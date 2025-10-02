// Handle chat completion requests from socket
export const handleChatCompletion = (data, socket, addLog, sendError, r1CreateRef) => {
  const currentRequestId = data.requestId || data.data?.requestId
  const messageToSend = data.message || data.data?.message
  const useLLM = data.useLLM !== undefined ? data.useLLM : (data.data?.useLLM !== undefined ? data.data.useLLM : true)
  const wantsR1Response = data.wantsR1Response !== undefined ? data.wantsR1Response : (data.data?.wantsR1Response !== undefined ? data.data.wantsR1Response : false)
  const wantsJournalEntry = true // Always save to journal as per requirements

  // Extract image data if present
  const imageBase64 = data.imageBase64 || data.data?.imageBase64
  const pluginId = data.pluginId || data.data?.pluginId

  addLog(`📤 Processing request ${currentRequestId}`)
  addLog(`📤 Message to send: "${messageToSend}"`)
  if (imageBase64) {
    addLog(`📸 Image data detected (${imageBase64.length} chars)`)
  }
  if (pluginId) {
    addLog(`🔌 Plugin ID: ${pluginId}`)
  }
  addLog(`📤 Options: useLLM=${useLLM}, wantsR1Response=${wantsR1Response}, wantsJournalEntry=${wantsJournalEntry}`)

  if (r1CreateRef.current && r1CreateRef.current.messaging) {
    try {
      // Prepare message options
      const messageOptions = {
        useLLM: useLLM,
        wantsR1Response: wantsR1Response,
        wantsJournalEntry: wantsJournalEntry,
        requestId: currentRequestId
      }

      // Add image data if present
      if (imageBase64) {
        messageOptions.imageBase64 = imageBase64
        addLog(`📸 Including image data in message options`)
      }

      // Add plugin ID if present
      if (pluginId) {
        messageOptions.pluginId = pluginId
        addLog(`🔌 Including plugin ID in message options: ${pluginId}`)
      }

      // Check if we should use vision API for image processing
      if (imageBase64 && (r1CreateRef.current.vision || r1CreateRef.current.image)) {
        addLog(`👁️ Using vision API for image processing`)

        const visionAPI = r1CreateRef.current.vision || r1CreateRef.current.image
        visionAPI.analyzeImage(imageBase64, {
          message: messageToSend,
          pluginId: pluginId,
          ...messageOptions
        })
      } else {
        // Use regular messaging API
        addLog(`💬 Using messaging API${imageBase64 ? ' with image data' : ''}`)
        r1CreateRef.current.messaging.sendMessage(messageToSend, messageOptions)
      }

      // Store the requestId for when we get the response
      if (currentRequestId) {
        socket._pendingRequestId = currentRequestId
        socket._originalMessage = data.originalMessage || data.data?.originalMessage
        addLog(`📝 Stored pending request: ${currentRequestId}`)
      }

      addLog(`📤 Sent message to R1 ${imageBase64 ? 'vision' : 'LLM'} API, requestId: ${currentRequestId}`)

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
    let simulatedResponse = `Hello! This is a simulated response from the R1 device. You said: "${messageToSend}". The R1 SDK is not available in this browser environment, but the socket communication is working correctly.`

    // Add image processing simulation if image data is present
    if (imageBase64) {
      simulatedResponse += `\n\n📸 Image detected! In a real R1 device, I would analyze this image (${imageBase64.length} characters of base64 data).`
      if (pluginId) {
        simulatedResponse += ` Using plugin: ${pluginId}`

        // Simulate different plugin responses
        if (pluginId === 'image-analyzer') {
          simulatedResponse += `\n\n🔍 Image Analysis Result: This appears to be a test image (1x1 pixel). The image contains minimal visual data and appears to be used for testing purposes.`
        }
      }
    }

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
    }, imageBase64 ? 2000 : 1000) // Longer delay for image processing simulation
  }
}