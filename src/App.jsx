import React, { useState, useCallback } from 'react'
import { COLORS, FONT, gradeSample } from './constants'
import { useRelay } from './useRelay'
import { countBerriesInZones } from './imageProcessor'
import { ensureLandscape } from './rotateImage'
import Header from './components/Header'
import ScoreDisplay from './components/ScoreDisplay'
import LotPanel from './components/LotPanel'
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

export default function App() {
  const isPhone = new URLSearchParams(window.location.search).get('mode') === 'phone'
  if (isPhone) return <PhoneCapture />
  return <Dashboard />
}

function Dashboard() {
  const [view, setView] = useState('qc')

  // Lot info
  const [lotId, setLotId] = useState('')
  const [grower, setGrower] = useState('')
  const [variety, setVariety] = useState('')
  const [sampleWeight, setSampleWeight] = useState(0)
  const [packType, setPackType] = useState('pint')
  // Counts
  const [counts, setCounts] = useState({ good: 0, soft: 0, major: 0, reds: 0, greens: 0, defects: 0, zero: 0 })

  // Incoming image from phone
  const [incomingImage, setIncomingImage] = useState(null)
  const [processing, setProcessing] = useState(false)

  // A/B tracking — computer counts (A) vs operator-corrected counts (B)
  const [computerCounts, setComputerCounts] = useState(null)

  // Zone editor & accuracy report
  const [showZoneEditor, setShowZoneEditor] = useState(false)
  const [showAccuracy, setShowAccuracy] = useState(false)
  const [showLogManager, setShowLogManager] = useState(false)

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
    const totalB = (counts.good || 0) + (counts.soft || 0) + (counts.major || 0) +
      (counts.reds || 0) + (counts.greens || 0) + (counts.defects || 0) + (counts.zero || 0)
    if (!totalB) return

    // Count how many official (non-extra) samples exist for this lot
    const officialCount = history.filter(s => s.lotId === lotId && !s.isExtra).length

    const sample = {
      id: Date.now(),
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      date: new Date().toLocaleDateString(),
      lotId, grower, variety, sampleWeight, packType,
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

    setCounts({ good: 0, soft: 0, major: 0, reds: 0, greens: 0, defects: 0, zero: 0 })
    setComputerCounts(null)
    setIncomingImage(null)

    const layerNames = { 1: 'BOTTOM LAYER', 2: 'MIDDLE LAYER', 3: 'TOP LAYER' }
    const label = isExtra
      ? 'EXTRA SAMPLE LOGGED'
      : `SAMPLE ${sample.sampleNum}/3 LOGGED — ${layerNames[sample.sampleNum] || ''}`
    alert(`${label}\n\nDiscard sample berries before next sample.`)
  }, [counts, computerCounts, lotId, grower, variety, history, saveHistory, saveAccuracyLog, trainingMode])

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
      lotId, grower, variety,
      good: 0, soft: 0, major: 0, reds: 0, greens: 0, defects: 0, zero: 0,
      isExtra: false,
      isSkipped: true,
      sampleNum: officialCount + 1,
    }
    saveHistory([...history, sample])
    alert(`${layerNames[officialCount]} LAYER SKIPPED`)
  }, [lotId, grower, variety, history, saveHistory])

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
        trainingMode={trainingMode}
        onToggleTraining={toggleTraining}
        relayConnected={connected}
        phonesOnline={phonesOnline}
      />

      <div style={{
        display: 'grid', gridTemplateColumns: '340px 1fr',
        minHeight: 'calc(100vh - 49px)',
      }}>
        {/* Left sidebar */}
        <div style={{
          background: COLORS.bg2, borderRight: `1px solid ${COLORS.border}`,
          padding: 18, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto',
        }}>
          <LotPanel
            lotId={lotId} setLotId={setLotId}
            grower={grower} setGrower={setGrower}
            variety={variety} setVariety={setVariety}
            sampleWeight={sampleWeight} setSampleWeight={setSampleWeight}
            packType={packType} setPackType={setPackType}
          />

          <hr style={{ border: 'none', borderTop: `1px solid ${COLORS.border}` }} />

          {/* Incoming image preview */}
          {incomingImage && (
            <div>
              <div style={{
                fontFamily: FONT, fontSize: 10, fontWeight: 600,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: COLORS.text3, marginBottom: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span>
                  Last Capture
                  <span style={{ color: COLORS.green, marginLeft: 8, fontWeight: 400 }}>
                    {incomingImage.timestamp}
                  </span>
                </span>
                <button onClick={() => setShowZoneEditor(true)} style={{
                  fontFamily: FONT, fontSize: 9, color: COLORS.amber,
                  background: 'transparent', border: `1px solid ${COLORS.amberDim}`,
                  padding: '2px 8px', borderRadius: 2, cursor: 'pointer',
                  letterSpacing: '0.06em',
                }}>
                  {hasZones ? 'EDIT ZONES' : 'DRAW ZONES'}
                </button>
              </div>
              <img
                src={incomingImage.data}
                onClick={() => setShowZoneEditor(true)}
                style={{
                  width: '100%', borderRadius: 4,
                  border: `1px solid ${COLORS.border}`,
                  cursor: 'pointer',
                }}
                alt="Captured tray"
                title="Click to draw/edit zones"
              />
              {processing && (
                <div style={{
                  fontFamily: FONT, fontSize: 10, color: COLORS.amber,
                  textAlign: 'center', marginTop: 6, letterSpacing: '0.08em',
                }}>
                  COUNTING...
                </div>
              )}
              {!processing && hasZones && counts.total > 0 && (
                <div style={{
                  fontFamily: FONT, fontSize: 10, color: COLORS.green,
                  textAlign: 'center', marginTop: 6, letterSpacing: '0.08em',
                }}>
                  AUTO-COUNTED — {counts.total} berries detected
                </div>
              )}
              {!processing && !hasZones && (
                <div style={{
                  fontFamily: FONT, fontSize: 10, color: COLORS.amber,
                  textAlign: 'center', marginTop: 6, letterSpacing: '0.08em',
                  cursor: 'pointer',
                }} onClick={() => setShowZoneEditor(true)}>
                  CLICK IMAGE TO DRAW ZONES
                </div>
              )}
            </div>
          )}

          <CountEntry counts={counts} setCounts={setCounts} />

          {/* Sample count indicator for current lot */}
          {lotId && (() => {
            const officialCount = history.filter(s => s.lotId === lotId && !s.isExtra).length
            const extraCount = history.filter(s => s.lotId === lotId && s.isExtra).length
            const layerNames = { 0: '#1 BOTTOM', 1: '#2 MIDDLE', 2: '#3 TOP' }
            return (
              <div style={{
                fontFamily: FONT, fontSize: 10, color: COLORS.text3,
                letterSpacing: '0.06em', textAlign: 'center',
                padding: '4px 0',
              }}>
                <div>{lotId}: {officialCount}/3 official{extraCount > 0 ? ` + ${extraCount} extra` : ''}</div>
                {officialCount < 3 ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 8, marginTop: 4,
                  }}>
                    <span style={{ color: COLORS.green }}>
                      NEXT: {layerNames[officialCount]} LAYER
                    </span>
                    <button onClick={skipLayer} style={{
                      fontFamily: FONT, fontSize: 9, color: COLORS.amber,
                      background: 'transparent', border: `1px solid ${COLORS.amberDim}`,
                      padding: '2px 6px', borderRadius: 2, cursor: 'pointer',
                      letterSpacing: '0.04em',
                    }}>
                      SKIP
                    </button>
                  </div>
                ) : (
                  <div style={{ color: COLORS.amber, marginTop: 2 }}>
                    3/3 COMPLETE — extras only
                  </div>
                )}
              </div>
            )
          })()}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => {
              setCounts({ good: 0, soft: 0, major: 0, reds: 0, greens: 0, defects: 0, zero: 0 })
              setIncomingImage(null)
            }} style={{
              flex: 1, background: COLORS.bg3,
              border: `1px solid ${COLORS.border2}`, color: COLORS.text3,
              fontFamily: FONT, fontSize: 10, fontWeight: 600,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              padding: 10, borderRadius: 3, cursor: 'pointer',
            }}>
              DISCARD
            </button>
            <button onClick={logSample} style={{
              flex: 2, background: COLORS.greenDim,
              border: `1px solid ${COLORS.green}`, color: COLORS.green,
              fontFamily: FONT, fontSize: 11, fontWeight: 600,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              padding: 10, borderRadius: 3, cursor: 'pointer',
            }}>
              {(() => {
                const oc = history.filter(s => s.lotId === lotId && !s.isExtra).length
                const ln = { 0: 'BOTTOM', 1: 'MIDDLE', 2: 'TOP' }
                return oc < 3 && lotId ? `LOG ${ln[oc]}` : 'LOG SAMPLE'
              })()}
            </button>
            <button onClick={logExtraSample} style={{
              flex: 1, background: COLORS.bg3,
              border: `1px solid ${COLORS.purple}`, color: COLORS.purple,
              fontFamily: FONT, fontSize: 10, fontWeight: 600,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              padding: 10, borderRadius: 3, cursor: 'pointer',
            }}>
              EXTRA
            </button>
          </div>
        </div>

        {/* Main content */}
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 18, overflowY: 'auto' }}>
          <ScoreDisplay counts={counts} />
          <ThresholdBars counts={counts} />
          <OpsPanel
            berryScore={(() => { const r = gradeSample(counts); return r.score })()}
            history={history}
            lotId={lotId}
          />
          <LotSummary lotId={lotId} history={history} />
          <SampleHistory history={history} onClear={clearHistory} />
        </div>
      </div>

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
    </div>
  )
}
