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

  // Build per-receipt packout
  const receiptData = receipts.map(r => {
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
                    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
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
      </div>
    </div>
  )
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
