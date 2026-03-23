import React, { useState, useEffect } from 'react'

const COLORS = {
  bg: '#ffffff', bg2: '#f7f7f5', border: '#ddd',
  green: '#0F6E56', greenBg: '#E1F5EE',
  amber: '#BA7517', amberBg: '#FAEEDA',
  red: '#A32D2D', redBg: '#FCEBEB',
  text: '#1a1a1a', text2: '#666', text3: '#999',
}

const FONT = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"

const GRADE_COLORS = {
  excellent: { text: COLORS.green, bg: COLORS.greenBg },
  good: { text: COLORS.green, bg: COLORS.greenBg },
  fair: { text: COLORS.amber, bg: COLORS.amberBg },
  poor: { text: COLORS.red, bg: COLORS.redBg },
}

export default function Viewer() {
  const [snapshot, setSnapshot] = useState(null)
  const [error, setError] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const id = new URLSearchParams(window.location.search).get('id')

  useEffect(() => {
    if (!id) { setError('No snapshot ID'); return }
    fetch(`/api/share/${id}`)
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json() })
      .then(d => setSnapshot(d))
      .catch(() => setError('Snapshot expired or not found. Ask for a new QR code.'))
  }, [id])

  if (error) return (
    <div style={pageStyle}>
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>BerryCheck</div>
        <div style={{ fontSize: 14, color: COLORS.text3 }}>{error}</div>
      </div>
    </div>
  )

  if (!snapshot) return (
    <div style={pageStyle}>
      <div style={{ textAlign: 'center', padding: 40, color: COLORS.text3 }}>Loading...</div>
    </div>
  )

  // Route to the right view based on snapshot type
  const views = {
    grade: GradeView,
    lotSummary: LotSummaryView,
    lineMonitor: LineMonitorView,
    packLog: PackLogView,
  }

  const ViewComponent = views[snapshot.type] || GradeView

  // Available views for menu (only show what has data in the snapshot)
  const availableViews = Object.keys(snapshot.views || {})

  return (
    <div style={pageStyle}>
      {/* Top bar */}
      <div style={{
        background: COLORS.bg2, borderBottom: `1px solid ${COLORS.border}`,
        padding: '12px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.green }}>
          BerryCheck
        </div>
        <div style={{ fontSize: 10, color: COLORS.text3 }}>
          {new Date(snapshot.createdAt).toLocaleTimeString('en-US', { hour12: true })}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: 16 }}>
        <ViewComponent data={snapshot} />
      </div>

      {/* Bottom menu — one tap to switch views */}
      {availableViews.length > 1 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: COLORS.bg2, borderTop: `1px solid ${COLORS.border}`,
          display: 'flex', justifyContent: 'center', gap: 4,
          padding: '8px 12px',
        }}>
          {availableViews.map(key => {
            const labels = {
              grade: 'Grade', lotSummary: 'Pallet', lineMonitor: 'Line', packLog: 'Pack Log',
            }
            const active = snapshot.type === key
            return (
              <button key={key} onClick={() => {
                setSnapshot({ ...snapshot, type: key, ...snapshot.views[key] })
              }} style={{
                fontFamily: FONT, fontSize: 11, fontWeight: 600,
                color: active ? COLORS.green : COLORS.text3,
                background: active ? COLORS.greenBg : 'transparent',
                border: `1px solid ${active ? COLORS.green : COLORS.border}`,
                padding: '8px 16px', borderRadius: 6, cursor: 'pointer',
                flex: 1, maxWidth: 120,
              }}>
                {labels[key] || key}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ========== GRADE VIEW ==========
function GradeView({ data }) {
  const g = data.grade || {}
  const gc = GRADE_COLORS[g.grade] || GRADE_COLORS.good

  return (
    <div>
      {/* Pallet info */}
      {(data.lotId || data.receiptNum) && (
        <div style={{ marginBottom: 16, fontSize: 12, color: COLORS.text2 }}>
          {data.lotId && <span style={{ fontWeight: 600, color: COLORS.text, marginRight: 12 }}>{data.lotId}</span>}
          {data.receiptNum && <span>{data.receiptNum}</span>}
          {data.grower && <span> — {data.grower}</span>}
          {data.variety && <span> / {data.variety}</span>}
        </div>
      )}

      {/* Big grade */}
      <div style={{
        background: gc.bg, borderRadius: 12, padding: 24,
        textAlign: 'center', marginBottom: 16,
      }}>
        <div style={{ fontSize: 42, fontWeight: 800, color: gc.text, lineHeight: 1 }}>
          {g.label || '—'}
        </div>
        <div style={{ fontSize: 13, color: gc.text, marginTop: 8, opacity: 0.8 }}>
          MBG Grade
        </div>
      </div>

      {/* Defect summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {[
          { label: 'Permanent', pct: g.pctPermanent, color: COLORS.amber },
          { label: 'Condition', pct: g.pctCondition, color: '#D85A30' },
          { label: 'Combined', pct: g.pctCombined, color: COLORS.text },
        ].map(d => (
          <div key={d.label} style={{
            background: COLORS.bg2, borderRadius: 8, padding: 14, textAlign: 'center',
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: d.color }}>{d.pct || 0}%</div>
            <div style={{ fontSize: 10, color: COLORS.text3, marginTop: 4 }}>{d.label}</div>
          </div>
        ))}
      </div>

      {/* Line stats */}
      {(data.lineRate || data.blowoff || data.sizeDiversion) && (
        <div style={{ display: 'grid', gridTemplateColumns: data.sizeDiversion ? '1fr 1fr 1fr' : '1fr 1fr', gap: 10, marginTop: 16 }}>
          {data.lineRate && (
            <div style={{ background: COLORS.bg2, borderRadius: 8, padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.text }}>{data.lineRate.toLocaleString()}</div>
              <div style={{ fontSize: 10, color: COLORS.text3, marginTop: 4 }}>Lbs/Hr</div>
            </div>
          )}
          {data.blowoff != null && (
            <div style={{ background: COLORS.bg2, borderRadius: 8, padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: data.blowoff > 12 ? COLORS.red : data.blowoff > 8 ? COLORS.amber : COLORS.text }}>
                {data.blowoff}%
              </div>
              <div style={{ fontSize: 10, color: COLORS.text3, marginTop: 4 }}>Blowoff</div>
            </div>
          )}
          {data.sizeDiversion != null && (
            <div style={{ background: COLORS.bg2, borderRadius: 8, padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.green }}>
                {data.sizeDiversion}%
              </div>
              <div style={{ fontSize: 10, color: COLORS.text3, marginTop: 4 }}>Size Sort</div>
            </div>
          )}
        </div>
      )}

      {/* Headroom */}
      {g.bottleneck && (
        <div style={{
          marginTop: 16, background: COLORS.bg2, borderRadius: 8, padding: 14,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 11, color: COLORS.text3, marginBottom: 4 }}>Tightest Category</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: g.bottleneck.remaining <= 1 ? COLORS.red : COLORS.text }}>
            {g.bottleneck.remaining}% room
          </div>
          <div style={{ fontSize: 11, color: COLORS.text2 }}>{g.bottleneck.name}</div>
        </div>
      )}
    </div>
  )
}

// ========== LOT SUMMARY VIEW ==========
function LotSummaryView({ data }) {
  const lot = data.lotSummary || {}

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 12 }}>
        Pallet {lot.lotId || '—'}
      </div>

      {lot.grade && (
        <div style={{
          background: (GRADE_COLORS[lot.grade.grade] || GRADE_COLORS.good).bg,
          borderRadius: 12, padding: 20, textAlign: 'center', marginBottom: 16,
        }}>
          <div style={{
            fontSize: 36, fontWeight: 800,
            color: (GRADE_COLORS[lot.grade.grade] || GRADE_COLORS.good).text,
          }}>
            {lot.grade.label}
          </div>
          <div style={{ fontSize: 11, color: COLORS.text2, marginTop: 6 }}>
            {lot.sampleCount}/3 samples · {lot.pctCombined || 0}% combined defects
          </div>
        </div>
      )}

      {/* Per-sample chips */}
      {lot.samples && lot.samples.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {lot.samples.map((s, i) => (
            <div key={i} style={{
              flex: 1, background: COLORS.bg2, borderRadius: 8, padding: 10,
              textAlign: 'center', opacity: s.isSkipped ? 0.4 : 1,
            }}>
              <div style={{ fontSize: 9, color: COLORS.text3 }}>{s.layer}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: s.isSkipped ? COLORS.text3 : COLORS.text }}>
                {s.isSkipped ? 'SKIP' : s.grade || '—'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ========== LINE MONITOR VIEW ==========
function LineMonitorView({ data }) {
  const line = data.lineMonitor || {}

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 16 }}>
        Line Monitor
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Cooler', value: line.remainingLbs ? `${line.remainingLbs.toLocaleString()} lbs` : '—', sub: 'remaining' },
          { label: 'Line Rate', value: line.lbsPerHour ? `${line.lbsPerHour.toLocaleString()}` : '—', sub: 'lbs/hr' },
          { label: 'Pallets Left', value: line.remainingPallets || '—', sub: `of ${line.totalPallets || 0}` },
          { label: 'Scans Today', value: line.scansToday || '0', sub: 'pallets dumped' },
        ].map(s => (
          <div key={s.label} style={{
            background: COLORS.bg2, borderRadius: 8, padding: 14, textAlign: 'center',
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.text }}>{s.value}</div>
            <div style={{ fontSize: 10, color: COLORS.text3, marginTop: 2 }}>{s.label}</div>
            <div style={{ fontSize: 9, color: COLORS.text3 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Receipt progress */}
      {line.receipts && line.receipts.map(r => (
        <div key={r.receiptNum} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 0', borderBottom: `1px solid ${COLORS.border}`,
        }}>
          <div style={{ fontWeight: 600, color: COLORS.green, width: 80, fontSize: 12 }}>{r.receiptNum}</div>
          <div style={{ flex: 1 }}>
            <div style={{
              height: 6, background: '#eee', borderRadius: 3, overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 3,
                background: r.pct >= 100 ? COLORS.green : COLORS.amber,
                width: `${Math.min(100, r.pct)}%`,
              }} />
            </div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, width: 50, textAlign: 'right' }}>
            {r.scanned}/{r.total}
          </div>
        </div>
      ))}
    </div>
  )
}

// ========== PACK LOG VIEW ==========
function PackLogView({ data }) {
  const log = data.packLog || {}

  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 16,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>Pack Log</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.green }}>
          {log.totalBoxes || 0} boxes · {log.palletCount || 0} pallets
        </div>
      </div>

      {log.entries && log.entries.map(e => (
        <div key={e.id} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 0', borderBottom: `1px solid ${COLORS.border}`,
          opacity: e.isMissed ? 0.5 : 1,
        }}>
          <div style={{
            fontSize: 14, fontWeight: 700, width: 30, textAlign: 'center',
            color: e.isMissed ? COLORS.red : COLORS.green,
          }}>
            {e.dailyPallet || '—'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text }}>
              {e.isMissed ? 'MISSED' : e.packCode}
            </div>
            <div style={{ fontSize: 10, color: COLORS.text3 }}>
              {e.grower}{e.receiptNum ? ` · ${e.receiptNum}` : ''} · {e.time}
            </div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>
            {e.isMissed ? '—' : e.boxes}
          </div>
        </div>
      ))}
    </div>
  )
}

const pageStyle = {
  fontFamily: FONT, fontSize: 14, color: COLORS.text,
  background: COLORS.bg, minHeight: '100vh',
}
