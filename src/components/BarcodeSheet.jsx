import React, { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { COLORS, FONT } from '../constants'
import { getActiveReceiptsWithStats } from '../receipts'

export default function BarcodeSheet({ onClose }) {
  const [receipts, setReceipts] = useState([])
  const [mode, setMode] = useState('sheet') // 'sheet' or 'label'

  useEffect(() => {
    setReceipts(getActiveReceiptsWithStats())
  }, [])

  const handlePrint = () => {
    window.print()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: COLORS.bg,
      overflowY: 'auto',
    }}>
      {/* Screen-only controls */}
      <div className="no-print" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 24px', background: COLORS.bg2,
        borderBottom: `1px solid ${COLORS.border}`,
      }}>
        <div style={{
          fontFamily: FONT, fontSize: 13, fontWeight: 600,
          color: COLORS.green, letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          Print Barcodes — {receipts.length} receipts
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setMode('sheet')} style={{
              fontFamily: FONT, fontSize: 10, fontWeight: 600,
              color: mode === 'sheet' ? COLORS.green : COLORS.text3,
              background: mode === 'sheet' ? COLORS.greenDim : 'transparent',
              border: `1px solid ${mode === 'sheet' ? COLORS.green : COLORS.border}`,
              padding: '6px 14px', borderRadius: 3, cursor: 'pointer',
            }}>
              Full Sheet
            </button>
            <button onClick={() => setMode('label')} style={{
              fontFamily: FONT, fontSize: 10, fontWeight: 600,
              color: mode === 'label' ? COLORS.amber : COLORS.text3,
              background: mode === 'label' ? COLORS.amberDim : 'transparent',
              border: `1px solid ${mode === 'label' ? COLORS.amber : COLORS.border}`,
              padding: '6px 14px', borderRadius: 3, cursor: 'pointer',
            }}>
              Zebra 4x2
            </button>
          </div>
          <button onClick={handlePrint} style={{
            fontFamily: FONT, fontSize: 11, fontWeight: 600,
            color: COLORS.green, background: COLORS.greenDim,
            border: `1px solid ${COLORS.green}`,
            padding: '8px 20px', borderRadius: 3, cursor: 'pointer',
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            Print
          </button>
          <button onClick={onClose} style={{
            fontFamily: FONT, fontSize: 11, fontWeight: 600,
            color: COLORS.text3, background: 'transparent',
            border: `1px solid ${COLORS.text3}`,
            padding: '8px 20px', borderRadius: 3, cursor: 'pointer',
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            Close
          </button>
        </div>
      </div>

      {receipts.length === 0 ? (
        <div style={{
          fontFamily: FONT, fontSize: 14,
          textAlign: 'center', padding: 60, color: COLORS.text3,
        }}>
          No active receipts to print.
        </div>
      ) : mode === 'sheet' ? (
        <SheetView receipts={receipts} />
      ) : (
        <LabelView receipts={receipts} />
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body, html {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          * {
            color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
          .print-sheet {
            padding: 0.5in !important;
            max-width: none !important;
          }
          .print-labels {
            padding: 0 !important;
            max-width: none !important;
          }
          .zebra-label {
            page-break-after: always;
            margin: 0 !important;
          }
          .zebra-label:last-child {
            page-break-after: avoid;
          }
        }
        @media print and (label) {
          @page {
            size: 4in 2in;
            margin: 0;
          }
        }
      `}</style>
    </div>
  )
}

// ========== FULL SHEET — regular paper, 2-column grid ==========
function SheetView({ receipts }) {
  return (
    <div className="print-sheet" style={{
      padding: 24, maxWidth: 800, margin: '0 auto',
    }}>
      <div style={{
        fontFamily: 'Arial, sans-serif', fontSize: 16, fontWeight: 700,
        textAlign: 'center', marginBottom: 4, color: '#000',
      }}>
        BerryCheck — Dump Scanner Sheet
      </div>
      <div style={{
        fontFamily: 'Arial, sans-serif', fontSize: 11, textAlign: 'center',
        marginBottom: 20, color: '#666',
      }}>
        {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        {' — '}Scan one barcode per pallet dumped
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {receipts.map(r => <SheetCard key={r.id} receipt={r} />)}
      </div>
    </div>
  )
}

function SheetCard({ receipt }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, receipt.id, {
        width: 100, margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      })
    }
  }, [receipt.id])

  return (
    <div style={{
      border: '2px solid #000', borderRadius: 4, padding: 12,
      background: '#fff', display: 'flex', gap: 12, alignItems: 'center',
      pageBreakInside: 'avoid',
    }}>
      <canvas ref={canvasRef} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 18, fontWeight: 700, color: '#000', marginBottom: 2 }}>
          {receipt.receiptNum}
        </div>
        <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 13, fontWeight: 600, color: '#333' }}>
          {receipt.grower}
        </div>
        <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 11, color: '#666' }}>
          {[receipt.variety, receipt.block].filter(Boolean).join(' / ')}
        </div>
        <div style={{
          fontFamily: 'Arial, sans-serif', fontSize: 12, fontWeight: 600,
          color: '#000', marginTop: 4, borderTop: '1px solid #ccc', paddingTop: 4,
        }}>
          {receipt.expectedPallets} pallets — {receipt.expectedLbs ? `${receipt.expectedLbs.toLocaleString()} lbs` : 'no weight'}
        </div>
      </div>
    </div>
  )
}

// ========== ZEBRA 4x2 LABELS — one per receipt ==========
function LabelView({ receipts }) {
  return (
    <div className="print-labels" style={{
      padding: 24, maxWidth: 500, margin: '0 auto',
      display: 'flex', flexDirection: 'column', gap: 20,
    }}>
      <div className="no-print" style={{
        fontFamily: 'Arial, sans-serif', fontSize: 12, color: '#666',
        textAlign: 'center', marginBottom: 8,
      }}>
        Set your printer to 4" x 2" label size. Each receipt prints as a separate label.
      </div>
      {receipts.map(r => <ZebraLabel key={r.id} receipt={r} />)}
    </div>
  )
}

function ZebraLabel({ receipt }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, receipt.id, {
        width: 120, margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      })
    }
  }, [receipt.id])

  // 4in x 2in = 384px x 192px at 96dpi, but we'll use larger for screen preview
  return (
    <div className="zebra-label" style={{
      width: '4in', height: '2in',
      border: '1px solid #000',
      background: '#fff',
      display: 'flex',
      alignItems: 'center',
      padding: '0.1in 0.15in',
      boxSizing: 'border-box',
      overflow: 'hidden',
    }}>
      {/* QR code — left side */}
      <canvas ref={canvasRef} style={{
        flexShrink: 0, width: '1.5in', height: '1.5in',
      }} />

      {/* Text — right side */}
      <div style={{
        flex: 1, paddingLeft: '0.15in',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', overflow: 'hidden',
      }}>
        <div style={{
          fontFamily: 'Arial, sans-serif', fontSize: 22, fontWeight: 900,
          color: '#000', lineHeight: 1.1, marginBottom: 4,
        }}>
          {receipt.receiptNum}
        </div>
        <div style={{
          fontFamily: 'Arial, sans-serif', fontSize: 14, fontWeight: 700,
          color: '#000', marginBottom: 2,
        }}>
          {receipt.grower}
        </div>
        <div style={{
          fontFamily: 'Arial, sans-serif', fontSize: 11, color: '#333',
          marginBottom: 6,
        }}>
          {[receipt.variety, receipt.block].filter(Boolean).join(' / ')}
        </div>
        <div style={{
          fontFamily: 'Arial, sans-serif', fontSize: 12, fontWeight: 700,
          color: '#000', borderTop: '1px solid #999', paddingTop: 4,
        }}>
          {receipt.expectedPallets} pallets
          {receipt.expectedLbs ? ` · ${receipt.expectedLbs.toLocaleString()} lbs` : ''}
        </div>
      </div>
    </div>
  )
}
