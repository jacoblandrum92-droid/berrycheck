import React, { useState } from 'react'
import { COLORS, FONT } from '../constants'

/**
 * QCerWizard — guided sample workflow for non-technical QCers.
 *
 * Renders a full-screen takeover with a step machine:
 *   Step 1: Pallet Setup (Daily # / Tag / Pack Code / Line)
 *   Step 2: Pick Layer (#1 BOTTOM / #2 MIDDLE / #3 TOP)
 *   Step 3: Pick Sample Type (Quality / Box Weight)
 *   Step 4a: Quality Sample (wraps CountEntry)
 *   Step 4b: Box Weight Sample (wraps BoxWeightEntry)
 *
 * After save → Step 2 (next layer) or Step 1 (new pallet).
 *
 * Reuses existing state via props — does not fork the data model. Toggling
 * QCer Mode off restores the dashboard with no data loss.
 *
 * Phase 6.0 — scaffold (DONE)
 * Phase 6.1 — Step 1: Pallet Setup (THIS COMMIT)
 * Phase 6.2 — Step 2: Pick Layer
 * Phase 6.3 — Step 3: Pick Sample Type
 * Phase 6.4 — Step 4a: Quality Sample
 * Phase 6.5 — Step 4b: Box Weight Sample
 * Phase 6.6 — Manager pop-out
 */
export default function QCerWizard({
  // Pallet Setup — Step 1
  dailyPalletNum, setDailyPalletNum,
  lotId, setLotId,
  packCode, setPackCode,
  packCodeDB = [], packFavorites = [],
  // Line slot
  dualLineMode, activeLine, switchLine,
  // Wizard control
  onExit,
}) {
  const [step, setStep] = useState(1)

  return (
    <div style={{
      position: 'fixed', inset: 0, background: COLORS.bg,
      display: 'flex', flexDirection: 'column',
      zIndex: 500,
    }}>
      {/* Header bar */}
      <div style={{
        padding: '14px 24px', borderBottom: `1px solid ${COLORS.border}`,
        background: COLORS.bg2,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          fontFamily: FONT, fontSize: 14, fontWeight: 800,
          color: COLORS.green, letterSpacing: '0.12em',
        }}>QCER MODE</div>
        <div style={{
          fontFamily: FONT, fontSize: 10, color: COLORS.text3,
          letterSpacing: '0.06em',
        }}>step {step} of 4</div>
        <div style={{ flex: 1 }} />
        {onExit && (
          <button onClick={onExit} style={{
            fontFamily: FONT, fontSize: 10, fontWeight: 700,
            color: COLORS.text3, background: 'transparent',
            border: `1px solid ${COLORS.border2}`,
            padding: '4px 12px', borderRadius: 3, cursor: 'pointer',
            letterSpacing: '0.06em',
          }}>EXIT QCER MODE</button>
        )}
      </div>

      {/* Step body */}
      <div style={{
        flex: 1, overflowY: 'auto',
        display: 'flex', justifyContent: 'center',
        padding: '32px 20px',
      }}>
        {step === 1 && (
          <PalletSetupStep
            dailyPalletNum={dailyPalletNum} setDailyPalletNum={setDailyPalletNum}
            lotId={lotId} setLotId={setLotId}
            packCode={packCode} setPackCode={setPackCode}
            packCodeDB={packCodeDB} packFavorites={packFavorites}
            dualLineMode={dualLineMode} activeLine={activeLine} switchLine={switchLine}
            onContinue={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <PlaceholderStep
            num={2} label="Pick Layer"
            onBack={() => setStep(1)}
            note="Layer picker arrives in Phase 6.2."
          />
        )}
        {step === 3 && (
          <PlaceholderStep
            num={3} label="Pick Sample Type"
            onBack={() => setStep(2)}
            note="Quality / Box Weight picker arrives in Phase 6.3."
          />
        )}
      </div>
    </div>
  )
}

// ============================================================
// Step 1 — Pallet Setup
// ============================================================
function PalletSetupStep({
  dailyPalletNum, setDailyPalletNum,
  lotId, setLotId,
  packCode, setPackCode,
  packCodeDB, packFavorites,
  dualLineMode, activeLine, switchLine,
  onContinue,
}) {
  return (
    <div style={{ width: 'min(640px, 100%)', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Title */}
      <div>
        <div style={{
          fontFamily: FONT, fontSize: 22, fontWeight: 800,
          color: COLORS.text, letterSpacing: '0.02em', marginBottom: 4,
        }}>Pallet Setup</div>
        <div style={{
          fontFamily: FONT, fontSize: 12, color: COLORS.text2,
        }}>
          Identify the pallet you're sampling. Pallet Tag can be added later
          via ASSIGN TAG if it isn't printed yet.
        </div>
      </div>

      {/* Line picker — only when dualLineMode is on */}
      {dualLineMode && switchLine && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label>Line</Label>
          <div style={{ display: 'flex', gap: 10 }}>
            {['line1', 'line2'].map(line => {
              const active = activeLine === line
              return (
                <button key={line} onClick={() => switchLine(line)} style={{
                  flex: 1,
                  fontFamily: FONT, fontSize: 16, fontWeight: 800,
                  color: active ? '#fff' : COLORS.text2,
                  background: active ? COLORS.green : 'transparent',
                  border: `2px solid ${active ? COLORS.green : COLORS.border2}`,
                  padding: '14px 0', borderRadius: 8, cursor: 'pointer',
                  letterSpacing: '0.12em',
                }}>
                  {line === 'line1' ? 'LINE 1' : 'LINE 2'}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Daily Pallet # + Pallet Tag */}
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: '0 0 180px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label>Daily Pallet #</Label>
          <div style={{
            background: COLORS.bg, border: `2px solid ${COLORS.green}`,
            borderRadius: 8, padding: '10px 14px',
            display: 'flex', alignItems: 'baseline', gap: 6,
          }}>
            <span style={{
              fontFamily: FONT, fontSize: 28, fontWeight: 800,
              color: COLORS.green, lineHeight: 1,
            }}>#</span>
            <input
              type="number" min="1"
              value={dailyPalletNum || ''}
              onChange={e => setDailyPalletNum(parseInt(e.target.value) || 1)}
              style={{
                flex: 1, background: 'transparent', border: 'none', padding: 0,
                fontFamily: FONT, fontSize: 28, fontWeight: 800,
                color: COLORS.green, lineHeight: 1, outline: 'none', minWidth: 0,
              }}
            />
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label>Pallet Tag <span style={{ color: COLORS.text3, fontWeight: 400 }}>(optional — assign later)</span></Label>
          <input
            value={lotId || ''}
            onChange={e => setLotId(e.target.value)}
            placeholder="scan or type tag"
            style={{
              background: COLORS.bg, border: `2px solid ${COLORS.border2}`,
              borderRadius: 8, padding: '10px 14px',
              fontFamily: FONT, fontSize: 22, fontWeight: 700,
              color: COLORS.text, outline: 'none', width: '100%',
            }}
          />
        </div>
      </div>

      {/* Pack Code */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Label>Pack Code</Label>
        <select
          value={packCode || ''}
          onChange={e => setPackCode(e.target.value)}
          style={{
            background: COLORS.bg,
            border: `2px solid ${packCode ? COLORS.purple : COLORS.border2}`,
            borderRadius: 8, padding: '10px 14px',
            fontFamily: FONT,
            fontSize: packCode ? 18 : 14, fontWeight: 700,
            color: packCode ? COLORS.text : COLORS.text3,
            outline: 'none', cursor: 'pointer', width: '100%',
          }}
        >
          <option value="">Select pack code…</option>
          {packFavorites.length > 0 && (
            <optgroup label="★ Favorites">
              {packCodeDB.filter(c => packFavorites.includes(c.code)).map(c => (
                <option key={c.code} value={c.code}>{c.code} — {c.desc}</option>
              ))}
            </optgroup>
          )}
          <optgroup label={packFavorites.length > 0 ? 'All Codes' : 'Pack Codes'}>
            {packCodeDB.filter(c => !packFavorites.includes(c.code)).map(c => (
              <option key={c.code} value={c.code}>{c.code} — {c.desc}</option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* Continue */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <button onClick={onContinue} style={{
          fontFamily: FONT, fontSize: 14, fontWeight: 800,
          color: '#fff', background: COLORS.green,
          border: `2px solid ${COLORS.green}`,
          padding: '14px 32px', borderRadius: 8, cursor: 'pointer',
          letterSpacing: '0.12em',
          boxShadow: `0 2px 6px ${COLORS.green}40`,
        }}>CONTINUE →</button>
      </div>
    </div>
  )
}

// ============================================================
// Placeholder for steps not yet built
// ============================================================
function PlaceholderStep({ num, label, onBack, note }) {
  return (
    <div style={{
      width: 'min(480px, 100%)', textAlign: 'center',
      display: 'flex', flexDirection: 'column', gap: 16,
      paddingTop: 60,
    }}>
      <div style={{
        fontFamily: FONT, fontSize: 12, color: COLORS.text3,
        letterSpacing: '0.12em', textTransform: 'uppercase',
      }}>Step {num}</div>
      <div style={{
        fontFamily: FONT, fontSize: 26, fontWeight: 800,
        color: COLORS.text,
      }}>{label}</div>
      <div style={{
        fontFamily: FONT, fontSize: 13, color: COLORS.text2, lineHeight: 1.5,
      }}>{note}</div>
      <div>
        <button onClick={onBack} style={{
          fontFamily: FONT, fontSize: 11, fontWeight: 700,
          color: COLORS.text2, background: 'transparent',
          border: `1px solid ${COLORS.border2}`,
          padding: '8px 18px', borderRadius: 4, cursor: 'pointer',
          letterSpacing: '0.08em',
        }}>← BACK</button>
      </div>
    </div>
  )
}

// ============================================================
// Shared bits
// ============================================================
function Label({ children }) {
  return (
    <div style={{
      fontFamily: FONT, fontSize: 10, fontWeight: 700,
      color: COLORS.text3, letterSpacing: '0.12em',
      textTransform: 'uppercase',
    }}>{children}</div>
  )
}
