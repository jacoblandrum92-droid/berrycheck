# BerryCheck — TODO

## Waiting on Jacob (specs/data needed)
- [ ] Pack codes — all ~8 codes, which buyer uses which, tare weights for each
- [ ] Jumbo/flat pint grading specs — tolerance differences from standard pint
- [ ] Per-pack-code defect tolerance adjustments (if any differ from MBG standard)
- [ ] Berry size thresholds (e.g. 18mm for jumbo) — confirm exact specs
- [ ] Any buyer-specific grading requirements that differ from MBG

## Next to build
- [ ] Lot accumulation — average 3 official samples into pallet grade (separate from extras)
- [ ] DC feedback loop — log accept/reject per pallet, build tolerance model over time
- [ ] Pack code system — replace pint/jumbo toggle with full pack code selector + per-code tare weights and tolerances
- [ ] PDF/CSV export — per-lot report formatted for audit trail
- [ ] Grower history dashboard — season averages, trends, variety breakdown

## Future
- [ ] YOLO model training — swap blob counter for trained berry detector when enough A/B data collected
- [ ] UV botrytis mode — second capture under UV, separate botrytis count
- [ ] Predictive model — flag lots based on grower + variety + week patterns
- [ ] Network play — multi-house anonymous DC tolerance sharing
- [ ] Raspberry Pi deployment — fixed mount, touchscreen, production hardware
- [ ] Weco 360 sorter integration — pull sort report at time of QC sample (timestamped ~1 min before log entry). Goal: compare what's going into the cup vs what's being blown off, track lbs/hr throughput. Lets the owner remotely review shed efficiency — QC grade vs sorter reject rate vs line speed. Need to investigate Weco 360 data export format (API, CSV dump, network share, etc.)
