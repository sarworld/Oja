# Releasing & versioning

## Versioning scheme

Oja uses [Semantic Versioning](https://semver.org/): **MAJOR.MINOR.PATCH**.

- **PATCH** (`0.1.0 → 0.1.1`) — bug fixes, no behaviour or API changes.
- **MINOR** (`0.1.0 → 0.2.0`) — new features, backward-compatible.
- **MAJOR** (`0.x → 1.0.0`) — first stable release / breaking changes.

We are pre-1.0 (`0.x`): the app works but the API and config may still shift
between minor versions until `1.0.0`.

The version lives in **three places that must match** on release:
1. `server/package.json` `version`
2. `web/package.json` `version`
3. `server/src/version.ts` `VERSION` (surfaced at `GET /api/health` and shown in
   the app's Settings)

## Cutting a release

1. Update the three version fields above to the new `X.Y.Z`.
2. Move items from `## [Unreleased]` into a new `## [X.Y.Z]` section in
   `CHANGELOG.md` with the date.
3. Commit: `release: vX.Y.Z`.
4. Tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z`.

That's it. The **`.github/workflows/release.yml`** workflow (triggered by the
`v*.*.*` tag) then automatically:

- verifies the tag matches all three source versions (fails the release if they
  drift),
- runs typecheck + build + tests for `server` and `web`,
- builds a **multi-arch image** (`linux/amd64` + `linux/arm64`) and pushes it to
  **GHCR** as `ghcr.io/sarworld/oja:X.Y.Z` (+ `:X.Y` and, for non-prerelease tags,
  `:latest` — an `-rc` tag never becomes `latest`),
- creates a **GitHub Release** with notes extracted from `CHANGELOG.md`
  (prereleases when the tag contains `-`, e.g. `v0.2.0-rc.1`).

No extra secrets are needed — it uses the built-in `GITHUB_TOKEN`. Every push/PR
also runs a Docker build (no push) in CI, so a broken `Dockerfile` is caught long
before you tag.

## What updating a version does to user data

**Updating never wipes data.** The database is stored on a host volume
(`./data` → `/app/data`, SQLite `oja.db` by default), separate from the
container image. Pulling a new image and recreating the container
(`docker compose pull && docker compose up -d`) keeps the same volume.

On startup the server runs **idempotent schema migrations** (`CREATE TABLE IF
NOT EXISTS` + additive `ALTER TABLE … ADD COLUMN IF NOT EXISTS`), so a newer
version upgrades an existing database in place. New columns get safe defaults;
existing rows are preserved.

The only ways to lose data are operator actions: deleting the `./data` directory,
removing the volume, or running the container **without** the volume mount.

## Compatibility notes

- **Photo source:** verified against Immich v2.7.x and v3.0.0. Album assets are
  read via the metadata search API (works across both major versions).
- **Database:** SQLite (default) and Postgres are both supported and tested.
