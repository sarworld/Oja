# Contributing to Oja

Thanks for your interest in improving Oja! Contributions of all sizes are welcome.

## Development setup

Oja is a TypeScript monorepo (Node 20+):

- `server/` — Express/Node backend (also serves the built frontend in production)
- `web/` — React + Vite + Tailwind frontend

Run both dev servers in separate terminals:

```bash
# backend
cd server
npm install
cp ../.env.example .env   # fill in IMMICH_*, VISION_*, APP_PASSWORD, SESSION_SECRET
npm run dev

# frontend
cd web
npm install
npm run dev
```

The frontend's Vite dev server proxies `/api` to the backend. See the README's **Configuration** and
**Choosing a vision model** sections for environment variables.

## Code style

- **TypeScript everywhere**, `strict` mode. Keep the typecheck clean.
- Before pushing, run in each package you touched:
  ```bash
  npm run typecheck
  npm run build
  npm test
  ```
  Both packages have test suites (`vitest`). CI runs the same `typecheck` + `build` + `npm test` for
  both `server` and `web` on Node 20 — keep it green. Add or update tests alongside your change.
- Match the surrounding style. Small, focused changes are easier to review.
- Don't commit secrets. `.env` is gitignored — keep it that way.

## Opening a pull request

1. Fork the repo and create a branch from `main` (e.g. `fix/history-timezone`).
2. Make your change, with the typecheck and build passing locally.
3. Write a clear PR description: what changed and why. Link any related issue.
4. Open the PR against `main`. A maintainer will review it.

For larger changes, please open an issue first to discuss the approach.

## License

By contributing, you agree that your contributions are licensed under the project's
[MIT License](LICENSE).
