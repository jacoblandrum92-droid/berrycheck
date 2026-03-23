import React, { useState, useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import { COLORS, FONT } from '../constants'

export default function Header({
  onOpenCamera, onResetZones, onShowAccuracy, onShowLogs, onShowReceipts, onShowPackLog, onShowPackCodes, onShowBackupForm, onShowPackout, onShowDCReconcile, onShowPrePack, onShowFeatures, features = {},
  trainingMode, onToggleTraining,
  relayConnected, phonesOnline
}) {
  const [clock, setClock] = useState('')
  const [localIP, setLocalIP] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-US', { hour12: false }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    fetch('/api/ip').then(r => r.json()).then(d => setLocalIP(d)).catch(() => {})
  }, [])

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const menuAction = (fn) => {
    setMenuOpen(false)
    fn()
  }

  return (
    <div style={{
      background: COLORS.bg2,
      borderBottom: `1px solid ${COLORS.border}`,
      padding: '12px 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      {/* Left — logo */}
      <div style={{
        fontFamily: FONT, fontSize: 15, fontWeight: 600,
        color: COLORS.green, letterSpacing: '0.08em', textTransform: 'uppercase',
      }}>
        BerryCheck <span style={{ color: COLORS.text3, fontWeight: 400 }}>QC</span>
      </div>

      {/* Right — status + menu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Local IP + QR */}
        {localIP && <IPDisplay ip={localIP} />}

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

        {/* Training indicator (always visible when on) */}
        {features.training !== false && trainingMode && (
          <div style={{
            fontFamily: FONT, fontSize: 10, fontWeight: 600,
            color: COLORS.green, background: COLORS.greenDim + '40',
            border: `1px solid ${COLORS.greenDim}`,
            padding: '4px 10px', borderRadius: 3,
            letterSpacing: '0.06em',
          }}>
            TRAINING ON
          </div>
        )}

        {/* Clock */}
        <div style={{ fontFamily: FONT, fontSize: 11, color: COLORS.text3 }}>
          {clock}
        </div>

        {/* Menu button */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button onClick={() => setMenuOpen(!menuOpen)} style={{
            fontFamily: FONT, fontSize: 10, fontWeight: 600,
            color: menuOpen ? COLORS.green : COLORS.text3,
            background: menuOpen ? COLORS.greenDim : COLORS.bg3,
            border: `1px solid ${menuOpen ? COLORS.green : COLORS.border2}`,
            padding: '5px 14px', borderRadius: 3, cursor: 'pointer',
            letterSpacing: '0.08em',
          }}>
            MENU
          </button>

          {menuOpen && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 6,
              background: COLORS.bg2, border: `1px solid ${COLORS.border2}`,
              borderRadius: 6, padding: '8px 0',
              minWidth: 200, zIndex: 3000,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              {/* Workflow */}
              <MenuSection label="Workflow">
                <MenuItem label="Receipts" color={COLORS.amber} onClick={() => menuAction(onShowReceipts)} gated={features.receipts !== false} />
                <MenuItem label="Pack Codes" onClick={() => menuAction(onShowPackCodes)} />
                <MenuItem label="Pre-Pack Notes" color={COLORS.green} onClick={() => menuAction(onShowPrePack)} />
                <MenuItem label="Pack Log" onClick={() => menuAction(onShowPackLog)} gated={features.packLog !== false} />
              </MenuSection>

              {/* Reports */}
              <MenuSection label="Reports">
                <MenuItem label="Packout Report" color={COLORS.green} onClick={() => menuAction(onShowPackout)} gated={features.packout !== false} />
                <MenuItem label="DC Reconciliation" color={COLORS.amber} onClick={() => menuAction(onShowDCReconcile)} gated={features.dcReconcile !== false} />
                <MenuItem label="Accuracy" onClick={() => menuAction(onShowAccuracy)} />
                <MenuItem label="Logs" onClick={() => menuAction(onShowLogs)} gated={features.logManager !== false} />
              </MenuSection>

              {/* Tools */}
              <MenuSection label="Tools">
                <MenuItem label="Local Camera" onClick={() => menuAction(onOpenCamera)} />
                <MenuItem label="Reset Zones" color={COLORS.amber} onClick={() => menuAction(onResetZones)} />
                <MenuItem label="Backup Form" onClick={() => menuAction(onShowBackupForm)} />
              </MenuSection>

              {/* Settings */}
              <MenuSection label="Settings" last>
                {features.training !== false && (
                  <MenuItem
                    label={`Training ${trainingMode ? 'ON' : 'OFF'}`}
                    color={trainingMode ? COLORS.green : COLORS.text3}
                    onClick={() => menuAction(onToggleTraining)}
                  />
                )}
                <MenuItem label="Features" color={COLORS.purple} onClick={() => menuAction(onShowFeatures)} />
                {features.seedData !== false && (
                  <MenuItem label="DEV: Seed Data" color={COLORS.purple} onClick={() => {
                    setMenuOpen(false)
                    ;(async () => {
                      if (!confirm('Replace all QC history and pack log with demo data?')) return
                      const { seed } = await import('../seedData.js')
                      const result = seed()
                      alert(`Seeded ${result.samples} samples, ${result.pallets} pallets. Reloading...`)
                      window.location.reload()
                    })()
                  }} />
                )}
              </MenuSection>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MenuSection({ label, children, last }) {
  // Filter out false-y children (from gated items)
  const visibleChildren = React.Children.toArray(children).filter(Boolean)
  if (visibleChildren.length === 0) return null

  return (
    <div style={{
      borderBottom: last ? 'none' : `1px solid ${COLORS.border}`,
      padding: '6px 0',
    }}>
      <div style={{
        fontFamily: FONT, fontSize: 8, fontWeight: 600,
        color: COLORS.text3, letterSpacing: '0.1em', textTransform: 'uppercase',
        padding: '4px 16px 4px',
      }}>
        {label}
      </div>
      {visibleChildren}
    </div>
  )
}

function MenuItem({ label, color, onClick, gated = true }) {
  if (!gated) return null
  return (
    <button onClick={onClick} style={{
      display: 'block', width: '100%', textAlign: 'left',
      fontFamily: FONT, fontSize: 11,
      color: color || COLORS.text2,
      background: 'transparent', border: 'none',
      padding: '7px 16px', cursor: 'pointer',
      letterSpacing: '0.04em',
    }}
      onMouseEnter={e => e.target.style.background = COLORS.bg3}
      onMouseLeave={e => e.target.style.background = 'transparent'}
    >
      {label}
    </button>
  )
}

function IPDisplay({ ip }) {
  const [showQR, setShowQR] = useState(false)
  const [mode, setMode] = useState('phone')
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
