import React, { useState } from 'react'
import { COLORS, FONT, gradeSample, DEFECT_DETAIL, GRADING_STANDARDS, classifyWeight, CLASS_COLORS, loadPackTolerance } from '../constants'

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

export default function SampleHistory({ history, onClear, onEdit }) {
  const [expanded, setExpanded] = useState(false)
  const [openId, setOpenId] = useState(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [clearTyped, setClearTyped] = useState('')
  const recent = [...history].reverse()
  const shown = expanded ? recent : recent.slice(0, 5)
  const todaySamples = history.filter(s => s.date === new Date().toLocaleDateString() && !s.isSkipped)
  const todayGrades = todaySamples.map(s => gradeSample(s, (GRADING_STANDARDS[s._gradingStandard] || GRADING_STANDARDS.mbg).tolerances))
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
            <button onClick={() => { setShowClearConfirm(true); setClearTyped('') }} style={{
              fontFamily: FONT, fontSize: 9, fontWeight: 600,
              color: COLORS.text3, background: 'transparent',
              border: `1px solid ${COLORS.border}`, padding: '4px 10px',
              borderRadius: 3, cursor: 'pointer', letterSpacing: '0.06em',
            }} title="Use Day Close in Ops to archive before clearing">CLEAR…</button>
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
          const isBox = s._sampleMethod === 'boxweight'
          const boxStatus = isBox
            ? (s._boxPctInSpec >= 95 ? 'ok' : s._boxPctInSpec >= 85 ? 'warn' : 'fail')
            : null
          const boxLabel = isBox
            ? (s._boxPctInSpec >= 95 ? 'PASS' : s._boxPctInSpec >= 85 ? 'BORDR' : 'FAIL')
            : null

          const result = isBox
            ? { label: boxLabel, status: boxStatus, pctCombined: (s._boxPctInSpec || 0).toFixed(0) + '% OK' }
            : gradeSample(s, (GRADING_STANDARDS[s._gradingStandard] || GRADING_STANDARDS.mbg).tolerances)
          const color = GRADE_TEXT[result.status] || COLORS.text3
          const bg = GRADE_BG[result.status] || COLORS.bg3
          const border = GRADE_BORDER[result.status] || COLORS.border

          const typeLabel = s.isSkipped ? 'SKIP'
            : isBox ? 'BOX'
            : s.isExtra ? 'EXTRA'
            : s.sampleNum ? `L${s.sampleNum}` : 'SOP'
          const typeColor = s.isSkipped ? COLORS.text3
            : isBox ? COLORS.amber
            : s.isExtra ? COLORS.purple : COLORS.green

          const isOpen = openId === s.id
          return (
            <div key={s.id} style={{
              background: bg, border: `1px solid ${border}`,
              borderRadius: 6, overflow: 'hidden',
              opacity: s.isSkipped ? 0.4 : s.isExtra ? 0.7 : 1,
            }}>
              <div
                onClick={() => setOpenId(isOpen ? null : s.id)}
                style={{
                  padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: 12,
                  cursor: 'pointer',
                }}
              >
                {/* Grade badge (or pass/fail for box) */}
                <div style={{
                  minWidth: 52, textAlign: 'center',
                }}>
                  <div style={{
                    fontFamily: FONT, fontSize: 13, fontWeight: 800,
                    color, letterSpacing: '0.04em', lineHeight: 1,
                  }}>{result.label}</div>
                  <div style={{
                    fontFamily: FONT, fontSize: 9, color: COLORS.text3, marginTop: 3,
                  }}>
                    {isBox
                      ? `${(s._boxPctInSpec || 0).toFixed(0)}%`
                      : `${result.pctCombined}%`}
                  </div>
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
                        Line {s.packLine}
                      </span>
                    )}
                    <span style={{
                      fontFamily: FONT, fontSize: 9, color: COLORS.text3,
                    }}>{s.time}</span>
                  </div>
                  {isBox ? (
                    <div style={{ display: 'flex', gap: 10, fontFamily: FONT, fontSize: 9, color: COLORS.text3 }}>
                      <span style={{ color: COLORS.amber, fontWeight: 700 }}>
                        {s._boxCount || 0} clamshells
                      </span>
                      <span>μ {(s._boxMean || 0).toFixed(1)}g / {s._boxLabelWeight || 0}g</span>
                      <span style={{ color: COLORS.green }}>{s._boxInSpec || 0} in</span>
                      {(s._boxUnder || 0) > 0 && (
                        <span style={{ color: COLORS.red, fontWeight: 600 }}>{s._boxUnder} under</span>
                      )}
                      {(s._boxOver || 0) > 0 && (
                        <span style={{ color: COLORS.amber, fontWeight: 600 }}>{s._boxOver} over</span>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 10, fontFamily: FONT, fontSize: 9, color: COLORS.text3 }}>
                      <span>{result.total} berries</span>
                      <span style={{ color: COLORS.text2 }}>{s.permanent || 0}P</span>
                      <span style={{ color: COLORS.text2 }}>{s.condition || 0}C</span>
                      {(s.decay || 0) > 0 && (
                        <span style={{ color: COLORS.red, fontWeight: 600 }}>{s.decay}D</span>
                      )}
                      {s.grower && <span>{s.grower}</span>}
                      {s._sampleMethod === 'pint' && <span style={{ color: '#10B981' }}>PINT</span>}
                      {s._sampleMethod === 'pint30' && <span style={{ color: '#1E40AF' }}>PINT 30</span>}
                      {s._sampleMethod === '18oz30' && <span style={{ color: '#EA580C' }}>18OZ 30</span>}
                      {s._sampleMethod === 'mightyblue30' && <span style={{ color: '#0891B2' }}>MIGHTY BLUE 30</span>}
                      {s._sampleMethod === '600g' && <span style={{ color: COLORS.text3 }}>600G</span>}
                      {s._sampleMethod === 'manual' && <span style={{ color: COLORS.purple }}>MANUAL</span>}
                      {s._clamshellNet > 0 && (
                        <span style={{ color: COLORS.text2, fontWeight: 600 }}>
                          {(typeof s._clamshellNet === 'number' ? s._clamshellNet : parseFloat(s._clamshellNet)).toFixed(1)}g
                          {s._clamshellLabel > 0 && (
                            <span style={{ color: COLORS.text3, fontWeight: 400 }}>
                              {' / '}{s._clamshellLabel}g
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Score (or mean weight for box) */}
                <div style={{
                  fontFamily: FONT, fontSize: isBox ? 14 : 18, fontWeight: 800,
                  color, minWidth: 32, textAlign: 'right',
                }}>
                  {isBox
                    ? ((s._boxMean || 0).toFixed(1) + 'g')
                    : (result.score > 0 ? result.score : '—')}
                </div>
                <div style={{
                  fontFamily: FONT, fontSize: 10, color: COLORS.text3,
                  marginLeft: 4,
                }}>{isOpen ? '▾' : '▸'}</div>
              </div>

              {isOpen && <SampleDetails sample={s} result={result} onEdit={onEdit} />}
            </div>
          )
        })}
      </div>

      {showClearConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 3000,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }} onClick={() => setShowClearConfirm(false)}>
          <div style={{
            background: '#fff', borderRadius: 10, padding: 24,
            maxWidth: 440, width: '100%',
            border: `2px solid ${COLORS.red}`,
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              fontFamily: FONT, fontSize: 14, fontWeight: 800,
              color: COLORS.red, marginBottom: 8, letterSpacing: '0.04em',
            }}>⚠ DESTRUCTIVE — CLEAR ALL SAMPLES</div>
            <div style={{
              fontFamily: FONT, fontSize: 11, color: COLORS.text, lineHeight: 1.5, marginBottom: 14,
            }}>
              This permanently deletes <b>every sample in the log</b> ({history.length} total, across all dates). You cannot undo this inside the app.
            </div>
            <div style={{
              fontFamily: FONT, fontSize: 11, color: COLORS.text, lineHeight: 1.5, marginBottom: 14,
              padding: 10, background: COLORS.bg2, borderRadius: 4,
              border: `1px solid ${COLORS.border}`,
            }}>
              <b>Archive first.</b> Go to <b>Operations → Day Close</b> to archive today's samples to the permanent archive before clearing. Day Close is the right tool — CLEAR is only for resetting after archival.
            </div>
            <div style={{
              fontFamily: FONT, fontSize: 10, color: COLORS.text3, marginBottom: 6,
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>Type <b style={{ color: COLORS.red }}>CLEAR ALL</b> to confirm:</div>
            <input
              type="text"
              value={clearTyped}
              onChange={e => setClearTyped(e.target.value)}
              placeholder="CLEAR ALL"
              autoFocus
              style={{
                width: '100%', fontFamily: FONT, fontSize: 14,
                padding: '8px 10px', boxSizing: 'border-box',
                border: `1px solid ${clearTyped === 'CLEAR ALL' ? COLORS.red : COLORS.border}`,
                borderRadius: 4, outline: 'none', marginBottom: 14,
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowClearConfirm(false)} style={{
                fontFamily: FONT, fontSize: 11, fontWeight: 600,
                color: COLORS.text, background: COLORS.bg2,
                border: `1px solid ${COLORS.border}`,
                padding: '8px 16px', borderRadius: 4, cursor: 'pointer',
                letterSpacing: '0.04em',
              }}>CANCEL</button>
              <button
                disabled={clearTyped !== 'CLEAR ALL'}
                onClick={() => { onClear(); setShowClearConfirm(false); setClearTyped('') }}
                style={{
                  fontFamily: FONT, fontSize: 11, fontWeight: 700,
                  color: COLORS.white,
                  background: clearTyped === 'CLEAR ALL' ? COLORS.red : '#aaa',
                  border: 'none',
                  padding: '8px 16px', borderRadius: 4,
                  cursor: clearTyped === 'CLEAR ALL' ? 'pointer' : 'not-allowed',
                  letterSpacing: '0.04em',
                }}>CLEAR ALL SAMPLES</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// SAMPLE DETAILS — expanded breakdown of a single sample
// ============================================================

function SampleDetails({ sample: s, result, onEdit }) {
  // Special-case: box-weight samples get a weight-distribution view, not defect breakdown
  if (s._sampleMethod === 'boxweight') {
    return <BoxSampleDetails sample={s} onEdit={onEdit} />
  }
  const standard = GRADING_STANDARDS[s._gradingStandard] || GRADING_STANDARDS.mbg
  const nextGrade = NEXT_GRADE[result.grade]
  const tol = standard.tolerances

  // Explain WHY this grade — find which categories are at/beyond the next-up threshold
  const reasons = []
  if (result.grade !== 'excellent' && result.grade !== 'none' && nextGrade && result.headrooms?.length) {
    // Compare current pcts to next-up grade's limits
    const nextLimits = {
      permanent: tol.permanent.totalMax[nextGrade],
      condition: tol.condition.totalMax[nextGrade],
      combined: tol.combinedMax[nextGrade],
      decay: tol.condition.decay[nextGrade],
    }
    if (result.pctPermanent > nextLimits.permanent) {
      reasons.push(`Permanent ${result.pctPermanent}% > ${nextLimits.permanent}% (${nextGrade} limit)`)
    }
    if (result.pctCondition > nextLimits.condition) {
      reasons.push(`Condition ${result.pctCondition}% > ${nextLimits.condition}% (${nextGrade} limit)`)
    }
    if (result.pctCombined > nextLimits.combined) {
      reasons.push(`Combined ${result.pctCombined}% > ${nextLimits.combined}% (${nextGrade} limit)`)
    }
    if (result.pctDecay > 0 && nextGrade === 'excellent') {
      reasons.push(`Any decay prevents Excellent`)
    } else if (result.pctDecay > nextLimits.decay) {
      reasons.push(`Decay ${result.pctDecay}% > ${nextLimits.decay}% (${nextGrade} limit)`)
    }
    if ((s.whiteMold || 0) > 0) {
      reasons.push(`White mold detected → auto Poor`)
    }
  }

  // Sample method metadata
  const methodLabel = {
    fullcount: 'Full Count (camera)', manual: 'Manual Count',
    '600g': '600g Subsample', pint: 'Pint (camera)',
    pint30: 'Pint 30-berry', '18oz30': '18oz 30-berry',
    mightyblue30: 'Mighty Blue 30-berry',
  }[s._sampleMethod] || s._sampleMethod || '—'

  return (
    <div style={{
      padding: '12px 14px',
      borderTop: `1px solid ${COLORS.border}`,
      background: COLORS.bg,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {/* Edit / Reassign */}
      {onEdit && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={(e) => { e.stopPropagation(); onEdit(s) }} style={{
            fontFamily: FONT, fontSize: 10, fontWeight: 700,
            color: COLORS.white, background: COLORS.green,
            border: 'none', padding: '6px 14px', borderRadius: 4,
            cursor: 'pointer', letterSpacing: '0.06em',
          }}>EDIT / REASSIGN</button>
        </div>
      )}

      {/* Why this grade */}
      {reasons.length > 0 && (
        <div>
          <div style={{
            fontFamily: FONT, fontSize: 9, fontWeight: 700, color: COLORS.text3,
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4,
          }}>
            Why {result.label}
            {nextGrade && (
              <span style={{ color: COLORS.text3, fontWeight: 400 }}>
                {' '}— couldn't reach {nextGrade.toUpperCase()} because
              </span>
            )}
          </div>
          <ul style={{
            margin: 0, padding: '0 0 0 14px',
            fontFamily: FONT, fontSize: 10, color: COLORS.text, lineHeight: 1.5,
          }}>
            {reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      {/* Headroom table — shows headroom against CURRENT grade's limits */}
      {result.headrooms?.length > 0 && (
        <div>
          <div style={{
            fontFamily: FONT, fontSize: 9, fontWeight: 700, color: COLORS.text3,
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4,
          }}>Category Breakdown</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '2px 10px' }}>
            <HeaderCell label="Category" />
            <HeaderCell label="Count" align="right" />
            <HeaderCell label="%" align="right" />
            <HeaderCell label="Limit / Room" align="right" />
            {result.headrooms.map((h, i) => {
              const over = h.remaining < 0
              const tight = !over && h.remaining <= 1
              const rowColor = over ? COLORS.red : tight ? COLORS.amber : COLORS.text
              return (
                <React.Fragment key={i}>
                  <Cell color={rowColor}>{h.name}</Cell>
                  <Cell align="right" color={COLORS.text2}>{h.count}</Cell>
                  <Cell align="right" color={rowColor}>{h.pct}%</Cell>
                  <Cell align="right" color={rowColor}>
                    {h.limit}% · {over ? `+${Math.abs(h.remaining)}` : `−${h.remaining}`}
                  </Cell>
                </React.Fragment>
              )
            })}
          </div>
          {result.bottleneck && (
            <div style={{
              marginTop: 6, fontFamily: FONT, fontSize: 9, color: COLORS.text3, fontStyle: 'italic',
            }}>
              Tightest: {result.bottleneck.name} ({result.bottleneck.remaining}% room)
            </div>
          )}
        </div>
      )}

      {/* Sub-defect detail if recorded */}
      {result.subPcts && (
        <div>
          <div style={{
            fontFamily: FONT, fontSize: 9, fontWeight: 700, color: COLORS.text3,
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4,
          }}>Per-Defect</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
            {[...DEFECT_DETAIL.permanent, ...DEFECT_DETAIL.condition, ...DEFECT_DETAIL.decay].map(d => {
              const n = s[d.key] || 0
              if (n === 0) return null
              const p = result.subPcts[d.key]
              return (
                <span key={d.key} style={{
                  fontFamily: FONT, fontSize: 10, color: COLORS.text,
                }}>
                  {d.label}: <b>{n}</b>
                  {p != null && (
                    <span style={{ color: COLORS.text3 }}> ({p.toFixed(1)}%)</span>
                  )}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Sample metadata */}
      <div style={{
        borderTop: `1px dashed ${COLORS.border}`, paddingTop: 8,
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px',
        fontFamily: FONT, fontSize: 10, color: COLORS.text2,
      }}>
        <Meta label="Standard" val={(s._gradingStandard || 'mbg').toUpperCase()} />
        <Meta label="Method" val={methodLabel} />
        {s.variety && <Meta label="Variety" val={s.variety} />}
        {s.packCriteria && s.packCriteria !== 'standard' && <Meta label="Pack Criteria" val={s.packCriteria} />}
        {s._thirtyBerryWeight > 0 && <Meta label="30-Berry Weight" val={`${s._thirtyBerryWeight}g`} />}
        {s._clamshellLabel > 0 && <Meta label="Label Weight" val={`${s._clamshellLabel}g`} />}
        {s._clamshellNet > 0 && <Meta label="Clamshell Net" val={`${s._clamshellNet.toFixed ? s._clamshellNet.toFixed(1) : s._clamshellNet}g`} />}
        {s._clamshellGross > 0 && <Meta label="Clamshell Gross" val={`${s._clamshellGross}g`} />}
        {s._packWeight > 0 && <Meta label="Pack Weight" val={`${s._packWeight}g`} />}
        {s._pintWeight > 0 && <Meta label="Pint Weight" val={`${s._pintWeight}g`} />}
        {s._fullcountTotal > 0 && <Meta label="Camera Count" val={`${s._fullcountTotal}`} />}
        {s.lineRate && <Meta label="Line Rate" val={s.lineRate} />}
        {s.blowoff != null && <Meta label="Blowoff" val={`${s.blowoff}%`} />}
        {s.id && <Meta label="Sample ID" val={String(s.id).slice(-8)} />}
      </div>
    </div>
  )
}

function BoxSampleDetails({ sample: s, onEdit }) {
  const weights = Array.isArray(s._boxWeights) ? s._boxWeights : []
  const label = s._boxLabelWeight || 0
  const tol = s._boxTolerance || 0
  const mean = s._boxMean || 0
  const min = s._boxMin || 0
  const max = s._boxMax || 0
  const count = s._boxCount || weights.length
  const inSpec = s._boxInSpec || 0
  const under = s._boxUnder || 0
  const over = s._boxOver || 0
  const pctInSpec = s._boxPctInSpec || 0
  const spread = count > 0 ? max - min : 0
  // Sample standard deviation
  const variance = count > 1
    ? weights.reduce((acc, w) => acc + Math.pow(w - mean, 2), 0) / (count - 1)
    : 0
  const stdev = Math.sqrt(variance)
  const passColor = pctInSpec >= 95 ? COLORS.green : pctInSpec >= 85 ? COLORS.amber : COLORS.red
  const passLabel = pctInSpec >= 95 ? 'PASS' : pctInSpec >= 85 ? 'BORDERLINE' : 'FAIL'
  const packColor = s._sampleMethod === 'boxweight' && s._boxLabelWeight > 450 ? '#EA580C' : '#1E40AF'

  return (
    <div style={{
      padding: '12px 14px',
      borderTop: `1px solid ${COLORS.border}`,
      background: COLORS.bg,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {/* Edit / Reassign */}
      {onEdit && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={(e) => { e.stopPropagation(); onEdit(s) }} style={{
            fontFamily: FONT, fontSize: 10, fontWeight: 700,
            color: COLORS.white, background: COLORS.green,
            border: 'none', padding: '6px 14px', borderRadius: 4,
            cursor: 'pointer', letterSpacing: '0.06em',
          }}>EDIT / REASSIGN</button>
        </div>
      )}

      {/* Pass/fail headline */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px',
        background: passColor + '15',
        border: `2px solid ${passColor}`,
        borderRadius: 6,
      }}>
        <div style={{
          fontFamily: FONT, fontSize: 18, fontWeight: 800, color: passColor,
          letterSpacing: '0.06em',
        }}>{passLabel}</div>
        <div style={{ flex: 1 }} />
        <div style={{
          fontFamily: FONT, fontSize: 14, fontWeight: 700, color: passColor,
        }}>{inSpec}/{count} in spec ({pctInSpec.toFixed(1)}%)</div>
      </div>

      {/* Stats grid */}
      <div>
        <div style={{
          fontFamily: FONT, fontSize: 9, fontWeight: 700, color: COLORS.text3,
          textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4,
        }}>Distribution</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {[
            { k: 'Mean', v: mean.toFixed(1) + 'g', c: COLORS.text },
            { k: 'StDev', v: stdev.toFixed(2) + 'g', c: COLORS.text2 },
            { k: 'Min', v: min.toFixed(1) + 'g', c: COLORS.text2 },
            { k: 'Max', v: max.toFixed(1) + 'g', c: COLORS.text2 },
            { k: 'Spread', v: spread.toFixed(1) + 'g', c: COLORS.text2 },
            { k: 'Label', v: label + 'g', c: packColor },
            { k: 'Tolerance', v: '±' + tol + 'g', c: COLORS.text2 },
            { k: 'N', v: count, c: COLORS.text },
          ].map(stat => (
            <div key={stat.k} style={{
              background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
              borderRadius: 4, padding: '6px 8px', textAlign: 'center',
            }}>
              <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: stat.c }}>{stat.v}</div>
              <div style={{ fontFamily: FONT, fontSize: 8, color: COLORS.text3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{stat.k}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Per-clamshell breakdown */}
      {weights.length > 0 && (
        <div>
          <div style={{
            fontFamily: FONT, fontSize: 9, fontWeight: 700, color: COLORS.text3,
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4,
          }}>Individual Weights</div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))', gap: 4,
            padding: 6, background: COLORS.bg2, borderRadius: 4,
            border: `1px solid ${COLORS.border}`,
          }}>
            {weights.map((w, i) => {
              const cls = classifyWeight(w, label, loadPackTolerance())
              const isUnder = w < label - label * loadPackTolerance().greenPct / 100
              const c = CLASS_COLORS[cls]
              const inSp = cls === 'green'
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '3px 6px',
                  background: c + '12', border: `1px solid ${c}40`,
                  borderRadius: 3,
                }}>
                  <span style={{
                    fontFamily: FONT, fontSize: 8, color: COLORS.text3,
                    letterSpacing: '0.04em',
                  }}>#{i + 1}</span>
                  <span style={{
                    fontFamily: FONT, fontSize: 11, fontWeight: 700, color: c,
                    flex: 1, textAlign: 'right',
                  }}>{w.toFixed(1)}g</span>
                  <span style={{
                    fontFamily: FONT, fontSize: 8, fontWeight: 700, color: c,
                  }}>{inSp ? '✓' : isUnder ? '↓' : '↑'}</span>
                </div>
              )
            })}
          </div>
          <div style={{
            display: 'flex', gap: 12, marginTop: 6,
            fontFamily: FONT, fontSize: 9, color: COLORS.text3,
          }}>
            <span><span style={{ color: COLORS.green, fontWeight: 700 }}>✓ {inSpec}</span> in spec</span>
            {under > 0 && <span><span style={{ color: COLORS.red, fontWeight: 700 }}>↓ {under}</span> under ({(label - tol).toFixed(1)}g)</span>}
            {over > 0 && <span><span style={{ color: COLORS.amber, fontWeight: 700 }}>↑ {over}</span> over ({(label + tol).toFixed(1)}g)</span>}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div style={{
        borderTop: `1px dashed ${COLORS.border}`, paddingTop: 8,
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px',
        fontFamily: FONT, fontSize: 10, color: COLORS.text2,
      }}>
        <Meta label="Time" val={s.time || '—'} />
        <Meta label="Daily Pallet" val={`#${s.dailyPalletNum || '—'}`} />
        {s.lotId && <Meta label="Pallet Tag" val={s.lotId} />}
        {s.packLine && <Meta label="Line" val={s.packLine} />}
        {s.grower && <Meta label="Grower" val={s.grower} />}
        {s.variety && <Meta label="Variety" val={s.variety} />}
        {s.id && <Meta label="Sample ID" val={String(s.id).slice(-8)} />}
      </div>
    </div>
  )
}

const NEXT_GRADE = { poor: 'fair', fair: 'good', good: 'excellent' }

function HeaderCell({ label, align = 'left' }) {
  return (
    <div style={{
      fontFamily: FONT, fontSize: 8, fontWeight: 700, color: COLORS.text3,
      textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: align,
    }}>{label}</div>
  )
}

function Cell({ children, align = 'left', color = COLORS.text }) {
  return (
    <div style={{
      fontFamily: FONT, fontSize: 10, color, textAlign: align,
    }}>{children}</div>
  )
}

function Meta({ label, val }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ color: COLORS.text3 }}>{label}</span>
      <span style={{ color: COLORS.text, fontWeight: 500 }}>{val}</span>
    </div>
  )
}
