import React, { useState, useMemo, useEffect, useRef } from 'react'
import { COLORS, FONT } from '../constants'

/**
 * Retroactive pallet-tag assignment.
 * Pallet tags are physically assigned after a pallet is closed (sometimes 30+ min
 * after the QC sample was taken). This modal lets the QCer/manager assign a tag
 * to a (date, dailyPalletNum, packLine) group, updating every sample on that pallet.
 *
 * Props:
 *   history       — array of samples (bc_history)
 *   onAssign      — (packLine, dailyPalletNum, newTag) => void
 *   onClose       — () => void
 */
export default function PalletTagAssign({ history, onAssign, onClose }) {
  const [showAll, setShowAll] = useState(false)
  const [edits, setEdits] = useState({}) // { 'line-#': 'newTag' }

  const today = new Date().toLocaleDateString()

  const groups = useMemo(() => {
    const map = new Map()
    for (const s of history || []) {
      if (s.date !== today) continue
      if (s.isExtra) continue
      // Skip samples with no daily pallet # — they shouldn't appear as a row
      if (!s.dailyPalletNum) continue
      const line = String(s.packLine || '?')
      const num = s.dailyPalletNum
      const key = `${line}-${num}`
      if (!map.has(key)) {
        map.set(key, {
          key,
          packLine: line,
          dailyPalletNum: num,
          samples: [],
          lotId: s.lotId || '',
          latestId: s.id || 0,
          latestTime: s.time || '',
        })
      }
      const g = map.get(key)
      g.samples.push(s)
      if (s.lotId && !g.lotId) g.lotId = s.lotId
      if ((s.id || 0) > g.latestId) {
        g.latestId = s.id || 0
        g.latestTime = s.time || g.latestTime
      }
    }
    return Array.from(map.values()).sort((a, b) => b.latestId - a.latestId)
  }, [history, today])

  const visible = showAll ? groups : groups.filter(g => !g.lotId)

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
      paddingTop: '5vh', zIndex: 1000,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: COLORS.bg, borderRadius: 8,
        width: 'min(640px, 92vw)', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 18px', borderBottom: `1px solid ${COLORS.border}`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            fontFamily: FONT, fontSize: 16, fontWeight: 800,
            color: COLORS.text, letterSpacing: '0.04em',
          }}>ASSIGN PALLET TAG</div>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{
            fontFamily: FONT, fontSize: 11, fontWeight: 600,
            color: COLORS.text2, background: 'transparent',
            border: `1px solid ${COLORS.border2}`,
            padding: '4px 12px', borderRadius: 3, cursor: 'pointer',
            letterSpacing: '0.06em',
          }}>CLOSE</button>
        </div>

        {/* Filter */}
        <div style={{
          padding: '8px 18px', borderBottom: `1px solid ${COLORS.border}`,
          display: 'flex', alignItems: 'center', gap: 12,
          background: COLORS.bg2,
        }}>
          <label style={{
            fontFamily: FONT, fontSize: 11, color: COLORS.text2,
            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
          }}>
            <input
              type="checkbox" checked={showAll}
              onChange={e => setShowAll(e.target.checked)}
            />
            Show already-tagged pallets
          </label>
          <div style={{ flex: 1 }} />
          <div style={{ fontFamily: FONT, fontSize: 10, color: COLORS.text3 }}>
            {visible.length} pallet{visible.length === 1 ? '' : 's'} · today only
          </div>
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', padding: 12, flex: 1 }}>
          {visible.length === 0 ? (
            <div style={{
              fontFamily: FONT, fontSize: 13, color: COLORS.text3,
              textAlign: 'center', padding: '40px 20px',
            }}>
              {showAll
                ? 'No pallets sampled today yet.'
                : 'All of today’s pallets are tagged. Check the box above to edit existing tags.'}
            </div>
          ) : (
            visible.map(g => (
              <PalletRow
                key={g.key}
                group={g}
                value={edits[g.key] !== undefined ? edits[g.key] : g.lotId}
                onChange={v => setEdits(prev => ({ ...prev, [g.key]: v }))}
                onAssign={(newTag) => {
                  if (g.lotId && newTag !== g.lotId) {
                    if (!confirm(`Pallet Line ${g.packLine} #${g.dailyPalletNum} is currently tagged "${g.lotId}". Replace with "${newTag}"?\n\nThis updates ${g.samples.length} sample${g.samples.length === 1 ? '' : 's'}.`)) return
                  }
                  onAssign(g.packLine, g.dailyPalletNum, newTag)
                  setEdits(prev => {
                    const next = { ...prev }
                    delete next[g.key]
                    return next
                  })
                }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function PalletRow({ group, value, onChange, onAssign }) {
  const inputRef = useRef(null)
  const trimmed = (value || '').trim()
  const dirty = trimmed !== (group.lotId || '').trim()
  const isEmpty = !trimmed
  const isUntagged = !group.lotId

  return (
    <div style={{
      background: isUntagged ? COLORS.bg2 : COLORS.bg,
      border: `1px solid ${isUntagged ? COLORS.amber + '60' : COLORS.border}`,
      borderRadius: 6, padding: '10px 14px', marginBottom: 8,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6,
      }}>
        <span style={{
          fontFamily: FONT, fontSize: 11, fontWeight: 800,
          color: COLORS.text, letterSpacing: '0.08em',
        }}>LINE {group.packLine} · #{group.dailyPalletNum}</span>
        <span style={{
          fontFamily: FONT, fontSize: 9, color: COLORS.text3,
          letterSpacing: '0.06em',
        }}>
          {group.samples.length} sample{group.samples.length === 1 ? '' : 's'}
          {group.latestTime ? ` · last ${group.latestTime}` : ''}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{
          fontFamily: FONT, fontSize: 9, fontWeight: 700,
          color: isUntagged ? COLORS.amber : COLORS.green,
          letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          {isUntagged ? 'Untagged' : 'Tagged'}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          ref={inputRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && dirty && !isEmpty) {
              onAssign(trimmed)
            }
          }}
          placeholder="scan or type tag"
          style={{
            flex: 1, fontFamily: FONT, fontSize: 14, fontWeight: 600,
            color: COLORS.text, background: COLORS.bg,
            border: `1px solid ${COLORS.border2}`,
            borderRadius: 4, padding: '6px 10px', outline: 'none',
          }}
        />
        <button
          disabled={!dirty || isEmpty}
          onClick={() => onAssign(trimmed)}
          style={{
            fontFamily: FONT, fontSize: 11, fontWeight: 700,
            color: '#fff',
            background: (!dirty || isEmpty) ? COLORS.text3 : (isUntagged ? COLORS.amber : COLORS.green),
            border: 'none', borderRadius: 4,
            padding: '6px 16px',
            cursor: (!dirty || isEmpty) ? 'default' : 'pointer',
            letterSpacing: '0.08em',
          }}
        >
          {isUntagged ? 'ASSIGN' : 'UPDATE'}
        </button>
      </div>
    </div>
  )
}
