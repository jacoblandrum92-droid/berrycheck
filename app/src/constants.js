// Design tokens — light professional theme (PrimusEngine-adjacent)
export const COLORS = {
  bg: '#ffffff',
  bg2: '#f7f7f5',
  bg3: '#eeedea',
  border: '#ddd',
  border2: '#bbb',
  green: '#0F6E56',
  greenDim: '#E1F5EE',
  amber: '#BA7517',
  amberDim: '#FAEEDA',
  red: '#A32D2D',
  redDim: '#FCEBEB',
  purple: '#534AB7',
  text: '#1a1a1a',
  text2: '#666',
  text3: '#999',
  white: '#ffffff',
}

export const FONT = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"

// ============================================================
// MBG GRADING STANDARD — percentage-based, 600g sample
// ============================================================
//
// SAMPLE: 600 grams of fruit
// BERRY COUNT: Weigh 30-berry subsample, calculate total count
//   Berry Count = 600g / (30-berry weight / 30)
//
// GRADES: Excellent > Good > Fair > Poor
//
// PERMANENT DEFECTS (don't change in transit):
//   Stems, Green/Red, Scars/Dry Broken Skin
//
// CONDITION DEFECTS (can worsen in transit):
//   Shrivel, Bruise, Soft, Mechanically Crushed,
//   Decay (Alternaria/Anthracnose), White Mold, Leaky/Splits
//
// White Mold: 0% for Excellent, any = auto-downgrade
// Decay: 0% for Excellent, ≤1% Good, ≤1.78% Fair
// ============================================================

// MBG tolerance chart — maximum percentages per grade
export const MBG_TOLERANCES = {
  permanent: {
    stems:    { excellent: 4, good: 6, fair: 8 },
    greenRed: { excellent: 5, good: 7, fair: 9 },
    scars:    { excellent: 4, good: 6, fair: 8 },
    totalMax: { excellent: 5, good: 7, fair: 9 },
  },
  condition: {
    shrivel:  { excellent: 3, good: 4, fair: 6 },
    bruise:   { excellent: 3, good: 4, fair: 6 },
    soft:     { excellent: 2, good: 3, fair: 5 },
    crushed:  { excellent: 1, good: 2, fair: 3 },
    decay:    { excellent: 0, good: 1, fair: 1.78 },
    whiteMold:{ excellent: 0, good: 0, fair: 0 }, // any = Poor for white mold
    leaky:    { excellent: 1, good: 2, fair: 3 },
    totalMax: { excellent: 3, good: 4, fair: 6 },
  },
  combinedMax:  { excellent: 7, good: 10, fair: 14 },
}

// ============================================================
// BUTTERFLY STANDARD — independent grading system
// ============================================================
// Philosophy: Retail-first. Tighter on condition defects — soft, leaky,
// and decayed fruit has no place in quality retail packs. More lenient
// on cosmetic permanent defects that consumers tolerate (stems, minor
// color, scarring). What matters is what the customer opens.
export const BUTTERFLY_TOLERANCES = {
  permanent: {
    stems:    { excellent: 5, good: 7, fair: 10 },
    greenRed: { excellent: 6, good: 8, fair: 10 },
    scars:    { excellent: 5, good: 7, fair: 10 },
    totalMax: { excellent: 6, good: 8, fair: 10 },
  },
  condition: {
    shrivel:  { excellent: 2, good: 3, fair: 5 },
    bruise:   { excellent: 2, good: 3, fair: 5 },
    soft:     { excellent: 1, good: 2, fair: 3 },   // soft fruit is unacceptable
    crushed:  { excellent: 1, good: 1, fair: 2 },
    decay:    { excellent: 0, good: 0.5, fair: 1 }, // near-zero tolerance
    whiteMold:{ excellent: 0, good: 0, fair: 0 },   // any = Poor
    leaky:    { excellent: 0, good: 1, fair: 2 },   // leaky has no place in quality fruit
    totalMax: { excellent: 3, good: 4, fair: 5 },
  },
  combinedMax:  { excellent: 8, good: 11, fair: 14 },
}

export const GRADING_STANDARDS = {
  mbg:       { key: 'mbg',       label: 'MBG',       tolerances: MBG_TOLERANCES },
  butterfly: { key: 'butterfly', label: 'BUTTERFLY',  tolerances: BUTTERFLY_TOLERANCES },
}

// Berry size from 30-berry sample weight
export const BERRY_SIZE = {
  small:  { maxWeight: 33, maxMM: 13, label: 'Small' },
  medium: { minWeight: 34, maxWeight: 65, minMM: 14, maxMM: 17, label: 'Medium' },
  large:  { minWeight: 66, minMM: 18, label: 'Large' },
}

// Baxlo firmness
export const FIRMNESS = {
  firm:     { min: 70, label: 'Firm' },
  modFirm:  { min: 65, max: 69, label: 'Moderately Firm' },
  sensitive: { min: 60, max: 64, label: 'Sensitive' },
  soft:     { max: 59, label: 'Soft' },
}

// Pack criteria — additional gates beyond standard MBG grading
export const PACK_CRITERIA = {
  standard: {
    label: 'Standard',
    description: 'Grading standard tolerance chart only',
    minGrade: null,
    min30BerryWeight: null,
    minBerryMM: null,
    minBaxlo: null,
    spec: null,
  },
  mightyBlue: {
    label: 'Mighty Blue',
    description: 'Good/Excellent + Large berries (19mm+)',
    minGrade: 'good',
    min30BerryWeight: 66, // ≥66g for 30 berries = ≥2.2g avg = ≥19mm
    minBerryMM: 19,
    minBaxlo: null,
    spec: 'Grade: Good or Excellent · Berry size: 19mm+ (Large) · 30-berry weight: 66g+',
  },
  sweetSelections: {
    label: 'Sweet Selections',
    description: 'Excellent + Medium+ berries (14mm+) + Firm (Baxlo >75)',
    minGrade: 'excellent',
    min30BerryWeight: 34, // ≥34g for 30 berries = ≥1.13g avg = ≥14mm
    minBerryMM: 14,
    minBaxlo: 75,
    spec: 'Grade: Excellent · Berry size: 14mm+ (Medium or larger) · 30-berry weight: 34g+ · Baxlo firmness: >75',
  },
}

// Grade ranking for comparison
export const GRADE_RANK = { excellent: 4, good: 3, fair: 2, poor: 1, none: 0 }

// Lean count categories — what the operator actually sorts
// Three piles + good: permanent, condition, decay
export const ZONE_TYPES = [
  { key: 'good',      label: 'Good',       color: COLORS.green },
  { key: 'permanent', label: 'Permanent',  color: COLORS.amber },
  { key: 'condition', label: 'Condition',  color: '#D85A30' },
  { key: 'decay',     label: 'Decay/Mold', color: COLORS.red },
]

// Detailed breakdown keys — for when operator wants specifics
export const DEFECT_DETAIL = {
  permanent: [
    { key: 'stems',    label: 'Stems' },
    { key: 'greenRed', label: 'Green/Red' },
    { key: 'scars',    label: 'Scars' },
  ],
  condition: [
    { key: 'shrivel',  label: 'Shrivel' },
    { key: 'bruise',   label: 'Bruise' },
    { key: 'soft',     label: 'Soft' },
    { key: 'crushed',  label: 'Crushed' },
    { key: 'leaky',    label: 'Leaky/Split' },
  ],
  decay: [
    { key: 'decayRot',  label: 'Decay (Alt/Anth)' },
    { key: 'whiteMold', label: 'White Mold' },
  ],
}

// ============================================================
// GRADING LOGIC
// ============================================================

/**
 * Grade a sample against a tolerance standard.
 *
 * Lean mode: counts = { good, permanent, condition, decay }
 * Detailed mode: counts include breakdown keys (stems, greenRed, etc.)
 *
 * @param {Object} counts - berry counts per category
 * @param {Object} [tolerances] - tolerance table (default: MBG_TOLERANCES)
 * @returns {Object} full grade result with grade, percentages, headroom
 */
export function gradeSample(counts, tolerances) {
  const good = counts.good || 0

  // Support both lean (3 piles) and detailed counts
  // Use explicit undefined check — 0 is a valid count
  const permanentTotal = counts.permanent !== undefined && counts.permanent !== null
    ? counts.permanent
    : (counts.stems || 0) + (counts.greenRed || 0) + (counts.scars || 0)

  const conditionTotal = counts.condition !== undefined && counts.condition !== null
    ? counts.condition
    : (counts.shrivel || 0) + (counts.bruise || 0) + (counts.soft || 0) +
      (counts.crushed || 0) + (counts.leaky || 0)

  const decayTotal = counts.decay !== undefined && counts.decay !== null
    ? counts.decay
    : (counts.decayRot || 0) + (counts.whiteMold || 0)

  const totalDefects = permanentTotal + conditionTotal + decayTotal
  const total = good + totalDefects

  if (total === 0) {
    return {
      grade: 'none',
      label: '—',
      status: 'none',
      total: 0,
      pctPermanent: 0,
      pctCondition: 0,
      pctDecay: 0,
      pctCombined: 0,
      headrooms: [],
      bottleneck: null,
    }
  }

  // Calculate percentages
  const pctPermanent = (permanentTotal / total) * 100
  const pctCondition = (conditionTotal / total) * 100
  const pctDecay = (decayTotal / total) * 100
  const pctCombined = (totalDefects / total) * 100

  const tol = tolerances || MBG_TOLERANCES

  // Detailed sub-percentages (only meaningful when individual defect keys are provided)
  // If ANY detailed key exists, we're in detailed mode
  const hasDetailed = (counts.stems !== undefined || counts.greenRed !== undefined ||
    counts.scars !== undefined || counts.shrivel !== undefined || counts.bruise !== undefined ||
    counts.soft !== undefined || counts.crushed !== undefined || counts.leaky !== undefined ||
    counts.decayRot !== undefined || counts.whiteMold !== undefined)
  const subPcts = {}
  if (hasDetailed && total > 0) {
    // Permanent subs
    subPcts.stems = ((counts.stems || 0) / total) * 100
    subPcts.greenRed = ((counts.greenRed || 0) / total) * 100
    subPcts.scars = ((counts.scars || 0) / total) * 100
    // Condition subs
    subPcts.shrivel = ((counts.shrivel || 0) / total) * 100
    subPcts.bruise = ((counts.bruise || 0) / total) * 100
    subPcts.soft = ((counts.soft || 0) / total) * 100
    subPcts.crushed = ((counts.crushed || 0) / total) * 100
    subPcts.leaky = ((counts.leaky || 0) / total) * 100
  }

  // Check if all sub-limits pass for a given grade level
  function checkSubLimits(level) {
    if (!hasDetailed) return true // quick mode — skip sub-checks
    const p = tol.permanent
    const c = tol.condition
    if (subPcts.stems > (p.stems[level] || 999)) return false
    if (subPcts.greenRed > (p.greenRed[level] || 999)) return false
    if (subPcts.scars > (p.scars[level] || 999)) return false
    if (subPcts.shrivel > (c.shrivel[level] || 999)) return false
    if (subPcts.bruise > (c.bruise[level] || 999)) return false
    if (subPcts.soft > (c.soft[level] || 999)) return false
    if (subPcts.crushed > (c.crushed[level] || 999)) return false
    if (subPcts.leaky > (c.leaky[level] || 999)) return false
    return true
  }

  // Determine grade — worst category wins
  // Check each threshold from Excellent down
  function getGrade() {
    // White mold = auto Poor
    if ((counts.whiteMold || 0) > 0) return 'poor'

    // Any decay = cannot be Excellent
    if (decayTotal > 0) {
      // Check if within Good tolerance
      if (pctDecay <= tol.condition.decay.good &&
          pctPermanent <= tol.permanent.totalMax.good &&
          pctCondition <= tol.condition.totalMax.good &&
          pctCombined <= tol.combinedMax.good &&
          checkSubLimits('good')) {
        return 'good'
      }
      if (pctDecay <= tol.condition.decay.fair &&
          pctPermanent <= tol.permanent.totalMax.fair &&
          pctCondition <= tol.condition.totalMax.fair &&
          pctCombined <= tol.combinedMax.fair &&
          checkSubLimits('fair')) {
        return 'fair'
      }
      return 'poor'
    }

    // No decay — check for Excellent
    if (pctPermanent <= tol.permanent.totalMax.excellent &&
        pctCondition <= tol.condition.totalMax.excellent &&
        pctCombined <= tol.combinedMax.excellent &&
        checkSubLimits('excellent')) {
      return 'excellent'
    }

    if (pctPermanent <= tol.permanent.totalMax.good &&
        pctCondition <= tol.condition.totalMax.good &&
        pctCombined <= tol.combinedMax.good &&
        checkSubLimits('good')) {
      return 'good'
    }

    if (pctPermanent <= tol.permanent.totalMax.fair &&
        pctCondition <= tol.condition.totalMax.fair &&
        pctCombined <= tol.combinedMax.fair &&
        checkSubLimits('fair')) {
      return 'fair'
    }

    return 'poor'
  }

  const grade = getGrade()

  const GRADE_LABELS = {
    excellent: 'EXCELLENT',
    good: 'GOOD',
    fair: 'FAIR',
    poor: 'POOR',
  }

  const GRADE_STATUS = {
    excellent: 'excellent',
    good: 'ok',
    fair: 'warn',
    poor: 'fail',
  }

  // Build headroom — distance to the boundary of the CURRENT grade
  // "How much room before I drop?" uses the current grade's max thresholds
  // because going OVER that limit is what drops you
  const headrooms = []

  // Always show headroom — use current grade's limits, or Fair limits for Poor
  const gradeForLimits = grade === 'poor' ? 'fair' : grade === 'none' ? 'excellent' : grade

  if (grade !== 'none') {
    const permLimit = tol.permanent.totalMax[gradeForLimits]
    const condLimit = tol.condition.totalMax[gradeForLimits]
    const combLimit = tol.combinedMax[gradeForLimits]

    headrooms.push({
      name: 'Permanent Defects',
      pct: round1(pctPermanent),
      limit: permLimit,
      remaining: round1(permLimit - pctPermanent),
      count: permanentTotal,
      type: 'permanent',
    })
    headrooms.push({
      name: 'Condition Defects',
      pct: round1(pctCondition),
      limit: condLimit,
      remaining: round1(condLimit - pctCondition),
      count: conditionTotal,
      type: 'condition',
    })
    headrooms.push({
      name: 'Total Combined',
      pct: round1(pctCombined),
      limit: combLimit,
      remaining: round1(combLimit - pctCombined),
      count: totalDefects,
      type: 'combined',
    })

    // Decay — show for all grades. For Excellent, limit is 0 (any decay = downgrade)
    const decayLimit = grade === 'excellent' ? 0 : tol.condition.decay[gradeForLimits] || 0
    headrooms.push({
      name: 'Decay',
      pct: round1(pctDecay),
      limit: decayLimit || 0.01, // avoid division by zero in score calc
      remaining: round1((decayLimit || 0) - pctDecay),
      count: decayTotal,
      type: 'decay',
    })
  }

  // Bottleneck — which category is tightest (closest to dropping)
  const bottleneck = headrooms.length > 0
    ? headrooms.reduce((min, h) => h.remaining < min.remaining ? h : min, headrooms[0])
    : null

  // Score: 0-100 based on how much room you have within your current grade
  // 100 = no defects in this category, 0 = at the limit, negative = over
  let score = 100
  if (grade === 'poor') {
    score = 0
  } else if (bottleneck && bottleneck.limit > 0) {
    score = Math.round((bottleneck.remaining / bottleneck.limit) * 100)
    score = Math.max(-99, Math.min(100, score))
  }

  return {
    grade,
    label: GRADE_LABELS[grade],
    status: GRADE_STATUS[grade],
    score,
    total,
    totalDefects,
    pctPermanent: round1(pctPermanent),
    pctCondition: round1(pctCondition),
    pctDecay: round1(pctDecay),
    pctCombined: round1(pctCombined),
    headrooms,
    bottleneck,
    counts: {
      good, permanent: permanentTotal, condition: conditionTotal, decay: decayTotal,
    },
    subPcts: hasDetailed ? subPcts : null,
    isDetailed: hasDetailed,
  }
}

function round1(n) {
  return Math.round(n * 10) / 10
}

// ============================================================
// PACK WEIGHT TOLERANCE — color rules for clamshell fill/box weights
// ============================================================
//
// Green:  |dev| <= greenPct of label weight (e.g., ±2% of 302g = ±6.04g)
// Yellow: outside green band but overweight <= yellowOverG  (or any underweight)
// Red:    overweight > yellowOverG (severely over — cost/giveaway concern)

export const DEFAULT_PACK_TOLERANCE = { greenPct: 2, yellowOverG: 20 }

export function loadPackTolerance() {
  try {
    const raw = localStorage.getItem('bc_pack_tolerance')
    if (!raw) return { ...DEFAULT_PACK_TOLERANCE }
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_PACK_TOLERANCE, ...parsed }
  } catch { return { ...DEFAULT_PACK_TOLERANCE } }
}

export function savePackTolerance(rules) {
  try { localStorage.setItem('bc_pack_tolerance', JSON.stringify(rules)) } catch {}
}

export function classifyWeight(w, labelWeight, rules) {
  const r = rules || DEFAULT_PACK_TOLERANCE
  const dev = w - (labelWeight || 0)
  const greenBandG = (labelWeight || 0) * (r.greenPct / 100)
  if (Math.abs(dev) <= greenBandG) return 'green'
  if (dev > r.yellowOverG) return 'red'
  return 'yellow'
}

export const CLASS_COLORS = {
  green: '#0F6E56',
  yellow: '#BA7517',
  red: '#A32D2D',
}
