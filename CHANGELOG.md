# Changelog

All notable changes to Oja are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project uses
[Semantic Versioning](https://semver.org/) (see [RELEASING.md](./RELEASING.md)).

## [Unreleased]

## [0.1.0] — first preview

The initial public preview: a self-hosted calorie diary that reads food photos
from your photo source (Immich) and estimates calories with a bring-your-own
vision LLM.

### Added
- **Photo-source ingestion** — watch an album; auto-poll on an interval plus a
  manual **Sync now**. Add-only and deduped by source asset ID.
- **Vision estimates** — dish name, per-item kcal + macros, confidence, notes.
- **In-app setup wizard** — configure the photo source (URL + API key, album
  picker) and the vision provider (preset + key + model) from the browser; env
  vars, when set, lock the corresponding field for headless deploys.
- **Many LLM providers** — OpenAI-compatible (OpenAI, OpenRouter, MiniMax, Groq,
  Together, DeepInfra, Ollama, LM Studio, vLLM) plus native Anthropic and Gemini.
- **Corrections** — include/exclude per meal, manual edit, **re-analyze**, and a
  **talk-it-through** chat that adjusts the numbers.
- **Personal food memory** — past corrected meals are fed back as priors so
  recurring meals converge to your own numbers.
- **Dashboard** — daily goal ring + macro bars, history chart, and a calendar
  date picker to jump to any day.
- **Resilient sync** — non-food photos are remembered (not re-analyzed), hard
  failures retry then park, and meals whose photo left the source are flagged
  **“removed from source”** (kept, not deleted).
- **Storage** — SQLite by default (single file, zero-setup) or Postgres via
  `DATABASE_URL`. Schema auto-migrates on startup.
- Single Docker image (+ compose), MIT licensed, 52 automated tests, CI.

### Compatibility
- Verified against **Immich v2.7.x and v3.0.0-rc.2**. (v3 removed the embedded
  `assets` array from the album endpoint; Oja uses the metadata search API,
  which works on both.)

[Unreleased]: https://github.com/sarworld/Oja/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/sarworld/Oja/releases/tag/v0.1.0
