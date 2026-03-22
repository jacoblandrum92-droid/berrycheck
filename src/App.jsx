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
import PackLogViewer, { PackLogInput } from './components/PackLog'
import PackCodeManager from './components/PackCodeManager'

export default function App() {
  const mode = new URLSearchParams(window.location.search).get('mode')
  if (mode === 'phone') return <PhoneCapture />
  if (mode === 'dump') return <DumpScanner />
  return <Dashboard />
}

function Dashboard() {
  const [view, setView] = useState('qc')

  // Lot info
  const [lotId, setLotId] = useState('')
  const [receiptNum, setReceiptNum] = useState('')
  const [grower, setGrower] = useState('')
  const [variety, setVariety] = useState('')
  const [packCriteria, setPackCriteria] = useState('standard')
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

  const saveHistory = useCallback((h) => {
    setHistory(h)
    localStorage.setItem('bc_history', JSON.stringify(h))
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

    const sample = {
      id: Date.now(),
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      date: new Date().toLocaleDateString(),
      lotId, receiptNum, grower, variety, packCriteria,
      ...counts,
      isExtra,
      sampleNum: isExtra ? null : officialCount + 1, // 1, 2, 3 for official samples
      // A/B data
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
    const label = isExtra
      ? 'EXTRA SAMPLE LOGGED'
      : `SAMPLE ${sample.sampleNum}/3 LOGGED — ${layerNames[sample.sampleNum] || ''}`
    alert(`${label}\n\nDiscard sample berries before next sample.`)
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
    alert(`${layerNames[officialCount]} LAYER SKIPPED`)
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
        lotId, receiptNum, grower, variety, packCriteria,
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

    alert(`Pallet ${lotId} marked as MISSED — ${3 - officialCount} sample(s) skipped`)
  }, [lotId, receiptNum, grower, variety, packCriteria, history, saveHistory])

  const clearHistory = useCallback(() => saveHistory([]), [saveHistory])

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
          {/* QC Top strip — pallet setup */}
          <QCSetupBar
            lotId={lotId} setLotId={setLotId}
            receiptNum={receiptNum} setReceiptNum={setReceiptNum}
            grower={grower} setGrower={setGrower}
            variety={variety} setVariety={setVariety}
            packCriteria={packCriteria} setPackCriteria={setPackCriteria}
            history={history} skipLayer={skipLayer} skipPallet={skipPallet}
          />

          {/* Pack log input */}
          <PackLogInput receiptNum={receiptNum} grower={grower} />

          {/* Main QC area — sample input + grade */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: 24, padding: '20px 32px',
            alignContent: 'start',
          }}>
            {/* LEFT — Sample input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
            </div>

            {/* RIGHT — Grade result + headroom */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <ScoreDisplay counts={counts} />
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

      {/* Grading guide overlay */}
      {showGradingGuide && (
        <GradingGuide onClose={() => setShowGradingGuide(false)} />
      )}
    </div>
  )
}
