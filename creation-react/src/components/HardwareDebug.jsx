import React, { useState, useEffect } from 'react'

const HardwareDebug = ({ r1Sdk, socket, deviceId, isConnected }) => {
  const [accelerometerData, setAccelerometerData] = useState({ x: 0, y: 0, z: 0 })
  const [accelerometerActive, setAccelerometerActive] = useState(false)
  const [hardwareEvents, setHardwareEvents] = useState([])
  const [buttonStates, setButtonStates] = useState({
    sideClick: false,
    scrollUp: false,
    scrollDown: false
  })

  const addHardwareEvent = (type, description) => {
    const event = {
      id: Date.now(),
      type,
      description,
      timestamp: new Date().toLocaleTimeString()
    }
    setHardwareEvents(prev => [event, ...prev.slice(0, 9)])

    // Stream to server
    if (socket && socket.connected) {
      fetch('/debug/stream/hardware', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          data: event,
          timestamp: new Date().toISOString()
        })
      }).catch(err => console.warn('Failed to stream hardware event:', err))
    }
  }

  useEffect(() => {
    if (!r1Sdk?.hardware) return

    // Set up hardware event listeners
    const handleSideClick = () => {
      addHardwareEvent('sideClick', 'Side button pressed')
      setButtonStates(prev => ({ ...prev, sideClick: true }))
      setTimeout(() => setButtonStates(prev => ({ ...prev, sideClick: false })), 200)
    }

    const handleScrollUp = () => {
      addHardwareEvent('scrollUp', 'Scroll wheel up')
      setButtonStates(prev => ({ ...prev, scrollUp: true }))
      setTimeout(() => setButtonStates(prev => ({ ...prev, scrollUp: false })), 200)
    }

    const handleScrollDown = () => {
      addHardwareEvent('scrollDown', 'Scroll wheel down')
      setButtonStates(prev => ({ ...prev, scrollDown: true }))
      setTimeout(() => setButtonStates(prev => ({ ...prev, scrollDown: false })), 200)
    }

    r1Sdk.hardware.on('sideClick', handleSideClick)
    r1Sdk.hardware.on('scrollUp', handleScrollUp)
    r1Sdk.hardware.on('scrollDown', handleScrollDown)

    return () => {
      // Cleanup listeners
      if (r1Sdk.hardware) {
        r1Sdk.hardware.off('sideClick', handleSideClick)
        r1Sdk.hardware.off('scrollUp', handleScrollUp)
        r1Sdk.hardware.off('scrollDown', handleScrollDown)
      }
    }
  }, [r1Sdk])

  const startAccelerometer = async () => {
    if (!r1Sdk?.accelerometer) {
      addHardwareEvent('error', 'Accelerometer API not available')
      return
    }

    try {
      await r1Sdk.accelerometer.start((data) => {
        setAccelerometerData(data)
      })
      setAccelerometerActive(true)
      addHardwareEvent('accelerometer', 'Accelerometer started')
    } catch (error) {
      addHardwareEvent('error', `Accelerometer start failed: ${error.message}`)
    }
  }

  const stopAccelerometer = async () => {
    if (!r1Sdk?.accelerometer) return

    try {
      await r1Sdk.accelerometer.stop()
      setAccelerometerActive(false)
      addHardwareEvent('accelerometer', 'Accelerometer stopped')
    } catch (error) {
      addHardwareEvent('error', `Accelerometer stop failed: ${error.message}`)
    }
  }

  const simulateTouch = (x, y) => {
    if (!r1Sdk?.touch) {
      addHardwareEvent('error', 'Touch API not available')
      return
    }

    try {
      r1Sdk.touch.tap(x, y)
      addHardwareEvent('touch', `Touch simulated at (${x}, ${y})`)
    } catch (error) {
      addHardwareEvent('error', `Touch simulation failed: ${error.message}`)
    }
  }

  return (
    <div className="hardware-debug">
      <h3>Hardware Debug</h3>

      {/* Accelerometer Section */}
      <div className="debug-section">
        <h4>Accelerometer</h4>
        <div className="accelerometer-controls">
          <button
            className={`hw-btn ${accelerometerActive ? 'active' : ''}`}
            onClick={accelerometerActive ? stopAccelerometer : startAccelerometer}
            disabled={!isConnected}
          >
            {accelerometerActive ? 'Stop' : 'Start'} Accelerometer
          </button>
        </div>
        <div className="accelerometer-display">
          <div className="accel-value">X: {(accelerometerData?.x ?? 0).toFixed(2)}</div>
          <div className="accel-value">Y: {(accelerometerData?.y ?? 0).toFixed(2)}</div>
          <div className="accel-value">Z: {(accelerometerData?.z ?? 0).toFixed(2)}</div>
        </div>
      </div>

      {/* Hardware Buttons */}
      <div className="debug-section">
        <h4>Hardware Buttons</h4>
        <div className="button-indicators">
          <div className={`button-indicator ${buttonStates.sideClick ? 'pressed' : ''}`}>
            Side Button: {buttonStates.sideClick ? 'PRESSED' : 'Released'}
          </div>
          <div className={`button-indicator ${buttonStates.scrollUp ? 'pressed' : ''}`}>
            Scroll Up: {buttonStates.scrollUp ? 'PRESSED' : 'Released'}
          </div>
          <div className={`button-indicator ${buttonStates.scrollDown ? 'pressed' : ''}`}>
            Scroll Down: {buttonStates.scrollDown ? 'PRESSED' : 'Released'}
          </div>
        </div>
      </div>

      {/* Touch Simulation */}
      <div className="debug-section">
        <h4>Touch Simulation</h4>
        <div className="touch-buttons">
          <button
            className="hw-btn"
            onClick={() => simulateTouch(120, 141)}
            disabled={!isConnected}
          >
            Center Tap
          </button>
          <button
            className="hw-btn"
            onClick={() => simulateTouch(60, 70)}
            disabled={!isConnected}
          >
            Top-Left
          </button>
          <button
            className="hw-btn"
            onClick={() => simulateTouch(180, 212)}
            disabled={!isConnected}
          >
            Bottom-Right
          </button>
        </div>
      </div>

      {/* Event Log */}
      <div className="debug-section">
        <h4>Hardware Events</h4>
        <div className="event-log">
          {hardwareEvents.map(event => (
            <div key={event.id} className={`event-entry event-${event.type}`}>
              [{event.timestamp}] {event.description}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default HardwareDebug