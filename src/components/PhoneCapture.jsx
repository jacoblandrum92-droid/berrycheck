import React, { useRef, useState } from 'react'
import { COLORS, FONT } from '../constants'
import { useRelay } from '../useRelay'

/**
 * Minimal phone-only capture UI.
 * Phone acts as a dedicated camera — snap and send to dashboard.
 * No counting, no zones, no score. Just capture + relay.
 */
export default function PhoneCapture() {
  const fileRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [status, setStatus] = useState('ready')

  const { connected, sendImage, lastAck } = useRelay('phone')

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target.result
      setPreview(dataUrl)
      setStatus('sending')

      // Send to dashboard via WebSocket
      const sent = sendImage(dataUrl)
      if (sent) {
        setStatus('sent')
        setTimeout(() => setStatus('ready'), 3000)
      } else {
        setStatus('error')
      }
    }
    reader.readAsDataURL(file)
  }

  const retake = () => {
    setPreview(null)
    setStatus('ready')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div style={{
      background: '#0a0d06', minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      fontFamily: FONT,
    }}>
      {/* Top bar */}
      <div style={{
        padding: '16px 20px 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{
          fontSize: 14, fontWeight: 600, color: COLORS.green,
          letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          BerryCheck
        </div>
        <div style={{
          fontSize: 11, padding: '4px 12px', borderRadius: 20,
          background: connected ? '#0f1a06' : '#1a0805',
          border: `1px solid ${connected ? COLORS.greenDim : COLORS.redDim}`,
          color: connected ? COLORS.green : '#ff6b5b',
        }}>
          {connected ? 'LINKED' : 'NO CONNECTION'}
        </div>
      </div>

      {/* Connection info */}
      {!connected && (
        <div style={{
          margin: '0 20px', padding: 12,
          background: 'rgba(192,57,43,0.1)', border: `1px solid ${COLORS.redDim}`,
          borderRadius: 4, fontSize: 11, color: COLORS.text3, lineHeight: 1.6,
        }}>
          Make sure the relay server is running on the laptop:
          <div style={{ color: COLORS.amber, marginTop: 4 }}>node server.js</div>
        </div>
      )}

      {/* Main area */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '20px 24px', gap: 24,
      }}>
        {!preview ? (
          <>
            <input ref={fileRef} type="file" accept="image/*" capture="environment"
              onChange={handleFile} style={{ display: 'none' }} />

            <div style={{
              fontSize: 12, color: COLORS.text3, textAlign: 'center',
              letterSpacing: '0.06em', lineHeight: 1.6,
            }}>
              {connected
                ? 'Camera ready. Snap the tray.'
                : 'Waiting for dashboard connection...'}
            </div>

            <button
              onClick={() => fileRef.current?.click()}
              disabled={!connected}
              style={{
                width: 100, height: 100, borderRadius: '50%',
                border: `3px solid ${connected ? COLORS.green : COLORS.text3}`,
                background: 'transparent', cursor: connected ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 0, WebkitTapHighlightColor: 'transparent',
                opacity: connected ? 1 : 0.4,
              }}
            >
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: connected ? COLORS.green : COLORS.text3,
              }} />
            </button>

            <div style={{
              fontSize: 10, color: COLORS.text3,
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              TAP TO CAPTURE
            </div>
          </>
        ) : (
          <>
            {/* Preview */}
            <div style={{
              width: '100%', maxWidth: 400, borderRadius: 6,
              overflow: 'hidden', border: `1px solid ${COLORS.border}`,
            }}>
              <img src={preview} style={{ width: '100%', display: 'block' }} alt="Captured" />
            </div>

            {/* Status */}
            <div style={{
              fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: status === 'sent' ? COLORS.green
                : status === 'sending' ? COLORS.amber
                : status === 'error' ? '#ff6b5b'
                : COLORS.text3,
            }}>
              {status === 'sent' ? 'SENT TO DASHBOARD'
                : status === 'sending' ? 'SENDING...'
                : status === 'error' ? 'SEND FAILED — TRY AGAIN'
                : 'READY'}
            </div>

            {lastAck && status === 'sent' && (
              <div style={{ fontSize: 10, color: COLORS.text3 }}>
                Dashboard received image
              </div>
            )}

            {/* Retake */}
            <button onClick={retake} style={{
              fontSize: 12, fontWeight: 600, color: COLORS.green,
              background: COLORS.greenDim, border: `1px solid ${COLORS.green}`,
              padding: '12px 32px', borderRadius: 3, cursor: 'pointer',
              letterSpacing: '0.08em', textTransform: 'uppercase',
              fontFamily: FONT,
            }}>
              NEXT SAMPLE
            </button>
          </>
        )}
      </div>
    </div>
  )
}
