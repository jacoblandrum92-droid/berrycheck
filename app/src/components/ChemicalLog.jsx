import React, { useState } from 'react'
import { COLORS, FONT } from '../constants'

/**
 * ChemicalLog — renders chemical inventory data as a formatted MBG E-1.2b form.
 * Matches the paper "Chemical Inventory Log — Field" layout.
 */

const CHEM_STORAGE_KEY = 'bc_chemical_inventory'

function loadInventory() {
  try { return JSON.parse(localStorage.getItem(CHEM_STORAGE_KEY) || 'null') } catch { return null }
}

function getBalance(data, chemicalId, upToDate) {
  return data.transactions
    .filter(t => t.chemicalId === chemicalId && t.date <= upToDate)
    .reduce((sum, t) => t.type === 'add' ? sum + t.amount : sum - t.amount, 0)
}

function getLastPurchase(data, chemicalId, upToDate) {
  const purchases = data.transactions
    .filter(t => t.chemicalId === chemicalId && t.type === 'add' && t.date <= upToDate)
    .sort((a, b) => b.date.localeCompare(a.date))
  return purchases[0] || null
}

export default function ChemicalLog({ date, location, onClose }) {
  const inv = loadInventory()
  const [logDate, setLogDate] = useState(date || new Date().toISOString().slice(0, 10))
  const [logLocation, setLogLocation] = useState(location || '')
  const [sdsStatus, setSdsStatus] = useState(() => {
    // Load per-chemical SDS status
    try { return JSON.parse(localStorage.getItem('bc_chemical_sds') || '{}') } catch { return {} }
  })
  const [notes, setNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bc_chemical_notes') || '{}') } catch { return {} }
  })

  const saveSds = (chemId, val) => {
    const next = { ...sdsStatus, [chemId]: val }
    setSdsStatus(next)
    localStorage.setItem('bc_chemical_sds', JSON.stringify(next))
    fetch('/api/store/bc_chemical_sds', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    }).catch(() => {})
  }

  const saveNote = (chemId, val) => {
    const next = { ...notes, [chemId]: val }
    setNotes(next)
    localStorage.setItem('bc_chemical_notes', JSON.stringify(next))
    fetch('/api/store/bc_chemical_notes', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    }).catch(() => {})
  }

  if (!inv || !inv.chemicals || inv.chemicals.length === 0) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }} onClick={onClose}>
        <div style={{
          background: '#fff', borderRadius: 8, padding: 30, maxWidth: 400, textAlign: 'center',
        }} onClick={e => e.stopPropagation()}>
          <div style={{ fontFamily: FONT, fontSize: 13, color: COLORS.text, marginBottom: 12 }}>
            No chemicals in inventory yet.
          </div>
          <div style={{ fontFamily: FONT, fontSize: 10, color: COLORS.text3, marginBottom: 16 }}>
            Add chemicals via Ops → CHEMICALS, or scan a paper log with FCHEM → SCAN → PARSE INTO INVENTORY.
          </div>
          <button onClick={onClose} style={{
            fontFamily: FONT, fontSize: 10, color: COLORS.text3,
            background: 'transparent', border: `1px solid ${COLORS.border}`,
            padding: '6px 16px', borderRadius: 4, cursor: 'pointer',
          }}>CLOSE</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 4, width: '95%', maxWidth: 1000,
        maxHeight: '90vh', overflow: 'auto', boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
      }} onClick={e => e.stopPropagation()}>

        {/* === FORM HEADER === */}
        <div style={{ padding: '20px 30px 10px', borderBottom: '2px solid #333' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontFamily: 'serif', fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>
                Chemical Inventory Log — Field
              </div>
              <div style={{ fontFamily: 'serif', fontSize: 9, color: '#555', lineHeight: 1.4, maxWidth: 500, marginTop: 4 }}>
                (Includes, but is not limited to, pesticides and similar [i.e., herbicides, fungicides, fertilizers, etc.],
                rodent baits and similar, sanitation chemicals, hygiene chemicals, facility specific chemicals, etc.)
              </div>
              <div style={{ fontFamily: 'serif', fontSize: 9, color: '#333', fontWeight: 600, marginTop: 4 }}>
                Instructions: Complete this form pre-season and monthly during season.
              </div>
            </div>
            <button onClick={onClose} style={{
              fontFamily: FONT, fontSize: 9, color: COLORS.text3,
              background: '#f5f5f5', border: `1px solid #ddd`,
              padding: '4px 12px', borderRadius: 3, cursor: 'pointer',
            }} className="no-print">CLOSE</button>
          </div>

          {/* Date & Location */}
          <div style={{ display: 'flex', gap: 30, marginTop: 12, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: 'serif', fontSize: 11, fontWeight: 700 }}>Date:</span>
              <input type="date" value={logDate} onChange={e => setLogDate(e.target.value)}
                style={{ fontFamily: 'serif', fontSize: 11, border: 'none', borderBottom: '1px solid #999', padding: '2px 4px', background: 'transparent' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
              <span style={{ fontFamily: 'serif', fontSize: 11, fontWeight: 700 }}>Location:</span>
              <input type="text" value={logLocation} onChange={e => setLogLocation(e.target.value)}
                placeholder="Farm / shed name"
                style={{ fontFamily: 'serif', fontSize: 11, border: 'none', borderBottom: '1px solid #999', padding: '2px 4px', background: 'transparent', flex: 1 }} />
            </div>
          </div>
        </div>

        {/* === DATA TABLE === */}
        <div style={{ padding: '0 30px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 0 }}>
            <thead>
              <tr style={{ background: '#f0f0ec' }}>
                <th style={formTh}>Product Name</th>
                <th style={formTh}>Container Volume</th>
                <th style={formTh}>Quantity on Hand</th>
                <th style={formTh}>Purchased Quantity/Date</th>
                <th style={formTh}>Notes/Comments</th>
                <th style={{ ...formTh, width: 80 }}>SDS and Label on File?</th>
              </tr>
            </thead>
            <tbody>
              {inv.chemicals.map(chem => {
                const qty = getBalance(inv, chem.id, logDate)
                const lastPurchase = getLastPurchase(inv, chem.id, logDate)
                return (
                  <tr key={chem.id} style={{ borderBottom: '1px solid #ccc' }}>
                    <td style={formTd}>
                      <div style={{ fontWeight: 600 }}>{chem.name}</div>
                      {chem.epaNumber && (
                        <div style={{ fontSize: 8, color: '#888' }}>EPA: {chem.epaNumber}</div>
                      )}
                      {chem.activeIngredient && (
                        <div style={{ fontSize: 8, color: '#888' }}>AI: {chem.activeIngredient}</div>
                      )}
                    </td>
                    <td style={{ ...formTd, textAlign: 'center' }}>
                      {chem.unit}
                    </td>
                    <td style={{
                      ...formTd, textAlign: 'center', fontWeight: 700,
                      color: qty <= 0 ? '#a00' : '#1a1a1a',
                    }}>
                      {qty.toFixed(1)} {chem.unit}
                    </td>
                    <td style={formTd}>
                      {lastPurchase ? (
                        <span>{lastPurchase.amount} {chem.unit} — {lastPurchase.date}</span>
                      ) : (
                        <span style={{ color: '#999' }}>—</span>
                      )}
                    </td>
                    <td style={formTd}>
                      <input type="text" value={notes[chem.id] || ''}
                        onChange={e => saveNote(chem.id, e.target.value)}
                        placeholder="—"
                        style={{
                          fontFamily: 'serif', fontSize: 10, width: '100%',
                          border: 'none', background: 'transparent', padding: '2px 0',
                        }} />
                    </td>
                    <td style={{ ...formTd, textAlign: 'center' }}>
                      <select value={sdsStatus[chem.id] || ''} onChange={e => saveSds(chem.id, e.target.value)}
                        style={{
                          fontFamily: 'serif', fontSize: 10, border: '1px solid #ddd',
                          borderRadius: 2, padding: '1px 4px', background: '#fff',
                        }}>
                        <option value="">—</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </td>
                  </tr>
                )
              })}
              {/* Empty rows to match paper form */}
              {Array.from({ length: Math.max(0, 12 - inv.chemicals.length) }, (_, i) => (
                <tr key={`empty-${i}`} style={{ borderBottom: '1px solid #ccc' }}>
                  <td style={formTd}>&nbsp;</td>
                  <td style={formTd}></td>
                  <td style={formTd}></td>
                  <td style={formTd}></td>
                  <td style={formTd}></td>
                  <td style={formTd}></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* === FORM FOOTER === */}
        <div style={{
          padding: '10px 30px 16px', marginTop: 10,
          borderTop: '1px solid #ccc',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ fontFamily: 'serif', fontSize: 8, color: '#888' }}>
            <div>For use by Owner/Manager or Risk Assessment Coordinator Only</div>
            <div style={{ marginTop: 2 }}>
              <b>Form No./Name:</b> E-1.2b Chemical Inventory Log - Field &nbsp;&nbsp;
              <b>Revision No./Name:</b> 1
            </div>
          </div>
          <div style={{ fontFamily: 'serif', fontSize: 8, color: '#888', textAlign: 'right' }}>
            <div><b>Created By/Date:</b> MBG Marketing — 03/20/2014</div>
            <div><b>Last Revision By/Date:</b> MBG Marketing — 10/23/2018</div>
          </div>
        </div>

        {/* Print button */}
        <div style={{ padding: '0 30px 16px', textAlign: 'center' }} className="no-print">
          <button onClick={() => window.print()} style={{
            fontFamily: FONT, fontSize: 11, fontWeight: 600,
            color: COLORS.green, background: COLORS.greenDim,
            border: `1px solid ${COLORS.green}`,
            padding: '8px 24px', borderRadius: 4, cursor: 'pointer',
          }}>PRINT LOG</button>
        </div>
      </div>
    </div>
  )
}

const formTh = {
  fontFamily: 'serif', fontSize: 10, fontWeight: 700, color: '#333',
  textAlign: 'left', padding: '8px 10px',
  borderBottom: '2px solid #666', borderRight: '1px solid #ccc',
}

const formTd = {
  fontFamily: 'serif', fontSize: 10, color: '#333',
  padding: '6px 10px', borderRight: '1px solid #eee',
  verticalAlign: 'top',
}
