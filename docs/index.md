---
layout: home

hero:
  name: Oja
  text: A calorie diary that reads your food photos
  tagline: Self-hosted. Drop a meal photo into an Immich album and Oja logs the calories and macros — with a vision model you choose.
  actions:
    - theme: brand
      text: Install
      link: /installation
    - theme: alt
      text: GitHub
      link: https://github.com/sarworld/Oja

features:
  - icon: 📸
    title: Reads an Immich album
    details: Drop food photos into an album you already use; new ones get logged automatically. Read-only on your library.
  - icon: 🧠
    title: Bring your own model
    details: Local Ollama / LM Studio, or any OpenAI-compatible / Anthropic / Gemini endpoint. You control cost and privacy.
  - icon: ✏️
    title: Fix it by chatting
    details: '"I only had half, no rice" and Oja re-estimates. Your corrections become priors for next time.'
---

> ⚠️ **Built with heavy AI assistance**, reviewed and maintained by the author. Early and experimental — calorie numbers are AI estimates, not nutrition or medical advice.

## What it does

Point Oja at an Immich album (e.g. `Food`) and drop meal photos in. It polls the album, runs each new photo through your vision model, and logs the dish with per-item calories and macros. You get daily totals, macro bars, and a history chart against your goal.

One Docker container, SQLite by default, no telemetry, MIT.

- [Install →](/installation) — Docker Compose + the browser setup wizard
- [Configuration →](/configuration) — settings and env vars
- [Vision providers →](/vision-providers) — pick a model, local or hosted
- [FAQ →](/faq) — accuracy, sync, and common issues
