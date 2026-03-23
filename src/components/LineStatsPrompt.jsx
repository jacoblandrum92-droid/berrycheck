import React, { useState } from 'react'
import { COLORS, FONT } from '../constants'

export default function LineStatsPrompt({ context, onSubmit, onSkip }) {
  const [lineRate, setLineRate] = useState('')
  const [blowoff, setBlowoff] = useState('')
  const [sizeDiversion, setSizeDiversion] = useState('')

  const isCloseOut = context === 'close-out'

  const handleSubmit = () => {
    onSubmit({
      lineRate: parseFloat(lineRate) || null,
      blowoff: parseFloat(blowoff) || null,
      sizeDiversion: parseFloat(sizeDiversion) || null,
      capturedAt: context,
    })
  }

  const inputStyle = {
    fontFamily: FONT, fontSize: 16, color: COLORS.text,
    background: COLORS.bg, border: `1px solid ${COLORS.border2}`,
    padding: '10px 12px', borderRadius: 4, outline: 'none',
    boxSizing: 'border-box', width: '100%', textAlign: 'center',
    fontWeight: 600,
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: COLORS.bg,
        border: `2px solid ${isCloseOut ? COLORS.amber : COLORS.green}`,
        borderRadius: 10, width: '90%', maxWidth: 420,
        padding: 24,
      }}>
        <div style={{
          fontFamily: FONT, fontSize: 14, fontWeight: 700,
          color: isCloseOut ? COLORS.amber : COLORS.green,
          marginBottom: 4,
        }}>
          {isCloseOut ? 'Line Stats Missing' : 'Middle Layer — Check Machine'}
        </div>
        <div style={{
          fontFamily: FONT, fontSize: 11, color: COLORS.text2,
          marginBottom: 20,
        }}>
          {isCloseOut
            ? 'Line stats were not recorded at the middle sample. Please check the machine now before closing the pallet.'
            : 'Walk to the machine and record the current line stats.'}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div>
            <div style={{
              fontFamily: FONT, fontSize: 9, color: COLORS.text3,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              marginBottom: 4, textAlign: 'center',
            }}>Lbs/Hr</div>
            <input type="number" min="0" style={inputStyle}
              value={lineRate} onChange={e => setLineRate(e.target.value)}
              placeholder="0" autoFocus
            />
          </div>
          <div>
            <div style={{
              fontFamily: FONT, fontSize: 9, color: COLORS.text3,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              marginBottom: 4, textAlign: 'center',
            }}>Blowoff %</div>
            <input type="number" min="0" max="100" step="0.1" style={inputStyle}
              value={blowoff} onChange={e => setBlowoff(e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <div style={{
              fontFamily: FONT, fontSize: 9, color: COLORS.text3,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              marginBottom: 4, textAlign: 'center',
            }}>Size Sort %</div>
            <input type="number" min="0" max="100" step="0.1" style={inputStyle}
              value={sizeDiversion} onChange={e => setSizeDiversion(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {!isCloseOut && (
            <button onClick={onSkip} style={{
              flex: 1, fontFamily: FONT, fontSize: 11, fontWeight: 600,
              color: COLORS.text3, background: 'transparent',
              border: `1px solid ${COLORS.border}`,
              padding: 12, borderRadius: 6, cursor: 'pointer',
            }}>
              SKIP FOR NOW
            </button>
          )}
          <button onClick={handleSubmit} style={{
            flex: 2, fontFamily: FONT, fontSize: 13, fontWeight: 700,
            color: COLORS.green, background: COLORS.greenDim,
            border: `2px solid ${COLORS.green}`,
            padding: 12, borderRadius: 6, cursor: 'pointer',
            letterSpacing: '0.06em',
          }}>
            SAVE
          </button>
        </div>
      </div>
    </div>
  )
}
