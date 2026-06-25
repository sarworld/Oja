# Installation

Oja ships as **one Docker image**. A multi-stage build compiles the React frontend and
the TypeScript backend, then the final image serves the static UI from the same Express
server that exposes the API — so there's a single container to run.

## Requirements

- **Docker** with the Compose plugin (`docker compose`).
- A running **photo source** (Immich today) and a **vision LLM** (cloud or local). These
  can be configured after the container is up — see [Getting started](/getting-started).

## Docker Compose (recommended)

The repo includes a ready-to-use `docker-compose.yml`:

```yaml
services:
  oja:
    build: .
    image: oja
    container_name: oja
    env_file: .env
    ports:
      - "${PORT:-8462}:${PORT:-8462}"
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

Start it:

```bash
cp .env.example .env   # set at least APP_PASSWORD and SESSION_SECRET
docker compose up -d
```

Then open **http://localhost:8462**. See [Getting started](/getting-started) for the
first-run wizard.

::: details Building locally vs using a prebuilt image
The bundled compose file uses `build: .`, which builds the image from the `Dockerfile`
in the repo. If a published image is available for your release, you can replace
`build: .` with `image: <published-image>:<tag>` to pull instead of build. Pinning a
version tag (rather than `latest`) is recommended so upgrades are deliberate.
:::

## Ports

| Setting | Default | Notes |
|---|---|---|
| `PORT` | `8462` | The HTTP port Express listens on, **inside** the container. The compose file maps the same port on the host (`${PORT:-8462}:${PORT:-8462}`). |

To serve on a different host port, set `PORT` in `.env` (it's read by both the app and the
compose port mapping). Put Oja behind a reverse proxy (Caddy, Traefik, nginx) if you want
TLS or a hostname.

## Data & persistence

Oja stores **everything that matters in `/app/data`** inside the container:

- The **SQLite database** (`oja.db` by default) — your diary, settings, and any config you
  saved through the UI.

The compose file bind-mounts the host's `./data` directory to `/app/data`, and the image
declares `/app/data` as a volume. **Keep this mount** — it's what makes your diary survive
`docker compose down`, image rebuilds, and upgrades.

```yaml
volumes:
  - ./data:/app/data
```

::: warning Back up ./data
Your entire diary lives in `./data`. Back it up like any other important data. (If you use
Postgres instead of SQLite, back up your database server instead — see below.)
:::

If you run Postgres, the SQLite file isn't used, but `/app/data` may still be needed for
other runtime files — keep the mount in place.

## SQLite (default) vs Postgres

By default Oja uses **better-sqlite3** — a single file in `./data`, zero setup. This is the
right choice for nearly everyone.

If you'd rather use **Postgres** (for example, you already run a database server and want
your diary there), set `DATABASE_URL` to a `postgres://…` connection string. Oja
auto-selects Postgres when the URL starts with `postgres`:

```ini
# .env
DATABASE_URL=postgres://oja:secret@db:5432/oja
```

A minimal compose setup with Postgres:

```yaml
services:
  oja:
    build: .
    image: oja
    container_name: oja
    env_file: .env          # contains DATABASE_URL=postgres://oja:secret@db:5432/oja
    ports:
      - "${PORT:-8462}:${PORT:-8462}"
    volumes:
      - ./data:/app/data
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    container_name: oja-db
    environment:
      POSTGRES_USER: oja
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: oja
    volumes:
      - ./pgdata:/var/lib/postgresql/data
    restart: unless-stopped
```

Oja creates its tables automatically on first connect, for both SQLite and Postgres.

::: tip Which should I pick?
**SQLite** unless you have a specific reason not to — it's simpler, file-based, and easy
to back up. Reach for **Postgres** only if you already operate one or want centralized
backups/HA.
:::

## Calling a local model from inside Docker

If your vision model runs on the **host** (Ollama or LM Studio), the container can't reach
it at `localhost` — that's the container's own loopback. Use `host.docker.internal`
instead, e.g. `http://host.docker.internal:11434/v1` for Ollama.

On **Linux**, add the host gateway mapping to the service:

```yaml
services:
  oja:
    # ...
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

Alternatively, point the base URL at your host's LAN IP. Details and per-provider base
URLs are on the [Vision providers](/vision-providers) page.

## Updating

With a `build: .` compose file:

```bash
# pull the latest source for your chosen version, then:
docker compose up -d --build
```

With a pinned, published image, bump the tag in `docker-compose.yml` and:

```bash
docker compose pull
docker compose up -d
```

Your `./data` directory (and therefore your diary) is untouched by updates. Oja applies any
needed database migrations on startup.

::: tip Pin versions
Self-hosters generally pin a specific version rather than tracking a moving tag, so updates
are intentional. Read the project's changelog/releases before bumping.
:::

## Verifying it's running

```bash
# container status
docker compose ps

# follow logs
docker compose logs -f oja

# health check (no auth required)
curl http://localhost:8462/api/health
# -> {"ok":true,"configured":false}   (configured flips to true once set up)
```

`configured: false` simply means the photo source and/or vision model haven't been set up
yet — finish the [setup wizard](/getting-started#_4-finish-the-setup-wizard).

## Running from source (development)

Oja is a TypeScript monorepo — an Express/Node backend in `server/` and a React + Vite
frontend in `web/`, requiring **Node 20+**. For local development without Docker, see
[Contributing](/contributing#development-setup).

## Security notes

Oja is a single-user, self-hosted app. A few things to harden a real deployment:

- **Set a strong `APP_PASSWORD`.** It's the only credential; logins are rate-limited
  (10/min) and the compare is constant-time, but a weak password is still a weak password.
- **Protect `.env`** — it holds your Immich and LLM API keys. `chmod 600 .env` so only your
  user can read it; it's already git-ignored so it won't be committed.
- The vision/sync endpoints (`/sync`, `/reanalyze`, `/entries/:id/chat`) are login-protected
  and additionally rate-limited (30/min) so a leaked password can't run up large LLM bills.
- **Put it behind TLS and set `COOKIE_SECURE=true`** when serving over HTTPS (e.g. a reverse
  proxy). Leave it `false` for plain-HTTP access on a trusted LAN, or the login cookie won't
  be sent.
- **Only point `IMMICH_URL` / vision base URL at endpoints you trust.** Oja makes outbound
  requests to whatever you configure (that's the point — your Immich and your LLM). It does
  not restrict those hosts, so don't expose the config to untrusted users.
- **Don't expose Oja directly to the public internet.** Keep it on your LAN/VPN or behind an
  authenticating reverse proxy.
- The container runs as a **non-root** user. With the bundled Compose file (named volume)
  this just works; if you bind-mount a host directory instead, `chown 1000:1000` it first so
  the app can write its database.
