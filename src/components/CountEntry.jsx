import React from 'react'
import { COLORS, FONT, ZONE_TYPES } from '../constants'

// Count fields match zone types minus 'good' (good is the main population)
const fields = ZONE_TYPES.filter(z => z.key !== 'good')

export default function CountEntry({ counts, setCounts }) {
  const update = (key, val) => {
    setCounts(prev => ({ ...prev, [key]: Math.max(0, parseInt(val) || 0) }))
  }

  const zeroCount = counts.zero || 0

  return (
    <div>
      <div style={{
        fontFamily: FONT, fontSize: 10, fontWeight: 600,
        letterSpacing: '0.12em', textTransform: 'uppercase',
        color: COLORS.text3, marginBottom: 8,
      }}>
        Berry Counts
      </div>

      {/* Good / total at top */}
      <div style={{
        background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
        borderRadius: 3, padding: '8px 10px', marginBottom: 6,
      }}>
        <div style={{
          fontFamily: FONT, fontSize: 9, color: COLORS.text3,
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3,
        }}>Good Berries</div>
        <input type="number" min="0" value={counts.good || ''}
          onChange={e => update('good', e.target.value)} placeholder="0"
          style={{
            background: 'transparent', border: 'none', padding: 0,
            fontFamily: FONT, fontSize: 20, fontWeight: 600,
            color: (counts.good || 0) > 0 ? COLORS.green : COLORS.text3,
            width: '100%', outline: 'none',
          }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {fields.map(f => (
          <div key={f.key} style={{
            background: COLORS.bg2,
            border: `1px solid ${f.key === 'zero' && zeroCount > 0 ? '#ff0040' : COLORS.border}`,
            borderRadius: 3, padding: '8px 10px',
          }}>
            <div style={{
              fontFamily: FONT, fontSize: 9, color: COLORS.text3,
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3,
            }}>
              {f.label}
            </div>
            <input type="number" min="0" value={counts[f.key] || ''}
              onChange={e => update(f.key, e.target.value)} placeholder="0"
              style={{
                background: 'transparent', border: 'none', padding: 0,
                fontFamily: FONT, fontSize: 20, fontWeight: 600,
                color: (counts[f.key] || 0) > 0 ? f.color : COLORS.text3,
                width: '100%', outline: 'none',
              }}
            />
          </div>
        ))}
      </div>

      {zeroCount > 0 && (
        <div style={{
          marginTop: 8, padding: '8px 12px',
          background: 'rgba(255, 0, 64, 0.1)', border: '1px solid #ff0040',
          borderRadius: 3, fontFamily: FONT, fontSize: 11, fontWeight: 600,
          color: '#ff0040', letterSpacing: '0.06em', textTransform: 'uppercase',
          textAlign: 'center',
        }}>
          ZERO TOLERANCE — AUTO FAIL
        </div>
      )}
    </div>
  )
}
