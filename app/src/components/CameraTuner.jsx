import React, { useState, useEffect, useRef, useCallback } from 'react'
import { COLORS, FONT } from '../constants'

// Zone boundaries — fraction of frame dimensions (camera is fixed-mount)
// Bottom rows are defect zones, rest is sample berries
const ZONE_LINE_Y = 0.75       // berries below this Y fraction = defect zone
const ZONE_LEFT_X = 0.33       // defect zone: left of this = scars
const ZONE_RIGHT_X = 0.67      // defect zone: right of this = green/red

function classifyBerries(berries, width, height) {
  let sample = 0, scars = 0, condition = 0, greenRed = 0
  const yLine = height * ZONE_LINE_Y
  const xLeft = width * ZONE_LEFT_X
  const xRight = width * ZONE_RIGHT_X

  for (const b of berries) {
    if (b.y < yLine) {
      sample++
    } else if (b.x < xLeft) {
      scars++
    } else if (b.x < xRight) {
      condition++
    } else {
      greenRed++
    }
  }
  return { total: berries.length, sample, zones: { scars, condition, greenRed } }
}

/**
 * CameraTuner — inline component for QC view.
 * Shows live camera feed with berry detection, HSV tuning sliders,
 * a USE COUNT button that sends the berry count to CountEntry,
 * and a LABEL mode for capturing YOLO training data.
 *
 * Props:
 *   wsRef           — ref to the relay WebSocket
 *   graderConnected — boolean
 *   onUseCount      — callback(count) to send berry count to the QC form
 */

export default function CameraTuner({ wsRef, graderConnected, relayConnected, onUseCount }) {
  const canvasRef = useRef(null)
  const maskCanvasRef = useRef(null)
  const filteredCanvasRef = useRef(null)
  const [showMask, setShowMask] = useState(false)
  const [showFiltered, setShowFiltered] = useState(false)
  const [showTuning, setShowTuning] = useState(false)
  const [profile, setProfile] = useState('blueberry')
  const [profiles, setProfiles] = useState({})
  const [berryCount, setBerryCount] = useState(0)
  const [fps, setFps] = useState(0)
  const [hsv, setHsv] = useState({
    h_low: 90, h_high: 145,
    s_low: 30, s_high: 255,
    v_low: 30, v_high: 200,
  })
  const [blur, setBlur] = useState(true)
  const [minArea, setMinArea] = useState(300)
  const [maxArea, setMaxArea] = useState(50000)
  const [crop, setCrop] = useState({ left: 0.06, right: 0.02, top: 0.0, bottom: 0.04 })
  const cropTimeout = useRef(null)
  const frameCountRef = useRef(0)
  const lastFpsTime = useRef(Date.now())
  const latestCountRef = useRef(0)
  const latestBerriesRef = useRef([])
  const frameDimsRef = useRef({ width: 1920, height: 1080 })

  // Label mode state
  const [labelMode, setLabelMode] = useState(false)
  const [frozenRaw, setFrozenRaw] = useState(null)
  const [markers, setMarkers] = useState([])
  const [imgDims, setImgDims] = useState({ width: 1920, height: 1080 })
  const [trainingCount, setTrainingCount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [labelRadius, setLabelRadius] = useState(25)
  const labelModeRef = useRef(false)

  const sendCommand = useCallback((cmd) => {
    if (wsRef?.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'command', ...cmd }))
    }
  }, [wsRef])

  const updateCrop = useCallback((side, value) => {
    setCrop(prev => {
      const next = { ...prev, [side]: value }
      clearTimeout(cropTimeout.current)
      cropTimeout.current = setTimeout(() => {
        if (wsRef?.current && wsRef.current.readyState === 1) {
          wsRef.current.send(JSON.stringify({ type: 'command', action: 'update_crop', ...next }))
        }
      }, 50)
      return next
    })
  }, [wsRef])

  const hsvTimeout = useRef(null)
  const updateHsv = useCallback((key, value) => {
    const next = { ...hsv, [key]: value }
    setHsv(next)
    clearTimeout(hsvTimeout.current)
    hsvTimeout.current = setTimeout(() => {
      sendCommand({ action: 'update_hsv', ...next })
    }, 50)
  }, [hsv, sendCommand])

  const handleFrame = useCallback((msg) => {
    // Pick up profile list from grader_status
    if (msg.type === 'grader_status' && msg.profiles) {
      setProfiles(msg.profiles)
      if (msg.profile) setProfile(msg.profile)
      return
    }

    // Training capture response — enter label mode
    if (msg.type === 'training_capture') {
      setFrozenRaw(msg.raw)
      setImgDims({ width: msg.width, height: msg.height })
      // Pre-fill markers from detection (YOLO or HSV) as starting guess
      const autoDetected = (msg.berries || []).map(b => ({ x: b.x, y: b.y, r: Math.max(b.r, 15) }))
      if (autoDetected.length > 0) {
        const radii = autoDetected.map(m => m.r).sort((a, b) => a - b)
        setLabelRadius(Math.max(radii[Math.floor(radii.length / 2)], 20))
      } else {
        setLabelRadius(25)
      }
      setMarkers(autoDetected)
      setLabelMode(true)
      labelModeRef.current = true
      return
    }

    if (msg.type !== 'grader_frame') return

    // Don't update canvas in label mode — frame is frozen
    if (labelModeRef.current) return

    const count = msg.count || 0
    setBerryCount(count)
    latestCountRef.current = count
    if (msg.berries) latestBerriesRef.current = msg.berries
    if (msg.frame && canvasRef.current) frameDimsRef.current = { width: canvasRef.current.width || 1920, height: canvasRef.current.height || 1080 }

    if (msg.hsv) setHsv(prev => {
      const same = Object.keys(msg.hsv).every(k => prev[k] === msg.hsv[k])
      return same ? prev : msg.hsv
    })
    if (msg.blur !== undefined) setBlur(msg.blur)
    if (msg.profile) setProfile(msg.profile)
    if (msg.crop) setCrop(prev => {
      const same = ['left','right','top','bottom'].every(k => prev[k] === msg.crop[k])
      return same ? prev : msg.crop
    })

    frameCountRef.current++
    const now = Date.now()
    if (now - lastFpsTime.current >= 1000) {
      setFps(frameCountRef.current)
      frameCountRef.current = 0
      lastFpsTime.current = now
    }

    if (msg.frame && canvasRef.current) {
      const img = new Image()
      img.onload = () => {
        const canvas = canvasRef.current
        if (!canvas) return
        canvas.width = img.width
        canvas.height = img.height
        canvas.getContext('2d').drawImage(img, 0, 0)
      }
      img.src = 'data:image/jpeg;base64,' + msg.frame
    }

    if (msg.mask && maskCanvasRef.current && showMask) {
      const img = new Image()
      img.onload = () => {
        const canvas = maskCanvasRef.current
        if (!canvas) return
        canvas.width = img.width
        canvas.height = img.height
        canvas.getContext('2d').drawImage(img, 0, 0)
      }
      img.src = 'data:image/png;base64,' + msg.mask
    }

    if (msg.filtered && filteredCanvasRef.current && showFiltered) {
      const img = new Image()
      img.onload = () => {
        const canvas = filteredCanvasRef.current
        if (!canvas) return
        canvas.width = img.width
        canvas.height = img.height
        canvas.getContext('2d').drawImage(img, 0, 0)
      }
      img.src = 'data:image/jpeg;base64,' + msg.filtered
    }
  }, [showMask, showFiltered])

  useEffect(() => {
    if (!relayConnected || !wsRef?.current) return
    const ws = wsRef.current
    const handler = (event) => {
      try { handleFrame(JSON.parse(event.data)) } catch {}
    }
    ws.addEventListener('message', handler)
    return () => ws.removeEventListener('message', handler)
  }, [relayConnected, wsRef, handleFrame])

  // Fetch training count on mount and after saves
  useEffect(() => {
    fetch('/api/training-count').then(r => r.json()).then(d => {
      if (d && typeof d.count === 'number') setTrainingCount(d.count)
    }).catch(() => {})
  }, [saving])

  // Draw frozen frame + markers in label mode
  useEffect(() => {
    if (!labelMode || !frozenRaw || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const img = new Image()
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)
      markers.forEach((m, i) => {
        // Filled semi-transparent circle
        ctx.beginPath()
        ctx.arc(m.x, m.y, m.r, 0, 2 * Math.PI)
        ctx.fillStyle = 'rgba(0, 255, 0, 0.25)'
        ctx.fill()
        ctx.strokeStyle = '#00ff00'
        ctx.lineWidth = 3
        ctx.stroke()
        // Number label with background
        const label = String(i + 1)
        ctx.font = 'bold 18px monospace'
        const tw = ctx.measureText(label).width
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
        ctx.fillRect(m.x - tw / 2 - 3, m.y - m.r - 24, tw + 6, 22)
        ctx.fillStyle = '#00ff00'
        ctx.fillText(label, m.x - tw / 2, m.y - m.r - 6)
      })
    }
    img.src = 'data:image/jpeg;base64,' + frozenRaw
  }, [labelMode, frozenRaw, markers])

  // Map click position to image coordinates, accounting for objectFit: contain letterboxing
  const clickToImageCoords = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const canvasAspect = canvas.width / canvas.height
    const elemAspect = rect.width / rect.height
    let renderW, renderH, offsetX, offsetY
    if (canvasAspect > elemAspect) {
      // Wider than element — letterbox top/bottom
      renderW = rect.width
      renderH = rect.width / canvasAspect
      offsetX = 0
      offsetY = (rect.height - renderH) / 2
    } else {
      // Taller than element — letterbox left/right
      renderH = rect.height
      renderW = rect.height * canvasAspect
      offsetX = (rect.width - renderW) / 2
      offsetY = 0
    }
    const x = Math.round((e.clientX - rect.left - offsetX) * (canvas.width / renderW))
    const y = Math.round((e.clientY - rect.top - offsetY) * (canvas.height / renderH))
    // Ignore clicks in the letterbox padding
    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) return null
    return { x, y }
  }, [])

  // Canvas click — add/remove markers in label mode
  const handleCanvasClick = useCallback((e) => {
    if (!labelModeRef.current) return
    const coords = clickToImageCoords(e)
    if (!coords) return
    const { x: imgX, y: imgY } = coords

    setMarkers(prev => {
      const hitIdx = prev.findIndex(m => {
        const dist = Math.sqrt((m.x - imgX) ** 2 + (m.y - imgY) ** 2)
        return dist < m.r * 1.5
      })
      if (hitIdx >= 0) {
        return prev.filter((_, i) => i !== hitIdx)
      } else {
        return [...prev, { x: imgX, y: imgY, r: labelRadius }]
      }
    })
  }, [labelRadius])

  // Scroll wheel adjusts label radius
  const handleCanvasWheel = useCallback((e) => {
    if (!labelModeRef.current) return
    e.preventDefault()
    const delta = e.deltaY > 0 ? -3 : 3
    setLabelRadius(prev => Math.max(8, Math.min(60, prev + delta)))
  }, [])

  const saveTrainingData = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/training-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: frozenRaw,
          labels: markers,
          width: imgDims.width,
          height: imgDims.height,
        }),
      })
      const data = await res.json()
      if (data.count) setTrainingCount(data.count)
      const classified = classifyBerries(markers, imgDims.width, imgDims.height)
      onUseCount(classified)
      setLabelMode(false)
      labelModeRef.current = false
      setMarkers([])
      setFrozenRaw(null)
    } catch (e) {
      console.error('Save failed:', e)
    }
    setSaving(false)
  }, [frozenRaw, markers, imgDims])

  const cancelLabel = useCallback(() => {
    setLabelMode(false)
    labelModeRef.current = false
    setMarkers([])
    setFrozenRaw(null)
  }, [])

  const [retrying, setRetrying] = useState(false)
  const retryCamera = useCallback(() => {
    setRetrying(true)
    fetch('/api/restart-camera', { method: 'POST' })
      .catch(() => {})
      .finally(() => setTimeout(() => setRetrying(false), 3000))
  }, [])

  if (!graderConnected) {
    return (
      <div style={{
        background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
        borderRadius: 4, padding: 16, textAlign: 'center',
      }}>
        <div style={{ fontFamily: FONT, fontSize: 10, color: COLORS.text3, letterSpacing: '0.06em' }}>
          GRADER OFFLINE
        </div>
        <button onClick={retryCamera} disabled={retrying} style={{
          fontFamily: FONT, fontSize: 10, fontWeight: 600,
          color: retrying ? COLORS.text3 : COLORS.green,
          background: retrying ? COLORS.bg3 : COLORS.green + '15',
          border: `1px solid ${retrying ? COLORS.border : COLORS.green}`,
          padding: '6px 16px', borderRadius: 4, cursor: retrying ? 'default' : 'pointer',
          marginTop: 8, letterSpacing: '0.06em',
        }}>
          {retrying ? 'CONNECTING...' : 'RETRY CAMERA'}
        </button>
      </div>
    )
  }

  const sliderRow = (label, key, min, max) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
      <span style={{ width: 40, fontSize: 10, textAlign: 'right', color: COLORS.text3 }}>{label}</span>
      <input
        type="range" min={min} max={max} value={hsv[key]}
        onChange={e => updateHsv(key, parseInt(e.target.value))}
        style={{ flex: 1, height: 4 }}
      />
      <span style={{ width: 24, fontSize: 10, color: COLORS.text2 }}>{hsv[key]}</span>
    </div>
  )

  return (
    <div style={{
      background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
      borderRadius: 4, overflow: 'hidden',
    }}>
      {/* Header strip */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '6px 10px', borderBottom: `1px solid ${COLORS.border}`,
        background: labelMode ? '#1a2f1a' : COLORS.bg3,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: labelMode ? COLORS.amber : COLORS.green,
            boxShadow: `0 0 6px ${labelMode ? COLORS.amber : COLORS.green}`,
          }} />
          <span style={{ fontFamily: FONT, fontSize: 10, color: labelMode ? COLORS.amber : COLORS.green, letterSpacing: '0.06em', fontWeight: 600 }}>
            {labelMode ? 'LABEL MODE' : 'CAMERA'}
          </span>
          {!labelMode && Object.keys(profiles).length > 0 && Object.entries(profiles).map(([key, label]) => (
            <button key={key} onClick={() => {
              setProfile(key)
              sendCommand({ action: 'set_profile', name: key })
            }} style={{
              fontFamily: FONT, fontSize: 8, fontWeight: 600,
              color: profile === key ? COLORS.green : COLORS.text3,
              background: profile === key ? COLORS.green + '20' : 'transparent',
              border: `1px solid ${profile === key ? COLORS.green : COLORS.border}`,
              padding: '2px 6px', borderRadius: 3, cursor: 'pointer',
              letterSpacing: '0.04em',
            }}>
              {label}
            </button>
          ))}
          {!labelMode && (
            <span style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3 }}>
              {fps} fps
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!labelMode && (
            <button onClick={retryCamera} disabled={retrying} title="Restart the camera helper if the feed is frozen or wrong" style={{
              fontFamily: FONT, fontSize: 8, fontWeight: 700,
              color: retrying ? COLORS.text3 : COLORS.text2,
              background: 'transparent',
              border: `1px solid ${retrying ? COLORS.border : COLORS.border2}`,
              padding: '2px 6px', borderRadius: 3,
              cursor: retrying ? 'default' : 'pointer',
              letterSpacing: '0.08em',
            }}>{retrying ? '...' : 'RESTART'}</button>
          )}
          {trainingCount > 0 && (
            <span style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3 }}>
              {trainingCount} labeled
            </span>
          )}
          <span style={{
            fontFamily: FONT, fontSize: 14, fontWeight: 700,
            color: labelMode ? COLORS.amber : COLORS.green,
          }}>
            {labelMode ? markers.length : berryCount}
          </span>
          <span style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3 }}>berries</span>
        </div>
      </div>

      {/* Camera feed */}
      <div style={{ position: 'relative', background: '#000' }}>
        <canvas ref={canvasRef} onClick={handleCanvasClick} onWheel={handleCanvasWheel} style={{
          width: '100%', maxHeight: labelMode ? 300 : ((showMask || showFiltered) ? 140 : 200),
          objectFit: 'contain', display: 'block',
          cursor: labelMode ? 'crosshair' : 'default',
        }} />
        {!labelMode && showMask && (
          <canvas ref={maskCanvasRef} style={{
            width: '100%', maxHeight: 100, objectFit: 'contain', display: 'block',
            borderTop: '1px solid #333',
          }} />
        )}
        {!labelMode && showFiltered && (
          <canvas ref={filteredCanvasRef} style={{
            width: '100%', maxHeight: 100, objectFit: 'contain', display: 'block',
            borderTop: '1px solid #333',
          }} />
        )}
        {labelMode && (
          <>
            <div style={{
              position: 'absolute', bottom: 6, left: 6,
              fontFamily: FONT, fontSize: 9, color: COLORS.text3,
              background: 'rgba(0,0,0,0.7)', padding: '3px 6px', borderRadius: 3,
            }}>
              Click to add — click circle to remove — scroll to resize
            </div>
            <div style={{
              position: 'absolute', bottom: 6, right: 6,
              fontFamily: FONT, fontSize: 10, color: COLORS.amber, fontWeight: 700,
              background: 'rgba(0,0,0,0.7)', padding: '3px 8px', borderRadius: 3,
            }}>
              r={labelRadius}
            </div>
          </>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ padding: '6px 10px', display: 'flex', gap: 6 }}>
        {labelMode ? (
          <>
            <button onClick={saveTrainingData} disabled={saving} style={{
              flex: 1, fontFamily: FONT, fontSize: 12, fontWeight: 700,
              color: '#fff', background: saving ? COLORS.text3 : COLORS.green,
              border: 'none', padding: '10px', borderRadius: 4,
              cursor: saving ? 'default' : 'pointer', letterSpacing: '0.06em',
            }}>
              {saving ? 'SAVING...' : `SAVE (${markers.length} berries)`}
            </button>
            <button onClick={cancelLabel} style={{
              fontFamily: FONT, fontSize: 9, fontWeight: 600,
              color: COLORS.amber, background: 'transparent',
              border: `1px solid ${COLORS.amber}`,
              padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
              letterSpacing: '0.06em',
            }}>
              CANCEL
            </button>
          </>
        ) : (
          <>
            <button onClick={() => {
              const dims = frameDimsRef.current
              const classified = classifyBerries(latestBerriesRef.current, dims.width, dims.height)
              onUseCount(classified)
            }} style={{
              flex: 1, fontFamily: FONT, fontSize: 12, fontWeight: 700,
              color: '#fff', background: COLORS.green,
              border: 'none', padding: '10px', borderRadius: 4, cursor: 'pointer',
              letterSpacing: '0.06em',
            }}>
              USE COUNT ({berryCount})
            </button>
            <button onClick={() => sendCommand({ action: 'capture_training' })} style={{
              fontFamily: FONT, fontSize: 9, fontWeight: 600,
              color: COLORS.amber, background: 'transparent',
              border: `1px solid ${COLORS.amber}`,
              padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
              letterSpacing: '0.06em',
            }}>
              LABEL
            </button>
            <button onClick={() => setShowTuning(!showTuning)} style={{
              fontFamily: FONT, fontSize: 9, fontWeight: 600,
              color: showTuning ? COLORS.green : COLORS.text3,
              background: showTuning ? COLORS.greenDim : 'transparent',
              border: `1px solid ${showTuning ? COLORS.green : COLORS.border}`,
              padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
              letterSpacing: '0.06em',
            }}>
              TUNE
            </button>
            <button onClick={() => setShowMask(!showMask)} style={{
              fontFamily: FONT, fontSize: 9, fontWeight: 600,
              color: showMask ? COLORS.amber : COLORS.text3,
              background: 'transparent',
              border: `1px solid ${showMask ? COLORS.amber : COLORS.border}`,
              padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
              letterSpacing: '0.06em',
            }}>
              MASK
            </button>
            <button onClick={() => setShowFiltered(!showFiltered)} style={{
              fontFamily: FONT, fontSize: 9, fontWeight: 600,
              color: showFiltered ? '#2563EB' : COLORS.text3,
              background: 'transparent',
              border: `1px solid ${showFiltered ? '#2563EB' : COLORS.border}`,
              padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
              letterSpacing: '0.06em',
            }}>
              FILTERED
            </button>
          </>
        )}
      </div>

      {/* Tuning panel — collapsible (hidden in label mode) */}
      {showTuning && !labelMode && (
        <div style={{
          padding: '8px 10px', borderTop: `1px solid ${COLORS.border}`,
          background: COLORS.bg3,
        }}>
          {/* HSV */}
          <div style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3, letterSpacing: '0.06em', marginBottom: 4, fontWeight: 600 }}>
            HSV RANGE
          </div>
          {sliderRow('H lo', 'h_low', 0, 179)}
          {sliderRow('H hi', 'h_high', 0, 179)}
          {sliderRow('S lo', 's_low', 0, 255)}
          {sliderRow('S hi', 's_high', 0, 255)}
          {sliderRow('V lo', 'v_low', 0, 255)}
          {sliderRow('V hi', 'v_high', 0, 255)}

          {/* Area filter */}
          <div style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3, letterSpacing: '0.06em', marginTop: 8, marginBottom: 4, fontWeight: 600 }}>
            BERRY SIZE
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ width: 40, fontSize: 10, textAlign: 'right', color: COLORS.text3 }}>Min</span>
            <input type="range" min={50} max={5000} step={50} value={minArea}
              onChange={e => { const v = parseInt(e.target.value); setMinArea(v); sendCommand({ action: 'set_area', min: v }) }}
              style={{ flex: 1, height: 4 }} />
            <span style={{ width: 30, fontSize: 10, color: COLORS.text2 }}>{minArea}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 40, fontSize: 10, textAlign: 'right', color: COLORS.text3 }}>Max</span>
            <input type="range" min={5000} max={100000} step={1000} value={maxArea}
              onChange={e => { const v = parseInt(e.target.value); setMaxArea(v); sendCommand({ action: 'set_area', max: v }) }}
              style={{ flex: 1, height: 4 }} />
            <span style={{ width: 30, fontSize: 10, color: COLORS.text2 }}>{maxArea}</span>
          </div>

          {/* Crop / ROI */}
          <div style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3, letterSpacing: '0.06em', marginTop: 8, marginBottom: 4, fontWeight: 600 }}>
            CROP (TRAY EDGES)
          </div>
          {[
            ['Left', 'left'],
            ['Right', 'right'],
            ['Top', 'top'],
            ['Bottom', 'bottom'],
          ].map(([label, side]) => (
            <div key={side} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{ width: 40, fontSize: 10, textAlign: 'right', color: COLORS.text3 }}>{label}</span>
              <input type="range" min={0} max={30} step={1}
                value={Math.round((crop[side] || 0) * 100)}
                onChange={e => updateCrop(side, parseInt(e.target.value) / 100)}
                style={{ flex: 1, height: 4 }} />
              <span style={{ width: 30, fontSize: 10, color: COLORS.text2 }}>
                {Math.round((crop[side] || 0) * 100)}%
              </span>
            </div>
          ))}

          {/* Toggles + actions */}
          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
            <label style={{ fontFamily: FONT, fontSize: 10, color: COLORS.text3, display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={blur} onChange={e => {
                setBlur(e.target.checked)
                sendCommand({ action: 'set_blur', enabled: e.target.checked })
              }} />
              Blur
            </label>
            <div style={{ flex: 1 }} />
            <button onClick={() => sendCommand({ action: 'save_crop' })} style={{ ...smallBtn, color: COLORS.green, borderColor: COLORS.green }}>SAVE CROP</button>
            <button onClick={() => sendCommand({ action: 'snapshot' })} style={smallBtn}>SNAP</button>
            <button onClick={() => sendCommand({ action: 'save_hsv' })} style={{ ...smallBtn, color: COLORS.green, borderColor: COLORS.green }}>SAVE</button>
            <button onClick={() => {
              sendCommand({ action: 'reset_hsv' })
              setHsv({ h_low: 90, h_high: 145, s_low: 30, s_high: 255, v_low: 30, v_high: 200 })
            }} style={{ ...smallBtn, color: COLORS.amber, borderColor: COLORS.amber }}>RESET</button>
          </div>
        </div>
      )}
    </div>
  )
}

const smallBtn = {
  fontFamily: FONT,
  fontSize: 9,
  fontWeight: 600,
  color: COLORS.text3,
  background: 'transparent',
  border: `1px solid ${COLORS.border}`,
  padding: '3px 8px',
  borderRadius: 3,
  cursor: 'pointer',
  letterSpacing: '0.06em',
}
