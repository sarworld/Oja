import { SqliteStore } from '../db/sqlite.js';
import { PostgresStore } from '../db/postgres.js';
import type { Store } from '../db/index.js';
import type { Config } from '../config.js';
import type { AppContext } from '../context.js';
import { ConfigService } from '../config-service.js';
import type { HistoryPrior } from '../db/types.js';
import type { VisionResult } from '../providers/index.js';
import type { AnalyzeOptions } from '../vision.js';
import { ImmichClient } from '../immich.js';

export function testConfig(): Config {
  return {
    PORT: 0,
    APP_PASSWORD: 'secret',
    SESSION_SECRET: 'test-session-secret',
    DATABASE_URL: 'sqlite::memory:',
    TZ: 'UTC',
    COOKIE_SECURE: false,
  };
}

// Build a fresh store for a test. Defaults to in-memory SQLite. When
// TEST_DATABASE_URL points at Postgres (used by the Postgres CI job), it builds
// a PostgresStore and drops/recreates the schema so each test starts clean.
export async function memStore(): Promise<Store> {
  const url = process.env.TEST_DATABASE_URL;
  if (url && url.startsWith('postgres')) {
    const store = new PostgresStore(url);
    await store.reset();
    await store.init();
    return store;
  }
  const store = new SqliteStore(':memory:');
  await store.init();
  return store;
}

export interface FakeImmich {
  listAlbumAssets: () => Promise<Array<{ id: string; localDateTime?: string }>>;
  getDataUrl: (id: string) => Promise<string>;
  getThumbnailBytes?: (
    id: string,
  ) => Promise<{ bytes: Buffer; contentType: string }>;
}

/**
 * Build an AppContext with stubbed immich() + analyze() for tests.
 * `env` lets a test simulate locked env-var config.
 */
export async function makeContext(opts: {
  store?: Store;
  env?: NodeJS.ProcessEnv;
  immich?: Partial<FakeImmich>;
  analyze?: (
    imageDataUrl: string,
    priors: HistoryPrior[],
    o?: AnalyzeOptions,
  ) => Promise<VisionResult>;
} = {}): Promise<AppContext> {
  const store = opts.store ?? (await memStore());
  const cfg = testConfig();
  const svc = new ConfigService(store, opts.env ?? {});
  await svc.load();

  const fakeImmich = {
    listAlbumAssets: opts.immich?.listAlbumAssets ?? (async () => []),
    getDataUrl: opts.immich?.getDataUrl ?? (async () => 'data:image/png;base64,AAAA'),
    getThumbnailBytes:
      opts.immich?.getThumbnailBytes ??
      (async () => ({ bytes: Buffer.from('img'), contentType: 'image/jpeg' })),
  } as unknown as ImmichClient;

  const analyzeFn =
    opts.analyze ??
    (async (): Promise<VisionResult> => ({
      is_food: true,
      dish: 'Test dish',
      items: [],
      total_kcal: 100,
      total_protein_g: 10,
      total_carbs_g: 10,
      total_fat_g: 5,
      confidence: 'low',
      notes: '',
      raw: {},
    }));

  return {
    cfg,
    store,
    config: svc,
    syncRunning: false,
    async effective() {
      return svc.getEffective();
    },
    async immich() {
      return fakeImmich;
    },
    async analyze(imageDataUrl, priors, o) {
      return analyzeFn(imageDataUrl, priors, o);
    },
  };
}
