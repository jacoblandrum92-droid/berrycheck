"""
BerryCheck Camera Service
=========================
Connects to berrycheck relay as role=grader.
Streams camera frames with HSV-based berry detection.
Receives tuning commands from the browser UI.

Usage: python camera_service.py
Requires: pip install opencv-python numpy websocket-client
"""

import cv2
import numpy as np
import json
import os
import sys
import time
import base64
import threading
from datetime import datetime

try:
    import websocket
except ImportError:
    print("Missing websocket-client. Install with: pip install websocket-client")
    sys.exit(1)

# =============================================================
# CONFIGURATION
# =============================================================
CAMERA_INDEX = 1           # 0 = built-in, 1 = USB webcam
RELAY_URL = "ws://localhost:5175?role=grader"
HSV_FILE = "berry_hsv_values.json"
SNAPSHOT_DIR = "snapshots"
FRAME_INTERVAL = 0.1       # seconds between frames sent (10 fps)
JPEG_QUALITY = 70          # lower = smaller frames, faster streaming

# =============================================================
# HSV PROFILES — presets for different fruit
# =============================================================
PROFILES = {
    "blueberry": {
        "label": "Blueberry",
        "hsv": {"h_low": 90, "h_high": 145, "s_low": 30, "s_high": 255, "v_low": 30, "v_high": 200},
        "min_area": 300,
        "max_area": 50000,
    },
    "red_grape": {
        "label": "Red Grape",
        "hsv": {"h_low": 0, "h_high": 15, "s_low": 50, "s_high": 255, "v_low": 30, "v_high": 200},
        "min_area": 500,
        "max_area": 80000,
    },
    "red_grape_upper": {
        "label": "Red Grape (purple)",
        "hsv": {"h_low": 155, "h_high": 179, "s_low": 40, "s_high": 255, "v_low": 20, "v_high": 200},
        "min_area": 500,
        "max_area": 80000,
    },
}

DEFAULTS = PROFILES["blueberry"]["hsv"].copy()

# Detection parameters
MIN_BERRY_AREA = 300
MAX_BERRY_AREA = 50000
USE_BLUR = True


class CameraService:
    def __init__(self):
        self.hsv = self.load_hsv()
        self.profile = "blueberry"
        self.use_blur = USE_BLUR
        self.min_area = MIN_BERRY_AREA
        self.max_area = MAX_BERRY_AREA
        self.running = False
        self.ws = None
        self._ws_connected = False
        self.cap = None
        self.streaming = True  # can be paused from browser

    def load_hsv(self):
        if os.path.exists(HSV_FILE):
            try:
                with open(HSV_FILE, "r") as f:
                    vals = json.load(f)
                    print(f"[hsv] Loaded from {HSV_FILE}")
                    return vals
            except Exception:
                pass
        print("[hsv] Using defaults")
        return DEFAULTS.copy()

    def save_hsv(self):
        with open(HSV_FILE, "w") as f:
            json.dump(self.hsv, f, indent=2)
        print(f"[hsv] Saved to {HSV_FILE}")

    def process_frame(self, frame):
        """Apply HSV mask, find berries, return annotated frame + detection data."""
        hsv_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

        lower = np.array([self.hsv["h_low"], self.hsv["s_low"], self.hsv["v_low"]])
        upper = np.array([self.hsv["h_high"], self.hsv["s_high"], self.hsv["v_high"]])
        mask = cv2.inRange(hsv_frame, lower, upper)

        # Clean up mask
        if self.use_blur:
            blurred = cv2.GaussianBlur(mask, (7, 7), 0)
            _, mask = cv2.threshold(blurred, 127, 255, cv2.THRESH_BINARY)

        # Morphological ops — close small gaps, remove speckle noise
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)  # fill small holes
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)   # remove small specks

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        berries = []
        berry_count = 0
        for contour in contours:
            area = cv2.contourArea(contour)
            if self.min_area < area < self.max_area:
                berry_count += 1
                (x, y), radius = cv2.minEnclosingCircle(contour)
                cx, cy, r = int(x), int(y), int(radius)
                berries.append({"x": cx, "y": cy, "r": r, "area": int(area)})
                # Draw on frame
                cv2.circle(frame, (cx, cy), r, (0, 255, 0), 2)
                cv2.putText(frame, str(berry_count),
                            (cx - 8, cy - r - 5),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

        # Overlay info
        cv2.putText(frame, f"Berries: {berry_count}", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)

        # Filtered result — only berry-colored pixels from original
        filtered = cv2.bitwise_and(frame, frame, mask=mask)

        return frame, mask, filtered, berry_count, berries

    def frame_to_jpeg_base64(self, frame):
        """Encode frame as JPEG base64 for WebSocket transport."""
        _, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
        return base64.b64encode(buf).decode('utf-8')

    def mask_to_png_base64(self, mask):
        """Encode mask as small PNG base64."""
        # Resize mask to half for bandwidth
        h, w = mask.shape
        small = cv2.resize(mask, (w // 2, h // 2))
        _, buf = cv2.imencode('.png', small)
        return base64.b64encode(buf).decode('utf-8')

    def handle_command(self, msg):
        """Handle commands from the browser UI."""
        action = msg.get("action")

        if action == "update_hsv":
            for key in ["h_low", "h_high", "s_low", "s_high", "v_low", "v_high"]:
                if key in msg:
                    self.hsv[key] = msg[key]

        elif action == "save_hsv":
            self.save_hsv()

        elif action == "reset_hsv":
            self.hsv = DEFAULTS.copy()

        elif action == "set_blur":
            self.use_blur = msg.get("enabled", True)

        elif action == "set_area":
            if "min" in msg:
                self.min_area = msg["min"]
            if "max" in msg:
                self.max_area = msg["max"]

        elif action == "snapshot":
            self._take_snapshot = True

        elif action == "pause":
            self.streaming = False

        elif action == "resume":
            self.streaming = True

        elif action == "set_profile":
            name = msg.get("name", "blueberry")
            if name in PROFILES:
                p = PROFILES[name]
                self.hsv = p["hsv"].copy()
                self.min_area = p["min_area"]
                self.max_area = p["max_area"]
                self.profile = name
                print(f"[profile] Switched to {p['label']}")

        elif action == "set_camera":
            idx = msg.get("index", CAMERA_INDEX)
            self._switch_camera(idx)

    def _switch_camera(self, idx):
        """Switch to a different camera index."""
        if self.cap:
            self.cap.release()
        self.cap = cv2.VideoCapture(idx)
        if self.cap.isOpened():
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1920)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 1080)
            print(f"[camera] Switched to index {idx}")
        else:
            print(f"[camera] Failed to open index {idx}")

    def send_msg(self, msg):
        """Send JSON message to relay."""
        if self.ws and self._ws_connected:
            try:
                self.ws.send(json.dumps(msg))
            except Exception as e:
                print(f"[ws] Send error: {e}")

    def on_ws_message(self, ws, raw):
        try:
            msg = JSON_parse(raw)
            if msg.get("type") == "command":
                self.handle_command(msg)
        except Exception as e:
            print(f"[ws] Message error: {e}")

    def on_ws_open(self, ws):
        self._ws_connected = True
        print("[ws] Connected to relay")
        self.send_msg({
            "type": "grader_status",
            "status": "ready",
            "hsv": self.hsv,
            "blur": self.use_blur,
            "min_area": self.min_area,
            "max_area": self.max_area,
            "profile": self.profile,
            "profiles": {k: v["label"] for k, v in PROFILES.items()},
        })

    def on_ws_close(self, ws, code, reason):
        self._ws_connected = False
        print(f"[ws] Disconnected ({code})")

    def on_ws_error(self, ws, error):
        print(f"[ws] Error: {error}")

    def run(self):
        # Open camera
        print(f"\n=== BerryCheck Camera Service ===")
        print(f"Camera index: {CAMERA_INDEX}")
        print(f"Relay: {RELAY_URL}")

        self.cap = cv2.VideoCapture(CAMERA_INDEX)
        if not self.cap.isOpened():
            print(f"\n[ERROR] Could not open camera {CAMERA_INDEX}")
            print("Try changing CAMERA_INDEX at the top of this file")
            return

        # Try to set 1080p — if camera doesn't support it, it uses its default
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1920)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 1080)

        # Verify camera can actually grab a frame
        ret, test_frame = self.cap.read()
        if not ret:
            print(f"[WARN] Camera {CAMERA_INDEX} opened but can't grab frames at 1920x1080, trying default resolution...")
            self.cap.release()
            self.cap = cv2.VideoCapture(CAMERA_INDEX)
            if not self.cap.isOpened():
                print(f"[ERROR] Could not reopen camera {CAMERA_INDEX}")
                return
            ret, test_frame = self.cap.read()
            if not ret:
                print(f"[ERROR] Camera {CAMERA_INDEX} cannot grab frames")
                return

        w = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        print(f"Camera resolution: {w}x{h}")

        self.running = True
        self._count_history = []
        self._stable_count = 0

        # Connect to relay in a background thread
        self.ws = websocket.WebSocketApp(
            RELAY_URL,
            on_open=self.on_ws_open,
            on_message=self.on_ws_message,
            on_close=self.on_ws_close,
            on_error=self.on_ws_error,
        )
        ws_thread = threading.Thread(target=self._ws_run_forever, daemon=True)
        ws_thread.start()
        self._take_snapshot = False
        last_send = 0

        print("[camera] Streaming... Press Ctrl+C to stop\n")

        try:
            while self.running:
                ret, frame = self.cap.read()
                if not ret:
                    print("[camera] Frame grab failed")
                    time.sleep(0.5)
                    continue

                # Always process (for local display if needed)
                annotated, mask, filtered, count, berries = self.process_frame(frame.copy())

                # Stabilize count — only update when consistent over multiple frames
                self._count_history.append(count)
                if len(self._count_history) > 15:
                    self._count_history.pop(0)
                # Use the most common count in the last 15 frames
                if len(self._count_history) >= 5:
                    from collections import Counter
                    most_common = Counter(self._count_history).most_common(1)[0]
                    # Only adopt if it appears in at least 40% of recent frames
                    if most_common[1] >= len(self._count_history) * 0.4:
                        self._stable_count = most_common[0]
                stable_count = self._stable_count

                # Snapshot requested
                if self._take_snapshot:
                    self._take_snapshot = False
                    os.makedirs(SNAPSHOT_DIR, exist_ok=True)
                    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
                    cv2.imwrite(f"{SNAPSHOT_DIR}/{ts}_original.jpg", frame)
                    cv2.imwrite(f"{SNAPSHOT_DIR}/{ts}_annotated.jpg", annotated)
                    cv2.imwrite(f"{SNAPSHOT_DIR}/{ts}_mask.png", mask)
                    cv2.imwrite(f"{SNAPSHOT_DIR}/{ts}_filtered.jpg", filtered)
                    print(f"[snapshot] Saved {ts}")

                # Rate-limit WebSocket sends
                now = time.time()
                if self.streaming and (now - last_send) >= FRAME_INTERVAL:
                    last_send = now
                    self.send_msg({
                        "type": "grader_frame",
                        "frame": self.frame_to_jpeg_base64(annotated),
                        "mask": self.mask_to_png_base64(mask),
                        "filtered": self.frame_to_jpeg_base64(filtered),
                        "count": stable_count,
                        "raw_count": count,
                        "berries": berries,
                        "hsv": self.hsv,
                        "blur": self.use_blur,
                        "profile": self.profile,
                        "timestamp": datetime.now().isoformat(),
                    })

                # Small sleep to not peg CPU
                time.sleep(0.01)

        except KeyboardInterrupt:
            print("\n[camera] Stopping...")

        finally:
            self.running = False
            self.save_hsv()
            if self.cap:
                self.cap.release()
            if self.ws:
                self.ws.close()
            print("[camera] Done")

    def _ws_run_forever(self):
        """Run WebSocket with auto-reconnect."""
        while self.running:
            try:
                self.ws.run_forever(ping_interval=10, ping_timeout=5)
            except Exception as e:
                print(f"[ws] Connection error: {e}")
            if self.running:
                print("[ws] Reconnecting in 3s...")
                time.sleep(3)
                self.ws = websocket.WebSocketApp(
                    RELAY_URL,
                    on_open=self.on_ws_open,
                    on_message=self.on_ws_message,
                    on_close=self.on_ws_close,
                    on_error=self.on_ws_error,
                )


def JSON_parse(raw):
    """Parse JSON string."""
    return json.loads(raw)


if __name__ == "__main__":
    service = CameraService()
    service.run()
