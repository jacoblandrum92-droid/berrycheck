import { app, BrowserWindow, Menu } from 'electron';
import { fileURLToPath } from 'url';
import path from 'path';
import { spawn, spawnSync } from 'child_process';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import express from 'express';
import { networkInterfaces } from 'os';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'fs';

// Find a working Python interpreter — never hard-code a user-specific path.
// Tries PATH first, then common Windows install locations. Cached after first hit.
let _pythonPath = null;
function findPython() {
  if (_pythonPath) return _pythonPath;
  const candidates = ['python', 'python3', 'py'];
  const localApp = process.env.LOCALAPPDATA || '';
  for (const ver of ['Python313', 'Python312', 'Python311', 'Python310']) {
    if (localApp) candidates.push(path.join(localApp, 'Programs', 'Python', ver, 'python.exe'));
    candidates.push(`C:\\${ver}\\python.exe`);
  }
  for (const p of candidates) {
    try {
      const r = spawnSync(p, ['--version'], { stdio: 'ignore' });
      if (r.status === 0) { _pythonPath = p; console.log(`[python] using ${p}`); return p; }
    } catch {}
  }
  console.error('[python] No Python interpreter found. Install from python.org and check "Add to PATH".');
  return null;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

// Suppress pipe errors from child processes dying
process.on('uncaughtException', (err) => {
  if (err.code === 'EPIPE' || err.code === 'ENOENT') return;
  console.error('[fatal]', err);
});

let cameraProcess = null;
let scaleProcess = null;
let httpServer = null;

// --- Minimal relay server (WebSocket only + API endpoints) ---
function startRelay() {
  const expressApp = express();
  httpServer = createServer(expressApp);
  const wss = new WebSocketServer({ server: httpServer });
  const clients = new Map();

  wss.on('connection', (ws, req) => {
    const params = new URL(req.url, 'http://localhost').searchParams;
    const role = params.get('role') || 'dashboard';
    clients.set(ws, { role });

    const count = (r) => [...clients.values()].filter(c => c.role === r).length;
    console.log(`[ws] ${role} connected (phones: ${count('phone')}, dashboards: ${count('dashboard')}, graders: ${count('grader')}, scales: ${count('scale')})`);
    broadcast({ type: 'status', phones: count('phone'), dashboards: count('dashboard'), graders: count('grader'), scales: count('scale') }, 'dashboard');

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'image' && role === 'phone') {
          broadcast({ type: 'image', data: msg.data, timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }) }, 'dashboard');
          ws.send(JSON.stringify({ type: 'ack', message: 'Sent to dashboard' }));
        }
        if (role === 'grader' && (msg.type === 'grader_frame' || msg.type === 'grader_status' || msg.type === 'sample' || msg.type === 'training_capture')) {
          broadcast(msg, 'dashboard');
        }
        if (role === 'scale' && (msg.type === 'scale_weight' || msg.type === 'scale_status' || msg.type === 'scale_ack')) {
          broadcast(msg, 'dashboard');
        }
        if (role === 'dashboard' && msg.type === 'command') {
          broadcast(msg, 'grader');
        }
        if (role === 'dashboard' && msg.type === 'scale_command') {
          broadcast(msg, 'scale');
        }
      } catch (e) { console.error('[ws]', e.message); }
    });

    ws.on('close', () => {
      clients.delete(ws);
      broadcast({ type: 'status', phones: count('phone'), dashboards: count('dashboard'), graders: count('grader'), scales: count('scale') }, 'dashboard');
    });
  });

  function broadcast(msg, targetRole) {
    const payload = JSON.stringify(msg);
    for (const [ws, info] of clients) {
      if (info.role === targetRole && ws.readyState === 1) ws.send(payload);
    }
  }

  function getLocalIP() {
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) return net.address;
      }
    }
    return 'localhost';
  }

  expressApp.use(express.json({ limit: '10mb' }));
  expressApp.get('/api/ip', (req, res) => res.json({ ip: getLocalIP(), port: 5175 }));

  // Shared storage
  const dataDir = app.isPackaged
    ? path.join(path.dirname(app.getPath('exe')), 'data')
    : path.join(rootDir, 'data');
  try { mkdirSync(dataDir, { recursive: true }) } catch {}

  expressApp.get('/api/store/:key', (req, res) => {
    try {
      const data = readFileSync(path.join(dataDir, req.params.key + '.json'), 'utf-8');
      res.type('application/json').send(data);
    } catch { res.json(null); }
  });
  expressApp.put('/api/store/:key', (req, res) => {
    try {
      writeFileSync(path.join(dataDir, req.params.key + '.json'), JSON.stringify(req.body));
      // Notify all dashboards that this key changed
      broadcast({ type: 'sync', key: req.params.key }, 'dashboard');
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Phone image HTTP fallback (when WebSocket doesn't connect)
  expressApp.post('/api/phone-image', (req, res) => {
    const { data } = req.body;
    if (data) {
      broadcast({
        type: 'image',
        data,
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      }, 'dashboard');
      res.json({ ok: true });
    } else {
      res.status(400).json({ error: 'No image data' });
    }
  });

  expressApp.post('/api/sample', (req, res) => {
    broadcast({ type: 'sample', data: req.body }, 'dashboard');
    res.json({ ok: true });
  });

  // Daily summaries
  const dailySummaries = new Map();
  expressApp.post('/api/daily', (req, res) => {
    const { date, data } = req.body;
    dailySummaries.set(date, { ...data, date, updatedAt: new Date().toISOString() });
    if (dailySummaries.size > 90) dailySummaries.delete(dailySummaries.keys().next().value);
    res.json({ ok: true });
  });
  expressApp.get('/api/daily/:date', (req, res) => {
    const s = dailySummaries.get(req.params.date);
    if (!s) return res.status(404).json({ error: 'No data' });
    res.json(s);
  });
  expressApp.get('/api/daily', (req, res) => res.json([...dailySummaries.keys()].sort().reverse()));

  // Snapshots
  const snapshots = new Map();
  expressApp.post('/api/share', (req, res) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    snapshots.set(id, { ...req.body, createdAt: new Date().toISOString(), id });
    if (snapshots.size > 50) snapshots.delete(snapshots.keys().next().value);
    res.json({ id, url: `http://${getLocalIP()}:5175/?mode=view&id=${id}` });
  });
  expressApp.get('/api/share/:id', (req, res) => {
    const s = snapshots.get(req.params.id);
    if (!s) return res.status(404).json({ error: 'Not found' });
    res.json(s);
  });

  // Restart camera service endpoint
  expressApp.post('/api/restart-camera', (req, res) => {
    if (cameraProcess && !cameraProcess.killed) {
      cameraProcess.kill();
      cameraProcess = null;
    }
    setTimeout(() => {
      startCamera();
      res.json({ ok: true, message: 'Camera service restarted' });
    }, 500);
  });

  // --- YOLO training data endpoints (mirrors server.js) ---
  const appDir = app.isPackaged ? path.dirname(app.getPath('exe')) : rootDir;
  const mlDatasetDir = path.join(appDir, 'ml', 'dataset');

  expressApp.get('/api/training-count', (req, res) => {
    try {
      const trainDir = path.join(mlDatasetDir, 'images', 'train');
      const files = readdirSync(trainDir).filter(f => f.endsWith('.jpg'));
      res.json({ count: files.length });
    } catch {
      res.json({ count: 0 });
    }
  });

  expressApp.post('/api/training-data', (req, res) => {
    const { image, labels, width, height } = req.body || {};
    if (!image || !labels) return res.status(400).json({ error: 'Missing image or labels' });

    const trainImgDir = path.join(mlDatasetDir, 'images', 'train');
    const trainLblDir = path.join(mlDatasetDir, 'labels', 'train');
    mkdirSync(trainImgDir, { recursive: true });
    mkdirSync(trainLblDir, { recursive: true });

    let idx = 0;
    try {
      const existing = readdirSync(trainImgDir).filter(f => f.endsWith('.jpg'));
      const nums = existing.map(f => parseInt(f)).filter(n => !isNaN(n));
      if (nums.length > 0) idx = Math.max(...nums) + 1;
    } catch {}
    const name = String(idx).padStart(4, '0');

    const imgBuf = Buffer.from(image, 'base64');
    writeFileSync(path.join(trainImgDir, `${name}.jpg`), imgBuf);

    const yoloLines = labels.map(({ x, y, r }) => {
      const cx = Math.max(0, Math.min(1, x / width));
      const cy = Math.max(0, Math.min(1, y / height));
      const bw = Math.max(0, Math.min(1, (2 * r) / width));
      const bh = Math.max(0, Math.min(1, (2 * r) / height));
      return `0 ${cx.toFixed(6)} ${cy.toFixed(6)} ${bw.toFixed(6)} ${bh.toFixed(6)}`;
    }).join('\n');
    writeFileSync(path.join(trainLblDir, `${name}.txt`), yoloLines);

    const total = readdirSync(trainImgDir).filter(f => f.endsWith('.jpg')).length;
    console.log(`[training] Saved ${name}.jpg with ${labels.length} labels (${total} total)`);
    res.json({ ok: true, idx, count: total });
  });

  expressApp.post('/api/start-training', (req, res) => {
    const trainScript = path.join(appDir, 'ml', 'train.py');
    if (!existsSync(trainScript)) return res.status(404).json({ error: 'train.py not found' });
    const pythonPath = findPython();
    if (!pythonPath) return res.status(500).json({ error: 'Python not found' });

    const trainProc = spawn(pythonPath, ['-u', trainScript], {
      cwd: path.join(appDir, 'ml'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    trainProc.stdout.on('data', d => process.stdout.write('[train] ' + d));
    trainProc.stderr.on('data', d => process.stderr.write('[train] ' + d));
    trainProc.on('close', code => console.log(`[train] Finished (code ${code})`));

    console.log(`[train] Started training (PID ${trainProc.pid})`);
    res.json({ ok: true, pid: trainProc.pid });
  });

  // Serve the built app
  const distDir = app.isPackaged
    ? path.join(path.dirname(app.getPath('exe')), 'dist')
    : path.join(rootDir, 'dist');
  expressApp.use(express.static(distDir));
  expressApp.get('/{*path}', (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });

  httpServer.listen(5175, '0.0.0.0', () => {
    console.log('[relay] Serving app + WebSocket + API on port 5175');
  });

  httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error('[relay] Port 5175 is already in use — killing the other process...');
      // Find and kill whatever is hogging the port, then retry
      const { execSync } = require('child_process');
      try {
        const out = execSync('netstat -ano | findstr :5175 | findstr LISTENING', { encoding: 'utf-8' });
        const pids = [...new Set(out.trim().split('\n').map(l => l.trim().split(/\s+/).pop()))];
        for (const pid of pids) {
          if (pid && pid !== '0') {
            console.log(`[relay] Killing PID ${pid} on port 5175`);
            try { execSync(`taskkill /PID ${pid} /F`); } catch {}
          }
        }
        setTimeout(() => {
          httpServer.listen(5175, '0.0.0.0', () => {
            console.log('[relay] Serving app + WebSocket + API on port 5175 (after reclaim)');
          });
        }, 1000);
      } catch (e) {
        console.error('[relay] Could not reclaim port 5175:', e.message);
      }
    }
  });
}

function startCamera() {
  const appDir = app.isPackaged ? path.dirname(app.getPath('exe')) : rootDir;
  const scriptPath = path.join(appDir, 'camera_service.py');
  const pythonPath = findPython();
  if (!pythonPath) return;
  cameraProcess = spawn(pythonPath, ['-u', scriptPath], {
    cwd: appDir,
    stdio: 'pipe',
    env: { ...process.env },
  });
  cameraProcess.stdout.on('data', (d) => { try { console.log('[camera]', d.toString().trim()) } catch {} });
  cameraProcess.stderr.on('data', (d) => { try { console.error('[camera]', d.toString().trim()) } catch {} });
  cameraProcess.on('error', () => { cameraProcess = null; });
  cameraProcess.on('close', () => { cameraProcess = null; });
}

function startScale() {
  const appDir = app.isPackaged ? path.dirname(app.getPath('exe')) : rootDir;
  const scriptPath = path.join(appDir, 'scale_service.py');
  const pythonPath = findPython();
  if (!pythonPath) return;
  scaleProcess = spawn(pythonPath, ['-u', scriptPath], {
    cwd: appDir,
    stdio: 'pipe',
    env: { ...process.env },
  });
  scaleProcess.stdout.on('data', (d) => { try { console.log('[scale]', d.toString().trim()) } catch {} });
  scaleProcess.stderr.on('data', (d) => { try { console.error('[scale]', d.toString().trim()) } catch {} });
  scaleProcess.on('error', () => { scaleProcess = null; });
  scaleProcess.on('close', () => { scaleProcess = null; });
}

function stopServices() {
  if (cameraProcess && !cameraProcess.killed) { cameraProcess.kill(); cameraProcess = null; }
  if (scaleProcess && !scaleProcess.killed) { scaleProcess.kill(); scaleProcess = null; }
  if (httpServer) { httpServer.close(); httpServer = null; }
}

function createWindow() {
  Menu.setApplicationMenu(null);

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'BerryCheck',
    autoHideMenuBar: true,
    icon: path.join(rootDir, 'public', 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Always load from the relay server — API calls and WebSocket need same origin
  setTimeout(() => {
    win.loadURL('http://localhost:5175');
  }, 1000);
}

app.whenReady().then(() => {
  startRelay();
  startCamera();
  startScale();
  createWindow();
});

app.on('window-all-closed', () => { stopServices(); app.quit(); });
app.on('before-quit', () => { stopServices(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
