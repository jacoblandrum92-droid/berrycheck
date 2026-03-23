import React, { useState, useEffect } from 'react'
import { COLORS, FONT } from '../constants'
import { loadPackCodes } from '../packCodes'

const STORAGE_KEY = 'bc_packplan'

function loadPlan() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

function savePlan(plan) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plan))
}

/**
 * Pack Plan — daily target from the office.
 * Shows what to pack, how many pallets of each, and tracks progress.
 * Displayed on QC side so the floor always knows the plan.
 */
export default function PackPlan({ packLog }) {
  const [plan, setPlan] = useState(loadPlan)
  const [editing, setEditing] = useState(false)

  // Refresh from storage (in case another tab edits)
  useEffect(() => {
    const id = setInterval(() => setPlan(loadPlan()), 5000)
    return () => clearInterval(id)
  }, [])

  // Count completed pallets per pack code from today's pack log
  const today = new Date().toLocaleDateString()
  const todayLog = (packLog || []).filter(e => e.date === today && !e.isMissed)
  const completedByCode = {}
  for (const e of todayLog) {
    const code = e.packCode || ''
    completedByCode[code] = (completedByCode[code] || 0) + 1
  }
  // Also count by description match (pack plan might use desc, not code)
  const completedByDesc = {}
  const packCodeDB = loadPackCodes()
  for (const e of todayLog) {
    const match = packCodeDB.find(c => c.code === e.packCode)
    if (match) {
      completedByDesc[match.desc] = (completedByDesc[match.desc] || 0) + 1
    }
  }

  if (plan.length === 0 && !editing) {
    return (
      <button onClick={() => setEditing(true)} style={{
        fontFamily: FONT, fontSize: 10, fontWeight: 600,
        color: COLORS.text3, background: 'transparent',
        border: `1px dashed ${COLORS.border}`,
        padding: '8px 16px', borderRadius: 4, cursor: 'pointer',
        letterSpacing: '0.06em', width: '100%',
      }}>
        + SET TODAY'S PACK PLAN
      </button>
    )
  }

  if (editing) {
    return <PlanEditor plan={plan} onSave={(p) => { savePlan(p); setPlan(p); setEditing(false) }} onCancel={() => setEditing(false)} />
  }

  // Find current target — first incomplete non-balance line, or balance if all orders done
  const currentIdx = (() => {
    const firstIncomplete = plan.findIndex(line => {
      if (line.balance) return false
      const done = getCompleted(line, completedByCode, completedByDesc)
      return done < line.pallets
    })
    if (firstIncomplete !== -1) return firstIncomplete
    // All orders done — balance line is current
    return plan.findIndex(line => line.balance)
  })()

  return (
    <div style={{
      background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
      borderRadius: 4, padding: '10px 14px',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 8,
      }}>
        <div style={{
          fontFamily: FONT, fontSize: 9, fontWeight: 600,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color: COLORS.text3,
        }}>
          Pack Plan
        </div>
        <button onClick={() => setEditing(true)} style={{
          fontFamily: FONT, fontSize: 9, color: COLORS.text3,
          background: 'transparent', border: `1px solid ${COLORS.border}`,
          padding: '2px 8px', borderRadius: 3, cursor: 'pointer',
        }}>EDIT</button>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {plan.map((line, i) => {
          const done = getCompleted(line, completedByCode, completedByDesc)
          const isBalance = line.balance
          const isComplete = !isBalance && done >= line.pallets
          const isCurrent = i === currentIdx

          return (
            <div key={i} style={{
              background: isCurrent ? COLORS.greenDim : isBalance ? COLORS.amberDim + '40' : isComplete ? COLORS.bg3 : COLORS.bg,
              border: `1px solid ${isCurrent ? COLORS.green : isBalance ? COLORS.amber : isComplete ? COLORS.border : COLORS.border}`,
              borderRadius: 4, padding: '6px 10px',
              opacity: isComplete ? 0.5 : 1,
              position: 'relative',
            }}>
              {isCurrent && (
                <div style={{
                  position: 'absolute', top: -1, left: -1, right: -1, height: 2,
                  background: COLORS.green, borderRadius: '4px 4px 0 0',
                }} />
              )}
              <div style={{
                fontFamily: FONT, fontSize: 11, fontWeight: 600,
                color: isCurrent ? COLORS.green : isBalance ? COLORS.amber : isComplete ? COLORS.text3 : COLORS.text,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {line.palletType && (
                  <span style={{
                    fontSize: 8, fontWeight: 800,
                    color: line.palletType === 'chep' ? '#fff' : '#8D6E3F',
                    background: line.palletType === 'chep' ? '#1565C0' : '#D4B896',
                    padding: '1px 4px', borderRadius: 2,
                  }}>
                    {line.palletType === 'chep' ? 'CHEP' : 'BRN'}
                  </span>
                )}
                {line.label || line.packCode}
                {isBalance && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, color: COLORS.amber,
                    marginLeft: 6, letterSpacing: '0.04em',
                  }}>BALANCE</span>
                )}
              </div>
              <div style={{
                fontFamily: FONT, fontSize: 10,
                color: isCurrent ? COLORS.green : COLORS.text3,
              }}>
                {isBalance ? (
                  <><span style={{ fontWeight: 700 }}>{done}</span> pallets — run until clear</>
                ) : (
                  <>
                    <span style={{ fontWeight: 700 }}>{done}</span>/{line.pallets} pallets
                    {line.boxes > 0 && (
                      <span style={{ color: COLORS.text3, marginLeft: 4 }}>({line.boxes} bx)</span>
                    )}
                  </>
                )}
              </div>
              {line.notes && (
                <div style={{
                  fontFamily: FONT, fontSize: 9, color: COLORS.amber,
                  marginTop: 2,
                }}>
                  {line.notes}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary */}
      {(() => {
        const totalPlanned = plan.reduce((s, l) => s + l.pallets, 0)
        const totalDone = plan.reduce((s, l) => s + Math.min(l.pallets, getCompleted(l, completedByCode, completedByDesc)), 0)
        return (
          <div style={{
            fontFamily: FONT, fontSize: 10, color: COLORS.text3,
            marginTop: 6, textAlign: 'right',
          }}>
            {totalDone}/{totalPlanned} planned pallets complete
          </div>
        )
      })()}
    </div>
  )
}

function getCompleted(line, byCode, byDesc) {
  // Match by code first, then by label against desc
  return byCode[line.packCode] || byDesc[line.label] || 0
}

function PlanEditor({ plan, onSave, onCancel }) {
  const [lines, setLines] = useState(
    plan.length > 0 ? plan.map(l => ({ ...l, boxes: l.boxes || '', balance: l.balance || false, palletType: l.palletType || '' })) : [{ packCode: '', label: '', boxes: '', pallets: '', notes: '', balance: false, palletType: '' }]
  )
  const [packCodeDB] = useState(loadPackCodes)

  const update = (i, field, value) => {
    setLines(prev => prev.map((l, idx) => {
      if (idx !== i) return l
      const updated = { ...l, [field]: value }
      // Auto-fill label, pallet type, recalculate pallets from pack code
      if (field === 'packCode' && value) {
        const match = packCodeDB.find(c => c.code === value)
        if (match) {
          updated.label = match.desc
          updated.perPallet = match.perPallet
          updated.palletType = match.palletType || 'brown'
          // Recalc pallets if boxes already entered
          if (updated.boxes && match.perPallet) {
            updated.pallets = Math.ceil(parseInt(updated.boxes) / match.perPallet)
          }
        }
      }
      // Recalc pallets when boxes change
      if (field === 'boxes') {
        const match = packCodeDB.find(c => c.code === updated.packCode)
        const perPallet = match?.perPallet || updated.perPallet
        if (perPallet && value) {
          updated.pallets = Math.ceil(parseInt(value) / perPallet)
        }
      }
      return updated
    }))
  }

  const addLine = () => {
    setLines([...lines, { packCode: '', label: '', boxes: '', pallets: '', notes: '', balance: false, palletType: '' }])
  }

  const removeLine = (i) => {
    if (lines.length <= 1) return
    setLines(lines.filter((_, idx) => idx !== i))
  }

  const handleSave = () => {
    const clean = lines
      .filter(l => l.balance || (l.boxes && parseInt(l.boxes) > 0) || (l.pallets && parseInt(l.pallets) > 0))
      .map(l => {
        const match = packCodeDB.find(c => c.code === l.packCode)
        const perPallet = match?.perPallet || l.perPallet || 0
        const boxes = parseInt(l.boxes) || 0
        const pallets = boxes && perPallet ? Math.ceil(boxes / perPallet) : parseInt(l.pallets) || 0
        return {
          packCode: l.packCode,
          label: l.label || l.packCode,
          boxes: l.balance ? 0 : boxes,
          pallets: l.balance ? 0 : pallets,
          perPallet,
          notes: l.notes || '',
          balance: l.balance || false,
          palletType: l.palletType || 'brown',
        }
      })
    onSave(clean)
  }

  // Total across all lines
  const totalBoxes = lines.reduce((s, l) => s + (parseInt(l.boxes) || 0), 0)
  const totalPallets = lines.reduce((s, l) => {
    const match = packCodeDB.find(c => c.code === l.packCode)
    const perPallet = match?.perPallet || l.perPallet
    const boxes = parseInt(l.boxes) || 0
    return s + (perPallet && boxes ? Math.ceil(boxes / perPallet) : parseInt(l.pallets) || 0)
  }, 0)

  const inputStyle = {
    fontFamily: FONT, fontSize: 12, color: COLORS.text,
    background: COLORS.bg, border: `1px solid ${COLORS.border2}`,
    padding: '6px 8px', borderRadius: 3, outline: 'none',
    boxSizing: 'border-box', width: '100%',
  }

  return (
    <div style={{
      background: COLORS.bg2, border: `2px solid ${COLORS.amber}`,
      borderRadius: 6, padding: 14,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 10,
      }}>
        <div style={{
          fontFamily: FONT, fontSize: 11, fontWeight: 700,
          color: COLORS.amber,
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          Edit Pack Plan
        </div>
        {totalBoxes > 0 && (
          <div style={{
            fontFamily: FONT, fontSize: 12, fontWeight: 700,
            color: COLORS.green,
          }}>
            {totalBoxes.toLocaleString()} boxes = {totalPallets} pallets
          </div>
        )}
      </div>

      {lines.map((line, i) => {
        const match = packCodeDB.find(c => c.code === line.packCode)
        const perPallet = match?.perPallet || line.perPallet
        const boxes = parseInt(line.boxes) || 0
        const calcPallets = perPallet && boxes ? Math.ceil(boxes / perPallet) : null
        const remainder = perPallet && boxes ? boxes % perPallet : null

        return (
          <div key={i} style={{ marginBottom: 8 }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '180px 60px 1fr 80px 80px 1fr 30px',
              gap: 6, alignItems: 'end',
            }}>
              <div>
                {i === 0 && <div style={{ fontFamily: FONT, fontSize: 8, color: COLORS.text3, marginBottom: 2 }}>PACK CODE</div>}
                <select style={inputStyle} value={line.packCode}
                  onChange={e => update(i, 'packCode', e.target.value)}>
                  <option value="">Select...</option>
                  {packCodeDB.map(c => (
                    <option key={c.code} value={c.code}>{c.code} — {c.desc}</option>
                  ))}
                </select>
              </div>
              <div>
                {i === 0 && <div style={{ fontFamily: FONT, fontSize: 8, color: COLORS.text3, marginBottom: 2 }}>PALLET</div>}
                <button onClick={() => update(i, 'palletType', line.palletType === 'chep' ? 'brown' : 'chep')}
                  style={{
                    ...inputStyle, textAlign: 'center', fontWeight: 800, cursor: 'pointer',
                    fontSize: 10, letterSpacing: '0.04em', padding: '6px 4px',
                    color: line.palletType === 'chep' ? '#fff' : '#8D6E3F',
                    background: line.palletType === 'chep' ? '#1565C0' : '#D4B896',
                    border: `1px solid ${line.palletType === 'chep' ? '#1565C0' : '#8D6E3F'}`,
                  }}>
                  {line.palletType === 'chep' ? 'CHEP' : 'BROWN'}
                </button>
              </div>
              <div>
                {i === 0 && <div style={{ fontFamily: FONT, fontSize: 8, color: COLORS.text3, marginBottom: 2 }}>LABEL</div>}
                <input style={inputStyle} value={line.label}
                  onChange={e => update(i, 'label', e.target.value)}
                  placeholder="e.g. 18oz Publix" />
              </div>
              <div>
                {i === 0 && <div style={{ fontFamily: FONT, fontSize: 8, color: COLORS.text3, marginBottom: 2 }}>BOXES</div>}
                {line.balance ? (
                  <div style={{
                    ...inputStyle, textAlign: 'center', fontWeight: 700,
                    background: COLORS.amberDim, color: COLORS.amber,
                  }}>
                    BAL
                  </div>
                ) : (
                  <input type="number" min="0" style={{ ...inputStyle, textAlign: 'center', fontWeight: 700 }}
                    value={line.boxes}
                    onChange={e => update(i, 'boxes', e.target.value)}
                    placeholder="0" />
                )}
              </div>
              <div>
                {i === 0 && <div style={{ fontFamily: FONT, fontSize: 8, color: COLORS.text3, marginBottom: 2 }}>PALLETS</div>}
                <div style={{
                  ...inputStyle, textAlign: 'center', fontWeight: 700,
                  background: COLORS.bg3,
                  color: line.balance ? COLORS.amber : calcPallets ? COLORS.green : COLORS.text3,
                }}>
                  {line.balance ? 'TBD' : (calcPallets ?? (parseInt(line.pallets) || '—'))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'end' }}>
                <div style={{ flex: 1 }}>
                  {i === 0 && <div style={{ fontFamily: FONT, fontSize: 8, color: COLORS.text3, marginBottom: 2 }}>NOTES</div>}
                  <input style={inputStyle} value={line.notes || ''}
                    onChange={e => update(i, 'notes', e.target.value)}
                    placeholder="Switch after 9th, etc." />
                </div>
                <button onClick={() => update(i, 'balance', !line.balance)}
                  title="Balance — run until fruit is gone"
                  style={{
                    fontFamily: FONT, fontSize: 8, fontWeight: 700,
                    color: line.balance ? COLORS.amber : COLORS.text3,
                    background: line.balance ? COLORS.amberDim : 'transparent',
                    border: `1px solid ${line.balance ? COLORS.amber : COLORS.border}`,
                    padding: '5px 6px', borderRadius: 3, cursor: 'pointer',
                    letterSpacing: '0.04em', whiteSpace: 'nowrap',
                  }}>
                  BAL
                </button>
              </div>
              <button onClick={() => removeLine(i)} style={{
                fontFamily: FONT, fontSize: 10, color: COLORS.red,
                background: 'transparent', border: 'none', cursor: 'pointer',
                padding: '6px 0',
              }}>x</button>
            </div>
            {/* Conversion detail */}
            {perPallet && boxes > 0 && (
              <div style={{
                fontFamily: FONT, fontSize: 9, color: COLORS.text3,
                paddingLeft: 186, marginTop: 2,
              }}>
                {perPallet} boxes/pallet
                {remainder > 0 && (
                  <span style={{ color: COLORS.amber }}>
                    {' '}— last pallet short by {perPallet - remainder} boxes
                  </span>
                )}
              </div>
            )}
          </div>
        )
      })}

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button onClick={addLine} style={{
          fontFamily: FONT, fontSize: 10, color: COLORS.amber,
          background: 'transparent', border: `1px dashed ${COLORS.amber}`,
          padding: '6px 14px', borderRadius: 3, cursor: 'pointer',
        }}>+ ADD LINE</button>
        <div style={{ flex: 1 }} />
        <button onClick={onCancel} style={{
          fontFamily: FONT, fontSize: 10, color: COLORS.text3,
          background: 'transparent', border: `1px solid ${COLORS.border}`,
          padding: '6px 14px', borderRadius: 3, cursor: 'pointer',
        }}>CANCEL</button>
        <button onClick={handleSave} style={{
          fontFamily: FONT, fontSize: 11, fontWeight: 700, color: COLORS.green,
          background: COLORS.greenDim, border: `1px solid ${COLORS.green}`,
          padding: '6px 18px', borderRadius: 3, cursor: 'pointer',
        }}>SAVE PLAN</button>
      </div>
    </div>
  )
}
