import React, { useState, useRef, useEffect } from 'react'
import QRCode from 'qrcode'
import { COLORS, FONT } from '../constants'

/**
 * LogCapture — photograph a handwritten log, transcribe with AI, edit, save.
 * Works as a modal overlay. Pass the log code and date to associate the capture.
 */

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

const CHEM_STORAGE_KEY = 'bc_chemical_inventory'

export default function LogCapture({ logCode, logLabel, onSave, onClose }) {
  const [image, setImage] = useState(null) // base64 data URL
  const [transcription, setTranscription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [waitingForPhone, setWaitingForPhone] = useState(false)
  const [localIP, setLocalIP] = useState(null)
  const [parsedTx, setParsedTx] = useState(null)     // parsed chemical transactions
  const [parsingChem, setParsingChem] = useState(false)
  const [chemSaved, setChemSaved] = useState(false)
  const fileRef = useRef(null)
  const qrCanvasRef = useRef(null)
  const wsRef = useRef(null)

  const isChemLog = logCode === 'FCHEM' || logCode === 'PCHEM'
  const [formRows, setFormRows] = useState(null) // structured form data for chem logs
  const [parsingForm, setParsingForm] = useState(false)

  // Get local IP for QR code
  useEffect(() => {
    fetch('/api/ip').then(r => r.json()).then(d => setLocalIP(d)).catch(() => {})
  }, [])

  // Render QR code when shown
  useEffect(() => {
    if (showQR && qrCanvasRef.current && localIP) {
      const url = `http://${localIP.ip}:${localIP.port}/?mode=phone&for=document`
      QRCode.toCanvas(qrCanvasRef.current, url, { width: 200, margin: 2 })
    }
  }, [showQR, localIP])

  // Listen for phone image via WebSocket
  useEffect(() => {
    if (!waitingForPhone) return
    const host = window.location.hostname || 'localhost'
    const ws = new WebSocket(`ws://${host}:5175?role=dashboard`)
    wsRef.current = ws

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'image' && msg.data) {
          setImage(msg.data)
          setWaitingForPhone(false)
          setShowQR(false)
        }
      } catch {}
    }

    return () => { ws.close(); wsRef.current = null }
  }, [waitingForPhone])

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImage(reader.result)
    reader.readAsDataURL(file)
  }

  const transcribe = async () => {
    if (!image) return
    if (!API_KEY) {
      setError('No API key configured. Add VITE_ANTHROPIC_API_KEY to .env')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Extract base64 data and media type from data URL
      const match = image.match(/^data:(image\/\w+);base64,(.+)$/)
      if (!match) throw new Error('Invalid image format')
      const [, mediaType, base64Data] = match

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64Data },
              },
              {
                type: 'text',
                text: `This is a photograph of a handwritten food safety compliance log (${logLabel}). Please transcribe all the handwritten text you can see, preserving the structure as much as possible. Include dates, names, values, checkmarks (as [x]), and any notes. If something is illegible, mark it as [illegible]. Format it cleanly but faithfully — don't add information that isn't on the page.`,
              },
            ],
          }],
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error?.message || `API error ${res.status}`)
      }

      const data = await res.json()
      const text = data.content?.[0]?.text || ''
      setTranscription(text)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // For FCHEM/PCHEM: extract structured form rows directly from the image
  const extractFormRows = async () => {
    if (!image || !API_KEY) return
    setParsingForm(true)
    setError(null)

    try {
      const match = image.match(/^data:(image\/\w+);base64,(.+)$/)
      if (!match) throw new Error('Invalid image format')
      const [, mediaType, base64Data] = match

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
              { type: 'text', text: `This is a photo of an MBG Chemical Inventory Log (Form E-1.2b). Extract every filled row from the table.

For each row, return a JSON object with these fields matching the form columns:
- "productName": string
- "containerVolume": string (e.g. "2.5 gal", "1 qt", "50 lb bag")
- "quantityOnHand": string (e.g. "3", "1.5 gal", "half full")
- "purchasedQtyDate": string (quantity and date if written, e.g. "2 gal — 01/15/2026")
- "notes": string (any notes/comments)
- "sdsOnFile": string ("yes", "no", or "" if blank/checkmark)

Also extract the header fields:
- "date": string (the date written on the form)
- "location": string (the location written on the form)

Return a JSON object: { "date": "...", "location": "...", "rows": [...] }
Only include rows that have at least a product name written. If something is illegible, write [illegible]. Return ONLY JSON, no markdown.` },
            ],
          }],
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error?.message || `API error ${res.status}`)
      }

      const data = await res.json()
      const text = data.content?.[0]?.text || '{}'
      const jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
      const parsed = JSON.parse(jsonStr)
      setFormRows(parsed)
    } catch (e) {
      setError('Failed to extract form: ' + e.message)
    } finally {
      setParsingForm(false)
    }
  }

  const updateFormRow = (index, field, value) => {
    setFormRows(prev => ({
      ...prev,
      rows: prev.rows.map((r, i) => i === index ? { ...r, [field]: value } : r),
    }))
  }

  const addFormRow = () => {
    setFormRows(prev => ({
      ...prev,
      rows: [...(prev.rows || []), { productName: '', containerVolume: '', quantityOnHand: '', purchasedQtyDate: '', notes: '', sdsOnFile: '' }],
    }))
  }

  const removeFormRow = (index) => {
    setFormRows(prev => ({ ...prev, rows: prev.rows.filter((_, i) => i !== index) }))
  }

  const parseChemicals = async () => {
    if (!transcription || !API_KEY) return
    setParsingChem(true)
    setError(null)

    try {
      // Load existing chemical inventory to give the AI context
      let existingChems = []
      try {
        const inv = JSON.parse(localStorage.getItem(CHEM_STORAGE_KEY) || '{}')
        existingChems = (inv.chemicals || []).map(c => `${c.name} (${c.unit}, EPA: ${c.epaNumber || 'n/a'})`)
      } catch {}

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: `You are parsing a farm chemical inventory or spray record transcription into structured data.

Here is the transcription of a handwritten ${logLabel} log:

---
${transcription}
---

${existingChems.length > 0 ? `Known chemicals already in inventory:\n${existingChems.join('\n')}\n\nMatch to existing chemicals when possible.\n` : ''}

Extract every chemical transaction you can find. For each one, output a JSON object with:
- "chemical": chemical/product name (string)
- "type": "add" for deliveries/purchases/received, "spray" for applications/used/sprayed
- "amount": numeric amount (number)
- "unit": unit of measure like oz, gal, lb, qt, L (string)
- "date": date in YYYY-MM-DD format if found, otherwise null (string or null)
- "field": field or block name if mentioned (string or null)
- "target": target pest/disease if mentioned (string or null)
- "notes": any other relevant info (string or null)

If this appears to be a current inventory count (not a transaction log), treat each line as a "add" transaction representing the on-hand quantity.

Return ONLY a JSON array of objects. No markdown, no explanation. If you can't find any transactions, return [].`,
          }],
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error?.message || `API error ${res.status}`)
      }

      const data = await res.json()
      const text = data.content?.[0]?.text || '[]'
      // Parse JSON from response (handle markdown code blocks)
      const jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
      const transactions = JSON.parse(jsonStr)
      setParsedTx(transactions)
    } catch (e) {
      setError('Failed to parse chemicals: ' + e.message)
    } finally {
      setParsingChem(false)
    }
  }

  const saveChemTransactions = () => {
    if (!parsedTx || parsedTx.length === 0) return

    try {
      const inv = JSON.parse(localStorage.getItem(CHEM_STORAGE_KEY) || 'null') || { chemicals: [], transactions: [], snapshots: {} }

      for (const tx of parsedTx) {
        // Find or create the chemical
        let chem = inv.chemicals.find(c =>
          c.name.toLowerCase() === tx.chemical.toLowerCase()
        )
        if (!chem) {
          chem = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 4),
            name: tx.chemical,
            unit: tx.unit || 'oz',
            epaNumber: '',
            activeIngredient: '',
          }
          inv.chemicals.push(chem)
        }

        // Add the transaction
        inv.transactions.push({
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          chemicalId: chem.id,
          type: tx.type || 'add',
          amount: parseFloat(tx.amount) || 0,
          date: tx.date || new Date().toISOString().slice(0, 10),
          notes: tx.notes || '',
          field: tx.field || '',
          target: tx.target || '',
        })
      }

      localStorage.setItem(CHEM_STORAGE_KEY, JSON.stringify(inv))
      fetch('/api/store/' + CHEM_STORAGE_KEY, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inv),
      }).catch(() => {})

      setChemSaved(true)
    } catch (e) {
      setError('Failed to save: ' + e.message)
    }
  }

  const updateParsedTx = (index, field, value) => {
    setParsedTx(prev => prev.map((tx, i) => i === index ? { ...tx, [field]: value } : tx))
  }

  const removeParsedTx = (index) => {
    setParsedTx(prev => prev.filter((_, i) => i !== index))
  }

  const handleSave = () => {
    onSave({
      image,
      transcription,
      capturedAt: new Date().toISOString(),
      logCode,
    })
    setSaved(true)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: COLORS.bg, borderRadius: 8, width: '90%', maxWidth: 700,
        maxHeight: '90vh', overflow: 'auto',
        padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 16,
        }}>
          <div>
            <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: COLORS.text }}>
              Capture Log: {logCode}
            </div>
            <div style={{ fontFamily: FONT, fontSize: 11, color: COLORS.text3 }}>
              {logLabel}
            </div>
          </div>
          <button onClick={onClose} style={{
            fontFamily: FONT, fontSize: 10, color: COLORS.text3,
            background: 'transparent', border: `1px solid ${COLORS.border}`,
            padding: '4px 12px', borderRadius: 3, cursor: 'pointer',
          }}>CLOSE</button>
        </div>

        {/* Capture options */}
        {!image && !showQR && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <button onClick={() => { setShowQR(true); setWaitingForPhone(true) }} style={{
              flex: 1, fontFamily: FONT, fontSize: 12, fontWeight: 600,
              color: COLORS.green, background: COLORS.greenDim,
              border: `2px solid ${COLORS.green}`,
              padding: '16px', borderRadius: 6, cursor: 'pointer',
              textAlign: 'center',
            }}>
              PHONE CAMERA
              <div style={{ fontSize: 9, fontWeight: 400, color: COLORS.text3, marginTop: 4 }}>
                Scan QR code with your phone
              </div>
            </button>
            <button onClick={() => fileRef.current?.click()} style={{
              flex: 1, fontFamily: FONT, fontSize: 12, fontWeight: 600,
              color: COLORS.text2, background: COLORS.bg2,
              border: `2px solid ${COLORS.border}`,
              padding: '16px', borderRadius: 6, cursor: 'pointer',
              textAlign: 'center',
            }}>
              UPLOAD FILE
              <div style={{ fontSize: 9, fontWeight: 400, color: COLORS.text3, marginTop: 4 }}>
                Select an existing photo
              </div>
            </button>
            <input ref={fileRef} type="file" accept="image/*"
              onChange={handleFile} style={{ display: 'none' }} />
          </div>
        )}

        {/* QR code for phone camera */}
        {showQR && !image && (
          <div style={{
            textAlign: 'center', padding: 20, marginBottom: 16,
            background: COLORS.bg2, borderRadius: 6, border: `1px solid ${COLORS.border}`,
          }}>
            <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: COLORS.text, marginBottom: 12 }}>
              Scan with your phone to open camera
            </div>
            <canvas ref={qrCanvasRef} style={{ display: 'block', margin: '0 auto' }} />
            {localIP && (
              <div style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3, marginTop: 8 }}>
                http://{localIP.ip}:{localIP.port}/?mode=phone&for=document
              </div>
            )}
            <div style={{
              fontFamily: FONT, fontSize: 10, color: COLORS.amber,
              marginTop: 12, fontWeight: 600,
            }}>
              {waitingForPhone ? 'Waiting for photo from phone...' : 'Connected'}
            </div>
            <button onClick={() => { setShowQR(false); setWaitingForPhone(false) }} style={{
              fontFamily: FONT, fontSize: 9, color: COLORS.text3,
              background: 'transparent', border: `1px solid ${COLORS.border}`,
              padding: '4px 12px', borderRadius: 3, cursor: 'pointer',
              marginTop: 8,
            }}>CANCEL</button>
          </div>
        )}

        {/* Image preview */}
        {image && (
          <div style={{ marginBottom: 16 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 6,
            }}>
              <span style={{ fontFamily: FONT, fontSize: 9, color: COLORS.text3, letterSpacing: '0.06em' }}>
                CAPTURED IMAGE
              </span>
              <button onClick={() => { setImage(null); setTranscription(''); setError(null) }} style={{
                fontFamily: FONT, fontSize: 8, color: COLORS.amber,
                background: 'transparent', border: `1px solid ${COLORS.amber}`,
                padding: '2px 8px', borderRadius: 2, cursor: 'pointer',
              }}>RETAKE</button>
            </div>
            <img src={image} style={{
              width: '100%', maxHeight: 300, objectFit: 'contain',
              borderRadius: 4, border: `1px solid ${COLORS.border}`,
              background: '#000',
            }} />
          </div>
        )}

        {/* Transcribe / Extract buttons */}
        {image && !transcription && !loading && !formRows && !parsingForm && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {isChemLog ? (
              <button onClick={extractFormRows} style={{
                flex: 1, fontFamily: FONT, fontSize: 12, fontWeight: 700,
                color: '#fff', background: COLORS.green,
                border: 'none', padding: '12px', borderRadius: 4, cursor: 'pointer',
              }}>
                EXTRACT FORM DATA
              </button>
            ) : (
              <button onClick={transcribe} style={{
                flex: 1, fontFamily: FONT, fontSize: 12, fontWeight: 700,
                color: '#fff', background: COLORS.green,
                border: 'none', padding: '12px', borderRadius: 4, cursor: 'pointer',
              }}>
                TRANSCRIBE WITH AI
              </button>
            )}
            <button onClick={() => isChemLog ? setFormRows({ date: '', location: '', rows: [{ productName: '', containerVolume: '', quantityOnHand: '', purchasedQtyDate: '', notes: '', sdsOnFile: '' }] }) : setTranscription(' ')} style={{
              fontFamily: FONT, fontSize: 10, color: COLORS.text3,
              background: 'transparent', border: `1px solid ${COLORS.border}`,
              padding: '12px 16px', borderRadius: 4, cursor: 'pointer',
            }}>
              SKIP — ENTER MANUALLY
            </button>
          </div>
        )}

        {/* Loading */}
        {(loading || parsingForm) && (
          <div style={{
            fontFamily: FONT, fontSize: 11, color: COLORS.amber,
            textAlign: 'center', padding: 20,
          }}>
            {parsingForm ? 'Extracting form data...' : 'Transcribing handwriting...'}
          </div>
        )}

        {/* === CHEMICAL FORM VIEW === */}
        {formRows && !saved && (
          <div style={{ marginBottom: 16 }}>
            {/* Header fields */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: 'serif', fontSize: 11, fontWeight: 700 }}>Date:</span>
                <input type="text" value={formRows.date || ''} onChange={e => setFormRows(p => ({ ...p, date: e.target.value }))}
                  style={{ fontFamily: 'serif', fontSize: 11, borderBottom: '1px solid #999', border: 'none', padding: '2px 4px', width: 120 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                <span style={{ fontFamily: 'serif', fontSize: 11, fontWeight: 700 }}>Location:</span>
                <input type="text" value={formRows.location || ''} onChange={e => setFormRows(p => ({ ...p, location: e.target.value }))}
                  style={{ fontFamily: 'serif', fontSize: 11, borderBottom: '1px solid #999', border: 'none', padding: '2px 4px', flex: 1 }} />
              </div>
            </div>

            {/* Form title */}
            <div style={{ fontFamily: 'serif', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
              Chemical Inventory Log — Field
            </div>

            {/* Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr style={{ background: '#f0f0ec' }}>
                  <th style={fth}>Product Name</th>
                  <th style={fth}>Container Volume</th>
                  <th style={fth}>Qty on Hand</th>
                  <th style={fth}>Purchased Qty/Date</th>
                  <th style={fth}>Notes</th>
                  <th style={{ ...fth, width: 50 }}>SDS?</th>
                  <th style={{ ...fth, width: 30 }}></th>
                </tr>
              </thead>
              <tbody>
                {(formRows.rows || []).map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={ftd}><input value={row.productName || ''} onChange={e => updateFormRow(i, 'productName', e.target.value)} style={finput} /></td>
                    <td style={ftd}><input value={row.containerVolume || ''} onChange={e => updateFormRow(i, 'containerVolume', e.target.value)} style={{ ...finput, width: 80 }} /></td>
                    <td style={ftd}><input value={row.quantityOnHand || ''} onChange={e => updateFormRow(i, 'quantityOnHand', e.target.value)} style={{ ...finput, width: 60 }} /></td>
                    <td style={ftd}><input value={row.purchasedQtyDate || ''} onChange={e => updateFormRow(i, 'purchasedQtyDate', e.target.value)} style={finput} /></td>
                    <td style={ftd}><input value={row.notes || ''} onChange={e => updateFormRow(i, 'notes', e.target.value)} style={finput} /></td>
                    <td style={ftd}>
                      <select value={row.sdsOnFile || ''} onChange={e => updateFormRow(i, 'sdsOnFile', e.target.value)}
                        style={{ fontFamily: 'serif', fontSize: 9, border: '1px solid #ddd', borderRadius: 2, padding: '1px', width: 40 }}>
                        <option value="">—</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </td>
                    <td style={ftd}>
                      <button onClick={() => removeFormRow(i)} style={{
                        fontSize: 8, color: COLORS.red, background: 'transparent',
                        border: 'none', cursor: 'pointer',
                      }}>X</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={addFormRow} style={{
              fontFamily: FONT, fontSize: 9, color: COLORS.text3,
              background: 'transparent', border: `1px solid ${COLORS.border}`,
              padding: '3px 10px', borderRadius: 3, cursor: 'pointer', marginTop: 6,
            }}>+ ADD ROW</button>

            {/* Save form */}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => {
                onSave({
                  image,
                  formData: formRows,
                  capturedAt: new Date().toISOString(),
                  logCode,
                })
                setSaved(true)
              }} style={{
                flex: 1, fontFamily: FONT, fontSize: 13, fontWeight: 700,
                color: '#fff', background: COLORS.green,
                border: 'none', padding: '12px', borderRadius: 4, cursor: 'pointer',
              }}>
                SAVE FORM
              </button>
              {!parsedTx && !parsingChem && (
                <button onClick={() => {
                  // Convert form rows to transcription text for chemical parsing
                  const text = (formRows.rows || []).map(r =>
                    `${r.productName}: ${r.quantityOnHand} on hand, container ${r.containerVolume}, purchased ${r.purchasedQtyDate || 'n/a'}`
                  ).join('\n')
                  setTranscription(text)
                  parseChemicals()
                }} style={{
                  fontFamily: FONT, fontSize: 10, fontWeight: 600,
                  color: COLORS.amber, background: COLORS.amberDim,
                  border: `1px solid ${COLORS.amber}`,
                  padding: '12px 16px', borderRadius: 4, cursor: 'pointer',
                }}>
                  ALSO UPDATE INVENTORY
                </button>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            fontFamily: FONT, fontSize: 10, color: COLORS.red,
            background: COLORS.redDim, padding: '8px 12px', borderRadius: 4,
            marginBottom: 12,
          }}>
            {error}
          </div>
        )}

        {/* Editable transcription */}
        {transcription && (
          <div style={{ marginBottom: 16 }}>
            <div style={{
              fontFamily: FONT, fontSize: 9, color: COLORS.text3,
              letterSpacing: '0.06em', marginBottom: 4,
            }}>
              TRANSCRIPTION — edit below to fix any errors
            </div>
            <textarea
              value={transcription}
              onChange={e => setTranscription(e.target.value)}
              style={{
                fontFamily: FONT, fontSize: 11, lineHeight: 1.6,
                width: '100%', minHeight: 200, padding: 12,
                border: `1px solid ${COLORS.border}`, borderRadius: 4,
                background: COLORS.bg2, color: COLORS.text,
                resize: 'vertical',
              }}
            />
          </div>
        )}

        {/* Save */}
        {transcription && !saved && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button onClick={handleSave} style={{
              flex: 1, fontFamily: FONT, fontSize: 13, fontWeight: 700,
              color: '#fff', background: COLORS.green,
              border: 'none', padding: '12px', borderRadius: 4, cursor: 'pointer',
            }}>
              SAVE TO LOG
            </button>
            {isChemLog && !parsedTx && !parsingChem && (
              <button onClick={parseChemicals} style={{
                flex: 1, fontFamily: FONT, fontSize: 11, fontWeight: 700,
                color: COLORS.amber, background: COLORS.amberDim,
                border: `2px solid ${COLORS.amber}`,
                padding: '12px', borderRadius: 4, cursor: 'pointer',
              }}>
                PARSE INTO INVENTORY
              </button>
            )}
          </div>
        )}

        {parsingChem && (
          <div style={{
            fontFamily: FONT, fontSize: 11, color: COLORS.amber,
            textAlign: 'center', padding: 16,
          }}>
            Parsing chemicals from transcription...
          </div>
        )}

        {/* Parsed chemical transactions — review & edit */}
        {parsedTx && !chemSaved && (
          <div style={{
            background: COLORS.bg2, border: `1px solid ${COLORS.amber}`,
            borderRadius: 6, padding: 16, marginBottom: 12,
          }}>
            <div style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, color: COLORS.amber, marginBottom: 10 }}>
              Found {parsedTx.length} transaction{parsedTx.length !== 1 ? 's' : ''} — review and edit before saving
            </div>
            {parsedTx.map((tx, i) => (
              <div key={i} style={{
                display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6,
                padding: '6px 8px', background: COLORS.bg, borderRadius: 3,
                border: `1px solid ${COLORS.border}`, flexWrap: 'wrap',
              }}>
                <select value={tx.type} onChange={e => updateParsedTx(i, 'type', e.target.value)}
                  style={{ fontFamily: FONT, fontSize: 9, padding: '2px 4px', border: `1px solid ${COLORS.border}`, borderRadius: 2, width: 70,
                    color: tx.type === 'spray' ? COLORS.red : COLORS.green, fontWeight: 600 }}>
                  <option value="add">ADD</option>
                  <option value="spray">SPRAY</option>
                </select>
                <input value={tx.chemical} onChange={e => updateParsedTx(i, 'chemical', e.target.value)}
                  style={{ fontFamily: FONT, fontSize: 10, padding: '3px 6px', border: `1px solid ${COLORS.border}`, borderRadius: 2, flex: 1, minWidth: 100, fontWeight: 600 }}
                  placeholder="Chemical name" />
                <input type="number" step="0.1" value={tx.amount} onChange={e => updateParsedTx(i, 'amount', e.target.value)}
                  style={{ fontFamily: FONT, fontSize: 10, padding: '3px 6px', border: `1px solid ${COLORS.border}`, borderRadius: 2, width: 60, textAlign: 'right' }}
                  placeholder="Amt" />
                <input value={tx.unit || ''} onChange={e => updateParsedTx(i, 'unit', e.target.value)}
                  style={{ fontFamily: FONT, fontSize: 10, padding: '3px 6px', border: `1px solid ${COLORS.border}`, borderRadius: 2, width: 40 }}
                  placeholder="unit" />
                <input type="date" value={tx.date || ''} onChange={e => updateParsedTx(i, 'date', e.target.value)}
                  style={{ fontFamily: FONT, fontSize: 9, padding: '2px 4px', border: `1px solid ${COLORS.border}`, borderRadius: 2 }} />
                <input value={tx.field || ''} onChange={e => updateParsedTx(i, 'field', e.target.value)}
                  style={{ fontFamily: FONT, fontSize: 9, padding: '3px 6px', border: `1px solid ${COLORS.border}`, borderRadius: 2, width: 70 }}
                  placeholder="Field" />
                <button onClick={() => removeParsedTx(i)} style={{
                  fontFamily: FONT, fontSize: 8, color: COLORS.red,
                  background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px',
                }}>X</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={saveChemTransactions} style={{
                flex: 1, fontFamily: FONT, fontSize: 11, fontWeight: 700,
                color: '#fff', background: COLORS.green,
                border: 'none', padding: '10px', borderRadius: 4, cursor: 'pointer',
              }}>
                SAVE {parsedTx.length} TO INVENTORY
              </button>
              <button onClick={() => setParsedTx(null)} style={{
                fontFamily: FONT, fontSize: 10, color: COLORS.text3,
                background: 'transparent', border: `1px solid ${COLORS.border}`,
                padding: '10px 16px', borderRadius: 4, cursor: 'pointer',
              }}>DISCARD</button>
            </div>
          </div>
        )}

        {chemSaved && (
          <div style={{
            fontFamily: FONT, fontSize: 11, fontWeight: 600,
            color: COLORS.green, background: COLORS.greenDim,
            border: `1px solid ${COLORS.green}`, borderRadius: 4,
            padding: 10, marginBottom: 12, textAlign: 'center',
          }}>
            {parsedTx.length} transaction{parsedTx.length !== 1 ? 's' : ''} added to chemical inventory
          </div>
        )}

        {saved && (
          <div style={{
            fontFamily: FONT, fontSize: 12, fontWeight: 600,
            color: COLORS.green, textAlign: 'center', padding: 12,
          }}>
            Saved to compliance log.{isChemLog && !chemSaved && !parsedTx ? ' You can also parse into chemical inventory.' : ''} Close when done.
          </div>
        )}
      </div>
    </div>
  )
}

// Form table styles
const fth = {
  fontFamily: 'serif', fontSize: 9, fontWeight: 700, color: '#333',
  textAlign: 'left', padding: '6px 6px',
  borderBottom: '2px solid #666', borderRight: '1px solid #ddd',
}
const ftd = {
  padding: '3px 4px', borderRight: '1px solid #eee', verticalAlign: 'middle',
}
const finput = {
  fontFamily: 'serif', fontSize: 10, width: '100%',
  border: 'none', borderBottom: '1px solid #ddd',
  background: 'transparent', padding: '2px 2px',
}
