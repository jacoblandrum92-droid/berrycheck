import React from 'react'
import { COLORS, FONT, gradeSample } from '../constants'

const GRADE_BG = {
  excellent: '#E1F5EE', ok: '#E1F5EE',
  warn: '#FAEEDA', fail: '#FCEBEB', none: '#f7f7f5',
}
const GRADE_TEXT = {
  excellent: '#0F6E56', ok: '#0F6E56',
  warn: '#BA7517', fail: '#A32D2D', none: '#999',
}

export default function SampleHistory({ history, onClear }) {
  const thStyle = {
    fontFamily: FONT, fontSize: 9, color: COLORS.text3,
    textTransform: 'uppercase', letterSpacing: '0.08em',
    textAlign: 'left', padding: '7px 12px',
    borderBottom: `1px solid ${COLORS.border}`, fontWeight: 500,
  }
  const tdStyle = {
    fontFamily: FONT, fontSize: 11, color: COLORS.text2, padding: '9px 12px',
  }

  return (
    <div style={{
      background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
      borderRadius: 4, overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 16px', borderBottom: `1px solid ${COLORS.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{
          fontFamily: FONT, fontSize: 10, fontWeight: 600,
          letterSpacing: '0.12em', textTransform: 'uppercase', color: COLORS.text3,
        }}>Sample History</div>
        {history.length > 0 && (
          <button onClick={onClear} style={{
            fontFamily: FONT, fontSize: 9, color: COLORS.text3,
            background: 'transparent', border: `1px solid ${COLORS.border}`,
            padding: '3px 9px', borderRadius: 2, cursor: 'pointer',
            letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>Clear</button>
        )}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>#</th>
              <th style={thStyle}>Time</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Tag</th>
              <th style={thStyle}>Receipt</th>
              <th style={thStyle}>Grower</th>
              <th style={thStyle}>Total</th>
              <th style={thStyle}>Perm</th>
              <th style={thStyle}>Cond</th>
              <th style={thStyle}>Decay</th>
              <th style={thStyle}>Defect %</th>
              <th style={thStyle}>Grade</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={12} style={{ ...tdStyle, textAlign: 'center', padding: 28, color: COLORS.text3 }}>
                  No samples logged yet
                </td>
              </tr>
            ) : (
              [...history].reverse().map(s => {
                const result = gradeSample(s)
                const color = GRADE_TEXT[result.status] || COLORS.text3
                const bg = GRADE_BG[result.status] || '#f7f7f5'

                return (
                  <tr key={s.id} style={{
                    borderBottom: `1px solid ${COLORS.border}`,
                    opacity: s.isExtra ? 0.6 : 1,
                  }}>
                    <td style={{ ...tdStyle, fontWeight: 700, color: COLORS.green }}>{s.dailyPalletNum || '—'}</td>
                    <td style={tdStyle}>{s.time}</td>
                    <td style={tdStyle}>
                      {s.isExtra ? (
                        <span style={{ fontSize: 9, fontWeight: 600, color: COLORS.purple }}>EXTRA</span>
                      ) : (
                        <span style={{ fontSize: 9, fontWeight: 600, color: COLORS.text3 }}>
                          {s.sampleNum ? `#${s.sampleNum}` : 'SOP'}
                        </span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, color: COLORS.text }}>{s.lotId || '—'}</td>
                    <td style={tdStyle}>{s.receiptNum || '—'}</td>
                    <td style={tdStyle}>{s.grower || '—'}</td>
                    <td style={tdStyle}>{result.total}</td>
                    <td style={tdStyle}>{s.permanent || 0}</td>
                    <td style={tdStyle}>{s.condition || 0}</td>
                    <td style={{ ...tdStyle, color: (s.decay || 0) > 0 ? COLORS.red : COLORS.text2 }}>
                      {s.decay || 0}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600, color }}>
                      {result.pctCombined}%
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        fontFamily: FONT, fontSize: 10, fontWeight: 600,
                        padding: '2px 7px', borderRadius: 2, letterSpacing: '0.04em',
                        background: bg, color,
                      }}>{result.label}</span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
