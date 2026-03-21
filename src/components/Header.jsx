import React, { useState, useEffect } from 'react'
import { COLORS, FONT } from '../constants'

export default function Header({
  onOpenCamera, onResetZones, onShowAccuracy, onShowLogs,
  trainingMode, onToggleTraining,
  relayConnected, phonesOnline
}) {
  const [clock, setClock] = useState('')

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-US', { hour12: false }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{
      background: COLORS.bg2,
      borderBottom: `1px solid ${COLORS.border}`,
      padding: '12px 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{
        fontFamily: FONT, fontSize: 15, fontWeight: 600,
        color: COLORS.green, letterSpacing: '0.08em', textTransform: 'uppercase',
      }}>
        BerryCheck <span style={{ color: COLORS.text3, fontWeight: 400 }}>QC</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Phone status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: phonesOnline > 0 ? COLORS.green : COLORS.text3,
            boxShadow: phonesOnline > 0 ? `0 0 6px ${COLORS.green}` : 'none',
          }} />
          <div style={{
            fontFamily: FONT, fontSize: 10, color: COLORS.text3, letterSpacing: '0.08em',
          }}>
            {phonesOnline > 0 ? 'PHONE LINKED' : relayConnected ? 'WAITING FOR PHONE' : 'RELAY OFF'}
          </div>
        </div>

        {/* Training mode toggle */}
        <button onClick={onToggleTraining} style={{
          fontFamily: FONT, fontSize: 10,
          color: trainingMode ? COLORS.green : COLORS.text3,
          background: trainingMode ? COLORS.greenDim + '40' : 'transparent',
          border: `1px solid ${trainingMode ? COLORS.greenDim : COLORS.border}`,
          padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
          letterSpacing: '0.06em',
        }}>
          TRAINING {trainingMode ? 'ON' : 'OFF'}
        </button>

        {/* Logs */}
        <button onClick={onShowLogs} style={{
          fontFamily: FONT, fontSize: 10, color: COLORS.text3,
          background: 'transparent', border: `1px solid ${COLORS.border}`,
          padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
          letterSpacing: '0.06em',
        }}>
          LOGS
        </button>

        {/* Accuracy report */}
        <button onClick={onShowAccuracy} style={{
          fontFamily: FONT, fontSize: 10, color: COLORS.text3,
          background: 'transparent', border: `1px solid ${COLORS.border}`,
          padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
          letterSpacing: '0.06em',
        }}>
          ACCURACY
        </button>

        <button onClick={onResetZones} style={{
          fontFamily: FONT, fontSize: 10, color: COLORS.amber,
          background: 'transparent', border: `1px solid ${COLORS.amberDim}`,
          padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
          letterSpacing: '0.06em',
        }}>
          RESET ZONES
        </button>

        <button onClick={onOpenCamera} style={{
          fontFamily: FONT, fontSize: 10, color: COLORS.text3,
          background: COLORS.bg3, border: `1px solid ${COLORS.border2}`,
          padding: '4px 12px', borderRadius: 3, cursor: 'pointer',
          letterSpacing: '0.06em',
        }}>
          LOCAL CAMERA
        </button>

        <div style={{ fontFamily: FONT, fontSize: 11, color: COLORS.text3 }}>
          {clock}
        </div>
      </div>
    </div>
  )
}
