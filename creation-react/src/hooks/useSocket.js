import { useState, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'

export function useSocket(addConsoleLog, sendErrorToServer) {
  const [isConnected, setIsConnected] = useState(false)
  const [deviceId, setDeviceId] = useState(null)
  const [deviceInfo, setDeviceInfo] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState('Initializing...')

  const socketRef = useRef(null)

  // Socket connection
  const connectSocket = useCallback(() => {
    addConsoleLog('Starting Socket.IO connection attempt')

    if (socketRef.current && socketRef.current.connected) {
      addConsoleLog('Socket.IO already connected')
      return
    }

    // Socket.IO configuration with automatic cookie sending
    socketRef.current = io('/', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      timeout: 5000,
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      withCredentials: true // This ensures cookies are sent automatically
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

      // Clear stored deviceId
      if (socketRef.current) {
        socketRef.current._deviceId = null
      }

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

    // Add heartbeat/ping mechanism - will be set up after device connection
    socketRef.current._heartbeatInterval = null

    // Test event listener to verify socket is working
    socketRef.current.on('test_event', (data) => {
      addConsoleLog(`🧪 Received test event: ${JSON.stringify(data)}`, 'info')
    })

    // Test event from server
    socketRef.current.on('test_from_server', (data) => {
      addConsoleLog(`🧪 Received test_from_server event: ${JSON.stringify(data)}`, 'info')
    })

    // Application events
    socketRef.current.on('connected', (data) => {
      setDeviceId(data.deviceId)
      // Store deviceId in socket ref for reliable access
      socketRef.current._deviceId = data.deviceId

      setDeviceInfo({
        pinCode: data.pinCode,
        pinEnabled: data.pinEnabled !== false && data.pinCode !== null
      })

      // Handle device secret cookie for persistence
      if (data.deviceSecret && !data.isReconnection) {
        // Set cookie for new devices (expires in 30 days)
        const expiryDate = new Date()
        expiryDate.setDate(expiryDate.getDate() + 30)
        document.cookie = `r1_device_secret=${encodeURIComponent(data.deviceSecret)}; expires=${expiryDate.toUTCString()}; path=/; SameSite=Strict`
        addConsoleLog(`🍪 Device secret cookie set for persistence`, 'info')
      }

      setConnectionStatus(`${data.isReconnection ? 'Reconnected' : 'Connected'} - Device: [HIDDEN]`)
      addConsoleLog(`${data.isReconnection ? 'Reconnected' : 'Connected'} with device`)
      addConsoleLog(`Received PIN from socket: ${data.pinCode ? '[HIDDEN]' : 'none'}`, 'info')

      if (data.isReconnection) {
        addConsoleLog(`✅ Successfully reconnected using device secret`, 'info')
      }

      // Set up heartbeat/ping mechanism with the actual device ID
      if (socketRef.current._heartbeatInterval) {
        clearInterval(socketRef.current._heartbeatInterval)
      }

      socketRef.current._heartbeatInterval = setInterval(() => {
        if (socketRef.current && socketRef.current.connected && socketRef.current._deviceId) {
          socketRef.current.emit('ping', {
            timestamp: Date.now(),
            deviceId: socketRef.current._deviceId
          })
          // Only log ping occasionally to avoid spam
          if (Math.random() < 0.1) { // 10% chance to log
            addConsoleLog(`🏓 Ping sent`, 'info')
          }
        }
      }, 30000) // Ping every 30 seconds

      // Automatically refresh device info to get the latest PIN from server
      setTimeout(() => {
        if (data.deviceId && window.refreshDeviceInfo) {
          window.refreshDeviceInfo(data.deviceId)
        }
      }, 1000)

      // Send a test ping immediately to ensure device is properly registered
      setTimeout(() => {
        if (socketRef.current && socketRef.current.connected && socketRef.current._deviceId) {
          socketRef.current.emit('ping', {
            timestamp: Date.now(),
            deviceId: socketRef.current._deviceId
          })
          addConsoleLog(`🏓 Initial ping sent`, 'info')

          // Test if we can receive custom events
          addConsoleLog(`🧪 Testing socket event reception...`, 'info')
          socketRef.current.emit('test_message', {
            deviceId: socketRef.current._deviceId,
            message: 'Testing socket bidirectional communication',
            timestamp: new Date().toISOString()
          })
        }
      }, 2000)

      // Check if PIN is required for chat completions
      if (!data.pinCode) {
        addConsoleLog(`⚠️ Device has no PIN set - this might be required for chat completions`, 'warn')
        addConsoleLog(`💡 Try enabling a PIN to see if chat completions work`, 'info')
      }

      // Device should now be properly registered for chat completions
    })

    // Handle incoming chat completion requests
    socketRef.current.on('chat_completion', (data) => {
      addConsoleLog(`🚨🚨🚨 CHAT COMPLETION EVENT RECEIVED! 🚨🚨🚨`, 'info')
      addConsoleLog(`📥 Received chat completion request: ${JSON.stringify(data, null, 2)}`)

      // Emit event for R1 SDK hook to handle
      if (window.handleChatCompletion) {
        window.handleChatCompletion(data, socketRef.current, addConsoleLog, sendErrorToServer)
      } else {
        addConsoleLog('❌ No chat completion handler available', 'error')
      }
    })

    // Handle incoming text-to-speech requests
    socketRef.current.on('text_to_speech', (data) => {
      const requestId = data.requestId || data.data?.requestId
      const eventKey = `tts-${requestId}`

      // Prevent duplicate processing of the same TTS request
      if (socketRef.current._processedTTSEvents && socketRef.current._processedTTSEvents.has(eventKey)) {
        addConsoleLog(`🚫 Skipping duplicate TTS event: ${requestId}`)
        return
      }

      // Initialize processed events tracker if needed
      if (!socketRef.current._processedTTSEvents) {
        socketRef.current._processedTTSEvents = new Set()
      }
      socketRef.current._processedTTSEvents.add(eventKey)

      // Clean up old events after 30 seconds
      setTimeout(() => {
        if (socketRef.current._processedTTSEvents) {
          socketRef.current._processedTTSEvents.delete(eventKey)
        }
      }, 30000)

      addConsoleLog(`🎵🎵🎵 TEXT-TO-SPEECH EVENT RECEIVED! 🎵🎵🎵`, 'info')
      addConsoleLog(`📥 Received TTS request: ${JSON.stringify(data, null, 2)}`)

      // Check if handler is available
      if (window.handleTextToSpeech) {
        addConsoleLog(`✅ TTS handler available, calling it...`, 'info')
        try {
          window.handleTextToSpeech(data, socketRef.current, addConsoleLog, sendErrorToServer)
          addConsoleLog(`✅ TTS handler called successfully`, 'info')
        } catch (error) {
          addConsoleLog(`❌ TTS handler threw error: ${error.message}`, 'error')
          addConsoleLog(`❌ TTS handler error stack: ${error.stack}`, 'error')
        }
      } else {
        addConsoleLog('❌ No text-to-speech handler available - this is the problem!', 'error')
        // Send error response immediately
        socketRef.current.emit('tts_error', {
          requestId: data.requestId || data.data?.requestId,
          error: 'TTS handler not available on device',
          deviceId: socketRef.current._deviceId
        })
      }
    })

    // Handle server errors/notifications
    socketRef.current.on('error', (data) => {
      addConsoleLog(`❌ Server error: ${JSON.stringify(data)}`, 'error')
    })

    socketRef.current.on('notification', (data) => {
      addConsoleLog(`📢 Server notification: ${JSON.stringify(data)}`, 'info')
    })

    // Device connection/disconnection events removed to prevent device ID leakage

    // Debug data broadcasts removed to prevent device ID leakage
  }, [addConsoleLog, sendErrorToServer])

  const handleReconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }
    setDeviceId(null)
    setDeviceInfo(null)
    connectSocket()
  }, [connectSocket])

  return {
    isConnected,
    deviceId,
    deviceInfo,
    connectionStatus,
    socketRef,
    connectSocket,
    handleReconnect,
    setDeviceInfo
  }
}