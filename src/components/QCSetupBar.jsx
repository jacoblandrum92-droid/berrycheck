import React, { useState, useEffect } from 'react'
import { COLORS, FONT, PACK_CRITERIA } from '../constants'
import { loadReceipts } from '../receipts'

const inputStyle = {
  background: COLORS.bg3, border: `1px solid ${COLORS.border2}`,
  color: COLORS.text, fontFamily: FONT, fontSize: 12,
  padding: '6px 10px', borderRadius: 3, outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle = {
  fontFamily: FONT, fontSize: 8, color: COLORS.text3,
  letterSpacing: '0.08em', textTransform: 'uppercase',
  marginBottom: 3, display: 'block',
}

export default function QCSetupBar({
  lotId, setLotId, receiptNum, setReceiptNum,
  grower, setGrower, variety, setVariety,
  packCriteria, setPackCriteria,
  history, skipLayer, skipPallet,
}) {
  const [activeReceipts, setActiveReceipts] = useState([])

  useEffect(() => {
    const refresh = () => {
      const all = loadReceipts()
      setActiveReceipts(all.filter(r => r.status === 'active'))
    }
    refresh()
    const id = setInterval(refresh, 5000)
    return () => clearInterval(id)
  }, [])

  const handleReceiptChange = (e) => {
    const selectedId = e.target.value
    if (!selectedId) { setReceiptNum(''); return }
    const receipt = activeReceipts.find(r => r.id === selectedId)
    if (receipt) {
      setReceiptNum(receipt.receiptNum)
      if (receipt.grower) setGrower(receipt.grower)
      if (receipt.variety) setVariety(receipt.variety)
    }
  }

  // Layer info
  const officialCount = lotId ? history.filter(s => s.lotId === lotId && !s.isExtra).length : 0
  const extraCount = lotId ? history.filter(s => s.lotId === lotId && s.isExtra).length : 0
  const layerNames = { 0: '#1 BOTTOM', 1: '#2 MIDDLE', 2: '#3 TOP' }

  const packKeys = Object.keys(PACK_CRITERIA)

  return (
    <div style={{
      background: COLORS.bg2, borderBottom: `1px solid ${COLORS.border}`,
      padding: '10px 32px',
      display: 'flex', alignItems: 'flex-end', gap: 16,
    }}>
      {/* Receipt */}
      <div style={{ minWidth: 200 }}>
        <label style={labelStyle}>Receipt</label>
        <select
          style={{ ...inputStyle, width: '100%' }}
          value={activeReceipts.find(r => r.receiptNum === receiptNum)?.id || ''}
          onChange={handleReceiptChange}
        >
          <option value="">Select...</option>
          {activeReceipts.map(r => (
            <option key={r.id} value={r.id}>
              {r.receiptNum} — {r.grower}{r.variety ? ` / ${r.variety}` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Pallet Tag */}
      <div style={{ minWidth: 120 }}>
        <label style={labelStyle}>Pallet Tag</label>
        <input style={{ ...inputStyle, width: '100%' }}
          value={lotId} onChange={e => setLotId(e.target.value)}
          placeholder="P-0042"
        />
      </div>

      {/* Grower (auto-filled, editable) */}
      <div style={{ minWidth: 120 }}>
        <label style={labelStyle}>Grower</label>
        <input style={{ ...inputStyle, width: '100%' }}
          value={grower} onChange={e => setGrower(e.target.value)}
          placeholder="Name"
        />
      </div>

      {/* Variety (auto-filled, editable) */}
      <div style={{ minWidth: 100 }}>
        <label style={labelStyle}>Variety</label>
        <input style={{ ...inputStyle, width: '100%' }}
          value={variety} onChange={e => setVariety(e.target.value)}
          placeholder="Variety"
        />
      </div>

      {/* Pack Criteria */}
      <div>
        <label style={labelStyle}>Pack Criteria</label>
        <div style={{ display: 'flex', gap: 4 }}>
          {packKeys.map(key => {
            const pc = PACK_CRITERIA[key]
            const active = packCriteria === key
            return (
              <button key={key} onClick={() => setPackCriteria(key)}
                title={pc.description}
                style={{
                  fontFamily: FONT, fontSize: 10, fontWeight: 600,
                  color: active ? COLORS.green : COLORS.text3,
                  background: active ? COLORS.greenDim : 'transparent',
                  border: `1px solid ${active ? COLORS.green : COLORS.border}`,
                  padding: '5px 10px', borderRadius: 3, cursor: 'pointer',
                  letterSpacing: '0.04em', whiteSpace: 'nowrap',
                }}>
                {pc.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Layer indicator */}
      {lotId && (
        <div style={{
          fontFamily: FONT, fontSize: 11, textAlign: 'right',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div>
            <div style={{ color: COLORS.text3, fontSize: 9, letterSpacing: '0.06em' }}>
              {lotId}: {officialCount}/3{extraCount > 0 ? ` +${extraCount}` : ''}
            </div>
            {officialCount < 3 ? (
              <div style={{ color: COLORS.green, fontWeight: 600, fontSize: 12 }}>
                NEXT: {layerNames[officialCount]}
              </div>
            ) : (
              <div style={{ color: COLORS.amber, fontWeight: 600, fontSize: 11 }}>
                3/3 DONE
              </div>
            )}
          </div>
          {officialCount < 3 && (
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={skipLayer} style={{
                fontFamily: FONT, fontSize: 9, color: COLORS.amber,
                background: 'transparent', border: `1px solid ${COLORS.amberDim}`,
                padding: '4px 8px', borderRadius: 3, cursor: 'pointer',
              }}>
                SKIP LAYER
              </button>
              <button onClick={skipPallet} style={{
                fontFamily: FONT, fontSize: 9, color: COLORS.red,
                background: 'transparent', border: `1px solid ${COLORS.redDim}`,
                padding: '4px 8px', borderRadius: 3, cursor: 'pointer',
              }}>
                MISS PALLET
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
