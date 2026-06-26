# 🍲 Oja

Your calorie diary, from your photos. Drop a food pic into an Immich album and
Oja logs the meal — calories and macros — using a vision model you choose
(local or hosted).

> **Built with heavy AI assistance**, reviewed and maintained by the author.
> Early and experimental — calorie numbers are AI estimates, not nutrition or
> medical advice.

![Oja](docs/public/screenshots/today.jpeg)

## What it does

- Watches an Immich album; new food photos get logged automatically (read-only)
- Estimates calories + protein / carbs / fat per meal
- Fix it in plain English — *"I only had half"* — and it re-estimates
- Daily totals, macro bars, and a history chart vs your goal

## Run it

```bash
git clone https://github.com/sarworld/Oja && cd Oja
cp .env.example .env        # set APP_PASSWORD and SESSION_SECRET
docker compose up -d
```

Open `http://localhost:8462` and finish setup in the browser — your Immich URL +
API key, and the vision model you want (Ollama / LM Studio locally, or any
OpenAI-compatible / Anthropic / Gemini endpoint).

SQLite by default, non-root container, no telemetry. MIT.

**Full docs → [docs.ojatracker.com](https://docs.ojatracker.com)**
