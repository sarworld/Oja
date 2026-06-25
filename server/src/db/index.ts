import type { Config } from '../config.js';
import { PostgresStore } from './postgres.js';
import { SqliteStore } from './sqlite.js';
import type { Store } from './types.js';

export type { Store } from './types.js';
export * from './types.js';

/**
 * Build the data store from DATABASE_URL.
 * - `postgres://…` / `postgresql://…` → PostgresStore
 * - `sqlite:./path` or a bare path     → SqliteStore
 */
export async function createStore(cfg: Config): Promise<Store> {
  const url = cfg.DATABASE_URL.trim();
  let store: Store;

  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    store = new PostgresStore(url);
  } else {
    const filePath = url.startsWith('sqlite:') ? url.slice('sqlite:'.length) : url;
    store = new SqliteStore(filePath || './data/oja.db');
  }

  await store.init();
  return store;
}
