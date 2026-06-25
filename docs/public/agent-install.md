# Oja — AI Agent Install Guide

You are an automated coding agent setting up **Oja** on the user's machine. Oja is a
self-hosted web app that reads food photos from the user's **Immich** album and logs
calories with a vision LLM. Follow these steps **in order**. Run the shell commands
yourself. Ask the user **only** for the values in Step 1 — generate everything else.

## Step 0 — Prerequisites
Run `docker version`. If Docker is not installed or not running, stop and tell the user to
install/start Docker, then resume.

## Step 1 — Ask the user for these values
1. `IMMICH_URL` — their Immich server, e.g. `https://immich.example.com`
2. `IMMICH_API_KEY` — Immich → Account Settings → API Keys → New
3. `IMMICH_ALBUM` — the album Oja watches (default: `Food`). Tell them to create it in
   Immich and drop food photos into it.
4. The vision LLM. Offer two defaults and let them pick:
   - **Anthropic (recommended, cheap):** `VISION_PROVIDER=anthropic`,
     `VISION_BASE_URL=https://api.anthropic.com`, `VISION_MODEL=claude-haiku-4-5`,
     and ask for `VISION_API_KEY` (an Anthropic API key).
   - **Local / $0 (Ollama):** `VISION_PROVIDER=openai`,
     `VISION_BASE_URL=http://host.docker.internal:11434/v1`, `VISION_MODEL=llava`,
     `VISION_API_KEY=ollama` (any non-empty string). Requires Ollama running with
     `ollama pull llava`. On Linux add `--add-host=host.docker.internal:host-gateway`
     to the `docker run` in Step 4.
   - Any OpenAI-compatible API also works (OpenAI `gpt-4o-mini`, OpenRouter, Groq,
     etc.): `VISION_PROVIDER=openai` + that provider's base URL/key/model.

Export each as a shell variable (`IMMICH_URL=...`, etc.).

## Step 2 — Generate secrets (do not ask the user)
```bash
APP_PASSWORD=$(openssl rand -hex 12)
SESSION_SECRET=$(openssl rand -hex 32)
```
Remember `APP_PASSWORD` — you give it to the user in Step 6.

## Step 3 — Get Oja
Try the published image:
```bash
docker pull ghcr.io/sarworld/oja:latest
```
If that fails (image not published yet), build from source instead:
```bash
git clone https://github.com/sarworld/Oja.git && cd oja
```

## Step 4 — Run
**If you pulled the image:**
```bash
docker run -d --name oja -p 8462:8462 -v oja-data:/app/data \
  -e APP_PASSWORD="$APP_PASSWORD" -e SESSION_SECRET="$SESSION_SECRET" \
  -e IMMICH_URL="$IMMICH_URL" -e IMMICH_API_KEY="$IMMICH_API_KEY" -e IMMICH_ALBUM="$IMMICH_ALBUM" \
  -e VISION_PROVIDER="$VISION_PROVIDER" -e VISION_BASE_URL="$VISION_BASE_URL" \
  -e VISION_API_KEY="$VISION_API_KEY" -e VISION_MODEL="$VISION_MODEL" \
  ghcr.io/sarworld/oja:latest
```
**If you cloned the source**, write a `.env` file in the repo with those same keys
(`APP_PASSWORD=...`, `SESSION_SECRET=...`, `IMMICH_*`, `VISION_*`), then:
```bash
docker compose up -d --build
```

## Step 5 — Verify it came up configured
```bash
for i in $(seq 1 20); do
  curl -sf http://localhost:8462/api/health | grep -q '"configured":true' && break
  sleep 2
done
curl -s http://localhost:8462/api/health
```
Expect `{"ok":true,"version":"...","configured":true}`. If `configured` is `false`, an
Immich/vision value is wrong or missing — re-check Step 1 and `docker logs oja`.

## Step 6 — (optional) Trigger the first sync
```bash
J=$(mktemp)
curl -s -c "$J" -b "$J" -X POST -H 'Content-Type: application/json' \
  -d "{\"password\":\"$APP_PASSWORD\"}" http://localhost:8462/api/login >/dev/null
curl -s -b "$J" -X POST http://localhost:8462/api/sync; echo
```

## Step 7 — Report to the user
Tell them:
- **URL:** `http://localhost:8462` (or `http://<this-host-ip>:8462`)
- **Login password:** the `APP_PASSWORD` you generated
- Drop food photos into the **`$IMMICH_ALBUM`** album in Immich; Oja logs them every
  ~90 min and has a **Sync now** button. Open Settings to set a daily calorie goal.

## Troubleshooting
- **`400 / could not process image`, or a `temperature` error** → use a current vision
  model: `claude-haiku-4-5` / `claude-sonnet-4-6` / `claude-opus-4-8` (Anthropic), or
  `gpt-4o-mini` (OpenAI). Old `claude-3-5-*` IDs are retired.
- **`401` on `/api/sync`** → log in first (Step 6).
- **No photos appearing** → confirm the album name matches `IMMICH_ALBUM` exactly and the
  Immich API key is valid; `docker logs oja` shows sync activity.
