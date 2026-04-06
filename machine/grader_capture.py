# =============================================
# Blueberry Grader - Camera Capture Script
# Runs on laptop or Pi
# Listens for ESP32 serial trigger
# Captures frames from all cameras during spin window
# =============================================
# INSTALL:
#   pip install opencv-python pyserial
# USAGE:
#   python grader_capture.py
#   Then press button on machine OR type START in terminal
# =============================================

import cv2
import serial
import serial.tools.list_ports
import os
import time
import threading
from datetime import datetime

# --- Config ---
SERIAL_PORT   = None        # set to None for auto-detect, or "COM3" / "/dev/ttyUSB0"
BAUD_RATE     = 115200
CAMERA_IDS    = [0, 1, 2]  # USB camera indices - add/remove as needed
SAVE_DIR      = "captures"
FRAME_WIDTH   = 1920
FRAME_HEIGHT  = 1080
SHOW_PREVIEW  = True        # set False on Pi with no monitor

# --- State ---
recording    = False
sample_count = 0
cameras      = []
frames       = {i: [] for i in CAMERA_IDS}

# =============================================
def find_serial_port():
    ports = serial.tools.list_ports.comports()
    for p in ports:
        if "USB" in p.description or "CH340" in p.description or "CP210" in p.description:
            print(f"Found ESP32 on {p.device}")
            return p.device
    return None

# =============================================
def init_cameras():
    global cameras
    for cam_id in CAMERA_IDS:
        cap = cv2.VideoCapture(cam_id)
        if cap.isOpened():
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_WIDTH)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_HEIGHT)
            cap.set(cv2.CAP_PROP_AUTOFOCUS, 1)
            cameras.append((cam_id, cap))
            print(f"Camera {cam_id} initialized")
        else:
            print(f"WARNING: Camera {cam_id} not found")
    return len(cameras) > 0

# =============================================
def capture_loop():
    """Runs in background thread - continuously grabs frames when recording"""
    global recording, frames
    while True:
        for cam_id, cap in cameras:
            ret, frame = cap.read()
            if ret and recording:
                frames[cam_id].append(frame.copy())
        time.sleep(0.05) # ~20fps per camera

# =============================================
def save_sample():
    global sample_count, frames
    sample_count += 1
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    folder = os.path.join(SAVE_DIR, f"sample_{sample_count:04d}_{timestamp}")
    os.makedirs(folder, exist_ok=True)

    total = 0
    for cam_id, _ in cameras:
        cam_folder = os.path.join(folder, f"cam_{cam_id}")
        os.makedirs(cam_folder, exist_ok=True)
        for i, frame in enumerate(frames[cam_id]):
            path = os.path.join(cam_folder, f"frame_{i:04d}.jpg")
            cv2.imwrite(path, frame, [cv2.IMWRITE_JPEG_QUALITY, 95])
            total += 1
        frames[cam_id] = [] # clear for next sample

    print(f"  Saved {total} frames to {folder}")
    return folder

# =============================================
def serial_listener(ser):
    """Listens for ESP32 messages"""
    global recording
    while True:
        try:
            if ser.in_waiting:
                msg = ser.readline().decode().strip()
                print(f"ESP32: {msg}")

                if msg == "CAPTURING":
                    recording = True
                    for cam_id in CAMERA_IDS:
                        frames[cam_id] = []
                    print(f"  Recording started - {len(cameras)} cameras active")

                elif msg == "DONE":
                    recording = False
                    print("  Recording stopped - saving...")
                    save_sample()
                    print(f"  Ready for next sample")

                elif msg == "READY":
                    print("  Machine ready - press button or type START")

        except Exception as e:
            print(f"Serial error: {e}")
        time.sleep(0.01)

# =============================================
def main():
    global recording

    os.makedirs(SAVE_DIR, exist_ok=True)

    # Init cameras
    print("Initializing cameras...")
    if not init_cameras():
        print("ERROR: No cameras found")
        return

    # Init serial
    port = SERIAL_PORT or find_serial_port()
    ser = None
    if port:
        try:
            ser = serial.Serial(port, BAUD_RATE, timeout=1)
            print(f"Connected to ESP32 on {port}")
            threading.Thread(target=serial_listener, args=(ser,), daemon=True).start()
        except Exception as e:
            print(f"Serial connection failed: {e}")
            print("Running in manual mode - press ENTER to trigger")
    else:
        print("No ESP32 found - running in manual mode")

    # Start capture thread
    threading.Thread(target=capture_loop, daemon=True).start()

    print("\n=== Blueberry Grader Ready ===")
    print(f"Cameras: {len(cameras)}")
    print(f"Saving to: {os.path.abspath(SAVE_DIR)}")
    print("Press ENTER to manually trigger, Ctrl+C to quit\n")

    # Preview window
    if SHOW_PREVIEW and cameras:
        cv2.namedWindow("Grader Preview", cv2.WINDOW_NORMAL)

    try:
        while True:
            # Show preview
            if SHOW_PREVIEW and cameras:
                _, cap = cameras[0]
                ret, frame = cap.read()
                if ret:
                    preview = cv2.resize(frame, (640, 360))
                    status = "RECORDING" if recording else "READY"
                    color = (0, 0, 255) if recording else (0, 255, 0)
                    cv2.putText(preview, status, (10, 30),
                               cv2.FONT_HERSHEY_SIMPLEX, 1, color, 2)
                    cv2.putText(preview, f"Sample #{sample_count}", (10, 65),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,255,255), 1)
                    cv2.imshow("Grader Preview", preview)
                key = cv2.waitKey(1)
                if key == 13:  # Enter key
                    if not recording and ser:
                        ser.write(b"START\n")
                    elif not recording:
                        # Manual mode - no ESP32
                        recording = True
                        for cam_id in CAMERA_IDS:
                            frames[cam_id] = []
                        print("Manual recording started (6 sec)...")
                        time.sleep(6)
                        recording = False
                        save_sample()
                if key == 27:  # Escape
                    break

    except KeyboardInterrupt:
        print("\nShutting down")
    finally:
        for _, cap in cameras:
            cap.release()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
