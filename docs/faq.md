# FAQ

## What is Oja, in one sentence?

A self-hosted, MIT-licensed **calorie diary** that reads food photos from your **photo
source** and logs calories + macros using a **vision LLM you bring** — with a dashboard,
corrections, and a personal food memory.

## How accurate is it?

Calorie and macro numbers are **AI estimates from a single photo**, not measurements. They
can be wrong — sometimes substantially — because portion size, hidden ingredients, oil, and
cooking method are genuinely hard to judge from an image. Independent studies of photo-based
calorie AI report mean errors in the ~25–30% range.

Oja's accuracy story isn't first-shot perfection — it's the **correction loop**:

- It's **one tap to fix** a meal — [edit, re-analyze, or chat](/usage#meal-cards).
- Your corrections feed **[personal food memory](/usage#personal-food-memory)**, so your
  **recurring meals converge on your own numbers** over time.

Treat Oja as a fast, low-friction approximation that *gets better for you* — not a food
scale.

::: warning Not medical advice
Oja is for casual tracking. **Do not** rely on it for medical, clinical, or other decisions
that require precise nutrition data.
:::

## What does it cost?

Oja itself is **free** — MIT-licensed, self-hosted, **no subscription**. Your only cost is
whatever your chosen LLM charges:

- **Cloud model** — you pay your provider directly. Cheap vision models (e.g.
  `gpt-4o-mini`) cost roughly a fraction of a cent per photo.
- **Local model** — **`$0`** in API fees with [Ollama or LM Studio](/vision-providers); you
  just use your own hardware.

Because you bring your own key, **you** control the spend. See
[Vision providers](/vision-providers#cost-privacy-notes).

## Is it private? What leaves my network?

You self-host everything, and your **diary, history, and goals always stay in your own
database**. What goes out depends on your model:

- **Local model (Ollama / LM Studio):** **nothing** leaves your network.
- **Cloud model:** only the **photo + prompt** are sent to your provider for each analysis.
  Your history and diet records are never uploaded anywhere.

Your photo-source API key is used **server-side only** to fetch images — it's **never
exposed to your browser**. Pick a local model if you want zero third-party exposure.

## What if I remove a photo from the album?

**Nothing is lost.** Removing a photo from the watched album **does not delete the logged
meal** — your diary is the source of truth. Entries whose photo no longer exists at the
source are **flagged** ("removed from source"); the calories stay. If the photo reappears,
the flag clears on the next sync.

To actually remove a meal, **Delete** it from the meal card in the Today view. Full details:
[How sync works → Removing a photo](/how-sync-works#removing-a-photo-doesn-t-delete-the-meal).

## What photo sources are supported?

**[Immich](https://immich.app) is the supported source today.** Oja watches an album in
your Immich server and reads new photos from it. The codebase keeps the source abstraction
generic and **more sources are planned**, but right now Immich is the one to use. See
[Getting started](/getting-started) for setup.

## Does it support multiple users?

Oja uses a **single shared login password** (`APP_PASSWORD`) — there are **no per-user
accounts** today. Everyone who logs in shares one diary and one watched album. If you want
separate diaries for separate people, run separate Oja instances (each pointed at its own
album, with its own `./data`). Per-member diaries mapped from your source's users are a
possible future direction, not a current feature.

## Do I need an `.env` file?

No. You only need to set a **login password** and **session secret** to start; the photo
source and vision model can be entered entirely in the browser via the
[setup wizard](/getting-started#_4-finish-the-setup-wizard). Setting a value in `.env`
**locks** that field in the UI — handy for headless deploys. See
[Configuration](/configuration#env-vs-ui-precedence).

## Can I use a local, free model?

Yes — run **Ollama** or **LM Studio** on your machine and point Oja at it. It's `$0` and
fully private. From inside Docker, use `host.docker.internal` in the base URL. See
[Vision providers → Ollama](/vision-providers#ollama-local-0-private).

## SQLite or Postgres?

**SQLite by default** — a single file in `./data`, zero setup, easy to back up. Switch to
**Postgres** only if you want it, by setting `DATABASE_URL` to a `postgres://…` URL. See
[Installation → SQLite vs Postgres](/installation#sqlite-default-vs-postgres).

## How do I add calories for something I didn't photograph?

Oja's input is **photos** from your album — its core loop is photo-driven. The simplest way
to capture something is to **photograph it** (or share an existing image into the album). Use
the per-meal [edit / chat](/usage#meal-cards) tools to fine-tune what gets logged.

## How often does it check for new photos?

Every **`POLL_INTERVAL_MINUTES`** (default **90 minutes**), plus whenever you press **Sync
now**. Set `POLL_INTERVAL_MINUTES=0` to disable automatic polling and sync only on demand.

## My estimate looks wrong — what should I do?

[Re-analyze](/usage#re-analyze-the-photo) with a short correction (e.g. "double portion, no
rice"), [edit](/usage#edit-a-meal-by-hand) the numbers directly, or
[chat](/usage#talk-it-through-chat) it. Every correction also improves future estimates for
similar meals via [food memory](/usage#personal-food-memory).

## Still stuck?

See [Troubleshooting](/troubleshooting) for connection, vision-test, and sync issues.
