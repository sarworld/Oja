// Single source of truth for the app version (SemVer). Keep this in sync with
// package.json on release — the RELEASING.md checklist bumps both, and CI tags
// the Docker image with this value. Surfaced via GET /api/health.
export const VERSION = '0.1.0';
