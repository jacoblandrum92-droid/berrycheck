"""
BerryCheck Grader Service
=========================
The grader's brain. Runs as a standalone service that:
- Connects to BerryCheck relay via WebSocket (role=grader)
- Receives commands (start_scan, abort, tare, calibrate, unload, dump)
- Runs scan cycles (mock or real hardware)
- Sends status updates and sample payloads back to BerryCheck

Mock mode: simulates scan cycles with configurable fake data. No hardware needed.
Production mode: talks to ESP32 + cameras. Same API, real data.

Usage:
    python grader_service.py              # mock mode (default)
    python grader_service.py --real       # production mode (needs hardware)
    python grader_service.py --port 5175  # custom relay port

The service is the single source of truth for the grader state machine.
BerryCheck is a client. A future touchscreen would be another client.
"""

import asyncio
import json
import time
import random
import argparse
import os
import sys
from datetime import datetime

try:
    import websockets
except ImportError:
    print("Missing dependency: websockets")
    print("Install with: pip install websockets")
    sys.exit(1)

# ============================================================
# Configuration
# ============================================================

RELAY_HOST = "localhost"
RELAY_PORT = 5175
RECONNECT_DELAY = 3  # seconds between reconnect attempts

# Mock mode scan timing (seconds) — matches real ESP32 cycle feel
MOCK_WEIGH_TIME = 1.0
MOCK_SPIN_TIME = 6.0
MOCK_COUNT_TIME = 1.5

# Grid dimensions — parametric, set from physical build (v14.4 reference)
GRID_COLS = 18   # berries per row (18 saddles = 3 segments × 6)
GRID_ROWS = 11   # berry rows (12 shafts - 1)

# Sample generation defaults
DEFAULT_TOTAL_RANGE = (150, 198)  # realistic berry count range (18×11 max)
DEFAULT_WEIGHT_RANGE = (330.0, 460.0)  # sample weight in grams
DEFAULT_DEFECT_RATE = 0.05  # 5% defect rate for mock data

# Buffer directory for payloads when WebSocket is down
BUFFER_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "buffer")

# ============================================================
# State Machine
# ============================================================

class GraderState:
    IDLE = "ready"
    WEIGHING = "weighing"
    SCANNING = "scanning"
    COUNTING = "counting"
    COMPLETE = "complete"
    UNLOADING = "unloading"
    ABORTING = "aborting"


class GraderService:
    def __init__(self, mock=True, relay_host=RELAY_HOST, relay_port=RELAY_PORT):
        self.mock = mock
        self.relay_url = f"ws://{relay_host}:{relay_port}/?role=grader"
        self.ws = None
        self.state = GraderState.IDLE
        self.running = True
        self.scan_task = None
        self.sample_count = 0
        self.tare_weight = 0.0
        self.last_weight = 0.0

        # Ensure buffer directory exists
        os.makedirs(BUFFER_DIR, exist_ok=True)

    # --------------------------------------------------------
    # WebSocket connection management
    # --------------------------------------------------------

    async def connect(self):
        """Connect to BerryCheck relay with auto-reconnect."""
        while self.running:
            try:
                mode_str = "MOCK" if self.mock else "PRODUCTION"
                print(f"[grader] Connecting to {self.relay_url} ({mode_str} mode)...")
                async with websockets.connect(self.relay_url) as ws:
                    self.ws = ws
                    print(f"[grader] Connected to BerryCheck relay")
                    await self.send_status(GraderState.IDLE)

                    # Flush any buffered payloads from previous disconnects
                    await self.flush_buffer()

                    async for message in ws:
                        await self.handle_message(message)

            except (websockets.ConnectionClosed, ConnectionRefusedError, OSError) as e:
                self.ws = None
                print(f"[grader] Connection lost: {e}. Retrying in {RECONNECT_DELAY}s...")
                await asyncio.sleep(RECONNECT_DELAY)

    async def send(self, msg):
        """Send a message to the relay. Buffer if disconnected."""
        payload = json.dumps(msg)
        if self.ws:
            try:
                await self.ws.send(payload)
                return True
            except websockets.ConnectionClosed:
                self.ws = None

        # Buffer sample payloads — these are sacred data
        if msg.get("type") == "sample":
            self.buffer_payload(msg)
            print(f"[grader] WebSocket down — sample buffered to disk")

        return False

    async def send_status(self, status, **extra):
        """Send a grader_status message."""
        self.state = status
        msg = {"type": "grader_status", "status": status, **extra}
        await self.send(msg)
        print(f"[grader] Status: {status}" + (f" {extra}" if extra else ""))

    # --------------------------------------------------------
    # Payload buffering (for WebSocket disconnects)
    # --------------------------------------------------------

    def buffer_payload(self, msg):
        """Save a payload to disk for later delivery."""
        ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        path = os.path.join(BUFFER_DIR, f"sample_{ts}.json")
        with open(path, "w") as f:
            json.dump(msg, f)

    async def flush_buffer(self):
        """Send any buffered payloads from previous disconnects."""
        if not os.path.exists(BUFFER_DIR):
            return

        files = sorted(f for f in os.listdir(BUFFER_DIR) if f.endswith(".json"))
        if not files:
            return

        print(f"[grader] Flushing {len(files)} buffered payload(s)...")
        for fname in files:
            path = os.path.join(BUFFER_DIR, fname)
            try:
                with open(path, "r") as f:
                    msg = json.load(f)
                if self.ws:
                    await self.ws.send(json.dumps(msg))
                    os.remove(path)
                    print(f"[grader] Flushed: {fname}")
            except Exception as e:
                print(f"[grader] Failed to flush {fname}: {e}")

    # --------------------------------------------------------
    # Command handling
    # --------------------------------------------------------

    async def handle_message(self, raw):
        """Handle incoming messages from BerryCheck via relay."""
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            return

        if msg.get("type") != "command":
            return

        action = msg.get("action")
        print(f"[grader] Command received: {action}")

        if action == "start_scan":
            await self.start_scan(msg.get("config", {}))
        elif action == "abort":
            await self.abort()
        elif action == "tare":
            await self.tare()
        elif action == "calibrate":
            await self.calibrate()
        elif action == "unload":
            await self.unload()
        elif action == "dump":
            if msg.get("confirm"):
                await self.dump()
            else:
                print("[grader] Dump rejected — missing confirm flag")
        elif action == "set_speed":
            rpm = msg.get("rpm", 30)
            print(f"[grader] Speed set to {rpm} RPM (mock — no effect)")
        else:
            print(f"[grader] Unknown command: {action}")

    # --------------------------------------------------------
    # Scan cycle
    # --------------------------------------------------------

    async def start_scan(self, config=None):
        """Start a scan cycle."""
        if self.state != GraderState.IDLE:
            print(f"[grader] Cannot scan — currently {self.state}")
            return

        # Cancel any lingering task
        if self.scan_task and not self.scan_task.done():
            self.scan_task.cancel()

        self.scan_task = asyncio.create_task(self._run_scan(config or {}))

    async def _run_scan(self, config):
        """Execute the full scan cycle."""
        try:
            spectrums = config.get("spectrums", ["visible"])

            # --- Weigh ---
            weight = self._mock_weight() if self.mock else self._real_weight()
            await self.send_status(GraderState.WEIGHING, weight_g=round(weight, 1))
            await asyncio.sleep(MOCK_WEIGH_TIME if self.mock else 0.5)

            # --- Scan each spectrum ---
            total_passes = len(spectrums)
            for i, spectrum in enumerate(spectrums):
                progress = (i + 1) / total_passes
                await self.send_status(
                    GraderState.SCANNING,
                    pass_name=spectrum,
                    progress=round(progress, 2)
                )

                if self.mock:
                    # Simulate the ~6 second spin with progress updates
                    steps = 10
                    for step in range(steps):
                        await asyncio.sleep(MOCK_SPIN_TIME / total_passes / steps)
                        sub_progress = (i + (step + 1) / steps) / total_passes
                        await self.send_status(
                            GraderState.SCANNING,
                            pass_name=spectrum,
                            progress=round(sub_progress, 2)
                        )
                else:
                    # Real mode: trigger ESP32, wait for DONE
                    await self._real_scan_pass(spectrum)

            # --- Count ---
            await self.send_status(GraderState.COUNTING)
            if self.mock:
                await asyncio.sleep(MOCK_COUNT_TIME)
                sample = self._generate_mock_sample(weight, spectrums)
            else:
                sample = await self._real_count()

            # --- Complete ---
            await self.send_status(GraderState.COMPLETE)
            self.sample_count += 1

            # Send sample payload
            await self.send({"type": "sample", "data": sample})
            print(f"[grader] Sample #{self.sample_count} sent — {sample['counts']['total']} berries, {sample['weight']['sample_g']}g")

        except asyncio.CancelledError:
            print("[grader] Scan aborted")
            await self.send_status(GraderState.IDLE)

    # --------------------------------------------------------
    # Other commands
    # --------------------------------------------------------

    async def abort(self):
        """Abort current scan cycle."""
        if self.scan_task and not self.scan_task.done():
            self.scan_task.cancel()
            print("[grader] Aborting scan...")
        await self.send_status(GraderState.IDLE)

    async def tare(self):
        """Zero the scale."""
        if self.mock:
            self.tare_weight = random.uniform(840.0, 860.0)
            print(f"[grader] Tare set to {self.tare_weight:.1f}g (mock)")
        else:
            # Real: read load cell, store as tare
            pass
        await self.send_status(GraderState.IDLE, tare_g=round(self.tare_weight, 1))

    async def calibrate(self):
        """Run empty tray calibration capture."""
        print("[grader] Calibrating (empty tray capture)...")
        await self.send_status("calibrating")

        if self.mock:
            await asyncio.sleep(2.0)
            print("[grader] Calibration complete (mock — no cameras)")
        else:
            # Real: capture empty tray from all cameras, build grid position map
            pass

        await self.send_status(GraderState.IDLE)

    async def unload(self):
        """Trigger berry unload after sample is saved."""
        await self.send_status(GraderState.UNLOADING)

        if self.mock:
            await asyncio.sleep(1.0)
            print("[grader] Unload complete (mock)")
        else:
            # Real: trigger servo or signal manual release
            pass

        await self.send_status(GraderState.IDLE)

    async def dump(self):
        """Emergency unload — clear berries immediately."""
        print("[grader] DUMP — emergency unload")

        # Abort any running scan first
        if self.scan_task and not self.scan_task.done():
            self.scan_task.cancel()

        await self.send_status(GraderState.UNLOADING)

        if self.mock:
            await asyncio.sleep(0.5)
        else:
            # Real: trigger servo immediately
            pass

        await self.send_status(GraderState.IDLE)
        print("[grader] Dump complete — tray clear")

    # --------------------------------------------------------
    # Mock data generation
    # --------------------------------------------------------

    def _mock_weight(self):
        """Generate a realistic sample weight."""
        return random.uniform(*DEFAULT_WEIGHT_RANGE)

    def _generate_mock_sample(self, weight, spectrums):
        """Build a complete sample payload with realistic fake data."""
        total = random.randint(*DEFAULT_TOTAL_RANGE)
        defect_count = max(0, int(total * random.uniform(0.01, 0.10)))
        clean = total - defect_count

        # Split defects into categories
        permanent = random.randint(0, defect_count)
        remaining = defect_count - permanent
        condition = random.randint(0, remaining)
        decay = remaining - condition

        # Detail breakdowns
        permanent_detail = self._split_defects(permanent, ["stems", "scars", "insect", "broken_skin", "mummified"])
        condition_detail = self._split_defects(condition, ["soft", "leaky", "shriveled", "overripe"])
        decay_detail = self._split_defects(decay, ["mold", "rot"])

        # Grid occupancy
        occupancy = self._generate_occupancy(total)

        avg_berry_g = round(weight / total, 2) if total > 0 else 0

        return {
            "source": "grader",
            "version": "1.0",
            "timestamp": datetime.now().isoformat() + "Z",
            "sample_method": "fullcount",
            "mock": True,

            "counts": {
                "total": total,
                "clean": clean,
                "permanent": permanent,
                "condition": condition,
                "decay": decay,
                "permanent_detail": permanent_detail,
                "condition_detail": condition_detail,
                "decay_detail": decay_detail,
            },

            "weight": {
                "sample_g": round(weight, 1),
                "tare_g": round(self.tare_weight, 1),
                "avg_berry_g": avg_berry_g,
            },

            "grid": {
                "cols": GRID_COLS,
                "rows": GRID_ROWS,
                "occupancy": occupancy,
            },

            "imaging": {
                "spectrums_captured": spectrums,
                "cameras_used": 3,
                "uv_flag": False,
                "nir_captured": False,
            },

            "images": {
                "transport": "none",
                "visible_top": None,
                "visible_angle_l": None,
                "visible_angle_r": None,
                "nir_top": None,
                "uv_top": None,
            },
        }

    def _split_defects(self, count, categories):
        """Randomly distribute a defect count across categories."""
        result = {cat: 0 for cat in categories}
        for _ in range(count):
            cat = random.choice(categories)
            result[cat] += 1
        return result

    def _generate_occupancy(self, total):
        """Generate a grid occupancy map with the given number of berries."""
        positions = GRID_COLS * GRID_ROWS
        # Fill grid randomly up to total
        flat = [1] * min(total, positions) + [0] * max(0, positions - total)
        random.shuffle(flat)
        # Reshape into rows
        return [flat[r * GRID_COLS:(r + 1) * GRID_COLS] for r in range(GRID_ROWS)]

    # --------------------------------------------------------
    # Real hardware stubs (filled in when hardware exists)
    # --------------------------------------------------------

    def _real_weight(self):
        """Read weight from HX711 load cell via ESP32 serial."""
        # TODO: serial read from ESP32
        return 0.0

    async def _real_scan_pass(self, spectrum):
        """Run a real camera capture pass for the given spectrum."""
        # TODO: trigger ESP32, capture frames, wait for DONE
        pass

    async def _real_count(self):
        """Run real image analysis on captured frames."""
        # TODO: position-based occupancy detection
        return self._generate_mock_sample(0.0, ["visible"])


# ============================================================
# Entry point
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="BerryCheck Grader Service")
    parser.add_argument("--real", action="store_true", help="Production mode (requires hardware)")
    parser.add_argument("--host", default=RELAY_HOST, help=f"Relay host (default: {RELAY_HOST})")
    parser.add_argument("--port", type=int, default=RELAY_PORT, help=f"Relay port (default: {RELAY_PORT})")
    args = parser.parse_args()

    mock = not args.real
    service = GraderService(mock=mock, relay_host=args.host, relay_port=args.port)

    mode_str = "MOCK" if mock else "PRODUCTION"
    print(f"")
    print(f"  BerryCheck Grader Service")
    print(f"  Mode: {mode_str}")
    print(f"  Relay: ws://{args.host}:{args.port}")
    print(f"  Grid: {GRID_COLS}×{GRID_ROWS} ({GRID_COLS * GRID_ROWS} positions)")
    print(f"")

    try:
        asyncio.run(service.connect())
    except KeyboardInterrupt:
        print("\n[grader] Shutting down")
        service.running = False


if __name__ == "__main__":
    main()
