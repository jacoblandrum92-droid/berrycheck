import React, { useState, useCallback } from 'react'
import { COLORS, FONT, gradeSample, PACK_CRITERIA, GRADE_RANK } from './constants'
import { loadReceipts } from './receipts'
import { useRelay } from './useRelay'
import { countBerriesInZones } from './imageProcessor'
import { ensureLandscape } from './rotateImage'
import Header from './components/Header'
import ScoreDisplay from './components/ScoreDisplay'
import CountEntry from './components/CountEntry'
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

export default function App() {
  const mode = new URLSearchParams(window.location.search).get('mode')
  if (mode === 'phone') return <PhoneCapture />
  if (mode === 'dump') return <DumpScanner />
  if (mode === 'view') return <Viewer />
  if (mode === 'daily') return <DailyView />
  return <Dashboard />
}

function Dashboard() {
  const [view, setView] = useState('qc')

  // Daily pallet number — auto-generated from pack log
  const [dailyPalletNum, setDailyPalletNum] = useState(() => {
    try {
      const today = new Date().toLocaleDateString()
      const log = JSON.parse(localStorage.getItem('bc_packlog') || '[]')
      return log.filter(e => e.date === today).reduce((max, e) => Math.max(max, e.dailyPallet || 0), 0) + 1
    } catch { return 1 }
  })

  // Lot info
  const [lotId, setLotId] = useState('')
  const [receiptNum, setReceiptNum] = useState('')
  const [grower, setGrower] = useState('')
  const [variety, setVariety] = useState('')
  const [packCriteria, setPackCriteria] = useState('standard')
  const [lineRate, setLineRate] = useState('')
  const [blowoff, setBlowoff] = useState('')
  const [sizeDiversion, setSizeDiversion] = useState('')
  // Counts
  const [counts, setCounts] = useState({ good: 0, permanent: 0, condition: 0, decay: 0 })

  // Incoming image from phone
  const [incomingImage, setIncomingImage] = useState(null)
  const [processing, setProcessing] = useState(false)

  // A/B tracking — computer counts (A) vs operator-corrected counts (B)
  const [computerCounts, setComputerCounts] = useState(null)

  // Zone editor & accuracy report
  const [showZoneEditor, setShowZoneEditor] = useState(false)
  const [showAccuracy, setShowAccuracy] = useState(false)
  const [showLogManager, setShowLogManager] = useState(false)
  const [showReceipts, setShowReceipts] = useState(false)
  const [showBarcodeSheet, setShowBarcodeSheet] = useState(false)
  const [showGradingGuide, setShowGradingGuide] = useState(false)
  const [showPackLog, setShowPackLog] = useState(false)
  const [showPackCodes, setShowPackCodes] = useState(false)
  const [detailedCounts, setDetailedCounts] = useState(false)
  const [showPalletCloseOut, setShowPalletCloseOut] = useState(false)
  const [showReceiptChange, setShowReceiptChange] = useState(false)
  const [palletReceipts, setPalletReceipts] = useState([]) // tracks receipt segments on current pallet
  const [packCode, setPackCode] = useState('')
  const [lastPackCode, setLastPackCode] = useState('')
  const [showBackupForm, setShowBackupForm] = useState(false)
  const [showLineStats, setShowLineStats] = useState(null) // 'mid-sample' or 'close-out'
  const [palletLineStats, setPalletLineStats] = useState(null) // stored once captured

  // Training mode toggle — when ON, A/B data is saved for accuracy tracking
  const [trainingMode, setTrainingMode] = useState(() => {
    return localStorage.getItem('bc_training') === 'true'
  })
  const toggleTraining = () => {
    const next = !trainingMode
    setTrainingMode(next)
    localStorage.setItem('bc_training', next.toString())
  }

  // Sample history
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bc_history') || '[]') } catch { return [] }
  })

  const getSavedZones = () => {
    try {
      const saved = JSON.parse(localStorage.getItem('bc_zones') || '[]')
      const validKeys = ['good', 'soft', 'major', 'reds', 'greens', 'defects', 'zero']
      return saved.filter(z => validKeys.includes(z.key))
    } catch { return [] }
  }

  // Handle incoming image from phone
  const handleRelayImage = useCallback(async (imageData, timestamp) => {
    // Rotate portrait to landscape
    const landscapeData = await ensureLandscape(imageData)
    setIncomingImage({ data: landscapeData, timestamp })

    // Auto-process if we have saved zones
    const zones = getSavedZones()
    if (zones.length > 0) {
      setProcessing(true)
      try {
        const result = await countBerriesInZones(landscapeData, zones)
        setCounts(result.counts)
        setComputerCounts({ ...result.counts }) // Save A (computer) before operator edits
      } catch (err) {
        console.error('Auto-process error:', err)
      } finally {
        setProcessing(false)
      }
    }
  }, [])

  const { connected, phonesOnline } = useRelay('dashboard', handleRelayImage)

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
    pushDailySummary(h)
  }, [])

  // Save accuracy log (A/B comparisons) to localStorage
  const saveAccuracyLog = useCallback((entry) => {
    try {
      const log = JSON.parse(localStorage.getItem('bc_accuracy') || '[]')
      log.push(entry)
      localStorage.setItem('bc_accuracy', JSON.stringify(log))
    } catch {}
  }, [])

  const doLogSample = useCallback((isExtra) => {
    const totalB = (counts.good || 0) + (counts.permanent || 0) +
      (counts.condition || 0) + (counts.decay || 0)
    if (!totalB) return

    // Count how many official (non-extra) samples exist for this lot
    const officialCount = history.filter(s => s.lotId === lotId && !s.isExtra).length

    // Check for receipt bounceback on official samples
    // If this receipt was used, then a different one was used, and now this one is back — flag it
    let receiptWarning = null
    if (!isExtra && receiptNum) {
      const officialSamples = history.filter(s => s.lotId === lotId && !s.isExtra && !s.isSkipped)
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
      lotId, dailyPalletNum, receiptNum, grower, variety, packCriteria,
      ...counts,
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
  const logExtraSample = useCallback(() => doLogSample(true), [doLogSample])

  // Skip a layer — logs a blank placeholder so the layer counter advances
  const skipLayer = useCallback(() => {
    const officialCount = history.filter(s => s.lotId === lotId && !s.isExtra).length
    if (officialCount >= 3) return
    const layerNames = { 0: 'BOTTOM', 1: 'MIDDLE', 2: 'TOP' }
    const sample = {
      id: Date.now(),
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      date: new Date().toLocaleDateString(),
      lotId, receiptNum, grower, variety,
      good: 0, soft: 0, major: 0, reds: 0, greens: 0, defects: 0, zero: 0,
      isExtra: false,
      isSkipped: true,
      sampleNum: officialCount + 1,
    }
    saveHistory([...history, sample])
    // No alert — visible in layer indicator
  }, [lotId, receiptNum, grower, variety, history, saveHistory])

  // Skip entire pallet — logs all remaining layers as skipped + pack log missed entry
  const skipPallet = useCallback(() => {
    if (!lotId) return alert('Set a pallet tag first')
    if (!confirm(`Skip pallet ${lotId}? All samples will be marked as missed.`)) return

    const officialCount = history.filter(s => s.lotId === lotId && !s.isExtra).length
    const now = new Date()
    const time = now.toLocaleTimeString('en-US', { hour12: false })
    const date = now.toLocaleDateString()
    const newSamples = []

    // Log remaining layers as skipped
    for (let i = officialCount; i < 3; i++) {
      newSamples.push({
        id: Date.now() + i,
        time, date,
        lotId, dailyPalletNum, receiptNum, grower, variety, packCriteria,
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
  }, [])

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
    }}>
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
        trainingMode={trainingMode}
        onToggleTraining={toggleTraining}
        relayConnected={connected}
        phonesOnline={phonesOnline}
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
        <button onClick={() => setShowGradingGuide(true)} style={{
          fontFamily: FONT, fontSize: 11, fontWeight: 700,
          color: COLORS.text3, background: 'transparent',
          border: 'none', padding: '10px 14px', cursor: 'pointer',
        }} title="Grading Guide">
          ?
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
        <div style={{ minHeight: 'calc(100vh - 90px)' }}>
          {/* Pallet builder — unified receipt + pack management */}
          <PalletBuilder
            dailyPalletNum={dailyPalletNum}
            palletTag={lotId} setPalletTag={setLotId}
            palletReceipts={palletReceipts}
            onAddReceipt={addReceiptToPallet}
            onUpdateBoxes={updateReceiptBoxes}
            onRemoveReceipt={removeReceiptFromPallet}
            onSelectReceipt={selectReceiptForQC}
            packCode={packCode} setPackCode={setPackCode}
            currentReceiptNum={receiptNum}
          />

          {/* Pack criteria + layer indicator strip */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '6px 32px', borderBottom: `1px solid ${COLORS.border}`,
            background: COLORS.bg,
          }}>
            {/* Pack criteria */}
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

            <div style={{ flex: 1 }} />

            {/* Layer indicator */}
            {(() => {
              const officialCount = lotId ? history.filter(s => s.lotId === lotId && !s.isExtra).length : 0
              const layerNames = { 0: '#1 BOTTOM', 1: '#2 MIDDLE', 2: '#3 TOP' }
              return (
                <div style={{
                  fontFamily: FONT, fontSize: 11,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  {officialCount < 3 ? (
                    <span style={{ color: COLORS.green, fontWeight: 600 }}>
                      NEXT: {layerNames[officialCount] || 'SAMPLE'}
                    </span>
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
                  {receiptNum && (
                    <span style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3 }}>
                      QC: {receiptNum} ({grower})
                    </span>
                  )}
                </div>
              )
            })()}
          </div>

          {/* Main QC area — sample input + grade */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: 24, padding: '20px 32px',
            alignContent: 'start',
          }}>
            {/* LEFT — Sample input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Incoming image from phone */}
              {incomingImage && (
                <div style={{
                  background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
                  borderRadius: 4, padding: 10,
                }}>
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
                    <button onClick={() => setShowZoneEditor(true)} style={{
                      fontFamily: FONT, fontSize: 9, color: COLORS.amber,
                      background: 'transparent', border: `1px solid ${COLORS.amberDim}`,
                      padding: '2px 8px', borderRadius: 2, cursor: 'pointer',
                    }}>
                      {getSavedZones().length > 0 ? 'EDIT ZONES' : 'DRAW ZONES'}
                    </button>
                  </div>
                  <img
                    src={incomingImage.data}
                    onClick={() => setShowZoneEditor(true)}
                    style={{
                      width: '100%', maxHeight: 180, objectFit: 'contain',
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

              <CountEntry
                counts={counts} setCounts={setCounts}
                detailed={detailedCounts}
                onToggleDetailed={() => setDetailedCounts(!detailedCounts)}
              />

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => {
                  setCounts({ good: 0, permanent: 0, condition: 0, decay: 0 })
                  setIncomingImage(null)
                }} style={{
                  flex: 1, background: COLORS.bg3,
                  border: `1px solid ${COLORS.border2}`, color: COLORS.text3,
                  fontFamily: FONT, fontSize: 11, fontWeight: 600,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  padding: 14, borderRadius: 4, cursor: 'pointer',
                }}>
                  DISCARD
                </button>
                <button onClick={logSample} style={{
                  flex: 2, background: COLORS.greenDim,
                  border: `2px solid ${COLORS.green}`, color: COLORS.green,
                  fontFamily: FONT, fontSize: 14, fontWeight: 700,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  padding: 14, borderRadius: 4, cursor: 'pointer',
                }}>
                  {(() => {
                    const oc = history.filter(s => s.lotId === lotId && !s.isExtra).length
                    const ln = { 0: 'LOG BOTTOM', 1: 'LOG MIDDLE', 2: 'LOG TOP' }
                    return oc < 3 && lotId ? ln[oc] : 'LOG SAMPLE'
                  })()}
                </button>
                <button onClick={logExtraSample} style={{
                  flex: 1, background: COLORS.bg3,
                  border: `1px solid ${COLORS.purple}`, color: COLORS.purple,
                  fontFamily: FONT, fontSize: 11, fontWeight: 600,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  padding: 14, borderRadius: 4, cursor: 'pointer',
                }}>
                  EXTRA
                </button>
              </div>
              {/* Static reminder */}
              <div style={{
                fontFamily: FONT, fontSize: 10, color: COLORS.text3,
                textAlign: 'center', fontStyle: 'italic',
              }}>
                Discard sampled berries into trash lugs — do not return to production
              </div>

              {/* Inline line stats — appears after middle layer, persists until filled or pallet closed */}
              {showLineStats && !palletLineStats && (
                <div style={{
                  background: COLORS.amberDim, border: `2px solid ${COLORS.amber}`,
                  borderRadius: 6, padding: 14,
                }}>
                  <div style={{
                    fontFamily: FONT, fontSize: 11, fontWeight: 700,
                    color: COLORS.amber, marginBottom: 4,
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                  }}>
                    Line Stats — Check Machine Now
                  </div>
                  <div style={{
                    fontFamily: FONT, fontSize: 10, color: COLORS.text2,
                    marginBottom: 10,
                  }}>
                    Walk to the 360 and record current stats. You can defer this but it will keep showing until entered.
                  </div>
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
                      // Attach to middle sample
                      setHistory(prev => {
                        const updated = [...prev]
                        for (let i = updated.length - 1; i >= 0; i--) {
                          if (updated[i].lotId === lotId && updated[i].sampleNum === 2 && !updated[i].isExtra) {
                            updated[i] = { ...updated[i], lineStats: stats }
                            break
                          }
                        }
                        localStorage.setItem('bc_history', JSON.stringify(updated))
                        return updated
                      })
                      setShowLineStats(null)
                    }} style={{
                      flex: 2, fontFamily: FONT, fontSize: 12, fontWeight: 700,
                      color: COLORS.amber, background: COLORS.bg,
                      border: `2px solid ${COLORS.amber}`,
                      padding: 10, borderRadius: 4, cursor: 'pointer',
                      letterSpacing: '0.06em',
                    }}>
                      SAVE LINE STATS
                    </button>
                    <button onClick={() => {/* just leave it showing */}} style={{
                      flex: 1, fontFamily: FONT, fontSize: 10,
                      color: COLORS.text3, background: 'transparent',
                      border: `1px solid ${COLORS.border}`,
                      padding: 10, borderRadius: 4, cursor: 'pointer',
                    }}>
                      LATER
                    </button>
                  </div>
                </div>
              )}

              {/* Line stats confirmed — show as pallet metric */}
              {palletLineStats && (
                <div style={{
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
            </div>

            {/* RIGHT — Grade result + headroom */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <ShareButton label="Share QC Data" getSnapshot={() => {
                  const gradeResult = gradeSample(counts)
                  const lotSamples = history.filter(s => s.lotId === lotId)
                  const official = lotSamples.filter(s => !s.isExtra && !s.isSkipped)
                  const packLog = JSON.parse(localStorage.getItem('bc_packlog') || '[]')
                  const today = new Date().toLocaleDateString()
                  const todayLog = packLog.filter(e => e.date === today)
                  return {
                    type: 'grade',
                    lotId, dailyPalletNum, receiptNum, grower, variety, packCriteria,
                    grade: gradeResult,
                    views: {
                      grade: { grade: gradeResult },
                      lotSummary: {
                        lotSummary: {
                          lotId,
                          sampleCount: official.length,
                          grade: official.length > 0 ? gradeSample(averageCounts(official)) : null,
                          pctCombined: official.length > 0 ? gradeSample(averageCounts(official)).pctCombined : 0,
                          samples: [1,2,3].map(n => {
                            const s = lotSamples.find(x => x.sampleNum === n)
                            if (!s) return { layer: ['BTM','MID','TOP'][n-1], isSkipped: true }
                            if (s.isSkipped) return { layer: ['BTM','MID','TOP'][n-1], isSkipped: true }
                            return { layer: ['BTM','MID','TOP'][n-1], grade: gradeSample(s).label }
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
              <ScoreDisplay counts={counts} packCriteria={packCriteria} />
              <ThresholdBars counts={counts} />
              <LotSummary lotId={lotId} history={history} />
            </div>
          </div>
        </div>
      ) : (
        /* ========== OPS MODE ========== */
        <div style={{
          padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20,
          minHeight: 'calc(100vh - 90px)', overflowY: 'auto',
        }}>
          <LineMonitor />
          <OpsPanel
            berryScore={(() => { const r = gradeSample(counts); return r.score })()}
            history={history}
            lotId={lotId}
          />
          <LotSummary lotId={lotId} history={history} />
          <SampleHistory history={history} onClear={clearHistory} />
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
          }}
          onClose={() => setShowLogManager(false)}
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
          packCode={lastPackCode}
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

      {/* Grading guide overlay */}
      {showGradingGuide && (
        <GradingGuide onClose={() => setShowGradingGuide(false)} />
      )}
    </div>
  )
}
