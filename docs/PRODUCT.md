# Oja — Product & Strategy Report (path to v1.0)

*Prepared June 2026. Grounded in the current SPEC.md and a scan of the 2026 calorie-tracker landscape.*

> **TL;DR for the maintainer.** The single thing Oja must nail for a public v1.0 is the loop nobody else has: **food photos already in your Immich album become an accurate, easily-correctable calorie diary — with no separate app, no upload step, no subscription, and your own LLM key.** Everything in the "Must" list below exists to make that loop trustworthy and shippable. Don't build a MyFitnessPal clone; build the Immich-native thing only you can build.

---

## 1. Positioning

**Positioning statement:**

> **Oja is a self-hosted calorie diary that turns the food photos already flowing into your Immich library into an accurate, private calorie + macro log — using your own vision LLM, with no subscription and no data leaving your network.**

**Who it's for (in priority order):**

1. **The Immich / self-hosting / r/selfhosted crowd.** They already run Immich, already auto-backup phone photos to it, already value owning their data. Oja is a companion app — it plugs into infrastructure they love. This is the beachhead.
2. **Calorie trackers burned by SaaS.** People tired of MyFitnessPal's ads + $80/yr paywall, Cal AI's dynamic pricing and billing drama, or any app that holds their diet history hostage. They want the photo-snap convenience of Cal AI without the rent-seeking.
3. **Privacy-sensitive / data-portability people.** Anyone who doesn't want their meal photos and health data on someone else's servers — a real and growing cohort.

**Why Oja wins (the wedge):**

- **Photo-native via Immich you already run.** Competitors make you install *their* camera app and snap *inside* it. Oja reads the album your phone already backs up to. The capture step is free.
- **No subscription, ever.** The whole category is a subscription tollbooth (see §2). Oja is MIT, self-hosted, $0.
- **You own your data.** It's a SQLite file (or your Postgres) on your hardware. Export anytime.
- **Bring-your-own-LLM.** OpenAI-compatible endpoint — use gpt-4o-mini for cents, OpenRouter, MiniMax, or a fully local llava/Ollama for zero cloud. You control cost *and* privacy.
- **Personal food memory.** Your corrected meals become priors, so *your* recurring dinner converges to *your* numbers. No SaaS does this per-user-locally.

---

## 2. Competitive landscape

### Commercial apps (the incumbents)

| App | Approach | Price (2026) | Does well | Gaps Oja exploits |
|---|---|---|---|---|
| **MyFitnessPal** | Manual log + huge DB + barcode; "Meal Scan" AI in Premium | Free (ad-supported, no barcode, 5%-granularity macros); **Premium $19.99/mo or $79.99/yr**; Premium+ $99.99/yr | 20M-food DB, 380+ restaurant chains, biggest community, integrations | Ads, paywalls core features, cloud-only, owns your data. **Acquired Cal AI in March 2026** |
| **Lose It!** | Manual log + "Snap It" photo AI | Freemium; Premium ~$39.99/yr | Friendly UX, established photo feature | Cloud SaaS, subscription, closed data |
| **Cal AI** | **Photo-first** + phone depth sensor for volume | Free download; **paywalled core, ~$9.99/mo or $29.99/yr** w/ dynamic pricing ($19.99–$49.99) | Cheapest photo-snap workflow; depth-based portioning | **Turbulent 2026:** pulled from App Store (April) over deceptive paywall, 3.2M-user breach, acquired by MFP. Dynamic pricing, 3-day trial traps, ~27% mean error on real meals. **This is Oja's narrative gift.** |
| **MacroFactor** | Adaptive macro coaching, no photo focus | Premium-only, no free tier; **$71.99/yr (~$5.99/mo)** | Best-in-class adaptive TDEE/macro algorithm, privacy-respecting (no ads), verified DB | No photo AI, premium-only, cloud |
| **Cronometer** | Lab-grade micronutrients (84 nutrients) | **Free Basic (full-featured)**; Gold ~$49.99/yr | Precision: USDA/NCCDB verified data, micronutrients | Manual entry, clinical not casual, cloud |
| **SnapCalorie** | Photo-first AI (founded by ex-Google nutrition-AI lead) | Freemium/subscription | Strong on photo accuracy claims, macro estimation | Cloud SaaS, subscription |

**Pattern:** the entire commercial category is a **subscription tollbooth**, and the photo-AI subset (Cal AI, SnapCalorie, Lose It! Snap It, MFP Meal Scan) is both **the hot growth area and the most contested on accuracy** (independent 2025 study: ~26.9% mean absolute % error across nutrients). Oja competes on **price (free), ownership, and privacy** — and matches them on the one feature users actually want (photo-snap) — while being honest about accuracy where they oversell it.

### Open-source / self-hosted trackers (the real competitive set)

| Project | What it is | Photo AI? | Immich-native? | Verdict vs Oja |
|---|---|---|---|---|
| **SparkyFitness** | Most complete self-hosted MFP alternative. Nutrition + exercise + water + sleep + body, multi-user/family, OIDC/TOTP/passkey/MFA, 6 food DBs, Apple Health/Garmin/Fitbit, **AI photo recognition + chat coach** | **Yes** (upload to *its* app) | **No** | The strongest competitor. But it's a broad MFP clone — you upload into *it*. Oja's wedge: **no upload, reads Immich**; narrower but sharper |
| **CalorieMate** | AI photo calorie tracker, self-hosted, Docker, CLIP embeddings | **Yes** (upload) | No | Closest in spirit. Author admits "rough approximations." Oja differentiates on **Immich ingestion + food memory + macro/correction depth** |
| **wger** | Mature FLOSS fitness+nutrition+weight, great Docker, REST API, mobile apps | No | No | Manual logging, no photo AI. Different lane |
| **NutriTrace** | New single-container PWA+Android, AGPL, zero telemetry, imports from MFP/LoseIt/Cronometer | No | No | Privacy-pure manual tracker. Good import story to learn from |
| **Cronometer-likes (Food Diary, PANTS, Calorific, OpenNutriTracker)** | Manual web/mobile trackers, varying maturity | No | No | All manual. None photo-first, none Immich-native |

**The competitive truth:** Nobody owns "**Immich-native photo calorie diary**." SparkyFitness owns "self-hosted MFP clone with AI." CalorieMate owns "self-hosted AI photo, rough." Oja's defensible position is the **intersection of Immich ingestion + correction-loop accuracy + personal food memory** — a position the SPEC already targets. Lean all the way into it.

---

## 3. Go-to features for v1.0 (MoSCoW)

Tied to the codebase: the repo is currently **scaffolding** (`server/src/config.ts`, `db/types.ts`; Vite/Tailwind config). SPEC.md describes the intended feature set. So "exists" below means **specified and on the critical path**; "missing" means **not in SPEC and needs a decision**. The build agents must deliver the SPEC; this section says **what's worth their time before tagging 1.0**.

### MUST — the headline answer. Nail these or don't release.

| Must-have | Status | Why it's a Must |
|---|---|---|
| **Album-driven photo ingestion (auto-poll + manual "Sync now")** | In SPEC (`POST /api/sync`, `POLL_INTERVAL_MINUTES`) | This *is* the product. The Immich loop must be rock-solid: no dupes (asset-id unique), resumable, never crashes on one bad photo |
| **Accurate-enough estimate + per-item breakdown** | In SPEC (vision contract, items JSON) | Table stakes. Must show dish + per-item kcal/macros + confidence so the user can sanity-check |
| **Effortless correction (edit / re-analyze / chat)** | In SPEC (`PATCH`, `/reanalyze`, `/chat`) | **Oja's accuracy story is correction, not first-shot perfection.** This is already a strength — make it fast and obvious. The whole pitch hinges on "wrong is fine, fixing is one tap" |
| **Personal food memory (corrected meals as priors)** | In SPEC (core differentiator) | The thing no competitor has. Must visibly work: recurring meals should converge. Surface a ✓ "matched a past meal" cue |
| **Include/exclude per photo** | In SPEC (`/toggle`) | Immich albums will catch menu photos, the cat near the plate, etc. Users must drop non-meals from the day in one tap |
| **Daily goal + macro progress + today view** | In SPEC (`/api/day`, settings) | Without "am I on track today?" it's a gallery, not a diary |
| **Non-food / bad-photo handling** | In SPEC (`is_food` flag, `notfood` count) | Albums *will* contain non-food. Misclassifying a sunset as 600 kcal destroys trust on day one. **Must be bulletproof** |
| **Single-password auth + Immich key never reaches browser** | In SPEC (session cookie, `/api/photo` proxy) | It's on the network with a powerful API key. Minimum viable security is non-negotiable |
| **One-command Docker + honest 5-min README** | In SPEC (single image, compose) | This audience self-hosts. If `docker compose up` + `.env` doesn't just work, they bounce |
| **Multi-arch image (amd64 + arm64)** | **Missing — add to release** | Half this audience runs a Pi/NAS. arm64 is not optional for the Immich crowd |
| **History (intake vs goal over time)** | In SPEC (`/api/history`, recharts) | Trend is why people stick with a tracker past week one |

### SHOULD — strongly improves v1.0, do if time allows

| Should-have | Status | Notes |
|---|---|---|
| **Manual food entry without a photo** | Missing | Coffee, a banana, a beer — no one photographs everything. A "+add" with a kcal/macro form (LLM can estimate from a text description, reuse the vision pipeline w/o image). Big completeness win |
| **Data export (CSV / JSON)** | Missing | "You own your data" is a core claim — back it with a real export button. Cheap to add, huge trust signal |
| **Units toggle (metric/imperial)** | Missing | International self-host audience. Macros are grams already; mainly affects weight logging + display |
| **PWA / installable + "Add to Home Screen"** | Partial (Vite app) | Make the web app installable so it feels like a phone app. Low cost, high perceived polish |
| **Demo / seed mode** | Missing | Critical for the *announcement* (see §6). Let people click a live demo with seeded meals & no Immich/LLM required |
| **EXIF capture-time → correct day/meal** | In SPEC (`taken_at`) | Make sure this is used for day bucketing (TZ-aware), not log time. The Immich unfair advantage (§4) |
| **Weight logging + simple trend** | Missing | Most-requested adjacent feature in every tracker. A single number/day + a line is enough for 1.0-adjacent |

### COULD — nice, post-1.0 candidates

- **Barcode / nutrition-label scan** (Open Food Facts lookup, or vision OCR of a label). Photo-native angle: snap the label, same pipeline. Strong fit but not the core loop.
- **Water logging.**
- **Weekly summary** (rollup + simple insights — your own LLM can write the prose).
- **Multi-user** (see §4 — Immich is multi-user; mapping Immich users → Oja accounts is a *differentiated* could).
- **Recipe / saved-meal templates** (reuse food memory infra).
- **Streaks / gentle gamification.**

### WON'T (yet) — explicitly out of scope for 1.0, say so to manage expectations

- Exercise / workout tracking (that's wger / SparkyFitness territory — don't sprawl).
- Apple Health / Garmin / Fitbit sync.
- Native mobile apps (PWA covers it; capture is via Immich's app anyway).
- Micronutrient (vitamin/mineral) tracking (that's Cronometer's moat; vision can't estimate it credibly).
- Social / community / meal sharing.
- Meal planning / grocery lists.

**Discipline note:** SparkyFitness already does "everything." Oja's win is *not* feature parity — it's being the **best, simplest, Immich-native photo diary**. The "Won't" list is a feature.

---

## 4. Immich-specific opportunities (the unfair advantage)

Building **on** Immich — not just supporting it — is the moat. No commercial app can copy this; no other OSS tracker has chosen this lane.

| Opportunity | Leverage | Status |
|---|---|---|
| **Zero-capture ingestion** | The user's phone *already* auto-backs-up photos to Immich. Drop them in the "Food" album (or share-to-album from the phone) and they appear in Oja. **The capture app is free — it's the camera + Immich the user already runs.** This is the headline unfair advantage | Core SPEC |
| **EXIF capture time = accurate day & meal** | Photos carry real `taken_at`. Bucket meals by the moment eaten, not logged. Enables breakfast/lunch/dinner inference for free | In SPEC — *make sure it's wired through TZ-correctly* |
| **Reuse existing backups** | The food history already lives in Immich. Oja can backfill: point at the album and analyze months of past food photos retroactively | Could — great onboarding "wow" |
| **Thumbnails / preview API** | Oja proxies Immich for images (`/api/photo`), so it never stores duplicates and inherits Immich's transcoding/thumbnails. Storage cost ≈ zero | In SPEC |
| **Immich multi-user mapping** | Immich is natively multi-user. Mapping Immich users/albums → Oja diaries is a *differentiated* multi-user story: each household member's "Food" album → their own diary. Post-1.0, but uniquely Oja's | Won't-yet → 1.x |
| **Share-to-album mobile flow** | On iOS/Android, "Share → Immich → Food album" is a 2-tap log from any photo, even screenshots of menus. Document this flow prominently | Docs win |

**The pitch in one line:** *"You already photograph your food and back it up to Immich. Oja just reads it."* That sentence is the whole marketing campaign.

**Practical note on ingestion:** Immich has **no native outbound webhook for new album assets** (confirmed via community discussions — it's a requested feature, not shipped). **Polling is correct and necessary** — don't wait for webhooks. Keep `POLL_INTERVAL_MINUTES` + manual Sync; that's the right call, not a limitation.

---

## 5. Differentiators to lean into (and how to message them)

1. **Personal food memory** — *"It learns your kitchen."* Your corrected meals become priors; your weeknight dal converges to your numbers. Frame it as the answer to "AI calorie counters are inaccurate" — Oja gets accurate *for you* over time. This beats Cal AI's static one-shot guess. **Make it visible** (show when a meal matched a prior).
2. **Fully local / private** — *"Your meals never leave your network"* (with a local LLM). Even with a cloud LLM, only the photo+prompt go out, your history stays home. Contrast with Cal AI's 3.2M-user breach.
3. **Bring-your-own model** — *"Pennies, not a subscription."* gpt-4o-mini analyses a meal for a fraction of a cent; the whole category charges $30–$100/yr. Or run llava/Ollama for $0 and zero cloud. **Put a real cost example in the README** ("~$0.001/photo with gpt-4o-mini").
4. **You own your data** — MIT license, SQLite file, CSV export. The anti-MyFitnessPal.

These four are the entire differentiation story. Repeat them on the README, the landing screenshot, and the announcement post.

---

## 6. Release-readiness checklist

| Item | Why | Priority |
|---|---|---|
| **Single-password auth working + Immich key proxied (never in browser)** | Security floor for a networked app holding a powerful key | **Must** |
| **Multi-arch Docker image (amd64 + arm64)** via buildx, pushed to GHCR/Docker Hub | Pi/NAS audience. Non-negotiable for this crowd | **Must** |
| **Versioned releases + CHANGELOG** (semver, GitHub Releases, tagged image: `:1.0.0` not just `:latest`) | Self-hosters pin versions; WUD/watchtower users expect semver | **Must** |
| **Honest 5-minute README** (`.env.example`, compose, the share-to-album flow, an LLM cost example) | First impression for the whole audience | **Must** |
| **Screenshots + a GIF/short video demo** of the loop: photo → estimate → quick correction → today's total | r/selfhosted scrolls on visuals. A GIF is worth 1000 words | **Must** |
| **Demo / seed mode** (no Immich/LLM needed — seeded meals) | Lets people *try before they self-host*; powers the announcement | **Should (high)** |
| **Robust non-food / bad-photo handling** (`is_food:false`, never logs a sunset as a meal) | Day-one trust killer if wrong | **Must** |
| **Graceful failure** (bad LLM JSON stripped/parsed, one bad photo doesn't halt a sync, clear errors in UI) | SPEC mentions `<think>` stripping + first-`{}` extraction — verify it's resilient | **Must** |
| **Accuracy disclaimer** (README + in-app): "estimates, not medical/precise; correct & let it learn" | Sets expectations; defuses the #1 review complaint across the category | **Must** |
| **Data export (CSV)** | Backs the "you own your data" claim | **Should** |
| **LICENSE (MIT), CONTRIBUTING, .env.example** | Already in SPEC's packaging scope — confirm present | **Must** |
| **Announcement plan** (below) | A great app no one sees ≠ a release | **Must** |

**Announcement plan (in order):**
1. **awesome.immich.app** PR (the community-projects list) — *the* highest-leverage placement. Oja is exactly what that list is for, and the Immich team explicitly punts integrations to community tools.
2. **r/selfhosted** + **r/immich** launch post with the GIF and the one-liner pitch.
3. **r/loseit / r/CICO / r/MacroFactor**-adjacent (privacy/anti-subscription angle) — secondary, careful not to spam.
4. **Hacker News** "Show HN" with the honest accuracy + privacy framing.
5. Submit to **awesome-selfhosted** and **awesome-docker-compose**.

---

## 7. Risks & mitigations

| Risk | Reality | Mitigation |
|---|---|---|
| **Estimate accuracy underwhelms** | Independent studies put photo-AI at ~27% mean error; users *will* compare to a food scale | Lead with the **correction loop + food memory** as the accuracy story, not first-shot. Disclaimer up front. "Gets accurate for *you*" is honest and true |
| **Vision API cost surprises users** | People fear "AI = expensive" | Default to **gpt-4o-mini** (cents), document a concrete cost/photo, and loudly support **local llava/Ollama** for $0. Bring-your-own-key means *they* control it |
| **Non-food false positives** | Albums contain non-meals; logging them as calories breaks trust instantly | Hard `is_food` gate + easy exclude. Test against junk photos before release. This is a **Must**, not an edge case |
| **Model output variance / bad JSON** | LLMs return malformed JSON, `<think>` blocks, prose | SPEC already strips think-blocks + extracts first `{}` — make it defensive, with a sane fallback entry the user can fix, never a crash |
| **Privacy messaging overpromise** | With a *cloud* LLM, photos *do* leave the network | Be precise: "fully local with a local model; with a cloud model only the photo+prompt leave, your history stays home." Don't claim more than is true — this audience checks |
| **Scope creep toward SparkyFitness parity** | Tempting to add exercise/water/sleep/integrations | Hold the "Won't-yet" line. Oja wins by being the *best narrow* tool, not a worse broad one |
| **Immich API changes / album rename breaks polling** | Immich moves fast | Accept album by **name OR id** (SPEC does), handle 404s gracefully, surface a clear "can't find album" status in Settings |

---

## 8. Prioritized roadmap

### Path to 1.0 (ship this, in order)

1. **Make the SPEC's core loop bulletproof** — ingestion (dedupe, resumable, one-bad-photo-safe), vision estimate + per-item breakdown, **non-food gate**, include/exclude. *This is 70% of the value.*
2. **Correction trifecta + food memory visibly working** — edit / re-analyze / chat, and prove recurring meals converge (surface the "matched a past meal ✓" cue). *This is the differentiation.*
3. **Today view + goals + history chart.** The diary feel.
4. **Auth + key-proxy + sane error handling.** Security floor.
5. **Packaging:** multi-arch Docker, compose, `.env.example`, semver release `:1.0.0` + CHANGELOG.
6. **Trust & polish:** non-food robustness pass, accuracy disclaimer, **demo/seed mode**, README with the share-to-album flow + LLM cost example, **screenshots + GIF**.
7. **CSV export** (cheap, backs the data-ownership claim — pull into 1.0 if time).
8. **Launch:** awesome-immich PR → r/selfhosted + r/immich → Show HN.

### 1.x wishlist (after 1.0 lands and gets feedback)

- **Manual / text food entry** (no photo) + **water logging** — completeness.
- **Weight logging + trend.**
- **Weekly/monthly summary** (LLM-written insights from your own model).
- **Units toggle (metric/imperial).**
- **Backfill mode** — retroactively analyze months of existing Immich food photos (great "wow", uniquely Immich).
- **Immich multi-user → per-member diaries** (the differentiated multi-user story).
- **Barcode / label scan** (Open Food Facts + vision OCR) — photo-native, on-brand.
- **Saved meals / recipe templates** (reuse food-memory infra).
- **PWA push / daily reminder.**

---

## Sources

- [Cal AI pricing & accuracy 2026 (NutriScan)](https://nutriscan.app/blog/posts/cal-ai-pricing-2026-monthly-yearly-premium-abc6e7b26f) · [Cal AI review/accuracy (NutriFy)](https://nutrifytracker.com/blog/is-cal-ai-worth-it) · [Cal AI](https://www.calai.app/)
- [MacroFactor vs MFP vs Cronometer pricing 2026 (NutriScan)](https://nutriscan.app/blog/posts/myfitnesspal-vs-macrofactor-2026-which-paid-tracker-b86a2f0b87) · [Cronometer pricing 2026](https://nutriscan.app/blog/posts/cronometer-pricing-2026-basic-vs-gold-vs-pro-b28e621201) · [MacroFactor cost 2026](https://nutriscan.app/blog/posts/macrofactor-cost-2026-free-version-29f5edc98b)
- [SparkyFitness (GitHub)](https://github.com/CodeWithCJ/SparkyFitness) · [SparkyFitness overview](https://www.xugj520.cn/en/archives/sparkyfitness-self-hosted-health-tracker.html)
- [CalorieMate (GitHub)](https://github.com/ignoxx/caloriemate) · [wger](https://github.com/wger-project/wger) · [NutriTrace](https://github.com/TraceApps/nutritrace) · [Food Diary](https://github.com/pkirilin/food-diary)
- [Awesome Immich](https://awesome.immich.app/) · [Awesome Immich (blog)](https://immich.app/blog/immich-awesome) · [Immich full-sync / webhook discussion](https://github.com/immich-app/immich/discussions/28322)
