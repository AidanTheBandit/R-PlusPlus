// Detect and extract an MCP tool call from R1 LAM response text.
// Searches anywhere in the text (not just at the start) and uses
// balanced-brace counting so nested objects in "arguments" are handled.
// Returns the parsed tool call object { server, tool, arguments } or null.
export const detectMcpToolCall = (text) => {
  if (!text || typeof text !== 'string') return null

  // Quick check: does the pattern exist at all?
  if (!/\{\s*"mcp_tool_call"\s*:/.test(text)) return null

  // Find the start of the outer JSON object
  const startMatch = text.match(/\{\s*"mcp_tool_call"\s*:\s*\{/)
  if (!startMatch) return null

  const startIdx = startMatch.index

  // Count braces to find the matching closing brace (handles nesting)
  let depth = 0
  let inString = false
  let escape = false
  let endIdx = -1

  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i]
    if (escape) {
      escape = false
      continue
    }
    if (ch === '\\' && inString) {
      escape = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        endIdx = i
        break
      }
    }
  }

  if (endIdx === -1) {
    console.log('[MCP] Could not find matching closing brace for tool call JSON')
    return null
  }

  const jsonStr = text.substring(startIdx, endIdx + 1)
  try {
    const parsed = JSON.parse(jsonStr)
    const call = parsed.mcp_tool_call
    if (!call) {
      console.log('[MCP] JSON parsed but no mcp_tool_call key')
      return null
    }
    // Support a few field-name variations for robustness
    const server = call.server || call.serverName
    const tool = call.tool || call.toolName || call.name
    if (!server || !tool) {
      console.log(`[MCP] Tool call missing server or tool field (server=${server}, tool=${tool})`)
      return null
    }
    return {
      server,
      tool,
      arguments: call.arguments || call.args || call.params || {}
    }
  } catch (e) {
    console.log('[MCP] Failed to parse extracted tool call JSON:', e.message)
    return null
  }
}

// Handle MCP tool result from server.
// Sends the tool result to the R1 LAM as a follow-up message so the LAM
// can formulate a natural-language response using the tool data.
// The LAM's next response will flow through the normal onMessage handler.
export const handleMcpToolResult = (data, socket, addLog, sendError, r1CreateRef) => {
  const requestId = data.requestId
  const serverName = data.serverName
  const toolName = data.toolName
  const result = data.result
  const error = data.error

  addLog(`[MCP] Received tool result for ${serverName}.${toolName} (requestId: ${requestId})`, 'info')

  if (error) {
    addLog(`[MCP] Tool execution error: ${error}`, 'error')
  } else {
    addLog(`[MCP] Tool result: ${typeof result === 'string' ? result.substring(0, 200) : JSON.stringify(result).substring(0, 200)}`, 'info')
  }

  // Format the result for the R1 LAM
  let resultMessage
  if (error) {
    resultMessage = `[TOOL RESULT] ${serverName}.${toolName}: ERROR: ${error}`
  } else {
    const resultStr = typeof result === 'string' ? result : JSON.stringify(result)
    resultMessage = `[TOOL RESULT] ${serverName}.${toolName}: ${resultStr}`
  }

  if (r1CreateRef.current && r1CreateRef.current.messaging) {
    addLog(`[MCP] Sending tool result to R1 LAM as follow-up message`, 'info')

    try {
      r1CreateRef.current.messaging.sendMessage(resultMessage, {
        useLLM: true,
        wantsR1Response: true
      })
      addLog(`[MCP] Tool result sent to R1 LAM, waiting for follow-up response`, 'info')
    } catch (err) {
      addLog(`[MCP] Error sending tool result to R1 LAM: ${err.message}`, 'error')
      addLog(`[MCP] Falling back to sending tool result directly as response`, 'warn')
      // Fall back: send the result directly as the final response
      if (socket && socket.connected) {
        socket.emit('response', {
          requestId: requestId,
          response: resultMessage,
          model: 'r1-llm',
          timestamp: new Date().toISOString(),
          deviceId: socket._deviceId
        })
        socket._pendingRequestId = null
        socket._originalMessage = null
        addLog(`[MCP] Sent tool result as fallback final response`, 'info')
      }
    }
  } else {
    addLog('[MCP] R1 SDK messaging not available - sending tool result directly as response', 'warn')
    if (socket && socket.connected) {
      socket.emit('response', {
        requestId: requestId,
        response: resultMessage,
        model: 'r1-llm',
        timestamp: new Date().toISOString(),
        deviceId: socket._deviceId
      })
      socket._pendingRequestId = null
      socket._originalMessage = null
      addLog(`[MCP] Sent tool result as final response (no R1 SDK)`, 'info')
    }
  }
}

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

  addLog(`[OUT] Processing request ${currentRequestId}`)
  addLog(`[OUT] Message to send: "${messageToSend}"`)
  if (imageBase64) {
    addLog(`[IMG] Image data detected (${imageBase64.length} chars)`)
  }
  if (pluginId) {
    addLog(`[PLUGIN] Plugin ID: ${pluginId}`)
  }
  addLog(`[OUT] Options: useLLM=${useLLM}, wantsR1Response=${wantsR1Response}, wantsJournalEntry=${wantsJournalEntry}`)

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
        addLog(`[IMG] Including image data in message options`)
      }

      // Add plugin ID if present
      if (pluginId) {
        messageOptions.pluginId = pluginId
        addLog(`[PLUGIN] Including plugin ID in message options: ${pluginId}`)
      }

      // Check if we should use vision API for image processing
      if (imageBase64 && (r1CreateRef.current.vision || r1CreateRef.current.image)) {
        addLog(`[VISION] Using vision API for image processing`)

        const visionAPI = r1CreateRef.current.vision || r1CreateRef.current.image
        visionAPI.analyzeImage(imageBase64, {
          message: messageToSend,
          pluginId: pluginId,
          ...messageOptions
        })
      } else {
        // Use regular messaging API
        addLog(`[MSG] Using messaging API${imageBase64 ? ' with image data' : ''}`)
        r1CreateRef.current.messaging.sendMessage(messageToSend, messageOptions)
      }

      // Store the requestId for when we get the response
      if (currentRequestId) {
        socket._pendingRequestId = currentRequestId
        socket._originalMessage = data.originalMessage || data.data?.originalMessage
        addLog(`[MEMO] Stored pending request: ${currentRequestId}`)
      }

      addLog(`[OUT] Sent message to R1 ${imageBase64 ? 'vision' : 'LLM'} API, requestId: ${currentRequestId}`)

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
    addLog('[ERR] R1 SDK messaging not available - using fallback simulation', 'warn')

    // For testing purposes, simulate an R1 response when SDK is not available
    let simulatedResponse = `Hello! This is a simulated response from the R1 device. You said: "${messageToSend}". The R1 SDK is not available in this browser environment, but the socket communication is working correctly.`

    // Add image processing simulation if image data is present
    if (imageBase64) {
      simulatedResponse += `\n\n[IMG] Image detected! In a real R1 device, I would analyze this image (${imageBase64.length} characters of base64 data).`
      if (pluginId) {
        simulatedResponse += ` Using plugin: ${pluginId}`

        // Simulate different plugin responses
        if (pluginId === 'image-analyzer') {
          simulatedResponse += `\n\n[CHECK] Image Analysis Result: This appears to be a test image (1x1 pixel). The image contains minimal visual data and appears to be used for testing purposes.`
        }
      }
    }

    addLog(`[FALLBACK] Simulating R1 response: "${simulatedResponse.substring(0, 50)}..."`, 'info')

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

        addLog(`[OUT] Sending simulated response: ${JSON.stringify(responseData, null, 2)}`)
        socket.emit('response', responseData)
        addLog(`[OK] Sent simulated R1 response via socket`)
      }
    }, imageBase64 ? 2000 : 1000) // Longer delay for image processing simulation
  }
}