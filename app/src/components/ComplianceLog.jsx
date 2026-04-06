import React, { useState, useEffect, useCallback } from 'react'
import { COLORS, FONT } from '../constants'
import LogCapture from './LogCapture'

// ============================================================
// SCHEDULE RULES & DEFAULTS
// ============================================================

const HARVEST_START = new Date('2026-04-09')
const HARVEST_END = new Date('2026-06-05')

const LOG_TYPES = {
  // Daily during harvest
  COOL: { label: 'Cooler Temp Log', category: 'daily', defaultTime: '06:30', defaultMsg: 'Record cooler unit temperatures', group: 'Startup' },
  DPOC: { label: 'Pre-Operation Checklist', category: 'daily', defaultTime: '06:00', defaultMsg: 'Complete pre-op checklist before the line starts', group: 'Startup' },
  DOIP: { label: 'Packing Facility Inspection', category: 'daily', defaultTime: '06:15', defaultMsg: 'Daily packing facility inspection', group: 'Startup' },
  SHIP: { label: 'Transport/Receiving Inspection', category: 'daily', defaultTime: '16:00', defaultMsg: 'Did you receive or ship today? Fill out transport log', group: 'Mid-Day' },
  CLET: { label: 'Field Equipment Cleaning', category: 'daily', defaultTime: '17:00', defaultMsg: 'Clean and log field equipment/tools', group: 'End of Day' },
  SANE: { label: 'Sanitation Report: Equipment', category: 'daily', defaultTime: '17:15', defaultMsg: 'Complete equipment sanitation report', group: 'End of Day' },
  CLUB: { label: 'Lug & Bucket Cleaning', category: 'daily', defaultTime: '17:30', defaultMsg: 'Clean and sanitize lugs & buckets', group: 'End of Day' },

  // Weekly during harvest
  EROD: { label: 'Exterior Rodent Traps', category: 'weekly', day: 1, defaultTime: '08:00', defaultMsg: 'Inspect exterior rodent trap stations', group: 'Weekly' },
  IROD: { label: 'Interior Rodent Traps', category: 'weekly', day: 1, defaultTime: '08:00', defaultMsg: 'Inspect interior rodent trap stations', group: 'Weekly' },
  HWST: { label: 'Hand Wash Station Treatment', category: 'weekly', day: 0, defaultTime: '07:00', defaultMsg: 'Treat hand wash stations', group: 'Weekly' },
  FERT: { label: 'Fertilizer Records', category: 'weekly-yearround', day: 5, defaultTime: '09:00', defaultMsg: 'Record fertilizer applications', group: 'Weekly' },

  // Monthly year-round
  WELL: { label: 'Well/Pump Inspection', category: 'monthly', dayOfMonth: 9, defaultTime: '09:30', defaultMsg: 'Monthly well and pump inspection due', group: 'Monthly' },
  FCHEM: { label: 'Farm Chemical Inventory', category: 'monthly', dayOfMonth: 1, defaultTime: '09:00', defaultMsg: 'Update farm chemical inventory', group: 'Monthly' },
  PCHEM: { label: 'Packing House Chemical Log', category: 'monthly', dayOfMonth: 15, defaultTime: '09:00', defaultMsg: 'Update packing house chemical log', group: 'Monthly' },
}

const STORAGE_KEY = 'bc_compliance_config'
const COMPLETION_KEY = 'bc_compliance_done'

function isHarvestDay(date) {
  return date >= HARVEST_START && date <= HARVEST_END
}

function getLogsForDate(date, config) {
  const dow = date.getDay() // 0=Sun
  const dom = date.getDate()
  const harvest = isHarvestDay(date)
  const due = []

  for (const [code, def] of Object.entries(LOG_TYPES)) {
    const cfg = config[code] || {}
    if (cfg.disabled) continue

    let isDue = false

    if (def.category === 'daily') {
      isDue = harvest
    } else if (def.category === 'weekly') {
      // Weekly during harvest only, monthly outside harvest
      if (harvest) {
        isDue = dow === (cfg.day ?? def.day)
      } else {
        // Monthly fallback outside harvest — use first occurrence of that weekday
        isDue = dom <= 7 && dow === (cfg.day ?? def.day)
      }
    } else if (def.category === 'weekly-yearround') {
      isDue = dow === (cfg.day ?? def.day)
    } else if (def.category === 'monthly') {
      isDue = dom === (cfg.dayOfMonth ?? def.dayOfMonth)
    }

    if (isDue) {
      due.push({
        code,
        ...def,
        time: cfg.time || def.defaultTime,
        msg: cfg.msg || def.defaultMsg,
      })
    }
  }

  // Sort by prompt time
  due.sort((a, b) => a.time.localeCompare(b.time))
  return due
}

function dateKey(date) {
  return date.toISOString().slice(0, 10)
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function ComplianceLog() {
  const [config, setConfig] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} }
  })
  const [completions, setCompletions] = useState(() => {
    try { return JSON.parse(localStorage.getItem(COMPLETION_KEY) || '{}') } catch { return {} }
  })
  const [showSettings, setShowSettings] = useState(false)
  const [captureLog, setCaptureLog] = useState(null) // { code, label } or null
  const [showAll, setShowAll] = useState(false)
  const [captures, setCaptures] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bc_compliance_captures') || '{}') } catch { return {} }
  })
  const [now, setNow] = useState(new Date())

  // Tick every minute
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])

  // Persist
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    fetch('/api/store/' + STORAGE_KEY, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) }).catch(() => {})
  }, [config])
  useEffect(() => {
    localStorage.setItem(COMPLETION_KEY, JSON.stringify(completions))
    fetch('/api/store/' + COMPLETION_KEY, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(completions) }).catch(() => {})
  }, [completions])
  useEffect(() => {
    localStorage.setItem('bc_compliance_captures', JSON.stringify(captures))
    fetch('/api/store/bc_compliance_captures', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(captures) }).catch(() => {})
  }, [captures])

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayKey = dateKey(today)
  const todayLogs = getLogsForDate(today, config)
  const harvest = isHarvestDay(today)

  const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0')

  const todayCompletions = completions[todayKey] || {}

  const markDone = useCallback((code) => {
    setCompletions(prev => ({
      ...prev,
      [todayKey]: { ...(prev[todayKey] || {}), [code]: now.toLocaleTimeString('en-US', { hour12: false }) }
    }))
  }, [todayKey, now])

  const unmarkDone = useCallback((code) => {
    setCompletions(prev => {
      const day = { ...(prev[todayKey] || {}) }
      delete day[code]
      return { ...prev, [todayKey]: day }
    })
  }, [todayKey])

  const updateConfig = useCallback((code, field, value) => {
    setConfig(prev => ({
      ...prev,
      [code]: { ...(prev[code] || {}), [field]: value }
    }))
  }, [])

  // Split logs into: overdue (past prompt time, not done), upcoming (not yet time), done
  const overdue = []
  const active = []
  const upcoming = []
  const done = []

  for (const log of todayLogs) {
    if (todayCompletions[log.code]) {
      done.push({ ...log, doneAt: todayCompletions[log.code] })
    } else if (log.time <= currentTime) {
      // Check if it's been more than 30 min past prompt time
      const [h, m] = log.time.split(':').map(Number)
      const promptMinutes = h * 60 + m
      const nowMinutes = now.getHours() * 60 + now.getMinutes()
      if (nowMinutes - promptMinutes > 60) {
        overdue.push(log)
      } else {
        active.push(log)
      }
    } else {
      upcoming.push(log)
    }
  }

  // Tomorrow preview
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowLogs = getLogsForDate(tomorrow, config)

  return (
    <div style={{
      background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
      borderRadius: 4, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 16px', borderBottom: `1px solid ${COLORS.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontFamily: FONT, fontSize: 10, fontWeight: 600,
            letterSpacing: '0.12em', textTransform: 'uppercase', color: COLORS.text3,
          }}>Compliance</span>
          {harvest && (
            <span style={{
              fontFamily: FONT, fontSize: 8, fontWeight: 600,
              color: COLORS.green, background: COLORS.greenDim,
              padding: '2px 6px', borderRadius: 2, letterSpacing: '0.06em',
            }}>HARVEST</span>
          )}
          <span style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3 }}>
            {done.length}/{todayLogs.length} done
          </span>
          {overdue.length > 0 && (
            <span style={{
              fontFamily: FONT, fontSize: 8, fontWeight: 600,
              color: COLORS.red, background: COLORS.redDim,
              padding: '2px 6px', borderRadius: 2,
            }}>{overdue.length} OVERDUE</span>
          )}
        </div>
        <button onClick={() => setShowAll(!showAll)} style={{
          fontFamily: FONT, fontSize: 8, fontWeight: 600,
          color: showAll ? COLORS.purple : COLORS.text3,
          background: showAll ? COLORS.purple + '15' : 'transparent',
          border: `1px solid ${showAll ? COLORS.purple : COLORS.border}`,
          padding: '3px 8px', borderRadius: 2, cursor: 'pointer',
          letterSpacing: '0.06em',
        }}>
          {showAll ? 'TODAY' : 'ALL LOGS'}
        </button>
        <button onClick={() => setShowSettings(!showSettings)} style={{
          fontFamily: FONT, fontSize: 8, fontWeight: 600,
          color: showSettings ? COLORS.green : COLORS.text3,
          background: showSettings ? COLORS.greenDim : 'transparent',
          border: `1px solid ${showSettings ? COLORS.green : COLORS.border}`,
          padding: '3px 8px', borderRadius: 2, cursor: 'pointer',
          letterSpacing: '0.06em',
        }}>
          {showSettings ? 'CLOSE' : 'SETTINGS'}
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div style={{
          padding: '12px 16px', borderBottom: `1px solid ${COLORS.border}`,
          background: COLORS.bg3, maxHeight: 400, overflowY: 'auto',
        }}>
          <div style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3, marginBottom: 8, letterSpacing: '0.06em' }}>
            Set prompt times and messages for each log. Changes save automatically.
          </div>
          {Object.entries(LOG_TYPES).map(([code, def]) => {
            const cfg = config[code] || {}
            return (
              <div key={code} style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
                padding: '6px 8px', background: COLORS.bg2, borderRadius: 3,
                opacity: cfg.disabled ? 0.4 : 1,
              }}>
                <input type="checkbox" checked={!cfg.disabled}
                  onChange={e => updateConfig(code, 'disabled', !e.target.checked)}
                  title="Enable/disable this log"
                />
                <span style={{ fontFamily: FONT, fontSize: 9, fontWeight: 600, color: COLORS.text, width: 40 }}>{code}</span>
                <span style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text2, width: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {def.label}
                </span>
                {/* Day picker for weekly logs */}
                {(def.category === 'weekly' || def.category === 'weekly-yearround') && (
                  <select value={cfg.day ?? def.day}
                    onChange={e => updateConfig(code, 'day', parseInt(e.target.value))}
                    style={{
                      fontFamily: FONT, fontSize: 9, padding: '2px 4px',
                      border: `1px solid ${COLORS.border}`, borderRadius: 2,
                      background: COLORS.bg, width: 65,
                    }}>
                    <option value={0}>Sun</option>
                    <option value={1}>Mon</option>
                    <option value={2}>Tue</option>
                    <option value={3}>Wed</option>
                    <option value={4}>Thu</option>
                    <option value={5}>Fri</option>
                    <option value={6}>Sat</option>
                  </select>
                )}
                {/* Day-of-month picker for monthly logs */}
                {def.category === 'monthly' && (
                  <select value={cfg.dayOfMonth ?? def.dayOfMonth}
                    onChange={e => updateConfig(code, 'dayOfMonth', parseInt(e.target.value))}
                    style={{
                      fontFamily: FONT, fontSize: 9, padding: '2px 4px',
                      border: `1px solid ${COLORS.border}`, borderRadius: 2,
                      background: COLORS.bg, width: 55,
                    }}>
                    {Array.from({ length: 28 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1}{['st','nd','rd'][i] || 'th'}</option>
                    ))}
                  </select>
                )}
                {/* Spacer for daily logs that don't have a day picker */}
                {def.category === 'daily' && <span style={{ width: 65 }} />}
                <input type="time" value={cfg.time || def.defaultTime}
                  onChange={e => updateConfig(code, 'time', e.target.value)}
                  style={{
                    fontFamily: FONT, fontSize: 10, padding: '2px 4px',
                    border: `1px solid ${COLORS.border}`, borderRadius: 2,
                    background: COLORS.bg, width: 80,
                  }}
                />
                <input type="text" value={cfg.msg ?? def.defaultMsg}
                  onChange={e => updateConfig(code, 'msg', e.target.value)}
                  placeholder={def.defaultMsg}
                  style={{
                    fontFamily: FONT, fontSize: 9, padding: '3px 6px',
                    border: `1px solid ${COLORS.border}`, borderRadius: 2,
                    background: COLORS.bg, flex: 1, color: COLORS.text2,
                  }}
                />
                <span style={{ fontFamily: FONT, fontSize: 8, color: COLORS.text3, width: 50, textAlign: 'right' }}>
                  {def.category}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* All logs view — scan any log anytime */}
      {showAll ? (
        <div style={{ padding: '8px 16px' }}>
          {Object.entries(LOG_TYPES).map(([code, def]) => {
            const cfg = config[code] || {}
            if (cfg.disabled) return null
            const isDueToday = todayLogs.some(l => l.code === code)
            const isDone = !!todayCompletions[code]
            const capKey = `${todayKey}_${code}`
            const capData = captures[capKey] || []
            return (
              <LogItem
                key={code}
                log={{ code, msg: cfg.msg || def.defaultMsg, time: cfg.time || def.defaultTime }}
                status={isDone ? 'done' : isDueToday ? 'active' : 'upcoming'}
                doneAt={isDone ? todayCompletions[code] : undefined}
                onDone={() => markDone(code)}
                onUndo={() => unmarkDone(code)}
                onCapture={() => setCaptureLog({ code, label: cfg.msg || def.defaultMsg })}
                captureCount={capData.length}
                captureData={capData}
                onDeleteCapture={(idx) => {
                  setCaptures(prev => {
                    const updated = [...(prev[capKey] || [])]
                    updated.splice(idx, 1)
                    return { ...prev, [capKey]: updated }
                  })
                }}
              />
            )
          })}
        </div>
      ) : todayLogs.length === 0 ? (
        <div style={{ padding: '20px 16px', textAlign: 'center' }}>
          <span style={{ fontFamily: FONT, fontSize: 11, color: COLORS.text3 }}>No logs due today</span>
          <div style={{ marginTop: 4 }}>
            <button onClick={() => setShowAll(true)} style={{
              fontFamily: FONT, fontSize: 9, color: COLORS.purple,
              background: 'transparent', border: `1px solid ${COLORS.purple}`,
              padding: '4px 12px', borderRadius: 3, cursor: 'pointer',
            }}>SHOW ALL LOGS</button>
          </div>
        </div>
      ) : (
        <div style={{ padding: '8px 16px' }}>
          {/* Overdue */}
          {overdue.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontFamily: FONT, fontSize: 8, fontWeight: 600, color: COLORS.red, letterSpacing: '0.08em', marginBottom: 4 }}>OVERDUE</div>
              {overdue.map(log => (
                <LogItem key={log.code} log={log} status="overdue" onDone={() => markDone(log.code)} onCapture={() => setCaptureLog({ code: log.code, label: log.msg })} captureCount={(captures[`${todayKey}_${log.code}`] || []).length} captureData={captures[`${todayKey}_${log.code}`] || []} onDeleteCapture={(idx) => { setCaptures(prev => { const k = `${todayKey}_${log.code}`; const u = [...(prev[k] || [])]; u.splice(idx, 1); return { ...prev, [k]: u } }) }} />
              ))}
            </div>
          )}

          {/* Active — prompt time has passed */}
          {active.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontFamily: FONT, fontSize: 8, fontWeight: 600, color: COLORS.amber, letterSpacing: '0.08em', marginBottom: 4 }}>DO NOW</div>
              {active.map(log => (
                <LogItem key={log.code} log={log} status="active" onDone={() => markDone(log.code)} onCapture={() => setCaptureLog({ code: log.code, label: log.msg })} captureCount={(captures[`${todayKey}_${log.code}`] || []).length} captureData={captures[`${todayKey}_${log.code}`] || []} onDeleteCapture={(idx) => { setCaptures(prev => { const k = `${todayKey}_${log.code}`; const u = [...(prev[k] || [])]; u.splice(idx, 1); return { ...prev, [k]: u } }) }} />
              ))}
            </div>
          )}

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontFamily: FONT, fontSize: 8, fontWeight: 600, color: COLORS.text3, letterSpacing: '0.08em', marginBottom: 4 }}>UPCOMING</div>
              {upcoming.map(log => (
                <LogItem key={log.code} log={log} status="upcoming" onDone={() => markDone(log.code)} onCapture={() => setCaptureLog({ code: log.code, label: log.msg })} captureCount={(captures[`${todayKey}_${log.code}`] || []).length} captureData={captures[`${todayKey}_${log.code}`] || []} onDeleteCapture={(idx) => { setCaptures(prev => { const k = `${todayKey}_${log.code}`; const u = [...(prev[k] || [])]; u.splice(idx, 1); return { ...prev, [k]: u } }) }} />
              ))}
            </div>
          )}

          {/* Done */}
          {done.length > 0 && (
            <div>
              <div style={{ fontFamily: FONT, fontSize: 8, fontWeight: 600, color: COLORS.green, letterSpacing: '0.08em', marginBottom: 4 }}>DONE</div>
              {done.map(log => (
                <LogItem key={log.code} log={log} status="done" doneAt={log.doneAt} onUndo={() => unmarkDone(log.code)} onCapture={() => setCaptureLog({ code: log.code, label: log.msg })} captureCount={(captures[`${todayKey}_${log.code}`] || []).length} captureData={captures[`${todayKey}_${log.code}`] || []} onDeleteCapture={(idx) => { setCaptures(prev => { const k = `${todayKey}_${log.code}`; const u = [...(prev[k] || [])]; u.splice(idx, 1); return { ...prev, [k]: u } }) }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tomorrow preview */}
      {tomorrowLogs.length > 0 && (
        <div style={{
          padding: '6px 16px 10px', borderTop: `1px solid ${COLORS.border}`,
        }}>
          <span style={{ fontFamily: FONT, fontSize: 8, color: COLORS.text3, letterSpacing: '0.06em' }}>
            TOMORROW: {tomorrowLogs.map(l => l.code).join(', ')}
          </span>
        </div>
      )}

      {/* Log capture modal */}
      {captureLog && (
        <LogCapture
          logCode={captureLog.code}
          logLabel={captureLog.label}
          onSave={(data) => {
            const key = `${todayKey}_${captureLog.code}`
            setCaptures(prev => ({
              ...prev,
              [key]: [...(prev[key] || []), data],
            }))
            setCaptureLog(null)
          }}
          onClose={() => setCaptureLog(null)}
        />
      )}
    </div>
  )
}

// ============================================================
// LOG ITEM ROW
// ============================================================

function LogItem({ log, status, doneAt, onDone, onUndo, onCapture, captureCount, captureData, onDeleteCapture }) {
  const [showScans, setShowScans] = useState(false)
  const colors = {
    overdue: { bg: COLORS.redDim, border: COLORS.red, text: COLORS.red },
    active: { bg: COLORS.amberDim, border: COLORS.amber, text: COLORS.amber },
    upcoming: { bg: COLORS.bg, border: COLORS.border, text: COLORS.text3 },
    done: { bg: COLORS.greenDim, border: COLORS.green, text: COLORS.green },
  }
  const c = colors[status]

  return (
    <div style={{ marginBottom: 3 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 10px',
        background: c.bg, border: `1px solid ${c.border}`,
        borderRadius: showScans ? '3px 3px 0 0' : 3,
      }}>
        <span style={{ fontFamily: FONT, fontSize: 9, fontWeight: 700, color: c.text, width: 40 }}>
          {log.code}
        </span>
        <span style={{ fontFamily: FONT, fontSize: 10, color: status === 'done' ? COLORS.green : COLORS.text2, flex: 1 }}>
          {log.msg}
        </span>
        {captureCount > 0 && (
          <button onClick={() => setShowScans(!showScans)} style={{
            fontFamily: FONT, fontSize: 8, fontWeight: 600,
            color: COLORS.green, background: COLORS.greenDim,
            border: `1px solid ${COLORS.green}`,
            padding: '2px 6px', borderRadius: 2, cursor: 'pointer',
          }}>{captureCount} SCAN{captureCount > 1 ? 'S' : ''}</button>
        )}
        <button onClick={onCapture} style={{
          fontFamily: FONT, fontSize: 8, fontWeight: 600,
          color: COLORS.text3,
          background: 'transparent',
          border: `1px solid ${COLORS.border}`,
          padding: '2px 6px', borderRadius: 2, cursor: 'pointer',
        }}>+ SCAN</button>
        <span style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3 }}>
          {status === 'done' ? `done ${doneAt}` : log.time}
        </span>
        {status === 'done' ? (
          <button onClick={onUndo} style={{
            fontFamily: FONT, fontSize: 8, color: COLORS.text3,
            background: 'transparent', border: `1px solid ${COLORS.border}`,
            padding: '2px 6px', borderRadius: 2, cursor: 'pointer',
          }}>UNDO</button>
        ) : (
          <button onClick={onDone} style={{
            fontFamily: FONT, fontSize: 8, fontWeight: 600,
            color: status === 'upcoming' ? COLORS.text3 : c.text,
            background: 'transparent', border: `1px solid ${status === 'upcoming' ? COLORS.border : c.border}`,
            padding: '2px 8px', borderRadius: 2, cursor: 'pointer',
          }}>DONE</button>
        )}
      </div>

      {/* Expanded scans view */}
      {showScans && captureData && captureData.length > 0 && (
        <div style={{
          padding: '8px 10px', background: COLORS.bg,
          border: `1px solid ${c.border}`, borderTop: 'none',
          borderRadius: '0 0 3px 3px',
        }}>
          {captureData.map((scan, i) => (
            <div key={i} style={{ marginBottom: i < captureData.length - 1 ? 10 : 0 }}>
              <div style={{
                display: 'flex', gap: 8, alignItems: 'flex-start',
              }}>
                {scan.image && (
                  <img src={scan.image} style={{
                    width: 80, height: 60, objectFit: 'cover',
                    borderRadius: 3, border: `1px solid ${COLORS.border}`,
                    cursor: 'pointer',
                  }} onClick={() => window.open(scan.image, '_blank')} />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontFamily: FONT, fontSize: 8, color: COLORS.text3 }}>
                      Captured {new Date(scan.capturedAt).toLocaleString()}
                    </span>
                    {onDeleteCapture && (
                      <button onClick={() => { if (confirm('Delete this scan?')) onDeleteCapture(i) }} style={{
                        fontFamily: FONT, fontSize: 8, color: COLORS.red,
                        background: 'transparent', border: `1px solid ${COLORS.redDim}`,
                        padding: '1px 5px', borderRadius: 2, cursor: 'pointer',
                      }}>DEL</button>
                    )}
                  </div>
                  {scan.transcription ? (
                    <div style={{
                      fontFamily: FONT, fontSize: 10, color: COLORS.text2,
                      lineHeight: 1.5, whiteSpace: 'pre-wrap',
                      maxHeight: 120, overflowY: 'auto',
                      padding: '4px 6px', background: COLORS.bg2,
                      borderRadius: 2, border: `1px solid ${COLORS.border}`,
                    }}>
                      {scan.transcription}
                    </div>
                  ) : (
                    <div style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3, fontStyle: 'italic' }}>
                      No transcription
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
