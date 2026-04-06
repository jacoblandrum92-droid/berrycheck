import React, { useState, useEffect } from 'react'
import { COLORS, FONT } from '../constants'
import { loadReceipts } from '../receipts'
import { loadPackCodes } from '../packCodes'

export default function PalletCloseOut({ lotId, receiptNum, grower, packCode, priorReceipts, palletLineStats, onClose, onCancel }) {
  const [receipts, setReceipts] = useState([])
  const [packCodes, setPackCodes] = useState([])
  const [entries, setEntries] = useState([])

  useEffect(() => {
    const active = loadReceipts().filter(r => r.status === 'active')
    setReceipts(active)
    setPackCodes(loadPackCodes())

    // Pre-fill with prior receipt segments (from mid-pallet changes) + current receipt
    const priorEntries = (priorReceipts || []).map((pr, i) => ({
      id: Date.now() + i,
      receiptNum: pr.receiptNum || '',
      grower: pr.grower || '',
      variety: pr.variety || '',
      boxes: pr.boxes ? pr.boxes.toString() : '',
    }))

    // Add current receipt as the last segment (boxes TBD)
    const currentEntry = {
      id: Date.now() + 100,
      receiptNum: receiptNum || '',
      grower: (() => { const r = active.find(r => r.receiptNum === receiptNum); return r?.grower || grower || '' })(),
      variety: (() => { const r = active.find(r => r.receiptNum === receiptNum); return r?.variety || '' })(),
      boxes: '',
    }

    setEntries([...priorEntries, currentEntry])
  }, [])

  const addEntry = () => {
    setEntries([...entries, {
      id: Date.now(),
      receiptNum: '',
      grower: '',
      variety: '',
      boxes: '',
    }])
  }

  const updateEntry = (id, field, value) => {
    setEntries(entries.map(e => {
      if (e.id !== id) return e
      const updated = { ...e, [field]: value }
      // Auto-fill grower/variety when receipt selected
      if (field === 'receiptNum' && value) {
        const r = receipts.find(r => r.receiptNum === value)
        if (r) {
          updated.grower = r.grower || ''
          updated.variety = r.variety || ''
        }
      }
      return updated
    }))
  }

  const removeEntry = (id) => {
    if (entries.length <= 1) return
    setEntries(entries.filter(e => e.id !== id))
  }

  const totalBoxes = entries.reduce((sum, e) => sum + (parseInt(e.boxes) || 0), 0)

  // Get expected per pallet from selected pack code
  const selectedPack = packCodes.find(c => c.code === packCode)
  const expectedBoxes = selectedPack ? selectedPack.perPallet : null

  const handleClose = () => {
    // Validate — at least one entry with boxes
    const hasBoxes = entries.some(e => parseInt(e.boxes) > 0)
    if (!hasBoxes) {
      alert('Enter box counts before closing the pallet.')
      return
    }

    onClose({
      lotId,
      entries: entries.map(e => ({
        receiptNum: e.receiptNum,
        grower: e.grower,
        variety: e.variety,
        boxes: parseInt(e.boxes) || 0,
      })).filter(e => e.boxes > 0),
      totalBoxes,
      packCode,
      lineRate: palletLineStats?.lineRate || null,
      blowoff: palletLineStats?.blowoff || null,
      sizeDiversion: palletLineStats?.sizeDiversion || null,
      lineStatsCapturedAt: palletLineStats?.capturedAt || null,
    })
  }

  const inputStyle = {
    fontFamily: FONT, fontSize: 12, color: COLORS.text,
    background: COLORS.bg, border: `1px solid ${COLORS.border2}`,
    padding: '7px 10px', borderRadius: 3, outline: 'none',
    boxSizing: 'border-box', width: '100%',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: COLORS.bg, border: `2px solid ${COLORS.green}`,
        borderRadius: 10, width: '90%', maxWidth: 550,
        padding: 24, maxHeight: '85vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{
          fontFamily: FONT, fontSize: 16, fontWeight: 700,
          color: COLORS.green, marginBottom: 4,
        }}>
          Close Out Pallet {lotId}
        </div>
        <div style={{
          fontFamily: FONT, fontSize: 12, color: COLORS.text2,
          marginBottom: 20,
        }}>
          Confirm what's on this pallet before moving to the next one.
        </div>

        {/* Receipt entries */}
        {entries.map((entry, i) => (
          <div key={entry.id} style={{
            background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
            borderRadius: 6, padding: 14, marginBottom: 10,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 8,
            }}>
              <div style={{
                fontFamily: FONT, fontSize: 10, fontWeight: 600,
                color: COLORS.text3, letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>
                {entries.length > 1 ? `Receipt ${i + 1} of ${entries.length}` : 'Receipt'}
              </div>
              {entries.length > 1 && (
                <button onClick={() => removeEntry(entry.id)} style={{
                  fontFamily: FONT, fontSize: 9, color: COLORS.red,
                  background: 'transparent', border: `1px solid ${COLORS.redDim}`,
                  padding: '2px 8px', borderRadius: 2, cursor: 'pointer',
                }}>REMOVE</button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 8 }}>
              {/* Receipt dropdown */}
              <div>
                <div style={{ fontFamily: FONT, fontSize: 8, color: COLORS.text3, marginBottom: 2, letterSpacing: '0.06em' }}>
                  RECEIPT
                </div>
                <select style={inputStyle} value={entry.receiptNum}
                  onChange={e => updateEntry(entry.id, 'receiptNum', e.target.value)}>
                  <option value="">Select...</option>
                  {receipts.map(r => (
                    <option key={r.id} value={r.receiptNum}>
                      {r.receiptNum} — {r.grower}
                    </option>
                  ))}
                </select>
              </div>

              {/* Grower (auto-filled) */}
              <div>
                <div style={{ fontFamily: FONT, fontSize: 8, color: COLORS.text3, marginBottom: 2, letterSpacing: '0.06em' }}>
                  GROWER / VARIETY
                </div>
                <div style={{
                  ...inputStyle, color: COLORS.text2,
                  display: 'flex', alignItems: 'center',
                }}>
                  {entry.grower || '—'}{entry.variety ? ` / ${entry.variety}` : ''}
                </div>
              </div>

              {/* Box count */}
              <div>
                <div style={{ fontFamily: FONT, fontSize: 8, color: COLORS.text3, marginBottom: 2, letterSpacing: '0.06em' }}>
                  BOXES
                </div>
                <input type="number" min="0" style={{
                  ...inputStyle,
                  fontSize: 16, fontWeight: 700, textAlign: 'center',
                  color: (parseInt(entry.boxes) || 0) > 0 ? COLORS.text : COLORS.text3,
                }}
                  value={entry.boxes}
                  onChange={e => updateEntry(entry.id, 'boxes', e.target.value)}
                  placeholder="0"
                  autoFocus={i === 0}
                />
              </div>
            </div>
          </div>
        ))}

        {/* Add receipt button */}
        <button onClick={addEntry} style={{
          fontFamily: FONT, fontSize: 11, fontWeight: 600,
          color: COLORS.amber, background: 'transparent',
          border: `1px dashed ${COLORS.amber}`,
          padding: '10px 0', borderRadius: 6, cursor: 'pointer',
          width: '100%', marginBottom: 16,
          letterSpacing: '0.06em',
        }}>
          + Add Another Receipt to This Pallet
        </button>

        {/* Line stats display or reminder */}
        {palletLineStats ? (
          <div style={{
            background: COLORS.greenDim, border: `1px solid ${COLORS.green}`,
            borderRadius: 6, padding: 12, marginBottom: 14,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ display: 'flex', gap: 16 }}>
              {palletLineStats.lineRate && (
                <div style={{ fontFamily: FONT, fontSize: 11 }}>
                  <span style={{ color: COLORS.text3 }}>Lbs/Hr </span>
                  <b style={{ color: COLORS.green }}>{palletLineStats.lineRate}</b>
                </div>
              )}
              {palletLineStats.blowoff != null && (
                <div style={{ fontFamily: FONT, fontSize: 11 }}>
                  <span style={{ color: COLORS.text3 }}>Blowoff </span>
                  <b style={{ color: COLORS.green }}>{palletLineStats.blowoff}%</b>
                </div>
              )}
              {palletLineStats.sizeDiversion != null && (
                <div style={{ fontFamily: FONT, fontSize: 11 }}>
                  <span style={{ color: COLORS.text3 }}>Size Sort </span>
                  <b style={{ color: COLORS.green }}>{palletLineStats.sizeDiversion}%</b>
                </div>
              )}
            </div>
            <div style={{
              fontFamily: FONT, fontSize: 9, color: COLORS.green, fontStyle: 'italic',
            }}>
              captured at {palletLineStats.capturedAt}
            </div>
          </div>
        ) : (
          <div style={{
            background: COLORS.amberDim, border: `1px solid ${COLORS.amber}`,
            borderRadius: 6, padding: 12, marginBottom: 14,
            fontFamily: FONT, fontSize: 11, color: COLORS.amber,
          }}>
            Line stats not recorded for this pallet. This pallet will log without lbs/hr, blowoff, or size sort data.
          </div>
        )}

        {/* Total */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 14px',
          background: totalBoxes > 0 && expectedBoxes && totalBoxes !== expectedBoxes
            ? COLORS.amberDim : COLORS.bg2,
          border: `1px solid ${totalBoxes > 0 && expectedBoxes && totalBoxes !== expectedBoxes
            ? COLORS.amber : COLORS.border}`,
          borderRadius: 6, marginBottom: 16,
        }}>
          <div style={{ fontFamily: FONT, fontSize: 12, color: COLORS.text2 }}>
            Total Boxes
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{
              fontFamily: FONT, fontSize: 24, fontWeight: 700,
              color: totalBoxes > 0 ? COLORS.text : COLORS.text3,
            }}>
              {totalBoxes}
            </span>
            {expectedBoxes && (
              <span style={{
                fontFamily: FONT, fontSize: 12,
                color: totalBoxes === expectedBoxes ? COLORS.green
                  : totalBoxes > 0 ? COLORS.amber : COLORS.text3,
              }}>
                {totalBoxes === expectedBoxes ? '= full pallet'
                  : totalBoxes > 0 ? `of ${expectedBoxes} expected` : `/ ${expectedBoxes}`}
              </span>
            )}
          </div>
        </div>

        {/* Warning if not full */}
        {totalBoxes > 0 && expectedBoxes && totalBoxes < expectedBoxes && (
          <div style={{
            fontFamily: FONT, fontSize: 10, color: COLORS.amber,
            textAlign: 'center', marginBottom: 12,
          }}>
            Short pallet — {expectedBoxes - totalBoxes} boxes under. This is OK if it's the last pallet of a receipt.
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, fontFamily: FONT, fontSize: 12, fontWeight: 600,
            color: COLORS.text3, background: 'transparent',
            border: `1px solid ${COLORS.border}`,
            padding: 14, borderRadius: 6, cursor: 'pointer',
          }}>
            NOT YET
          </button>
          <button onClick={handleClose} style={{
            flex: 2, fontFamily: FONT, fontSize: 14, fontWeight: 700,
            color: COLORS.green, background: COLORS.greenDim,
            border: `2px solid ${COLORS.green}`,
            padding: 14, borderRadius: 6, cursor: 'pointer',
            letterSpacing: '0.06em',
          }}>
            CLOSE PALLET
          </button>
        </div>
      </div>
    </div>
  )
}
