/**
 * Seed realistic BerryCheck data for development/demo.
 *
 * Simulates a real day on the shed floor:
 * - Start with the cleanest fruit in the cooler (best grower first)
 * - Run each receipt to completion before starting the next
 * - After standard packs finish, reopen receipts that had sized fruit
 *   and run Mighty Blue pallets from the size-sorted berries
 * - Quality degrades slightly through the day (fruit warms up)
 * - One missed pallet mid-day (realistic)
 */

export async function seed() {
  localStorage.removeItem('bc_history')
  localStorage.removeItem('bc_packlog')
  localStorage.removeItem('bc_receipts')
  localStorage.removeItem('bc_packplan')
  localStorage.removeItem('bc_packcodes_favorites')

  // Seed favorite pack codes — the ~8 this shed actually uses
  localStorage.setItem('bc_packcodes_favorites', JSON.stringify([
    'NF1293', // 12-6oz
    'NF740',  // 12-1pt
    'NF1295', // 8-18oz
    'NF4193', // 12-18oz (CHEP)
    'NF8889', // 12-9.8oz Mighty Blue
    'NF7291', // 12-24oz (CHEP)
    'NF767',  // 12-2lb
    'NF5292', // RTE Lugs
  ]))

  const today = new Date().toLocaleDateString()
  const history = []
  const packLog = []
  const receipts = []
  let palletNum = 1

  // Pack plan for the day — follows what the office sent
  // Standard 18oz for most orders, Mighty Blue 9.8oz at end
  const packPlan = [
    { packCode: 'NF1295', label: 'GA 8-18 OZ BLUES', boxes: 1440, pallets: 10, perPallet: 144, palletType: 'brown', notes: '', balance: false },
    { packCode: 'NF8889', label: 'GA 12-9.8 OZ, MTY BL', boxes: 432, pallets: 3, perPallet: 144, palletType: 'brown', notes: 'After sized fruit run', balance: false },
    { packCode: 'NF740', label: 'GA 12-1 PT BLUES', boxes: 0, pallets: 0, perPallet: 144, palletType: 'brown', notes: '', balance: true },
  ]
  localStorage.setItem('bc_packplan', JSON.stringify(packPlan))
  let baseTime = 7 * 60 // 7:00 AM in minutes

  // Receipts ordered best fruit first (how a real shed prioritizes)
  const receiptDefs = [
    { receiptNum: 'R-001', grower: 'Thompson Farms', variety: 'Star', block: 'NE-12',
      expectedPallets: 5, expectedLbs: 6000, quality: 'clean', hasSized: true },
    { receiptNum: 'R-002', grower: 'Thompson Farms', variety: 'Farthing', block: 'SW-3',
      expectedPallets: 3, expectedLbs: 3600, quality: 'clean', hasSized: true },
    { receiptNum: 'R-003', grower: 'Davis Brothers', variety: 'Star', block: 'Main',
      expectedPallets: 4, expectedLbs: 4800, quality: 'mid', hasSized: false },
    { receiptNum: 'R-004', grower: 'Hernandez AG', variety: 'Meadowlark', block: 'Field 2',
      expectedPallets: 3, expectedLbs: 3600, quality: 'rough', hasSized: false },
  ]

  // Create receipt records
  for (const rd of receiptDefs) {
    receipts.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      receiptNum: rd.receiptNum,
      grower: rd.grower,
      variety: rd.variety,
      block: rd.block,
      expectedPallets: rd.expectedPallets,
      expectedLbs: rd.expectedLbs,
      createdAt: new Date().toISOString(),
      scans: [],
      status: 'active',
    })
  }

  // ============================================================
  // PHASE 1: Standard packs — run each receipt to completion
  // Best fruit first, finish before moving to next
  // ============================================================

  for (const rd of receiptDefs) {
    // Day wears on — fruit quality degrades slightly (warming up in shed)
    const dayFatigue = (baseTime - 7 * 60) / (10 * 60) // 0 at 7AM, ~1 at 5PM

    for (let pIdx = 0; pIdx < rd.expectedPallets; pIdx++) {
      const lotId = `P-${String(palletNum).padStart(4, '0')}`

      // Line stats — clean fruit runs faster
      const baseRate = rd.quality === 'clean' ? 1350 : rd.quality === 'mid' ? 1150 : 950
      const lineRate = Math.round(baseRate + randInt(-100, 100) - dayFatigue * 50)
      const blowoff = rd.quality === 'clean' ? rand(3, 6) : rd.quality === 'mid' ? rand(6, 10) : rand(9, 14)
      const sizeDiversion = rd.hasSized ? rand(4, 9) : rand(1, 3)

      // 3 layer samples
      for (let layer = 1; layer <= 3; layer++) {
        baseTime += randInt(4, 8) // 4-8 min between samples
        const time = minsToTime(baseTime)

        const speedPenalty = Math.max(0, (lineRate - 1200) / 400)
        const qualityBase = rd.quality === 'clean' ? 0.4 : rd.quality === 'mid' ? 1.8 : 3.2
        const fatiguePenalty = dayFatigue * 0.5

        const permanent = Math.max(0, Math.round((qualityBase + fatiguePenalty + rand(-0.5, 0.8)) * rand(0.8, 1.3)))
        const condition = Math.max(0, Math.round((qualityBase * 0.6 + speedPenalty * 0.4 + fatiguePenalty * 0.3 + rand(-0.3, 0.8)) * rand(0.8, 1.3)))
        const decay = rd.quality === 'rough' && Math.random() > 0.55 ? randInt(0, 2)
          : rd.quality === 'mid' && Math.random() > 0.85 ? 1 : 0

        const totalBerries = randInt(295, 335)
        const defects = permanent + condition + decay
        const good = Math.max(0, totalBerries - defects)

        history.push({
          id: Date.now() + palletNum * 100 + layer,
          time, date: today,
          lotId, dailyPalletNum: palletNum,
          receiptNum: rd.receiptNum, grower: rd.grower, variety: rd.variety,
          packCriteria: 'standard',
          good, permanent, condition, decay,
          isExtra: false, isSkipped: false, sampleNum: layer,
        })
      }

      // Pack log
      baseTime += randInt(2, 5) // close-out time
      packLog.push({
        id: Date.now() + palletNum * 100 + 90,
        time: minsToTime(baseTime), date: today,
        packCode: 'NF1295',
        receiptNum: rd.receiptNum, grower: rd.grower, variety: rd.variety,
        palletNum: lotId, dailyPallet: palletNum,
        boxes: randInt(90, 108),
        lineRate, blowoff: round1(blowoff), sizeDiversion: round1(sizeDiversion),
        lineStatsCapturedAt: 'mid-sample',
      })

      // Missed pallet mid-day — forklift had to swap, QC couldn't get to it
      if (palletNum === 6) {
        palletNum++
        packLog.push({
          id: Date.now() + palletNum * 100 + 95,
          time: minsToTime(baseTime + 3), date: today,
          packCode: '—', receiptNum: '', grower: '',
          palletNum: `P-${String(palletNum).padStart(4, '0')}`,
          dailyPallet: palletNum, boxes: 0, isMissed: true,
        })
        // Log missed in history too
        for (let layer = 1; layer <= 3; layer++) {
          history.push({
            id: Date.now() + palletNum * 100 + layer,
            time: minsToTime(baseTime + 3), date: today,
            lotId: `P-${String(palletNum).padStart(4, '0')}`,
            dailyPalletNum: palletNum,
            receiptNum: rd.receiptNum, grower: rd.grower, variety: rd.variety,
            packCriteria: 'standard',
            good: 0, permanent: 0, condition: 0, decay: 0,
            isExtra: false, isSkipped: true, isMissed: true, sampleNum: layer,
          })
        }
      }

      palletNum++
      baseTime += randInt(8, 15) // gap between pallets (forklift swap, etc.)
    }

    // Short break between receipts — line changeover
    baseTime += randInt(10, 20)
  }

  // ============================================================
  // PHASE 2: Mighty Blue run — reopen receipts that had sized fruit
  // Size-sorted berries from earlier are all 19mm+, run as premium
  // Smaller batches, 1-2 pallets each, better fruit (pre-sorted)
  // ============================================================

  baseTime += randInt(15, 25) // changeover to MB setup

  const sizedReceipts = receiptDefs.filter(rd => rd.hasSized)

  for (const rd of sizedReceipts) {
    const mbPallets = rd.expectedPallets >= 4 ? 2 : 1

    for (let pIdx = 0; pIdx < mbPallets; pIdx++) {
      const lotId = `P-${String(palletNum).padStart(4, '0')}`

      // Mighty Blue — pre-sorted, cleaner fruit, slower more careful line
      const lineRate = Math.round(randInt(800, 1000))
      const blowoff = rand(2, 5) // less blowoff — fruit is already sorted
      const sizeDiversion = 0 // already size-sorted

      for (let layer = 1; layer <= 3; layer++) {
        baseTime += randInt(5, 9)
        const time = minsToTime(baseTime)

        // Cleaner than standard — these berries were already size-graded
        const permanent = Math.max(0, Math.round(rand(0, 1.5)))
        const condition = Math.max(0, Math.round(rand(0, 1)))
        const decay = 0

        const totalBerries = randInt(240, 280) // fewer berries — they're bigger (19mm+)
        const defects = permanent + condition
        const good = Math.max(0, totalBerries - defects)

        history.push({
          id: Date.now() + palletNum * 100 + layer,
          time, date: today,
          lotId, dailyPalletNum: palletNum,
          receiptNum: rd.receiptNum, grower: rd.grower, variety: rd.variety,
          packCriteria: 'mightyBlue',
          good, permanent, condition, decay,
          isExtra: false, isSkipped: false, sampleNum: layer,
        })
      }

      // Extra sample on one MB pallet — QC double-checking premium pack
      if (pIdx === 0) {
        baseTime += 3
        const permanent = randInt(0, 1)
        const good = randInt(250, 275) - permanent
        history.push({
          id: Date.now() + palletNum * 100 + 50,
          time: minsToTime(baseTime), date: today,
          lotId, dailyPalletNum: palletNum,
          receiptNum: rd.receiptNum, grower: rd.grower, variety: rd.variety,
          packCriteria: 'mightyBlue',
          good, permanent, condition: 0, decay: 0,
          isExtra: true, isSkipped: false, sampleNum: null,
        })
      }

      baseTime += randInt(3, 6)
      packLog.push({
        id: Date.now() + palletNum * 100 + 90,
        time: minsToTime(baseTime), date: today,
        packCode: 'NF8889',
        receiptNum: rd.receiptNum, grower: rd.grower, variety: rd.variety,
        palletNum: lotId, dailyPallet: palletNum,
        boxes: randInt(84, 100), // sometimes short — sized fruit doesn't always fill
        lineRate, blowoff: round1(blowoff), sizeDiversion: 0,
        lineStatsCapturedAt: 'mid-sample',
      })

      palletNum++
      baseTime += randInt(10, 15)
    }
  }

  // Save receipts
  localStorage.setItem('bc_receipts', JSON.stringify(receipts))
  localStorage.setItem('bc_history', JSON.stringify(history))
  localStorage.setItem('bc_packlog', JSON.stringify(packLog))

  // Push daily summary to server so DailyView works on phone
  try {
    const { gradeSample } = await import('./constants.js')

    const palletMap = {}
    history.forEach(s => {
      if (!s.lotId) return
      if (!palletMap[s.lotId]) {
        palletMap[s.lotId] = {
          lotId: s.lotId, receiptNum: s.receiptNum, grower: s.grower,
          variety: s.variety, time: s.time,
          lineRate: null, blowoff: null, sizeDiversion: null,
          dcStrictness: 3, isMissed: false, samples: [],
        }
      }
      palletMap[s.lotId].samples.push(s)
    })

    packLog.forEach(e => {
      const p = palletMap[e.palletNum]
      if (p) {
        if (e.lineRate) p.lineRate = e.lineRate
        if (e.blowoff != null) p.blowoff = e.blowoff
        if (e.sizeDiversion != null) p.sizeDiversion = e.sizeDiversion
        if (e.isMissed) p.isMissed = true
      }
    })

    const pallets = Object.values(palletMap).map(p => {
      const official = p.samples.filter(s => !s.isExtra && !s.isSkipped)
      if (official.length === 0) return { ...p, grade: p.isMissed ? 'MISSED' : '—', pctCombined: 0, samples: undefined }
      const avg = {}
      for (const key of ['good', 'permanent', 'condition', 'decay']) {
        avg[key] = Math.round((official.reduce((a, s) => a + (s[key] || 0), 0) / official.length) * 10) / 10
      }
      const result = gradeSample(avg)
      return { ...p, grade: result.label, pctCombined: result.pctCombined, samples: undefined }
    })

    const withRate = pallets.filter(p => p.lineRate)
    const withBlowoff = pallets.filter(p => p.blowoff != null)
    const avgLineRate = withRate.length > 0 ? withRate.reduce((s, p) => s + p.lineRate, 0) / withRate.length : null
    const avgBlowoff = withBlowoff.length > 0
      ? Math.round((withBlowoff.reduce((s, p) => s + p.blowoff, 0) / withBlowoff.length) * 10) / 10
      : null

    await fetch('/api/daily', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: today, data: { pallets, avgLineRate, avgBlowoff } }),
    })
    console.log('Daily summary pushed to server.')
  } catch (e) {
    console.warn('Could not push daily summary:', e.message)
  }

  const standardPallets = palletNum - 1 - sizedReceipts.reduce((s, rd) => s + (rd.expectedPallets >= 4 ? 2 : 1), 0)
  const mbPallets = palletNum - 1 - standardPallets - 1 // -1 for missed
  console.log(`Seeded: ${history.length} samples, ${palletNum - 1} pallets (${standardPallets} standard + ${mbPallets} Mighty Blue + 1 missed)`)
  console.log(`Day ran ${minsToTime(7 * 60)} to ${minsToTime(baseTime)}`)
  console.log('Reload to see data.')

  return {
    samples: history.length,
    pallets: palletNum - 1,
    growers: [...new Set(history.map(s => s.grower))],
    endTime: minsToTime(baseTime),
  }
}

export function clearSeed() {
  localStorage.removeItem('bc_history')
  localStorage.removeItem('bc_packlog')
  localStorage.removeItem('bc_receipts')
  console.log('Cleared all data. Reload.')
}

function minsToTime(mins) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(Math.floor(m)).padStart(2, '0')}:00`
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function rand(min, max) {
  return min + Math.random() * (max - min)
}

function round1(n) {
  return Math.round(n * 10) / 10
}
