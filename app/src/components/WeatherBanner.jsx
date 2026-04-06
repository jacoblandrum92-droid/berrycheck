import React, { useState, useEffect } from 'react'
import { COLORS, FONT } from '../constants'

// ============================================================
// Weather Banner — berry-relevant weather context for QCers
// ============================================================
//
// Uses NWS API (free, no key). Fetches when internet is available,
// caches aggressively in localStorage. Shows nothing if no data.
//
// Surfaces conditions that affect berry quality:
//   - Heat stress (sustained high temps)
//   - Humidity (mold/decay risk)
//   - Rain events (soft fruit, splitting)
//   - Drought → rain transitions (cracking risk)
//   - Drying wind after rain (good)
//   - High wind (physical damage)
//   - Extended hot dry (dehydration/shrivel)
// ============================================================

const CACHE_KEY = 'bc_weather'
const LOCATION_KEY = 'bc_weather_location'
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes
const FETCH_RETRY = 5 * 60 * 1000 // retry every 5 min if fetch fails

// NWS API base
const NWS = 'https://api.weather.gov'

// Berry-relevant weather thresholds
const THRESHOLDS = {
  hotTemp: 90,        // °F — heat stress
  warmTemp: 85,       // °F — warm
  highHumidity: 85,   // % — mold risk
  heavyRain: 0.5,     // inches — significant rain
  lightRain: 0.1,     // inches — some rain
  highWind: 15,       // mph — physical damage risk
  strongWind: 20,     // mph — serious wind
  dryingWind: 8,      // mph — good for drying after rain
  droughtDays: 5,     // consecutive dry hot days
}

// Condition flag generators — each returns { icon, text, severity } or null
function analyzeConditions(recent, forecast) {
  const flags = []

  try {
  // --- Build the pattern narrative ---
  if (recent) {
    const { maxTemps = [], minHumidity = [], maxHumidity = [], daytimeMaxHumidity = [], sustainedDaytimeHumidity = false, totalRain = 0, maxWind = 0, recentRainDays = 0, dryHotDays = 0 } = recent || {}

    const avgHigh = maxTemps.length ? Math.round(maxTemps.reduce((a, b) => a + b, 0) / maxTemps.length) : null
    const peakTemp = maxTemps.length ? Math.round(Math.max(...maxTemps)) : null
    const overnightHumid = maxHumidity.length && Math.max(...maxHumidity) >= THRESHOLDS.highHumidity
    const daytimeDry = daytimeMaxHumidity.length && Math.max(...daytimeMaxHumidity) < THRESHOLDS.highHumidity
    const tempTrend = maxTemps.length >= 2 ? maxTemps[maxTemps.length - 1] - maxTemps[0] : 0

    // --- Pattern: heavy dew nights + dry afternoons (classic SE spring/summer) ---
    if (overnightHumid && daytimeDry && totalRain < THRESHOLDS.lightRain) {
      const dayHumid = daytimeMaxHumidity.length ? Math.round(Math.max(...daytimeMaxHumidity)) : null
      let dewNote = `Heavy dew overnight, drying out by afternoon`
      if (dayHumid) dewNote += ` (daytime peak ${dayHumid}%)`
      if (dryHotDays >= 2) dewNote += ` — ${dryHotDays} dry days running`
      flags.push({ icon: '🌤', text: dewNote, severity: 'good' })
    }

    // --- Heat pattern ---
    const hotDays = maxTemps.filter(t => t >= THRESHOLDS.hotTemp).length
    const warmDays = maxTemps.filter(t => t >= THRESHOLDS.warmTemp).length
    if (hotDays >= 2) {
      let heatNote = `${hotDays} days above ${THRESHOLDS.hotTemp}°F (peak ${peakTemp}°F)`
      if (tempTrend > 3) heatNote += ' — temps climbing'
      else if (tempTrend < -3) heatNote += ' — starting to cool'
      else heatNote += ' — holding steady'
      heatNote += '. Watch for soft/shriveled fruit'
      flags.push({ icon: '🌡', text: heatNote, severity: 'warn' })
    } else if (hotDays === 1) {
      let heatNote = `Hit ${peakTemp}°F`
      if (tempTrend > 3) heatNote += ' — temps trending up this week'
      else heatNote += ' recently'
      flags.push({ icon: '☀', text: heatNote, severity: 'info' })
    } else if (warmDays >= 2 && avgHigh) {
      // Not hot but consistently warm — worth noting
      let warmNote = `Averaging ${avgHigh}°F highs`
      if (tempTrend > 3) warmNote += ' — getting hotter'
      else if (tempTrend < -3) warmNote += ' — cooling off'
      flags.push({ icon: '☀', text: warmNote, severity: 'info' })
    }

    // --- Extended dry heat (shrivel risk) ---
    if (dryHotDays >= THRESHOLDS.droughtDays) {
      flags.push({ icon: '🏜', text: `${dryHotDays} consecutive hot dry days — expect shriveled berries, watch for dehydration`, severity: 'warn' })
    } else if (dryHotDays >= 3) {
      flags.push({ icon: '🏜', text: `${dryHotDays} dry days and counting — soil drying out`, severity: 'info' })
    }

    // --- Humidity: only flag sustained daytime humidity ---
    // Overnight dew is normal — don't flag it
    if (sustainedDaytimeHumidity && totalRain >= THRESHOLDS.lightRain) {
      flags.push({ icon: '💧', text: `Daytime humidity staying above ${THRESHOLDS.highHumidity}% + recent rain — real mold/decay pressure`, severity: 'warn' })
    } else if (sustainedDaytimeHumidity) {
      flags.push({ icon: '💧', text: `Humidity not burning off during the day (${Math.round(Math.max(...daytimeMaxHumidity))}%) — watch for moisture defects`, severity: 'info' })
    }

    // --- Rain ---
    if (totalRain >= THRESHOLDS.heavyRain) {
      flags.push({ icon: '🌧', text: `${totalRain.toFixed(1)}" rain in past 3 days — watch for soft fruit and splitting`, severity: 'warn' })
    } else if (totalRain >= THRESHOLDS.lightRain) {
      flags.push({ icon: '🌦', text: `Light rain recently (${totalRain.toFixed(1)}") — some moisture impact possible`, severity: 'info' })
    }

    // --- Rain after drought (cracking risk) ---
    if (dryHotDays >= 3 && totalRain >= THRESHOLDS.lightRain) {
      flags.push({ icon: '⚠', text: 'Rain after dry spell — increased cracking/splitting risk', severity: 'alert' })
    }

    // --- Wind ---
    if (maxWind >= THRESHOLDS.strongWind) {
      flags.push({ icon: '💨', text: `Winds hit ${Math.round(maxWind)} mph — check for physical damage, stem pull`, severity: 'warn' })
    } else if (maxWind >= THRESHOLDS.highWind) {
      flags.push({ icon: '🌬', text: `Gusts to ${Math.round(maxWind)} mph — minor wind damage possible`, severity: 'info' })
    }

    // --- Good drying wind after rain ---
    if (recentRainDays > 0 && maxWind >= THRESHOLDS.dryingWind && maxWind < THRESHOLDS.highWind) {
      flags.push({ icon: '✓', text: 'Good drying wind after rain — moisture clearing', severity: 'good' })
    }
  }

  // --- Forecast (what's coming) ---
  if (forecast) {
    const { highTemps, rainChance, windSpeed } = forecast
    const fcstParts = []

    if (highTemps.length) {
      const fcstHigh = Math.round(Math.max(...highTemps))
      if (fcstHigh >= THRESHOLDS.hotTemp) fcstParts.push(`${fcstHigh}°F`)
      else if (fcstHigh >= THRESHOLDS.warmTemp) fcstParts.push(`${fcstHigh}°F`)
    }

    if (rainChance > 60) fcstParts.push(`${rainChance}% rain`)
    else if (rainChance > 30) fcstParts.push(`${rainChance}% rain chance`)

    if (windSpeed >= THRESHOLDS.highWind) fcstParts.push(`${Math.round(windSpeed)} mph wind`)

    if (fcstParts.length > 0) {
      const severity = 'info'
      flags.push({ icon: '→', text: `Coming up: ${fcstParts.join(', ')}`, severity })
    } else if (recent && recent.dryHotDays >= 2) {
      flags.push({ icon: '→', text: 'More of the same in the forecast — dry pattern holding', severity: 'info' })
    }
  }

  } catch (err) {
    console.error('[weather] analysis error:', err)
    flags.push({ icon: '⚠', text: 'Weather data available but analysis failed — raw data may be incomplete', severity: 'info' })
  }

  // If nothing notable, say so
  if (flags.length === 0) {
    flags.push({ icon: '✓', text: 'Weather conditions look normal for berry quality', severity: 'good' })
  }

  return flags
}

// ============================================================
// NWS API fetching
// ============================================================

// Default location: 31634 (Homerville, GA area)
// Override by setting bc_weather_location in localStorage:
//   localStorage.setItem('bc_weather_location', JSON.stringify({lat: XX, lon: XX}))
const DEFAULT_LOCATION = { lat: 30.98, lon: -83.18 }

function getLocation() {
  const cached = localStorage.getItem(LOCATION_KEY)
  if (cached) {
    try { return JSON.parse(cached) } catch {}
  }
  return DEFAULT_LOCATION
}

async function fetchNWSPoint(lat, lon) {
  const res = await fetch(`${NWS}/points/${lat.toFixed(4)},${lon.toFixed(4)}`, {
    headers: { 'User-Agent': 'BerryCheck QC App (berrycheck@example.com)' }
  })
  if (!res.ok) throw new Error(`NWS points: ${res.status}`)
  return res.json()
}

async function fetchObservations(stationUrl) {
  const res = await fetch(`${stationUrl}/observations?limit=72`, {
    headers: { 'User-Agent': 'BerryCheck QC App (berrycheck@example.com)' }
  })
  if (!res.ok) throw new Error(`NWS observations: ${res.status}`)
  return res.json()
}

async function fetchForecast(forecastUrl) {
  const res = await fetch(forecastUrl, {
    headers: { 'User-Agent': 'BerryCheck QC App (berrycheck@example.com)' }
  })
  if (!res.ok) throw new Error(`NWS forecast: ${res.status}`)
  return res.json()
}

function cToF(c) { return c * 9 / 5 + 32 }
function mmToIn(mm) { return mm / 25.4 }
function kphToMph(kph) { return kph * 0.621371 }

function parseObservations(data) {
  const obs = data.features || []
  if (obs.length === 0) return null

  // Group by day (last 3 days)
  const now = new Date()
  const threeDaysAgo = new Date(now - 3 * 86400000)
  const recent = obs.filter(o => new Date(o.properties.timestamp) > threeDaysAgo)

  const maxTemps = []
  const minHumidity = []
  const maxHumidity = []
  const daytimeMaxHumidity = [] // 8am-6pm only — what actually matters for berry mold
  let totalRain = 0
  let maxWind = 0
  let recentRainDays = 0
  let dryHotDays = 0
  let sustainedDaytimeHumidity = false // humid through the heat of the day, not just overnight dew

  // Group by date
  const byDate = {}
  for (const o of recent) {
    const date = o.properties.timestamp?.slice(0, 10)
    if (!date) continue
    if (!byDate[date]) byDate[date] = []
    byDate[date].push(o.properties)
  }

  let consecutiveDryHot = 0
  const sortedDates = Object.keys(byDate).sort()

  for (const date of sortedDates) {
    const dayObs = byDate[date]
    const temps = dayObs.map(o => o.temperature?.value).filter(v => v != null).map(cToF)
    const humids = dayObs.map(o => o.relativeHumidity?.value).filter(v => v != null)
    const precip = dayObs.map(o => o.precipitationLastHour?.value).filter(v => v != null && v > 0)
    const winds = dayObs.map(o => o.windSpeed?.value).filter(v => v != null).map(kphToMph)
    const gusts = dayObs.map(o => o.windGust?.value).filter(v => v != null).map(kphToMph)

    // Daytime humidity (8am-6pm) — the hours that matter for mold pressure
    const daytimeObs = dayObs.filter(o => {
      const hour = new Date(o.timestamp).getHours()
      return hour >= 8 && hour <= 18
    })
    const daytimeHumids = daytimeObs.map(o => o.relativeHumidity?.value).filter(v => v != null)

    if (temps.length) maxTemps.push(Math.max(...temps))
    if (humids.length) {
      minHumidity.push(Math.min(...humids))
      maxHumidity.push(Math.max(...humids))
    }
    if (daytimeHumids.length) {
      const dayMax = Math.max(...daytimeHumids)
      daytimeMaxHumidity.push(dayMax)
      // Sustained = daytime humidity stayed high even when it should burn off
      if (dayMax >= THRESHOLDS.highHumidity) sustainedDaytimeHumidity = true
    }

    const dayRain = precip.reduce((s, v) => s + mmToIn(v), 0)
    totalRain += dayRain
    if (dayRain >= THRESHOLDS.lightRain) {
      recentRainDays++
      consecutiveDryHot = 0
    } else if (temps.length && Math.max(...temps) >= THRESHOLDS.warmTemp) {
      consecutiveDryHot++
    } else {
      consecutiveDryHot = 0
    }

    const allWinds = [...winds, ...gusts]
    if (allWinds.length) maxWind = Math.max(maxWind, ...allWinds)
  }

  dryHotDays = consecutiveDryHot

  return { maxTemps, minHumidity, maxHumidity, daytimeMaxHumidity, sustainedDaytimeHumidity, totalRain, maxWind, recentRainDays, dryHotDays }
}

function parseForecast(data) {
  const periods = data.properties?.periods || []
  if (periods.length === 0) return null

  // Look at next 2-3 periods (today/tonight/tomorrow)
  const upcoming = periods.slice(0, 4)
  const highTemps = upcoming.map(p => p.temperature).filter(t => t != null)
  const rainChance = Math.max(...upcoming.map(p => {
    const pcp = p.probabilityOfPrecipitation?.value
    return pcp != null ? pcp : 0
  }))
  const windSpeed = Math.max(...upcoming.map(p => {
    const match = p.windSpeed?.match(/(\d+)/)
    return match ? parseInt(match[1]) : 0
  }))

  return { highTemps, rainChance, windSpeed }
}

async function fetchWeatherData() {
  const loc = getLocation()
  if (!loc) return null

  const point = await fetchNWSPoint(loc.lat, loc.lon)
  const stationsUrl = point.properties.observationStations
  const forecastUrl = point.properties.forecast

  // Get nearest station
  const stationsRes = await fetch(stationsUrl, {
    headers: { 'User-Agent': 'BerryCheck QC App (berrycheck@example.com)' }
  })
  const stations = await stationsRes.json()
  const stationId = stations.features?.[0]?.id
  if (!stationId) return null

  const [obsData, fcstData] = await Promise.all([
    fetchObservations(stationId),
    fetchForecast(forecastUrl),
  ])

  const recent = parseObservations(obsData)
  const forecast = parseForecast(fcstData)
  const flags = analyzeConditions(recent, forecast)

  const stationName = stations.features?.[0]?.properties?.name || 'Unknown'

  return {
    flags,
    station: stationName,
    fetchedAt: new Date().toISOString(),
    recent,
    forecast,
  }
}

// ============================================================
// Severity styling
// ============================================================

const SEVERITY_STYLES = {
  alert: { bg: COLORS.redDim, border: COLORS.red + '40', color: COLORS.red },
  warn: { bg: COLORS.amberDim, border: COLORS.amber + '40', color: COLORS.amber },
  info: { bg: COLORS.bg2, border: COLORS.border, color: COLORS.text2 },
  good: { bg: COLORS.greenDim, border: COLORS.green + '40', color: COLORS.green },
}

function worstSeverity(flags) {
  const order = ['alert', 'warn', 'info', 'good']
  for (const s of order) {
    if (flags.some(f => f.severity === s)) return s
  }
  return 'info'
}

// ============================================================
// Component
// ============================================================

export default function WeatherBanner() {
  const [weather, setWeather] = useState(null)
  const [collapsed, setCollapsed] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    // Load from cache immediately
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      try {
        const data = JSON.parse(cached)
        setWeather(data)
      } catch {}
    }

    // Fetch fresh data
    let timer = null
    const doFetch = () => {
      fetchWeatherData()
        .then(data => {
          if (data) {
            setWeather(data)
            setError(false)
            localStorage.setItem(CACHE_KEY, JSON.stringify(data))
          }
        })
        .catch((err) => {
          console.error('[weather] fetch failed:', err)
          setError(true)
          // Retry later
          timer = setTimeout(doFetch, FETCH_RETRY)
        })
    }

    // Check if cache is stale
    if (cached) {
      try {
        const data = JSON.parse(cached)
        const age = Date.now() - new Date(data.fetchedAt).getTime()
        if (age > CACHE_TTL) doFetch()
      } catch {
        doFetch()
      }
    } else {
      doFetch()
    }

    // Refresh every 30 min
    const interval = setInterval(doFetch, CACHE_TTL)
    return () => { clearInterval(interval); if (timer) clearTimeout(timer) }
  }, [])

  // Show loading/error state so we can see the banner exists
  if (!weather && !error) {
    return (
      <div style={{
        background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
        borderRadius: 4, padding: '6px 12px', fontFamily: FONT,
        fontSize: 11, color: COLORS.text3,
      }}>
        WEATHER — loading...
      </div>
    )
  }

  if (error && !weather) {
    return (
      <div style={{
        background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
        borderRadius: 4, padding: '6px 12px', fontFamily: FONT,
        fontSize: 11, color: COLORS.text3,
      }}>
        WEATHER — offline (no cached data)
      </div>
    )
  }

  if (!weather || !weather.flags || weather.flags.length === 0) return null

  const severity = worstSeverity(weather.flags)
  const style = SEVERITY_STYLES[severity]
  const age = weather.fetchedAt ? Math.round((Date.now() - new Date(weather.fetchedAt).getTime()) / 60000) : null

  return (
    <div style={{
      background: style.bg, border: `1px solid ${style.border}`,
      borderRadius: 4, padding: '6px 12px', margin: '0',
      fontFamily: FONT,
    }}>
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <div style={{
          fontSize: 8, fontWeight: 700, color: style.color,
          letterSpacing: '0.08em', flexShrink: 0,
        }}>
          WEATHER
        </div>
        <div style={{ fontSize: 11, color: COLORS.text, flex: 1 }}>
          {collapsed
            ? weather.flags.filter(f => f.severity === severity).map(f => f.text).join(' · ')
            : weather.flags[0].icon + ' ' + weather.flags[0].text
          }
        </div>
        <div style={{ fontSize: 9, color: COLORS.text3, flexShrink: 0 }}>
          {age != null && age < 60 ? `${age}m ago` : age != null ? `${Math.round(age / 60)}h ago` : ''}
          {collapsed ? ' ▸' : weather.flags.length > 1 ? ' ▾' : ''}
        </div>
      </div>

      {!collapsed && weather.flags.length > 1 && (
        <div style={{ marginTop: 4, paddingLeft: 2 }}>
          {weather.flags.slice(1).map((flag, i) => {
            const fs = SEVERITY_STYLES[flag.severity]
            return (
              <div key={i} style={{
                fontSize: 11, color: COLORS.text, padding: '2px 0',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ color: fs.color, fontSize: 10, width: 16, textAlign: 'center' }}>{flag.icon}</span>
                <span>{flag.text}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
