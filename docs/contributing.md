# Contributing

Contributions of all sizes are welcome. This page is a quick orientation; the canonical
guide is **[`CONTRIBUTING.md`](https://github.com/sarworld/Oja/blob/main/CONTRIBUTING.md)**
in the repo.

## Project shape

Oja is a TypeScript monorepo (**Node 20+**):

- **`server/`** — Express/Node backend (also serves the built frontend in production).
- **`web/`** — React + Vite + Tailwind frontend.
- **`docs/`** — this documentation site (VitePress).

The single source of truth for the architecture and contracts is
[`SPEC.md`](https://github.com/sarworld/Oja/blob/main/SPEC.md). The
[Architecture](/architecture) page summarizes it.

## Development setup

Run the two dev servers in separate terminals. The frontend's Vite dev server proxies
`/api` to the backend.

```bash
# backend  (http://localhost:8462)
cd server
npm install
cp ../.env.example .env   # fill in IMMICH_*, VISION_*, APP_PASSWORD, SESSION_SECRET
npm run dev               # tsx watch, restarts on change

# frontend  (Vite dev server)
cd web
npm install
npm run dev
```

Useful scripts (available in **both** `server/` and `web/`):

```bash
npm run typecheck   # tsc, no emit
npm run build       # server -> server/dist, web -> web/dist
npm test            # vitest (server: unit + supertest API; web: component tests)
```

To exercise the production image locally:

```bash
docker compose up --build
```

## Before opening a PR

In each package you touched, keep things green:

```bash
npm run typecheck
npm run build
npm test
```

CI runs the same `typecheck` + `build` + `test` for both `server` and `web` on Node 20.
TypeScript is `strict` everywhere — keep the typecheck clean, match the surrounding style,
add or update tests alongside your change, and **never commit secrets** (`.env` is
git-ignored). Then fork, branch from `main`, and open a PR with a clear description.

## Working on the docs

This site is self-contained under `docs/`:

```bash
cd docs
npm install
npm run docs:dev       # local preview with hot reload
npm run docs:build     # production build (static site)
npm run docs:preview   # serve the built site
```

Pages are Markdown files in `docs/`; navigation and the sidebar live in
`docs/.vitepress/config.ts`. Keep docs accurate to the actual behavior — when you change a
feature, update the relevant page.

## Adding a vision provider

Vision support is intentionally easy to extend — each provider is a small adapter under
`server/src/providers/`.

1. **Add an adapter** in `server/src/providers/` with the shared shape
   `(cfg{base_url?, api_key, model}, imageBytes, prompt) => parsed estimate JSON`. The
   adapter sends the image to the provider and returns the parsed estimate. Reuse the shared
   JSON parsing (think-stripping, first-`{}` extraction, total fallback) so behavior stays
   consistent.
2. **Most providers need no new adapter.** If the provider exposes an **OpenAI-compatible**
   `/chat/completions` endpoint with `image_url` input, it already works with the existing
   `openai` adapter — you just add a **preset**. Only truly native APIs (like
   `anthropic`/`gemini`) warrant a new adapter.
3. **Register it** so `vision_provider` can select it.
4. **Add a preset** (label, provider, base URL, suggested models, optional note) so it shows
   up in the setup wizard's dropdown, and document a config block on the
   [Vision providers](/vision-providers) page.
5. **Test it** — add a unit test (mock the HTTP call) covering the happy path and the JSON
   parsing.

See [Architecture → The vision contract](/architecture#the-vision-contract) for the exact
JSON shape adapters must produce.

## Adding a new photo source (future)

Today **Immich** is the only photo source, but the design keeps the source behind an
abstraction so others can be added. A new source needs to provide, at minimum:

- a way to **list the assets** in a configured album/collection (with each asset's **stable
  id** and **capture time**), and
- a way to **fetch image bytes** for an asset (so Oja can analyze it and proxy thumbnails
  without storing duplicates).

The [sync logic](/how-sync-works) (dedup by asset id, non-food memory, retry/park, and the
"removed from source" reconcile) and the vision pipeline are **source-agnostic** — they
operate on those two capabilities. If you're interested in adding a source, open an issue to
discuss the interface first.

## Filing issues

Bug reports and feature requests are welcome on the
[issue tracker](https://github.com/sarworld/Oja/issues). For bugs, include your Oja version,
how you deployed it (Docker/compose), your vision provider, and any relevant lines from
`docker compose logs oja`.
