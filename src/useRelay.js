import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * WebSocket hook for phone↔laptop relay.
 * @param {string} role - 'phone' or 'dashboard'
 * @param {function} onImage - callback when an image is received (dashboard only)
 */
export function useRelay(role, onImage) {
  const wsRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const [phonesOnline, setPhonesOnline] = useState(0)
  const [lastAck, setLastAck] = useState(null)

  useEffect(() => {
    // Connect to relay server on port 5175
    const host = window.location.hostname || 'localhost'
    const url = `ws://${host}:5175?role=${role}`

    let ws = null
    let retryTimeout = null

    function connect() {
      ws = new WebSocket(url)

      ws.onopen = () => {
        setConnected(true)
        wsRef.current = ws
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)

          if (msg.type === 'image' && onImage) {
            onImage(msg.data, msg.timestamp)
          }

          if (msg.type === 'status') {
            setPhonesOnline(msg.phones || 0)
          }

          if (msg.type === 'ack') {
            setLastAck(msg.message)
          }
        } catch (e) {
          console.error('Relay message error:', e)
        }
      }

      ws.onclose = () => {
        setConnected(false)
        wsRef.current = null
        // Auto-reconnect after 3 seconds
        retryTimeout = setTimeout(connect, 3000)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      if (retryTimeout) clearTimeout(retryTimeout)
      if (ws) ws.close()
    }
  }, [role]) // intentionally not including onImage to avoid reconnects

  const sendImage = useCallback((dataUrl) => {
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'image', data: dataUrl }))
      return true
    }
    return false
  }, [])

  return { connected, phonesOnline, sendImage, lastAck }
}
