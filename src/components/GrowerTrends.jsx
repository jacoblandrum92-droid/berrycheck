import React from 'react'
import { COLORS, FONT, gradeSample } from '../constants'

const GRADE_COLORS = {
  excellent: '#0F6E56', good: '#0F6E56', fair: '#BA7517', poor: '#A32D2D', none: '#999',
}

/**
 * Grower Trends — aggregates QC data by grower and variety across all samples.
 * Shows which growers send clean fruit (run fast) vs marginal fruit (babysit).
 */
export default function GrowerTrends({ history, growerFilter }) {
  // Filter to selected grower
  const filtered = growerFilter
    ? history.filter(s => s.grower === growerFilter)
    : history

  // Group samples by grower + variety
  const groups = {}
  for (const s of filtered) {
    if (s.isSkipped || !s.grower) continue
    const key = `${s.grower}||${s.variety || ''}`
    if (!groups[key]) {
      groups[key] = {
        grower: s.grower,
        variety: s.variety || '',
        samples: [],
        pallets: new Set(),
        receipts: new Set(),
      }
    }
    groups[key].samples.push(s)
    if (s.dailyPalletNum) groups[key].pallets.add(s.dailyPalletNum)
    if (s.receiptNum) groups[key].receipts.add(s.receiptNum)
  }

  // Calculate stats for each group
  const rows = Object.values(groups).map(g => {
    const official = g.samples.filter(s => !s.isExtra)
    const all = g.samples

    // Average counts across all samples
    const keys = ['good', 'permanent', 'condition', 'decay']
    const avgCounts = {}
    for (const key of keys) {
      avgCounts[key] = all.length > 0
        ? Math.round((all.reduce((a, s) => a + (s[key] || 0), 0) / all.length) * 10) / 10
        : 0
    }

    const gradeResult = all.length > 0 ? gradeSample(avgCounts) : null

    // Grade distribution
    const gradeDist = { excellent: 0, good: 0, fair: 0, poor: 0 }
    for (const s of all) {
      const r = gradeSample(s)
      if (gradeDist[r.grade] !== undefined) gradeDist[r.grade]++
    }

    // Trend — compare first half vs second half
    let trend = null
    if (all.length >= 4) {
      const mid = Math.floor(all.length / 2)
      const firstHalf = all.slice(0, mid)
      const secondHalf = all.slice(mid)
      const firstPct = avgPctCombined(firstHalf)
      const secondPct = avgPctCombined(secondHalf)
      if (firstPct != null && secondPct != null) {
        const delta = round1(secondPct - firstPct)
        trend = { delta, direction: delta > 1 ? 'worse' : delta < -1 ? 'better' : 'stable' }
      }
    }

    return {
      grower: g.grower,
      variety: g.variety,
      sampleCount: all.length,
      palletCount: g.pallets.size,
      receiptCount: g.receipts.size,
      grade: gradeResult?.grade || 'none',
      gradeLabel: gradeResult?.label || '—',
      pctCombined: gradeResult?.pctCombined ?? 0,
      pctPermanent: gradeResult?.pctPermanent ?? 0,
      pctCondition: gradeResult?.pctCondition ?? 0,
      pctDecay: gradeResult?.pctDecay ?? 0,
      gradeDist,
      trend,
    }
  })

  // Sort by defect % descending — worst growers at top
  rows.sort((a, b) => b.pctCombined - a.pctCombined)

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
        {growerFilter ? `${growerFilter} — Variety Breakdown` : 'Grower Quality Trends'}
      </div>

      {rows.length === 0 ? (
        <div style={{
          fontFamily: FONT, fontSize: 11, color: COLORS.text3,
          textAlign: 'center', padding: 24,
        }}>
          No grower data yet. Samples need a grower name to appear here.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map(r => {
            const color = GRADE_COLORS[r.grade] || COLORS.text3
            const trendColor = !r.trend ? COLORS.text3
              : r.trend.direction === 'worse' ? COLORS.red
              : r.trend.direction === 'better' ? COLORS.green
              : COLORS.text3

            return (
              <div key={`${r.grower}-${r.variety}`} style={{
                background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                borderLeft: `3px solid ${color}`,
                borderRadius: 4, padding: '10px 14px',
              }}>
                {/* Top row — grower identity + grade */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 8,
                }}>
                  <div>
                    <span style={{
                      fontFamily: FONT, fontSize: 13, fontWeight: 700, color: COLORS.text,
                    }}>
                      {r.grower}
                    </span>
                    {r.variety && (
                      <span style={{
                        fontFamily: FONT, fontSize: 11, color: COLORS.text3, marginLeft: 8,
                      }}>
                        {r.variety}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {r.trend && (
                      <span style={{
                        fontFamily: FONT, fontSize: 9, fontWeight: 600,
                        color: trendColor, letterSpacing: '0.04em',
                      }}>
                        {r.trend.direction === 'worse' ? `+${r.trend.delta}%` :
                         r.trend.direction === 'better' ? `${r.trend.delta}%` : 'STABLE'}
                        {r.trend.direction !== 'stable' && (
                          r.trend.direction === 'worse' ? ' TRENDING UP' : ' TRENDING DOWN'
                        )}
                      </span>
                    )}
                    <span style={{
                      fontFamily: FONT, fontSize: 12, fontWeight: 700,
                      color, padding: '2px 8px', borderRadius: 3,
                      background: color + '15',
                    }}>
                      {r.gradeLabel}
                    </span>
                  </div>
                </div>

                {/* Stats row */}
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)',
                  gap: 8,
                }}>
                  <StatCell label="Samples" value={r.sampleCount} />
                  <StatCell label="Pallets" value={r.palletCount} />
                  <StatCell label="Combined" value={`${r.pctCombined}%`} color={color} />
                  <StatCell label="Permanent" value={`${r.pctPermanent}%`} />
                  <StatCell label="Condition" value={`${r.pctCondition}%`} />
                  <StatCell label="Decay" value={`${r.pctDecay}%`}
                    color={r.pctDecay > 0 ? COLORS.red : undefined} />
                </div>

                {/* Grade distribution bar */}
                {r.sampleCount >= 2 && (
                  <div style={{
                    display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden',
                    marginTop: 8,
                  }}>
                    {['excellent', 'good', 'fair', 'poor'].map(g => {
                      const count = r.gradeDist[g]
                      if (count === 0) return null
                      const pct = (count / r.sampleCount) * 100
                      return (
                        <div key={g} style={{
                          width: `${pct}%`,
                          background: GRADE_COLORS[g],
                          opacity: 0.6,
                        }} title={`${g}: ${count} samples`} />
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatCell({ label, value, color }) {
  return (
    <div>
      <div style={{
        fontFamily: FONT, fontSize: 8, color: COLORS.text3,
        letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2,
      }}>{label}</div>
      <div style={{
        fontFamily: FONT, fontSize: 12, fontWeight: 600,
        color: color || COLORS.text,
      }}>{value}</div>
    </div>
  )
}

function avgPctCombined(samples) {
  if (samples.length === 0) return null
  const keys = ['good', 'permanent', 'condition', 'decay']
  const avgCounts = {}
  for (const key of keys) {
    avgCounts[key] = Math.round((samples.reduce((a, s) => a + (s[key] || 0), 0) / samples.length) * 10) / 10
  }
  return gradeSample(avgCounts).pctCombined
}

function round1(n) {
  return Math.round(n * 10) / 10
}
