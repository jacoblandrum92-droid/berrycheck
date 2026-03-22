import React from 'react'
import { COLORS, FONT, gradeSample } from '../constants'

const GRADE_COLORS = {
  excellent: '#0F6E56',
  ok: '#0F6E56',
  warn: '#BA7517',
  fail: '#A32D2D',
  none: '#999',
}

export default function LotSummary({ lotId, history }) {
  if (!lotId) return null

  const lotSamples = history.filter(s => s.lotId === lotId)
  if (lotSamples.length === 0) return null

  const official = lotSamples.filter(s => !s.isExtra && !s.isSkipped)
  const extras = lotSamples.filter(s => s.isExtra)
  const allReal = [...official, ...extras]

  const officialAvg = averageSamples(official)
  const enhancedAvg = allReal.length > official.length ? averageSamples(allReal) : null

  const officialGrade = officialAvg ? gradeSample(officialAvg) : null
  const enhancedGrade = enhancedAvg ? gradeSample(enhancedAvg) : null

  const isComplete = official.length >= 3

  return (
    <div style={{
      background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
      borderRadius: 4, padding: '14px 16px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 14,
      }}>
        <div style={{
          fontFamily: FONT, fontSize: 10, fontWeight: 600,
          letterSpacing: '0.12em', textTransform: 'uppercase', color: COLORS.text3,
        }}>
          Pallet Grade — {lotId}
        </div>
        <div style={{
          fontFamily: FONT, fontSize: 10,
          color: isComplete ? COLORS.green : COLORS.amber,
        }}>
          {official.length}/3 SAMPLES{extras.length > 0 ? ` + ${extras.length} EXTRA` : ''}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: enhancedGrade ? '1fr 1fr' : '1fr', gap: 12 }}>
        <GradeCard
          title="SOP Grade (Official)"
          subtitle={`${official.length} sample${official.length !== 1 ? 's' : ''} averaged`}
          avg={officialAvg}
          grade={officialGrade}
          isOfficial
        />
        {enhancedGrade && (
          <GradeCard
            title="Enhanced Grade"
            subtitle={`${allReal.length} samples averaged (incl. extras)`}
            avg={enhancedAvg}
            grade={enhancedGrade}
            isOfficial={false}
          />
        )}
      </div>

      {/* Per-sample breakdown */}
      {official.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{
            fontFamily: FONT, fontSize: 9, color: COLORS.text3,
            letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8,
          }}>
            Sample Breakdown
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3].map(num => {
              const sample = official.find(s => s.sampleNum === num)
              const skipped = lotSamples.find(s => s.sampleNum === num && s.isSkipped)
              const layerNames = { 1: 'BTM', 2: 'MID', 3: 'TOP' }

              if (skipped) {
                return <SampleChip key={num} label={`#${num} ${layerNames[num]}`}
                  value="SKIP" color={COLORS.text3} dimmed />
              }
              if (!sample) {
                return <SampleChip key={num} label={`#${num} ${layerNames[num]}`}
                  value="—" color={COLORS.text3} dimmed />
              }

              const result = gradeSample(sample)
              const color = GRADE_COLORS[result.status] || COLORS.text3

              return (
                <SampleChip key={num} label={`#${num} ${layerNames[num]}`}
                  value={result.label || '—'}
                  color={color}
                  detail={`P:${sample.permanent || 0} C:${sample.condition || 0} D:${sample.decay || 0}`}
                />
              )
            })}
          </div>

          {extras.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              {extras.map((s, i) => {
                const result = gradeSample(s)
                const color = GRADE_COLORS[result.status] || COLORS.text3
                return (
                  <SampleChip key={s.id} label={`EX${i + 1}`}
                    value={result.label || '—'}
                    color={color} extra />
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function GradeCard({ title, subtitle, avg, grade, isOfficial }) {
  if (!grade) return null

  const gradeColor = GRADE_COLORS[grade.status] || COLORS.text3

  return (
    <div style={{
      background: COLORS.bg3, border: `1px solid ${isOfficial ? gradeColor + '40' : COLORS.border}`,
      borderRadius: 4, padding: 12, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: gradeColor,
      }} />
      <div style={{
        fontFamily: FONT, fontSize: 9, color: COLORS.text3,
        letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4,
      }}>
        {title}
      </div>

      <div style={{
        fontFamily: FONT, fontSize: 28, fontWeight: 700,
        color: gradeColor, lineHeight: 1, marginBottom: 6,
      }}>
        {grade.label}
      </div>

      {avg && (
        <div style={{
          fontFamily: FONT, fontSize: 10, color: COLORS.text2, lineHeight: 1.8,
        }}>
          <div>Permanent: <span style={{ fontWeight: 600, color: COLORS.text }}>{grade.pctPermanent}%</span></div>
          <div>Condition: <span style={{ fontWeight: 600, color: COLORS.text }}>{grade.pctCondition}%</span></div>
          <div>Combined: <span style={{ fontWeight: 600, color: grade.pctCombined >= 10 ? COLORS.red : COLORS.text }}>{grade.pctCombined}%</span></div>
        </div>
      )}

      <div style={{
        fontFamily: FONT, fontSize: 9, color: COLORS.text3, marginTop: 6,
      }}>
        {subtitle}
      </div>
    </div>
  )
}

function SampleChip({ label, value, color, detail, dimmed, extra }) {
  return (
    <div style={{
      flex: 1, background: COLORS.bg3,
      border: `1px solid ${extra ? COLORS.purple + '30' : COLORS.border}`,
      borderRadius: 3, padding: '6px 8px', textAlign: 'center',
      opacity: dimmed ? 0.4 : 1,
    }}>
      <div style={{
        fontFamily: FONT, fontSize: 8, color: extra ? COLORS.purple : COLORS.text3,
        letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: FONT, fontSize: 13, fontWeight: 700, color, lineHeight: 1,
      }}>
        {value}
      </div>
      {detail && (
        <div style={{
          fontFamily: FONT, fontSize: 8, color: COLORS.text3, marginTop: 3,
        }}>
          {detail}
        </div>
      )}
    </div>
  )
}

function averageSamples(samples) {
  if (samples.length === 0) return null
  const keys = ['good', 'permanent', 'condition', 'decay']
  const avg = {}
  for (const key of keys) {
    const sum = samples.reduce((a, s) => a + (s[key] || 0), 0)
    avg[key] = Math.round((sum / samples.length) * 10) / 10
  }
  return avg
}
