import React, { useState, useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import { COLORS, FONT } from '../constants'

export default function Header({
  onOpenCamera, onResetZones, onShowAccuracy, onShowLogs, onShowReceipts, onShowPackLog, onShowPackCodes, onShowBackupForm,
  trainingMode, onToggleTraining,
  relayConnected, phonesOnline
}) {
  const [clock, setClock] = useState('')
  const [localIP, setLocalIP] = useState(null)

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-US', { hour12: false }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    fetch('/api/ip').then(r => r.json()).then(d => setLocalIP(d)).catch(() => {})
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
        {/* Local IP + QR */}
        {localIP && (
          <IPDisplay ip={localIP} />
        )}

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

        {/* Pack Codes */}
        <button onClick={onShowPackCodes} style={{
          fontFamily: FONT, fontSize: 10, color: COLORS.text3,
          background: 'transparent', border: `1px solid ${COLORS.border}`,
          padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
          letterSpacing: '0.06em',
        }}>
          PACK CODES
        </button>

        {/* Receipts */}
        <button onClick={onShowReceipts} style={{
          fontFamily: FONT, fontSize: 10, color: COLORS.amber,
          background: 'transparent', border: `1px solid ${COLORS.amberDim}`,
          padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
          letterSpacing: '0.06em',
        }}>
          RECEIPTS
        </button>

        {/* Pack Log */}
        <button onClick={onShowPackLog} style={{
          fontFamily: FONT, fontSize: 10, color: COLORS.text3,
          background: 'transparent', border: `1px solid ${COLORS.border}`,
          padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
          letterSpacing: '0.06em',
        }}>
          PACK LOG
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

        <button onClick={onShowBackupForm} style={{
          fontFamily: FONT, fontSize: 10, color: COLORS.text3,
          background: 'transparent', border: `1px solid ${COLORS.border}`,
          padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
          letterSpacing: '0.06em',
        }}>
          BACKUP FORM
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

function IPDisplay({ ip }) {
  const [showQR, setShowQR] = useState(false)
  const [mode, setMode] = useState('phone') // 'phone' or 'dump'
  const canvasRef = useRef(null)

  const baseUrl = `http://${ip.ip}:${ip.port}`
  const urls = {
    phone: `${baseUrl}/?mode=phone`,
    dump: `${baseUrl}/?mode=dump`,
    dashboard: baseUrl,
    daily: `${baseUrl}/?mode=daily`,
  }

  useEffect(() => {
    if (showQR && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, urls[mode], {
        width: 220,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      })
    }
  }, [showQR, mode])

  return (
    <>
      <div style={{
        fontFamily: FONT, fontSize: 10, color: COLORS.text3,
        background: COLORS.bg3, border: `1px solid ${COLORS.border}`,
        padding: '3px 10px', borderRadius: 3, letterSpacing: '0.04em',
        cursor: 'pointer',
      }}
        title="Click for QR code"
        onClick={() => setShowQR(true)}
      >
        {ip.ip}:{ip.port}
      </div>

      {showQR && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setShowQR(false)}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 28,
            textAlign: 'center', minWidth: 300,
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              fontFamily: FONT, fontSize: 14, fontWeight: 700,
              color: '#1a1a1a', marginBottom: 12,
            }}>
              Scan to Connect
            </div>

            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 16 }}>
              {[
                { key: 'phone', label: 'Phone Camera' },
                { key: 'dump', label: 'Dump Scanner' },
                { key: 'daily', label: 'Daily Report' },
                { key: 'dashboard', label: 'Dashboard' },
              ].map(m => (
                <button key={m.key} onClick={() => setMode(m.key)} style={{
                  fontFamily: FONT, fontSize: 10, fontWeight: 600,
                  color: mode === m.key ? '#0F6E56' : '#999',
                  background: mode === m.key ? '#E1F5EE' : 'transparent',
                  border: `1px solid ${mode === m.key ? '#0F6E56' : '#ddd'}`,
                  padding: '5px 12px', borderRadius: 4, cursor: 'pointer',
                }}>
                  {m.label}
                </button>
              ))}
            </div>

            <canvas ref={canvasRef} style={{ display: 'block', margin: '0 auto' }} />

            <div style={{
              fontFamily: FONT, fontSize: 11, color: '#666',
              marginTop: 12, wordBreak: 'break-all',
            }}>
              {urls[mode]}
            </div>

            <button onClick={() => setShowQR(false)} style={{
              fontFamily: FONT, fontSize: 11, color: '#999',
              background: 'transparent', border: `1px solid #ddd`,
              padding: '8px 24px', borderRadius: 4, cursor: 'pointer',
              marginTop: 16,
            }}>
              CLOSE
            </button>
          </div>
        </div>
      )}
    </>
  )
}
