import React from 'react'
import { COLORS, FONT, gradeSample } from '../constants'

const GRADE_COLORS = {
  excellent: '#0F6E56',
  ok: '#0F6E56',
  warn: '#BA7517',
  fail: '#A32D2D',
  none: '#999',
}

export default function ScoreDisplay({ counts }) {
  const result = gradeSample(counts)
  const hasData = result.total > 0

  const gradeColor = GRADE_COLORS[result.status] || COLORS.text3

  // Guidance text based on grade and score
  const guidance = !hasData ? 'waiting for sample'
    : result.grade === 'excellent' && result.score >= 50 ? 'room to push speed'
    : result.grade === 'excellent' ? 'Excellent but tight — watch it'
    : result.grade === 'good' && result.score >= 50 ? 'solid Good — hold pace'
    : result.grade === 'good' ? 'Good but drifting toward Fair'
    : result.grade === 'fair' && result.score >= 30 ? 'Fair — manageable'
    : result.grade === 'fair' ? 'Fair — close to Poor'
    : 'Poor — slow down or divert'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
      {/* Grade card — the big one */}
      <div style={{
        background: COLORS.bg2, border: `1px solid ${hasData ? gradeColor + '40' : COLORS.border}`,
        borderRadius: 6, padding: '16px 20px', gridColumn: 'span 2',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: hasData ? gradeColor : COLORS.border2,
        }} />
        <div style={{
          fontFamily: FONT, fontSize: 9, color: COLORS.text3,
          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6,
        }}>MBG Grade</div>
        <div style={{
          fontFamily: FONT, fontSize: 42, fontWeight: 700,
          color: gradeColor, lineHeight: 1, marginBottom: 4,
        }}>
          {hasData ? result.label : '—'}
        </div>
        <div style={{ fontFamily: FONT, fontSize: 11, color: COLORS.text3 }}>
          {guidance}
        </div>
      </div>

      {/* Bottleneck — what's closest to dropping you */}
      <div style={{
        background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
        borderRadius: 6, padding: '16px 14px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: hasData && result.bottleneck
            ? (result.bottleneck.remaining <= 1 ? COLORS.red : result.bottleneck.remaining <= 2 ? COLORS.amber : COLORS.green)
            : COLORS.border2,
        }} />
        <div style={{
          fontFamily: FONT, fontSize: 9, color: COLORS.text3,
          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6,
        }}>Tightest</div>
        {hasData && result.bottleneck ? (
          <>
            <div style={{
              fontFamily: FONT, fontSize: 22, fontWeight: 700,
              color: result.bottleneck.remaining <= 1 ? COLORS.red : COLORS.text,
              lineHeight: 1, marginBottom: 2,
            }}>
              {result.bottleneck.remaining}%
            </div>
            <div style={{
              fontFamily: FONT, fontSize: 9, color: COLORS.text3,
            }}>
              {result.bottleneck.name}
            </div>
          </>
        ) : (
          <div style={{
            fontFamily: FONT, fontSize: 22, fontWeight: 700,
            color: COLORS.text3, lineHeight: 1,
          }}>—</div>
        )}
      </div>

      {/* Combined defect % */}
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
        }}>Defects</div>
        <div style={{
          fontFamily: FONT, fontSize: 22, fontWeight: 600,
          color: hasData ? (result.pctCombined >= 10 ? COLORS.red : COLORS.text) : COLORS.text3,
          lineHeight: 1, marginBottom: 2,
        }}>
          {hasData ? result.pctCombined + '%' : '—'}
        </div>
        <div style={{
          fontFamily: FONT, fontSize: 9, color: COLORS.text3,
        }}>
          {hasData ? `${result.totalDefects} of ${result.total}` : 'combined'}
        </div>
      </div>
    </div>
  )
}
