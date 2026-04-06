import React, { useState, useEffect, useRef } from 'react'
import { COLORS, FONT } from '../constants'

/**
 * ScaleCapture — live weight display + record/manual entry
 *
 * Two modes, visually distinct:
 *   LIVE (scale connected): pulsing weight, "RECORD" button to capture
 *   MANUAL (no scale or user chose to type): plain input field
 *
 * After recording: weight is locked, shows source badge (SCALE or MANUAL),
 * with a CLEAR button to start over.
 */
export default function ScaleCapture({ scaleConnected, scaleWeight, onWeightCapture, capturedWeight }) {
  const [manualValue, setManualValue] = useState('')
  const [isManualMode, setIsManualMode] = useState(false)
  const [pulseOpacity, setPulseOpacity] = useState(1)
  const pulseRef = useRef(null)

  // Subtle pulse animation on live weight to show it's updating
  useEffect(() => {
    if (!scaleConnected || capturedWeight != null) return
    setPulseOpacity(0.5)
    if (pulseRef.current) clearTimeout(pulseRef.current)
    pulseRef.current = setTimeout(() => setPulseOpacity(1), 150)
    return () => { if (pulseRef.current) clearTimeout(pulseRef.current) }
  }, [scaleWeight, scaleConnected, capturedWeight])

  const handleRecord = () => {
    if (scaleWeight != null) {
      onWeightCapture(Math.round(scaleWeight * 10) / 10, 'scale')
    }
  }

  const handleManualSubmit = () => {
    const val = parseFloat(manualValue)
    if (val > 0) {
      onWeightCapture(val, 'manual')
    }
  }

  const handleClear = () => {
    onWeightCapture(null, null)
    setManualValue('')
    setIsManualMode(false)
  }

  // === RECORDED STATE — weight is locked in ===
  if (capturedWeight != null) {
    const isFromScale = capturedWeight._source === 'scale'
    return (
      <div style={{
        background: COLORS.bg3,
        border: `2px solid ${COLORS.green}`,
        borderRadius: 6, padding: 12,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 4,
        }}>
          <div style={{
            fontFamily: FONT, fontSize: 9, fontWeight: 600,
            color: COLORS.green, letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            WEIGHT RECORDED
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div style={{
              fontFamily: FONT, fontSize: 8, fontWeight: 700,
              color: isFromScale ? COLORS.green : COLORS.amber,
              background: isFromScale ? COLORS.greenDim : COLORS.amber + '20',
              border: `1px solid ${isFromScale ? COLORS.green : COLORS.amber}`,
              padding: '1px 8px', borderRadius: 10, letterSpacing: '0.08em',
            }}>
              {isFromScale ? 'SCALE' : 'MANUAL'}
            </div>
            <button onClick={handleClear} style={{
              fontFamily: FONT, fontSize: 8, fontWeight: 600,
              color: COLORS.text3, background: 'transparent',
              border: `1px solid ${COLORS.border}`,
              padding: '1px 8px', borderRadius: 2, cursor: 'pointer',
              letterSpacing: '0.06em',
            }}>CLEAR</button>
          </div>
        </div>
        <div style={{
          fontFamily: FONT, fontSize: 28, fontWeight: 700,
          color: COLORS.green, letterSpacing: '-0.02em',
        }}>
          {capturedWeight.weight}g
        </div>
        {capturedWeight.weight && (
          <div style={{
            fontFamily: FONT, fontSize: 10, color: COLORS.text3,
            marginTop: 2,
          }}>
            {(capturedWeight.weight / 28.35).toFixed(1)} oz
          </div>
        )}
      </div>
    )
  }

  // === MANUAL MODE — user chose to type ===
  if (isManualMode || !scaleConnected) {
    return (
      <div style={{
        background: COLORS.bg3,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 6, padding: 12,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 8,
        }}>
          <div style={{
            fontFamily: FONT, fontSize: 9, fontWeight: 600,
            color: COLORS.text3, letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            {scaleConnected ? 'ENTER WEIGHT' : 'WEIGHT (no scale)'}
          </div>
          {scaleConnected && (
            <button onClick={() => setIsManualMode(false)} style={{
              fontFamily: FONT, fontSize: 8, fontWeight: 600,
              color: COLORS.green, background: COLORS.greenDim,
              border: `1px solid ${COLORS.green}`,
              padding: '2px 8px', borderRadius: 2, cursor: 'pointer',
              letterSpacing: '0.06em',
            }}>USE SCALE</button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="number" step="0.1" min="0"
            value={manualValue}
            onChange={e => setManualValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
            placeholder="grams"
            style={{
              flex: 1, background: COLORS.bg2,
              border: `1px solid ${COLORS.border2}`,
              color: COLORS.text, fontFamily: FONT, fontSize: 18, fontWeight: 600,
              padding: '8px 12px', borderRadius: 4, outline: 'none',
            }}
          />
          <button
            onClick={handleManualSubmit}
            disabled={!manualValue || parseFloat(manualValue) <= 0}
            style={{
              fontFamily: FONT, fontSize: 11, fontWeight: 700,
              color: manualValue && parseFloat(manualValue) > 0 ? '#fff' : COLORS.text3,
              background: manualValue && parseFloat(manualValue) > 0 ? COLORS.amber : COLORS.bg2,
              border: 'none',
              padding: '10px 16px', borderRadius: 4, cursor: 'pointer',
              letterSpacing: '0.06em', textTransform: 'uppercase',
              opacity: manualValue && parseFloat(manualValue) > 0 ? 1 : 0.5,
            }}
          >
            SAVE
          </button>
        </div>
        {manualValue && parseFloat(manualValue) > 0 && (
          <div style={{
            fontFamily: FONT, fontSize: 10, color: COLORS.text3, marginTop: 4,
          }}>
            {(parseFloat(manualValue) / 28.35).toFixed(1)} oz
          </div>
        )}
      </div>
    )
  }

  // === LIVE SCALE MODE — weight updating in real time ===
  return (
    <div style={{
      background: COLORS.bg3,
      border: `1px solid ${COLORS.green}40`,
      borderRadius: 6, padding: 12,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 4,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: COLORS.green,
            boxShadow: `0 0 8px ${COLORS.green}`,
            animation: 'none',
          }} />
          <div style={{
            fontFamily: FONT, fontSize: 9, fontWeight: 600,
            color: COLORS.green, letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            LIVE
          </div>
        </div>
        <button onClick={() => setIsManualMode(true)} style={{
          fontFamily: FONT, fontSize: 8, fontWeight: 600,
          color: COLORS.text3, background: 'transparent',
          border: `1px solid ${COLORS.border}`,
          padding: '2px 8px', borderRadius: 2, cursor: 'pointer',
          letterSpacing: '0.06em',
        }}>TYPE INSTEAD</button>
      </div>

      <div style={{
        fontFamily: FONT, fontSize: 32, fontWeight: 700,
        color: COLORS.text, letterSpacing: '-0.02em',
        opacity: pulseOpacity,
        transition: 'opacity 0.15s ease',
      }}>
        {scaleWeight != null ? `${scaleWeight.toFixed(1)}g` : '—'}
      </div>

      {scaleWeight != null && (
        <div style={{
          fontFamily: FONT, fontSize: 10, color: COLORS.text3,
          marginTop: 2, marginBottom: 8,
        }}>
          {(scaleWeight / 28.35).toFixed(1)} oz
        </div>
      )}

      <button
        onClick={handleRecord}
        disabled={scaleWeight == null || scaleWeight <= 0}
        style={{
          width: '100%',
          fontFamily: FONT, fontSize: 13, fontWeight: 700,
          color: scaleWeight > 0 ? '#fff' : COLORS.text3,
          background: scaleWeight > 0 ? COLORS.green : COLORS.bg2,
          border: 'none',
          padding: '10px 0', borderRadius: 4, cursor: 'pointer',
          letterSpacing: '0.08em', textTransform: 'uppercase',
          opacity: scaleWeight > 0 ? 1 : 0.5,
        }}
      >
        RECORD WEIGHT
      </button>
    </div>
  )
}
