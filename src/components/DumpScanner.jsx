import React, { useState, useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { COLORS, FONT } from '../constants'
import { findReceipt, logScan, getReceiptStats } from '../receipts'

export default function DumpScanner() {
  const [scanning, setScanning] = useState(false)
  const [lastScan, setLastScan] = useState(null)
  const [error, setError] = useState(null)
  const [cameraReady, setCameraReady] = useState(false)
  const scannerRef = useRef(null)
  const scannerInstanceRef = useRef(null)
  const cooldownRef = useRef(false)

  const startScanner = async () => {
    setError(null)
    try {
      const scanner = new Html5Qrcode('dump-scanner-video')
      scannerInstanceRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        (decodedText) => {
          // Prevent rapid double-scans
          if (cooldownRef.current) return
          cooldownRef.current = true
          setTimeout(() => { cooldownRef.current = false }, 2000)

          handleScan(decodedText)
        },
        () => {} // ignore scan failures (no QR in frame)
      )
      setCameraReady(true)
      setScanning(true)
    } catch (err) {
      setError(`Camera error: ${err.message || err}`)
    }
  }

  const stopScanner = async () => {
    if (scannerInstanceRef.current) {
      try {
        await scannerInstanceRef.current.stop()
        scannerInstanceRef.current.clear()
      } catch {}
      scannerInstanceRef.current = null
    }
    setScanning(false)
    setCameraReady(false)
  }

  useEffect(() => {
    return () => { stopScanner() }
  }, [])

  const handleScan = (receiptId) => {
    const receipt = findReceipt(receiptId)
    if (!receipt) {
      setLastScan({ error: true, message: 'UNKNOWN CODE', id: receiptId })
      return
    }

    const result = logScan(receipt.id)
    if (!result) {
      setLastScan({ error: true, message: 'SCAN FAILED' })
      return
    }

    const stats = getReceiptStats(result.receipt)
    setLastScan({
      error: false,
      receipt: result.receipt,
      scan: result.scan,
      stats,
    })
  }

  return (
    <div style={{
      background: COLORS.bg, minHeight: '100vh',
      color: COLORS.text, fontFamily: FONT,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Top bar */}
      <div style={{
        padding: '12px 16px',
        background: COLORS.bg2,
        borderBottom: `1px solid ${COLORS.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{
          fontSize: 14, fontWeight: 600,
          color: COLORS.green, letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>
          Dump Scanner
        </div>
        <div style={{
          fontSize: 10, color: scanning ? COLORS.green : COLORS.text3,
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          {scanning ? 'CAMERA ACTIVE' : 'CAMERA OFF'}
        </div>
      </div>

      {/* Scanner area */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 20, gap: 20,
      }}>
        {/* Camera viewfinder */}
        <div
          id="dump-scanner-video"
          ref={scannerRef}
          style={{
            width: 300, height: 300,
            background: COLORS.bg2,
            borderRadius: 8,
            border: `2px solid ${scanning ? COLORS.green : COLORS.border2}`,
            overflow: 'hidden',
          }}
        />

        {/* Start/Stop button */}
        {!scanning ? (
          <button onClick={startScanner} style={{
            fontFamily: FONT, fontSize: 16, fontWeight: 700,
            color: COLORS.green, background: COLORS.greenDim,
            border: `2px solid ${COLORS.green}`,
            padding: '16px 48px', borderRadius: 8, cursor: 'pointer',
            letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            Start Scanner
          </button>
        ) : (
          <button onClick={stopScanner} style={{
            fontFamily: FONT, fontSize: 12, fontWeight: 600,
            color: COLORS.text3, background: 'transparent',
            border: `1px solid ${COLORS.text3}`,
            padding: '10px 24px', borderRadius: 4, cursor: 'pointer',
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            Stop Camera
          </button>
        )}

        {error && (
          <div style={{
            fontFamily: FONT, fontSize: 12, color: COLORS.red,
            background: COLORS.redDim, border: `1px solid ${COLORS.red}`,
            padding: '10px 16px', borderRadius: 4,
            maxWidth: 400, textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        {/* Last scan result */}
        {lastScan && !lastScan.error && (
          <div style={{
            background: COLORS.bg2, border: `2px solid ${COLORS.green}`,
            borderRadius: 8, padding: 20,
            width: '100%', maxWidth: 400,
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: 11, color: COLORS.green,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              marginBottom: 8,
            }}>
              Pallet Scanned
            </div>
            <div style={{
              fontSize: 24, fontWeight: 700, color: COLORS.green,
              marginBottom: 4,
            }}>
              {lastScan.receipt.receiptNum}
            </div>
            <div style={{
              fontSize: 14, color: COLORS.text, fontWeight: 600,
              marginBottom: 2,
            }}>
              {lastScan.receipt.grower}
            </div>
            <div style={{
              fontSize: 11, color: COLORS.text3,
              marginBottom: 12,
            }}>
              {[lastScan.receipt.variety, lastScan.receipt.block].filter(Boolean).join(' / ')}
            </div>

            {/* Progress */}
            <div style={{
              display: 'flex', justifyContent: 'center', alignItems: 'baseline',
              gap: 8, marginBottom: 8,
            }}>
              <span style={{
                fontSize: 36, fontWeight: 700,
                color: lastScan.stats.remaining === 0 ? COLORS.green : COLORS.amber,
              }}>
                {lastScan.stats.scanned}
              </span>
              <span style={{ fontSize: 14, color: COLORS.text3 }}>
                / {lastScan.receipt.expectedPallets}
              </span>
            </div>

            {/* Progress bar */}
            <div style={{
              height: 8, background: COLORS.bg3, borderRadius: 4,
              overflow: 'hidden', marginBottom: 8,
            }}>
              <div style={{
                height: '100%', borderRadius: 4,
                background: lastScan.stats.pctComplete >= 100 ? COLORS.green : COLORS.amber,
                width: `${Math.min(100, lastScan.stats.pctComplete)}%`,
                transition: 'width 0.3s',
              }} />
            </div>

            <div style={{
              fontSize: 12, color: COLORS.text3,
            }}>
              {lastScan.stats.remaining === 0
                ? 'RECEIPT COMPLETE'
                : `${lastScan.stats.remaining} raw pallets remaining`
              }
            </div>

            {lastScan.stats.lbsRemaining > 0 && (
              <div style={{
                fontSize: 10, color: COLORS.text3, marginTop: 4,
              }}>
                ~{lastScan.stats.lbsRemaining.toLocaleString()} lbs left
              </div>
            )}
          </div>
        )}

        {lastScan && lastScan.error && (
          <div style={{
            background: COLORS.bg2, border: `2px solid ${COLORS.red}`,
            borderRadius: 8, padding: 20,
            width: '100%', maxWidth: 400,
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: 16, fontWeight: 700, color: COLORS.red,
              marginBottom: 4,
            }}>
              {lastScan.message}
            </div>
            <div style={{
              fontSize: 10, color: COLORS.text3,
            }}>
              This barcode doesn't match any active receipt
            </div>
          </div>
        )}

        {/* Instructions */}
        {!lastScan && scanning && (
          <div style={{
            fontSize: 13, color: COLORS.text3,
            textAlign: 'center', maxWidth: 300,
            lineHeight: 1.6,
          }}>
            Point camera at the QR code on the barcode sheet.
            One scan per raw pallet dumped.
          </div>
        )}
      </div>
    </div>
  )
}
