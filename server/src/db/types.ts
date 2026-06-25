export type Confidence = 'low' | 'medium' | 'high';
export type Source = 'auto' | 'manual' | 'reanalyzed' | 'chat';

export interface Item {
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface ChatMessage {
  role: string;
  text: string;
}

export interface Entry {
  id: string;
  immich_asset_id: string;
  taken_at: string | null;
  day: string; // YYYY-MM-DD (local TZ)
  logged_at: string; // ISO
  dish: string;
  items: Item[];
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: Confidence;
  notes: string;
  included: boolean;
  edited: boolean;
  source: Source;
  /** True when the photo is no longer present in the watched source (album). */
  source_missing: boolean;
  raw: unknown;
  chat: ChatMessage[];
}

/** Fields supplied when inserting a brand-new entry. */
export interface NewEntry {
  id: string;
  immich_asset_id: string;
  taken_at: string | null;
  day: string;
  logged_at: string;
  dish: string;
  items: Item[];
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: Confidence;
  notes: string;
  included: boolean;
  edited: boolean;
  source: Source;
  raw: unknown;
  chat: ChatMessage[];
}

export interface Settings {
  goal_kcal: number;
  goal_protein_g: number;
  goal_carbs_g: number;
  goal_fat_g: number;
}

/** A prior fed into the vision prompt (personal food memory). */
export interface HistoryPrior {
  dish: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  trusted: boolean;
}

export interface DayAggregate {
  day: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meals: number;
}

/** Common data-access interface; sqlite + postgres implement it. */
export interface Store {
  init(): Promise<void>;

  /** Runtime app config (key/value) persisted across restarts. */
  getAppConfig(): Promise<Record<string, string>>;
  setAppConfig(patch: Record<string, string>): Promise<Record<string, string>>;

  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;

  hasAsset(immichAssetId: string): Promise<boolean>;
  /** Flag logged entries whose asset is absent from `presentIds` as source_missing
   *  (and clear the flag for those present). Returns the count now flagged missing. */
  reconcileSource(presentIds: string[]): Promise<number>;
  /** Assets seen but not logged (non-food / hard failures) so they aren't re-analyzed every sync. */
  getSkip(immichAssetId: string): Promise<{ reason: string; attempts: number } | null>;
  setSkip(immichAssetId: string, reason: string, attempts: number): Promise<void>;
  clearSkip(immichAssetId: string): Promise<void>;
  insertEntry(entry: NewEntry): Promise<Entry>;
  getEntry(id: string): Promise<Entry | null>;
  getEntriesForDay(day: string): Promise<Entry[]>;
  updateEntry(id: string, patch: Partial<Entry>): Promise<Entry | null>;
  deleteEntry(id: string): Promise<boolean>;

  /** Personal food memory: corrected entries first, deduped by normalized dish. */
  getHistoryPriors(limit?: number): Promise<HistoryPrior[]>;

  /** Per-day aggregates (included entries only) for the history chart. */
  getHistory(days: number): Promise<DayAggregate[]>;

  close(): Promise<void>;
}
