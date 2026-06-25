import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type {
  DayAggregate,
  Entry,
  HistoryPrior,
  NewEntry,
  Settings,
  Store,
} from './types.js';
import { normalizeDish, stripNul } from './util.js';

interface EntryRow {
  id: string;
  immich_asset_id: string;
  taken_at: string | null;
  day: string;
  logged_at: string;
  dish: string;
  items: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: string;
  notes: string;
  included: number;
  edited: number;
  source: string;
  source_missing: number;
  raw: string | null;
  chat: string;
}

function rowToEntry(r: EntryRow): Entry {
  return {
    id: r.id,
    immich_asset_id: r.immich_asset_id,
    taken_at: r.taken_at,
    day: r.day,
    logged_at: r.logged_at,
    dish: r.dish,
    items: r.items ? JSON.parse(r.items) : [],
    kcal: r.kcal,
    protein_g: r.protein_g,
    carbs_g: r.carbs_g,
    fat_g: r.fat_g,
    confidence: r.confidence as Entry['confidence'],
    notes: r.notes ?? '',
    included: !!r.included,
    edited: !!r.edited,
    source: r.source as Entry['source'],
    source_missing: !!r.source_missing,
    raw: r.raw ? JSON.parse(r.raw) : null,
    chat: r.chat ? JSON.parse(r.chat) : [],
  };
}

export class SqliteStore implements Store {
  private db: Database.Database;

  constructor(filePath: string) {
    if (filePath !== ':memory:') {
      mkdirSync(dirname(filePath), { recursive: true });
    }
    this.db = new Database(filePath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  async init(): Promise<void> {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        immich_asset_id TEXT NOT NULL UNIQUE,
        taken_at TEXT,
        day TEXT NOT NULL,
        logged_at TEXT NOT NULL,
        dish TEXT NOT NULL DEFAULT '',
        items TEXT NOT NULL DEFAULT '[]',
        kcal INTEGER NOT NULL DEFAULT 0,
        protein_g REAL NOT NULL DEFAULT 0,
        carbs_g REAL NOT NULL DEFAULT 0,
        fat_g REAL NOT NULL DEFAULT 0,
        confidence TEXT NOT NULL DEFAULT 'low',
        notes TEXT NOT NULL DEFAULT '',
        included INTEGER NOT NULL DEFAULT 1,
        edited INTEGER NOT NULL DEFAULT 0,
        source TEXT NOT NULL DEFAULT 'auto',
        source_missing INTEGER NOT NULL DEFAULT 0,
        raw TEXT,
        chat TEXT NOT NULL DEFAULT '[]'
      );
      CREATE INDEX IF NOT EXISTS idx_entries_day ON entries(day);
      CREATE INDEX IF NOT EXISTS idx_entries_logged_at ON entries(logged_at);

      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        goal_kcal INTEGER NOT NULL DEFAULT 2000,
        goal_protein_g REAL NOT NULL DEFAULT 140,
        goal_carbs_g REAL NOT NULL DEFAULT 220,
        goal_fat_g REAL NOT NULL DEFAULT 65
      );
      INSERT OR IGNORE INTO settings (id) VALUES (1);

      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS skipped_assets (
        immich_asset_id TEXT PRIMARY KEY,
        reason TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );
    `);

    // Migrate pre-existing databases: add columns introduced after first release.
    const cols = this.db.prepare(`PRAGMA table_info(entries)`).all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === 'source_missing')) {
      this.db.exec(`ALTER TABLE entries ADD COLUMN source_missing INTEGER NOT NULL DEFAULT 0`);
    }
  }

  async reconcileSource(presentIds: string[]): Promise<number> {
    const present = new Set(presentIds);
    const rows = this.db
      .prepare(`SELECT id, immich_asset_id, source_missing FROM entries`)
      .all() as Array<{ id: string; immich_asset_id: string; source_missing: number }>;
    const upd = this.db.prepare(`UPDATE entries SET source_missing = ? WHERE id = ?`);
    let missing = 0;
    const tx = this.db.transaction(() => {
      for (const r of rows) {
        const want = present.has(r.immich_asset_id) ? 0 : 1;
        if (want) missing++;
        if (want !== r.source_missing) upd.run(want, r.id);
      }
    });
    tx();
    return missing;
  }

  async getSkip(id: string): Promise<{ reason: string; attempts: number } | null> {
    const row = this.db
      .prepare('SELECT reason, attempts FROM skipped_assets WHERE immich_asset_id = ?')
      .get(id) as { reason: string; attempts: number } | undefined;
    return row ?? null;
  }

  async setSkip(id: string, reason: string, attempts: number): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO skipped_assets (immich_asset_id, reason, attempts, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(immich_asset_id) DO UPDATE SET reason = excluded.reason,
           attempts = excluded.attempts, updated_at = excluded.updated_at`,
      )
      .run(id, reason, attempts, new Date().toISOString());
  }

  async clearSkip(id: string): Promise<void> {
    this.db.prepare('DELETE FROM skipped_assets WHERE immich_asset_id = ?').run(id);
  }

  async getAppConfig(): Promise<Record<string, string>> {
    const rows = this.db
      .prepare('SELECT key, value FROM app_config')
      .all() as Array<{ key: string; value: string }>;
    const out: Record<string, string> = {};
    for (const r of rows) out[r.key] = r.value;
    return out;
  }

  async setAppConfig(patch: Record<string, string>): Promise<Record<string, string>> {
    const upsert = this.db.prepare(
      `INSERT INTO app_config (key, value) VALUES (@key, @value)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    );
    const tx = this.db.transaction((entries: Array<[string, string]>) => {
      for (const [key, value] of entries) upsert.run({ key, value });
    });
    tx(Object.entries(patch));
    return this.getAppConfig();
  }

  async getSettings(): Promise<Settings> {
    const row = this.db
      .prepare(
        'SELECT goal_kcal, goal_protein_g, goal_carbs_g, goal_fat_g FROM settings WHERE id = 1',
      )
      .get() as Settings | undefined;
    return (
      row ?? { goal_kcal: 2000, goal_protein_g: 140, goal_carbs_g: 220, goal_fat_g: 65 }
    );
  }

  async updateSettings(patch: Partial<Settings>): Promise<Settings> {
    const current = await this.getSettings();
    const next: Settings = { ...current, ...patch };
    this.db
      .prepare(
        `UPDATE settings SET goal_kcal=@goal_kcal, goal_protein_g=@goal_protein_g,
         goal_carbs_g=@goal_carbs_g, goal_fat_g=@goal_fat_g WHERE id = 1`,
      )
      .run(next);
    return next;
  }

  async hasAsset(immichAssetId: string): Promise<boolean> {
    const row = this.db
      .prepare('SELECT 1 FROM entries WHERE immich_asset_id = ?')
      .get(immichAssetId);
    return !!row;
  }

  async insertEntry(e: NewEntry): Promise<Entry> {
    e = stripNul(e);
    this.db
      .prepare(
        `INSERT INTO entries
         (id, immich_asset_id, taken_at, day, logged_at, dish, items, kcal,
          protein_g, carbs_g, fat_g, confidence, notes, included, edited, source, raw, chat)
         VALUES
         (@id, @immich_asset_id, @taken_at, @day, @logged_at, @dish, @items, @kcal,
          @protein_g, @carbs_g, @fat_g, @confidence, @notes, @included, @edited, @source, @raw, @chat)`,
      )
      .run({
        ...e,
        items: JSON.stringify(e.items),
        included: e.included ? 1 : 0,
        edited: e.edited ? 1 : 0,
        raw: e.raw == null ? null : JSON.stringify(e.raw),
        chat: JSON.stringify(e.chat),
      });
    const inserted = await this.getEntry(e.id);
    if (!inserted) throw new Error('insert failed');
    return inserted;
  }

  async getEntry(id: string): Promise<Entry | null> {
    const row = this.db.prepare('SELECT * FROM entries WHERE id = ?').get(id) as
      | EntryRow
      | undefined;
    return row ? rowToEntry(row) : null;
  }

  async getEntriesForDay(day: string): Promise<Entry[]> {
    const rows = this.db
      .prepare('SELECT * FROM entries WHERE day = ? ORDER BY logged_at ASC')
      .all(day) as EntryRow[];
    return rows.map(rowToEntry);
  }

  async updateEntry(id: string, patch: Partial<Entry>): Promise<Entry | null> {
    patch = stripNul(patch);
    const existing = await this.getEntry(id);
    if (!existing) return null;
    const next: Entry = { ...existing, ...patch };
    this.db
      .prepare(
        `UPDATE entries SET
          taken_at=@taken_at, day=@day, logged_at=@logged_at, dish=@dish, items=@items,
          kcal=@kcal, protein_g=@protein_g, carbs_g=@carbs_g, fat_g=@fat_g,
          confidence=@confidence, notes=@notes, included=@included, edited=@edited,
          source=@source, raw=@raw, chat=@chat
         WHERE id=@id`,
      )
      .run({
        id: next.id,
        taken_at: next.taken_at,
        day: next.day,
        logged_at: next.logged_at,
        dish: next.dish,
        items: JSON.stringify(next.items),
        kcal: next.kcal,
        protein_g: next.protein_g,
        carbs_g: next.carbs_g,
        fat_g: next.fat_g,
        confidence: next.confidence,
        notes: next.notes,
        included: next.included ? 1 : 0,
        edited: next.edited ? 1 : 0,
        source: next.source,
        raw: next.raw == null ? null : JSON.stringify(next.raw),
        chat: JSON.stringify(next.chat),
      });
    return this.getEntry(id);
  }

  async deleteEntry(id: string): Promise<boolean> {
    const res = this.db.prepare('DELETE FROM entries WHERE id = ?').run(id);
    return res.changes > 0;
  }

  async getHistoryPriors(limit = 30): Promise<HistoryPrior[]> {
    // Corrected entries first, then most recent. Dedupe by normalized dish.
    const rows = this.db
      .prepare(
        `SELECT dish, kcal, protein_g, carbs_g, fat_g,
                (CASE WHEN edited = 1 OR source IN ('manual','chat','reanalyzed') THEN 1 ELSE 0 END) AS trusted
         FROM entries
         WHERE dish <> ''
         ORDER BY trusted DESC, logged_at DESC`,
      )
      .all() as Array<{
      dish: string;
      kcal: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
      trusted: number;
    }>;

    const seen = new Set<string>();
    const out: HistoryPrior[] = [];
    for (const r of rows) {
      const key = normalizeDish(r.dish);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({
        dish: r.dish,
        kcal: r.kcal,
        protein_g: r.protein_g,
        carbs_g: r.carbs_g,
        fat_g: r.fat_g,
        trusted: !!r.trusted,
      });
      if (out.length >= limit) break;
    }
    return out;
  }

  async getHistory(days: number): Promise<DayAggregate[]> {
    const rows = this.db
      .prepare(
        `SELECT day,
                SUM(kcal) AS kcal,
                SUM(protein_g) AS protein_g,
                SUM(carbs_g) AS carbs_g,
                SUM(fat_g) AS fat_g,
                COUNT(*) AS meals
         FROM entries
         WHERE included = 1
           AND day >= date('now','localtime','-' || ? || ' days')
         GROUP BY day
         ORDER BY day DESC`,
      )
      .all(days) as Array<{
      day: string;
      kcal: number | null;
      protein_g: number | null;
      carbs_g: number | null;
      fat_g: number | null;
      meals: number;
    }>;
    return rows
      .map((r) => ({
        day: r.day,
        kcal: r.kcal ?? 0,
        protein_g: r.protein_g ?? 0,
        carbs_g: r.carbs_g ?? 0,
        fat_g: r.fat_g ?? 0,
        meals: r.meals,
      }))
      .reverse(); // chronological ascending for the chart
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
