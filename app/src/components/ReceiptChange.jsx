import React, { useState, useEffect } from 'react'
import { COLORS, FONT } from '../constants'
import { loadReceipts } from '../receipts'

export default function ReceiptChange({ currentReceipt, currentGrower, onConfirm, onCancel }) {
  const [boxes, setBoxes] = useState('')
  const [newReceiptId, setNewReceiptId] = useState('')
  const [activeReceipts, setActiveReceipts] = useState([])

  useEffect(() => {
    setActiveReceipts(loadReceipts().filter(r => r.status === 'active'))
  }, [])

  const handleConfirm = () => {
    if (!boxes || parseInt(boxes) < 1) return alert('Enter box count for the outgoing receipt')
    if (!newReceiptId) return alert('Select the new receipt')

    const newReceipt = activeReceipts.find(r => r.id === newReceiptId)
    onConfirm({
      outgoingBoxes: parseInt(boxes),
      newReceiptNum: newReceipt.receiptNum,
      newGrower: newReceipt.grower || '',
      newVariety: newReceipt.variety || '',
    })
  }

  const inputStyle = {
    fontFamily: FONT, fontSize: 13, color: COLORS.text,
    background: COLORS.bg, border: `1px solid ${COLORS.border2}`,
    padding: '8px 12px', borderRadius: 4, outline: 'none',
    boxSizing: 'border-box', width: '100%',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: COLORS.bg, border: `2px solid ${COLORS.amber}`,
        borderRadius: 10, width: '90%', maxWidth: 450,
        padding: 24,
      }}>
        <div style={{
          fontFamily: FONT, fontSize: 15, fontWeight: 700,
          color: COLORS.amber, marginBottom: 4,
        }}>
          Add Receipt to Pallet
        </div>
        <div style={{
          fontFamily: FONT, fontSize: 11, color: COLORS.text2,
          marginBottom: 20,
        }}>
          Adding a new receipt to this pallet. How many boxes of the current receipt are on the pallet so far?
        </div>

        {/* Outgoing receipt */}
        <div style={{
          background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
          borderRadius: 6, padding: 14, marginBottom: 14,
        }}>
          <div style={{
            fontFamily: FONT, fontSize: 9, color: COLORS.text3,
            letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8,
          }}>
            Outgoing — {currentReceipt || 'No receipt'} {currentGrower ? `(${currentGrower})` : ''}
          </div>
          <div style={{
            fontFamily: FONT, fontSize: 10, color: COLORS.text2, marginBottom: 6,
          }}>
            How many boxes of this receipt are on the pallet?
          </div>
          <input type="number" min="1" style={{
            ...inputStyle, fontSize: 20, fontWeight: 700, textAlign: 'center',
          }}
            value={boxes}
            onChange={e => setBoxes(e.target.value)}
            placeholder="0"
            autoFocus
          />
        </div>

        {/* New receipt */}
        <div style={{
          background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
          borderRadius: 6, padding: 14, marginBottom: 20,
        }}>
          <div style={{
            fontFamily: FONT, fontSize: 9, color: COLORS.text3,
            letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8,
          }}>
            Incoming — New Receipt
          </div>
          <select style={inputStyle} value={newReceiptId}
            onChange={e => setNewReceiptId(e.target.value)}>
            <option value="">Select new receipt...</option>
            {activeReceipts.filter(r => r.receiptNum !== currentReceipt).map(r => (
              <option key={r.id} value={r.id}>
                {r.receiptNum} — {r.grower}{r.variety ? ` / ${r.variety}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, fontFamily: FONT, fontSize: 12, fontWeight: 600,
            color: COLORS.text3, background: 'transparent',
            border: `1px solid ${COLORS.border}`,
            padding: 12, borderRadius: 6, cursor: 'pointer',
          }}>
            CANCEL
          </button>
          <button onClick={handleConfirm} style={{
            flex: 2, fontFamily: FONT, fontSize: 13, fontWeight: 700,
            color: COLORS.amber, background: COLORS.amberDim,
            border: `2px solid ${COLORS.amber}`,
            padding: 12, borderRadius: 6, cursor: 'pointer',
            letterSpacing: '0.06em',
          }}>
            SWITCH RECEIPT
          </button>
        </div>
      </div>
    </div>
  )
}
