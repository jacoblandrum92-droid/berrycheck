import React, { useEffect, useState } from 'react'

/**
 * InventoryTally — standalone phone tool for shed inventory counting.
 *
 * Tap a product row to +1 (umpire-counter style). Add products on the fly
 * as you walk the shed. Each product has a name + counting unit (cases,
 * rolls, boxes, 100-packs, whatever). Persists across screen locks.
 *
 * Routes via `?mode=inv` from any phone on the LAN.
 *
 * NOT tied to BerryCheck data. Own localStorage key, own styling. If this
 * grows useful enough to merge into BerryCheck proper, easy to extract.
 */
const STORE_KEY = 'bc_inventory_tally_session'

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
  purple: '#534AB7',
}
const F = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"

function loadSession() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return { products: [] }
    const parsed = JSON.parse(raw)
    return parsed && Array.isArray(parsed.products) ? parsed : { products: [] }
  } catch { return { products: [] } }
}

function saveSession(s) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)) } catch {}
}

export default function InventoryTally({ onBack }) {
  const [session, setSession] = useState(() => loadSession())
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [showSummary, setShowSummary] = useState(false)

  useEffect(() => { saveSession(session) }, [session])

  const addProduct = (name, unit) => {
    const id = Date.now() + Math.random()
    setSession(prev => ({
      products: [...prev.products, { id, name: name.trim(), unit: (unit || '').trim(), count: 0 }],
    }))
    setAdding(false)
  }

  const incrementBy = (id, by) => {
    setSession(prev => ({
      products: prev.products.map(p => p.id === id ? { ...p, count: Math.max(0, p.count + by) } : p),
    }))
  }
  const increment = (id) => incrementBy(id, 1)
  const incrementTen = (id) => incrementBy(id, 10)
  const decrement = (id) => incrementBy(id, -1)

  const setCount = (id, count) => {
    setSession(prev => ({
      products: prev.products.map(p => p.id === id ? { ...p, count: Math.max(0, count) } : p),
    }))
  }

  const updateProduct = (id, patch) => {
    setSession(prev => ({
      products: prev.products.map(p => p.id === id ? { ...p, ...patch } : p),
    }))
  }

  const deleteProduct = (id) => {
    if (!confirm('Delete this product? Its count will be lost.')) return
    setSession(prev => ({
      products: prev.products.filter(p => p.id !== id),
    }))
    setEditingId(null)
  }

  const resetAll = () => {
    if (!confirm('Reset all counts to 0? Products stay; counts go to zero.')) return
    setSession(prev => ({
      products: prev.products.map(p => ({ ...p, count: 0 })),
    }))
  }

  const clearAll = () => {
    if (!confirm('Clear ALL products and counts? This cannot be undone.')) return
    setSession({ products: [] })
  }

  if (showSummary) {
    return <SummaryView session={session} onBack={() => setShowSummary(false)} onReset={resetAll} onClear={clearAll} />
  }

  const total = session.products.reduce((sum, p) => sum + (p.count || 0), 0)

  return (
    <div style={{
      minHeight: '100vh', background: C.bg,
      fontFamily: F, color: C.text,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Sticky header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: C.bg, borderBottom: `1px solid ${C.border}`,
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        {onBack && (
          <button onClick={onBack} style={{
            fontFamily: F, fontSize: 10, fontWeight: 700,
            color: C.textDim, background: 'transparent',
            border: `1px solid ${C.border}`,
            padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
            letterSpacing: '0.06em', minHeight: 32,
            touchAction: 'manipulation',
          }}>← TOOLS</button>
        )}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Inventory</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.text, lineHeight: 1.1 }}>
            {session.products.length} products · {total} total
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowSummary(true)} disabled={session.products.length === 0} style={{
          ...primaryBtn,
          padding: '8px 14px',
          background: session.products.length > 0 ? C.green : C.border,
          color: session.products.length > 0 ? '#fff' : C.textDim,
          cursor: session.products.length > 0 ? 'pointer' : 'default',
        }}>SUMMARY</button>
      </div>

      {/* Body */}
      <div style={{ padding: 12, flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Add product card */}
        {adding ? (
          <AddProductForm onAdd={addProduct} onCancel={() => setAdding(false)} />
        ) : (
          <button onClick={() => setAdding(true)} style={{
            fontFamily: F, fontSize: 14, fontWeight: 700,
            color: C.purple, background: 'transparent',
            border: `2px dashed ${C.purple}80`,
            borderRadius: 10, padding: '14px',
            cursor: 'pointer', letterSpacing: '0.06em',
            touchAction: 'manipulation',
          }}>+ ADD PRODUCT</button>
        )}

        {/* Empty state */}
        {session.products.length === 0 && !adding && (
          <div style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 10, padding: '32px 20px',
            textAlign: 'center', color: C.textDim,
            fontSize: 13, lineHeight: 1.5,
          }}>
            <div style={{ fontWeight: 700, color: C.text, marginBottom: 6 }}>No products yet</div>
            Tap <strong>+ ADD PRODUCT</strong> to start. Examples:
            <div style={{ marginTop: 10, fontSize: 12 }}>
              "Clamshells" / cases · "PTI Rolls" / roll · "Hairnets" / 100-pack
            </div>
          </div>
        )}

        {/* Product rows */}
        {session.products.map(p => (
          editingId === p.id ? (
            <EditProductRow
              key={p.id}
              product={p}
              onSave={(patch) => { updateProduct(p.id, patch); setEditingId(null) }}
              onDelete={() => deleteProduct(p.id)}
              onCancel={() => setEditingId(null)}
              onSetCount={(n) => setCount(p.id, n)}
            />
          ) : (
            <ProductRow
              key={p.id}
              product={p}
              onTap={() => increment(p.id)}
              onAddTen={() => incrementTen(p.id)}
              onDecrement={() => decrement(p.id)}
              onEdit={() => setEditingId(p.id)}
            />
          )
        ))}

        {session.products.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={resetAll} style={{ ...ghostBtn, flex: 1 }}>RESET COUNTS</button>
            <button onClick={clearAll} style={{ ...ghostBtn, flex: 1, color: C.red, borderColor: C.red + '60' }}>CLEAR ALL</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Product row — tap anywhere = +1
// ============================================================
function ProductRow({ product, onTap, onAddTen, onDecrement, onEdit }) {
  const stop = (e) => { e.stopPropagation() }
  return (
    <div
      onClick={onTap}
      style={{
        background: product.count > 0 ? C.greenSoft : C.card,
        border: `2px solid ${product.count > 0 ? C.green : C.border}`,
        borderRadius: 10, padding: '14px 16px',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 12,
        userSelect: 'none', touchAction: 'manipulation',
        minHeight: 70,
      }}>
      {/* Name + unit */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: F, fontSize: 16, fontWeight: 700, color: C.text,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{product.name}</div>
        {product.unit && (
          <div style={{ fontFamily: F, fontSize: 11, color: C.textDim, letterSpacing: '0.06em' }}>
            per {product.unit}
          </div>
        )}
      </div>

      {/* Count */}
      <div style={{
        fontFamily: F, fontSize: 32, fontWeight: 800,
        color: product.count > 0 ? C.green : C.textDim,
        lineHeight: 1, minWidth: 50, textAlign: 'right',
      }}>
        {product.count}
      </div>

      {/* +1 indicator */}
      <div style={{
        fontFamily: F, fontSize: 24, fontWeight: 800,
        color: product.count > 0 ? C.green : C.textDim,
        lineHeight: 1,
      }}>+</div>

      {/* Action buttons (don't bubble tap) */}
      <div onClick={stop} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <button onClick={onAddTen} title="+10" style={{
          ...miniBtn(C.green),
          width: 38, fontSize: 11, fontWeight: 800,
          background: C.green, color: '#fff', borderColor: C.green,
        }}>+10</button>
        <button onClick={onDecrement} title="−1" style={{ ...miniBtn(C.red), width: 38 }}>−</button>
        <button onClick={onEdit} title="edit" style={{ ...miniBtn(C.textDim), width: 38 }}>✎</button>
      </div>
    </div>
  )
}

// ============================================================
// Edit product row
// ============================================================
function EditProductRow({ product, onSave, onDelete, onCancel, onSetCount }) {
  const [name, setName] = useState(product.name)
  const [unit, setUnit] = useState(product.unit || '')
  const [count, setCount] = useState(String(product.count))

  const save = () => {
    if (!name.trim()) return
    const n = parseInt(count)
    onSave({ name: name.trim(), unit: unit.trim(), count: isNaN(n) ? product.count : Math.max(0, n) })
  }

  return (
    <div style={{
      background: C.card, border: `2px solid ${C.purple}`,
      borderRadius: 10, padding: 14,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="product name"
        autoFocus
        style={editInput}
      />
      <input
        value={unit}
        onChange={e => setUnit(e.target.value)}
        placeholder="unit (e.g. cases, rolls)"
        style={{ ...editInput, fontSize: 14 }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: '0.08em' }}>COUNT</div>
        <input
          type="number" inputMode="numeric"
          value={count}
          onChange={e => setCount(e.target.value.replace(/[^0-9]/g, ''))}
          style={{ ...editInput, fontSize: 16, width: 100 }}
        />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={save} style={{ ...primaryBtn, flex: 1, padding: '10px' }}>SAVE</button>
        <button onClick={onCancel} style={{ ...ghostBtn, flex: 1 }}>CANCEL</button>
        <button onClick={onDelete} style={{ ...ghostBtn, color: C.red, borderColor: C.red, padding: '8px 14px' }}>DELETE</button>
      </div>
    </div>
  )
}

// ============================================================
// Add product form
// ============================================================
function AddProductForm({ onAdd, onCancel }) {
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')

  const submit = () => {
    if (!name.trim()) return
    onAdd(name, unit)
  }

  return (
    <div style={{
      background: C.card, border: `2px solid ${C.purple}`,
      borderRadius: 10, padding: 14,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel() }}
        placeholder="product name (e.g. Clamshells)"
        autoFocus
        style={editInput}
      />
      <input
        value={unit}
        onChange={e => setUnit(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel() }}
        placeholder="unit (e.g. cases, rolls, boxes)"
        style={{ ...editInput, fontSize: 14 }}
      />
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={submit} disabled={!name.trim()} style={{
          ...primaryBtn,
          flex: 1, padding: '10px',
          background: name.trim() ? C.purple : C.border,
          borderColor: name.trim() ? C.purple : C.border,
          color: name.trim() ? '#fff' : C.textDim,
          cursor: name.trim() ? 'pointer' : 'default',
        }}>ADD</button>
        <button onClick={onCancel} style={{ ...ghostBtn, flex: 1 }}>CANCEL</button>
      </div>
    </div>
  )
}

// ============================================================
// Summary
// ============================================================
function SummaryView({ session, onBack, onReset, onClear }) {
  const products = session.products
  const total = products.reduce((sum, p) => sum + (p.count || 0), 0)

  // Pretty text dump for copy/paste — "Clamshells: 42 cases"
  const text = products.map(p => {
    const unit = p.unit ? ` ${p.unit}` : ''
    return `${p.name}: ${p.count}${unit}`
  }).join('\n')

  const copy = (str) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(str).then(() => alert('Copied'), () => alert('Copy failed — long-press to select'))
    } else {
      alert('Long-press text to select and copy')
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.bg,
      fontFamily: F, color: C.text,
      display: 'flex', flexDirection: 'column',
      padding: '20px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={onBack} style={ghostBtn}>← BACK</button>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: C.textDim }}>{products.length} products · {total} total</div>
      </div>

      <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Inventory Summary</div>
      <div style={{ fontSize: 12, color: C.textDim, marginBottom: 16 }}>
        Snapshot of your current counts. Copy below to take to your records.
      </div>

      {/* Each product compactly */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 10, padding: 12, marginBottom: 12,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        {products.length === 0 ? (
          <div style={{ color: C.textDim, fontSize: 13, textAlign: 'center', padding: 20 }}>
            No products yet
          </div>
        ) : (
          products.map(p => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'baseline', gap: 8,
              padding: '8px 10px', borderRadius: 6,
              background: p.count > 0 ? C.greenSoft : 'transparent',
            }}>
              <div style={{
                fontSize: 14, fontWeight: 700, color: C.text,
                flex: 1, minWidth: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{p.name}</div>
              <div style={{
                fontSize: 18, fontWeight: 800,
                color: p.count > 0 ? C.green : C.textDim,
              }}>{p.count}</div>
              {p.unit && (
                <div style={{ fontSize: 11, color: C.textDim, letterSpacing: '0.04em' }}>{p.unit}</div>
              )}
            </div>
          ))
        )}
      </div>

      {products.length > 0 && (
        <div style={{
          background: C.card, border: `2px solid ${C.green}`,
          borderRadius: 10, padding: 12, marginBottom: 12,
          fontFamily: F, fontSize: 14, lineHeight: 1.6,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          userSelect: 'all', WebkitUserSelect: 'all',
        }}>{text}</div>
      )}

      {products.length > 0 && (
        <button onClick={() => copy(text)} style={{ ...primaryBtn, marginBottom: 12 }}>
          COPY TO CLIPBOARD
        </button>
      )}

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => { onReset(); onBack() }} style={{ ...ghostBtn, flex: 1, padding: '12px' }}>
          RESET COUNTS
        </button>
        <button onClick={() => { onClear(); onBack() }} style={{ ...ghostBtn, flex: 1, padding: '12px', color: C.red, borderColor: C.red + '60' }}>
          CLEAR ALL
        </button>
      </div>
    </div>
  )
}

// ============================================================
// Shared bits
// ============================================================
const primaryBtn = {
  fontFamily: F, fontSize: 13, fontWeight: 800,
  color: '#fff', background: C.green,
  border: `2px solid ${C.green}`,
  padding: '12px 16px', borderRadius: 8, cursor: 'pointer',
  letterSpacing: '0.08em', minHeight: 44,
  touchAction: 'manipulation',
}

const ghostBtn = {
  fontFamily: F, fontSize: 11, fontWeight: 700,
  color: C.textDim, background: 'transparent',
  border: `1px solid ${C.border}`,
  padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
  letterSpacing: '0.06em', minHeight: 40,
  touchAction: 'manipulation',
}

const editInput = {
  fontFamily: F, fontSize: 16, fontWeight: 600,
  color: C.text, background: C.bg,
  border: `1px solid ${C.border}`,
  borderRadius: 6, padding: '10px 12px',
  width: '100%', outline: 'none',
}

function miniBtn(color) {
  return {
    fontFamily: F, fontSize: 14, fontWeight: 700,
    color, background: 'transparent',
    border: `1px solid ${color}80`,
    width: 32, height: 32, padding: 0,
    borderRadius: 4, cursor: 'pointer',
    touchAction: 'manipulation',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
}
