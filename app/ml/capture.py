"""
Berry Training Data Capture
============================
Opens the camera, runs the existing HSV detection pipeline to auto-generate
bounding box labels, and saves image + label pairs in YOLO format.

Usage:
  python capture.py              # interactive — press SPACE to capture, Q to quit
  python capture.py --burst 20   # auto-capture 20 frames with slight delays

The HSV auto-labels are a starting point (~80% correct). Fix the remaining
errors in Roboflow or LabelImg before training.

Output:
  dataset/images/train/NNNN.jpg   — raw camera frame
  dataset/labels/train/NNNN.txt   — YOLO format: class cx cy w h (normalized)
"""

import cv2
import numpy as np
import json
import os
import sys
import time
import argparse

# Add parent dir so we can import camera_service's detection logic
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

DATASET_DIR = os.path.join(os.path.dirname(__file__), 'dataset')
HSV_FILE = os.path.join(os.path.dirname(__file__), '..', 'berry_hsv_values.json')

# Detection params — mirrors camera_service.py
MIN_AREA = 200
MAX_AREA = 50000
MIN_CIRCULARITY = 0.35
PEAK_NEIGHBORHOOD = 19
MIN_DIST_PEAK = 4


def load_hsv():
    if os.path.exists(HSV_FILE):
        with open(HSV_FILE) as f:
            return json.load(f)
    return {"h_low": 90, "h_high": 145, "s_low": 30, "s_high": 255, "v_low": 30, "v_high": 200}


def detect_berries(frame, hsv_vals):
    """Run the same HSV pipeline as camera_service.py, return bounding boxes."""
    hsv_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    lower = np.array([hsv_vals["h_low"], hsv_vals["s_low"], hsv_vals["v_low"]])
    upper = np.array([hsv_vals["h_high"], hsv_vals["s_high"], hsv_vals["v_high"]])
    mask = cv2.inRange(hsv_frame, lower, upper)

    # Blur + threshold
    blurred = cv2.GaussianBlur(mask, (7, 7), 0)
    _, mask = cv2.threshold(blurred, 127, 255, cv2.THRESH_BINARY)

    # Morphological cleanup
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    boxes = []  # (x, y, w, h) in pixels
    for contour in contours:
        area = cv2.contourArea(contour)
        if area < MIN_AREA or area > MAX_AREA:
            continue

        perimeter = cv2.arcLength(contour, True)
        if perimeter == 0:
            continue
        circularity = 4 * 3.14159 * area / (perimeter * perimeter)

        if circularity >= MIN_CIRCULARITY:
            x, y, w, h = cv2.boundingRect(contour)
            boxes.append((x, y, w, h))
        else:
            # Try splitting merged berries
            split_boxes = _split_merged(contour, mask)
            boxes.extend(split_boxes)

    return boxes, mask


def _split_merged(contour, full_mask):
    """Split merged contour using distance transform peaks, return bounding boxes."""
    area = cv2.contourArea(contour)
    if area < MIN_AREA * 2:
        return []

    rect = cv2.minAreaRect(contour)
    w, h = rect[1]
    if w > 0 and h > 0:
        aspect = max(w, h) / min(w, h)
        if aspect > 3.0:
            return []

    sub_mask = np.zeros(full_mask.shape, dtype=np.uint8)
    cv2.drawContours(sub_mask, [contour], -1, 255, -1)

    dist = cv2.distanceTransform(sub_mask, cv2.DIST_L2, 5)
    peak_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (PEAK_NEIGHBORHOOD, PEAK_NEIGHBORHOOD))
    dilated = cv2.dilate(dist, peak_kernel)
    local_max = ((dist == dilated) & (dist > MIN_DIST_PEAK)).astype(np.uint8) * 255

    num_peaks, peak_labels = cv2.connectedComponents(local_max)
    if num_peaks <= 1:
        return []

    boxes = []
    for peak_id in range(1, num_peaks):
        ys, xs = np.where(peak_labels == peak_id)
        if len(xs) == 0:
            continue
        cx, cy = int(xs.mean()), int(ys.mean())
        r = max(int(dist[cy, cx]), 5)
        if 3.14159 * r * r < MIN_AREA // 2:
            continue
        # Bounding box from center + radius
        boxes.append((cx - r, cy - r, 2 * r, 2 * r))

    return boxes


def to_yolo_format(boxes, img_w, img_h):
    """Convert pixel bounding boxes to YOLO normalized format."""
    lines = []
    for (x, y, w, h) in boxes:
        cx = (x + w / 2) / img_w
        cy = (y + h / 2) / img_h
        nw = w / img_w
        nh = h / img_h
        # Clamp to [0, 1]
        cx = max(0, min(1, cx))
        cy = max(0, min(1, cy))
        nw = max(0, min(1, nw))
        nh = max(0, min(1, nh))
        lines.append(f"0 {cx:.6f} {cy:.6f} {nw:.6f} {nh:.6f}")
    return "\n".join(lines)


def next_index(split='train'):
    """Find the next available image index."""
    img_dir = os.path.join(DATASET_DIR, 'images', split)
    existing = [f for f in os.listdir(img_dir) if f.endswith('.jpg')]
    if not existing:
        return 0
    nums = [int(f.split('.')[0]) for f in existing if f.split('.')[0].isdigit()]
    return max(nums) + 1 if nums else 0


def save_sample(frame, boxes, split='train', idx=None):
    """Save image and YOLO label file."""
    if idx is None:
        idx = next_index(split)

    img_path = os.path.join(DATASET_DIR, 'images', split, f'{idx:04d}.jpg')
    lbl_path = os.path.join(DATASET_DIR, 'labels', split, f'{idx:04d}.txt')

    img_h, img_w = frame.shape[:2]
    yolo_labels = to_yolo_format(boxes, img_w, img_h)

    cv2.imwrite(img_path, frame)
    with open(lbl_path, 'w') as f:
        f.write(yolo_labels)

    return idx, len(boxes)


def find_camera():
    """Find the first working camera."""
    for idx in range(5):
        cap = cv2.VideoCapture(idx)
        if cap.isOpened():
            ret, _ = cap.read()
            if ret:
                return cap, idx
            cap.release()
    return None, None


def main():
    parser = argparse.ArgumentParser(description='Capture berry training data')
    parser.add_argument('--burst', type=int, default=0,
                        help='Auto-capture N frames (0 = interactive mode)')
    parser.add_argument('--delay', type=float, default=0.5,
                        help='Seconds between burst captures')
    parser.add_argument('--split', default='train', choices=['train', 'val'],
                        help='Dataset split to save to')
    parser.add_argument('--camera', type=int, default=1,
                        help='Camera index (default 1, 0 is usually phantom)')
    args = parser.parse_args()

    hsv = load_hsv()
    print(f"HSV: {hsv}")

    # Try specified camera first, then scan
    cap = cv2.VideoCapture(args.camera)
    cam_idx = args.camera
    if not cap.isOpened() or not cap.read()[0]:
        print(f"Camera {args.camera} not available, scanning...")
        cap.release()
        cap, cam_idx = find_camera()
        if cap is None:
            print("No camera found")
            return

    # Try 1080p
    cap.release()
    cap = cv2.VideoCapture(cam_idx)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1920)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 1080)

    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    print(f"Camera {cam_idx}: {w}x{h}")

    if args.burst > 0:
        # Burst mode — auto-capture N frames
        print(f"Burst: capturing {args.burst} frames to {args.split}/")
        for i in range(args.burst):
            ret, frame = cap.read()
            if not ret:
                print(f"  Frame grab failed at {i}")
                continue
            boxes, _ = detect_berries(frame, hsv)
            idx, count = save_sample(frame, boxes, args.split)
            print(f"  [{i+1}/{args.burst}] Saved {idx:04d}.jpg — {count} auto-labels")
            time.sleep(args.delay)
        print("Done.")
    else:
        # Interactive mode
        print("Interactive mode — press SPACE to capture, Q to quit")
        print("Window shows live detection preview\n")
        while True:
            ret, frame = cap.read()
            if not ret:
                continue

            preview = frame.copy()
            boxes, mask = detect_berries(frame, hsv)

            # Draw boxes on preview
            for (x, y, bw, bh) in boxes:
                cv2.rectangle(preview, (x, y), (x + bw, y + bh), (0, 255, 0), 2)
            cv2.putText(preview, f"Auto-detect: {len(boxes)} berries (SPACE=save, Q=quit)",
                        (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

            # Show at half size for screen fit
            disp = cv2.resize(preview, (w // 2, h // 2))
            cv2.imshow('Berry Capture', disp)

            key = cv2.waitKey(30) & 0xFF
            if key == ord('q'):
                break
            elif key == ord(' '):
                idx, count = save_sample(frame, boxes, args.split)
                print(f"Saved {idx:04d}.jpg — {count} auto-labels")

        cv2.destroyAllWindows()

    cap.release()


if __name__ == '__main__':
    main()
