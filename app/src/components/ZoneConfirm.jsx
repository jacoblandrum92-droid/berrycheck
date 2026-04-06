import React from 'react'
import { COLORS, FONT } from '../constants'

/**
 * ZoneConfirm — full-screen overlay after phone image is zone-counted.
 * Shows the image with zone labels and counts. QCer confirms or redraws.
 */

const ZONE_COLORS = {
  good: '#0F6E56',
  permanent: '#BA7517',
  condition: '#D85A30',
  decay: '#A32D2D',
}

const ZONE_LABELS = {
  good: 'Good',
  permanent: 'Permanent',
  condition: 'Condition',
  decay: 'Decay/Mold',
}

export default function ZoneConfirm({ image, zones, counts, onConfirm, onRedraw, onCancel }) {
  const total = Object.values(counts).reduce((s, v) => s + v, 0)
  const defects = (counts.permanent || 0) + (counts.condition || 0) + (counts.decay || 0)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9500,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT,
    }}>
      {/* Header */}
      <div style={{
        color: '#fff', fontSize: 14, fontWeight: 700,
        letterSpacing: '0.08em', marginBottom: 12,
      }}>
        VERIFY ZONE COUNTS
      </div>
      <div style={{
        color: '#ccc', fontSize: 11, marginBottom: 16, textAlign: 'center',
        maxWidth: 500, lineHeight: 1.5,
      }}>
        Confirm the berries are in the correct zones. Each zone's count is shown below.
        Make sure no good berries drifted into defect piles and no defects are hiding in the good zone.
      </div>

      {/* Image with zone overlay */}
      <div style={{ position: 'relative', maxWidth: '80%', maxHeight: '50vh' }}>
        <img src={image} style={{
          maxWidth: '100%', maxHeight: '50vh', objectFit: 'contain',
          borderRadius: 6, display: 'block',
        }} />
        {/* Zone labels overlaid on image */}
        {zones.map(zone => (
          <div key={zone.key} style={{
            position: 'absolute',
            left: `${zone.x * 100}%`,
            top: `${zone.y * 100}%`,
            width: `${zone.w * 100}%`,
            height: `${zone.h * 100}%`,
            border: `2px solid ${ZONE_COLORS[zone.key] || '#fff'}`,
            borderRadius: 3,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <div style={{
              background: (ZONE_COLORS[zone.key] || '#333') + 'CC',
              color: '#fff', padding: '4px 10px', borderRadius: 3,
              fontSize: 13, fontWeight: 700, textAlign: 'center',
            }}>
              {ZONE_LABELS[zone.key] || zone.key}: {counts[zone.key] || 0}
            </div>
          </div>
        ))}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <div style={{
          background: COLORS.green + '30', border: `1px solid ${COLORS.green}`,
          borderRadius: 6, padding: '10px 20px', textAlign: 'center',
        }}>
          <div style={{ color: COLORS.green, fontSize: 24, fontWeight: 700 }}>{total}</div>
          <div style={{ color: '#ccc', fontSize: 9, letterSpacing: '0.06em' }}>TOTAL</div>
        </div>
        <div style={{
          background: '#0F6E5630', border: `1px solid ${COLORS.green}`,
          borderRadius: 6, padding: '10px 20px', textAlign: 'center',
        }}>
          <div style={{ color: COLORS.green, fontSize: 24, fontWeight: 700 }}>{counts.good || 0}</div>
          <div style={{ color: '#ccc', fontSize: 9, letterSpacing: '0.06em' }}>GOOD</div>
        </div>
        {(counts.permanent || 0) > 0 && (
          <div style={{
            background: '#BA751730', border: `1px solid ${COLORS.amber}`,
            borderRadius: 6, padding: '10px 20px', textAlign: 'center',
          }}>
            <div style={{ color: COLORS.amber, fontSize: 24, fontWeight: 700 }}>{counts.permanent}</div>
            <div style={{ color: '#ccc', fontSize: 9, letterSpacing: '0.06em' }}>PERMANENT</div>
          </div>
        )}
        {(counts.condition || 0) > 0 && (
          <div style={{
            background: '#D85A3030', border: `1px solid #D85A30`,
            borderRadius: 6, padding: '10px 20px', textAlign: 'center',
          }}>
            <div style={{ color: '#D85A30', fontSize: 24, fontWeight: 700 }}>{counts.condition}</div>
            <div style={{ color: '#ccc', fontSize: 9, letterSpacing: '0.06em' }}>CONDITION</div>
          </div>
        )}
        {(counts.decay || 0) > 0 && (
          <div style={{
            background: '#A32D2D30', border: `1px solid ${COLORS.red}`,
            borderRadius: 6, padding: '10px 20px', textAlign: 'center',
          }}>
            <div style={{ color: COLORS.red, fontSize: 24, fontWeight: 700 }}>{counts.decay}</div>
            <div style={{ color: '#ccc', fontSize: 9, letterSpacing: '0.06em' }}>DECAY</div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        <button onClick={onConfirm} style={{
          fontFamily: FONT, fontSize: 14, fontWeight: 700,
          color: '#fff', background: COLORS.green,
          border: 'none', padding: '14px 40px', borderRadius: 6, cursor: 'pointer',
          letterSpacing: '0.06em',
        }}>
          CONFIRM COUNTS
        </button>
        <button onClick={onRedraw} style={{
          fontFamily: FONT, fontSize: 11, fontWeight: 600,
          color: COLORS.amber, background: 'transparent',
          border: `2px solid ${COLORS.amber}`,
          padding: '14px 24px', borderRadius: 6, cursor: 'pointer',
        }}>
          REDRAW ZONES
        </button>
        <button onClick={onCancel} style={{
          fontFamily: FONT, fontSize: 11,
          color: '#999', background: 'transparent',
          border: `1px solid #666`,
          padding: '14px 24px', borderRadius: 6, cursor: 'pointer',
        }}>
          CANCEL
        </button>
      </div>
    </div>
  )
}
