import type { Config } from './config.js';
import { ConfigService, type EffectiveConfig } from './config-service.js';
import type { Store } from './db/index.js';
import { ImmichClient } from './immich.js';
import { analyze, type AnalyzeOptions } from './vision.js';
import type { HistoryPrior } from './db/types.js';
import type { VisionResult } from './providers/index.js';

/**
 * Shared app context handed to routes. Immich + vision are resolved from the
 * *effective* config at call time, so changes made through the setup UI take
 * effect without a restart.
 */
export interface AppContext {
  cfg: Config;
  store: Store;
  config: ConfigService;
  /** In-memory lock so only one sync runs at a time. */
  syncRunning: boolean;
  /** Build an Immich client from the current effective config. */
  immich(): Promise<ImmichClient>;
  /** Run a vision estimate with the current effective config. */
  analyze(
    imageDataUrl: string,
    priors: HistoryPrior[],
    opts?: AnalyzeOptions,
  ): Promise<VisionResult>;
  /** Convenience: the current effective integration config. */
  effective(): Promise<EffectiveConfig>;
}

export function createContext(cfg: Config, store: Store): AppContext {
  const svc = new ConfigService(store);

  return {
    cfg,
    store,
    config: svc,
    syncRunning: false,
    async effective() {
      return svc.getEffective();
    },
    async immich() {
      const c = await svc.getEffective();
      return new ImmichClient({
        url: c.immich_url,
        api_key: c.immich_api_key,
        album: c.immich_album,
      });
    },
    async analyze(imageDataUrl, priors, opts) {
      const c = await svc.getEffective();
      return analyze(c, imageDataUrl, priors, opts);
    },
  };
}
