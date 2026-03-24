# BerryCheck — Agent Notes

Read the memory files at `C:\Users\jacob\.claude\projects\C--Users-jacob\memory\` for full context on Jacob, the project philosophy, and business framing. Key files: `project_berrycheck.md`, `feedback_berrycheck_ux.md`, `user_jacob_profile.md`.

## Critical Rules
- **Never block the workflow.** All fields optional, all steps skippable. The line doesn't stop for the app.
- **Grading math must be correct.** Tolerances use `<=` (at-limit = pass) per MBG "shall not exceed" standard. `gradeSample(counts, tolerances)` accepts any tolerance table — default is MBG.
- **Offline-first.** No internet in the shed. Everything runs on local WiFi.
- **MBG standard is proprietary.** Butterfly Standard exists as an independent alternative for non-MBG sheds. The Butterfly philosophy is retail-first: strict on condition defects (soft, leaky, decay — what consumers reject), lenient on cosmetic permanent defects (stems, color, scars — what consumers tolerate).
- Read `src/constants.js` for the grading engine — it's the heart of the app. Both `MBG_TOLERANCES` and `BUTTERFLY_TOLERANCES` live there, referenced via `GRADING_STANDARDS`.

## Architecture
- React 19 + Vite frontend, Express/WebSocket relay server (`server.js`)
- Port 5175 (relay server serves built app + WebSocket). PrimusEngine is on 5173 — don't collide.
- All data in localStorage (no SQLite yet). Keys: `bc_history`, `bc_packlog`, `bc_receipts`, `bc_packplan`, `bc_prepack`, `bc_dc_results`, `bc_features`, `bc_packcodes_db`, `bc_packcodes_favorites`, `bc_zones`, `bc_accuracy`, `bc_training`, `bc_dc_strictness`, `bc_target_score`, `bc_dc_log`

## What Needs Organizing (Priority)
The app has grown fast over 2 days. The next session should focus on cleanup before adding more features:

1. **App.jsx is bloated** — 1000+ lines, 20+ state variables, 15+ overlays. Needs extraction:
   - QC view → own component
   - Ops view → own component
   - All the overlay state → context or reducer
   - The pack log inline input bar is still imported but may be redundant with PalletBuilder

2. **Header.jsx has too many buttons** — 12+ buttons across the top. Needs a menu/dropdown or grouping. The header is wider than most screens.

3. **Feature flags are defined but not fully wired** — many features have toggle keys in `featureFlags.js` but aren't actually gated in the components. The Header gates some buttons, the Ops tab gates some views, but QC-side features like `extraSamples`, `skipControls`, `lineStats` prompt, etc. aren't gated yet. The old `clamshellSample` flag name may be stale — sampling methods are now `fullcount`/`manual`/`600g`.

4. **Duplicate data patterns** — `averageCounts()` is defined in both App.jsx and LotSummary.jsx. Pack log loading happens in multiple components independently. Should centralize.

5. **Seed data** uses pack codes NF1295 and NF8889 — verify these match the actual codes used in the shed once season starts.

6. **The relay server stores daily summaries in-memory** (`const dailySummaries = new Map()`). If the server restarts, phone daily view loses all data. Needs file-based persistence or SQLite.

7. **Phone daily view (`?mode=daily`) is broken** — as of end of session 2026-03-23, the daily report on the phone isn't loading data even after re-seeding and restarting the relay server. The `pushDailySummary` in App.jsx POSTs to `/api/daily` and the seed data also pushes, but something in the chain isn't working. Debug this first — check: is the POST actually reaching the server? Is the date format matching between the POST and the GET? Is the phone hitting the right IP/port? The DailyView fetches from `/api/daily/${date}` using `new Date().toLocaleDateString()` as the date key — locale-dependent date formatting could be the issue if the POST and GET use different formats.

## Recent Features (Session 2026-03-23)

### Bug Fixes
- `getSavedZones()` was filtering out all defect zone keys — image auto-processing was broken
- Detailed-mode decay key collision (`decay` vs `decayRot`) — percentages were wrong
- `packCode` not flowing to PalletCloseOut (was passing stale `lastPackCode`)
- `handlePalletCloseOut` stale closure missing `palletLineStats`
- `skipLayer` writing old field names (`soft`/`major` → `permanent`/`condition`/`decay`)
- Threshold `<` changed to `<=` per MBG spec, GradingGuide updated to match

### New Analytics
- **Speed vs Quality** — line stats correlated with grades per pallet, per grower
- **Line Optimizer** — PUSH/HOLD/WATCH/SLOW DOWN recommendation using DC ceiling + trend + max safe speed
- **Grower Trends** — per-grower/variety quality aggregates with first-half vs second-half trend
- **Grower Filter** — shared filter bar on Ops tab, Daily View (phone), Packout Report

### New Workflow Tools
- **Pack Plan** — daily targets in boxes, auto-calc pallets, Balance line, CHEP/brown toggle
- **Pack code special instructions** — amber banner on QC side when code has special requirements
- **Favorite pack codes** — star toggle, favorites grouped at top of dropdown
- **Pallet type (CHEP/brown)** — on all pack codes with migration for existing data
- **Three sampling methods** — Full Count (camera counts total, QCer pulls defects only, includes pack weight for calibration), Manual Count (hand-count total, replaces old "Clamshell"), 600g Subsample (traditional MBG 30-berry weigh)
- **Pre-Pack Notes** — quick tags + free-text about raw fruit, inline banner on QC side

### New Reports
- **Packout Report** — per-receipt with grower filter, line stats alongside packout
- **Fruit Flow** — material balance (raw → blowoff → size div → expected → actual → gap with cup fill explanation)
- **DC Reconciliation** — enter DC results, compare to internal QC, alignment rate, tolerance signal
- **Line stats vs packout correlation** — does faster running actually cost packout?

### Infrastructure
- **Feature toggle system** — 31 features, 8 categories, 4 presets, toggle panel
- **Dev seed data** — realistic day simulation with pack plan, receipts, favorites
- **Daily summary push** — seed data pushes to relay server for phone daily view

## Recent Features (Session 2026-03-24)

### Grading Standards
- **Butterfly Standard** — independent grading system, retail-first philosophy. Tighter on condition (soft 1/2/3%, leaky 0/1/2%, decay 0/0.5/1%), lenient on cosmetic permanent (stems 5/7/10%, scars 5/7/10%). Toggled via QC Settings panel.
- **`gradeSample(counts, tolerances)`** — grading engine now parameterized. Any tolerance table can be passed. `GRADING_STANDARDS` maps keys to tables.

### Sampling Methods
- **Full Count** — camera counts total berries from photo, QCer only pulls and counts defects. Pack weight recorded for filler/scale calibration (metadata only, doesn't affect grading). Most accurate method.
- **Manual Count** — replaces "Clamshell". QCer hand-counts total berries then sorts defects. Same rigor as Full Count without camera.
- **600g Subsample** — traditional MBG method unchanged. 30-berry subsample weight estimates total.

### QC Settings UI
- **SOP-grade procedures** — each sampling method has numbered step-by-step instructions displayed on screen. Designed to pass compliance scrutiny.
- **Info panels** — every toggle (standard, method, defect entry) has a brief description always visible + expandable [?] with verbose explanation of when/why to use that setting.
- **Pack criteria specs** — Mighty Blue and Sweet Selections berry size requirements now shown inline at selector and in score display. `PACK_CRITERIA` includes `spec` string and `minBerryMM` field.

### Key Architecture Note
- `sampleMethod` state in App.jsx cycles: `'fullcount'` → `'600g'` → `'manual'` → `'fullcount'`
- `gradingStandard` state: `'mbg'` or `'butterfly'`
- CountEntry stores method metadata in counts: `_sampleMethod`, `_fullcountTotal`, `_packWeight`, `_manualTotal`, `_thirtyBerryWeight`
- Camera integration (phone snap → WebSocket → auto-count) already exists and is separate from the sampling method. The "Full Count" method's total berry input is designed to be auto-populated by the camera system.

## Business Context
BerryCheck is not just a QC tool. The real product is a DC tolerance model + line optimization engine. See `project_berrycheck.md` in memory for the full framing. The DC Reconciliation feature is the data input for the tolerance model — it needs real season data to validate.
