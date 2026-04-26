import React, { useState, useEffect } from 'react'
import { COLORS, FONT } from '../constants'

// mL per unit (US)
const ML = {
  mL: 1,
  L: 1000,
  tsp: 4.92892,
  tbsp: 14.7868,
  fl_oz: 29.5735,
  cup: 236.588,
  gal: 3785.41,
}

const CUP_FRACTIONS = [
  { label: '1/8', value: 0.125 },
  { label: '1/4', value: 0.25 },
  { label: '1/3', value: 1 / 3 },
  { label: '1/2', value: 0.5 },
  { label: '2/3', value: 2 / 3 },
  { label: '3/4', value: 0.75 },
]

function nearestCup(cups) {
  if (cups < 0.1) return null
  const whole = Math.floor(cups)
  const rem = cups - whole
  if (rem < 0.0625) return whole === 1 ? '1 cup' : `${whole} cups`
  if (rem > 0.9375) {
    const up = whole + 1
    return up === 1 ? '1 cup' : `${up} cups`
  }
  let best = CUP_FRACTIONS[0]
  for (const f of CUP_FRACTIONS) {
    if (Math.abs(rem - f.value) < Math.abs(rem - best.value)) best = f
  }
  if (whole === 0) return `${best.label} cup`
  return `${whole} ${best.label} cups`
}

const BLEACH_KEY = 'bc_sanitizer_calc_bleach'
const SELECT_KEY = 'bc_sanitizer_calc_selectrocide'

function loadPrefs(key, fallback) {
  try { return { ...fallback, ...JSON.parse(localStorage.getItem(key) || '{}') } } catch { return fallback }
}

const DEFAULT_BLEACH = {
  concentration: 8.25,
  targetPpm: 200,
  mixVolume: 4,
  mixUnit: 'gal',
}

const DEFAULT_SELECT = {
  stockPpm: 500,
  targetPpm: 5,
  mixVolume: 4,
  mixUnit: 'gal',
}

export default function SanitizerCalculator({ onClose }) {
  const [tab, setTab] = useState('bleach')
  const [bleach, setBleach] = useState(() => loadPrefs(BLEACH_KEY, DEFAULT_BLEACH))
  const [select, setSelect] = useState(() => loadPrefs(SELECT_KEY, DEFAULT_SELECT))

  useEffect(() => { localStorage.setItem(BLEACH_KEY, JSON.stringify(bleach)) }, [bleach])
  useEffect(() => { localStorage.setItem(SELECT_KEY, JSON.stringify(select)) }, [select])

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 6, width: '95%', maxWidth: 640,
        maxHeight: '90vh', overflow: 'auto', boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
      }}>
        <div style={{
          padding: '14px 24px', borderBottom: `1px solid ${COLORS.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, letterSpacing: 0.5 }}>
            SANITIZER CALCULATOR
          </div>
          <button onClick={onClose} style={{
            fontFamily: FONT, fontSize: 10, color: COLORS.text3,
            background: '#f5f5f5', border: `1px solid ${COLORS.border}`,
            padding: '4px 12px', borderRadius: 3, cursor: 'pointer',
          }}>CLOSE</button>
        </div>

        <div style={{ display: 'flex', borderBottom: `1px solid ${COLORS.border}` }}>
          <TabBtn active={tab === 'bleach'} onClick={() => setTab('bleach')}>BLEACH</TabBtn>
          <TabBtn active={tab === 'selectrocide'} onClick={() => setTab('selectrocide')}>SELECTROCIDE</TabBtn>
        </div>

        <div style={{ padding: 20 }}>
          {tab === 'bleach' && <BleachCalc s={bleach} set={setBleach} />}
          {tab === 'selectrocide' && <SelectrocideCalc s={select} set={setSelect} />}
        </div>
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '12px 16px',
      fontFamily: FONT, fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
      color: active ? COLORS.green : COLORS.text3,
      background: active ? COLORS.greenDim : '#fafafa',
      border: 'none',
      borderBottom: active ? `2px solid ${COLORS.green}` : '2px solid transparent',
      cursor: 'pointer',
    }}>{children}</button>
  )
}

function BleachCalc({ s, set }) {
  // stock ppm = concentration% * 10,000
  const stockPpm = (parseFloat(s.concentration) || 0) * 10000
  return (
    <>
      <Field label="Bleach strength">
        <NumInput value={s.concentration} onChange={v => set({ ...s, concentration: v })} suffix="%" step={0.25} />
        <Chips values={[5.25, 6, 7.5, 8.25, 10, 12.5]} suffix="%" active={s.concentration}
          onPick={v => set({ ...s, concentration: v })} />
      </Field>

      <Field label="Target ppm">
        <NumInput value={s.targetPpm} onChange={v => set({ ...s, targetPpm: v })} suffix="ppm" />
        <Chips values={[50, 100, 150, 200, 500, 600]} active={s.targetPpm}
          onPick={v => set({ ...s, targetPpm: v })} />
      </Field>

      <VolumeField s={s} set={set} />

      <Output stockPpm={stockPpm} targetPpm={parseFloat(s.targetPpm) || 0} mixVolumeMl={volToMl(s)} />
    </>
  )
}

function SelectrocideCalc({ s, set }) {
  return (
    <>
      <div style={{
        fontSize: 10, color: COLORS.text2, background: COLORS.bg2,
        padding: '8px 10px', borderRadius: 3, marginBottom: 14, lineHeight: 1.5,
      }}>
        Selectrocide comes in activated bottles (pouch + water). Enter the stock ppm your
        activated bottle ends up at — check the label or your recipe. Update anytime.
      </div>

      <Field label="Stock concentration">
        <NumInput value={s.stockPpm} onChange={v => set({ ...s, stockPpm: v })} suffix="ppm" />
        <Chips values={[100, 500, 1000, 3000]} suffix="ppm" active={s.stockPpm}
          onPick={v => set({ ...s, stockPpm: v })} />
      </Field>

      <Field label="Target ppm">
        <NumInput value={s.targetPpm} onChange={v => set({ ...s, targetPpm: v })} suffix="ppm" step={0.5} />
        <Chips values={[1, 5, 20, 100, 200]} active={s.targetPpm}
          onPick={v => set({ ...s, targetPpm: v })} />
      </Field>

      <VolumeField s={s} set={set} />

      <Output
        stockPpm={parseFloat(s.stockPpm) || 0}
        targetPpm={parseFloat(s.targetPpm) || 0}
        mixVolumeMl={volToMl(s)}
      />
    </>
  )
}

function VolumeField({ s, set }) {
  return (
    <Field label="Mix volume">
      <div style={{ display: 'flex', gap: 8 }}>
        <NumInput value={s.mixVolume} onChange={v => set({ ...s, mixVolume: v })} />
        <select value={s.mixUnit} onChange={e => set({ ...s, mixUnit: e.target.value })}
          style={{
            fontFamily: FONT, fontSize: 12, padding: '6px 8px',
            border: `1px solid ${COLORS.border}`, borderRadius: 3, background: '#fff',
          }}>
          <option value="gal">gal</option>
          <option value="L">L</option>
        </select>
      </div>
      <Chips
        values={s.mixUnit === 'gal' ? [1, 4, 5, 55, 60] : [1, 4, 10, 20, 200]}
        suffix={` ${s.mixUnit}`}
        active={s.mixVolume}
        onPick={v => set({ ...s, mixVolume: v })}
      />
    </Field>
  )
}

function volToMl(s) {
  const v = parseFloat(s.mixVolume) || 0
  return v * (ML[s.mixUnit] || 1)
}

function Output({ stockPpm, targetPpm, mixVolumeMl }) {
  const valid = stockPpm > 0 && targetPpm > 0 && mixVolumeMl > 0 && targetPpm <= stockPpm
  const additiveMl = valid ? (targetPpm / stockPpm) * mixVolumeMl : 0

  const fl_oz = additiveMl / ML.fl_oz
  const tbsp = additiveMl / ML.tbsp
  const tsp = additiveMl / ML.tsp
  const cups = additiveMl / ML.cup
  const cupLabel = nearestCup(cups)

  const bigNum = (n, unit, precision = 2) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
      <span style={{ fontSize: 22, fontWeight: 700, color: COLORS.text }}>{n.toFixed(precision)}</span>
      <span style={{ fontSize: 11, color: COLORS.text2 }}>{unit}</span>
    </div>
  )

  if (!valid) {
    return (
      <div style={{
        marginTop: 18, padding: 16, background: COLORS.bg2, borderRadius: 4,
        fontSize: 11, color: COLORS.text2, textAlign: 'center',
      }}>
        {targetPpm > stockPpm
          ? 'Target ppm is higher than stock — check your inputs.'
          : 'Enter concentration, target ppm, and mix volume to see the recipe.'}
      </div>
    )
  }

  return (
    <div style={{
      marginTop: 18, padding: 16,
      background: COLORS.greenDim, border: `1px solid ${COLORS.green}`, borderRadius: 4,
    }}>
      <div style={{ fontSize: 10, color: COLORS.green, fontWeight: 700, letterSpacing: 0.5, marginBottom: 10 }}>
        ADD TO WATER
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 8,
      }}>
        {bigNum(fl_oz, 'fl oz', fl_oz < 1 ? 3 : 2)}
        {bigNum(additiveMl, 'mL', additiveMl < 10 ? 1 : 0)}
        {bigNum(tbsp, 'tbsp', tbsp < 1 ? 2 : 1)}
        {bigNum(tsp, 'tsp', 1)}
      </div>
      {cupLabel && (
        <div style={{
          marginTop: 10, paddingTop: 10, borderTop: `1px solid ${COLORS.green}`,
          fontSize: 14, color: COLORS.text, fontWeight: 600,
        }}>
          ≈ {cupLabel}
          <span style={{ fontSize: 10, color: COLORS.text2, fontWeight: 400, marginLeft: 6 }}>
            ({cups.toFixed(2)} cup)
          </span>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.text2, letterSpacing: 0.5, marginBottom: 6 }}>
        {label.toUpperCase()}
      </div>
      {children}
    </div>
  )
}

function NumInput({ value, onChange, suffix, step = 1 }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <input
        type="number"
        value={value}
        step={step}
        onChange={e => onChange(e.target.value)}
        style={{
          fontFamily: FONT, fontSize: 13, width: 90, padding: '6px 8px',
          border: `1px solid ${COLORS.border}`, borderRadius: 3, background: '#fff',
        }}
      />
      {suffix && <span style={{ fontSize: 11, color: COLORS.text2 }}>{suffix}</span>}
    </div>
  )
}

function Chips({ values, active, onPick, suffix = '' }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
      {values.map(v => {
        const isActive = Math.abs((parseFloat(active) || 0) - v) < 0.001
        return (
          <button key={v} onClick={() => onPick(v)} style={{
            fontFamily: FONT, fontSize: 10, fontWeight: isActive ? 700 : 500,
            color: isActive ? COLORS.green : COLORS.text2,
            background: isActive ? COLORS.greenDim : '#fafafa',
            border: `1px solid ${isActive ? COLORS.green : COLORS.border}`,
            padding: '3px 8px', borderRadius: 10, cursor: 'pointer',
          }}>{v}{suffix}</button>
        )
      })}
    </div>
  )
}
