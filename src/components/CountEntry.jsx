import React, { useState, useEffect } from 'react'
import { COLORS, FONT, DEFECT_DETAIL } from '../constants'

export default function CountEntry({ counts, setCounts, detailed, onToggleDetailed }) {
  const [thirtyBerryWeight, setThirtyBerryWeight] = useState('')

  // Calculate total berry count from 30-berry subsample
  // Total = 600g / (30-berry weight / 30)
  const avgBerryWeight = thirtyBerryWeight ? (parseFloat(thirtyBerryWeight) / 30) : 0
  const estimatedTotal = avgBerryWeight > 0 ? Math.round(600 / avgBerryWeight) : null

  // Berry size from 30-berry weight
  const berrySize = !thirtyBerryWeight ? null
    : parseFloat(thirtyBerryWeight) <= 33 ? 'Small'
    : parseFloat(thirtyBerryWeight) <= 65 ? 'Medium'
    : 'Large'

  const berrySizeColor = berrySize === 'Small' ? COLORS.amber
    : berrySize === 'Large' ? COLORS.green
    : berrySize === 'Medium' ? COLORS.text
    : COLORS.text3

  const update = (key, val) => {
    setCounts(prev => ({ ...prev, [key]: Math.max(0, parseInt(val) || 0) }))
  }

  // Auto-calculate good berries when we have a total and defect counts
  const totalDefects = detailed
    ? (counts.stems || 0) + (counts.greenRed || 0) + (counts.scars || 0) +
      (counts.shrivel || 0) + (counts.bruise || 0) + (counts.soft || 0) +
      (counts.crushed || 0) + (counts.leaky || 0) +
      (counts.decayRot || 0) + (counts.whiteMold || 0)
    : (counts.permanent || 0) + (counts.condition || 0) + (counts.decay || 0)

  const decayCount = detailed
    ? (counts.decayRot || 0) + (counts.whiteMold || 0)
    : (counts.decay || 0)

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
      {/* Header with toggle */}
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

      {/* Step 1: 30-berry subsample weight */}
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
            }}>
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

      {/* Step 2: Good berries count */}
      <div style={{
        background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
        borderRadius: 4, padding: '8px 10px', marginBottom: 8,
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 3,
        }}>
          <div style={{
            fontFamily: FONT, fontSize: 9, color: COLORS.text3,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>Good Berries</div>
          {estimatedTotal && (counts.good || 0) > 0 && (
            <div style={{
              fontFamily: FONT, fontSize: 9, color: COLORS.text3,
            }}>
              {totalDefects} defects of {(counts.good || 0) + totalDefects} total
            </div>
          )}
        </div>
        <input type="number" min="0" value={counts.good || ''}
          onChange={e => update('good', e.target.value)} placeholder="0"
          style={{
            background: 'transparent', border: 'none', padding: 0,
            fontFamily: FONT, fontSize: 22, fontWeight: 700,
            color: (counts.good || 0) > 0 ? COLORS.green : COLORS.text3,
            width: '100%', outline: 'none',
          }}
        />
      </div>

      {/* Step 3: Defect counts */}
      {!detailed ? (
        /* ===== QUICK MODE — 3 piles ===== */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          {inputBox('permanent', 'Permanent', COLORS.amber)}
          {inputBox('condition', 'Condition', '#D85A30')}
          {inputBox('decay', 'Decay/Mold', COLORS.red, decayCount > 0 ? COLORS.red : undefined)}
        </div>
      ) : (
        /* ===== DETAILED MODE — full breakdown ===== */
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
