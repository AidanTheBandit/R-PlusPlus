import { useRef, useEffect } from 'react'
import { r1 } from 'r1-create'
import { handleTextToSpeech } from './useR1TTS.js'
import { handleChatCompletion, handleMcpToolResult, detectMcpToolCall } from './useR1Chat.js'
import { testR1APIs } from './r1SDKUtils.js'

export function useR1SDK(addConsoleLog, sendErrorToServer, socketRef) {
  const r1CreateRef = useRef(null)

  useEffect(() => {
    try {
      addConsoleLog('[CHECK] Checking R1 SDK availability...', 'info')
      addConsoleLog(`[CHECK] r1 object exists: ${!!r1}`, 'info')
      addConsoleLog(`[CHECK] r1.messaging exists: ${!!(r1 && r1.messaging)}`, 'info')

      // Check if R1 SDK is available
      if (r1 && r1.messaging) {
        r1CreateRef.current = r1
        addConsoleLog('[OK] R1 SDK available and initialized', 'info')

        // Test available APIs
        testR1APIs(r1, addConsoleLog)

        // Set up message handler for LLM responses
        try {
          r1.messaging.onMessage((response) => {
            addConsoleLog(`[OUT] R1 SDK message received: ${JSON.stringify(response, null, 2)}`)

            // The R1 responds with {"message":"text"}, so extract the response text
            const responseText = response.message || response.content || response || 'No response text'

            addConsoleLog(`[OUT] Extracted response text: "${responseText}"`)
            addConsoleLog(`[OUT] Current pending request ID: ${socketRef.current?._pendingRequestId}`)

            // Check for MCP tool call anywhere in the response text
            const mcpToolCall = detectMcpToolCall(String(responseText))

            if (mcpToolCall) {
              addConsoleLog(`[MCP] Detected MCP tool call: ${mcpToolCall.server}.${mcpToolCall.tool}`, 'info')
              addConsoleLog(`[MCP] Tool call arguments: ${JSON.stringify(mcpToolCall.arguments)}`, 'info')

              if (socketRef.current && socketRef.current.connected) {
                const requestId = socketRef.current._pendingRequestId
                const currentDeviceId = socketRef.current._deviceId

                socketRef.current.emit('mcp_tool_call', {
                  requestId: requestId,
                  serverName: mcpToolCall.server,
                  toolName: mcpToolCall.tool,
                  args: mcpToolCall.arguments || {},
                  deviceId: currentDeviceId
                })

                addConsoleLog(`[MCP] Emitted mcp_tool_call for ${mcpToolCall.server}.${mcpToolCall.tool} (requestId: ${requestId})`, 'info')
                addConsoleLog(`[MCP] Waiting for mcp_tool_result from server before forwarding response`, 'info')

                // Do NOT clear the pending request ID - we need it when the
                // tool result comes back and the LAM sends its final response.
                // Do NOT emit 'response' yet - the final response comes after
                // the tool result is fed back to the LAM.
              } else {
                addConsoleLog('[MCP] Socket not connected, cannot emit mcp_tool_call', 'error')
              }
              return // Stop processing - wait for tool result
            }

            // Normal response flow (no MCP tool call detected)
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

              addConsoleLog(`[OUT] Sending response data: ${JSON.stringify(responseData, null, 2)}`)

              socketRef.current.emit('response', responseData)
              addConsoleLog(`[OUT] Sent R1 SDK response via socket: "${responseText.substring(0, 50)}..." (requestId: ${socketRef.current._pendingRequestId})`)

              // Clear the pending request data
              socketRef.current._pendingRequestId = null
              socketRef.current._originalMessage = null
            } else {
              addConsoleLog('Socket not connected, cannot send response', 'error')
            }
          })
          addConsoleLog('[OK] R1 messaging onMessage handler set up', 'info')
        } catch (handlerError) {
          addConsoleLog(`[ERR] Error setting up R1 message handler: ${handlerError.message}`, 'error')
        }
      } else {
        addConsoleLog('[ERR] R1 SDK messaging not available - this app must run on R1 device', 'error')
        addConsoleLog(`[CHECK] r1 object details: ${JSON.stringify(r1, null, 2)}`, 'info')

        // Check if we're in a browser environment that doesn't have R1 SDK
        if (typeof window !== 'undefined' && !window.r1) {
          addConsoleLog('[TIP] This appears to be running in a browser without R1 SDK', 'info')
          addConsoleLog('[TIP] For testing, you can use the mock response mode', 'info')
        }
      }
    } catch (error) {
      addConsoleLog(`[ERR] R1 SDK initialization error: ${error.message}`, 'error')
      addConsoleLog(`[ERR] Error stack: ${error.stack}`, 'error')
      console.error('R1 SDK initialization error details:', error)
    }

    // Set up global handlers for socket hook
    window.handleChatCompletion = (data, socket, addLog, sendError) =>
      handleChatCompletion(data, socket, addLog, sendError, r1CreateRef)
    window.handleTextToSpeech = (data, socket, addLog, sendError) =>
      handleTextToSpeech(data, socket, addLog, sendError, r1CreateRef)
    window.handleMcpToolResult = (data, socket, addLog, sendError) =>
      handleMcpToolResult(data, socket, addLog, sendError, r1CreateRef)

    // Cleanup
    return () => {
      if (window.handleChatCompletion) {
        delete window.handleChatCompletion
      }
      if (window.handleTextToSpeech) {
        delete window.handleTextToSpeech
      }
      if (window.handleMcpToolResult) {
        delete window.handleMcpToolResult
      }
    }
  }, [addConsoleLog, sendErrorToServer, socketRef])

  return {
    r1CreateRef
  }
}
