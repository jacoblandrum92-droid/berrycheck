import React, { useState, useEffect } from 'react'
import { COLORS, FONT } from '../constants'
import { loadReceipts } from '../receipts'

const DEFAULT_VARIETIES = ['Emerald', 'Farthing', 'Key Crisp', 'Meadowlark', 'Patricia', 'Star']

function loadVarieties() {
  try {
    const saved = JSON.parse(localStorage.getItem('bc_varieties') || '[]')
    // Merge defaults with any custom ones, dedupe, sort
    const merged = [...new Set([...DEFAULT_VARIETIES, ...saved])]
    merged.sort((a, b) => a.localeCompare(b))
    return merged
  } catch { return [...DEFAULT_VARIETIES] }
}

function saveCustomVariety(name) {
  try {
    const custom = JSON.parse(localStorage.getItem('bc_varieties') || '[]')
    if (!custom.includes(name) && !DEFAULT_VARIETIES.includes(name)) {
      custom.push(name)
      localStorage.setItem('bc_varieties', JSON.stringify(custom))
    }
  } catch {}
}

function VarietySelect({ value, onChange }) {
  const [varieties, setVarieties] = useState(loadVarieties)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')

  const handleChange = (e) => {
    if (e.target.value === '__other__') {
      setAdding(true)
    } else {
      onChange(e.target.value)
    }
  }

  const addVariety = () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    saveCustomVariety(trimmed)
    setVarieties(loadVarieties())
    onChange(trimmed)
    setAdding(false)
    setNewName('')
  }

  if (adding) {
    return (
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          style={{ ...inputStyle, flex: 1, fontSize: 11 }}
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="New variety"
          autoFocus
          onKeyDown={e => e.key === 'Enter' && addVariety()}
        />
        <button onClick={addVariety} style={{
          fontFamily: FONT, fontSize: 9, color: COLORS.green,
          background: COLORS.greenDim, border: `1px solid ${COLORS.green}`,
          padding: '4px 8px', borderRadius: 3, cursor: 'pointer',
        }}>ADD</button>
        <button onClick={() => setAdding(false)} style={{
          fontFamily: FONT, fontSize: 9, color: COLORS.text3,
          background: 'transparent', border: `1px solid ${COLORS.border}`,
          padding: '4px 6px', borderRadius: 3, cursor: 'pointer',
        }}>X</button>
      </div>
    )
  }

  return (
    <select style={inputStyle} value={value} onChange={handleChange}>
      <option value="">Select</option>
      {varieties.map(v => <option key={v}>{v}</option>)}
      <option value="__other__">+ Add New</option>
    </select>
  )
}

const labelStyle = {
  fontFamily: FONT, fontSize: 10, color: COLORS.text3,
  letterSpacing: '0.08em', textTransform: 'uppercase',
  display: 'block', marginBottom: 4,
}

const inputStyle = {
  width: '100%', background: COLORS.bg3,
  border: `1px solid ${COLORS.border2}`,
  color: COLORS.text, fontFamily: FONT, fontSize: 13,
  padding: '7px 10px', borderRadius: 3, outline: 'none',
  boxSizing: 'border-box',
}

// Clamshell profiles — user-managed list with name + tare weight
function loadClamshells() {
  try {
    return JSON.parse(localStorage.getItem('bc_clamshells') || '[]')
  } catch { return [] }
}

function saveClamshells(list) {
  localStorage.setItem('bc_clamshells', JSON.stringify(list))
}

export default function LotPanel({
  lotId, setLotId, receiptNum, setReceiptNum,
  grower, setGrower, variety, setVariety,
  sampleWeight, setSampleWeight, packType, setPackType,
  onReceiptSelect,
}) {
  const [activeReceipts, setActiveReceipts] = useState([])

  // Refresh active receipts list when component mounts and periodically
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
    if (!selectedId) {
      setReceiptNum('')
      return
    }
    const receipt = activeReceipts.find(r => r.id === selectedId)
    if (receipt) {
      setReceiptNum(receipt.receiptNum)
      // Auto-fill grower and variety from receipt if they have values
      if (receipt.grower) setGrower(receipt.grower)
      if (receipt.variety) setVariety(receipt.variety)
      if (onReceiptSelect) onReceiptSelect(receipt)
    }
  }

  // Clamshell profiles
  const [clamshells, setClamshells] = useState(loadClamshells)
  const [selectedClam, setSelectedClam] = useState('')
  const [tareEnabled, setTareEnabled] = useState(true)
  const [grossWeight, setGrossWeight] = useState('')
  const [addingClam, setAddingClam] = useState(false)
  const [newClamName, setNewClamName] = useState('')
  const [newClamTare, setNewClamTare] = useState('')

  const currentClam = clamshells.find(c => c.name === selectedClam)
  const currentTare = currentClam ? currentClam.tare : 0
  const effectiveTare = tareEnabled ? currentTare : 0

  const handleGrossChange = (val) => {
    const gross = parseFloat(val) || 0
    setGrossWeight(val)
    const net = Math.max(0, gross - effectiveTare)
    setSampleWeight(Math.round(net * 10) / 10)
  }

  const handleClamSelect = (name) => {
    setSelectedClam(name)
    const clam = clamshells.find(c => c.name === name)
    const tare = (clam && tareEnabled) ? clam.tare : 0
    if (grossWeight) {
      const net = Math.max(0, (parseFloat(grossWeight) || 0) - tare)
      setSampleWeight(Math.round(net * 10) / 10)
    }
  }

  const handleToggleTare = () => {
    const next = !tareEnabled
    setTareEnabled(next)
    if (grossWeight) {
      const tare = next ? currentTare : 0
      const net = Math.max(0, (parseFloat(grossWeight) || 0) - tare)
      setSampleWeight(Math.round(net * 10) / 10)
    }
  }

  const addClamshell = () => {
    const name = newClamName.trim()
    const tare = parseFloat(newClamTare) || 0
    if (!name) return
    if (clamshells.some(c => c.name === name)) return alert('Profile already exists')
    const updated = [...clamshells, { name, tare }]
    setClamshells(updated)
    saveClamshells(updated)
    setSelectedClam(name)
    setAddingClam(false)
    setNewClamName('')
    setNewClamTare('')
    if (grossWeight && tareEnabled) {
      const net = Math.max(0, (parseFloat(grossWeight) || 0) - tare)
      setSampleWeight(Math.round(net * 10) / 10)
    }
  }

  const deleteClam = (name) => {
    const updated = clamshells.filter(c => c.name !== name)
    setClamshells(updated)
    saveClamshells(updated)
    if (selectedClam === name) setSelectedClam('')
  }

  return (
    <div>
      <div style={{
        fontFamily: FONT, fontSize: 10, fontWeight: 600,
        letterSpacing: '0.12em', textTransform: 'uppercase',
        color: COLORS.text3, marginBottom: 8,
      }}>Pallet Information</div>

      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>Grower Receipt</label>
        <select
          style={inputStyle}
          value={activeReceipts.find(r => r.receiptNum === receiptNum)?.id || ''}
          onChange={handleReceiptChange}
        >
          <option value="">Select receipt...</option>
          {activeReceipts.map(r => (
            <option key={r.id} value={r.id}>
              {r.receiptNum} — {r.grower}{r.variety ? ` / ${r.variety}` : ''}{r.block ? ` / ${r.block}` : ''}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>Pallet Tag</label>
        <input style={inputStyle} value={lotId} onChange={e => setLotId(e.target.value)} placeholder="e.g. P-0042" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div>
          <label style={labelStyle}>Grower</label>
          <input style={inputStyle} value={grower} onChange={e => setGrower(e.target.value)} placeholder="Name" />
        </div>
        <div>
          <label style={labelStyle}>Variety</label>
          <VarietySelect value={variety} onChange={setVariety} />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Pack Type</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { key: 'pint', label: 'Pint' },
            { key: 'jumbo', label: 'Jumbo' },
          ].map(p => (
            <button key={p.key} onClick={() => setPackType(p.key)} style={{
              flex: 1, fontFamily: FONT, fontSize: 10, fontWeight: 600,
              color: packType === p.key ? COLORS.green : COLORS.text3,
              background: packType === p.key ? COLORS.greenDim + '40' : 'transparent',
              border: `1px solid ${packType === p.key ? COLORS.greenDim : COLORS.border}`,
              padding: '6px 8px', borderRadius: 3, cursor: 'pointer',
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Clamshell + Weight section */}
      <div style={{
        background: COLORS.bg3, border: `1px solid ${COLORS.border}`,
        borderRadius: 4, padding: 10, marginBottom: 10,
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 6,
        }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>Clamshell</label>
          <button onClick={() => setAddingClam(true)} style={{
            fontFamily: FONT, fontSize: 9, color: COLORS.green,
            background: 'transparent', border: `1px solid ${COLORS.green}`,
            padding: '2px 8px', borderRadius: 2, cursor: 'pointer',
          }}>+ ADD</button>
        </div>

        {/* Add new clamshell form */}
        {addingClam && (
          <div style={{
            display: 'flex', gap: 4, marginBottom: 8,
          }}>
            <input
              style={{ ...inputStyle, flex: 2, fontSize: 11 }}
              value={newClamName}
              onChange={e => setNewClamName(e.target.value)}
              placeholder="Name (e.g. SMI Pint)"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && addClamshell()}
            />
            <input
              style={{ ...inputStyle, flex: 1, fontSize: 11 }}
              type="number" step="0.1" min="0"
              value={newClamTare}
              onChange={e => setNewClamTare(e.target.value)}
              placeholder="Tare (g)"
              onKeyDown={e => e.key === 'Enter' && addClamshell()}
            />
            <button onClick={addClamshell} style={{
              fontFamily: FONT, fontSize: 9, color: COLORS.green,
              background: COLORS.greenDim, border: `1px solid ${COLORS.green}`,
              padding: '4px 8px', borderRadius: 3, cursor: 'pointer',
            }}>SAVE</button>
            <button onClick={() => { setAddingClam(false); setNewClamName(''); setNewClamTare('') }} style={{
              fontFamily: FONT, fontSize: 9, color: COLORS.text3,
              background: 'transparent', border: `1px solid ${COLORS.border}`,
              padding: '4px 6px', borderRadius: 3, cursor: 'pointer',
            }}>X</button>
          </div>
        )}

        {/* Clamshell dropdown */}
        <select style={{ ...inputStyle, marginBottom: 8 }} value={selectedClam}
          onChange={e => handleClamSelect(e.target.value)}>
          <option value="">Select clamshell...</option>
          {clamshells.map(c => (
            <option key={c.name} value={c.name}>
              {c.name} ({c.tare}g)
            </option>
          ))}
        </select>

        {/* Tare display with toggle */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 8,
        }}>
          <div style={{
            fontFamily: FONT, fontSize: 11,
            color: tareEnabled ? COLORS.text : COLORS.text3,
            opacity: tareEnabled ? 1 : 0.5,
          }}>
            Tare: {currentTare ? `${currentTare}g` : 'none'}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={handleToggleTare} style={{
              fontFamily: FONT, fontSize: 9,
              color: tareEnabled ? COLORS.green : COLORS.text3,
              background: tareEnabled ? COLORS.greenDim : 'transparent',
              border: `1px solid ${tareEnabled ? COLORS.green : COLORS.border}`,
              padding: '2px 8px', borderRadius: 2, cursor: 'pointer',
            }}>
              TARE {tareEnabled ? 'ON' : 'OFF'}
            </button>
            {selectedClam && (
              <button onClick={() => deleteClam(selectedClam)} style={{
                fontFamily: FONT, fontSize: 9, color: COLORS.red,
                background: 'transparent', border: `1px solid ${COLORS.redDim}`,
                padding: '2px 6px', borderRadius: 2, cursor: 'pointer',
              }}>DEL</button>
            )}
          </div>
        </div>

        {/* Gross weight input */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label style={labelStyle}>Gross Wt (g)</label>
            <input
              style={inputStyle} type="number" step="0.1" min="0"
              value={grossWeight}
              onChange={e => handleGrossChange(e.target.value)}
              placeholder="Scale reading"
            />
          </div>
          <div>
            <label style={labelStyle}>Net Wt (g)</label>
            <div style={{
              ...inputStyle, display: 'flex', alignItems: 'center',
              color: sampleWeight > 0 ? COLORS.green : COLORS.text3,
              fontWeight: 600,
              background: COLORS.bg2,
            }}>
              {sampleWeight > 0 ? `${sampleWeight}g` : '—'}
            </div>
          </div>
        </div>
      </div>

      <div style={{
        padding: '6px 10px',
        background: COLORS.bg3, border: `1px solid ${COLORS.border}`,
        borderRadius: 3, fontFamily: FONT, fontSize: 10,
        color: COLORS.text3, letterSpacing: '0.06em',
      }}>
        STANDARD: MBG — 1 PINT SAMPLE
      </div>
    </div>
  )
}
