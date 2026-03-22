import React, { useState, useEffect } from 'react'
import { COLORS, FONT } from '../constants'
import { getCoolerStats, getActiveReceiptsWithStats, getReceiptStats } from '../receipts'

export default function LineMonitor() {
  const [cooler, setCooler] = useState(null)
  const [receipts, setReceipts] = useState([])

  const refresh = () => {
    setCooler(getCoolerStats())
    setReceipts(getActiveReceiptsWithStats())
  }

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 5000) // refresh every 5s
    return () => clearInterval(interval)
  }, [])

  if (!cooler) return null

  const statBox = (label, value, unit, color) => (
    <div style={{
      background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
      borderRadius: 4, padding: 14, textAlign: 'center',
    }}>
      <div style={{
        fontFamily: FONT, fontSize: 9, fontWeight: 600,
        letterSpacing: '0.12em', textTransform: 'uppercase',
        color: COLORS.text3, marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: FONT, fontSize: 24, fontWeight: 700,
        color: color || COLORS.text,
      }}>
        {value}
      </div>
      {unit && (
        <div style={{
          fontFamily: FONT, fontSize: 9, color: COLORS.text3,
          marginTop: 2,
        }}>
          {unit}
        </div>
      )}
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{
        fontFamily: FONT, fontSize: 11, fontWeight: 600,
        letterSpacing: '0.1em', textTransform: 'uppercase',
        color: COLORS.text2, marginBottom: 12,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>Line Monitor</span>
        <span style={{ fontSize: 9, color: COLORS.text3, fontWeight: 400 }}>
          {cooler.scansToday} scans today — refreshes every 5s
        </span>
      </div>

      {/* Top stats row */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 10, marginBottom: 16,
      }}>
        {statBox(
          'Cooler Inventory',
          cooler.totalRemainingLbs > 0 ? cooler.totalRemainingLbs.toLocaleString() : '0',
          'lbs remaining',
          cooler.totalRemainingLbs > 0 ? COLORS.amber : COLORS.green
        )}
        {statBox(
          'Pallets Remaining',
          cooler.totalRemainingPallets,
          `of ${cooler.totalExpectedPallets} total`,
          cooler.totalRemainingPallets > 0 ? COLORS.text : COLORS.green
        )}
        {statBox(
          'Line Rate',
          cooler.overallLbsPerHour > 0 ? cooler.overallLbsPerHour.toLocaleString() : '—',
          cooler.overallLbsPerHour > 0 ? 'lbs/hr' : 'waiting for scans',
          COLORS.green
        )}
        {statBox(
          'Active Receipts',
          cooler.activeReceipts,
          `${cooler.scansToday} scans today`,
          COLORS.text
        )}
      </div>

      {/* FIFO warnings */}
      {cooler.fifoWarnings.length > 0 && (() => {
        // Check if any old receipts are being skipped
        const oldestUnstarted = cooler.fifoWarnings.find(r => r.stats.scanned === 0)
        if (!oldestUnstarted) return null

        const age = Math.round(
          (Date.now() - new Date(oldestUnstarted.createdAt).getTime()) / (1000 * 60 * 60)
        )
        if (age < 12) return null // don't warn if less than 12 hours old

        return (
          <div style={{
            background: COLORS.amberDim + '40', border: `1px solid ${COLORS.amber}`,
            borderRadius: 4, padding: '10px 14px', marginBottom: 16,
            fontFamily: FONT, fontSize: 11, color: COLORS.amber,
          }}>
            FIFO: {oldestUnstarted.receiptNum} ({oldestUnstarted.grower}) has been waiting {age}+ hours
            — {oldestUnstarted.stats.remaining} pallets not yet started
          </div>
        )
      })()}

      {/* Receipt progress list */}
      {receipts.length > 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {receipts.map(r => {
            const stats = r.stats
            const isComplete = stats.pctComplete >= 100
            const isStarted = stats.scanned > 0

            return (
              <div key={r.id} style={{
                display: 'grid',
                gridTemplateColumns: '90px 140px 1fr 80px 90px',
                gap: 10, alignItems: 'center',
                padding: '8px 12px',
                background: COLORS.bg2,
                border: `1px solid ${COLORS.border}`,
                borderLeft: `3px solid ${isComplete ? COLORS.green : isStarted ? COLORS.amber : COLORS.text3}`,
                borderRadius: 3,
                opacity: isComplete ? 0.6 : 1,
              }}>
                <div style={{
                  fontFamily: FONT, fontSize: 12, fontWeight: 700,
                  color: COLORS.green,
                }}>
                  {r.receiptNum}
                </div>
                <div>
                  <div style={{
                    fontFamily: FONT, fontSize: 11, color: COLORS.text,
                    fontWeight: 600,
                  }}>
                    {r.grower}
                  </div>
                  <div style={{
                    fontFamily: FONT, fontSize: 9, color: COLORS.text3,
                  }}>
                    {[r.variety, r.block].filter(Boolean).join(' / ') || '—'}
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div style={{
                    height: 6, background: COLORS.bg3, borderRadius: 3,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      background: isComplete ? COLORS.green : isStarted ? COLORS.amber : COLORS.text3,
                      width: `${Math.min(100, stats.pctComplete)}%`,
                      transition: 'width 0.3s',
                    }} />
                  </div>
                </div>

                <div style={{
                  fontFamily: FONT, fontSize: 12, fontWeight: 600,
                  color: isComplete ? COLORS.green : COLORS.text,
                  textAlign: 'right',
                }}>
                  {stats.scanned}/{r.expectedPallets}
                </div>

                <div style={{
                  fontFamily: FONT, fontSize: 10,
                  color: COLORS.text3, textAlign: 'right',
                }}>
                  {stats.lbsPerHour > 0
                    ? `${stats.lbsPerHour.toLocaleString()} lb/h`
                    : stats.lbsRemaining > 0
                      ? `${stats.lbsRemaining.toLocaleString()} lb`
                      : '—'
                  }
                </div>
              </div>
            )
          })}
        </div>
      )}

      {receipts.length === 0 && (
        <div style={{
          fontFamily: FONT, fontSize: 12, color: COLORS.text3,
          textAlign: 'center', padding: 30,
        }}>
          No active receipts. Create receipts to start tracking.
        </div>
      )}
    </div>
  )
}
