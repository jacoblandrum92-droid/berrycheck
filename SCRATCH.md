# Scratch — Cross-Instance Notes
*Shared workspace between Claude Code and Claude Desktop*
*Updated: 2026-04-05*

## Project Structure
- `app/` — QC + Ops software (Claude Code)
- `machine/` — grader hardware (Desktop Claude)
- `INTEGRATION_SPEC.md` — contract between them
- This file — the notepad between instances

---

## Current State (2026-04-01)

### Hardware Build Status (updated 2026-04-01)
- **Parts have arrived.** Hardware build starting NOW.
- 2020 aluminum extrusion: on hand, ready to cut
- Rollers printed: v10/v11 segments on hand
- Couplers printed: v4 on hand — may or may not be relevant for 2020 build
- Old prototype brackets (far_bracket_final etc): IRRELEVANT — old prototype, ignore
- ESP32 on hand, not yet wired
- Motors on hand
- 3D prints folder: `Desktop/Blueberry 3D prints/` has printed parts
- SCAD reference model: `Desktop/berrygrader_machine/grader_reference_v4.scad`

### Active Problem: Roller Mounting
**This is the first thing to solve.** How do the 6mm core shaft rollers mount to the 2020 frame with pulleys attached while still allowing the dual sub-frame (top fixed, bottom drops) design? Specifically:
- How does the 6mm shaft interface with the 2020 extrusion? (bearings? printed holders? slots?)
- Where do pulleys attach on each shaft for the polybelt to engage?
- How do the bottom-frame rollers maintain alignment in their vertical drop channels while still having pulleys?
- Pulley dimensions TBD — Jacob will design and print quickly once mounting is figured out

### Roller Dimensions (from v11.6 — current production design)
| Parameter | Value |
|---|---|
| Peak diameter | 23mm |
| Waist diameter | 17.7mm |
| Berry pitch | 23mm (saddle center to saddle center) |
| Shaft core diameter | 6mm |
| Shaft spacing | 25mm center-to-center (2mm clearance between peaks) |
| Segments per roller | 3 (6 saddles each, 150mm segment, 450mm total) |
| Grid | 18 columns × 11 rows = 198 positions |
| Profile | Linear V-groove (WECO style) |

### Polybelt Specs
- 3mm diameter orange tubular polybelt
- Serpentines through top half of roller drive wheels
- Runs straight on bottom half
- Custom printed pulleys on each shaft (Bambu A1 Mini) — dimensions TBD

### Mechanical Design Decisions (from 2026-03-31 planning session)

**Dual sub-frame roller system:**
- Top frame: fixed, holds every other roller
- Bottom frame: drops on vertical guides/races for unloading
- Both frames nested with channels that maintain roller spacing and height limits

**Polybelt drive:** (see "Polybelt Specs" section above for belt details)
- When bottom frame drops ~30mm, bottom rollers disengage from belt
- Gap between top rollers opens to ~28mm — berries fall through
- Manual release initially (latch/lever), servo automation later

**Key constraints:**
- Biggest roller that fits inside a Ropak lug profile (599 × 399mm exterior)
- Frame must sit inside the lug rim (legs 190mm for 178mm lug clearance)
- Tray slides in/out on rails
- Custom printed pulleys (Bambu A1 Mini)

### Hardware Additions (2026-04-04/05)
- **Clamshell scale:** Standalone USB scale for weighing pint/18oz clamshells. 1×1kg load cell, HX711, Arduino Nano/ESP32. Serial protocol: `W:xxx.x`, `TARE`, `CALWEIGHT`. See `berrygrader_machine/current/Clamshell Scale (In Progress)/`.
- **Load cell frame:** 2020 rectangle on drawer slides under berry tray. 4×5kg cells. Tray drops onto steel dowel locating pins for quick-swap. See `berrygrader_machine/current/Load Cell Assemblies/`.
- **Pivot dump prototype** is the active unload mechanism (single frame, manual tilt). Vertical unload shelved.
- **Load cells on order**, steel dowel pins on order, drawer slides on order.

### Software Status
- BerryCheck app: full QC + Ops features built, Electron wrapped
- Camera service: HSV counting works, integrated into app
- Grader firmware: basic motor control, serial protocol written
- Capture script: multi-camera, manual mode, auto-saves organized frames
- **Mock grader service built:** `machine/grader_service.py` — connects to relay, sends fake scan cycles + sample payloads
- **Clamshell scale firmware:** basic test sketch at `berrygrader_machine/current/Clamshell Scale (In Progress)/load_cell_test/` — needs full protocol implementation
- **NOT built yet:** image analysis, BerryCheck grader control panel UI, grid calibration, clamshell scale BerryCheck integration, tray load cell ESP32 integration

### Integration Spec Updates (2026-03-31)
- Added position-based tracking model (track grid positions, not berries)
- Added DUMP command (emergency unload with safeguard)
- Updated unload to reflect manual drop mechanism (not "Phase 3 servo")
- Added grid occupancy to sample payload
- Added image transport mode flag (filepath default, URL for remote)
- Added MBG calibration log concept
- Added "Questions for MBG QC" section
- Defined data loss rules (sacred data vs replaceable samples)
- Removed singulation buzz (doesn't match roller design)
- Decay semantics: TBD pending MBG inspector confirmation

### Resolved Integration Questions
1. **Image transport:** Filepath for localhost (default). URL for remote/server deployments. Transport mode flag in payload.
2. **Payload validation:** `permanent + condition + decay + clean == total`. Warn, never block. In Phase 1, validation runs after QCer submits (grader only sends total).
3. **Decay semantics:** TBD — need MBG inspector confirmation. BerryCheck should handle both interpretations until calibrated.
4. **WebSocket disconnect:** Grader completes cycle, buffers payload to disk, retries via HTTP POST on reconnect. Never abort a scan for a software hiccup.

---

## From Claude Code

### Session 2026-03-29
- Integrated HSV camera tuner into BerryCheck as `app/camera_service.py`
- Camera connects to relay as `role=grader`, streams frames via WebSocket
- CameraTuner component inline on QC page — live feed, HSV sliders, USE COUNT button
- Fruit profiles: blueberry + red grape presets
- Stabilized counting (rolling mode over 15 frames, morphological cleanup)
- Electron desktop app built — BerryCheck.exe in `app/release/win-unpacked/`
- Restructured project into `app/` + `machine/` + root docs

### Session 2026-03-31 (planning — no code changes)
- Full review of all project docs + SCAD reference model
- Designed position-based tracking model with Jacob
- Planned progressive automation strategy (camera counts → ML suggests → auto grade)
- Resolved 3 of 4 integration spec open questions (decay TBD pending MBG)
- Identified stale docs: machine/docs/BLUEBERRY_GRADER_PROJECT.md describes old design
- Updated: INTEGRATION_SPEC.md, CLAUDE.md (app + machine), TODO.md, SCRATCH.md, memory files
- Jacob has 32 real berry photos for image analysis development

---

## From Claude Desktop

*(Desktop Claude: read the "Current State" and "Mechanical Design Decisions" sections
above. The INTEGRATION_SPEC.md has been significantly updated. The machine CLAUDE.md
and TODO.md have been rewritten to reflect the current mechanical design.)*

*(Note: machine/docs/BLUEBERRY_GRADER_PROJECT.md is STALE — it describes TT motors,
rubber band drive, V-groove brackets, 2 shafts. The actual build uses 2020 aluminum,
polybelt, dual sub-frame, 12 shafts. Needs a full rewrite when someone has time.)*

---

## Stale Files That Need Attention
- `machine/docs/BLUEBERRY_GRADER_PROJECT.md` — old mechanical design, wrong motors, wrong drive system, wrong brackets, wrong dimensions
- `machine/scad/*.scad` — may not match current printed parts (v11.6 rollers, v1 brackets in berrygrader_machine/current/)
- `machine/firmware/grader_esp32.ino` — references TT motor pin config, may need updating for JGB37-520 or whatever motors Jacob uses
- Current production designs live in `berrygrader_machine/current/` — NOT in `machine/scad/`
