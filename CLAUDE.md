# BerryCheck — Agent Notes

**Before touching any code, run the Pre-Work Protocol in `PROTOCOL.md`.**

Read the memory files at `C:\Users\jacob\.claude\projects\C--Users-jacob\memory\` for full context on Jacob, the project philosophy, and business framing. Key files: `project_berrycheck.md`, `feedback_berrycheck_ux.md`, `user_jacob_profile.md`.

## Project Structure

```
BerryCheck/
├── app/                    ← QC + Ops software (Claude Code owns)
│   ├── src/                  React app
│   ├── camera_service.py     Python camera/HSV counting service
│   ├── electron/             Desktop wrapper (spawns relay + camera)
│   ├── server.js             WebSocket relay + API (runs inside Electron)
│   ├── release/              Built BerryCheck.exe
│   └── ...
├── machine/                ← Grader hardware (Desktop Claude owns)
│   ├── grader_service.py     THE GRADER BRAIN — mock or real mode
│   ├── grader_capture.py     Multi-camera capture script
│   ├── firmware/             ESP32 Arduino sketch
│   ├── scad/                 3D-printed parts (OpenSCAD)
│   ├── buffer/               Auto-created: buffered payloads on disconnect
│   └── docs/                 Hardware project docs (STALE — needs rewrite)
├── INTEGRATION_SPEC.md     ← Contract between machine and app (READ THIS)
├── PROTOCOL.md             ← Pre-work and debugging protocols (READ THIS TOO)
├── SCRATCH.md              ← Cross-instance notepad (Claude Code ↔ Desktop Claude)
├── PITCH.md                ← Business framing
├── CLAUDE.md               ← This file
└── ../berrygrader_machine/ ← Hardware designs (SCAD, specs, session logs — Desktop Claude)
```

## Three Guilds

### Machine Guild (Desktop Claude)
The physical grader — ESP32, roller tray, cameras, load cell, 3D-printed parts. Lives in `machine/`. Connects to the app via WebSocket as `role=grader` per the integration spec. The machine produces counts. It never grades.

### QC Guild (Claude Code)
The grading and sampling system. Camera feed + HSV counting, defect entry, grading engine (MBG/Butterfly tolerances), sample logging. Lives in `app/`. The QC side is the sellable product — works standalone at a farm or shed, with or without the physical grader.

### Ops Guild (Claude Code)
Operations intelligence layer. Pack plans, line stats, blowoff rates, speed vs quality, grower trends, DC reconciliation, packout reports. Lives in `app/` alongside QC (same React app, different tab). This is the consulting upsell — requires QC data to be useful.

**Cross-guild communication:** `INTEGRATION_SPEC.md` defines the machine↔app contract. `SCRATCH.md` is the notepad between Claude instances.

## Critical Rules
- **Never block the workflow.** All fields optional, all steps skippable. The line doesn't stop for the app. At peak pace, pallets come every 4 minutes — the system must accommodate skipping samples.
- **Grading math must be correct.** Tolerances use `<=` (at-limit = pass) per MBG "shall not exceed" standard. `gradeSample(counts, tolerances)` accepts any tolerance table — default is MBG.
- **Offline-first.** No internet in the shed. Everything runs on local WiFi.
- **Never lose sacred data.** Archives, pallet records, history, calibration logs = never lost. Buffer, persist, retry. A single sample in front of the QCer can be re-scanned — that's replaceable.
- **MBG standard is proprietary.** Butterfly Standard exists as an independent alternative for non-MBG sheds. Retail-first: strict on condition defects (soft, leaky, decay), lenient on cosmetic permanent defects (stems, color, scars).
- Read `app/src/constants.js` for the grading engine — both `MBG_TOLERANCES` and `BUTTERFLY_TOLERANCES` live there, referenced via `GRADING_STANDARDS`.

## App Architecture
- React 19 + Vite frontend, Express/WebSocket relay server (`app/server.js`)
- Electron desktop app (`app/electron/main.js`) — spawns relay server + camera service, serves built app on port 5175
- Python camera service (`app/camera_service.py`) — OpenCV HSV detection, WebSocket streaming, fruit profiles (blueberry, red grape), stabilized counting
- Port 5175 (relay + app). PrimusEngine is on 5173 — don't collide.
- All data in localStorage. Keys: `bc_history`, `bc_packlog`, `bc_receipts`, `bc_packplan`, `bc_prepack`, `bc_dc_results`, `bc_features`, `bc_packcodes_db`, `bc_packcodes_favorites`, `bc_zones`, `bc_accuracy`, `bc_training`, `bc_dc_strictness`, `bc_target_score`, `bc_dc_log`
- Future: needs a path to server hosting for other sheds to adopt mid-season. Don't hardcode localhost assumptions.

## QC Features
- **Three sampling methods:** Full Count (camera total + manual defects), Manual Count (hand-count total), 600g Subsample (traditional MBG 30-berry weigh)
- **Two weighing sources:** Clamshell scale (standalone 1kg USB serial) or tray load cells (4x 5kg on grader). See INTEGRATION_SPEC.md "Sampling Workflows".
- **Two grading standards:** MBG (industry), Butterfly (retail-first, independent)
- **Camera integration:** Python camera_service.py → WebSocket → live feed in QC view with HSV tuner, USE COUNT button auto-populates Full Count total
- **Fruit profiles:** Blueberry, Red Grape presets for HSV detection
- **QC Settings:** Simple/full view toggle, SOP procedures, defect entry modes (quick 3-pile vs detailed per-type)
- **Grader control panel:** Connection status, SCAN, TARE, CALIBRATE, UNLOAD, DUMP buttons. Status/progress bar. Only visible when grader connected. See INTEGRATION_SPEC.md for full command set.

## Grader Integration (Progressive Automation)

The grader integration follows a trust-building progression:

**Phase 1 — Camera counts, human grades:**
- Grader sends total berry count (position-based occupancy detection)
- QCer enters defect counts manually in BerryCheck
- Every sample = labeled training data (images + human defect classification)
- Photo record of every sample for audit trail

**Phase 2 — ML suggests, human confirms:**
- System starts suggesting defect counts based on accumulated training data
- QCer confirms or corrects
- Corrections feed back into model improvement

**Phase 3 — Auto grade, human spot-checks:**
- System handles full grading autonomously
- QCer reviews borderline or flagged samples

Trust is earned sample by sample. No hard cutover.

## MBG Calibration

Before production use, BerryCheck must be validated against the MBG portal QC tool:
- **Calibration log** in the app: date, samples compared, results, sign-off
- **Questions for MBG QC** accessible from the app (for when inspectors visit)
- Decay semantics (subset of condition or separate?) TBD pending MBG confirmation

See INTEGRATION_SPEC.md "MBG Standards Calibration" section for details.

## Ops Features
- Pack Plan, Pack Log, Pallet Builder, Pallet Close Out
- Receipts, Pack Codes (favorites, special instructions)
- Speed vs Quality, Grower Trends, Line Optimizer
- Packout Report, Fruit Flow, DC Reconciliation
- Feature toggle system (31 features, 8 categories, 4 presets)

## Known Issues
- **App.jsx is bloated** — 1000+ lines, needs extraction into QC and Ops view components
- **Phone daily view broken** — date format mismatch between POST and GET
- **In-memory daily summaries** — lost on server restart, needs persistence
- **Feature flags not fully wired** — some QC-side features not gated
- **machine/docs/BLUEBERRY_GRADER_PROJECT.md is stale** — describes old mechanical design (TT motors, rubber band drive, V-groove brackets). The actual build uses 2020 aluminum, polybelt drive, dual sub-frame rollers. Needs rewrite.

## Session 2026-03-29 (Claude Code)
- Integrated HSV camera tuner from berrygrader into BerryCheck as `camera_service.py`
- Built CameraTuner React component — inline on QC page with live feed, HSV sliders, TUNE/MASK/FILTERED views
- USE COUNT button sends camera count → auto-populates Full Count total in CountEntry
- Added fruit profiles (blueberry, red grape) switchable from UI
- Stabilized berry count (rolling mode over 15 frames)
- Added morphological close/open to mask cleanup
- Wrapped app in Electron — BerryCheck.exe launches relay + camera + UI
- RETRY CAMERA button for when camera service fails to start
- Moved grade display to top of QC page as header
- Collapsed pallet/pack management into expandable section
- Added QC Settings simple/full view toggle
- Added Sample History table to QC page
- Restructured project: `app/` (software) + `machine/` (hardware) + root docs

## Business Context
BerryCheck is not just a QC tool. The sellable product is the grading machine + QC system. The Ops layer is the consulting upsell. The DC tolerance model + line optimization engine is the long-term value play. See `PITCH.md` and `project_berrycheck.md` in memory for full framing.
