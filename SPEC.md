# Oja — build spec (shared contract for all build agents)

**Oja** is a self-hosted **calorie diary that reads food photos from an Immich album** and
estimates calories + macros with a vision LLM. It's a companion app to Immich. MIT licensed.

This file is the single source of truth that the backend, frontend, and packaging must agree on.
Keep it; it doubles as architecture docs. (It is derived from a working private prototype, but the
public app must be **fully generic** — NO Home Assistant, NO pantry features, NO hardcoded hosts/keys.)

## Product summary
- User points Oja at their Immich server (URL + API key) and names an album (e.g. "Food").
- They drop food photos into that album (from phone/camera auto-backup).
- Oja polls the album on an interval (+ a manual "Sync now"), runs each new photo through a vision
  LLM, and logs an estimate: dish name, per-item kcal + macros, confidence, notes.
- Dashboard: today's total vs a daily goal + macro bars; per-meal cards with the per-item breakdown.
- Each meal can be **included/excluded** from the day, **edited** manually, **re-analyzed**
  (re-run vision, optionally with a corrected description), or adjusted by **chat** ("it was a double
  portion, no rice").
- **Personal food memory:** past meals — corrected ones first — are fed back as priors so recurring
  meals converge to the user's own numbers. This is a core differentiator. KEEP IT.
- History tab: intake-vs-goal over time. Settings: goal kcal + macros, connection config status.

## Tech stack (decided — best-practice, not over-engineered)
- **Backend:** Node 20+, **TypeScript**, **Express 5**. **better-sqlite3** as the default store (zero-setup,
  single file in `./data`), with **optional Postgres** (`pg`) auto-selected when `DATABASE_URL` starts
  with `postgres`. Validate env with **zod**. Vision via `fetch` to an **OpenAI-compatible** chat
  completions endpoint (works with OpenAI, OpenRouter, MiniMax, local llava/Ollama, etc.). Auth: a
  single shared password via signed cookie session (`cookie-session` or `express-session`).
- **Frontend:** **React 18 + TypeScript + Vite + Tailwind CSS**, **@tanstack/react-query** for data,
  **recharts** for the history chart. Mobile-first, responsive, dark theme. No CSS framework beyond Tailwind.
- **Packaging:** ONE production Docker image (multi-stage: build `web` → static, build `server` → `dist`,
  final stage serves the static frontend from Express). `docker-compose.yml` for one-command start.

## Repo layout
```
oja/
  server/        # backend (owned by backend agent)
  web/           # frontend (owned by frontend agent)
  docs/          # PRODUCT.md report (owned by report agent), screenshots later
  Dockerfile, docker-compose.yml, .env.example, README.md, LICENSE, CONTRIBUTING.md, .github/  (packaging agent)
  SPEC.md        # this file
```

## Configuration (env vars — single source for packaging `.env.example` + backend zod schema)
| Var | Required | Default | Notes |
|---|---|---|---|
| `PORT` | no | `8462` | http port |
| `APP_PASSWORD` | yes | — | single login password |
| `SESSION_SECRET` | yes | — | cookie signing secret |
| `DATABASE_URL` | no | `sqlite:./data/oja.db` | `postgres://…` to use Postgres |
| `IMMICH_URL` | yes | — | e.g. `https://immich.example.com` |
| `IMMICH_API_KEY` | yes | — | Immich API key |
| `IMMICH_ALBUM` | yes | `Food` | album name OR id Oja watches |
| `VISION_BASE_URL` | no | `https://api.openai.com/v1` | OpenAI-compatible base |
| `VISION_API_KEY` | yes | — | key for the vision provider |
| `VISION_MODEL` | no | `gpt-4o-mini` | any vision-capable model |
| `POLL_INTERVAL_MINUTES` | no | `90` | `0` disables auto-poll |
| `TZ` | no | `UTC` | day-boundary timezone |

## Data model
`entries`: `id` pk, `immich_asset_id` unique, `taken_at` (ISO), `day` (YYYY-MM-DD, local TZ),
`logged_at`, `dish` text, `items` json `[{name,kcal,protein_g,carbs_g,fat_g}]`, `kcal` int,
`protein_g`/`carbs_g`/`fat_g` numeric, `confidence` (`low|medium|high`), `notes` text,
`included` bool default true, `edited` bool default false, `source`
(`auto|manual|reanalyzed|chat`), `raw` json (full model output), `chat` json (array of {role,text}).
`settings`: singleton `goal_kcal` (default 2000), `goal_protein_g` (140), `goal_carbs_g` (220), `goal_fat_g` (65).

## Vision contract
Prompt instructs the model to identify the dish + each visible item and estimate kcal/macros for the
**portion shown**, returning ONLY JSON:
```json
{"is_food":true,"dish":"…","items":[{"name":"…","kcal":0,"protein_g":0,"carbs_g":0,"fat_g":0}],
 "total_kcal":0,"total_protein_g":0,"total_carbs_g":0,"total_fat_g":0,
 "confidence":"low|medium|high","notes":"…","reply":"short friendly sentence (chat/reanalyze only)"}```
Strip any `<think>…</think>` blocks before parsing; extract the first `{…}` JSON object.
**Food memory:** before each estimate, fetch up to 30 past meals (corrected first, deduped by dish)
and add them to the prompt as priors ("if this resembles one of these, use its numbers; ✓ = trusted").

## REST API (frontend ⇄ backend contract — match exactly)
- `GET  /api/health` → `{ok:true, configured:bool}` (configured = Immich+vision env present)
- `POST /api/login` `{password}` → 200 + session cookie | 401
- `POST /api/logout` → 200
- `GET  /api/day?date=YYYY-MM-DD` → `{date, settings, totals:{kcal,protein_g,carbs_g,fat_g,meals}, entries:[…]}`
- `POST /api/sync` → `{added,skipped,notfood,errors,dishes:[…]}` (409 if already running)
- `POST /api/entries/:id/toggle` → `{included}`
- `PATCH /api/entries/:id` `{dish?,notes?,kcal?,protein_g?,carbs_g?,fat_g?}` → updated entry
- `POST /api/entries/:id/reanalyze` `{text?}` → updated entry
- `POST /api/entries/:id/chat` `{message}` → `{entry, reply}`
- `DELETE /api/entries/:id` → `{ok:true}`
- `GET  /api/settings` ; `PUT /api/settings` `{goal_kcal?,…}` → settings
- `GET  /api/history?days=30` → `{days:[{day,kcal,protein_g,carbs_g,fat_g,meals}], settings}`
- `GET  /api/photo/:assetId?size=thumbnail|preview` → image bytes (server proxies Immich with the key; never expose the key to the browser)
All `/api/*` except `health` and `login` require auth → 401 `{error:"auth"}` otherwise.

## Quality bar
Typecheck clean, `npm run build` works in both `server` and `web`, sensible error handling,
no secrets in code, README good enough for a stranger to self-host in 5 minutes.

---

# v1.1 additions — Setup wizard, runtime config, broad LLM support, tests

## Runtime configuration (no more boot-time exit)
The server MUST start even with NO Immich/vision config. Remove the hard `process.exit` on
missing config. Effective config for a field = the **env var if set**, otherwise the value saved
via the setup UI (DB table `app_config`, single JSON row or key/value). Env-set fields are
**locked** (read-only in UI, labelled "set by environment"). `health.configured` = effective
Immich + vision config is complete. The poller and sync no-op (with a clear message) until configured.

Config fields: `immich_url`, `immich_api_key`, `immich_album`, `vision_provider`,
`vision_base_url`, `vision_api_key`, `vision_model`, `poll_interval_minutes`.
**Secrets are never returned to the browser in plaintext.** GET returns per field
`{set:boolean, locked:boolean, value?:<non-secret value only>}`.

## New REST endpoints
- `GET  /api/config` → `{configured, fields:{<name>:{set,locked,value?}}}`
- `PUT  /api/config` `{immich_url?,immich_api_key?,immich_album?,vision_provider?,vision_base_url?,vision_api_key?,vision_model?,poll_interval_minutes?}` → saves non-locked fields; returns same shape as GET
- `POST /api/config/test-immich` `{url?,api_key?}` (falls back to saved) → `{ok, error?, albums?:[{id,name,assetCount}]}`
- `POST /api/config/test-vision` `{provider?,base_url?,api_key?,model?}` → `{ok, error?, sample?}` (tiny round-trip)
- `GET  /api/immich/albums` → `[{id,name,assetCount}]` (for the album picker)
All require auth except as before.

## Vision providers — "support most LLM models"
`vision_provider` selects an adapter (a small `src/providers/` module, easy to extend):
- **`openai`** (OpenAI-compatible, DEFAULT) — covers OpenAI, OpenRouter, MiniMax, Groq, Together,
  DeepInfra, **Ollama**, **LM Studio**, **vLLM**, anything exposing `/chat/completions` with `image_url`.
- **`anthropic`** — native Messages API (image content blocks, base64).
- **`gemini`** — native Google Generative Language API (`inlineData`).
Each adapter: `(cfg{base_url?,api_key,model}, imageBytes, prompt) => parsed estimate JSON`.
Export a **PRESETS** list for the UI dropdown: `{label, provider, base_url, models:[…], note?}` covering
OpenAI, OpenRouter, MiniMax, Groq, Together, DeepInfra, Ollama (local), LM Studio (local),
Anthropic, Google Gemini, and "Custom". README documents one config block per preset.

## Setup wizard (frontend)
If `/api/health` (or `/api/config`) reports not configured → route to **`/setup`**. Steps:
1. **Immich** — base URL + API key → "Test & load albums" (`/api/config/test-immich`) → album dropdown.
2. **Vision** — provider preset dropdown (auto-fills base URL + suggested models), API key, model →
   "Test" (`/api/config/test-vision`).
3. **Save** (`PUT /api/config`) → go to dashboard.
Also reachable from **Settings → Connection**. Env-locked fields render read-only with a note.
Clean multi-step UI consistent with the app's theme.

## Testing (well-tested)
- **Backend:** `vitest`. Unit tests for: vision JSON extraction + `<think>` stripping + total
  fallback; food-memory prior selection/dedup/ordering; config precedence (env vs db, locked,
  secret masking); sync dedup + lock + non-food skip + one-bad-photo-doesn't-abort (mock Immich +
  vision). API tests with **supertest** against the app using an in-memory/temp **sqlite** store and
  a mocked vision/Immich layer: auth guard (401), login, day/totals math (included only), toggle,
  PATCH, reanalyze, chat, settings, history, config GET masking + PUT locked-field rejection.
  Add `npm test` script.
- **Frontend:** `vitest` + `@testing-library/react` — a few component tests (CalorieRing math,
  MealCard include/exclude + per-item render, Setup wizard step validation) with the API mocked.
  Add `npm test`.
- **CI:** extend `.github/workflows/ci.yml` to run `npm test` for both `server` and `web`.
Tests must pass locally (`npm test` green in both).
