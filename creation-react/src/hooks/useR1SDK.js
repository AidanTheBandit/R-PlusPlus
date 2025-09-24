import { useRef, useEffect } from 'react'
import { r1 } from 'r1-create'

export function useR1SDK(addConsoleLog, sendErrorToServer, socketRef) {
  const r1CreateRef = useRef(null)

  // Handle chat completion requests from socket
  const handleChatCompletion = (data, socket, addLog, sendError) => {
    const currentRequestId = data.requestId || data.data?.requestId
    const messageToSend = data.message || data.data?.message
    const useLLM = data.useLLM !== undefined ? data.useLLM : (data.data?.useLLM !== undefined ? data.data.useLLM : true)
    const wantsR1Response = data.wantsR1Response !== undefined ? data.wantsR1Response : (data.data?.wantsR1Response !== undefined ? data.data.wantsR1Response : false)
    const wantsJournalEntry = true // Always save to journal as per requirements

    if (r1CreateRef.current && r1CreateRef.current.messaging) {
      try {
        addLog(`📤 Processing request ${currentRequestId}`)
        addLog(`📤 Message to send: "${messageToSend}"`)
        addLog(`📤 Options: useLLM=${useLLM}, wantsR1Response=${wantsR1Response}, wantsJournalEntry=${wantsJournalEntry}`)

        // Use R1 SDK messaging API to send message to LLM
        r1CreateRef.current.messaging.sendMessage(messageToSend, {
          useLLM: useLLM,
          wantsR1Response: wantsR1Response,
          wantsJournalEntry: wantsJournalEntry,
          requestId: currentRequestId
        })

        // Store the requestId for when we get the response
        if (currentRequestId) {
          socket._pendingRequestId = currentRequestId
          socket._originalMessage = data.originalMessage || data.data?.originalMessage
          addLog(`📝 Stored pending request: ${currentRequestId}`)
        }

        addLog(`📤 Sent message to R1 LLM via messaging API, requestId: ${currentRequestId}`)

        // Send immediate acknowledgment that we received the request
        socket.emit('message_received', {
          requestId: currentRequestId,
          deviceId: socket._deviceId,
          timestamp: new Date().toISOString()
        })

      } catch (error) {
        addLog(`R1 SDK messaging error: ${error.message}`, 'error')
        addLog(`R1 SDK error stack: ${error.stack}`, 'error')
        socket.emit('error', {
          requestId: data.requestId || data.data?.requestId,
          error: `R1 SDK messaging error: ${error.message}`,
          deviceId: socket._deviceId
        })
        sendError('error', `R1 SDK messaging failed: ${error.message}`)
      }
    } else {
      addLog('❌ R1 SDK messaging not available - using fallback simulation', 'warn')

      // For testing purposes, simulate an R1 response when SDK is not available
      const simulatedResponse = `Hello! This is a simulated response from the R1 device. You said: "${messageToSend}". The R1 SDK is not available in this browser environment, but the socket communication is working correctly.`

      addLog(`🤖 Simulating R1 response: "${simulatedResponse.substring(0, 50)}..."`, 'info')

      // Send simulated response after a short delay to mimic processing time
      setTimeout(() => {
        if (socket && socket.connected) {
          const responseData = {
            requestId: currentRequestId,
            response: simulatedResponse,
            originalMessage: data.originalMessage || data.data?.originalMessage,
            model: 'r1-llm-simulated',
            timestamp: new Date().toISOString(),
            deviceId: socket._deviceId
          }

          addLog(`📤 Sending simulated response: ${JSON.stringify(responseData, null, 2)}`)
          socket.emit('response', responseData)
          addLog(`✅ Sent simulated R1 response via socket`)
        }
      }, 1000) // 1 second delay to simulate processing
    }
  }

  useEffect(() => {
    try {
      addConsoleLog('🔍 Checking R1 SDK availability...', 'info')
      addConsoleLog(`🔍 r1 object exists: ${!!r1}`, 'info')
      addConsoleLog(`🔍 r1.messaging exists: ${!!(r1 && r1.messaging)}`, 'info')

      // Check if R1 SDK is available
      if (r1 && r1.messaging) {
        r1CreateRef.current = r1
        addConsoleLog('✅ R1 SDK available and initialized', 'info')

        // Check what APIs are available
        const availableAPIs = []
        if (r1.messaging) availableAPIs.push('messaging')
        if (r1.llm) availableAPIs.push('llm')
        if (r1.camera) availableAPIs.push('camera')
        if (r1.hardware) availableAPIs.push('hardware')
        if (r1.storage) availableAPIs.push('storage')
        if (r1.microphone) availableAPIs.push('microphone')
        if (r1.speaker) availableAPIs.push('speaker')

        addConsoleLog(`📋 Available R1 APIs: ${availableAPIs.join(', ')}`, 'info')

        // Test the messaging API
        try {
          addConsoleLog('🧪 Testing R1 messaging API...', 'info')
          // Just check if the methods exist
          if (typeof r1.messaging.sendMessage === 'function') {
            addConsoleLog('✅ r1.messaging.sendMessage is available', 'info')
          } else {
            addConsoleLog('❌ r1.messaging.sendMessage is not a function', 'error')
          }

          if (typeof r1.messaging.onMessage === 'function') {
            addConsoleLog('✅ r1.messaging.onMessage is available', 'info')
          } else {
            addConsoleLog('❌ r1.messaging.onMessage is not a function', 'error')
          }
        } catch (testError) {
          addConsoleLog(`❌ Error testing R1 messaging API: ${testError.message}`, 'error')
        }

        // Set up message handler for LLM responses
        try {
          r1.messaging.onMessage((response) => {
            addConsoleLog(`📤 R1 SDK message received: ${JSON.stringify(response, null, 2)}`)

            // The R1 responds with {"message":"text"}, so extract the response text
            const responseText = response.message || response.content || response || 'No response text'

            addConsoleLog(`📤 Extracted response text: "${responseText}"`)
            addConsoleLog(`📤 Current pending request ID: ${socketRef.current?._pendingRequestId}`)

            // Send response via socket (server will handle requestId matching)
            if (socketRef.current && socketRef.current.connected) {
              const currentDeviceId = socketRef.current._deviceId
              const responseData = {
                requestId: socketRef.current._pendingRequestId,
                response: responseText,
                originalMessage: socketRef.current._originalMessage,
                model: 'r1-llm',
                timestamp: new Date().toISOString(),
                deviceId: currentDeviceId
              }

              addConsoleLog(`📤 Sending response data: ${JSON.stringify(responseData, null, 2)}`)

              socketRef.current.emit('response', responseData)
              addConsoleLog(`📤 Sent R1 SDK response via socket: "${responseText.substring(0, 50)}..." (requestId: ${socketRef.current._pendingRequestId})`)

              // Clear the pending request data
              socketRef.current._pendingRequestId = null
              socketRef.current._originalMessage = null
            } else {
              addConsoleLog('Socket not connected, cannot send response', 'error')
            }
          })
          addConsoleLog('✅ R1 messaging onMessage handler set up', 'info')
        } catch (handlerError) {
          addConsoleLog(`❌ Error setting up R1 message handler: ${handlerError.message}`, 'error')
        }
      } else {
        addConsoleLog('❌ R1 SDK messaging not available - this app must run on R1 device', 'error')
        addConsoleLog(`🔍 r1 object details: ${JSON.stringify(r1, null, 2)}`, 'info')

        // Check if we're in a browser environment that doesn't have R1 SDK
        if (typeof window !== 'undefined' && !window.r1) {
          addConsoleLog('💡 This appears to be running in a browser without R1 SDK', 'info')
          addConsoleLog('💡 For testing, you can use the mock response mode', 'info')
        }
      }
    } catch (error) {
      addConsoleLog(`❌ R1 SDK initialization error: ${error.message}`, 'error')
      addConsoleLog(`❌ Error stack: ${error.stack}`, 'error')
      console.error('R1 SDK initialization error details:', error)
    }

    // Set up global handler for socket hook
    window.handleChatCompletion = handleChatCompletion

    // Cleanup
    return () => {
      if (window.handleChatCompletion) {
        delete window.handleChatCompletion
      }
    }
  }, [addConsoleLog, sendErrorToServer, socketRef])

  return {
    r1CreateRef
  }
}