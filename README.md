# BerryCheck QC — Local Demo

## Setup (one time)

```
pip install flask anthropic
```

Set your API key. In Windows Command Prompt:
```
set ANTHROPIC_API_KEY=your-key-here
```

Or in PowerShell:
```
$env:ANTHROPIC_API_KEY="your-key-here"
```

## Run

```
cd berrycheck
python app.py
```

## Use

1. ThinkPad dashboard:  http://localhost:5000
2. Find your ThinkPad's local IP:
   - Open Command Prompt and type: ipconfig
   - Look for "IPv4 Address" under your WiFi adapter
   - Usually something like 192.168.1.xxx

3. iPhone: open Safari and go to  http://[your-ip]:5000/capture
   - Both devices must be on the same WiFi network
   - Allow camera access when prompted
   - Use the back camera, good lighting, white tray

## Workflow

1. Enter lot info on ThinkPad (lot ID, grower, variety, spec)
2. Spread berries on white tray under your light
3. Sort softs to bottom-right corner, reds to bottom-left, 
   anthracnose suspects to top-right
4. On iPhone: tap capture
5. Counts auto-populate on ThinkPad dashboard in ~3 seconds
6. Adjust any counts if needed, hit LOG SAMPLE
