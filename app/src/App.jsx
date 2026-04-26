import React, { useState, useCallback, useEffect } from 'react'
import { COLORS, FONT, gradeSample, PACK_CRITERIA, GRADE_RANK, GRADING_STANDARDS, classifyWeight, CLASS_COLORS, loadPackTolerance } from './constants'

// Server-backed storage helper — write to both localStorage and server
function serverSave(key, data) {
  fetch('/api/store/' + key, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).catch(() => {})
}
import { loadFeatures, saveFeatures } from './featureFlags'
import { loadReceipts } from './receipts'
import { loadPackCodes, loadFavorites } from './packCodes'
import { useRelay } from './useRelay'
import { countBerriesInZones } from './imageProcessor'
import { ensureLandscape } from './rotateImage'
import Header from './components/Header'
import ScoreDisplay from './components/ScoreDisplay'
import CountEntry from './components/CountEntry'
import ScaleCapture from './components/ScaleCapture'
import ThresholdBars from './components/ThresholdBars'
import SampleHistory from './components/SampleHistory'
import LotSummary from './components/LotSummary'
import OpsPanel from './components/OpsPanel'
import CameraCapture from './components/CameraCapture'
import PhoneCapture from './components/PhoneCapture'
import ZoneEditor from './components/ZoneEditor'
import AccuracyReport from './components/AccuracyReport'
import LogManager from './components/LogManager'
import DumpScanner from './components/DumpScanner'
import ReceiptManager from './components/ReceiptManager'
import BarcodeSheet from './components/BarcodeSheet'
import LineMonitor from './components/LineMonitor'
import GradingGuide from './components/GradingGuide'
import QCSetupBar from './components/QCSetupBar'
import PalletBuilder from './components/PalletBuilder'
import BackupForm from './components/BackupForm'
import Viewer from './components/Viewer'
import DailyView from './components/DailyView'
import ShareButton from './components/ShareButton'
import PackLogViewer, { PackLogInput } from './components/PackLog'
import PackCodeManager from './components/PackCodeManager'
import PalletCloseOut from './components/PalletCloseOut'
import ReceiptChange from './components/ReceiptChange'
import SpeedQuality from './components/SpeedQuality'
import GrowerTrends from './components/GrowerTrends'
import GrowerFilter from './components/GrowerFilter'
import PackPlan from './components/PackPlan'
import PackoutReport from './components/PackoutReport'
import DCReconcile from './components/DCReconcile'
import FeaturePanel from './components/FeaturePanel'
import ComplianceLog from './components/ComplianceLog'
import WeatherBanner from './components/WeatherBanner'
import DayClose from './components/DayClose'
import ChemicalInventory from './components/ChemicalInventory'
import ChemicalLog from './components/ChemicalLog'
import SanitizerCalculator from './components/SanitizerCalculator'
import PrePackNotes, { PrePackBanner } from './components/PrePackNotes'
import CameraTuner from './components/CameraTuner'
import ZoneConfirm from './components/ZoneConfirm'
import PalletTagAssign from './components/PalletTagAssign'
import QCerWizard from './components/QCerWizard'

export default function App() {
  const mode = new URLSearchParams(window.location.search).get('mode')
  if (mode === 'phone') return <PhoneCapture />
  if (mode === 'dump') return <DumpScanner />
  if (mode === 'view') return <Viewer />
  if (mode === 'daily') return <DailyView />
  return <Dashboard />
}

const FONT_SCALES = { small: 0.85, normal: 1, large: 1.2 }

function Dashboard() {
  const [view, setView] = useState('qc')
  const [features, setFeatures] = useState(loadFeatures)
  const [showFeatures, setShowFeatures] = useState(false)
  const [fontScale, setFontScale] = useState(() => {
    return localStorage.getItem('bc_font_scale') || 'normal'
  })
  const [cameraResetAt, setCameraResetAt] = useState(0)

  // Sync from server on mount — pull shared data into localStorage
  const [synced, setSynced] = useState(false)
  useEffect(() => {
    const keys = ['bc_history', 'bc_packlog', 'bc_receipts', 'bc_packplan',
      'bc_prepack', 'bc_dc_results', 'bc_features', 'bc_packcodes_db',
      'bc_packcodes_favorites', 'bc_zones', 'bc_accuracy', 'bc_training',
      'bc_compliance_config', 'bc_compliance_done', 'bc_compliance_custom']
    Promise.all(keys.map(key =>
      fetch('/api/store/' + key).then(r => r.json()).then(data => {
        if (data !== null) localStorage.setItem(key, JSON.stringify(data))
      }).catch(() => {})
    )).then(() => {
      // Reload state from now-hydrated localStorage
      setFeatures(loadFeatures())
      try { setHistory(JSON.parse(localStorage.getItem('bc_history') || '[]')) } catch {}
      setSynced(true)
    })
  }, [])

  // Persist features on change
  useEffect(() => { saveFeatures(features) }, [features])

  // Camera reset hotkey: Ctrl+Alt+C → POST /api/restart-camera
  useEffect(() => {
    const onKey = (e) => {
      if (!e.ctrlKey || !e.altKey || e.shiftKey || e.metaKey) return
      if ((e.key || '').toLowerCase() !== 'c') return
      const t = e.target
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      e.preventDefault()
      fetch('/api/restart-camera', { method: 'POST' }).catch(() => {})
      setCameraResetAt(Date.now())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!cameraResetAt) return
    const id = setTimeout(() => setCameraResetAt(0), 2000)
    return () => clearTimeout(id)
  }, [cameraResetAt])

  // === Line slots (two pallets worked in parallel, one per line) ===
  const INIT_ACTIVE_LINE = (() => {
    try { return localStorage.getItem('bc_active_line') || 'line1' } catch { return 'line1' }
  })()
  const INIT_SLOT = (() => {
    try { return JSON.parse(localStorage.getItem(`bc_slot_${INIT_ACTIVE_LINE}`) || '{}') } catch { return {} }
  })()
  // Find last pack code used on a given line (looks back through bc_history)
  const findLastPackCodeForLine = (packLine) => {
    try {
      const history = JSON.parse(localStorage.getItem('bc_history') || '[]')
      for (let i = history.length - 1; i >= 0; i--) {
        const s = history[i]
        if (String(s.packLine) === String(packLine) && s.packCode) return s.packCode
      }
    } catch {}
    return ''
  }
  const computeDailyPalletDefault = () => {
    try {
      const today = new Date().toLocaleDateString()
      const log = JSON.parse(localStorage.getItem('bc_packlog') || '[]')
      return log.filter(e => e.date === today).reduce((max, e) => Math.max(max, e.dailyPallet || 0), 0) + 1
    } catch { return 1 }
  }

  const [activeLine, setActiveLine] = useState(INIT_ACTIVE_LINE)
  const [dualLineMode, setDualLineMode] = useState(() => {
    try { return localStorage.getItem('bc_dual_line_mode') === 'true' } catch { return false }
  })
  useEffect(() => {
    try { localStorage.setItem('bc_dual_line_mode', dualLineMode ? 'true' : 'false') } catch {}
  }, [dualLineMode])

  // Daily pallet number — auto-generated from pack log
  const [dailyPalletNum, setDailyPalletNum] = useState(INIT_SLOT.dailyPalletNum || computeDailyPalletDefault())

  // Lot info
  const [lotId, setLotId] = useState(INIT_SLOT.lotId || '')
  const [packLine, setPackLine] = useState(INIT_SLOT.packLine || (INIT_ACTIVE_LINE === 'line1' ? '1' : '2'))
  const [receiptNum, setReceiptNum] = useState(INIT_SLOT.receiptNum || '')
  const [grower, setGrower] = useState(INIT_SLOT.grower || '')
  const [variety, setVariety] = useState(INIT_SLOT.variety || '')
  const [packCriteria, setPackCriteria] = useState(INIT_SLOT.packCriteria || 'standard')
  const [lineRate, setLineRate] = useState(INIT_SLOT.lineRate || '')
  const [blowoff, setBlowoff] = useState(INIT_SLOT.blowoff || '')
  const [sizeDiversion, setSizeDiversion] = useState(INIT_SLOT.sizeDiversion || '')
  // Counts
  const [counts, setCounts] = useState(INIT_SLOT.counts || { good: 0, permanent: 0, condition: 0, decay: 0 })
  // Scale weight capture — { weight: number, _source: 'scale'|'manual' } or null
  const [capturedWeight, setCapturedWeight] = useState(INIT_SLOT.capturedWeight || null)

  // Incoming image from phone
  const [incomingImage, setIncomingImage] = useState(null)
  const [processing, setProcessing] = useState(false)

  // A/B tracking — computer counts (A) vs operator-corrected counts (B)
  const [computerCounts, setComputerCounts] = useState(null)

  // Zone editor & accuracy report
  const [showZoneEditor, setShowZoneEditor] = useState(false)
  const [showAccuracy, setShowAccuracy] = useState(false)
  const [showLogManager, setShowLogManager] = useState(false)
  const [showChemicals, setShowChemicals] = useState(false)
  const [showChemLog, setShowChemLog] = useState(false)
  const [showSanitizerCalc, setShowSanitizerCalc] = useState(false)
  const [showReceipts, setShowReceipts] = useState(false)
  const [showBarcodeSheet, setShowBarcodeSheet] = useState(false)
  const [showGradingGuide, setShowGradingGuide] = useState(false)
  const [showPhoneQR, setShowPhoneQR] = useState(false)
  const [showCameraPanel, setShowCameraPanel] = useState(false)
  const [showScalePanel, setShowScalePanel] = useState(false)


  const [pendingZoneCounts, setPendingZoneCounts] = useState(null) // { counts, image, zones }
  const [showPackLog, setShowPackLog] = useState(false)
  const [showPackCodes, setShowPackCodes] = useState(false)
  const [showAssignTag, setShowAssignTag] = useState(false)
  const [palletLayersCompact, setPalletLayersCompact] = useState(() => {
    try { return localStorage.getItem('bc_pallet_layers_compact') === 'true' } catch { return false }
  })
  useEffect(() => {
    try { localStorage.setItem('bc_pallet_layers_compact', palletLayersCompact ? 'true' : 'false') } catch {}
  }, [palletLayersCompact])
  // QCer Mode — guided wizard layered over the existing data model. Default OFF
  // (this is still experimental). Toggle from Header MENU → Settings.
  const [qcerMode, setQcerMode] = useState(() => {
    try { return localStorage.getItem('bc_qcer_mode') === 'true' } catch { return false }
  })
  useEffect(() => {
    try { localStorage.setItem('bc_qcer_mode', qcerMode ? 'true' : 'false') } catch {}
  }, [qcerMode])
  const toggleQcerMode = () => setQcerMode(v => !v)
  const [detailedCounts, setDetailedCounts] = useState(true)
  const [sampleMethod, setSampleMethod] = useState('fullcount') // 'fullcount', '600g', or 'manual'
  const [gradingStandard, setGradingStandard] = useState('mbg') // 'mbg' or 'butterfly'
  const [showPalletCloseOut, setShowPalletCloseOut] = useState(false)
  const [showPackout, setShowPackout] = useState(false)
  const [showDCReconcile, setShowDCReconcile] = useState(false)
  const [showPrePack, setShowPrePack] = useState(false)
  const [showReceiptChange, setShowReceiptChange] = useState(false)
  const [palletReceipts, setPalletReceipts] = useState(INIT_SLOT.palletReceipts || []) // tracks receipt segments on current pallet
  const [packCode, setPackCode] = useState(
    INIT_SLOT.packCode !== undefined
      ? INIT_SLOT.packCode
      : findLastPackCodeForLine(INIT_SLOT.packLine || (INIT_ACTIVE_LINE === 'line1' ? '1' : '2'))
  )
  const [lastPackCode, setLastPackCode] = useState(INIT_SLOT.lastPackCode || '')
  const [packCodeDB, setPackCodeDB] = useState(() => loadPackCodes())
  const [packFavorites, setPackFavorites] = useState(() => loadFavorites())
  // Refresh pack-code DB when the manager modal closes (so new entries appear in top card)
  useEffect(() => {
    if (!showPackCodes) {
      setPackCodeDB(loadPackCodes())
      setPackFavorites(loadFavorites())
    }
  }, [showPackCodes])
  const [showBackupForm, setShowBackupForm] = useState(false)
  const [showLineStats, setShowLineStats] = useState(null) // 'mid-sample' or 'close-out'
  const [palletLineStats, setPalletLineStats] = useState(INIT_SLOT.palletLineStats || null) // stored once captured
  const [editingSample, setEditingSample] = useState(null) // sample object being edited/reassigned
  const [boxWeightMode, setBoxWeightMode] = useState(false) // toggle: box-weight audit vs regular sampling
  const [boxWeights, setBoxWeights] = useState([]) // array of numbers
  const [boxTolerance, setBoxTolerance] = useState(() => {
    try { return parseFloat(localStorage.getItem('bc_box_tolerance') || '5') } catch { return 5 }
  })
  useEffect(() => {
    try { localStorage.setItem('bc_box_tolerance', String(boxTolerance)) } catch {}
  }, [boxTolerance])

  // Auto-persist current line's slot to localStorage on any relevant change
  useEffect(() => {
    try {
      const slot = {
        lotId, dailyPalletNum, packLine, receiptNum, grower, variety,
        packCriteria, packCode, lastPackCode,
        palletReceipts, palletLineStats,
        lineRate, blowoff, sizeDiversion,
        counts, capturedWeight,
      }
      localStorage.setItem(`bc_slot_${activeLine}`, JSON.stringify(slot))
    } catch {}
  }, [activeLine, lotId, dailyPalletNum, packLine, receiptNum, grower, variety, packCriteria, packCode, lastPackCode, palletReceipts, palletLineStats, lineRate, blowoff, sizeDiversion, counts, capturedWeight])

  // Switch between line slots — saves current, loads target
  const switchLine = useCallback((target) => {
    if (target === activeLine) return
    // Current state auto-persists via the effect above, so we can safely load target
    let t = {}
    try { t = JSON.parse(localStorage.getItem(`bc_slot_${target}`) || '{}') } catch {}
    setLotId(t.lotId || '')
    setDailyPalletNum(t.dailyPalletNum || computeDailyPalletDefault())
    setPackLine(t.packLine || (target === 'line1' ? '1' : '2'))
    setReceiptNum(t.receiptNum || '')
    setGrower(t.grower || '')
    setVariety(t.variety || '')
    setPackCriteria(t.packCriteria || 'standard')
    setPackCode(
      t.packCode !== undefined
        ? t.packCode
        : findLastPackCodeForLine(t.packLine || (target === 'line1' ? '1' : '2'))
    )
    setLastPackCode(t.lastPackCode || '')
    setPalletReceipts(t.palletReceipts || [])
    setPalletLineStats(t.palletLineStats || null)
    setLineRate(t.lineRate || '')
    setBlowoff(t.blowoff || '')
    setSizeDiversion(t.sizeDiversion || '')
    setCounts(t.counts || { good: 0, permanent: 0, condition: 0, decay: 0 })
    setCapturedWeight(t.capturedWeight || null)
    setActiveLine(target)
    try { localStorage.setItem('bc_active_line', target) } catch {}
  }, [activeLine])

  // Training mode toggle — when ON, A/B data is saved for accuracy tracking
  const [trainingMode, setTrainingMode] = useState(() => {
    return localStorage.getItem('bc_training') === 'true'
  })
  const toggleTraining = () => {
    const next = !trainingMode
    setTrainingMode(next)
    localStorage.setItem('bc_training', next.toString())
    serverSave('bc_training', next)
  }

  // Sample history
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bc_history') || '[]') } catch { return [] }
  })

  const getSavedZones = () => {
    try {
      const saved = JSON.parse(localStorage.getItem('bc_zones') || '[]')
      const validKeys = ['good', 'permanent', 'condition', 'decay']
      return saved.filter(z => validKeys.includes(z.key))
    } catch { return [] }
  }

  // Handle incoming image from phone
  const handleRelayImage = useCallback(async (imageData, timestamp) => {
    // Rotate portrait to landscape
    const landscapeData = await ensureLandscape(imageData)
    setIncomingImage({ data: landscapeData, timestamp })

    // Auto-process if we have saved zones — hold for confirmation
    const zones = getSavedZones()
    if (zones.length > 0) {
      setProcessing(true)
      try {
        const result = await countBerriesInZones(landscapeData, zones)
        // Don't apply yet — show confirmation overlay
        setPendingZoneCounts({ counts: result.counts, image: landscapeData, zones })
        setComputerCounts({ ...result.counts })
      } catch (err) {
        console.error('Auto-process error:', err)
      } finally {
        setProcessing(false)
      }
    }
  }, [])

  const confirmZoneCounts = useCallback(() => {
    if (!pendingZoneCounts) return
    const zc = pendingZoneCounts.counts
    const total = (zc.good || 0) + (zc.permanent || 0) + (zc.condition || 0) + (zc.decay || 0)
    setCounts(prev => ({
      ...prev,
      good: zc.good || 0,
      permanent: zc.permanent || 0,
      condition: zc.condition || 0,
      decay: zc.decay || 0,
      _fullcountTotal: total,
      _sampleMethod: 'fullcount',
      _source: 'phone',
    }))
    // Auto-set to fullcount + quick mode (phone zones = 3-pile summary counts)
    if (sampleMethod !== 'fullcount') setSampleMethod('fullcount')
    if (detailedCounts) setDetailedCounts(false)
    setPendingZoneCounts(null)
  }, [pendingZoneCounts, sampleMethod, detailedCounts])

  // Sync handler — when another device saves data, pull fresh copy
  const handleSync = useCallback((key) => {
    fetch('/api/store/' + key).then(r => r.json()).then(data => {
      if (data === null) return
      localStorage.setItem(key, JSON.stringify(data))
      // Update React state for keys we hold in state
      if (key === 'bc_history') try { setHistory(data) } catch {}
      if (key === 'bc_features') try { setFeatures(typeof data === 'object' ? { ...loadFeatures(), ...data } : loadFeatures()) } catch {}
    }).catch(() => {})
  }, [])

  const { connected, phonesOnline, graderConnected, scaleConnected, scaleWeight, scalePort, sendScaleCommand, wsRef } = useRelay('dashboard', handleRelayImage, handleSync)

  // Auto-expand camera/scale panels when hardware connects
  useEffect(() => { if (graderConnected) setShowCameraPanel(true) }, [graderConnected])
  useEffect(() => { if (scaleConnected) setShowScalePanel(true) }, [scaleConnected])

  // Push daily summary to server for viewer/archive access
  const pushDailySummary = useCallback((h) => {
    const today = new Date().toLocaleDateString()
    const todaySamples = h.filter(s => s.date === today)

    // Group by pallet
    const palletMap = {}
    todaySamples.forEach(s => {
      if (!s.lotId) return
      if (!palletMap[s.lotId]) {
        palletMap[s.lotId] = {
          lotId: s.lotId, receiptNum: s.receiptNum, grower: s.grower,
          variety: s.variety, time: s.time,
          lineRate: s.lineRate, blowoff: s.blowoff, sizeDiversion: s.sizeDiversion,
          dcStrictness: null, isMissed: false,
          samples: [],
        }
      }
      palletMap[s.lotId].samples.push(s)
      if (s.lineRate) palletMap[s.lotId].lineRate = s.lineRate
      if (s.sizeDiversion != null) palletMap[s.lotId].sizeDiversion = s.sizeDiversion
      if (s.blowoff != null) palletMap[s.lotId].blowoff = s.blowoff
      if (s.isMissed) palletMap[s.lotId].isMissed = true
    })

    // Grade each pallet
    const pallets = Object.values(palletMap).map(p => {
      const official = p.samples.filter(s => !s.isExtra && !s.isSkipped)
      if (official.length === 0) return { ...p, grade: p.isMissed ? 'MISSED' : '—', pctCombined: 0 }
      const avg = {}
      for (const key of ['good', 'permanent', 'condition', 'decay']) {
        avg[key] = Math.round((official.reduce((a, s) => a + (s[key] || 0), 0) / official.length) * 10) / 10
      }
      const result = gradeSample(avg)
      return { ...p, grade: result.label, pctCombined: result.pctCombined, samples: undefined }
    })

    // Day averages
    const withRate = pallets.filter(p => p.lineRate)
    const withBlowoff = pallets.filter(p => p.blowoff != null)
    const avgLineRate = withRate.length > 0 ? withRate.reduce((s, p) => s + p.lineRate, 0) / withRate.length : null
    const avgBlowoff = withBlowoff.length > 0
      ? Math.round((withBlowoff.reduce((s, p) => s + p.blowoff, 0) / withBlowoff.length) * 10) / 10
      : null

    // Try to get DC strictness from localStorage
    let dcStrictness = null
    try { dcStrictness = parseInt(localStorage.getItem('bc_dc_strictness') || '3') } catch {}
    pallets.forEach(p => { if (!p.dcStrictness) p.dcStrictness = dcStrictness })

    fetch('/api/daily', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: today, data: { pallets, avgLineRate, avgBlowoff } }),
    }).catch(() => {})
  }, [])

  const saveHistory = useCallback((h) => {
    setHistory(h)
    localStorage.setItem('bc_history', JSON.stringify(h))
    serverSave('bc_history', h)
    pushDailySummary(h)
  }, [])

  // Retroactively assign a pallet tag — updates every sample on (date, dailyPalletNum, packLine)
  // and syncs the live slot if the active line+pallet matches
  const assignPalletTag = useCallback((targetPackLine, targetDailyPallet, newTag) => {
    const today = new Date().toLocaleDateString()
    const tag = (newTag || '').trim()
    const updated = history.map(s => {
      if (s.date !== today) return s
      if ((s.dailyPalletNum || 0) !== targetDailyPallet) return s
      if (String(s.packLine || '') !== String(targetPackLine)) return s
      return { ...s, lotId: tag }
    })
    saveHistory(updated)
    // Sync live slot if the active pallet matches
    const activePackLineStr = activeLine === 'line1' ? '1' : '2'
    if (String(packLine) === String(targetPackLine) && dailyPalletNum === targetDailyPallet) {
      setLotId(tag)
    } else if (activePackLineStr === String(targetPackLine) && dailyPalletNum === targetDailyPallet) {
      setLotId(tag)
    }
  }, [history, saveHistory, activeLine, packLine, dailyPalletNum])

  // Save accuracy log (A/B comparisons) to localStorage
  const saveAccuracyLog = useCallback((entry) => {
    try {
      const log = JSON.parse(localStorage.getItem('bc_accuracy') || '[]')
      log.push(entry)
      localStorage.setItem('bc_accuracy', JSON.stringify(log))
      serverSave('bc_accuracy', log)
    } catch {}
  }, [])

  const doLogSample = useCallback((isExtra) => {
    const totalB = (counts.good || 0) + (counts.permanent || 0) +
      (counts.condition || 0) + (counts.decay || 0)
    if (!totalB) return

    // Count official (non-extra) samples for today's daily pallet #
    const todayStr = new Date().toLocaleDateString()
    const sameLot = (s) => s.dailyPalletNum === dailyPalletNum && s.date === todayStr && !s.isExtra
    const officialCount = history.filter(sameLot).length

    // Check for receipt bounceback on official samples
    // If this receipt was used, then a different one was used, and now this one is back — flag it
    let receiptWarning = null
    if (!isExtra && receiptNum) {
      const officialSamples = history.filter(s => sameLot(s) && !s.isSkipped)
      if (officialSamples.length >= 2) {
        const receiptSequence = officialSamples.map(s => s.receiptNum)
        const lastReceipt = receiptSequence[receiptSequence.length - 1]
        const prevReceipts = receiptSequence.slice(0, -1)
        // Current receipt matches an older one but not the most recent — it bounced back
        if (lastReceipt !== receiptNum && prevReceipts.includes(receiptNum)) {
          receiptWarning = `Receipt ${receiptNum} was used earlier, then switched to ${lastReceipt}, and is now back. This is unusual — verify the correct receipt is selected.`
        }
      }
    }

    if (receiptWarning) {
      const proceed = confirm(`WARNING: ${receiptWarning}\n\nDo you want to continue logging this sample under ${receiptNum}?`)
      if (!proceed) return
    }

    const sample = {
      id: Date.now(),
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      date: new Date().toLocaleDateString(),
      lotId, dailyPalletNum, packLine, receiptNum, grower, variety, packCriteria,
      ...counts,
      _gradingStandard: gradingStandard,
      isExtra,
      sampleNum: isExtra ? null : officialCount + 1,
      receiptWarning: receiptWarning || null,
      computerCounts: computerCounts || null,
      wasEdited: computerCounts ? JSON.stringify(counts) !== JSON.stringify(computerCounts) : null,
    }
    saveHistory([...history, sample])

    // Log A/B comparison for accuracy tracking (only in training mode)
    if (computerCounts && trainingMode) {
      saveAccuracyLog({
        id: sample.id,
        time: sample.time,
        date: sample.date,
        a: computerCounts,
        b: counts,
        edited: sample.wasEdited,
        isExtra,
      })
    }

    setCounts({ good: 0, permanent: 0, condition: 0, decay: 0 })
    setCapturedWeight(null)
    setComputerCounts(null)
    setIncomingImage(null)

    const layerNames = { 1: 'BOTTOM LAYER', 2: 'MIDDLE LAYER', 3: 'TOP LAYER' }

    if (!isExtra && sample.sampleNum >= 3) {
      // 3/3 complete — go to close-out
      setShowPalletCloseOut(true)
    } else if (!isExtra && sample.sampleNum === 2) {
      // Middle layer — show inline line stats prompt (non-blocking)
      setShowLineStats('mid-sample')
    }

    // No alert — static reminder is always visible below the action buttons
  }, [counts, computerCounts, lotId, receiptNum, grower, variety, history, saveHistory, saveAccuracyLog, trainingMode])

  const logSample = useCallback(() => doLogSample(false), [doLogSample])

  // Log a box-weight sample (EXTRA — doesn't consume a layer slot)
  const logBoxWeightSample = useCallback((labelWeight, tolerance) => {
    const weights = boxWeights.filter(w => w > 0)
    if (weights.length === 0) return
    const now = new Date()
    const rules = loadPackTolerance()
    const mean = weights.reduce((a, b) => a + b, 0) / weights.length
    const min = Math.min(...weights)
    const max = Math.max(...weights)
    const classes = weights.map(w => classifyWeight(w, labelWeight, rules))
    const inSpec = classes.filter(c => c === 'green').length
    const under = weights.filter(w => w < labelWeight - labelWeight * rules.greenPct / 100).length
    const over = classes.filter(c => c === 'red').length
    const pctInSpec = (inSpec / weights.length) * 100
    const sample = {
      id: Date.now(),
      time: now.toLocaleTimeString('en-US', { hour12: false }),
      date: now.toLocaleDateString(),
      lotId, dailyPalletNum, packLine, receiptNum, grower, variety, packCriteria,
      good: 0, permanent: 0, condition: 0, decay: 0,
      _sampleMethod: 'boxweight',
      _gradingStandard: gradingStandard,
      _boxWeights: weights,
      _boxLabelWeight: labelWeight,
      _boxTolerance: tolerance,
      _boxMean: mean,
      _boxMin: min,
      _boxMax: max,
      _boxCount: weights.length,
      _boxInSpec: inSpec,
      _boxUnder: under,
      _boxOver: over,
      _boxPctInSpec: pctInSpec,
      isExtra: true,
      sampleNum: null,
    }
    saveHistory([...history, sample])
    setBoxWeights([])
    setBoxWeightMode(false)
  }, [boxWeights, lotId, dailyPalletNum, packLine, receiptNum, grower, variety, packCriteria, gradingStandard, history, saveHistory])
  const logExtraSample = useCallback(() => doLogSample(true), [doLogSample])

  // Scope samples to today's daily pallet # (pallet tag may be blank while layers show)
  const todayStr = new Date().toLocaleDateString()
  const palletMatches = (s) =>
    s.dailyPalletNum === dailyPalletNum && s.date === todayStr && !s.isExtra

  // Skip a layer — logs a blank placeholder so the layer counter advances
  const skipLayer = useCallback(() => {
    const officialCount = history.filter(palletMatches).length
    if (officialCount >= 3) return
    const sample = {
      id: Date.now(),
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      date: new Date().toLocaleDateString(),
      lotId, dailyPalletNum, packLine, receiptNum, grower, variety,
      good: 0, permanent: 0, condition: 0, decay: 0,
      isExtra: false,
      isSkipped: true,
      sampleNum: officialCount + 1,
    }
    saveHistory([...history, sample])
    // No alert — visible in layer indicator
  }, [lotId, dailyPalletNum, packLine, receiptNum, grower, variety, history, saveHistory])

  // Update or delete a sample by id (for layer editing / reassignment)
  const updateSample = useCallback((id, patch) => {
    const next = history.map(s => s.id === id ? { ...s, ...patch } : s)
    saveHistory(next)
  }, [history, saveHistory])

  const deleteSample = useCallback((id) => {
    const next = history.filter(s => s.id !== id)
    saveHistory(next)
  }, [history, saveHistory])

  // Undo a skip — remove the skip entry for a given layer so it becomes empty again
  const unskipLayer = useCallback((layerNum) => {
    const filtered = history.filter(s =>
      !(s.dailyPalletNum === dailyPalletNum && s.date === todayStr &&
        s.sampleNum === layerNum && s.isSkipped && !s.isExtra)
    )
    if (filtered.length === history.length) return // nothing to remove
    saveHistory(filtered)
  }, [dailyPalletNum, todayStr, history, saveHistory])

  // Skip up to a target layer — auto-fills skips for any earlier empty layers
  const skipToLayer = useCallback((targetLayer) => {
    const officialCount = history.filter(palletMatches).length
    if (officialCount >= targetLayer - 1) return // already past
    const now = new Date()
    const time = now.toLocaleTimeString('en-US', { hour12: false })
    const date = now.toLocaleDateString()
    const newSamples = []
    for (let i = officialCount; i < targetLayer - 1; i++) {
      newSamples.push({
        id: Date.now() + i,
        time, date,
        lotId, dailyPalletNum, packLine, receiptNum, grower, variety, packCriteria,
        good: 0, permanent: 0, condition: 0, decay: 0,
        isExtra: false, isSkipped: true,
        sampleNum: i + 1,
      })
    }
    saveHistory([...history, ...newSamples])
  }, [lotId, dailyPalletNum, packLine, receiptNum, grower, variety, packCriteria, history, saveHistory])

  // Skip entire pallet — logs all remaining layers as skipped + pack log missed entry
  const skipPallet = useCallback(() => {
    if (!lotId) return alert('Set a pallet tag first')
    if (!confirm(`Skip pallet ${lotId}? All samples will be marked as missed.`)) return

    const todayStr2 = new Date().toLocaleDateString()
    const officialCount = history.filter(s =>
      s.dailyPalletNum === dailyPalletNum && s.date === todayStr2 && !s.isExtra
    ).length
    const now = new Date()
    const time = now.toLocaleTimeString('en-US', { hour12: false })
    const date = now.toLocaleDateString()
    const newSamples = []

    // Log remaining layers as skipped
    for (let i = officialCount; i < 3; i++) {
      newSamples.push({
        id: Date.now() + i,
        time, date,
        lotId, dailyPalletNum, packLine, receiptNum, grower, variety, packCriteria,
        good: 0, permanent: 0, condition: 0, decay: 0,
        isExtra: false, isSkipped: true, isMissed: true,
        sampleNum: i + 1,
      })
    }

    if (newSamples.length > 0) {
      saveHistory([...history, ...newSamples])
    }

    // Log missed entry in pack log
    try {
      const packLog = JSON.parse(localStorage.getItem('bc_packlog') || '[]')
      const todayEntries = packLog.filter(e => e.date === date)
      const maxNum = todayEntries.reduce((max, e) => Math.max(max, e.dailyPallet || 0), 0)
      packLog.push({
        id: Date.now() + 10,
        time, date,
        packCode: '—',
        receiptNum: receiptNum || '',
        grower: grower || '',
        palletNum: lotId,
        dailyPallet: maxNum + 1,
        boxes: 0,
        isMissed: true,
      })
      localStorage.setItem('bc_packlog', JSON.stringify(packLog))
      serverSave('bc_packlog', packLog)
    } catch {}

    // No alert — visible in the sample log
  }, [lotId, receiptNum, grower, variety, packCriteria,
      history, saveHistory])

  // Pallet builder — add/update/remove receipts
  const addReceiptToPallet = useCallback((receipt) => {
    setPalletReceipts(prev => [...prev, receipt])
    // Set current receipt to the one just added
    setReceiptNum(receipt.receiptNum)
    setGrower(receipt.grower)
    setVariety(receipt.variety)
  }, [])

  const updateReceiptBoxes = useCallback((index, boxes) => {
    setPalletReceipts(prev => prev.map((r, i) => i === index ? { ...r, boxes } : r))
  }, [])

  const removeReceiptFromPallet = useCallback((index) => {
    setPalletReceipts(prev => prev.filter((_, i) => i !== index))
  }, [])

  const selectReceiptForQC = useCallback((receipt) => {
    setReceiptNum(receipt.receiptNum)
    setGrower(receipt.grower)
    setVariety(receipt.variety)
  }, [])

  // Handle receipt change mid-pallet (legacy — kept for ReceiptChange modal)
  const handleReceiptChange = useCallback((data) => {
    // Record the outgoing receipt segment
    setPalletReceipts(prev => [...prev, {
      receiptNum, grower, variety,
      boxes: data.outgoingBoxes,
    }])
    // Switch to new receipt
    setReceiptNum(data.newReceiptNum)
    setGrower(data.newGrower)
    setVariety(data.newVariety)
    setShowReceiptChange(false)
  }, [receiptNum, grower, variety])

  // Handle pallet close-out — saves composition to pack log
  const handlePalletCloseOut = useCallback((palletData) => {
    try {
      const packLog = JSON.parse(localStorage.getItem('bc_packlog') || '[]')
      const today = new Date().toLocaleDateString()
      const time = new Date().toLocaleTimeString('en-US', { hour12: false })
      const todayEntries = packLog.filter(e => e.date === today)
      const maxNum = todayEntries.reduce((max, e) => Math.max(max, e.dailyPallet || 0), 0)
      const dailyPallet = maxNum + 1

      // Log each receipt on this pallet
      palletData.entries.forEach((entry, i) => {
        packLog.push({
          id: Date.now() + i,
          time, date: today,
          packCode: palletData.packCode || '—',
          receiptNum: entry.receiptNum,
          grower: entry.grower,
          variety: entry.variety,
          palletNum: palletData.lotId,
          dailyPallet,
          boxes: entry.boxes,
          isSplit: palletData.entries.length > 1,
          lineRate: (palletLineStats || palletData).lineRate,
          blowoff: (palletLineStats || palletData).blowoff,
          sizeDiversion: (palletLineStats || palletData).sizeDiversion,
          lineStatsCapturedAt: palletLineStats?.capturedAt || palletData.lineStatsCapturedAt || 'close-out',
        })
      })

      localStorage.setItem('bc_packlog', JSON.stringify(packLog))
      serverSave('bc_packlog', packLog)
    } catch {}

    setShowPalletCloseOut(false)
    setPalletLineStats(null)
    setShowLineStats(null)
    // Advance daily pallet number for next pallet
    setDailyPalletNum(prev => prev + 1)
    // Reset for next pallet
    setLotId('')
    setReceiptNum('')
    setGrower('')
    setVariety('')
    setPalletReceipts([])
    setPackCode('')
  }, [palletLineStats])

  const clearHistory = useCallback(() => saveHistory([]), [saveHistory])

  // Helper: average counts across samples for lot grading
  const averageCounts = (samples) => {
    if (samples.length === 0) return { good: 0, permanent: 0, condition: 0, decay: 0 }
    const keys = ['good', 'permanent', 'condition', 'decay']
    const avg = {}
    for (const key of keys) {
      avg[key] = Math.round((samples.reduce((a, s) => a + (s[key] || 0), 0) / samples.length) * 10) / 10
    }
    return avg
  }

  const onCameraResult = useCallback((zoneCounts) => {
    setCounts(zoneCounts)
    setView('qc')
  }, [])

  const onZoneCounts = useCallback((zoneCounts) => {
    setCounts(zoneCounts)
    setComputerCounts({ ...zoneCounts })
    setShowZoneEditor(false)
  }, [])

  if (view === 'camera') {
    return <CameraCapture onResult={onCameraResult} onBack={() => setView('qc')} />
  }

  const hasZones = getSavedZones().length > 0

  return (
    <div style={{
      background: COLORS.bg, minHeight: '100vh',
      color: COLORS.text, fontFamily: FONT, fontSize: 14,
      zoom: FONT_SCALES[fontScale] || 1,
    }}>
      {cameraResetAt ? (
        <div style={{
          position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
          background: COLORS.panel || '#111', color: COLORS.text,
          border: `1px solid ${COLORS.border}`, padding: '8px 14px',
          fontFamily: FONT, fontSize: 11, letterSpacing: '0.06em',
          borderRadius: 4,
        }}>CAMERA RESET SENT</div>
      ) : null}
      <Header
        onOpenCamera={() => setView('camera')}
        onResetZones={() => {
          localStorage.removeItem('bc_zones')
          alert('Zones cleared. Draw new zones on the next captured image.')
        }}
        onShowAccuracy={() => setShowAccuracy(true)}
        onShowLogs={() => setShowLogManager(true)}
        onShowReceipts={() => setShowReceipts(true)}
        onShowPackLog={() => setShowPackLog(true)}
        onShowPackCodes={() => setShowPackCodes(true)}
        onShowBackupForm={() => setShowBackupForm(true)}
        onShowPackout={() => setShowPackout(true)}
        onShowDCReconcile={() => setShowDCReconcile(true)}
        onShowPrePack={() => setShowPrePack(true)}
        onShowFeatures={() => setShowFeatures(true)}
        features={features}
        trainingMode={trainingMode}
        onToggleTraining={toggleTraining}
        qcerMode={qcerMode}
        onToggleQcerMode={toggleQcerMode}
        relayConnected={connected}
        phonesOnline={phonesOnline}
        graderConnected={graderConnected}
        scaleConnected={scaleConnected}
        scaleWeight={scaleWeight}
        scalePort={scalePort}
        onScaleTare={() => sendScaleCommand('tare')}
        fontScale={fontScale}
        onFontScale={(size) => { setFontScale(size); localStorage.setItem('bc_font_scale', size) }}
      />

      {/* Mode toggle */}
      <div style={{
        display: 'flex', borderBottom: `1px solid ${COLORS.border}`,
        background: COLORS.bg2,
      }}>
        <button onClick={() => setView('qc')} style={{
          flex: 1, fontFamily: FONT, fontSize: 12, fontWeight: 600,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          padding: '10px 20px', cursor: 'pointer', border: 'none',
          background: view === 'qc' ? COLORS.bg : COLORS.bg2,
          color: view === 'qc' ? COLORS.green : COLORS.text3,
          borderBottom: view === 'qc' ? `2px solid ${COLORS.green}` : '2px solid transparent',
        }}>
          QC Sample
        </button>
        <button onClick={() => setView('ops')} style={{
          flex: 1, fontFamily: FONT, fontSize: 12, fontWeight: 600,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          padding: '10px 20px', cursor: 'pointer', border: 'none',
          background: view === 'ops' ? COLORS.bg : COLORS.bg2,
          color: view === 'ops' ? COLORS.amber : COLORS.text3,
          borderBottom: view === 'ops' ? `2px solid ${COLORS.amber}` : '2px solid transparent',
        }}>
          Operations
        </button>
      </div>

      {view === 'qc' ? (
        /* ========== QC MODE ========== */
        (() => {
          // Compute active pack theme — loud color so QCer knows which pack type.
          // Per-pack-type modes (pint / 18oz / mightyblue) and legacy 30-berry-only modes
          // (pint30 / 18oz30 / mightyblue30) share colors per pack type.
          const BUILTIN_PACK_COLORS = {
            pint: '#10B981',         // green — pint (camera)
            pint30: '#1E40AF',       // blue — pint (30-berry, legacy)
            '18oz': '#EA580C',       // orange — 18oz (camera)
            '18oz30': '#EA580C',     // orange — 18oz (30-berry, legacy)
            mightyblue: '#0891B2',   // teal — Mighty Blue (camera)
            mightyblue30: '#0891B2', // teal — Mighty Blue (30-berry, legacy)
          }
          let packColor = BUILTIN_PACK_COLORS[sampleMethod] || null
          let packLabel = null
          if (sampleMethod === 'pint' || sampleMethod === 'pint30') packLabel = 'PINT'
          else if (sampleMethod === '18oz' || sampleMethod === '18oz30') packLabel = '18OZ'
          else if (sampleMethod === 'mightyblue' || sampleMethod === 'mightyblue30') packLabel = 'MIGHTY BLUE'
          else {
            try {
              const customs = JSON.parse(localStorage.getItem('bc_custom_methods') || '[]')
              const match = customs.find(c => c.key === sampleMethod)
              if (match) { packColor = match.color || '#DB2777'; packLabel = match.label.toUpperCase() }
            } catch {}
          }
          const themed = !!packColor
          return (
        <div style={{ minHeight: 'calc(100vh - 90px)' }}>
          {/* ===== SAMPLE BOX — Center of attention ===== */}
          <div style={{
            maxWidth: 640, margin: '20px auto 0', padding: '0 20px',
          }}>
            <div style={{
              background: COLORS.bg,
              border: themed ? `3px solid ${packColor}` : `2px solid ${COLORS.border2}`,
              borderRadius: 10,
              overflow: 'hidden',
              boxShadow: themed ? `0 2px 20px ${packColor}40` : '0 2px 12px rgba(0,0,0,0.06)',
            }}>

              {/* Pack type banner — colored dot + clean label. Parent box's colored border carries the loud signal. */}
              {themed && (
                <div style={{
                  background: COLORS.bg,
                  padding: '14px 18px',
                  borderBottom: `1px solid ${packColor}30`,
                  display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  <span style={{
                    width: 14, height: 14, borderRadius: '50%',
                    background: packColor,
                    boxShadow: `0 0 0 4px ${packColor}22`,
                    flex: '0 0 auto',
                  }} />
                  <span style={{
                    fontFamily: FONT, fontSize: 22, fontWeight: 700,
                    color: COLORS.text, letterSpacing: '0.04em',
                  }}>{packLabel}</span>
                  <div style={{ flex: 1 }} />
                  <span style={{
                    fontFamily: FONT, fontSize: 9, fontWeight: 700,
                    color: packColor, letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                  }}>Active Pack</span>
                </div>
              )}

              {/* Line slot switcher — only when dual-line mode is on */}
              {dualLineMode && (
                <LineSwitcher
                  activeLine={activeLine}
                  lotId={lotId}
                  counts={counts}
                  onSwitch={switchLine}
                />
              )}

              {/* Pallet identity — Daily # + Tag + Pack Code + layer visual; wraps on narrow.
                  justify-center so the wrapped second row (Layer / BOX WEIGHT / ASSIGN TAG) sits centered
                  rather than hugging the left. The first row still fills the width because Pack Code grows. */}
              <div style={{
                display: 'flex', alignItems: 'stretch', gap: 10,
                flexWrap: 'wrap', justifyContent: 'center',
                padding: '12px 14px',
                background: themed ? packColor + '12' : COLORS.bg2,
                borderBottom: `1px solid ${themed ? packColor + '30' : COLORS.border}`,
              }}>
                {/* DAILY PALLET NUMBER card */}
                <div style={{
                  flex: '0 0 auto', minWidth: 120,
                  background: COLORS.bg,
                  border: `2px solid ${COLORS.green}`,
                  borderRadius: 8,
                  padding: '8px 14px',
                  display: 'flex', flexDirection: 'column', gap: 2,
                }}>
                  <div style={{
                    fontFamily: FONT, fontSize: 9, fontWeight: 700,
                    color: COLORS.green, letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                  }}>Daily Pallet #</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{
                      fontFamily: FONT, fontSize: 34, fontWeight: 800,
                      color: COLORS.green, lineHeight: 1,
                    }}>#</span>
                    <input
                      type="number"
                      min="1"
                      value={dailyPalletNum}
                      onChange={e => setDailyPalletNum(parseInt(e.target.value) || 1)}
                      style={{
                        background: 'transparent', border: 'none', padding: 0,
                        fontFamily: FONT, fontSize: 34, fontWeight: 800,
                        color: COLORS.green, lineHeight: 1,
                        width: 80, outline: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* PALLET TAG card */}
                <div style={{
                  flex: '1 1 140px', minWidth: 140,
                  background: COLORS.bg,
                  border: `2px solid ${COLORS.border2}`,
                  borderRadius: 8,
                  padding: '8px 14px',
                  display: 'flex', flexDirection: 'column', gap: 2,
                }}>
                  <div style={{
                    fontFamily: FONT, fontSize: 9, fontWeight: 700,
                    color: COLORS.text3, letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                  }}>Pallet Tag</div>
                  <input
                    value={lotId}
                    onChange={e => setLotId(e.target.value)}
                    placeholder="scan or type tag"
                    style={{
                      background: 'transparent', border: 'none', padding: 0,
                      color: COLORS.text, fontFamily: FONT, fontSize: 24, fontWeight: 700,
                      outline: 'none', width: '100%',
                    }}
                  />
                </div>

                {/* PACK CODE card — line-specific; defaults to last code used on this line */}
                <div style={{
                  flex: '1 1 220px', minWidth: 220,
                  background: COLORS.bg,
                  border: `2px solid ${packCode ? COLORS.purple : COLORS.border2}`,
                  borderRadius: 8,
                  padding: '8px 14px',
                  display: 'flex', flexDirection: 'column', gap: 2,
                }}>
                  <div style={{
                    fontFamily: FONT, fontSize: 9, fontWeight: 700,
                    color: packCode ? COLORS.purple : COLORS.text3,
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                  }}>Pack Code</div>
                  <select
                    value={packCode}
                    onChange={e => setPackCode(e.target.value)}
                    style={{
                      background: 'transparent', border: 'none', padding: 0,
                      fontFamily: FONT,
                      fontSize: packCode ? 18 : 14, fontWeight: 700,
                      color: packCode ? COLORS.text : COLORS.text3,
                      outline: 'none', width: '100%', cursor: 'pointer',
                      appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
                    }}
                  >
                    <option value="">Select pack code…</option>
                    {packFavorites.length > 0 && (
                      <optgroup label="★ Favorites">
                        {packCodeDB.filter(c => packFavorites.includes(c.code)).map(c => (
                          <option key={c.code} value={c.code}>{c.code} — {c.desc}</option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label={packFavorites.length > 0 ? 'All Codes' : 'Pack Codes'}>
                      {packCodeDB.filter(c => !packFavorites.includes(c.code)).map(c => (
                        <option key={c.code} value={c.code}>{c.code} — {c.desc}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Layer visual — always visible, correlated with daily pallet # */}
                <div style={{ flex: '0 0 170px', display: 'flex', alignItems: 'stretch' }}>
                  <PalletLayers
                    dailyPalletNum={dailyPalletNum}
                    history={history}
                    gradingStandard={gradingStandard}
                    onSkipToLayer={skipToLayer}
                    onUnskipLayer={unskipLayer}
                    onEditSample={setEditingSample}
                    compact={palletLayersCompact}
                    onToggleCompact={() => setPalletLayersCompact(v => !v)}
                  />
                </div>

                {/* BOX WEIGHT — sized to match Layer group, full-height single button */}
                <div style={{ flex: '0 0 170px', display: 'flex', alignItems: 'stretch' }}>
                  <button
                    onClick={() => { setBoxWeightMode(v => !v); if (boxWeightMode) setBoxWeights([]) }}
                    style={{
                      width: '100%', flex: 1,
                      fontFamily: FONT, fontSize: 14, fontWeight: 800,
                      color: boxWeightMode ? '#fff' : COLORS.amber,
                      background: boxWeightMode ? COLORS.amber : 'transparent',
                      border: `2px solid ${COLORS.amber}`,
                      borderRadius: 6, cursor: 'pointer',
                      letterSpacing: '0.12em',
                      padding: '8px 10px',
                      lineHeight: 1.25,
                    }}>BOX<br />WEIGHT{boxWeightMode ? ' ●' : ''}</button>
                </div>

              </div>

              {/* Receipt context — thin strip when set */}
              {receiptNum && (
                <div style={{
                  padding: '4px 16px',
                  background: COLORS.bg2,
                  borderBottom: `1px solid ${COLORS.border}`,
                }}>
                  <span style={{ fontFamily: FONT, fontSize: 10, color: COLORS.text3 }}>
                    {receiptNum} ({grower}){variety ? ` \u00b7 ${variety}` : ''}
                  </span>
                </div>
              )}

              {/* Live grade display — integrated in card; hidden in box-weight mode (no grade in that flow) */}
              {!boxWeightMode && (
                <div style={{ padding: '10px 16px', borderBottom: `1px solid ${COLORS.border}` }}>
                  <ScoreDisplay counts={counts} packCriteria={packCriteria} tolerances={GRADING_STANDARDS[gradingStandard].tolerances} />
                </div>
              )}

              {/* Tools row — camera, scale, logs */}
              <div style={{
                display: 'flex', gap: 6, padding: '8px 16px',
                borderBottom: `1px solid ${COLORS.border}`,
              }}>
                {!boxWeightMode && (
                  <button onClick={() => setShowCameraPanel(p => !p)} style={{
                    fontFamily: FONT, fontSize: 9, fontWeight: 600,
                    color: graderConnected ? COLORS.green : COLORS.text3,
                    background: showCameraPanel ? COLORS.bg3 : 'transparent',
                    border: `1px solid ${graderConnected ? COLORS.green : COLORS.border}`,
                    padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
                    letterSpacing: '0.06em',
                  }}>CAMERA {graderConnected ? '\u25cf' : ''}</button>
                )}
                <button onClick={() => setShowScalePanel(p => !p)} style={{
                  fontFamily: FONT, fontSize: 9, fontWeight: 600,
                  color: scaleConnected ? COLORS.green : COLORS.text3,
                  background: showScalePanel ? COLORS.bg3 : 'transparent',
                  border: `1px solid ${scaleConnected ? COLORS.green : COLORS.border}`,
                  padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
                  letterSpacing: '0.06em',
                }}>SCALE {scaleConnected ? '\u25cf' : ''}</button>
                <div style={{ flex: 1 }} />
                <button onClick={() => setShowAssignTag(true)} style={{
                  fontFamily: FONT, fontSize: 9, fontWeight: 700,
                  color: COLORS.purple, background: 'transparent',
                  border: `1px solid ${COLORS.purple}`,
                  padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
                  letterSpacing: '0.06em',
                }}>ASSIGN TAG</button>
                <button onClick={() => setShowLogManager(true)} style={{
                  fontFamily: FONT, fontSize: 11, fontWeight: 700,
                  color: '#fff', background: COLORS.amber,
                  border: `1px solid ${COLORS.amber}`,
                  padding: '6px 14px', borderRadius: 4, cursor: 'pointer',
                  letterSpacing: '0.08em',
                  boxShadow: `0 1px 2px ${COLORS.amber}40`,
                }}>LOGS</button>
              </div>

              {/* Camera panel — expandable; hidden in box-weight mode */}
              {showCameraPanel && !boxWeightMode && (
                <div style={{ padding: '8px 16px', borderBottom: `1px solid ${COLORS.border}`, background: COLORS.bg2 }}>
                  <CameraTuner
                    wsRef={wsRef}
                    relayConnected={connected}
                    graderConnected={graderConnected}
                    onUseCount={(countOrObj) => {
                      const total = (typeof countOrObj === 'object' && countOrObj !== null)
                        ? countOrObj.total : countOrObj
                      setCounts(prev => ({ ...prev, _fullcountTotal: total, _source: 'grader' }))
                      // Camera count only auto-routes to fullcount if the QCer isn't already in a camera-clamshell mode
                      if (sampleMethod !== 'fullcount' && sampleMethod !== 'pint' && sampleMethod !== '18oz' && sampleMethod !== 'mightyblue') setSampleMethod('fullcount')
                    }}
                  />
                  {!incomingImage && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button onClick={() => setShowPhoneQR(true)} style={{
                        flex: 1, fontFamily: FONT, fontSize: 10, color: COLORS.text3,
                        background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                        padding: '8px', borderRadius: 4, cursor: 'pointer',
                        letterSpacing: '0.06em', textAlign: 'center',
                      }}>PHONE CAMERA</button>
                    </div>
                  )}
                </div>
              )}

              {/* Scale panel — expandable */}
              {showScalePanel && (
                <div style={{ padding: '8px 16px', borderBottom: `1px solid ${COLORS.border}`, background: COLORS.bg2 }}>
                  <ScaleCapture
                    scaleConnected={scaleConnected}
                    scaleWeight={scaleWeight}
                    capturedWeight={capturedWeight}
                    onWeightCapture={(weight, source) => {
                      if (weight == null) {
                        setCapturedWeight(null)
                        setCounts(prev => ({ ...prev, _packWeight: 0, _scaleSource: null }))
                      } else {
                        setCapturedWeight({ weight, _source: source })
                        setCounts(prev => ({ ...prev, _packWeight: weight, _scaleSource: source }))
                      }
                    }}
                  />
                </div>
              )}

              {/* Incoming image from phone — shows when received; hidden in box-weight mode */}
              {incomingImage && !boxWeightMode && (
                <div style={{ padding: '8px 16px', borderBottom: `1px solid ${COLORS.border}`, background: COLORS.bg2 }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: 6,
                  }}>
                    <div style={{
                      fontFamily: FONT, fontSize: 9, color: COLORS.text3,
                      letterSpacing: '0.06em', textTransform: 'uppercase',
                    }}>
                      Capture <span style={{ color: COLORS.green, fontWeight: 400 }}>{incomingImage.timestamp}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => {
                        localStorage.removeItem('bc_zones')
                        alert('Zones cleared. Draw new zones on the next captured image.')
                      }} style={{
                        fontFamily: FONT, fontSize: 9, color: COLORS.amber,
                        background: 'transparent', border: `1px solid ${COLORS.amberDim}`,
                        padding: '2px 8px', borderRadius: 2, cursor: 'pointer',
                      }}>RESET ZONES</button>
                      <button onClick={() => setShowZoneEditor(true)} style={{
                        fontFamily: FONT, fontSize: 9, color: COLORS.amber,
                        background: 'transparent', border: `1px solid ${COLORS.amberDim}`,
                        padding: '2px 8px', borderRadius: 2, cursor: 'pointer',
                      }}>
                        {getSavedZones().length > 0 ? 'EDIT ZONES' : 'DRAW ZONES'}
                      </button>
                    </div>
                  </div>
                  <img
                    src={incomingImage.data}
                    onClick={() => setShowZoneEditor(true)}
                    style={{
                      width: '100%', maxHeight: 160, objectFit: 'contain',
                      borderRadius: 3, border: `1px solid ${COLORS.border}`,
                      cursor: 'pointer',
                    }}
                    alt="Captured tray"
                  />
                  {processing && (
                    <div style={{
                      fontFamily: FONT, fontSize: 10, color: COLORS.amber,
                      textAlign: 'center', marginTop: 4,
                    }}>COUNTING...</div>
                  )}
                </div>
              )}

              {/* COUNT ENTRY — The main event */}
              {boxWeightMode ? (
                <BoxWeightEntry
                  weights={boxWeights}
                  setWeights={setBoxWeights}
                  tolerance={boxTolerance}
                  setTolerance={setBoxTolerance}
                  activeMethod={sampleMethod}
                  onSetMethod={setSampleMethod}
                  onSave={logBoxWeightSample}
                  onCancel={() => { setBoxWeightMode(false); setBoxWeights([]) }}
                />
              ) : (
              <div style={{ padding: '12px 16px' }}>
                <CountEntry
                  counts={counts} setCounts={setCounts}
                  detailed={detailedCounts}
                  onToggleDetailed={() => setDetailedCounts(!detailedCounts)}
                  sampleMethod={sampleMethod}
                  onToggleMethod={() => setSampleMethod(prev =>
                    prev === 'fullcount' ? 'pint'
                    : prev === 'pint' ? '18oz'
                    : prev === '18oz' ? 'mightyblue'
                    : prev === 'mightyblue' ? 'pint30'
                    : prev === 'pint30' ? '18oz30'
                    : prev === '18oz30' ? 'mightyblue30'
                    : prev === 'mightyblue30' ? '600g'
                    : prev === '600g' ? 'manual'
                    : 'fullcount'
                  )}
                  onSetMethod={setSampleMethod}
                  gradingStandard={gradingStandard}
                  onToggleStandard={() => setGradingStandard(prev => prev === 'mbg' ? 'butterfly' : 'mbg')}
                  onShowGradingGuide={() => setShowGradingGuide(true)}
                  dualLineMode={dualLineMode}
                  onToggleDualLineMode={() => setDualLineMode(v => !v)}
                />
              </div>
              )}

              {/* Action buttons — hidden in box-weight mode (has its own save) */}
              {!boxWeightMode && (
              <div style={{ display: 'flex', gap: 8, padding: '0 16px 12px' }}>
                <button onClick={() => {
                  setCounts({ good: 0, permanent: 0, condition: 0, decay: 0 })
                  setCapturedWeight(null)
                  setIncomingImage(null)
                }} style={{
                  flex: 1, background: COLORS.bg3,
                  border: `1px solid ${COLORS.border2}`, color: COLORS.text3,
                  fontFamily: FONT, fontSize: 11, fontWeight: 600,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  padding: 14, borderRadius: 4, cursor: 'pointer',
                }}>DISCARD</button>
                <button onClick={logSample} style={{
                  flex: 2, background: COLORS.greenDim,
                  border: `2px solid ${COLORS.green}`, color: COLORS.green,
                  fontFamily: FONT, fontSize: 14, fontWeight: 700,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  padding: 14, borderRadius: 4, cursor: 'pointer',
                }}>
                  {(() => {
                    const td = new Date().toLocaleDateString()
                    const oc = history.filter(s => s.dailyPalletNum === dailyPalletNum && s.date === td && !s.isExtra).length
                    const ln = { 0: 'LOG BOTTOM', 1: 'LOG MIDDLE', 2: 'LOG TOP' }
                    return oc < 3 ? ln[oc] : 'LOG SAMPLE'
                  })()}
                </button>
                <button onClick={logExtraSample} style={{
                  flex: 1, background: COLORS.bg3,
                  border: `1px solid ${COLORS.purple}`, color: COLORS.purple,
                  fontFamily: FONT, fontSize: 11, fontWeight: 600,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  padding: 14, borderRadius: 4, cursor: 'pointer',
                }}>EXTRA</button>
              </div>
              )}

              {/* Static reminder */}
              <div style={{
                fontFamily: FONT, fontSize: 10, color: COLORS.text3,
                textAlign: 'center', fontStyle: 'italic', padding: '0 16px 10px',
              }}>
                Discard sampled berries into trash lugs — do not return to production
              </div>

            </div>

            {/* Line stats — below sample box, in center column */}
            {showLineStats && !palletLineStats && (
              <div style={{
                marginTop: 12,
                background: COLORS.amberDim, border: `2px solid ${COLORS.amber}`,
                borderRadius: 6, padding: 14,
              }}>
                <div style={{
                  fontFamily: FONT, fontSize: 11, fontWeight: 700,
                  color: COLORS.amber, marginBottom: 4,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>Line Stats — Check Machine Now</div>
                <div style={{
                  fontFamily: FONT, fontSize: 10, color: COLORS.text2,
                  marginBottom: 10,
                }}>Walk to the 360 and record current stats. You can defer this but it will keep showing until entered.</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontFamily: FONT, fontSize: 8, color: COLORS.amber, letterSpacing: '0.06em', marginBottom: 3 }}>LBS/HR</div>
                    <input type="number" min="0" id="ls-rate" placeholder="0" style={{
                      fontFamily: FONT, fontSize: 16, fontWeight: 700, textAlign: 'center',
                      width: '100%', padding: '8px', borderRadius: 4, border: `1px solid ${COLORS.amber}`,
                      background: COLORS.bg, color: COLORS.text, outline: 'none', boxSizing: 'border-box',
                    }} />
                  </div>
                  <div>
                    <div style={{ fontFamily: FONT, fontSize: 8, color: COLORS.amber, letterSpacing: '0.06em', marginBottom: 3 }}>BLOWOFF %</div>
                    <input type="number" min="0" max="100" step="0.1" id="ls-blowoff" placeholder="0" style={{
                      fontFamily: FONT, fontSize: 16, fontWeight: 700, textAlign: 'center',
                      width: '100%', padding: '8px', borderRadius: 4, border: `1px solid ${COLORS.amber}`,
                      background: COLORS.bg, color: COLORS.text, outline: 'none', boxSizing: 'border-box',
                    }} />
                  </div>
                  <div>
                    <div style={{ fontFamily: FONT, fontSize: 8, color: COLORS.amber, letterSpacing: '0.06em', marginBottom: 3 }}>SIZE SORT %</div>
                    <input type="number" min="0" max="100" step="0.1" id="ls-size" placeholder="0" style={{
                      fontFamily: FONT, fontSize: 16, fontWeight: 700, textAlign: 'center',
                      width: '100%', padding: '8px', borderRadius: 4, border: `1px solid ${COLORS.amber}`,
                      background: COLORS.bg, color: COLORS.text, outline: 'none', boxSizing: 'border-box',
                    }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => {
                    const rate = parseFloat(document.getElementById('ls-rate')?.value) || null
                    const blow = parseFloat(document.getElementById('ls-blowoff')?.value) || null
                    const size = parseFloat(document.getElementById('ls-size')?.value) || null
                    if (!rate && !blow && !size) return
                    const stats = { lineRate: rate, blowoff: blow, sizeDiversion: size, capturedAt: showLineStats }
                    setPalletLineStats(stats)
                    setHistory(prev => {
                      const updated = [...prev]
                      for (let i = updated.length - 1; i >= 0; i--) {
                        if (updated[i].lotId === lotId && updated[i].sampleNum === 2 && !updated[i].isExtra) {
                          updated[i] = { ...updated[i], lineStats: stats }
                          break
                        }
                      }
                      localStorage.setItem('bc_history', JSON.stringify(updated))
                      serverSave('bc_history', updated)
                      return updated
                    })
                    setShowLineStats(null)
                  }} style={{
                    flex: 2, fontFamily: FONT, fontSize: 12, fontWeight: 700,
                    color: COLORS.amber, background: COLORS.bg,
                    border: `2px solid ${COLORS.amber}`,
                    padding: 10, borderRadius: 4, cursor: 'pointer',
                    letterSpacing: '0.06em',
                  }}>SAVE LINE STATS</button>
                  <button onClick={() => {}} style={{
                    flex: 1, fontFamily: FONT, fontSize: 10,
                    color: COLORS.text3, background: 'transparent',
                    border: `1px solid ${COLORS.border}`,
                    padding: 10, borderRadius: 4, cursor: 'pointer',
                  }}>LATER</button>
                </div>
              </div>
            )}
            {palletLineStats && (
              <div style={{
                marginTop: 12,
                background: COLORS.greenDim, border: `1px solid ${COLORS.green}`,
                borderRadius: 6, padding: '10px 14px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div style={{ display: 'flex', gap: 14, fontFamily: FONT, fontSize: 11 }}>
                  {palletLineStats.lineRate && <span><span style={{ color: COLORS.text3 }}>Lbs/Hr</span> <b style={{ color: COLORS.green }}>{palletLineStats.lineRate}</b></span>}
                  {palletLineStats.blowoff != null && <span><span style={{ color: COLORS.text3 }}>Blowoff</span> <b style={{ color: COLORS.green }}>{palletLineStats.blowoff}%</b></span>}
                  {palletLineStats.sizeDiversion != null && <span><span style={{ color: COLORS.text3 }}>Size Sort</span> <b style={{ color: COLORS.green }}>{palletLineStats.sizeDiversion}%</b></span>}
                </div>
                <span style={{ fontFamily: FONT, fontSize: 9, color: COLORS.green, fontStyle: 'italic' }}>
                  {palletLineStats.capturedAt}
                </span>
              </div>
            )}

            {/* Weather & Pre-pack context — subtle, below sample box */}
            <div style={{ marginTop: 8 }}>
              <WeatherBanner />
            </div>
            {receiptNum && (
              <div style={{ marginTop: 4 }}>
                <PrePackBanner receiptNum={receiptNum} />
              </div>
            )}
          </div>

          {/* ===== RESULTS — populate below as samples are logged ===== */}
          <div style={{
            maxWidth: 800, margin: '24px auto 0', padding: '0 20px 20px',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            {/* Pallet management — accessible but secondary */}
            <details style={{ borderBottom: `1px solid ${COLORS.border}` }}>
              <summary style={{
                fontFamily: FONT, fontSize: 9, fontWeight: 600, color: COLORS.text3,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                padding: '6px 0', cursor: 'pointer',
                listStyle: 'none', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 8 }}>&#9654;</span> PALLET / PACK
                {receiptNum && <span style={{ color: COLORS.green, fontWeight: 400, textTransform: 'none', letterSpacing: '0.02em' }}>{'\u2014'} {receiptNum} {grower}</span>}
              </summary>

              <PalletBuilder
                palletReceipts={palletReceipts}
                onAddReceipt={addReceiptToPallet}
                onUpdateBoxes={updateReceiptBoxes}
                onRemoveReceipt={removeReceiptFromPallet}
                onSelectReceipt={selectReceiptForQC}
                packCode={packCode} setPackCode={setPackCode}
                currentReceiptNum={receiptNum}
              />

              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 0',
                borderBottom: `1px solid ${COLORS.border}`,
              }}>
                {features.receipts !== false && (
                  <button onClick={() => setShowReceipts(true)} style={{
                    fontFamily: FONT, fontSize: 9, color: COLORS.amber,
                    background: 'transparent', border: `1px solid ${COLORS.amberDim}`,
                    padding: '3px 10px', borderRadius: 3, cursor: 'pointer',
                    letterSpacing: '0.06em',
                  }}>RECEIPTS</button>
                )}
                <button onClick={() => setShowPackCodes(true)} style={{
                  fontFamily: FONT, fontSize: 9, color: COLORS.text3,
                  background: 'transparent', border: `1px solid ${COLORS.border}`,
                  padding: '3px 10px', borderRadius: 3, cursor: 'pointer',
                  letterSpacing: '0.06em',
                }}>PACK CODES</button>
                <button onClick={() => setShowPrePack(true)} style={{
                  fontFamily: FONT, fontSize: 9, color: COLORS.green,
                  background: 'transparent', border: `1px solid ${COLORS.greenDim}`,
                  padding: '3px 10px', borderRadius: 3, cursor: 'pointer',
                  letterSpacing: '0.06em',
                }}>PRE-PACK</button>
              </div>

              {features.packPlan !== false && (
                <div style={{ padding: '6px 0' }}>
                  <PackPlan packLog={(() => {
                    try { return JSON.parse(localStorage.getItem('bc_packlog') || '[]') } catch { return [] }
                  })()} />
                </div>
              )}

              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '6px 0', borderBottom: `1px solid ${COLORS.border}`,
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {Object.entries(PACK_CRITERIA).map(([key, pc]) => (
                      <button key={key} onClick={() => setPackCriteria(key)}
                        title={pc.description}
                        style={{
                          fontFamily: FONT, fontSize: 10, fontWeight: 600,
                          color: packCriteria === key ? COLORS.green : COLORS.text3,
                          background: packCriteria === key ? COLORS.greenDim : 'transparent',
                          border: `1px solid ${packCriteria === key ? COLORS.green : COLORS.border}`,
                          padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
                        }}>
                        {pc.label}
                      </button>
                    ))}
                  </div>
                  {PACK_CRITERIA[packCriteria]?.spec && (
                    <div style={{ fontFamily: FONT, fontSize: 9, color: COLORS.green, letterSpacing: '0.02em' }}>
                      {PACK_CRITERIA[packCriteria].spec}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1 }} />
                {(() => {
                  const td = new Date().toLocaleDateString()
                  const officialCount = history.filter(s => s.dailyPalletNum === dailyPalletNum && s.date === td && !s.isExtra).length
                  const layerNames = { 0: '#1 BOTTOM', 1: '#2 MIDDLE', 2: '#3 TOP' }
                  return (
                    <div style={{ fontFamily: FONT, fontSize: 11, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {officialCount < 3 ? (
                        <span style={{ color: COLORS.green, fontWeight: 600 }}>NEXT: {layerNames[officialCount] || 'SAMPLE'}</span>
                      ) : (
                        <span style={{ color: COLORS.amber, fontWeight: 600 }}>3/3 DONE</span>
                      )}
                      {officialCount < 3 && (
                        <>
                          <button onClick={skipLayer} style={{
                            fontFamily: FONT, fontSize: 9, color: COLORS.text3,
                            background: 'transparent', border: `1px solid ${COLORS.border}`,
                            padding: '3px 8px', borderRadius: 3, cursor: 'pointer',
                          }}>SKIP LAYER</button>
                          <button onClick={skipPallet} style={{
                            fontFamily: FONT, fontSize: 9, color: COLORS.red,
                            background: 'transparent', border: `1px solid ${COLORS.redDim}`,
                            padding: '3px 8px', borderRadius: 3, cursor: 'pointer',
                          }}>MISS PALLET</button>
                        </>
                      )}
                    </div>
                  )
                })()}
              </div>
            </details>

            <ThresholdBars counts={counts} tolerances={GRADING_STANDARDS[gradingStandard].tolerances} />
            <LotSummary lotId={lotId} history={history} />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <ShareButton label="Share QC Data" getSnapshot={() => {
                // Decide what to share: in-progress sample if counts non-zero, else latest sample
                const hasCurrent = (counts.good || counts.permanent || counts.condition || counts.decay) > 0
                const today = new Date().toLocaleDateString()
                const todaySamples = history.filter(s => s.date === today)
                const latestSample = [...todaySamples].reverse().find(s => !s.isSkipped) || history.slice(-1)[0] || null
                const activeSample = hasCurrent
                  ? { ...counts, _sampleMethod: sampleMethod, _gradingStandard: gradingStandard,
                      lotId, dailyPalletNum, packLine, receiptNum, grower, variety, packCriteria,
                      time: new Date().toLocaleTimeString('en-US', { hour12: false }) }
                  : latestSample

                const tol = (activeSample && GRADING_STANDARDS[activeSample._gradingStandard])
                  ? GRADING_STANDARDS[activeSample._gradingStandard].tolerances
                  : GRADING_STANDARDS[gradingStandard].tolerances
                const isBox = activeSample && activeSample._sampleMethod === 'boxweight'
                const gradeResult = (!activeSample || isBox)
                  ? { grade: 'none', label: '—', status: 'none', pctCombined: 0, pctPermanent: 0, pctCondition: 0, pctDecay: 0, total: 0, score: 0 }
                  : gradeSample(activeSample, tol)

                const focusLot = (activeSample?.lotId) || lotId || ''
                const focusPallet = (activeSample?.dailyPalletNum) || dailyPalletNum
                const lotSamples = history.filter(s => s.lotId === focusLot && s.date === today)
                const official = lotSamples.filter(s => !s.isExtra && !s.isSkipped)
                const packLog = JSON.parse(localStorage.getItem('bc_packlog') || '[]')
                const todayLog = packLog.filter(e => e.date === today)

                const boxPayload = isBox ? {
                  weights: activeSample._boxWeights || [],
                  mean: activeSample._boxMean || 0,
                  min: activeSample._boxMin || 0,
                  max: activeSample._boxMax || 0,
                  count: activeSample._boxCount || 0,
                  inSpec: activeSample._boxInSpec || 0,
                  under: activeSample._boxUnder || 0,
                  over: activeSample._boxOver || 0,
                  pctInSpec: activeSample._boxPctInSpec || 0,
                  labelWeight: activeSample._boxLabelWeight || 0,
                  tolerance: activeSample._boxTolerance || 0,
                } : null

                return {
                  type: isBox ? 'box' : 'grade',
                  lotId: focusLot,
                  dailyPalletNum: focusPallet,
                  packLine: activeSample?.packLine || packLine,
                  receiptNum: activeSample?.receiptNum || receiptNum,
                  grower: activeSample?.grower || grower,
                  variety: activeSample?.variety || variety,
                  packCriteria: activeSample?.packCriteria || packCriteria,
                  sampleMethod: activeSample?._sampleMethod || sampleMethod,
                  time: activeSample?.time,
                  grade: gradeResult,
                  box: boxPayload,
                  clamshellNet: activeSample?._clamshellNet,
                  clamshellLabel: activeSample?._clamshellLabel,
                  views: {
                    grade: { grade: gradeResult, box: boxPayload },
                    lotSummary: {
                      lotSummary: {
                        lotId: focusLot,
                        sampleCount: official.length,
                        grade: official.length > 0 ? gradeSample(averageCounts(official), tol) : null,
                        pctCombined: official.length > 0 ? gradeSample(averageCounts(official), tol).pctCombined : 0,
                        samples: [1,2,3].map(n => {
                          const s = lotSamples.find(x => x.sampleNum === n)
                          if (!s) return { layer: ['BTM','MID','TOP'][n-1], isSkipped: true }
                          if (s.isSkipped) return { layer: ['BTM','MID','TOP'][n-1], isSkipped: true }
                          return { layer: ['BTM','MID','TOP'][n-1], grade: gradeSample(s, tol).label }
                        }),
                      },
                    },
                    packLog: {
                      packLog: {
                        entries: todayLog,
                        totalBoxes: todayLog.reduce((s, e) => s + (e.boxes || 0), 0),
                        palletCount: new Set(todayLog.filter(e => !e.isMissed).map(e => e.dailyPallet)).size,
                      },
                    },
                  },
                }
              }} />
            </div>
            <SampleHistory history={history} onClear={clearHistory} onEdit={setEditingSample} />
          </div>
        </div>
        )
        })()
      ) : (
        /* ========== OPS MODE ========== */
        <div style={{
          display: 'flex', flexDirection: 'column',
          minHeight: 'calc(100vh - 90px)', overflowY: 'auto',
        }}>
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* ── TODAY ── */}
          <OpsSection title="Today">
            <DayClose onDayReset={() => {
              try { setHistory(JSON.parse(localStorage.getItem('bc_history') || '[]')) } catch {}
            }} />
            <ComplianceLog />
          </OpsSection>

          {/* ── QUALITY ── */}
          <OpsSection title="Quality" actions={[
            features.dcReconcile !== false && { label: 'DC RECON', onClick: () => setShowDCReconcile(true) },
            features.packout !== false && { label: 'PACKOUT', onClick: () => setShowPackout(true) },
            { label: 'ACCURACY', onClick: () => setShowAccuracy(true) },
          ].filter(Boolean)}>
            <SampleHistory history={history} onClear={clearHistory} onEdit={setEditingSample} />
            <LotSummary lotId={lotId} history={history} />
            {(features.speedQuality !== false || features.growerTrends !== false) && (
              <GrowerFilter history={history}>
                {(selectedGrower) => (
                  <>
                    {features.speedQuality !== false && <SpeedQuality history={history} growerFilter={selectedGrower} />}
                    {features.growerTrends !== false && <GrowerTrends history={history} growerFilter={selectedGrower} />}
                  </>
                )}
              </GrowerFilter>
            )}
          </OpsSection>

          {/* ── RECORDS ── */}
          <OpsSection title="Records" actions={[
            { label: 'CHEMICALS', onClick: () => setShowChemicals(true) },
            { label: 'CHEM LOG', onClick: () => setShowChemLog(true) },
            { label: 'CALC', onClick: () => setShowSanitizerCalc(true) },
            features.logManager !== false && { label: 'LOGS', onClick: () => setShowLogManager(true) },
          ].filter(Boolean)}>
          </OpsSection>

          {/* ── PACKING ── */}
          <OpsSection title="Packing" actions={[
            features.receipts !== false && { label: 'RECEIPTS', onClick: () => setShowReceipts(true) },
            features.packLog !== false && { label: 'PACK LOG', onClick: () => setShowPackLog(true) },
          ].filter(Boolean)}>
            {features.lineMonitor !== false && <LineMonitor />}
            {features.opsPanel !== false && (
              <OpsPanel
                berryScore={(() => { const r = gradeSample(counts, GRADING_STANDARDS[gradingStandard].tolerances); return r.score })()}
                history={history}
                lotId={lotId}
              />
            )}
          </OpsSection>

          </div>
        </div>
      )}

      {/* Zone editor overlay */}
      {showZoneEditor && incomingImage && (
        <ZoneEditor
          imageData={incomingImage.data}
          onCounts={onZoneCounts}
          onClose={() => setShowZoneEditor(false)}
        />
      )}

      {/* Accuracy report overlay */}
      {showAccuracy && (
        <AccuracyReport onClose={() => setShowAccuracy(false)} />
      )}

      {/* Log manager overlay */}
      {showLogManager && (
        <LogManager
          history={history}
          onUpdateHistory={(h) => {
            setHistory(h)
            localStorage.setItem('bc_history', JSON.stringify(h))
            serverSave('bc_history', h)
          }}
          onClose={() => setShowLogManager(false)}
        />
      )}

      {/* Pallet tag assign overlay */}
      {showAssignTag && (
        <PalletTagAssign
          history={history}
          onAssign={assignPalletTag}
          onClose={() => setShowAssignTag(false)}
        />
      )}

      {/* Receipt manager overlay */}
      {showReceipts && (
        <ReceiptManager
          onClose={() => setShowReceipts(false)}
          onPrint={() => {
            setShowReceipts(false)
            setShowBarcodeSheet(true)
          }}
        />
      )}

      {/* Barcode sheet overlay */}
      {showBarcodeSheet && (
        <BarcodeSheet onClose={() => setShowBarcodeSheet(false)} />
      )}

      {/* Pack log overlay */}
      {showPackLog && (
        <PackLogViewer onClose={() => setShowPackLog(false)} />
      )}

      {/* Pack code manager overlay */}
      {showPackCodes && (
        <PackCodeManager onClose={() => setShowPackCodes(false)} />
      )}

      {/* Receipt change */}
      {showReceiptChange && (
        <ReceiptChange
          currentReceipt={receiptNum}
          currentGrower={grower}
          onConfirm={handleReceiptChange}
          onCancel={() => setShowReceiptChange(false)}
        />
      )}

      {/* Pallet close-out */}
      {showPalletCloseOut && (
        <PalletCloseOut
          lotId={lotId}
          receiptNum={receiptNum}
          grower={grower}
          packCode={packCode}
          priorReceipts={palletReceipts}
          palletLineStats={palletLineStats}
          onClose={(data) => {
            handlePalletCloseOut(data)
            setPalletReceipts([])
          }}
          onCancel={() => setShowPalletCloseOut(false)}
        />
      )}

      {/* Backup form */}
      {showBackupForm && (
        <BackupForm onClose={() => setShowBackupForm(false)} />
      )}

      {/* Packout report overlay */}
      {showPackout && (
        <PackoutReport onClose={() => setShowPackout(false)} />
      )}

      {/* DC Reconciliation overlay */}
      {showDCReconcile && (
        <DCReconcile onClose={() => setShowDCReconcile(false)} />
      )}

      {/* Pre-pack notes */}
      {showPrePack && (
        <PrePackNotes onClose={() => setShowPrePack(false)} />
      )}

      {/* Feature toggle panel */}
      {showFeatures && (
        <FeaturePanel features={features} setFeatures={setFeatures} onClose={() => setShowFeatures(false)} />
      )}

      {/* Grading guide overlay */}
      {showGradingGuide && (
        <GradingGuide onClose={() => setShowGradingGuide(false)} />
      )}

      {showChemicals && (
        <ChemicalInventory onClose={() => setShowChemicals(false)} />
      )}

      {showChemLog && (
        <ChemicalLog onClose={() => setShowChemLog(false)} />
      )}

      {showSanitizerCalc && (
        <SanitizerCalculator onClose={() => setShowSanitizerCalc(false)} />
      )}

      {showPhoneQR && (
        <PhoneQROverlay onClose={() => setShowPhoneQR(false)} />
      )}

      {pendingZoneCounts && (
        <ZoneConfirm
          image={pendingZoneCounts.image}
          zones={pendingZoneCounts.zones}
          counts={pendingZoneCounts.counts}
          onConfirm={confirmZoneCounts}
          onRedraw={() => { setPendingZoneCounts(null); setShowZoneEditor(true) }}
          onCancel={() => setPendingZoneCounts(null)}
        />
      )}

      {editingSample && (
        editingSample._sampleMethod === 'boxweight' ? (
          <BoxSampleEditor
            sample={editingSample}
            history={history}
            onSave={(patch) => { updateSample(editingSample.id, patch); setEditingSample(null) }}
            onDelete={() => { deleteSample(editingSample.id); setEditingSample(null) }}
            onClose={() => setEditingSample(null)}
          />
        ) : (
          <SampleEditor
            sample={editingSample}
            history={history}
            gradingStandard={gradingStandard}
            onSave={(patch) => { updateSample(editingSample.id, patch); setEditingSample(null) }}
            onDelete={() => { deleteSample(editingSample.id); setEditingSample(null) }}
            onClose={() => setEditingSample(null)}
          />
        )
      )}

      {/* QCer Mode wizard — full-screen takeover when enabled. State hooks above
          continue to run, so toggling off restores the dashboard with no data loss. */}
      {qcerMode && (
        <QCerWizard
          dailyPalletNum={dailyPalletNum} setDailyPalletNum={setDailyPalletNum}
          lotId={lotId} setLotId={setLotId}
          packCode={packCode} setPackCode={setPackCode}
          packCodeDB={packCodeDB} packFavorites={packFavorites}
          dualLineMode={dualLineMode} activeLine={activeLine} switchLine={switchLine}
          onExit={toggleQcerMode}
        />
      )}

    </div>
  )
}

function PalletLayers({ dailyPalletNum, history, gradingStandard, onSkipToLayer, onUnskipLayer, onEditSample, compact, onToggleCompact }) {
  const layers = [3, 2, 1] // display top to bottom
  const layerNames = { 1: 'BOTTOM', 2: 'MIDDLE', 3: 'TOP' }
  // Correlate with today's daily pallet # — pallet tag can be blank while layers show
  const today = new Date().toLocaleDateString()
  const lotSamples = history.filter(s =>
    s.dailyPalletNum === dailyPalletNum &&
    s.date === today &&
    !s.isExtra
  )

  const layerState = (n) => {
    const sample = lotSamples.find(s => s.sampleNum === n)
    if (!sample) return { state: 'empty', sample: null }
    if (sample.isSkipped) return { state: 'skipped', sample }
    return { state: 'sampled', sample }
  }

  // NEXT = lowest-numbered empty layer (handles out-of-order states)
  const nextLayer = [1, 2, 3].find(n => layerState(n).state === 'empty') || null

  const renderLayer = (n) => {
    const { state, sample } = layerState(n)
    const isNext = n === nextLayer
    let label, bg, textColor, borderColor, indicator, title, onClick

    if (state === 'sampled') {
      const result = gradeSample(sample, (GRADING_STANDARDS[sample._gradingStandard] || GRADING_STANDARDS[gradingStandard] || GRADING_STANDARDS.mbg).tolerances)
      const gradeColor = result.status === 'excellent' || result.status === 'ok' ? COLORS.green
        : result.status === 'warn' ? COLORS.amber
        : result.status === 'fail' ? COLORS.red
        : COLORS.text3
      label = result.label
      bg = gradeColor + '18'
      textColor = gradeColor
      borderColor = gradeColor + '60'
      indicator = '●'
      title = `Layer #${n} ${layerNames[n]} — ${result.label} — tap to edit or reassign`
      onClick = () => onEditSample && onEditSample(sample)
    } else if (state === 'skipped') {
      label = 'SKIP'
      bg = COLORS.bg3
      textColor = COLORS.text3
      borderColor = COLORS.border
      indicator = '✕'
      title = `Layer #${n} ${layerNames[n]} skipped — tap to undo`
      onClick = () => onUnskipLayer(n)
    } else {
      label = isNext ? 'NEXT' : 'TAP'
      bg = isNext ? COLORS.green + '15' : COLORS.bg
      textColor = isNext ? COLORS.green : COLORS.text3
      borderColor = isNext ? COLORS.green : COLORS.border
      indicator = isNext ? '▸' : ''
      title = `Tap to sample layer #${n} ${layerNames[n]}${!isNext ? ' (skips earlier empty layers)' : ''}`
      onClick = () => onSkipToLayer(n)
    }

    if (compact) {
      // Flat menu — short pills in a vertical stack with abbreviated labels
      return (
        <button
          key={n}
          type="button"
          disabled={!onClick}
          onClick={onClick || undefined}
          title={title}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 4, padding: '4px 8px',
            background: bg, color: textColor,
            border: `1px solid ${borderColor}`,
            borderRadius: 3,
            fontFamily: FONT, fontSize: 10, fontWeight: 700,
            letterSpacing: '0.04em',
            cursor: onClick ? 'pointer' : 'default',
            width: '100%',
            textDecoration: state === 'skipped' ? 'line-through' : 'none',
          }}
        >
          <span style={{ opacity: 0.7, fontSize: 9 }}>#{n}</span>
          <span style={{ fontWeight: 800, textDecoration: 'none', fontSize: 11 }}>
            {indicator && <span style={{ marginRight: 3 }}>{indicator}</span>}
            {label}
          </span>
        </button>
      )
    }

    // Illustrative — bigger, with full layer name
    return (
      <button
        key={n}
        type="button"
        disabled={!onClick}
        onClick={onClick || undefined}
        title={title}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 8, padding: '8px 12px',
          background: bg, color: textColor,
          border: `1px solid ${borderColor}`,
          borderRadius: 4,
          fontFamily: FONT, fontSize: 10, fontWeight: 700,
          letterSpacing: '0.04em',
          cursor: onClick ? 'pointer' : 'default',
          width: '100%',
          textDecoration: state === 'skipped' ? 'line-through' : 'none',
        }}
      >
        <span style={{ opacity: 0.85, fontSize: 9, letterSpacing: '0.06em' }}>#{n} {layerNames[n]}</span>
        <span style={{ fontWeight: 800, textDecoration: 'none', fontSize: 12 }}>
          {indicator && <span style={{ marginRight: 4 }}>{indicator}</span>}
          {label}
        </span>
      </button>
    )
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: compact ? 2 : 4,
      width: '100%', position: 'relative',
    }}>
      {layers.map(renderLayer)}
      {onToggleCompact && (
        <button
          type="button"
          onClick={onToggleCompact}
          title={compact ? 'Switch to illustrative layout' : 'Switch to flat menu layout'}
          style={{
            position: 'absolute', top: -4, right: -4,
            width: 16, height: 16, padding: 0,
            background: COLORS.bg2, color: COLORS.text3,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 3, cursor: 'pointer',
            fontFamily: FONT, fontSize: 9, lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >{compact ? '☷' : '≡'}</button>
      )}
    </div>
  )
}

function BoxSampleEditor({ sample, history, onSave, onDelete, onClose }) {
  const [dailyPalletNum, setDailyPalletNum] = React.useState(sample.dailyPalletNum || 1)
  const [packLine, setPackLine] = React.useState(sample.packLine || '')
  const [lotId, setLotId] = React.useState(sample.lotId || '')
  const [weights, setWeights] = React.useState(
    Array.isArray(sample._boxWeights) ? [...sample._boxWeights] : []
  )
  const [labelWeight, setLabelWeight] = React.useState(sample._boxLabelWeight || 302)
  const [tolerance, setTolerance] = React.useState(sample._boxTolerance || 5)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [newWeight, setNewWeight] = React.useState('')

  // Recompute stats live using pack-tolerance rules (green/yellow/red)
  const rules = React.useMemo(() => loadPackTolerance(), [])
  const count = weights.length
  const mean = count > 0 ? weights.reduce((a, b) => a + b, 0) / count : 0
  const min = count > 0 ? Math.min(...weights) : 0
  const max = count > 0 ? Math.max(...weights) : 0
  const classes = weights.map(w => classifyWeight(w, labelWeight, rules))
  const inSpec = classes.filter(c => c === 'green').length
  const under = weights.filter(w => w < labelWeight - labelWeight * rules.greenPct / 100).length
  const over = classes.filter(c => c === 'red').length
  const pctInSpec = count > 0 ? (inSpec / count) * 100 : 0
  const passColor = pctInSpec >= 95 ? COLORS.green : pctInSpec >= 85 ? COLORS.amber : COLORS.red
  const passLabel = count === 0 ? '—' : pctInSpec >= 95 ? 'PASS' : pctInSpec >= 85 ? 'BORDERLINE' : 'FAIL'
  const accent = (sample._sampleMethod === 'boxweight' && labelWeight > 450) ? '#EA580C' : '#1E40AF'

  const addWeight = () => {
    const n = parseFloat(newWeight)
    if (!n || n <= 0) return
    setWeights([...weights, n])
    setNewWeight('')
  }
  const removeWeightAt = (idx) => setWeights(weights.filter((_, i) => i !== idx))
  const editWeightAt = (idx, val) => {
    const n = parseFloat(val)
    setWeights(weights.map((w, i) => i === idx ? (isNaN(n) ? 0 : n) : w))
  }

  const save = () => {
    onSave({
      dailyPalletNum: parseInt(dailyPalletNum) || 1,
      packLine,
      lotId,
      _boxWeights: weights,
      _boxLabelWeight: labelWeight,
      _boxTolerance: tolerance,
      _boxCount: count,
      _boxMean: mean,
      _boxMin: min,
      _boxMax: max,
      _boxInSpec: inSpec,
      _boxUnder: under,
      _boxOver: over,
      _boxPctInSpec: pctInSpec,
    })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 3000,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 10, padding: 20,
        maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto',
        border: `2px solid ${accent}`,
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
        }}>
          <div>
            <div style={{
              fontFamily: FONT, fontSize: 14, fontWeight: 800, color: COLORS.text,
              letterSpacing: '0.04em',
            }}>Edit Box Sample</div>
            <div style={{
              fontFamily: FONT, fontSize: 10, color: COLORS.text3, marginTop: 2,
            }}>
              {sample.date} · {sample.time} · id {String(sample.id).slice(-6)}
            </div>
          </div>
          <div style={{
            fontFamily: FONT, fontSize: 16, fontWeight: 800, color: passColor,
            padding: '4px 12px', borderRadius: 4,
            background: passColor + '15', border: `1px solid ${passColor}60`,
          }}>{passLabel}{count > 0 ? ` ${pctInSpec.toFixed(0)}%` : ''}</div>
        </div>

        {/* Reassign — PRIMARY USE */}
        <div style={{
          padding: 12, marginBottom: 12,
          background: accent + '08', border: `2px solid ${accent}`, borderRadius: 6,
        }}>
          <div style={{
            fontFamily: FONT, fontSize: 10, fontWeight: 700, color: accent,
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
          }}>Reassign Line / Pallet</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
            <label style={{ flex: 1, fontFamily: FONT, fontSize: 10, color: COLORS.text3 }}>
              Daily Pallet #
              <input type="number" min="1" value={dailyPalletNum}
                onChange={e => setDailyPalletNum(e.target.value)}
                style={{
                  display: 'block', width: '100%', marginTop: 3, padding: '8px 10px',
                  fontFamily: FONT, fontSize: 20, fontWeight: 800, color: accent,
                  border: `1px solid ${accent}60`, borderRadius: 4, outline: 'none',
                  boxSizing: 'border-box', background: '#fff',
                }}
              />
            </label>
            <label style={{ flex: 1, fontFamily: FONT, fontSize: 10, color: COLORS.text3 }}>
              Line
              <input value={packLine}
                onChange={e => setPackLine(e.target.value)}
                placeholder="1 / 2 / name"
                style={{
                  display: 'block', width: '100%', marginTop: 3, padding: '8px 10px',
                  fontFamily: FONT, fontSize: 18, fontWeight: 700, color: COLORS.text,
                  border: `1px solid ${accent}60`, borderRadius: 4, outline: 'none',
                  boxSizing: 'border-box', background: '#fff',
                }}
              />
            </label>
          </div>
          <label style={{ fontFamily: FONT, fontSize: 10, color: COLORS.text3 }}>
            Pallet Tag (optional)
            <input value={lotId} onChange={e => setLotId(e.target.value)}
              placeholder="scan or type"
              style={{
                display: 'block', width: '100%', marginTop: 3, padding: '6px 8px',
                fontFamily: FONT, fontSize: 13, color: COLORS.text,
                border: `1px solid ${COLORS.border}`, borderRadius: 3, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </label>
        </div>

        {/* Spec settings */}
        <div style={{
          padding: 10, marginBottom: 12,
          background: COLORS.bg2, border: `1px solid ${COLORS.border}`, borderRadius: 4,
          display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <label style={{ fontFamily: FONT, fontSize: 10, color: COLORS.text3 }}>
            Label (g)
            <input type="number" min="0" value={labelWeight}
              onChange={e => setLabelWeight(parseFloat(e.target.value) || 0)}
              style={{
                display: 'block', marginTop: 3, padding: '4px 8px', width: 70,
                fontFamily: FONT, fontSize: 14, fontWeight: 700, color: accent,
                border: `1px solid ${accent}60`, borderRadius: 3, outline: 'none',
              }}
            />
          </label>
          <label style={{ fontFamily: FONT, fontSize: 10, color: COLORS.text3 }}>
            Tolerance ±(g)
            <input type="number" min="0" step="0.1" value={tolerance}
              onChange={e => setTolerance(parseFloat(e.target.value) || 0)}
              style={{
                display: 'block', marginTop: 3, padding: '4px 8px', width: 60,
                fontFamily: FONT, fontSize: 14, fontWeight: 700, color: COLORS.text,
                border: `1px solid ${COLORS.border2}`, borderRadius: 3, outline: 'none',
              }}
            />
          </label>
          <div style={{ flex: 1 }} />
          <div style={{ fontFamily: FONT, fontSize: 10, color: COLORS.text3 }}>
            μ <b style={{ color: COLORS.text }}>{mean.toFixed(1)}g</b>
            {'  '}N <b style={{ color: COLORS.text }}>{count}</b>
            {under > 0 && <span>{'  '}↓<b style={{ color: COLORS.red }}>{under}</b></span>}
            {over > 0 && <span>{'  '}↑<b style={{ color: COLORS.amber }}>{over}</b></span>}
          </div>
        </div>

        {/* Weight list — edit individual entries */}
        <div style={{ marginBottom: 12 }}>
          <div style={{
            fontFamily: FONT, fontSize: 10, fontWeight: 700, color: COLORS.text3,
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            Weights
            <span style={{ color: COLORS.text3, fontWeight: 400, textTransform: 'none' }}>
              edit or remove any entry
            </span>
          </div>
          <div style={{
            maxHeight: 200, overflowY: 'auto',
            border: `1px solid ${COLORS.border}`, borderRadius: 4,
          }}>
            {weights.length === 0 ? (
              <div style={{
                padding: 12, textAlign: 'center',
                fontFamily: FONT, fontSize: 10, color: COLORS.text3,
              }}>No weights in this box sample</div>
            ) : weights.map((w, i) => {
              const cls = classifyWeight(w, labelWeight, rules)
              const isUnder = w < labelWeight - labelWeight * rules.greenPct / 100
              const c = CLASS_COLORS[cls]
              const inSp = cls === 'green'
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 8px',
                  borderBottom: i < weights.length - 1 ? `1px solid ${COLORS.border}` : 'none',
                  background: i % 2 === 0 ? COLORS.bg : COLORS.bg2,
                }}>
                  <span style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3, width: 24 }}>#{i + 1}</span>
                  <input type="number" min="0" step="0.1" value={w}
                    onChange={e => editWeightAt(i, e.target.value)}
                    style={{
                      fontFamily: FONT, fontSize: 12, fontWeight: 700, color: c,
                      background: '#fff', border: `1px solid ${c}40`,
                      borderRadius: 3, padding: '3px 6px', width: 80, outline: 'none',
                    }}
                  />
                  <span style={{ fontFamily: FONT, fontSize: 9, color: c, letterSpacing: '0.04em', fontWeight: 600 }}>
                    {inSp ? 'IN SPEC' : isUnder ? 'UNDER' : 'OVER'}
                  </span>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => removeWeightAt(i)} style={{
                    fontFamily: FONT, fontSize: 9, color: COLORS.red,
                    background: 'transparent', border: `1px solid ${COLORS.red}40`,
                    padding: '2px 8px', borderRadius: 2, cursor: 'pointer',
                  }}>×</button>
                </div>
              )
            })}
          </div>
          {/* Add more */}
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <input type="number" min="0" step="0.1" value={newWeight}
              onChange={e => setNewWeight(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addWeight() }}
              placeholder="add weight (g)"
              style={{
                flex: 1, padding: '6px 10px',
                fontFamily: FONT, fontSize: 13, color: COLORS.text,
                border: `1px solid ${accent}60`, borderRadius: 3, outline: 'none',
              }}
            />
            <button onClick={addWeight} style={{
              fontFamily: FONT, fontSize: 10, fontWeight: 700, color: '#fff',
              background: accent, border: 'none',
              padding: '6px 14px', borderRadius: 3, cursor: 'pointer',
              letterSpacing: '0.06em',
            }}>+ ADD</button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} style={{
              fontFamily: FONT, fontSize: 10, fontWeight: 600, color: COLORS.red,
              background: 'transparent', border: `1px solid ${COLORS.red}60`,
              padding: '8px 14px', borderRadius: 4, cursor: 'pointer',
              letterSpacing: '0.06em',
            }}>DELETE BOX SAMPLE</button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: FONT, fontSize: 10, color: COLORS.red, fontWeight: 600 }}>Sure?</span>
              <button onClick={onDelete} style={{
                fontFamily: FONT, fontSize: 10, fontWeight: 700, color: '#fff',
                background: COLORS.red, border: 'none',
                padding: '6px 12px', borderRadius: 3, cursor: 'pointer',
              }}>YES DELETE</button>
              <button onClick={() => setConfirmDelete(false)} style={{
                fontFamily: FONT, fontSize: 10, color: COLORS.text3,
                background: 'transparent', border: `1px solid ${COLORS.border}`,
                padding: '6px 10px', borderRadius: 3, cursor: 'pointer',
              }}>NO</button>
            </div>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{
            fontFamily: FONT, fontSize: 11, color: COLORS.text2,
            background: 'transparent', border: `1px solid ${COLORS.border}`,
            padding: '8px 16px', borderRadius: 4, cursor: 'pointer',
          }}>CANCEL</button>
          <button onClick={save} style={{
            fontFamily: FONT, fontSize: 11, fontWeight: 700, color: '#fff',
            background: accent, border: 'none',
            padding: '8px 18px', borderRadius: 4, cursor: 'pointer',
            letterSpacing: '0.06em',
          }}>SAVE</button>
        </div>
      </div>
    </div>
  )
}

function BoxWeightEntry({ weights, setWeights, tolerance, setTolerance, activeMethod, onSetMethod, onSave, onCancel }) {
  const [entry, setEntry] = React.useState('')
  const inputRef = React.useRef(null)

  // Load enabled methods + customs so QCer can swap pack types inside box mode
  const customMethods = React.useMemo(() => {
    try { return JSON.parse(localStorage.getItem('bc_custom_methods') || '[]') } catch { return [] }
  }, [])
  const enabledMethods = React.useMemo(() => {
    try {
      const raw = localStorage.getItem('bc_enabled_methods')
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  }, [])
  // Box mode — one chip per physical pack. Keys map to the 30-berry methods
  // so the pack banner picks up the same blue/orange theme as regular sampling.
  const BUILTIN_PACKS = [
    { key: 'pint30', label: 'PINT', labelWeight: 302, color: '#1E40AF' },
    { key: '18oz30', label: '18OZ', labelWeight: 518, color: '#EA580C' },
    { key: 'mightyblue30', label: 'MIGHTY BLUE', labelWeight: 282, color: '#0891B2' },
  ]
  const customPacks = customMethods.map(c => ({
    key: c.key, label: c.label.toUpperCase(), labelWeight: c.labelWeight, color: c.color || '#DB2777',
  }))
  const allPacks = [...BUILTIN_PACKS, ...customPacks]
  const visiblePacks = enabledMethods === null ? allPacks : allPacks.filter(p => enabledMethods.includes(p.key))
  const activePack = allPacks.find(p => p.key === activeMethod) || BUILTIN_PACKS[0]
  const accent = activePack.color

  // Label weight auto-updates when pack changes; still manually editable
  const [labelWeight, setLabelWeight] = React.useState(activePack.labelWeight)
  React.useEffect(() => { setLabelWeight(activePack.labelWeight) }, [activeMethod])

  const addWeight = () => {
    const n = parseFloat(entry)
    if (!n || n <= 0) return
    setWeights([...weights, n])
    setEntry('')
    if (inputRef.current) inputRef.current.focus()
  }

  const removeWeight = (idx) => {
    setWeights(weights.filter((_, i) => i !== idx))
  }

  const rules = React.useMemo(() => loadPackTolerance(), [])
  const count = weights.length
  const mean = count > 0 ? weights.reduce((a, b) => a + b, 0) / count : 0
  const min = count > 0 ? Math.min(...weights) : 0
  const max = count > 0 ? Math.max(...weights) : 0
  const classes = weights.map(w => classifyWeight(w, labelWeight, rules))
  const inSpec = classes.filter(c => c === 'green').length
  const under = weights.filter(w => w < labelWeight - labelWeight * rules.greenPct / 100).length
  const over = classes.filter(c => c === 'red').length
  const pctInSpec = count > 0 ? (inSpec / count) * 100 : 0
  const passColor = pctInSpec >= 95 ? COLORS.green : pctInSpec >= 85 ? COLORS.amber : COLORS.red
  const passLabel = count === 0 ? '—' : pctInSpec >= 95 ? 'PASS' : pctInSpec >= 85 ? 'BORDERLINE' : 'FAIL'

  return (
    <div style={{ padding: '12px 16px' }}>
      {/* Pack type picker — match regular sampling so QCer knows which pack */}
      {visiblePacks.length > 1 && onSetMethod && (
        <div style={{
          display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap',
          padding: '8px 10px',
          background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
          borderRadius: 6,
        }}>
          <span style={{
            fontFamily: FONT, fontSize: 9, fontWeight: 700, color: COLORS.text3,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            alignSelf: 'center',
          }}>Pack Type</span>
          {visiblePacks.map(p => {
            const on = p.key === activeMethod
            return (
              <button key={p.key} onClick={() => onSetMethod(p.key)} style={{
                fontFamily: FONT, fontSize: 10, fontWeight: 800,
                color: on ? '#fff' : p.color,
                background: on ? p.color : p.color + '12',
                border: `1px solid ${p.color}`,
                padding: '5px 12px', borderRadius: 4, cursor: 'pointer',
                letterSpacing: '0.06em',
              }}>
                {p.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Config row: label target + rule summary — themed to active pack */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
        padding: '10px 12px',
        background: COLORS.bg, border: `2px solid ${accent}`, borderRadius: 6,
      }}>
        <label style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3 }}>
          Label Target (g)
          <input type="number" min="0" step="1" value={labelWeight}
            onChange={e => setLabelWeight(parseFloat(e.target.value) || 0)}
            style={{
              display: 'block', marginTop: 3, padding: '4px 8px', width: 80,
              fontFamily: FONT, fontSize: 18, fontWeight: 800, color: accent,
              border: `1px solid ${accent}60`, background: accent + '12',
              borderRadius: 3, outline: 'none',
            }}
          />
        </label>
        <div style={{ flex: 1 }} />
        <div style={{
          fontFamily: FONT, fontSize: 10, color: COLORS.text3, textAlign: 'right', lineHeight: 1.4,
        }}>
          <span style={{ color: COLORS.green, fontWeight: 700 }}>Green</span> ±{rules.greenPct}%
          {' · '}
          <span style={{ color: COLORS.amber, fontWeight: 700 }}>Yellow</span> up to +{rules.yellowOverG}g
          {' · '}
          <span style={{ color: COLORS.red, fontWeight: 700 }}>Red</span> over +{rules.yellowOverG}g<br />
          <span style={{ color: COLORS.text3, fontSize: 9 }}>
            Green zone: {(labelWeight - labelWeight * rules.greenPct / 100).toFixed(1)}g – {(labelWeight + labelWeight * rules.greenPct / 100).toFixed(1)}g
          </span>
        </div>
      </div>

      {/* Weight entry — themed */}
      <div style={{
        display: 'flex', alignItems: 'stretch', gap: 8, marginBottom: 10,
      }}>
        <input
          ref={inputRef}
          type="number" min="0" step="0.1"
          value={entry}
          onChange={e => setEntry(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addWeight() }}
          placeholder="weight (g)"
          autoFocus
          style={{
            flex: 1, padding: '12px 14px',
            fontFamily: FONT, fontSize: 24, fontWeight: 800, color: COLORS.text,
            border: `2px solid ${accent}`, borderRadius: 6, outline: 'none',
          }}
        />
        <button onClick={addWeight} style={{
          fontFamily: FONT, fontSize: 13, fontWeight: 800, color: '#fff',
          background: accent, border: 'none',
          padding: '0 22px', borderRadius: 6, cursor: 'pointer',
          letterSpacing: '0.08em',
        }}>+ ADD</button>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6,
        marginBottom: 10,
      }}>
        {[
          { k: 'N', v: count, c: COLORS.text },
          { k: 'Mean', v: count ? mean.toFixed(1) + 'g' : '—', c: COLORS.text },
          { k: 'Min', v: count ? min.toFixed(1) + 'g' : '—', c: COLORS.text2 },
          { k: 'Max', v: count ? max.toFixed(1) + 'g' : '—', c: COLORS.text2 },
          { k: 'Under', v: under, c: under > 0 ? COLORS.red : COLORS.text3 },
          { k: 'Over', v: over, c: over > 0 ? COLORS.amber : COLORS.text3 },
        ].map(s => (
          <div key={s.k} style={{
            background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
            borderRadius: 4, padding: '6px 8px', textAlign: 'center',
          }}>
            <div style={{ fontFamily: FONT, fontSize: 15, fontWeight: 800, color: s.c }}>{s.v}</div>
            <div style={{ fontFamily: FONT, fontSize: 8, color: COLORS.text3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{s.k}</div>
          </div>
        ))}
      </div>

      {/* Pass/fail summary */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px', marginBottom: 10,
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
        }}>{count > 0 ? `${inSpec}/${count} in spec (${pctInSpec.toFixed(1)}%)` : 'Add weights to begin'}</div>
      </div>

      {/* Weight list */}
      {count > 0 && (
        <div style={{
          maxHeight: 180, overflowY: 'auto',
          border: `1px solid ${COLORS.border}`, borderRadius: 4,
          marginBottom: 10,
        }}>
          {weights.map((w, i) => {
            const cls = classifyWeight(w, labelWeight, rules)
            const isUnder = w < labelWeight - labelWeight * rules.greenPct / 100
            const c = CLASS_COLORS[cls]
            const inSp = cls === 'green'
            const dev = w - labelWeight
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px',
                borderBottom: i < weights.length - 1 ? `1px solid ${COLORS.border}` : 'none',
                background: i % 2 === 0 ? COLORS.bg : COLORS.bg2,
              }}>
                <span style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3, width: 22 }}>#{i + 1}</span>
                <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: c, width: 64 }}>{w.toFixed(1)}g</span>
                <span style={{ fontFamily: FONT, fontSize: 9, color: c, letterSpacing: '0.04em', fontWeight: 600 }}>
                  {inSp ? 'IN SPEC' : `${isUnder ? 'UNDER' : 'OVER'} ${dev >= 0 ? '+' : ''}${dev.toFixed(1)}g`}
                </span>
                <div style={{ flex: 1 }} />
                <button onClick={() => removeWeight(i)} style={{
                  fontFamily: FONT, fontSize: 8, color: COLORS.text3,
                  background: 'transparent', border: `1px solid ${COLORS.border}`,
                  padding: '1px 6px', borderRadius: 2, cursor: 'pointer',
                }}>×</button>
              </div>
            )
          })}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} style={{
          flex: 1, background: COLORS.bg3,
          border: `1px solid ${COLORS.border2}`, color: COLORS.text3,
          fontFamily: FONT, fontSize: 11, fontWeight: 600,
          letterSpacing: '0.06em', textTransform: 'uppercase',
          padding: 12, borderRadius: 4, cursor: 'pointer',
        }}>CANCEL</button>
        <button onClick={() => onSave(labelWeight, rules.yellowOverG)}
          disabled={count === 0}
          style={{
            flex: 2, background: count === 0 ? '#ccc' : accent + '20',
            border: `2px solid ${count === 0 ? COLORS.border2 : accent}`,
            color: count === 0 ? COLORS.text3 : accent,
            fontFamily: FONT, fontSize: 14, fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            padding: 12, borderRadius: 4,
            cursor: count === 0 ? 'not-allowed' : 'pointer',
          }}>SAVE BOX ({count})</button>
      </div>
    </div>
  )
}

function SampleEditor({ sample, history, gradingStandard, onSave, onDelete, onClose }) {
  const [dailyPalletNum, setDailyPalletNum] = React.useState(sample.dailyPalletNum || 1)
  const [sampleNum, setSampleNum] = React.useState(sample.sampleNum || 1)
  const [lotId, setLotId] = React.useState(sample.lotId || '')
  const [good, setGood] = React.useState(sample.good || 0)
  const [permanent, setPermanent] = React.useState(sample.permanent || 0)
  const [condition, setCondition] = React.useState(sample.condition || 0)
  const [decay, setDecay] = React.useState(sample.decay || 0)
  const [confirmDelete, setConfirmDelete] = React.useState(false)

  const currentResult = gradeSample({ good, permanent, condition, decay },
    (GRADING_STANDARDS[sample._gradingStandard] || GRADING_STANDARDS[gradingStandard] || GRADING_STANDARDS.mbg).tolerances)
  const currentColor = currentResult.status === 'excellent' || currentResult.status === 'ok' ? COLORS.green
    : currentResult.status === 'warn' ? COLORS.amber
    : currentResult.status === 'fail' ? COLORS.red : COLORS.text3

  const layerNames = { 1: '#1 BOTTOM', 2: '#2 MIDDLE', 3: '#3 TOP' }

  const save = () => {
    onSave({
      dailyPalletNum: parseInt(dailyPalletNum) || 1,
      sampleNum: parseInt(sampleNum) || 1,
      lotId,
      good: parseInt(good) || 0,
      permanent: parseInt(permanent) || 0,
      condition: parseInt(condition) || 0,
      decay: parseInt(decay) || 0,
    })
  }

  // Warn if reassignment would collide with an existing sample
  const collision = history.find(s =>
    s.id !== sample.id &&
    s.dailyPalletNum === parseInt(dailyPalletNum) &&
    s.sampleNum === parseInt(sampleNum) &&
    s.date === sample.date &&
    !s.isExtra
  )

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 3000,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 10, padding: 20,
        maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto',
        border: `2px solid ${currentColor}`,
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
        }}>
          <div>
            <div style={{
              fontFamily: FONT, fontSize: 14, fontWeight: 800, color: COLORS.text,
              letterSpacing: '0.04em',
            }}>Edit Sample</div>
            <div style={{
              fontFamily: FONT, fontSize: 10, color: COLORS.text3, marginTop: 2,
            }}>
              {sample.date} · {sample.time} · id {String(sample.id).slice(-6)}
            </div>
          </div>
          <div style={{
            fontFamily: FONT, fontSize: 18, fontWeight: 800, color: currentColor,
            padding: '4px 12px', borderRadius: 4,
            background: currentColor + '15', border: `1px solid ${currentColor}60`,
          }}>{currentResult.label}</div>
        </div>

        {/* Reassign pallet + layer */}
        <div style={{
          padding: 12, marginBottom: 12,
          background: COLORS.bg2, border: `1px solid ${COLORS.border2}`, borderRadius: 4,
        }}>
          <div style={{
            fontFamily: FONT, fontSize: 10, fontWeight: 700, color: COLORS.text,
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
          }}>Reassign</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
            <label style={{ flex: 1, fontFamily: FONT, fontSize: 10, color: COLORS.text3 }}>
              Daily Pallet #
              <input type="number" min="1" value={dailyPalletNum}
                onChange={e => setDailyPalletNum(e.target.value)}
                style={{
                  display: 'block', width: '100%', marginTop: 3, padding: '6px 8px',
                  fontFamily: FONT, fontSize: 16, fontWeight: 700, color: COLORS.text,
                  border: `1px solid ${COLORS.border2}`, borderRadius: 3, outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </label>
            <label style={{ flex: 1, fontFamily: FONT, fontSize: 10, color: COLORS.text3 }}>
              Layer
              <select value={sampleNum} onChange={e => setSampleNum(parseInt(e.target.value))}
                style={{
                  display: 'block', width: '100%', marginTop: 3, padding: '6px 8px',
                  fontFamily: FONT, fontSize: 13, fontWeight: 700, color: COLORS.text,
                  border: `1px solid ${COLORS.border2}`, borderRadius: 3, outline: 'none',
                  boxSizing: 'border-box', background: '#fff',
                }}>
                <option value={1}>{layerNames[1]}</option>
                <option value={2}>{layerNames[2]}</option>
                <option value={3}>{layerNames[3]}</option>
              </select>
            </label>
          </div>
          <label style={{ fontFamily: FONT, fontSize: 10, color: COLORS.text3 }}>
            Pallet Tag (optional)
            <input value={lotId} onChange={e => setLotId(e.target.value)}
              placeholder="scan or type"
              style={{
                display: 'block', width: '100%', marginTop: 3, padding: '6px 8px',
                fontFamily: FONT, fontSize: 13, color: COLORS.text,
                border: `1px solid ${COLORS.border}`, borderRadius: 3, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </label>
          {collision && (
            <div style={{
              marginTop: 8, padding: '6px 8px',
              background: COLORS.amberDim, border: `1px solid ${COLORS.amber}`,
              borderRadius: 3, fontFamily: FONT, fontSize: 10, color: COLORS.amber,
              fontWeight: 600,
            }}>
              ⚠ Pallet #{dailyPalletNum} layer {sampleNum} already has a sample. Save anyway?
            </div>
          )}
        </div>

        {/* Defect counts (quick 3-pile edit) */}
        <div style={{
          padding: 12, marginBottom: 12,
          background: COLORS.bg2, border: `1px solid ${COLORS.border2}`, borderRadius: 4,
        }}>
          <div style={{
            fontFamily: FONT, fontSize: 10, fontWeight: 700, color: COLORS.text,
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
          }}>Counts (3-pile)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
            {[
              { label: 'Good', val: good, set: setGood, color: COLORS.green },
              { label: 'Perm', val: permanent, set: setPermanent, color: COLORS.amber },
              { label: 'Cond', val: condition, set: setCondition, color: '#D85A30' },
              { label: 'Decay', val: decay, set: setDecay, color: COLORS.red },
            ].map(f => (
              <label key={f.label} style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3 }}>
                {f.label}
                <input type="number" min="0" value={f.val}
                  onChange={e => f.set(parseInt(e.target.value) || 0)}
                  style={{
                    display: 'block', width: '100%', marginTop: 3, padding: '6px 8px',
                    fontFamily: FONT, fontSize: 18, fontWeight: 700, color: f.color,
                    border: `1px solid ${COLORS.border2}`, borderRadius: 3, outline: 'none',
                    boxSizing: 'border-box', background: '#fff',
                  }}
                />
              </label>
            ))}
          </div>
          <div style={{
            marginTop: 8, fontFamily: FONT, fontSize: 10, color: COLORS.text3,
          }}>
            Note: editing here overrides per-defect detail (stems/shrivel/etc.) with 3-pile totals.
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} style={{
              fontFamily: FONT, fontSize: 10, fontWeight: 600, color: COLORS.red,
              background: 'transparent', border: `1px solid ${COLORS.red}60`,
              padding: '8px 14px', borderRadius: 4, cursor: 'pointer',
              letterSpacing: '0.06em',
            }}>DELETE SAMPLE</button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: FONT, fontSize: 10, color: COLORS.red, fontWeight: 600 }}>Sure?</span>
              <button onClick={onDelete} style={{
                fontFamily: FONT, fontSize: 10, fontWeight: 700, color: '#fff',
                background: COLORS.red, border: 'none',
                padding: '6px 12px', borderRadius: 3, cursor: 'pointer',
              }}>YES DELETE</button>
              <button onClick={() => setConfirmDelete(false)} style={{
                fontFamily: FONT, fontSize: 10, color: COLORS.text3,
                background: 'transparent', border: `1px solid ${COLORS.border}`,
                padding: '6px 10px', borderRadius: 3, cursor: 'pointer',
              }}>NO</button>
            </div>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{
            fontFamily: FONT, fontSize: 11, color: COLORS.text2,
            background: 'transparent', border: `1px solid ${COLORS.border}`,
            padding: '8px 16px', borderRadius: 4, cursor: 'pointer',
          }}>CANCEL</button>
          <button onClick={save} style={{
            fontFamily: FONT, fontSize: 11, fontWeight: 700, color: '#fff',
            background: COLORS.green, border: 'none',
            padding: '8px 18px', borderRadius: 4, cursor: 'pointer',
            letterSpacing: '0.06em',
          }}>SAVE</button>
        </div>
      </div>
    </div>
  )
}

function LineSwitcher({ activeLine, lotId, counts, onSwitch }) {
  const readSlot = (key) => {
    try { return JSON.parse(localStorage.getItem(`bc_slot_${key}`) || '{}') } catch { return {} }
  }
  const slot1 = readSlot('line1')
  const slot2 = readSlot('line2')

  const renderBtn = (k, label, slot) => {
    const active = activeLine === k
    const effLotId = active ? lotId : (slot.lotId || '')
    const effCounts = active ? counts : (slot.counts || {})
    const hasWork = !!(effLotId || effCounts.permanent || effCounts.condition || effCounts.decay)
    const subtitle = effLotId || (hasWork ? 'in progress' : 'empty')
    return (
      <button
        key={k}
        type="button"
        onClick={() => onSwitch(k)}
        style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          padding: '10px 10px',
          background: active ? COLORS.green : (hasWork ? COLORS.amberDim : COLORS.bg2),
          color: active ? COLORS.white : COLORS.text,
          border: 'none',
          borderBottom: `2px solid ${active ? COLORS.green : (hasWork ? COLORS.amber : COLORS.border)}`,
          cursor: 'pointer',
          fontFamily: FONT, letterSpacing: '0.06em',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800 }}>{label}</div>
        <div style={{
          fontSize: 9, fontWeight: 500,
          color: active ? 'rgba(255,255,255,0.85)' : COLORS.text3,
        }}>
          {subtitle}
        </div>
      </button>
    )
  }

  return (
    <div style={{ display: 'flex' }}>
      {renderBtn('line1', 'LINE 1', slot1)}
      {renderBtn('line2', 'LINE 2', slot2)}
    </div>
  )
}

function OpsSection({ title, actions, children }) {
  const hasContent = React.Children.toArray(children).some(Boolean)
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: hasContent ? 12 : 0,
        borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 6,
      }}>
        <span style={{
          fontFamily: FONT, fontSize: 10, fontWeight: 700, color: COLORS.text,
          letterSpacing: '0.12em', textTransform: 'uppercase',
        }}>{title}</span>
        <div style={{ flex: 1 }} />
        {actions && actions.map((a, i) => (
          <button key={i} onClick={a.onClick} style={{
            fontFamily: FONT, fontSize: 8, fontWeight: 600,
            color: COLORS.text3, background: 'transparent',
            border: `1px solid ${COLORS.border}`,
            padding: '3px 8px', borderRadius: 2, cursor: 'pointer',
            letterSpacing: '0.06em',
          }}>{a.label}</button>
        ))}
      </div>
      {hasContent && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {children}
        </div>
      )}
    </div>
  )
}

function PhoneQROverlay({ onClose }) {
  const canvasRef = React.useRef(null)
  const [url, setUrl] = React.useState('')

  React.useEffect(() => {
    import('qrcode').then(QRCode => {
      fetch('/api/ip').then(r => r.json()).then(d => {
        const u = `http://${d.ip}:${d.port}/?mode=phone`
        setUrl(u)
        if (canvasRef.current) {
          QRCode.toCanvas(canvasRef.current, u, { width: 220, margin: 2 })
        }
      }).catch(() => setUrl('Could not get IP'))
    })
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: 28,
        textAlign: 'center', minWidth: 280,
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: '#1a1a1a', marginBottom: 12 }}>
          Scan to Open Phone Camera
        </div>
        <canvas ref={canvasRef} style={{ display: 'block', margin: '0 auto' }} />
        {url && (
          <div style={{ fontFamily: FONT, fontSize: 10, color: '#666', marginTop: 10, wordBreak: 'break-all' }}>
            {url}
          </div>
        )}
        <button onClick={onClose} style={{
          fontFamily: FONT, fontSize: 11, color: '#999',
          background: 'transparent', border: '1px solid #ddd',
          padding: '8px 24px', borderRadius: 4, cursor: 'pointer',
          marginTop: 16,
        }}>CLOSE</button>
      </div>
    </div>
  )
}
