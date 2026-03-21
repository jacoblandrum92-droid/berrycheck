import React, { useState, useEffect } from 'react'
import { COLORS, FONT } from '../constants'

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
}

// Preset tare weights — add new clamshells here
const TARE_PRESETS = [
  { key: 'smi',      label: 'SMI Pint + Label',      tare: null },
  { key: 'highland', label: 'Highland Pint + Label',  tare: null },
  { key: 'custom',   label: 'Custom',                 tare: null },
]

function loadTares() {
  try {
    return JSON.parse(localStorage.getItem('bc_tares') || '{}')
  } catch { return {} }
}

function saveTares(tares) {
  localStorage.setItem('bc_tares', JSON.stringify(tares))
}

export default function LotPanel({
  lotId, setLotId, grower, setGrower, variety, setVariety,
  sampleWeight, setSampleWeight, packType, setPackType
}) {
  const [tareKey, setTareKey] = useState('smi')
  const [grossWeight, setGrossWeight] = useState('')
  const [savedTares, setSavedTares] = useState(loadTares)
  const [editingTare, setEditingTare] = useState(false)
  const [tareInput, setTareInput] = useState('')

  const currentTare = savedTares[tareKey] || 0

  const handleGrossChange = (val) => {
    const gross = parseFloat(val) || 0
    setGrossWeight(val)
    const net = Math.max(0, gross - currentTare)
    setSampleWeight(Math.round(net * 10) / 10)
  }

  const handleTareSelect = (key) => {
    setTareKey(key)
    const tare = savedTares[key] || 0
    if (grossWeight) {
      const net = Math.max(0, (parseFloat(grossWeight) || 0) - tare)
      setSampleWeight(Math.round(net * 10) / 10)
    }
  }

  const saveTareWeight = () => {
    const val = parseFloat(tareInput) || 0
    const updated = { ...savedTares, [tareKey]: val }
    setSavedTares(updated)
    saveTares(updated)
    setEditingTare(false)
    // Recalculate net
    if (grossWeight) {
      const net = Math.max(0, (parseFloat(grossWeight) || 0) - val)
      setSampleWeight(Math.round(net * 10) / 10)
    }
  }

  return (
    <div>
      <div style={{
        fontFamily: FONT, fontSize: 10, fontWeight: 600,
        letterSpacing: '0.12em', textTransform: 'uppercase',
        color: COLORS.text3, marginBottom: 8,
      }}>Lot Information</div>

      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>Lot ID</label>
        <input style={inputStyle} value={lotId} onChange={e => setLotId(e.target.value)} placeholder="e.g. LOT-0042" />
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

      {/* Tare + Weight section */}
      <div style={{
        background: COLORS.bg3, border: `1px solid ${COLORS.border}`,
        borderRadius: 4, padding: 10, marginBottom: 10,
      }}>
        <label style={labelStyle}>Clamshell Tare</label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {TARE_PRESETS.map(p => (
            <button key={p.key} onClick={() => handleTareSelect(p.key)} style={{
              flex: 1, fontFamily: FONT, fontSize: 9, fontWeight: 600,
              color: tareKey === p.key ? COLORS.green : COLORS.text3,
              background: tareKey === p.key ? COLORS.greenDim + '40' : 'transparent',
              border: `1px solid ${tareKey === p.key ? COLORS.greenDim : COLORS.border}`,
              padding: '5px 4px', borderRadius: 3, cursor: 'pointer',
              letterSpacing: '0.04em', textTransform: 'uppercase',
            }}>
              {p.key === 'custom' ? 'Custom' : p.key.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Tare value display + edit */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 8,
        }}>
          {editingTare ? (
            <div style={{ display: 'flex', gap: 6, flex: 1 }}>
              <input
                type="number" step="0.1" min="0"
                value={tareInput}
                onChange={e => setTareInput(e.target.value)}
                placeholder="Tare (g)"
                style={{ ...inputStyle, flex: 1, fontSize: 12 }}
                autoFocus
              />
              <button onClick={saveTareWeight} style={{
                fontFamily: FONT, fontSize: 9, color: COLORS.green,
                background: COLORS.greenDim, border: `1px solid ${COLORS.green}`,
                padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
              }}>SAVE</button>
              <button onClick={() => setEditingTare(false)} style={{
                fontFamily: FONT, fontSize: 9, color: COLORS.text3,
                background: 'transparent', border: `1px solid ${COLORS.border}`,
                padding: '4px 8px', borderRadius: 3, cursor: 'pointer',
              }}>X</button>
            </div>
          ) : (
            <>
              <div style={{
                fontFamily: FONT, fontSize: 11, color: currentTare ? COLORS.text : COLORS.text3,
              }}>
                Tare: {currentTare ? `${currentTare}g` : 'not set'}
              </div>
              <button onClick={() => {
                setTareInput(currentTare || '')
                setEditingTare(true)
              }} style={{
                fontFamily: FONT, fontSize: 9, color: COLORS.amber,
                background: 'transparent', border: `1px solid ${COLORS.amberDim}`,
                padding: '2px 8px', borderRadius: 2, cursor: 'pointer',
                letterSpacing: '0.04em',
              }}>
                {currentTare ? 'EDIT' : 'SET TARE'}
              </button>
            </>
          )}
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
