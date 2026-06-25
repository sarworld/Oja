import { randomUUID } from 'node:crypto';
import type { AppContext } from './context.js';
import type { NewEntry } from './db/types.js';
import { localDay } from './time.js';

/** A hard-failing asset is retried at most this many times before being parked. */
const MAX_SYNC_RETRIES = 3;

export interface SyncResult {
  added: number;
  skipped: number;
  notfood: number;
  errors: number;
  /** Logged entries whose photo is no longer in the source album. */
  missing: number;
  dishes: string[];
  /** Set when the sync did nothing because the integration isn't configured. */
  skippedReason?: string;
}

/**
 * Poll the configured Immich album, analyze every asset not already in the DB,
 * and insert results. Guarded by an in-memory lock (ctx.syncRunning).
 *
 * No-ops (with a clear log + `skippedReason`) until Immich + vision are
 * configured. Throws { code: 'busy' } if a sync is already in progress.
 */
export async function runSync(ctx: AppContext): Promise<SyncResult> {
  if (ctx.syncRunning) {
    const err = new Error('sync already running') as Error & { code?: string };
    err.code = 'busy';
    throw err;
  }

  const result: SyncResult = { added: 0, skipped: 0, notfood: 0, errors: 0, missing: 0, dishes: [] };

  if (!(await ctx.config.isConfigured())) {
    result.skippedReason = 'not configured';
    // eslint-disable-next-line no-console
    console.log('[sync] skipped — Immich/vision not configured yet');
    return result;
  }

  ctx.syncRunning = true;

  try {
    const immich = await ctx.immich();
    const assets = await immich.listAlbumAssets();

    for (const asset of assets) {
      let priorAttempts = 0;
      try {
        if (await ctx.store.hasAsset(asset.id)) {
          result.skipped++;
          continue;
        }

        // Remember assets seen-but-not-logged so we don't re-pay to analyze the
        // same non-food (or repeatedly broken) photo on every sync.
        const skip = await ctx.store.getSkip(asset.id);
        priorAttempts = skip?.attempts ?? 0;
        if (skip && (skip.reason === 'notfood' || skip.attempts >= MAX_SYNC_RETRIES)) {
          result.skipped++;
          continue;
        }

        const priors = await ctx.store.getHistoryPriors(30);
        const dataUrl = await immich.getDataUrl(asset.id, 'preview');
        const vr = await ctx.analyze(dataUrl, priors);

        if (!vr.is_food) {
          await ctx.store.setSkip(asset.id, 'notfood', 0);
          result.notfood++;
          continue;
        }

        const takenAt = asset.localDateTime ?? asset.fileCreatedAt ?? null;
        const day = localDay(takenAt, ctx.cfg.TZ);

        const entry: NewEntry = {
          id: randomUUID(),
          immich_asset_id: asset.id,
          taken_at: takenAt,
          day,
          logged_at: new Date().toISOString(),
          dish: vr.dish,
          items: vr.items,
          kcal: vr.total_kcal,
          protein_g: vr.total_protein_g,
          carbs_g: vr.total_carbs_g,
          fat_g: vr.total_fat_g,
          confidence: vr.confidence,
          notes: vr.notes,
          included: true,
          edited: false,
          source: 'auto',
          raw: vr.raw,
          chat: [],
        };

        await ctx.store.insertEntry(entry);
        if (skip) await ctx.store.clearSkip(asset.id);
        result.added++;
        if (vr.dish) result.dishes.push(vr.dish);
      } catch (e) {
        await ctx.store.setSkip(asset.id, 'error', priorAttempts + 1).catch(() => {});
        result.errors++;
        // eslint-disable-next-line no-console
        console.error(`[sync] asset ${asset.id} failed:`, (e as Error).message);
      }
    }

    // Flag logged meals whose photo is no longer in the source album. The album
    // listing succeeded (we're past listAlbumAssets), so this set is authoritative.
    result.missing = await ctx.store.reconcileSource(assets.map((a) => a.id));
  } finally {
    ctx.syncRunning = false;
  }

  return result;
}
