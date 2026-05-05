import React from 'react'
import { COLORS, FONT } from '../constants'

const GRADE_COLORS = {
  good: '#85C5A8',
  fair: COLORS.amber,
  poor: COLORS.red,
}

const GRADE_LABELS_SHORT = {
  good: 'G',
  fair: 'F',
  poor: 'P',
}

export default function DefectHeadroomBar({ drops }) {
  if (!drops || drops.length === 0) return null

  const max = drops[drops.length - 1].plus
  const range = max + Math.max(1, Math.ceil(max * 0.15))

  return (
    <div style={{ marginTop: 5, fontFamily: FONT }}>
      <div style={{
        height: 4, background: COLORS.bg3, borderRadius: 2, position: 'relative',
        overflow: 'visible',
      }}>
        {drops.map((d, i) => {
          const segLeft = ((i === 0 ? 0 : drops[i - 1].plus) / range) * 100
          const segRight = (d.plus / range) * 100
          return (
            <React.Fragment key={d.toGrade + '-' + i}>
              <div style={{
                position: 'absolute', left: `${segLeft}%`,
                width: `${segRight - segLeft}%`, top: 0, height: '100%',
                background: GRADE_COLORS[d.toGrade] + '55',
              }} />
              <div style={{
                position: 'absolute', left: `${segRight}%`, top: -2,
                width: 1, height: 8, background: GRADE_COLORS[d.toGrade],
              }} />
            </React.Fragment>
          )
        })}
      </div>
      <div style={{
        marginTop: 3, fontSize: 8, letterSpacing: '0.04em',
        display: 'flex', gap: 5, flexWrap: 'wrap',
      }}>
        {drops.map((d, i) => (
          <span key={d.toGrade + '-' + i} style={{
            color: GRADE_COLORS[d.toGrade], fontWeight: 700,
          }}>
            +{d.plus}{GRADE_LABELS_SHORT[d.toGrade]}
          </span>
        ))}
      </div>
    </div>
  )
}
