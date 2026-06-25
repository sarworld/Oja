import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { randomUUID } from 'node:crypto';
import { createApp } from '../app.js';
import { makeContext, memStore, testConfig } from './helpers.js';
import type { AppContext } from '../context.js';
import type { Store } from '../db/index.js';
import type { NewEntry } from '../db/types.js';

async function seedEntry(store: Store, over: Partial<NewEntry> = {}): Promise<string> {
  const id = over.id ?? randomUUID();
  const e: NewEntry = {
    id,
    immich_asset_id: over.immich_asset_id ?? randomUUID(),
    taken_at: null,
    day: over.day ?? '2026-01-01',
    logged_at: new Date().toISOString(),
    dish: over.dish ?? 'Seed Dish',
    items: over.items ?? [{ name: 'rice', kcal: 200, protein_g: 4, carbs_g: 44, fat_g: 1 }],
    kcal: over.kcal ?? 200,
    protein_g: over.protein_g ?? 4,
    carbs_g: over.carbs_g ?? 44,
    fat_g: over.fat_g ?? 1,
    confidence: 'low',
    notes: '',
    included: over.included ?? true,
    edited: false,
    source: 'auto',
    raw: {},
    chat: [],
    ...over,
  };
  await store.insertEntry(e);
  return id;
}

interface Harness {
  app: Express;
  ctx: AppContext;
  store: Store;
}

async function harness(env: NodeJS.ProcessEnv = {}): Promise<Harness> {
  const store = await memStore();
  const ctx = await makeContext({
    store,
    env,
    immich: {
      getThumbnailBytes: async () => ({
        bytes: Buffer.from('imgbytes'),
        contentType: 'image/jpeg',
      }),
    },
    analyze: async (_url, _priors, opts) => ({
      is_food: true,
      dish: 'Reanalyzed',
      items: [],
      total_kcal: 333,
      total_protein_g: 1,
      total_carbs_g: 2,
      total_fat_g: 3,
      confidence: 'medium',
      notes: 'note',
      reply: opts?.wantReply ? 'Sounds good!' : undefined,
      raw: {},
    }),
  });
  const app = createApp(testConfig(), ctx, { serveStatic: false });
  return { app, ctx, store };
}

async function authedAgent(app: Express) {
  const agent = request.agent(app);
  const res = await agent.post('/api/login').send({ password: 'secret' });
  expect(res.status).toBe(200);
  return agent;
}

describe('API auth guard', () => {
  let app: Express;
  beforeEach(async () => {
    ({ app } = await harness());
  });

  it('health is public and reports unconfigured', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, configured: false });
    expect(res.body.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('protected routes return 401 without a session', async () => {
    for (const path of ['/api/day', '/api/settings', '/api/history', '/api/config']) {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'auth' });
    }
  });

  it('login rejects a wrong password', async () => {
    const res = await request(app).post('/api/login').send({ password: 'nope' });
    expect(res.status).toBe(401);
  });

  it('login then access works; logout revokes', async () => {
    const agent = await authedAgent(app);
    expect((await agent.get('/api/settings')).status).toBe(200);
    await agent.post('/api/logout');
    expect((await agent.get('/api/settings')).status).toBe(401);
  });
});

describe('API day totals (included-only math)', () => {
  it('sums only included entries', async () => {
    const { app, store } = await harness();
    await seedEntry(store, { day: '2026-02-02', kcal: 500, included: true });
    await seedEntry(store, { day: '2026-02-02', kcal: 300, included: true });
    await seedEntry(store, { day: '2026-02-02', kcal: 999, included: false });
    const agent = await authedAgent(app);
    const res = await agent.get('/api/day?date=2026-02-02');
    expect(res.status).toBe(200);
    expect(res.body.totals.kcal).toBe(800);
    expect(res.body.totals.meals).toBe(2);
    expect(res.body.entries).toHaveLength(3); // all entries returned, only included counted
  });
});

describe('API entry mutations', () => {
  it('toggle flips included', async () => {
    const { app, store } = await harness();
    const id = await seedEntry(store, { included: true });
    const agent = await authedAgent(app);
    const res = await agent.post(`/api/entries/${id}/toggle`);
    expect(res.body.included).toBe(false);
    const again = await agent.post(`/api/entries/${id}/toggle`);
    expect(again.body.included).toBe(true);
  });

  it('PATCH updates fields and marks edited/manual', async () => {
    const { app, store } = await harness();
    const id = await seedEntry(store);
    const agent = await authedAgent(app);
    const res = await agent.patch(`/api/entries/${id}`).send({ dish: 'Edited', kcal: 123.7 });
    expect(res.status).toBe(200);
    expect(res.body.dish).toBe('Edited');
    expect(res.body.kcal).toBe(124); // rounded
    expect(res.body.edited).toBe(true);
    expect(res.body.source).toBe('manual');
  });

  it('PATCH rejects an invalid body', async () => {
    const { app, store } = await harness();
    const id = await seedEntry(store);
    const agent = await authedAgent(app);
    const res = await agent.patch(`/api/entries/${id}`).send({ kcal: 'lots' });
    expect(res.status).toBe(400);
  });

  it('reanalyze re-runs vision and stores the result', async () => {
    const { app, store } = await harness();
    const id = await seedEntry(store);
    const agent = await authedAgent(app);
    const res = await agent.post(`/api/entries/${id}/reanalyze`).send({ text: 'double portion' });
    expect(res.status).toBe(200);
    expect(res.body.kcal).toBe(333);
    expect(res.body.source).toBe('reanalyzed');
  });

  it('chat appends turns and returns a reply', async () => {
    const { app, store } = await harness();
    const id = await seedEntry(store);
    const agent = await authedAgent(app);
    const res = await agent.post(`/api/entries/${id}/chat`).send({ message: 'no rice' });
    expect(res.status).toBe(200);
    expect(res.body.reply).toBe('Sounds good!');
    expect(res.body.entry.chat).toEqual([
      { role: 'user', text: 'no rice' },
      { role: 'assistant', text: 'Sounds good!' },
    ]);
    expect(res.body.entry.source).toBe('chat');
  });

  it('chat requires a message', async () => {
    const { app, store } = await harness();
    const id = await seedEntry(store);
    const agent = await authedAgent(app);
    expect((await agent.post(`/api/entries/${id}/chat`).send({})).status).toBe(400);
  });

  it('delete removes the entry', async () => {
    const { app, store } = await harness();
    const id = await seedEntry(store);
    const agent = await authedAgent(app);
    expect((await agent.delete(`/api/entries/${id}`)).body).toEqual({ ok: true });
    expect((await agent.delete(`/api/entries/${id}`)).status).toBe(404);
  });
});

describe('API settings + history', () => {
  it('GET/PUT settings round-trip', async () => {
    const { app } = await harness();
    const agent = await authedAgent(app);
    const before = await agent.get('/api/settings');
    expect(before.body.goal_kcal).toBe(2000);
    const after = await agent.put('/api/settings').send({ goal_kcal: 2500 });
    expect(after.body.goal_kcal).toBe(2500);
  });

  it('history aggregates included entries by day', async () => {
    const { app, store } = await harness();
    const today = new Date().toISOString().slice(0, 10);
    await seedEntry(store, { day: today, kcal: 400, included: true });
    await seedEntry(store, { day: today, kcal: 600, included: false });
    const agent = await authedAgent(app);
    const res = await agent.get('/api/history?days=30');
    const day = res.body.days.find((d: { day: string }) => d.day === today);
    expect(day.kcal).toBe(400); // excluded entry not summed
    expect(day.meals).toBe(1);
  });

  it('history excludes days older than the requested window (old photos)', async () => {
    const { app, store } = await harness();
    const today = new Date().toISOString().slice(0, 10);
    await seedEntry(store, { day: today, kcal: 500, included: true });
    await seedEntry(store, { day: '2018-11-29', kcal: 999, included: true }); // ~8 years old
    const agent = await authedAgent(app);
    const res = await agent.get('/api/history?days=30');
    const days = res.body.days.map((d: { day: string }) => d.day);
    expect(days).toContain(today);
    expect(days).not.toContain('2018-11-29');
  });
});

describe('API config endpoint', () => {
  it('GET masks secrets and PUT saves non-locked fields', async () => {
    const { app } = await harness();
    const agent = await authedAgent(app);
    const before = await agent.get('/api/config');
    expect(before.body.configured).toBe(false);
    expect(before.body.fields.immich_api_key.set).toBe(false);

    const put = await agent.put('/api/config').send({
      immich_url: 'https://immich.example.com',
      immich_api_key: 'secret-key',
      immich_album: 'Food',
      vision_api_key: 'vis-key',
      vision_model: 'gpt-4o',
    });
    expect(put.status).toBe(200);
    expect(put.body.configured).toBe(true);
    // secret never echoed back
    expect(put.body.fields.immich_api_key).not.toHaveProperty('value');
    expect(put.body.fields.immich_api_key.set).toBe(true);
    expect(put.body.fields.immich_url.value).toBe('https://immich.example.com');
  });

  it('PUT does not change env-locked fields', async () => {
    const { app } = await harness({ VISION_API_KEY: 'env-vision-key' });
    const agent = await authedAgent(app);
    const view = await agent.get('/api/config');
    expect(view.body.fields.vision_api_key.locked).toBe(true);

    await agent.put('/api/config').send({ vision_api_key: 'override-attempt' });
    const after = await agent.get('/api/config');
    // still locked, and the effective value is the env one (not exposed, but locked stays)
    expect(after.body.fields.vision_api_key.locked).toBe(true);
  });

  it('health reflects configuration after PUT', async () => {
    const { app } = await harness();
    const agent = await authedAgent(app);
    await agent.put('/api/config').send({
      immich_url: 'https://immich.example.com',
      immich_api_key: 'k',
      vision_api_key: 'v',
      vision_model: 'm',
    });
    const res = await request(app).get('/api/health');
    expect(res.body.configured).toBe(true);
  });
});
