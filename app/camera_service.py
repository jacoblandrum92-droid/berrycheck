"""
BerryCheck Camera Service
=========================
Connects to berrycheck relay as role=grader.
Streams camera frames with berry detection (YOLO if model exists, HSV fallback).
Receives tuning commands from the browser UI.

Usage: python camera_service.py
Requires: pip install opencv-python numpy websocket-client
Optional: pip install ultralytics  (for YOLO mode)
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
CAMERA_INDEX = 1           # 0 = phantom device, 1 = USB camera
RELAY_URL = "ws://localhost:5175?role=grader"
HSV_FILE = "berry_hsv_values.json"
CROP_FILE = "berry_crop_values.json"
YOLO_MODEL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ml", "berry_model.pt")
SNAPSHOT_DIR = "snapshots"
FRAME_INTERVAL = 0.1       # seconds between frames sent (10 fps)
JPEG_QUALITY = 70          # lower = smaller frames, faster streaming
# ROI crop — fraction to trim from each edge (ignores stuff outside the tray)
CROP_LEFT = 0.06
CROP_RIGHT = 0.02
CROP_TOP = 0.0
CROP_BOTTOM = 0.04

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
MIN_BERRY_AREA = 200       # lowered from 300 — catches partial/occluded berries
MAX_BERRY_AREA = 50000
MIN_CIRCULARITY = 0.35     # 1.0 = perfect circle, 0.35 = allows ovals, rejects bars
PEAK_NEIGHBORHOOD = 19     # px — local-max kernel for splitting merged berry blobs
MIN_DIST_PEAK = 4          # min distance-transform value to count as a berry center
USE_BLUR = True


class CameraService:
    def __init__(self):
        self.hsv = self.load_hsv()
        self.profile = "blueberry"
        self.use_blur = USE_BLUR
        self.min_area = MIN_BERRY_AREA
        self.max_area = MAX_BERRY_AREA
        self.min_circularity = MIN_CIRCULARITY
        self.crop_left = CROP_LEFT
        self.crop_right = CROP_RIGHT
        self.crop_top = CROP_TOP
        self.crop_bottom = CROP_BOTTOM
        self._load_crop()
        self.running = False
        self.ws = None
        self._ws_connected = False
        self.cap = None
        self.streaming = True  # can be paused from browser
        self._capture_training = False
        self.yolo_model = None
        self.detection_mode = "hsv"  # "hsv" or "yolo"
        self._load_yolo()

    def _load_yolo(self):
        """Try to load YOLO model. Falls back to HSV if not available."""
        if not os.path.exists(YOLO_MODEL):
            print("[detect] No YOLO model found, using HSV detection")
            return
        try:
            from ultralytics import YOLO
            self.yolo_model = YOLO(YOLO_MODEL)
            self.detection_mode = "yolo"
            print(f"[detect] YOLO model loaded from {YOLO_MODEL}")
        except ImportError:
            print("[detect] ultralytics not installed, using HSV detection")
        except Exception as e:
            print(f"[detect] YOLO load failed ({e}), using HSV detection")

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

    def _load_crop(self):
        if os.path.exists(CROP_FILE):
            try:
                with open(CROP_FILE, "r") as f:
                    vals = json.load(f)
                    self.crop_left = float(vals.get("left", CROP_LEFT))
                    self.crop_right = float(vals.get("right", CROP_RIGHT))
                    self.crop_top = float(vals.get("top", CROP_TOP))
                    self.crop_bottom = float(vals.get("bottom", CROP_BOTTOM))
                    print(f"[crop] Loaded from {CROP_FILE}")
            except Exception as e:
                print(f"[crop] Load failed ({e}), using defaults")

    def save_crop(self):
        with open(CROP_FILE, "w") as f:
            json.dump({
                "left": self.crop_left, "right": self.crop_right,
                "top": self.crop_top, "bottom": self.crop_bottom,
            }, f, indent=2)
        print(f"[crop] Saved to {CROP_FILE}")

    def process_frame(self, frame):
        """Detect berries — always HSV for live feed (fast). YOLO used only for label captures."""
        return self._process_frame_hsv(frame)

    def _yolo_detect(self, frame):
        """Run YOLO on cropped ROI, return deduplicated berries in full-frame coords."""
        h, w = frame.shape[:2]
        x0 = int(w * self.crop_left)
        y0 = int(h * self.crop_top)
        x1 = int(w * (1 - self.crop_right))
        y1 = int(h * (1 - self.crop_bottom))
        cropped = frame[y0:y1, x0:x1]

        results = self.yolo_model(cropped, verbose=False, conf=0.40)[0]
        raw = []
        for box in results.boxes:
            bx1, by1, bx2, by2 = box.xyxy[0].cpu().numpy().astype(int)
            # Map back to full-frame coordinates
            cx, cy = (bx1 + bx2) // 2 + x0, (by1 + by2) // 2 + y0
            r = max(bx2 - bx1, by2 - by1) // 2
            conf = float(box.conf[0])
            raw.append({"x": int(cx), "y": int(cy), "r": int(r), "area": int((bx2-bx1)*(by2-by1)), "circ": conf})

        # Deduplicate — merge overlapping detections, keep highest confidence
        raw.sort(key=lambda b: b["circ"], reverse=True)
        berries = []
        for b in raw:
            too_close = False
            for kept in berries:
                dist = ((b["x"] - kept["x"]) ** 2 + (b["y"] - kept["y"]) ** 2) ** 0.5
                if dist < max(b["r"], kept["r"]) * 1.2:
                    too_close = True
                    break
            if not too_close:
                berries.append(b)

        print(f"[yolo] {len(raw)} raw → {len(berries)} after dedup")
        return berries

    def _process_frame_yolo(self, frame):
        """YOLO-based berry detection."""
        results = self.yolo_model(frame, verbose=False, conf=0.40)[0]

        berries = []
        berry_count = 0
        # Generate a blank mask (YOLO doesn't use HSV but UI expects one)
        mask = np.zeros(frame.shape[:2], dtype=np.uint8)

        for box in results.boxes:
            berry_count += 1
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
            conf = float(box.conf[0])
            cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
            r = max(x2 - x1, y2 - y1) // 2

            berries.append({"x": cx, "y": cy, "r": r, "area": (x2-x1)*(y2-y1), "circ": conf})

            # Draw on frame
            cv2.circle(frame, (cx, cy), r, (0, 255, 0), 2)
            cv2.putText(frame, str(berry_count),
                        (cx - 8, cy - r - 5),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
            # Fill mask for UI consistency
            cv2.circle(mask, (cx, cy), r, 255, -1)

        cv2.putText(frame, f"Berries: {berry_count} (YOLO)", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)

        filtered = cv2.bitwise_and(frame, frame, mask=mask)
        return frame, mask, filtered, berry_count, berries

    def _process_frame_hsv(self, frame):
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

        # Crop bounds in pixel coords — only count berries whose center sits inside
        h, w = frame.shape[:2]
        x_min = w * self.crop_left
        x_max = w * (1 - self.crop_right)
        y_min = h * self.crop_top
        y_max = h * (1 - self.crop_bottom)

        berries = []
        berry_count = 0
        split_attempts = 0
        for contour in contours:
            area = cv2.contourArea(contour)
            if area < self.min_area or area > self.max_area:
                continue

            # Circularity filter — reject long/thin shapes (rollers, bars)
            perimeter = cv2.arcLength(contour, True)
            if perimeter == 0:
                continue
            circularity = 4 * 3.14159 * area / (perimeter * perimeter)

            if circularity >= self.min_circularity:
                # Single berry — passes both filters
                (x, y), radius = cv2.minEnclosingCircle(contour)
                cx, cy, r = int(x), int(y), int(radius)
                if not (x_min <= cx <= x_max and y_min <= cy <= y_max):
                    continue
                berry_count += 1
                berries.append({"x": cx, "y": cy, "r": r, "area": int(area), "circ": round(circularity, 2)})
                cv2.circle(frame, (cx, cy), r, (0, 255, 0), 2)
                cv2.putText(frame, str(berry_count),
                            (cx - 8, cy - r - 5),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
            else:
                # Failed circularity — likely merged berries, try to split (max 10/frame)
                if split_attempts < 10:
                    split_attempts += 1
                    split_count = self._split_merged(contour, mask, frame, berries, berry_count, (x_min, x_max, y_min, y_max))
                    berry_count += split_count

        # Visible crop rectangle (debug overlay)
        cv2.rectangle(frame, (int(x_min), int(y_min)), (int(x_max), int(y_max)), (180, 180, 180), 1)

        # Overlay info
        cv2.putText(frame, f"Berries: {berry_count}", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)

        # Filtered result — only berry-colored pixels from original
        filtered = cv2.bitwise_and(frame, frame, mask=mask)

        return frame, mask, filtered, berry_count, berries

    def _split_merged(self, contour, full_mask, frame, berries, start_count, bounds=None):
        """Split a merged contour into individual berries using distance transform peaks.

        When two berries touch, they form one blob that fails circularity.
        The distance transform finds the center of each berry (local maxima),
        so we can count them individually.
        """
        # Must be big enough to contain at least 2 berries
        area = cv2.contourArea(contour)
        if area < self.min_area * 2:
            return 0

        # Reject very elongated shapes — those are roller bars, not merged berries
        rect = cv2.minAreaRect(contour)
        w, h = rect[1]
        if w > 0 and h > 0:
            aspect = max(w, h) / min(w, h)
            if aspect > 3.0:
                return 0

        # Work on bounding rect only — much faster than full-frame arrays
        bx, by, bw, bh = cv2.boundingRect(contour)
        sub_mask = np.zeros((bh, bw), dtype=np.uint8)
        shifted = contour - [bx, by]
        cv2.drawContours(sub_mask, [shifted], -1, 255, -1)

        # Distance transform — berry centers become peaks
        dist = cv2.distanceTransform(sub_mask, cv2.DIST_L2, 5)

        # Find local maxima
        peak_kernel = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE, (PEAK_NEIGHBORHOOD, PEAK_NEIGHBORHOOD)
        )
        dilated = cv2.dilate(dist, peak_kernel)
        local_max = ((dist == dilated) & (dist > MIN_DIST_PEAK)).astype(np.uint8) * 255

        num_peaks, peak_labels = cv2.connectedComponents(local_max)

        if num_peaks <= 1:
            return 0

        found = 0
        for peak_id in range(1, num_peaks):
            ys, xs = np.where(peak_labels == peak_id)
            if len(xs) == 0:
                continue
            # Convert back to full-frame coordinates
            cx, cy = int(xs.mean()) + bx, int(ys.mean()) + by
            local_cy, local_cx = int(ys.mean()), int(xs.mean())
            r = max(int(dist[local_cy, local_cx]), 5)
            area_est = int(3.14159 * r * r)
            if area_est < self.min_area // 2:
                continue
            if bounds is not None:
                bx_min, bx_max, by_min, by_max = bounds
                if not (bx_min <= cx <= bx_max and by_min <= cy <= by_max):
                    continue
            found += 1
            idx = start_count + found
            berries.append({"x": cx, "y": cy, "r": r, "area": area_est, "circ": 0.0})
            cv2.circle(frame, (cx, cy), r, (0, 255, 0), 2)
            cv2.putText(frame, str(idx), (cx - 8, cy - r - 5),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

        return found

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

        elif action == "capture_training":
            self._capture_training = True

        elif action == "update_crop":
            for key, attr in (("left", "crop_left"), ("right", "crop_right"),
                              ("top", "crop_top"), ("bottom", "crop_bottom")):
                if key in msg:
                    setattr(self, attr, max(0.0, min(0.45, float(msg[key]))))

        elif action == "save_crop":
            self.save_crop()

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

    def _find_working_camera(self):
        """Scan indices 1-4 and return the first camera that actually grabs frames.
        Skips index 0 — that's the laptop webcam/phantom device, not a USB camera."""
        for idx in range(1, 5):
            cap = cv2.VideoCapture(idx)
            if cap.isOpened():
                ret, frame = cap.read()
                if ret:
                    print(f"[camera] Found working camera at index {idx}")
                    return cap, idx
                cap.release()
        return None, None

    def run(self):
        # Open camera
        print(f"\n=== BerryCheck Camera Service ===")
        print(f"Preferred camera index: {CAMERA_INDEX}")
        print(f"Relay: {RELAY_URL}")

        # Try preferred index first
        self.cap = cv2.VideoCapture(CAMERA_INDEX)
        found_idx = CAMERA_INDEX
        if self.cap.isOpened():
            ret, test_frame = self.cap.read()
            if not ret:
                print(f"[WARN] Camera {CAMERA_INDEX} can't grab frames, scanning for alternatives...")
                self.cap.release()
                self.cap, found_idx = self._find_working_camera()
        else:
            print(f"[WARN] Camera {CAMERA_INDEX} unavailable, scanning for alternatives...")
            self.cap, found_idx = self._find_working_camera()

        if self.cap is None:
            print(f"\n[ERROR] No working camera found (scanned indices 0-4)")
            return

        # Try to set 1080p — release and reopen to avoid corrupted state
        self.cap.release()
        self.cap = cv2.VideoCapture(found_idx)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1920)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 1080)
        ret, test_frame = self.cap.read()
        if not ret:
            # 1080p didn't work — reopen at default resolution
            print(f"[WARN] 1080p failed on camera {found_idx}, using default resolution...")
            self.cap.release()
            self.cap = cv2.VideoCapture(found_idx)
            if not self.cap.isOpened():
                print(f"[ERROR] Could not reopen camera {found_idx}")
                return
            ret, test_frame = self.cap.read()
            if not ret:
                print(f"[ERROR] Camera {found_idx} cannot grab frames after reopen")
                return

        w = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        print(f"Camera resolution: {w}x{h} (index {found_idx})")

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
        self._yolo_last_scan = 0
        self._yolo_berries = []
        self._yolo_count = 0
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

                # Training capture requested — use YOLO if available for better auto-labels
                if self._capture_training:
                    self._capture_training = False
                    if self.yolo_model is not None:
                        yolo_berries = self._yolo_detect(frame)
                        capture_berries = yolo_berries
                    else:
                        capture_berries = berries
                    self.send_msg({
                        "type": "training_capture",
                        "raw": self.frame_to_jpeg_base64(frame),
                        "berries": capture_berries,
                        "width": int(frame.shape[1]),
                        "height": int(frame.shape[0]),
                    })
                    print(f"[training] Captured frame with {len(berries)} auto-labels")

                # YOLO periodic scan — every 3 seconds, one inference
                now = time.time()
                if self.yolo_model and (now - self._yolo_last_scan) >= 3.0:
                    self._yolo_last_scan = now
                    self._yolo_berries = self._yolo_detect(frame)
                    self._yolo_count = len(self._yolo_berries)

                # Build display frame: YOLO overlay if available, else HSV
                if self._yolo_berries:
                    display = frame.copy()
                    for i, b in enumerate(self._yolo_berries):
                        cv2.circle(display, (b["x"], b["y"]), b["r"], (0, 255, 0), 2)
                        cv2.putText(display, str(i + 1), (b["x"] - 8, b["y"] - b["r"] - 5),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
                    cv2.putText(display, f"Berries: {self._yolo_count} (YOLO)", (10, 30),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
                    display_count = self._yolo_count
                    display_berries = self._yolo_berries
                else:
                    display = annotated
                    display_count = stable_count
                    display_berries = berries

                # Rate-limit WebSocket sends
                if self.streaming and (now - last_send) >= FRAME_INTERVAL:
                    last_send = now
                    self.send_msg({
                        "type": "grader_frame",
                        "frame": self.frame_to_jpeg_base64(display),
                        "mask": self.mask_to_png_base64(mask),
                        "filtered": self.frame_to_jpeg_base64(filtered),
                        "count": display_count,
                        "raw_count": count,
                        "berries": display_berries,
                        "hsv": self.hsv,
                        "blur": self.use_blur,
                        "profile": self.profile,
                        "crop": {
                            "left": self.crop_left, "right": self.crop_right,
                            "top": self.crop_top, "bottom": self.crop_bottom,
                        },
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
