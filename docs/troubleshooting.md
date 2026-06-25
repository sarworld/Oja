# Troubleshooting

Common issues and how to fix them. If your problem isn't here, check the
[FAQ](/faq) and the container logs:

```bash
docker compose logs -f oja
```

## I can't reach Oja / the login page

- Confirm the container is up: `docker compose ps`.
- Check `GET /api/health` directly: `curl http://localhost:8462/api/health` should return
  `{"ok":true,"configured":...}`.
- Make sure you're using the right **port** (default `8462`, or whatever you set as `PORT`),
  and that the compose **port mapping** matches it.

## I don't know my login password

The login password is **`APP_PASSWORD`**. If you never set it in `.env`, Oja **generated a
random one and logged it on boot** — find it in the startup logs:

```bash
docker compose logs oja | grep -i password
```

For a stable password, set `APP_PASSWORD` in `.env` and restart (`docker compose up -d`).

## It keeps logging me out / sessions reset on restart

Set a fixed **`SESSION_SECRET`**. If it's unset, Oja generates a random one each boot, which
**invalidates existing sessions** on every restart. Use a long random value:

```bash
openssl rand -hex 32
```

Put it in `.env` as `SESSION_SECRET` and restart.

## "Can't connect to source" / Immich test fails

When **Test & load albums** (or `POST /api/config/test-immich`) fails:

- **Base URL** — use your Immich **base URL** (e.g. `https://immich.example.com`), not a
  deep link. Include the scheme (`https://`).
- **Reachability from the container** — Oja calls your source from **inside Docker**. If
  Immich is on the same host, `http://localhost…` won't work from the container; use the
  host's **LAN IP** or `host.docker.internal` (on Linux, add
  `extra_hosts: ["host.docker.internal:host-gateway"]`).
- **API key** — recreate it in Immich (**Account Settings → API Keys → New API Key**) and
  paste the fresh key; it's only shown once. See
  [Get an Immich API key](/getting-started#get-an-immich-api-key).
- **TLS / certificate** — a self-signed or invalid certificate on your Immich URL can block
  the connection; use a valid certificate or a reachable `http://` LAN address.
- **Reverse proxy** — make sure the proxy in front of Immich forwards the API paths and
  isn't stripping auth headers.

## My album doesn't appear / no photos sync

- After a successful Immich test, **pick the album** from the dropdown — Oja only watches
  the configured album.
- `IMMICH_ALBUM` accepts the album's **name** (e.g. `Food`) **or** its **id**. If you
  renamed the album, update the field (a rename can break a name-based match).
- Confirm the photos are actually **in that album** in Immich.
- Press **Sync now** and read the toast/logs — *"Up to date"* with `0 added` means Oja saw
  no **new** photos (already-logged ones are skipped by design — see
  [add-only & deduped](/how-sync-works#add-only-deduped-by-source-asset-id)).
- New photos that aren't food are recorded as **notfood** and won't appear as meals — that's
  expected.

## Vision test fails / "Vision OK" never shows

When **Test &lt;provider&gt;** (or `POST /api/config/test-vision`) fails:

- **Provider / base URL mismatch** — for OpenAI-compatible providers the **base URL** must
  match the provider (the wizard preset fills the right one). For **Anthropic** use the
  `anthropic` adapter and for **Gemini** the `gemini` adapter — don't point an OpenAI base
  URL at them.
- **API key** — wrong/expired keys fail the round-trip. For **local** providers
  (Ollama / LM Studio) any non-empty string works, but the field can't be empty.
- **Model id** — use a **vision-capable** model that your provider actually offers; ids
  change over time (see [Vision providers](/vision-providers)).
- **Local model not reachable** — if Ollama / LM Studio runs on the host, the container
  needs `host.docker.internal` (or the host LAN IP), and the model's **local server must be
  running** (`ollama serve` / LM Studio's server, with the model pulled/loaded). See
  [Calling a local model from inside Docker](/installation#calling-a-local-model-from-inside-docker).

## Syncs error / "model returns no JSON"

Oja parses model output defensively — it strips `<think>…</think>` blocks, extracts the
first JSON object, and sums per-item numbers if totals are missing. If a photo still errors:

- Oja **counts it as an error, retries it on later syncs, and parks it** after repeated
  failures — it never aborts the whole sync, so other photos still process. See
  [transient errors](/how-sync-works#transient-errors-are-retried-then-parked).
- Some models are bad at returning clean JSON or at vision. Try a **stronger
  vision-capable model** (e.g. `gpt-4o-mini`) to confirm it's a model-quality issue.
- Check `docker compose logs -f oja` for the specific per-asset error message.

## "A sync is already running"

Only one sync runs at a time. If you press **Sync now** during an in-progress sync, you'll
see this (the API returns `409`). Wait for the current run to finish and try again.

## A meal shows a broken/placeholder thumbnail

The photo for that meal is likely **no longer in the source album** — the entry is
**flagged as removed from source**, the image can't load, and a placeholder is shown. **The
meal and its calories are kept on purpose** (your diary is the source of truth). To remove
the meal, **Delete** it from the card. See
[Removing a photo](/how-sync-works#removing-a-photo-doesn-t-delete-the-meal).

## A non-food photo got logged as a meal (or vice versa)

The non-food gate is the model's `is_food` judgement and isn't perfect. If a non-meal
slipped through, **exclude** or **delete** it from the Today view. If a real meal was
wrongly skipped as non-food, **re-add the photo** or rely on other photos of the meal.

## Day totals look off / a meal is on the wrong day

- Totals count only meals toggled **Counted** — check the
  [include/exclude](/usage#include-exclude-a-meal) state.
- Days are bucketed by each photo's **capture time** in your **`TZ`**. If meals land on the
  wrong calendar day, set `TZ` to your local timezone (e.g. `America/Toronto`) and restart.

## A config field is greyed out / "set by environment"

That field is **set by an environment variable**, which **locks** it in the UI. To change
it, edit the value in `.env` (or your environment) and restart — or unset the env var to
manage it from the UI. See [env-vs-UI precedence](/configuration#env-vs-ui-precedence).

## Resetting

Your entire diary and UI-saved config live in **`./data`** (or your Postgres). To start
completely fresh, stop Oja and remove that data — **this is irreversible**:

```bash
docker compose down
rm -rf ./data        # deletes your diary and saved config — be sure!
docker compose up -d
```

(With Postgres, drop/recreate your database instead.)
