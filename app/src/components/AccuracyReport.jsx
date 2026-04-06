import React, { useState } from 'react'
import { COLORS, FONT, ZONE_TYPES } from '../constants'

export default function AccuracyReport({ onClose }) {
  const [log] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bc_accuracy') || '[]') } catch { return [] }
  })

  if (log.length === 0) {
    return (
      <div style={overlayStyle}>
        <div style={panelStyle}>
          <div style={headerStyle}>
            <span>Computer Accuracy Report</span>
            <button onClick={onClose} style={closeBtnStyle}>CLOSE</button>
          </div>
          <div style={{
            padding: 40, textAlign: 'center',
            fontFamily: FONT, fontSize: 12, color: COLORS.text3,
          }}>
            No A/B data yet. Log samples with computer counts to start tracking accuracy.
          </div>
        </div>
      </div>
    )
  }

  // Calculate accuracy stats
  const totalSamples = log.length
  const editedSamples = log.filter(e => e.edited).length
  const unchangedSamples = totalSamples - editedSamples
  const accuracyPct = Math.round((unchangedSamples / totalSamples) * 100)

  // Per-zone accuracy
  const zoneKeys = ZONE_TYPES.map(zt => zt.key)
  const zoneStats = {}
  for (const key of zoneKeys) {
    let totalDiff = 0
    let totalCount = 0
    let exactMatches = 0
    let sampleCount = 0

    for (const entry of log) {
      if (entry.a && entry.b && entry.a[key] !== undefined && entry.b[key] !== undefined) {
        const a = entry.a[key] || 0
        const b = entry.b[key] || 0
        totalDiff += Math.abs(a - b)
        totalCount += b
        if (a === b) exactMatches++
        sampleCount++
      }
    }

    zoneStats[key] = {
      sampleCount,
      exactMatches,
      exactPct: sampleCount > 0 ? Math.round((exactMatches / sampleCount) * 100) : 0,
      avgDiff: sampleCount > 0 ? Math.round((totalDiff / sampleCount) * 10) / 10 : 0,
    }
  }

  return (
    <div style={overlayStyle}>
      <div style={panelStyle}>
        <div style={headerStyle}>
          <span>Computer Accuracy Report</span>
          <button onClick={onClose} style={closeBtnStyle}>CLOSE</button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto' }}>
          {/* Summary */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20,
          }}>
            <StatCard label="Total Samples" value={totalSamples} color={COLORS.text} />
            <StatCard label="Accepted As-Is" value={`${accuracyPct}%`}
              color={accuracyPct >= 80 ? COLORS.green : accuracyPct >= 50 ? COLORS.amber : COLORS.red} />
            <StatCard label="Operator Edits" value={editedSamples} color={COLORS.amber} />
          </div>

          {/* Per-zone breakdown */}
          <div style={{
            fontFamily: FONT, fontSize: 10, fontWeight: 600,
            color: COLORS.text3, letterSpacing: '0.12em', textTransform: 'uppercase',
            marginBottom: 10,
          }}>Per-Zone Accuracy</div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Zone</th>
                <th style={thStyle}>Exact Match</th>
                <th style={thStyle}>Avg Diff</th>
                <th style={thStyle}>Samples</th>
              </tr>
            </thead>
            <tbody>
              {ZONE_TYPES.map(zt => {
                const s = zoneStats[zt.key]
                if (!s || s.sampleCount === 0) return null
                return (
                  <tr key={zt.key} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    <td style={{ ...tdStyle, color: zt.color }}>{zt.label}</td>
                    <td style={{
                      ...tdStyle, fontWeight: 600,
                      color: s.exactPct >= 80 ? COLORS.green : s.exactPct >= 50 ? COLORS.amber : COLORS.red,
                    }}>{s.exactPct}%</td>
                    <td style={tdStyle}>{s.avgDiff === 0 ? '0' : `+/-${s.avgDiff}`}</td>
                    <td style={tdStyle}>{s.sampleCount}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Recent comparisons */}
          <div style={{
            fontFamily: FONT, fontSize: 10, fontWeight: 600,
            color: COLORS.text3, letterSpacing: '0.12em', textTransform: 'uppercase',
            marginTop: 20, marginBottom: 10,
          }}>Recent A/B Comparisons</div>

          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {[...log].reverse().slice(0, 20).map(entry => (
              <div key={entry.id} style={{
                background: COLORS.bg3, border: `1px solid ${COLORS.border}`,
                borderRadius: 4, padding: 10, marginBottom: 6,
                fontFamily: FONT, fontSize: 10, color: COLORS.text2,
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', marginBottom: 6,
                }}>
                  <span>{entry.date} {entry.time}</span>
                  <span style={{
                    color: entry.edited ? COLORS.amber : COLORS.green,
                    fontWeight: 600,
                  }}>
                    {entry.edited ? 'EDITED' : 'EXACT'}
                  </span>
                </div>
                {entry.edited && (
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {ZONE_TYPES.map(zt => {
                      const a = entry.a?.[zt.key] ?? 0
                      const b = entry.b?.[zt.key] ?? 0
                      if (a === 0 && b === 0) return null
                      const diff = a !== b
                      return (
                        <span key={zt.key} style={{
                          color: diff ? COLORS.red : COLORS.text3,
                        }}>
                          {zt.label}: {a}→{b}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div style={{
      background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
      borderRadius: 6, padding: '12px 14px', textAlign: 'center',
    }}>
      <div style={{
        fontFamily: FONT, fontSize: 9, color: COLORS.text3,
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
      }}>{label}</div>
      <div style={{
        fontFamily: FONT, fontSize: 28, fontWeight: 700, color, lineHeight: 1,
      }}>{value}</div>
    </div>
  )
}

const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
  zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
}

const panelStyle = {
  background: COLORS.bg, border: `1px solid ${COLORS.border}`,
  borderRadius: 8, width: '90%', maxWidth: 700, maxHeight: '85vh',
  display: 'flex', flexDirection: 'column', overflow: 'hidden',
}

const headerStyle = {
  padding: '14px 20px', borderBottom: `1px solid ${COLORS.border}`,
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  fontFamily: FONT, fontSize: 12, fontWeight: 600,
  color: COLORS.green, letterSpacing: '0.08em', textTransform: 'uppercase',
}

const closeBtnStyle = {
  fontFamily: FONT, fontSize: 10, color: COLORS.text3,
  background: 'transparent', border: `1px solid ${COLORS.border}`,
  padding: '4px 12px', borderRadius: 3, cursor: 'pointer',
  letterSpacing: '0.06em',
}

const thStyle = {
  fontFamily: FONT, fontSize: 9, color: COLORS.text3,
  textTransform: 'uppercase', letterSpacing: '0.08em',
  textAlign: 'left', padding: '7px 12px',
  borderBottom: `1px solid ${COLORS.border}`, fontWeight: 500,
}

const tdStyle = {
  fontFamily: FONT, fontSize: 11, color: COLORS.text2, padding: '9px 12px',
}
