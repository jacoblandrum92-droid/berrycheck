import React from 'react'
import { COLORS, FONT, gradeSample } from '../constants'

export default function ThresholdBars({ counts }) {
  const result = gradeSample(counts)
  const hasData = result.total > 0 && result.headrooms

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
        }}>Grade Headroom</div>
        <div style={{ fontFamily: FONT, fontSize: 10, color: COLORS.text3 }}>
          {hasData ? `CURRENT: ${result.label}` : '600G SAMPLE'}
        </div>
      </div>

      {!hasData ? (
        <div style={{
          padding: 28, textAlign: 'center',
          fontFamily: FONT, fontSize: 11, color: COLORS.text3, letterSpacing: '0.06em',
        }}>Log a sample to see grade analysis</div>
      ) : result.headrooms.length === 0 ? (
        <div style={{
          padding: 20, textAlign: 'center',
          fontFamily: FONT, fontSize: 12, color: COLORS.red,
          letterSpacing: '0.06em', fontWeight: 600,
        }}>POOR — exceeds all grade thresholds</div>
      ) : (
        result.headrooms.map(h => {
          const maxBar = h.limit * 2 || 1
          const w = Math.min(100, (h.pct / maxBar) * 100)
          const m = (h.limit / maxBar) * 100
          const rem = h.remaining

          const barCol = rem < 0 ? COLORS.red : rem <= 1 ? COLORS.amber : COLORS.green
          const remCol = rem < 0 ? COLORS.red : rem <= 1 ? COLORS.amber : COLORS.green

          return (
            <div key={h.name} style={{
              display: 'grid', gridTemplateColumns: '150px 1fr 70px 80px',
              alignItems: 'center', gap: 14, padding: '9px 0',
              borderBottom: `1px solid ${COLORS.border}`,
            }}>
              <div style={{
                fontFamily: FONT, fontSize: 11, color: COLORS.text2,
                letterSpacing: '0.03em',
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
                fontFamily: FONT, fontSize: 12, fontWeight: 600,
                textAlign: 'right', color: rem < 0 ? COLORS.red : COLORS.text,
              }}>{h.pct}% / {h.limit}%</div>
              <div style={{
                fontFamily: FONT, fontSize: 10, textAlign: 'right', color: remCol,
                fontWeight: 600,
              }}>
                {rem > 0 ? `${rem}% room` : rem === 0 ? 'AT LIMIT' : `${Math.abs(rem)}% OVER`}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
