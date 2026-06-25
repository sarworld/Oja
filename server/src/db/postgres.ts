import pg from 'pg';
import type {
  DayAggregate,
  Entry,
  HistoryPrior,
  NewEntry,
  Settings,
  Store,
} from './types.js';
import { normalizeDish, stripNul } from './util.js';

const { Pool } = pg;

interface EntryRow {
  id: string;
  immich_asset_id: string;
  taken_at: string | null;
  day: string;
  logged_at: string;
  dish: string;
  items: unknown;
  kcal: number;
  protein_g: string | number;
  carbs_g: string | number;
  fat_g: string | number;
  confidence: string;
  notes: string;
  included: boolean;
  edited: boolean;
  source: string;
  source_missing: boolean;
  raw: unknown;
  chat: unknown;
}

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === 'number' ? v : parseFloat(v) || 0;
}

function rowToEntry(r: EntryRow): Entry {
  return {
    id: r.id,
    immich_asset_id: r.immich_asset_id,
    taken_at: r.taken_at,
    day: r.day,
    logged_at:
      typeof r.logged_at === 'string'
        ? r.logged_at
        : new Date(r.logged_at as unknown as number).toISOString(),
    dish: r.dish,
    items: (r.items as Entry['items']) ?? [],
    kcal: num(r.kcal),
    protein_g: num(r.protein_g),
    carbs_g: num(r.carbs_g),
    fat_g: num(r.fat_g),
    confidence: r.confidence as Entry['confidence'],
    notes: r.notes ?? '',
    included: !!r.included,
    edited: !!r.edited,
    source: r.source as Entry['source'],
    source_missing: !!r.source_missing,
    raw: r.raw ?? null,
    chat: (r.chat as Entry['chat']) ?? [],
  };
}

export class PostgresStore implements Store {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  /** Test-only: wipe the schema so a test starts from a clean database. */
  async reset(): Promise<void> {
    await this.pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  }

  async init(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        immich_asset_id TEXT NOT NULL UNIQUE,
        taken_at TEXT,
        day TEXT NOT NULL,
        logged_at TEXT NOT NULL,
        dish TEXT NOT NULL DEFAULT '',
        items JSONB NOT NULL DEFAULT '[]'::jsonb,
        kcal INTEGER NOT NULL DEFAULT 0,
        protein_g NUMERIC NOT NULL DEFAULT 0,
        carbs_g NUMERIC NOT NULL DEFAULT 0,
        fat_g NUMERIC NOT NULL DEFAULT 0,
        confidence TEXT NOT NULL DEFAULT 'low',
        notes TEXT NOT NULL DEFAULT '',
        included BOOLEAN NOT NULL DEFAULT TRUE,
        edited BOOLEAN NOT NULL DEFAULT FALSE,
        source TEXT NOT NULL DEFAULT 'auto',
        source_missing BOOLEAN NOT NULL DEFAULT FALSE,
        raw JSONB,
        chat JSONB NOT NULL DEFAULT '[]'::jsonb
      );
      CREATE INDEX IF NOT EXISTS idx_entries_day ON entries(day);
      CREATE INDEX IF NOT EXISTS idx_entries_logged_at ON entries(logged_at);
      -- Migrate pre-existing databases.
      ALTER TABLE entries ADD COLUMN IF NOT EXISTS source_missing BOOLEAN NOT NULL DEFAULT FALSE;

      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        goal_kcal INTEGER NOT NULL DEFAULT 2000,
        goal_protein_g NUMERIC NOT NULL DEFAULT 140,
        goal_carbs_g NUMERIC NOT NULL DEFAULT 220,
        goal_fat_g NUMERIC NOT NULL DEFAULT 65
      );
      INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS skipped_assets (
        immich_asset_id TEXT PRIMARY KEY,
        reason TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }

  async getSkip(id: string): Promise<{ reason: string; attempts: number } | null> {
    const { rows } = await this.pool.query(
      'SELECT reason, attempts FROM skipped_assets WHERE immich_asset_id = $1',
      [id],
    );
    return rows[0] ? { reason: rows[0].reason, attempts: Number(rows[0].attempts) } : null;
  }

  async setSkip(id: string, reason: string, attempts: number): Promise<void> {
    await this.pool.query(
      `INSERT INTO skipped_assets (immich_asset_id, reason, attempts, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (immich_asset_id) DO UPDATE SET reason = EXCLUDED.reason,
         attempts = EXCLUDED.attempts, updated_at = NOW()`,
      [id, reason, attempts],
    );
  }

  async clearSkip(id: string): Promise<void> {
    await this.pool.query('DELETE FROM skipped_assets WHERE immich_asset_id = $1', [id]);
  }

  async getAppConfig(): Promise<Record<string, string>> {
    const { rows } = await this.pool.query('SELECT key, value FROM app_config');
    const out: Record<string, string> = {};
    for (const r of rows) out[r.key as string] = r.value as string;
    return out;
  }

  async setAppConfig(patch: Record<string, string>): Promise<Record<string, string>> {
    for (const [key, value] of Object.entries(patch)) {
      await this.pool.query(
        `INSERT INTO app_config (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, value],
      );
    }
    return this.getAppConfig();
  }

  async getSettings(): Promise<Settings> {
    const { rows } = await this.pool.query(
      'SELECT goal_kcal, goal_protein_g, goal_carbs_g, goal_fat_g FROM settings WHERE id = 1',
    );
    const r = rows[0];
    if (!r) return { goal_kcal: 2000, goal_protein_g: 140, goal_carbs_g: 220, goal_fat_g: 65 };
    return {
      goal_kcal: num(r.goal_kcal),
      goal_protein_g: num(r.goal_protein_g),
      goal_carbs_g: num(r.goal_carbs_g),
      goal_fat_g: num(r.goal_fat_g),
    };
  }

  async updateSettings(patch: Partial<Settings>): Promise<Settings> {
    const current = await this.getSettings();
    const next: Settings = { ...current, ...patch };
    await this.pool.query(
      `UPDATE settings SET goal_kcal=$1, goal_protein_g=$2, goal_carbs_g=$3, goal_fat_g=$4 WHERE id = 1`,
      [next.goal_kcal, next.goal_protein_g, next.goal_carbs_g, next.goal_fat_g],
    );
    return next;
  }

  async hasAsset(immichAssetId: string): Promise<boolean> {
    const { rows } = await this.pool.query(
      'SELECT 1 FROM entries WHERE immich_asset_id = $1',
      [immichAssetId],
    );
    return rows.length > 0;
  }

  async reconcileSource(presentIds: string[]): Promise<number> {
    await this.pool.query(
      `UPDATE entries SET source_missing = NOT (immich_asset_id = ANY($1::text[]))`,
      [presentIds],
    );
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::int AS n FROM entries WHERE source_missing`,
    );
    return rows[0].n as number;
  }

  async insertEntry(e: NewEntry): Promise<Entry> {
    e = stripNul(e);
    const { rows } = await this.pool.query(
      `INSERT INTO entries
        (id, immich_asset_id, taken_at, day, logged_at, dish, items, kcal,
         protein_g, carbs_g, fat_g, confidence, notes, included, edited, source, raw, chat)
       VALUES
        ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18::jsonb)
       RETURNING *`,
      [
        e.id,
        e.immich_asset_id,
        e.taken_at,
        e.day,
        e.logged_at,
        e.dish,
        JSON.stringify(e.items),
        e.kcal,
        e.protein_g,
        e.carbs_g,
        e.fat_g,
        e.confidence,
        e.notes,
        e.included,
        e.edited,
        e.source,
        e.raw == null ? null : JSON.stringify(e.raw),
        JSON.stringify(e.chat),
      ],
    );
    return rowToEntry(rows[0]);
  }

  async getEntry(id: string): Promise<Entry | null> {
    const { rows } = await this.pool.query('SELECT * FROM entries WHERE id = $1', [id]);
    return rows[0] ? rowToEntry(rows[0]) : null;
  }

  async getEntriesForDay(day: string): Promise<Entry[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM entries WHERE day = $1 ORDER BY logged_at ASC',
      [day],
    );
    return rows.map(rowToEntry);
  }

  async updateEntry(id: string, patch: Partial<Entry>): Promise<Entry | null> {
    patch = stripNul(patch);
    const existing = await this.getEntry(id);
    if (!existing) return null;
    const next: Entry = { ...existing, ...patch };
    const { rows } = await this.pool.query(
      `UPDATE entries SET
        taken_at=$2, day=$3, logged_at=$4, dish=$5, items=$6::jsonb, kcal=$7,
        protein_g=$8, carbs_g=$9, fat_g=$10, confidence=$11, notes=$12,
        included=$13, edited=$14, source=$15, raw=$16::jsonb, chat=$17::jsonb
       WHERE id=$1 RETURNING *`,
      [
        next.id,
        next.taken_at,
        next.day,
        next.logged_at,
        next.dish,
        JSON.stringify(next.items),
        next.kcal,
        next.protein_g,
        next.carbs_g,
        next.fat_g,
        next.confidence,
        next.notes,
        next.included,
        next.edited,
        next.source,
        next.raw == null ? null : JSON.stringify(next.raw),
        JSON.stringify(next.chat),
      ],
    );
    return rows[0] ? rowToEntry(rows[0]) : null;
  }

  async deleteEntry(id: string): Promise<boolean> {
    const res = await this.pool.query('DELETE FROM entries WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  async getHistoryPriors(limit = 30): Promise<HistoryPrior[]> {
    const { rows } = await this.pool.query(
      `SELECT dish, kcal, protein_g, carbs_g, fat_g,
              (edited OR source IN ('manual','chat','reanalyzed')) AS trusted
       FROM entries
       WHERE dish <> ''
       ORDER BY trusted DESC, logged_at DESC`,
    );
    const seen = new Set<string>();
    const out: HistoryPrior[] = [];
    for (const r of rows) {
      const key = normalizeDish(r.dish);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({
        dish: r.dish,
        kcal: num(r.kcal),
        protein_g: num(r.protein_g),
        carbs_g: num(r.carbs_g),
        fat_g: num(r.fat_g),
        trusted: !!r.trusted,
      });
      if (out.length >= limit) break;
    }
    return out;
  }

  async getHistory(days: number): Promise<DayAggregate[]> {
    const { rows } = await this.pool.query(
      `SELECT day,
              SUM(kcal) AS kcal,
              SUM(protein_g) AS protein_g,
              SUM(carbs_g) AS carbs_g,
              SUM(fat_g) AS fat_g,
              COUNT(*) AS meals
       FROM entries
       WHERE included = TRUE
         AND day::date >= CURRENT_DATE - $1::int
       GROUP BY day
       ORDER BY day DESC`,
      [days],
    );
    return rows
      .map((r) => ({
        day: r.day,
        kcal: num(r.kcal),
        protein_g: num(r.protein_g),
        carbs_g: num(r.carbs_g),
        fat_g: num(r.fat_g),
        meals: num(r.meals),
      }))
      .reverse();
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
