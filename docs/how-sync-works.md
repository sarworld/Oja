# How sync works

Sync is the heart of Oja: it turns new photos in your album into diary entries. This page
explains exactly what happens on each run — including the dedup, non-food, error, and
"removed photo" behaviours — so there are no surprises.

## When a sync runs

- **Automatically**, on the **`POLL_INTERVAL_MINUTES`** schedule (default **90 minutes**;
  set `0` to disable auto-poll).
- **Manually**, when you press **Sync now** on the Today tab.

Only **one sync runs at a time** — an in-memory lock guards it. If you trigger a sync while
one is already running, you'll get *"A sync is already running."* (the API returns `409`).

If the photo source / vision model aren't configured yet, a sync **no-ops** with a clear
message instead of erroring.

## What a sync does

For the configured album, Oja lists the assets and processes each one:

1. **Already logged?** If an entry already exists for that asset (matched by its **source
   asset ID**), it's **skipped**. → *sync is **add-only** and **deduped**.*
2. **Known non-food or repeatedly broken?** If Oja previously saw this asset and recorded
   it as non-food, or it has already failed the max number of times, it's **skipped** (so
   Oja doesn't keep re-paying to analyze the same photo).
3. **New photo?** Oja fetches the image and runs it through your
   [vision model](#the-vision-step), passing your recent meals as
   [food-memory priors](/usage#personal-food-memory).
   - If the model says **it isn't food**, Oja records that fact and **does not log a meal**
     (counted as **notfood**). → *non-food is remembered, not logged.*
   - If the model **succeeds**, Oja **inserts a meal** with the dish, per-item kcal/macros,
     totals, confidence, and notes — bucketed to the right **day** using the photo's
     capture time in your `TZ`.
   - If the analysis **throws** (network blip, bad response, etc.), Oja **parks** the asset
     with a retry counter and moves on (counted as **errors**). → *one bad photo never
     aborts the whole sync.*

At the end, Oja **reconciles** your diary against the album it just listed (see
[removing a photo](#removing-a-photo-doesn-t-delete-the-meal)).

The **Sync now** toast summarizes the run with counts of **added**, **skipped**,
**notfood**, and **errors**.

## Add-only & deduped by source asset ID

Every photo in your source has a stable **asset ID**, and Oja stores it with the meal under
a **unique** constraint. So:

- Re-running a sync never creates duplicates — already-logged photos are skipped.
- Syncs are **cheap to repeat** — only genuinely new photos cost an analysis.

## Non-food is remembered

Food albums collect non-meals — menus, receipts, the occasional sunset. When the model
flags a photo as **not food**, Oja records that asset as non-food and **skips it on future
syncs**, so you don't pay to re-analyze it and it never shows up as a phantom meal.

If something *was* misjudged, you can still act on the meals that **did** log — exclude or
delete them from the Today view. (A hard non-food gate plus easy exclude is what keeps a
sunset from ever counting as 600 kcal.)

## Transient errors are retried, then parked

If analyzing a photo fails (a timeout, a momentary provider error, a malformed response),
Oja doesn't give up immediately and doesn't crash the sync. It **counts the error**,
remembers the asset with an attempt counter, and **retries it on later syncs**. After a few
failed attempts the asset is **parked** (stopped being retried) so a permanently-bad photo
doesn't waste calls forever. The rest of the album processes normally either way.

## Removing a photo doesn't delete the meal

::: warning Your diary is the source of truth
**Removing a photo from the watched album does _not_ delete the logged meal.** Once Oja has
read a photo and logged the calories, that **diary entry is authoritative** — your record of
what you ate shouldn't vanish just because you tidied up your photo library.
:::

Here's the exact behaviour. At the end of every sync, Oja compares your logged meals against
the assets currently in the album:

- Entries whose photo **is still** in the album are normal.
- Entries whose photo **is no longer** in the album are **flagged** as *removed from
  source* (tracked on the entry as `source_missing`). The sync result reports how many were
  newly flagged (its **missing** count). The meal — and its calories — **stays in your
  diary**.
- If the photo later **reappears** in the album, the flag is **cleared** automatically on
  the next sync.

::: tip This is intentional, not a bug
The flag exists so you can tell which meals no longer have a backing photo, without ever
losing diet history. The thumbnail for a removed-source entry simply can't load (you'll see
a placeholder).
:::

### To actually remove a meal

Use **Delete meal** on the meal card in the Today view (it has a confirm step). That removes
the diary entry for good. Deleting in-app is the supported way to remove a meal — **not**
deleting the source photo.

## The vision step

When a new photo needs analyzing, Oja:

1. Builds a prompt asking the model to identify the **dish** and each **visible item** and
   estimate kcal + macros **for the portion shown**, returning a single JSON object.
2. Prepends up to **30 of your past meals** as
   [priors](/usage#personal-food-memory) (corrected ones first), so recurring meals
   converge on *your* numbers.
3. Sends the image to your provider via the selected
   [adapter](/vision-providers) (`openai` / `anthropic` / `gemini`).
4. **Parses defensively**: strips any `<think>…</think>` reasoning, extracts the first JSON
   object, and — if the model omits totals — **sums the per-item numbers** as a fallback.
   Confidence defaults sensibly if absent.

This resilience is why a slightly chatty or oddly-formatted model response still produces a
usable entry instead of failing the sync. The exact JSON contract is in
[Architecture → The vision contract](/architecture#the-vision-contract).

## Sync result fields

A sync returns these counts (shown in the **Sync now** toast and available via the API):

| Field | Meaning |
|---|---|
| `added` | New meals logged this run. |
| `skipped` | Assets skipped — already logged, known non-food, or parked after repeated failures. |
| `notfood` | Photos the model judged **not food** (recorded, not logged). |
| `errors` | Photos whose analysis failed this run (will be retried, then parked). |
| `missing` | Logged meals newly flagged because their photo is **no longer** in the album. |
| `dishes` | Names of the dishes added this run. |

See the full API in [Architecture](/architecture#rest-api).
