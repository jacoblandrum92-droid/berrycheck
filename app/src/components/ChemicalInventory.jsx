import React, { useState, useEffect, useCallback } from 'react'
import { COLORS, FONT } from '../constants'

/**
 * ChemicalInventory — farm chemical shed ledger.
 * Tracks chemicals on hand, spray applications (subtract), deliveries (add).
 * Monthly snapshots auto-generated for FCHEM compliance log.
 */

const STORAGE_KEY = 'bc_chemical_inventory'

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') } catch { return null }
}

function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  fetch('/api/store/' + STORAGE_KEY, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).catch(() => {})
}

function getDefaults() {
  return {
    chemicals: [],        // [{ id, name, unit, epaNumber, activeIngredient }]
    transactions: [],     // [{ id, date, chemicalId, type: 'add'|'spray', amount, notes, field, target }]
    snapshots: {},        // { "2026-01": { chemId: qty, ... }, "2026-02": ... }
  }
}

function todayStr() { return new Date().toISOString().slice(0, 10) }
function monthKey(dateStr) { return dateStr.slice(0, 7) }

function getBalance(data, chemicalId, upToDate) {
  return data.transactions
    .filter(t => t.chemicalId === chemicalId && t.date <= upToDate)
    .reduce((sum, t) => t.type === 'add' ? sum + t.amount : sum - t.amount, 0)
}

function getAllBalances(data, upToDate) {
  const balances = {}
  data.chemicals.forEach(c => {
    balances[c.id] = getBalance(data, c.id, upToDate || todayStr())
  })
  return balances
}

// Generate monthly snapshots from Jan 2026 to current month
function generateSnapshots(data) {
  const start = new Date('2026-01-01')
  const now = new Date()
  const snapshots = {}

  let d = new Date(start)
  while (d <= now) {
    const mk = d.toISOString().slice(0, 7)
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)
    snapshots[mk] = getAllBalances(data, lastDay)
    d.setMonth(d.getMonth() + 1)
  }

  return snapshots
}

export default function ChemicalInventory({ onClose }) {
  const [data, setData] = useState(() => load() || getDefaults())
  const [view, setView] = useState('current')   // 'current' | 'history' | 'add-chemical' | 'add-transaction' | 'snapshot'
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [editingTx, setEditingTx] = useState(null)

  // New chemical form
  const [newChem, setNewChem] = useState({ name: '', unit: 'oz', epaNumber: '', activeIngredient: '' })
  // New transaction form
  const [newTx, setNewTx] = useState({ chemicalId: '', type: 'spray', amount: '', date: todayStr(), notes: '', field: '', target: '' })

  useEffect(() => { save(data) }, [data])

  // Auto-generate snapshots whenever data changes
  useEffect(() => {
    const snapshots = generateSnapshots(data)
    if (JSON.stringify(snapshots) !== JSON.stringify(data.snapshots)) {
      setData(prev => ({ ...prev, snapshots }))
    }
  }, [data.transactions, data.chemicals])

  const addChemical = () => {
    if (!newChem.name.trim()) return
    setData(prev => ({
      ...prev,
      chemicals: [...prev.chemicals, {
        id: Date.now().toString(36),
        name: newChem.name.trim(),
        unit: newChem.unit,
        epaNumber: newChem.epaNumber.trim(),
        activeIngredient: newChem.activeIngredient.trim(),
      }],
    }))
    setNewChem({ name: '', unit: 'oz', epaNumber: '', activeIngredient: '' })
    setView('current')
  }

  const removeChemical = (id) => {
    if (!confirm('Remove this chemical and all its records?')) return
    setData(prev => ({
      ...prev,
      chemicals: prev.chemicals.filter(c => c.id !== id),
      transactions: prev.transactions.filter(t => t.chemicalId !== id),
    }))
  }

  const addTransaction = () => {
    if (!newTx.chemicalId || !newTx.amount) return
    setData(prev => ({
      ...prev,
      transactions: [...prev.transactions, {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 4),
        chemicalId: newTx.chemicalId,
        type: newTx.type,
        amount: parseFloat(newTx.amount),
        date: newTx.date,
        notes: newTx.notes.trim(),
        field: newTx.field.trim(),
        target: newTx.target.trim(),
      }],
    }))
    setNewTx(prev => ({ ...prev, amount: '', notes: '', field: '', target: '' }))
    setView('current')
  }

  const deleteTransaction = (id) => {
    setData(prev => ({
      ...prev,
      transactions: prev.transactions.filter(t => t.id !== id),
    }))
  }

  const balances = getAllBalances(data)

  // Months from Jan 2026 to now
  const months = []
  let d = new Date('2026-01-01')
  const now = new Date()
  while (d <= now) {
    months.push(d.toISOString().slice(0, 7))
    d.setMonth(d.getMonth() + 1)
  }
  months.reverse()

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: COLORS.bg, borderRadius: 8, width: '95%', maxWidth: 900,
        maxHeight: '90vh', overflow: 'auto',
        padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 16,
        }}>
          <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: COLORS.text }}>
            Farm Chemical Inventory
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setView('current')} style={tabBtn(view === 'current')}>CURRENT</button>
            <button onClick={() => setView('history')} style={tabBtn(view === 'history')}>HISTORY</button>
            <button onClick={() => setView('snapshot')} style={tabBtn(view === 'snapshot')}>MONTHLY LOGS</button>
            <button onClick={onClose} style={{
              fontFamily: FONT, fontSize: 9, color: COLORS.text3,
              background: 'transparent', border: `1px solid ${COLORS.border}`,
              padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
            }}>CLOSE</button>
          </div>
        </div>

        {/* === CURRENT INVENTORY === */}
        {view === 'current' && (
          <div>
            {data.chemicals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30 }}>
                <div style={{ fontFamily: FONT, fontSize: 12, color: COLORS.text3, marginBottom: 12 }}>
                  No chemicals added yet
                </div>
                <button onClick={() => setView('add-chemical')} style={primaryBtn}>ADD CHEMICAL</button>
              </div>
            ) : (
              <>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
                  <thead>
                    <tr>
                      <th style={th}>Chemical</th>
                      <th style={th}>EPA #</th>
                      <th style={th}>Active Ingredient</th>
                      <th style={{ ...th, textAlign: 'right' }}>On Hand</th>
                      <th style={{ ...th, textAlign: 'right' }}>Unit</th>
                      <th style={th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.chemicals.map(c => {
                      const qty = balances[c.id] || 0
                      return (
                        <tr key={c.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                          <td style={{ ...td, fontWeight: 600 }}>{c.name}</td>
                          <td style={{ ...td, color: COLORS.text3, fontSize: 9 }}>{c.epaNumber || '—'}</td>
                          <td style={{ ...td, color: COLORS.text3, fontSize: 9 }}>{c.activeIngredient || '—'}</td>
                          <td style={{
                            ...td, textAlign: 'right', fontWeight: 700,
                            color: qty <= 0 ? COLORS.red : qty < 10 ? COLORS.amber : COLORS.green,
                          }}>
                            {qty.toFixed(1)}
                          </td>
                          <td style={{ ...td, textAlign: 'right', color: COLORS.text3 }}>{c.unit}</td>
                          <td style={td}>
                            <button onClick={() => removeChemical(c.id)} style={{
                              fontFamily: FONT, fontSize: 8, color: COLORS.red,
                              background: 'transparent', border: 'none', cursor: 'pointer',
                            }}>DEL</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setView('add-chemical')} style={secondaryBtn}>+ CHEMICAL</button>
                  <button onClick={() => setView('add-transaction')} style={primaryBtn}>LOG SPRAY / DELIVERY</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* === ADD CHEMICAL === */}
        {view === 'add-chemical' && (
          <div>
            <div style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: COLORS.text, marginBottom: 12 }}>
              Add Chemical to Inventory
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 400 }}>
              <input type="text" placeholder="Chemical name *" value={newChem.name}
                onChange={e => setNewChem(p => ({ ...p, name: e.target.value }))} style={input} />
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" placeholder="EPA Registration #" value={newChem.epaNumber}
                  onChange={e => setNewChem(p => ({ ...p, epaNumber: e.target.value }))} style={{ ...input, flex: 1 }} />
                <select value={newChem.unit} onChange={e => setNewChem(p => ({ ...p, unit: e.target.value }))} style={input}>
                  <option value="oz">oz</option>
                  <option value="gal">gal</option>
                  <option value="lb">lb</option>
                  <option value="qt">qt</option>
                  <option value="pt">pt</option>
                  <option value="L">L</option>
                  <option value="kg">kg</option>
                  <option value="units">units</option>
                </select>
              </div>
              <input type="text" placeholder="Active ingredient" value={newChem.activeIngredient}
                onChange={e => setNewChem(p => ({ ...p, activeIngredient: e.target.value }))} style={input} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={addChemical} style={primaryBtn}>ADD</button>
                <button onClick={() => setView('current')} style={secondaryBtn}>CANCEL</button>
              </div>
            </div>
          </div>
        )}

        {/* === ADD TRANSACTION === */}
        {view === 'add-transaction' && (
          <div>
            <div style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: COLORS.text, marginBottom: 12 }}>
              Log Spray Application or Delivery
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 500 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={newTx.type} onChange={e => setNewTx(p => ({ ...p, type: e.target.value }))} style={input}>
                  <option value="spray">SPRAY (subtract)</option>
                  <option value="add">DELIVERY (add)</option>
                </select>
                <input type="date" value={newTx.date}
                  onChange={e => setNewTx(p => ({ ...p, date: e.target.value }))} style={input} />
              </div>
              <select value={newTx.chemicalId}
                onChange={e => setNewTx(p => ({ ...p, chemicalId: e.target.value }))} style={input}>
                <option value="">Select chemical *</option>
                {data.chemicals.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.unit})</option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="number" step="0.1" placeholder="Amount *" value={newTx.amount}
                  onChange={e => setNewTx(p => ({ ...p, amount: e.target.value }))} style={{ ...input, flex: 1 }} />
                <span style={{ fontFamily: FONT, fontSize: 11, color: COLORS.text3, alignSelf: 'center' }}>
                  {data.chemicals.find(c => c.id === newTx.chemicalId)?.unit || 'units'}
                </span>
              </div>
              {newTx.type === 'spray' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="text" placeholder="Field / block" value={newTx.field}
                    onChange={e => setNewTx(p => ({ ...p, field: e.target.value }))} style={{ ...input, flex: 1 }} />
                  <input type="text" placeholder="Target pest / disease" value={newTx.target}
                    onChange={e => setNewTx(p => ({ ...p, target: e.target.value }))} style={{ ...input, flex: 1 }} />
                </div>
              )}
              <input type="text" placeholder="Notes" value={newTx.notes}
                onChange={e => setNewTx(p => ({ ...p, notes: e.target.value }))} style={input} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={addTransaction} style={primaryBtn}>LOG</button>
                <button onClick={() => setView('current')} style={secondaryBtn}>CANCEL</button>
              </div>
            </div>
          </div>
        )}

        {/* === TRANSACTION HISTORY === */}
        {view === 'history' && (
          <div>
            {data.transactions.length === 0 ? (
              <div style={{ fontFamily: FONT, fontSize: 11, color: COLORS.text3, textAlign: 'center', padding: 20 }}>
                No transactions yet
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Date</th>
                    <th style={th}>Type</th>
                    <th style={th}>Chemical</th>
                    <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                    <th style={th}>Field</th>
                    <th style={th}>Target</th>
                    <th style={th}>Notes</th>
                    <th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.transactions].sort((a, b) => b.date.localeCompare(a.date)).map(t => {
                    const chem = data.chemicals.find(c => c.id === t.chemicalId)
                    return (
                      <tr key={t.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                        <td style={td}>{t.date}</td>
                        <td style={td}>
                          <span style={{
                            fontFamily: FONT, fontSize: 8, fontWeight: 600,
                            color: t.type === 'spray' ? COLORS.red : COLORS.green,
                            background: t.type === 'spray' ? COLORS.redDim : COLORS.greenDim,
                            padding: '1px 5px', borderRadius: 2,
                          }}>{t.type === 'spray' ? 'SPRAY' : 'ADD'}</span>
                        </td>
                        <td style={{ ...td, fontWeight: 600 }}>{chem?.name || '?'}</td>
                        <td style={{
                          ...td, textAlign: 'right', fontWeight: 600,
                          color: t.type === 'spray' ? COLORS.red : COLORS.green,
                        }}>
                          {t.type === 'spray' ? '-' : '+'}{t.amount} {chem?.unit}
                        </td>
                        <td style={{ ...td, color: COLORS.text3, fontSize: 9 }}>{t.field || '—'}</td>
                        <td style={{ ...td, color: COLORS.text3, fontSize: 9 }}>{t.target || '—'}</td>
                        <td style={{ ...td, color: COLORS.text3, fontSize: 9 }}>{t.notes || '—'}</td>
                        <td style={td}>
                          <button onClick={() => deleteTransaction(t.id)} style={{
                            fontFamily: FONT, fontSize: 8, color: COLORS.red,
                            background: 'transparent', border: 'none', cursor: 'pointer',
                          }}>DEL</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* === MONTHLY SNAPSHOTS === */}
        {view === 'snapshot' && (
          <div>
            <div style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3, marginBottom: 12 }}>
              Auto-generated monthly inventory snapshots for FCHEM compliance. Click a month to view.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {months.map(m => (
                <button key={m} onClick={() => setSelectedMonth(selectedMonth === m ? null : m)} style={{
                  fontFamily: FONT, fontSize: 10, fontWeight: selectedMonth === m ? 700 : 400,
                  color: selectedMonth === m ? COLORS.green : COLORS.text2,
                  background: selectedMonth === m ? COLORS.greenDim : COLORS.bg2,
                  border: `1px solid ${selectedMonth === m ? COLORS.green : COLORS.border}`,
                  padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
                }}>{m}</button>
              ))}
            </div>
            {selectedMonth && data.snapshots[selectedMonth] && (
              <div>
                <div style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: COLORS.text, marginBottom: 8 }}>
                  Inventory as of end of {selectedMonth}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>Chemical</th>
                      <th style={th}>EPA #</th>
                      <th style={{ ...th, textAlign: 'right' }}>On Hand</th>
                      <th style={{ ...th, textAlign: 'right' }}>Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.chemicals.map(c => {
                      const qty = data.snapshots[selectedMonth][c.id] || 0
                      return (
                        <tr key={c.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                          <td style={{ ...td, fontWeight: 600 }}>{c.name}</td>
                          <td style={{ ...td, color: COLORS.text3, fontSize: 9 }}>{c.epaNumber || '—'}</td>
                          <td style={{
                            ...td, textAlign: 'right', fontWeight: 700,
                            color: qty <= 0 ? COLORS.red : COLORS.text,
                          }}>{qty.toFixed(1)}</td>
                          <td style={{ ...td, textAlign: 'right', color: COLORS.text3 }}>{c.unit}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {/* Transactions for this month */}
                {(() => {
                  const txs = data.transactions
                    .filter(t => monthKey(t.date) === selectedMonth)
                    .sort((a, b) => a.date.localeCompare(b.date))
                  if (txs.length === 0) return (
                    <div style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3, marginTop: 8 }}>
                      No transactions this month
                    </div>
                  )
                  return (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontFamily: FONT, fontSize: 9, fontWeight: 600, color: COLORS.text3, marginBottom: 4 }}>
                        TRANSACTIONS IN {selectedMonth}
                      </div>
                      {txs.map(t => {
                        const chem = data.chemicals.find(c => c.id === t.chemicalId)
                        return (
                          <div key={t.id} style={{
                            display: 'flex', gap: 8, alignItems: 'center',
                            fontFamily: FONT, fontSize: 9, padding: '3px 0',
                            borderBottom: `1px solid ${COLORS.bg3}`,
                          }}>
                            <span style={{ color: COLORS.text3, width: 70 }}>{t.date}</span>
                            <span style={{
                              fontWeight: 600, width: 40,
                              color: t.type === 'spray' ? COLORS.red : COLORS.green,
                            }}>{t.type === 'spray' ? 'SPRAY' : 'ADD'}</span>
                            <span style={{ fontWeight: 600, width: 100 }}>{chem?.name}</span>
                            <span style={{ color: t.type === 'spray' ? COLORS.red : COLORS.green, width: 60, textAlign: 'right' }}>
                              {t.type === 'spray' ? '-' : '+'}{t.amount} {chem?.unit}
                            </span>
                            <span style={{ color: COLORS.text3, flex: 1 }}>
                              {[t.field, t.target, t.notes].filter(Boolean).join(' · ') || ''}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// --- Styles ---
const th = {
  fontFamily: FONT, fontSize: 9, color: COLORS.text3,
  textTransform: 'uppercase', letterSpacing: '0.08em',
  textAlign: 'left', padding: '7px 10px',
  borderBottom: `1px solid ${COLORS.border}`, fontWeight: 500,
}
const td = {
  fontFamily: FONT, fontSize: 10, color: COLORS.text2, padding: '7px 10px',
}
const input = {
  fontFamily: FONT, fontSize: 11, padding: '6px 10px',
  border: `1px solid ${COLORS.border}`, borderRadius: 3,
  background: COLORS.bg2, color: COLORS.text,
}
const primaryBtn = {
  fontFamily: FONT, fontSize: 10, fontWeight: 700,
  color: '#fff', background: COLORS.green,
  border: 'none', padding: '8px 16px', borderRadius: 4, cursor: 'pointer',
}
const secondaryBtn = {
  fontFamily: FONT, fontSize: 10, color: COLORS.text3,
  background: 'transparent', border: `1px solid ${COLORS.border}`,
  padding: '8px 16px', borderRadius: 4, cursor: 'pointer',
}

function tabBtn(active) {
  return {
    fontFamily: FONT, fontSize: 9, fontWeight: 600,
    color: active ? COLORS.green : COLORS.text3,
    background: active ? COLORS.greenDim : 'transparent',
    border: `1px solid ${active ? COLORS.green : COLORS.border}`,
    padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
    letterSpacing: '0.06em',
  }
}
