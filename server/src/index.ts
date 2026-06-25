import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadConfig } from './config.js';
import { createStore } from './db/index.js';
import { createContext } from './context.js';
import { createApp } from './app.js';
import { runSync } from './sync.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const cfg = loadConfig();
  const store = await createStore(cfg);
  const ctx = createContext(cfg, store);

  // dist/index.js → ../../web/dist relative to this file at runtime.
  const webDist = resolve(__dirname, '../../web/dist');
  const app = createApp(cfg, ctx, { staticDir: webDist });

  // Warm the config cache so the first health/config call is instant.
  await ctx.config.load();
  const configured = await ctx.config.isConfigured();

  const server = app.listen(cfg.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(
      `[oja] listening on :${cfg.PORT} (TZ=${cfg.TZ})` +
        (configured ? '' : ' — not configured yet, visit /setup'),
    );
  });

  // Poller. The interval reflects the *effective* poll_interval_minutes, which
  // is re-read on every tick so config changes take effect without a restart.
  // We schedule a fixed 1-minute heartbeat and only sync when due + configured.
  let lastRun = 0;
  const heartbeatMs = 60 * 1000;
  const tick = async () => {
    try {
      await ctx.config.load(); // pick up UI config changes
      const eff = await ctx.config.getEffective();
      if (eff.poll_interval_minutes <= 0) return; // auto-poll disabled
      const dueMs = eff.poll_interval_minutes * 60 * 1000;
      if (Date.now() - lastRun < dueMs) return;
      if (!(await ctx.config.isConfigured())) return;
      lastRun = Date.now();
      const r = await runSync(ctx);
      // eslint-disable-next-line no-console
      console.log(
        `[oja] poll: +${r.added} added, ${r.skipped} skipped, ${r.notfood} not-food, ${r.errors} errors`,
      );
    } catch (e) {
      if ((e as { code?: string }).code !== 'busy') {
        // eslint-disable-next-line no-console
        console.error('[oja] poll failed:', (e as Error).message);
      }
    }
  };
  if (configured) void tick();
  const timer = setInterval(() => void tick(), heartbeatMs);
  timer.unref?.();
  // eslint-disable-next-line no-console
  console.log('[oja] poller heartbeat every 1min (interval from effective config)');

  const shutdown = async () => {
    // eslint-disable-next-line no-console
    console.log('[oja] shutting down…');
    server.close();
    await store.close().catch(() => {});
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[oja] fatal:', e);
  process.exit(1);
});
