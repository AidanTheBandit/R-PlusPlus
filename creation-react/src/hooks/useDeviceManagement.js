import { useCallback } from 'react'

export function useDeviceManagement(deviceId, deviceInfo, setDeviceInfo, addConsoleLog, sendErrorToServer) {
  const refreshDeviceInfoDirect = useCallback(async (targetDeviceId) => {
    try {
      addConsoleLog(`Refreshing device info`, 'info')
      const response = await fetch(`/${targetDeviceId}/info`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        addConsoleLog(`Device info refreshed: PIN=${data.pinCode}, enabled=${data.pinEnabled}`, 'info')
        setDeviceInfo({
          pinCode: data.pinCode,
          pinEnabled: data.pinEnabled !== false && data.pinCode !== null
        })
      } else {
        addConsoleLog(`Failed to refresh device info: ${response.status}`, 'error')
      }
    } catch (error) {
      addConsoleLog(`Error refreshing device info: ${error.message}`, 'error')
    }
  }, [addConsoleLog, setDeviceInfo])

  const handleRefreshDeviceInfo = useCallback(async () => {
    if (!deviceId) {
      addConsoleLog('No device connected', 'warn')
      return
    }
    await refreshDeviceInfoDirect(deviceId)
  }, [deviceId, refreshDeviceInfoDirect, addConsoleLog])

  const checkDeviceStatus = useCallback(async () => {
    if (!deviceId) {
      addConsoleLog('No device ID to check', 'warn')
      return
    }

    try {
      addConsoleLog(`🔍 Checking device status`, 'info')
      const response = await fetch(`/${deviceId}/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        addConsoleLog(`📊 Device status: ${JSON.stringify(data)}`, 'info')
      } else {
        addConsoleLog(`❌ Device status check failed: ${response.status}`, 'error')
      }
    } catch (error) {
      addConsoleLog(`❌ Error checking device status: ${error.message}`, 'error')
    }
  }, [deviceId, addConsoleLog])

  const syncDeviceData = useCallback(async (targetDeviceId, socketRef) => {
    try {
      addConsoleLog(`🔄 Syncing device data`, 'info')

      // Send device sync request to server
      const response = await fetch(`/${targetDeviceId}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          socketId: socketRef?.current?.id,
          timestamp: new Date().toISOString(),
          clientInfo: {
            userAgent: navigator.userAgent,
            url: window.location.href
          }
        })
      })

      if (response.ok) {
        const data = await response.json()
        addConsoleLog(`✅ Device sync successful: ${JSON.stringify(data)}`, 'info')

        // Update local device info with server data
        if (data.pinCode !== deviceInfo?.pinCode) {
          addConsoleLog(`🔄 PIN updated from server: ${data.pinCode}`, 'info')
          setDeviceInfo(prev => ({
            ...prev,
            pinCode: data.pinCode,
            pinEnabled: data.pinEnabled !== false && data.pinCode !== null
          }))
        }
      } else {
        addConsoleLog(`❌ Device sync failed: ${response.status}`, 'error')
      }
    } catch (error) {
      addConsoleLog(`❌ Error syncing device data: ${error.message}`, 'error')
    }
  }, [addConsoleLog, deviceInfo?.pinCode, setDeviceInfo])

  const testChatCompletion = useCallback(async () => {
    if (!deviceId) {
      addConsoleLog('No device ID to test', 'warn')
      return
    }

    try {
      addConsoleLog(`🧪 Testing chat completion`, 'info')

      const testMessage = "Test message from R1 console"
      const response = await fetch('/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(deviceInfo?.pinCode && { 'Authorization': `Bearer ${deviceInfo.pinCode}` })
        },
        body: JSON.stringify({
          model: 'r1-command',
          messages: [{ role: 'user', content: testMessage }],
          temperature: 0.7,
          max_tokens: 150,
          deviceId: deviceId
        })
      })

      if (response.ok) {
        const data = await response.json()
        addConsoleLog(`✅ Chat completion test successful: ${JSON.stringify(data).substring(0, 200)}...`, 'info')
      } else {
        const errorText = await response.text()
        addConsoleLog(`❌ Chat completion test failed: ${response.status} - ${errorText}`, 'error')

        // If device not found, try to sync and retry
        if (errorText.includes('not found') || errorText.includes('not connected')) {
          addConsoleLog(`🔄 Device not found - attempting sync and retry`, 'warn')
          await syncDeviceData(deviceId, null)

          // Retry after sync
          setTimeout(async () => {
            try {
              const retryResponse = await fetch('/chat/completions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(deviceInfo?.pinCode && { 'Authorization': `Bearer ${deviceInfo.pinCode}` })
                },
                body: JSON.stringify({
                  model: 'r1-command',
                  messages: [{ role: 'user', content: testMessage }],
                  temperature: 0.7,
                  max_tokens: 150,
                  deviceId: deviceId
                })
              })

              if (retryResponse.ok) {
                const retryData = await retryResponse.json()
                addConsoleLog(`✅ Chat completion retry successful: ${JSON.stringify(retryData).substring(0, 200)}...`, 'info')
              } else {
                const retryError = await retryResponse.text()
                addConsoleLog(`❌ Chat completion retry failed: ${retryResponse.status} - ${retryError}`, 'error')
              }
            } catch (retryErr) {
              addConsoleLog(`❌ Error in retry: ${retryErr.message}`, 'error')
            }
          }, 2000)
        }
      }
    } catch (error) {
      addConsoleLog(`❌ Error testing chat completion: ${error.message}`, 'error')
    }
  }, [deviceId, deviceInfo?.pinCode, addConsoleLog, syncDeviceData])

  const handleDisablePin = useCallback(async () => {
    if (!deviceId) {
      addConsoleLog('No device ID available', 'error')
      return
    }

    if (!deviceInfo?.pinCode) {
      addConsoleLog('No PIN available - refreshing device info first', 'warn')
      await refreshDeviceInfoDirect(deviceId)

      // Check again after refresh
      if (!deviceInfo?.pinCode) {
        addConsoleLog('Still no PIN after refresh - cannot disable', 'error')
        return
      }
    }

    addConsoleLog(`=== PIN DISABLE ATTEMPT ===`, 'info')
    addConsoleLog(`Device ID: [HIDDEN]`, 'info')
    addConsoleLog(`Client PIN: [HIDDEN]`, 'info')
    addConsoleLog(`PIN Enabled: ${deviceInfo.pinEnabled}`, 'info')

    try {
      const url = `/${deviceId}/disable-pin`
      addConsoleLog(`Request URL: ${url}`, 'info')
      addConsoleLog(`Authorization: Bearer ${deviceInfo.pinCode}`, 'info')

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${deviceInfo.pinCode}`,
          'Content-Type': 'application/json'
        }
      })

      addConsoleLog(`Response: ${response.status} ${response.statusText}`, 'info')

      if (response.ok) {
        setDeviceInfo(prev => ({ ...prev, pinEnabled: false, pinCode: null }))
        addConsoleLog('✅ PIN disabled successfully', 'info')
      } else {
        const responseText = await response.text()
        addConsoleLog(`❌ Server response: ${responseText}`, 'error')

        // If auth error, refresh and try once more
        if (response.status === 401 || response.status === 403) {
          addConsoleLog('🔄 Auth failed - refreshing PIN and retrying once', 'warn')
          await refreshDeviceInfoDirect(deviceId)

          // Retry once with fresh PIN
          if (deviceInfo?.pinCode) {
            addConsoleLog(`🔄 Retrying with fresh PIN: ${deviceInfo.pinCode}`, 'info')
            const retryResponse = await fetch(url, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${deviceInfo.pinCode}`,
                'Content-Type': 'application/json'
              }
            })

            if (retryResponse.ok) {
              setDeviceInfo(prev => ({ ...prev, pinEnabled: false, pinCode: null }))
              addConsoleLog('✅ PIN disabled successfully on retry', 'info')
            } else {
              const retryText = await retryResponse.text()
              addConsoleLog(`❌ Retry also failed: ${retryText}`, 'error')
            }
          }
        }
      }
    } catch (error) {
      addConsoleLog(`❌ Network error: ${error.message}`, 'error')
    }
  }, [deviceId, deviceInfo, addConsoleLog, refreshDeviceInfoDirect, setDeviceInfo])

  const handleEnablePin = useCallback(async () => {
    if (!deviceId) {
      addConsoleLog('No device connected', 'warn')
      return
    }

    const newPin = prompt('Enter new 6-digit PIN code:')
    if (!newPin || newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      addConsoleLog('Invalid PIN format. Must be exactly 6 digits.', 'error')
      return
    }

    try {
      const response = await fetch(`/${deviceId}/enable-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newPin })
      })

      if (response.ok) {
        await response.json() // consume response
        setDeviceInfo(prev => ({ ...prev, pinEnabled: true, pinCode: newPin }))
        addConsoleLog(`PIN enabled successfully: ${newPin}`, 'info')
      } else {
        let errorMessage = 'Unknown error'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`
        } catch (parseError) {
          errorMessage = `HTTP ${response.status} - ${response.statusText}`
        }
        addConsoleLog(`Failed to enable PIN: ${errorMessage}`, 'error')
      }
    } catch (error) {
      addConsoleLog(`Error enabling PIN: ${error.message}`, 'error')
    }
  }, [deviceId, addConsoleLog, setDeviceInfo])

  const handleChangePin = useCallback(async () => {
    if (!deviceId || !deviceInfo?.pinCode) {
      addConsoleLog('No current PIN to change', 'warn')
      return
    }

    const currentPin = prompt('Enter current PIN code:')
    if (!currentPin) return

    const newPin = prompt('Enter new 6-digit PIN code:')
    if (!newPin || newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      addConsoleLog('Invalid PIN format. Must be exactly 6 digits.', 'error')
      return
    }

    try {
      const response = await fetch(`/${deviceId}/change-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ currentPin, newPin })
      })

      if (response.ok) {
        setDeviceInfo(prev => ({ ...prev, pinCode: newPin }))
        addConsoleLog(`PIN changed successfully: ${newPin}`, 'info')
      } else {
        let errorMessage = 'Unknown error'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`
        } catch (parseError) {
          errorMessage = `HTTP ${response.status} - ${response.statusText}`
        }
        addConsoleLog(`Failed to change PIN: ${errorMessage}`, 'error')
      }
    } catch (error) {
      addConsoleLog(`Error changing PIN: ${error.message}`, 'error')
    }
  }, [deviceId, deviceInfo?.pinCode, addConsoleLog, setDeviceInfo])

  // Set up global function for socket hook
  window.refreshDeviceInfo = refreshDeviceInfoDirect

  return {
    handleRefreshDeviceInfo,
    handleDisablePin,
    handleEnablePin,
    handleChangePin
  }
}