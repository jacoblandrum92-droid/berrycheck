import React, { useState, useRef, useEffect } from 'react'
import QRCode from 'qrcode'
import { COLORS, FONT } from '../constants'

export default function ShareButton({ getSnapshot, label }) {
  const [shareUrl, setShareUrl] = useState(null)
  const canvasRef = useRef(null)

  const handleShare = async () => {
    const snapshot = getSnapshot()
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot),
      })
      const data = await res.json()
      setShareUrl(data.url)
    } catch (err) {
      console.error('Share error:', err)
    }
  }

  useEffect(() => {
    if (shareUrl && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, shareUrl, {
        width: 200, margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      })
    }
  }, [shareUrl])

  return (
    <>
      <button onClick={handleShare} title={label || 'Share via QR'}
        style={{
          fontFamily: FONT, fontSize: 10, color: COLORS.text3,
          background: 'transparent', border: `1px solid ${COLORS.border}`,
          padding: '3px 8px', borderRadius: 3, cursor: 'pointer',
          letterSpacing: '0.04em',
        }}>
        QR
      </button>

      {shareUrl && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setShareUrl(null)}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 28,
            textAlign: 'center', minWidth: 280,
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              fontFamily: FONT, fontSize: 14, fontWeight: 700,
              color: COLORS.text, marginBottom: 4,
            }}>
              Scan to View
            </div>
            <div style={{
              fontFamily: FONT, fontSize: 11, color: COLORS.text3,
              marginBottom: 16,
            }}>
              {label || 'Share this data'}
            </div>

            <canvas ref={canvasRef} style={{ display: 'block', margin: '0 auto' }} />

            <div style={{
              fontFamily: FONT, fontSize: 10, color: COLORS.text3,
              marginTop: 12, wordBreak: 'break-all',
            }}>
              {shareUrl}
            </div>

            <button onClick={() => setShareUrl(null)} style={{
              fontFamily: FONT, fontSize: 11, color: COLORS.text3,
              background: 'transparent', border: `1px solid ${COLORS.border}`,
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
