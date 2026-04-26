import React, { useState, useEffect } from 'react'
import { classifyWeight, loadPackTolerance } from '../constants'

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
    box: BoxView,
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
              grade: 'Grade', box: 'Box', lotSummary: 'Pallet', lineMonitor: 'Line', packLog: 'Pack Log',
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
  const isEmpty = !g.label || g.label === '—' || (g.total || 0) === 0

  // Pack method badge
  const methodColor = {
    pint: '#10B981', pint30: '#1E40AF', '18oz30': '#EA580C', mightyblue30: '#0891B2',
    '600g': COLORS.text3, fullcount: '#2563EB', manual: '#534AB7',
  }[data.sampleMethod] || COLORS.text3
  const methodLabel = {
    pint: 'PINT (camera)', pint30: 'PINT 30', '18oz30': '18OZ 30', mightyblue30: 'MIGHTY BLUE 30',
    '600g': '600G SUBSAMPLE', fullcount: 'FULL COUNT', manual: 'MANUAL COUNT',
  }[data.sampleMethod] || data.sampleMethod

  return (
    <div>
      {/* Pallet info header */}
      <div style={{
        marginBottom: 14, padding: '10px 12px',
        background: COLORS.bg2, borderRadius: 8,
        border: `1px solid ${COLORS.border}`,
      }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
          {data.dailyPalletNum && (
            <span style={{ fontSize: 18, fontWeight: 800, color: COLORS.green }}>
              #{data.dailyPalletNum}
            </span>
          )}
          {data.lotId && <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{data.lotId}</span>}
          {data.packLine && <span style={{ fontSize: 11, color: COLORS.text3 }}>Line {data.packLine}</span>}
          {data.time && <span style={{ fontSize: 11, color: COLORS.text3, marginLeft: 'auto' }}>{data.time}</span>}
        </div>
        {(data.receiptNum || data.grower || data.variety) && (
          <div style={{ fontSize: 11, color: COLORS.text2, marginTop: 4 }}>
            {data.receiptNum && <span>{data.receiptNum}</span>}
            {data.grower && <span> — {data.grower}</span>}
            {data.variety && <span> / {data.variety}</span>}
          </div>
        )}
        {methodLabel && (
          <div style={{
            display: 'inline-block', marginTop: 6, padding: '2px 8px',
            fontSize: 9, fontWeight: 700, color: methodColor,
            background: methodColor + '15', border: `1px solid ${methodColor}40`,
            borderRadius: 3, letterSpacing: '0.06em',
          }}>{methodLabel}</div>
        )}
        {data.clamshellNet > 0 && (
          <div style={{ fontSize: 10, color: COLORS.text2, marginTop: 6 }}>
            Net: <b>{(typeof data.clamshellNet === 'number' ? data.clamshellNet : parseFloat(data.clamshellNet)).toFixed(1)}g</b>
            {data.clamshellLabel > 0 && <span style={{ color: COLORS.text3 }}> / {data.clamshellLabel}g label</span>}
          </div>
        )}
      </div>

      {isEmpty && (
        <div style={{
          padding: 18, marginBottom: 16, textAlign: 'center',
          background: COLORS.bg2, border: `1px dashed ${COLORS.border}`,
          borderRadius: 8,
        }}>
          <div style={{ fontSize: 13, color: COLORS.text2, fontWeight: 600 }}>No sample data in this snapshot</div>
          <div style={{ fontSize: 10, color: COLORS.text3, marginTop: 4 }}>
            Generate a new QR after logging a sample or entering counts.
          </div>
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

// ========== BOX VIEW ==========
function BoxView({ data }) {
  const b = data.box || {}
  const pct = b.pctInSpec || 0
  const passColor = pct >= 95 ? COLORS.green : pct >= 85 ? COLORS.amber : COLORS.red
  const passLabel = b.count > 0 ? (pct >= 95 ? 'PASS' : pct >= 85 ? 'BORDERLINE' : 'FAIL') : '—'
  const passBg = pct >= 95 ? COLORS.greenBg : pct >= 85 ? COLORS.amberBg : COLORS.redBg

  const packColor = data.sampleMethod === '18oz30' ? '#EA580C'
    : data.sampleMethod === 'pint30' ? '#1E40AF'
    : data.sampleMethod === 'mightyblue30' ? '#0891B2' : COLORS.text3
  const packLabel = data.sampleMethod === '18oz30' ? '18OZ'
    : data.sampleMethod === 'pint30' ? 'PINT'
    : data.sampleMethod === 'mightyblue30' ? 'MIGHTY BLUE' : (data.sampleMethod || '').toUpperCase()

  return (
    <div>
      {/* Header */}
      <div style={{
        marginBottom: 14, padding: '10px 12px',
        background: COLORS.bg2, borderRadius: 8, border: `1px solid ${COLORS.border}`,
      }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
          {data.dailyPalletNum && (
            <span style={{ fontSize: 18, fontWeight: 800, color: COLORS.green }}>#{data.dailyPalletNum}</span>
          )}
          {data.lotId && <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{data.lotId}</span>}
          {data.time && <span style={{ fontSize: 11, color: COLORS.text3, marginLeft: 'auto' }}>{data.time}</span>}
        </div>
        <div style={{
          display: 'inline-block', marginTop: 6, padding: '3px 10px',
          fontSize: 10, fontWeight: 800, color: packColor,
          background: packColor + '15', border: `1px solid ${packColor}60`,
          borderRadius: 3, letterSpacing: '0.08em',
        }}>BOX WEIGHT · {packLabel}</div>
      </div>

      {/* Pass/fail big badge */}
      <div style={{
        background: passBg, borderRadius: 12, padding: 20,
        textAlign: 'center', marginBottom: 14,
        border: `2px solid ${passColor}`,
      }}>
        <div style={{ fontSize: 36, fontWeight: 800, color: passColor, lineHeight: 1 }}>
          {passLabel}
        </div>
        <div style={{ fontSize: 13, color: passColor, marginTop: 8, fontWeight: 600 }}>
          {b.count > 0
            ? `${b.inSpec}/${b.count} in spec (${pct.toFixed(1)}%)`
            : 'No weights captured'}
        </div>
      </div>

      {/* Stats grid */}
      {b.count > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
          {[
            { k: 'Mean', v: (b.mean || 0).toFixed(1) + 'g', c: COLORS.text },
            { k: 'Min', v: (b.min || 0).toFixed(1) + 'g', c: COLORS.text2 },
            { k: 'Max', v: (b.max || 0).toFixed(1) + 'g', c: COLORS.text2 },
            { k: 'Label', v: (b.labelWeight || 0) + 'g', c: packColor },
            { k: 'Tolerance', v: '±' + (b.tolerance || 0) + 'g', c: COLORS.text2 },
            { k: 'N', v: b.count, c: COLORS.text },
          ].map(s => (
            <div key={s.k} style={{
              background: COLORS.bg2, borderRadius: 6, padding: 10, textAlign: 'center',
              border: `1px solid ${COLORS.border}`,
            }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.c }}>{s.v}</div>
              <div style={{ fontSize: 9, color: COLORS.text3, marginTop: 2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{s.k}</div>
            </div>
          ))}
        </div>
      )}

      {/* Under/over summary */}
      {b.count > 0 && (b.under > 0 || b.over > 0) && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          {b.under > 0 && (
            <div style={{
              flex: 1, background: COLORS.redBg, border: `1px solid ${COLORS.red}`,
              borderRadius: 6, padding: 10, textAlign: 'center',
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.red }}>↓ {b.under}</div>
              <div style={{ fontSize: 9, color: COLORS.red, marginTop: 2 }}>UNDER {(b.labelWeight - b.tolerance).toFixed(1)}g</div>
            </div>
          )}
          {b.over > 0 && (
            <div style={{
              flex: 1, background: COLORS.amberBg, border: `1px solid ${COLORS.amber}`,
              borderRadius: 6, padding: 10, textAlign: 'center',
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.amber }}>↑ {b.over}</div>
              <div style={{ fontSize: 9, color: COLORS.amber, marginTop: 2 }}>OVER {(b.labelWeight + b.tolerance).toFixed(1)}g</div>
            </div>
          )}
        </div>
      )}

      {/* Weight list */}
      {Array.isArray(b.weights) && b.weights.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.text3, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
            Individual Weights
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4 }}>
            {b.weights.map((w, i) => {
              const rules = loadPackTolerance()
              const cls = classifyWeight(w, b.labelWeight, rules)
              const isUnder = w < b.labelWeight - b.labelWeight * rules.greenPct / 100
              const c = cls === 'green' ? COLORS.green : cls === 'yellow' ? COLORS.amber : COLORS.red
              const inSp = cls === 'green'
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px',
                  background: c === COLORS.green ? COLORS.greenBg
                    : c === COLORS.amber ? COLORS.amberBg : COLORS.redBg,
                  border: `1px solid ${c}60`, borderRadius: 4,
                }}>
                  <span style={{ fontSize: 9, color: COLORS.text3, width: 22 }}>#{i + 1}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: c, flex: 1 }}>{w.toFixed(1)}g</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: c }}>
                    {inSp ? '✓' : isUnder ? '↓' : '↑'}
                  </span>
                </div>
              )
            })}
          </div>
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
