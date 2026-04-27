import React, { useState } from 'react'
import PalletLoadTracker from './PalletLoadTracker'
import InventoryTally from './InventoryTally'

/**
 * ShedTools — phone hub for the standalone phone tools.
 *
 * Single URL (?mode=tools) bookmarks both tools. Picker lets the user open
 * either Pallet Load Tracker or Inventory Tally; back-to-tools button
 * returns to the picker without losing tool state (each tool persists in
 * its own localStorage key).
 *
 * NOT tied to BerryCheck data. Standalone, mobile-first.
 */
const C = {
  bg: '#f5f5f3',
  card: '#ffffff',
  border: '#dcdcd8',
  text: '#1a1a1a',
  textDim: '#6c6c68',
  green: '#0F6E56',
  greenSoft: '#E1F5EE',
  amber: '#BA7517',
  amberSoft: '#FAEEDA',
  purple: '#534AB7',
  purpleSoft: '#ECEAF8',
}
const F = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"

export default function ShedTools() {
  const [active, setActive] = useState(null) // null | 'load' | 'inv'

  if (active === 'load') {
    return <PalletLoadTracker onBack={() => setActive(null)} />
  }
  if (active === 'inv') {
    return <InventoryTally onBack={() => setActive(null)} />
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.bg,
      fontFamily: F, color: C.text,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '40px 20px',
    }}>
      <div style={{ width: 'min(440px, 100%)', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, color: C.textDim,
            letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 4,
          }}>Phone Tools</div>
          <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>Shed Tools</div>
          <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.5 }}>
            Pick a tool. Each one saves its own state, so you can switch back
            and forth without losing progress.
          </div>
        </div>

        <ToolCard
          accent={C.green}
          accentSoft={C.greenSoft}
          icon="📦"
          title="Pallet Load Tracker"
          desc="Generate a list from a number range. Tap each pallet as you load it. Get a sorted list at the end for the shed shipping program."
          onClick={() => setActive('load')}
        />

        <ToolCard
          accent={C.purple}
          accentSoft={C.purpleSoft}
          icon="📋"
          title="Inventory Tally"
          desc="Walk the shed and count clamshells, rolls, boxes, hairnets — anything. Add products on the fly. Tap a row to +1 like an umpire counter."
          onClick={() => setActive('inv')}
        />
      </div>
    </div>
  )
}

function ToolCard({ accent, accentSoft, icon, title, desc, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left',
        background: C.card,
        border: `2px solid ${accent}`,
        borderRadius: 12, padding: '18px 20px',
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: 8,
        boxShadow: `0 2px 8px ${accent}22`,
        touchAction: 'manipulation',
        transition: 'transform 0.05s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 44, height: 44,
          background: accentSoft, borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22,
        }}>{icon}</div>
        <div style={{
          fontFamily: F, fontSize: 18, fontWeight: 800,
          color: accent, letterSpacing: '0.02em',
        }}>{title}</div>
      </div>
      <div style={{
        fontFamily: F, fontSize: 12, color: C.textDim,
        lineHeight: 1.5,
      }}>{desc}</div>
    </button>
  )
}
