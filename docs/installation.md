# Install

Oja runs as a single Docker container. You need [Immich](https://immich.app) and
a vision-capable LLM (local or hosted) — see [Vision providers](/vision-providers).

## Docker Compose

```bash
git clone https://github.com/sarworld/Oja && cd Oja
cp .env.example .env
docker compose up -d
```

Set at least these in `.env`:

```bash
APP_PASSWORD=choose-a-strong-one        # the single login password
SESSION_SECRET=$(openssl rand -hex 32)  # signs the session cookie
```

Then open **`http://localhost:8462`**, log in, and the **setup wizard** walks you
through the rest in the browser — your Immich URL + API key, the album to watch,
and your vision model. No further config files needed.

To change the port, set `PORT` in `.env` (the app and the published port follow it).

## Data

The database lives in a named Docker volume (`oja-data`), so your history survives
restarts and updates. Default storage is a single SQLite file — zero setup.

**Postgres (optional):** set `DATABASE_URL=postgres://user:pass@host:5432/oja` in
`.env` and Oja uses Postgres instead. The schema is created automatically.

## Updating

```bash
git pull
docker compose up -d --build
```

Your `.env` and the data volume are untouched.

## Behind a reverse proxy

Serving over HTTPS? Set `COOKIE_SECURE=true` so the login cookie gets the Secure
flag. Plain-HTTP LAN access works with the default (`false`).
