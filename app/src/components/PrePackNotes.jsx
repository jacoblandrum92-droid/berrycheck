import React, { useState, useEffect } from 'react'
import { COLORS, FONT } from '../constants'
import { loadReceipts } from '../receipts'

const STORAGE_KEY = 'bc_prepack'

function loadPrePack() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

function savePrePack(notes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  fetch('/api/store/' + STORAGE_KEY, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(notes) }).catch(() => {})
}

// Quick observation tags — tap to toggle, faster than typing
const QUICK_TAGS = [
  { key: 'firm', label: 'Firm', color: COLORS.green },
  { key: 'soft', label: 'Soft Fruit', color: COLORS.red },
  { key: 'wet', label: 'Wet/Rain', color: COLORS.amber },
  { key: 'splits', label: 'Splits', color: COLORS.red },
  { key: 'stems', label: 'Stemmy', color: COLORS.amber },
  { key: 'green', label: 'Green/Red', color: COLORS.amber },
  { key: 'clean', label: 'Clean', color: COLORS.green },
  { key: 'decay', label: 'Decay Risk', color: COLORS.red },
  { key: 'large', label: 'Large Berries', color: COLORS.green },
  { key: 'small', label: 'Small Berries', color: COLORS.amber },
  { key: 'mixed', label: 'Mixed Size', color: COLORS.text3 },
  { key: 'bruise', label: 'Bruise Prone', color: COLORS.amber },
]

/**
 * Pre-Pack Notes — quick observations about raw fruit before it runs.
 *
 * This is a "when you can" tool. Some mornings you have time to look at the fruit,
 * some mornings you don't. Everything is optional.
 *
 * Input: receipt selection, quick tags, free-text notes, optional quick counts
 * Output: context banner when that receipt starts running on the QC side
 */
export default function PrePackNotes({ onClose }) {
  const [notes, setNotes] = useState(loadPrePack)
  const [activeReceipts, setActiveReceipts] = useState([])
  const [selectedReceipt, setSelectedReceipt] = useState('')

  useEffect(() => {
    setActiveReceipts(loadReceipts().filter(r => r.status === 'active'))
  }, [])

  // Current note for selected receipt
  const current = notes.find(n => n.receiptNum === selectedReceipt) || null

  const saveNote = (receiptNum, updates) => {
    const existing = notes.find(n => n.receiptNum === receiptNum)
    let updated
    if (existing) {
      updated = notes.map(n => n.receiptNum === receiptNum ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n)
    } else {
      const receipt = activeReceipts.find(r => r.receiptNum === receiptNum)
      updated = [...notes, {
        receiptNum,
        grower: receipt?.grower || '',
        variety: receipt?.variety || '',
        tags: [],
        text: '',
        quickCounts: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...updates,
      }]
    }
    setNotes(updated)
    savePrePack(updated)
  }

  const toggleTag = (tag) => {
    if (!selectedReceipt) return
    const currentTags = current?.tags || []
    const newTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag]
    saveNote(selectedReceipt, { tags: newTags })
  }

  const inputStyle = {
    fontFamily: FONT, fontSize: 12, color: COLORS.text,
    background: COLORS.bg, border: `1px solid ${COLORS.border2}`,
    padding: '8px 10px', borderRadius: 4, outline: 'none',
    boxSizing: 'border-box', width: '100%',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: COLORS.bg, borderRadius: 10,
        width: '90%', maxWidth: 600,
        padding: 24, maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 6,
        }}>
          <div>
            <div style={{ fontFamily: FONT, fontSize: 16, fontWeight: 700, color: COLORS.green }}>
              Pre-Pack Notes
            </div>
            <div style={{ fontFamily: FONT, fontSize: 11, color: COLORS.text3 }}>
              Quick observations about raw fruit — use when you can, skip when you can't
            </div>
          </div>
          <button onClick={onClose} style={{
            fontFamily: FONT, fontSize: 11, color: COLORS.text3,
            background: 'transparent', border: `1px solid ${COLORS.border}`,
            padding: '6px 14px', borderRadius: 4, cursor: 'pointer',
          }}>CLOSE</button>
        </div>

        {/* Receipt selector */}
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontFamily: FONT, fontSize: 9, color: COLORS.text3,
            letterSpacing: '0.08em', marginBottom: 4,
          }}>RECEIPT</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {activeReceipts.map(r => {
              const hasNotes = notes.some(n => n.receiptNum === r.receiptNum)
              const isSelected = selectedReceipt === r.receiptNum
              return (
                <button key={r.id} onClick={() => setSelectedReceipt(r.receiptNum)} style={{
                  fontFamily: FONT, fontSize: 11, fontWeight: isSelected ? 700 : 400,
                  color: isSelected ? COLORS.green : hasNotes ? COLORS.text : COLORS.text3,
                  background: isSelected ? COLORS.greenDim : hasNotes ? COLORS.bg2 : 'transparent',
                  border: `1px solid ${isSelected ? COLORS.green : hasNotes ? COLORS.amber : COLORS.border}`,
                  padding: '6px 12px', borderRadius: 4, cursor: 'pointer',
                }}>
                  {r.receiptNum} — {r.grower}
                  {r.variety ? ` / ${r.variety}` : ''}
                  {hasNotes && <span style={{ color: COLORS.amber, marginLeft: 4 }}>noted</span>}
                </button>
              )
            })}
          </div>
        </div>

        {selectedReceipt ? (
          <>
            {/* Quick tags */}
            <div style={{ marginBottom: 14 }}>
              <div style={{
                fontFamily: FONT, fontSize: 9, color: COLORS.text3,
                letterSpacing: '0.08em', marginBottom: 6,
              }}>OBSERVATIONS — tap what you see</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {QUICK_TAGS.map(tag => {
                  const active = (current?.tags || []).includes(tag.key)
                  return (
                    <button key={tag.key} onClick={() => toggleTag(tag.key)} style={{
                      fontFamily: FONT, fontSize: 11, fontWeight: active ? 600 : 400,
                      color: active ? tag.color : COLORS.text3,
                      background: active ? tag.color + '15' : 'transparent',
                      border: `1px solid ${active ? tag.color : COLORS.border}`,
                      padding: '5px 10px', borderRadius: 4, cursor: 'pointer',
                    }}>
                      {tag.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Free-text notes */}
            <div style={{ marginBottom: 14 }}>
              <div style={{
                fontFamily: FONT, fontSize: 9, color: COLORS.text3,
                letterSpacing: '0.08em', marginBottom: 4,
              }}>NOTES — anything about this fruit</div>
              <textarea
                value={current?.text || ''}
                onChange={e => saveNote(selectedReceipt, { text: e.target.value })}
                placeholder="Heavy rain this week but berries look like they held up. Some soft spots on the top layer. Running this first while it's cool..."
                rows={3}
                style={{
                  ...inputStyle, resize: 'vertical',
                  fontFamily: FONT, fontSize: 12, lineHeight: 1.5,
                }}
              />
            </div>

            {/* Optional quick counts */}
            <div style={{ marginBottom: 14 }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: 6,
              }}>
                <div style={{
                  fontFamily: FONT, fontSize: 9, color: COLORS.text3,
                  letterSpacing: '0.08em',
                }}>QUICK COUNT — optional, grab a handful and sort</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {[
                  { key: 'good', label: 'Good', color: COLORS.green },
                  { key: 'permanent', label: 'Permanent', color: COLORS.amber },
                  { key: 'condition', label: 'Condition', color: '#D85A30' },
                  { key: 'decay', label: 'Decay', color: COLORS.red },
                ].map(cat => (
                  <div key={cat.key}>
                    <div style={{ fontFamily: FONT, fontSize: 8, color: cat.color, letterSpacing: '0.06em', marginBottom: 2 }}>
                      {cat.label.toUpperCase()}
                    </div>
                    <input type="number" min="0"
                      value={current?.quickCounts?.[cat.key] || ''}
                      onChange={e => {
                        const counts = { ...(current?.quickCounts || {}), [cat.key]: parseInt(e.target.value) || 0 }
                        saveNote(selectedReceipt, { quickCounts: counts })
                      }}
                      placeholder="—"
                      style={{
                        ...inputStyle, textAlign: 'center', fontWeight: 700,
                        fontSize: 16, padding: '6px',
                        color: (current?.quickCounts?.[cat.key] || 0) > 0 ? cat.color : COLORS.text3,
                      }}
                    />
                  </div>
                ))}
              </div>
              <div style={{
                fontFamily: FONT, fontSize: 9, color: COLORS.text3,
                marginTop: 4, fontStyle: 'italic',
              }}>
                Not a formal sample — just a rough read on what's in the lug
              </div>
            </div>

            {/* Prediction preview if we have historical data */}
            {current && (current.tags.length > 0 || current.text) && (
              <div style={{
                background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
                borderRadius: 6, padding: 12,
                fontFamily: FONT, fontSize: 11, color: COLORS.text2, lineHeight: 1.6,
              }}>
                <div style={{
                  fontSize: 9, fontWeight: 600, color: COLORS.text3,
                  letterSpacing: '0.06em', marginBottom: 4,
                }}>
                  NOTED FOR {selectedReceipt}
                </div>
                {current.tags.length > 0 && (
                  <div style={{ marginBottom: 4 }}>
                    {current.tags.map(t => {
                      const tag = QUICK_TAGS.find(q => q.key === t)
                      return tag ? (
                        <span key={t} style={{
                          display: 'inline-block', fontSize: 10, fontWeight: 600,
                          color: tag.color, background: tag.color + '15',
                          padding: '1px 6px', borderRadius: 3, marginRight: 4, marginBottom: 2,
                        }}>{tag.label}</span>
                      ) : null
                    })}
                  </div>
                )}
                {current.text && <div>{current.text}</div>}
                <div style={{ fontSize: 9, color: COLORS.text3, marginTop: 4 }}>
                  This will appear as a banner when {selectedReceipt} is the active QC receipt.
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{
            fontFamily: FONT, fontSize: 12, color: COLORS.text3,
            textAlign: 'center', padding: 30,
          }}>
            Select a receipt to add notes
          </div>
        )}

        {/* All notes summary */}
        {notes.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{
              fontFamily: FONT, fontSize: 9, color: COLORS.text3,
              letterSpacing: '0.08em', marginBottom: 8,
            }}>ALL PRE-PACK NOTES</div>
            {notes.map(n => (
              <div key={n.receiptNum} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 0', borderBottom: `1px solid ${COLORS.border}`,
              }}>
                <div>
                  <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: COLORS.text }}>
                    {n.receiptNum}
                  </span>
                  <span style={{ fontFamily: FONT, fontSize: 10, color: COLORS.text3, marginLeft: 6 }}>
                    {n.grower}
                  </span>
                  {n.tags.length > 0 && (
                    <span style={{ fontFamily: FONT, fontSize: 9, color: COLORS.amber, marginLeft: 6 }}>
                      {n.tags.length} tags
                    </span>
                  )}
                </div>
                <button onClick={() => {
                  const updated = notes.filter(x => x.receiptNum !== n.receiptNum)
                  setNotes(updated)
                  savePrePack(updated)
                }} style={{
                  fontFamily: FONT, fontSize: 9, color: COLORS.red,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                }}>remove</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Inline banner for QC side — shows pre-pack notes for the active receipt.
 * Import this separately and render it when a receipt is active.
 */
export function PrePackBanner({ receiptNum }) {
  const [note, setNote] = useState(null)

  useEffect(() => {
    const refresh = () => {
      const all = loadPrePack()
      setNote(all.find(n => n.receiptNum === receiptNum) || null)
    }
    refresh()
    const id = setInterval(refresh, 5000)
    return () => clearInterval(id)
  }, [receiptNum])

  if (!note || (!note.tags.length && !note.text)) return null

  return (
    <div style={{
      background: COLORS.amberDim + '30', border: `1px solid ${COLORS.amber}40`,
      borderRadius: 4, padding: '6px 12px',
      display: 'flex', alignItems: 'center', gap: 8,
      fontFamily: FONT,
    }}>
      <div style={{
        fontSize: 8, fontWeight: 700, color: COLORS.amber,
        letterSpacing: '0.08em', flexShrink: 0,
      }}>
        PRE-PACK
      </div>
      {note.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {note.tags.map(t => {
            const tag = QUICK_TAGS.find(q => q.key === t)
            return tag ? (
              <span key={t} style={{
                fontSize: 9, fontWeight: 600, color: tag.color,
                background: tag.color + '12', padding: '1px 5px', borderRadius: 2,
              }}>{tag.label}</span>
            ) : null
          })}
        </div>
      )}
      {note.text && (
        <div style={{
          fontSize: 10, color: COLORS.text2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {note.text}
        </div>
      )}
    </div>
  )
}
