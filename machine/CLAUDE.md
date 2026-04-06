# Blueberry Grader — Agent Handoff Notes

*Last updated: 2026-04-05*

**Before touching any code, run the Pre-Work Protocol in `../PROTOCOL.md`.**

---

## What This Project Is

A physical blueberry grading machine that images berries with multi-angle coverage
using diabolo-profiled rollers. Built for Jacob's packing shed as an affordable
alternative to $50k+ commercial graders. Integrates with **BerryCheck** (the QC app
at `../app/`).

**Target cost: $500–800 in parts**
**The machine produces counts. BerryCheck produces grades. Never grade on this side.**

## Project Structure

```
berrycheck/machine/
├── grader_service.py                  ← THE GRADER BRAIN — mock or real mode (Python/asyncio)
├── grader_capture.py                  ← Multi-camera capture (Python/OpenCV)
├── firmware/grader_esp32.ino          ← ESP32 motor control (Arduino C++)
├── scad/                              ← 3D print models (OpenSCAD) — may be outdated
│   ├── roller_shaft.scad
│   ├── roller_bracket.scad
│   ├── roller_shaft_coupler.scad
│   └── berry_test_tray.scad
├── buffer/                            ← Auto-created: buffered payloads when WebSocket is down
├── docs/BLUEBERRY_GRADER_PROJECT.md   ← Master spec — STALE, needs rewrite
├── TODO.md                            ← Task list
└── CLAUDE.md                          ← This file

Also relevant:
├── Desktop/berrygrader_machine/              ← Hardware design repo (SCAD, specs, session logs)
│   ├── current/grader_reference_v14.4.scad   ← Production reference model
│   ├── current/Clamshell Scale (In Progress) ← Scale hardware + firmware
│   └── current/Load Cell Assemblies/         ← Tray weighing system
├── Desktop/Blueberry 3D prints/              ← Printed parts (roller v11.6, brackets, couplers)
├── berrycheck/INTEGRATION_SPEC.md            ← Contract with BerryCheck app (READ THIS FIRST)
└── berrycheck/PROTOCOL.md                    ← Pre-work and debugging protocols (READ THIS TOO)
```

## Critical Context

- **Jacob doesn't code.** Claude agents write all code. Explain in plain terms.
- **Hardware build in progress.** 2020 aluminum being cut now. Rollers are printed (v10/v11). Software must be ready when hardware is assembled.
- **Offline-first.** No internet in the shed. Everything runs locally.
- **Read INTEGRATION_SPEC.md** at the project root. It defines the contract between this machine and BerryCheck. Every payload, command, and status message is specified there.

## Current Mechanical Design (as of 2026-03-31)

### Frame
- 2020 aluminum extrusion — main frame + camera frame above
- Legs 190mm (clears a Ropak lug at 178mm — machine can sit over a lug)
- Tray slides in/out on rails

### Rollers — Single Frame (Pivot Dump Prototype)
- All 12 rollers mounted to a single tray frame
- Tray slides in/out on drawer slides, pivots backward for unload
- See `berrygrader_machine/current/PIVOT_DUMP_PROTOTYPE.md` for full design
- Dual sub-frame (vertical unload) shelved for production — see `berrygrader_machine/archive/VERTICAL_UNLOAD_DESIGN.md`
- Rollers have diabolo profile — linear V-groove, 23mm peak dia, 17.7mm waist dia, 6mm core shaft
- Berry pitch: 23mm (saddle center to center)
- Shaft spacing: 25mm center-to-center (2mm clearance between 23mm peaks)
- Male/female joints at shaft ends for chaining segments
- Berry sits in the saddle between two adjacent rollers
- Spinning causes rotation axis wobble → multi-angle surface exposure

### Drive System
- 3mm diameter orange tubular polybelt (like packing equipment)
- Serpentines through the TOP half of roller drive wheels (drives all rollers when engaged)
- Runs STRAIGHT on the bottom half
- Motors mounted on one of the frames
- Custom printed pulleys on each shaft (Bambu A1 Mini) — dimensions TBD

### Active Problem: Roller-to-Frame Mounting
How the 6mm core shaft rollers mount to the 2020 frame with pulleys while supporting the dual sub-frame drop design. This is being figured out by Jacob + Desktop Claude with physical parts in hand. Pulley design follows once mounting is solved.

### Unload Mechanism — Pivot Dump (Prototype)
- Tray slides out from camera theater on drawer slides
- Pull locking pin, lift front handle — tray pivots backward at frame connection point
- Berries cascade over roller peaks into lug underneath (~15-20° tilt)
- Lower tray, re-pin, slide back in for next sample
- Future: vertical unload (dual sub-frame drop) for production throughput

### Cameras & Lighting
- 3-5 USB cameras mounted on 2020 camera frame above the tray
- At minimum: 1 overhead (counting + occupancy) + 2 angled (45° left/right for surface detail)
- White LED bars for visible spectrum
- Aspirational: NIR 850nm bars, UV 365nm bars (not guaranteed day one)
- Blackout curtain or enclosure for controlled lighting

### Grid Dimensions
- Constrained by: largest roller that fits inside a Ropak lug profile
- Ropak exterior: 599 × 399mm. Frame must fit inside.
- Reference model (v14.4 SCAD): 18 berries per row, 12 shafts = 11 berry rows = 198 positions
- Final grid size determined by physical build — software must be parametric

## Position-Based Tracking

This is the core software concept. See INTEGRATION_SPEC.md for full details.

- Track grid POSITIONS, not individual berries
- Overhead camera determines occupancy per position
- Angled cameras capture each position from their perspective
- Berry spinning gives near-full surface coverage per position
- Calibration: one-time mapping of grid positions to pixel coordinates per camera
- Counting = occupancy detection, not blob finding

## ESP32 & Electronics

- ESP32-WROOM-32 (38-pin)
- Motor control via driver board (PWM speed, direction)
- Start button (GPIO 34), Status LED (GPIO 2)
- Serial protocol: READY/START/CAPTURING/DONE
- Tray load cells: 4x 5kg bar cells via HX711 (on load cell frame, not in ESP32 yet)
- Future: servo control for automatic unload

### Clamshell Scale (separate device)
- Arduino Nano (or ESP32) on separate USB serial port
- 1x 1kg bar load cell via HX711
- Serial protocol: `W:xxx.x` output, `TARE`/`CALWEIGHT:xxx.x`/`GETCAL` commands
- See `berrygrader_machine/current/Clamshell Scale (In Progress)/` for hardware design
- See INTEGRATION_SPEC.md "Clamshell Scale Serial Protocol" for data contract

## Key Software to Build (Priority Order)

**Already built:**
- ✅ `grader_service.py` — standalone service, mock mode + production mode stubs, WebSocket client, command handling, status broadcasting, sample payload generation, local disk buffering on disconnect. Run with `python grader_service.py` (mock) or `python grader_service.py --real` (production).

**Still needed:**
1. **BerryCheck grader control panel UI** — SCAN, TARE, CALIBRATE, UNLOAD, DUMP buttons + progress bar (app side)
2. **Berry detection & counting** — position-based occupancy from overhead camera frames
3. **Grid calibration routine** — map pixel coords to grid positions per camera
4. **Multi-camera position mapping** — reconcile same position across cameras
5. **Image capture integration** — wire grader_capture.py into grader_service.py for real mode
6. **ESP32 serial integration** — wire firmware protocol into grader_service.py for real mode

See TODO.md for full breakdown.

## Rules

1. **Read INTEGRATION_SPEC.md** for the data contract. All payloads must match that spec.
2. The capture script's frame format is the input contract for analysis code.
3. Keep firmware and software cleanly separated — ESP32 does machine control, laptop does compute.
4. Test analysis code with sample images before assuming it works.
5. All analysis output must be compatible with BerryCheck's `gradeSample()` input format.
6. Grid dimensions must be configurable, not hardcoded — final size depends on physical build.
7. **Never block the QCer's workflow.** If something fails, degrade gracefully. The line doesn't stop.
8. Jacob has 32 real berry photos available for algorithm development.
