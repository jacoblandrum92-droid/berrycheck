import React, { useState, useEffect } from 'react'
import { COLORS, FONT } from '../constants'
import {
  loadReceipts, createReceipt, updateReceipt, deleteReceipt,
  getReceiptStats, getActiveReceiptsWithStats,
} from '../receipts'

export default function ReceiptManager({ onClose, onPrint }) {
  const [receipts, setReceipts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({
    receiptNum: '', grower: '', variety: '', block: '',
    expectedPallets: '', expectedLbs: '',
  })

  const refresh = () => setReceipts(getActiveReceiptsWithStats())
  useEffect(() => { refresh() }, [])

  const resetForm = () => {
    setForm({ receiptNum: '', grower: '', variety: '', block: '', expectedPallets: '', expectedLbs: '' })
    setEditId(null)
    setShowForm(false)
  }

  const handleSave = () => {
    if (!form.receiptNum.trim() && !form.grower.trim()) return alert('Receipt number or grower is required')
    if (!form.expectedPallets || Number(form.expectedPallets) < 1) return alert('Expected pallets is required')

    if (editId) {
      updateReceipt(editId, {
        receiptNum: form.receiptNum,
        grower: form.grower.trim(),
        variety: form.variety.trim(),
        block: form.block.trim(),
        expectedPallets: Number(form.expectedPallets),
        expectedLbs: Number(form.expectedLbs) || 0,
      })
    } else {
      createReceipt({
        receiptNum: form.receiptNum,
        grower: form.grower.trim(),
        variety: form.variety.trim(),
        block: form.block.trim(),
        expectedPallets: Number(form.expectedPallets),
        expectedLbs: Number(form.expectedLbs) || 0,
      })
    }
    resetForm()
    refresh()
  }

  const handleEdit = (r) => {
    setForm({
      receiptNum: r.receiptNum,
      grower: r.grower,
      variety: r.variety,
      block: r.block,
      expectedPallets: r.expectedPallets.toString(),
      expectedLbs: r.expectedLbs.toString(),
    })
    setEditId(r.id)
    setShowForm(true)
  }

  const handleClose = (id) => {
    if (!confirm('Close this receipt? It will move to the archive.')) return
    updateReceipt(id, { status: 'completed', closedAt: new Date().toISOString() })
    refresh()
  }

  const handleReopen = (id) => {
    updateReceipt(id, { status: 'active', closedAt: null })
    refresh()
  }

  const handleDelete = (id) => {
    if (!confirm('Delete this receipt? This cannot be undone.')) return
    deleteReceipt(id)
    refresh()
  }

  const inputStyle = {
    fontFamily: FONT, fontSize: 13, color: COLORS.text,
    background: COLORS.bg, border: `1px solid ${COLORS.border2}`,
    padding: '8px 10px', borderRadius: 3, width: '100%',
    boxSizing: 'border-box',
  }

  const labelStyle = {
    fontFamily: FONT, fontSize: 9, fontWeight: 600,
    letterSpacing: '0.12em', textTransform: 'uppercase',
    color: COLORS.text3, marginBottom: 4, display: 'block',
  }

  const btnStyle = (color, bg) => ({
    fontFamily: FONT, fontSize: 10, fontWeight: 600,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    color, background: bg || 'transparent',
    border: `1px solid ${color}`,
    padding: '6px 14px', borderRadius: 3, cursor: 'pointer',
  })

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
      paddingTop: 40, overflowY: 'auto',
    }}>
      <div style={{
        background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
        borderRadius: 6, width: '95%', maxWidth: 900,
        maxHeight: '90vh', overflowY: 'auto', padding: 24,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 20,
        }}>
          <div style={{
            fontFamily: FONT, fontSize: 14, fontWeight: 600,
            color: COLORS.green, letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            Receipts — {receipts.length} active
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onPrint} style={btnStyle(COLORS.amber)}>
              Print Barcode Sheet
            </button>
            <button onClick={() => { setShowForm(true); setEditId(null) }} style={btnStyle(COLORS.green)}>
              + New Receipt
            </button>
            <button onClick={onClose} style={btnStyle(COLORS.text3)}>
              Close
            </button>
          </div>
        </div>

        {/* New/Edit form */}
        {showForm && (
          <div style={{
            background: COLORS.bg3, border: `1px solid ${COLORS.border2}`,
            borderRadius: 4, padding: 16, marginBottom: 16,
          }}>
            <div style={{
              fontFamily: FONT, fontSize: 11, fontWeight: 600,
              color: COLORS.text, letterSpacing: '0.08em',
              marginBottom: 12, textTransform: 'uppercase',
            }}>
              {editId ? 'Edit Receipt' : 'New Receipt'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Receipt #</label>
                <input
                  style={inputStyle}
                  value={form.receiptNum}
                  onChange={e => setForm({ ...form, receiptNum: e.target.value })}
                  placeholder="Auto-assigned if blank"
                />
              </div>
              <div>
                <label style={labelStyle}>Grower *</label>
                <input
                  style={inputStyle}
                  value={form.grower}
                  onChange={e => setForm({ ...form, grower: e.target.value })}
                  placeholder="Grower name"
                />
              </div>
              <div>
                <label style={labelStyle}>Variety</label>
                <input
                  style={inputStyle}
                  value={form.variety}
                  onChange={e => setForm({ ...form, variety: e.target.value })}
                  placeholder="e.g. Star"
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Block / Field</label>
                <input
                  style={inputStyle}
                  value={form.block}
                  onChange={e => setForm({ ...form, block: e.target.value })}
                  placeholder="e.g. Block 12"
                />
              </div>
              <div>
                <label style={labelStyle}>Expected Pallets *</label>
                <input
                  type="number" min="1" style={inputStyle}
                  value={form.expectedPallets}
                  onChange={e => setForm({ ...form, expectedPallets: e.target.value })}
                  placeholder="# of pallets"
                />
              </div>
              <div>
                <label style={labelStyle}>Expected Lbs</label>
                <input
                  type="number" min="0" style={inputStyle}
                  value={form.expectedLbs}
                  onChange={e => setForm({ ...form, expectedLbs: e.target.value })}
                  placeholder="Total weight"
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSave} style={btnStyle(COLORS.green, COLORS.greenDim)}>
                {editId ? 'Update' : 'Create'}
              </button>
              <button onClick={resetForm} style={btnStyle(COLORS.text3)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Receipt list */}
        {receipts.length === 0 ? (
          <div style={{
            fontFamily: FONT, fontSize: 12, color: COLORS.text3,
            textAlign: 'center', padding: 40,
          }}>
            No active receipts. Create one to get started.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {receipts.map(r => {
              const stats = r.stats
              const pctColor = stats.pctComplete >= 100 ? COLORS.green
                : stats.pctComplete >= 50 ? COLORS.amber
                : COLORS.text3

              return (
                <div key={r.id} style={{
                  background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                  borderRadius: 4, padding: 14,
                  borderLeft: `3px solid ${stats.pctComplete >= 100 ? COLORS.green : COLORS.border2}`,
                }}>
                  <div style={{
                    display: 'grid', gridTemplateColumns: '100px 1fr 1fr 120px auto',
                    gap: 10, alignItems: 'center', overflow: 'hidden',
                  }}>
                    {/* Receipt # */}
                    <div>
                      <div style={{
                        fontFamily: FONT, fontSize: 14, fontWeight: 700,
                        color: COLORS.green, letterSpacing: '0.06em',
                      }}>
                        {r.receiptNum}
                      </div>
                      <div style={{
                        fontFamily: FONT, fontSize: 9, color: COLORS.text3,
                        marginTop: 2,
                      }}>
                        {new Date(r.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Grower / Variety / Block */}
                    <div>
                      <div style={{
                        fontFamily: FONT, fontSize: 12, color: COLORS.text,
                        fontWeight: 600,
                      }}>
                        {r.grower}
                      </div>
                      <div style={{
                        fontFamily: FONT, fontSize: 10, color: COLORS.text3,
                      }}>
                        {[r.variety, r.block].filter(Boolean).join(' / ') || '—'}
                      </div>
                    </div>

                    {/* Progress */}
                    <div>
                      <div style={{
                        display: 'flex', alignItems: 'baseline', gap: 6,
                      }}>
                        <span style={{
                          fontFamily: FONT, fontSize: 18, fontWeight: 700,
                          color: pctColor,
                        }}>
                          {stats.scanned}
                        </span>
                        <span style={{
                          fontFamily: FONT, fontSize: 11, color: COLORS.text3,
                        }}>
                          / {r.expectedPallets} pallets
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div style={{
                        height: 4, background: COLORS.bg3, borderRadius: 2,
                        marginTop: 4, overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%', borderRadius: 2,
                          background: pctColor,
                          width: `${Math.min(100, stats.pctComplete)}%`,
                          transition: 'width 0.3s',
                        }} />
                      </div>
                    </div>

                    {/* Lbs */}
                    <div style={{ textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                      <div style={{
                        fontFamily: FONT, fontSize: 11, color: COLORS.text,
                      }}>
                        {stats.lbsRemaining.toLocaleString()} lbs
                      </div>
                      {stats.lbsPerHour > 0 && (
                        <div style={{
                          fontFamily: FONT, fontSize: 9, color: COLORS.amber,
                        }}>
                          {stats.lbsPerHour.toLocaleString()} lbs/hr
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button onClick={() => handleEdit(r)} style={{
                        ...btnStyle(COLORS.text3),
                        padding: '4px 8px', fontSize: 9,
                      }}>
                        Edit
                      </button>
                      <button onClick={() => handleClose(r.id)} style={{
                        ...btnStyle(COLORS.amber),
                        padding: '4px 8px', fontSize: 9,
                      }}>
                        Close
                      </button>
                      <button onClick={() => handleDelete(r.id)} style={{
                        ...btnStyle(COLORS.red),
                        padding: '4px 8px', fontSize: 9,
                      }}>
                        Del
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Completed receipts toggle */}
        <CompletedReceipts onReopen={handleReopen} />
      </div>
    </div>
  )
}

function CompletedReceipts({ onReopen }) {
  const [show, setShow] = useState(false)
  const completed = loadReceipts().filter(r => r.status === 'completed')

  if (completed.length === 0) return null

  return (
    <div style={{ marginTop: 16 }}>
      <button onClick={() => setShow(!show)} style={{
        fontFamily: FONT, fontSize: 10, color: COLORS.text3,
        background: 'transparent', border: `1px solid ${COLORS.border}`,
        padding: '6px 12px', borderRadius: 3, cursor: 'pointer',
        letterSpacing: '0.08em', textTransform: 'uppercase',
        width: '100%',
      }}>
        {show ? 'Hide' : 'Show'} Archive — {completed.length} closed receipt{completed.length !== 1 ? 's' : ''}
      </button>
      {show && (
        <div style={{ marginTop: 8 }}>
          {completed.map(r => (
            <div key={r.id} style={{
              fontFamily: FONT, fontSize: 10, color: COLORS.text3,
              padding: '8px 12px',
              background: COLORS.bg,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 3,
              marginBottom: 4,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              opacity: 0.7,
            }}>
              <div>
                <span style={{ color: COLORS.text, fontWeight: 600 }}>{r.receiptNum}</span>
                {' — '}
                {r.grower}
                {r.variety ? ` / ${r.variety}` : ''}
                {' — '}
                {r.scans.length}/{r.expectedPallets} pallets
                {r.closedAt && (
                  <span style={{ marginLeft: 8, fontSize: 9 }}>
                    closed {new Date(r.closedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              <button onClick={() => onReopen(r.id)} style={{
                fontFamily: FONT, fontSize: 9, color: COLORS.amber,
                background: 'transparent', border: `1px solid ${COLORS.amberDim}`,
                padding: '2px 8px', borderRadius: 2, cursor: 'pointer',
                letterSpacing: '0.04em',
              }}>
                REOPEN
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
