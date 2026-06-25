import type { Store } from './db/index.js';
import {
  CONFIG_FIELDS,
  FIELD_DEFAULTS,
  FIELD_ENV,
  SECRET_FIELDS,
  type ConfigField,
} from './config.js';

/** Effective integration config — env wins over DB, defaults fill the rest. */
export interface EffectiveConfig {
  immich_url: string;
  immich_api_key: string;
  immich_album: string;
  vision_provider: string;
  vision_base_url: string;
  vision_api_key: string;
  vision_model: string;
  poll_interval_minutes: number;
}

/** Per-field masked view for the API. */
export interface FieldStatus {
  set: boolean;
  locked: boolean;
  value?: string | number;
}

export interface ConfigView {
  configured: boolean;
  fields: Record<ConfigField, FieldStatus>;
}

function envValue(field: ConfigField, env: NodeJS.ProcessEnv): string | undefined {
  const raw = env[FIELD_ENV[field]];
  if (raw == null) return undefined;
  const trimmed = String(raw).trim();
  return trimmed.length ? trimmed : undefined;
}

/**
 * Runtime config service. Each field's effective value = env var if set,
 * otherwise the value saved through the setup UI (DB), otherwise a default.
 * Env-set fields are "locked" (read-only in the UI / never overwritten by PUT).
 */
export class ConfigService {
  private store: Store;
  private env: NodeJS.ProcessEnv;
  private dbCache: Record<string, string> = {};
  private loaded = false;

  constructor(store: Store, env: NodeJS.ProcessEnv = process.env) {
    this.store = store;
    this.env = env;
  }

  /** Load DB-persisted config into the cache (once, then on demand). */
  async load(): Promise<void> {
    this.dbCache = await this.store.getAppConfig();
    this.loaded = true;
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.loaded) await this.load();
  }

  /** Is a field locked by an environment variable? */
  isLocked(field: ConfigField): boolean {
    return envValue(field, this.env) !== undefined;
  }

  /** Raw effective string for a field (env → db → default), or undefined. */
  private rawValue(field: ConfigField): string | undefined {
    const e = envValue(field, this.env);
    if (e !== undefined) return e;
    const d = this.dbCache[field];
    if (d != null && String(d).trim().length) return String(d).trim();
    return FIELD_DEFAULTS[field];
  }

  /** Compute the full effective integration config. */
  async getEffective(): Promise<EffectiveConfig> {
    await this.ensureLoaded();
    const poll = parseInt(this.rawValue('poll_interval_minutes') ?? '90', 10);
    return {
      immich_url: this.rawValue('immich_url') ?? '',
      immich_api_key: this.rawValue('immich_api_key') ?? '',
      immich_album: this.rawValue('immich_album') ?? 'Food',
      vision_provider: this.rawValue('vision_provider') ?? 'openai',
      vision_base_url: this.rawValue('vision_base_url') ?? 'https://api.openai.com/v1',
      vision_api_key: this.rawValue('vision_api_key') ?? '',
      vision_model: this.rawValue('vision_model') ?? 'gpt-4o-mini',
      poll_interval_minutes: Number.isFinite(poll) && poll >= 0 ? poll : 90,
    };
  }

  /** Effective Immich + vision config is complete. */
  async isConfigured(): Promise<boolean> {
    const c = await this.getEffective();
    return Boolean(
      c.immich_url &&
        c.immich_api_key &&
        c.immich_album &&
        c.vision_api_key &&
        c.vision_model &&
        c.vision_base_url,
    );
  }

  /** Masked view for GET /api/config — secrets never leak their plaintext. */
  async getView(): Promise<ConfigView> {
    await this.ensureLoaded();
    const fields = {} as Record<ConfigField, FieldStatus>;
    for (const field of CONFIG_FIELDS) {
      const locked = this.isLocked(field);
      const raw = this.rawValue(field);
      const secret = SECRET_FIELDS.has(field);
      // `set` reflects whether a real value exists (env or db), not the default.
      const hasReal =
        envValue(field, this.env) !== undefined ||
        (this.dbCache[field] != null && String(this.dbCache[field]).trim().length > 0);
      const status: FieldStatus = { set: hasReal, locked };
      if (!secret && raw !== undefined) {
        status.value =
          field === 'poll_interval_minutes' ? parseInt(raw, 10) : raw;
      }
      fields[field] = status;
    }
    return { configured: await this.isConfigured(), fields };
  }

  /**
   * Persist non-locked fields. Locked (env) fields in the patch are ignored.
   * Empty string clears the DB value (reverts to default / unset).
   */
  async update(patch: Partial<Record<ConfigField, string | number>>): Promise<ConfigView> {
    await this.ensureLoaded();
    const toSave: Record<string, string> = {};
    for (const field of CONFIG_FIELDS) {
      if (!(field in patch)) continue;
      if (this.isLocked(field)) continue; // never overwrite env-locked fields
      const v = patch[field];
      if (v === undefined || v === null) continue;
      toSave[field] = String(v).trim();
    }
    if (Object.keys(toSave).length) {
      this.dbCache = await this.store.setAppConfig(toSave);
    }
    return this.getView();
  }
}
