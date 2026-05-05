import React, { useState, useEffect, useMemo } from 'react'
import { COLORS, FONT, DEFECT_DETAIL, classifyWeight, CLASS_COLORS, loadPackTolerance, savePackTolerance, DEFAULT_PACK_TOLERANCE, GRADING_STANDARDS, defectsToNextDrop } from '../constants'
import DefectHeadroomBar from './DefectHeadroomBar'

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
  pint: {
    label: 'PINT',
    brief: 'Pint clamshell — camera total or 30-berry weight.',
    verbose: 'Sample a sealed pint clamshell from the line. Use the camera/grader for total count, OR pull 30 berries and weigh them — the system uses whichever you enter. Optional clamshell weight check for fill audit. Grading is on actual percentages.',
    color: '#10B981',
    steps: [
      'Pull a sealed pint clamshell from the packing line.',
      'Optional: weigh on clamshell scale (gross or net) for fill audit.',
      'Either dump onto tray and use camera count, OR pull 30 berries and weigh them.',
      'Inspect every berry. Remove and sort all defects.',
      'Record defect counts below. System grades against 302g pint label.',
    ],
  },
  '18oz': {
    label: '18OZ',
    brief: '18oz clamshell — camera total or 30-berry weight.',
    verbose: 'Sample a sealed 18oz clamshell from the line. Use the camera/grader for total count, OR pull 30 berries and weigh them — the system uses whichever you enter. Optional clamshell weight check for fill audit. Grading is on actual percentages against the 518g label.',
    color: '#EA580C',
    steps: [
      'Pull a sealed 18oz clamshell from the packing line.',
      'Optional: weigh on clamshell scale (gross or net) for fill audit.',
      'Either dump onto tray and use camera count, OR pull 30 berries and weigh them.',
      'Inspect every berry. Remove and sort all defects.',
      'Record defect counts below. System grades against 518g 18oz label.',
    ],
  },
  mightyblue: {
    label: 'MIGHTY BLUE',
    brief: '9.8oz Mighty Blue clamshell — camera total or 30-berry weight.',
    verbose: 'Sample a sealed 9.8oz Mighty Blue clamshell from the line. Use the camera/grader for total count, OR pull 30 berries and weigh them — the system uses whichever you enter. Mighty Blue requires Good or Excellent grade and ≥19mm berry size (≥66g per 30 berries) — check via the 30-berry weight even if using camera count.',
    color: '#0891B2',
    steps: [
      'Pull a sealed 9.8oz Mighty Blue clamshell from the packing line.',
      'Optional: weigh on clamshell scale (gross or net) for fill audit.',
      'Either dump onto tray and use camera count, OR pull 30 berries and weigh them.',
      'For Mighty Blue: 30-berry weight is recommended (size verification ≥66g).',
      'Inspect every berry. Remove and sort all defects.',
      'Record defect counts below. System grades against 282g Mighty Blue label.',
    ],
  },
  pint30: {
    label: 'PINT (30-BERRY)',
    brief: 'Pint clamshell + 30-berry subsample — no camera needed.',
    verbose: 'Field sampling method when no camera is available. Weigh the clamshell for a fill check (actual vs label), then pull 30 berries, weigh them, and let the system estimate total berry count from the label weight and average berry weight. Grading is based on the labeled clamshell weight (302g pint) so results are consistent regardless of fill variance.',
    color: '#1E40AF',
    steps: [
      'Pull a sealed pint clamshell from the packing line.',
      'Place on the clamshell scale. Record gross weight — system will show net vs label as a fill check.',
      'Open clamshell and pull 30 berries at random.',
      'Weigh the 30-berry subsample. Record weight in grams.',
      'Return the 30 berries to the clamshell.',
      'Inspect every berry. Remove and sort all defects.',
      'Record defect counts below. System grades against 302g label weight.',
    ],
  },
  '18oz30': {
    label: '18OZ (30-BERRY)',
    brief: '18oz clamshell + 30-berry subsample — no camera needed.',
    verbose: 'Field sampling method for 18oz clamshells when no camera is available. Weigh the clamshell for a fill check (actual vs label), then pull 30 berries, weigh them, and let the system estimate total berry count from the label weight and average berry weight. Grading is based on the labeled clamshell weight (518g) so results are consistent regardless of fill variance.',
    color: '#EA580C',
    steps: [
      'Pull a sealed 18oz clamshell from the packing line.',
      'Place on the clamshell scale. Record gross weight — system will show net vs label as a fill check.',
      'Open clamshell and pull 30 berries at random.',
      'Weigh the 30-berry subsample. Record weight in grams.',
      'Return the 30 berries to the clamshell.',
      'Inspect every berry. Remove and sort all defects.',
      'Record defect counts below. System grades against 518g label weight.',
    ],
  },
  mightyblue30: {
    label: 'MIGHTY BLUE (30-BERRY)',
    brief: '9.8oz Mighty Blue clamshell + 30-berry subsample — no camera needed.',
    verbose: 'Field sampling method for 9.8oz Mighty Blue clamshells when no camera is available. Weigh the clamshell for a fill check (actual vs label), then pull 30 berries, weigh them, and let the system estimate total berry count from the label weight and average berry weight. Grading is based on the labeled clamshell weight (282g) so results are consistent regardless of fill variance.',
    color: '#0891B2',
    steps: [
      'Pull a sealed 9.8oz Mighty Blue clamshell from the packing line.',
      'Place on the clamshell scale. Record gross weight — system will show net vs label as a fill check.',
      'Open clamshell and pull 30 berries at random.',
      'Weigh the 30-berry subsample. Record weight in grams.',
      'Return the 30 berries to the clamshell.',
      'Inspect every berry. Remove and sort all defects.',
      'Record defect counts below. System grades against 282g label weight.',
    ],
  },
}

// Clamshell profiles — editable defaults (built-ins). New per-pack-type keys
// (pint, 18oz, mightyblue) are the new universal modes that accept either camera total
// or 30-berry weight. Legacy 30-berry-only keys retained for history readability.
const CLAMSHELL_PROFILES = {
  pint:         { labelWeight: 302, tare: 20, unitLabel: 'Pint' },
  '18oz':       { labelWeight: 518, tare: 30, unitLabel: '18oz' },
  mightyblue:   { labelWeight: 282, tare: 20, unitLabel: 'Mighty Blue' },
  // Legacy 30-berry-only modes (still resolvable for historical samples)
  pint30:       { labelWeight: 302, tare: 20, unitLabel: 'Pint' },
  '18oz30':     { labelWeight: 518, tare: 30, unitLabel: '18oz' },
  mightyblue30: { labelWeight: 282, tare: 20, unitLabel: 'Mighty Blue' },
}

// Built-in method keys in display order
// Cycle order: per-pack-type camera modes first, then legacy 30-berry-only modes,
// then 600g and manual. The QCer can pick any of them — camera modes use the grader,
// 30-berry modes don't. Each pack type has both options for now; future cleanup can
// fold them into one dual-input mode if Jacob confirms.
const BUILTIN_METHOD_ORDER = ['fullcount', 'pint', '18oz', 'mightyblue', 'pint30', '18oz30', 'mightyblue30', '600g', 'manual']

// localStorage keys for admin settings
const LS_ENABLED = 'bc_enabled_methods'
const LS_CUSTOM  = 'bc_custom_methods'

function loadEnabledMethods() {
  try {
    const raw = localStorage.getItem(LS_ENABLED)
    if (!raw) return null // null = all enabled by default
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : null
  } catch { return null }
}

function saveEnabledMethods(keys) {
  try { localStorage.setItem(LS_ENABLED, JSON.stringify(keys)) } catch {}
}

function loadCustomMethods() {
  try {
    const raw = localStorage.getItem(LS_CUSTOM)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}

function saveCustomMethods(arr) {
  try { localStorage.setItem(LS_CUSTOM, JSON.stringify(arr)) } catch {}
}

// Build the combined METHODS map (built-ins + customs), and the combined profile map
function buildMethodRegistry(customs) {
  const methods = { ...METHODS }
  const profiles = { ...CLAMSHELL_PROFILES }
  for (const c of customs) {
    methods[c.key] = {
      label: c.label.toUpperCase(),
      brief: `${c.unitLabel} + 30-berry subsample — custom pack type.`,
      verbose: `Custom sampling type for ${c.unitLabel} clamshells. Weigh the clamshell for a fill check, pull 30 berries, weigh them, and let the system estimate total berry count from the ${c.labelWeight}g label weight.`,
      color: c.color || '#DB2777',
      steps: [
        `Pull a sealed ${c.unitLabel} clamshell from the packing line.`,
        'Place on the clamshell scale. Record gross weight.',
        'Open clamshell and pull 30 berries at random.',
        'Weigh the 30-berry subsample.',
        'Return the 30 berries to the clamshell.',
        'Inspect every berry. Remove and sort all defects.',
        `Record defect counts below. System grades against ${c.labelWeight}g label weight.`,
      ],
      _custom: true,
    }
    profiles[c.key] = { labelWeight: c.labelWeight, tare: c.tare, unitLabel: c.unitLabel }
  }
  return { methods, profiles }
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

export default function CountEntry({ counts, setCounts, detailed, onToggleDetailed, sampleMethod, onToggleMethod, onSetMethod, gradingStandard, onToggleStandard, onShowGradingGuide, dualLineMode, onToggleDualLineMode }) {
  // Admin: custom methods + enabled-methods filter
  const [customMethods, setCustomMethods] = useState(loadCustomMethods)
  const [enabledMethods, setEnabledMethodsState] = useState(loadEnabledMethods) // null = all
  const [showMethodsAdmin, setShowMethodsAdmin] = useState(false)
  const registry = buildMethodRegistry(customMethods)
  const allKeys = [...BUILTIN_METHOD_ORDER, ...customMethods.map(c => c.key)]
  const enabledKeys = enabledMethods === null ? allKeys : allKeys.filter(k => enabledMethods.includes(k))
  const cycleKeys = enabledKeys.length > 0 ? enabledKeys : allKeys

  // If the current method gets disabled, auto-switch to first enabled
  useEffect(() => {
    if (enabledKeys.length > 0 && !enabledKeys.includes(sampleMethod) && onSetMethod) {
      onSetMethod(enabledKeys[0])
    }
  }, [enabledKeys, sampleMethod, onSetMethod])

  const cycleMethod = () => {
    if (!onSetMethod) { onToggleMethod && onToggleMethod(); return }
    const idx = cycleKeys.indexOf(sampleMethod)
    const next = cycleKeys[(idx + 1) % cycleKeys.length]
    onSetMethod(next)
  }

  const saveAdmin = ({ enabled, customs }) => {
    if (customs) { setCustomMethods(customs); saveCustomMethods(customs) }
    if (enabled !== undefined) { setEnabledMethodsState(enabled); saveEnabledMethods(enabled) }
  }

  const [thirtyBerryWeight, setThirtyBerryWeight] = useState('')
  const [manualTotal, setManualTotal] = useState('')
  const [fullcountTotal, setFullcountTotal] = useState('')
  const [packWeight, setPackWeight] = useState('')
  const [expandedInfo, setExpandedInfo] = useState(null)
  const [simpleView, setSimpleView] = useState(() => {
    try { return localStorage.getItem('bc_qc_simple_view') === 'true' } catch { return false }
  })

  // Reset local fields when counts are cleared (after logging a sample)
  useEffect(() => {
    if (counts.good === 0 && counts.permanent === 0 && counts.condition === 0 && counts.decay === 0 && !counts._fullcountTotal) {
      setFullcountTotal('')
      setPackWeight('')
      setPintWeight('')
      setManualTotal('')
      setThirtyBerryWeight('')
      setClamshellGross('')
      setClamshellNetOverride('')
      setClamshell30Weight('')
    }
  }, [counts.good, counts.permanent, counts.condition, counts.decay])

  // Auto-detect sample method from incoming data
  useEffect(() => {
    if ((counts._source === 'grader' || counts._source === 'phone') && counts._fullcountTotal) {
      setFullcountTotal(String(counts._fullcountTotal))
      if (sampleMethod !== 'fullcount' && sampleMethod !== 'pint' && onSetMethod) onSetMethod('fullcount')
    }
  }, [counts._fullcountTotal, counts._source])

  const [pintWeight, setPintWeight] = useState('')
  const [pintTare, setPintTare] = useState(true) // subtract 20g clamshell weight

  // 30-berry clamshell modes (pint30, 18oz30)
  const [clamshellGross, setClamshellGross] = useState('')
  const [clamshellNetOverride, setClamshellNetOverride] = useState('') // manual entry, overrides gross-tare
  const [clamshell30Weight, setClamshell30Weight] = useState('')
  const [clamshellTareOn, setClamshellTareOn] = useState(() => {
    try { return localStorage.getItem('bc_clamshell_tare_on') === 'true' } catch { return false }
  })
  useEffect(() => {
    try { localStorage.setItem('bc_clamshell_tare_on', clamshellTareOn ? 'true' : 'false') } catch {}
  }, [clamshellTareOn])
  const [clamshellTareAmount, setClamshellTareAmount] = useState('20')
  const [clamshellLabelWeight, setClamshellLabelWeight] = useState('302')

  const isManual = sampleMethod === 'manual'
  const isFullCount = sampleMethod === 'fullcount'
  // Per-pack-type modes — accept camera total OR 30-berry weight. isPint kept as alias
  // for `sampleMethod === 'pint'` so existing pint-specific UI branches still apply when relevant.
  const isPint = sampleMethod === 'pint'
  const is18oz = sampleMethod === '18oz'
  const isMightyBlue = sampleMethod === 'mightyblue'
  const isPackTypeMode = isPint || is18oz || isMightyBlue
  // Legacy 30-berry-only modes — still resolvable for older history samples
  const isPint30 = sampleMethod === 'pint30'
  const is18oz30 = sampleMethod === '18oz30'
  const isMightyBlue30 = sampleMethod === 'mightyblue30'
  const isClamshell30 = isPint30 || is18oz30 || isMightyBlue30 || !!(registry.profiles[sampleMethod] && sampleMethod !== 'pint' && sampleMethod !== '18oz' && sampleMethod !== 'mightyblue' && sampleMethod !== '600g' && sampleMethod !== 'fullcount' && sampleMethod !== 'manual')

  // Apply clamshell profile defaults when switching into a 30-berry mode
  useEffect(() => {
    if (!isClamshell30) return
    const profile = registry.profiles[sampleMethod]
    if (!profile) return
    setClamshellTareAmount(String(profile.tare))
    setClamshellLabelWeight(String(profile.labelWeight))
  }, [sampleMethod])

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

  // === Pint mode calculations ===
  // Per-pack-type tare (pint=20, 18oz=30, mightyblue=20). Falls back to pint default
  // for unknown sampleMethods (e.g. fullcount, manual — these don't render the clamshell card anyway).
  const PACK_PROFILE = CLAMSHELL_PROFILES[sampleMethod] || CLAMSHELL_PROFILES.pint
  const CLAMSHELL_TARE = PACK_PROFILE.tare
  const PACK_LABEL_WEIGHT = PACK_PROFILE.labelWeight
  const pintGross = parseFloat(pintWeight) || 0
  const pintNetWeight = pintTare ? Math.max(0, pintGross - CLAMSHELL_TARE) : pintGross
  // 600g-equivalent projection — for MBG cross-reporting consistency, always scaled to 600g
  const pintScaleFactor = pintNetWeight > 0 ? 600 / pintNetWeight : 0
  const pint600gEquivTotal = pintScaleFactor > 0 && parseInt(fullcountTotal) ? Math.round(parseInt(fullcountTotal) * pintScaleFactor) : null

  // === Clamshell 30-berry mode calculations (pint30, 18oz30) ===
  const clamshellTareVal = parseFloat(clamshellTareAmount) || 0
  const clamshellGrossVal = parseFloat(clamshellGross) || 0
  const clamshellNetComputed = clamshellTareOn ? Math.max(0, clamshellGrossVal - clamshellTareVal) : clamshellGrossVal
  const clamshellNetOverrideVal = parseFloat(clamshellNetOverride) || 0
  // Recorded net: manual override takes precedence; else computed from gross - tare
  const clamshellNetMeasured = clamshellNetOverrideVal > 0 ? clamshellNetOverrideVal : clamshellNetComputed
  const clamshellLabel = parseFloat(clamshellLabelWeight) || 0
  const clamshellFillDelta = clamshellNetMeasured > 0 && clamshellLabel > 0 ? clamshellNetMeasured - clamshellLabel : null
  const clamshell30Val = parseFloat(clamshell30Weight) || 0
  const clamshellAvgBerryWeight = clamshell30Val > 0 ? clamshell30Val / 30 : 0
  // Grading uses MEASURED clamshell weight when entered (the actual pack the
  // customer opens), falls back to label target if measured weight isn't available.
  const clamshellGradingWeight = clamshellNetMeasured > 0 ? clamshellNetMeasured : clamshellLabel
  const clamshellEstimatedTotal = clamshellAvgBerryWeight > 0 && clamshellGradingWeight > 0
    ? Math.round(clamshellGradingWeight / clamshellAvgBerryWeight) : null
  const clamshellBerrySize = !clamshell30Val ? null
    : clamshell30Val <= 33 ? 'Small'
    : clamshell30Val <= 65 ? 'Medium'
    : 'Large'
  const clamshellBerrySizeColor = clamshellBerrySize === 'Small' ? COLORS.amber
    : clamshellBerrySize === 'Large' ? COLORS.green
    : clamshellBerrySize === 'Medium' ? COLORS.text
    : COLORS.text3

  // === Active total — depends on mode ===
  const estimatedTotal = (isFullCount || isPackTypeMode) ? (parseInt(fullcountTotal) || null)
    : isManual ? (parseInt(manualTotal) || null)
    : isClamshell30 ? clamshellEstimatedTotal
    : estimatedTotal600

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
        return { ...prev, _sampleMethod: 'fullcount', _fullcountTotal: t, _packWeight: w, _manualTotal: 0, _thirtyBerryWeight: 0, _pintWeight: 0 }
      })
    } else if (isPackTypeMode) {
      const t = parseInt(fullcountTotal) || 0
      const pw = parseFloat(pintWeight) || 0
      setCounts(prev => {
        if (prev._sampleMethod === sampleMethod && prev._fullcountTotal === t && prev._pintWeight === pw) return prev
        return {
          ...prev,
          _sampleMethod: sampleMethod,
          _fullcountTotal: t,
          _pintWeight: pw,
          _pintScaleFactor: pintScaleFactor,
          _pint600gEquivTotal: pint600gEquivTotal,
          _packLabelWeight: PACK_LABEL_WEIGHT,
          _manualTotal: 0,
          _thirtyBerryWeight: 0,
          _packWeight: 0,
        }
      })
    } else if (isClamshell30) {
      const w30 = parseFloat(clamshell30Weight) || 0
      const gross = parseFloat(clamshellGross) || 0
      setCounts(prev => {
        if (prev._sampleMethod === sampleMethod &&
            prev._thirtyBerryWeight === w30 &&
            prev._clamshellGross === gross &&
            prev._clamshellLabel === clamshellLabel) return prev
        return {
          ...prev,
          _sampleMethod: sampleMethod,
          _thirtyBerryWeight: w30,
          _clamshellGross: gross,
          _clamshellNet: clamshellNetMeasured,
          _clamshellLabel: clamshellLabel,
          _clamshellTare: clamshellTareOn ? clamshellTareVal : 0,
          _clamshellEstimatedTotal: clamshellEstimatedTotal || 0,
          _manualTotal: 0, _fullcountTotal: 0, _packWeight: 0, _pintWeight: 0,
        }
      })
    } else if (isManual) {
      const t = parseInt(manualTotal) || 0
      setCounts(prev => {
        if (prev._sampleMethod === 'manual' && prev._manualTotal === t) return prev
        return { ...prev, _sampleMethod: 'manual', _manualTotal: t, _thirtyBerryWeight: 0, _fullcountTotal: 0, _packWeight: 0, _pintWeight: 0 }
      })
    } else {
      const w = parseFloat(thirtyBerryWeight) || 0
      setCounts(prev => {
        if (prev._sampleMethod === '600g' && prev._thirtyBerryWeight === w) return prev
        return { ...prev, _sampleMethod: '600g', _thirtyBerryWeight: w, _manualTotal: 0, _fullcountTotal: 0, _packWeight: 0, _pintWeight: 0 }
      })
    }
  }, [thirtyBerryWeight, manualTotal, fullcountTotal, packWeight, pintWeight, clamshell30Weight, clamshellGross, clamshellNetOverride, clamshellLabel, clamshellTareOn, clamshellTareVal, isManual, isFullCount, isPackTypeMode, isClamshell30, sampleMethod, pintScaleFactor, pint600gEquivTotal, PACK_LABEL_WEIGHT])

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
  }, [(isFullCount || isPackTypeMode) ? fullcountTotal : isManual ? manualTotal : isClamshell30 ? clamshell30Weight : thirtyBerryWeight, estimatedTotal])

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

  const headroomMap = useMemo(() => {
    if (!detailed) return null
    // Bars are nonsense when the denominator is small (e.g. 30-berry weight not
    // entered yet) — every defect skips tiers because each berry = several %.
    if (!estimatedTotal || estimatedTotal < 50) return null
    const tol = (GRADING_STANDARDS[gradingStandard] || GRADING_STANDARDS.mbg).tolerances
    return defectsToNextDrop(counts, tol)
  }, [detailed, counts, gradingStandard, estimatedTotal])

  const inputBox = (key, label, color, borderColor) => {
    const drops = headroomMap?.perDefect?.[key]
    return (
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
        {detailed && drops && drops.length > 0 && <DefectHeadroomBar drops={drops} />}
      </div>
    )
  }

  const methodConfig = registry.methods[sampleMethod] || METHODS[sampleMethod]
  const standardConfig = STANDARDS[gradingStandard]
  const detailConfig = detailed ? DETAIL_MODES.detailed : DETAIL_MODES.quick

  return (
    <div>
      {/* === QC SETTINGS === */}
      <div style={{
        background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
        borderRadius: 4, padding: simpleView ? '6px 12px' : '10px 12px', marginBottom: 8,
      }}>
        {simpleView ? (
          /* --- SIMPLE VIEW: single row with toggle buttons --- */
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {onToggleStandard && (
              <button onClick={onToggleStandard} style={{
                fontFamily: FONT, fontSize: 9, fontWeight: 600,
                color: gradingStandard === 'butterfly' ? COLORS.green : COLORS.text2,
                background: gradingStandard === 'butterfly' ? COLORS.green + '15' : COLORS.bg,
                border: `1px solid ${gradingStandard === 'butterfly' ? COLORS.green : COLORS.border}`,
                padding: '3px 10px', borderRadius: 3, cursor: 'pointer',
                letterSpacing: '0.06em',
              }}>
                {standardConfig.label}
              </button>
            )}
            {onShowGradingGuide && (
              <button onClick={onShowGradingGuide} style={{
                fontFamily: FONT, fontSize: 8, fontWeight: 600,
                color: COLORS.text3, background: 'transparent',
                border: `1px solid ${COLORS.border}`,
                padding: '3px 6px', borderRadius: 3, cursor: 'pointer',
              }}>GUIDE</button>
            )}
            <button onClick={cycleMethod} style={{
              fontFamily: FONT, fontSize: 9, fontWeight: 600,
              color: methodConfig.color,
              background: methodConfig.color + '15',
              border: `1px solid ${methodConfig.color}`,
              padding: '3px 10px', borderRadius: 3, cursor: 'pointer',
              letterSpacing: '0.06em',
            }}>
              {methodConfig.label}
            </button>
            <button onClick={onToggleDetailed} style={{
              fontFamily: FONT, fontSize: 9, fontWeight: 600,
              color: detailed ? COLORS.amber : COLORS.text2,
              background: detailed ? COLORS.amber + '15' : COLORS.bg,
              border: `1px solid ${detailed ? COLORS.amber : COLORS.border}`,
              padding: '3px 10px', borderRadius: 3, cursor: 'pointer',
              letterSpacing: '0.06em',
            }}>
              {detailConfig.label}
            </button>
            <div style={{ flex: 1 }} />
            <button onClick={() => setShowMethodsAdmin(true)} style={{
              fontFamily: FONT, fontSize: 8, color: COLORS.text3,
              background: 'transparent', border: `1px solid ${COLORS.border}`,
              padding: '2px 6px', borderRadius: 2, cursor: 'pointer',
              letterSpacing: '0.06em',
            }} title="Manage sample types">
              ADMIN
            </button>
            <button onClick={() => { setSimpleView(false); localStorage.setItem('bc_qc_simple_view', 'false') }} style={{
              fontFamily: FONT, fontSize: 8, color: COLORS.text3,
              background: 'transparent', border: `1px solid ${COLORS.border}`,
              padding: '2px 6px', borderRadius: 2, cursor: 'pointer',
              letterSpacing: '0.06em',
            }}>
              EXPAND
            </button>
          </div>
        ) : (
          /* --- FULL VIEW: detailed settings with descriptions --- */
          <>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
            }}>
              <div style={{
                fontFamily: FONT, fontSize: 9, fontWeight: 600, color: COLORS.text3,
                textTransform: 'uppercase', letterSpacing: '0.1em',
              }}>QC Settings</div>
              <button onClick={() => { setSimpleView(true); localStorage.setItem('bc_qc_simple_view', 'true') }} style={{
                fontFamily: FONT, fontSize: 8, color: COLORS.text3,
                background: 'transparent', border: `1px solid ${COLORS.border}`,
                padding: '2px 6px', borderRadius: 2, cursor: 'pointer',
                letterSpacing: '0.06em',
              }}>
                SIMPLIFY
              </button>
            </div>

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
                onClick={cycleMethod}
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

              {/* Admin: manage sample types */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                paddingTop: 4, borderTop: `1px dashed ${COLORS.border}`,
              }}>
                <div style={{
                  fontFamily: FONT, fontSize: 9, fontWeight: 600, color: COLORS.text3,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>Available Types</div>
                <button onClick={() => setShowMethodsAdmin(true)} style={{
                  fontFamily: FONT, fontSize: 9, fontWeight: 600,
                  color: COLORS.text2, background: COLORS.bg,
                  border: `1px solid ${COLORS.border2}`,
                  padding: '4px 12px', borderRadius: 3, cursor: 'pointer',
                  letterSpacing: '0.06em',
                }}>MANAGE TYPES ({enabledKeys.length}/{allKeys.length})</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* === SOP PROCEDURE STEPS (hidden in simple view) === */}
      {!simpleView && <SOPSteps steps={methodConfig.steps} />}

      {/* === SAMPLE SIZE INPUT — mode-dependent === */}
      {(isFullCount || isPackTypeMode) ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
          {/* Pack-type modes: clamshell weight — fill audit + 600g equivalent scaling */}
          {isPackTypeMode ? (
            <div style={{
              background: COLORS.bg2, border: `1px solid ${methodConfig.color}40`,
              borderRadius: 4, padding: '10px 12px',
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: 6,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    fontFamily: FONT, fontSize: 9, color: methodConfig.color,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>{pintTare ? 'Gross Weight (g)' : 'Net Berry Weight (g)'}</div>
                  <button onClick={() => setPintTare(prev => !prev)} style={{
                    fontFamily: FONT, fontSize: 8, fontWeight: 600,
                    color: pintTare ? methodConfig.color : COLORS.text3,
                    background: pintTare ? methodConfig.color + '15' : 'transparent',
                    border: `1px solid ${pintTare ? methodConfig.color : COLORS.border}`,
                    padding: '1px 6px', borderRadius: 3, cursor: 'pointer',
                    letterSpacing: '0.04em',
                  }}>
                    TARE −{CLAMSHELL_TARE}g {pintTare ? 'ON' : 'OFF'}
                  </button>
                </div>
                {pintNetWeight > 0 && (
                  <div style={{
                    fontFamily: FONT, fontSize: 9, color: COLORS.text3,
                    letterSpacing: '0.04em',
                  }}>
                    {pintTare && pintGross > 0 ? `${pintGross}g − ${CLAMSHELL_TARE}g = ${pintNetWeight}g` : `${pintNetWeight}g`}
                    {` · ${(pintNetWeight / 28.35).toFixed(1)} oz`}
                    {pintScaleFactor > 0 && ` · ${pintScaleFactor.toFixed(2)}x → 600g`}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <input type="number" min="0" step="0.1"
                  value={pintWeight}
                  onChange={e => setPintWeight(e.target.value)}
                  placeholder="0"
                  style={{
                    background: 'transparent', border: 'none', padding: 0,
                    fontFamily: FONT, fontSize: 18, fontWeight: 600,
                    color: pintWeight ? COLORS.text : COLORS.text3,
                    width: '80px', outline: 'none',
                  }}
                />
                {pint600gEquivTotal && (
                  <div style={{
                    fontFamily: FONT, fontSize: 11, color: methodConfig.color, fontWeight: 600,
                  }}>
                    600g equiv: ~{pint600gEquivTotal} berries
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Fullcount: pack weight — calibration check */
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
          )}
          {/* Total berries — from camera */}
          <div style={{
            background: COLORS.bg2, border: `1px solid ${isPackTypeMode ? methodConfig.color + '40' : '#2563EB40'}`,
            borderRadius: 4, padding: '10px 12px',
          }}>
            <div style={{
              fontFamily: FONT, fontSize: 9, color: isPackTypeMode ? methodConfig.color : '#2563EB',
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
                  fontFamily: FONT, fontSize: 11, color: isPackTypeMode ? methodConfig.color : '#2563EB', fontWeight: 600,
                }}>
                  every berry inspected
                </div>
              )}
            </div>
          </div>
        </div>
      ) : isClamshell30 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
          {/* Clamshell weight card — prominent */}
          <div style={{
            background: COLORS.bg, border: `2px solid ${methodConfig.color}`,
            borderRadius: 6, padding: '12px 14px',
          }}>
            {/* Header row: label + target + fill delta + compact label input */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 8, gap: 8, flexWrap: 'wrap',
            }}>
              <div style={{
                fontFamily: FONT, fontSize: 11, fontWeight: 700, color: methodConfig.color,
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>{clamshellTareOn ? 'Clamshell Gross' : 'Clamshell Weight'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {clamshellFillDelta !== null && (
                  <div style={{
                    fontFamily: FONT, fontSize: 10,
                    color: CLASS_COLORS[classifyWeight(clamshellNetMeasured, clamshellLabel, loadPackTolerance())],
                    letterSpacing: '0.04em', fontWeight: 700,
                  }}>
                    {clamshellFillDelta >= 0 ? '+' : ''}{clamshellFillDelta.toFixed(1)}g
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{
                    fontFamily: FONT, fontSize: 9, color: COLORS.text3,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>Label Target</span>
                  <input type="number" min="0" step="1"
                    value={clamshellLabelWeight}
                    onChange={e => setClamshellLabelWeight(e.target.value)}
                    placeholder="302"
                    style={{
                      fontFamily: FONT, fontSize: 13, fontWeight: 700,
                      color: methodConfig.color, background: COLORS.bg2,
                      border: `1px solid ${methodConfig.color}40`,
                      borderRadius: 3, padding: '3px 6px',
                      width: 64, outline: 'none',
                    }}
                  />
                  <span style={{ fontFamily: FONT, fontSize: 10, color: COLORS.text3 }}>g</span>
                </div>
              </div>
            </div>

            {/* Big weight input */}
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: 10,
              padding: '6px 10px',
              background: COLORS.bg2, border: `1px solid ${methodConfig.color}30`,
              borderRadius: 4,
            }}>
              <input type="number" min="0" step="0.1"
                value={clamshellGross}
                onChange={e => setClamshellGross(e.target.value)}
                placeholder="0"
                style={{
                  background: 'transparent', border: 'none', padding: 0,
                  fontFamily: FONT, fontSize: 32, fontWeight: 800,
                  color: clamshellGross ? COLORS.text : COLORS.text3,
                  width: 120, outline: 'none',
                }}
              />
              <span style={{
                fontFamily: FONT, fontSize: 14, fontWeight: 600, color: COLORS.text3,
              }}>g</span>
              <div style={{ flex: 1 }} />
              {/* Tare toggle — compact when OFF, details expand when ON */}
              <button
                onClick={() => setClamshellTareOn(prev => !prev)}
                style={{
                  fontFamily: FONT, fontSize: 10, fontWeight: 700,
                  color: clamshellTareOn ? COLORS.white : COLORS.text3,
                  background: clamshellTareOn ? methodConfig.color : COLORS.bg,
                  border: `1px solid ${clamshellTareOn ? methodConfig.color : COLORS.border}`,
                  padding: '5px 10px', borderRadius: 4, cursor: 'pointer',
                  letterSpacing: '0.08em',
                }}
              >
                TARE {clamshellTareOn ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Tare details — only when ON */}
            {clamshellTareOn && (
              <div style={{
                marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${COLORS.border}`,
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    fontFamily: FONT, fontSize: 9, fontWeight: 600, color: COLORS.text3,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>Tare amount</span>
                  <input type="number" min="0" step="0.1"
                    value={clamshellTareAmount}
                    onChange={e => setClamshellTareAmount(e.target.value)}
                    placeholder="20"
                    style={{
                      fontFamily: FONT, fontSize: 12, fontWeight: 700,
                      color: COLORS.text, background: COLORS.bg,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 3, padding: '3px 6px',
                      width: 64, outline: 'none',
                    }}
                  />
                  <span style={{ fontFamily: FONT, fontSize: 10, color: COLORS.text3 }}>g</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    fontFamily: FONT, fontSize: 9, fontWeight: 600, color: methodConfig.color,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>Net (Recorded)</span>
                  <input type="number" min="0" step="0.1"
                    value={clamshellNetOverride || (clamshellNetComputed > 0 ? clamshellNetComputed.toFixed(1) : '')}
                    onChange={e => setClamshellNetOverride(e.target.value)}
                    placeholder={clamshellNetComputed > 0 ? clamshellNetComputed.toFixed(1) : '0'}
                    style={{
                      fontFamily: FONT, fontSize: 14, fontWeight: 700,
                      color: COLORS.text, background: COLORS.bg,
                      border: `1px solid ${methodConfig.color}60`,
                      borderRadius: 3, padding: '3px 6px',
                      width: 80, outline: 'none',
                    }}
                  />
                  <span style={{ fontFamily: FONT, fontSize: 10, color: COLORS.text3 }}>g</span>
                  {clamshellNetOverride && (
                    <button onClick={() => setClamshellNetOverride('')} style={{
                      fontFamily: FONT, fontSize: 8, color: COLORS.text3,
                      background: 'transparent', border: `1px solid ${COLORS.border}`,
                      padding: '1px 6px', borderRadius: 2, cursor: 'pointer',
                      letterSpacing: '0.04em',
                    }}>USE COMPUTED</button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 30-berry subsample weight — prominent */}
          <div style={{
            background: COLORS.bg, border: `2px solid ${methodConfig.color}`,
            borderRadius: 6, padding: '12px 14px',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 8, gap: 8, flexWrap: 'wrap',
            }}>
              <div style={{
                fontFamily: FONT, fontSize: 11, fontWeight: 700, color: methodConfig.color,
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>30-Berry Subsample</div>
              {clamshellBerrySize && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{
                    fontFamily: FONT, fontSize: 10, color: COLORS.text3, fontWeight: 500,
                  }}>
                    {clamshellAvgBerryWeight > 0 ? `${Math.round(clamshellAvgBerryWeight * 100) / 100}g avg` : ''}
                  </span>
                  <span style={{
                    fontFamily: FONT, fontSize: 10, fontWeight: 700,
                    color: clamshellBerrySizeColor, letterSpacing: '0.06em',
                    padding: '2px 8px',
                    background: clamshellBerrySizeColor + '18',
                    border: `1px solid ${clamshellBerrySizeColor}40`,
                    borderRadius: 3,
                  }}>
                    {clamshellBerrySize.toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: 10,
              padding: '6px 10px',
              background: COLORS.bg2, border: `1px solid ${methodConfig.color}30`,
              borderRadius: 4,
            }}>
              <input type="number" min="0" step="0.1"
                value={clamshell30Weight}
                onChange={e => setClamshell30Weight(e.target.value)}
                placeholder="0"
                style={{
                  background: 'transparent', border: 'none', padding: 0,
                  fontFamily: FONT, fontSize: 32, fontWeight: 800,
                  color: clamshell30Weight ? COLORS.text : COLORS.text3,
                  width: 120, outline: 'none',
                }}
              />
              <span style={{
                fontFamily: FONT, fontSize: 14, fontWeight: 600, color: COLORS.text3,
              }}>g</span>
              <div style={{ flex: 1 }} />
              {clamshellEstimatedTotal && (
                <div style={{
                  fontFamily: FONT, fontSize: 11, fontWeight: 700, color: methodConfig.color,
                  textAlign: 'right',
                }}>
                  ≈ {clamshellEstimatedTotal} berries
                  <div style={{ fontSize: 9, fontWeight: 500, color: COLORS.text3 }}>
                    in {clamshellLabel}g label
                  </div>
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
            <div>{(isFullCount || isPackTypeMode) ? 'Snap photo for count' : isManual ? 'Enter total berry count' : 'Enter 30-berry weight'}</div>
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

      {showMethodsAdmin && (
        <MethodsAdmin
          allKeys={allKeys}
          enabledMethods={enabledMethods}
          customMethods={customMethods}
          registry={registry}
          dualLineMode={dualLineMode}
          onToggleDualLineMode={onToggleDualLineMode}
          onSave={saveAdmin}
          onClose={() => setShowMethodsAdmin(false)}
        />
      )}
    </div>
  )
}

// ============================================================
// METHODS ADMIN — manage enabled types + custom pack types
// ============================================================

function MethodsAdmin({ allKeys, enabledMethods, customMethods, registry, dualLineMode, onToggleDualLineMode, onSave, onClose }) {
  const [tolerance, setTolerance] = useState(loadPackTolerance())
  const currentEnabled = enabledMethods === null ? allKeys : enabledMethods
  const [enabled, setEnabled] = useState(currentEnabled)
  const [customs, setCustoms] = useState(customMethods)
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState({ label: '', labelWeight: '', tare: '' })

  const toggle = (key) => {
    setEnabled(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  const addCustom = () => {
    const label = form.label.trim()
    const labelWeight = parseFloat(form.labelWeight) || 0
    const tare = parseFloat(form.tare) || 0
    if (!label || labelWeight <= 0) return
    const key = 'custom_' + label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_' + Date.now().toString(36)
    const newCustom = { key, label, unitLabel: label, labelWeight, tare, color: '#DB2777' }
    const next = [...customs, newCustom]
    setCustoms(next)
    setEnabled(prev => [...prev, key])
    setShowAddForm(false)
    setForm({ label: '', labelWeight: '', tare: '' })
  }

  const removeCustom = (key) => {
    setCustoms(prev => prev.filter(c => c.key !== key))
    setEnabled(prev => prev.filter(k => k !== key))
  }

  const save = () => {
    onSave({ enabled, customs })
    savePackTolerance(tolerance)
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 3000,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 10, padding: 20,
        maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto',
        border: `2px solid ${COLORS.border2}`,
      }}>
        <div style={{
          fontFamily: FONT, fontSize: 14, fontWeight: 800, color: COLORS.text,
          marginBottom: 4, letterSpacing: '0.04em',
        }}>Manage Sample Types</div>
        <div style={{
          fontFamily: FONT, fontSize: 10, color: COLORS.text3, marginBottom: 14,
        }}>Check which types the QCer can cycle through. Saves until you change it.</div>

        {/* Pack weight tolerance rules — applies to all packs */}
        <div style={{
          padding: '10px 12px', marginBottom: 12,
          background: COLORS.bg2, border: `1px solid ${COLORS.border2}`, borderRadius: 4,
        }}>
          <div style={{
            fontFamily: FONT, fontSize: 10, fontWeight: 700, color: COLORS.text,
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
          }}>Weight Tolerance Rules</div>
          <div style={{
            fontFamily: FONT, fontSize: 10, color: COLORS.text3, lineHeight: 1.4, marginBottom: 8,
          }}>Applies across all packs. Green = within ±X% of label. Yellow = outside green band up to Y grams overweight. Red = over Y grams overweight.</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <label style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3 }}>
              Green band ±%
              <input type="number" min="0" step="0.1" value={tolerance.greenPct}
                onChange={e => setTolerance({ ...tolerance, greenPct: parseFloat(e.target.value) || 0 })}
                style={{
                  display: 'block', marginTop: 3, padding: '6px 8px', width: 80,
                  fontFamily: FONT, fontSize: 14, fontWeight: 700, color: '#0F6E56',
                  border: `1px solid #0F6E5660`, borderRadius: 3, outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </label>
            <label style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3 }}>
              Yellow → Red threshold (g over)
              <input type="number" min="0" step="1" value={tolerance.yellowOverG}
                onChange={e => setTolerance({ ...tolerance, yellowOverG: parseFloat(e.target.value) || 0 })}
                style={{
                  display: 'block', marginTop: 3, padding: '6px 8px', width: 80,
                  fontFamily: FONT, fontSize: 14, fontWeight: 700, color: '#A32D2D',
                  border: `1px solid #A32D2D60`, borderRadius: 3, outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </label>
            <div style={{
              flex: 1, alignSelf: 'flex-end',
              fontFamily: FONT, fontSize: 9, color: COLORS.text3, lineHeight: 1.5,
            }}>
              <span style={{ color: '#0F6E56', fontWeight: 700 }}>Green</span>: within ±{tolerance.greenPct}% (pint 302g ≈ ±{(302 * tolerance.greenPct / 100).toFixed(1)}g)<br />
              <span style={{ color: '#BA7517', fontWeight: 700 }}>Yellow</span>: outside green, over by ≤{tolerance.yellowOverG}g<br />
              <span style={{ color: '#A32D2D', fontWeight: 700 }}>Red</span>: over label by &gt;{tolerance.yellowOverG}g
            </div>
          </div>
        </div>

        {/* Dual-line mode toggle */}
        {onToggleDualLineMode && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', marginBottom: 14,
            background: dualLineMode ? COLORS.green + '10' : COLORS.bg2,
            border: `1px solid ${dualLineMode ? COLORS.green + '60' : COLORS.border}`,
            borderRadius: 4,
          }}>
            <button onClick={onToggleDualLineMode} style={{
              fontFamily: FONT, fontSize: 11, fontWeight: 700,
              color: dualLineMode ? COLORS.white : COLORS.text3,
              background: dualLineMode ? COLORS.green : COLORS.bg,
              border: `1px solid ${dualLineMode ? COLORS.green : COLORS.border}`,
              padding: '6px 14px', borderRadius: 4, cursor: 'pointer',
              letterSpacing: '0.08em', minWidth: 78,
            }}>
              DUAL LINE {dualLineMode ? 'ON' : 'OFF'}
            </button>
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: FONT, fontSize: 11, fontWeight: 700, color: COLORS.text,
                letterSpacing: '0.04em',
              }}>Line 1 / Line 2 parallel pallets</div>
              <div style={{
                fontFamily: FONT, fontSize: 9, color: COLORS.text3, lineHeight: 1.3,
              }}>Show LINE 1 / LINE 2 switcher to work two pallets in parallel.</div>
            </div>
          </div>
        )}

        {/* Method list with toggles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          {allKeys.map(key => {
            const cfg = registry.methods[key]
            if (!cfg) return null
            const isOn = enabled.includes(key)
            const isCustom = !!cfg._custom
            return (
              <div key={key} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px',
                background: isOn ? cfg.color + '10' : COLORS.bg2,
                border: `1px solid ${isOn ? cfg.color + '60' : COLORS.border}`,
                borderRadius: 4,
              }}>
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={() => toggle(key)}
                  style={{ width: 18, height: 18, cursor: 'pointer', accentColor: cfg.color }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: FONT, fontSize: 11, fontWeight: 700,
                    color: isOn ? cfg.color : COLORS.text2, letterSpacing: '0.04em',
                  }}>{cfg.label}</div>
                  <div style={{
                    fontFamily: FONT, fontSize: 9, color: COLORS.text3, lineHeight: 1.3,
                  }}>{cfg.brief}</div>
                </div>
                {isCustom && (
                  <button onClick={() => removeCustom(key)} style={{
                    fontFamily: FONT, fontSize: 9, color: COLORS.red,
                    background: 'transparent', border: `1px solid ${COLORS.red}40`,
                    padding: '2px 8px', borderRadius: 2, cursor: 'pointer',
                  }}>REMOVE</button>
                )}
              </div>
            )
          })}
        </div>

        {/* Add custom */}
        {showAddForm ? (
          <div style={{
            padding: 12, marginBottom: 14,
            background: COLORS.bg2, border: `1px solid ${COLORS.border2}`, borderRadius: 4,
          }}>
            <div style={{
              fontFamily: FONT, fontSize: 10, fontWeight: 700, color: COLORS.text,
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
            }}>Add Custom Pack Type (30-berry clamshell)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontFamily: FONT, fontSize: 10, color: COLORS.text3 }}>
                Name (e.g., "32oz", "2lb")
                <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })}
                  placeholder="32oz"
                  style={{
                    display: 'block', width: '100%', marginTop: 3, padding: '6px 8px',
                    fontFamily: FONT, fontSize: 13, color: COLORS.text,
                    border: `1px solid ${COLORS.border}`, borderRadius: 3, outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <label style={{ flex: 1, fontFamily: FONT, fontSize: 10, color: COLORS.text3 }}>
                  Label Weight (g)
                  <input type="number" min="0" value={form.labelWeight}
                    onChange={e => setForm({ ...form, labelWeight: e.target.value })}
                    placeholder="907"
                    style={{
                      display: 'block', width: '100%', marginTop: 3, padding: '6px 8px',
                      fontFamily: FONT, fontSize: 13, color: COLORS.text,
                      border: `1px solid ${COLORS.border}`, borderRadius: 3, outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </label>
                <label style={{ flex: 1, fontFamily: FONT, fontSize: 10, color: COLORS.text3 }}>
                  Tare (g)
                  <input type="number" min="0" value={form.tare}
                    onChange={e => setForm({ ...form, tare: e.target.value })}
                    placeholder="35"
                    style={{
                      display: 'block', width: '100%', marginTop: 3, padding: '6px 8px',
                      fontFamily: FONT, fontSize: 13, color: COLORS.text,
                      border: `1px solid ${COLORS.border}`, borderRadius: 3, outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </label>
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button onClick={() => { setShowAddForm(false); setForm({ label: '', labelWeight: '', tare: '' }) }}
                  style={{
                    fontFamily: FONT, fontSize: 10, color: COLORS.text3,
                    background: 'transparent', border: `1px solid ${COLORS.border}`,
                    padding: '6px 12px', borderRadius: 3, cursor: 'pointer',
                  }}>CANCEL</button>
                <button onClick={addCustom}
                  disabled={!form.label || !parseFloat(form.labelWeight)}
                  style={{
                    fontFamily: FONT, fontSize: 10, fontWeight: 700, color: '#fff',
                    background: (!form.label || !parseFloat(form.labelWeight)) ? '#aaa' : COLORS.green,
                    border: 'none', padding: '6px 14px', borderRadius: 3,
                    cursor: (!form.label || !parseFloat(form.labelWeight)) ? 'not-allowed' : 'pointer',
                    letterSpacing: '0.06em',
                  }}>ADD</button>
              </div>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAddForm(true)} style={{
            width: '100%', padding: '8px 12px', marginBottom: 14,
            fontFamily: FONT, fontSize: 10, fontWeight: 600,
            color: COLORS.text2, background: COLORS.bg,
            border: `1px dashed ${COLORS.border2}`, borderRadius: 3, cursor: 'pointer',
            letterSpacing: '0.06em',
          }}>+ ADD CUSTOM PACK TYPE</button>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            fontFamily: FONT, fontSize: 11, color: COLORS.text2,
            background: 'transparent', border: `1px solid ${COLORS.border}`,
            padding: '8px 16px', borderRadius: 4, cursor: 'pointer',
          }}>CANCEL</button>
          <button onClick={save} style={{
            fontFamily: FONT, fontSize: 11, fontWeight: 700, color: '#fff',
            background: COLORS.green, border: 'none',
            padding: '8px 20px', borderRadius: 4, cursor: 'pointer',
            letterSpacing: '0.06em',
          }}>SAVE</button>
        </div>
      </div>
    </div>
  )
}

const sectionLabel = {
  fontFamily: FONT, fontSize: 9, fontWeight: 600,
  color: COLORS.text3, letterSpacing: '0.08em',
  textTransform: 'uppercase', marginBottom: 4,
}
