import React, { useState, useEffect } from 'react'
import { COLORS, FONT, gradeSample } from '../constants'

const GRADE_COLORS = {
  excellent: '#0F6E56', good: '#0F6E56', fair: '#BA7517', poor: '#A32D2D',
}

/**
 * Speed vs Quality — shows the relationship between line stats and pallet grades.
 * Joins pack log (line stats) with sample history (grades) by daily pallet number.
 * This is the core data view for the "run to the line" optimization thesis.
 */
export default function SpeedQuality({ history, growerFilter }) {
  const [packLog, setPackLog] = useState([])

  useEffect(() => {
    const refresh = () => {
      try { setPackLog(JSON.parse(localStorage.getItem('bc_packlog') || '[]')) } catch { setPackLog([]) }
    }
    refresh()
    const id = setInterval(refresh, 5000)
    return () => clearInterval(id)
  }, [])

  // Build pallet-level data by joining history + pack log on dailyPalletNum
  const allPalletData = buildPalletData(history, packLog)

  // Filter by grower if set
  const palletData = growerFilter
    ? allPalletData.filter(p => p.grower === growerFilter)
    : allPalletData

  // Only show pallets that have both grade and at least one line stat
  const paired = palletData.filter(p => p.grade && p.grade !== 'none' && (p.lineRate || p.blowoff != null))

  // Correlation summary
  const withRate = paired.filter(p => p.lineRate)
  const withBlowoff = paired.filter(p => p.blowoff != null)

  // Group by grade for averages
  const byGrade = {}
  for (const p of paired) {
    if (!byGrade[p.grade]) byGrade[p.grade] = []
    byGrade[p.grade].push(p)
  }

  const gradeOrder = ['excellent', 'good', 'fair', 'poor']

  return (
    <div style={{
      background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
      borderRadius: 4, padding: '14px 16px',
    }}>
      <div style={{
        fontFamily: FONT, fontSize: 10, fontWeight: 600,
        letterSpacing: '0.12em', textTransform: 'uppercase',
        color: COLORS.text3, marginBottom: 12,
      }}>
        Speed vs Quality{growerFilter ? ` — ${growerFilter}` : ''}
      </div>

      {paired.length === 0 ? (
        <div style={{
          fontFamily: FONT, fontSize: 11, color: COLORS.text3,
          textAlign: 'center', padding: 24,
        }}>
          Need pallets with both QC grades and line stats to show correlations.
          {palletData.length > 0 && ` (${palletData.length} pallets graded, ${paired.length} with line stats)`}
        </div>
      ) : (
        <>
          {/* Grade vs avg line stats summary */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '100px 1fr 1fr 1fr 80px',
            gap: 0, marginBottom: 14,
          }}>
            <div style={headerCell}>Grade</div>
            <div style={headerCell}>Avg Lbs/Hr</div>
            <div style={headerCell}>Avg Blowoff</div>
            <div style={headerCell}>Avg Defect %</div>
            <div style={headerCell}>Pallets</div>

            {gradeOrder.filter(g => byGrade[g]).map(g => {
              const pallets = byGrade[g]
              const avgRate = avg(pallets.map(p => p.lineRate).filter(Boolean))
              const avgBlow = avg(pallets.map(p => p.blowoff).filter(v => v != null))
              const avgDefect = avg(pallets.map(p => p.pctCombined).filter(Boolean))
              const color = GRADE_COLORS[g] || COLORS.text

              return [
                <div key={`${g}-grade`} style={{ ...dataCell, fontWeight: 700, color }}>
                  {g.toUpperCase()}
                </div>,
                <div key={`${g}-rate`} style={dataCell}>
                  {avgRate ? `${Math.round(avgRate).toLocaleString()}` : '—'}
                </div>,
                <div key={`${g}-blow`} style={dataCell}>
                  {avgBlow != null ? `${round1(avgBlow)}%` : '—'}
                </div>,
                <div key={`${g}-defect`} style={{ ...dataCell, color }}>
                  {avgDefect ? `${round1(avgDefect)}%` : '—'}
                </div>,
                <div key={`${g}-count`} style={{ ...dataCell, color: COLORS.text3 }}>
                  {pallets.length}
                </div>,
              ]
            })}
          </div>

          {/* Pallet-by-pallet timeline */}
          <div style={{
            fontFamily: FONT, fontSize: 9, color: COLORS.text3,
            letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8,
          }}>
            Pallet Timeline ({paired.length} with data)
          </div>

          <div style={{ overflowX: 'auto' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '50px 70px 80px 80px 80px 80px 100px',
              gap: 0,
            }}>
              <div style={headerCell}>#</div>
              <div style={headerCell}>Grade</div>
              <div style={headerCell}>Defect %</div>
              <div style={headerCell}>Lbs/Hr</div>
              <div style={headerCell}>Blowoff</div>
              <div style={headerCell}>Size Sort</div>
              <div style={headerCell}>Grower</div>

              {paired.map(p => {
                const color = GRADE_COLORS[p.grade] || COLORS.text3
                return [
                  <div key={`${p.dailyPallet}-num`} style={{ ...dataCell, fontWeight: 700, color: COLORS.green }}>
                    {p.dailyPallet}
                  </div>,
                  <div key={`${p.dailyPallet}-grade`} style={{ ...dataCell, fontWeight: 600, color }}>
                    {p.grade.toUpperCase()}
                  </div>,
                  <div key={`${p.dailyPallet}-defect`} style={{ ...dataCell, color }}>
                    {p.pctCombined != null ? `${p.pctCombined}%` : '—'}
                  </div>,
                  <div key={`${p.dailyPallet}-rate`} style={dataCell}>
                    {p.lineRate ? Math.round(p.lineRate).toLocaleString() : '—'}
                  </div>,
                  <div key={`${p.dailyPallet}-blow`} style={dataCell}>
                    {p.blowoff != null ? `${p.blowoff}%` : '—'}
                  </div>,
                  <div key={`${p.dailyPallet}-size`} style={dataCell}>
                    {p.sizeDiversion != null ? `${p.sizeDiversion}%` : '—'}
                  </div>,
                  <div key={`${p.dailyPallet}-grower`} style={{ ...dataCell, color: COLORS.text3, fontSize: 10 }}>
                    {p.grower || '—'}
                  </div>,
                ]
              })}
            </div>
          </div>

          {/* Insight callout */}
          {withRate.length >= 3 && (() => {
            const fast = withRate.filter(p => p.lineRate >= avg(withRate.map(r => r.lineRate)))
            const slow = withRate.filter(p => p.lineRate < avg(withRate.map(r => r.lineRate)))
            const fastDefect = avg(fast.map(p => p.pctCombined).filter(Boolean))
            const slowDefect = avg(slow.map(p => p.pctCombined).filter(Boolean))

            if (!fastDefect || !slowDefect) return null

            const delta = round1(fastDefect - slowDefect)
            const avgLine = Math.round(avg(withRate.map(r => r.lineRate)))

            return (
              <div style={{
                marginTop: 12, padding: '10px 14px',
                background: Math.abs(delta) > 2 ? COLORS.amberDim : COLORS.bg3,
                border: `1px solid ${Math.abs(delta) > 2 ? COLORS.amber : COLORS.border}`,
                borderRadius: 4, fontFamily: FONT, fontSize: 11, color: COLORS.text2,
                lineHeight: 1.6,
              }}>
                <span style={{ fontWeight: 600, color: COLORS.text }}>Pattern: </span>
                Above {avgLine} lbs/hr → avg {round1(fastDefect)}% defects.
                Below {avgLine} lbs/hr → avg {round1(slowDefect)}% defects.
                {delta > 2
                  ? ` Faster running is adding ~${delta}% defects.`
                  : delta < -1
                    ? ` Faster running is not hurting quality — room to push.`
                    : ` Speed isn't significantly affecting quality at this range.`
                }
              </div>
            )
          })()}

          {/* Line Optimizer — actionable guidance */}
          <LineOptimizer paired={paired} growerFilter={growerFilter} />
        </>
      )}
    </div>
  )
}

function buildPalletData(history, packLog) {
  // Group history by dailyPalletNum
  const historyByPallet = {}
  for (const s of history) {
    if (!s.dailyPalletNum || s.isSkipped) continue
    if (!historyByPallet[s.dailyPalletNum]) historyByPallet[s.dailyPalletNum] = []
    historyByPallet[s.dailyPalletNum].push(s)
  }

  // Group pack log by dailyPallet
  const logByPallet = {}
  for (const e of packLog) {
    if (!e.dailyPallet) continue
    // Use first entry per pallet (they share line stats)
    if (!logByPallet[e.dailyPallet]) logByPallet[e.dailyPallet] = e
  }

  // Join
  const allPalletNums = new Set([
    ...Object.keys(historyByPallet).map(Number),
    ...Object.keys(logByPallet).map(Number),
  ])

  const result = []
  for (const num of allPalletNums) {
    const samples = historyByPallet[num] || []
    const logEntry = logByPallet[num]

    // Grade from official samples
    const official = samples.filter(s => !s.isExtra && !s.isSkipped)
    let grade = null
    let pctCombined = null
    if (official.length > 0) {
      const keys = ['good', 'permanent', 'condition', 'decay']
      const avgCounts = {}
      for (const key of keys) {
        avgCounts[key] = Math.round((official.reduce((a, s) => a + (s[key] || 0), 0) / official.length) * 10) / 10
      }
      const gradeResult = gradeSample(avgCounts)
      grade = gradeResult.grade
      pctCombined = gradeResult.pctCombined
    }

    // First sample's grower/receipt for context
    const firstSample = samples[0] || {}

    result.push({
      dailyPallet: num,
      date: firstSample.date || logEntry?.date || '',
      grade,
      pctCombined,
      lineRate: logEntry?.lineRate || null,
      blowoff: logEntry?.blowoff != null ? logEntry.blowoff : null,
      sizeDiversion: logEntry?.sizeDiversion != null ? logEntry.sizeDiversion : null,
      grower: firstSample.grower || logEntry?.grower || '',
      receiptNum: firstSample.receiptNum || logEntry?.receiptNum || '',
      sampleCount: official.length,
    })
  }

  return result.sort((a, b) => a.dailyPallet - b.dailyPallet)
}

const headerCell = {
  fontFamily: FONT, fontSize: 9, color: COLORS.text3,
  textTransform: 'uppercase', letterSpacing: '0.06em',
  padding: '6px 8px', borderBottom: `1px solid ${COLORS.border}`,
  fontWeight: 500,
}

const dataCell = {
  fontFamily: FONT, fontSize: 11, color: COLORS.text2,
  padding: '7px 8px', borderBottom: `1px solid ${COLORS.border}`,
}

function avg(arr) {
  if (arr.length === 0) return null
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function round1(n) {
  return Math.round(n * 10) / 10
}

/**
 * Line Optimizer — turns the speed/quality data into a recommendation.
 *
 * Logic:
 * 1. Get DC strictness level → maps to a defect % ceiling
 * 2. Look at this grower's pallets sorted by speed
 * 3. Find the fastest speed where grade held within DC tolerance
 * 4. Look at the last 3 pallets for trend (getting worse = early warning)
 * 5. Recommend: push, hold, or slow down
 */
function LineOptimizer({ paired, growerFilter }) {
  if (paired.length < 3) return null

  // DC strictness → approximate combined defect ceiling
  let dcLevel = 3
  try { dcLevel = parseInt(localStorage.getItem('bc_dc_strictness') || '3') } catch {}

  // DC tolerance ceiling — what % combined defects the DC will accept
  // These are rough estimates based on DC strictness level
  const dcCeiling = { 1: 14, 2: 12, 3: 10, 4: 8, 5: 6 }[dcLevel] || 10
  const dcLabel = { 1: 'Very Loose', 2: 'Loose', 3: 'Normal', 4: 'Strict', 5: 'Very Strict' }[dcLevel]

  const withRate = paired.filter(p => p.lineRate && p.pctCombined != null)
  if (withRate.length < 3) return null

  // Current state — last pallet
  const latest = withRate[withRate.length - 1]
  const currentRate = latest.lineRate
  const currentDefect = latest.pctCombined
  const headroom = round1(dcCeiling - currentDefect)

  // Recent trend — last 3 pallets
  const recent = withRate.slice(-3)
  const recentDefects = recent.map(p => p.pctCombined)
  const trending = recentDefects[2] - recentDefects[0]
  const trendDir = trending > 1.5 ? 'worse' : trending < -1.5 ? 'better' : 'stable'

  // Find the speed sweet spot for this grower
  // Sort by speed, find the fastest pallet that stayed under ceiling
  const sorted = [...withRate].sort((a, b) => a.lineRate - b.lineRate)
  const underCeiling = sorted.filter(p => p.pctCombined <= dcCeiling)
  const maxSafeRate = underCeiling.length > 0 ? Math.max(...underCeiling.map(p => p.lineRate)) : null
  const overCeiling = sorted.filter(p => p.pctCombined > dcCeiling)
  const minDangerRate = overCeiling.length > 0 ? Math.min(...overCeiling.map(p => p.lineRate)) : null

  // Blowoff analysis
  const withBlowoff = paired.filter(p => p.blowoff != null && p.pctCombined != null)
  const avgBlowoff = withBlowoff.length > 0 ? round1(avg(withBlowoff.map(p => p.blowoff))) : null

  // Build recommendation
  let action, actionColor, actionDetail

  if (currentDefect > dcCeiling) {
    // Over the line
    action = 'SLOW DOWN'
    actionColor = COLORS.red
    const safeRate = maxSafeRate ? Math.round(maxSafeRate) : Math.round(currentRate * 0.85)
    actionDetail = `You're ${round1(currentDefect - dcCeiling)}% over the DC ceiling. `
    if (maxSafeRate) {
      actionDetail += `This grower's fruit held under ${dcCeiling}% up to ${safeRate} lbs/hr. Drop to that range.`
    } else {
      actionDetail += `No safe speed found for this fruit today — consider increasing blowoff or diverting.`
    }
    if (avgBlowoff != null && avgBlowoff < 10) {
      actionDetail += ` Blowoff is at ${avgBlowoff}% — you have room to increase it before slowing the line.`
    }
  } else if (headroom <= 2) {
    // Close to the line
    action = 'HOLD'
    actionColor = COLORS.amber
    actionDetail = `Only ${headroom}% headroom to DC ceiling. `
    if (trendDir === 'worse') {
      actionDetail += `Trending worse over last 3 pallets (+${round1(trending)}%). If this continues you'll breach. Consider slowing 50-100 lbs/hr.`
    } else {
      actionDetail += `Holding steady. Don't push faster — you're right at the edge.`
    }
  } else if (headroom > 2 && trendDir === 'worse') {
    // Have room but trending wrong way
    action = 'WATCH'
    actionColor = COLORS.amber
    actionDetail = `${headroom}% headroom but trending worse (+${round1(trending)}% over last 3 pallets). `
    actionDetail += `You have room but the trend is going the wrong direction. Hold current speed and see if it stabilizes.`
  } else {
    // Have room, trend is stable or improving
    action = 'PUSH'
    actionColor = COLORS.green
    if (maxSafeRate && maxSafeRate > currentRate + 50) {
      actionDetail = `${headroom}% headroom. This grower's fruit has held up to ${Math.round(maxSafeRate)} lbs/hr today. `
      actionDetail += `You can push ~${Math.round(maxSafeRate - currentRate)} lbs/hr faster.`
    } else if (headroom > 5) {
      actionDetail = `${headroom}% headroom and trend is ${trendDir}. Room to push ~100 lbs/hr and see what happens.`
    } else {
      actionDetail = `${headroom}% headroom, trend is stable. Modest room to push — try 50 lbs/hr increments.`
    }
    if (avgBlowoff != null && avgBlowoff > 10) {
      actionDetail += ` Blowoff is high at ${avgBlowoff}% — consider reducing it to improve packout while you push speed.`
    }
  }

  return (
    <div style={{
      marginTop: 14, borderRadius: 6, overflow: 'hidden',
      border: `2px solid ${actionColor}`,
    }}>
      {/* Action banner */}
      <div style={{
        background: actionColor, padding: '10px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{
          fontFamily: FONT, fontSize: 16, fontWeight: 800,
          color: '#fff', letterSpacing: '0.1em',
        }}>
          {action}
        </div>
        <div style={{
          fontFamily: FONT, fontSize: 11, color: '#fff', opacity: 0.9,
        }}>
          {growerFilter || 'All growers'} · DC: {dcLabel} (≤{dcCeiling}%)
        </div>
      </div>

      {/* Detail */}
      <div style={{ padding: '12px 16px', background: actionColor + '08' }}>
        {/* Current state */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 10, marginBottom: 12,
        }}>
          <div>
            <div style={{ fontFamily: FONT, fontSize: 8, color: COLORS.text3, letterSpacing: '0.06em' }}>CURRENT SPEED</div>
            <div style={{ fontFamily: FONT, fontSize: 18, fontWeight: 700, color: COLORS.text }}>{Math.round(currentRate)}</div>
            <div style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3 }}>lbs/hr</div>
          </div>
          <div>
            <div style={{ fontFamily: FONT, fontSize: 8, color: COLORS.text3, letterSpacing: '0.06em' }}>DEFECTS</div>
            <div style={{ fontFamily: FONT, fontSize: 18, fontWeight: 700, color: currentDefect > dcCeiling ? COLORS.red : COLORS.text }}>{currentDefect}%</div>
            <div style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3 }}>combined</div>
          </div>
          <div>
            <div style={{ fontFamily: FONT, fontSize: 8, color: COLORS.text3, letterSpacing: '0.06em' }}>HEADROOM</div>
            <div style={{ fontFamily: FONT, fontSize: 18, fontWeight: 700, color: headroom <= 0 ? COLORS.red : headroom <= 2 ? COLORS.amber : COLORS.green }}>{headroom}%</div>
            <div style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3 }}>to DC ceiling</div>
          </div>
          <div>
            <div style={{ fontFamily: FONT, fontSize: 8, color: COLORS.text3, letterSpacing: '0.06em' }}>TREND (3 PAL)</div>
            <div style={{ fontFamily: FONT, fontSize: 18, fontWeight: 700, color: trendDir === 'worse' ? COLORS.red : trendDir === 'better' ? COLORS.green : COLORS.text3 }}>
              {trendDir === 'worse' ? '+' + round1(trending) + '%' : trendDir === 'better' ? round1(trending) + '%' : 'FLAT'}
            </div>
            <div style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3 }}>{trendDir}</div>
          </div>
        </div>

        {/* Recommendation text */}
        <div style={{
          fontFamily: FONT, fontSize: 12, color: COLORS.text2,
          lineHeight: 1.7, padding: '8px 0',
        }}>
          {actionDetail}
        </div>

        {/* Speed range bar — visual of where you are vs safe zone */}
        {maxSafeRate && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontFamily: FONT, fontSize: 8, color: COLORS.text3, letterSpacing: '0.06em', marginBottom: 4 }}>
              SPEED RANGE FOR THIS GROWER
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3, width: 40 }}>
                {Math.round(Math.min(...withRate.map(p => p.lineRate)))}
              </span>
              <div style={{
                flex: 1, height: 8, background: COLORS.bg3, borderRadius: 4, position: 'relative', overflow: 'visible',
              }}>
                {/* Safe zone */}
                {(() => {
                  const minRate = Math.min(...withRate.map(p => p.lineRate))
                  const maxRate = Math.max(...withRate.map(p => p.lineRate))
                  const range = maxRate - minRate || 1
                  const safeEnd = ((maxSafeRate - minRate) / range) * 100
                  const dangerStart = minDangerRate ? ((minDangerRate - minRate) / range) * 100 : 100
                  const currentPos = ((currentRate - minRate) / range) * 100

                  return (
                    <>
                      <div style={{
                        position: 'absolute', left: 0, top: 0, bottom: 0,
                        width: `${Math.min(100, safeEnd)}%`,
                        background: COLORS.green + '40', borderRadius: 4,
                      }} />
                      {minDangerRate && (
                        <div style={{
                          position: 'absolute', right: 0, top: 0, bottom: 0,
                          width: `${100 - dangerStart}%`,
                          background: COLORS.red + '30', borderRadius: 4,
                        }} />
                      )}
                      {/* Current position marker */}
                      <div style={{
                        position: 'absolute', top: -3, left: `${Math.min(98, Math.max(2, currentPos))}%`,
                        width: 4, height: 14, background: actionColor, borderRadius: 2,
                        transform: 'translateX(-50%)',
                      }} />
                    </>
                  )
                })()}
              </div>
              <span style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3, width: 40, textAlign: 'right' }}>
                {Math.round(Math.max(...withRate.map(p => p.lineRate)))}
              </span>
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between', marginTop: 2,
              fontFamily: FONT, fontSize: 8, color: COLORS.text3,
            }}>
              <span style={{ color: COLORS.green }}>safe</span>
              <span style={{ color: COLORS.red }}>risk</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
