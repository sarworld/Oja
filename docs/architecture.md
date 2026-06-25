# Architecture

A high-level look at how Oja is built — useful if you're self-hosting deliberately,
integrating with the API, or thinking about contributing.

## The big picture

```
                ┌──────────────────────────────────────────────────┐
                │                   Oja (one container)            │
                │                                                  │
  Food photos   │   ┌────────────┐   ┌───────────┐   ┌──────────┐  │
   ───────────► │   │   Source   │──►│  Vision   │──►│  Store   │  │
  (your album)  │   │   poller   │   │ provider  │   │ SQLite / │  │
                │   │  + Sync now│   │ adapter   │   │ Postgres │  │
                │   └────────────┘   └───────────┘   └────┬─────┘  │
                │                                          │        │
                │   ┌──────────────────────────────────────▼─────┐  │
                │   │      Express API  +  static React UI       │  │
                │   └──────────────────────┬─────────────────────┘  │
                └──────────────────────────┼────────────────────────┘
                                           │
                                      Your browser
                                  (dashboard, corrections)
```

1. **Source poller** lists your watched album (Immich today) on an interval, plus on-demand
   via **Sync now**.
2. For each **new** photo, a **vision provider adapter** sends the image to your chosen LLM
   and gets back a structured estimate (with your recent meals mixed in as priors).
3. Results are written to the **store** — **SQLite** by default, or **Postgres**.
4. The **Express server** exposes a REST API **and** serves the built React dashboard from
   the same process, so it's one container.

## Tech stack

| Layer | Choice |
|---|---|
| **Backend** | Node 20+, TypeScript, **Express 5** |
| **Store** | **better-sqlite3** (default, single file in `./data`); **Postgres** (`pg`) auto-selected when `DATABASE_URL` starts with `postgres` |
| **Vision** | `fetch` to your provider via a small adapter — `openai` (OpenAI-compatible), `anthropic` (native), `gemini` (native) |
| **Auth** | Single shared password → signed cookie session |
| **Frontend** | React 18 + TypeScript + Vite + Tailwind CSS, TanStack Query, Recharts; mobile-first, dark theme |
| **Packaging** | One multi-stage Docker image (build web → static, build server → `dist`, final stage serves the static UI from Express) |

## Runtime configuration

Oja starts **even with no source/vision config**. Each config field's **effective value** is
the **environment variable if set**, otherwise the value **saved in the UI** (persisted in
the store), otherwise a **default**. Env-set fields are **locked** (read-only in the UI).
Secrets are never returned to the browser in plaintext. The poller and sync **no-op until
configured**. Full details: [Configuration](/configuration).

## REST API

The frontend talks to the backend over a small REST API under `/api`. **All endpoints
except `health` and `login` require authentication** (an unauthenticated call returns `401`
with `{"error":"auth"}`).

### Auth & health

| Method | Path | Body | Response |
|---|---|---|---|
| `GET` | `/api/health` | — | `{ok, configured}` — `configured` = source + vision fully set. |
| `POST` | `/api/login` | `{password}` | `200` + session cookie, or `401`. |
| `POST` | `/api/logout` | — | `{ok:true}`. |

### Diary

| Method | Path | Body | Response |
|---|---|---|---|
| `GET` | `/api/day?date=YYYY-MM-DD` | — | `{date, settings, totals:{kcal,protein_g,carbs_g,fat_g,meals}, entries:[…]}` (totals count **included** meals only). |
| `POST` | `/api/sync` | — | `{added, skipped, notfood, errors, missing, dishes:[…]}` — `409` if a sync is already running. |
| `POST` | `/api/entries/:id/toggle` | — | `{included}` — flip a meal in/out of the day. |
| `PATCH` | `/api/entries/:id` | `{dish?,notes?,kcal?,protein_g?,carbs_g?,fat_g?}` | The updated entry (marked `edited`, `source: manual`). |
| `POST` | `/api/entries/:id/reanalyze` | `{text?}` | The updated entry, re-run through vision with the optional hint (`source: reanalyzed`). |
| `POST` | `/api/entries/:id/chat` | `{message}` | `{entry, reply}` — adjust the meal in natural language (`source: chat`). |
| `DELETE` | `/api/entries/:id` | — | `{ok:true}` (or `404`). |

### Settings & history

| Method | Path | Body | Response |
|---|---|---|---|
| `GET` | `/api/settings` | — | `{goal_kcal, goal_protein_g, goal_carbs_g, goal_fat_g}`. |
| `PUT` | `/api/settings` | `{goal_kcal?,…}` | The updated settings. |
| `GET` | `/api/history?days=30` | — | `{days:[{day,kcal,protein_g,carbs_g,fat_g,meals}], settings}`. |

### Configuration & connection testing

| Method | Path | Body | Response |
|---|---|---|---|
| `GET` | `/api/config` | — | `{configured, fields:{<name>:{set, locked, value?}}}` — **secrets carry no value**. |
| `PUT` | `/api/config` | `{immich_url?,immich_api_key?,immich_album?,vision_provider?,vision_base_url?,vision_api_key?,vision_model?,poll_interval_minutes?}` | Saves **non-locked** fields; returns the same shape as `GET`. |
| `POST` | `/api/config/test-immich` | `{url?,api_key?}` (falls back to saved) | `{ok, error?, albums?:[{id,name,assetCount}]}`. |
| `POST` | `/api/config/test-vision` | `{provider?,base_url?,api_key?,model?}` | `{ok, error?, sample?}` — a tiny round-trip. |
| `GET` | `/api/immich/albums` | — | `[{id,name,assetCount}]` — for the album picker. |

### Image proxy

| Method | Path | Response |
|---|---|---|
| `GET` | `/api/photo/:assetId?size=thumbnail\|preview` | Image bytes — the server proxies your source with its API key, so **the key never reaches the browser**. |

## The vision contract

For each photo, the prompt asks the model to identify the **dish** and each **visible item**
and estimate kcal + macros for the **portion shown**, returning **only** a JSON object:

```json
{
  "is_food": true,
  "dish": "…",
  "items": [{ "name": "…", "kcal": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0 }],
  "total_kcal": 0,
  "total_protein_g": 0,
  "total_carbs_g": 0,
  "total_fat_g": 0,
  "confidence": "low|medium|high",
  "notes": "…",
  "reply": "short friendly sentence (chat/reanalyze only)"
}
```

Parsing is **defensive**: Oja strips any `<think>…</think>` reasoning, extracts the first
`{…}` object, and falls back to **summing the per-item numbers** when totals are missing.
`confidence` defaults sensibly if absent. This is why minor model formatting quirks don't
break a sync.

**Food memory.** Before each estimate, Oja fetches up to **30** of your past meals —
**corrected ones first**, de-duplicated by dish — and adds them to the prompt as priors
(*"if this resembles one of these, use its numbers; ✓ = trusted"*), so recurring meals
converge on your own numbers.

Adapters live in `server/src/providers/` and share the shape
`(cfg{base_url?, api_key, model}, imageBytes, prompt) => parsed estimate JSON`. See
[Vision providers](/vision-providers) and [Contributing](/contributing#adding-a-vision-provider).

## Data model

The store keeps a handful of tables (created automatically on first run, for both SQLite and
Postgres).

### `entries` — one row per logged meal

| Column | Type | Notes |
|---|---|---|
| `id` | text | Primary key. |
| `immich_asset_id` | text | **Unique** — the source asset ID (this is what dedups syncs). |
| `taken_at` | text | Photo capture time (ISO), if available. |
| `day` | text | `YYYY-MM-DD` in your `TZ` — the day this meal counts toward. |
| `logged_at` | text | When Oja recorded it (ISO). |
| `dish` | text | Dish name. |
| `items` | json | `[{name, kcal, protein_g, carbs_g, fat_g}]` — the per-item breakdown. |
| `kcal` | int | Total calories. |
| `protein_g` / `carbs_g` / `fat_g` | numeric | Total macros. |
| `confidence` | text | `low` / `medium` / `high`. |
| `notes` | text | Model notes. |
| `included` | bool | Counts toward the day's totals (default `true`). |
| `edited` | bool | Hand-corrected (default `false`). |
| `source` | text | `auto` / `manual` / `reanalyzed` / `chat`. |
| `source_missing` | bool | `true` when the photo is **no longer** in the watched album ("removed from source"). |
| `raw` | json | The full model output. |
| `chat` | json | The talk-it-through conversation `[{role, text}]`. |

### `settings` — your goals (singleton row)

| Column | Default |
|---|---|
| `goal_kcal` | `2000` |
| `goal_protein_g` | `140` |
| `goal_carbs_g` | `220` |
| `goal_fat_g` | `65` |

### Supporting tables

- **App config** — key/value store backing the [UI-saved config](/configuration) (the values
  the setup wizard writes when not set by env).
- **Skipped assets** — remembers which source assets were judged **non-food** or have
  **failed** analysis (with an attempt counter), so syncs don't re-pay to analyze them. This
  is what powers the [non-food and retry behaviour](/how-sync-works).

## Why polling (not webhooks)

Oja **polls** the album (plus manual **Sync now**) rather than receiving push
notifications. Immich has **no native outbound webhook for new album assets**, so polling is
the correct, reliable approach — not a limitation. Tune the cadence with
`POLL_INTERVAL_MINUTES`.

## See also

- **[How sync works](/how-sync-works)** — the sync lifecycle in detail.
- **[Configuration](/configuration)** — every variable and precedence.
- **[Contributing](/contributing)** — dev setup and extension points.
