// Design tokens — dark agricultural terminal aesthetic
export const COLORS = {
  bg: '#0f1209',
  bg2: '#171c0e',
  bg3: '#1e2613',
  border: '#2a3318',
  border2: '#3a4a22',
  green: '#7cb842',
  greenDim: '#4a7020',
  amber: '#d4930a',
  amberDim: '#7a5205',
  red: '#c0392b',
  redDim: '#6e1f17',
  purple: '#a78bfa',
  text: '#d4e4b8',
  text2: '#8aa464',
  text3: '#526638',
  white: '#ffffff',
}

export const FONT = "'IBM Plex Mono', monospace"

// ============================================================
// MBG GRADING STANDARD — per pint equivalent sample
// ============================================================
//
// THREE CATEGORIES:
//
// 1. ZERO TOLERANCE (auto-fail, no exceptions)
//    - Fruit Rots (Alternaria, Anthracnose with visible spores)
//    - White Mold
//    - Maggots
//
// 2. CHARACTER (major defects, counted individually)
//    - Crushed / Split / Leaking: max 1 per sample
//    - Soft / Overripe (non-bleeding): max 2 per sample
//
// 3. DEFECTS (minor defects, counted together)
//    - Red berries (20-25%+ red surface)
//    - Green berries (30%+ green surface)
//    - Damage (insect, mummy, tears, scars, frost, dry splits, shrivel)
//    - Stems (cap stems)
//    - Clusters (count as 1 each)
//    - Exobasidium: max 4 per pint
//    - Total defects: max 16 per pint
//
// ============================================================

// MBG limits per pint sample
export const MBG_LIMITS = {
  // Zero tolerance — any count > 0 = auto-fail
  zeroTolerance: {
    fruitRot: 0,   // alternaria + anthracnose with spores
    whiteMold: 0,
    maggots: 0,
  },
  // Character (major defects) — hard count limits
  character: {
    crushedSplitLeak: 1,  // max 1 per sample
    soft: 2,               // max 2 non-bleeding per sample
  },
  // Defects (minor) — max 16 total
  defects: {
    totalMax: 16,
    exobasidiumMax: 4,
  },
}

// Tray zone types — what the operator sorts into sections
export const ZONE_TYPES = [
  { key: 'good',     label: 'Good',              color: COLORS.green },
  { key: 'soft',     label: 'Soft / Overripe',   color: '#ff6b5b' },
  { key: 'major',    label: 'Major (Crush/Split/Leak)', color: COLORS.red },
  { key: 'reds',     label: 'Red',               color: '#e06030' },
  { key: 'greens',   label: 'Green',             color: '#50a040' },
  { key: 'defects',  label: 'Minor Defects',     color: COLORS.amber },
  { key: 'zero',     label: 'Zero Tolerance',    color: '#ff0040' },
]

// ============================================================
// GRADING LOGIC
// ============================================================

/**
 * Grade a sample against MBG standard.
 * All counts are raw berry counts from the tray.
 *
 * @param {Object} counts - { good, soft, major, reds, greens, defects, zero }
 * @returns {Object} full grade result
 */
export function gradeSample(counts) {
  const good = counts.good || 0
  const soft = counts.soft || 0
  const major = counts.major || 0
  const reds = counts.reds || 0
  const greens = counts.greens || 0
  const defects = counts.defects || 0
  const zero = counts.zero || 0

  const total = good + soft + major + reds + greens + defects + zero
  const limits = MBG_LIMITS

  // --- Zero Tolerance Check ---
  if (zero > 0) {
    return {
      pass: false,
      status: 'zero_tolerance',
      label: 'AUTO FAIL',
      reason: 'Zero tolerance defect detected (rot / white mold / maggots)',
      score: null,
      total,
      details: buildDetails(counts, total),
    }
  }

  // --- Character (Major) Check ---
  const majorFail = major > limits.character.crushedSplitLeak
  const softFail = soft > limits.character.soft

  // --- Defects (Minor) Check ---
  const totalMinor = reds + greens + defects
  const minorFail = totalMinor > limits.defects.totalMax

  // --- Build headroom details ---
  const headrooms = [
    {
      name: 'Soft / Overripe',
      count: soft,
      limit: limits.character.soft,
      remaining: limits.character.soft - soft,
      type: 'character',
    },
    {
      name: 'Major (Crush/Split/Leak)',
      count: major,
      limit: limits.character.crushedSplitLeak,
      remaining: limits.character.crushedSplitLeak - major,
      type: 'character',
    },
    {
      name: 'Red',
      count: reds,
      limit: null, // no individual limit, part of total 16
      remaining: null,
      type: 'defect',
    },
    {
      name: 'Green',
      count: greens,
      limit: null,
      remaining: null,
      type: 'defect',
    },
    {
      name: 'Minor Defects',
      count: defects,
      limit: null,
      remaining: null,
      type: 'defect',
    },
    {
      name: 'Total Minor Defects',
      count: totalMinor,
      limit: limits.defects.totalMax,
      remaining: limits.defects.totalMax - totalMinor,
      type: 'defect_total',
    },
  ]

  const pass = !majorFail && !softFail && !minorFail

  // --- Score ---
  // Composite score based on how close each category is to its limit.
  // +100 = all zeros. 0 = at limit. Negative = over limit.
  let score = 100
  if (total > 0) {
    const ratios = []

    // Soft headroom: 0 of 2 = +100, 2 of 2 = 0, 3 of 2 = -50
    if (limits.character.soft > 0) {
      ratios.push((limits.character.soft - soft) / limits.character.soft)
    }

    // Major headroom: 0 of 1 = +100, 1 of 1 = 0, 2 of 1 = -100
    if (limits.character.crushedSplitLeak > 0) {
      ratios.push((limits.character.crushedSplitLeak - major) / limits.character.crushedSplitLeak)
    }

    // Total minor headroom: 0 of 16 = +100, 16 of 16 = 0
    if (limits.defects.totalMax > 0) {
      ratios.push((limits.defects.totalMax - totalMinor) / limits.defects.totalMax)
    }

    const worstRatio = Math.min(...ratios)
    score = Math.round(worstRatio * 100)
    score = Math.max(-99, Math.min(100, score))
  }

  let status = 'ok'
  let label = 'PASS'
  if (!pass) {
    status = 'fail'
    label = 'FAIL'
  } else if (score < 20) {
    status = 'warn'
    label = 'PASS — TIGHT'
  }

  return {
    pass,
    status,
    label,
    reason: !pass ? buildFailReason(majorFail, softFail, minorFail) : null,
    score,
    total,
    details: buildDetails(counts, total),
    headrooms,
  }
}

function buildDetails(counts, total) {
  return {
    total,
    good: counts.good || 0,
    soft: counts.soft || 0,
    major: counts.major || 0,
    reds: counts.reds || 0,
    greens: counts.greens || 0,
    defects: counts.defects || 0,
    zero: counts.zero || 0,
    totalMinor: (counts.reds || 0) + (counts.greens || 0) + (counts.defects || 0),
  }
}

function buildFailReason(majorFail, softFail, minorFail) {
  const reasons = []
  if (majorFail) reasons.push('Major defects over limit (max 1 crush/split/leak)')
  if (softFail) reasons.push('Soft/overripe over limit (max 2)')
  if (minorFail) reasons.push('Total minor defects over limit (max 16)')
  return reasons.join('. ')
}

function round1(n) {
  return Math.round(n * 10) / 10
}
