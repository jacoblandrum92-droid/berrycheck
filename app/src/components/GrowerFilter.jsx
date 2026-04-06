import React, { useState, useMemo } from 'react'
import { COLORS, FONT } from '../constants'

/**
 * Grower filter bar — shared across SpeedQuality and GrowerTrends.
 * Defaults to the grower with the most pallets (the house grower).
 * Uses render-prop pattern: children receives the selected grower string.
 */
export default function GrowerFilter({ history, children }) {
  // Build grower list sorted by pallet count (most pallets = house grower = default)
  const growers = useMemo(() => {
    const map = {}
    for (const s of history) {
      if (!s.grower || s.isSkipped) continue
      if (!map[s.grower]) map[s.grower] = new Set()
      if (s.dailyPalletNum) map[s.grower].add(s.dailyPalletNum)
    }
    return Object.entries(map)
      .map(([grower, pallets]) => ({ grower, palletCount: pallets.size }))
      .sort((a, b) => b.palletCount - a.palletCount)
  }, [history])

  const [selected, setSelected] = useState(null)

  // Default to top grower (most pallets)
  const activeGrower = selected || (growers.length > 0 ? growers[0].grower : null)

  if (growers.length === 0) return children(null)

  return (
    <div>
      {/* Filter bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        marginBottom: 12, flexWrap: 'wrap',
      }}>
        <div style={{
          fontFamily: FONT, fontSize: 9, fontWeight: 600,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color: COLORS.text3, marginRight: 4,
        }}>
          Grower
        </div>
        {growers.map(g => {
          const isActive = g.grower === activeGrower
          return (
            <button key={g.grower} onClick={() => setSelected(g.grower)}
              style={{
                fontFamily: FONT, fontSize: 11, fontWeight: isActive ? 700 : 400,
                color: isActive ? COLORS.green : COLORS.text2,
                background: isActive ? COLORS.greenDim : 'transparent',
                border: `1px solid ${isActive ? COLORS.green : COLORS.border}`,
                padding: '5px 12px', borderRadius: 4, cursor: 'pointer',
              }}>
              {g.grower}
              <span style={{
                fontSize: 9, color: isActive ? COLORS.green : COLORS.text3,
                marginLeft: 5,
              }}>
                {g.palletCount}
              </span>
            </button>
          )
        })}
      </div>

      {/* Render children with selected grower */}
      {children(activeGrower)}
    </div>
  )
}
