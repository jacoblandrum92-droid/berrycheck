import React, { useState } from 'react'
import { COLORS, FONT, gradeSample } from '../constants'

const GRADE_BG = {
  excellent: '#0F6E5615', ok: '#0F6E5615',
  warn: '#BA751715', fail: '#A32D2D15', none: COLORS.bg3,
}
const GRADE_TEXT = {
  excellent: '#0F6E56', ok: '#0F6E56',
  warn: '#BA7517', fail: '#A32D2D', none: '#999',
}
const GRADE_BORDER = {
  excellent: '#0F6E5640', ok: '#0F6E5640',
  warn: '#BA751740', fail: '#A32D2D40', none: COLORS.border,
}

export default function SampleHistory({ history, onClear }) {
  const [expanded, setExpanded] = useState(false)
  const recent = [...history].reverse()
  const shown = expanded ? recent : recent.slice(0, 5)
  const todaySamples = history.filter(s => s.date === new Date().toLocaleDateString() && !s.isSkipped)
  const todayGrades = todaySamples.map(s => gradeSample(s))
  const avgScore = todayGrades.length > 0
    ? Math.round(todayGrades.reduce((sum, g) => sum + (g.score || 0), 0) / todayGrades.length)
    : null

  return (
    <div style={{
      background: COLORS.bg, border: `1px solid ${COLORS.border}`,
      borderRadius: 8, overflow: 'hidden',
    }}>
      {/* Header card */}
      <div style={{
        padding: '14px 18px', borderBottom: `1px solid ${COLORS.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: COLORS.bg2,
      }}>
        <div>
          <div style={{
            fontFamily: FONT, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase', color: COLORS.text,
          }}>
            Sample Log
          </div>
          <div style={{
            fontFamily: FONT, fontSize: 10, color: COLORS.text3, marginTop: 2,
          }}>
            {todaySamples.length} today{history.length > todaySamples.length ? ` · ${history.length} total` : ''}
            {avgScore !== null && (
              <span style={{ color: avgScore >= 70 ? COLORS.green : avgScore >= 40 ? COLORS.amber : COLORS.red, fontWeight: 600 }}>
                {' '}· avg score {avgScore}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {history.length > 5 && (
            <button onClick={() => setExpanded(!expanded)} style={{
              fontFamily: FONT, fontSize: 9, fontWeight: 600,
              color: COLORS.text3, background: 'transparent',
              border: `1px solid ${COLORS.border}`, padding: '4px 10px',
              borderRadius: 3, cursor: 'pointer', letterSpacing: '0.06em',
            }}>{expanded ? 'LESS' : `ALL ${history.length}`}</button>
          )}
          {history.length > 0 && (
            <button onClick={onClear} style={{
              fontFamily: FONT, fontSize: 9, fontWeight: 600,
              color: COLORS.red, background: 'transparent',
              border: `1px solid ${COLORS.red}30`, padding: '4px 10px',
              borderRadius: 3, cursor: 'pointer', letterSpacing: '0.06em',
            }}>CLEAR</button>
          )}
        </div>
      </div>

      {/* Sample cards */}
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {shown.length === 0 ? (
          <div style={{
            fontFamily: FONT, fontSize: 11, color: COLORS.text3,
            textAlign: 'center', padding: '24px 0',
          }}>
            No samples logged yet
          </div>
        ) : shown.map(s => {
          const result = gradeSample(s)
          const color = GRADE_TEXT[result.status] || COLORS.text3
          const bg = GRADE_BG[result.status] || COLORS.bg3
          const border = GRADE_BORDER[result.status] || COLORS.border

          const typeLabel = s.isSkipped ? 'SKIP' : s.isExtra ? 'EXTRA'
            : s.sampleNum ? `L${s.sampleNum}` : 'SOP'
          const typeColor = s.isSkipped ? COLORS.text3
            : s.isExtra ? COLORS.purple : COLORS.green

          return (
            <div key={s.id} style={{
              background: bg, border: `1px solid ${border}`,
              borderRadius: 6, padding: '10px 14px',
              opacity: s.isSkipped ? 0.4 : s.isExtra ? 0.7 : 1,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              {/* Grade badge */}
              <div style={{
                minWidth: 52, textAlign: 'center',
              }}>
                <div style={{
                  fontFamily: FONT, fontSize: 13, fontWeight: 800,
                  color, letterSpacing: '0.04em', lineHeight: 1,
                }}>{result.label}</div>
                <div style={{
                  fontFamily: FONT, fontSize: 9, color: COLORS.text3, marginTop: 3,
                }}>{result.pctCombined}%</div>
              </div>

              <div style={{ width: 1, height: 32, background: border }} />

              {/* Details */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{
                    fontFamily: FONT, fontSize: 10, fontWeight: 700, color: typeColor,
                  }}>{typeLabel}</span>
                  <span style={{
                    fontFamily: FONT, fontSize: 10, fontWeight: 600, color: COLORS.text,
                  }}>{s.lotId || '—'}</span>
                  {s.packLine && (
                    <span style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3 }}>
                      L{s.packLine}
                    </span>
                  )}
                  <span style={{
                    fontFamily: FONT, fontSize: 9, color: COLORS.text3,
                  }}>{s.time}</span>
                </div>
                <div style={{ display: 'flex', gap: 10, fontFamily: FONT, fontSize: 9, color: COLORS.text3 }}>
                  <span>{result.total} berries</span>
                  <span style={{ color: COLORS.text2 }}>{s.permanent || 0}P</span>
                  <span style={{ color: COLORS.text2 }}>{s.condition || 0}C</span>
                  {(s.decay || 0) > 0 && (
                    <span style={{ color: COLORS.red, fontWeight: 600 }}>{s.decay}D</span>
                  )}
                  {s.grower && <span>{s.grower}</span>}
                  {s._sampleMethod === 'pint' && <span style={{ color: '#10B981' }}>PINT</span>}
                </div>
              </div>

              {/* Score */}
              <div style={{
                fontFamily: FONT, fontSize: 18, fontWeight: 800,
                color, minWidth: 32, textAlign: 'right',
              }}>
                {result.score > 0 ? result.score : '—'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
