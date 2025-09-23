import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { r1 } from 'r1-create'
import DebugTool from './components/DebugTool'
import './App.css'
import './components/DebugComponents.css'

function App() {
  const [isConnected, setIsConnected] = useState(false)
  const [deviceId, setDeviceId] = useState(null)
  const [statusMessage, setStatusMessage] = useState('Initializing...')
  const [debugLogs, setDebugLogs] = useState([])
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraFacing, setCameraFacing] = useState('user') // 'user' or 'environment'
  const [cameraStream, setCameraStream] = useState(null)
  const socketRef = useRef(null)
  const r1CreateRef = useRef(null)
  const videoRef = useRef(null)

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
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5
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

      // Clear any pending request data on disconnect
      socketRef.current._pendingRequestId = null
      socketRef.current._originalMessage = null

      // Clear heartbeat interval
      if (socketRef.current._heartbeatInterval) {
        clearInterval(socketRef.current._heartbeatInterval)
        socketRef.current._heartbeatInterval = null
      }
    })

    socketRef.current.on('connect_error', (error) => {
      addDebugLog(`Socket.IO connection error: ${error.message}`, 'error')
      setIsConnected(false)
      setStatusMessage(`Connection error: ${error.message}`)
      sendErrorToServer('error', `Socket connection failed: ${error.message}`)
    })

    socketRef.current.on('reconnect', (attemptNumber) => {
      addDebugLog(`Socket.IO reconnected after ${attemptNumber} attempts`)
      setIsConnected(true)
      setStatusMessage('Reconnected')
    })

    socketRef.current.on('reconnect_error', (error) => {
      addDebugLog(`Socket.IO reconnection failed: ${error.message}`, 'error')
      sendErrorToServer('error', `Socket reconnection failed: ${error.message}`)
    })

    // Handle pong responses from server
    socketRef.current.on('pong', (data) => {
      const latency = Date.now() - data.timestamp
      addDebugLog(`🏓 Pong received, latency: ${latency}ms`)
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
      setStatusMessage(`Connected - ID: ${data.deviceId}`)
      addDebugLog(`Connected with device ID: ${data.deviceId}`)
    })

    // Camera control events
    socketRef.current.on('magic_cam_start', (data) => {
      addDebugLog(`Magic cam start command received: ${JSON.stringify(data)}`)
      console.log('Magic cam start event received:', data)
      startCamera()
    })

    socketRef.current.on('magic_cam_stop', (data) => {
      addDebugLog('Magic cam stop command received')
      console.log('Magic cam stop event received:', data)
      stopCamera()
    })

    socketRef.current.on('magic_cam_capture', (data) => {
      addDebugLog(`Magic cam capture command received: ${JSON.stringify(data)}`)
      console.log('Magic cam capture event received:', data)
      capturePhoto()
    })

    socketRef.current.on('magic_cam_switch', (data) => {
      addDebugLog('Magic cam switch command received')
      console.log('Magic cam switch event received:', data)
      switchCamera()
    })

    socketRef.current.on('chat_completion', (data) => {
      addDebugLog(`Received chat completion: ${JSON.stringify(data).substring(0, 100)}...`)

      if (r1CreateRef.current && r1CreateRef.current.messaging) {
        try {
          // Store requestId for response
          const currentRequestId = data.requestId || data.data?.requestId
          const messageToSend = data.message || data.data?.message

          // Use R1 SDK messaging API to send message to LLM
          r1CreateRef.current.messaging.sendMessage(messageToSend, {
            useLLM: true,
            requestId: currentRequestId // Pass requestId to messaging if supported
          })

          // Store the requestId for when we get the response
          if (currentRequestId) {
            socketRef.current._pendingRequestId = currentRequestId
            socketRef.current._originalMessage = data.originalMessage || data.data?.originalMessage
          }

          addDebugLog(`Sent message to R1 LLM via messaging API, requestId: ${currentRequestId}`)
        } catch (error) {
          addDebugLog(`R1 SDK messaging error: ${error.message}`, 'error')
          socketRef.current.emit('error', {
            requestId: data.requestId || data.data?.requestId,
            error: `R1 SDK messaging error: ${error.message}`,
            deviceId
          })
          sendErrorToServer('error', `R1 SDK messaging failed: ${error.message}`)
        }
      } else {
        addDebugLog('R1 SDK messaging not available - cannot process message', 'error')
        socketRef.current.emit('error', {
          requestId: data.requestId || data.data?.requestId,
          error: 'R1 SDK messaging not available - this app must run on R1 device',
          deviceId
        })
      }
    })
  }

  // Initialize R1 SDK
  useEffect(() => {
    try {
      // Check if R1 SDK is available
      if (r1 && r1.messaging) {
        r1CreateRef.current = r1
        addDebugLog('R1 SDK available')
        
        // Check what APIs are available
        const availableAPIs = []
        if (r1.messaging) availableAPIs.push('messaging')
        if (r1.llm) availableAPIs.push('llm')
        if (r1.camera) availableAPIs.push('camera')
        if (r1.hardware) availableAPIs.push('hardware')
        if (r1.storage) availableAPIs.push('storage')
        if (r1.microphone) availableAPIs.push('microphone')
        if (r1.speaker) availableAPIs.push('speaker')
        
        addDebugLog(`Available R1 APIs: ${availableAPIs.join(', ')}`)
        
        // Set up message handler for LLM responses
        r1.messaging.onMessage((response) => {
          addDebugLog(`R1 SDK message received: ${JSON.stringify(response).substring(0, 100)}...`)

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
            addDebugLog(`Sent R1 SDK response via socket: "${responseText.substring(0, 50)}..." (requestId: ${socketRef.current._pendingRequestId})`)

            // Clear the pending request data
            socketRef.current._pendingRequestId = null
            socketRef.current._originalMessage = null
          } else {
            addDebugLog('Socket not connected, cannot send response', 'error')
          }
        })
      } else {
        addDebugLog('R1 SDK messaging not available - this app must run on R1 device', 'error')
        console.error('r1 object:', r1)
      }
    } catch (error) {
      addDebugLog(`R1 SDK initialization error: ${error.message}`, 'error')
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
    connectSocket()
  }

  // Camera control functions
  const startCamera = async () => {
    addDebugLog('Attempting to start camera...')
    console.log('r1CreateRef.current:', r1CreateRef.current)
    console.log('r1 object:', r1)
    
    if (r1CreateRef.current && r1CreateRef.current.camera) {
      try {
        addDebugLog(`R1 camera API found, starting with facing mode: ${cameraFacing}`)
        console.log('Calling r1.camera.start with:', { facingMode: cameraFacing })
        const stream = await r1CreateRef.current.camera.start({ facingMode: cameraFacing })
        setCameraActive(true)
        addDebugLog(`Camera started successfully with ${cameraFacing} facing mode`)
        console.log('Camera start result:', stream)
      } catch (error) {
        addDebugLog(`Camera start error: ${error.message}`, 'error')
        console.error('Camera start error details:', error)
      }
    } else {
      addDebugLog('R1 camera API not available - this app must run on R1 device', 'error')
      console.error('r1CreateRef.current:', r1CreateRef.current)
      console.error('r1 object:', r1)
      if (r1CreateRef.current) {
        console.error('Available properties on r1CreateRef.current:', Object.keys(r1CreateRef.current))
      }
    }
  }

  const stopCamera = async () => {
    addDebugLog('Attempting to stop camera...')
    if (r1CreateRef.current && r1CreateRef.current.camera) {
      try {
        await r1CreateRef.current.camera.stop()
        setCameraActive(false)
        addDebugLog('Camera stopped successfully')
      } catch (error) {
        addDebugLog(`Camera stop error: ${error.message}`, 'error')
        console.error('Camera stop error details:', error)
      }
    } else {
      addDebugLog('R1 camera API not available for stop', 'error')
    }
  }

  const capturePhoto = async () => {
    addDebugLog('Attempting to capture photo...')
    if (r1CreateRef.current && r1CreateRef.current.camera) {
      try {
        const photo = await r1CreateRef.current.camera.capturePhoto(240, 282)
        addDebugLog(`Photo captured: ${photo ? 'success' : 'failed'}`)
        console.log('Photo capture result:', photo)
        if (photo && socketRef.current && socketRef.current.connected) {
          socketRef.current.emit('photo_captured', {
            photo: photo,
            deviceId
          })
          addDebugLog('Photo sent via socket')
        }
      } catch (error) {
        addDebugLog(`Photo capture error: ${error.message}`, 'error')
        console.error('Photo capture error details:', error)
      }
    } else {
      addDebugLog('R1 camera API not available for capture', 'error')
    }
  }

  const switchCamera = () => {
    addDebugLog('Attempting to switch camera...')
    const newFacing = cameraFacing === 'user' ? 'environment' : 'user'
    setCameraFacing(newFacing)
    if (cameraActive) {
      addDebugLog(`Switching camera while active, stopping first...`)
      stopCamera().then(() => {
        addDebugLog(`Restarting camera with new facing mode: ${newFacing}`)
        startCamera()
      }).catch(error => {
        addDebugLog(`Error during camera switch: ${error.message}`, 'error')
      })
    } else {
      addDebugLog(`Camera facing mode switched to ${newFacing} (camera not active)`)
    }
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
      <div className="container">
        <h2>R1 Debug Tool</h2>

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

        <DebugTool
          r1Sdk={r1CreateRef.current}
          socket={socketRef.current}
          deviceId={deviceId}
          isConnected={isConnected}
        />
      </div>
    </div>
  )
}

export default App