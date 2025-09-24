import { useState, useRef, useCallback } from 'react'

export function useConsole() {
  const [consoleLogs, setConsoleLogs] = useState([])
  const consoleRef = useRef(null)

  // Console logging function
  const addConsoleLog = useCallback((message, type = 'info') => {
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
  }, [])

  // Error logging to server
  const sendErrorToServer = useCallback((level, message, stack = null, deviceId = null) => {
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
  }, [])

  return {
    consoleLogs,
    consoleRef,
    addConsoleLog,
    sendErrorToServer
  }
}