import React from 'react'
import { COLORS, FONT } from '../constants'
import { FEATURE_CATALOG, FEATURE_PRESETS, applyPreset } from '../featureFlags'

export default function FeaturePanel({ features, setFeatures, onClose }) {
  const toggle = (key) => setFeatures(prev => ({ ...prev, [key]: !prev[key] }))
  const activeCount = Object.values(features).filter(Boolean).length
  const totalCount = Object.keys(features).length

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: COLORS.bg, borderRadius: 10,
        width: '90%', maxWidth: 600,
        padding: 24, maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 16,
        }}>
          <div>
            <div style={{ fontFamily: FONT, fontSize: 16, fontWeight: 700, color: COLORS.green }}>
              Features
            </div>
            <div style={{ fontFamily: FONT, fontSize: 11, color: COLORS.text3 }}>
              {activeCount}/{totalCount} active
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => {
              const all = {}
              Object.keys(features).forEach(k => { all[k] = true })
              setFeatures(all)
            }} style={quickBtn}>ALL ON</button>
            <button onClick={() => {
              const none = {}
              Object.keys(features).forEach(k => { none[k] = false })
              setFeatures(none)
            }} style={quickBtn}>ALL OFF</button>
            <button onClick={onClose} style={{
              ...quickBtn, color: COLORS.text3, borderColor: COLORS.border,
            }}>CLOSE</button>
          </div>
        </div>

        {/* Presets */}
        <div style={{
          display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap',
        }}>
          {FEATURE_PRESETS.map(p => (
            <button key={p.id} onClick={() => setFeatures(applyPreset(p))} style={{
              fontFamily: FONT, fontSize: 11, fontWeight: 600,
              color: p.color, background: p.bg,
              border: `1px solid ${p.color}`,
              padding: '6px 14px', borderRadius: 4, cursor: 'pointer',
            }}>
              {p.label}
              <div style={{ fontSize: 9, fontWeight: 400, opacity: 0.7 }}>{p.desc}</div>
            </button>
          ))}
        </div>

        {/* Categories + toggles */}
        {FEATURE_CATALOG.map(cat => (
          <div key={cat.category} style={{ marginBottom: 16 }}>
            <div style={{
              fontFamily: FONT, fontSize: 9, fontWeight: 600,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              color: COLORS.text3, marginBottom: 8,
            }}>
              {cat.category}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {cat.items.map(item => {
                const on = features[item.key]
                return (
                  <div key={item.key} onClick={() => toggle(item.key)} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '7px 12px', borderRadius: 4, cursor: 'pointer',
                    background: on ? COLORS.greenDim + '40' : COLORS.bg2,
                    border: `1px solid ${on ? COLORS.green + '40' : COLORS.border}`,
                  }}>
                    {/* Toggle switch */}
                    <div style={{
                      width: 32, height: 18, borderRadius: 9,
                      background: on ? COLORS.green : COLORS.border2,
                      position: 'relative', flexShrink: 0,
                      transition: 'background 0.2s',
                    }}>
                      <div style={{
                        width: 14, height: 14, borderRadius: '50%',
                        background: '#fff',
                        position: 'absolute', top: 2,
                        left: on ? 16 : 2,
                        transition: 'left 0.2s',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                      }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontFamily: FONT, fontSize: 12, fontWeight: 600,
                        color: on ? COLORS.text : COLORS.text3,
                      }}>
                        {item.label}
                      </div>
                      <div style={{
                        fontFamily: FONT, fontSize: 10, color: COLORS.text3,
                      }}>
                        {item.desc}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const quickBtn = {
  fontFamily: FONT, fontSize: 9, fontWeight: 600,
  color: COLORS.green, background: 'transparent',
  border: `1px solid ${COLORS.greenDim}`,
  padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
  letterSpacing: '0.06em',
}
