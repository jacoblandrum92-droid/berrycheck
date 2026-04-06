import React, { useState, useCallback, useEffect } from 'react'
import { COLORS, FONT } from '../constants'

/**
 * DayClose — end-of-day archive + reset.
 * AUTO-ARCHIVES on startup if there's data from a previous day.
 * Manual "CLOSE DAY" button available as fallback.
 * Archives are browsable from the Ops tab. DC reports attach to past days.
 */

const ARCHIVE_KEY = 'bc_archives' // { "2026-04-15": { history, packlog, packplan, prepack, compliance, ... }, ... }

// Keys to archive and reset
const DAILY_KEYS = [
  { key: 'bc_history', label: 'Sample History' },
  { key: 'bc_packlog', label: 'Pack Log' },
  { key: 'bc_packplan', label: 'Pack Plan' },
  { key: 'bc_prepack', label: 'Pre-Pack Notes' },
  { key: 'bc_compliance_done', label: 'Compliance Log' },
]

// Keys to keep (not reset)
// bc_receipts, bc_features, bc_packcodes_db, bc_packcodes_favorites,
// bc_zones, bc_compliance_config, bc_dc_results, etc.

function loadArchives() {
  try { return JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '{}') } catch { return {} }
}

function saveArchives(archives) {
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archives))
  fetch('/api/store/' + ARCHIVE_KEY, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(archives),
  }).catch(() => {})
}

const LAST_ACTIVE_KEY = 'bc_last_active_date'

function todayDate() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

function hasDataToArchive() {
  for (const { key } of DAILY_KEYS) {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const data = JSON.parse(raw)
      if (Array.isArray(data) && data.length > 0) return true
      if (typeof data === 'object' && data && Object.keys(data).length > 0) return true
    } catch {}
  }
  return false
}

function autoArchive(dateToArchive) {
  const archive = {}
  const counts = {}

  DAILY_KEYS.forEach(({ key, label }) => {
    try {
      const data = JSON.parse(localStorage.getItem(key) || '[]')
      archive[key] = data
      counts[label] = Array.isArray(data) ? data.length : (typeof data === 'object' ? Object.keys(data).length : 1)
    } catch {
      archive[key] = null
      counts[label] = 0
    }
  })

  archive._closedAt = new Date().toISOString()
  archive._counts = counts
  archive._auto = true

  const all = loadArchives()
  // Don't overwrite if already archived
  if (!all[dateToArchive]) {
    all[dateToArchive] = archive
    saveArchives(all)
  }

  // Clear daily keys
  DAILY_KEYS.forEach(({ key }) => {
    const empty = key === 'bc_compliance_done' ? '{}' : '[]'
    localStorage.setItem(key, empty)
    fetch('/api/store/' + key, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(key === 'bc_compliance_done' ? {} : []),
    }).catch(() => {})
  })

  // Update last active date
  localStorage.setItem(LAST_ACTIVE_KEY, todayDate())

  return dateToArchive
}

export default function DayClose({ onDayReset }) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [showDCAttach, setShowDCAttach] = useState(null)
  const [autoArchived, setAutoArchived] = useState(null)

  // Auto-archive on mount if data is from a previous day
  useEffect(() => {
    const lastActive = localStorage.getItem(LAST_ACTIVE_KEY)
    const today = todayDate()

    if (lastActive && lastActive < today && hasDataToArchive()) {
      const archivedDate = autoArchive(lastActive)
      setAutoArchived(archivedDate)
      if (onDayReset) onDayReset()
    }

    // Always stamp today
    localStorage.setItem(LAST_ACTIVE_KEY, today)
  }, [])

  // Also check at midnight if app stays open
  useEffect(() => {
    const check = setInterval(() => {
      const lastActive = localStorage.getItem(LAST_ACTIVE_KEY)
      const today = todayDate()
      if (lastActive && lastActive < today && hasDataToArchive()) {
        const archivedDate = autoArchive(lastActive)
        setAutoArchived(archivedDate)
        localStorage.setItem(LAST_ACTIVE_KEY, today)
        if (onDayReset) onDayReset()
      }
    }, 60000) // check every minute
    return () => clearInterval(check)
  }, [onDayReset])

  const archives = loadArchives()
  const archiveDates = Object.keys(archives).sort().reverse()
  const today = todayDate()
  const todayAlreadyArchived = !!archives[today]

  const doClose = useCallback(() => {
    const archive = {}
    const counts = {}

    DAILY_KEYS.forEach(({ key, label }) => {
      try {
        const data = JSON.parse(localStorage.getItem(key) || '[]')
        archive[key] = data
        counts[label] = Array.isArray(data) ? data.length : (typeof data === 'object' ? Object.keys(data).length : 1)
      } catch {
        archive[key] = null
        counts[label] = 0
      }
    })

    archive._closedAt = new Date().toISOString()
    archive._counts = counts

    // Save to archives
    const all = loadArchives()
    all[today] = archive
    saveArchives(all)

    // Clear daily keys
    DAILY_KEYS.forEach(({ key }) => {
      localStorage.setItem(key, key === 'bc_compliance_done' ? '{}' : '[]')
      fetch('/api/store/' + key, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(key === 'bc_compliance_done' ? {} : []),
      }).catch(() => {})
    })

    setShowConfirm(false)
    if (onDayReset) onDayReset()
  }, [today, onDayReset])

  const attachDC = useCallback((date, dcData) => {
    const all = loadArchives()
    if (all[date]) {
      all[date].dc_report = dcData
      all[date]._dcAttachedAt = new Date().toISOString()
      saveArchives(all)
    }
    setShowDCAttach(null)
  }, [])

  const selectedArchive = selectedDate ? archives[selectedDate] : null

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
          }}>Day Close</span>
          <span style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3 }}>
            {archiveDates.length} archived day{archiveDates.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowArchive(!showArchive)} style={{
            fontFamily: FONT, fontSize: 8, fontWeight: 600,
            color: showArchive ? COLORS.green : COLORS.text3,
            background: showArchive ? COLORS.greenDim : 'transparent',
            border: `1px solid ${showArchive ? COLORS.green : COLORS.border}`,
            padding: '3px 8px', borderRadius: 2, cursor: 'pointer',
            letterSpacing: '0.06em',
          }}>ARCHIVES</button>
          <button onClick={() => setShowConfirm(true)} disabled={todayAlreadyArchived} style={{
            fontFamily: FONT, fontSize: 8, fontWeight: 600,
            color: todayAlreadyArchived ? COLORS.text3 : COLORS.amber,
            background: todayAlreadyArchived ? 'transparent' : COLORS.amberDim,
            border: `1px solid ${todayAlreadyArchived ? COLORS.border : COLORS.amber}`,
            padding: '3px 8px', borderRadius: 2, cursor: todayAlreadyArchived ? 'default' : 'pointer',
            letterSpacing: '0.06em',
          }}>
            {todayAlreadyArchived ? 'CLOSED' : 'CLOSE DAY'}
          </button>
        </div>
      </div>

      {/* Auto-archive notification */}
      {autoArchived && (
        <div style={{
          padding: '8px 16px', background: COLORS.greenDim,
          borderBottom: `1px solid ${COLORS.green}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontFamily: FONT, fontSize: 10, color: COLORS.green }}>
            Yesterday's data ({autoArchived}) was auto-archived. Starting fresh.
          </span>
          <button onClick={() => setAutoArchived(null)} style={{
            fontFamily: FONT, fontSize: 8, color: COLORS.text3,
            background: 'transparent', border: `1px solid ${COLORS.border}`,
            padding: '2px 6px', borderRadius: 2, cursor: 'pointer',
          }}>OK</button>
        </div>
      )}

      {/* Confirm dialog */}
      {showConfirm && (
        <div style={{
          padding: '12px 16px', background: COLORS.amberDim,
          borderBottom: `1px solid ${COLORS.amber}`,
        }}>
          <div style={{ fontFamily: FONT, fontSize: 11, color: COLORS.amber, fontWeight: 600, marginBottom: 6 }}>
            Archive today's data and start fresh?
          </div>
          <div style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text2, marginBottom: 10 }}>
            This saves all of today's samples, pack log, pack plan, pre-pack notes, and compliance
            completions under <b>{today}</b>. Working state resets for tomorrow.
            Receipts and settings are not affected.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={doClose} style={{
              fontFamily: FONT, fontSize: 10, fontWeight: 700,
              color: '#fff', background: COLORS.amber,
              border: 'none', padding: '8px 20px', borderRadius: 4, cursor: 'pointer',
            }}>ARCHIVE & RESET</button>
            <button onClick={() => setShowConfirm(false)} style={{
              fontFamily: FONT, fontSize: 10, color: COLORS.text3,
              background: 'transparent', border: `1px solid ${COLORS.border}`,
              padding: '8px 16px', borderRadius: 4, cursor: 'pointer',
            }}>CANCEL</button>
          </div>
        </div>
      )}

      {/* Archive browser */}
      {showArchive && (
        <div style={{ padding: '8px 16px', borderBottom: `1px solid ${COLORS.border}`, maxHeight: 400, overflowY: 'auto' }}>
          {archiveDates.length === 0 ? (
            <div style={{ fontFamily: FONT, fontSize: 10, color: COLORS.text3, padding: '12px 0', textAlign: 'center' }}>
              No archives yet
            </div>
          ) : (
            archiveDates.map(date => {
              const a = archives[date]
              const counts = a._counts || {}
              const hasDC = !!a.dc_report
              const isSelected = selectedDate === date

              return (
                <div key={date} style={{ marginBottom: 4 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px', background: isSelected ? COLORS.greenDim : COLORS.bg,
                    border: `1px solid ${isSelected ? COLORS.green : COLORS.border}`,
                    borderRadius: 3, cursor: 'pointer',
                  }} onClick={() => setSelectedDate(isSelected ? null : date)}>
                    <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: COLORS.text }}>
                      {date}
                    </span>
                    <span style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3 }}>
                      {counts['Sample History'] || 0} samples, {counts['Pack Log'] || 0} pallets
                    </span>
                    {hasDC && (
                      <span style={{
                        fontFamily: FONT, fontSize: 8, fontWeight: 600,
                        color: COLORS.green, background: COLORS.greenDim,
                        padding: '1px 5px', borderRadius: 2,
                      }}>DC</span>
                    )}
                    <div style={{ flex: 1 }} />
                    {!hasDC && (
                      <button onClick={e => { e.stopPropagation(); setShowDCAttach(date) }} style={{
                        fontFamily: FONT, fontSize: 8, color: COLORS.amber,
                        background: 'transparent', border: `1px solid ${COLORS.amber}`,
                        padding: '2px 6px', borderRadius: 2, cursor: 'pointer',
                      }}>+ DC REPORT</button>
                    )}
                  </div>

                  {/* Expanded archive detail */}
                  {isSelected && selectedArchive && (
                    <div style={{
                      padding: '8px 10px', margin: '2px 0 4px',
                      background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                      borderRadius: 3,
                    }}>
                      {DAILY_KEYS.map(({ key, label }) => {
                        const data = selectedArchive[key]
                        const count = Array.isArray(data) ? data.length
                          : (typeof data === 'object' && data ? Object.keys(data).length : 0)
                        return (
                          <div key={key} style={{
                            display: 'flex', justifyContent: 'space-between',
                            fontFamily: FONT, fontSize: 9, color: COLORS.text2,
                            padding: '2px 0',
                          }}>
                            <span>{label}</span>
                            <span style={{ color: count > 0 ? COLORS.text : COLORS.text3 }}>{count} records</span>
                          </div>
                        )
                      })}
                      <div style={{
                        fontFamily: FONT, fontSize: 8, color: COLORS.text3, marginTop: 4,
                      }}>
                        Closed at {new Date(selectedArchive._closedAt).toLocaleString()}
                        {selectedArchive._dcAttachedAt && ` · DC attached ${new Date(selectedArchive._dcAttachedAt).toLocaleString()}`}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* DC Report attach dialog */}
      {showDCAttach && (
        <DCAttachDialog
          date={showDCAttach}
          onAttach={(dcData) => attachDC(showDCAttach, dcData)}
          onClose={() => setShowDCAttach(null)}
        />
      )}
    </div>
  )
}

function DCAttachDialog({ date, onAttach, onClose }) {
  const [notes, setNotes] = useState('')
  const [result, setResult] = useState('accept') // accept | reject | partial

  return (
    <div style={{
      padding: '12px 16px', background: COLORS.bg3,
      borderBottom: `1px solid ${COLORS.border}`,
    }}>
      <div style={{ fontFamily: FONT, fontSize: 10, fontWeight: 600, color: COLORS.text, marginBottom: 8 }}>
        Attach DC Report for {date}
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {['accept', 'reject', 'partial'].map(r => (
          <button key={r} onClick={() => setResult(r)} style={{
            fontFamily: FONT, fontSize: 9, fontWeight: 600,
            color: result === r
              ? (r === 'accept' ? COLORS.green : r === 'reject' ? COLORS.red : COLORS.amber)
              : COLORS.text3,
            background: result === r
              ? (r === 'accept' ? COLORS.greenDim : r === 'reject' ? COLORS.redDim : COLORS.amberDim)
              : 'transparent',
            border: `1px solid ${result === r
              ? (r === 'accept' ? COLORS.green : r === 'reject' ? COLORS.red : COLORS.amber)
              : COLORS.border}`,
            padding: '4px 12px', borderRadius: 3, cursor: 'pointer',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>{r}</button>
        ))}
      </div>
      <textarea value={notes} onChange={e => setNotes(e.target.value)}
        placeholder="DC feedback notes, deductions, specific issues..."
        style={{
          fontFamily: FONT, fontSize: 10, width: '100%', minHeight: 60,
          padding: 8, border: `1px solid ${COLORS.border}`, borderRadius: 3,
          background: COLORS.bg, color: COLORS.text2, resize: 'vertical',
        }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={() => onAttach({ result, notes, attachedAt: new Date().toISOString() })} style={{
          fontFamily: FONT, fontSize: 10, fontWeight: 700,
          color: '#fff', background: COLORS.green,
          border: 'none', padding: '6px 16px', borderRadius: 4, cursor: 'pointer',
        }}>SAVE</button>
        <button onClick={onClose} style={{
          fontFamily: FONT, fontSize: 10, color: COLORS.text3,
          background: 'transparent', border: `1px solid ${COLORS.border}`,
          padding: '6px 16px', borderRadius: 4, cursor: 'pointer',
        }}>CANCEL</button>
      </div>
    </div>
  )
}
