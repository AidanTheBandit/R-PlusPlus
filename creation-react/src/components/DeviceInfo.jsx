import React, { useState, useEffect } from 'react'

const DeviceInfo = ({ r1Sdk, socket, deviceId, isConnected }) => {
  const [deviceInfo, setDeviceInfo] = useState({
    sdk: {
      available: false,
      version: 'unknown',
      apis: []
    },
    hardware: {
      accelerometer: false,
      touch: false,
      hardware: false,
      storage: false,
      llm: false,
      camera: false,
      microphone: false,
      speaker: false
    },
    screen: {
      width: 240,
      height: 282,
      pixelRatio: 1,
      colorDepth: 24
    },
    browser: {
      userAgent: '',
      platform: '',
      language: '',
      cookieEnabled: false,
      onLine: false
    },
    capabilities: {
      webgl: false,
      webAudio: false,
      serviceWorker: false,
      localStorage: false,
      sessionStorage: false,
      indexedDB: false
    }
  })
  const [deviceEvents, setDeviceEvents] = useState([])

  const addDeviceEvent = (type, description) => {
    const event = {
      id: Date.now(),
      type,
      description,
      timestamp: new Date().toLocaleTimeString()
    }
    setDeviceEvents(prev => [event, ...prev.slice(0, 9)])

    // Stream to server
    if (socket && socket.connected) {
      fetch('/debug/stream/device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          data: event,
          timestamp: new Date().toISOString()
        })
      }).catch(err => console.warn('Failed to stream device event:', err))
    }
  }

  const detectCapabilities = () => {
    const capabilities = {
      webgl: (() => {
        try {
          const canvas = document.createElement('canvas')
          return !!(window.WebGLRenderingContext && canvas.getContext('webgl'))
        } catch (e) {
          return false
        }
      })(),
      webAudio: !!window.AudioContext || !!window.webkitAudioContext,
      serviceWorker: 'serviceWorker' in navigator,
      localStorage: (() => {
        try {
          localStorage.setItem('test', 'test')
          localStorage.removeItem('test')
          return true
        } catch (e) {
          return false
        }
      })(),
      sessionStorage: (() => {
        try {
          sessionStorage.setItem('test', 'test')
          sessionStorage.removeItem('test')
          return true
        } catch (e) {
          return false
        }
      })(),
      indexedDB: !!window.indexedDB
    }

    setDeviceInfo(prev => ({ ...prev, capabilities }))
    addDeviceEvent('info', `Capabilities detected: ${JSON.stringify(capabilities)}`)
  }

  const collectDeviceInfo = () => {
    const info = {
      sdk: {
        available: !!r1Sdk,
        version: r1Sdk?.version || 'unknown',
        apis: r1Sdk ? Object.keys(r1Sdk).filter(key => typeof r1Sdk[key] === 'object' && r1Sdk[key] !== null) : []
      },
      hardware: {
        accelerometer: !!r1Sdk?.accelerometer,
        touch: !!r1Sdk?.touch,
        hardware: !!r1Sdk?.hardware,
        storage: !!r1Sdk?.storage,
        llm: !!r1Sdk?.llm,
        camera: !!r1Sdk?.camera,
        microphone: !!r1Sdk?.microphone,
        speaker: !!r1Sdk?.speaker
      },
      screen: {
        width: screen.width,
        height: screen.height,
        pixelRatio: window.devicePixelRatio || 1,
        colorDepth: screen.colorDepth
      },
      browser: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine
      }
    }

    setDeviceInfo(info)
    addDeviceEvent('info', 'Device information collected')

    // Send to server
    if (socket && socket.connected) {
      socket.emit('device_info', {
        deviceId,
        deviceInfo: info,
        timestamp: new Date().toISOString()
      })
    }
  }

  const testAPIConnectivity = async () => {
    if (!r1Sdk) {
      addDeviceEvent('error', 'R1 SDK not available')
      return
    }

    const tests = []

    // Test each API
    if (r1Sdk.hardware) {
      try {
        // Just check if methods exist
        const hasMethods = ['on', 'off'].every(method => typeof r1Sdk.hardware[method] === 'function')
        tests.push({ api: 'hardware', available: hasMethods })
      } catch (error) {
        tests.push({ api: 'hardware', available: false, error: error.message })
      }
    }

    if (r1Sdk.storage) {
      try {
        const hasPlain = r1Sdk.storage.plain && typeof r1Sdk.storage.plain.setItem === 'function'
        const hasSecure = r1Sdk.storage.secure && typeof r1Sdk.storage.secure.setItem === 'function'
        tests.push({ api: 'storage', available: hasPlain || hasSecure, details: { plain: hasPlain, secure: hasSecure } })
      } catch (error) {
        tests.push({ api: 'storage', available: false, error: error.message })
      }
    }

    if (r1Sdk.llm) {
      try {
        const hasSpeak = typeof r1Sdk.llm.askLLMSpeak === 'function'
        const hasJSON = typeof r1Sdk.llm.askLLMJSON === 'function'
        tests.push({ api: 'llm', available: hasSpeak || hasJSON, details: { speak: hasSpeak, json: hasJSON } })
      } catch (error) {
        tests.push({ api: 'llm', available: false, error: error.message })
      }
    }

    if (r1Sdk.camera) {
      try {
        const hasStart = typeof r1Sdk.camera.start === 'function'
        const hasCapture = typeof r1Sdk.camera.capturePhoto === 'function'
        tests.push({ api: 'camera', available: hasStart && hasCapture })
      } catch (error) {
        tests.push({ api: 'camera', available: false, error: error.message })
      }
    }

    if (r1Sdk.microphone) {
      try {
        const hasStart = typeof r1Sdk.microphone.startRecording === 'function'
        const hasStop = typeof r1Sdk.microphone.stopRecording === 'function'
        tests.push({ api: 'microphone', available: hasStart && hasStop })
      } catch (error) {
        tests.push({ api: 'microphone', available: false, error: error.message })
      }
    }

    if (r1Sdk.speaker) {
      try {
        const hasPlay = typeof r1Sdk.speaker.play === 'function'
        const hasTone = typeof r1Sdk.speaker.playTone === 'function'
        tests.push({ api: 'speaker', available: hasPlay || hasTone, details: { play: hasPlay, tone: hasTone } })
      } catch (error) {
        tests.push({ api: 'speaker', available: false, error: error.message })
      }
    }

    addDeviceEvent('info', `API connectivity tests: ${JSON.stringify(tests)}`)
  }

  const getR1Specifications = () => {
    const specs = {
      display: '240x282px portrait',
      hardware: ['Accelerometer', 'PTT button', 'Scroll wheel'],
      storage: 'Secure (Android M+) and plain storage',
      audio: 'Microphone, speaker',
      camera: 'Front/back cameras',
      ai: 'Full LLM integration',
      platform: 'Rabbit R1 / RabbitOS'
    }

    addDeviceEvent('info', `R1 Specifications: ${JSON.stringify(specs)}`)
    return specs
  }

  useEffect(() => {
    if (isConnected) {
      collectDeviceInfo()
      detectCapabilities()
    }
  }, [isConnected, r1Sdk])

  return (
    <div className="device-info">
      <h3>Device Information</h3>

      {/* Device Controls */}
      <div className="debug-section">
        <h4>Device Diagnostics</h4>
        <div className="device-controls">
          <button
            className="device-btn"
            onClick={collectDeviceInfo}
            disabled={!isConnected}
          >
            Collect Info
          </button>
          <button
            className="device-btn"
            onClick={detectCapabilities}
          >
            Detect Capabilities
          </button>
          <button
            className="device-btn"
            onClick={testAPIConnectivity}
            disabled={!isConnected}
          >
            Test APIs
          </button>
          <button
            className="device-btn"
            onClick={getR1Specifications}
          >
            R1 Specs
          </button>
        </div>
      </div>

      {/* SDK Information */}
      <div className="debug-section">
        <h4>R1 SDK Status</h4>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Available:</span>
            <span className={`info-value ${deviceInfo.sdk.available ? 'yes' : 'no'}`}>
              {deviceInfo.sdk.available ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Version:</span>
            <span className="info-value">{deviceInfo.sdk.version}</span>
          </div>
          <div className="info-item full-width">
            <span className="info-label">Available APIs:</span>
            <div className="api-list">
              {deviceInfo.sdk.apis.map(api => (
                <span key={api} className="api-tag">{api}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Hardware APIs */}
      <div className="debug-section">
        <h4>Hardware APIs</h4>
        <div className="hardware-grid">
          {Object.entries(deviceInfo.hardware).map(([api, available]) => (
            <div key={api} className="hardware-item">
              <span className="hardware-name">{api}</span>
              <span className={`hardware-status ${available ? 'available' : 'unavailable'}`}>
                {available ? '✓' : '✗'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Screen & Browser */}
      <div className="debug-section">
        <h4>Screen & Browser</h4>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Screen:</span>
            <span className="info-value">
              {deviceInfo.screen.width}×{deviceInfo.screen.height} ({deviceInfo.screen.pixelRatio}x)
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Platform:</span>
            <span className="info-value">{deviceInfo.browser.platform}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Language:</span>
            <span className="info-value">{deviceInfo.browser.language}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Online:</span>
            <span className={`info-value ${deviceInfo.browser.onLine ? 'yes' : 'no'}`}>
              {deviceInfo.browser.onLine ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      </div>

      {/* Browser Capabilities */}
      <div className="debug-section">
        <h4>Browser Capabilities</h4>
        <div className="capabilities-grid">
          {Object.entries(deviceInfo.capabilities).map(([capability, supported]) => (
            <div key={capability} className="capability-item">
              <span className="capability-name">{capability}</span>
              <span className={`capability-status ${supported ? 'supported' : 'unsupported'}`}>
                {supported ? '✓' : '✗'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Event Log */}
      <div className="debug-section">
        <h4>Device Events</h4>
        <div className="event-log">
          {deviceEvents.map(event => (
            <div key={event.id} className={`event-entry event-${event.type}`}>
              [{event.timestamp}] {event.description}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default DeviceInfo