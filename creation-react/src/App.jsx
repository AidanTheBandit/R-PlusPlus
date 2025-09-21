import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import './App.css'

function App() {
  const [isConnected, setIsConnected] = useState(false)
  const [deviceId, setDeviceId] = useState(null)
  const [statusMessage, setStatusMessage] = useState('Initializing...')
  const [debugLogs, setDebugLogs] = useState([])
  const socketRef = useRef(null)
  const r1CreateRef = useRef(null)

  // Initialize R1 Create if available
  useEffect(() => {
    if (window.r1Create) {
      r1CreateRef.current = window.r1Create
      addDebugLog('R1 Create API available')
    } else {
      addDebugLog('R1 Create API not found', 'warn')
    }
  }, [])

  // Debug logging function
  const addDebugLog = (message, level = 'info') => {
    const logEntry = {
      timestamp: new Date().toLocaleTimeString(),
      level,
      message
    }
    setDebugLogs(prev => [...prev.slice(-49), logEntry]) // Keep last 50 logs
    console.log(`[${logEntry.timestamp}] ${level.toUpperCase()}: ${message}`)
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
          deviceId
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
    addDebugLog('Starting Socket.IO connection attempt')

    if (socketRef.current && socketRef.current.connected) {
      addDebugLog('Socket.IO already connected')
      return
    }

    // Socket.IO configuration - same as R1-Walky
    socketRef.current = io('/', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      timeout: 5000,
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    })

    // Connection events
    socketRef.current.on('connect', () => {
      addDebugLog('Socket.IO connected successfully')
      setIsConnected(true)
      setStatusMessage('Connected')
    })

    socketRef.current.on('disconnect', () => {
      addDebugLog('Socket.IO disconnected', 'warn')
      setIsConnected(false)
      setStatusMessage('Disconnected')
      setDeviceId(null)
    })

    socketRef.current.on('connect_error', (error) => {
      addDebugLog(`Socket.IO connection error: ${error.message}`, 'error')
      setIsConnected(false)
      setStatusMessage(`Connection error: ${error.message}`)
      sendErrorToServer('error', `Socket connection failed: ${error.message}`)
    })

    socketRef.current.on('reconnect', (attemptNumber) => {
      addDebugLog(`Socket.IO reconnected after ${attemptNumber} attempts`)
    })

    socketRef.current.on('reconnect_error', (error) => {
      addDebugLog(`Socket.IO reconnection failed: ${error.message}`, 'error')
      sendErrorToServer('error', `Socket reconnection failed: ${error.message}`)
    })

    // Application events
    socketRef.current.on('connected', (data) => {
      setDeviceId(data.deviceId)
      setStatusMessage(`Connected - ID: ${data.deviceId}`)
      addDebugLog(`Connected with device ID: ${data.deviceId}`)
    })

    socketRef.current.on('chat_completion', (data) => {
      addDebugLog(`Received chat completion: ${JSON.stringify(data).substring(0, 100)}...`)

      if (r1CreateRef.current) {
        r1CreateRef.current.process(data.message).then(response => {
          socketRef.current.emit('response', {
            originalMessage: data.message,
            response,
            model: data.model,
            timestamp: new Date().toISOString(),
            deviceId
          })
          addDebugLog('Sent response to server')
        }).catch(err => {
          addDebugLog(`R1 Create processing error: ${err.message}`, 'error')
          socketRef.current.emit('error', {
            error: err.message,
            deviceId
          })
          sendErrorToServer('error', `R1 Create processing failed: ${err.message}`)
        })
      } else {
        addDebugLog('R1 Create not available, cannot process message', 'error')
      }
    })
  }

  const handleReconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }
    setDeviceId(null)
    connectSocket()
  }

  // Initialize on mount
  useEffect(() => {
    addDebugLog('R1 Creation React App initialized')

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

    // Connect socket
    connectSocket()

    // Cleanup
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [])

  return (
    <div className="app">
      <div className="container">
        <h2>R1 Creation - React</h2>

        <div className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
          {statusMessage}
        </div>

        <button
          className="reconnect-btn"
          onClick={handleReconnect}
          disabled={isConnected}
        >
          {isConnected ? 'Connected' : 'Reconnect'}
        </button>

        <div className="debug-panel">
          <div className="debug-header">
            Debug Log: <span className="debug-status">Active</span>
          </div>
          <div className="debug-log">
            {debugLogs.map((log, index) => (
              <div key={index} className={`debug-entry debug-${log.level}`}>
                [{log.timestamp}] {log.level.toUpperCase()}: {log.message}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App