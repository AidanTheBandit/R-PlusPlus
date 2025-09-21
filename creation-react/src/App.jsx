import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { r1 } from 'r1-create'
import './App.css'

function App() {
  const [isConnected, setIsConnected] = useState(false)
  const [deviceId, setDeviceId] = useState(null)
  const [statusMessage, setStatusMessage] = useState('Initializing...')
  const [debugLogs, setDebugLogs] = useState([])
  const socketRef = useRef(null)
  const r1CreateRef = useRef(null)
  const messageRequestMap = useRef(new Map()) // Map to store message -> requestId

  // Initialize R1 SDK
  useEffect(() => {
    try {
      // Check if R1 SDK is available
      if (r1 && r1.messaging) {
        r1CreateRef.current = r1
        addDebugLog('R1 SDK available')
        
        // Set up message handler for LLM responses
        r1.messaging.onMessage((response) => {
          addDebugLog(`R1 SDK message received: ${JSON.stringify(response).substring(0, 100)}...`)
          
          // Try to find the requestId for this response
          // The response might contain the original message or we need to match it
          let requestId = null
          let originalMessage = null
          
          // Check if response contains the original message
          if (response.originalMessage) {
            originalMessage = response.originalMessage
            requestId = messageRequestMap.current.get(originalMessage)
          } else if (response.message) {
            // Sometimes the response might be the echoed message
            originalMessage = response.message
            requestId = messageRequestMap.current.get(originalMessage)
          }
          
          // If we found a requestId, send HTTP response to server
          if (requestId) {
            messageRequestMap.current.delete(originalMessage)
            
            // Send response via HTTP POST instead of socket
            fetch('/response', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                requestId: requestId,
                originalMessage: originalMessage,
                response: response.content || response.message || response,
                model: 'r1-llm',
                deviceId: deviceId,
                timestamp: new Date().toISOString()
              })
            }).then(httpResponse => {
              if (httpResponse.ok) {
                addDebugLog(`Sent R1 SDK response via HTTP (requestId: ${requestId})`)
              } else {
                addDebugLog(`Failed to send HTTP response: ${httpResponse.status}`, 'error')
              }
            }).catch(error => {
              addDebugLog(`HTTP response send error: ${error.message}`, 'error')
            })
          } else {
            addDebugLog('No requestId found for R1 response', 'warn')
          }
        })
      } else {
        addDebugLog('R1 SDK messaging not available - this app must run on R1 device', 'error')
      }
    } catch (error) {
      addDebugLog(`R1 SDK initialization error: ${error.message}`, 'error')
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

      if (r1CreateRef.current && r1CreateRef.current.messaging) {
        try {
          // Store the requestId for this message
          messageRequestMap.current.set(data.message, data.requestId)
          
          // Use R1 SDK messaging API to send message to LLM
          r1CreateRef.current.messaging.sendMessage(data.message, { 
            useLLM: true
          })
          addDebugLog('Sent message to R1 LLM via messaging API')
        } catch (error) {
          addDebugLog(`R1 SDK messaging error: ${error.message}`, 'error')
          socketRef.current.emit('error', {
            requestId: data.requestId, // Include request ID in error
            error: `R1 SDK messaging error: ${error.message}`,
            deviceId
          })
          sendErrorToServer('error', `R1 SDK messaging failed: ${error.message}`)
        }
      } else {
        addDebugLog('R1 SDK messaging not available - cannot process message', 'error')
        socketRef.current.emit('error', {
          requestId: data.requestId, // Include request ID in error
          error: 'R1 SDK messaging not available - this app must run on R1 device',
          deviceId
        })
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