import React from 'react'
import { COLORS, FONT, gradeSample } from '../constants'

export default function ThresholdBars({ counts }) {
  const result = gradeSample(counts)
  const hasData = result.total > 0 && result.headrooms

  if (result.status === 'zero_tolerance') return null

  return (
    <div style={{
      background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
      borderRadius: 4, padding: '14px 16px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div style={{
          fontFamily: FONT, fontSize: 10, fontWeight: 600,
          letterSpacing: '0.12em', textTransform: 'uppercase', color: COLORS.text3,
        }}>MBG Grade Thresholds</div>
        <div style={{ fontFamily: FONT, fontSize: 10, color: COLORS.text3 }}>
          PER PINT SAMPLE
        </div>
      </div>

      {!hasData ? (
        <div style={{
          padding: 28, textAlign: 'center',
          fontFamily: FONT, fontSize: 11, color: COLORS.text3, letterSpacing: '0.06em',
        }}>Log a sample to see grade analysis</div>
      ) : (
        result.headrooms.filter(h => h.limit !== null).map(h => {
          const cap = h.limit * 2.5 || 1
          const w = Math.min(100, (h.count / cap) * 100)
          const m = (h.limit / cap) * 100
          const rem = h.remaining

          const barCol = rem < 0 ? COLORS.red : rem <= 0 ? COLORS.amber : COLORS.green
          const remCol = rem < 0 ? '#ff6b5b' : rem <= 1 ? COLORS.amber : COLORS.green
          const valCol = rem < 0 ? '#ff6b5b' : COLORS.text

          return (
            <div key={h.name} style={{
              display: 'grid', gridTemplateColumns: '180px 1fr 50px 70px',
              alignItems: 'center', gap: 14, padding: '9px 0',
              borderBottom: `1px solid ${COLORS.border}`,
            }}>
              <div style={{
                fontFamily: FONT, fontSize: 11, color: COLORS.text2,
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>{h.name}</div>
              <div style={{
                height: 5, background: COLORS.bg3, borderRadius: 3, position: 'relative',
              }}>
                <div style={{
                  height: '100%', borderRadius: 3, background: barCol,
                  width: `${w}%`, transition: 'width 0.5s ease',
                }} />
                <div style={{
                  position: 'absolute', top: -4, left: `${m}%`,
                  width: 2, height: 13, background: COLORS.border2, borderRadius: 1,
                }} />
              </div>
              <div style={{
                fontFamily: FONT, fontSize: 13, fontWeight: 600,
                textAlign: 'right', color: valCol,
              }}>{h.count}/{h.limit}</div>
              <div style={{
                fontFamily: FONT, fontSize: 10, textAlign: 'right', color: remCol,
              }}>
                {rem >= 0 ? '+' : ''}{rem} left
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
