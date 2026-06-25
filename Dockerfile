# syntax=docker/dockerfile:1

# =============================================================================
# Stage 1 — build the web frontend (React + Vite -> web/dist)
# =============================================================================
FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS web-build
WORKDIR /app/web
COPY web/package.json web/package-lock.json* ./
RUN npm ci
COPY web/ ./
RUN npm run build

# =============================================================================
# Stage 2 — build the server (TypeScript -> server/dist)
# better-sqlite3 compiles a native addon, so we need python3/make/g++ here.
# =============================================================================
FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS server-build
WORKDIR /app/server
RUN apk add --no-cache python3 make g++
COPY server/package.json server/package-lock.json* ./
RUN npm ci
COPY server/ ./
RUN npm run build
# Prune to production dependencies for the final image (keeps the native
# better-sqlite3 binary that was just compiled).
RUN npm prune --omit=dev

# =============================================================================
# Final stage — single runtime image. Express serves the static web build.
# =============================================================================
FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Server runtime: compiled JS + production node_modules + package.json.
COPY --from=server-build /app/server/dist            ./server/dist
COPY --from=server-build /app/server/node_modules    ./server/node_modules
COPY --from=server-build /app/server/package.json    ./server/package.json

# Static frontend (Express serves this).
COPY --from=web-build    /app/web/dist               ./web/dist

# SQLite database / app data lives here; mount a volume to persist it.
# Own everything as the built-in non-root `node` user (uid 1000) and drop root.
RUN mkdir -p /app/data && chown -R node:node /app
VOLUME ["/app/data"]

# Run from /app so the default DATABASE_URL (sqlite:./data/oja.db) resolves to
# /app/data, which matches the VOLUME. (A named volume inherits this ownership;
# for a host bind-mount, chown the host dir to uid 1000 — see the docs.)
WORKDIR /app
USER node
EXPOSE 8462

CMD ["node", "server/dist/index.js"]
