import React, { useState } from 'react'
import { COLORS, FONT, gradeSample } from '../constants'

const GRADE_TEXT = {
  excellent: '#0F6E56', ok: '#0F6E56',
  warn: '#BA7517', fail: '#A32D2D', none: '#999',
}

export default function LogManager({ history, onUpdateHistory, onClose }) {
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})
  const [filter, setFilter] = useState('')

  const filtered = filter
    ? history.filter(s => (s.lotId || '').toLowerCase().includes(filter.toLowerCase()) ||
        (s.receiptNum || '').toLowerCase().includes(filter.toLowerCase()))
    : history

  const startEdit = (sample) => {
    setEditingId(sample.id)
    setEditData({ ...sample })
  }

  const saveEdit = () => {
    const updated = history.map(s => s.id === editingId ? { ...s, ...editData } : s)
    onUpdateHistory(updated)
    setEditingId(null)
    setEditData({})
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditData({})
  }

  const deleteSample = (id) => {
    if (!confirm('Delete this sample? This cannot be undone.')) return
    const updated = history.filter(s => s.id !== id)
    onUpdateHistory(updated)
    if (editingId === id) cancelEdit()
  }

  const updateField = (key, val) => {
    setEditData(prev => ({ ...prev, [key]: val }))
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: COLORS.bg, border: `1px solid ${COLORS.border}`,
        borderRadius: 8, width: '95%', maxWidth: 900, maxHeight: '90vh',
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
            Sample Log — {history.length} records
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              style={{
                fontFamily: FONT, fontSize: 11, background: COLORS.bg3,
                border: `1px solid ${COLORS.border2}`, color: COLORS.text,
                padding: '4px 10px', borderRadius: 3, outline: 'none', width: 160,
              }}
              placeholder="Filter by Pallet/Receipt"
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
            <button onClick={onClose} style={{
              fontFamily: FONT, fontSize: 10, color: COLORS.text3,
              background: 'transparent', border: `1px solid ${COLORS.border}`,
              padding: '4px 12px', borderRadius: 3, cursor: 'pointer',
            }}>CLOSE</button>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Date', 'Time', 'Type', 'Pallet', 'Receipt', 'Grower', 'Variety',
                  'Good', 'Perm', 'Cond', 'Decay',
                  'Defect %', 'Grade', ''].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={14} style={{
                    ...tdStyle, textAlign: 'center', padding: 28, color: COLORS.text3,
                  }}>
                    {filter ? 'No matching records' : 'No samples logged yet'}
                  </td>
                </tr>
              ) : (
                [...filtered].reverse().map(s => {
                  const isEditing = editingId === s.id
                  const data = isEditing ? editData : s
                  const result = gradeSample(data)
                  const color = GRADE_TEXT[result.status] || COLORS.text3

                  const typeLabel = s.isSkipped ? 'SKIP' : s.isExtra ? 'EXTRA'
                    : s.sampleNum ? `#${s.sampleNum}` : 'SOP'
                  const typeColor = s.isSkipped ? COLORS.text3
                    : s.isExtra ? COLORS.purple : COLORS.green

                  return (
                    <tr key={s.id} style={{
                      borderBottom: `1px solid ${COLORS.border}`,
                      background: isEditing ? COLORS.bg3 : 'transparent',
                      opacity: s.isSkipped ? 0.4 : s.isExtra ? 0.7 : 1,
                    }}>
                      <td style={tdStyle}>{s.date}</td>
                      <td style={tdStyle}>{s.time}</td>
                      <td style={{ ...tdStyle, color: typeColor, fontWeight: 600 }}>{typeLabel}</td>
                      {isEditing ? (
                        <>
                          <td style={tdStyle}><input style={editInput} value={data.lotId || ''} onChange={e => updateField('lotId', e.target.value)} /></td>
                          <td style={tdStyle}><input style={editInput} value={data.receiptNum || ''} onChange={e => updateField('receiptNum', e.target.value)} /></td>
                          <td style={tdStyle}><input style={editInput} value={data.grower || ''} onChange={e => updateField('grower', e.target.value)} /></td>
                          <td style={tdStyle}><input style={editInput} value={data.variety || ''} onChange={e => updateField('variety', e.target.value)} /></td>
                          {['good', 'permanent', 'condition', 'decay'].map(k => (
                            <td key={k} style={tdStyle}>
                              <input style={{ ...editInput, width: 35 }} type="number" min="0"
                                value={data[k] || ''} onChange={e => updateField(k, parseInt(e.target.value) || 0)} />
                            </td>
                          ))}
                        </>
                      ) : (
                        <>
                          <td style={{ ...tdStyle, color: COLORS.text }}>{s.lotId || '—'}</td>
                          <td style={tdStyle}>{s.receiptNum || '—'}</td>
                          <td style={tdStyle}>{s.grower || '—'}</td>
                          <td style={tdStyle}>{s.variety || '—'}</td>
                          <td style={{ ...tdStyle, color: COLORS.green }}>{s.good || 0}</td>
                          <td style={tdStyle}>{s.permanent || 0}</td>
                          <td style={tdStyle}>{s.condition || 0}</td>
                          <td style={{ ...tdStyle, color: (s.decay || 0) > 0 ? COLORS.red : COLORS.text2 }}>{s.decay || 0}</td>
                        </>
                      )}
                      <td style={{ ...tdStyle, fontWeight: 600, color }}>{result.pctCombined}%</td>
                      <td style={tdStyle}>
                        <span style={{
                          fontFamily: FONT, fontSize: 10, fontWeight: 600,
                          padding: '2px 7px', borderRadius: 2, color,
                        }}>{result.label}</span>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {isEditing ? (
                            <>
                              <button onClick={saveEdit} style={actionBtn(COLORS.green)}>SAVE</button>
                              <button onClick={cancelEdit} style={actionBtn(COLORS.text3)}>X</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEdit(s)} style={actionBtn(COLORS.amber)}>EDIT</button>
                              <button onClick={() => deleteSample(s.id)} style={actionBtn(COLORS.red)}>DEL</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const thStyle = {
  fontFamily: FONT, fontSize: 8, color: COLORS.text3,
  textTransform: 'uppercase', letterSpacing: '0.06em',
  textAlign: 'left', padding: '6px 8px', whiteSpace: 'nowrap',
  borderBottom: `1px solid ${COLORS.border}`, fontWeight: 500,
}

const tdStyle = {
  fontFamily: FONT, fontSize: 10, color: COLORS.text2,
  padding: '6px 8px', whiteSpace: 'nowrap',
}

const editInput = {
  fontFamily: FONT, fontSize: 10, background: COLORS.bg2,
  border: `1px solid ${COLORS.border2}`, color: COLORS.text,
  padding: '3px 5px', borderRadius: 2, outline: 'none', width: 60,
}

function actionBtn(color) {
  return {
    fontFamily: FONT, fontSize: 8, fontWeight: 600, color,
    background: 'transparent', border: `1px solid ${color}40`,
    padding: '2px 6px', borderRadius: 2, cursor: 'pointer',
    letterSpacing: '0.04em',
  }
}
