import React, { useState, useEffect } from 'react'
import { COLORS, FONT } from '../constants'
import { loadReceipts } from '../receipts'
import { loadPackCodes, loadFavorites, toggleFavorite, loadPackCodesGrouped } from '../packCodes'

const inputStyle = {
  background: COLORS.bg3, border: `1px solid ${COLORS.border2}`,
  color: COLORS.text, fontFamily: FONT, fontSize: 12,
  padding: '6px 10px', borderRadius: 3, outline: 'none',
  boxSizing: 'border-box', width: '100%',
}

const labelStyle = {
  fontFamily: FONT, fontSize: 8, color: COLORS.text3,
  letterSpacing: '0.08em', textTransform: 'uppercase',
  marginBottom: 3, display: 'block',
}

export default function PalletBuilder({
  dailyPalletNum, palletTag, setPalletTag,
  palletReceipts, onAddReceipt, onUpdateBoxes, onRemoveReceipt, onSelectReceipt,
  packCode, setPackCode,
  currentReceiptNum,
}) {
  const [activeReceipts, setActiveReceipts] = useState([])
  const [packCodeDB, setPackCodeDB] = useState([])
  const [selectedReceipt, setSelectedReceipt] = useState('')

  const [favorites, setFavoritesState] = useState([])

  useEffect(() => {
    const refresh = () => {
      setActiveReceipts(loadReceipts().filter(r => r.status === 'active'))
      setPackCodeDB(loadPackCodes())
      setFavoritesState(loadFavorites())
    }
    refresh()
    const id = setInterval(refresh, 5000)
    return () => clearInterval(id)
  }, [])

  const handleAddReceipt = () => {
    if (!selectedReceipt) return
    const receipt = activeReceipts.find(r => r.id === selectedReceipt)
    if (!receipt) return

    // Don't add duplicates
    if (palletReceipts.some(pr => pr.receiptNum === receipt.receiptNum)) return

    onAddReceipt({
      receiptNum: receipt.receiptNum,
      grower: receipt.grower || '',
      variety: receipt.variety || '',
      boxes: null, // filled in later
    })
    setSelectedReceipt('')
  }

  const selectedPack = packCodeDB.find(c => c.code === packCode)
  const expectedBoxes = selectedPack ? selectedPack.perPallet : null
  const totalBoxes = palletReceipts.reduce((sum, r) => sum + (r.boxes || 0), 0)

  return (
    <div style={{
      background: COLORS.bg2, borderBottom: `1px solid ${COLORS.border}`,
      padding: '10px 32px',
    }}>
      {/* Top row — pallet identity + pack code + add receipt */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: palletReceipts.length > 0 ? 10 : 0,
      }}>
        {/* Daily pallet # */}
        <div style={{ textAlign: 'center', minWidth: 50 }}>
          <label style={labelStyle}>Pallet</label>
          <div style={{
            fontFamily: FONT, fontSize: 22, fontWeight: 800,
            color: COLORS.green, lineHeight: 1,
          }}>
            #{dailyPalletNum}
          </div>
        </div>

        {/* Pallet tag */}
        <div style={{ minWidth: 110 }}>
          <label style={labelStyle}>Pallet Tag</label>
          <input style={inputStyle}
            value={palletTag} onChange={e => setPalletTag(e.target.value)}
            placeholder="from portal"
          />
        </div>

        {/* Pack code */}
        <div style={{ minWidth: 160, position: 'relative' }}>
          <label style={labelStyle}>Pack Code</label>
          <select style={inputStyle} value={packCode}
            onChange={e => setPackCode(e.target.value)}>
            <option value="">Select...</option>
            {favorites.length > 0 && (
              <optgroup label="Favorites">
                {packCodeDB.filter(c => favorites.includes(c.code)).map(c => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.desc}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label={favorites.length > 0 ? 'All Codes' : 'Pack Codes'}>
              {packCodeDB.filter(c => !favorites.includes(c.code)).map(c => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.desc}
                </option>
              ))}
            </optgroup>
          </select>
          {/* Star toggle for current code */}
          {packCode && (
            <button onClick={() => {
              toggleFavorite(packCode)
              setFavoritesState(loadFavorites())
            }} title={favorites.includes(packCode) ? 'Remove from favorites' : 'Add to favorites'} style={{
              position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, color: favorites.includes(packCode) ? COLORS.amber : COLORS.text3,
              padding: '0 4px',
            }}>
              {favorites.includes(packCode) ? '\u2605' : '\u2606'}
            </button>
          )}
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 30, background: COLORS.border, alignSelf: 'center' }} />

        {/* Add receipt to pallet */}
        <div style={{ minWidth: 200 }}>
          <label style={labelStyle}>Add Receipt to Pallet</label>
          <select style={inputStyle} value={selectedReceipt}
            onChange={e => setSelectedReceipt(e.target.value)}>
            <option value="">Select receipt...</option>
            {activeReceipts.map(r => (
              <option key={r.id} value={r.id}>
                {r.receiptNum} — {r.grower}{r.variety ? ` / ${r.variety}` : ''}
              </option>
            ))}
          </select>
        </div>

        <button onClick={handleAddReceipt} style={{
          fontFamily: FONT, fontSize: 10, fontWeight: 600,
          color: COLORS.green, background: COLORS.greenDim,
          border: `1px solid ${COLORS.green}`,
          padding: '6px 14px', borderRadius: 3, cursor: 'pointer',
          letterSpacing: '0.04em', whiteSpace: 'nowrap',
        }}>
          ADD TO PALLET
        </button>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Box total */}
        {palletReceipts.length > 0 && (
          <div style={{
            fontFamily: FONT, textAlign: 'right',
          }}>
            <div style={{ fontSize: 8, color: COLORS.text3, letterSpacing: '0.06em' }}>BOXES</div>
            <div style={{
              fontSize: 18, fontWeight: 700,
              color: expectedBoxes && totalBoxes > 0 && totalBoxes === expectedBoxes ? COLORS.green
                : totalBoxes > 0 ? COLORS.text : COLORS.text3,
            }}>
              {totalBoxes || '—'}{expectedBoxes ? ` / ${expectedBoxes}` : ''}
            </div>
          </div>
        )}
      </div>

      {/* Receipt log — stacks up as receipts are added */}
      {palletReceipts.length > 0 && (
        <div style={{
          display: 'flex', gap: 6, flexWrap: 'wrap',
        }}>
          {palletReceipts.map((pr, i) => {
            const isActive = currentReceiptNum === pr.receiptNum
            return (
            <div key={i} onClick={() => onSelectReceipt(pr)} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: isActive ? COLORS.greenDim : COLORS.bg,
              border: `2px solid ${isActive ? COLORS.green : COLORS.border}`,
              borderRadius: 4, padding: '6px 10px',
              cursor: 'pointer',
              boxShadow: isActive ? `0 0 0 1px ${COLORS.green}40` : 'none',
            }}>
              {/* Active indicator */}
              {isActive && (
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: COLORS.green, flexShrink: 0,
                }} />
              )}
              <div style={{
                fontFamily: FONT, fontSize: 11, fontWeight: 600,
                color: isActive ? COLORS.green : COLORS.text,
              }}>
                {pr.receiptNum}
              </div>
              <div style={{
                fontFamily: FONT, fontSize: 10, color: COLORS.text3,
              }}>
                {pr.grower}{pr.variety ? ` / ${pr.variety}` : ''}
              </div>

              {/* Box count — editable inline */}
              <input type="number" min="0"
                value={pr.boxes || ''}
                onClick={e => e.stopPropagation()}
                onChange={e => onUpdateBoxes(i, parseInt(e.target.value) || null)}
                placeholder="—"
                style={{
                  fontFamily: FONT, fontSize: 13, fontWeight: 700,
                  color: pr.boxes ? COLORS.text : COLORS.text3,
                  background: 'transparent', border: `1px solid ${COLORS.border}`,
                  borderRadius: 3, padding: '3px 6px', width: 55,
                  textAlign: 'center', outline: 'none',
                }}
              />
              <span style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3 }}>bx</span>

              <button onClick={(e) => { e.stopPropagation(); onRemoveReceipt(i) }} style={{
                fontFamily: FONT, fontSize: 8, color: COLORS.red,
                background: 'transparent', border: 'none',
                cursor: 'pointer', padding: '0 2px',
              }}>✕</button>
            </div>
            )
          })}
        </div>
      )}

      {/* Pack code special instructions + pallet type — visible to the whole floor */}
      {selectedPack && (selectedPack.special || selectedPack.palletType) && (
        <div style={{
          marginTop: palletReceipts.length > 0 ? 8 : 0,
          background: COLORS.amberDim, border: `1px solid ${COLORS.amber}`,
          borderRadius: 4, padding: '6px 12px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {/* Pallet type badge */}
          {selectedPack.palletType && (
            <div style={{
              fontFamily: FONT, fontSize: 10, fontWeight: 800,
              color: selectedPack.palletType === 'chep' ? '#fff' : COLORS.text,
              background: selectedPack.palletType === 'chep' ? '#1565C0' : '#8D6E3F',
              padding: '3px 8px', borderRadius: 3,
              letterSpacing: '0.06em',
              flexShrink: 0,
            }}>
              {selectedPack.palletType === 'chep' ? 'CHEP' : 'BROWN'}
            </div>
          )}
          {selectedPack.special && (
            <>
              <div style={{
                fontFamily: FONT, fontSize: 9, fontWeight: 700,
                color: COLORS.amber, letterSpacing: '0.08em',
                flexShrink: 0,
              }}>
                SPECIAL
              </div>
              <div style={{
                fontFamily: FONT, fontSize: 12, fontWeight: 600,
                color: COLORS.amber,
              }}>
                {selectedPack.special}
              </div>
            </>
          )}
          <div style={{ flex: 1 }} />
          <div style={{
            fontFamily: FONT, fontSize: 9, color: COLORS.text3,
          }}>
            {selectedPack.code}
          </div>
        </div>
      )}
    </div>
  )
}
