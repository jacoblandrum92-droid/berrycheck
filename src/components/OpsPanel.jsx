import React, { useState, useEffect } from 'react'
import { COLORS, FONT } from '../constants'

/**
 * Operations Panel
 *
 * Two controls:
 * 1. DC Strictness (1-5) — weekly estimate from owner/Jacob on how strict the DC will grade
 * 2. Target Berry Score slider — where we want to be running
 *
 * Plus placeholder for future Weco 360 sorter integration.
 *
 * The real operations score will come from:
 *   Sorter throughput (lbs/hr) + Blowoff rate (%) + QC berry score
 * Until we have sorter data, this panel gives a rough directional guide.
 */

const DC_LEVELS = [
  { level: 1, label: 'Very Loose', desc: 'Supply short, DC accepting almost everything', color: COLORS.green },
  { level: 2, label: 'Loose', desc: 'Below average strictness, some room to push', color: '#8bc34a' },
  { level: 3, label: 'Normal', desc: 'Standard grading, stay within MBG', color: COLORS.amber },
  { level: 4, label: 'Strict', desc: 'Above average scrutiny, keep headroom', color: '#e06030' },
  { level: 5, label: 'Very Strict', desc: 'Peak supply or DC cracking down, run clean', color: '#ff6b5b' },
]

export default function OpsPanel({ berryScore, history, lotId }) {
  const [dcStrictness, setDcStrictness] = useState(() => {
    try { return parseInt(localStorage.getItem('bc_dc_strictness') || '3') } catch { return 3 }
  })
  const [targetScore, setTargetScore] = useState(() => {
    try { return parseInt(localStorage.getItem('bc_target_score') || '25') } catch { return 25 }
  })

  // Save when changed
  useEffect(() => {
    localStorage.setItem('bc_dc_strictness', dcStrictness.toString())
  }, [dcStrictness])

  useEffect(() => {
    localStorage.setItem('bc_target_score', targetScore.toString())
  }, [targetScore])

  // Log DC strictness changes with timestamp
  const updateStrictness = (level) => {
    setDcStrictness(level)
    try {
      const log = JSON.parse(localStorage.getItem('bc_dc_log') || '[]')
      log.push({
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString('en-US', { hour12: false }),
        level,
        label: DC_LEVELS[level - 1].label,
      })
      localStorage.setItem('bc_dc_log', JSON.stringify(log))
    } catch {}
  }

  const dcInfo = DC_LEVELS[dcStrictness - 1]

  // Suggested target based on DC strictness
  const suggestedTarget = {
    1: 5,    // DC is loose, run tight to threshold
    2: 15,
    3: 25,   // Normal, comfortable headroom
    4: 40,
    5: 60,   // DC is strict, run very clean
  }[dcStrictness]

  // How are we doing vs target?
  const hasScore = berryScore !== null && berryScore !== undefined
  const delta = hasScore ? berryScore - targetScore : null
  const opsStatus = !hasScore ? 'neutral'
    : delta > 30 ? 'speed_up'     // way above target, wasting capacity
    : delta > 10 ? 'above'        // above target, could push a bit
    : delta >= -10 ? 'dialed'     // in the zone
    : delta >= -25 ? 'watch'      // below target
    : 'over'                      // well below, slow down

  const opsLabels = {
    neutral: { text: 'WAITING FOR DATA', color: COLORS.text3 },
    speed_up: { text: 'SPEED UP — CAPACITY AVAILABLE', color: COLORS.amber },
    above: { text: 'ABOVE TARGET — ROOM TO PUSH', color: COLORS.green },
    dialed: { text: 'DIALED IN', color: COLORS.green },
    watch: { text: 'BELOW TARGET — WATCH IT', color: COLORS.amber },
    over: { text: 'OVER — SLOW DOWN', color: '#ff6b5b' },
  }

  const ops = opsLabels[opsStatus]

  return (
    <div style={{
      background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
      borderRadius: 4, padding: '14px 16px',
    }}>
      <div style={{
        fontFamily: FONT, fontSize: 10, fontWeight: 600,
        letterSpacing: '0.12em', textTransform: 'uppercase',
        color: COLORS.text3, marginBottom: 12,
      }}>
        Operations
      </div>

      {/* Warning caveat */}
      <div style={{
        background: COLORS.amberDim + '20', border: `1px solid ${COLORS.amberDim}`,
        borderRadius: 3, padding: '6px 10px', marginBottom: 14,
        fontFamily: FONT, fontSize: 9, color: COLORS.amber,
        lineHeight: 1.5,
      }}>
        PLACEHOLDER — This score is an estimate based on DC strictness and berry score only.
        The real operations score requires Weco 360 sorter data (throughput + blowoff rate)
        integrated with QC grades. Do not make major line speed decisions from this alone.
      </div>

      {/* Ops status indicator */}
      <div style={{
        background: COLORS.bg3, border: `1px solid ${ops.color}40`,
        borderRadius: 4, padding: '10px 14px', marginBottom: 14,
        textAlign: 'center',
      }}>
        <div style={{
          fontFamily: FONT, fontSize: 12, fontWeight: 700,
          color: ops.color, letterSpacing: '0.08em',
        }}>
          {ops.text}
        </div>
        {hasScore && (
          <div style={{
            fontFamily: FONT, fontSize: 10, color: COLORS.text3, marginTop: 4,
          }}>
            Berry score {berryScore > 0 ? '+' : ''}{berryScore} vs target {targetScore > 0 ? '+' : ''}{targetScore}
            {delta !== null ? ` (${delta > 0 ? '+' : ''}${delta})` : ''}
          </div>
        )}
      </div>

      {/* DC Strictness */}
      <div style={{ marginBottom: 14 }}>
        <div style={{
          fontFamily: FONT, fontSize: 9, color: COLORS.text3,
          letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6,
        }}>
          DC Strictness This Week
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {DC_LEVELS.map(dc => (
            <button key={dc.level} onClick={() => updateStrictness(dc.level)} style={{
              flex: 1, fontFamily: FONT, fontSize: 12, fontWeight: 700,
              color: dcStrictness === dc.level ? dc.color : COLORS.text3,
              background: dcStrictness === dc.level ? dc.color + '20' : 'transparent',
              border: `1px solid ${dcStrictness === dc.level ? dc.color : COLORS.border}`,
              padding: '8px 4px', borderRadius: 3, cursor: 'pointer',
            }}>
              {dc.level}
            </button>
          ))}
        </div>
        <div style={{
          fontFamily: FONT, fontSize: 10, marginTop: 6,
          color: dcInfo.color,
        }}>
          <span style={{ fontWeight: 600 }}>{dcInfo.label}</span>
          <span style={{ color: COLORS.text3 }}> — {dcInfo.desc}</span>
        </div>
      </div>

      {/* Target Score Slider */}
      <div style={{ marginBottom: 14 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 6,
        }}>
          <div style={{
            fontFamily: FONT, fontSize: 9, color: COLORS.text3,
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            Target Berry Score
          </div>
          <div style={{
            fontFamily: FONT, fontSize: 14, fontWeight: 700,
            color: COLORS.green,
          }}>
            +{targetScore}
          </div>
        </div>
        <input type="range" min="-20" max="80" value={targetScore}
          onChange={e => setTargetScore(parseInt(e.target.value))}
          style={{ width: '100%', accentColor: COLORS.green }}
        />
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontFamily: FONT, fontSize: 8, color: COLORS.text3,
          marginTop: 2,
        }}>
          <span>PUSH IT (-20)</span>
          <span>SAFE (+80)</span>
        </div>
        {Math.abs(targetScore - suggestedTarget) > 15 && (
          <div style={{
            fontFamily: FONT, fontSize: 9, color: COLORS.amber,
            marginTop: 6,
          }}>
            Suggested target for DC level {dcStrictness}: +{suggestedTarget}
          </div>
        )}
      </div>

      {/* Future: Weco 360 sorter data placeholder */}
      <div style={{
        background: COLORS.bg3, border: `1px dashed ${COLORS.border}`,
        borderRadius: 4, padding: '12px 14px',
      }}>
        <div style={{
          fontFamily: FONT, fontSize: 9, color: COLORS.text3,
          letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8,
        }}>
          Weco 360 Sorter (Not Connected)
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
        }}>
          <SorterPlaceholder label="Throughput" value="— lbs/hr" />
          <SorterPlaceholder label="Blowoff" value="— %" />
          <SorterPlaceholder label="Efficiency" value="— %" />
        </div>
        <div style={{
          fontFamily: FONT, fontSize: 9, color: COLORS.text3,
          marginTop: 8, lineHeight: 1.5,
        }}>
          When connected, these metrics combined with QC grades will produce
          the real operations score — optimizing the relationship between
          what goes in the cup, what gets blown off, and how fast we're running.
        </div>
      </div>
    </div>
  )
}

function SorterPlaceholder({ label, value }) {
  return (
    <div style={{
      background: COLORS.bg2, borderRadius: 3, padding: '8px 6px', textAlign: 'center',
    }}>
      <div style={{
        fontFamily: FONT, fontSize: 8, color: COLORS.text3,
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3,
      }}>{label}</div>
      <div style={{
        fontFamily: FONT, fontSize: 14, fontWeight: 600, color: COLORS.text3,
      }}>{value}</div>
    </div>
  )
}
