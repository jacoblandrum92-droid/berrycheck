import React from 'react'
import { COLORS, FONT } from '../constants'

export default function BackupForm({ onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: COLORS.bg, overflowY: 'auto',
    }}>
      {/* Screen controls */}
      <div className="no-print" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 24px', background: COLORS.bg2,
        borderBottom: `1px solid ${COLORS.border}`,
      }}>
        <div style={{
          fontFamily: FONT, fontSize: 13, fontWeight: 600,
          color: COLORS.green, letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          Backup QC Form — Print a Stack
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => window.print()} style={{
            fontFamily: FONT, fontSize: 11, fontWeight: 600,
            color: COLORS.green, background: COLORS.greenDim,
            border: `1px solid ${COLORS.green}`,
            padding: '8px 20px', borderRadius: 3, cursor: 'pointer',
          }}>PRINT</button>
          <button onClick={onClose} style={{
            fontFamily: FONT, fontSize: 11, fontWeight: 600,
            color: COLORS.text3, background: 'transparent',
            border: `1px solid ${COLORS.text3}`,
            padding: '8px 20px', borderRadius: 3, cursor: 'pointer',
          }}>CLOSE</button>
        </div>
      </div>

      {/* Printable form — two per page */}
      <div className="print-forms" style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
        <PalletForm />
        <div style={{ pageBreakAfter: 'always' }} />
        <PalletForm />
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-forms { padding: 0 !important; max-width: none !important; }
          body, html { background: white !important; margin: 0 !important; }
        }
      `}</style>
    </div>
  )
}

function PalletForm() {
  const cell = {
    border: '1px solid #999', padding: '6px 8px',
    fontFamily: 'Arial, sans-serif', fontSize: 11,
  }
  const label = {
    ...cell, fontWeight: 700, background: '#f0f0f0', width: 120,
  }
  const blank = {
    ...cell, minHeight: 22,
  }
  const bigBlank = {
    ...cell, minHeight: 30, fontSize: 14,
  }

  return (
    <div style={{
      border: '2px solid #000', borderRadius: 4, padding: 16,
      marginBottom: 24, pageBreakInside: 'avoid',
      fontFamily: 'Arial, sans-serif',
    }}>
      <div style={{
        fontSize: 16, fontWeight: 900, textAlign: 'center',
        marginBottom: 2, letterSpacing: '0.05em',
      }}>
        BerryCheck QC — Backup Form
      </div>
      <div style={{
        fontSize: 9, textAlign: 'center', color: '#666', marginBottom: 12,
      }}>
        Use when app is unavailable. Enter data into app later.
      </div>

      {/* Header info */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <tbody>
          <tr>
            <td style={label}>Date</td>
            <td style={blank}></td>
            <td style={label}>Pallet Tag</td>
            <td style={blank}></td>
            <td style={label}>Daily Pallet #</td>
            <td style={{ ...blank, width: 60 }}></td>
          </tr>
          <tr>
            <td style={label}>Pack Code</td>
            <td style={blank}></td>
            <td style={label}>Pack Criteria</td>
            <td colSpan={3} style={blank}>
              <span style={{ fontSize: 9, color: '#999' }}>Standard / Mighty Blue / Sweet Sel</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Receipt segments */}
      <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 4 }}>
        Receipts on this pallet:
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <thead>
          <tr>
            <th style={{ ...cell, fontWeight: 700, background: '#f0f0f0' }}>Receipt #</th>
            <th style={{ ...cell, fontWeight: 700, background: '#f0f0f0' }}>Grower</th>
            <th style={{ ...cell, fontWeight: 700, background: '#f0f0f0' }}>Variety</th>
            <th style={{ ...cell, fontWeight: 700, background: '#f0f0f0', width: 70 }}>Boxes</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style={blank}></td><td style={blank}></td><td style={blank}></td><td style={blank}></td></tr>
          <tr><td style={blank}></td><td style={blank}></td><td style={blank}></td><td style={blank}></td></tr>
          <tr><td style={blank}></td><td style={blank}></td><td style={blank}></td><td style={blank}></td></tr>
        </tbody>
      </table>

      {/* QC Samples */}
      <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 4 }}>
        QC Samples (600g each):
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <thead>
          <tr>
            <th style={{ ...cell, fontWeight: 700, background: '#f0f0f0' }}>Layer</th>
            <th style={{ ...cell, fontWeight: 700, background: '#f0f0f0' }}>30-Berry Wt (g)</th>
            <th style={{ ...cell, fontWeight: 700, background: '#f0f0f0' }}>Good</th>
            <th style={{ ...cell, fontWeight: 700, background: '#f0f0f0' }}>Permanent</th>
            <th style={{ ...cell, fontWeight: 700, background: '#f0f0f0' }}>Condition</th>
            <th style={{ ...cell, fontWeight: 700, background: '#f0f0f0' }}>Decay</th>
            <th style={{ ...cell, fontWeight: 700, background: '#f0f0f0' }}>Grade</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...cell, fontWeight: 600 }}>#1 Bottom</td>
            <td style={blank}></td><td style={blank}></td><td style={blank}></td>
            <td style={blank}></td><td style={blank}></td><td style={blank}></td>
          </tr>
          <tr>
            <td style={{ ...cell, fontWeight: 600 }}>#2 Middle</td>
            <td style={blank}></td><td style={blank}></td><td style={blank}></td>
            <td style={blank}></td><td style={blank}></td><td style={blank}></td>
          </tr>
          <tr>
            <td style={{ ...cell, fontWeight: 600 }}>#3 Top</td>
            <td style={blank}></td><td style={blank}></td><td style={blank}></td>
            <td style={blank}></td><td style={blank}></td><td style={blank}></td>
          </tr>
          <tr>
            <td style={{ ...cell, color: '#999' }}>Extra</td>
            <td style={blank}></td><td style={blank}></td><td style={blank}></td>
            <td style={blank}></td><td style={blank}></td><td style={blank}></td>
          </tr>
        </tbody>
      </table>

      {/* Operations */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <tbody>
          <tr>
            <td style={label}>Lbs/Hr</td>
            <td style={blank}></td>
            <td style={label}>Blowoff %</td>
            <td style={blank}></td>
            <td style={label}>Size Sort %</td>
            <td style={blank}></td>
          </tr>
          <tr>
            <td style={label}>Pallet Grade</td>
            <td style={bigBlank}></td>
            <td style={label}>DC Strictness</td>
            <td style={blank}>
              <span style={{ fontSize: 9, color: '#999' }}>1-5</span>
            </td>
            <td style={label}>Time</td>
            <td style={blank}></td>
          </tr>
        </tbody>
      </table>

      {/* Defect reference */}
      <div style={{
        fontSize: 8, color: '#999', lineHeight: 1.5,
        borderTop: '1px solid #ccc', paddingTop: 6,
      }}>
        <b>Permanent:</b> stems, green/red, scars &nbsp;|&nbsp;
        <b>Condition:</b> soft, bruise, shrivel, crushed, leaky &nbsp;|&nbsp;
        <b>Decay:</b> rot (alternaria/anthracnose), white mold &nbsp;|&nbsp;
        <b>Procedure:</b> 600g sample → pull 30 berries, weigh → sort defects → count piles
      </div>
    </div>
  )
}
