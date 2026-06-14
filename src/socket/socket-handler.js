const { sendOpenAIResponse } = require('../utils/response-utils');
const { DeviceIdManager } = require('../utils/device-id-manager');
// Using built-in fetch (Node.js 18+)

// Function to convert text response to JSON using Groq API
async function convertToJsonWithGroq(textResponse, originalRequest) {
  try {
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      console.log('No GROQ_API_KEY found, skipping JSON conversion');
      return null;
    }

    const prompt = `Convert the following text response to a valid JSON object. The response should be in this exact format: {"move": "chess_move", "reasoning": "explanation"}

Text to convert: "${textResponse}"

Return ONLY the JSON object, no additional text or explanation.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 200
      })
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    const jsonText = data.choices[0].message.content.trim();
    
    // Validate that it's valid JSON
    const parsed = JSON.parse(jsonText);
    console.log('[OK] Successfully converted response to JSON using Groq');
    return parsed;
  } catch (error) {
    console.error('[OK] Failed to convert response to JSON with Groq:', error.message);
    return null;
  }
}
const axios = require('axios');

function setupSocketHandler(io, connectedR1s, pendingRequests, requestDeviceMap, debugStreams, deviceLogs, debugDataStore, performanceMetrics, deviceIdManager = null) {
  // Initialize device ID manager if not provided
  if (!deviceIdManager) {
    deviceIdManager = new DeviceIdManager();
  }

  // Get PIN configuration from environment
  const enablePin = process.env.DISABLE_PIN !== 'true'; // Default to enabled, disable if DISABLE_PIN=true

  // Track requests that have had tools executed (for follow-up responses)
  const toolExecutedRequests = new Set();

  // Socket.IO connection handling
  io.on('connection', async (socket) => {
    // Get client info for device identification
    const userAgent = socket.handshake.headers['user-agent'];
    const ipAddress = socket.handshake.address || socket.request.connection.remoteAddress;
    
    // Extract device secret from socket auth payload (primary) or cookie (fallback)
    let deviceSecret = null;

    // Check auth payload first (sent from localStorage, most reliable)
    if (socket.handshake.auth && socket.handshake.auth.deviceSecret) {
      deviceSecret = socket.handshake.auth.deviceSecret;
    }

    // Fallback: check cookie
    if (!deviceSecret) {
      const cookies = socket.handshake.headers.cookie;
      if (cookies) {
        const cookieMatch = cookies.match(/r1_device_secret=([^;]+)/);
        if (cookieMatch) {
          deviceSecret = decodeURIComponent(cookieMatch[1]);
        }
      }
    }

    // Get or create persistent device ID
    console.log(`[OK] New socket connection: ${socket.id}`);
    console.log(`🍪 Device secret from cookie: ${deviceSecret ? 'present' : 'none'}`);
    
    const result = await deviceIdManager.registerDevice(socket.id, null, deviceSecret, userAgent, ipAddress, enablePin);
    const { deviceId, pinCode, deviceSecret: newDeviceSecret, isReconnection } = result;
    connectedR1s.set(deviceId, socket);

    console.log(`R1 device ${isReconnection ? 'reconnected' : 'connected'}`);
    console.log(`Total connected devices: ${connectedR1s.size}`);

    // Don't broadcast device connections to prevent device ID leakage

    // Send welcome message with device ID, PIN code, and device secret for cookie
    socket.emit('connected', {
      deviceId: deviceId,
      pinCode: pinCode,
      pinEnabled: pinCode !== null,
      deviceSecret: newDeviceSecret, // Only sent for new devices
      isReconnection: isReconnection,
      message: isReconnection ? 'Reconnected to R-API server' : 'Connected to R-API server'
    });
    
    // Remove debug logging to prevent device ID leakage

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`R1 device disconnected`);
      
      // Clean up any pending requests for this device
      const requestsToClean = [];
      for (const [requestId, deviceIdMapped] of requestDeviceMap.entries()) {
        if (deviceIdMapped === deviceId) {
          requestsToClean.push(requestId);
        }
      }
      
      for (const requestId of requestsToClean) {
        if (pendingRequests.has(requestId)) {
          const { res, timeout } = pendingRequests.get(requestId);
          
          // Clear the timeout
          clearTimeout(timeout);
          
          // Remove from maps
          pendingRequests.delete(requestId);
          requestDeviceMap.delete(requestId);
          
          // Send timeout response to client
          res.status(504).json({
            error: {
              message: 'Device disconnected - request cancelled',
              type: 'device_disconnected'
            }
          });
          
          console.log(`🧹 Cleaned up pending request ${requestId} due to device disconnect`);
        }
      }
      
      connectedR1s.delete(deviceId);
      deviceIdManager.unregisterDevice(socket.id);

      console.log(`Total connected devices after disconnect: ${connectedR1s.size}`);
      console.log(`Cleaned up ${requestsToClean.length} pending requests`);
    });

    // Debug data streaming handlers - store locally only
    socket.on('hardware_event', (data) => {
      // Store locally but don't log device IDs
    });

    socket.on('camera_event', (data) => {
      // Store locally but don't log device IDs
    });

    socket.on('llm_event', (data) => {
      // Store locally but don't log device IDs
    });

    socket.on('storage_event', (data) => {
      // Store locally but don't log device IDs
    });

    socket.on('audio_event', (data) => {
      // Store locally but don't log device IDs
    });

    socket.on('performance_event', (data) => {
      // Store locally but don't log device IDs
    });

    socket.on('device_event', (data) => {
      // Store locally but don't log device IDs
    });

    socket.on('client_log', (data) => {
      // Store locally but don't log device IDs
    });

    socket.on('system_info', (data) => {
      console.log(`System info received`);
      // Store system info for analytics (without exposing device ID)
      if (!global.systemInfo) global.systemInfo = {};
      global.systemInfo[deviceId] = {
        ...data.systemInfo,
        lastUpdated: new Date().toISOString()
      };
    });

    // Handle ping/heartbeat from client
    socket.on('ping', (data) => {
      // Respond with pong to keep connection alive (without exposing device ID)
      socket.emit('pong', {
        timestamp: Date.now(),
        serverTime: new Date().toISOString()
      });
    });

    // Handle chat completion requests from server
    socket.on('chat_completion', (data) => {
      console.log(`💬 Chat completion request received`);
      
      // Forward to the R1 device - the R1 app should handle this
      // The R1 device will process the messages and send back a response via 'response' event
      console.log(`📨 Forwarding chat completion to R1 device:`, JSON.stringify(data, null, 2));
    });

    // Handle text-to-speech requests from server
    socket.on('text_to_speech', (data) => {
      console.log(`🎵 Text-to-speech request received`);
      
      // Forward to the R1 device - the R1 app should handle this
      // The R1 device will process the TTS request and send back audio via 'tts_response' event
      console.log(`📨 Forwarding TTS request to R1 device:`, JSON.stringify(data, null, 2));
    });

    socket.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        console.log(`Message from device:`, message);

        // Handle different message types from R1
        switch (message.type) {
          case 'status':
            console.log(`R1 device status:`, message.data);
            break;
          case 'response':
            console.log(`R1 device response:`, message.data);
            break;
          case 'error':
            console.error(`R1 device error:`, message.data);
            break;
          default:
            console.log(`Unknown message type from device:`, message);
        }
      } catch (error) {
        console.error(`Error parsing message from ${deviceId}:`, error);
      }
    });

    // Handle response events from R1 devices
    socket.on('response', async (data) => {
      console.log(`[OK] Socket Response received`);

      const { requestId, response, originalMessage, model, timestamp } = data;

      console.log(`Looking for pending request: ${requestId}`);

      // Only process responses with valid request IDs to prevent cross-contamination
      if (requestId && pendingRequests.has(requestId)) {
        console.log(`[OK] Found matching request, sending response to client`);
        const { res, timeout, stream, response_format } = pendingRequests.get(requestId);

        // Verify this request was actually sent to this device
        const expectedDeviceId = requestDeviceMap.get(requestId);
        if (expectedDeviceId !== deviceId) {
          console.log(`[OK] Security violation: Response from wrong device`);
          return;
        }

        // Check if this is a follow-up response after MCP tool execution
        const isMCPFollowUp = mcpToolExecutedRequests.has(requestId);

        // Check if the response contains an MCP tool call
        let finalResponse = response;
        let isMCPToolCall = false;

        try {
          // Strip markdown code blocks if present
          let cleanResponse = response.trim();
          if (cleanResponse.startsWith('```json') && cleanResponse.endsWith('```')) {
            cleanResponse = cleanResponse.slice(7, -3).trim(); // Remove ```json and ```
          } else if (cleanResponse.startsWith('```') && cleanResponse.endsWith('```')) {
            cleanResponse = cleanResponse.slice(3, -3).trim(); // Remove ``` and ```
          }

          // For JSON responses, validate the JSON format
          if (response_format && response_format.type === 'json_object') {
            try {
              JSON.parse(cleanResponse);
              finalResponse = cleanResponse; // Use the clean response
              console.log(`[OK] Valid JSON response for json_object format`);
            } catch (jsonError) {
              console.log(`[OK] Invalid JSON response for json_object format, attempting conversion with Groq`);
              
              // Try to convert using Groq
              const convertedJson = await convertToJsonWithGroq(cleanResponse, { requestId, model, originalMessage });
              if (convertedJson) {
                finalResponse = JSON.stringify(convertedJson);
                console.log(`[OK] Successfully converted response to JSON`);
              } else {
                console.error(`[OK] Failed to convert response to JSON, sending error`);
                clearTimeout(timeout);
                pendingRequests.delete(requestId);
                requestDeviceMap.delete(requestId);
                
                res.status(400).json({
                  error: {
                    message: 'Invalid JSON response from device and conversion failed',
                    type: 'invalid_json_response'
                  }
                });
                return;
              }
            }
          } else {
            // Try to parse the response as JSON to check for mcp_tool_call
            const parsedResponse = JSON.parse(cleanResponse);
            if (parsedResponse && parsedResponse.mcp_tool_call) {
              console.log(`[OK] MCP tool call detected in response`);
              isMCPToolCall = true;

              const { server: serverName, tool: toolName, arguments: toolArgs } = parsedResponse.mcp_tool_call;

              if (mcpManager) {
                try {
                  // Execute the MCP tool
                  const toolResult = await mcpManager.handleToolCall(deviceId, serverName, toolName, toolArgs || {});

                  // Mark this request as having had an MCP tool executed
                  mcpToolExecutedRequests.add(requestId);

                  // Send the tool result back to the R1 device for final response generation
                  socket.emit('mcp_tool_result', {
                    requestId: requestId,
                    serverName,
                    toolName,
                    result: toolResult,
                    success: true,
                    timestamp: new Date().toISOString()
                  });

                  // Don't send the response yet - wait for the R1 to generate the final response
                  console.log(`[OK] MCP tool executed, waiting for R1 final response`);
                  return;

                } catch (toolError) {
                  console.error(`[OK] MCP tool execution failed:`, toolError);

                  // Send error back to R1 device
                  socket.emit('mcp_tool_result', {
                    requestId: requestId,
                    serverName,
                    toolName,
                    error: toolError.message,
                    success: false,
                    timestamp: new Date().toISOString()
                  });

                  // Send error response to client
                  clearTimeout(timeout);
                  pendingRequests.delete(requestId);
                  requestDeviceMap.delete(requestId);
                  mcpToolExecutedRequests.delete(requestId);

                  res.status(500).json({
                    error: {
                      message: `MCP tool execution failed: ${toolError.message}`,
                      type: 'mcp_error'
                    }
                  });
                  return;
                }
              } else {
                console.error(`[OK] MCP manager not available`);
                finalResponse = "Sorry, MCP functionality is not available at this time.";
              }
            }
          }
        } catch (parseError) {
          // Response is not JSON, use as-is
          console.log(`📝 Response is not JSON, using as normal response`);
        }

        // If this is not an MCP tool call, or if MCP execution failed, send the response
        if (!isMCPToolCall) {
          // If this is a follow-up response after MCP tool execution, clean up the tracking
          if (isMCPFollowUp) {
            mcpToolExecutedRequests.delete(requestId);
            console.log(`[OK] Received final response after MCP tool execution`);
          }

          // Clear timeout and remove from pending requests
          clearTimeout(timeout);
          pendingRequests.delete(requestId);
          requestDeviceMap.delete(requestId);
          console.log(`🗑️ Removed pending request, remaining: ${pendingRequests.size}`);

          sendOpenAIResponse(res, finalResponse, originalMessage, model, stream);
        }
      }
      else {
        console.log(`[OK] No matching requests found for response`);
      }
    });

    // Handle TTS response events from R1 devices
    socket.on('tts_response', (data) => {
      console.log(`🔊 TTS Response received`);

      const { requestId, audioData, audioFormat, timestamp } = data;

      console.log(`Looking for pending TTS request: ${requestId}`);

      // Only process responses with valid request IDs to prevent cross-contamination
      if (requestId && pendingRequests.has(requestId)) {
        console.log(`[OK] Found matching TTS request, sending audio response to client`);
        const { res, timeout, isTTS, response_format } = pendingRequests.get(requestId);

        // Verify this request was actually sent to this device
        const expectedDeviceId = requestDeviceMap.get(requestId);
        if (expectedDeviceId !== deviceId) {
          console.log(`[OK] Security violation: TTS response from wrong device`);
          return;
        }

        // Clear timeout and remove from pending requests
        clearTimeout(timeout);
        pendingRequests.delete(requestId);
        requestDeviceMap.delete(requestId);
        console.log(`🗑️ Removed pending TTS request, remaining: ${pendingRequests.size}`);

        // Set appropriate headers for audio response (OpenAI TTS API compliant)
        const format = audioFormat || response_format || 'mp3';
        const contentType = format === 'mp3' ? 'audio/mpeg' :
                           format === 'wav' ? 'audio/wav' :
                           format === 'opus' ? 'audio/opus' :
                           format === 'aac' ? 'audio/aac' :
                           format === 'flac' ? 'audio/flac' :
                           format === 'pcm' ? 'audio/pcm' :
                           'audio/mpeg';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="speech.${format}"`);

        // Send the audio data (OpenAI TTS returns binary audio data)
        if (audioData) {
          try {
            // Handle different audio data formats
            if (typeof audioData === 'string') {
              // Check if it's base64 encoded (from browser)
              if (audioData.includes('-') && audioData.includes('tts-')) {
                // This is our simulated data format, create minimal valid audio
                console.log(`🎵 Sending simulated ${format} audio data`);
                // Create a minimal valid audio file header based on format
                let audioBuffer;
                if (format === 'mp3') {
                  // Minimal MP3 frame
                  audioBuffer = Buffer.from([
                    0xFF, 0xFB, 0x10, 0x00, 0x00, 0x00, 0x00, 0x00,
                    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
                  ]);
                } else if (format === 'wav') {
                  // Minimal WAV header
                  audioBuffer = Buffer.from([
                    0x52, 0x49, 0x46, 0x46, // "RIFF"
                    0x24, 0x08, 0x00, 0x00, // File size
                    0x57, 0x41, 0x56, 0x45, // "WAVE"
                    0x66, 0x6D, 0x74, 0x20, // "fmt "
                    0x10, 0x00, 0x00, 0x00, // Chunk size
                    0x01, 0x00, 0x01, 0x00, // Audio format (PCM)
                    0x80, 0x3E, 0x00, 0x00, // Sample rate (16000)
                    0x00, 0x7D, 0x00, 0x00, // Byte rate
                    0x02, 0x00, 0x10, 0x00, // Block align, bits per sample
                    0x64, 0x61, 0x74, 0x61, // "data"
                    0x00, 0x08, 0x00, 0x00  // Data size
                  ]);
                } else {
                  // Default minimal audio data
                  audioBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
                }
                res.send(audioBuffer);
              } else {
                // Assume it's base64 encoded real audio data
                const buffer = Buffer.from(audioData, 'base64');
                res.send(buffer);
              }
            } else if (Buffer.isBuffer(audioData)) {
              // Already a buffer
              res.send(audioData);
            } else {
              // Unknown format, send as-is
              res.send(audioData);
            }
            console.log(`🎵 Sent ${format} audio response`);
          } catch (error) {
            console.error(`Error processing audio data: ${error.message}`);
            res.status(500).json({
              error: {
                message: 'Error processing audio data from device',
                type: 'audio_processing_error'
              }
            });
          }
        } else {
          console.log(`[OK] No audio data received from device`);
          res.status(500).json({
            error: {
              message: 'No audio data received from device',
              type: 'no_audio_data'
            }
          });
        }
      } else {
        console.log(`[OK] No matching TTS requests found for response`);
      }
    });

    // Handle error events from R1 devices
    socket.on('error', (data) => {
      console.error(`Error from device:`, data);

      const { requestId, error, type } = data;

      // Only process errors with valid request IDs to prevent cross-contamination
      if (requestId && pendingRequests.has(requestId)) {
        // Verify this request was actually sent to this device
        const expectedDeviceId = requestDeviceMap.get(requestId);
        if (expectedDeviceId !== deviceId) {
          console.log(`[OK] Security violation: Error from wrong device`);
          return;
        }

        const { res, timeout, isTTS } = pendingRequests.get(requestId);

        // Clear timeout and remove from pending requests
        clearTimeout(timeout);
        pendingRequests.delete(requestId);
        requestDeviceMap.delete(requestId);

        // Send appropriate error response based on request type
        if (isTTS) {
          res.status(500).json({
            error: {
              message: error || 'TTS error from R1 device',
              type: 'tts_error'
            }
          });
        } else {
          // Send error response
          res.status(500).json({
            error: {
              message: error || 'Error from R1 device',
              type: 'r1_error'
            }
          });
        }
      }
    });

    socket.on('disconnect', () => {
      connectedR1s.delete(deviceId);
      console.log(`R1 device disconnected`);
      console.log(`Total connected devices: ${connectedR1s.size}`);
    });
  });
}

module.exports = { setupSocketHandler };
