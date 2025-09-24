import { useEffect } from 'react'
import './App.css'
import StatusBar from './components/StatusBar'
import ConsolePanel from './components/ConsolePanel'
import { useConsole } from './hooks/useConsole'
import { useSocket } from './hooks/useSocket'
import { useR1SDK } from './hooks/useR1SDK'
import { useDeviceManagement } from './hooks/useDeviceManagement'

function App() {
  // Console logging hook
  const { consoleLogs, consoleRef, addConsoleLog, sendErrorToServer } = useConsole()

  // Socket connection hook
  const {
    isConnected,
    deviceId,
    deviceInfo,
    socketRef,
    connectSocket,
    handleReconnect,
    setDeviceInfo
  } = useSocket(addConsoleLog, sendErrorToServer)

  // R1 SDK hook
  useR1SDK(addConsoleLog, sendErrorToServer, socketRef)

  // Device management hook
  const {
    handleRefreshDeviceInfo,
    checkDeviceStatus,
    testChatCompletion,
    handleDisablePin,
    handleEnablePin,
    handleChangePin
  } = useDeviceManagement(deviceId, deviceInfo, setDeviceInfo, addConsoleLog, sendErrorToServer)

  // Initialize on mount
  useEffect(() => {
    addConsoleLog('R1 Anywhere Console initialized')

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

    // Connect socket after hooks are initialized
    connectSocket()

    // Cleanup
    return () => {
      if (socketRef.current) {
        if (socketRef.current._heartbeatInterval) {
          clearInterval(socketRef.current._heartbeatInterval)
        }
        socketRef.current.disconnect()
      }
    }
  }, [addConsoleLog, sendErrorToServer, connectSocket, socketRef])

  return (
    <div className="app">
      <StatusBar
        isConnected={isConnected}
        deviceId={deviceId}
        deviceInfo={deviceInfo}
        onRefreshDeviceInfo={handleRefreshDeviceInfo}
        onCheckDeviceStatus={checkDeviceStatus}
        onTestChatCompletion={testChatCompletion}
        onReconnect={handleReconnect}
        onChangePin={handleChangePin}
        onDisablePin={handleDisablePin}
        onEnablePin={handleEnablePin}
        onSocketTest={() => {
          if (socketRef.current && socketRef.current.connected) {
            addConsoleLog('🧪 Testing socket communication...', 'info')
            socketRef.current.emit('test_message', {
              deviceId: deviceId,
              message: 'Socket test from creation app',
              timestamp: new Date().toISOString()
            })
          } else {
            addConsoleLog('❌ Socket not connected', 'error')
          }
        }}
      />

      {/* Main Content - Activity Log */}
      <div className="main-content">
        <ConsolePanel consoleLogs={consoleLogs} ref={consoleRef} />
      </div>
    </div>
  )
}

export default App