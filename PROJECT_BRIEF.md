# BerryCheck QC — Project Brief
*Complete handoff document for Claude Code*

---

## What this is

A blueberry QC (quality control) tool for a packing shed operation in Clinch County, Georgia. The operator spreads a berry sample on a white tray, physically sorts defects into tray corners, photographs it with an iPhone, and the system auto-counts the zones, grades the lot against buyer spec thresholds, and logs everything to a database.

This is a real working tool being built for active use during blueberry season. The developer (Jacob) does not write code himself — Claude writes all code.

---

## Current state

A working Flask demo exists in this folder with:
- `app.py` — Flask server, Claude Vision API integration, `/analyze` endpoint
- `templates/dashboard.html` — ThinkPad-side QC dashboard, polls for camera results
- `templates/capture.html` — iPhone camera interface, sends image to server
- `requirements.txt` — flask, anthropic

The demo works end-to-end:
1. Flask runs on ThinkPad (Windows, WiFi network)
2. iPhone opens `/capture` in Safari on same WiFi
3. Operator spreads berries, sorts defects to corners, taps capture
4. Claude Vision analyzes image, returns JSON counts
5. Dashboard auto-populates, operator reviews and logs sample
6. Grade analysis and threshold headroom calculated per buyer spec

---

## The tray corner system

This is the core UX innovation. The operator physically sorts berries into corners before photographing:

- **Bottom right** → softs (operator squeeze-detects these manually)
- **Bottom left** → red / unripe berries
- **Top right** → anthracnose suspects (dark sunken lesions)
- **Center field** → all remaining berries (the count population)

Claude Vision is prompted to count each zone separately. The operator does the defect identification with their hands and eyes — the camera just counts what they've already sorted.

---

## Defects being tracked

Three defects matter. Everything else is secondary:

1. **Softs** — detected by operator touch/squeeze, sorted to corner. No camera can detect this.
2. **Botrytis** (gray mold) — UV fluorescence under 365nm light. Fluoresces before visible to naked eye. Future hardware: UV LED hood over tray.
3. **Anthracnose** — visible dark sunken lesions. Camera-detectable. Sorted to corner by operator.

Red/unripe berries are tracked but lower priority than the three above.

---

## Buyer spec / grade threshold system

This is the core business value. Every sample is graded against a buyer spec:

| Spec | Soft limit | Total defect limit | Red limit | Anthracnose limit |
|---|---|---|---|---|
| US No. 1 | 5% | 10% | 5% | 3% |
| US No. 2 | 10% | 20% | 10% | 8% |
| Premium (2%) | 2% | 4% | 2% | 1% |
| Export (1%) | 1% | 2% | 1% | 0.5% |

The dashboard shows:
- Current defect % per category
- How much headroom remains before hitting threshold ("you have +2.3% soft headroom")
- Auto-downgrade logic (if lot fails target spec, shows what grade it does qualify for)
- Color coding: green = comfortable, amber = watch it, red = threshold breach

This headroom number is the "money line" — tells the floor manager exactly where they stand on each lot.

---

## Hardware setup (current / planned)

**Current demo hardware:**
- ThinkPad (Windows) running Flask server
- iPhone on same WiFi as camera input
- Any bright light, white tray

**Planned production hardware:**
- Raspberry Pi 5 (~$90) replacing ThinkPad for shed deployment
- Raspberry Pi Camera Module 3 as primary overhead camera
- 7" touchscreen for operator display
- Load cell + HX711 for sample weight (0.1g resolution)
- Backlit acrylic tray (white LED panel underneath)
- UV LED hood (hinged black acrylic box, 365nm LED strips inside) — second exposure mode for botrytis

**UV workflow (not yet built):**
- White light image first (hood open) → count + anthracnose
- Hood closes, UV LEDs fire → second image → botrytis fluorescence flag
- Both images tied to same lot record

---

## What needs to be built next

Priority order:

### 1. SQLite persistence (high priority)
Currently history is in browser localStorage — disappears on refresh, not shared between devices.
Need: SQLite database (`qc.db`) on the server storing all sample records.
Fields needed:
- id, timestamp, lot_id, grower, variety, sample_weight_g
- total_count, soft_count, red_count, anthr_count
- soft_pct, red_pct, anthr_pct, defect_pct
- uv_flag (boolean)
- buyer_spec, grade_result, headroom_soft
- notes (from Vision response)
- image_filename (save thumbnail)

### 2. Lot accumulation (high priority)
Multiple samples per lot should accumulate:
- Average defect rates across all samples for a lot
- Trend indicator (is defect rate going up or down across samples?)
- Final lot grade based on accumulated average, not single sample

### 3. Grower history dashboard (medium priority)
Per-grower view showing:
- Season defect averages
- Which growers consistently trend toward threshold
- Variety breakdown per grower

### 4. PDF/CSV report export (medium priority)
- Per-lot report formatted for PrimusGFS audit trail
- Timestamp, grower, variety, sample data, grade result, UV flag
- Should look professional enough to hand to an auditor

### 5. UV hood integration (future)
- Second camera trigger via GPIO (Pi only)
- Two-image workflow per sample
- UV flag auto-set from second image analysis

### 6. Predictive model (future)
- Based on historical grower + variety + date data
- Flag incoming lots before QC based on known patterns
- "Grower X with Jewel in week 3 averages 4.2% softs — near threshold"

---

## Business context

Jacob is building toward a consulting practice around food safety auditing (PrimusGFS). This tool has two value angles:

1. **Internal shed use** — faster, more consistent QC with automatic audit-ready records
2. **Commercial product** — sellable to other small/mid-size packing operations in the Southeast

The PrimusGFS audit trail angle is important — auto-generated timestamped QC records reduce manual paperwork and support food safety compliance. Jacob's auditing background makes him credible to sell this to other sheds.

---

## Tech stack

- **Backend:** Python / Flask
- **Vision AI:** Anthropic Claude API (claude-opus-4-5), image sent as base64
- **Database:** SQLite (to be implemented)
- **Frontend:** Vanilla HTML/CSS/JS (no framework)
- **Deployment:** Local network only (ThinkPad or Pi on shed WiFi)
- **iPhone interface:** Mobile Safari, getUserMedia for camera

---

## Environment

- Windows ThinkPad (development and current deployment)
- Python with pip
- API key in environment variable: `ANTHROPIC_API_KEY`
- Future: Raspberry Pi 5 running same Flask app on shed network

---

## Design language

The UI uses a dark agricultural terminal aesthetic:
- Background: near-black green-tinted (`#0f1209`)
- Accent: muted green (`#7cb842`)
- Warning: amber (`#d4930a`)
- Error/fail: red (`#c0392b`)
- Font: IBM Plex Mono (monospace throughout)
- Minimal, no decorative elements — this runs on a shed floor

Keep this aesthetic consistent in all new UI work.

---

## Claude Vision prompt (current)

```
You are analyzing a blueberry QC sample tray image.

The operator has spread berries across a white tray and physically sorted defects into corners:
- BOTTOM RIGHT corner: soft berries placed there by operator
- BOTTOM LEFT corner: red / unripe berries placed there by operator
- TOP RIGHT corner: berries with suspected anthracnose lesions (dark sunken spots)
- CENTER FIELD: all remaining berries (the main population)

Your job is to count berries in each zone as accurately as possible.

Respond ONLY with a valid JSON object, no other text, no markdown:
{
  "total": <integer, ALL berries visible on tray>,
  "softs": <integer, berries in bottom right corner>,
  "reds": <integer, berries in bottom left corner>,
  "anthracnose": <integer, berries in top right corner>,
  "uv_flag": false,
  "notes": "<one sentence observation about the sample, or empty string>"
}

If a corner appears empty, use 0. If the image is too dark or blurry to count accurately,
still give your best estimate and note it.
```

This prompt should be tuned over time as real sample images reveal where Vision struggles.

---

## Known limitations / honest notes

- Claude Vision counts accurately to ~85-92% on clean single-layer spreads
- Overlapping/touching berries reduce count accuracy
- Vision cannot detect softs — operator hands are the only reliable soft detector
- Anthracnose detection by Vision is decent for obvious lesions, misses subtle ones
- UV botrytis detection is promising but untested — hardware not yet built
- The corner sorting system depends on operator discipline — needs training

---

## Files in this folder

```
berrycheck/
├── app.py                  # Flask server + Vision API
├── requirements.txt        # flask, anthropic
├── README.md               # Quick start instructions
├── PROJECT_BRIEF.md        # This file
└── templates/
    ├── dashboard.html      # ThinkPad QC dashboard
    └── capture.html        # iPhone camera interface
```
