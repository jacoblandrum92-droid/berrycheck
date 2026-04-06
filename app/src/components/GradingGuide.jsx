import React from 'react'
import { COLORS, FONT } from '../constants'

export default function GradingGuide({ onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: COLORS.bg, border: `1px solid ${COLORS.border}`,
        borderRadius: 8, width: '95%', maxWidth: 800, maxHeight: '90vh',
        overflowY: 'auto', padding: 28,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 20,
        }}>
          <div style={{
            fontFamily: FONT, fontSize: 14, fontWeight: 700,
            color: COLORS.green, letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            MBG Grading Quick Reference
          </div>
          <button onClick={onClose} style={{
            fontFamily: FONT, fontSize: 11, color: COLORS.text3,
            background: 'transparent', border: `1px solid ${COLORS.border}`,
            padding: '6px 14px', borderRadius: 4, cursor: 'pointer',
          }}>CLOSE</button>
        </div>

        {/* QC Step-by-step */}
        <div style={{
          background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
          borderRadius: 6, padding: 16, marginBottom: 20,
        }}>
          <div style={sectionTitle}>QC Sampling Procedure — Step by Step</div>
          <ol style={{ ...listStyle, paddingLeft: 22, lineHeight: 2.2 }}>
            <li><strong>Pull a clamshell</strong> from the packed pallet. SOP = 3 samples per pallet: bottom layer, middle layer, top layer.</li>
            <li><strong>Weigh 600 grams</strong> of fruit onto a clean tray. This is your sample. Record gross weight, subtract clamshell tare for net.</li>
            <li><strong>Pull a 30-berry subsample</strong> and weigh it. This gives you berry size (Small &le;33g, Medium 34–65g, Large &ge;66g) and lets you calculate total berry count: <em>600g &divide; (30-berry weight &divide; 30)</em>.</li>
            <li><strong>Baxlo firmness</strong> (if equipped): Pick 4–5 representative berries. Press each against the durometer needle on both sides. Average all readings. Firm &ge;70, Sensitive 60–64, Soft &le;59.</li>
            <li><strong>Sort the sample</strong> into piles. Remove defects from the good berries:
              <ul style={{ marginTop: 4 }}>
                <li><strong>Permanent pile</strong> — stems, green/red berries, scars. These won't change in transit.</li>
                <li><strong>Condition pile</strong> — soft, bruise, shrivel, crushed, leaky/split. These get worse in transit.</li>
                <li><strong>Decay pile</strong> — rot (Alternaria, Anthracnose), white mold (Botrytis). Any white mold = auto Poor.</li>
              </ul>
            </li>
            <li><strong>Count each pile</strong> and enter into BerryCheck. Use Quick mode (3 piles) for speed or Detailed mode (individual defect types) for full MBG-accurate grading with sub-limit checks.</li>
            <li><strong>Log the sample</strong>. The grade is calculated automatically from defect percentages. Check the headroom bars to see how close you are to dropping a grade.</li>
            <li><strong>Discard sample berries</strong> before pulling the next sample. Do not return them to the clamshell.</li>
          </ol>
          <div style={{ ...bodySmall, marginTop: 8, fontStyle: 'italic' }}>
            Why 600g? MBG standardizes on a weight-based sample to normalize across berry sizes. The 30-berry subsample converts weight to count so percentages are accurate regardless of whether you're running small Farthings or jumbo Meadowlarks.
          </div>
        </div>

        {/* Three piles */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
          {/* Permanent */}
          <div style={{
            background: COLORS.amberDim, border: `1px solid ${COLORS.amber}`,
            borderRadius: 6, padding: 16,
          }}>
            <div style={{ ...sectionTitle, color: COLORS.amber }}>Permanent Defects</div>
            <div style={{ ...bodySmall, marginBottom: 8 }}>Won't change in transit. Sort these first.</div>
            <ul style={listStyle}>
              <li><strong>Stems</strong> — any berry with an attached stem</li>
              <li><strong>Green</strong> — 10%+ of berry surface green</li>
              <li><strong>Red</strong> — 20%+ of berry surface red</li>
              <li><strong>Scars</strong> — 20%+ brown necrotic tissue (bird peck, dry split, frost, exobasidium, tears)</li>
            </ul>
          </div>

          {/* Condition */}
          <div style={{
            background: '#FDF0E9', border: '1px solid #D85A30',
            borderRadius: 6, padding: 16,
          }}>
            <div style={{ ...sectionTitle, color: '#D85A30' }}>Condition Defects</div>
            <div style={{ ...bodySmall, marginBottom: 8 }}>Can worsen during shipment/storage.</div>
            <ul style={listStyle}>
              <li><strong>Soft</strong> — uniformly soft to touch, stays flat from pressure</li>
              <li><strong>Bruise</strong> — soft in one spot, not losing shape</li>
              <li><strong>Shrivel</strong> — wrinkled, dehydrated appearance</li>
              <li><strong>Crushed</strong> — broken skin, lost shape from mechanical damage</li>
              <li><strong>Leaky/Split</strong> — wet from juice, overripe splits, wet crush</li>
            </ul>
          </div>

          {/* Decay */}
          <div style={{
            background: COLORS.redDim, border: `1px solid ${COLORS.red}`,
            borderRadius: 6, padding: 16,
          }}>
            <div style={{ ...sectionTitle, color: COLORS.red }}>Decay / Mold</div>
            <div style={{ ...bodySmall, marginBottom: 8 }}>Any decay = cannot grade Excellent.</div>
            <ul style={listStyle}>
              <li><strong>Decay</strong> — Alternaria or Anthracnose rot, decomposition from bacteria/fungi</li>
              <li><strong>White Mold</strong> — Botrytis (gray/white mold). Any amount = Poor grade</li>
            </ul>
          </div>
        </div>

        {/* Grade thresholds table */}
        <div style={{
          background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
          borderRadius: 6, padding: 16, marginBottom: 20,
        }}>
          <div style={sectionTitle}>Grade Thresholds (Maximum %)</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
            <thead>
              <tr>
                <th style={thStyle}></th>
                <th style={{ ...thStyle, color: COLORS.green }}>Excellent</th>
                <th style={{ ...thStyle, color: COLORS.green }}>Good</th>
                <th style={{ ...thStyle, color: COLORS.amber }}>Fair</th>
                <th style={{ ...thStyle, color: COLORS.red }}>Poor</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdLabel}>Permanent Defects</td>
                <td style={tdVal}>&le; 5%</td>
                <td style={tdVal}>&le; 7%</td>
                <td style={tdVal}>&le; 9%</td>
                <td style={tdVal}>&gt; 9%</td>
              </tr>
              <tr>
                <td style={tdLabel}>Condition Defects</td>
                <td style={tdVal}>&le; 3%</td>
                <td style={tdVal}>&le; 4%</td>
                <td style={tdVal}>&le; 6%</td>
                <td style={tdVal}>&gt; 6%</td>
              </tr>
              <tr style={{ borderTop: `2px solid ${COLORS.border}` }}>
                <td style={{ ...tdLabel, fontWeight: 700 }}>Total Combined</td>
                <td style={{ ...tdVal, fontWeight: 700 }}>&le; 7%</td>
                <td style={{ ...tdVal, fontWeight: 700 }}>&le; 10%</td>
                <td style={{ ...tdVal, fontWeight: 700 }}>&le; 14%</td>
                <td style={{ ...tdVal, fontWeight: 700 }}>&gt; 14%</td>
              </tr>
              <tr>
                <td style={tdLabel}>Decay</td>
                <td style={tdVal}>0%</td>
                <td style={tdVal}>&le; 1%</td>
                <td style={tdVal}>&le; 1.78%</td>
                <td style={tdVal}>&gt; 1.78%</td>
              </tr>
              <tr>
                <td style={tdLabel}>White Mold</td>
                <td style={tdVal}>0%</td>
                <td style={{ ...tdVal, color: COLORS.red }}>Any = Poor</td>
                <td style={{ ...tdVal, color: COLORS.red }}>Any = Poor</td>
                <td style={tdVal}>—</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Berry size + firmness */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{
            background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
            borderRadius: 6, padding: 16,
          }}>
            <div style={sectionTitle}>Berry Size (30-berry sample)</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
              <tbody>
                <tr><td style={tdLabel}>Small</td><td style={tdVal}>&le; 33g (&le; 13mm)</td></tr>
                <tr><td style={tdLabel}>Medium</td><td style={tdVal}>34–65g (14–17mm)</td></tr>
                <tr><td style={tdLabel}>Large</td><td style={tdVal}>&ge; 66g (&ge; 18mm)</td></tr>
              </tbody>
            </table>
          </div>

          <div style={{
            background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
            borderRadius: 6, padding: 16,
          }}>
            <div style={sectionTitle}>Firmness (Baxlo)</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
              <tbody>
                <tr><td style={tdLabel}>Firm</td><td style={tdVal}>&ge; 70</td></tr>
                <tr><td style={tdLabel}>Moderately Firm</td><td style={tdVal}>65–69</td></tr>
                <tr><td style={tdLabel}>Sensitive</td><td style={tdVal}>60–64</td></tr>
                <tr><td style={tdLabel}>Soft</td><td style={tdVal}>&le; 59</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Riding the line */}
        <div style={{
          background: COLORS.greenDim, border: `1px solid ${COLORS.green}`,
          borderRadius: 6, padding: 16, marginTop: 20,
        }}>
          <div style={{ ...sectionTitle, color: COLORS.green }}>Reading the Headroom Bars</div>
          <div style={bodyText}>
            The headroom bars show how much room you have before dropping a grade. Watch the <strong>Tightest</strong> number — that's your bottleneck. If it says "Condition Defects 1.2% room" — that's what will drop you from Good to Fair first. Push speed until the tightest category gets uncomfortable, then back off.
          </div>
        </div>
      </div>
    </div>
  )
}

const sectionTitle = {
  fontFamily: FONT, fontSize: 12, fontWeight: 700,
  color: '#1a1a1a', letterSpacing: '0.04em',
  marginBottom: 6,
}

const bodyText = {
  fontFamily: FONT, fontSize: 12, color: '#444',
  lineHeight: 1.6,
}

const bodySmall = {
  fontFamily: FONT, fontSize: 11, color: '#666',
  lineHeight: 1.5,
}

const listStyle = {
  fontFamily: FONT, fontSize: 11, color: '#333',
  lineHeight: 1.8, paddingLeft: 18, margin: 0,
}

const thStyle = {
  fontFamily: FONT, fontSize: 10, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.06em',
  padding: '8px 10px', textAlign: 'center',
  borderBottom: '1px solid #ddd',
}

const tdLabel = {
  fontFamily: FONT, fontSize: 11, color: '#333',
  padding: '6px 10px', borderBottom: '1px solid #eee',
}

const tdVal = {
  fontFamily: FONT, fontSize: 11, color: '#1a1a1a',
  padding: '6px 10px', textAlign: 'center',
  borderBottom: '1px solid #eee',
}
