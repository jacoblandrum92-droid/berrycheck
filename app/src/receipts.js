// Receipt data model — localStorage-backed
// A receipt = a batch of fruit from a grower/block/variety with expected pallet count

const STORAGE_KEY = 'bc_receipts'

export function loadReceipts() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
  catch { return [] }
}

export function saveReceipts(receipts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts))
  fetch('/api/store/' + STORAGE_KEY, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(receipts),
  }).catch(() => {})
}

export function createReceipt({ receiptNum, grower, variety, block, expectedPallets, expectedLbs }) {
  const receipts = loadReceipts()
  const receipt = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    receiptNum: receiptNum || `R-${String(receipts.length + 1).padStart(3, '0')}`,
    grower: grower || '',
    variety: variety || '',
    block: block || '',
    expectedPallets: expectedPallets || 0,
    expectedLbs: expectedLbs || 0,
    createdAt: new Date().toISOString(),
    scans: [], // each scan: { timestamp, palletNum }
    status: 'active', // active | completed | cancelled
  }
  receipts.push(receipt)
  saveReceipts(receipts)
  return receipt
}

export function updateReceipt(id, updates) {
  const receipts = loadReceipts()
  const idx = receipts.findIndex(r => r.id === id)
  if (idx === -1) return null
  receipts[idx] = { ...receipts[idx], ...updates }
  saveReceipts(receipts)
  return receipts[idx]
}

export function deleteReceipt(id) {
  const receipts = loadReceipts().filter(r => r.id !== id)
  saveReceipts(receipts)
}

export function logScan(receiptId) {
  const receipts = loadReceipts()
  const receipt = receipts.find(r => r.id === receiptId)
  if (!receipt) return null

  const scan = {
    timestamp: new Date().toISOString(),
    palletNum: receipt.scans.length + 1,
  }
  receipt.scans.push(scan)
  saveReceipts(receipts)
  return { receipt, scan }
}

// Find receipt by ID or receiptNum
export function findReceipt(query) {
  const receipts = loadReceipts()
  return receipts.find(r => r.id === query || r.receiptNum === query)
}

// --- Computed stats ---

export function getReceiptStats(receipt) {
  const scanned = receipt.scans.length
  const remaining = Math.max(0, receipt.expectedPallets - scanned)
  const pctComplete = receipt.expectedPallets > 0
    ? Math.round((scanned / receipt.expectedPallets) * 100)
    : 0

  // Estimate lbs per pallet
  const lbsPerPallet = receipt.expectedPallets > 0
    ? receipt.expectedLbs / receipt.expectedPallets
    : 0
  const lbsScanned = scanned * lbsPerPallet
  const lbsRemaining = remaining * lbsPerPallet

  // Line rate from scan timestamps
  let lbsPerHour = 0
  let palletsPerHour = 0
  if (receipt.scans.length >= 2) {
    const first = new Date(receipt.scans[0].timestamp).getTime()
    const last = new Date(receipt.scans[receipt.scans.length - 1].timestamp).getTime()
    const hours = (last - first) / (1000 * 60 * 60)
    if (hours > 0) {
      palletsPerHour = Math.round((scanned - 1) / hours * 10) / 10
      lbsPerHour = Math.round(((scanned - 1) * lbsPerPallet) / hours)
    }
  }

  return {
    scanned,
    remaining,
    pctComplete,
    lbsPerPallet: Math.round(lbsPerPallet),
    lbsScanned: Math.round(lbsScanned),
    lbsRemaining: Math.round(lbsRemaining),
    lbsPerHour,
    palletsPerHour,
  }
}

export function getCoolerStats() {
  const receipts = loadReceipts().filter(r => r.status === 'active')
  let totalExpectedLbs = 0
  let totalScannedLbs = 0
  let totalExpectedPallets = 0
  let totalScannedPallets = 0

  receipts.forEach(r => {
    const stats = getReceiptStats(r)
    totalExpectedLbs += r.expectedLbs || 0
    totalScannedLbs += stats.lbsScanned
    totalExpectedPallets += r.expectedPallets || 0
    totalScannedPallets += stats.scanned
  })

  // Overall line rate — all scans from today
  const today = new Date().toISOString().slice(0, 10)
  const allScansToday = []
  receipts.forEach(r => {
    r.scans.forEach(s => {
      if (s.timestamp.startsWith(today)) allScansToday.push(s)
    })
  })
  allScansToday.sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  let overallLbsPerHour = 0
  if (allScansToday.length >= 2) {
    const first = new Date(allScansToday[0].timestamp).getTime()
    const last = new Date(allScansToday[allScansToday.length - 1].timestamp).getTime()
    const hours = (last - first) / (1000 * 60 * 60)
    if (hours > 0) {
      // Average lbs per pallet across all active receipts
      const avgLbsPerPallet = totalExpectedPallets > 0
        ? totalExpectedLbs / totalExpectedPallets
        : 0
      overallLbsPerHour = Math.round(((allScansToday.length - 1) * avgLbsPerPallet) / hours)
    }
  }

  // FIFO — oldest receipt with remaining pallets
  const withRemaining = receipts
    .map(r => ({ ...r, stats: getReceiptStats(r) }))
    .filter(r => r.stats.remaining > 0)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  return {
    totalExpectedLbs,
    totalScannedLbs,
    totalRemainingLbs: totalExpectedLbs - totalScannedLbs,
    totalExpectedPallets,
    totalScannedPallets,
    totalRemainingPallets: totalExpectedPallets - totalScannedPallets,
    overallLbsPerHour,
    activeReceipts: receipts.length,
    scansToday: allScansToday.length,
    fifoWarnings: withRemaining.slice(0, 3), // oldest 3 unfinished
  }
}

// Get all active receipts with their stats
export function getActiveReceiptsWithStats() {
  return loadReceipts()
    .filter(r => r.status === 'active')
    .map(r => ({ ...r, stats: getReceiptStats(r) }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}
