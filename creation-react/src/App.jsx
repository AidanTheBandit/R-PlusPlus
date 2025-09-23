import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { r1 } from 'r1-create'
import './App.css'

function App() {
  const [isConnected, setIsConnected] = useState(false)
  const [deviceId, setDeviceId] = useState(null)
  const [deviceInfo, setDeviceInfo] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState('Initializing...')
  const [consoleLogs, setConsoleLogs] = useState([])

  const socketRef = useRef(null)
  const r1CreateRef = useRef(null)
  const consoleRef = useRef(null)

  // Console logging function
  const addConsoleLog = (message, type = 'info') => {
    const logEntry = {
      timestamp: new Date().toLocaleTimeString(),
      type,
      message
    }
    setConsoleLogs(prev => [...prev.slice(-99), logEntry]) // Keep last 100 logs
    console.log(`[${logEntry.timestamp}] ${type.toUpperCase()}: ${message}`)

    // Auto-scroll to bottom
    setTimeout(() => {
      if (consoleRef.current) {
        consoleRef.current.scrollTop = consoleRef.current.scrollHeight
      }
    }, 100)
  }

  // Error logging to server
  const sendErrorToServer = (level, message, stack = null) => {
    try {
      fetch('/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level,
          message: String(message),
          stack: stack ? String(stack) : null,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          deviceId: deviceId
        })
      }).catch(err => {
        console.warn('Failed to send error to server:', err)
      })
    } catch (err) {
      console.warn('Error logging failed:', err)
    }
  }

  // Socket connection
  const connectSocket = () => {
    addConsoleLog('Starting Socket.IO connection attempt')

    if (socketRef.current && socketRef.current.connected) {
      addConsoleLog('Socket.IO already connected')
      return
    }

    // Socket.IO configuration
    socketRef.current = io('/', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      timeout: 5000,
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5
    })

    // Connection events
    socketRef.current.on('connect', () => {
      addConsoleLog('Socket.IO connected successfully')
      setIsConnected(true)
      setConnectionStatus('Connected')
    })

    socketRef.current.on('disconnect', () => {
      addConsoleLog('Socket.IO disconnected', 'warn')
      setIsConnected(false)
      setConnectionStatus('Disconnected')
      setDeviceId(null)

      // Clear any pending request data on disconnect
      if (socketRef.current._pendingRequestId) {
        socketRef.current._pendingRequestId = null
        socketRef.current._originalMessage = null
      }

      // Clear heartbeat interval
      if (socketRef.current._heartbeatInterval) {
        clearInterval(socketRef.current._heartbeatInterval)
        socketRef.current._heartbeatInterval = null
      }
    })

    socketRef.current.on('connect_error', (error) => {
      addConsoleLog(`Socket.IO connection error: ${error.message}`, 'error')
      setIsConnected(false)
      setConnectionStatus(`Connection error: ${error.message}`)
      sendErrorToServer('error', `Socket connection failed: ${error.message}`)
    })

    socketRef.current.on('reconnect', (attemptNumber) => {
      addConsoleLog(`Socket.IO reconnected after ${attemptNumber} attempts`)
      setIsConnected(true)
      setConnectionStatus('Reconnected')
    })

    socketRef.current.on('reconnect_error', (error) => {
      addConsoleLog(`Socket.IO reconnection failed: ${error.message}`, 'error')
      sendErrorToServer('error', `Socket reconnection failed: ${error.message}`)
    })

    // Handle pong responses from server
    socketRef.current.on('pong', (data) => {
      const latency = Date.now() - data.timestamp
      addConsoleLog(`🏓 Pong received, latency: ${latency}ms`)
    })

    // Add heartbeat/ping mechanism
    const heartbeatInterval = setInterval(() => {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('ping', { timestamp: Date.now(), deviceId })
      }
    }, 30000) // Ping every 30 seconds

    // Store the interval so we can clear it on disconnect
    socketRef.current._heartbeatInterval = heartbeatInterval

    // Application events
    socketRef.current.on('connected', (data) => {
      setDeviceId(data.deviceId)
      setDeviceInfo({
        pinCode: data.pinCode,
        pinEnabled: data.pinEnabled !== false && data.pinCode !== null
      })
      setConnectionStatus(`Connected - Device: ${data.deviceId}`)
      addConsoleLog(`Connected with device ID: ${data.deviceId}`)
      addConsoleLog(`Received PIN from socket: ${data.pinCode}`, 'info')

      // Automatically refresh device info to get the latest PIN from server
      setTimeout(() => {
        if (data.deviceId) {
          refreshDeviceInfoDirect(data.deviceId)
        }
      }, 1000)
    })

    // Handle incoming chat completion requests
    socketRef.current.on('chat_completion', (data) => {
      addConsoleLog(`📥 Received chat completion request: ${data.message?.substring(0, 50)}...`)

      if (r1CreateRef.current && r1CreateRef.current.messaging) {
        try {
          // Store requestId for response
          const currentRequestId = data.requestId || data.data?.requestId
          const messageToSend = data.message || data.data?.message

          // Use R1 SDK messaging API to send message to LLM
          r1CreateRef.current.messaging.sendMessage(messageToSend, {
            useLLM: true,
            requestId: currentRequestId
          })

          // Store the requestId for when we get the response
          if (currentRequestId) {
            socketRef.current._pendingRequestId = currentRequestId
            socketRef.current._originalMessage = data.originalMessage || data.data?.originalMessage
          }

          addConsoleLog(`📤 Sent message to R1 LLM via messaging API, requestId: ${currentRequestId}`)
        } catch (error) {
          addConsoleLog(`R1 SDK messaging error: ${error.message}`, 'error')
          socketRef.current.emit('error', {
            requestId: data.requestId || data.data?.requestId,
            error: `R1 SDK messaging error: ${error.message}`,
            deviceId
          })
          sendErrorToServer('error', `R1 SDK messaging failed: ${error.message}`)
        }
      } else {
        addConsoleLog('R1 SDK messaging not available - cannot process message', 'error')
        socketRef.current.emit('error', {
          requestId: data.requestId || data.data?.requestId,
          error: 'R1 SDK messaging not available - this app must run on R1 device',
          deviceId
        })
      }
    })

    // Handle device connection/disconnection broadcasts
    socketRef.current.on('device_connected', (data) => {
      addConsoleLog(`📱 Device connected: ${data.deviceId}`)
    })

    socketRef.current.on('device_disconnected', (data) => {
      addConsoleLog(`📱 Device disconnected: ${data.deviceId}`)
    })

    // Handle debug data broadcasts
    socketRef.current.on('debug_data', (data) => {
      addConsoleLog(`🔍 ${data.type}: ${JSON.stringify(data.data).substring(0, 100)}...`)
    })
  }

  // Initialize R1 SDK
  useEffect(() => {
    try {
      // Check if R1 SDK is available
      if (r1 && r1.messaging) {
        r1CreateRef.current = r1
        addConsoleLog('R1 SDK available')

        // Check what APIs are available
        const availableAPIs = []
        if (r1.messaging) availableAPIs.push('messaging')
        if (r1.llm) availableAPIs.push('llm')
        if (r1.camera) availableAPIs.push('camera')
        if (r1.hardware) availableAPIs.push('hardware')
        if (r1.storage) availableAPIs.push('storage')
        if (r1.microphone) availableAPIs.push('microphone')
        if (r1.speaker) availableAPIs.push('speaker')

        addConsoleLog(`Available R1 APIs: ${availableAPIs.join(', ')}`)

        // Set up message handler for LLM responses
        r1.messaging.onMessage((response) => {
          addConsoleLog(`📤 R1 SDK message received: ${JSON.stringify(response).substring(0, 100)}...`)

          // The R1 responds with {"message":"text"}, so extract the response text
          const responseText = response.message || response.content || response

          // Send response via socket (server will handle requestId matching)
          if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit('response', {
              requestId: socketRef.current._pendingRequestId,
              response: responseText,
              originalMessage: socketRef.current._originalMessage,
              model: 'r1-llm',
              timestamp: new Date().toISOString(),
              deviceId
            })
            addConsoleLog(`📤 Sent R1 SDK response via socket: "${responseText.substring(0, 50)}..." (requestId: ${socketRef.current._pendingRequestId})`)

            // Clear the pending request data
            socketRef.current._pendingRequestId = null
            socketRef.current._originalMessage = null
          } else {
            addConsoleLog('Socket not connected, cannot send response', 'error')
          }
        })
      } else {
        addConsoleLog('R1 SDK messaging not available - this app must run on R1 device', 'error')
        console.error('r1 object:', r1)
      }
    } catch (error) {
      addConsoleLog(`R1 SDK initialization error: ${error.message}`, 'error')
      console.error('R1 SDK initialization error details:', error)
    }

    // Connect socket after R1 SDK initialization
    connectSocket()
  }, [])

  const handleReconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }
    setDeviceId(null)
    setDeviceInfo(null)
    connectSocket()
  }

  const refreshDeviceInfoDirect = async (targetDeviceId) => {
    try {
      addConsoleLog(`Refreshing device info for: ${targetDeviceId}`, 'info')
      const response = await fetch(`/${targetDeviceId}/info`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        addConsoleLog(`Device info refreshed: PIN=${data.pinCode}, enabled=${data.pinEnabled}`, 'info')
        setDeviceInfo({
          pinCode: data.pinCode,
          pinEnabled: data.pinEnabled !== false && data.pinCode !== null
        })
      } else {
        addConsoleLog(`Failed to refresh device info: ${response.status}`, 'error')
      }
    } catch (error) {
      addConsoleLog(`Error refreshing device info: ${error.message}`, 'error')
    }
  }

  const handleRefreshDeviceInfo = async () => {
    if (!deviceId) {
      addConsoleLog('No device connected', 'warn')
      return
    }
    await refreshDeviceInfoDirect(deviceId)
  }

  const handleDisablePin = async () => {
    if (!deviceId) {
      addConsoleLog('No device ID available', 'error')
      return
    }

    if (!deviceInfo?.pinCode) {
      addConsoleLog('No PIN available - refreshing device info first', 'warn')
      await refreshDeviceInfoDirect(deviceId)

      // Check again after refresh
      if (!deviceInfo?.pinCode) {
        addConsoleLog('Still no PIN after refresh - cannot disable', 'error')
        return
      }
    }

    addConsoleLog(`=== PIN DISABLE ATTEMPT ===`, 'info')
    addConsoleLog(`Device ID: ${deviceId}`, 'info')
    addConsoleLog(`Client PIN: ${deviceInfo.pinCode}`, 'info')
    addConsoleLog(`PIN Enabled: ${deviceInfo.pinEnabled}`, 'info')

    try {
      const url = `/${deviceId}/disable-pin`
      addConsoleLog(`Request URL: ${url}`, 'info')
      addConsoleLog(`Authorization: Bearer ${deviceInfo.pinCode}`, 'info')

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${deviceInfo.pinCode}`,
          'Content-Type': 'application/json'
        }
      })

      addConsoleLog(`Response: ${response.status} ${response.statusText}`, 'info')

      if (response.ok) {
        setDeviceInfo(prev => ({ ...prev, pinEnabled: false, pinCode: null }))
        addConsoleLog('✅ PIN disabled successfully', 'info')
      } else {
        const responseText = await response.text()
        addConsoleLog(`❌ Server response: ${responseText}`, 'error')

        // If auth error, refresh and try once more
        if (response.status === 401 || response.status === 403) {
          addConsoleLog('🔄 Auth failed - refreshing PIN and retrying once', 'warn')
          await refreshDeviceInfoDirect(deviceId)

          // Retry once with fresh PIN
          if (deviceInfo?.pinCode) {
            addConsoleLog(`🔄 Retrying with fresh PIN: ${deviceInfo.pinCode}`, 'info')
            const retryResponse = await fetch(url, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${deviceInfo.pinCode}`,
                'Content-Type': 'application/json'
              }
            })

            if (retryResponse.ok) {
              setDeviceInfo(prev => ({ ...prev, pinEnabled: false, pinCode: null }))
              addConsoleLog('✅ PIN disabled successfully on retry', 'info')
            } else {
              const retryText = await retryResponse.text()
              addConsoleLog(`❌ Retry also failed: ${retryText}`, 'error')
            }
          }
        }
      }
    } catch (error) {
      addConsoleLog(`❌ Network error: ${error.message}`, 'error')
    }
  }

  const handleEnablePin = async () => {
    if (!deviceId) {
      addConsoleLog('No device connected', 'warn')
      return
    }

    const newPin = prompt('Enter new 6-digit PIN code:')
    if (!newPin || newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      addConsoleLog('Invalid PIN format. Must be exactly 6 digits.', 'error')
      return
    }

    try {
      const response = await fetch(`/${deviceId}/enable-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newPin })
      })

      if (response.ok) {
        await response.json() // consume response
        setDeviceInfo(prev => ({ ...prev, pinEnabled: true, pinCode: newPin }))
        addConsoleLog(`PIN enabled successfully: ${newPin}`, 'info')
      } else {
        let errorMessage = 'Unknown error'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`
        } catch (parseError) {
          errorMessage = `HTTP ${response.status} - ${response.statusText}`
        }
        addConsoleLog(`Failed to enable PIN: ${errorMessage}`, 'error')
      }
    } catch (error) {
      addConsoleLog(`Error enabling PIN: ${error.message}`, 'error')
    }
  }

  const handleChangePin = async () => {
    if (!deviceId || !deviceInfo?.pinCode) {
      addConsoleLog('No current PIN to change', 'warn')
      return
    }

    const currentPin = prompt('Enter current PIN code:')
    if (!currentPin) return

    const newPin = prompt('Enter new 6-digit PIN code:')
    if (!newPin || newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      addConsoleLog('Invalid PIN format. Must be exactly 6 digits.', 'error')
      return
    }

    try {
      const response = await fetch(`/${deviceId}/change-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ currentPin, newPin })
      })

      if (response.ok) {
        setDeviceInfo(prev => ({ ...prev, pinCode: newPin }))
        addConsoleLog(`PIN changed successfully: ${newPin}`, 'info')
      } else {
        let errorMessage = 'Unknown error'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`
        } catch (parseError) {
          errorMessage = `HTTP ${response.status} - ${response.statusText}`
        }
        addConsoleLog(`Failed to change PIN: ${errorMessage}`, 'error')
      }
    } catch (error) {
      addConsoleLog(`Error changing PIN: ${error.message}`, 'error')
    }
  }

  // Initialize on mount
  useEffect(() => {
    addConsoleLog('R1 Anywhere Console initialized')

    // Override console methods for error logging
    const originalConsoleError = console.error
    const originalConsoleWarn = console.warn

    console.error = (...args) => {
      const message = args.join(' ')
      const stack = new Error().stack
      sendErrorToServer('error', message, stack)
      originalConsoleError.apply(console, args)
    }

    console.warn = (...args) => {
      const message = args.join(' ')
      sendErrorToServer('warn', message)
      originalConsoleWarn.apply(console, args)
    }

    // Global error handlers
    window.addEventListener('error', (event) => {
      sendErrorToServer('error', event.message, event.error?.stack)
    })

    window.addEventListener('unhandledrejection', (event) => {
      sendErrorToServer('error', `Unhandled promise rejection: ${event.reason}`, event.reason?.stack)
    })

    // Cleanup
    return () => {
      if (socketRef.current) {
        if (socketRef.current._heartbeatInterval) {
          clearInterval(socketRef.current._heartbeatInterval)
        }
        socketRef.current.disconnect()
      }
    }
  }, [])

  return (
    <div className="app">
      {/* Top Status Bar */}
      <div className="status-bar">
        <div className="status-left">
          <div className="app-title">
            <span className="icon">⚡</span>
            <span>R1 Anywhere</span>
          </div>
          <div className={`connection-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            <div className="pulse"></div>
            <span>{isConnected ? 'Online' : 'Offline'}</span>
          </div>
        </div>

        <div className="status-right">
          {deviceId && (
            <div className="device-badge">
              <span className="device-label">Device</span>
              <code className="device-code">{deviceId}</code>
            </div>
          )}

          {deviceInfo?.pinEnabled && deviceInfo?.pinCode && (
            <div className="pin-badge">
              <span className="pin-label">PIN</span>
              <code className="pin-code">{deviceInfo.pinCode}</code>
              <div className="pin-actions">
                <button className="pin-action" onClick={handleChangePin} title="Change PIN">
                  <span>⟲</span>
                </button>
                <button className="pin-action danger" onClick={handleDisablePin} title="Disable PIN">
                  <span>✕</span>
                </button>
              </div>
            </div>
          )}

          {(!deviceInfo?.pinEnabled || !deviceInfo?.pinCode) && deviceId && (
            <button className="enable-pin-btn" onClick={handleEnablePin} title="Enable PIN">
              <span>🔒</span>
              <span>Enable PIN</span>
            </button>
          )}

          {deviceId && (
            <button
              className="refresh-btn"
              onClick={handleRefreshDeviceInfo}
              title="Refresh device info"
            >
              <span>🔄</span>
            </button>
          )}

          <button
            className={`reconnect-btn ${isConnected ? 'connected' : 'disconnected'}`}
            onClick={handleReconnect}
            disabled={isConnected}
            title={isConnected ? 'Connected' : 'Reconnect'}
          >
            <span>{isConnected ? '●' : '⟲'}</span>
          </button>
        </div>
      </div>

      {/* Main Content - Activity Log */}
      <div className="main-content">
        <div className="console-panel">
          <div className="console-header">
            <div className="console-title">
              <span className="console-icon">📝</span>
              <span>Activity Log</span>
            </div>
            <div className="console-stats">
              <span className="log-count">{consoleLogs.length}</span>
              <span className="log-label">entries</span>
            </div>
          </div>

          <div className="console-content" ref={consoleRef}>
            {consoleLogs.length === 0 ? (
              <div className="console-empty">
                <div className="empty-icon">�n</div>
                <div className="empty-text">Waiting for activity...</div>
              </div>
            ) : (
              consoleLogs.map((log, index) => (
                <div key={index} className={`console-entry ${log.type}`}>
                  <div className="entry-time">{log.timestamp}</div>
                  <div className="entry-level">
                    <span className={`level-badge ${log.type}`}>
                      {log.type === 'error' ? '❌' : log.type === 'warn' ? '⚠️' : log.type === 'info' ? 'ℹ️' : '📝'}
                    </span>
                  </div>
                  <div className="entry-message">{log.message}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App