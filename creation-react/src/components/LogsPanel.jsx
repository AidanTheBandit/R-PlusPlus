import React, { useState, useEffect } from 'react'

const LogsPanel = ({ r1Sdk, socket, deviceId, isConnected }) => {
  const [logs, setLogs] = useState([])
  const [logFilter, setLogFilter] = useState('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const [serverLogs, setServerLogs] = useState([])
  const logsEndRef = React.useRef(null)

  const addLog = (level, message, source = 'client') => {
    const logEntry = {
      id: Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      source
    }
    setLogs(prev => [...prev.slice(-199), logEntry]) // Keep last 200 logs

    // Stream to server
    if (socket && socket.connected) {
      fetch('/debug/stream/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          data: logEntry,
          timestamp: new Date().toISOString()
        })
      }).catch(err => console.warn('Failed to stream log:', err))
    }
  }

  const clearLogs = () => {
    setLogs([])
    addLog('info', 'Client logs cleared', 'system')
  }

  const exportLogs = () => {
    const logText = logs.map(log =>
      `[${log.timestamp}] ${log.level.toUpperCase()} [${log.source}]: ${log.message}`
    ).join('\n')

    const blob = new Blob([logText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `r1-debug-logs-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    addLog('info', 'Logs exported to file', 'system')
  }

  const fetchServerLogs = () => {
    if (!socket || !socket.connected) return

    socket.emit('get_server_logs', { deviceId }, (response) => {
      if (response && response.logs) {
        setServerLogs(response.logs)
        addLog('info', `Fetched ${response.logs.length} server logs`, 'system')
      }
    })
  }

  const testLogging = () => {
    addLog('info', 'Test info message', 'test')
    addLog('warn', 'Test warning message', 'test')
    addLog('error', 'Test error message', 'test')
    addLog('debug', 'Test debug message', 'test')
  }

  const filteredLogs = logs.filter(log => logFilter === 'all' || log.level === logFilter)

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  useEffect(() => {
    // Set up socket listeners for server logs
    if (socket) {
      const handleServerLog = (logData) => {
        addLog(logData.level, logData.message, 'server')
      }

      socket.on('server_log', handleServerLog)

      return () => {
        socket.off('server_log', handleServerLog)
      }
    }
  }, [socket])

  useEffect(() => {
    // Override console methods to capture all logs
    const originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug
    }

    console.log = (...args) => {
      addLog('info', args.join(' '), 'console')
      originalConsole.log.apply(console, args)
    }

    console.info = (...args) => {
      addLog('info', args.join(' '), 'console')
      originalConsole.info.apply(console, args)
    }

    console.warn = (...args) => {
      addLog('warn', args.join(' '), 'console')
      originalConsole.warn.apply(console, args)
    }

    console.error = (...args) => {
      addLog('error', args.join(' '), 'console')
      originalConsole.error.apply(console, args)
    }

    console.debug = (...args) => {
      addLog('debug', args.join(' '), 'console')
      originalConsole.debug.apply(console, args)
    }

    // Add initial log
    addLog('info', 'Debug logging system initialized', 'system')

    return () => {
      // Restore original console methods
      Object.assign(console, originalConsole)
    }
  }, [])

  return (
    <div className="logs-panel">
      <h3>Logs & Debugging</h3>

      {/* Log Controls */}
      <div className="debug-section">
        <h4>Log Controls</h4>
        <div className="log-controls">
          <select
            value={logFilter}
            onChange={(e) => setLogFilter(e.target.value)}
          >
            <option value="all">All Levels</option>
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
          </select>

          <label className="auto-scroll">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            Auto-scroll
          </label>

          <button className="log-btn" onClick={clearLogs}>
            Clear Logs
          </button>

          <button className="log-btn" onClick={exportLogs}>
            Export Logs
          </button>

          <button
            className="log-btn"
            onClick={fetchServerLogs}
            disabled={!isConnected}
          >
            Fetch Server Logs
          </button>

          <button className="log-btn" onClick={testLogging}>
            Test Logging
          </button>
        </div>
      </div>

      {/* Log Statistics */}
      <div className="debug-section">
        <h4>Log Statistics</h4>
        <div className="log-stats">
          <div className="stat-item">
            <span className="stat-label">Total Logs:</span>
            <span className="stat-value">{logs.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Filtered:</span>
            <span className="stat-value">{filteredLogs.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Errors:</span>
            <span className="stat-value error">{logs.filter(l => l.level === 'error').length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Warnings:</span>
            <span className="stat-value warning">{logs.filter(l => l.level === 'warn').length}</span>
          </div>
        </div>
      </div>

      {/* Log Display */}
      <div className="debug-section">
        <h4>Log Output</h4>
        <div className="logs-container">
          <div className="logs-display">
            {filteredLogs.map(log => (
              <div key={log.id} className={`log-entry log-${log.level} log-source-${log.source}`}>
                <span className="log-timestamp">[{log.timestamp}]</span>
                <span className="log-level">[{log.level.toUpperCase()}]</span>
                <span className="log-source">[{log.source}]</span>
                <span className="log-message">{log.message}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>

      {/* Server Logs */}
      {serverLogs.length > 0 && (
        <div className="debug-section">
          <h4>Server Logs ({serverLogs.length})</h4>
          <div className="logs-container">
            <div className="logs-display">
              {serverLogs.map((log, index) => (
                <div key={index} className={`log-entry log-${log.level} log-source-server`}>
                  <span className="log-timestamp">[{log.timestamp}]</span>
                  <span className="log-level">[{log.level.toUpperCase()}]</span>
                  <span className="log-source">[server]</span>
                  <span className="log-message">{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LogsPanel