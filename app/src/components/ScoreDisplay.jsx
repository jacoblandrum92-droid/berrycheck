import React from 'react'
import { COLORS, FONT, gradeSample, PACK_CRITERIA, GRADE_RANK } from '../constants'

const GRADE_COLORS = {
  excellent: '#0F6E56',
  ok: '#0F6E56',
  warn: '#BA7517',
  fail: '#A32D2D',
  none: '#999',
}

export default function ScoreDisplay({ counts, packCriteria, tolerances }) {
  const result = gradeSample(counts, tolerances)
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

  // Pack criteria check — separate from grade
  const pc = PACK_CRITERIA[packCriteria] || PACK_CRITERIA.standard
  const thirtyBerryWeight = counts._thirtyBerryWeight || 0
  let packCheck = null

  if (hasData && packCriteria !== 'standard') {
    const issues = []

    // Grade gate
    if (pc.minGrade) {
      const gradeOk = GRADE_RANK[result.grade] >= GRADE_RANK[pc.minGrade]
      if (!gradeOk) {
        issues.push(`Needs ${pc.minGrade.toUpperCase()}+ grade, currently ${result.label}`)
      }
    }

    // Berry size gate
    if (pc.min30BerryWeight && thirtyBerryWeight > 0) {
      if (thirtyBerryWeight < pc.min30BerryWeight) {
        const currentMM = Math.round(13 + ((thirtyBerryWeight / 30) - 1.1) * 4.55)
        const requiredMM = Math.round(13 + ((pc.min30BerryWeight / 30) - 1.1) * 4.55)
        issues.push(`Berry size ~${currentMM}mm, need ${requiredMM}mm+`)
      }
    } else if (pc.min30BerryWeight && thirtyBerryWeight === 0) {
      issues.push('Enter 30-berry weight to check size requirement')
    }

    // Baxlo gate (Sweet Selections)
    if (pc.minBaxlo) {
      // Baxlo is optional — just note the requirement if not entered
      issues.push(`Baxlo >75 required (verify with durometer)`)
    }

    packCheck = {
      pass: issues.length === 0 || (issues.length === 1 && issues[0].includes('Baxlo')),
      issues,
      label: pc.label,
    }
  }

  return (
    <div>
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
          }}>{tolerances ? 'Grade' : 'MBG Grade'}</div>
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

        {/* Bottleneck */}
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
              <div style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3 }}>
                {result.bottleneck.name}
              </div>
            </>
          ) : (
            <div style={{ fontFamily: FONT, fontSize: 22, fontWeight: 700, color: COLORS.text3, lineHeight: 1 }}>—</div>
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
          <div style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3 }}>
            {hasData ? `${result.totalDefects} of ${result.total}` : 'combined'}
          </div>
        </div>
      </div>

      {/* Pack criteria check — separate from grade */}
      {packCheck && (
        <div style={{
          marginTop: 10,
          background: packCheck.pass ? COLORS.greenDim : COLORS.redDim,
          border: `1px solid ${packCheck.pass ? COLORS.green : COLORS.red}`,
          borderRadius: 6, padding: '10px 14px',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: packCheck.issues.length > 0 ? 6 : 0,
          }}>
            <div style={{
              fontFamily: FONT, fontSize: 10, fontWeight: 700,
              color: packCheck.pass ? COLORS.green : COLORS.red,
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              {packCheck.label}: {packCheck.pass ? 'PASS' : 'DOES NOT QUALIFY'}
            </div>
            <div style={{
              fontFamily: FONT, fontSize: 9, color: COLORS.text3,
              fontStyle: 'italic',
            }}>
              Fruit grade stands — pack spec is separate
            </div>
          </div>
          {/* Spec requirements */}
          {pc.spec && (
            <div style={{
              fontFamily: FONT, fontSize: 9, color: COLORS.text2,
              marginBottom: packCheck.issues.length > 0 ? 6 : 0,
              lineHeight: 1.4,
            }}>
              {pc.spec}
            </div>
          )}
          {/* Current issues */}
          {packCheck.issues.length > 0 && (
            <div style={{
              fontFamily: FONT, fontSize: 10,
              color: packCheck.pass ? COLORS.green : COLORS.red,
              opacity: 0.8,
            }}>
              {packCheck.issues.map((issue, i) => (
                <div key={i}>· {issue}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
