# Grader ↔ BerryCheck Integration Spec
*Shared reference document — lives in both projects*
*Updated: April 5, 2026*

---

## Overview

The **blueberry grader** is the physical hardware (roller tray, cameras, lights, ESP32)
that separates, photographs, weighs, and counts berries. It produces structured data.

**BerryCheck** is the web application that receives that data, grades it against
MBG/Butterfly tolerances, logs it, generates reports, and pushes to operations
dashboards. It consumes structured data.

A standalone **clamshell scale** provides pack weight measurement as an additional
peripheral device, connected via USB serial independently of the grader.

This document defines the contract between all three systems so they can be
developed independently and integrate cleanly.

**Key principle: The grader produces counts. BerryCheck produces grades.**

---

## Data Flow

```
┌─────────────────────────────────────────────────────┐
│                    GRADER (hardware)                 │
│                                                     │
│  Cameras → OpenCV → berry count + position mapping  │
│  4x 5kg load cells → HX711 → tray weight            │
│  ESP32 → serial → cycle control + tray weighing     │
│  All runs on laptop (Python)                        │
└──────────────────────┬──────────────────────────────┘
                       │
                       │  WebSocket or HTTP POST
                       │  to localhost:5175
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│                 BERRYCHECK (webapp)                  │
│                                                     │
│  Receives sample payload → grades → logs → displays │
│  Express relay server on port 5175                  │
│  React frontend for QC and Ops views                │
│  Serial port reader for clamshell scale             │
└──────────────────────▲──────────────────────────────┘
                       │
                       │  USB Serial (115200 baud)
                       │  W:xxx.x weight readings
                       │
┌──────────────────────┴──────────────────────────────┐
│               CLAMSHELL SCALE (peripheral)           │
│                                                     │
│  1x 1kg load cell → HX711 → Arduino Nano/ESP32     │
│  Weighs pint clamshells (~310g) and 18oz (~510g)    │
│  Independent — works when grader is off             │
└─────────────────────────────────────────────────────┘
```

---

## Device Architecture

### Grader ESP32 (primary device)
- ESP32-WROOM-32 on USB serial to laptop
- Controls: roller motors (PWM via L298N or equivalent driver)
- Reads: 4x 5kg bar load cells via HX711 (tray weight)
- Serial protocol: `START`/`CAPTURING`/`DONE` for cycle control
- Future: servo control for automated unload

### Clamshell Scale (standalone peripheral)
- Arduino Nano (or ESP32) on separate USB serial
- Reads: 1x 1kg bar load cell via HX711
- Independent from grader — works when grader is off
- Used for weighing pint clamshells (~310g) and 18oz bricks (~510g)
- See "Clamshell Scale Serial Protocol" section below

### Load Cell Frame (tray weighing)

Three-piece stacking assembly:
1. **Machine frame** with slide adapter plates
2. **Load cell frame** — 2020 aluminum rectangle riding on drawer slides, 4x 5kg cells mounted on top
3. **Berry tray** — drops onto steel dowel locating pins on cell free ends

```
Load path: berries → berry tray → pin receiver C-mounts →
steel dowel pins → top pads → cell free ends → strain gauge →
cell fixed ends → base plates → LC frame → drawer slides → machine frame
```

Slides carry horizontal forces only. Vertical weight path goes exclusively
through load cells. Tray lifts straight up for quick-swap (cleaning, roller swap).

---

## Position-Based Tracking Model

The rollers form a fixed grid. Positions are known and constant — calibrated once per camera.

```
Grid: 18 columns × 11 rows = 198 positions
Position (col, row) = fixed physical location on the roller tray
Berry pitch: 23mm center-to-center (saddle to saddle)
Shaft spacing: 25mm center-to-center
Roller peak diameter: 23mm
Roller waist diameter: 17.7mm
Roller profile: linear V-groove (WECO style)
```

**How it works:**
- Overhead camera determines occupancy: is there a berry at position (col, row)?
- Each angled camera also maps to the same grid positions from its perspective
- Berry is spinning on the rollers — across all frames from all cameras, near-full surface coverage
- Counting = occupancy detection per position, NOT blob-finding in a messy image
- Calibration is one-time per camera: map grid positions to pixel coordinates

**Why positions, not berries:**
- Each position has known camera coverage strengths/weaknesses
- Easy to pull "all images of the berry at position (3,7)" across all cameras
- Rolling minimizes blind spots; position awareness tells you which spots have weaker coverage
- Far more reliable than tracking individual berries across frames

---

## Sample Payload (grader → BerryCheck)

The grader sends this JSON to BerryCheck's relay server when a scan completes.

```json
{
  "source": "grader",
  "version": "1.0",
  "timestamp": "2026-06-15T14:32:07.123Z",
  "sample_method": "fullcount",

  "counts": {
    "total": 187,
    "clean": 178,
    "permanent": 6,
    "condition": 3,
    "decay": 0,

    "permanent_detail": {
      "stems": 3,
      "scars": 2,
      "insect": 1,
      "broken_skin": 0,
      "mummified": 0
    },
    "condition_detail": {
      "soft": 2,
      "leaky": 1,
      "shriveled": 0,
      "overripe": 0
    },
    "decay_detail": {
      "mold": 0,
      "rot": 0
    }
  },

  "weight": {
    "sample_g": 412.3,
    "tare_g": 850.0,
    "avg_berry_g": 2.2,
    "scale_source": "tray"
  },

  "grid": {
    "cols": 18,
    "rows": 11,
    "occupancy": [
      [1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      "... (one array per row, 18 elements each, 1=occupied, 0=empty)"
    ]
  },

  "imaging": {
    "spectrums_captured": ["visible"],
    "cameras_used": 4,
    "uv_flag": false,
    "nir_captured": false
  },

  "images": {
    "transport": "filepath",
    "visible_top": "./captures/sample_0042/visible_top.jpg",
    "visible_angle_l": "./captures/sample_0042/visible_angle_l.jpg",
    "visible_angle_r": "./captures/sample_0042/visible_angle_r.jpg",
    "nir_top": null,
    "uv_top": null
  }
}
```

### Field Notes

**`source`**: Always `"grader"` when from the hardware. Distinguishes from
`"phone"` or `"manual"` entries.

**`sample_method`**: Always `"fullcount"` when the grader provides the total count.

**`counts`**: In Phase 1, the grader provides `total` (camera-counted). The QCer
enters defect counts manually in the BerryCheck UI. Detail fields may be empty
until Phase 2+ when ML assists or the QCer fills them in.

**`counts.total`**: Replaces BerryCheck's `_fullcountTotal` field.

**`counts.decay`**: Decay semantics TBD — need to confirm with MBG QC inspectors
whether decay is a subset of condition or tracked independently. See "Questions for
MBG QC" section. BerryCheck should handle both interpretations until calibrated.

**`weight`**: From the HX711 load cell(s). `avg_berry_g` = `sample_g` / `total`.

**`weight.scale_source`**: `"tray"` (4x 5kg cells under the roller tray) or `"clamshell"`
(standalone 1kg scale). Tells BerryCheck which scale provided the weight. When `"clamshell"`,
the weight was read before berries were loaded onto the grader.

**`grid`**: Position occupancy map. Lets BerryCheck know which positions had berries
and enables per-position image retrieval.

**`images.transport`**: `"filepath"` for localhost (default). Future: `"url"` for
remote/server deployments where grader and BerryCheck run on different machines.
Images are referenced, not embedded — BerryCheck reads them from disk or fetches
from URL as needed.

**`imaging`**: Which spectrums were captured. Phase 1 likely `["visible"]` only.

---

## BerryCheck Endpoints the Grader Uses

### WebSocket relay (primary — real-time)
Connect to `ws://[laptop-ip]:5175/?role=grader`

The grader sends:
```json
{
  "type": "sample",
  "data": { /* sample payload above */ }
}
```

BerryCheck dashboard receives it the same way it currently receives phone camera
images — the relay broadcasts to all `dashboard` role clients.

### HTTP POST (fallback / buffer)
`POST http://[laptop-ip]:5175/api/sample`

Same payload as WebSocket message body. Used when WebSocket connection drops.
The grader buffers the payload locally and retries via POST on reconnect.

**Data loss rules:**
- A single sample sitting on the tray in front of the QCer can be re-scanned. Losing it is annoying but not critical.
- Archives, pallet records, history, and calibration logs are sacred. These must never be lost. Buffer, persist, retry.
- If WebSocket drops mid-scan: grader completes the cycle (berries are already on the rollers), saves payload to disk, retries on reconnect.

### Cycle status (live display)
The grader sends status updates during the scan cycle:
```json
{
  "type": "grader_status",
  "status": "scanning",
  "pass": "visible",
  "progress": 0.45
}
```

---

## Command Channel (BerryCheck → grader)

The QC person controls the grader from the BerryCheck UI. No separate app needed.

### Commands BerryCheck sends to the grader

**Start scan:**
```json
{
  "type": "command",
  "action": "start_scan",
  "config": {
    "spectrums": ["visible"]
  }
}
```
QC person loads berries, slides tray in, hits SCAN in BerryCheck.
Grader weighs, spins rollers, captures frames, counts, sends results back.

**Abort scan:**
```json
{
  "type": "command",
  "action": "abort"
}
```
Stops current cycle. Motors off.

**Unload:**
```json
{
  "type": "command",
  "action": "unload"
}
```
Triggers the unload mechanism after sample is saved.

**Prototype (pivot dump):** QCer slides tray out on drawer slides, pulls locking
pin, lifts front handle — tray pivots backward, berries cascade over roller peaks
into lug underneath. Manual, no electronics needed.

**Future (vertical unload):** Dual sub-frame design. Bottom rollers drop ~30mm on
vertical guides, belt disengages, berries fall through gaps. Manual latch initially,
servo-actuated via ESP32 later. Design complete — see
`berrygrader_machine/archive/VERTICAL_UNLOAD_DESIGN.md`.

**Dump (emergency unload):**
```json
{
  "type": "command",
  "action": "dump",
  "confirm": true
}
```
Immediately unloads berries without saving. For when the QCer needs the tray
clear NOW. Requires confirmation tap in UI (safeguard against accidental press).
Does not discard any already-saved data.

**Tare scale:**
```json
{
  "type": "command",
  "action": "tare"
}
```
Zero the load cell with empty tray. Run once at start of session.

**Calibrate (empty tray capture):**
```json
{
  "type": "command",
  "action": "calibrate"
}
```
Captures empty tray under all light types for white balance and grid position mapping.

**Adjust motor speed:**
```json
{
  "type": "command",
  "action": "set_speed",
  "rpm": 30
}
```

### Grader status messages back to BerryCheck

```json
{"type": "grader_status", "status": "ready"}
{"type": "grader_status", "status": "weighing", "weight_g": 412.3}
{"type": "grader_status", "status": "scanning", "pass": "visible", "progress": 0.33}
{"type": "grader_status", "status": "scanning", "pass": "nir", "progress": 0.66}
{"type": "grader_status", "status": "scanning", "pass": "uv", "progress": 1.0}
{"type": "grader_status", "status": "counting"}
{"type": "grader_status", "status": "complete"}
{"type": "grader_status", "status": "unloading"}
```

### BerryCheck UI — Grader Control Panel

Only visible when grader is connected:

```
┌──────────────────────────────────────────┐
│  GRADER  ● Connected                     │
│                                          │
│  [  SCAN  ]    [TARE]    [CALIBRATE]     │
│  Status: Ready                           │
│  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░  Visible pass     │
│  Tray Weight: 412.3g  |  Count: 187     │
│  [ UNLOAD ]              [ DUMP ⚠ ]      │
├──────────────────────────────────────────┤
│  CLAMSHELL SCALE  ● COM11                │
│                                          │
│  Weight: 312.5g        [TARE]            │
│  [ CALIBRATE ]  [ SELECT PORT ▼ ]        │
└──────────────────────────────────────────┘
```

When grader disconnects, BerryCheck falls back to phone/manual entry. The grader
is an enhancement, never a dependency.

---

## Full Scan Sequence (end to end)

```
1. QCer slides tray out on drawer slides, loads berries onto rollers
2. Slides tray back into camera theater
3. Taps [SCAN] in BerryCheck
4. BerryCheck sends start_scan command via WebSocket
5. Relay forwards to grader Python script
6. Grader reads tray load cells → sends {"status":"weighing"}
7. Grader sends "START" over serial to ESP32
8. ESP32 spins rollers → grader sends {"status":"scanning","pass":"visible"}
9. Cameras capture visible frames across all positions
10. (If configured) ESP32 cycles NIR, UV lighting for additional passes
11. OpenCV processes frames → position-based occupancy → berry count
12. Grader sends {"status":"counting"}
13. Grader assembles sample payload with count + grid + weight + image paths
14. Grader sends {"type":"sample","data":{...}} via WebSocket
15. BerryCheck receives payload, auto-populates Full Count total + weight
16. QCer reviews count, enters defect counts in BerryCheck UI
17. QCer taps LOG SAMPLE
18. BerryCheck grades against tolerances, stores record
19. QCer slides tray out, pulls locking pin, lifts front handle (pivot dump)
20. Berries cascade over roller peaks into lug underneath
21. Lower tray, re-pin, slide back in — ready for next sample
```

Total time target: under 60 seconds from tray-in to grade displayed.
At 4 min/pallet with good fruit, the system accommodates skipping to 1-2 samples.

---

## BerryCheck Data Model Mapping

| Grader field | BerryCheck field | Notes |
|---|---|---|
| counts.total | _fullcountTotal | Auto-populates Full Count total |
| counts.permanent | permanent count | Sums to permanent defect % |
| counts.condition | condition count | Sums to condition defect % |
| counts.decay | decay count | Separate tolerance per MBG |
| weight.sample_g | _packWeight | Metadata for filler calibration |
| weight.avg_berry_g | (calculated) | Displayed in sample detail |
| imaging.uv_flag | uv_flag | Boolean — botrytis fluorescence detected |
| images.* | (stored references) | Audit trail, ML training |
| grid.occupancy | (new field) | Position map for per-position analysis |
| timestamp | sample timestamp | ISO 8601 |
| source | (new field) | "grader" vs "phone" vs "manual" |

---

## Payload Validation

When BerryCheck receives a grader payload:
- Verify `permanent + condition + decay + clean == total` (if all fields present)
- In Phase 1, the grader only sends `total`. Defects come from the QCer later.
  Validation runs after the QCer submits, not on grader payload receipt.
- If validation fails: **warn, don't block.** Show a flag. Never prevent the QCer
  from saving a sample. The line doesn't wait.

---

## Clamshell Scale Serial Protocol

The clamshell scale communicates over USB serial at 115200 baud.
This is a direct serial connection to BerryCheck — NOT via the WebSocket relay.

### Scale → BerryCheck (continuous output, 5 readings/sec)
```
W:xxx.x\n
```
Example: `W:312.5\n` (grams, 0.1g resolution)

### BerryCheck → Scale (commands)

| Command | Response | Action |
|---|---|---|
| `TARE\n` | `OK:TARE\n` | Zero the scale (must be empty) |
| `CALWEIGHT:xxx.x\n` | `OK:CAL:factor\n` | Calibrate with known weight in grams |
| `GETCAL\n` | `CAL:xxx.x\n` | Report current calibration factor |

Cal factor persists in EEPROM/flash across power cycles. Auto-tare on power-up
(scale must be empty when plugged in).

### BerryCheck UI — Clamshell Scale Module

- **Live weight display** — reads `W:xxx.x` from serial, shows current weight
- **Tare button** — sends `TARE`, resets display to 0
- **Calibration wizard** — tare → place known weight → enter weight → calculates factor
- **COM port selector** — dropdown to select which serial port the scale is on
- **Weight log** — optional timestamp log of each weigh event

---

## Sampling Workflows

### Pint Clamshell Workflow
1. Place sealed clamshell on clamshell scale
2. Read weight from scale display in BerryCheck
3. Open clamshell, dump berries onto roller tray
4. Tap SCAN in BerryCheck → grader counts berries
5. QCer enters defects → grade displayed
6. Pivot dump to unload → next sample

Weight source: clamshell scale. `scale_source: "clamshell"` in payload.

### 600g Weigh Sample Workflow
1. Load berries directly onto roller tray
2. Tray load cells read weight automatically (tare at session start)
3. Tap SCAN → grader counts berries
4. QCer enters defects → grade displayed
5. Pivot dump to unload → next sample

Weight source: tray load cells. `scale_source: "tray"` in payload.

### How They Map to BerryCheck

Both workflows use `sample_method: "fullcount"` — the grader counts berries the
same way regardless of how they were weighed. The `weight.scale_source` field
tells BerryCheck where the weight came from.

Both populate `_packWeight` in CountEntry. The clamshell workflow gets its weight
before the scan; the tray workflow gets its weight during the scan.

---

## Phase Integration Timeline

### Phase 1 — Counter + manual grade (season start)
- Grader sends: `counts.total` (camera-counted) + `weight` (load cell) + images
- QCer enters: defect counts by type in BerryCheck UI
- BerryCheck: grades using existing engine, logs, pushes to dashboards
- **Every sample = labeled training data** (images paired with human defect counts)
- Images stored for future ML training

### Phase 2 — ML assistant (mid-season)
- Grader sends: `counts.total` + `weight` + suggested defect counts from ML model
- QCer: confirms or overrides suggested counts in BerryCheck UI
- Corrections feed back into training pipeline
- Trust earned progressively, sample by sample

### Phase 3 — Auto grade (late season / next season)
- Grader sends: complete payload with all counts, detail breakdowns, UV flags
- QCer: reviews and overrides if needed
- Minimal human interaction on clean fruit

---

## Deployment Model

### Day 1: Single laptop in the shed
Both grader software and BerryCheck run on the same laptop. Grader POSTs to
localhost:5175. No network hops.

### Future: Server-hosted for other sheds
BerryCheck needs a path to run on a server so another packing shed can adopt
mid-season. This means:
- Image transport must support URLs (not just local filepaths)
- WebSocket relay must handle remote connections
- Data persistence must be robust (not just localStorage)
- Auth/multi-tenant considerations

Design for localhost-first but don't hardcode assumptions that prevent remote deployment.

---

## Network Architecture

```
Shed WiFi (no internet)
│
├── Laptop (runs everything day 1)
│   ├── BerryCheck relay server (port 5175)
│   ├── BerryCheck Vite dev server (port 5176) or built dist
│   ├── Grader Python scripts (capture, count, push)
│   ├── ESP32 via USB serial (grader: motors + tray load cells)
│   └── Arduino Nano via USB serial (clamshell scale)
│
├── QCer's phone
│   └── Safari → http://[laptop-ip]:5175 (BerryCheck UI)
│
├── Owner's phone (optional)
│   └── Safari → http://[laptop-ip]:5175/?mode=daily
│
└── (Future) Server replaces laptop for BerryCheck hosting
```

---

## MBG Standards Calibration

### Calibration Log (new feature — app side)
Before production use, BerryCheck's grading engine must be validated against the
MBG portal QC tool. The app should log this calibration:

- Date of calibration
- Samples run through both BerryCheck and MBG portal tool
- Results comparison (pass/fail agreement, tolerance alignment)
- Sign-off (who ran it)
- Any discrepancies and how they were resolved

This log gives credibility — proof that BerryCheck's interpretation of MBG standards
matches the official tool.

### Questions for MBG QC Inspectors
When MBG QC inspectors visit the shed, ask:

1. **Decay in condition count**: Is decay a subset of condition defects, or tracked
   entirely separately? (e.g., 3 condition + 1 decay: is that 3 total or 4 total?)
2. **Tolerance interpretation**: "shall not exceed X%" — does at-limit (exactly X%) pass or fail?
3. **Subsample vs full count**: Does MBG accept full-count (all berries) results or
   only the traditional 600g/30-berry subsample method?
4. **Photo documentation**: Does MBG accept/recognize photo-documented QC samples
   as evidence in DC disputes?
5. **UV fluorescence**: What's MBG's position on UV botrytis screening as a QC tool?

These questions should be accessible from within the BerryCheck app so the QCer
can pull them up when inspectors visit.

---

## What Each Project Needs to Build

### Grader project (machine/ — hardware + Python)
- [x] WebSocket client (connect to BerryCheck relay on port 5175 as role "grader") — `grader_service.py`
- [x] Command listener (receive start_scan, abort, unload, dump, tare, calibrate) — `grader_service.py`
- [x] Status broadcaster (send grader_status messages during cycle) — `grader_service.py`
- [x] Sample payload builder (assemble JSON per this spec) — `grader_service.py` (mock mode)
- [x] Local buffer (save payloads to disk if WebSocket drops, retry on reconnect) — `grader_service.py`
- [ ] OpenCV berry counter (position-based occupancy detection on 18×11 grid)
- [ ] Grid calibration routine (map grid positions to pixel coords per camera)
- [ ] Multi-camera position mapping (reconcile same position across cameras)
- [ ] Image capture coordinator (multi-cam, multi-spectrum, save to disk)
- [ ] Tray load cell reader (4x 5kg cells, HX711 via ESP32 serial)
- [ ] ESP32 cycle controller (serial protocol for lights/motors)

### Clamshell scale project (firmware)
- [ ] Arduino Nano / ESP32 firmware (HX711 read, serial protocol: W:xxx.x, TARE, CALWEIGHT, GETCAL)
- [ ] EEPROM cal factor persistence
- [ ] Auto-tare on power-up

### BerryCheck project (app/ — webapp)
- [x] WebSocket role: "grader" — relay already routes grader↔dashboard messages (`server.js`)
- [x] Command sender: relay forwards dashboard→grader commands (`server.js`)
- [x] HTTP POST endpoint `/api/sample` as WebSocket fallback (`server.js`)
- [ ] Grader control panel in QC view (SCAN, TARE, CALIBRATE, UNLOAD, DUMP buttons)
- [ ] Grader connection indicator (● Connected / ○ Disconnected)
- [ ] Sample receiver: parse grader payload, populate CountEntry fields
- [ ] Auto-populate `_fullcountTotal` from `counts.total`
- [ ] Auto-populate `_packWeight` from `weight.sample_g`
- [ ] Progress bar rendering from grader_status messages
- [ ] Store grader image references alongside sample record
- [ ] Display `source` field in sample history (grader vs phone vs manual)
- [ ] Graceful fallback: if grader disconnects, revert to phone/manual workflow
- [ ] Clamshell scale serial reader (serialport npm, read W:xxx.x, send commands)
- [ ] Clamshell scale UI module (live weight, tare, calibration wizard, COM port selector)
- [ ] Dual sampling workflow support (clamshell vs tray weight → scale_source field)
- [ ] MBG calibration log (date, samples compared, results, sign-off)
- [ ] "Questions for MBG QC" reference accessible from app
- [ ] Payload validation (warn, never block)

---

## Project Repositories

| Path | Contents | Owner |
|---|---|---|
| `berrycheck/app/` | BerryCheck web app (React/Vite, Express relay, Electron) | Claude Code |
| `berrycheck/machine/` | Grader software (grader_service.py, firmware, capture script) | Desktop Claude / Claude Code |
| `berrycheck/INTEGRATION_SPEC.md` | This document — the contract | Shared |
| `berrycheck/PROTOCOL.md` | Pre-work and debugging protocols for agents | Shared |
| `berrygrader_machine/` | Hardware designs (SCAD, specs, session logs) | Desktop Claude |
| `berrygrader_machine/current/` | Active build files (brackets, rollers, reference model, scales) | Desktop Claude |
| `berrygrader_machine/archive/` | Shelved designs (vertical unload, old bracket iterations) | Desktop Claude |
