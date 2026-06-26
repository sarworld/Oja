# Contributing

Issues and PRs welcome. The repo is a small TypeScript monorepo — an Express/Node
backend in `server/` and a React + Vite frontend in `web/`. Requires **Node 20+**.

```bash
# backend (http://localhost:8462)
cd server && npm install && npm run dev

# frontend (Vite dev server, proxies /api to the backend)
cd web && npm install && npm run dev
```

Before opening a PR:

```bash
npm run typecheck   # in server/ and web/
npm test            # vitest
```

`main` is protected — changes go through a PR with green CI.

> Heads up: this project was built with heavy AI assistance, and is reviewed and
> maintained by the author. PRs are reviewed the same way.
