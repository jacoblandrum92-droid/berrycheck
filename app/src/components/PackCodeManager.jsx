import React, { useState, useEffect } from 'react'
import { COLORS, FONT } from '../constants'
import { loadPackCodes, savePackCodes, addPackCode, deletePackCode } from '../packCodes'

export default function PackCodeManager({ onClose }) {
  const [codes, setCodes] = useState([])
  const [filter, setFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ code: '', desc: '', weight: '', perPallet: '', special: '' })

  const refresh = () => setCodes(loadPackCodes())
  useEffect(() => { refresh() }, [])

  const filtered = filter
    ? codes.filter(c =>
        c.code.toLowerCase().includes(filter.toLowerCase()) ||
        c.desc.toLowerCase().includes(filter.toLowerCase()) ||
        c.special.toLowerCase().includes(filter.toLowerCase())
      )
    : codes

  const handleAdd = () => {
    if (!form.code.trim()) return alert('Pack code is required')
    const success = addPackCode({
      code: form.code.trim(),
      desc: form.desc.trim(),
      weight: parseFloat(form.weight) || 0,
      perPallet: parseInt(form.perPallet) || 0,
      special: form.special.trim(),
    })
    if (!success) return alert('Code already exists')
    setForm({ code: '', desc: '', weight: '', perPallet: '', special: '' })
    setShowForm(false)
    refresh()
  }

  const handleDelete = (code) => {
    if (!confirm(`Delete ${code}?`)) return
    deletePackCode(code)
    refresh()
  }

  const inputStyle = {
    fontFamily: FONT, fontSize: 12, color: COLORS.text,
    background: COLORS.bg, border: `1px solid ${COLORS.border2}`,
    padding: '7px 10px', borderRadius: 3, width: '100%',
    boxSizing: 'border-box', outline: 'none',
  }

  const labelStyle = {
    fontFamily: FONT, fontSize: 9, fontWeight: 600,
    letterSpacing: '0.1em', textTransform: 'uppercase',
    color: COLORS.text3, marginBottom: 3, display: 'block',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
      paddingTop: 40, overflowY: 'auto',
    }}>
      <div style={{
        background: COLORS.bg, border: `1px solid ${COLORS.border}`,
        borderRadius: 8, width: '95%', maxWidth: 900,
        maxHeight: '90vh', overflowY: 'auto', padding: 24,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 16,
        }}>
          <div style={{
            fontFamily: FONT, fontSize: 14, fontWeight: 600,
            color: COLORS.green, letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            Pack Codes — {codes.length} loaded
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              style={{ ...inputStyle, width: 180, fontSize: 11 }}
              placeholder="Search codes..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
            <button onClick={() => setShowForm(true)} style={{
              fontFamily: FONT, fontSize: 10, fontWeight: 600,
              color: COLORS.green, background: 'transparent',
              border: `1px solid ${COLORS.green}`,
              padding: '6px 14px', borderRadius: 3, cursor: 'pointer',
            }}>+ ADD</button>
            <button onClick={onClose} style={{
              fontFamily: FONT, fontSize: 10, color: COLORS.text3,
              background: 'transparent', border: `1px solid ${COLORS.border}`,
              padding: '6px 14px', borderRadius: 3, cursor: 'pointer',
            }}>CLOSE</button>
          </div>
        </div>

        {/* Add form */}
        {showForm && (
          <div style={{
            background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
            borderRadius: 4, padding: 14, marginBottom: 14,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 80px 80px 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={labelStyle}>Code</label>
                <input style={inputStyle} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="NF740" />
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <input style={inputStyle} value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} placeholder="GA 12-1 PT BLUES" />
              </div>
              <div>
                <label style={labelStyle}>Wt (lbs)</label>
                <input type="number" style={inputStyle} value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} placeholder="8.00" />
              </div>
              <div>
                <label style={labelStyle}>Per Pallet</label>
                <input type="number" style={inputStyle} value={form.perPallet} onChange={e => setForm({ ...form, perPallet: e.target.value })} placeholder="144" />
              </div>
              <div>
                <label style={labelStyle}>Special</label>
                <input style={inputStyle} value={form.special} onChange={e => setForm({ ...form, special: e.target.value })} placeholder="PTI, CHEP, etc." />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={handleAdd} style={{
                fontFamily: FONT, fontSize: 10, fontWeight: 600,
                color: COLORS.green, background: COLORS.greenDim,
                border: `1px solid ${COLORS.green}`,
                padding: '5px 14px', borderRadius: 3, cursor: 'pointer',
              }}>SAVE</button>
              <button onClick={() => setShowForm(false)} style={{
                fontFamily: FONT, fontSize: 10, color: COLORS.text3,
                background: 'transparent', border: `1px solid ${COLORS.border}`,
                padding: '5px 14px', borderRadius: 3, cursor: 'pointer',
              }}>CANCEL</button>
            </div>
          </div>
        )}

        {/* Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Code', 'Description', 'Weight', '/Pallet', 'Special', ''].map(h => (
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
            {filtered.map(c => (
              <tr key={c.code} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                <td style={{ ...td, fontWeight: 600, color: COLORS.green }}>{c.code}</td>
                <td style={td}>{c.desc}</td>
                <td style={td}>{c.weight} lbs</td>
                <td style={td}>{c.perPallet}</td>
                <td style={{ ...td, fontSize: 10, color: COLORS.text3 }}>{c.special || '—'}</td>
                <td style={td}>
                  <button onClick={() => handleDelete(c.code)} style={{
                    fontFamily: FONT, fontSize: 8, color: COLORS.red,
                    background: 'transparent', border: `1px solid ${COLORS.redDim}`,
                    padding: '2px 6px', borderRadius: 2, cursor: 'pointer',
                  }}>DEL</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const td = {
  fontFamily: FONT, fontSize: 11, color: COLORS.text2,
  padding: '7px 10px',
}
