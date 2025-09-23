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
  const [pinEnabled, setPinEnabled] = useState(true)
  const [pinCode, setPinCode] = useState(null)
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
      setPinEnabled(data.pinEnabled !== false && data.pinCode !== null)
      setPinCode(data.pinCode)
      setConnectionStatus(`Connected - Device: ${data.deviceId}`)
      addConsoleLog(`Connected with device ID: ${data.deviceId}`)
      if (data.pinCode) {
        addConsoleLog(`PIN Code: ${data.pinCode} (use as API key)`, 'info')
      }
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

  const handleDisablePin = async () => {
    if (!deviceId || !deviceInfo?.pinCode) {
      addConsoleLog('No PIN to disable', 'warn')
      return
    }

    try {
      const response = await fetch(`/${deviceId}/disable-pin`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${deviceInfo.pinCode}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        setDeviceInfo(prev => ({ ...prev, pinEnabled: false }))
        setPinEnabled(false)
        addConsoleLog('PIN disabled successfully', 'info')
      } else {
        const error = await response.json()
        addConsoleLog(`Failed to disable PIN: ${error.error}`, 'error')
      }
    } catch (error) {
      addConsoleLog(`Error disabling PIN: ${error.message}`, 'error')
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
        const data = await response.json()
        setDeviceInfo(prev => ({ ...prev, pinEnabled: true, pinCode: newPin }))
        setPinEnabled(true)
        setPinCode(newPin)
        addConsoleLog(`PIN enabled successfully: ${newPin}`, 'info')
      } else {
        const error = await response.json()
        addConsoleLog(`Failed to enable PIN: ${error.error}`, 'error')
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
        setPinCode(newPin)
        addConsoleLog(`PIN changed successfully: ${newPin}`, 'info')
      } else {
        const error = await response.json()
        addConsoleLog(`Failed to change PIN: ${error.error}`, 'error')
      }
    } catch (error) {
      addConsoleLog(`Error changing PIN: ${error.message}`, 'error')
    }
  }

  // Initialize on mount
  useEffect(() => {
    addConsoleLog('R1 Creation Console initialized')

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
      <div className="header">
        <div className="header-top">
          <h1>R1 Device Console</h1>
          <div className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
            {connectionStatus}
          </div>
        </div>
        <div className="header-info">
          {deviceId && (
            <div className="device-id">
              Device ID: <code>{deviceId}</code>
            </div>
          )}
          <div className="pin-controls">
            {pinEnabled && pinCode && (
              <div className="pin-info">
                PIN: <code>{pinCode}</code>
                <button
                  className="disable-pin-btn"
                  onClick={handleDisablePin}
                  title="Disable PIN authentication"
                >
                  ✕
                </button>
                <button
                  className="change-pin-btn"
                  onClick={handleChangePin}
                  title="Change PIN code"
                >
                  ⟲
                </button>
              </div>
            )}
            {(!pinEnabled || !pinCode) && (
              <div className="pin-info">
                <span className="pin-disabled">No PIN</span>
                <button
                  className="enable-pin-btn"
                  onClick={handleEnablePin}
                  title="Enable PIN authentication"
                >
                  +
                </button>
              </div>
            )}
          </div>
          <button
            className="reconnect-btn"
            onClick={handleReconnect}
            disabled={isConnected}
            title={isConnected ? 'Connected' : 'Reconnect to server'}
          >
            {isConnected ? '●' : '⟲'}
          </button>
        </div>
      </div>

      <div className="console-container">
        <div className="console-header">
          <h3>Activity Log</h3>
          <span className="log-count">{consoleLogs.length} entries</span>
        </div>
        <div className="console" ref={consoleRef}>
          {consoleLogs.map((log, index) => (
            <div key={index} className={`console-line ${log.type}`}>
              <span className="timestamp">[{log.timestamp}]</span>
              <span className="level">{log.type.toUpperCase()}</span>
              <span className="message">{log.message}</span>
            </div>
          ))}
          {consoleLogs.length === 0 && (
            <div className="console-placeholder">
              Waiting for activity...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App