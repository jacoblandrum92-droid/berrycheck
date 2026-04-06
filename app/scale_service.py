"""
Clamshell Scale Service
=======================
Bridges the USB serial clamshell scale to BerryCheck via WebSocket relay.
Spawned by Electron alongside camera_service.py.

Usage:
    python scale_service.py              # auto-detect serial port
    python scale_service.py --port COM11 # specific port
    python scale_service.py --list       # list available ports

The scale outputs "W:xxx.x\n" at 115200 baud, 5 readings/sec.
Commands from BerryCheck (via WebSocket) are forwarded to serial.
"""

import asyncio
import json
import sys
import time

try:
    import serial
    import serial.tools.list_ports
except ImportError:
    print("[scale] Missing dependency: pyserial")
    print("[scale] Install with: pip install pyserial")
    sys.exit(1)

try:
    import websockets
except ImportError:
    print("[scale] Missing dependency: websockets")
    print("[scale] Install with: pip install websockets")
    sys.exit(1)

BAUD_RATE = 115200
RELAY_URL = "ws://localhost:5175/?role=scale"
RECONNECT_DELAY = 3
SERIAL_RETRY_DELAY = 5


def find_scale_port():
    """Auto-detect the scale's serial port (Arduino Nano / ESP32)."""
    ports = serial.tools.list_ports.comports()
    for p in ports:
        desc = (p.description or "").lower()
        hwid = (p.hwid or "").lower()
        # Match common USB-serial chips used by Arduino Nano / ESP32
        if any(chip in desc for chip in ["ch340", "cp210", "usb serial", "usb-serial"]):
            return p.device
        if any(chip in hwid for chip in ["ch340", "cp210", "1a86", "10c4"]):
            return p.device
    return None


def list_ports():
    """Print available serial ports and exit."""
    ports = serial.tools.list_ports.comports()
    if not ports:
        print("[scale] No serial ports found")
        return
    for p in ports:
        print(f"  {p.device}: {p.description} [{p.hwid}]")


class ScaleBridge:
    def __init__(self, port=None):
        self.requested_port = port
        self.ser = None
        self.ws = None
        self.last_weight = 0.0
        self.connected = False

    def open_serial(self):
        """Open or reopen the serial port."""
        if self.ser and self.ser.is_open:
            return True

        port = self.requested_port or find_scale_port()
        if not port:
            return False

        try:
            self.ser = serial.Serial(port, BAUD_RATE, timeout=0.1)
            print(f"[scale] Serial connected: {port} @ {BAUD_RATE}")
            return True
        except serial.SerialException as e:
            print(f"[scale] Serial error on {port}: {e}")
            self.ser = None
            return False

    async def send_ws(self, msg):
        """Send a message to the WebSocket relay."""
        if self.ws:
            try:
                await self.ws.send(json.dumps(msg))
            except Exception:
                pass

    async def read_serial_loop(self):
        """Read weight lines from serial and broadcast via WebSocket."""
        while True:
            if not self.ser or not self.ser.is_open:
                if not self.open_serial():
                    await asyncio.sleep(SERIAL_RETRY_DELAY)
                    continue

            try:
                if self.ser.in_waiting:
                    line = self.ser.readline().decode("utf-8", errors="ignore").strip()
                    if line.startswith("W:"):
                        try:
                            weight = float(line[2:])
                            self.last_weight = weight
                            await self.send_ws({
                                "type": "scale_weight",
                                "weight_g": weight,
                                "port": self.ser.port,
                            })
                        except ValueError:
                            pass
                    elif line.startswith("OK:"):
                        # Forward acknowledgments to dashboard
                        await self.send_ws({
                            "type": "scale_ack",
                            "message": line,
                        })
                    elif line.startswith("CAL:"):
                        await self.send_ws({
                            "type": "scale_ack",
                            "message": line,
                        })
                else:
                    await asyncio.sleep(0.05)
            except (serial.SerialException, OSError):
                print("[scale] Serial disconnected")
                self.ser = None
                await self.send_ws({"type": "scale_status", "status": "disconnected"})
                await asyncio.sleep(SERIAL_RETRY_DELAY)

    async def handle_ws_commands(self):
        """Listen for commands from BerryCheck and forward to serial."""
        while True:
            if not self.ws:
                await asyncio.sleep(0.5)
                continue
            try:
                raw = await self.ws.recv()
                msg = json.loads(raw)
                if msg.get("type") == "scale_command":
                    action = msg.get("action", "")
                    if self.ser and self.ser.is_open:
                        if action == "tare":
                            self.ser.write(b"TARE\n")
                        elif action == "calweight":
                            weight = msg.get("weight", 0)
                            self.ser.write(f"CALWEIGHT:{weight}\n".encode())
                        elif action == "getcal":
                            self.ser.write(b"GETCAL\n")
                        print(f"[scale] Command sent: {action}")
                    else:
                        print(f"[scale] Command {action} ignored — serial not connected")
            except Exception:
                await asyncio.sleep(0.5)

    async def run(self):
        """Main loop — connect to WebSocket relay and bridge serial."""
        while True:
            try:
                print(f"[scale] Connecting to relay at {RELAY_URL}...")
                async with websockets.connect(RELAY_URL) as ws:
                    self.ws = ws
                    self.connected = True
                    print("[scale] WebSocket connected to relay")

                    # Send initial status
                    serial_ok = self.ser and self.ser.is_open
                    await self.send_ws({
                        "type": "scale_status",
                        "status": "connected" if serial_ok else "no_serial",
                        "port": self.ser.port if serial_ok else None,
                    })

                    # Run serial reader and command handler concurrently
                    await asyncio.gather(
                        self.read_serial_loop(),
                        self.handle_ws_commands(),
                    )
            except (websockets.ConnectionClosed, ConnectionRefusedError, OSError) as e:
                self.ws = None
                self.connected = False
                print(f"[scale] WebSocket disconnected: {e}")
                await asyncio.sleep(RECONNECT_DELAY)


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Clamshell Scale Bridge")
    parser.add_argument("--port", help="Serial port (e.g. COM11)")
    parser.add_argument("--list", action="store_true", help="List available ports")
    args = parser.parse_args()

    if args.list:
        list_ports()
        return

    print("")
    print("  Clamshell Scale Service")
    print("  =======================")
    print(f"  Serial: {args.port or 'auto-detect'}")
    print(f"  Relay:  {RELAY_URL}")
    print("")

    bridge = ScaleBridge(port=args.port)
    asyncio.run(bridge.run())


if __name__ == "__main__":
    main()
