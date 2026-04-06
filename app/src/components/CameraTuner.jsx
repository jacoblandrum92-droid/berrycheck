import React, { useState, useEffect, useRef, useCallback } from 'react'
import { COLORS, FONT } from '../constants'

/**
 * CameraTuner — inline component for QC view.
 * Shows live camera feed with berry detection, HSV tuning sliders,
 * and a USE COUNT button that sends the berry count to CountEntry.
 *
 * Props:
 *   wsRef           — ref to the relay WebSocket
 *   graderConnected — boolean
 *   onUseCount      — callback(count) to send berry count to the QC form
 */

export default function CameraTuner({ wsRef, graderConnected, onUseCount }) {
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
  const frameCountRef = useRef(0)
  const lastFpsTime = useRef(Date.now())
  const latestCountRef = useRef(0)

  const sendCommand = useCallback((cmd) => {
    if (wsRef?.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'command', ...cmd }))
    }
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

    if (msg.type !== 'grader_frame') return

    const count = msg.count || 0
    setBerryCount(count)
    latestCountRef.current = count

    if (msg.hsv) setHsv(prev => {
      const same = Object.keys(msg.hsv).every(k => prev[k] === msg.hsv[k])
      return same ? prev : msg.hsv
    })
    if (msg.blur !== undefined) setBlur(msg.blur)
    if (msg.profile) setProfile(msg.profile)

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
    if (!wsRef?.current) return
    const ws = wsRef.current
    const handler = (event) => {
      try { handleFrame(JSON.parse(event.data)) } catch {}
    }
    ws.addEventListener('message', handler)
    return () => ws.removeEventListener('message', handler)
  }, [wsRef?.current, handleFrame])

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
        background: COLORS.bg3,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', background: COLORS.green,
            boxShadow: `0 0 6px ${COLORS.green}`,
          }} />
          <span style={{ fontFamily: FONT, fontSize: 10, color: COLORS.green, letterSpacing: '0.06em', fontWeight: 600 }}>
            CAMERA
          </span>
          {Object.keys(profiles).length > 0 && Object.entries(profiles).map(([key, label]) => (
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
          <span style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3 }}>
            {fps} fps
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontFamily: FONT, fontSize: 14, fontWeight: 700, color: COLORS.green,
          }}>
            {berryCount}
          </span>
          <span style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3 }}>berries</span>
        </div>
      </div>

      {/* Camera feed */}
      <div style={{ position: 'relative', background: '#000' }}>
        <canvas ref={canvasRef} style={{
          width: '100%', maxHeight: (showMask || showFiltered) ? 140 : 200, objectFit: 'contain', display: 'block',
        }} />
        {showMask && (
          <canvas ref={maskCanvasRef} style={{
            width: '100%', maxHeight: 100, objectFit: 'contain', display: 'block',
            borderTop: '1px solid #333',
          }} />
        )}
        {showFiltered && (
          <canvas ref={filteredCanvasRef} style={{
            width: '100%', maxHeight: 100, objectFit: 'contain', display: 'block',
            borderTop: '1px solid #333',
          }} />
        )}
      </div>

      {/* USE COUNT button */}
      <div style={{ padding: '6px 10px', display: 'flex', gap: 6 }}>
        <button onClick={() => onUseCount(latestCountRef.current)} style={{
          flex: 1, fontFamily: FONT, fontSize: 12, fontWeight: 700,
          color: '#fff', background: COLORS.green,
          border: 'none', padding: '10px', borderRadius: 4, cursor: 'pointer',
          letterSpacing: '0.06em',
        }}>
          USE COUNT ({berryCount})
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
      </div>

      {/* Tuning panel — collapsible */}
      {showTuning && (
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
