# Configuration

Oja can be configured **two ways**, and you can mix them:

- **In the browser** — the [setup wizard](/getting-started#_4-finish-the-setup-wizard)
  and **Settings → Connection**. Values are saved server-side.
- **Via environment variables** — set in `.env` (see [`.env.example`](#env-file-example)).

The two map to the **same fields**. When an environment variable **is** set, the matching
UI field becomes **locked** (read-only, labelled *"set by environment"*) and the UI can't
change it. This makes env vars ideal for **headless / managed / reproducible** deploys.

## Variable reference

The **Required** column means *required before Oja is usable*, **not** *required at boot* —
Oja starts fine with an empty `.env` and lets you finish setup in the browser.

| Variable | Required | Default | Set via UI? | Notes |
|---|:---:|---|:---:|---|
| `PORT` | no | `8462` | no | HTTP port the server listens on. |
| `APP_PASSWORD` | **yes** | — | no | Single login password for the UI. If unset, a random one is generated and logged on boot. |
| `SESSION_SECRET` | **yes** | — | no | Secret used to sign the session cookie — use a long random string. If unset, a random one is generated and **sessions reset on every restart**. |
| `DATABASE_URL` | no | `sqlite:./data/oja.db` | no | Set a `postgres://…` (or `postgresql://…`) URL to use Postgres instead of SQLite. |
| `IMMICH_URL` | **yes** | — | **yes** | Your photo source's base URL, e.g. `https://immich.example.com`. |
| `IMMICH_API_KEY` | **yes** | — | **yes** | API key for the photo source. **Secret** — never returned to the browser. |
| `IMMICH_ALBUM` | **yes** | `Food` | **yes** | The album Oja watches — by **name** (e.g. `Food`) **or** id. |
| `VISION_PROVIDER` | no | `openai` | **yes** | Adapter: `openai` (OpenAI-compatible, covers most), `anthropic` (native), or `gemini` (native). |
| `VISION_BASE_URL` | no | `https://api.openai.com/v1` | **yes** | Base URL for OpenAI-compatible providers. (The native `anthropic`/`gemini` adapters use their own endpoints.) |
| `VISION_API_KEY` | **yes** | — | **yes** | Key for your vision provider. **Secret** — never returned to the browser. Local providers accept any non-empty string. |
| `VISION_MODEL` | no | `gpt-4o-mini` | **yes** | Any vision-capable model your provider offers. |
| `POLL_INTERVAL_MINUTES` | no | `90` | **yes** | How often to auto-poll the album. `0` disables auto-poll (manual **Sync now** still works). |
| `TZ` | no | `UTC` | no | Timezone used for **day boundaries**, e.g. `America/Toronto`, `Asia/Kolkata`. |

::: tip The five env-only values
Only **`APP_PASSWORD`**, **`SESSION_SECRET`**, **`PORT`**, **`DATABASE_URL`**, and **`TZ`**
are env-only. Everything else (your photo source + vision settings) can be entered entirely
in the UI, entirely via `.env`, or mixed.
:::

## The fields you set in the UI

The eight fields the wizard/Settings manage map one-to-one to the env vars above:

| UI / config field | Env var |
|---|---|
| `immich_url` | `IMMICH_URL` |
| `immich_api_key` | `IMMICH_API_KEY` |
| `immich_album` | `IMMICH_ALBUM` |
| `vision_provider` | `VISION_PROVIDER` |
| `vision_base_url` | `VISION_BASE_URL` |
| `vision_api_key` | `VISION_API_KEY` |
| `vision_model` | `VISION_MODEL` |
| `poll_interval_minutes` | `POLL_INTERVAL_MINUTES` |

## Env-vs-UI precedence

For each field, Oja computes its **effective value** like this:

```
environment variable  →  value saved in the UI (database)  →  built-in default
```

1. **Environment variable set?** It wins. The field is **locked** in the UI ("set by
   environment") and a `PUT /api/config` can't overwrite it.
2. **Otherwise, a value saved in the UI?** That's used. You can change it any time in
   Settings.
3. **Otherwise**, the **default** applies (e.g. album `Food`, model `gpt-4o-mini`).

Oja considers itself **configured** once the effective values for the photo source
(URL + key + album) **and** the vision model (base URL + key + model) are all present. Until
then, the poller and **Sync now** simply no-op with a clear message, and
`GET /api/health` reports `configured: false`.

### Secrets are never sent to the browser

`IMMICH_API_KEY` and `VISION_API_KEY` are **secret fields**. The config API returns only
whether each is **set** and **locked** — never the value. In the UI, secret fields show
`•••• set` or `not set`, and you can overwrite a secret by typing a new value (leaving it
blank keeps the existing one). Image bytes are proxied through Oja's server using the photo
source key, so that key never reaches your browser either.

## Where your data lives

| Thing | Location |
|---|---|
| Diary, settings, **and UI-saved config** | The database — a SQLite file in `./data` (default), or your Postgres if `DATABASE_URL` is a `postgres://…` URL. |
| Secrets you enter in the UI | Stored server-side in that same database; never echoed back to the browser. |
| Secrets you set via env | Live only in your `.env` / environment; they're read at boot and **lock** the field. |

Because UI-saved settings live in the database, they persist across restarts and upgrades
as long as you keep your `./data` mount (or Postgres). See
[Installation → Data & persistence](/installation#data-persistence).

## `.env` file example

This is the shipped `.env.example`. Everything except the core login/secret/port/db/tz
lines is optional at boot — leave it blank to enter it in the wizard, or fill it in to lock
it.

```ini
# --- Core ---------------------------------------------------------------
PORT=8462

# Single login password for the UI.
APP_PASSWORD=

# Secret used to sign the session cookie — e.g. `openssl rand -hex 32`.
SESSION_SECRET=

# Database. Defaults to a SQLite file in ./data. Set a postgres:// URL for Postgres.
# DATABASE_URL=postgres://user:pass@host:5432/oja

# --- Photo source (Immich) ----------------------------------------------
# Can all be left blank and entered in the Setup wizard instead.
IMMICH_URL=https://immich.example.com
IMMICH_API_KEY=
# Album (name or id) Oja watches for food photos.
IMMICH_ALBUM=Food

# --- Vision / LLM -------------------------------------------------------
# Adapter: openai (OpenAI-compatible, default — covers most providers incl.
# Ollama/LM Studio), anthropic (native), or gemini (native).
VISION_PROVIDER=openai
# OpenAI-compatible base URL (ignored by the native anthropic/gemini adapters).
VISION_BASE_URL=https://api.openai.com/v1
VISION_API_KEY=
# Any vision-capable model offered by your provider.
VISION_MODEL=gpt-4o-mini

# --- Behaviour ----------------------------------------------------------
# How often to auto-poll the album, in minutes. 0 disables auto-poll.
POLL_INTERVAL_MINUTES=90

# Timezone used for day boundaries (e.g. America/Toronto, Asia/Kolkata).
TZ=UTC
```

::: warning Don't commit secrets
`.env` is git-ignored — keep it that way. Treat `APP_PASSWORD`, `SESSION_SECRET`,
`IMMICH_API_KEY`, and `VISION_API_KEY` as secrets.
:::

## See also

- **[Vision providers](/vision-providers)** — concrete base URLs and example models per
  provider, plus how to pick one.
- **[Getting started](/getting-started)** — the wizard walkthrough.
- **[Architecture](/architecture)** — the full REST API surface and data model.
