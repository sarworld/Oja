# Configuration

There are two ways to set anything: the **setup wizard / Settings page** in the
browser, or **environment variables**. If an env var is set, that field becomes
read-only in the UI (`set by environment`) — handy for reproducible deploys.
Secrets (API keys) are stored server-side and shown masked.

## Connection settings

| Setting | Env var | What it is |
|---|---|---|
| Immich URL | `IMMICH_URL` | Your Immich server, e.g. `https://immich.example.com` |
| Immich API key | `IMMICH_API_KEY` | A read-access key from Immich (Account Settings → API Keys) |
| Album | `IMMICH_ALBUM` | The album to watch (name or id), e.g. `Food` |
| Vision provider | `VISION_PROVIDER` | `openai` (OpenAI-compatible, default), `anthropic`, or `gemini` |
| Vision base URL | `VISION_BASE_URL` | The endpoint, e.g. `https://api.openai.com/v1` |
| Vision API key | `VISION_API_KEY` | Key for your model provider (any non-empty string for local models) |
| Vision model | `VISION_MODEL` | The vision-capable model id |
| Auto-sync | `POLL_INTERVAL_MINUTES` | How often to check the album (default `90`; `0` = manual only) |

See [Vision providers](/vision-providers) for ready-made base URLs and models.

## Core settings

| Env var | Default | What it is |
|---|---|---|
| `APP_PASSWORD` | — | Single login password (set one) |
| `SESSION_SECRET` | — | Signs the session cookie (`openssl rand -hex 32`) |
| `PORT` | `8462` | Port the app listens on / publishes |
| `TZ` | `UTC` | Timezone for day boundaries, e.g. `America/Toronto` |
| `COOKIE_SECURE` | `false` | Set `true` behind HTTPS |
| `DATABASE_URL` | — | Set a `postgres://…` URL to use Postgres instead of SQLite |
