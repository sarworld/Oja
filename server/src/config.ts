import { randomBytes } from 'node:crypto';
import { z } from 'zod';

/**
 * Boot-time environment.
 *
 * v1.1: the server MUST always start. Only PORT / APP_PASSWORD / SESSION_SECRET /
 * DATABASE_URL / TZ are read at boot; everything Immich/vision related is now part
 * of the *runtime* config (env-or-DB) handled by the config service. There is no
 * `process.exit` on missing integration config anymore.
 *
 * APP_PASSWORD and SESSION_SECRET fall back to generated values so an
 * un-provisioned container still boots (with a clear warning). For any real
 * deployment they should be set explicitly.
 */

/** Runtime-configurable integration fields (env var OR DB value). */
export const CONFIG_FIELDS = [
  'immich_url',
  'immich_api_key',
  'immich_album',
  'vision_provider',
  'vision_base_url',
  'vision_api_key',
  'vision_model',
  'poll_interval_minutes',
] as const;

export type ConfigField = (typeof CONFIG_FIELDS)[number];

/** Which runtime fields are secrets (never returned to the browser). */
export const SECRET_FIELDS: ReadonlySet<ConfigField> = new Set<ConfigField>([
  'immich_api_key',
  'vision_api_key',
]);

/** Map of runtime field → the env var that locks it. */
export const FIELD_ENV: Record<ConfigField, string> = {
  immich_url: 'IMMICH_URL',
  immich_api_key: 'IMMICH_API_KEY',
  immich_album: 'IMMICH_ALBUM',
  vision_provider: 'VISION_PROVIDER',
  vision_base_url: 'VISION_BASE_URL',
  vision_api_key: 'VISION_API_KEY',
  vision_model: 'VISION_MODEL',
  poll_interval_minutes: 'POLL_INTERVAL_MINUTES',
};

/** Defaults applied when neither env nor DB provides a value. */
export const FIELD_DEFAULTS: Partial<Record<ConfigField, string>> = {
  immich_album: 'Food',
  vision_provider: 'openai',
  vision_base_url: 'https://api.openai.com/v1',
  vision_model: 'gpt-4o-mini',
  poll_interval_minutes: '90',
};

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8462),
  APP_PASSWORD: z.string().min(1).optional(),
  SESSION_SECRET: z.string().min(1).optional(),
  DATABASE_URL: z.string().default('sqlite:./data/oja.db'),
  TZ: z.string().min(1).default('UTC'),
  // Set true when Oja is served over HTTPS (e.g. behind a TLS reverse proxy) so
  // the session cookie gets the Secure flag. Default false keeps plain-HTTP LAN
  // deploys working.
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
});

export interface Config {
  PORT: number;
  APP_PASSWORD: string;
  SESSION_SECRET: string;
  DATABASE_URL: string;
  TZ: string;
  COOKIE_SECURE: boolean;
}

let cached: Config | null = null;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  if (cached) return cached;
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    // Boot-time env is so minimal this should essentially never fail, but if it
    // does we still want to surface a clear message rather than crash silently.
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    // eslint-disable-next-line no-console
    console.error(`[oja] Invalid boot environment:\n${issues}`);
  }
  const data = parsed.success ? parsed.data : envSchema.parse({});

  let appPassword = data.APP_PASSWORD;
  if (!appPassword) {
    appPassword = randomBytes(18).toString('base64url');
    // eslint-disable-next-line no-console
    console.warn(
      `[oja] APP_PASSWORD not set — generated a temporary one for this run: ${appPassword}\n` +
        '      Set APP_PASSWORD in the environment for a stable login password.',
    );
  }
  let sessionSecret = data.SESSION_SECRET;
  if (!sessionSecret) {
    sessionSecret = randomBytes(32).toString('hex');
    // eslint-disable-next-line no-console
    console.warn(
      '[oja] SESSION_SECRET not set — generated an ephemeral one (sessions reset on restart).',
    );
  }

  cached = {
    PORT: data.PORT,
    APP_PASSWORD: appPassword,
    SESSION_SECRET: sessionSecret,
    DATABASE_URL: data.DATABASE_URL,
    TZ: data.TZ,
    COOKIE_SECURE: data.COOKIE_SECURE,
  };
  // Apply TZ so day-boundary date math uses it.
  process.env.TZ = cached.TZ;
  return cached;
}

/** Reset the cached boot config (tests only). */
export function resetConfigCache(): void {
  cached = null;
}
