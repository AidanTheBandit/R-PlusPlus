import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import './App.css'

/**
 * App — R1 Device Screen.
 *
 * Connects to the R-API server via Socket.IO. The server auto-generates a
 * device ID and PIN on connect and sends them back in a `connected` event.
 * This screen DISPLAYS them like a pairing code — you read them here and
 * enter them in the Control Panel.
 */
function App() {
  const [deviceId, setDeviceId] = useState(() => localStorage.getItem('r1-device-id'))
  const [pinCode, setPinCode] = useState(() => localStorage.getItem('r1-pin-code'))
  const [connected, setConnected] = useState(false)
  const [reconnecting, setReconnecting] = useState(!!localStorage.getItem('r1-device-id'))

  useEffect(() => {
    const socket = io({
      path: '/socket.io/',
      transports: ['polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    })

    socket.on('connect', () => {
      setConnected(true)
    })

    socket.on('connected', (data) => {
      setDeviceId(data.deviceId)
      setPinCode(data.pinCode)
      setReconnecting(data.isReconnection || false)

      // Persist device ID, PIN, and secret for reconnection + instant display
      localStorage.setItem('r1-device-id', data.deviceId)
      localStorage.setItem('r1-pin-code', data.pinCode || '')
      if (data.deviceSecret) {
        document.cookie = `r1_device_secret=${data.deviceSecret}; max-age=2592000; path=/`
        localStorage.setItem('r1-device-secret', data.deviceSecret)
      }
    })

    socket.on('disconnect', () => {
      setConnected(false)
    })

    socket.on('connect_error', () => {
      setConnected(false)
    })

    // Upgrade to websocket after polling establishes connection (Cloudflare tunnel safe)
    socket.io.on('reconnect_attempt', () => {
      socket.io.opts.transports = ['polling']
    })

    return () => socket.close()
  }, [])

  return (
    <div className="creation-viewport">
      <div className="creation-canvas device-screen">
        {/* Brand stripe */}
        <div className="brand-stripe">
          <div className="seg-1"></div>
          <div className="seg-2"></div>
          <div className="seg-3"></div>
        </div>

        <div className="device-body">
          {/* Logo mark */}
          <div className="device-logo" aria-hidden="true">
            <span className="device-logo-mark">R</span>
          </div>

          {deviceId ? (
            <>
              {/* Connection indicator */}
              <div className={`device-status ${connected ? 'online' : 'offline'}`}>
                <span className="device-status-dot"></span>
                {reconnecting ? 'Reconnected' : connected ? 'Connected' : 'Reconnecting'}
              </div>

              {/* Device ID display */}
              <div className="device-info">
                <p className="device-info-label">Device ID</p>
                <p className="device-info-value">{deviceId}</p>
              </div>

              {/* PIN display */}
              {pinCode && (
                <div className="device-pin">
                  <p className="device-info-label">PIN</p>
                  <p className="device-pin-value">
                    {pinCode.split('').map((digit, i) => (
                      <span key={i} className="device-pin-digit">{digit}</span>
                    ))}
                  </p>
                </div>
              )}

              {/* Instructions */}
              <p className="device-hint">
                Enter these in the Control Panel
              </p>
            </>
          ) : (
            <div className="device-connecting">
              <div className="device-spinner"></div>
              <p className="device-connecting-text">Connecting</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
