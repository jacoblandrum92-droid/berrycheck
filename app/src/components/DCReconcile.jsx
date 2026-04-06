import React, { useState, useEffect } from 'react'
import { COLORS, FONT, gradeSample } from '../constants'

const STORAGE_KEY = 'bc_dc_results'

function loadDCResults() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

function saveDCResults(results) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(results))
  fetch('/api/store/' + STORAGE_KEY, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(results) }).catch(() => {})
}

const DC_OUTCOMES = [
  { key: 'accept', label: 'Accept', color: COLORS.green },
  { key: 'downgrade', label: 'Downgrade', color: COLORS.amber },
  { key: 'reject', label: 'Reject', color: COLORS.red },
]

const DC_REASONS = [
  'Condition defects', 'Permanent defects', 'Decay/mold',
  'Soft', 'Leaky', 'Size', 'Bruise', 'Temperature',
  'Packaging', 'Label issue', 'Short count', 'Other',
]

/**
 * DC Reconciliation — compare our QC data against the DC's grading.
 *
 * This is the foundation of the DC tolerance model:
 * - Where we agree = our grading is calibrated
 * - Where we say better than them = we're grading loose (or DC is strict)
 * - Where we say worse than them = we're grading tight (or DC is loose)
 *
 * Over time, the pattern tells you how strict the DC is relative to your standards.
 */
export default function DCReconcile({ onClose }) {
  const [dcResults, setDcResults] = useState(loadDCResults)
  const [history, setHistory] = useState([])
  const [packLog, setPackLog] = useState([])
  const [view, setView] = useState('enter') // 'enter' or 'report'
  const [dateFilter, setDateFilter] = useState(() => {
    // Default to yesterday
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d.toLocaleDateString()
  })

  useEffect(() => {
    try { setHistory(JSON.parse(localStorage.getItem('bc_history') || '[]')) } catch {}
    try { setPackLog(JSON.parse(localStorage.getItem('bc_packlog') || '[]')) } catch {}
  }, [])

  // Build our internal pallet data for the selected date
  const internalPallets = buildInternalPallets(history, packLog, dateFilter)

  // DC results for this date
  const dateResults = dcResults.filter(r => r.shipDate === dateFilter)

  // Match DC results to internal pallets
  const reconciled = internalPallets.map(p => {
    const dcr = dateResults.find(r =>
      r.palletTag === p.lotId ||
      r.dailyPallet === p.dailyPallet ||
      r.palletTag === String(p.dailyPallet)
    )
    return { ...p, dc: dcr || null }
  })

  // Unmatched DC results (they reported on pallets we don't have)
  const unmatched = dateResults.filter(r =>
    !internalPallets.some(p =>
      r.palletTag === p.lotId ||
      r.dailyPallet === p.dailyPallet ||
      r.palletTag === String(p.dailyPallet)
    )
  )

  // Stats
  const withDC = reconciled.filter(r => r.dc)
  const accepts = withDC.filter(r => r.dc.outcome === 'accept')
  const downgrades = withDC.filter(r => r.dc.outcome === 'downgrade')
  const rejects = withDC.filter(r => r.dc.outcome === 'reject')

  // Agreement analysis
  const agreements = withDC.filter(r => {
    if (r.dc.outcome === 'accept' && (r.grade === 'excellent' || r.grade === 'good')) return true
    if (r.dc.outcome === 'reject' && (r.grade === 'fair' || r.grade === 'poor')) return true
    return false
  })
  const disagreements = withDC.filter(r => !agreements.includes(r))

  // Available dates from our data
  const dates = [...new Set([
    ...history.map(s => s.date),
    ...packLog.map(e => e.date),
  ])].sort().reverse()

  const save = (results) => {
    setDcResults(results)
    saveDCResults(results)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: COLORS.bg, borderRadius: 10,
        width: '95%', maxWidth: 850,
        padding: 24, maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 6,
        }}>
          <div>
            <div style={{
              fontFamily: FONT, fontSize: 16, fontWeight: 700, color: COLORS.green,
            }}>
              DC Reconciliation
            </div>
            <div style={{ fontFamily: FONT, fontSize: 11, color: COLORS.text3 }}>
              Our QC vs DC grading — feeds the tolerance model
            </div>
          </div>
          <button onClick={onClose} style={{
            fontFamily: FONT, fontSize: 11, color: COLORS.text3,
            background: 'transparent', border: `1px solid ${COLORS.border}`,
            padding: '6px 14px', borderRadius: 4, cursor: 'pointer',
          }}>CLOSE</button>
        </div>

        {/* Date + view toggle */}
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center',
          marginBottom: 16, flexWrap: 'wrap',
        }}>
          <div style={{
            fontFamily: FONT, fontSize: 9, color: COLORS.text3,
            letterSpacing: '0.08em',
          }}>SHIP DATE</div>
          {dates.slice(0, 7).map(d => (
            <button key={d} onClick={() => setDateFilter(d)} style={{
              fontFamily: FONT, fontSize: 10, fontWeight: dateFilter === d ? 700 : 400,
              color: dateFilter === d ? COLORS.green : COLORS.text3,
              background: dateFilter === d ? COLORS.greenDim : 'transparent',
              border: `1px solid ${dateFilter === d ? COLORS.green : COLORS.border}`,
              padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
            }}>
              {d}
            </button>
          ))}

          <div style={{ flex: 1 }} />

          <button onClick={() => setView('enter')} style={{
            fontFamily: FONT, fontSize: 10, fontWeight: view === 'enter' ? 700 : 400,
            color: view === 'enter' ? COLORS.amber : COLORS.text3,
            background: view === 'enter' ? COLORS.amberDim : 'transparent',
            border: `1px solid ${view === 'enter' ? COLORS.amber : COLORS.border}`,
            padding: '4px 12px', borderRadius: 4, cursor: 'pointer',
          }}>ENTER</button>
          <button onClick={() => setView('report')} style={{
            fontFamily: FONT, fontSize: 10, fontWeight: view === 'report' ? 700 : 400,
            color: view === 'report' ? COLORS.green : COLORS.text3,
            background: view === 'report' ? COLORS.greenDim : 'transparent',
            border: `1px solid ${view === 'report' ? COLORS.green : COLORS.border}`,
            padding: '4px 12px', borderRadius: 4, cursor: 'pointer',
          }}>REPORT</button>
        </div>

        {view === 'enter' ? (
          /* ========== ENTRY VIEW ========== */
          <EntryView
            pallets={internalPallets}
            dateResults={dateResults}
            dateFilter={dateFilter}
            allResults={dcResults}
            onSave={save}
          />
        ) : (
          /* ========== REPORT VIEW ========== */
          <div>
            {/* Summary cards */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 8, marginBottom: 16,
            }}>
              <SumCard label="Shipped" value={internalPallets.length} />
              <SumCard label="DC Reported" value={withDC.length} />
              <SumCard label="Accepted" value={accepts.length} color={COLORS.green} />
              <SumCard label="Downgraded" value={downgrades.length} color={COLORS.amber} />
              <SumCard label="Rejected" value={rejects.length} color={COLORS.red} />
            </div>

            {/* Agreement rate */}
            {withDC.length > 0 && (
              <div style={{
                background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
                borderRadius: 6, padding: 14, marginBottom: 16,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{
                    fontFamily: FONT, fontSize: 9, color: COLORS.text3,
                    letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4,
                  }}>Alignment Rate</div>
                  <div style={{ fontFamily: FONT, fontSize: 11, color: COLORS.text2, lineHeight: 1.6 }}>
                    Our grade aligned with DC outcome on <b>{agreements.length}</b> of <b>{withDC.length}</b> pallets.
                    {disagreements.length > 0 && (
                      <> <span style={{ color: COLORS.amber }}>{disagreements.length} discrepancies</span> — review below.</>
                    )}
                  </div>
                </div>
                <div style={{
                  fontFamily: FONT, fontSize: 28, fontWeight: 700,
                  color: agreements.length / withDC.length >= 0.8 ? COLORS.green : COLORS.amber,
                }}>
                  {Math.round((agreements.length / withDC.length) * 100)}%
                </div>
              </div>
            )}

            {/* DC strictness signal */}
            {withDC.length >= 3 && (() => {
              // Compare our avg defect % on accepted vs rejected
              const acceptAvg = avg(accepts.map(r => r.pctCombined))
              const rejectAvg = avg(rejects.map(r => r.pctCombined))
              const downgradeAvg = avg(downgrades.map(r => r.pctCombined))

              return (
                <div style={{
                  background: COLORS.amberDim + '40', border: `1px solid ${COLORS.amber}`,
                  borderRadius: 6, padding: 14, marginBottom: 16,
                  fontFamily: FONT, fontSize: 11, color: COLORS.text2, lineHeight: 1.8,
                }}>
                  <div style={{ fontWeight: 700, color: COLORS.amber, marginBottom: 4, fontSize: 10, letterSpacing: '0.06em' }}>
                    DC TOLERANCE SIGNAL
                  </div>
                  {acceptAvg != null && <div>Accepted pallets averaged <b>{round1(acceptAvg)}%</b> combined defects (our measurement)</div>}
                  {downgradeAvg != null && <div>Downgraded pallets averaged <b style={{ color: COLORS.amber }}>{round1(downgradeAvg)}%</b></div>}
                  {rejectAvg != null && <div>Rejected pallets averaged <b style={{ color: COLORS.red }}>{round1(rejectAvg)}%</b></div>}
                  {acceptAvg != null && rejectAvg != null && (
                    <div style={{ marginTop: 4, fontWeight: 600 }}>
                      The DC line appears to be around <b style={{ color: COLORS.amber }}>
                        {round1((acceptAvg + (rejectAvg || acceptAvg)) / 2)}%
                      </b> combined defects.
                    </div>
                  )}
                  {acceptAvg != null && !rejectAvg && downgradeAvg != null && (
                    <div style={{ marginTop: 4, fontWeight: 600 }}>
                      The DC line appears to be around <b style={{ color: COLORS.amber }}>
                        {round1((acceptAvg + downgradeAvg) / 2)}%
                      </b> combined defects.
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Pallet-by-pallet comparison */}
            <div style={{
              fontFamily: FONT, fontSize: 9, color: COLORS.text3,
              letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8,
            }}>
              Pallet Comparison
            </div>

            {reconciled.map(p => {
              const dcOutcome = p.dc ? DC_OUTCOMES.find(o => o.key === p.dc.outcome) : null
              const gradeColor = p.grade === 'excellent' || p.grade === 'good' ? COLORS.green
                : p.grade === 'fair' ? COLORS.amber : p.grade === 'poor' ? COLORS.red : COLORS.text3

              // Discrepancy?
              const isDiscrep = p.dc && (
                (p.dc.outcome === 'reject' && (p.grade === 'excellent' || p.grade === 'good')) ||
                (p.dc.outcome === 'accept' && (p.grade === 'poor'))
              )

              return (
                <div key={p.dailyPallet} style={{
                  display: 'grid', gridTemplateColumns: '50px 80px 100px 60px 80px 80px 1fr',
                  gap: 8, alignItems: 'center',
                  padding: '8px 10px', borderBottom: `1px solid ${COLORS.border}`,
                  background: isDiscrep ? COLORS.amberDim + '30' : 'transparent',
                }}>
                  <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: COLORS.green }}>
                    #{p.dailyPallet}
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: 10, color: COLORS.text3 }}>
                    {p.grower || '—'}
                  </div>
                  <div>
                    <span style={{
                      fontFamily: FONT, fontSize: 10, fontWeight: 600, color: gradeColor,
                      background: gradeColor + '15', padding: '1px 6px', borderRadius: 2,
                    }}>
                      {p.grade ? p.grade.toUpperCase() : '—'}
                    </span>
                    <span style={{ fontFamily: FONT, fontSize: 10, color: COLORS.text3, marginLeft: 4 }}>
                      {p.pctCombined != null ? `${p.pctCombined}%` : ''}
                    </span>
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: 10, color: COLORS.text3, textAlign: 'center' }}>
                    vs
                  </div>
                  <div>
                    {dcOutcome ? (
                      <span style={{
                        fontFamily: FONT, fontSize: 10, fontWeight: 600,
                        color: dcOutcome.color,
                        background: dcOutcome.color + '15', padding: '1px 6px', borderRadius: 2,
                      }}>
                        {dcOutcome.label.toUpperCase()}
                      </span>
                    ) : (
                      <span style={{ fontFamily: FONT, fontSize: 10, color: COLORS.text3 }}>—</span>
                    )}
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: 10, color: COLORS.text3 }}>
                    {p.dc?.dcGrade || ''}
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: 9, color: COLORS.amber }}>
                    {p.dc?.reason || ''}
                    {isDiscrep && <span style={{ fontWeight: 700, marginLeft: 4 }}>DISCREPANCY</span>}
                  </div>
                </div>
              )
            })}

            {unmatched.length > 0 && (
              <>
                <div style={{
                  fontFamily: FONT, fontSize: 9, color: COLORS.red, marginTop: 12, marginBottom: 6,
                  letterSpacing: '0.06em',
                }}>
                  UNMATCHED DC RESULTS ({unmatched.length})
                </div>
                {unmatched.map((r, i) => (
                  <div key={i} style={{
                    fontFamily: FONT, fontSize: 10, color: COLORS.text3,
                    padding: '4px 10px', borderBottom: `1px solid ${COLORS.border}`,
                  }}>
                    {r.palletTag || `#${r.dailyPallet}`} — {r.outcome} {r.reason ? `(${r.reason})` : ''}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function EntryView({ pallets, dateResults, dateFilter, allResults, onSave }) {
  const [entries, setEntries] = useState(() => {
    // Pre-fill from existing DC results for this date, or create blanks from our pallets
    return pallets.map(p => {
      const existing = dateResults.find(r =>
        r.palletTag === p.lotId || r.dailyPallet === p.dailyPallet
      )
      return {
        dailyPallet: p.dailyPallet,
        palletTag: p.lotId || '',
        grower: p.grower,
        ourGrade: p.grade ? p.grade.toUpperCase() : '—',
        ourPct: p.pctCombined,
        // DC data
        outcome: existing?.outcome || '',
        dcGrade: existing?.dcGrade || '',
        reason: existing?.reason || '',
        notes: existing?.notes || '',
      }
    })
  })

  const updateEntry = (i, field, value) => {
    setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e))
  }

  const saveAll = () => {
    // Remove old results for this date, add new ones
    const otherDates = allResults.filter(r => r.shipDate !== dateFilter)
    const newResults = entries
      .filter(e => e.outcome) // only save entries with a DC outcome
      .map(e => ({
        shipDate: dateFilter,
        dailyPallet: e.dailyPallet,
        palletTag: e.palletTag,
        outcome: e.outcome,
        dcGrade: e.dcGrade,
        reason: e.reason,
        notes: e.notes,
        enteredAt: new Date().toISOString(),
      }))
    onSave([...otherDates, ...newResults])
  }

  const inputStyle = {
    fontFamily: FONT, fontSize: 11, color: COLORS.text,
    background: COLORS.bg, border: `1px solid ${COLORS.border2}`,
    padding: '5px 6px', borderRadius: 3, outline: 'none',
    boxSizing: 'border-box', width: '100%',
  }

  return (
    <div>
      <div style={{
        fontFamily: FONT, fontSize: 10, color: COLORS.text3,
        marginBottom: 10, lineHeight: 1.6,
      }}>
        Enter DC results for each pallet. Tap the outcome, add their grade and reason if given.
        Only pallets with an outcome set will be saved.
      </div>

      {/* Header row */}
      <div style={{
        display: 'grid', gridTemplateColumns: '40px 70px 80px 60px 30px 90px 80px 120px 1fr',
        gap: 4, padding: '4px 0', borderBottom: `2px solid ${COLORS.border}`,
        fontFamily: FONT, fontSize: 8, color: COLORS.text3,
        letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>
        <div>#</div>
        <div>Grower</div>
        <div>Our Grade</div>
        <div>Our %</div>
        <div></div>
        <div>DC Outcome</div>
        <div>DC Grade</div>
        <div>Reason</div>
        <div>Notes</div>
      </div>

      {entries.map((e, i) => {
        const gradeColor = e.ourGrade === 'EXCELLENT' || e.ourGrade === 'GOOD' ? COLORS.green
          : e.ourGrade === 'FAIR' ? COLORS.amber : e.ourGrade === 'POOR' ? COLORS.red : COLORS.text3
        const dcColor = DC_OUTCOMES.find(o => o.key === e.outcome)?.color || COLORS.text3

        return (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '40px 70px 80px 60px 30px 90px 80px 120px 1fr',
            gap: 4, padding: '6px 0', borderBottom: `1px solid ${COLORS.border}`,
            alignItems: 'center',
          }}>
            <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: COLORS.green }}>
              {e.dailyPallet}
            </div>
            <div style={{ fontFamily: FONT, fontSize: 10, color: COLORS.text3 }}>
              {e.grower || '—'}
            </div>
            <div style={{
              fontFamily: FONT, fontSize: 10, fontWeight: 600, color: gradeColor,
            }}>
              {e.ourGrade}
            </div>
            <div style={{ fontFamily: FONT, fontSize: 10, color: COLORS.text3 }}>
              {e.ourPct != null ? `${e.ourPct}%` : '—'}
            </div>
            <div style={{ fontFamily: FONT, fontSize: 10, color: COLORS.text3, textAlign: 'center' }}>
              →
            </div>
            <div>
              <select style={{ ...inputStyle, color: dcColor, fontWeight: e.outcome ? 600 : 400 }}
                value={e.outcome}
                onChange={ev => updateEntry(i, 'outcome', ev.target.value)}>
                <option value="">—</option>
                {DC_OUTCOMES.map(o => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <input style={inputStyle} value={e.dcGrade}
                onChange={ev => updateEntry(i, 'dcGrade', ev.target.value)}
                placeholder="Their grade" />
            </div>
            <div>
              <select style={inputStyle} value={e.reason}
                onChange={ev => updateEntry(i, 'reason', ev.target.value)}>
                <option value="">—</option>
                {DC_REASONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <input style={inputStyle} value={e.notes}
                onChange={ev => updateEntry(i, 'notes', ev.target.value)}
                placeholder="" />
            </div>
          </div>
        )
      })}

      {entries.length === 0 && (
        <div style={{
          fontFamily: FONT, fontSize: 12, color: COLORS.text3,
          textAlign: 'center', padding: 30,
        }}>
          No pallets shipped on {dateFilter}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
        <div style={{ fontFamily: FONT, fontSize: 10, color: COLORS.text3, alignSelf: 'center' }}>
          {entries.filter(e => e.outcome).length} of {entries.length} entered
        </div>
        <button onClick={saveAll} style={{
          fontFamily: FONT, fontSize: 12, fontWeight: 700,
          color: COLORS.green, background: COLORS.greenDim,
          border: `1px solid ${COLORS.green}`,
          padding: '8px 20px', borderRadius: 4, cursor: 'pointer',
        }}>
          SAVE DC RESULTS
        </button>
      </div>
    </div>
  )
}

function buildInternalPallets(history, packLog, date) {
  // Group history by dailyPalletNum for the given date
  const byPallet = {}
  for (const s of history) {
    if (s.date !== date || !s.dailyPalletNum || s.isSkipped) continue
    if (!byPallet[s.dailyPalletNum]) byPallet[s.dailyPalletNum] = { samples: [], lotId: s.lotId, grower: s.grower }
    byPallet[s.dailyPalletNum].samples.push(s)
    if (s.lotId) byPallet[s.dailyPalletNum].lotId = s.lotId
    if (s.grower) byPallet[s.dailyPalletNum].grower = s.grower
  }

  return Object.entries(byPallet).map(([num, data]) => {
    const official = data.samples.filter(s => !s.isExtra)
    let grade = null, pctCombined = null
    if (official.length > 0) {
      const keys = ['good', 'permanent', 'condition', 'decay']
      const avg = {}
      for (const key of keys) {
        avg[key] = Math.round((official.reduce((a, s) => a + (s[key] || 0), 0) / official.length) * 10) / 10
      }
      const result = gradeSample(avg)
      grade = result.grade
      pctCombined = result.pctCombined
    }
    return {
      dailyPallet: parseInt(num),
      lotId: data.lotId || '',
      grower: data.grower || '',
      grade,
      pctCombined,
    }
  }).sort((a, b) => a.dailyPallet - b.dailyPallet)
}

function SumCard({ label, value, color }) {
  return (
    <div style={{
      background: COLORS.bg2, borderRadius: 6, padding: 10, textAlign: 'center',
    }}>
      <div style={{ fontFamily: FONT, fontSize: 20, fontWeight: 700, color: color || COLORS.text }}>
        {value}
      </div>
      <div style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3, marginTop: 2 }}>{label}</div>
    </div>
  )
}

function avg(arr) {
  const valid = arr.filter(v => v != null)
  if (valid.length === 0) return null
  return valid.reduce((a, b) => a + b, 0) / valid.length
}

function round1(n) {
  return Math.round(n * 10) / 10
}
