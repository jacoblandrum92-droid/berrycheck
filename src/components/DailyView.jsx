import React, { useState, useEffect } from 'react'

const COLORS = {
  bg: '#ffffff', bg2: '#f7f7f5', border: '#ddd',
  green: '#0F6E56', greenBg: '#E1F5EE',
  amber: '#BA7517', amberBg: '#FAEEDA',
  red: '#A32D2D', redBg: '#FCEBEB',
  text: '#1a1a1a', text2: '#666', text3: '#999',
}

const FONT = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"

const GRADE_STYLE = {
  EXCELLENT: { color: COLORS.green, bg: COLORS.greenBg },
  GOOD: { color: COLORS.green, bg: COLORS.greenBg },
  FAIR: { color: COLORS.amber, bg: COLORS.amberBg },
  POOR: { color: COLORS.red, bg: COLORS.redBg },
}

const DC_LABELS = {
  1: 'Very Loose', 2: 'Loose', 3: 'Normal', 4: 'Strict', 5: 'Very Strict',
}

export default function DailyView() {
  const [summary, setSummary] = useState(null)
  const [dates, setDates] = useState([])
  const [selectedDate, setSelectedDate] = useState(null)
  const [error, setError] = useState(null)
  const [showArchive, setShowArchive] = useState(false)

  const dateParam = new URLSearchParams(window.location.search).get('date')

  useEffect(() => {
    // Load available dates
    fetch('/api/daily').then(r => r.json()).then(setDates).catch(() => {})

    // Load specific date or today
    const target = dateParam || new Date().toLocaleDateString()
    setSelectedDate(target)
    loadDate(target)
  }, [])

  const loadDate = (date) => {
    setSelectedDate(date)
    setShowArchive(false)
    fetch(`/api/daily/${encodeURIComponent(date)}`)
      .then(r => { if (!r.ok) throw new Error('No data'); return r.json() })
      .then(d => { setSummary(d); setError(null) })
      .catch(() => { setSummary(null); setError(`No data recorded for ${date}`) })
  }

  return (
    <div style={{ fontFamily: FONT, background: COLORS.bg, minHeight: '100vh' }}>
      {/* Top bar */}
      <div style={{
        background: COLORS.bg2, borderBottom: `1px solid ${COLORS.border}`,
        padding: '12px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.green }}>BerryCheck</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setShowArchive(!showArchive)} style={{
            fontFamily: FONT, fontSize: 10, fontWeight: 600,
            color: COLORS.text3, background: 'transparent',
            border: `1px solid ${COLORS.border}`,
            padding: '5px 10px', borderRadius: 4, cursor: 'pointer',
          }}>
            {showArchive ? 'BACK' : 'ARCHIVE'}
          </button>
        </div>
      </div>

      {/* Archive date picker */}
      {showArchive ? (
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 12 }}>
            Past Days
          </div>
          {dates.length === 0 ? (
            <div style={{ color: COLORS.text3, fontSize: 13 }}>No archived data yet</div>
          ) : (
            dates.map(d => (
              <button key={d} onClick={() => loadDate(d)} style={{
                display: 'block', width: '100%', textAlign: 'left',
                fontFamily: FONT, fontSize: 13, color: d === selectedDate ? COLORS.green : COLORS.text,
                background: d === selectedDate ? COLORS.greenBg : COLORS.bg2,
                border: `1px solid ${COLORS.border}`,
                padding: '12px 16px', borderRadius: 6, cursor: 'pointer',
                marginBottom: 6, fontWeight: d === selectedDate ? 600 : 400,
              }}>
                {d}
              </button>
            ))
          )}
        </div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: 'center', color: COLORS.text3, fontSize: 14 }}>
          {error}
        </div>
      ) : !summary ? (
        <div style={{ padding: 40, textAlign: 'center', color: COLORS.text3 }}>Loading...</div>
      ) : (
        <div style={{ padding: 16 }}>
          {/* Date header */}
          <div style={{
            fontSize: 13, fontWeight: 600, color: COLORS.text2, marginBottom: 16,
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span>{summary.date}</span>
            <span>{summary.pallets?.length || 0} pallets</span>
          </div>

          {/* Day totals */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
            <StatCard label="Pallets" value={summary.pallets?.length || 0} />
            <StatCard label="Avg Lbs/Hr" value={summary.avgLineRate ? Math.round(summary.avgLineRate).toLocaleString() : '—'} />
            <StatCard label="Avg Blowoff" value={summary.avgBlowoff != null ? `${summary.avgBlowoff}%` : '—'}
              color={summary.avgBlowoff > 12 ? COLORS.red : summary.avgBlowoff > 8 ? COLORS.amber : COLORS.text} />
          </div>

          {/* Pallet list — scrollable */}
          {summary.pallets && summary.pallets.map((p, i) => {
            const gs = GRADE_STYLE[p.grade] || GRADE_STYLE.GOOD
            return (
              <div key={i} style={{
                background: COLORS.bg2, borderRadius: 8,
                padding: 14, marginBottom: 8,
                borderLeft: `4px solid ${gs.color}`,
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 6,
                }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginRight: 8 }}>
                      {p.lotId || '—'}
                    </span>
                    <span style={{ fontSize: 11, color: COLORS.text3 }}>
                      {p.receiptNum} · {p.grower}
                    </span>
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: gs.color,
                    background: gs.bg, padding: '3px 10px', borderRadius: 4,
                  }}>
                    {p.grade || '—'}
                  </span>
                </div>

                <div style={{
                  display: 'flex', gap: 16, fontSize: 11, color: COLORS.text2,
                }}>
                  <span>Defects: <b style={{ color: COLORS.text }}>{p.pctCombined || 0}%</b></span>
                  {p.lineRate && <span>Line: <b style={{ color: COLORS.text }}>{p.lineRate.toLocaleString()} lbs/hr</b></span>}
                  {p.blowoff != null && <span>Blowoff: <b style={{ color: p.blowoff > 12 ? COLORS.red : COLORS.text }}>{p.blowoff}%</b></span>}
                  {p.sizeDiversion != null && <span>Size Sort: <b style={{ color: COLORS.green }}>{p.sizeDiversion}%</b></span>}
                  {p.dcStrictness && <span>DC: <b style={{ color: COLORS.text }}>{DC_LABELS[p.dcStrictness] || p.dcStrictness}</b></span>}
                  <span style={{ color: COLORS.text3 }}>{p.time}</span>
                </div>

                {p.isMissed && (
                  <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.red, marginTop: 4 }}>
                    MISSED — no samples taken
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

function StatCard({ label, value, color }) {
  return (
    <div style={{
      background: COLORS.bg2, borderRadius: 8, padding: 12, textAlign: 'center',
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || COLORS.text }}>{value}</div>
      <div style={{ fontSize: 10, color: COLORS.text3, marginTop: 2 }}>{label}</div>
    </div>
  )
}
