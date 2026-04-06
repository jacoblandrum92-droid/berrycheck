# Blueberry Grader — Master Project Document
*Last updated: March 2026*

---

## Vision

A modular, open-source blueberry grading machine capable of imaging 200 berries
simultaneously with full 360° surface coverage. Built for small family packing
operations as an affordable alternative to $50,000+ commercial graders.

**Target cost: $500–800 in parts**
**Commercial equivalent: $50,000+**
**Target build time: 1 week to functional prototype**

---

## System Architecture

```
Physical Machine
└── Roller frame (3D printed PLA/PETG)
    └── Diabolo roller shafts (PETG) x2
        └── 200 berry saddles (20 wide x 10 deep)
    └── TT gear motor x1
    └── Cross-belt drive (figure-8 rubber band)

Electronics
└── ESP32-WROOM-32 (38-pin devkit)
    └── L298N motor driver
    └── Start button
    └── Status LED (onboard GPIO 2)
    └── 12V wall power supply

Imaging
└── USB webcams (3 now, 5 mounts built in)
    └── Camera 1: overhead (counting + top color)
    └── Camera 2: 45° left (upper hemisphere defects)
    └── Camera 3: 45° right (upper hemisphere defects)
    └── Camera 4: low left [phase 2]
    └── Camera 5: low right [phase 2]
└── NIR camera [phase 3]

Compute
└── Laptop (now) → Raspberry Pi 5 (final form)
    └── Python capture script (grader_capture.py)
    └── OpenCV image processing
    └── Berry counting algorithm [to build]
    └── Grading algorithm [to build]
```

---

## Berry Specifications

| Parameter | Value |
|---|---|
| Target berry size | < 19mm (sub-jumbo) |
| Average size | 15–16mm |
| Berries per pint | ~155–175 |
| Machine capacity | 200 berries |
| Layout | 20 wide × 10 deep |
| Berry pitch | 22mm center-to-center |

---

## Machine Dimensions

| Parameter | Value |
|---|---|
| Active roller surface | 440mm × 220mm |
| Full frame footprint | ~520mm × 300mm |
| Frame height | ~450mm to camera overhead |
| Roller shaft length | 250mm (two 125mm halves + coupler) |
| Roller count | 2 shafts (one each side of V-groove) |

---

## Mechanical Design

### V-Groove Geometry
- V-groove included angle: 90° (45° each side)
- Roller diameter: 10mm (PETG shaft + silicone tubing at peaks)
- Berry sits ~4mm below rim of V
- Berry contacts each roller at ~30° off center

### Diabolo Roller Shaft Profile
The key innovation. Instead of straight cylinders, each shaft has a
repeating hourglass (diabolo) profile:

| Parameter | Value |
|---|---|
| Waist diameter | 8mm |
| Peak diameter | 16mm |
| Period (waist to waist) | 22mm (matches berry pitch) |
| Profile curve | Cosine wave (smooth S-curve) |
| End stub diameter | 6mm |
| End stub length | 15mm each end |
| Total shaft length | 250mm |
| Motor end | D-flat profile for coupler grip |

**Why diabolo:** Straight rollers spin berry around one fixed axis.
Diabolo profile causes berry rotation axis to wobble and drift,
giving full 360° surface exposure to cameras without needing
to reposition anything.

**Print note:** 250mm exceeds A1 Mini 180mm bed.
Print diagonally OR print as two 125mm halves joined by coupler.

### Drive System
- Motor: TT gear motor (1:48 ratio, 3-6V)
- Driver: L298N module
- Drive method: Cross-belt (figure-8 rubber band)
  - Motor drives Shaft A
  - Figure-8 belt reverses direction to Shaft B
  - Both shafts drive berry surface same direction
  - Berry spins in place

---

## Electronics

### ESP32 Pin Map (WROOM-32 38-pin)

| GPIO | Function |
|---|---|
| 25 | Motor A IN1 (direction) |
| 26 | Motor A IN2 (direction) |
| 27 | Motor A ENA (PWM speed) |
| 14 | Motor B IN3 (direction) |
| 12 | Motor B IN4 (direction) |
| 13 | Motor B ENB (PWM speed) |
| 34 | Start button (INPUT_PULLUP) |
| 2  | Status LED (onboard) |
| 32 | Reserved: camera trigger [future] |
| 33 | Reserved: LED ring [future] |
| 35 | Reserved: position sensor [future] |

### Wiring
```
12V supply → L298N 12V + GND
L298N 5V out → ESP32 VIN (powers ESP32 from same supply)
L298N GND → ESP32 GND (common ground)
L298N IN1/IN2/ENA → ESP32 GPIO 25/26/27
L298N IN3/IN4/ENB → ESP32 GPIO 14/12/13
Start button → GPIO 34 + GND
```

### Serial Protocol (ESP32 ↔ Laptop/Pi)
| Message | Direction | Meaning |
|---|---|---|
| `READY` | ESP32 → PC | Boot complete, waiting |
| `START` | PC → ESP32 | Trigger a cycle remotely |
| `CAPTURING` | ESP32 → PC | Motors running, begin capture |
| `DONE` | ESP32 → PC | Cycle complete, save frames |

### Motor Cycle Timing
| Parameter | Value |
|---|---|
| Ramp up | 500ms (gentle on berries) |
| Spin time | 6000ms |
| Ramp down | 500ms |
| Cooldown | 1000ms |
| Total cycle | ~8 seconds |

---

## Software

### Files
| File | Purpose |
|---|---|
| `grader_esp32.ino` | ESP32 motor control firmware |
| `grader_capture.py` | Laptop/Pi camera capture script |
| `roller_bracket.scad` | End bracket 3D print |
| `roller_shaft.scad` | Diabolo roller shaft 3D print |
| `roller_shaft_coupler.scad` | Shaft joining coupler |
| `berry_test_tray.scad` | Cone size test tray |

### Python Dependencies
```
pip install opencv-python pyserial
```

### Capture Script Features (current)
- Auto-detects ESP32 serial port
- Multi-camera support (configure CAMERA_IDS list)
- Continuous capture during spin window
- Auto-saves frames organized by sample number and timestamp
- Live preview window with recording status
- Manual trigger mode (Enter key) when no ESP32 connected

### Grading Algorithm (to build - phase 2)
- [ ] Berry counting (contour detection per dimple)
- [ ] Size measurement (pixel diameter with known camera height)
- [ ] Color grading (HSV analysis - ripeness)
- [ ] Defect detection (YOLO model trained on blueberry images)
- [ ] Shriveling detection (circularity measurement)
- [ ] NIR internal defect detection (phase 3)

---

## Parts List

### Order Now
| Item | Spec | Source | Est. Cost |
|---|---|---|---|
| TT gear motor | 3-6V, 1:48 ratio, 10-pack | Amazon | $12 |
| L298N driver | standard module | Amazon | $7 |
| Silicone tubing | 10mm ID, 12mm OD | Amazon | $10 |
| M3 heat set inserts | 4mm OD, 100-pack | Amazon | $8 |
| M3 bolts | 8mm + 16mm assorted | Amazon | $8 |
| 12V power supply | 2A minimum | Amazon | $12 |
| USB webcam x3 | 1080p wide angle | Amazon | $30 each |
| Jumper wires | assorted M-M M-F F-F | Amazon | $6 |
| Breadboard | full size | Amazon | $5 |
| Rubber bands | wide, strong | Hardware | $2 |
| **Total** | | | **~$160** |

### Already Have
- ESP32-WROOM-32 38-pin devkit
- Bambu A1 Mini printer
- PLA filament
- PETG filament (preferred for rollers)
- Laptop for compute

### Phase 2 Additions
| Item | Est. Cost |
|---|---|
| 2x additional USB webcams | $60 |
| Raspberry Pi 5 (4GB) | $60 |
| Pi camera mount hardware | $15 |

### Phase 3 Additions
| Item | Est. Cost |
|---|---|
| NIR camera module | $60–80 |
| LED illumination ring | $20 |
| Jetson Nano (if needed for inference speed) | $150 |

---

## 3D Print Queue

Print in this order:

| # | File | Material | Est. Time | Purpose |
|---|---|---|---|---|
| 1 | berry_test_tray.scad | PLA | 1h 46m | Test cone sizes on real berries |
| 2 | roller_bracket.scad | PLA | ~2h | Test fit before printing all 40 |
| 3 | roller_shaft_coupler.scad | PETG | ~1h | Test coupler fit |
| 4 | roller_shaft.scad (half) | PETG | ~4h | Test diabolo profile |
| 5 | Full shaft set (x4 halves) | PETG | ~16h | Production rollers |
| 6 | Bracket set (x40) | PLA | ~20h | Full frame |
| 7 | Camera uprights | PLA | ~3h | Camera mounts |
| 8 | Base plate tiles | PLA | ~4h | Frame base |

---

## Build Schedule (1 Week)

| Day | Task |
|---|---|
| 1 | Print test tray. Order all parts. |
| 2 | Test tray with real berries - pick optimal cone size. Print roller bracket test pair. Write shaft coupler. |
| 3 | Parts arrive. Test fit bracket + silicone tubing. Print roller shaft half. Wire ESP32 + L298N on breadboard. |
| 4 | Full shaft test print. Upload ESP32 firmware. Test motor spin. Run capture script on laptop. |
| 5 | Print full bracket set (runs overnight). Assemble first roller module. Load berries. Verify spin and tumble. |
| 6 | Mount cameras. Tune motor speed. Capture first real sample. Verify 360° coverage. |
| 7 | Buffer. Fix whatever went wrong. First real grading run. |

---

## Future Roadmap

### Near Term
- [ ] Finish mechanical build
- [ ] Berry counting algorithm
- [ ] Size grading (pixel measurement)
- [ ] Color/ripeness grading

### Medium Term
- [ ] YOLO defect detection model
- [ ] Training dataset collection (using packing shed access)
- [ ] Pi 5 migration
- [ ] Full 5-camera rig
- [ ] Web dashboard for results

### Long Term
- [ ] NIR integration
- [ ] Automatic berry ejection by grade
- [ ] Integration with packing shed software
- [ ] Commercial version for small operations
- [ ] Open source release + documentation

---

## Key Decisions Log

| Decision | Reasoning |
|---|---|
| Diabolo roller profile | Straight rollers only spin one axis. Diabolo causes wobble = full 360° coverage |
| 200 berry capacity | Beats commercial 150-berry units. Full pint sample in one pass |
| 22mm pitch | Fits 15-16mm berries with clearance. Matches berry_count × pitch to bed geometry |
| Split shaft design | 250mm shaft exceeds A1 Mini 180mm bed. Two 125mm halves + coupler |
| Continuous capture | Simpler than trigger-based. No position sensor needed. Guaranteed coverage |
| ESP32 + laptop split | ESP32 handles machine control forever. Laptop/Pi handles compute. Clean separation |
| PLA frame / PETG rollers | PLA fine for structure. PETG food-safe, slightly flexible = better berry contact |
| TT gear motor | Cheap, simple, two wires, widely available, kid-friendly to work with |
| L298N driver | Classic beginner board. Handles two motors. PWM speed control. $3 |
