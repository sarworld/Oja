export type Confidence = "low" | "medium" | "high";
export type EntrySource = "auto" | "manual" | "reanalyzed" | "chat";

export interface FoodItem {
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface ChatTurn {
  role: "user" | "assistant" | string;
  text: string;
}

export interface Entry {
  id: number | string;
  immich_asset_id: string;
  taken_at: string;
  day: string;
  logged_at: string;
  dish: string;
  items: FoodItem[];
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: Confidence;
  notes: string;
  included: boolean;
  edited: boolean;
  source: EntrySource;
  source_missing?: boolean;
  chat?: ChatTurn[];
}

export interface Settings {
  goal_kcal: number;
  goal_protein_g: number;
  goal_carbs_g: number;
  goal_fat_g: number;
}

export interface DayTotals {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meals: number;
}

export interface DayResponse {
  date: string;
  settings: Settings;
  totals: DayTotals;
  entries: Entry[];
}

export interface SyncResult {
  added: number;
  skipped: number;
  notfood: number;
  errors: number;
  dishes: string[];
}

export interface HistoryDay {
  day: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meals: number;
}

export interface HistoryResponse {
  days: HistoryDay[];
  settings: Settings;
}

export interface Health {
  ok: boolean;
  configured: boolean;
  version?: string;
}

// ---------------------------------------------------------------------------
// v1.1 — runtime config + setup wizard

export interface ImmichAlbum {
  id: string;
  name: string;
  assetCount: number;
}

/** Per-field status returned by GET /api/config. Secrets never carry a value. */
export interface ConfigField {
  set: boolean;
  locked: boolean;
  value?: string;
}

export type ConfigFieldName =
  | "immich_url"
  | "immich_api_key"
  | "immich_album"
  | "vision_provider"
  | "vision_base_url"
  | "vision_api_key"
  | "vision_model"
  | "poll_interval_minutes";

export interface ConfigResponse {
  configured: boolean;
  fields: Record<ConfigFieldName, ConfigField>;
}

/** Payload for PUT /api/config — only non-locked fields are honoured. */
export type ConfigPatch = Partial<Record<ConfigFieldName, string>>;

export interface TestImmichResult {
  ok: boolean;
  error?: string;
  albums?: ImmichAlbum[];
}

export interface TestVisionResult {
  ok: boolean;
  error?: string;
  sample?: string;
}
