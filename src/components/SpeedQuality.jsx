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
