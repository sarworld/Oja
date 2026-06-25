import { Router } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { CONFIG_FIELDS } from '../config.js';
import type { ConfigField } from '../config.js';
import type { AppContext } from '../context.js';
import { requireAuth } from '../auth.js';
import { runSync } from '../sync.js';
import { todayLocal } from '../time.js';
import { computeTotals } from './totals.js';
import type { Entry } from '../db/types.js';
import { ImmichClient } from '../immich.js';
import { testVision } from '../vision.js';
import { VERSION } from '../version.js';
import { PRESETS } from '../providers/index.js';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const patchSchema = z.object({
  dish: z.string().optional(),
  notes: z.string().optional(),
  kcal: z.number().optional(),
  protein_g: z.number().optional(),
  carbs_g: z.number().optional(),
  fat_g: z.number().optional(),
});

const settingsSchema = z.object({
  goal_kcal: z.number().int().positive().optional(),
  goal_protein_g: z.number().nonnegative().optional(),
  goal_carbs_g: z.number().nonnegative().optional(),
  goal_fat_g: z.number().nonnegative().optional(),
});

const configSchema = z.object({
  immich_url: z.string().optional(),
  immich_api_key: z.string().optional(),
  immich_album: z.string().optional(),
  vision_provider: z.string().optional(),
  vision_base_url: z.string().optional(),
  vision_api_key: z.string().optional(),
  vision_model: z.string().optional(),
  poll_interval_minutes: z.union([z.number(), z.string()]).optional(),
});

// Throttle login attempts (single shared password → brute-forceable otherwise).
const loginLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_attempts' },
  skip: () => process.env.NODE_ENV === 'test',
});

// Light throttle on the LLM-calling / mutating endpoints. These are all behind
// auth, so this is not anti-DoS — it's a backstop so a leaked password or a
// buggy client retry loop can't rack up vision-API cost. Generous on purpose.
const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests' },
  skip: () => process.env.NODE_ENV === 'test',
});

// Constant-time password comparison. Hashing both sides first equalizes length
// so timingSafeEqual never throws and leaks nothing via length.
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function buildRouter(ctx: AppContext): Router {
  const r = Router();

  // ---- public: health + login --------------------------------------------
  r.get('/health', async (_req, res, next) => {
    try {
      res.json({ ok: true, version: VERSION, configured: await ctx.config.isConfigured() });
    } catch (e) {
      next(e);
    }
  });

  r.post('/login', loginLimiter, (req, res) => {
    const password = (req.body as { password?: unknown })?.password;
    if (typeof password === 'string' && safeEqual(password, ctx.cfg.APP_PASSWORD)) {
      (req.session as { authed?: boolean }).authed = true;
      res.status(200).json({ ok: true });
      return;
    }
    res.status(401).json({ error: 'auth' });
  });

  r.post('/logout', (req, res) => {
    if (req.session) (req.session as { authed?: boolean }).authed = false;
    res.status(200).json({ ok: true });
  });

  // ---- everything below requires auth -------------------------------------
  r.use(requireAuth);

  // ---- runtime config -----------------------------------------------------
  r.get('/config', async (_req, res, next) => {
    try {
      res.json(await ctx.config.getView());
    } catch (e) {
      next(e);
    }
  });

  r.get('/config/presets', (_req, res) => {
    res.json(PRESETS);
  });

  r.put('/config', async (req, res, next) => {
    try {
      const parsed = configSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'invalid body' });
        return;
      }
      const patch: Partial<Record<ConfigField, string | number>> = {};
      for (const field of CONFIG_FIELDS) {
        const v = (parsed.data as Record<string, unknown>)[field];
        if (v !== undefined) patch[field] = v as string | number;
      }
      res.json(await ctx.config.update(patch));
    } catch (e) {
      next(e);
    }
  });

  r.post('/config/test-immich', async (req, res) => {
    try {
      const body = (req.body ?? {}) as { url?: string; api_key?: string };
      const eff = await ctx.config.getEffective();
      const url = body.url?.trim() || eff.immich_url;
      const api_key = body.api_key?.trim() || eff.immich_api_key;
      if (!url || !api_key) {
        res.json({ ok: false, error: 'Immich URL and API key are required' });
        return;
      }
      const client = new ImmichClient({ url, api_key, album: eff.immich_album });
      const albums = await client.listAlbums();
      res.json({ ok: true, albums });
    } catch (e) {
      res.json({ ok: false, error: (e as Error).message });
    }
  });

  r.post('/config/test-vision', async (req, res) => {
    try {
      const body = (req.body ?? {}) as {
        provider?: string;
        base_url?: string;
        api_key?: string;
        model?: string;
      };
      const eff = await ctx.config.getEffective();
      const provider = body.provider?.trim() || eff.vision_provider;
      const base_url = body.base_url?.trim() || eff.vision_base_url;
      const api_key = body.api_key?.trim() || eff.vision_api_key;
      const model = body.model?.trim() || eff.vision_model;
      if (!api_key || !model) {
        res.json({ ok: false, error: 'API key and model are required' });
        return;
      }
      res.json(await testVision({ provider, base_url, api_key, model }));
    } catch (e) {
      res.json({ ok: false, error: (e as Error).message });
    }
  });

  r.get('/immich/albums', async (_req, res, next) => {
    try {
      const eff = await ctx.config.getEffective();
      if (!eff.immich_url || !eff.immich_api_key) {
        res.status(400).json({ error: 'Immich not configured' });
        return;
      }
      const client = new ImmichClient({
        url: eff.immich_url,
        api_key: eff.immich_api_key,
        album: eff.immich_album,
      });
      res.json(await client.listAlbums());
    } catch (e) {
      next(e);
    }
  });

  // ---- diary --------------------------------------------------------------
  r.get('/day', async (req, res, next) => {
    try {
      const raw = (req.query.date as string | undefined) ?? todayLocal(ctx.cfg.TZ);
      const parsed = dateSchema.safeParse(raw);
      const date = parsed.success ? parsed.data : todayLocal(ctx.cfg.TZ);
      const [settings, entries] = await Promise.all([
        ctx.store.getSettings(),
        ctx.store.getEntriesForDay(date),
      ]);
      res.json({ date, settings, totals: computeTotals(entries), entries });
    } catch (e) {
      next(e);
    }
  });

  r.post('/sync', apiLimiter, async (_req, res, next) => {
    try {
      const result = await runSync(ctx);
      res.json(result);
    } catch (e) {
      if ((e as { code?: string }).code === 'busy') {
        res.status(409).json({ error: 'sync already running' });
        return;
      }
      next(e);
    }
  });

  r.post('/entries/:id/toggle', async (req, res, next) => {
    try {
      const entry = await ctx.store.getEntry(req.params.id as string);
      if (!entry) {
        res.status(404).json({ error: 'not found' });
        return;
      }
      const updated = await ctx.store.updateEntry(entry.id, {
        included: !entry.included,
      });
      res.json({ included: updated?.included ?? !entry.included });
    } catch (e) {
      next(e);
    }
  });

  r.patch('/entries/:id', async (req, res, next) => {
    try {
      const parsed = patchSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'invalid body' });
        return;
      }
      const entry = await ctx.store.getEntry(req.params.id as string);
      if (!entry) {
        res.status(404).json({ error: 'not found' });
        return;
      }
      const p = parsed.data;
      const patch: Partial<Entry> = { edited: true, source: 'manual' };
      if (p.dish !== undefined) patch.dish = p.dish;
      if (p.notes !== undefined) patch.notes = p.notes;
      if (p.kcal !== undefined) patch.kcal = Math.round(p.kcal);
      if (p.protein_g !== undefined) patch.protein_g = p.protein_g;
      if (p.carbs_g !== undefined) patch.carbs_g = p.carbs_g;
      if (p.fat_g !== undefined) patch.fat_g = p.fat_g;
      const updated = await ctx.store.updateEntry(entry.id, patch);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  });

  r.post('/entries/:id/reanalyze', apiLimiter, async (req, res, next) => {
    try {
      const text = (req.body as { text?: unknown })?.text;
      const userText = typeof text === 'string' ? text : undefined;
      const entry = await ctx.store.getEntry(req.params.id as string);
      if (!entry) {
        res.status(404).json({ error: 'not found' });
        return;
      }
      const priors = await ctx.store.getHistoryPriors(30);
      const immich = await ctx.immich();
      const dataUrl = await immich.getDataUrl(entry.immich_asset_id, 'preview');
      const vr = await ctx.analyze(dataUrl, priors, { userText, wantReply: true });

      const updated = await ctx.store.updateEntry(entry.id, {
        dish: vr.dish || entry.dish,
        items: vr.items,
        kcal: vr.total_kcal,
        protein_g: vr.total_protein_g,
        carbs_g: vr.total_carbs_g,
        fat_g: vr.total_fat_g,
        confidence: vr.confidence,
        notes: vr.notes,
        edited: true,
        source: 'reanalyzed',
        raw: vr.raw,
      });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  });

  r.post('/entries/:id/chat', apiLimiter, async (req, res, next) => {
    try {
      const message = (req.body as { message?: unknown })?.message;
      if (typeof message !== 'string' || !message.trim()) {
        res.status(400).json({ error: 'message required' });
        return;
      }
      const entry = await ctx.store.getEntry(req.params.id as string);
      if (!entry) {
        res.status(404).json({ error: 'not found' });
        return;
      }
      const priors = await ctx.store.getHistoryPriors(30);
      const immich = await ctx.immich();
      const dataUrl = await immich.getDataUrl(entry.immich_asset_id, 'preview');
      const vr = await ctx.analyze(dataUrl, priors, {
        userText: message,
        wantReply: true,
        chatHistory: entry.chat,
      });

      const reply = vr.reply ?? vr.notes ?? 'Updated.';
      const chat = [
        ...entry.chat,
        { role: 'user', text: message },
        { role: 'assistant', text: reply },
      ];

      const updated = await ctx.store.updateEntry(entry.id, {
        dish: vr.dish || entry.dish,
        items: vr.items,
        kcal: vr.total_kcal,
        protein_g: vr.total_protein_g,
        carbs_g: vr.total_carbs_g,
        fat_g: vr.total_fat_g,
        confidence: vr.confidence,
        notes: vr.notes,
        edited: true,
        source: 'chat',
        raw: vr.raw,
        chat,
      });
      res.json({ entry: updated, reply });
    } catch (e) {
      next(e);
    }
  });

  r.delete('/entries/:id', async (req, res, next) => {
    try {
      const ok = await ctx.store.deleteEntry(req.params.id);
      if (!ok) {
        res.status(404).json({ error: 'not found' });
        return;
      }
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  r.get('/settings', async (_req, res, next) => {
    try {
      res.json(await ctx.store.getSettings());
    } catch (e) {
      next(e);
    }
  });

  r.put('/settings', async (req, res, next) => {
    try {
      const parsed = settingsSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'invalid body' });
        return;
      }
      res.json(await ctx.store.updateSettings(parsed.data));
    } catch (e) {
      next(e);
    }
  });

  r.get('/history', async (req, res, next) => {
    try {
      const daysRaw = parseInt((req.query.days as string) ?? '30', 10);
      const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(daysRaw, 365) : 30;
      const [agg, settings] = await Promise.all([
        ctx.store.getHistory(days),
        ctx.store.getSettings(),
      ]);
      res.json({ days: agg, settings });
    } catch (e) {
      next(e);
    }
  });

  r.get('/photo/:assetId', async (req, res, next) => {
    try {
      const sizeRaw = (req.query.size as string | undefined) ?? 'thumbnail';
      const size = sizeRaw === 'preview' ? 'preview' : 'thumbnail';
      const immich = await ctx.immich();
      const { bytes, contentType } = await immich.getThumbnailBytes(
        req.params.assetId,
        size,
      );
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.send(bytes);
    } catch (e) {
      next(e);
    }
  });

  return r;
}
