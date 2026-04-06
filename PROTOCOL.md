# BerryCheck Protocols

*Mandatory for all Claude agent instances working on this project.*
*Created: April 5, 2026*

---

## Pre-Work Protocol (BEFORE any code change)

Time budget: 2-3 minutes. If this takes longer, you're overthinking it.

### Step 1: Identify Blast Radius (30 seconds)

For each file you plan to edit, answer:
- What imports FROM this file? (grep for the filename across the project)
- What does this file import? (read the import block)
- List every file that will be affected by your change.

```bash
# App side — find who imports a module
grep -r "from.*ComponentName" app/src/
grep -r "import.*ComponentName" app/src/

# Machine side — find who imports a module
grep -r "from.*module_name" machine/
grep -r "import module_name" machine/
```

### Step 2: Verify Build State (30 seconds)

Confirm the project compiles BEFORE you change anything.
If it doesn't compile now, fix THAT first — don't stack changes on a broken build.

```bash
# App
cd app && npm run build 2>&1 | tail -5

# Machine
cd machine && python -c "import grader_service" 2>&1

# Firmware (syntax only)
# arduino-cli compile --verify or open in Arduino IDE
```

If the build is already broken, STOP. Tell Jacob. Do not add changes on top of a broken build.

### Step 3: Snapshot State Shape (30 seconds)

**For app changes that touch data:**
- Browser console: `Object.keys(localStorage).filter(k => k.startsWith('bc_'))`
- Check the shape of any key you'll modify: `JSON.parse(localStorage.getItem('bc_history'))[0]`
- Check `app/src/sharedStorage.js` ALL_KEYS array — your new key must be in this list

**For machine changes:**
- Check grader_service.py config constants at top of file
- Check INTEGRATION_SPEC.md payload format if touching payloads

### Step 4: Name Your Breakage Points (30 seconds)

Write down the 3 most likely things your change will break:
1. ___
2. ___
3. ___

Common breakage points:
- Missing import after moving/renaming a function
- localStorage key shape changed without migrating existing data
- WebSocket message format changed on one side but not the other
- Component prop name changed at definition but not at call site
- Port number wrong after editing server config
- Python module path wrong after moving files

### Step 5: State Your Verification Plan (30 seconds)

After making the change, you WILL check:
1. Build still compiles clean (Step 2 again)
2. Each breakage point from Step 4 is verified not-broken
3. The specific feature you changed works as intended

Do not skip verification. Do not declare victory without running verification.

---

## Debugging Protocol (when something breaks)

### One Free Swing

You get one gut-instinct fix attempt. If you think you know what's wrong, try it.

- If it works: done. No protocol overhead needed.
- If it doesn't work: **STOP GUESSING.** Run the layers below in order. No second guess without completing the layers first.

After any fix — including the free swing — re-run Layers 0 and 1 before declaring victory.

### Layer 0: The Stupid Stuff (5 seconds)

Check these FIRST. Do not think. Just look.

**Syntax / Imports:**
- Any red squiggles in the file you just edited?
- Did you forget to import something you're using?
- Did you forget to export something another file needs?
- Mismatched brackets, missing comma in JSX, unclosed template literal?

**Wrong Constants:**
- Port number: is it 5175 (relay) or 5176 (Vite dev)?
- WebSocket URL: `ws://` not `http://`, correct host, correct port?
- File path: forward slashes, correct relative path?
- Serial port: COM port number correct? (changes when USB is replugged)

**Typos:**
- Variable/function name spelled differently at definition vs usage?
- `camelCase` vs `snake_case` mismatch between JS and Python?
- String comparison: `"grader"` vs `"Grader"` vs `"GRADER"`?

If you find something in Layer 0: fix it, then run Layer 0 again to confirm.

### Layer 1: Does It Start? (30 seconds)

**App server:**
```bash
cd app && node server.js
# Expected: "BerryCheck server running on port 5175"
# If crash: read the error. Usually a missing module (npm install) or port in use.
```

**Vite dev server:**
```bash
cd app && npx vite --port 5176
# Expected: "ready in Xms"
# If crash: check vite.config.js, check node_modules exists
```

**Grader service:**
```bash
cd machine && python grader_service.py
# Expected: "BerryCheck Grader Service" banner + "Connecting..."
# If crash: pip install websockets, or check Python version
```

**WebSocket connection:**
- Browser devtools → Network tab → WS filter
- Is there a WebSocket connection to localhost:5175?
- Is the `role` parameter correct? (`?role=dashboard` for app, `?role=grader` for grader)
- If no connection: server not running, wrong port, or firewall

**Component render:**
- Does the page load at all? If blank white page: check browser console for React errors.
- If specific component missing: check App.jsx import and conditional rendering logic.

### Layer 2: What Does the Console Say? (2 minutes)

**Browser console (F12):**
- Any red errors? Read them. The message usually says exactly what's wrong.
- `Cannot read property of undefined` → something is null that shouldn't be
- `X is not a function` → wrong import, or calling a value not a function
- `Failed to fetch` → server endpoint wrong or server not running

**Network tab:**
- Are API calls returning 200? Or 404/500?
- Is the WebSocket connected (Status 101) or failing?
- Are WebSocket messages flowing? Click the WS connection → Messages tab.

**Server terminal:**
- Is the relay logging `[connect]` / `[relay]` / `[api]` messages?
- Any stack traces?

**localStorage integrity:**
- `JSON.parse(localStorage.getItem('bc_history'))` — does it parse cleanly?
- If corrupted: `localStorage.removeItem('bc_history')` and reload
- Check ALL_KEYS in sharedStorage.js — is your key listed?

### Layer 3: Actual Logic Debugging (only if Layers 0-2 are clean)

You've confirmed:
- No syntax errors or missing imports (L0)
- All servers start and connect (L1)
- No console errors, network calls succeed, data is intact (L2)

NOW you can investigate logic:
- Add `console.log` at the entry point of the function that's misbehaving
- Is the function being called at all? (If not: event handler not wired, or conditional prevents render)
- Is it called with the right arguments? (Log them)
- Trace the data flow: where does the value come from → where does it go → where does it go wrong?

### After Any Fix: Re-Run Layers 0-1

Fixed something? Great. Now re-run Layers 0 and 1 before declaring victory.
Your fix might have introduced a new Layer 0 issue (missing import, typo in the fix).

---

## BerryCheck-Specific Failure Modes

### Grader Integration

| Symptom | Check First |
|---|---|
| Grader shows "Disconnected" | Is grader_service.py running? Correct port (5175)? |
| SCAN button does nothing | WebSocket connected? Check server.js routing for `role=grader` |
| Sample payload not received | Check server.js `broadcast(msg, 'dashboard')` — is msg.type correct? |
| Count/weight not populating | Check useRelay.js message handler — parsing `sample` message type? |
| Mock vs Real confusion | Check `--real` flag. Mock sends `"mock": true` in payload. |

### Clamshell Scale

| Symptom | Check First |
|---|---|
| No weight reading | Arduino/ESP32 plugged in? Correct COM port? Baud 115200? |
| Weight reads 0 | Load cell wiring: Red=E+, Black=E-, White=A+, Green=A- |
| Weight jumps wildly | Load cell not rigidly mounted, or EMI on long wires |
| TARE doesn't respond | Baud rate (115200). Serial command format (`TARE\n`). |
| Wrong cal factor | Recalibrate with known weight. Check EEPROM save. |

### React / Vite

| Symptom | Check First |
|---|---|
| White blank page | Browser console → React render error |
| Component not showing | Feature flag in featureFlags.js? Conditional render in App.jsx? |
| State not persisting | sharedStorage.js — is the key in ALL_KEYS? Using store.set()? |
| Hot reload broken | Vite dev server running? Check terminal for Vite errors. |

### Electron

| Symptom | Check First |
|---|---|
| Window blank | Is relay server spawned? Check electron/main.js |
| Camera not working | Is camera_service.py spawned? Try RETRY CAMERA button. |
| Port 5175 in use | Kill other node/electron processes: `netstat -ano | findstr 5175` |

---

## Quick Reference: Key File Dependencies

### App Critical Path
```
App.jsx → imports every component → any component rename/move breaks App.jsx
server.js → relay + storage API → if this breaks, everything breaks
useRelay.js → WebSocket hook → used by App.jsx, CameraCapture, CameraTuner
sharedStorage.js → data layer → used by every component that persists data
constants.js → grading engine + design tokens → used everywhere
featureFlags.js → feature gates → controls what renders
```

### Machine Critical Path
```
grader_service.py → standalone → only external dep: websockets pip package
grader_capture.py → standalone → depends on opencv-python
firmware/grader_esp32.ino → standalone → compiled separately in Arduino IDE
```

### Cross-Boundary (spec-governed)
```
INTEGRATION_SPEC.md governs:
├── Sample payload JSON shape (grader_service.py generates, App.jsx consumes)
├── WebSocket message types (server.js routes, useRelay.js handles)
├── Command JSON shape (App.jsx sends, grader_service.py handles)
├── Grid dimensions (grader_service.py GRID_COLS/ROWS must match spec)
└── Clamshell serial protocol (firmware sends, Electron/BerryCheck reads)
```
