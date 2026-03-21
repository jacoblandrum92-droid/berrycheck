import React from 'react'
import { COLORS, FONT, gradeSample } from '../constants'

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
              <th style={thStyle}>Time</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Pallet</th>
              <th style={thStyle}>Grower</th>
              <th style={thStyle}>Total</th>
              <th style={thStyle}>Soft</th>
              <th style={thStyle}>Major</th>
              <th style={thStyle}>Minor</th>
              <th style={thStyle}>Score</th>
              <th style={thStyle}>Grade</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ ...tdStyle, textAlign: 'center', padding: 28, color: COLORS.text3 }}>
                  No samples logged yet
                </td>
              </tr>
            ) : (
              [...history].reverse().map(s => {
                const result = gradeSample(s)
                const totalMinor = (s.reds || 0) + (s.greens || 0) + (s.defects || 0)

                const scoreColor = result.status === 'zero_tolerance' ? '#ff0040'
                  : result.status === 'fail' ? '#ff6b5b'
                  : result.status === 'warn' ? COLORS.amber
                  : COLORS.green

                const gradeColor = result.status === 'fail' || result.status === 'zero_tolerance'
                  ? '#ff6b5b' : COLORS.green
                const gradeBg = result.status === 'fail' || result.status === 'zero_tolerance'
                  ? 'rgba(192,57,43,0.12)' : 'rgba(124,184,66,0.12)'
                const gradeBorder = result.status === 'fail' || result.status === 'zero_tolerance'
                  ? COLORS.redDim : COLORS.greenDim

                return (
                  <tr key={s.id} style={{
                    borderBottom: `1px solid ${COLORS.border}`,
                    opacity: s.isExtra ? 0.6 : 1,
                  }}>
                    <td style={tdStyle}>{s.time}</td>
                    <td style={tdStyle}>
                      {s.isExtra ? (
                        <span style={{
                          fontFamily: FONT, fontSize: 9, fontWeight: 600,
                          color: COLORS.purple, letterSpacing: '0.04em',
                        }}>EXTRA</span>
                      ) : (
                        <span style={{
                          fontFamily: FONT, fontSize: 9, fontWeight: 600,
                          color: COLORS.text3,
                        }}>{s.sampleNum ? `#${s.sampleNum}` : 'SOP'}</span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, color: COLORS.text }}>{s.lotId || '—'}</td>
                    <td style={tdStyle}>{s.grower || '—'}</td>
                    <td style={tdStyle}>{result.total}</td>
                    <td style={{ ...tdStyle, color: (s.soft || 0) > 2 ? '#ff6b5b' : COLORS.text2 }}>
                      {s.soft || 0}/2
                    </td>
                    <td style={{ ...tdStyle, color: (s.major || 0) > 1 ? '#ff6b5b' : COLORS.text2 }}>
                      {s.major || 0}/1
                    </td>
                    <td style={{ ...tdStyle, color: totalMinor > 16 ? '#ff6b5b' : COLORS.text2 }}>
                      {totalMinor}/16
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: scoreColor }}>
                      {result.score === null ? 'FAIL' : (result.score > 0 ? '+' : '') + result.score}
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        fontFamily: FONT, fontSize: 10, fontWeight: 600,
                        padding: '2px 7px', borderRadius: 2, letterSpacing: '0.04em',
                        background: gradeBg, color: gradeColor,
                        border: `1px solid ${gradeBorder}`,
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
