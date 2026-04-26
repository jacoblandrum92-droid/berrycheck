# BerryCheck — Vision Spec

*Source of truth for what this product is, who it serves, and what "done" looks like.*
*Last updated: April 5, 2026*

---

## What This Is

BerryCheck is a packing shed QC and operations platform that turns every pallet
sample into a timestamped, graded, photographed record — the receipt that proves
what left your dock.

The physical berry grader machine is an enhancement that automates counting and
eventually defect detection. It's the "can we do better?" question, not the
"can we do this at all?" question. BerryCheck works without it.

**One-liner:** "We keep the receipt so you don't eat the rejection."

---

## Who Uses It

### Day 1 User: Jacob (owner-operator)
- Runs QC himself while managing packing operations
- Building and using the product simultaneously — dev mode
- 10 days from first fruit (mid-April 2026)
- 1 shed, 1-2 lines, blueberries

### Week 2+ User: QC Person (hired hand)
- Non-technical. Follows a process. Needs it to be obvious.
- Will abandon the app instantly if it crashes, freezes, or adds time.
- The clipboard is their fallback — the app must be faster or equal, never slower.
- Trust is fragile. One crash = "I'll just use the clipboard."

### Future Users: Other shed operators
- Adopt mid-season via server-hosted deployment
- Need the same rock-solid reliability, different pack codes and receipt setup

---

## The Problem

DC rejects a load. Operator knows the fruit was good when it shipped. No proof.
Eats the cost. Happens multiple times per season. One main DC is the target.

The existing QC process is: pull clamshells, eyeball the fruit, clipboard notes
if anything. No timestamps, no photos, no grades, no trail. When the call comes
from the DC, there's nothing to show.

---

## What "Done" Looks Like

### Season Start (Day 1 — mid-April 2026)

**Must work:**
- Pull clamshell from pallet → weigh on scale → dump onto tray
- Count berries (camera or manual) → enter defects (quick 3-pile sort)
- Grade against MBG tolerances → display grade + score
- Log line speed and blowoff rate per pallet
- Snap a photo of each sample → timestamped record
- 3 samples per pallet, logged with pallet tag, receipt, timestamp
- Pack plan, pack log, basic ops metrics visible
- Runs on laptop, offline, zero internet dependency
- Never crashes. Never freezes. Never loses data.

**Can wait:**
- Detailed per-defect-type breakdown (quick mode is fine)
- Grader machine integration (hardware arrives week 2-3)
- ML defect detection (Phase 2+)
- Multi-shed deployment
- Grower trend reports (need a few weeks of data first)

### Week 2-3 (grader machine online)

**Validates:**
- Does the machine count berries faster/more accurately than the phone camera?
- Does it improve the QCer's workflow or just add handling steps?
- Is the roller tray practical for QCer inspection, or does a simpler dimple tray
  work better for holding berries in a countable grid?
- Does the clamshell scale integration save time vs a kitchen scale?

**Key question:** The machine's value might be DATA (camera-counted records with
defect pile documentation) more than SPEED. Even if the QC process takes the same
time, having structured image data per sample is vastly more than a clipboard.

### Mid-Season (steady state)

- QC person running it independently, Jacob supervising
- Grower trend data accumulating (quality by variety, block, pick crew)
- DC dispute defense tested in real rejection scenario
- Ops metrics driving line speed and scheduling decisions
- Enough labeled training data to start ML defect suggestion experiments

### End of Season (retrospective)

- Season-long QC data exportable for grower reports
- Clear answer on grader machine value proposition
- Product stable enough to pitch to second shed for next season
- Ops layer validated as consulting upsell or killed

---

## Core Workflows

### 1. QC Sample (the money workflow)

```
Pull clamshell → weigh → dump onto tray → count berries →
enter defects → grade → photo → log → next sample
```

- 3 samples per pallet (bottom, middle, top layer)
- Target: under 4 minutes per pallet with good fruit
- Must accommodate skipping samples — never slow the line
- Every field is optional. Partial data beats no data.

**Three counting methods (user picks per sample):**
- Full Count: camera counts total, QCer sorts defects (primary method)
- Manual Count: hand-count total, enter defects (fallback)
- 600g Subsample: weigh 600g, weigh 30-berry subsample, estimate total (MBG traditional)

**Grading:**
- MBG tolerances (industry standard) or Butterfly tolerances (retail-first alternative)
- Grade = worst of: permanent %, condition %, combined %, decay %
- White mold = instant Poor. Decay present = Excellent blocked.
- At-limit passes (`<=` not `<`). "Shall not exceed" means at-the-number is OK.
- Score (0-100) = headroom within current grade. Bottleneck = tightest category.

### 2. Ops Logging (the context layer)

```
Per pallet: line speed (lbs/hr) + blowoff rate + size sort breakdown
Per receipt: grower, variety, block, pack codes
Per day: total pallets, receipts processed, daily summary
```

- Line stats prompt is persistent but never blocking — skip if busy
- Pack plan drives expected production; actual vs plan is the dashboard
- DC reconciliation: compare shipped grades vs DC feedback

### 3. DC Dispute Defense (the sell)

```
DC calls about pallet #1234 →
Pull up timestamped QC record →
Show grade, defect counts, photo, line conditions →
"Here's what it looked like when it left our dock"
```

- Every pallet has a searchable QC trail
- Photo documentation is the killer feature for disputes
- Timestamped = can't be fabricated after the fact

### 4. Grower Feedback (the upsell)

```
After 3+ weeks of data →
Weekly trend by grower, variety, block, pick crew →
Show grower exactly how their fruit grades →
"Your Star variety has been trending soft for 3 weeks"
```

- Requires enough data to show trends (not Day 1)
- Transparency play: share ops data (line speed, blowoff) with growers who want it
- This is how you keep your best growers

---

## Hardware Integration (enhancement, not dependency)

### Clamshell Scale
- Standalone USB scale, 1kg load cell, Arduino Nano
- Weighs pint clamshells (~310g) and 18oz bricks (~510g)
- Replaces kitchen scale — faster tare, live display in app, auto-logs weight
- Serial protocol: `W:xxx.x` readings, `TARE`, `CALWEIGHT` commands
- **Day 1 candidate** — simple, no moving parts, high value

### Berry Grader Machine
- 12 diabolo-profiled rollers, 18×11 = 198 position grid
- Cameras count berries via position-based occupancy detection
- 4×5kg load cells for tray weighing
- Pivot dump unload (manual tilt for prototype)
- **Week 2-3 introduction** — validate counting accuracy and workflow fit

### The Fundamental Question

The grader's value proposition is under active investigation:

1. **Roller tray for QC inspection?** Berries in saddles may be hard to inspect.
   QCer needs to see and touch berries, not just photograph them.

2. **Dimple tray alternative?** A passive tray with dimples holding berries in a
   grid (no motors, no rollers) might be better for counting + sorting. Add a
   defect pile section where QCer places bad berries for camera counting.

3. **Data over speed?** Even if the machine doesn't save time, camera-counted
   records with defect pile photos is enormously more data than clipboard QC.
   The value might be documentation density, not throughput.

4. **Progressive validation:** Start with BerryCheck app (proven workflow) →
   add clamshell scale → add counting tray (passive or active) → add ML.
   Each step must independently justify its existence.

---

## UX Principles

1. **Never block the workflow.** All fields optional, all steps skippable. Better
   to have imperfect data than no data because the app had an opinion.

2. **The line doesn't stop.** At peak pace, pallets come every 4 minutes. The
   system must accommodate skipping, partial data, out-of-order entry.

3. **One crash kills trust.** The QC person will go back to the clipboard if the
   app freezes once. Stability is feature #1.

4. **Fewer taps than the clipboard.** If the app takes more steps than writing
   on paper, it will be abandoned. Every tap must earn its place.

5. **Offline is the default.** No internet in the shed. Everything local.
   AI features degrade gracefully — never break the UI.

6. **Show the grade immediately.** The QCer needs instant feedback after entering
   defects. Grade + score + headroom displayed as soon as data changes.

7. **Photos are proof.** Timestamps + photos = evidence. This is the product's
   core differentiator over a clipboard.

8. **QC-first.** BerryCheck is a QC sampling and archiving system before anything
   else. Ops, Pack Plans, Compliance Logs, and other tabs are secondary and have
   not earned their place. Don't bloat the QC flow to support unused features.
   See `project_berrycheck_qc_first.md` in Claude memory for the vision shift
   recorded on 2026-04-25.

9. **Discoverable, not disclosed.** A non-technical QCer should see only the
   controls relevant to the task they're doing. The dashboard should be a
   *guided flow* — pallet setup → layer pick → sample type pick → sample-specific
   UI — not a kitchen-sink of every feature at once. See "QCer Mode" below.

---

## QCer Mode (Guided Workflow) — Phase 6 (planned, not built)

The current dashboard is "kitchen-sink" — all controls visible at once. That works
for Jacob (owner-operator who knows every feature) but fails the non-technical
QCer who needs to be told what to do next.

QCer Mode is a guided wizard layered over the existing data model:

```
Step 1 — Pallet Setup
  Daily Pallet # · Pallet Tag · Pack Code   (line slot context preserved)
  [ Continue → ]

Step 2 — Pick Layer
  ◯ #1 BOTTOM   ◯ #2 MIDDLE   ◯ #3 TOP   (skipped layers shown as such)
  [ Continue → ]

Step 3 — Pick Sample Type
  [ QUALITY SAMPLE ]   [ BOX WEIGHT ]
  (only the chosen flow's UI shows next)

Step 4a — Quality Sample
  Camera or 30-berry input · Defect entry · Grade · Save

Step 4b — Box Weight
  Clamshell weights · Tolerance · Save

After save → Step 2 (next layer on this pallet) or Step 1 (new pallet).
```

**Design rules for Phase 6:**
- Implement as a `qcerMode` boolean toggle (persisted). When OFF, current
  full dashboard shows (Jacob's daily driver). When ON, render the wizard.
- Wizard reuses existing components (CountEntry, BoxWeightEntry, PalletLayers).
  Do not fork the data model — only wrap the UI in a step machine.
- Manager features (LOGS, ASSIGN TAG, OPS) reachable via a "MANAGER" pop-out
  that doesn't leave QCer mode.
- Skip-back must preserve in-progress data. The QCer should never lose work
  by hitting "back."

This is foundational and risky to do hastily. Plan it slice-by-slice with the
review skill before each merge.

---

## Architecture

```
Laptop in the shed (runs everything)
├── BerryCheck Electron app (port 5175)
│   ├── React frontend (QC + Ops views)
│   ├── Express/WebSocket relay server
│   └── Serial reader (clamshell scale)
├── Python camera service (OpenCV, HSV counting)
├── Grader service (mock or real mode, WebSocket client)
├── ESP32 via USB (grader motors + tray load cells)
└── Arduino Nano via USB (clamshell scale)

QCer's phone (optional)
└── Safari → BerryCheck UI on shed WiFi

All data in localStorage. Sacred data (history, archives, calibration)
is never lost — buffer, persist, retry. A single sample on the tray
can be re-scanned; that's replaceable.
```

**Contract:** `INTEGRATION_SPEC.md` defines the data contract between machine
and app. `PROTOCOL.md` defines pre-work and debugging protocols for agents.

---

## Business Model

### Product #1: Grading machine + QC system (the sell)
- Physical grader ($500-800 in parts) + BerryCheck software
- Shed operator buys the machine, gets the software
- The receipt/defense workflow is the pitch that lands

### Product #2: Ops intelligence layer (the upsell)
- Pack plans, line optimization, grower trends, DC reconciliation
- This is consulting value — Jacob's expertise packaged as software
- Requires Product #1 data to be useful

### Product #3: Data network (the long game)
- Every shed that plugs in captures structured quality data
- Cross-shed grower performance, DC rejection patterns, predictive flags
- The shed operator thinks he bought a CYA tool; he actually joined a data network

### Related: Butterfly / PrimusEngine
- Separate product: food safety audit platform (PrimusGFS compliance)
- Same user (Jacob), different context (farm audits vs packing shed QC)
- Shared tech philosophy: offline-first, AI-assisted, field-tested
- Separate business model: consultant SaaS ($100/mo) + operations ($30/mo)

---

## What Success Looks Like (Summer 2026)

- [ ] Every pallet that leaves the dock has a QC record
- [ ] Jacob can pull up any pallet's grade + photo in under 10 seconds
- [ ] First DC dispute defended with BerryCheck data
- [ ] QC person runs it independently for at least 2 weeks
- [ ] Grower gets their first weekly quality trend report
- [ ] Clear yes/no on whether the grader machine improves QC workflow
- [ ] App has zero data-loss incidents for the entire season
- [ ] Ops metrics (speed, blowoff, pack plan vs actual) tracked daily
