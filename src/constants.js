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
// Decay: 0% for Excellent, <1% Good, <1.78% Fair
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
    description: 'MBG tolerance chart',
    minGrade: null,
    min30BerryWeight: null,
    minBaxlo: null,
  },
  mightyBlue: {
    label: 'Mighty Blue',
    description: 'Good/Excellent + all berries 19mm+',
    minGrade: 'good',
    min30BerryWeight: 66, // ≥66g = ≥18mm (large)
    minBaxlo: null,
  },
  sweetSelections: {
    label: 'Sweet Selections',
    description: 'Excellent + Baxlo >75 + all berries 14mm+',
    minGrade: 'excellent',
    min30BerryWeight: 34, // ≥34g = ≥14mm (medium+)
    minBaxlo: 75,
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
    { key: 'decay',     label: 'Decay (Alt/Anth)' },
    { key: 'whiteMold', label: 'White Mold' },
  ],
}

// ============================================================
// GRADING LOGIC
// ============================================================

/**
 * Grade a sample against MBG standard.
 *
 * Lean mode: counts = { good, permanent, condition, decay }
 * Detailed mode: counts include breakdown keys (stems, greenRed, etc.)
 *
 * @param {Object} counts - berry counts per category
 * @returns {Object} full grade result with grade, percentages, headroom
 */
export function gradeSample(counts) {
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

  const tol = MBG_TOLERANCES

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
    if (subPcts.stems >= (p.stems[level] || 999)) return false
    if (subPcts.greenRed >= (p.greenRed[level] || 999)) return false
    if (subPcts.scars >= (p.scars[level] || 999)) return false
    if (subPcts.shrivel >= (c.shrivel[level] || 999)) return false
    if (subPcts.bruise >= (c.bruise[level] || 999)) return false
    if (subPcts.soft >= (c.soft[level] || 999)) return false
    if (subPcts.crushed >= (c.crushed[level] || 999)) return false
    if (subPcts.leaky >= (c.leaky[level] || 999)) return false
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
      if (pctDecay < tol.condition.decay.good &&
          pctPermanent < tol.permanent.totalMax.good &&
          pctCondition < tol.condition.totalMax.good &&
          pctCombined < tol.combinedMax.good &&
          checkSubLimits('good')) {
        return 'good'
      }
      if (pctDecay < tol.condition.decay.fair &&
          pctPermanent < tol.permanent.totalMax.fair &&
          pctCondition < tol.condition.totalMax.fair &&
          pctCombined < tol.combinedMax.fair &&
          checkSubLimits('fair')) {
        return 'fair'
      }
      return 'poor'
    }

    // No decay — check for Excellent
    if (pctPermanent < tol.permanent.totalMax.excellent &&
        pctCondition < tol.condition.totalMax.excellent &&
        pctCombined < tol.combinedMax.excellent &&
        checkSubLimits('excellent')) {
      return 'excellent'
    }

    if (pctPermanent < tol.permanent.totalMax.good &&
        pctCondition < tol.condition.totalMax.good &&
        pctCombined < tol.combinedMax.good &&
        checkSubLimits('good')) {
      return 'good'
    }

    if (pctPermanent < tol.permanent.totalMax.fair &&
        pctCondition < tol.condition.totalMax.fair &&
        pctCombined < tol.combinedMax.fair &&
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

  // For each grade, show how close you are to exceeding that grade's limits
  // Excellent: show distance to excellent limits (going over = drop to good)
  // Good: show distance to good limits (going over = drop to fair)
  // Fair: show distance to fair limits (going over = drop to poor)
  // Poor: no headroom (already at bottom)
  const gradeForLimits = grade // use current grade's limits

  if (grade !== 'poor' && grade !== 'none') {
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

    if (grade !== 'excellent') {
      const decayLimit = tol.condition.decay[gradeForLimits]
      if (decayLimit > 0) {
        headrooms.push({
          name: 'Decay',
          pct: round1(pctDecay),
          limit: decayLimit,
          remaining: round1(decayLimit - pctDecay),
          count: decayTotal,
          type: 'decay',
        })
      }
    }
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
