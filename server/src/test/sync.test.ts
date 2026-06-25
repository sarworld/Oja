import { describe, it, expect, vi } from 'vitest';
import { makeContext, memStore } from './helpers.js';
import { runSync } from '../sync.js';
import type { VisionResult } from '../providers/index.js';

function foodResult(over: Partial<VisionResult> = {}): VisionResult {
  return {
    is_food: true,
    dish: 'Dish',
    items: [],
    total_kcal: 100,
    total_protein_g: 10,
    total_carbs_g: 10,
    total_fat_g: 5,
    confidence: 'low',
    notes: '',
    raw: {},
    ...over,
  };
}

async function configuredCtx(opts: NonNullable<Parameters<typeof makeContext>[0]>) {
  const store = opts.store ?? (await memStore());
  const ctx = await makeContext({ ...opts, store });
  await ctx.config.update({
    immich_url: 'https://immich.example.com',
    immich_api_key: 'k',
    vision_api_key: 'v',
    vision_model: 'm',
  });
  return ctx;
}

describe('runSync', () => {
  it('no-ops with a reason when not configured', async () => {
    const ctx = await makeContext({});
    const r = await runSync(ctx);
    expect(r.skippedReason).toBe('not configured');
    expect(r.added).toBe(0);
  });

  it('adds food entries and skips already-seen assets (dedup)', async () => {
    const ctx = await configuredCtx({
      immich: {
        listAlbumAssets: async () => [{ id: 'a1' }, { id: 'a2' }],
      },
      analyze: async () => foodResult({ dish: 'Pasta' }),
    });
    const first = await runSync(ctx);
    expect(first.added).toBe(2);
    expect(first.dishes).toContain('Pasta');
    // second run: both already present → skipped, nothing added
    const second = await runSync(ctx);
    expect(second.added).toBe(0);
    expect(second.skipped).toBe(2);
  });

  it('counts non-food and does not insert it', async () => {
    const ctx = await configuredCtx({
      immich: { listAlbumAssets: async () => [{ id: 'x' }] },
      analyze: async () => foodResult({ is_food: false }),
    });
    const r = await runSync(ctx);
    expect(r.notfood).toBe(1);
    expect(r.added).toBe(0);
  });

  it('does not re-analyze a non-food asset on later syncs', async () => {
    const analyze = vi.fn(async () => foodResult({ is_food: false }));
    const ctx = await configuredCtx({
      immich: { listAlbumAssets: async () => [{ id: 'nf' }] },
      analyze,
    });
    const first = await runSync(ctx);
    expect(first.notfood).toBe(1);
    const second = await runSync(ctx);
    expect(second.skipped).toBe(1); // remembered as non-food
    expect(second.notfood).toBe(0);
    expect(analyze).toHaveBeenCalledOnce(); // only analyzed the first time
  });

  it('parks an asset that keeps failing after a few retries', async () => {
    const analyze = vi.fn(async () => {
      throw new Error('boom');
    });
    const ctx = await configuredCtx({
      immich: { listAlbumAssets: async () => [{ id: 'err' }] },
      analyze,
    });
    await runSync(ctx);
    await runSync(ctx);
    await runSync(ctx);
    expect(analyze).toHaveBeenCalledTimes(3); // retried up to the cap
    const r = await runSync(ctx);
    expect(analyze).toHaveBeenCalledTimes(3); // then parked, not retried
    expect(r.skipped).toBe(1);
    expect(r.errors).toBe(0);
  });

  it('flags entries whose photo left the source, and clears it when re-added', async () => {
    let present: Array<{ id: string }> = [{ id: 'p1' }, { id: 'p2' }];
    const ctx = await configuredCtx({
      immich: { listAlbumAssets: async () => present },
      analyze: vi.fn(async () => foodResult({ is_food: true })),
    });
    const first = await runSync(ctx); // logs p1 + p2
    expect(first.added).toBe(2);
    expect(first.missing).toBe(0);

    present = [{ id: 'p1' }]; // p2 removed from the album
    const second = await runSync(ctx);
    expect(second.missing).toBe(1);

    present = [{ id: 'p1' }, { id: 'p2' }]; // p2 put back
    const third = await runSync(ctx);
    expect(third.missing).toBe(0);
  });

  it('one bad photo does not abort the whole sync', async () => {
    let n = 0;
    const ctx = await configuredCtx({
      immich: { listAlbumAssets: async () => [{ id: 'bad' }, { id: 'good' }] },
      analyze: async () => {
        n++;
        if (n === 1) throw new Error('vision exploded');
        return foodResult({ dish: 'Salad' });
      },
    });
    const r = await runSync(ctx);
    expect(r.errors).toBe(1);
    expect(r.added).toBe(1);
    expect(r.dishes).toContain('Salad');
  });

  it('throws busy when a sync is already running (in-memory lock)', async () => {
    const ctx = await configuredCtx({
      immich: { listAlbumAssets: async () => [] },
    });
    ctx.syncRunning = true;
    await expect(runSync(ctx)).rejects.toMatchObject({ code: 'busy' });
  });

  it('releases the lock after completion', async () => {
    const ctx = await configuredCtx({
      immich: { listAlbumAssets: async () => [] },
    });
    await runSync(ctx);
    expect(ctx.syncRunning).toBe(false);
  });

  it('uses the effective config (analyze called with priors)', async () => {
    const analyze =
      vi.fn<(url: string, priors: unknown[]) => Promise<VisionResult>>(async () =>
        foodResult(),
      );
    const ctx = await configuredCtx({
      immich: { listAlbumAssets: async () => [{ id: 'p1' }] },
      analyze,
    });
    await runSync(ctx);
    expect(analyze).toHaveBeenCalledOnce();
    // priors arg is an array
    expect(Array.isArray(analyze.mock.calls[0][1])).toBe(true);
  });
});
