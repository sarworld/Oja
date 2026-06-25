# Getting started

This guide takes you from nothing to a working Oja in about five minutes. You'll start
the container, finish a short **setup wizard** in your browser, and run your first sync.

## Set up with an AI agent

Have an agentic AI session handy (Claude Code, Cursor, ChatGPT with tools, …)? **Copy this
prompt** and paste it in — the agent fetches the install guide, asks you for your keys, and
runs everything:

> Set up **Oja** on this machine — a self-hosted calorie tracker that reads food photos from
> my Immich album and estimates calories with an LLM. Fetch
> `https://raw.githubusercontent.com/sarworld/Oja/main/docs/public/agent-install.md` and follow
> it exactly. Ask me for my Immich URL, Immich API key, and an LLM API key (default the
> vision model to Anthropic `claude-haiku-4-5`); generate the app password and session
> secret yourself. Run it with Docker, verify `http://localhost:8462/api/health` shows
> `"configured": true`, then give me the URL and login password.

The agent follows [`/agent-install.md`](/agent-install.md) — a step-by-step guide written for
automated agents (collect keys → generate secrets → run → verify → report).

## One-command setup (headless / scripts)

Provisioning Oja unattended yourself — from a script, CI, or a NAS? Pass every setting as an
environment variable and Oja boots **fully configured**, skipping the wizard:

```bash
docker run -d --name oja -p 8462:8462 -v oja-data:/app/data \
  -e APP_PASSWORD="$(openssl rand -hex 12)" \
  -e SESSION_SECRET="$(openssl rand -hex 32)" \
  -e IMMICH_URL="https://immich.example.com" \
  -e IMMICH_API_KEY="<immich-api-key>" \
  -e IMMICH_ALBUM="Food" \
  -e VISION_PROVIDER="anthropic" \
  -e VISION_BASE_URL="https://api.anthropic.com" \
  -e VISION_API_KEY="<vision-api-key>" \
  -e VISION_MODEL="claude-haiku-4-5" \
  ghcr.io/sarworld/oja:latest
```

Open `http://localhost:8462`, log in with the password you set, and it's already connected —
no wizard. Env-provided values are **locked** (read-only) in the UI, which is exactly what you
want for reproducible, declarative deploys. Swap the `VISION_*` block for any
[provider](/vision-providers) — e.g. a local Ollama for a $0, private setup.

**Minimal** variant (configure the rest in the browser):

```bash
docker run -d --name oja -p 8462:8462 -v oja-data:/app/data \
  -e APP_PASSWORD="changeme" -e SESSION_SECRET="$(openssl rand -hex 32)" \
  ghcr.io/sarworld/oja:latest
```

::: tip Image availability
`ghcr.io/sarworld/oja` is published by the release workflow on each tagged version
(multi-arch `amd64` + `arm64`). Before the first release exists, build from source with
the Compose flow below.
:::

## What you need

- **[Docker](https://docs.docker.com/get-docker/)** with the Compose plugin (`docker compose`).
- A running **photo source**. **[Immich](https://immich.app) is the supported source today** —
  you need its base URL and an [API key](#get-an-immich-api-key).
- A **vision LLM** you can call. This can be a cloud provider (an API key) **or** a fully
  local, free model via [Ollama](/vision-providers#ollama-local-0-private) or
  [LM Studio](/vision-providers#lm-studio-local-0-private). See [Vision providers](/vision-providers).

::: tip You can configure everything in the browser
You do **not** need to prepare your photo-source or LLM details in advance. The only
things you set before the first launch are a **login password** and a **session secret**;
everything else is entered in the setup wizard. (If you'd rather bake config into the
container for a headless deploy, see [Configuration](/configuration).)
:::

## 1. Get the code

```bash
git clone https://github.com/sarworld/Oja.git
cd oja
```

## 2. Set a login password

Oja ships an `.env.example` you can copy. For a browser-driven setup, you only need to
fill in two values:

```bash
cp .env.example .env
```

Edit `.env` and set:

```ini
# A password you'll use to log into the Oja web UI.
APP_PASSWORD=choose-a-strong-password

# A long random string used to sign your login session cookie.
SESSION_SECRET=paste-a-long-random-string-here
```

Generate a good `SESSION_SECRET` with:

```bash
openssl rand -hex 32
```

You can leave the `IMMICH_*` and `VISION_*` lines blank — you'll enter those in the
wizard. (Anything you *do* set in `.env` becomes **locked** in the UI; see
[env-vs-UI precedence](/configuration#env-vs-ui-precedence).)

## 3. Start Oja

```bash
docker compose up -d
```

This builds and starts a single container. Your data is stored in `./data` (bind-mounted
into the container), so your diary survives restarts and upgrades.

Open **http://localhost:8462** and log in with your `APP_PASSWORD`.

## 4. Finish the setup wizard

If your photo source and vision model aren't configured yet, Oja drops you straight into
the **setup wizard**. It has three steps.

### Step 1 — Connect your photo source (Immich)

1. Enter your **Immich base URL** (e.g. `https://immich.example.com`).
2. Paste your **Immich API key** (see [below](#get-an-immich-api-key) to create one).
3. Click **Test & load albums**. Oja verifies the connection and shows
   *"Connected — N album(s) found."*
4. From the **Album to watch** dropdown, pick the album you'll drop food photos into.
5. Click **Next: Vision**.

### Step 2 — Choose a vision model

1. Pick a **provider preset** from the dropdown (OpenAI, OpenRouter, MiniMax, Groq,
   Together, DeepInfra, Ollama, LM Studio, Anthropic, Google Gemini, or Custom). Selecting
   a preset auto-fills the **base URL** and suggests vision-capable **models**.
2. Adjust the **model** if you want (suggestions appear as you type).
3. Paste your **API key** (local providers like Ollama / LM Studio usually need none —
   any non-empty string works).
4. Click **Test &lt;provider&gt;** for a tiny round-trip check. On success you'll see
   *"Vision OK."*
5. Click **Next: Save**.

::: tip Not sure which model to pick?
`gpt-4o-mini` (OpenAI) is a good, cheap default — roughly a fraction of a cent per photo.
Want zero cloud and `$0`? Run **Ollama** locally with `llava`. Full guidance is on the
[Vision providers](/vision-providers) page.
:::

### Step 3 — Save

Review the summary and click **Save & finish**. Oja writes your settings (secrets are
stored server-side and never shown again) and takes you to your dashboard.

You can return to the wizard any time from **Settings → Connection → Edit**.

## 5. Run your first sync

1. Drop a food photo into your watched album. The easiest path: on your phone, **Share →
   Immich → your Food album**, or let your normal auto-backup carry it in.
2. In Oja, open the **Today** tab and click **Sync now**.
3. Oja fetches new photos, analyzes each one, and shows your meals with calories, macros,
   and a per-item breakdown. Your goal ring and macro bars update.

After the first manual sync, Oja keeps polling your album automatically on the interval
you set (default **every 90 minutes**) — so new photos show up on their own.

## Get an Immich API key

1. Open your Immich web UI and click your avatar → **Account Settings**.
2. Open the **API Keys** section and click **New API Key**.
3. Give it a name (e.g. `oja`) and create it. **Copy the key — it's only shown once.**
4. Paste it into the wizard's *Immich API key* field (or set `IMMICH_API_KEY` in `.env`).

Oja proxies images through its own server using this key, so the key is **never exposed
to your browser**.

## Next steps

- **[Daily usage →](/usage)** — the goal ring, corrections, chat, food memory, history.
- **[How sync works →](/how-sync-works)** — dedup, non-food handling, and what happens
  when you remove a photo.
- **[Configuration →](/configuration)** — the full variable reference.
- Hit a snag? See **[Troubleshooting](/troubleshooting)**.
