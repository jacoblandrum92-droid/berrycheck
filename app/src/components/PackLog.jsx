import React, { useState, useEffect } from 'react'
import { COLORS, FONT } from '../constants'
import { loadPackCodes } from '../packCodes'

const STORAGE_KEY = 'bc_packlog'

function loadPackLog() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
  catch { return [] }
}

function savePackLog(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  fetch('/api/store/' + STORAGE_KEY, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entries) }).catch(() => {})
}

// Inline input bar that lives on the QC screen
export function PackLogInput({ receiptNum, grower }) {
  const [packCode, setPackCode] = useState('')
  const [boxes, setBoxes] = useState('')
  const [palletNum, setPalletNum] = useState('')
  const [flash, setFlash] = useState(false)
  const [showPalletRef, setShowPalletRef] = useState(false)
  const [recentEntries, setRecentEntries] = useState([])
  const [todayCount, setTodayCount] = useState(() => {
    const today = new Date().toLocaleDateString()
    const log = loadPackLog()
    const maxNum = log.filter(e => e.date === today).reduce((max, e) => Math.max(max, e.dailyPallet || 0), 0)
    return maxNum
  })

  // Load pack codes from managed database
  const [packCodeDB, setPackCodeDB] = useState(loadPackCodes)
  useEffect(() => {
    const refresh = () => setPackCodeDB(loadPackCodes())
    const id = setInterval(refresh, 5000)
    return () => clearInterval(id)
  }, [])

  // Get next daily pallet number
  const getDailyPalletNum = () => {
    const today = new Date().toLocaleDateString()
    const log = loadPackLog()
    const todayEntries = log.filter(e => e.date === today)
    // Find the highest daily pallet number used today
    const maxNum = todayEntries.reduce((max, e) => Math.max(max, e.dailyPallet || 0), 0)
    // Only increment if this is a new pallet (different palletNum from last entry)
    const lastEntry = todayEntries[todayEntries.length - 1]
    if (lastEntry && lastEntry.palletNum === palletNum.trim() && lastEntry.dailyPallet) {
      return lastEntry.dailyPallet // same pallet, same number
    }
    return maxNum + 1
  }

  const logEntry = () => {
    if (!packCode.trim() || !boxes) return
    const dailyPallet = getDailyPalletNum()
    const entry = {
      id: Date.now(),
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      date: new Date().toLocaleDateString(),
      packCode: packCode.trim(),
      receiptNum: receiptNum || '',
      grower: grower || '',
      palletNum: palletNum.trim(),
      dailyPallet,
      boxes: parseInt(boxes) || 0,
    }
    const log = loadPackLog()
    log.push(entry)
    savePackLog(log)

    setRecentEntries(prev => [...prev, entry].slice(-5)) // keep last 5
    setBoxes('')
    setTodayCount(dailyPallet)
    setFlash(true)
    setTimeout(() => setFlash(false), 600)
  }

  const inputStyle = {
    background: COLORS.bg3, border: `1px solid ${COLORS.border2}`,
    color: COLORS.text, fontFamily: FONT, fontSize: 12,
    padding: '6px 10px', borderRadius: 3, outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', gap: 8,
      padding: '8px 32px',
      background: flash ? COLORS.greenDim : COLORS.bg2,
      borderBottom: `1px solid ${COLORS.border}`,
      transition: 'background 0.3s',
    }}>
      <div style={{
        fontFamily: FONT, fontSize: 8, color: COLORS.text3,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        alignSelf: 'center', marginRight: 4,
      }}>
        Pack Log
      </div>

      {/* Pack code dropdown */}
      <div>
        <div style={{ fontFamily: FONT, fontSize: 8, color: COLORS.text3, letterSpacing: '0.06em', marginBottom: 2 }}>
          PACK CODE
        </div>
        <select
          style={{ ...inputStyle, width: 160 }}
          value={packCode}
          onChange={e => setPackCode(e.target.value)}
        >
          <option value="">Select...</option>
          {packCodeDB.map(c => (
            <option key={c.code} value={c.code}>
              {c.code} — {c.desc}
            </option>
          ))}
        </select>
      </div>

      {/* Pallet # */}
      <div>
        <div style={{ fontFamily: FONT, fontSize: 8, color: COLORS.text3, letterSpacing: '0.06em', marginBottom: 2 }}>
          PALLET #
        </div>
        <input
          style={{ ...inputStyle, width: 80 }}
          value={palletNum}
          onChange={e => setPalletNum(e.target.value)}
          placeholder="P-001"
        />
      </div>

      {/* Receipt (auto-filled, shown for context) */}
      <div>
        <div style={{ fontFamily: FONT, fontSize: 8, color: COLORS.text3, letterSpacing: '0.06em', marginBottom: 2 }}>
          RECEIPT
        </div>
        <div style={{
          ...inputStyle, width: 100,
          color: receiptNum ? COLORS.text : COLORS.text3,
          background: COLORS.bg3,
        }}>
          {receiptNum || '—'}
        </div>
      </div>

      {/* Boxes */}
      {(() => {
        const selectedPack = packCodeDB.find(c => c.code === packCode)
        const maxBoxes = selectedPack ? selectedPack.perPallet : null
        const boxCount = parseInt(boxes) || 0
        const isOver = maxBoxes && boxCount > maxBoxes

        return (
          <div>
            <div style={{
              fontFamily: FONT, fontSize: 8, color: isOver ? COLORS.red : COLORS.text3,
              letterSpacing: '0.06em', marginBottom: 2,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              BOXES {maxBoxes ? `(/${maxBoxes})` : ''}
              <span onClick={(e) => { e.stopPropagation(); setShowPalletRef(true) }} style={{
                cursor: 'pointer', color: COLORS.amber,
                fontWeight: 700, fontSize: 11,
                padding: '0 4px', border: `1px solid ${COLORS.amberDim}`,
                borderRadius: 3, lineHeight: '14px',
              }} title="Pallet quantities reference">?</span>
            </div>
            <input
              type="number" min="1"
              style={{
                ...inputStyle, width: 70,
                borderColor: isOver ? COLORS.red : COLORS.border2,
                color: isOver ? COLORS.red : COLORS.text,
              }}
              value={boxes}
              onChange={e => setBoxes(e.target.value)}
              placeholder="0"
              onKeyDown={e => e.key === 'Enter' && logEntry()}
            />
          </div>
        )
      })()}

      <button onClick={logEntry} style={{
        fontFamily: FONT, fontSize: 10, fontWeight: 600,
        color: COLORS.green, background: COLORS.greenDim,
        border: `1px solid ${COLORS.green}`,
        padding: '6px 14px', borderRadius: 3, cursor: 'pointer',
        letterSpacing: '0.06em',
      }}>
        LOG
      </button>

      {/* Daily pallet counter */}
      <div style={{
        fontFamily: FONT, fontSize: 11, color: COLORS.text3,
        textAlign: 'center', marginLeft: 4,
      }}>
        <div style={{ fontSize: 8, letterSpacing: '0.06em' }}>TODAY</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>
          {todayCount}
        </div>
        <div style={{ fontSize: 8 }}>pallets</div>
      </div>

      {/* Recent entries confirmation */}
      {recentEntries.length > 0 && (
        <div style={{
          display: 'flex', gap: 6, marginLeft: 8,
          alignItems: 'center', overflow: 'hidden', flex: 1,
        }}>
          {recentEntries.map(e => (
            <div key={e.id} style={{
              fontFamily: FONT, fontSize: 9, color: COLORS.green,
              background: COLORS.greenDim, border: `1px solid ${COLORS.green}30`,
              padding: '3px 8px', borderRadius: 3, whiteSpace: 'nowrap',
            }}>
              #{e.dailyPallet} · {e.packCode} · {e.receiptNum || '—'} · {e.boxes}bx
            </div>
          ))}
        </div>
      )}

      {/* Pallet quantity reference popup */}
      {showPalletRef && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setShowPalletRef(false)}>
          <div style={{
            background: '#fff', borderRadius: 8, padding: 20,
            maxWidth: 400, maxHeight: '70vh', overflowY: 'auto',
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              fontFamily: FONT, fontSize: 13, fontWeight: 700,
              color: COLORS.text, marginBottom: 12,
            }}>
              Boxes Per Full Pallet
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={refTh}>Qty</th>
                  <th style={refTh}>Pack Size</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { qty: 240, desc: '6oz (12-pack)' },
                  { qty: 144, desc: 'Pint, 11oz, 18oz (8-pack), 4x2lb' },
                  { qty: 100, desc: '18oz (12-pack), 16oz' },
                  { qty: 75, desc: 'Bulk lugs (RTE/MBG)' },
                  { qty: 60, desc: '18oz (18-pack), 24oz (12-pack)' },
                  { qty: 50, desc: '2lb (12-pack), 24oz (18-pack)' },
                ].map(r => (
                  <tr key={r.qty} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    <td style={{
                      fontFamily: FONT, fontSize: 16, fontWeight: 700,
                      color: COLORS.green, padding: '8px 12px', textAlign: 'center',
                    }}>{r.qty}</td>
                    <td style={{
                      fontFamily: FONT, fontSize: 11, color: COLORS.text2,
                      padding: '8px 12px',
                    }}>{r.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={() => setShowPalletRef(false)} style={{
              fontFamily: FONT, fontSize: 11, color: COLORS.text3,
              background: 'transparent', border: `1px solid ${COLORS.border}`,
              padding: '6px 16px', borderRadius: 4, cursor: 'pointer',
              marginTop: 12, width: '100%',
            }}>CLOSE</button>
          </div>
        </div>
      )}
    </div>
  )
}

// Full pack log viewer/printer — opens as overlay
export default function PackLogViewer({ onClose }) {
  const [entries, setEntries] = useState(loadPackLog)
  const [filterDate, setFilterDate] = useState(new Date().toLocaleDateString())

  const filtered = entries.filter(e => e.date === filterDate)

  // Group by pallet
  const pallets = {}
  filtered.forEach(e => {
    const key = e.palletNum || `unassigned-${e.id}`
    if (!pallets[key]) pallets[key] = []
    pallets[key].push(e)
  })

  const totalBoxes = filtered.reduce((sum, e) => sum + e.boxes, 0)

  const deleteEntry = (id) => {
    const updated = entries.filter(e => e.id !== id)
    setEntries(updated)
    savePackLog(updated)
  }

  const clearDay = () => {
    if (!confirm(`Clear all pack log entries for ${filterDate}?`)) return
    const updated = entries.filter(e => e.date !== filterDate)
    setEntries(updated)
    savePackLog(updated)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: COLORS.bg, border: `1px solid ${COLORS.border}`,
        borderRadius: 8, width: '95%', maxWidth: 700, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 20px', borderBottom: `1px solid ${COLORS.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{
            fontFamily: FONT, fontSize: 12, fontWeight: 600,
            color: COLORS.green, letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            Pack Log — {filterDate}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{
              fontFamily: FONT, fontSize: 11, color: COLORS.text,
              fontWeight: 600,
            }}>
              {totalBoxes} boxes / {filtered.length} entries
            </div>
            <button onClick={() => window.print()} style={{
              fontFamily: FONT, fontSize: 10, color: COLORS.amber,
              background: 'transparent', border: `1px solid ${COLORS.amber}`,
              padding: '4px 12px', borderRadius: 3, cursor: 'pointer',
            }}>PRINT</button>
            <button onClick={clearDay} style={{
              fontFamily: FONT, fontSize: 10, color: COLORS.red,
              background: 'transparent', border: `1px solid ${COLORS.redDim}`,
              padding: '4px 12px', borderRadius: 3, cursor: 'pointer',
            }}>CLEAR DAY</button>
            <button onClick={onClose} style={{
              fontFamily: FONT, fontSize: 10, color: COLORS.text3,
              background: 'transparent', border: `1px solid ${COLORS.border}`,
              padding: '4px 12px', borderRadius: 3, cursor: 'pointer',
            }}>CLOSE</button>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 20px 20px' }}>
          {filtered.length === 0 ? (
            <div style={{
              fontFamily: FONT, fontSize: 12, color: COLORS.text3,
              textAlign: 'center', padding: 40,
            }}>
              No entries for {filterDate}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
              <thead>
                <tr>
                  {['Time', '#', 'Pack Code', 'Pallet', 'Receipt', 'Grower', 'Boxes', ''].map(h => (
                    <th key={h} style={{
                      fontFamily: FONT, fontSize: 9, color: COLORS.text3,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      textAlign: 'left', padding: '8px 10px',
                      borderBottom: `1px solid ${COLORS.border}`, fontWeight: 500,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id} style={{
                    borderBottom: `1px solid ${COLORS.border}`,
                    background: e.isMissed ? COLORS.redDim : 'transparent',
                  }}>
                    <td style={td}>{e.time}</td>
                    <td style={{ ...td, fontWeight: 700, color: e.isMissed ? COLORS.red : COLORS.green }}>
                      {e.dailyPallet || '—'}
                    </td>
                    <td style={{ ...td, fontWeight: 600, color: COLORS.text }}>
                      {e.isMissed ? <span style={{ color: COLORS.red }}>MISSED</span> : e.packCode}
                    </td>
                    <td style={td}>{e.palletNum || '—'}</td>
                    <td style={td}>{e.receiptNum || '—'}</td>
                    <td style={td}>{e.grower || '—'}</td>
                    <td style={{ ...td, fontWeight: 600, color: COLORS.text }}>{e.boxes}</td>
                    <td style={td}>
                      <button onClick={() => deleteEntry(e.id)} style={{
                        fontFamily: FONT, fontSize: 8, color: COLORS.red,
                        background: 'transparent', border: `1px solid ${COLORS.redDim}`,
                        padding: '2px 6px', borderRadius: 2, cursor: 'pointer',
                      }}>DEL</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

const td = {
  fontFamily: FONT, fontSize: 11, color: COLORS.text2,
  padding: '8px 10px',
}
