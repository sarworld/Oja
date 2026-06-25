---
layout: home

hero:
  name: Oja
  text: A private calorie diary that reads your food photos
  tagline: Self-hosted, MIT-licensed, and powered by the AI model of your choice. Drop a food photo into your photo source — Oja logs the calories and macros.
  actions:
    - theme: brand
      text: Get started
      link: /getting-started
    - theme: alt
      text: How it works
      link: /how-sync-works
    - theme: alt
      text: View on GitHub
      link: https://github.com/sarworld/Oja

features:
  - icon: 📸
    title: Reads your photo source
    details: Point Oja at a photo source where you already drop food photos. Immich is the supported source today — no separate camera app, no upload step. More sources are planned.
  - icon: 🧠
    title: Bring your own LLM
    details: Use OpenAI, OpenRouter, MiniMax, Groq, Together, DeepInfra, native Anthropic or Gemini — or a fully local, $0 Ollama / LM Studio. You control cost and privacy.
  - icon: 🔒
    title: Private & self-hosted
    details: One Docker container on your hardware. Your diary is a SQLite file (or your Postgres). With a local model, nothing ever leaves your network.
  - icon: ✏️
    title: Wrong is fine, fixing is one tap
    details: Include or exclude a meal, edit it by hand, re-analyze the photo, or just chat — "it was a double portion, no rice." Corrections are the accuracy story.
  - icon: 💡
    title: Personal food memory
    details: Your corrected meals become priors, so your recurring dinners converge on your own numbers over time. No SaaS tracker does this per-user, locally.
  - icon: 📊
    title: A real diary
    details: A daily goal ring, macro bars, per-item breakdowns, an intake-vs-goal history chart, and a calendar to look back at any day.
---

## What is Oja?

**Oja** is a self-hosted **calorie diary** that turns the food photos you already
take into an accurate, private calorie + macro log — using **your own vision LLM**,
with **no subscription** and **no data leaving your network** (when you run a local model).

You point Oja at a **photo source** — a place where food photos land — and name an
**album** (for example, `Food`). You drop meal photos into that album from your
phone's auto-backup. Oja polls the album on an interval (plus a manual **Sync now**),
runs each new photo through a bring-your-own vision model, and logs an estimate:
dish name, per-item kcal + macros, a confidence level, and notes.

::: tip Your photo source
Oja is built around a **photo source** you already run. **[Immich](https://immich.app)
is the supported source today** — Oja is a natural companion to the Immich server many
self-hosters already use. The codebase keeps the source abstraction generic, and **more
sources are planned**. Throughout these docs you'll see generic "photo source" wording,
with concrete **Immich** instructions wherever they're needed.
:::

## Who it's for

- **The self-hosting / Immich crowd.** You already auto-backup your phone's photos and
  value owning your data. Oja plugs into infrastructure you already love.
- **Calorie trackers tired of SaaS.** No ads, no `$80/yr` paywall, no app that holds
  your diet history hostage. Oja is MIT-licensed and `$0`.
- **Privacy-sensitive people.** Your meal photos and health data stay on your hardware.
  With a local model, they never touch a third party at all.

## The whole pitch in one line

> *You already photograph your food and back it up. Oja just reads it.*

## Why Oja is different

| | Oja | Typical photo calorie app |
|---|---|---|
| **Capture** | Reads photos from a source you already use | Install *their* camera app, snap *inside* it |
| **Price** | Free, MIT-licensed, self-hosted | `$30`–`$100`/yr subscription |
| **Your data** | A SQLite file (or your Postgres) on your hardware | On someone else's servers |
| **The model** | Bring your own — cloud *or* fully local `$0` | Their model, their cost, their cloud |
| **Accuracy over time** | Personal food memory — your corrections become priors | A static one-shot guess |

## Where to next

<div class="vp-doc">

- **[Getting started →](/getting-started)** — up and running with Docker Compose and the
  first-run setup wizard.
- **[Installation →](/installation)** — image, volumes, ports, updating, SQLite vs Postgres.
- **[Configuration →](/configuration)** — every config variable, env-vs-UI precedence.
- **[Vision providers →](/vision-providers)** — pick a model: OpenAI, OpenRouter, local Ollama, and more.
- **[Daily usage →](/usage)** — the day-to-day workflow once it's set up.

</div>

::: warning Accuracy disclaimer
Calorie and macro numbers are **AI estimates from a photo**, not measurements. They can
be wrong — sometimes substantially. Treat Oja as a fast, low-friction *approximation* and
correct meals when you can. Do not rely on it for medical or clinical decisions. See the
[FAQ](/faq#how-accurate-is-it).
:::
