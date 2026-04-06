// Feature toggle system — same pattern as PrimusEngine
// Features default ON for Jacob's full dev experience
// Toggle OFF for demos or to hide unfinished features

const STORAGE_KEY = 'bc_features'

export const FEATURE_CATALOG = [
  { category: 'QC Workflow', items: [
    { key: 'detailedMode', label: 'Detailed Mode', desc: 'Full MBG sub-defect breakdown (stems, shrivel, etc.)' },
    { key: 'clamshellSample', label: 'Clamshell Sample', desc: 'Sample a cup off the line instead of 600g weigh-out' },
    { key: 'packCriteria', label: 'Pack Criteria', desc: 'Mighty Blue / Sweet Selections quality gates' },
    { key: 'lineStats', label: 'Line Stats', desc: 'Lbs/hr, blowoff, size sort capture per pallet' },
    { key: 'extraSamples', label: 'Extra Samples', desc: 'Ad-hoc samples outside the 3-layer SOP' },
    { key: 'skipControls', label: 'Skip/Miss Controls', desc: 'Skip layer and miss pallet buttons' },
    { key: 'imageCapture', label: 'Image Capture', desc: 'Phone-to-laptop photo relay + zone counting' },
    { key: 'training', label: 'Training Mode', desc: 'A/B accuracy tracking between computer and operator' },
  ]},
  { category: 'Packing', items: [
    { key: 'packPlan', label: 'Pack Plan', desc: 'Daily pack targets from office (boxes → pallets)' },
    { key: 'packLog', label: 'Pack Log', desc: 'Pallet close-out with box counts and receipts' },
    { key: 'palletType', label: 'Pallet Type', desc: 'CHEP/brown badges on pack codes and plan' },
    { key: 'specialInstructions', label: 'Special Instructions', desc: 'Pack code special instructions banner' },
  ]},
  { category: 'Operations', items: [
    { key: 'speedQuality', label: 'Speed vs Quality', desc: 'Line stats correlated with grade outcomes' },
    { key: 'lineOptimizer', label: 'Line Optimizer', desc: 'PUSH/HOLD/SLOW DOWN recommendation based on DC tolerance + trend' },
    { key: 'growerTrends', label: 'Grower Trends', desc: 'Per-grower/variety quality aggregates' },
    { key: 'opsPanel', label: 'Ops Panel', desc: 'DC strictness, target score, Weco placeholder' },
    { key: 'lineMonitor', label: 'Line Monitor', desc: 'Raw fruit in cooler, receipt progress, FIFO' },
  ]},
  { category: 'Reports', items: [
    { key: 'packout', label: 'Packout Report', desc: 'Raw lbs in vs packed lbs out per receipt' },
    { key: 'fruitFlow', label: 'Fruit Flow', desc: 'Material balance: raw → blowoff → size div → packed → gap (cup fill variance)' },
    { key: 'dcReconcile', label: 'DC Reconciliation', desc: 'Compare internal QC vs DC grading, tolerance signal' },
    { key: 'dailyView', label: 'Daily Report', desc: 'Phone-accessible daily summary with grower filter' },
    { key: 'shareButton', label: 'Share / QR', desc: 'Share QC data via QR code' },
  ]},
  { category: 'Pre-Pack', items: [
    { key: 'prePack', label: 'Pre-Pack Notes', desc: 'Quick observations about raw fruit before it runs' },
    { key: 'prePackBanner', label: 'Pre-Pack Banner', desc: 'Show pre-pack notes on QC side when receipt is active' },
  ]},
  { category: 'Receipts & Inventory', items: [
    { key: 'receipts', label: 'Receipt Manager', desc: 'Create/manage grower receipts' },
    { key: 'barcodes', label: 'Barcode Sheets', desc: 'QR barcode printing for receipts' },
    { key: 'dumpScanner', label: 'Dump Scanner', desc: 'Phone QR scanning for raw pallet tracking' },
  ]},
  { category: 'Dev', items: [
    { key: 'seedData', label: 'Seed Data', desc: 'Generate demo data for development' },
    { key: 'accuracy', label: 'Accuracy Report', desc: 'Computer vs operator counting comparison' },
    { key: 'logManager', label: 'Log Manager', desc: 'Edit/delete sample history entries' },
    { key: 'backupForm', label: 'Backup Form', desc: 'Printable paper backup form' },
  ]},
]

export const FEATURE_PRESETS = [
  {
    id: 'full', label: 'Full Power', desc: 'Everything on — Jacob\'s daily driver',
    color: '#0F6E56', bg: '#E1F5EE',
    features: null, // null = all on
  },
  {
    id: 'qc_only', label: 'QC Only', desc: 'Just grading — no ops, no reports, no packing',
    color: '#BA7517', bg: '#FAEEDA',
    features: {
      detailedMode: true, clamshellSample: true, packCriteria: true, lineStats: false, extraSamples: true,
      skipControls: true, imageCapture: false, training: false,
      packPlan: false, packLog: false, palletType: false, specialInstructions: false,
      speedQuality: false, lineOptimizer: false, growerTrends: false, opsPanel: false, lineMonitor: false,
      packout: false, fruitFlow: false, dcReconcile: false, dailyView: false, shareButton: false,
      prePack: false, prePackBanner: false,
      receipts: false, barcodes: false, dumpScanner: false,
      seedData: false, accuracy: false, logManager: false, backupForm: false,
    },
  },
  {
    id: 'demo', label: 'Demo', desc: 'Clean demo for pitching to other sheds',
    color: '#534AB7', bg: '#EDEBFA',
    features: {
      detailedMode: true, clamshellSample: true, packCriteria: true, lineStats: true, extraSamples: true,
      skipControls: true, imageCapture: false, training: false,
      packPlan: true, packLog: true, palletType: true, specialInstructions: true,
      speedQuality: true, lineOptimizer: true, growerTrends: true, opsPanel: true, lineMonitor: true,
      packout: true, fruitFlow: true, dcReconcile: true, dailyView: true, shareButton: true,
      prePack: true, prePackBanner: true,
      receipts: true, barcodes: false, dumpScanner: false,
      seedData: true, accuracy: false, logManager: false, backupForm: false,
    },
  },
  {
    id: 'floor', label: 'Floor', desc: 'Shed floor — QC + packing, no analytics',
    color: '#D85A30', bg: '#FDE8DF',
    features: {
      detailedMode: false, clamshellSample: true, packCriteria: true, lineStats: true, extraSamples: true,
      skipControls: true, imageCapture: true, training: false,
      packPlan: true, packLog: true, palletType: true, specialInstructions: true,
      speedQuality: false, lineOptimizer: false, growerTrends: false, opsPanel: false, lineMonitor: true,
      packout: false, fruitFlow: false, dcReconcile: false, dailyView: true, shareButton: false,
      prePack: true, prePackBanner: true,
      receipts: true, barcodes: true, dumpScanner: true,
      seedData: false, accuracy: false, logManager: false, backupForm: true,
    },
  },
]

// All feature keys
const ALL_KEYS = FEATURE_CATALOG.flatMap(cat => cat.items.map(item => item.key))

export function getDefaultFeatures() {
  const features = {}
  ALL_KEYS.forEach(key => { features[key] = true })
  return features
}

export function loadFeatures() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (saved) {
      const defaults = getDefaultFeatures()
      return { ...defaults, ...saved }
    }
    return getDefaultFeatures()
  } catch {
    return getDefaultFeatures()
  }
}

export function saveFeatures(features) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(features))
  // Also persist to server
  fetch('/api/store/' + STORAGE_KEY, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(features),
  }).catch(() => {})
}

export function applyPreset(preset) {
  if (preset.features === null) {
    // "Full Power" = all on
    return getDefaultFeatures()
  }
  // Start from all-off, apply preset
  const features = {}
  ALL_KEYS.forEach(key => { features[key] = false })
  return { ...features, ...preset.features }
}
