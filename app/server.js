/**
 * BerryCheck relay server.
 * - Proxies to Vite dev server for the app UI
 * - WebSocket relay: phone sends captured image → laptop receives it instantly
 * - In production (with dist/ built), serves static files directly
 *
 * Usage: node server.js
 * Everything runs on port 5175 — phone and laptop both use this one URL.
 */

import { WebSocketServer } from 'ws'
import express from 'express'
import { createServer } from 'http'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server })

// --- WebSocket relay ---
const clients = new Map()

wss.on('connection', (ws, req) => {
  const params = new URL(req.url, 'http://localhost').searchParams
  const role = params.get('role') || 'dashboard'
  clients.set(ws, { role })

  const phoneCount = [...clients.values()].filter(c => c.role === 'phone').length
  const dashCount = [...clients.values()].filter(c => c.role === 'dashboard').length
  const graderCount = [...clients.values()].filter(c => c.role === 'grader').length
  const scaleCount = [...clients.values()].filter(c => c.role === 'scale').length
  console.log(`[connect] ${role} (phones: ${phoneCount}, dashboards: ${dashCount}, graders: ${graderCount}, scales: ${scaleCount})`)

  broadcast({ type: 'status', phones: phoneCount, dashboards: dashCount, graders: graderCount, scales: scaleCount }, 'dashboard')

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw)

      // Phone → dashboard: image relay
      if (msg.type === 'image' && role === 'phone') {
        console.log(`[relay] image from phone → ${dashCount} dashboard(s)`)
        broadcast({
          type: 'image',
          data: msg.data,
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false })
        }, 'dashboard')
        ws.send(JSON.stringify({ type: 'ack', message: 'Sent to dashboard' }))
      }

      // Grader → dashboard: frames, status, sample data
      if (role === 'grader' && (msg.type === 'grader_frame' || msg.type === 'grader_status' || msg.type === 'sample')) {
        broadcast(msg, 'dashboard')
      }

      // Scale → dashboard: weight readings, status, acks
      if (role === 'scale' && (msg.type === 'scale_weight' || msg.type === 'scale_status' || msg.type === 'scale_ack')) {
        broadcast(msg, 'dashboard')
      }

      // Dashboard → grader: commands (start_scan, abort, tare, calibrate, hsv updates)
      if (role === 'dashboard' && msg.type === 'command') {
        broadcast(msg, 'grader')
      }

      // Dashboard → scale: commands (tare, calweight, getcal)
      if (role === 'dashboard' && msg.type === 'scale_command') {
        broadcast(msg, 'scale')
      }
    } catch (e) {
      console.error('[error]', e.message)
    }
  })

  ws.on('close', () => {
    clients.delete(ws)
    const pc = [...clients.values()].filter(c => c.role === 'phone').length
    const dc = [...clients.values()].filter(c => c.role === 'dashboard').length
    const gc = [...clients.values()].filter(c => c.role === 'grader').length
    const sc = [...clients.values()].filter(c => c.role === 'scale').length
    console.log(`[disconnect] ${role} (phones: ${pc}, dashboards: ${dc}, graders: ${gc}, scales: ${sc})`)
    broadcast({ type: 'status', phones: pc, dashboards: dc, graders: gc, scales: sc }, 'dashboard')
  })
})

function broadcast(msg, targetRole) {
  const payload = JSON.stringify(msg)
  for (const [ws, info] of clients) {
    if (info.role === targetRole && ws.readyState === 1) {
      ws.send(payload)
    }
  }
}

// --- Local IP endpoint ---
import { networkInterfaces } from 'os'

function getLocalIP() {
  const nets = networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address
    }
  }
  return 'localhost'
}

app.get('/api/ip', (req, res) => {
  res.json({ ip: getLocalIP(), port: PORT })
})

// --- Shared storage (replaces localStorage — all devices share one store) ---
import { readFileSync, writeFileSync, mkdirSync } from 'fs'

const DATA_DIR = join(__dirname, 'data')
try { mkdirSync(DATA_DIR, { recursive: true }) } catch {}

function storePath(key) { return join(DATA_DIR, key + '.json') }

app.get('/api/store/:key', (req, res) => {
  try {
    const data = readFileSync(storePath(req.params.key), 'utf-8')
    res.type('application/json').send(data)
  } catch {
    res.json(null)
  }
})

app.put('/api/store/:key', express.json({ limit: '10mb' }), (req, res) => {
  try {
    writeFileSync(storePath(req.params.key), JSON.stringify(req.body))
    broadcast({ type: 'sync', key: req.params.key }, 'dashboard')
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// --- Phone image HTTP fallback (when WebSocket doesn't connect) ---
app.post('/api/phone-image', express.json({ limit: '10mb' }), (req, res) => {
  const { data } = req.body
  if (data) {
    broadcast({
      type: 'image',
      data,
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
    }, 'dashboard')
    res.json({ ok: true })
  } else {
    res.status(400).json({ error: 'No image data' })
  }
})

// --- Sample POST fallback (grader → berrycheck when WebSocket is down) ---
app.post('/api/sample', express.json({ limit: '10mb' }), (req, res) => {
  const msg = { type: 'sample', data: req.body }
  broadcast(msg, 'dashboard')
  console.log('[api] Sample received via HTTP POST → dashboards')
  res.json({ ok: true })
})

// --- Snapshot sharing ---
// App posts a data snapshot, gets back an ID. Viewer fetches by ID.
const snapshots = new Map()

app.use(express.json({ limit: '2mb' }))

app.post('/api/share', (req, res) => {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
  const snapshot = {
    ...req.body,
    createdAt: new Date().toISOString(),
    id,
  }
  snapshots.set(id, snapshot)
  // Clean up old snapshots (keep last 50)
  if (snapshots.size > 50) {
    const oldest = snapshots.keys().next().value
    snapshots.delete(oldest)
  }
  res.json({ id, url: `http://${getLocalIP()}:${PORT}/?mode=view&id=${id}` })
})

app.get('/api/share/:id', (req, res) => {
  const snapshot = snapshots.get(req.params.id)
  if (!snapshot) return res.status(404).json({ error: 'Snapshot expired or not found' })
  res.json(snapshot)
})

// Daily summary — stores day summaries for archive access
const dailySummaries = new Map()

app.post('/api/daily', (req, res) => {
  const { date, data } = req.body
  dailySummaries.set(date, { ...data, date, updatedAt: new Date().toISOString() })
  // Keep last 90 days
  if (dailySummaries.size > 90) {
    const oldest = dailySummaries.keys().next().value
    dailySummaries.delete(oldest)
  }
  res.json({ ok: true })
})

app.get('/api/daily/:date', (req, res) => {
  const summary = dailySummaries.get(req.params.date)
  if (!summary) return res.status(404).json({ error: 'No data for this date' })
  res.json(summary)
})

app.get('/api/daily', (req, res) => {
  const dates = [...dailySummaries.keys()].sort().reverse()
  res.json(dates)
})

// --- HTTP serving ---
const distPath = join(__dirname, 'dist')
const VITE_PORT = 5176

if (existsSync(distPath)) {
  // Production: serve built files
  console.log('[mode] production — serving from dist/')
  app.use(express.static(distPath))
  app.get('/{*path}', (req, res) => {
    res.sendFile(join(distPath, 'index.html'))
  })
} else {
  // Dev: proxy everything to Vite
  console.log(`[mode] dev — proxying to Vite on port ${VITE_PORT}`)
  app.use('/{*path}', createProxyMiddleware({
    target: `http://localhost:${VITE_PORT}`,
    changeOrigin: true,
    ws: false, // we handle our own WS
  }))
}

const PORT = 5175
server.listen(PORT, '0.0.0.0', () => {
  console.log('')
  console.log('  BerryCheck server running on port ' + PORT)
  console.log('')
  console.log(`  Laptop:  http://localhost:${PORT}`)
  console.log(`  Phone:   http://192.168.1.223:${PORT}/?mode=phone`)
  console.log('')
})
