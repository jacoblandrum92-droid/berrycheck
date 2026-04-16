import React, { useState, useMemo } from 'react'
import { COLORS, FONT } from '../constants'

const TEMPLATE_KEY = 'bc_fert_template'
const CAPTURES_KEY = 'bc_compliance_captures'
const COMPLETION_KEY = 'bc_compliance_done'
const CONFIG_KEY = 'bc_compliance_config'

const EMPTY_FIELD = { name: '', acres: '' }
const EMPTY_PRODUCT = { name: '', rate: '', rateUnit: 'lb/acre', fields: [{ ...EMPTY_FIELD }], method: 'Fertigation' }

const METHODS = ['Fertigation', 'Foliar Spray', 'Granular', 'Soil Drench', 'Side Dress', 'Other']
const RATE_UNITS = ['lb/acre', 'oz/acre', 'gal/acre', 'qt/acre', 'pt/acre', 'fl oz/acre', 'kg/ha', 'L/ha']
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function parseRate(rate) {
  const n = parseFloat(rate)
  return isNaN(n) ? 0 : n
}

function calcTotal(product) {
  const rate = parseRate(product.rate)
  const totalAcres = (product.fields || []).reduce((sum, f) => sum + (parseFloat(f.acres) || 0), 0)
  if (!rate || !totalAcres) return null
  const total = rate * totalAcres
  const unitBase = (product.rateUnit || 'lb/acre').split('/')[0]
  return { total: Math.round(total * 100) / 100, unit: unitBase, acres: Math.round(totalAcres * 100) / 100 }
}

function loadJSON(key) {
  try { return JSON.parse(localStorage.getItem(key)) } catch { return null }
}

function saveJSON(key, data) {
  localStorage.setItem(key, JSON.stringify(data))
  fetch('/api/store/' + key, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).catch(() => {})
}

function dateKey(d) {
  return d.toISOString().slice(0, 10)
}

// Get the active FERT days from config or defaults
function getFertDays() {
  const cfg = loadJSON(CONFIG_KEY) || {}
  return cfg.FERT?.days ?? [1, 3, 5] // Mon, Wed, Fri
}

// Get all FERT-due dates between start and end
function getFertDates(startDate, endDate) {
  const days = getFertDays()
  const dates = []
  const d = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  while (d <= end) {
    if (days.includes(d.getDay())) {
      dates.push(dateKey(d))
    }
    d.setDate(d.getDate() + 1)
  }
  return dates
}

// Generate the text record for a specific date
function generateRecord(tmpl, forDate) {
  const lines = [
    `FERTILIZER APPLICATION RECORD`,
    `Date: ${forDate}`,
    `Applicator: ${tmpl.applicator || '—'}`,
    `Location: ${tmpl.location || '—'}`,
    ``,
    `APPLICATIONS:`,
  ]
  for (const p of tmpl.products) {
    if (!p.name.trim()) continue
    const calc = calcTotal(p)
    lines.push(`  Product: ${p.name}`)
    lines.push(`    Rate: ${p.rate || '—'} ${p.rateUnit || 'lb/acre'}`)
    lines.push(`    Method: ${p.method || 'Fertigation'}`)
    if (p.fields && p.fields.length > 0) {
      lines.push(`    Fields:`)
      for (const f of p.fields) {
        if (!f.name) continue
        lines.push(`      - ${f.name}: ${f.acres || '?'} acres`)
      }
    }
    if (calc) {
      lines.push(`    Total: ${calc.total} ${calc.unit} across ${calc.acres} acres`)
    }
    lines.push(``)
  }
  if (tmpl.notes) {
    lines.push(`Notes: ${tmpl.notes}`)
  }
  lines.push(``, `Signed off: ${new Date().toLocaleString()}`)
  return lines.join('\n')
}

/**
 * FertLog — auto-generate fert records from a saved template.
 * Modes: template editor | today sign-off | backfill review queue
 *
 * onSignOff({ date, transcription, ... }) — saves one entry
 * onBatchSignOff([{ date, transcription, ... }, ...]) �� saves multiple backfill entries
 */
export default function FertLog({ onSignOff, onBatchSignOff, onClose }) {
  const [template, setTemplate] = useState(() => loadJSON(TEMPLATE_KEY))
  const [editing, setEditing] = useState(() => !loadJSON(TEMPLATE_KEY))
  const [mode, setMode] = useState('signoff') // 'signoff' | 'backfill'
  const [draft, setDraft] = useState(() => loadJSON(TEMPLATE_KEY) || {
    applicator: '',
    location: '',
    startDate: '',
    endDate: '',
    products: [{ ...EMPTY_PRODUCT }],
    notes: '',
  })
  const [signed, setSigned] = useState(false)
  const [validationError, setValidationError] = useState(null)
  const [backfillChecked, setBackfillChecked] = useState({}) // { dateKey: true }
  const [backfillSaving, setBackfillSaving] = useState(false)
  const [backfillDone, setBackfillDone] = useState(false)

  const today = new Date().toISOString().slice(0, 10)

  // Compute missing dates for backfill
  const { missingDates, coveredDates } = useMemo(() => {
    if (!template?.startDate) return { missingDates: [], coveredDates: [] }
    const endDate = template.endDate && template.endDate < today ? template.endDate : today
    const allDates = getFertDates(template.startDate, endDate)
    const captures = loadJSON(CAPTURES_KEY) || {}
    const completions = loadJSON(COMPLETION_KEY) || {}

    const missing = []
    const covered = []
    for (const d of allDates) {
      const hasCap = (captures[`${d}_FERT`] || []).length > 0
      const hasDone = !!completions[d]?.FERT
      if (hasCap || hasDone) {
        covered.push(d)
      } else {
        missing.push(d)
      }
    }
    return { missingDates: missing, coveredDates: covered }
  }, [template, today])

  // Template save
  const saveAndUse = () => {
    const valid = draft.products.some(p => p.name.trim())
    if (!valid) {
      setValidationError('Add at least one product with a name.')
      return
    }
    if (!draft.startDate) {
      setValidationError('Set a start date for the active range.')
      return
    }
    setValidationError(null)
    saveJSON(TEMPLATE_KEY, draft)
    setTemplate(draft)
    setEditing(false)
  }

  const addProduct = () => {
    setDraft(prev => ({ ...prev, products: [...prev.products, { ...EMPTY_PRODUCT }] }))
  }
  const removeProduct = (i) => {
    setDraft(prev => ({ ...prev, products: prev.products.filter((_, idx) => idx !== i) }))
  }
  const updateProduct = (i, field, value) => {
    setDraft(prev => ({
      ...prev,
      products: prev.products.map((p, idx) => idx === i ? { ...p, [field]: value } : p),
    }))
  }
  const addField = (pi) => {
    setDraft(prev => ({
      ...prev,
      products: prev.products.map((p, idx) => idx === pi
        ? { ...p, fields: [...(p.fields || []), { ...EMPTY_FIELD }] } : p),
    }))
  }
  const removeField = (pi, fi) => {
    setDraft(prev => ({
      ...prev,
      products: prev.products.map((p, idx) => idx === pi
        ? { ...p, fields: p.fields.filter((_, i) => i !== fi) } : p),
    }))
  }
  const updateField = (pi, fi, key, value) => {
    setDraft(prev => ({
      ...prev,
      products: prev.products.map((p, pidx) => pidx === pi
        ? { ...p, fields: p.fields.map((f, fidx) => fidx === fi ? { ...f, [key]: value } : f) } : p),
    }))
  }

  // Sign off today
  const handleSignOff = () => {
    const record = generateRecord(template, today)
    onSignOff({
      date: today,
      transcription: record,
      capturedAt: new Date().toISOString(),
      logCode: 'FERT',
      autoGenerated: true,
    })
    setSigned(true)
  }

  // Toggle a backfill date
  const toggleBackfill = (d) => {
    setBackfillChecked(prev => ({ ...prev, [d]: !prev[d] }))
  }
  const selectAllBackfill = () => {
    const all = {}
    missingDates.forEach(d => { all[d] = true })
    setBackfillChecked(all)
  }
  const clearAllBackfill = () => setBackfillChecked({})

  // Sign off checked backfill entries
  const handleBackfillSignOff = () => {
    const dates = missingDates.filter(d => backfillChecked[d])
    if (dates.length === 0) return
    setBackfillSaving(true)

    const entries = dates.map(d => ({
      date: d,
      transcription: generateRecord(template, d),
      capturedAt: new Date().toISOString(),
      logCode: 'FERT',
      autoGenerated: true,
      backfilled: true,
    }))

    onBatchSignOff(entries)
    setBackfillSaving(false)
    setBackfillDone(true)
  }

  const checkedCount = missingDates.filter(d => backfillChecked[d]).length

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: COLORS.bg, borderRadius: 8, width: '90%', maxWidth: 650,
        maxHeight: '90vh', overflow: 'auto',
        padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 16,
        }}>
          <div>
            <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: COLORS.text }}>
              {editing ? 'Set Up Fert Template'
                : mode === 'backfill' ? 'Backfill Review'
                : 'Fertilizer Record — Sign Off'}
            </div>
            <div style={{ fontFamily: FONT, fontSize: 11, color: COLORS.text3 }}>
              {editing ? 'Enter your recurring fertilizer program.'
                : mode === 'backfill' ? `${missingDates.length} missing entries to review`
                : `Application for ${today}`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {!editing && template && (
              <button onClick={() => { setDraft({ ...template }); setEditing(true) }} style={headerBtnStyle(COLORS.amber, COLORS.amberDim)}>
                EDIT TEMPLATE
              </button>
            )}
            {!editing && template && mode === 'signoff' && missingDates.length > 0 && (
              <button onClick={() => setMode('backfill')} style={headerBtnStyle(COLORS.purple, COLORS.purple + '15')}>
                BACKFILL ({missingDates.length})
              </button>
            )}
            {!editing && mode === 'backfill' && (
              <button onClick={() => { setMode('signoff'); setBackfillDone(false) }} style={headerBtnStyle(COLORS.text3, 'transparent')}>
                TODAY
              </button>
            )}
            <button onClick={onClose} style={{
              fontFamily: FONT, fontSize: 10, color: COLORS.text3,
              background: 'transparent', border: `1px solid ${COLORS.border}`,
              padding: '4px 12px', borderRadius: 3, cursor: 'pointer',
            }}>CLOSE</button>
          </div>
        </div>

        {/* ======================== TEMPLATE EDITOR ======================== */}
        {editing && (
          <div>
            {/* Applicator + Location */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Applicator</label>
                <input value={draft.applicator} onChange={e => setDraft(p => ({ ...p, applicator: e.target.value }))}
                  placeholder="Name of person applying" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Location</label>
                <input value={draft.location} onChange={e => setDraft(p => ({ ...p, location: e.target.value }))}
                  placeholder="Farm / county" style={inputStyle} />
              </div>
            </div>

            {/* Date Range */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Active Start Date</label>
                <input type="date" value={draft.startDate || ''} onChange={e => setDraft(p => ({ ...p, startDate: e.target.value }))}
                  style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Active End Date (optional)</label>
                <input type="date" value={draft.endDate || ''} onChange={e => setDraft(p => ({ ...p, endDate: e.target.value }))}
                  style={inputStyle} />
                <div style={{ fontFamily: FONT, fontSize: 8, color: COLORS.text3, marginTop: 2 }}>
                  Leave blank for ongoing
                </div>
              </div>
            </div>

            {/* Products */}
            <label style={{ ...labelStyle, marginBottom: 6, display: 'block' }}>
              Products ({draft.products.length})
            </label>
            {draft.products.map((p, i) => (
              <div key={i} style={{
                background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
                borderRadius: 4, padding: '10px 12px', marginBottom: 8,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontFamily: FONT, fontSize: 9, fontWeight: 600, color: COLORS.text3 }}>
                    PRODUCT {i + 1}
                  </span>
                  {draft.products.length > 1 && (
                    <button onClick={() => removeProduct(i)} style={{
                      fontFamily: FONT, fontSize: 8, color: COLORS.red,
                      background: 'transparent', border: `1px solid ${COLORS.redDim}`,
                      padding: '1px 6px', borderRadius: 2, cursor: 'pointer',
                    }}>REMOVE</button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <div style={{ flex: 2 }}>
                    <label style={subLabelStyle}>Product Name</label>
                    <input value={p.name} onChange={e => updateProduct(i, 'name', e.target.value)}
                      placeholder="e.g. 20-20-20, CAN-17" style={inputStyle} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={subLabelStyle}>Rate</label>
                    <input value={p.rate} onChange={e => updateProduct(i, 'rate', e.target.value)}
                      placeholder="e.g. 5" type="number" step="any" style={inputStyle} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={subLabelStyle}>Unit</label>
                    <select value={p.rateUnit || 'lb/acre'} onChange={e => updateProduct(i, 'rateUnit', e.target.value)}
                      style={{ ...inputStyle, padding: '6px 4px' }}>
                      {RATE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={subLabelStyle}>Method</label>
                    <select value={p.method} onChange={e => updateProduct(i, 'method', e.target.value)}
                      style={{ ...inputStyle, padding: '6px 4px' }}>
                      {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>

                {/* Fields with acres */}
                <div style={{ marginLeft: 8, borderLeft: `2px solid ${COLORS.border}`, paddingLeft: 10 }}>
                  <label style={{ ...subLabelStyle, marginBottom: 4 }}>Fields / Blocks</label>
                  {(p.fields || []).map((f, fi) => (
                    <div key={fi} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                      <input value={f.name} onChange={e => updateField(i, fi, 'name', e.target.value)}
                        placeholder="Field name" style={{ ...inputStyle, flex: 2 }} />
                      <input value={f.acres} onChange={e => updateField(i, fi, 'acres', e.target.value)}
                        placeholder="Acres" type="number" step="any" style={{ ...inputStyle, flex: 1 }} />
                      <span style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3, whiteSpace: 'nowrap' }}>ac</span>
                      {(p.fields || []).length > 1 && (
                        <button onClick={() => removeField(i, fi)} style={{
                          fontFamily: FONT, fontSize: 8, color: COLORS.red,
                          background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px',
                        }}>X</button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => addField(i)} style={{
                    fontFamily: FONT, fontSize: 8, color: COLORS.text3,
                    background: 'transparent', border: `1px solid ${COLORS.border}`,
                    padding: '2px 8px', borderRadius: 2, cursor: 'pointer', marginTop: 2,
                  }}>+ ADD FIELD</button>
                  {(() => {
                    const calc = calcTotal(p)
                    if (!calc) return null
                    return (
                      <div style={{ fontFamily: FONT, fontSize: 10, fontWeight: 600, color: COLORS.green, marginTop: 6 }}>
                        Total: {calc.total} {calc.unit} across {calc.acres} acres
                      </div>
                    )
                  })()}
                </div>
              </div>
            ))}
            <button onClick={addProduct} style={{
              fontFamily: FONT, fontSize: 9, color: COLORS.text3,
              background: 'transparent', border: `1px solid ${COLORS.border}`,
              padding: '4px 12px', borderRadius: 3, cursor: 'pointer', marginBottom: 12,
            }}>+ ADD PRODUCT</button>

            {/* Notes */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Notes (optional)</label>
              <input value={draft.notes || ''} onChange={e => setDraft(p => ({ ...p, notes: e.target.value }))}
                placeholder="Any recurring notes" style={inputStyle} />
            </div>

            {validationError && (
              <div style={{
                fontFamily: FONT, fontSize: 10, color: COLORS.red,
                background: COLORS.redDim, padding: '6px 10px', borderRadius: 3, marginBottom: 8,
              }}>{validationError}</div>
            )}

            <button onClick={saveAndUse} style={{
              width: '100%', fontFamily: FONT, fontSize: 13, fontWeight: 700,
              color: '#fff', background: COLORS.green,
              border: 'none', padding: '12px', borderRadius: 4, cursor: 'pointer',
            }}>SAVE TEMPLATE</button>
          </div>
        )}

        {/* ======================== TODAY SIGN-OFF ======================== */}
        {!editing && template && mode === 'signoff' && !signed && (
          <div>
            <RecordPreview template={template} forDate={today} />
            <button onClick={handleSignOff} style={{
              width: '100%', fontFamily: FONT, fontSize: 14, fontWeight: 700,
              color: '#fff', background: COLORS.green,
              border: 'none', padding: '14px', borderRadius: 4, cursor: 'pointer',
            }}>SIGN OFF</button>
            <div style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3, textAlign: 'center', marginTop: 6 }}>
              This confirms the fertilizer application record for {today}
            </div>
          </div>
        )}

        {!editing && signed && mode === 'signoff' && (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: COLORS.green, marginBottom: 12 }}>
              Signed off. FERT log recorded for {today}.
            </div>
            <button onClick={onClose} style={{
              fontFamily: FONT, fontSize: 10, color: COLORS.text3,
              background: 'transparent', border: `1px solid ${COLORS.border}`,
              padding: '6px 16px', borderRadius: 3, cursor: 'pointer',
            }}>CLOSE</button>
          </div>
        )}

        {/* ======================== BACKFILL REVIEW ======================== */}
        {!editing && template && mode === 'backfill' && !backfillDone && (
          <div>
            {/* Stats bar */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 12, padding: '8px 12px',
              background: COLORS.bg2, borderRadius: 4, border: `1px solid ${COLORS.border}`,
            }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div>
                  <span style={reviewLabelStyle}>Date Range</span>
                  <span style={{ fontFamily: FONT, fontSize: 10, color: COLORS.text }}>
                    {template.startDate} — {template.endDate || 'ongoing'}
                  </span>
                </div>
                <div>
                  <span style={reviewLabelStyle}>Covered</span>
                  <span style={{ fontFamily: FONT, fontSize: 10, fontWeight: 600, color: COLORS.green }}>
                    {coveredDates.length}
                  </span>
                </div>
                <div>
                  <span style={reviewLabelStyle}>Missing</span>
                  <span style={{ fontFamily: FONT, fontSize: 10, fontWeight: 600, color: missingDates.length > 0 ? COLORS.red : COLORS.green }}>
                    {missingDates.length}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={selectAllBackfill} style={{
                  fontFamily: FONT, fontSize: 8, color: COLORS.green,
                  background: COLORS.greenDim, border: `1px solid ${COLORS.green}`,
                  padding: '3px 8px', borderRadius: 2, cursor: 'pointer',
                }}>SELECT ALL</button>
                <button onClick={clearAllBackfill} style={{
                  fontFamily: FONT, fontSize: 8, color: COLORS.text3,
                  background: 'transparent', border: `1px solid ${COLORS.border}`,
                  padding: '3px 8px', borderRadius: 2, cursor: 'pointer',
                }}>CLEAR</button>
              </div>
            </div>

            {missingDates.length === 0 ? (
              <div style={{
                fontFamily: FONT, fontSize: 12, color: COLORS.green,
                textAlign: 'center', padding: 24,
              }}>
                All caught up — no missing entries.
              </div>
            ) : (
              <>
                {/* Scrollable date checklist */}
                <div style={{ maxHeight: 400, overflowY: 'auto', marginBottom: 12 }}>
                  {missingDates.map(d => {
                    const dateObj = new Date(d + 'T00:00:00')
                    const dayName = DAY_LABELS[dateObj.getDay()]
                    const checked = !!backfillChecked[d]
                    return (
                      <div key={d}
                        onClick={() => toggleBackfill(d)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 12px', marginBottom: 2,
                          background: checked ? COLORS.greenDim : COLORS.bg2,
                          border: `1px solid ${checked ? COLORS.green : COLORS.border}`,
                          borderRadius: 3, cursor: 'pointer',
                          transition: 'all 0.1s',
                        }}>
                        <div style={{
                          width: 18, height: 18, borderRadius: 3,
                          border: `2px solid ${checked ? COLORS.green : COLORS.border}`,
                          background: checked ? COLORS.green : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          {checked && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>&#10003;</span>}
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: COLORS.text }}>
                            {dayName} {d}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {template.products.filter(p => p.name.trim()).map((p, pi) => {
                            const calc = calcTotal(p)
                            return (
                              <span key={pi} style={{
                                fontFamily: FONT, fontSize: 8,
                                color: COLORS.text2, background: COLORS.bg,
                                border: `1px solid ${COLORS.border}`,
                                padding: '1px 5px', borderRadius: 2,
                              }}>
                                {p.name}{calc ? ` — ${calc.total} ${calc.unit}` : ''}
                              </span>
                            )
                          })}
                        </div>
                        {checked && (
                          <span style={{
                            fontFamily: FONT, fontSize: 8, fontWeight: 600,
                            color: COLORS.green,
                          }}>REVIEWED</span>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Batch sign-off button */}
                <button onClick={handleBackfillSignOff} disabled={checkedCount === 0 || backfillSaving}
                  style={{
                    width: '100%', fontFamily: FONT, fontSize: 13, fontWeight: 700,
                    color: '#fff', background: checkedCount > 0 ? COLORS.green : COLORS.text3,
                    border: 'none', padding: '14px', borderRadius: 4,
                    cursor: checkedCount > 0 ? 'pointer' : 'not-allowed',
                    opacity: backfillSaving ? 0.6 : 1,
                  }}>
                  {backfillSaving ? 'SAVING...' : `SIGN OFF ${checkedCount} ENTRIES`}
                </button>
                <div style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3, textAlign: 'center', marginTop: 6 }}>
                  Each checked entry confirms "a human reviewed this record"
                </div>
              </>
            )}
          </div>
        )}

        {/* Backfill done */}
        {!editing && mode === 'backfill' && backfillDone && (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: COLORS.green, marginBottom: 4 }}>
              {checkedCount} entries backfilled and signed off.
            </div>
            <div style={{ fontFamily: FONT, fontSize: 10, color: COLORS.text3, marginBottom: 12 }}>
              All records stamped with your review.
            </div>
            <button onClick={onClose} style={{
              fontFamily: FONT, fontSize: 10, color: COLORS.text3,
              background: 'transparent', border: `1px solid ${COLORS.border}`,
              padding: '6px 16px', borderRadius: 3, cursor: 'pointer',
            }}>CLOSE</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Record Preview — shared between today sign-off and backfill
// ============================================================

function RecordPreview({ template, forDate }) {
  return (
    <div style={{
      background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
      borderRadius: 6, padding: 16, marginBottom: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontFamily: FONT, fontSize: 10, fontWeight: 600, color: COLORS.text3, letterSpacing: '0.08em' }}>
          AUTO-GENERATED RECORD
        </span>
        <span style={{
          fontFamily: FONT, fontSize: 8, fontWeight: 600,
          color: COLORS.green, background: COLORS.greenDim,
          padding: '2px 8px', borderRadius: 2,
        }}>FROM TEMPLATE</span>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        <div>
          <span style={reviewLabelStyle}>Date</span>
          <span style={reviewValueStyle}>{forDate}</span>
        </div>
        <div>
          <span style={reviewLabelStyle}>Applicator</span>
          <span style={reviewValueStyle}>{template.applicator || '—'}</span>
        </div>
        <div>
          <span style={reviewLabelStyle}>Location</span>
          <span style={reviewValueStyle}>{template.location || '—'}</span>
        </div>
      </div>

      {template.products.filter(p => p.name.trim()).map((p, i) => {
        const calc = calcTotal(p)
        return (
          <div key={i} style={{
            background: COLORS.bg, border: `1px solid ${COLORS.border}`,
            borderRadius: 4, padding: '10px 12px', marginBottom: 8,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: COLORS.text }}>{p.name}</span>
              <span style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3 }}>{p.method}</span>
            </div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 6 }}>
              <div>
                <span style={reviewLabelStyle}>Rate</span>
                <span style={{ fontFamily: FONT, fontSize: 11, color: COLORS.text2 }}>
                  {p.rate || '—'} {p.rateUnit || 'lb/acre'}
                </span>
              </div>
              {calc && (
                <div>
                  <span style={reviewLabelStyle}>Total</span>
                  <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: COLORS.green }}>
                    {calc.total} {calc.unit}
                  </span>
                </div>
              )}
              {calc && (
                <div>
                  <span style={reviewLabelStyle}>Acres</span>
                  <span style={{ fontFamily: FONT, fontSize: 11, color: COLORS.text2 }}>{calc.acres}</span>
                </div>
              )}
            </div>
            {p.fields && p.fields.filter(f => f.name).length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {p.fields.filter(f => f.name).map((f, fi) => (
                  <span key={fi} style={{
                    fontFamily: FONT, fontSize: 9, color: COLORS.text2,
                    background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
                    padding: '2px 6px', borderRadius: 2,
                  }}>
                    {f.name} — {f.acres || '?'} ac
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {template.notes && (
        <div style={{ fontFamily: FONT, fontSize: 10, color: COLORS.text2, marginTop: 8 }}>
          <span style={{ color: COLORS.text3, fontWeight: 600 }}>Notes: </span>{template.notes}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Styles
// ============================================================

function headerBtnStyle(color, bg) {
  return {
    fontFamily: FONT, fontSize: 8, fontWeight: 600, color,
    background: bg, border: `1px solid ${color}`,
    padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
    letterSpacing: '0.06em',
  }
}

const labelStyle = {
  fontFamily: FONT, fontSize: 9, fontWeight: 600,
  color: COLORS.text3, letterSpacing: '0.06em',
  display: 'block', marginBottom: 3,
}
const subLabelStyle = {
  fontFamily: FONT, fontSize: 8, color: COLORS.text3,
  display: 'block', marginBottom: 2,
}
const inputStyle = {
  fontFamily: FONT, fontSize: 11, width: '100%',
  padding: '6px 8px', border: `1px solid ${COLORS.border}`,
  borderRadius: 3, background: COLORS.bg, color: COLORS.text,
  boxSizing: 'border-box',
}
const reviewLabelStyle = {
  fontFamily: FONT, fontSize: 8, fontWeight: 600,
  color: COLORS.text3, letterSpacing: '0.06em',
  display: 'block', marginBottom: 2,
}
const reviewValueStyle = {
  fontFamily: FONT, fontSize: 12, fontWeight: 600,
  color: COLORS.text, display: 'block',
}
