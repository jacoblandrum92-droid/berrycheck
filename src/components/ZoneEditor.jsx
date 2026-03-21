import React, { useRef, useState } from 'react'
import { COLORS, FONT } from '../constants'
import { countBerriesInZones } from '../imageProcessor'

import { ZONE_TYPES } from '../constants'

export default function ZoneEditor({ imageData, onCounts, onClose }) {
  const imgRef = useRef(null)
  const [landscapeData, setLandscapeData] = useState(imageData)

  // Auto-rotate portrait images to landscape
  React.useEffect(() => {
    const img = new Image()
    img.onload = () => {
      if (img.height > img.width) {
        // Portrait — rotate 90° clockwise to landscape
        const canvas = document.createElement('canvas')
        canvas.width = img.height
        canvas.height = img.width
        const ctx = canvas.getContext('2d')
        ctx.translate(canvas.width / 2, canvas.height / 2)
        ctx.rotate(-Math.PI / 2)
        ctx.drawImage(img, -img.width / 2, -img.height / 2)
        setLandscapeData(canvas.toDataURL('image/jpeg', 0.92))
      }
    }
    img.src = imageData
  }, [imageData])

  const [zones, setZones] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('bc_zones') || '[]')
      // Filter out old zone keys that no longer exist in ZONE_TYPES
      const validKeys = ZONE_TYPES.map(zt => zt.key)
      const filtered = saved.filter(z => validKeys.includes(z.key))
      if (filtered.length !== saved.length) {
        localStorage.setItem('bc_zones', JSON.stringify(filtered))
      }
      return filtered
    } catch { return [] }
  })
  const [activeZoneType, setActiveZoneType] = useState(() => {
    const saved = (() => {
      try {
        const raw = JSON.parse(localStorage.getItem('bc_zones') || '[]')
        const validKeys = ZONE_TYPES.map(zt => zt.key)
        return raw.filter(z => validKeys.includes(z.key))
      } catch { return [] }
    })()
    const drawnKeys = saved.map(z => z.key)
    const next = ZONE_TYPES.find(zt => !drawnKeys.includes(zt.key))
    return next ? next.key : 'good'
  })
  const [drawing, setDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState(null)
  const [drawCurrent, setDrawCurrent] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [counts, setCounts] = useState(null)
  const [debugInfo, setDebugInfo] = useState(null)

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

  const onPointerUp = () => {
    if (!drawing || !drawStart || !drawCurrent) return
    setDrawing(false)

    const w = Math.abs(drawCurrent.x - drawStart.x)
    const h = Math.abs(drawCurrent.y - drawStart.y)
    if (w < 0.03 || h < 0.03) return

    const newZone = {
      key: activeZoneType,
      x: Math.min(drawStart.x, drawCurrent.x),
      y: Math.min(drawStart.y, drawCurrent.y),
      w, h,
    }

    const updated = zones.filter(z => z.key !== activeZoneType).concat(newZone)
    setZones(updated)
    localStorage.setItem('bc_zones', JSON.stringify(updated))

    // Auto-advance
    const drawnKeys = updated.map(z => z.key)
    const next = ZONE_TYPES.find(zt => !drawnKeys.includes(zt.key))
    if (next) setActiveZoneType(next.key)
  }

  const removeZone = (key) => {
    const updated = zones.filter(z => z.key !== key)
    setZones(updated)
    localStorage.setItem('bc_zones', JSON.stringify(updated))
  }

  const clearZones = () => {
    setZones([])
    localStorage.removeItem('bc_zones')
    setActiveZoneType('good')
    setCounts(null)
  }

  const processImage = async () => {
    if (zones.length === 0) return
    setProcessing(true)
    setCounts(null)
    try {
      const result = await countBerriesInZones(landscapeData, zones)
      setCounts(result.counts)
      setDebugInfo(result.debug)
    } catch (err) {
      console.error(err)
    } finally {
      setProcessing(false)
    }
  }

  const useCounts = () => {
    if (!counts) return
    onCounts(counts)
  }

  const activeColor = ZONE_TYPES.find(z => z.key === activeZoneType)?.color || COLORS.green

  const activeRect = drawing && drawStart && drawCurrent ? {
    x: Math.min(drawStart.x, drawCurrent.x),
    y: Math.min(drawStart.y, drawCurrent.y),
    w: Math.abs(drawCurrent.x - drawStart.x),
    h: Math.abs(drawCurrent.y - drawStart.y),
  } : null

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      zIndex: 1000, display: 'flex', flexDirection: 'column',
      overflow: 'auto',
    }}>
      {/* Top bar */}
      <div style={{
        padding: '12px 20px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexShrink: 0,
      }}>
        <button onClick={onClose} style={{
          fontFamily: FONT, fontSize: 12, color: COLORS.text3,
          background: 'none', border: 'none', cursor: 'pointer',
        }}>
          CLOSE
        </button>
        <div style={{
          fontFamily: FONT, fontSize: 12, fontWeight: 600,
          color: COLORS.green, letterSpacing: '0.08em',
        }}>
          DRAW ZONES
        </div>
        <div style={{ width: 50 }} />
      </div>

      {/* Instructions */}
      <div style={{
        fontFamily: FONT, fontSize: 11, color: COLORS.text3,
        textAlign: 'center', padding: '0 20px 8px',
      }}>
        Select a zone type below, then drag a rectangle on the image.
      </div>

      {/* Zone type selector */}
      <div style={{
        display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center',
        padding: '0 16px 12px',
      }}>
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
            }}>
              {drawn ? '* ' : ''}{zt.label}
            </button>
          )
        })}
      </div>

      {/* Image with zones */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', padding: '0 16px',
      }}>
        <div style={{
          position: 'relative', touchAction: 'none', userSelect: 'none',
          maxWidth: 800, width: '100%',
        }}
          onMouseDown={onPointerDown} onMouseMove={onPointerMove} onMouseUp={onPointerUp}
          onTouchStart={onPointerDown} onTouchMove={onPointerMove} onTouchEnd={onPointerUp}
        >
          <img ref={imgRef} src={landscapeData} style={{
            width: '100%', display: 'block', borderRadius: 6,
            border: `2px solid ${activeColor}40`,
            objectFit: 'contain',
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
                borderRadius: 4, pointerEvents: 'none',
              }}>
                <div style={{
                  position: 'absolute', top: -1, left: -1,
                  background: zt?.color || COLORS.green,
                  color: '#000', fontFamily: FONT, fontSize: 9, fontWeight: 700,
                  padding: '1px 5px', borderRadius: '0 0 3px 0',
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>
                  {zt?.label || z.key}
                  {counts && counts[z.key] !== undefined ? `: ${counts[z.key]}` : ''}
                </div>
              </div>
            )
          })}

          {/* Active drawing */}
          {activeRect && (
            <div style={{
              position: 'absolute',
              left: `${activeRect.x * 100}%`, top: `${activeRect.y * 100}%`,
              width: `${activeRect.w * 100}%`, height: `${activeRect.h * 100}%`,
              border: `2px dashed ${activeColor}`,
              borderRadius: 4, background: `${activeColor}15`, pointerEvents: 'none',
            }} />
          )}
        </div>

        {/* Zone remove buttons */}
        {zones.length > 0 && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center',
            marginTop: 10,
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

        {/* Debug info */}
        {debugInfo && (
          <div style={{
            background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
            borderRadius: 4, padding: 10, marginTop: 10,
            fontFamily: FONT, fontSize: 10, color: COLORS.text3,
            lineHeight: 1.8, maxWidth: 400, width: '100%',
          }}>
            <div>Threshold: {debugInfo.threshold} | Blobs: {debugInfo.blobsBeforeFilter} raw → {debugInfo.blobsAfterFilter} filtered</div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{
          display: 'flex', gap: 12, justifyContent: 'center',
          padding: '16px 0 24px',
        }}>
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
          {counts && (
            <button onClick={useCounts} style={btnStyle(COLORS.green, COLORS.greenDim, COLORS.green)}>
              USE COUNTS
            </button>
          )}
        </div>
      </div>
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
