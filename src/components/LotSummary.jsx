import React from 'react'
import { COLORS, FONT, MBG_LIMITS, gradeSample } from '../constants'

/**
 * Lot accumulation panel.
 * Shows official pallet grade (avg of 3 SOP samples)
 * and enhanced grade (all samples including extras).
 * Skipped layers are excluded from averages.
 */
export default function LotSummary({ lotId, history }) {
  if (!lotId) return null

  const lotSamples = history.filter(s => s.lotId === lotId)
  if (lotSamples.length === 0) return null

  const official = lotSamples.filter(s => !s.isExtra && !s.isSkipped)
  const extras = lotSamples.filter(s => s.isExtra)
  const allReal = [...official, ...extras] // everything except skipped

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
        {/* Official SOP Grade */}
        <GradeCard
          title="SOP Grade (Official)"
          subtitle={`${official.length} sample${official.length !== 1 ? 's' : ''} averaged`}
          avg={officialAvg}
          grade={officialGrade}
          isOfficial
        />

        {/* Enhanced Grade */}
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
                return (
                  <SampleChip key={num} label={`#${num} ${layerNames[num]}`}
                    value="SKIP" color={COLORS.text3} dimmed />
                )
              }
              if (!sample) {
                return (
                  <SampleChip key={num} label={`#${num} ${layerNames[num]}`}
                    value="—" color={COLORS.text3} dimmed />
                )
              }

              const result = gradeSample(sample)
              const scoreColor = result.status === 'zero_tolerance' ? '#ff0040'
                : result.status === 'fail' ? '#ff6b5b'
                : result.status === 'warn' ? COLORS.amber
                : COLORS.green

              return (
                <SampleChip key={num} label={`#${num} ${layerNames[num]}`}
                  value={result.score === null ? 'FAIL' : (result.score > 0 ? '+' : '') + result.score}
                  color={scoreColor}
                  detail={`S:${sample.soft || 0} M:${sample.major || 0} D:${(sample.reds || 0) + (sample.greens || 0) + (sample.defects || 0)}`}
                />
              )
            })}
          </div>

          {/* Extra samples */}
          {extras.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              {extras.map((s, i) => {
                const result = gradeSample(s)
                const scoreColor = result.status === 'fail' ? '#ff6b5b'
                  : result.status === 'warn' ? COLORS.amber
                  : COLORS.green
                return (
                  <SampleChip key={s.id} label={`EX${i + 1}`}
                    value={result.score === null ? 'FAIL' : (result.score > 0 ? '+' : '') + result.score}
                    color={scoreColor} extra />
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

  const scoreColor = grade.status === 'zero_tolerance' ? '#ff0040'
    : grade.status === 'fail' ? '#ff6b5b'
    : grade.status === 'warn' ? COLORS.amber
    : COLORS.green

  const limits = MBG_LIMITS

  return (
    <div style={{
      background: COLORS.bg3, border: `1px solid ${isOfficial ? scoreColor + '40' : COLORS.border}`,
      borderRadius: 4, padding: 12, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: scoreColor,
      }} />
      <div style={{
        fontFamily: FONT, fontSize: 9, color: COLORS.text3,
        letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4,
      }}>
        {title}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
        <div style={{
          fontFamily: FONT, fontSize: 36, fontWeight: 700,
          color: scoreColor, lineHeight: 1,
        }}>
          {grade.score === null ? 'FAIL' : (grade.score > 0 ? '+' : '') + grade.score}
        </div>
        <div style={{
          fontFamily: FONT, fontSize: 14, fontWeight: 600,
          color: scoreColor,
        }}>
          {grade.label}
        </div>
      </div>

      {/* Averaged counts */}
      {avg && (
        <div style={{
          fontFamily: FONT, fontSize: 10, color: COLORS.text2, lineHeight: 1.8,
        }}>
          <div>Soft: <span style={{ color: (avg.soft || 0) > limits.character.soft ? '#ff6b5b' : COLORS.text }}>{round1(avg.soft || 0)}</span>/{limits.character.soft}</div>
          <div>Major: <span style={{ color: (avg.major || 0) > limits.character.crushedSplitLeak ? '#ff6b5b' : COLORS.text }}>{round1(avg.major || 0)}</span>/{limits.character.crushedSplitLeak}</div>
          <div>Minor: <span style={{ color: ((avg.reds || 0) + (avg.greens || 0) + (avg.defects || 0)) > limits.defects.totalMax ? '#ff6b5b' : COLORS.text }}>{round1((avg.reds || 0) + (avg.greens || 0) + (avg.defects || 0))}</span>/{limits.defects.totalMax}</div>
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
        fontFamily: FONT, fontSize: 16, fontWeight: 700, color, lineHeight: 1,
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

/**
 * Average the counts across multiple samples.
 * Returns an object with averaged counts that can be fed into gradeSample().
 */
function averageSamples(samples) {
  if (samples.length === 0) return null

  const keys = ['good', 'soft', 'major', 'reds', 'greens', 'defects', 'zero']
  const avg = {}

  for (const key of keys) {
    const sum = samples.reduce((a, s) => a + (s[key] || 0), 0)
    avg[key] = Math.round((sum / samples.length) * 10) / 10
  }

  return avg
}

function round1(n) {
  return Math.round(n * 10) / 10
}
