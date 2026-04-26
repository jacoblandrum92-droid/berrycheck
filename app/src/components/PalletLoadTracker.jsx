import React, { useEffect, useState } from 'react'

/**
 * PalletLoadTracker — standalone phone tool, NOT tied to BerryCheck data.
 *
 * Purpose: when loading a semi mid-day, generate a sequential list of pallet
 * numbers from a range (e.g. 298-332), tap each as it's loaded, and at the
 * end get a sorted numerical list to take to the shed computer for shipping.
 *
 * Routes via `?mode=load` from any phone on the LAN.
 *
 * Persistence: own localStorage key `bc_load_tracker_session`. No interaction
 * with bc_history / bc_packlog / etc. If this grows useful enough to merge
 * into BerryCheck proper, it can be extracted cleanly.
 */
const STORE_KEY = 'bc_load_tracker_session'

const C = {
  bg: '#f5f5f3',
  card: '#ffffff',
  border: '#dcdcd8',
  text: '#1a1a1a',
  textDim: '#6c6c68',
  green: '#0F6E56',
  greenSoft: '#E1F5EE',
  red: '#A32D2D',
  amber: '#BA7517',
}
const F = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"

function loadSession() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

function saveSession(s) {
  try {
    if (!s) localStorage.removeItem(STORE_KEY)
    else localStorage.setItem(STORE_KEY, JSON.stringify(s))
  } catch {}
}

export default function PalletLoadTracker() {
  const [session, setSession] = useState(() => loadSession())
  // session shape: { range: { from, to }, pallets: number[], loaded: { [num]: true } }

  // Persist on change
  useEffect(() => { saveSession(session) }, [session])

  if (!session) {
    return <SetupView onStart={(from, to) => {
      const pallets = []
      for (let n = Math.min(from, to); n <= Math.max(from, to); n++) pallets.push(n)
      setSession({ pallets, loaded: {} })
    }} />
  }

  return <TrackerView session={session} setSession={setSession} />
}

// ============================================================
// SETUP — enter the range
// ============================================================
function SetupView({ onStart }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const fromN = parseInt(from)
  const toN = parseInt(to)
  const valid = !isNaN(fromN) && !isNaN(toN) && fromN > 0 && toN > 0
  const count = valid ? Math.abs(toN - fromN) + 1 : 0

  return (
    <div style={{
      minHeight: '100vh', background: C.bg,
      fontFamily: F, color: C.text,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '32px 20px',
    }}>
      <div style={{ width: 'min(420px, 100%)', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Pallet Load Tracker</div>
          <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.5 }}>
            Enter the range of pallet numbers being loaded. Each number gets a
            big tap target you press as you load that pallet.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <NumberField label="From" value={from} onChange={setFrom} autoFocus />
          <div style={{ paddingBottom: 16, fontSize: 22, color: C.textDim }}>→</div>
          <NumberField label="To" value={to} onChange={setTo} />
        </div>

        {valid && (
          <div style={{
            background: C.greenSoft, border: `1px solid ${C.green}40`,
            borderRadius: 8, padding: '10px 14px',
            fontSize: 13, color: C.green, fontWeight: 600,
          }}>
            {count} pallet{count === 1 ? '' : 's'} ready to track
          </div>
        )}

        <button
          disabled={!valid}
          onClick={() => onStart(fromN, toN)}
          style={{
            ...primaryBtn,
            background: valid ? C.green : C.border,
            color: valid ? '#fff' : C.textDim,
            cursor: valid ? 'pointer' : 'default',
          }}
        >
          GENERATE LIST
        </button>
      </div>
    </div>
  )
}

function NumberField({ label, value, onChange, autoFocus }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</div>
      <input
        type="number" inputMode="numeric"
        value={value}
        onChange={e => onChange(e.target.value.replace(/[^0-9]/g, ''))}
        autoFocus={autoFocus}
        style={{
          fontFamily: F, fontSize: 28, fontWeight: 800,
          color: C.text, background: C.card,
          border: `2px solid ${C.border}`,
          borderRadius: 8, padding: '12px 14px',
          width: '100%', outline: 'none',
        }}
      />
    </div>
  )
}

// ============================================================
// TRACKER — grid of pallet buttons + add-one + done
// ============================================================
function TrackerView({ session, setSession }) {
  const [showSummary, setShowSummary] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addValue, setAddValue] = useState('')

  const loadedCount = Object.keys(session.loaded).filter(k => session.loaded[k]).length

  const togglePallet = (n) => {
    setSession(prev => {
      const next = { ...prev.loaded }
      if (next[n]) delete next[n]
      else next[n] = true
      return { ...prev, loaded: next }
    })
  }

  const addOne = () => {
    const n = parseInt(addValue)
    if (!isNaN(n) && n > 0 && !session.pallets.includes(n)) {
      setSession(prev => ({ ...prev, pallets: [...prev.pallets, n] }))
    }
    setAddValue('')
    setAdding(false)
  }

  const startOver = () => {
    if (!confirm('Clear this load? Selected pallets will be lost.')) return
    setSession(null)
  }

  if (showSummary) {
    return <SummaryView session={session} onBack={() => setShowSummary(false)} onDone={() => { setSession(null); setShowSummary(false) }} />
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.bg,
      fontFamily: F, color: C.text,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Sticky header with counter */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: C.bg, borderBottom: `1px solid ${C.border}`,
        padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 11, color: C.textDim, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Loaded</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.green, lineHeight: 1 }}>
            {loadedCount}<span style={{ fontSize: 14, color: C.textDim, fontWeight: 600 }}> / {session.pallets.length}</span>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={startOver} style={smallBtn(C.red)}>RESET</button>
      </div>

      {/* Add-one + Pallet grid */}
      <div style={{ padding: 16, flex: 1 }}>
        {/* Add another (top) */}
        <div style={{ marginBottom: 12 }}>
          {adding ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number" inputMode="numeric"
                autoFocus
                value={addValue}
                onChange={e => setAddValue(e.target.value.replace(/[^0-9]/g, ''))}
                onKeyDown={e => { if (e.key === 'Enter') addOne(); if (e.key === 'Escape') { setAdding(false); setAddValue('') } }}
                placeholder="extra pallet #"
                style={{
                  flex: 1, fontFamily: F, fontSize: 18, fontWeight: 700,
                  background: C.card, border: `2px solid ${C.amber}`,
                  borderRadius: 8, padding: '10px 14px', outline: 'none',
                }}
              />
              <button onClick={addOne} style={primaryBtn}>ADD</button>
              <button onClick={() => { setAdding(false); setAddValue('') }} style={ghostBtn}>×</button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} style={{
              ...ghostBtn, width: '100%',
              borderColor: C.amber, color: C.amber,
              fontWeight: 700, padding: '12px',
            }}>+ ADD EXTRA PALLET</button>
          )}
        </div>

        {/* Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(78px, 1fr))',
          gap: 8,
        }}>
          {session.pallets.map(n => {
            const loaded = !!session.loaded[n]
            return (
              <button key={n} onClick={() => togglePallet(n)} style={{
                fontFamily: F, fontSize: 18, fontWeight: 800,
                color: loaded ? '#fff' : C.text,
                background: loaded ? C.green : C.card,
                border: `2px solid ${loaded ? C.green : C.border}`,
                borderRadius: 8,
                minHeight: 60, padding: 0, cursor: 'pointer',
                touchAction: 'manipulation',
                transition: 'transform 0.05s',
                ...(loaded ? { boxShadow: `0 2px 4px ${C.green}40` } : {}),
              }}>
                {n}
              </button>
            )
          })}
        </div>
      </div>

      {/* Sticky DONE bar */}
      <div style={{
        position: 'sticky', bottom: 0,
        background: C.bg, borderTop: `1px solid ${C.border}`,
        padding: '12px 16px',
      }}>
        <button
          onClick={() => setShowSummary(true)}
          disabled={loadedCount === 0}
          style={{
            ...primaryBtn,
            width: '100%',
            background: loadedCount > 0 ? C.green : C.border,
            color: loadedCount > 0 ? '#fff' : C.textDim,
            cursor: loadedCount > 0 ? 'pointer' : 'default',
          }}
        >
          DONE — SHOW LIST ({loadedCount})
        </button>
      </div>
    </div>
  )
}

// ============================================================
// SUMMARY — sorted list ready to type into the shed program
// ============================================================
function SummaryView({ session, onBack, onDone }) {
  const sorted = Object.keys(session.loaded)
    .filter(k => session.loaded[k])
    .map(Number)
    .sort((a, b) => a - b)

  const csv = sorted.join(', ')
  const newlines = sorted.join('\n')

  const copy = (text) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => alert('Copied'),
        () => alert('Copy failed — long-press to select manually')
      )
    } else {
      alert('Long-press the text to select and copy')
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.bg,
      fontFamily: F, color: C.text,
      display: 'flex', flexDirection: 'column',
      padding: '20px 16px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
      }}>
        <button onClick={onBack} style={ghostBtn}>← BACK</button>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: C.textDim }}>{sorted.length} pallets</div>
      </div>

      <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Loaded pallets</div>
      <div style={{ fontSize: 12, color: C.textDim, marginBottom: 16 }}>
        Sorted numerically. Copy and paste into the shed program.
      </div>

      {/* Big readable block */}
      <div style={{
        background: C.card, border: `2px solid ${C.green}`,
        borderRadius: 10, padding: 16, marginBottom: 12,
        fontFamily: F, fontSize: 22, fontWeight: 700,
        lineHeight: 1.5, wordBreak: 'break-word',
        userSelect: 'all', WebkitUserSelect: 'all',
      }}>
        {csv || '—'}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={() => copy(csv)} style={{ ...primaryBtn, flex: 1 }}>COPY 298, 305, …</button>
        <button onClick={() => copy(newlines)} style={{ ...primaryBtn, flex: 1, background: C.amber, borderColor: C.amber }}>COPY ONE-PER-LINE</button>
      </div>

      <div style={{ flex: 1 }} />

      <button onClick={onDone} style={{ ...ghostBtn, width: '100%', padding: '14px', fontWeight: 700 }}>
        DONE — START NEW LOAD
      </button>
    </div>
  )
}

// ============================================================
// Shared bits
// ============================================================
const primaryBtn = {
  fontFamily: F, fontSize: 14, fontWeight: 800,
  color: '#fff', background: C.green,
  border: `2px solid ${C.green}`,
  padding: '14px 18px', borderRadius: 8, cursor: 'pointer',
  letterSpacing: '0.08em', minHeight: 50,
  touchAction: 'manipulation',
}

const ghostBtn = {
  fontFamily: F, fontSize: 12, fontWeight: 700,
  color: C.textDim, background: 'transparent',
  border: `1px solid ${C.border}`,
  padding: '8px 14px', borderRadius: 6, cursor: 'pointer',
  letterSpacing: '0.06em', minHeight: 40,
  touchAction: 'manipulation',
}

function smallBtn(color) {
  return {
    fontFamily: F, fontSize: 10, fontWeight: 700,
    color, background: 'transparent',
    border: `1px solid ${color}`,
    padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
    letterSpacing: '0.06em', minHeight: 32,
    touchAction: 'manipulation',
  }
}
