import React, { useRef, useState } from 'react'
import { COLORS, FONT, ZONE_TYPES } from '../constants'
import { countBerriesInZones } from '../imageProcessor'

export default function CameraCapture({ onResult, onBack }) {
  const fileRef = useRef(null)
  const imgRef = useRef(null)

  const [preview, setPreview] = useState(null)
  const [imageDataUrl, setImageDataUrl] = useState(null)
  const [phase, setPhase] = useState('capture') // capture | draw | results

  // Zone drawing state
  const [zones, setZones] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bc_zones') || '[]') } catch { return [] }
  })
  const [activeZoneType, setActiveZoneType] = useState('good')
  const [drawing, setDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState(null)
  const [drawCurrent, setDrawCurrent] = useState(null)

  // Results
  const [counts, setCounts] = useState(null)
  const [debugInfo, setDebugInfo] = useState(null)
  const [processing, setProcessing] = useState(false)

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setPreview(ev.target.result)
      setImageDataUrl(ev.target.result)
      setPhase('draw')
      setCounts(null)
      setDebugInfo(null)
    }
    reader.readAsDataURL(file)
  }

  // Convert touch/click to relative coordinates (0-1) on the image
  const getRelPos = (e) => {
    const img = imgRef.current
    if (!img) return null
    const rect = img.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    }
  }

  const onPointerDown = (e) => {
    e.preventDefault()
    const pos = getRelPos(e)
    if (!pos) return
    setDrawing(true)
    setDrawStart(pos)
    setDrawCurrent(pos)
  }

  const onPointerMove = (e) => {
    if (!drawing) return
    e.preventDefault()
    const pos = getRelPos(e)
    if (pos) setDrawCurrent(pos)
  }

  const onPointerUp = (e) => {
    if (!drawing || !drawStart || !drawCurrent) return
    setDrawing(false)

    // Minimum size check — ignore tiny accidental taps
    const w = Math.abs(drawCurrent.x - drawStart.x)
    const h = Math.abs(drawCurrent.y - drawStart.y)
    if (w < 0.03 || h < 0.03) return

    const newZone = {
      key: activeZoneType,
      x: Math.min(drawStart.x, drawCurrent.x),
      y: Math.min(drawStart.y, drawCurrent.y),
      w,
      h,
    }

    // Replace existing zone of same type, or add
    const updated = zones.filter(z => z.key !== activeZoneType).concat(newZone)
    setZones(updated)
    localStorage.setItem('bc_zones', JSON.stringify(updated))
    fetch('/api/store/bc_zones', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) }).catch(() => {})

    // Auto-advance to next undrawn zone type
    const drawnKeys = updated.map(z => z.key)
    const next = ZONE_TYPES.find(zt => !drawnKeys.includes(zt.key))
    if (next) setActiveZoneType(next.key)
  }

  const clearZones = () => {
    setZones([])
    localStorage.removeItem('bc_zones')
    setActiveZoneType('good')
  }

  const removeZone = (key) => {
    const updated = zones.filter(z => z.key !== key)
    setZones(updated)
    localStorage.setItem('bc_zones', JSON.stringify(updated))
    fetch('/api/store/bc_zones', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) }).catch(() => {})
  }

  const processImage = async () => {
    if (!imageDataUrl || zones.length === 0) return
    setProcessing(true)
    try {
      const result = await countBerriesInZones(imageDataUrl, zones)
      setCounts(result.counts)
      setDebugInfo(result.debug)
      setPhase('results')
    } catch (err) {
      console.error(err)
      setDebugInfo({ error: err.message })
    } finally {
      setProcessing(false)
    }
  }

  const accept = () => {
    if (!counts) return
    // Build the count object for the dashboard
    // "good" berries + all defect zones = total
    onResult(counts)
  }

  const retake = () => {
    setPreview(null)
    setImageDataUrl(null)
    setCounts(null)
    setDebugInfo(null)
    setPhase('capture')
    if (fileRef.current) fileRef.current.value = ''
  }

  // Active drawing rectangle (while finger is moving)
  const activeRect = drawing && drawStart && drawCurrent ? {
    x: Math.min(drawStart.x, drawCurrent.x),
    y: Math.min(drawStart.y, drawCurrent.y),
    w: Math.abs(drawCurrent.x - drawStart.x),
    h: Math.abs(drawCurrent.y - drawStart.y),
  } : null

  const activeColor = ZONE_TYPES.find(z => z.key === activeZoneType)?.color || COLORS.green

  return (
    <div style={{
      background: COLORS.bg,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Top bar */}
      <div style={{
        padding: '14px 20px 10px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <button onClick={phase === 'results' ? () => setPhase('draw') : onBack} style={{
          fontFamily: FONT, fontSize: 12, color: COLORS.text3,
          background: 'none', border: 'none', cursor: 'pointer', padding: '8px 4px',
        }}>
          {phase === 'results' ? 'EDIT ZONES' : 'BACK'}
        </button>
        <div style={{
          fontFamily: FONT, fontSize: 13, fontWeight: 600,
          color: COLORS.green, letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          BerryCheck
        </div>
        <div style={{ width: 60 }} />
      </div>

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        padding: '0 16px 24px', gap: 12, overflowY: 'auto',
      }}>

        {/* ---- CAPTURE PHASE ---- */}
        {phase === 'capture' && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 20,
          }}>
            <input ref={fileRef} type="file" accept="image/*" capture="environment"
              onChange={handleFile} style={{ display: 'none' }} />

            {zones.length > 0 && (
              <div style={{
                fontFamily: FONT, fontSize: 11, color: COLORS.green,
                background: COLORS.greenDim + '40', border: `1px solid ${COLORS.greenDim}`,
                padding: '8px 14px', borderRadius: 4, textAlign: 'center',
              }}>
                {zones.length} zone{zones.length > 1 ? 's' : ''} saved from last session
              </div>
            )}

            <button onClick={() => fileRef.current?.click()} style={{
              width: 80, height: 80, borderRadius: '50%',
              border: `3px solid ${COLORS.green}`, background: 'transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0, WebkitTapHighlightColor: 'transparent',
            }}>
              <div style={{ width: 62, height: 62, borderRadius: '50%', background: COLORS.green }} />
            </button>
            <div style={{ fontFamily: FONT, fontSize: 11, color: COLORS.text3, letterSpacing: '0.06em' }}>
              TAP TO CAPTURE TRAY
            </div>
          </div>
        )}

        {/* ---- DRAW PHASE ---- */}
        {phase === 'draw' && preview && (
          <>
            {/* Instructions */}
            <div style={{
              fontFamily: FONT, fontSize: 11, color: COLORS.text3,
              textAlign: 'center', padding: '4px 0',
            }}>
              Draw a rectangle around each zone. Drag on the image.
            </div>

            {/* Zone type selector */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
              {ZONE_TYPES.map(zt => {
                const drawn = zones.find(z => z.key === zt.key)
                const isActive = activeZoneType === zt.key
                return (
                  <button key={zt.key} onClick={() => setActiveZoneType(zt.key)} style={{
                    fontFamily: FONT, fontSize: 10, fontWeight: 600,
                    color: isActive ? zt.color : drawn ? zt.color + '80' : COLORS.text3,
                    background: isActive ? zt.color + '20' : 'transparent',
                    border: `1px solid ${isActive ? zt.color : drawn ? zt.color + '40' : COLORS.border}`,
                    padding: '5px 10px', borderRadius: 3, cursor: 'pointer',
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                    position: 'relative',
                  }}>
                    {drawn ? '* ' : ''}{zt.label}
                  </button>
                )
              })}
            </div>

            {/* Image with zone overlays */}
            <div style={{ position: 'relative', touchAction: 'none', userSelect: 'none' }}
              onMouseDown={onPointerDown} onMouseMove={onPointerMove} onMouseUp={onPointerUp}
              onTouchStart={onPointerDown} onTouchMove={onPointerMove} onTouchEnd={onPointerUp}
            >
              <img ref={imgRef} src={preview} style={{
                width: '100%', display: 'block', borderRadius: 6,
                border: `2px solid ${activeColor}40`,
              }} alt="Tray" draggable={false} />

              {/* Drawn zones */}
              {zones.map(z => {
                const zt = ZONE_TYPES.find(t => t.key === z.key)
                return (
                  <div key={z.key} style={{
                    position: 'absolute',
                    left: `${z.x * 100}%`, top: `${z.y * 100}%`,
                    width: `${z.w * 100}%`, height: `${z.h * 100}%`,
                    border: `2px solid ${zt?.color || COLORS.green}`,
                    borderRadius: 4,
                    pointerEvents: 'none',
                  }}>
                    <div style={{
                      position: 'absolute', top: -1, left: -1,
                      background: zt?.color || COLORS.green,
                      color: '#000', fontFamily: FONT, fontSize: 9, fontWeight: 700,
                      padding: '1px 5px', borderRadius: '0 0 3px 0',
                      letterSpacing: '0.06em', textTransform: 'uppercase',
                    }}>
                      {zt?.label || z.key}
                    </div>
                  </div>
                )
              })}

              {/* Active drawing rectangle */}
              {activeRect && (
                <div style={{
                  position: 'absolute',
                  left: `${activeRect.x * 100}%`, top: `${activeRect.y * 100}%`,
                  width: `${activeRect.w * 100}%`, height: `${activeRect.h * 100}%`,
                  border: `2px dashed ${activeColor}`,
                  borderRadius: 4,
                  background: `${activeColor}15`,
                  pointerEvents: 'none',
                }} />
              )}
            </div>

            {/* Zone list / actions */}
            {zones.length > 0 && (
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center',
              }}>
                {zones.map(z => {
                  const zt = ZONE_TYPES.find(t => t.key === z.key)
                  return (
                    <button key={z.key} onClick={() => removeZone(z.key)} style={{
                      fontFamily: FONT, fontSize: 9, color: zt?.color || COLORS.text3,
                      background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
                      padding: '3px 8px', borderRadius: 3, cursor: 'pointer',
                    }}>
                      {zt?.label} x
                    </button>
                  )
                })}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={retake} style={btnStyle(COLORS.text3, COLORS.bg3, COLORS.border2)}>
                RETAKE
              </button>
              <button onClick={clearZones} style={btnStyle(COLORS.amber, COLORS.amberDim + '30', COLORS.amberDim)}>
                CLEAR ZONES
              </button>
              <button onClick={processImage}
                disabled={zones.length === 0 || processing}
                style={{
                  ...btnStyle(COLORS.green, COLORS.greenDim, COLORS.green),
                  opacity: zones.length === 0 ? 0.4 : 1,
                }}>
                {processing ? 'COUNTING...' : 'COUNT'}
              </button>
            </div>
          </>
        )}

        {/* ---- RESULTS PHASE ---- */}
        {phase === 'results' && counts && (
          <>
            {/* Count results */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8, width: '100%',
            }}>
              {ZONE_TYPES.map(zt => (
                <CountCell key={zt.key} label={zt.label} value={counts[zt.key] || 0} color={zt.color} />
              ))}
              <CountCell label="Total"
                value={Object.values(counts).reduce((a, b) => a + b, 0)}
                color={COLORS.text} />
            </div>

            {/* Debug info */}
            {debugInfo && (
              <div style={{
                background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
                borderRadius: 4, padding: 12, fontFamily: FONT, fontSize: 10,
                color: COLORS.text3, lineHeight: 1.8,
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Processing Debug
                </div>
                <div>Image: {debugInfo.imageSize}</div>
                <div>Background brightness: {debugInfo.bgBrightness}</div>
                <div>Threshold: {debugInfo.threshold}</div>
                <div>Raw blobs found: {debugInfo.blobsBeforeFilter}</div>
                <div>After size filter: {debugInfo.blobsAfterFilter}</div>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={retake} style={btnStyle(COLORS.text3, COLORS.bg3, COLORS.border2)}>
                RETAKE
              </button>
              <button onClick={accept} style={btnStyle(COLORS.green, COLORS.greenDim, COLORS.green)}>
                USE COUNTS
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function CountCell({ label, value, color }) {
  return (
    <div style={{
      background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
      borderRadius: 6, padding: '10px 8px', textAlign: 'center',
    }}>
      <div style={{
        fontFamily: FONT, fontSize: 9, color: COLORS.text3,
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4,
      }}>{label}</div>
      <div style={{
        fontFamily: FONT, fontSize: 24, fontWeight: 700,
        color: value > 0 ? color : COLORS.text3,
      }}>{value}</div>
    </div>
  )
}

function btnStyle(color, bg, border) {
  return {
    fontFamily: FONT, fontSize: 11, fontWeight: 600,
    color, background: bg, border: `1px solid ${border}`,
    padding: '10px 18px', borderRadius: 3, cursor: 'pointer',
    letterSpacing: '0.08em', textTransform: 'uppercase',
  }
}
