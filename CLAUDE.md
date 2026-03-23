# BerryCheck — Agent Notes

Read the memory files at `C:\Users\jacob\.claude\projects\C--Users-jacob\memory\` for full context on Jacob, the project philosophy, and business framing. Key files: `project_berrycheck.md`, `feedback_berrycheck_ux.md`, `user_jacob_profile.md`.

## Critical Rules
- **Never block the workflow.** All fields optional, all steps skippable. The line doesn't stop for the app.
- **Grading math must be correct.** Tolerances use `<=` (at-limit = pass) per MBG "shall not exceed" standard.
- **Offline-first.** No internet in the shed. Everything runs on local WiFi.
- Read `src/constants.js` for the grading engine — it's the heart of the app.

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

3. **Feature flags are defined but not fully wired** — many features have toggle keys in `featureFlags.js` but aren't actually gated in the components. The Header gates some buttons, the Ops tab gates some views, but QC-side features like `clamshellSample`, `extraSamples`, `skipControls`, `lineStats` prompt, etc. aren't gated yet.

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
- **Clamshell sampling** — toggle to sample a cup off the line instead of 600g weigh-out
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

## Business Context
BerryCheck is not just a QC tool. The real product is a DC tolerance model + line optimization engine. See `project_berrycheck.md` in memory for the full framing. The DC Reconciliation feature is the data input for the tolerance model — it needs real season data to validate.
