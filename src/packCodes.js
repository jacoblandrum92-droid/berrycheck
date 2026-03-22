// Pack code profiles — localStorage-backed
const STORAGE_KEY = 'bc_packcodes_db'

// Pre-loaded Georgia codes from MBG 2026 Packer Manual
const DEFAULT_CODES = [
  // Georgia Conventional
  { code: 'NF1293', desc: 'GA 12-6 OZ BLUES', weight: 4.57, perPallet: 240, special: '' },
  { code: 'NF7672', desc: 'GA 12-6 OZ, WM', weight: 4.57, perPallet: 240, special: 'Requires PTI - Walmart' },
  { code: 'NF3849', desc: 'GA 12-6 OZ, CC', weight: 4.57, perPallet: 240, special: 'Canada Certified Only' },
  { code: 'NF8233', desc: 'GA 12-6 OZ PATRIOT', weight: 4.57, perPallet: 240, special: 'American Flag Label' },
  { code: 'NF2102', desc: 'GA 4-2 LB BLUES', weight: 8.12, perPallet: 144, special: '' },
  { code: 'NF740', desc: 'GA 12-1 PT BLUES', weight: 8.00, perPallet: 144, special: '' },
  { code: 'NF9843', desc: 'GA 12-1 PT BLUES PTI', weight: 8.00, perPallet: 144, special: 'PTI Label (Kroger)' },
  { code: 'NF3850', desc: 'GA 12-1 PT, CC', weight: 8.00, perPallet: 144, special: 'Canada Only' },
  { code: 'NF7704', desc: 'GA 12-1 PT, WM', weight: 8.00, perPallet: 144, special: 'Requires PTI - Walmart' },
  { code: 'NF8235', desc: 'GA 12-1 PT PATRIOT', weight: 8.00, perPallet: 144, special: 'American Flag Label' },
  { code: 'NF8238', desc: 'GA 12-1 PT, HEB', weight: 8.00, perPallet: 144, special: 'HEB Label' },
  { code: 'NF8333', desc: 'GA 12-1 PT, SIGN', weight: 8.00, perPallet: 144, special: 'Signature Label/Ink Jet/PTI' },
  { code: 'NF7256', desc: 'GA 12-1 PT, LP WM', weight: 8.00, perPallet: 144, special: 'Requires PTI - Walmart' },
  { code: 'NF8237', desc: 'GA 12-1 LP PATRIOT', weight: 8.00, perPallet: 144, special: 'American Flag - PTI - Walmart' },
  { code: 'NF6104', desc: 'GA 12-11 OZ, WM', weight: 8.38, perPallet: 144, special: '11oz - PUBLIX' },
  { code: 'NF8917', desc: 'GA 12-11 OZ, PAT', weight: 8.38, perPallet: 144, special: '11oz PATRIOTIC - PUBLIX' },
  { code: 'NF8889', desc: 'GA 12-9.8 OZ, MTY BL', weight: 7.47, perPallet: 144, special: 'Requires PTI' },
  { code: 'NF8890', desc: 'GA 12-9.8 OZ, KROGER', weight: 7.47, perPallet: 144, special: 'Kroger Label / Requires PTI' },
  { code: 'NF8891', desc: 'GA 12-9.8 OZ, HEB', weight: 7.47, perPallet: 144, special: 'HEB Label' },
  { code: 'NF1295', desc: 'GA 8-18 OZ BLUES', weight: 9.14, perPallet: 144, special: '' },
  { code: 'NF9839', desc: 'GA 8-18 OZ BLUES PTI', weight: 9.14, perPallet: 144, special: 'PTI Label' },
  { code: 'NF3851', desc: 'GA 8-18 OZ CC', weight: 9.14, perPallet: 144, special: 'Canada Only' },
  { code: 'NF5333', desc: 'GA 8-18 OZ, TAPED', weight: 9.14, perPallet: 144, special: 'Requires Tape' },
  { code: 'NF8239', desc: 'GA 8-18 OZ, HEB', weight: 9.14, perPallet: 144, special: 'HEB Label' },
  { code: 'NF8334', desc: 'GA 8-18 OZ, SIGNATURE', weight: 9.14, perPallet: 144, special: 'Signature Label/Ink Jet/PTI' },
  { code: 'NF9472', desc: 'GA 8-18 OZ, PATRIOTIC', weight: 9.14, perPallet: 144, special: 'American Flag Label' },
  { code: 'NF4193', desc: 'GA 12-18 OZ BLUES', weight: 13.71, perPallet: 100, special: 'Taped, PTI, CHEP - Walmart' },
  { code: 'NF8240', desc: 'GA 12-18 OZ, COS', weight: 13.71, perPallet: 100, special: 'Taped, PTI, CHEP - Costco' },
  { code: 'NF8274', desc: 'GA 12-18 OZ, COS CC', weight: 13.71, perPallet: 100, special: 'Canada, Bilingual PTI/Ink Jet, CHEP' },
  { code: 'NF9474', desc: 'GA 12-18 OZ, PATRIOTIC', weight: 13.71, perPallet: 100, special: 'Flag Label, Taped, PTI, CHEP' },
  { code: 'NF7291', desc: 'GA 12-24 OZ BLUES', weight: 18.27, perPallet: 60, special: 'PTI - Walmart, CHEP' },
  { code: 'NF767', desc: 'GA 12-2 LB BLUES', weight: 24.36, perPallet: 50, special: 'Taped' },
  { code: 'NF7741', desc: 'GA 12-2 LB, WM', weight: 24.36, perPallet: 50, special: 'Taped, PTI, CHEP - Sams' },
  { code: 'NF1262', desc: 'GA 12-2 LB, COS', weight: 24.36, perPallet: 50, special: 'Taped, PTI, CHEP - Costco' },
  { code: 'NF3853', desc: 'GA 12-2 LB BL, CC', weight: 24.36, perPallet: 50, special: 'Canada, Bilingual, Taped, CHEP' },
  { code: 'NF5292', desc: 'GA RTE LUGS', weight: 1.00, perPallet: 75, special: '18-19 lbs/lug, Brown Pallet, NO CHEP' },
  { code: 'NF8248', desc: 'GA BULK MBG', weight: 1.00, perPallet: 60, special: '18-19 lbs/lug, Brown Pallet, NO CHEP' },
  // Georgia Organic
  { code: 'NF730', desc: 'GA 12-6 OZ, ORG', weight: 4.57, perPallet: 240, special: 'Organic' },
  { code: 'NF8287', desc: 'GA 12-6 OZ, ORG WM', weight: 4.57, perPallet: 240, special: 'Organic, PTI - Walmart' },
  { code: 'NF2160', desc: 'GA 12-1 PT, ORG', weight: 8.00, perPallet: 144, special: 'Organic' },
  { code: 'NF8938', desc: 'GA 12-1 PT, ORG WM', weight: 8.00, perPallet: 144, special: 'Organic, PTI - Walmart' },
  { code: 'NF6237', desc: 'GA 8-18 OZ, ORG', weight: 9.14, perPallet: 144, special: 'Organic' },
  { code: 'NF4199', desc: 'GA 12-18 OZ, ORG', weight: 13.71, perPallet: 100, special: 'Organic, SAMS, Taped, PTI WM, CHEP' },
  { code: 'NF8256', desc: 'GA 12-18 OZ, ORG COS', weight: 13.71, perPallet: 100, special: 'Organic, Costco, Taped, PTI, CHEP' },
  { code: 'NF4201', desc: 'GA 12-2, ORG COS', weight: 24.36, perPallet: 50, special: 'Organic, Costco, Taped, PTI, CHEP' },
  { code: 'NF8939', desc: 'GA FRESH BULK ORG', weight: 1.00, perPallet: 75, special: 'Organic, 17 lbs/lug, Brown Pallet, NO CHEP' },
  // Georgia Berry Blue
  { code: 'NF7699', desc: 'GA 12-6 OZ, BB', weight: 4.57, perPallet: 240, special: 'Berry Blue' },
  { code: 'NF7773', desc: 'GA 12-1 PT, BB', weight: 8.00, perPallet: 144, special: 'Berry Blue' },
  { code: 'NF10968', desc: 'GA 12-1 LP PT Sweet Sel', weight: 8.00, perPallet: 144, special: 'Berry Blue, PTI, Sweet Selections' },
  { code: 'NF11008', desc: 'GA 8-18 OZ PTI BB', weight: 9.14, perPallet: 144, special: 'Berry Blue, PTI' },
  { code: 'NF7744', desc: 'GA 12-18 OZ, BB', weight: 13.71, perPallet: 100, special: 'Berry Blue, Taped, PTI, CHEP - WM' },
  { code: 'NF7719', desc: 'GA 12-2, COS-BB', weight: 24.36, perPallet: 50, special: 'Berry Blue, Costco, Taped, PTI, CHEP' },
]

export function loadPackCodes() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (saved && saved.length > 0) return saved
    // First load — seed with defaults
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CODES))
    return DEFAULT_CODES
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CODES))
    return DEFAULT_CODES
  }
}

export function savePackCodes(codes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(codes))
}

export function addPackCode(code) {
  const codes = loadPackCodes()
  if (codes.some(c => c.code === code.code)) return false
  codes.push(code)
  savePackCodes(codes)
  return true
}

export function updatePackCode(codeId, updates) {
  const codes = loadPackCodes()
  const idx = codes.findIndex(c => c.code === codeId)
  if (idx === -1) return false
  codes[idx] = { ...codes[idx], ...updates }
  savePackCodes(codes)
  return true
}

export function deletePackCode(codeId) {
  const codes = loadPackCodes().filter(c => c.code !== codeId)
  savePackCodes(codes)
}
