import React, { useState, useEffect } from 'react'
import { COLORS, FONT, DEFECT_DETAIL } from '../constants'

export default function CountEntry({ counts, setCounts, detailed, onToggleDetailed, sampleMethod, onToggleMethod }) {
  const [thirtyBerryWeight, setThirtyBerryWeight] = useState('')
  const [clamTotal, setClamTotal] = useState('')

  const isClam = sampleMethod === 'clamshell'

  // === 600g mode calculations ===
  const avgBerryWeight = thirtyBerryWeight ? (parseFloat(thirtyBerryWeight) / 30) : 0
  const estimatedTotal600 = avgBerryWeight > 0 ? Math.round(600 / avgBerryWeight) : null

  // Berry size from 30-berry weight
  const berrySize = !thirtyBerryWeight ? null
    : parseFloat(thirtyBerryWeight) <= 33 ? 'Small'
    : parseFloat(thirtyBerryWeight) <= 65 ? 'Medium'
    : 'Large'

  const berrySizeColor = berrySize === 'Small' ? COLORS.amber
    : berrySize === 'Large' ? COLORS.green
    : berrySize === 'Medium' ? COLORS.text
    : COLORS.text3

  // === Active total — depends on mode ===
  const estimatedTotal = isClam ? (parseInt(clamTotal) || null) : estimatedTotal600

  // Calculate total defects
  const totalDefects = detailed
    ? (counts.stems || 0) + (counts.greenRed || 0) + (counts.scars || 0) +
      (counts.shrivel || 0) + (counts.bruise || 0) + (counts.soft || 0) +
      (counts.crushed || 0) + (counts.leaky || 0) +
      (counts.decayRot || 0) + (counts.whiteMold || 0)
    : (counts.permanent || 0) + (counts.condition || 0) + (counts.decay || 0)

  const decayCount = detailed
    ? (counts.decayRot || 0) + (counts.whiteMold || 0)
    : (counts.decay || 0)

  const goodCount = estimatedTotal ? Math.max(0, estimatedTotal - totalDefects) : 0

  // Store metadata in counts
  useEffect(() => {
    if (isClam) {
      setCounts(prev => {
        if (prev._sampleMethod === 'clamshell' && prev._clamTotal === (parseInt(clamTotal) || 0)) return prev
        return { ...prev, _sampleMethod: 'clamshell', _clamTotal: parseInt(clamTotal) || 0, _thirtyBerryWeight: 0 }
      })
    } else {
      const w = parseFloat(thirtyBerryWeight) || 0
      setCounts(prev => {
        if (prev._sampleMethod === '600g' && prev._thirtyBerryWeight === w) return prev
        return { ...prev, _sampleMethod: '600g', _thirtyBerryWeight: w, _clamTotal: 0 }
      })
    }
  }, [thirtyBerryWeight, clamTotal, isClam])

  // Auto-calculate good when total or defects change
  useEffect(() => {
    if (estimatedTotal) {
      setCounts(prev => {
        const defects = detailed
          ? (prev.stems || 0) + (prev.greenRed || 0) + (prev.scars || 0) +
            (prev.shrivel || 0) + (prev.bruise || 0) + (prev.soft || 0) +
            (prev.crushed || 0) + (prev.leaky || 0) +
            (prev.decayRot || 0) + (prev.whiteMold || 0)
          : (prev.permanent || 0) + (prev.condition || 0) + (prev.decay || 0)
        const newGood = Math.max(0, estimatedTotal - defects)
        if (prev.good === newGood) return prev
        return { ...prev, good: newGood }
      })
    }
  }, [isClam ? clamTotal : thirtyBerryWeight, estimatedTotal])

  const update = (key, val) => {
    const newVal = Math.max(0, parseInt(val) || 0)
    setCounts(prev => {
      const next = { ...prev, [key]: newVal }
      if (estimatedTotal && key !== 'good') {
        const defects = detailed
          ? (next.stems || 0) + (next.greenRed || 0) + (next.scars || 0) +
            (next.shrivel || 0) + (next.bruise || 0) + (next.soft || 0) +
            (next.crushed || 0) + (next.leaky || 0) +
            (next.decayRot || 0) + (next.whiteMold || 0)
          : (next.permanent || 0) + (next.condition || 0) + (next.decay || 0)
        next.good = Math.max(0, estimatedTotal - defects)
      }
      return next
    })
  }

  const inputBox = (key, label, color, borderColor) => (
    <div key={key} style={{
      background: COLORS.bg2,
      border: `1px solid ${borderColor || COLORS.border}`,
      borderRadius: 4, padding: '8px 10px',
    }}>
      <div style={{
        fontFamily: FONT, fontSize: 9, color: COLORS.text3,
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3,
      }}>
        {label}
      </div>
      <input type="number" min="0" value={counts[key] || ''}
        onChange={e => update(key, e.target.value)} placeholder="0"
        style={{
          background: 'transparent', border: 'none', padding: 0,
          fontFamily: FONT, fontSize: 20, fontWeight: 600,
          color: (counts[key] || 0) > 0 ? color : COLORS.text3,
          width: '100%', outline: 'none',
        }}
      />
    </div>
  )

  return (
    <div>
      {/* Header with toggles */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 8,
      }}>
        <div style={{
          fontFamily: FONT, fontSize: 10, fontWeight: 600,
          letterSpacing: '0.12em', textTransform: 'uppercase',
          color: COLORS.text3,
        }}>
          Sample Input
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {/* Sample method toggle */}
          <button onClick={onToggleMethod} style={{
            fontFamily: FONT, fontSize: 9, fontWeight: 600,
            color: isClam ? COLORS.purple : COLORS.text3,
            background: isClam ? COLORS.purple + '15' : 'transparent',
            border: `1px solid ${isClam ? COLORS.purple : COLORS.border}`,
            padding: '3px 10px', borderRadius: 3, cursor: 'pointer',
            letterSpacing: '0.06em',
          }}>
            {isClam ? 'CLAMSHELL' : '600G'}
          </button>
          {/* Detail toggle */}
          <button onClick={onToggleDetailed} style={{
            fontFamily: FONT, fontSize: 9, fontWeight: 600,
            color: detailed ? COLORS.amber : COLORS.text3,
            background: detailed ? COLORS.amberDim : 'transparent',
            border: `1px solid ${detailed ? COLORS.amber : COLORS.border}`,
            padding: '3px 10px', borderRadius: 3, cursor: 'pointer',
            letterSpacing: '0.06em',
          }}>
            {detailed ? 'DETAILED' : 'QUICK'}
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div style={{
        fontFamily: FONT, fontSize: 10, color: COLORS.text3,
        lineHeight: 1.6, marginBottom: 8,
        padding: '8px 10px', background: COLORS.bg2,
        borderRadius: 4, border: `1px solid ${COLORS.border}`,
      }}>
        {isClam ? (
          <>
            <b style={{ color: COLORS.text2 }}>1.</b> Grab a clamshell off the line.{' '}
            <b style={{ color: COLORS.text2 }}>2.</b> Dump and count total berries.{' '}
            <b style={{ color: COLORS.text2 }}>3.</b> Sort and count defect piles.
          </>
        ) : (
          <>
            <b style={{ color: COLORS.text2 }}>1.</b> Weigh out 600g of fruit.{' '}
            <b style={{ color: COLORS.text2 }}>2.</b> Pull 30 berries, weigh them, record below.{' '}
            <b style={{ color: COLORS.text2 }}>3.</b> Sort sample and count defect piles.
          </>
        )}
      </div>

      {/* === SAMPLE TOTAL INPUT — mode-dependent === */}
      {isClam ? (
        /* Clamshell mode — count total berries in cup */
        <div style={{
          background: COLORS.bg2, border: `1px solid ${COLORS.purple}40`,
          borderRadius: 4, padding: '10px 12px', marginBottom: 8,
        }}>
          <div style={{
            fontFamily: FONT, fontSize: 9, color: COLORS.purple,
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
          }}>Total Berries in Cup</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <input type="number" min="0"
              value={clamTotal}
              onChange={e => setClamTotal(e.target.value)}
              placeholder="0"
              style={{
                background: 'transparent', border: 'none', padding: 0,
                fontFamily: FONT, fontSize: 22, fontWeight: 700,
                color: clamTotal ? COLORS.text : COLORS.text3,
                width: '80px', outline: 'none',
              }}
            />
            {estimatedTotal && (
              <div style={{
                fontFamily: FONT, fontSize: 11, color: COLORS.purple, fontWeight: 600,
              }}>
                clamshell sample
              </div>
            )}
          </div>
        </div>
      ) : (
        /* 600g mode — 30-berry subsample weight */
        <>
          <div style={{
            background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
            borderRadius: 4, padding: '10px 12px', marginBottom: 8,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 6,
            }}>
              <div style={{
                fontFamily: FONT, fontSize: 9, color: COLORS.text3,
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>30-Berry Weight (g)</div>
              {berrySize && (
                <div style={{
                  fontFamily: FONT, fontSize: 9, fontWeight: 600,
                  color: berrySizeColor, letterSpacing: '0.04em',
                  display: 'flex', gap: 8, alignItems: 'center',
                }}>
                  <span style={{ color: COLORS.text3, fontWeight: 400 }}>
                    {avgBerryWeight > 0 ? `${Math.round(avgBerryWeight * 100) / 100}g · ~${Math.round(13 + (avgBerryWeight - 1.1) * 4.55)}mm` : ''}
                  </span>
                  {berrySize.toUpperCase()}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <input type="number" min="0" step="0.1"
                value={thirtyBerryWeight}
                onChange={e => setThirtyBerryWeight(e.target.value)}
                placeholder="0"
                style={{
                  background: 'transparent', border: 'none', padding: 0,
                  fontFamily: FONT, fontSize: 22, fontWeight: 700,
                  color: thirtyBerryWeight ? COLORS.text : COLORS.text3,
                  width: '80px', outline: 'none',
                }}
              />
              {estimatedTotal && (
                <div style={{
                  fontFamily: FONT, fontSize: 12, color: COLORS.green, fontWeight: 600,
                }}>
                  ≈ {estimatedTotal} berries in sample
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Good berries — auto-calculated */}
      <div style={{
        background: COLORS.greenDim, border: `1px solid ${COLORS.green}`,
        borderRadius: 4, padding: '8px 12px', marginBottom: 8,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{
            fontFamily: FONT, fontSize: 9, color: COLORS.green,
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2,
          }}>Good Berries</div>
          <div style={{
            fontFamily: FONT, fontSize: 22, fontWeight: 700,
            color: COLORS.green,
          }}>
            {estimatedTotal ? goodCount : '—'}
          </div>
        </div>
        <div style={{
          fontFamily: FONT, fontSize: 10, color: COLORS.green,
          textAlign: 'right', opacity: 0.7,
        }}>
          {estimatedTotal ? (
            <>
              <div>{totalDefects} defects</div>
              <div>{estimatedTotal} total</div>
            </>
          ) : (
            <div>{isClam ? 'Enter total berry count' : 'Enter 30-berry weight'}</div>
          )}
        </div>
      </div>

      {/* Defect counts */}
      {!detailed ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          {inputBox('permanent', 'Permanent', COLORS.amber)}
          {inputBox('condition', 'Condition', '#D85A30')}
          {inputBox('decay', 'Decay/Mold', COLORS.red, decayCount > 0 ? COLORS.red : undefined)}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <div style={sectionLabel}>Permanent Defects</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              {DEFECT_DETAIL.permanent.map(d =>
                inputBox(d.key, d.label, COLORS.amber)
              )}
            </div>
          </div>
          <div>
            <div style={sectionLabel}>Condition Defects</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              {DEFECT_DETAIL.condition.map(d =>
                inputBox(d.key, d.label, '#D85A30')
              )}
            </div>
          </div>
          <div>
            <div style={sectionLabel}>Decay / Mold</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {DEFECT_DETAIL.decay.map(d =>
                inputBox(d.key, d.label, COLORS.red, (counts[d.key] || 0) > 0 ? COLORS.red : undefined)
              )}
            </div>
          </div>
        </div>
      )}

      {decayCount > 0 && (
        <div style={{
          marginTop: 8, padding: '8px 12px',
          background: COLORS.redDim, border: `1px solid ${COLORS.red}`,
          borderRadius: 3, fontFamily: FONT, fontSize: 11, fontWeight: 600,
          color: COLORS.red, letterSpacing: '0.06em', textTransform: 'uppercase',
          textAlign: 'center',
        }}>
          Decay detected — cannot grade Excellent
        </div>
      )}
    </div>
  )
}

const sectionLabel = {
  fontFamily: FONT, fontSize: 9, fontWeight: 600,
  color: COLORS.text3, letterSpacing: '0.08em',
  textTransform: 'uppercase', marginBottom: 4,
}
