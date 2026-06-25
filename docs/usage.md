# Daily usage

Once Oja is set up, your day-to-day loop is simple: **photograph your food → it lands in
your album → Oja logs it.** This page covers everything you can do from the UI.

## The daily loop

1. **Photograph a meal** with your phone as usual.
2. **Get it into your watched album.** Two easy paths:
   - Your phone's **auto-backup** carries it into your photo source, and you move/add it to
     the food album; or
   - **Share → Immich → your Food album** straight from the photo — a two-tap log that
     works even for a screenshot of a menu.
3. **Oja picks it up** — automatically on the next poll, or instantly when you press
   **Sync now**.
4. **Review and correct** if needed. Your goal ring and macros update.

## Syncing: automatic + manual

- **Automatic.** Oja polls your album on the **`POLL_INTERVAL_MINUTES`** schedule (default
  **90 minutes**; `0` disables it). New photos appear on their own.
- **Manual — Sync now.** On the **Today** tab, press **Sync now** when you're impatient.
  The button shows **Syncing…** while it runs, then a toast summarizes the result, e.g.
  *"Synced — 3 added, 2 skipped, 1 error"*, or *"Up to date"* if there was nothing new.

Details of what sync does (dedup, non-food, retries): [How sync works](/how-sync-works).

## The Today view

The **Today** tab is your dashboard for a single day.

### Goal ring & macros

- A **calorie ring** shows `today's kcal / goal kcal` with how much you have **left** (or
  how far **over**). The ring shifts colour as you approach and pass your goal.
- Three **macro bars** — **Protein**, **Carbs**, **Fat** — show `value / goal g` and turn
  orange when you exceed a target.
- A meal count (e.g. *"3 meals"*) and the **Sync now** button sit at the bottom of the
  summary card.

Totals reflect only the meals **counted** for the day (see
[include/exclude](#include-exclude-a-meal)).

### The calendar date picker

You're not limited to today:

- Use the **‹** and **›** arrows to step to the previous / next day (you can't go past
  today).
- **Tap the date** to open a **calendar picker** and jump to any past day.
- A **Jump to today** shortcut appears whenever you're viewing a past day.

Day bucketing uses each photo's **capture time** (from its metadata) in your configured
`TZ` — so a late-night snack lands on the right day, not whenever the sync happened to run.

## Meal cards

Each logged meal is a card showing its **photo thumbnail**, the **dish name**, a
**confidence** badge (`low` / `medium` / `high`), the total **kcal**, a **P / C / F** macro
line, and a **per-item breakdown** (each item with its own kcal). Cards may also carry small
badges like **edited**, or a source tag (**manual**, **reanalyzed**, **chat**) when a meal
wasn't logged automatically.

Tap **Edit** on a card to expand its actions.

### Include / exclude a meal

Every card has a **Counted / Excluded** toggle. Your album will inevitably catch a menu
photo, a coffee you didn't mean to log, or the cat near the plate — flip a meal to
**Excluded** to drop it from the day's totals in one tap (the card dims). Toggle it back to
**Counted** any time. Excluding does **not** delete the meal.

### Edit a meal by hand

Under **Manual edit**, fix the **dish name**, **kcal**, and **protein / carbs / fat**
directly, then **Save changes**. Hand-edited meals are marked **edited** and feed
[food memory](#personal-food-memory) as trusted numbers.

### Re-analyze the photo

Not happy with the estimate? Under **Description (for re-analysis)**, optionally type a
correction — e.g. *"double portion, no rice, whole milk latte"* — and click **Re-analyze
photo**. Oja runs the vision model again **with your hint**, and replaces the estimate. A
toast confirms the new dish.

### Talk it through (chat)

Under **Talk it through**, just describe the fix in plain language — *"it was a double
portion, no rice"* — and **Send**. Oja adjusts the meal and replies. The conversation is
kept on the card so you can see the back-and-forth. This is the fastest way to nudge an
estimate without filling in fields.

### Delete a meal

**Delete meal** (with a confirm step) removes the entry entirely. Use this — not removing
the source photo — when you want a meal gone from your diary. See
[How sync works](/how-sync-works#removing-a-photo-doesn-t-delete-the-meal) for why.

## Personal food memory

This is Oja's signature feature. Before each new estimate, Oja feeds the model up to **30**
of your **past meals as priors** — your **corrected ones first** (hand-edited, re-analyzed,
or adjusted via chat), de-duplicated by dish. The prompt tells the model: *if this photo
resembles one of these, prefer those numbers* (a `✓` marks your trusted, corrected entries).

The practical effect: **your recurring meals converge on your own numbers over time.** Once
you've corrected your usual weeknight dinner a couple of times, future photos of it line up
with what you told Oja — without you touching them. The more you correct, the more *your*
diary reflects *your* kitchen.

::: tip Corrections are an investment
Every edit, re-analysis, or chat fix isn't just for that meal — it teaches Oja your numbers
for next time. A few corrections early pay off for weeks.
:::

## History

The **History** tab plots your **intake vs goal over time** (last 30 days by default):

- A **bar per day** of total kcal, coloured **green** when at/under goal and **red** when
  over (days with no logged meals show muted).
- A **dashed goal line** across the chart.
- Quick stats: your **average per day** and your **daily goal**.

It's the "am I trending the right way?" view — the reason a tracker sticks past week one.

## Settings

Open **Settings** to:

- **Daily goals** — set your target **Calories**, **Protein**, **Carbs**, and **Fat**, then
  **Save goals**. These drive the ring, macro bars, and history goal line.
- **Connection** — see whether the **server** is online and whether your **photo source +
  vision** are **configured**, review your current fields (secrets show as `•••• set`), and
  click **Edit** to reopen the [setup wizard](/getting-started#_4-finish-the-setup-wizard).
  Fields set via environment variables appear locked with a **🔒 env** marker.
- **Log out** of the UI.
