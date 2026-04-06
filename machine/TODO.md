# Blueberry Grader — TODO

*Updated: 2026-03-31*

## Phase 1: Software (No Hardware Needed)

### Mock Grader (Priority 1A — unblocks BerryCheck integration testing)
- [ ] Fake payload generator that matches INTEGRATION_SPEC.md format
- [ ] Connects to BerryCheck relay via WebSocket as role "grader"
- [ ] Sends realistic sample payloads (configurable count, weight, defect mix)
- [ ] Sends status messages during fake "scan cycle" (ready → scanning → counting → complete)
- [ ] Responds to commands (start_scan, abort, unload, dump, tare, calibrate)
- [ ] Button or script to fire a mock sample on demand

### Image Analysis Pipeline (Priority 1B — needs Jacob's 32 berry photos)
- [ ] **Berry detection** — find berries in a frame (HSV masking, contour detection)
- [ ] **Position-based counting** — map detections to grid positions (occupancy per saddle)
- [ ] **Size estimation** — pixel diameter, calibration strategy for mm conversion
- [ ] **Color classification** — HSV analysis for ripeness (green/turning/ripe/overripe)
- [ ] **Shriveling/circularity** — flag dehydrated berries by shape
- [ ] **Test harness** — load sample images, run analysis, output JSON matching spec
- [ ] **Grid calibration routine** — define grid positions from empty tray capture, map to pixel coords per camera

### BerryCheck Integration Layer (Priority 2)
- [ ] **WebSocket client** — connect to relay on port 5175 as role "grader"
- [ ] **Command listener** — receive start_scan, abort, unload, dump, tare, calibrate
- [ ] **Status broadcaster** — send grader_status messages during cycle for UI progress
- [ ] **Sample payload builder** — assemble JSON per INTEGRATION_SPEC.md
- [ ] **Local buffer** — save payloads to disk if WebSocket drops, retry via HTTP POST on reconnect
- [ ] **Output adapter** — convert analysis results into spec-compliant payload

### Firmware Enhancements (Priority 3)
- [ ] Speed tuning over serial (laptop sends target RPM)
- [ ] LED status patterns (idle/spinning/error/capturing)
- [ ] Error handling (motor stall detection, timeout recovery)
- [ ] Configurable timing (spin time/ramp time as serial commands)
- [ ] Unload servo control (when servo is wired)

## Phase 2: Hardware Integration (needs assembled machine)

- [ ] Camera mounting and alignment on 2020 frame
- [ ] Grid calibration with real roller geometry (empty tray capture → position mapping)
- [ ] Motor speed tuning (too fast = berries fly, too slow = incomplete rotation)
- [ ] Multi-camera position reconciliation (same grid, different angles)
- [ ] Test counting accuracy vs QCer manual count
- [ ] Polybelt tension and drive testing
- [ ] Unload mechanism testing (bottom frame drop, berry clearance, reset)
- [ ] Lighting setup (white LEDs, blackout, exposure tuning)

## Phase 3: Progressive Automation

- [ ] Training data pipeline (images + QCer defect counts from Phase 1 production)
- [ ] ML defect detection model (trained on accumulated labeled data)
- [ ] QCer confirmation flow (system suggests defects, human confirms/corrects)
- [ ] NIR camera integration (internal defects)
- [ ] UV camera integration (botrytis fluorescence)
- [ ] Raspberry Pi 5 migration
- [ ] Automatic unload via servo

## Integration Milestones

1. **Mock grader → BerryCheck** — fake payloads flow through, UI works end-to-end (no hardware)
2. **32 photos → analysis → count** — berry detection works on real images (no hardware)
3. **Real cameras → real count → BerryCheck** — hardware assembled, counting works live
4. **Full loop: load → scan → count → grade → unload** — production ready
5. **ML assists defect ID** — system starts suggesting, QCer confirms
