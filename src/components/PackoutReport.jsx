import React, { useState, useEffect } from 'react'
import { COLORS, FONT } from '../constants'
import { loadReceipts } from '../receipts'
import { loadPackCodes } from '../packCodes'

/**
 * Packout Report — how much packed fruit came out of what went in.
 *
 * Packout % = (packed lbs out / raw lbs in) × 100
 * Can exceed 100% — raw lbs are often estimates, and that's normal.
 *
 * Data sources:
 * - Receipts: expectedLbs (raw weight in)
 * - Pack log: boxes × pack code case weight (packed weight out)
 */
export default function PackoutReport({ onClose }) {
  const [packLog, setPackLog] = useState([])
  const [receipts, setReceipts] = useState([])
  const [packCodeDB, setPackCodeDB] = useState([])
  const [dateFilter, setDateFilter] = useState('today')
  const [growerFilter, setGrowerFilter] = useState(null)

  useEffect(() => {
    setReceipts(loadReceipts())
    setPackCodeDB(loadPackCodes())
    try { setPackLog(JSON.parse(localStorage.getItem('bc_packlog') || '[]')) } catch {}
  }, [])

  const today = new Date().toLocaleDateString()

  // Filter pack log by date
  const filteredLog = dateFilter === 'today'
    ? packLog.filter(e => e.date === today)
    : dateFilter === 'all'
      ? packLog
      : packLog.filter(e => e.date === dateFilter)

  // Get unique dates for filter
  const dates = [...new Set(packLog.map(e => e.date))].sort().reverse()

  // Get unique growers from receipts (sorted by most data)
  const growerCounts = {}
  filteredLog.forEach(e => { if (e.grower) growerCounts[e.grower] = (growerCounts[e.grower] || 0) + 1 })
  const growers = Object.entries(growerCounts).sort((a, b) => b[1] - a[1]).map(([g]) => g)

  // Build per-receipt packout
  const receiptData = receipts
    .filter(r => !growerFilter || r.grower === growerFilter)
    .map(r => {
    const entries = filteredLog.filter(e => e.receiptNum === r.receiptNum && !e.isMissed)
    const rawLbs = r.expectedLbs || 0

    // Calculate packed weight from boxes × case weight
    let packedLbs = 0
    let totalBoxes = 0
    let palletCount = new Set()
    const byPackCode = {}

    for (const e of entries) {
      const boxes = e.boxes || 0
      totalBoxes += boxes
      if (e.dailyPallet) palletCount.add(e.dailyPallet)

      // Look up case weight from pack code
      const pc = packCodeDB.find(c => c.code === e.packCode)
      const caseWeight = pc ? pc.weight : 0
      const lbs = boxes * caseWeight
      packedLbs += lbs

      const code = e.packCode || '—'
      if (!byPackCode[code]) byPackCode[code] = { boxes: 0, lbs: 0, desc: pc?.desc || code }
      byPackCode[code].boxes += boxes
      byPackCode[code].lbs += lbs
    }

    const packoutPct = rawLbs > 0 ? (packedLbs / rawLbs) * 100 : null
    // Shrink/loss = raw - packed. Negative means more came out than went in (estimate was low)
    const shrinkLbs = rawLbs - packedLbs
    const shrinkPct = rawLbs > 0 ? (shrinkLbs / rawLbs) * 100 : null

    // Line stats averages for this receipt
    const withRate = entries.filter(e => e.lineRate)
    const withBlowoff = entries.filter(e => e.blowoff != null)
    const avgLineRate = withRate.length > 0 ? Math.round(withRate.reduce((s, e) => s + e.lineRate, 0) / withRate.length) : null
    const avgBlowoff = withBlowoff.length > 0 ? round1(withBlowoff.reduce((s, e) => s + e.blowoff, 0) / withBlowoff.length) : null

    return {
      receiptNum: r.receiptNum,
      grower: r.grower,
      variety: r.variety,
      status: r.status,
      rawLbs,
      packedLbs: Math.round(packedLbs),
      packoutPct,
      shrinkLbs: Math.round(shrinkLbs),
      shrinkPct,
      totalBoxes,
      palletCount: palletCount.size,
      byPackCode: Object.values(byPackCode).sort((a, b) => b.lbs - a.lbs),
      hasData: entries.length > 0,
      avgLineRate,
      avgBlowoff,
    }
  }).filter(r => r.hasData || r.status === 'active')

  // Sort: active with data first, then active without, then completed
  receiptData.sort((a, b) => {
    if (a.hasData && !b.hasData) return -1
    if (!a.hasData && b.hasData) return 1
    return 0
  })

  // Day totals
  const totalRaw = receiptData.reduce((s, r) => s + r.rawLbs, 0)
  const totalPacked = receiptData.reduce((s, r) => s + r.packedLbs, 0)
  const totalBoxes = receiptData.reduce((s, r) => s + r.totalBoxes, 0)
  const totalPallets = receiptData.reduce((s, r) => s + r.palletCount, 0)
  const overallPackout = totalRaw > 0 ? (totalPacked / totalRaw) * 100 : null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: COLORS.bg, borderRadius: 10,
        width: '95%', maxWidth: 750,
        padding: 24, maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 16,
        }}>
          <div>
            <div style={{
              fontFamily: FONT, fontSize: 16, fontWeight: 700, color: COLORS.green,
            }}>
              Packout Report
            </div>
            <div style={{ fontFamily: FONT, fontSize: 11, color: COLORS.text3 }}>
              Packed lbs out / raw lbs in
            </div>
          </div>
          <button onClick={onClose} style={{
            fontFamily: FONT, fontSize: 11, color: COLORS.text3,
            background: 'transparent', border: `1px solid ${COLORS.border}`,
            padding: '6px 14px', borderRadius: 4, cursor: 'pointer',
          }}>CLOSE</button>
        </div>

        {/* Date filter */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          <button onClick={() => setDateFilter('today')} style={filterBtn(dateFilter === 'today')}>
            Today
          </button>
          <button onClick={() => setDateFilter('all')} style={filterBtn(dateFilter === 'all')}>
            All Time
          </button>
          {dates.filter(d => d !== today).slice(0, 5).map(d => (
            <button key={d} onClick={() => setDateFilter(d)} style={filterBtn(dateFilter === d)}>
              {d}
            </button>
          ))}
        </div>

        {/* Grower filter */}
        {growers.length > 1 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{
              fontFamily: FONT, fontSize: 9, color: COLORS.text3,
              letterSpacing: '0.08em', alignSelf: 'center', marginRight: 2,
            }}>GROWER</div>
            <button onClick={() => setGrowerFilter(null)} style={filterBtn(!growerFilter)}>
              All
            </button>
            {growers.map(g => (
              <button key={g} onClick={() => setGrowerFilter(g)} style={filterBtn(growerFilter === g)}>
                {g}
              </button>
            ))}
          </div>
        )}

        {/* Overall summary */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 8, marginBottom: 20,
        }}>
          <SummaryCard label="Raw Lbs In" value={totalRaw > 0 ? totalRaw.toLocaleString() : '—'} />
          <SummaryCard label="Packed Lbs Out" value={totalPacked > 0 ? totalPacked.toLocaleString() : '—'} />
          <SummaryCard label="Packout"
            value={overallPackout != null ? `${round1(overallPackout)}%` : '—'}
            color={overallPackout != null ? (overallPackout >= 85 ? COLORS.green : overallPackout >= 70 ? COLORS.amber : COLORS.red) : COLORS.text3} />
          <SummaryCard label="Total Boxes" value={totalBoxes > 0 ? totalBoxes.toLocaleString() : '—'} />
          <SummaryCard label="Pallets" value={totalPallets || '—'} />
        </div>

        {/* Per-receipt breakdown */}
        {receiptData.length === 0 ? (
          <div style={{
            fontFamily: FONT, fontSize: 12, color: COLORS.text3,
            textAlign: 'center', padding: 30,
          }}>
            No pack data for this period
          </div>
        ) : (
          receiptData.map(r => {
            const packoutColor = r.packoutPct == null ? COLORS.text3
              : r.packoutPct >= 85 ? COLORS.green
              : r.packoutPct >= 70 ? COLORS.amber
              : COLORS.red

            return (
              <div key={r.receiptNum} style={{
                background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
                borderLeft: `3px solid ${r.hasData ? packoutColor : COLORS.text3}`,
                borderRadius: 4, padding: 14, marginBottom: 8,
                opacity: r.hasData ? 1 : 0.5,
              }}>
                {/* Receipt header */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 8,
                }}>
                  <div>
                    <span style={{
                      fontFamily: FONT, fontSize: 13, fontWeight: 700, color: COLORS.text,
                    }}>
                      {r.receiptNum}
                    </span>
                    <span style={{ fontFamily: FONT, fontSize: 11, color: COLORS.text3, marginLeft: 8 }}>
                      {r.grower}{r.variety ? ` / ${r.variety}` : ''}
                    </span>
                  </div>
                  {r.packoutPct != null && (
                    <div style={{
                      fontFamily: FONT, fontSize: 18, fontWeight: 700,
                      color: packoutColor,
                    }}>
                      {round1(r.packoutPct)}%
                    </div>
                  )}
                </div>

                {/* Stats row */}
                {r.hasData && (
                  <div style={{
                    display: 'grid', gridTemplateColumns: `repeat(${5 + (r.avgLineRate ? 1 : 0) + (r.avgBlowoff != null ? 1 : 0)}, 1fr)`,
                    gap: 8, marginBottom: r.byPackCode.length > 1 ? 10 : 0,
                  }}>
                    <MiniStat label="Raw In" value={r.rawLbs > 0 ? `${r.rawLbs.toLocaleString()} lb` : '—'} />
                    <MiniStat label="Packed Out" value={`${r.packedLbs.toLocaleString()} lb`} />
                    <MiniStat label={r.shrinkLbs >= 0 ? 'Shrink' : 'Over'}
                      value={r.shrinkPct != null ? `${round1(Math.abs(r.shrinkPct))}%` : '—'}
                      color={r.shrinkLbs > 0 ? COLORS.amber : COLORS.green}
                      detail={`${Math.abs(r.shrinkLbs).toLocaleString()} lb`} />
                    <MiniStat label="Boxes" value={r.totalBoxes.toLocaleString()} />
                    <MiniStat label="Pallets" value={r.palletCount} />
                    {r.avgLineRate && <MiniStat label="Avg Lbs/Hr" value={r.avgLineRate} />}
                    {r.avgBlowoff != null && <MiniStat label="Avg Blowoff" value={`${r.avgBlowoff}%`} />}
                  </div>
                )}

                {/* Pack code breakdown — if multiple codes used */}
                {r.byPackCode.length > 1 && (
                  <div style={{
                    display: 'flex', gap: 6, flexWrap: 'wrap',
                  }}>
                    {r.byPackCode.map(pc => (
                      <div key={pc.desc} style={{
                        fontFamily: FONT, fontSize: 10, color: COLORS.text2,
                        background: COLORS.bg3, padding: '3px 8px', borderRadius: 3,
                      }}>
                        {pc.desc}: <b>{pc.boxes} bx</b> ({Math.round(pc.lbs).toLocaleString()} lb)
                      </div>
                    ))}
                  </div>
                )}

                {!r.hasData && (
                  <div style={{
                    fontFamily: FONT, fontSize: 10, color: COLORS.text3,
                  }}>
                    No packed pallets logged yet — {r.rawLbs > 0 ? `${r.rawLbs.toLocaleString()} raw lbs waiting` : 'no raw lbs entered'}
                  </div>
                )}
              </div>
            )
          })
        )}

        {/* Fruit Flow — material balance per receipt */}
        {(() => {
          const withFlow = receiptData.filter(r => r.hasData && r.rawLbs > 0)
          if (withFlow.length === 0) return null

          return (
            <div style={{
              background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
              borderRadius: 6, padding: 14, marginTop: 16,
            }}>
              <div style={{
                fontFamily: FONT, fontSize: 10, fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                color: COLORS.text3, marginBottom: 4,
              }}>
                Fruit Flow — Where Did the Lbs Go?
              </div>
              <div style={{
                fontFamily: FONT, fontSize: 10, color: COLORS.text3,
                marginBottom: 12, lineHeight: 1.5,
              }}>
                Raw lbs in minus sorter losses should roughly equal packed lbs out.
                The gap is mostly cup fill variance — packed lbs uses spec case weight, not actual weight on the pallet.
              </div>

              {/* Flow table */}
              <div style={{
                display: 'grid', gridTemplateColumns: '100px 90px 80px 80px 90px 90px 90px',
                gap: 0,
              }}>
                <div style={corrHeader}>Receipt</div>
                <div style={corrHeader}>Raw In</div>
                <div style={corrHeader}>Blowoff</div>
                <div style={corrHeader}>Size Div</div>
                <div style={corrHeader}>Expected</div>
                <div style={corrHeader}>Packed (spec)</div>
                <div style={corrHeader}>Gap</div>

                {withFlow.map(r => {
                  // Estimate lbs removed by sorter
                  const blowoffLbs = r.avgBlowoff != null ? Math.round(r.rawLbs * (r.avgBlowoff / 100)) : null
                  // Size diversion isn't "lost" — it goes to MB run. But for this receipt's flow it leaves
                  const sizeDivPct = r.hasData ? (() => {
                    const entries = filteredLog.filter(e =>
                      e.receiptNum === r.receiptNum && !e.isMissed && e.sizeDiversion != null
                    )
                    if (entries.length === 0) return null
                    return round1(entries.reduce((s, e) => s + e.sizeDiversion, 0) / entries.length)
                  })() : null
                  const sizeDivLbs = sizeDivPct != null ? Math.round(r.rawLbs * (sizeDivPct / 100)) : null

                  const totalRemoved = (blowoffLbs || 0) + (sizeDivLbs || 0)
                  const expectedPacked = r.rawLbs - totalRemoved
                  const gap = r.packedLbs - expectedPacked
                  const gapPct = expectedPacked > 0 ? round1((gap / expectedPacked) * 100) : null

                  const gapColor = gapPct == null ? COLORS.text3
                    : Math.abs(gapPct) <= 3 ? COLORS.green
                    : Math.abs(gapPct) <= 8 ? COLORS.amber
                    : COLORS.red

                  return [
                    <div key={`${r.receiptNum}-r`} style={{ ...corrCell, fontWeight: 600 }}>{r.receiptNum}</div>,
                    <div key={`${r.receiptNum}-raw`} style={corrCell}>{r.rawLbs.toLocaleString()}</div>,
                    <div key={`${r.receiptNum}-blow`} style={corrCell}>
                      {blowoffLbs != null ? `−${blowoffLbs.toLocaleString()}` : '—'}
                      {r.avgBlowoff != null && <span style={{ color: COLORS.text3, fontSize: 9 }}> ({r.avgBlowoff}%)</span>}
                    </div>,
                    <div key={`${r.receiptNum}-size`} style={corrCell}>
                      {sizeDivLbs != null ? `−${sizeDivLbs.toLocaleString()}` : '—'}
                      {sizeDivPct != null && <span style={{ color: COLORS.text3, fontSize: 9 }}> ({sizeDivPct}%)</span>}
                    </div>,
                    <div key={`${r.receiptNum}-exp`} style={{ ...corrCell, fontWeight: 600 }}>
                      {expectedPacked.toLocaleString()}
                    </div>,
                    <div key={`${r.receiptNum}-act`} style={{ ...corrCell, fontWeight: 600 }}>
                      {r.packedLbs.toLocaleString()}
                    </div>,
                    <div key={`${r.receiptNum}-gap`} style={{ ...corrCell, fontWeight: 600, color: gapColor }}>
                      {gap > 0 ? '+' : ''}{gap.toLocaleString()} lb
                      {gapPct != null && <span style={{ fontSize: 9 }}> ({gap > 0 ? '+' : ''}{gapPct}%)</span>}
                    </div>,
                  ]
                })}
              </div>

              {/* Interpretation */}
              <div style={{
                fontFamily: FONT, fontSize: 10, color: COLORS.text3,
                marginTop: 10, lineHeight: 1.6, fontStyle: 'italic',
              }}>
                <b style={{ fontStyle: 'normal', color: COLORS.text2 }}>Reading the gap:</b>{' '}
                Positive gap = packed more than expected (cups ran light of spec weight, or raw lbs was underestimated).{' '}
                Negative gap = packed less than expected (cups ran heavy, or unmeasured loss like floor waste, samples, trash).{' '}
                Within ±3% is normal. The shed gets paid per box at spec weight — this gap is the difference between what we billed and what actually went on the pallet.
              </div>
            </div>
          )
        })()}

        {/* Line Stats vs Packout Correlation */}
        {(() => {
          const withBoth = receiptData.filter(r => r.hasData && r.packoutPct != null && r.avgLineRate)
          if (withBoth.length < 2) return null

          // Sort by line rate and compare packout
          const sorted = [...withBoth].sort((a, b) => a.avgLineRate - b.avgLineRate)
          const fastHalf = sorted.slice(Math.floor(sorted.length / 2))
          const slowHalf = sorted.slice(0, Math.floor(sorted.length / 2))
          const fastPackout = avg(fastHalf.map(r => r.packoutPct))
          const slowPackout = avg(slowHalf.map(r => r.packoutPct))

          const blowoffData = receiptData.filter(r => r.hasData && r.packoutPct != null && r.avgBlowoff != null)
          const highBlowHalf = blowoffData.length >= 2
            ? [...blowoffData].sort((a, b) => b.avgBlowoff - a.avgBlowoff).slice(0, Math.floor(blowoffData.length / 2))
            : null
          const lowBlowHalf = blowoffData.length >= 2
            ? [...blowoffData].sort((a, b) => b.avgBlowoff - a.avgBlowoff).slice(Math.floor(blowoffData.length / 2))
            : null

          return (
            <div style={{
              background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
              borderRadius: 6, padding: 14, marginTop: 16,
            }}>
              <div style={{
                fontFamily: FONT, fontSize: 10, fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                color: COLORS.text3, marginBottom: 10,
              }}>
                Line Stats vs Packout — Do Our Numbers Tell the Truth?
              </div>

              <div style={{ fontFamily: FONT, fontSize: 11, color: COLORS.text2, lineHeight: 1.8 }}>
                {/* Line rate correlation */}
                <div style={{ marginBottom: 8 }}>
                  <b style={{ color: COLORS.text }}>Line Speed:</b>{' '}
                  Faster receipts (avg {Math.round(avg(fastHalf.map(r => r.avgLineRate)))} lbs/hr) packed out at{' '}
                  <b style={{ color: fastPackout >= slowPackout ? COLORS.green : COLORS.amber }}>{round1(fastPackout)}%</b>.{' '}
                  Slower receipts (avg {Math.round(avg(slowHalf.map(r => r.avgLineRate)))} lbs/hr) packed out at{' '}
                  <b style={{ color: slowPackout >= fastPackout ? COLORS.green : COLORS.amber }}>{round1(slowPackout)}%</b>.
                  {Math.abs(fastPackout - slowPackout) > 3
                    ? fastPackout < slowPackout
                      ? ' Running faster is costing packout — the speed penalty is real.'
                      : ' Faster running isn\'t hurting packout — the line can handle the speed.'
                    : ' Speed isn\'t significantly affecting packout in this range.'
                  }
                </div>

                {/* Blowoff correlation */}
                {highBlowHalf && lowBlowHalf && (() => {
                  const highBlowPackout = avg(highBlowHalf.map(r => r.packoutPct))
                  const lowBlowPackout = avg(lowBlowHalf.map(r => r.packoutPct))
                  return (
                    <div>
                      <b style={{ color: COLORS.text }}>Blowoff:</b>{' '}
                      Higher blowoff receipts (avg {round1(avg(highBlowHalf.map(r => r.avgBlowoff)))}%) packed out at{' '}
                      <b>{round1(highBlowPackout)}%</b>.{' '}
                      Lower blowoff (avg {round1(avg(lowBlowHalf.map(r => r.avgBlowoff)))}%) packed out at{' '}
                      <b>{round1(lowBlowPackout)}%</b>.
                      {highBlowPackout < lowBlowPackout - 2
                        ? ' More blowoff = lower packout. The sorter is removing fruit that could have been packed.'
                        : ' Blowoff rate isn\'t significantly impacting packout.'
                      }
                    </div>
                  )
                })()}

                {/* Per-receipt table */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '100px 80px 80px 80px 80px',
                  gap: 0, marginTop: 12,
                }}>
                  <div style={corrHeader}>Receipt</div>
                  <div style={corrHeader}>Packout</div>
                  <div style={corrHeader}>Lbs/Hr</div>
                  <div style={corrHeader}>Blowoff</div>
                  <div style={corrHeader}>Prediction</div>
                  {withBoth.map(r => {
                    // Simple prediction: higher speed + higher blowoff = lower packout
                    const prediction = r.avgBlowoff != null
                      ? (r.avgLineRate < 1200 && r.avgBlowoff < 8) ? 'Good'
                        : (r.avgLineRate > 1300 || r.avgBlowoff > 12) ? 'Watch'
                        : 'OK'
                      : '—'
                    const predColor = prediction === 'Good' ? COLORS.green : prediction === 'Watch' ? COLORS.amber : COLORS.text3
                    return [
                      <div key={`${r.receiptNum}-r`} style={corrCell}>{r.receiptNum}</div>,
                      <div key={`${r.receiptNum}-p`} style={{ ...corrCell, fontWeight: 600, color: r.packoutPct >= 85 ? COLORS.green : COLORS.amber }}>
                        {round1(r.packoutPct)}%
                      </div>,
                      <div key={`${r.receiptNum}-l`} style={corrCell}>{r.avgLineRate || '—'}</div>,
                      <div key={`${r.receiptNum}-b`} style={corrCell}>{r.avgBlowoff != null ? `${r.avgBlowoff}%` : '—'}</div>,
                      <div key={`${r.receiptNum}-d`} style={{ ...corrCell, color: predColor, fontWeight: 600 }}>
                        {prediction}
                        {r.packoutPct > 100 && <span style={{ color: COLORS.amber, fontWeight: 400, marginLeft: 4 }}>*</span>}
                      </div>,
                    ]
                  })}
                </div>
              </div>
            </div>
          )
        })()}

        {/* Over 100% explanation */}
        {overallPackout != null && overallPackout > 100 && (
          <div style={{
            background: COLORS.amberDim + '40', border: `1px solid ${COLORS.amber}`,
            borderRadius: 6, padding: 12, marginTop: 12,
            fontFamily: FONT, fontSize: 11, color: COLORS.amber, lineHeight: 1.6,
          }}>
            <b>Packout exceeds 100%</b> — cups likely ran light of fill weight.
            When clamshells are packed slightly under target weight, the same raw lbs yields more cups, pushing packout above 100%.
            This is not a data error. It means the operation was efficient on raw usage but individual cup weights may be below spec.
            This naturally shows as a negative discrepancy on operations efficiency reports — the raw lbs "stretched further" than expected.
          </div>
        )}

        {receiptData.some(r => r.packoutPct > 100) && overallPackout <= 100 && (
          <div style={{
            fontFamily: FONT, fontSize: 9, color: COLORS.text3,
            marginTop: 8, fontStyle: 'italic',
          }}>
            * Some receipts show packout above 100% — likely light cup fills on those runs.
          </div>
        )}
      </div>
    </div>
  )
}

function avg(arr) {
  const valid = arr.filter(v => v != null)
  if (valid.length === 0) return null
  return valid.reduce((a, b) => a + b, 0) / valid.length
}

const corrHeader = {
  fontFamily: FONT, fontSize: 8, color: COLORS.text3,
  letterSpacing: '0.06em', textTransform: 'uppercase',
  padding: '4px 6px', borderBottom: `1px solid ${COLORS.border}`,
}

const corrCell = {
  fontFamily: FONT, fontSize: 11, color: COLORS.text2,
  padding: '5px 6px', borderBottom: `1px solid ${COLORS.border}`,
}

function SummaryCard({ label, value, color }) {
  return (
    <div style={{
      background: COLORS.bg2, borderRadius: 6, padding: 10, textAlign: 'center',
    }}>
      <div style={{ fontFamily: FONT, fontSize: 18, fontWeight: 700, color: color || COLORS.text }}>
        {value}
      </div>
      <div style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3, marginTop: 2 }}>
        {label}
      </div>
    </div>
  )
}

function MiniStat({ label, value, color, detail }) {
  return (
    <div>
      <div style={{ fontFamily: FONT, fontSize: 8, color: COLORS.text3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: color || COLORS.text }}>
        {value}
      </div>
      {detail && (
        <div style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3 }}>
          {detail}
        </div>
      )}
    </div>
  )
}

function filterBtn(active) {
  return {
    fontFamily: FONT, fontSize: 10, fontWeight: active ? 700 : 400,
    color: active ? COLORS.green : COLORS.text3,
    background: active ? COLORS.greenDim : 'transparent',
    border: `1px solid ${active ? COLORS.green : COLORS.border}`,
    padding: '5px 10px', borderRadius: 4, cursor: 'pointer',
  }
}

function round1(n) {
  return Math.round(n * 10) / 10
}
