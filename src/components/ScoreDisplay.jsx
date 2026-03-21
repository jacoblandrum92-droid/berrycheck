import React from 'react'
import { COLORS, FONT, gradeSample } from '../constants'

export default function ScoreDisplay({ counts }) {
  const result = gradeSample(counts)
  const hasData = result.total > 0

  // Zero tolerance hard fail
  if (result.status === 'zero_tolerance') {
    return (
      <div style={{
        background: 'rgba(255, 0, 64, 0.08)', border: '2px solid #ff0040',
        borderRadius: 6, padding: '28px 24px', textAlign: 'center',
      }}>
        <div style={{
          fontFamily: FONT, fontSize: 60, fontWeight: 700,
          color: '#ff0040', lineHeight: 1, marginBottom: 8,
        }}>FAIL</div>
        <div style={{
          fontFamily: FONT, fontSize: 14, fontWeight: 600,
          color: '#ff0040', letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>ZERO TOLERANCE — AUTO FAIL</div>
        <div style={{
          fontFamily: FONT, fontSize: 11, color: COLORS.text3, marginTop: 8,
        }}>{result.reason}</div>
      </div>
    )
  }

  const scoreColor = !hasData ? COLORS.text3
    : result.status === 'fail' ? '#ff6b5b'
    : result.status === 'warn' ? COLORS.amber
    : COLORS.green

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
      {/* Score card */}
      <div style={{
        background: COLORS.bg2, border: `1px solid ${hasData ? scoreColor + '40' : COLORS.border}`,
        borderRadius: 6, padding: '16px 20px', gridColumn: 'span 2',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: hasData ? scoreColor : COLORS.border2,
        }} />
        <div style={{
          fontFamily: FONT, fontSize: 9, color: COLORS.text3,
          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6,
        }}>Line Score</div>
        <div style={{
          fontFamily: FONT, fontSize: 52, fontWeight: 700,
          color: scoreColor, lineHeight: 1, marginBottom: 4,
        }}>
          {hasData ? (result.score > 0 ? '+' : '') + result.score : '—'}
        </div>
        <div style={{ fontFamily: FONT, fontSize: 10, color: COLORS.text3 }}>
          {!hasData ? 'log a sample'
            : result.score >= 50 ? 'room to push speed'
            : result.score >= 20 ? 'comfortable — hold steady'
            : result.score >= 0 ? 'tight — watch it'
            : result.score >= -20 ? 'failing — secondary market?'
            : 'failing hard — slow down'}
        </div>
      </div>

      {/* Grade card */}
      <div style={{
        background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
        borderRadius: 6, padding: '16px 14px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: !hasData ? COLORS.border2
            : result.status === 'fail' ? COLORS.red
            : result.status === 'warn' ? COLORS.amber
            : COLORS.green,
        }} />
        <div style={{
          fontFamily: FONT, fontSize: 9, color: COLORS.text3,
          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6,
        }}>Grade</div>
        <div style={{
          fontFamily: FONT, fontSize: 16, fontWeight: 600,
          color: !hasData ? COLORS.text3 : result.status === 'fail' ? '#ff6b5b' : COLORS.green,
          lineHeight: 1.2,
        }}>
          {hasData ? result.label : '—'}
        </div>
      </div>

      {/* Total berries */}
      <div style={{
        background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
        borderRadius: 6, padding: '16px 14px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: COLORS.border2,
        }} />
        <div style={{
          fontFamily: FONT, fontSize: 9, color: COLORS.text3,
          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6,
        }}>Total</div>
        <div style={{
          fontFamily: FONT, fontSize: 26, fontWeight: 600,
          color: hasData ? COLORS.text : COLORS.text3, lineHeight: 1,
        }}>
          {hasData ? result.total : '—'}
        </div>
      </div>
    </div>
  )
}
