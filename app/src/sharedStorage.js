/**
 * Shared storage — replaces localStorage with server-backed storage.
 * All devices hitting the same server share one data store.
 * Falls back to localStorage if server is unreachable.
 *
 * Usage (drop-in replacement):
 *   import { store } from './sharedStorage'
 *
 *   // Load (async — returns parsed JSON or fallback)
 *   const data = await store.get('bc_history', [])
 *
 *   // Save (async — writes to server + localStorage cache)
 *   await store.set('bc_history', data)
 *
 *   // For React state init, use store.getSync() which reads localStorage cache
 *   const [data, setData] = useState(() => store.getSync('bc_history', []))
 */

const API_BASE = '/api/store'

// In-memory cache to avoid redundant fetches within the same session
const cache = new Map()

// Debounce timers per key
const saveTimers = new Map()
const DEBOUNCE_MS = 300

export const store = {
  /**
   * Async get — fetches from server, falls back to localStorage.
   * Use this in useEffect or event handlers.
   */
  async get(key, fallback = null) {
    try {
      const res = await fetch(`${API_BASE}/${key}`)
      const data = await res.json()
      if (data !== null) {
        // Update local cache
        cache.set(key, data)
        localStorage.setItem(key, JSON.stringify(data))
        return data
      }
    } catch {
      // Server unreachable — fall through to localStorage
    }

    // Try localStorage
    try {
      const local = localStorage.getItem(key)
      if (local) return JSON.parse(local)
    } catch {}

    return fallback
  },

  /**
   * Sync get — reads from localStorage cache only.
   * Use this for React useState initializers (can't be async).
   */
  getSync(key, fallback = null) {
    // Check in-memory cache first
    if (cache.has(key)) return cache.get(key)

    try {
      const local = localStorage.getItem(key)
      if (local) {
        const parsed = JSON.parse(local)
        cache.set(key, parsed)
        return parsed
      }
    } catch {}

    return fallback
  },

  /**
   * Async set — writes to server + localStorage cache.
   * Debounced to avoid flooding on rapid updates.
   */
  async set(key, data) {
    // Update local immediately (cache + localStorage)
    cache.set(key, data)
    try {
      localStorage.setItem(key, JSON.stringify(data))
    } catch {}

    // Debounced server write
    if (saveTimers.has(key)) clearTimeout(saveTimers.get(key))
    saveTimers.set(key, setTimeout(async () => {
      saveTimers.delete(key)
      try {
        await fetch(`${API_BASE}/${key}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
      } catch {
        // Server unreachable — data is still in localStorage
      }
    }, DEBOUNCE_MS))
  },

  /**
   * Remove a key from both server and localStorage.
   */
  async remove(key) {
    cache.delete(key)
    try { localStorage.removeItem(key) } catch {}
    try {
      await fetch(`${API_BASE}/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(null),
      })
    } catch {}
  },

  /**
   * Sync from server — pull all known keys from server into localStorage.
   * Call once on app startup to hydrate from server state.
   */
  async sync(keys) {
    for (const key of keys) {
      await store.get(key)
    }
  },
}

// All known BerryCheck storage keys
export const ALL_KEYS = [
  'bc_history', 'bc_packlog', 'bc_receipts', 'bc_packplan',
  'bc_prepack', 'bc_dc_results', 'bc_features', 'bc_packcodes_db',
  'bc_packcodes_favorites', 'bc_zones', 'bc_accuracy', 'bc_training',
  'bc_dc_strictness', 'bc_target_score', 'bc_dc_log',
  'bc_compliance_config', 'bc_compliance_done', 'bc_qc_simple_view',
]
