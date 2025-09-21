import React, { useState, useEffect, useRef } from 'react'

const PerformanceDebug = ({ r1Sdk, socket, deviceId, isConnected }) => {
  const [performanceMetrics, setPerformanceMetrics] = useState({
    fps: 0,
    memory: { used: 0, total: 0 },
    battery: { level: 0, charging: false },
    network: { type: 'unknown', speed: 'unknown' }
  })
  const [performanceEvents, setPerformanceEvents] = useState([])
  const [isMonitoring, setIsMonitoring] = useState(false)
  const fpsIntervalRef = useRef(null)
  const frameCountRef = useRef(0)
  const lastTimeRef = useRef(performance.now())

  const addPerformanceEvent = (type, description) => {
    const event = {
      id: Date.now(),
      type,
      description,
      timestamp: new Date().toLocaleTimeString()
    }
    setPerformanceEvents(prev => [event, ...prev.slice(0, 9)])

    // Stream to server
    if (socket && socket.connected) {
      fetch('/debug/stream/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          data: event,
          timestamp: new Date().toISOString()
        })
      }).catch(err => console.warn('Failed to stream performance event:', err))
    }
  }

  const startFPSMonitoring = () => {
    if (isMonitoring) return

    setIsMonitoring(true)
    frameCountRef.current = 0
    lastTimeRef.current = performance.now()

    const measureFPS = () => {
      frameCountRef.current++
      const currentTime = performance.now()

      if (currentTime - lastTimeRef.current >= 1000) {
        const fps = Math.round((frameCountRef.current * 1000) / (currentTime - lastTimeRef.current))
        setPerformanceMetrics(prev => ({ ...prev, fps }))
        frameCountRef.current = 0
        lastTimeRef.current = currentTime
      }

      fpsIntervalRef.current = requestAnimationFrame(measureFPS)
    }

    measureFPS()
    addPerformanceEvent('info', 'FPS monitoring started')
  }

  const stopFPSMonitoring = () => {
    if (fpsIntervalRef.current) {
      cancelAnimationFrame(fpsIntervalRef.current)
      fpsIntervalRef.current = null
    }
    setIsMonitoring(false)
    setPerformanceMetrics(prev => ({ ...prev, fps: 0 }))
    addPerformanceEvent('info', 'FPS monitoring stopped')
  }

  const measureMemoryUsage = () => {
    if ('memory' in performance) {
      const memory = performance.memory
      const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024)
      const totalMB = Math.round(memory.totalJSHeapSize / 1024 / 1024)

      setPerformanceMetrics(prev => ({
        ...prev,
        memory: { used: usedMB, total: totalMB }
      }))

      addPerformanceEvent('info', `Memory: ${usedMB}MB used of ${totalMB}MB total`)
    } else {
      addPerformanceEvent('warning', 'Memory API not available')
    }
  }

  const measureBatteryLevel = async () => {
    try {
      if ('getBattery' in navigator) {
        const battery = await navigator.getBattery()
        const level = Math.round(battery.level * 100)

        setPerformanceMetrics(prev => ({
          ...prev,
          battery: { level, charging: battery.charging }
        }))

        addPerformanceEvent('info', `Battery: ${level}% ${battery.charging ? '(charging)' : '(discharging)'}`)

        // Listen for battery changes
        const updateBattery = () => {
          const newLevel = Math.round(battery.level * 100)
          setPerformanceMetrics(prev => ({
            ...prev,
            battery: { level: newLevel, charging: battery.charging }
          }))
        }

        battery.addEventListener('levelchange', updateBattery)
        battery.addEventListener('chargingchange', updateBattery)

        return () => {
          battery.removeEventListener('levelchange', updateBattery)
          battery.removeEventListener('chargingchange', updateBattery)
        }
      } else {
        addPerformanceEvent('warning', 'Battery API not available')
      }
    } catch (error) {
      addPerformanceEvent('error', `Battery measurement failed: ${error.message}`)
    }
  }

  const measureNetworkInfo = () => {
    if ('connection' in navigator) {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
      if (connection) {
        setPerformanceMetrics(prev => ({
          ...prev,
          network: {
            type: connection.effectiveType || 'unknown',
            speed: connection.downlink ? `${connection.downlink} Mbps` : 'unknown'
          }
        }))

        addPerformanceEvent('info', `Network: ${connection.effectiveType || 'unknown'} at ${connection.downlink || 'unknown'} Mbps`)
      } else {
        addPerformanceEvent('warning', 'Network connection API not available')
      }
    } else {
      addPerformanceEvent('warning', 'Network information API not available')
    }
  }

  const runPerformanceTest = () => {
    addPerformanceEvent('info', 'Running performance test suite')

    // Memory test
    measureMemoryUsage()

    // Network test
    measureNetworkInfo()

    // Battery test
    measureBatteryLevel()

    // Simple computation test
    const startTime = performance.now()
    let result = 0
    for (let i = 0; i < 1000000; i++) {
      result += Math.sin(i) * Math.cos(i)
    }
    const endTime = performance.now()

    addPerformanceEvent('info', `Computation test: ${Math.round(endTime - startTime)}ms for 1M operations`)
  }

  const collectSystemInfo = () => {
    const systemInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
      deviceMemory: navigator.deviceMemory || 'unknown',
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth,
        pixelRatio: window.devicePixelRatio
      }
    }

    addPerformanceEvent('info', `System info collected: ${JSON.stringify(systemInfo)}`)

    // Send to server
    if (socket && socket.connected) {
      socket.emit('system_info', {
        deviceId,
        systemInfo,
        timestamp: new Date().toISOString()
      })
    }
  }

  useEffect(() => {
    // Auto-collect system info on mount
    if (isConnected) {
      collectSystemInfo()
      measureBatteryLevel()
    }

    return () => {
      stopFPSMonitoring()
    }
  }, [isConnected])

  return (
    <div className="performance-debug">
      <h3>Performance Debug</h3>

      {/* Performance Controls */}
      <div className="debug-section">
        <h4>Performance Monitoring</h4>
        <div className="performance-controls">
          <button
            className={`perf-btn ${isMonitoring ? 'active' : ''}`}
            onClick={isMonitoring ? stopFPSMonitoring : startFPSMonitoring}
          >
            {isMonitoring ? 'Stop FPS' : 'Start FPS'}
          </button>
          <button
            className="perf-btn"
            onClick={measureMemoryUsage}
          >
            Check Memory
          </button>
          <button
            className="perf-btn"
            onClick={measureNetworkInfo}
          >
            Check Network
          </button>
          <button
            className="perf-btn"
            onClick={runPerformanceTest}
          >
            Run Tests
          </button>
          <button
            className="perf-btn"
            onClick={collectSystemInfo}
          >
            System Info
          </button>
        </div>
      </div>

      {/* Real-time Metrics */}
      <div className="debug-section">
        <h4>Real-time Metrics</h4>
        <div className="metrics-display">
          <div className="metric-item">
            <span className="metric-label">FPS:</span>
            <span className="metric-value">{performanceMetrics.fps}</span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Memory:</span>
            <span className="metric-value">{performanceMetrics.memory.used}MB / {performanceMetrics.memory.total}MB</span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Battery:</span>
            <span className="metric-value">
              {performanceMetrics.battery.level}% {performanceMetrics.battery.charging ? '⚡' : ''}
            </span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Network:</span>
            <span className="metric-value">{performanceMetrics.network.type} ({performanceMetrics.network.speed})</span>
          </div>
        </div>
      </div>

      {/* Performance Visualization */}
      <div className="debug-section">
        <h4>Performance Indicators</h4>
        <div className="performance-indicators">
          <div className="indicator">
            <div className="indicator-label">FPS Health</div>
            <div className={`indicator-bar ${performanceMetrics.fps > 50 ? 'good' : performanceMetrics.fps > 30 ? 'warning' : 'bad'}`}>
              <div
                className="indicator-fill"
                style={{ width: `${Math.min(performanceMetrics.fps * 2, 100)}%` }}
              />
            </div>
            <div className="indicator-value">{performanceMetrics.fps} fps</div>
          </div>

          <div className="indicator">
            <div className="indicator-label">Memory Usage</div>
            <div className={`indicator-bar ${performanceMetrics.memory.used / performanceMetrics.memory.total < 0.8 ? 'good' : 'warning'}`}>
              <div
                className="indicator-fill"
                style={{
                  width: performanceMetrics.memory.total > 0
                    ? `${(performanceMetrics.memory.used / performanceMetrics.memory.total) * 100}%`
                    : '0%'
                }}
              />
            </div>
            <div className="indicator-value">{performanceMetrics.memory.used}MB</div>
          </div>

          <div className="indicator">
            <div className="indicator-label">Battery Level</div>
            <div className={`indicator-bar ${performanceMetrics.battery.level > 20 ? 'good' : 'warning'}`}>
              <div
                className="indicator-fill"
                style={{ width: `${performanceMetrics.battery.level}%` }}
              />
            </div>
            <div className="indicator-value">{performanceMetrics.battery.level}%</div>
          </div>
        </div>
      </div>

      {/* Event Log */}
      <div className="debug-section">
        <h4>Performance Events</h4>
        <div className="event-log">
          {performanceEvents.map(event => (
            <div key={event.id} className={`event-entry event-${event.type}`}>
              [{event.timestamp}] {event.description}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default PerformanceDebug