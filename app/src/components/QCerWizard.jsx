import React from 'react'
import { COLORS, FONT } from '../constants'

/**
 * QCerWizard — guided sample workflow for non-technical QCers.
 *
 * Renders a full-screen takeover with a step machine:
 *   Step 1: Pallet Setup (Daily # / Tag / Pack Code)
 *   Step 2: Pick Layer (#1 BOTTOM / #2 MIDDLE / #3 TOP)
 *   Step 3: Pick Sample Type (Quality / Box Weight)
 *   Step 4a: Quality Sample (wraps CountEntry)
 *   Step 4b: Box Weight Sample (wraps BoxWeightEntry)
 *
 * After save → Step 2 (next layer) or Step 1 (new pallet).
 *
 * Reuses existing data model — does not fork. The wizard is a UI shell over
 * the same state hooks that drive the full dashboard. Toggling QCer Mode off
 * restores the dashboard with no data loss.
 *
 * Phase 6.0 — scaffold only. Subsequent sub-phases fill in each step.
 */
export default function QCerWizard({ onExit }) {
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
        }}>guided sample workflow</div>
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

      {/* Body — placeholder for now */}
      <div style={{
        flex: 1, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        padding: 40,
      }}>
        <div style={{
          maxWidth: 480, textAlign: 'center',
          fontFamily: FONT,
        }}>
          <div style={{
            fontSize: 22, fontWeight: 700, color: COLORS.text,
            marginBottom: 12,
          }}>QCer Mode scaffold</div>
          <div style={{
            fontSize: 13, color: COLORS.text2, lineHeight: 1.5,
          }}>
            Step machine not yet wired. Sub-phases 6.1–6.6 will add Pallet Setup,
            Layer Pick, Sample Type, and the Quality / Box Weight flows in turn.
            Toggle EXIT QCER MODE (top-right) to return to the full dashboard.
          </div>
        </div>
      </div>
    </div>
  )
}
