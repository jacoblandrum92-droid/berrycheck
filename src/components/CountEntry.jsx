import React, { useState, useEffect } from 'react'
import { COLORS, FONT, DEFECT_DETAIL } from '../constants'

// ============================================================
// TOGGLE DEFINITIONS — name, brief, verbose, SOP steps
// ============================================================

const STANDARDS = {
  mbg: {
    label: 'MBG',
    brief: 'MBG industry standard tolerances',
    verbose: 'Michigan Blueberry Growers Association standard. Proprietary tolerance chart used across MBG member facilities. Balances permanent and condition defect tolerances equally. Use when packing under an MBG contract or when the receiving DC expects MBG-standard grading.',
  },
  butterfly: {
    label: 'BUTTERFLY',
    brief: 'Retail-first — strict on condition, lenient on cosmetic',
    verbose: 'Butterfly proprietary grading standard. Designed around what matters at retail: condition defects (soft, leaky, decayed fruit) are held to strict tolerances because they cause consumer rejection and shelf-life failures. Cosmetic permanent defects (stems, minor color, scarring) are more lenient — consumers tolerate these. Use for non-MBG customers or when optimizing for DC pass rates on condition-sensitive accounts.',
  },
}

const METHODS = {
  fullcount: {
    label: 'FULL COUNT',
    brief: 'Camera counts total berries. QCer pulls and records all defects.',
    verbose: 'The most accurate sampling method. Camera provides an exact total berry count from a photograph. QCer inspects every berry in the sample, removes all defects, and records counts by category. No subsampling — every berry is graded. Recommended when camera hardware is available.',
    color: '#2563EB',
    steps: [
      'Select one finished pack unit from the packing line.',
      'Weigh the pack on a calibrated scale and record weight (g). This verifies filler/scale calibration — it does not affect grading.',
      'Dump contents onto clean, dry sampling tray.',
      'Photograph the sample — camera counts total berries automatically.',
      'Verify camera count matches visual estimate. Correct manually if needed.',
      'Inspect every berry. Remove all defective berries from the sample.',
      'Sort defects by category and record counts below.',
    ],
  },
  manual: {
    label: 'MANUAL COUNT',
    brief: 'QCer hand-counts total berries, then pulls and records all defects.',
    verbose: 'Same inspection rigor as Full Count but without camera assistance. QCer manually counts total berries after dumping the pack, then inspects and sorts. Use when camera is unavailable or as a cross-check against camera counts.',
    color: COLORS.purple,
    steps: [
      'Select one finished pack unit from the packing line.',
      'Dump contents onto clean, dry sampling tray.',
      'Count every berry by hand and record the total below.',
      'Inspect every berry. Remove all defective berries from the sample.',
      'Sort defects by category and record counts below.',
    ],
  },
  '600g': {
    label: '600G SUBSAMPLE',
    brief: '600g weighed sample with 30-berry subsample to estimate total count.',
    verbose: 'Traditional MBG sampling method. A 600-gram fruit sample is collected and a 30-berry subsample is weighed to estimate total berry count via average berry weight. All berries in the 600g sample are then sorted and graded. The 30-berry weight also provides berry size classification. Note: total count is estimated, not exact.',
    color: COLORS.text2,
    steps: [
      'Collect exactly 600 grams of fruit from the packing line using a calibrated scale.',
      'Pull 30 berries at random from the 600g sample.',
      'Weigh the 30-berry subsample on a calibrated scale. Record weight in grams below.',
      'Return the 30 berries to the main 600g sample.',
      'Inspect every berry in the full sample. Remove all defective berries.',
      'Sort defects by category and record counts below.',
      'System calculates estimated total berry count from the 30-berry subsample weight.',
    ],
  },
}

const DETAIL_MODES = {
  quick: {
    label: 'QUICK',
    brief: '3-pile sort: permanent, condition, decay/mold.',
    verbose: 'Defects are sorted into three broad piles: Permanent (stems, green/red, scars), Condition (shrivel, bruise, soft, crushed, leaky), and Decay/Mold. One count per pile. Faster data entry but does not check individual defect sub-limits — a single defect type could exceed its tolerance without being flagged if the category total is still within range.',
  },
  detailed: {
    label: 'DETAILED',
    brief: 'Individual counts for each defect type. Enables sub-limit checking.',
    verbose: 'Each defect type is counted individually: stems, green/red, scars, shrivel, bruise, soft, crushed, leaky, decay (alternaria/anthracnose), and white mold. Enables sub-limit enforcement — the system checks each defect type against its own tolerance threshold in addition to category totals. Catches edge cases where one defect type is abnormally high. Required for full compliance with detailed grading standards.',
  },
}

// ============================================================
// INFO PANEL — expandable verbose description
// ============================================================

function InfoPanel({ config, expanded, onToggleExpand }) {
  return (
    <div>
      <div style={{
        fontFamily: FONT, fontSize: 10, color: COLORS.text2, lineHeight: 1.4,
        display: 'flex', alignItems: 'flex-start', gap: 6,
      }}>
        <span style={{ flex: 1 }}>{config.brief}</span>
        <button onClick={onToggleExpand} style={{
          fontFamily: FONT, fontSize: 9, fontWeight: 700,
          color: COLORS.text3, background: 'none', border: `1px solid ${COLORS.border}`,
          borderRadius: 2, padding: '0 4px', cursor: 'pointer', lineHeight: '16px',
          flexShrink: 0, marginTop: 1,
        }}>
          {expanded ? '−' : '?'}
        </button>
      </div>
      {expanded && (
        <div style={{
          fontFamily: FONT, fontSize: 10, color: COLORS.text2,
          lineHeight: 1.5, marginTop: 6, padding: '8px 10px',
          background: COLORS.bg, border: `1px solid ${COLORS.border}`,
          borderRadius: 3,
        }}>
          {config.verbose}
        </div>
      )}
    </div>
  )
}

// ============================================================
// SETTING ROW — label + toggle button + info
// ============================================================

function SettingRow({ label, config, buttonLabel, buttonColor, active, onClick, expanded, onToggleExpand }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{
          fontFamily: FONT, fontSize: 9, fontWeight: 600, color: COLORS.text3,
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          {label}
        </div>
        <button onClick={onClick} style={{
          fontFamily: FONT, fontSize: 9, fontWeight: 600,
          color: active ? buttonColor : COLORS.text2,
          background: active ? (buttonColor + '15') : COLORS.bg,
          border: `1px solid ${active ? buttonColor : COLORS.border}`,
          padding: '3px 10px', borderRadius: 3, cursor: 'pointer',
          letterSpacing: '0.06em',
        }}>
          {buttonLabel}
        </button>
      </div>
      <InfoPanel config={config} expanded={expanded} onToggleExpand={onToggleExpand} />
    </div>
  )
}

// ============================================================
// SOP STEPS — numbered procedure display
// ============================================================

function SOPSteps({ steps }) {
  return (
    <div style={{
      fontFamily: FONT, fontSize: 10, color: COLORS.text3,
      lineHeight: 1.6, marginBottom: 8,
      padding: '8px 10px', background: COLORS.bg2,
      borderRadius: 4, border: `1px solid ${COLORS.border}`,
    }}>
      <div style={{
        fontFamily: FONT, fontSize: 9, fontWeight: 600, color: COLORS.text3,
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
      }}>Sampling Procedure</div>
      <ol style={{ margin: 0, paddingLeft: 18 }}>
        {steps.map((step, i) => (
          <li key={i} style={{ marginBottom: i < steps.length - 1 ? 4 : 0 }}>
            <span style={{ color: COLORS.text2 }}>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function CountEntry({ counts, setCounts, detailed, onToggleDetailed, sampleMethod, onToggleMethod, gradingStandard, onToggleStandard }) {
  const [thirtyBerryWeight, setThirtyBerryWeight] = useState('')
  const [manualTotal, setManualTotal] = useState('')
  const [fullcountTotal, setFullcountTotal] = useState('')
  const [packWeight, setPackWeight] = useState('')
  const [expandedInfo, setExpandedInfo] = useState(null)

  const isManual = sampleMethod === 'manual'
  const isFullCount = sampleMethod === 'fullcount'

  const toggleInfo = (key) => setExpandedInfo(prev => prev === key ? null : key)

  // === 600g mode calculations ===
  const avgBerryWeight = thirtyBerryWeight ? (parseFloat(thirtyBerryWeight) / 30) : 0
  const estimatedTotal600 = avgBerryWeight > 0 ? Math.round(600 / avgBerryWeight) : null

  // Berry size from 30-berry weight
  const berrySize = !thirtyBerryWeight ? null
    : parseFloat(thirtyBerryWeight) <= 33 ? 'Small'
    : parseFloat(thirtyBerryWeight) <= 65 ? 'Medium'
    : 'Large'

  const berrySizeColor = berrySize === 'Small' ? COLORS.amber
    : berrySize === 'Large' ? COLORS.green
    : berrySize === 'Medium' ? COLORS.text
    : COLORS.text3

  // === Active total — depends on mode ===
  const estimatedTotal = isFullCount ? (parseInt(fullcountTotal) || null)
    : isManual ? (parseInt(manualTotal) || null) : estimatedTotal600

  // Calculate total defects
  const totalDefects = detailed
    ? (counts.stems || 0) + (counts.greenRed || 0) + (counts.scars || 0) +
      (counts.shrivel || 0) + (counts.bruise || 0) + (counts.soft || 0) +
      (counts.crushed || 0) + (counts.leaky || 0) +
      (counts.decayRot || 0) + (counts.whiteMold || 0)
    : (counts.permanent || 0) + (counts.condition || 0) + (counts.decay || 0)

  const decayCount = detailed
    ? (counts.decayRot || 0) + (counts.whiteMold || 0)
    : (counts.decay || 0)

  const goodCount = estimatedTotal ? Math.max(0, estimatedTotal - totalDefects) : 0

  // Store metadata in counts
  useEffect(() => {
    if (isFullCount) {
      const t = parseInt(fullcountTotal) || 0
      const w = parseFloat(packWeight) || 0
      setCounts(prev => {
        if (prev._sampleMethod === 'fullcount' && prev._fullcountTotal === t && prev._packWeight === w) return prev
        return { ...prev, _sampleMethod: 'fullcount', _fullcountTotal: t, _packWeight: w, _manualTotal: 0, _thirtyBerryWeight: 0 }
      })
    } else if (isManual) {
      const t = parseInt(manualTotal) || 0
      setCounts(prev => {
        if (prev._sampleMethod === 'manual' && prev._manualTotal === t) return prev
        return { ...prev, _sampleMethod: 'manual', _manualTotal: t, _thirtyBerryWeight: 0, _fullcountTotal: 0, _packWeight: 0 }
      })
    } else {
      const w = parseFloat(thirtyBerryWeight) || 0
      setCounts(prev => {
        if (prev._sampleMethod === '600g' && prev._thirtyBerryWeight === w) return prev
        return { ...prev, _sampleMethod: '600g', _thirtyBerryWeight: w, _manualTotal: 0, _fullcountTotal: 0, _packWeight: 0 }
      })
    }
  }, [thirtyBerryWeight, manualTotal, fullcountTotal, packWeight, isManual, isFullCount])

  // Auto-calculate good when total or defects change
  useEffect(() => {
    if (estimatedTotal) {
      setCounts(prev => {
        const defects = detailed
          ? (prev.stems || 0) + (prev.greenRed || 0) + (prev.scars || 0) +
            (prev.shrivel || 0) + (prev.bruise || 0) + (prev.soft || 0) +
            (prev.crushed || 0) + (prev.leaky || 0) +
            (prev.decayRot || 0) + (prev.whiteMold || 0)
          : (prev.permanent || 0) + (prev.condition || 0) + (prev.decay || 0)
        const newGood = Math.max(0, estimatedTotal - defects)
        if (prev.good === newGood) return prev
        return { ...prev, good: newGood }
      })
    }
  }, [isFullCount ? fullcountTotal : isManual ? manualTotal : thirtyBerryWeight, estimatedTotal])

  const update = (key, val) => {
    const newVal = Math.max(0, parseInt(val) || 0)
    setCounts(prev => {
      const next = { ...prev, [key]: newVal }
      if (estimatedTotal && key !== 'good') {
        const defects = detailed
          ? (next.stems || 0) + (next.greenRed || 0) + (next.scars || 0) +
            (next.shrivel || 0) + (next.bruise || 0) + (next.soft || 0) +
            (next.crushed || 0) + (next.leaky || 0) +
            (next.decayRot || 0) + (next.whiteMold || 0)
          : (next.permanent || 0) + (next.condition || 0) + (next.decay || 0)
        next.good = Math.max(0, estimatedTotal - defects)
      }
      return next
    })
  }

  const inputBox = (key, label, color, borderColor) => (
    <div key={key} style={{
      background: COLORS.bg2,
      border: `1px solid ${borderColor || COLORS.border}`,
      borderRadius: 4, padding: '8px 10px',
    }}>
      <div style={{
        fontFamily: FONT, fontSize: 9, color: COLORS.text3,
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3,
      }}>
        {label}
      </div>
      <input type="number" min="0" value={counts[key] || ''}
        onChange={e => update(key, e.target.value)} placeholder="0"
        style={{
          background: 'transparent', border: 'none', padding: 0,
          fontFamily: FONT, fontSize: 20, fontWeight: 600,
          color: (counts[key] || 0) > 0 ? color : COLORS.text3,
          width: '100%', outline: 'none',
        }}
      />
    </div>
  )

  const methodConfig = METHODS[sampleMethod]
  const standardConfig = STANDARDS[gradingStandard]
  const detailConfig = detailed ? DETAIL_MODES.detailed : DETAIL_MODES.quick

  return (
    <div>
      {/* === QC SETTINGS === */}
      <div style={{
        background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
        borderRadius: 4, padding: '10px 12px', marginBottom: 8,
      }}>
        <div style={{
          fontFamily: FONT, fontSize: 9, fontWeight: 600, color: COLORS.text3,
          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8,
        }}>QC Settings</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Grading Standard */}
          {onToggleStandard && (
            <SettingRow
              label="Grading Standard"
              config={standardConfig}
              buttonLabel={standardConfig.label}
              buttonColor={gradingStandard === 'butterfly' ? COLORS.green : COLORS.text2}
              active={gradingStandard === 'butterfly'}
              onClick={onToggleStandard}
              expanded={expandedInfo === 'standard'}
              onToggleExpand={() => toggleInfo('standard')}
            />
          )}

          {/* Sampling Method */}
          <SettingRow
            label="Sampling Method"
            config={methodConfig}
            buttonLabel={methodConfig.label}
            buttonColor={methodConfig.color}
            active={isFullCount || isManual}
            onClick={onToggleMethod}
            expanded={expandedInfo === 'method'}
            onToggleExpand={() => toggleInfo('method')}
          />

          {/* Defect Entry Mode */}
          <SettingRow
            label="Defect Entry"
            config={detailConfig}
            buttonLabel={detailConfig.label}
            buttonColor={detailed ? COLORS.amber : COLORS.text2}
            active={detailed}
            onClick={onToggleDetailed}
            expanded={expandedInfo === 'detail'}
            onToggleExpand={() => toggleInfo('detail')}
          />
        </div>
      </div>

      {/* === SOP PROCEDURE STEPS === */}
      <SOPSteps steps={methodConfig.steps} />

      {/* === SAMPLE SIZE INPUT — mode-dependent === */}
      {isFullCount ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
          {/* Pack weight — calibration check, not used for grading */}
          <div style={{
            background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
            borderRadius: 4, padding: '10px 12px',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 6,
            }}>
              <div style={{
                fontFamily: FONT, fontSize: 9, color: COLORS.text3,
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>Pack Weight (g) — calibration check</div>
              {packWeight && (
                <div style={{
                  fontFamily: FONT, fontSize: 9, color: COLORS.text3,
                  letterSpacing: '0.04em',
                }}>
                  {(parseFloat(packWeight) / 28.35).toFixed(1)} oz
                </div>
              )}
            </div>
            <input type="number" min="0" step="0.1"
              value={packWeight}
              onChange={e => setPackWeight(e.target.value)}
              placeholder="0"
              style={{
                background: 'transparent', border: 'none', padding: 0,
                fontFamily: FONT, fontSize: 18, fontWeight: 600,
                color: packWeight ? COLORS.text : COLORS.text3,
                width: '100%', outline: 'none',
              }}
            />
          </div>
          {/* Total berries — from camera */}
          <div style={{
            background: COLORS.bg2, border: `1px solid #2563EB40`,
            borderRadius: 4, padding: '10px 12px',
          }}>
            <div style={{
              fontFamily: FONT, fontSize: 9, color: '#2563EB',
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
            }}>Total Berries — camera count</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <input type="number" min="0"
                value={fullcountTotal}
                onChange={e => setFullcountTotal(e.target.value)}
                placeholder="0"
                style={{
                  background: 'transparent', border: 'none', padding: 0,
                  fontFamily: FONT, fontSize: 22, fontWeight: 700,
                  color: fullcountTotal ? COLORS.text : COLORS.text3,
                  width: '80px', outline: 'none',
                }}
              />
              {estimatedTotal && (
                <div style={{
                  fontFamily: FONT, fontSize: 11, color: '#2563EB', fontWeight: 600,
                }}>
                  every berry inspected
                </div>
              )}
            </div>
          </div>
        </div>
      ) : isManual ? (
        <div style={{
          background: COLORS.bg2, border: `1px solid ${COLORS.purple}40`,
          borderRadius: 4, padding: '10px 12px', marginBottom: 8,
        }}>
          <div style={{
            fontFamily: FONT, fontSize: 9, color: COLORS.purple,
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
          }}>Total Berries — hand count</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <input type="number" min="0"
              value={manualTotal}
              onChange={e => setManualTotal(e.target.value)}
              placeholder="0"
              style={{
                background: 'transparent', border: 'none', padding: 0,
                fontFamily: FONT, fontSize: 22, fontWeight: 700,
                color: manualTotal ? COLORS.text : COLORS.text3,
                width: '80px', outline: 'none',
              }}
            />
            {estimatedTotal && (
              <div style={{
                fontFamily: FONT, fontSize: 11, color: COLORS.purple, fontWeight: 600,
              }}>
                every berry inspected
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{
          background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
          borderRadius: 4, padding: '10px 12px', marginBottom: 8,
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 6,
          }}>
            <div style={{
              fontFamily: FONT, fontSize: 9, color: COLORS.text3,
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>30-Berry Subsample Weight (g)</div>
            {berrySize && (
              <div style={{
                fontFamily: FONT, fontSize: 9, fontWeight: 600,
                color: berrySizeColor, letterSpacing: '0.04em',
                display: 'flex', gap: 8, alignItems: 'center',
              }}>
                <span style={{ color: COLORS.text3, fontWeight: 400 }}>
                  {avgBerryWeight > 0 ? `${Math.round(avgBerryWeight * 100) / 100}g · ~${Math.round(13 + (avgBerryWeight - 1.1) * 4.55)}mm` : ''}
                </span>
                {berrySize.toUpperCase()}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <input type="number" min="0" step="0.1"
              value={thirtyBerryWeight}
              onChange={e => setThirtyBerryWeight(e.target.value)}
              placeholder="0"
              style={{
                background: 'transparent', border: 'none', padding: 0,
                fontFamily: FONT, fontSize: 22, fontWeight: 700,
                color: thirtyBerryWeight ? COLORS.text : COLORS.text3,
                width: '80px', outline: 'none',
              }}
            />
            {estimatedTotal && (
              <div style={{
                fontFamily: FONT, fontSize: 12, color: COLORS.green, fontWeight: 600,
              }}>
                ≈ {estimatedTotal} berries (estimated)
              </div>
            )}
          </div>
        </div>
      )}

      {/* Good berries — auto-calculated from total minus defects */}
      <div style={{
        background: COLORS.greenDim, border: `1px solid ${COLORS.green}`,
        borderRadius: 4, padding: '8px 12px', marginBottom: 8,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{
            fontFamily: FONT, fontSize: 9, color: COLORS.green,
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2,
          }}>Good Berries (total − defects)</div>
          <div style={{
            fontFamily: FONT, fontSize: 22, fontWeight: 700,
            color: COLORS.green,
          }}>
            {estimatedTotal ? goodCount : '—'}
          </div>
        </div>
        <div style={{
          fontFamily: FONT, fontSize: 10, color: COLORS.green,
          textAlign: 'right', opacity: 0.7,
        }}>
          {estimatedTotal ? (
            <>
              <div>{totalDefects} defects</div>
              <div>{estimatedTotal} total</div>
            </>
          ) : (
            <div>{isFullCount ? 'Snap photo for count' : isManual ? 'Enter total berry count' : 'Enter 30-berry weight'}</div>
          )}
        </div>
      </div>

      {/* Defect counts */}
      <div style={{
        fontFamily: FONT, fontSize: 9, fontWeight: 600, color: COLORS.text3,
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4,
      }}>
        {detailed ? 'Defect Counts — Full Breakdown' : 'Defect Counts — 3-Pile Sort'}
      </div>
      {!detailed ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          {inputBox('permanent', 'Permanent', COLORS.amber)}
          {inputBox('condition', 'Condition', '#D85A30')}
          {inputBox('decay', 'Decay/Mold', COLORS.red, decayCount > 0 ? COLORS.red : undefined)}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <div style={sectionLabel}>Permanent Defects</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              {DEFECT_DETAIL.permanent.map(d =>
                inputBox(d.key, d.label, COLORS.amber)
              )}
            </div>
          </div>
          <div>
            <div style={sectionLabel}>Condition Defects</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              {DEFECT_DETAIL.condition.map(d =>
                inputBox(d.key, d.label, '#D85A30')
              )}
            </div>
          </div>
          <div>
            <div style={sectionLabel}>Decay / Mold</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {DEFECT_DETAIL.decay.map(d =>
                inputBox(d.key, d.label, COLORS.red, (counts[d.key] || 0) > 0 ? COLORS.red : undefined)
              )}
            </div>
          </div>
        </div>
      )}

      {decayCount > 0 && (
        <div style={{
          marginTop: 8, padding: '8px 12px',
          background: COLORS.redDim, border: `1px solid ${COLORS.red}`,
          borderRadius: 3, fontFamily: FONT, fontSize: 11, fontWeight: 600,
          color: COLORS.red, letterSpacing: '0.06em', textTransform: 'uppercase',
          textAlign: 'center',
        }}>
          Decay detected — cannot grade Excellent
        </div>
      )}
    </div>
  )
}

const sectionLabel = {
  fontFamily: FONT, fontSize: 9, fontWeight: 600,
  color: COLORS.text3, letterSpacing: '0.08em',
  textTransform: 'uppercase', marginBottom: 4,
}
