const { sendOpenAIResponse } = require('../utils/response-utils');

function setupOpenAIRoutes(app, io, connectedR1s, conversationHistory, pendingRequests, requestDeviceMap, deviceIdManager) {
  // OpenAI-compatible API endpoints
  app.post('/v1/chat/completions', async (req, res) => {
    await handleChatCompletion(req, res, null); // null means broadcast to all devices
  });

  // Device-specific endpoints: /device-{deviceId}/v1/chat/completions
  app.post('/device-:deviceId/v1/chat/completions', async (req, res) => {
    const { deviceId } = req.params;
    await handleChatCompletion(req, res, deviceId);
  });

  // Models endpoint (OpenAI compatible)
  app.get('/v1/models', (req, res) => {
    res.json({
      object: 'list',
      data: [
        {
          id: 'r1-command',
          object: 'model',
          created: Math.floor(Date.now() / 1000),
          owned_by: 'r1-api'
        }
      ]
    });
  });

  // Device-specific models endpoint
  app.get('/device-:deviceId/v1/models', (req, res) => {
    const { deviceId } = req.params;
    res.json({
      object: 'list',
      data: [
        {
          id: `r1-command-${deviceId}`,
          object: 'model',
          created: Math.floor(Date.now() / 1000),
          owned_by: 'r1-api',
          device_id: deviceId
        }
      ]
    });
  });

  // Shared handler for chat completions
  async function handleChatCompletion(req, res, targetDeviceId) {
    try {
      const { messages, model = 'gpt-3.5-turbo', temperature = 0.7, max_tokens = 150, stream = false } = req.body;

      // Check if there are already pending requests (device can only handle one at a time)
      if (pendingRequests.size > 0) {
        console.log(`⚠️ Device is busy with ${pendingRequests.size} pending requests, rejecting new request`);
        res.status(429).json({
          error: {
            message: 'R1 device is currently processing another request. Please wait a moment and try again.',
            type: 'device_busy'
          }
        });
        return;
      }

      // Extract the latest user message
      const userMessage = messages[messages.length - 1]?.content || '';

      // Generate unique request ID
      const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Get conversation history for this "session" (using a simple approach)
      // In a real implementation, you'd use proper session management
      const sessionId = targetDeviceId || 'default'; // For now, use a single conversation per device
      const history = conversationHistory.get(sessionId) || [];

      // Add current user message to history
      history.push({
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString()
      });

      // Keep only last 10 messages to avoid context getting too long
      if (history.length > 10) {
        history.splice(0, history.length - 10);
      }

      // Update stored history
      conversationHistory.set(sessionId, history);

      // Create message with conversation context
      let messageWithContext = userMessage;
      if (history.length > 1) {
        // Get only the last assistant response for context
        const lastAssistantMessage = history.slice(-2).find(msg => msg.role === 'assistant');
        if (lastAssistantMessage) {
          messageWithContext = `Previous assistant response: ${lastAssistantMessage.content}\n\nCurrent question: ${userMessage}`;
        }
      }

      // Store the response callback with timeout
      const timeout = setTimeout(() => {
        console.log(`⏰ Request ${requestId} timed out, removing from pending requests`);
        pendingRequests.delete(requestId);
        requestDeviceMap.delete(requestId);
        console.log(`💾 Total pending requests after timeout: ${pendingRequests.size}`);
        console.log(`Request ${requestId} timed out - sending fallback response`);
        // Send a fallback response instead of error
        sendOpenAIResponse(res, 'I apologize, but the R1 device is taking longer than expected to respond. This might be due to processing a complex request or temporary connectivity issues. Please try again in a moment.', userMessage, model, stream);
      }, 60000); // 60 second timeout

      pendingRequests.set(requestId, { res, timeout, stream });
      console.log(`💾 Stored pending request: ${requestId}, total pending: ${pendingRequests.size}`);

      // Send command to R1 devices
      const command = {
        type: 'chat_completion',
        data: {
          message: messageWithContext, // Use message with conversation context
          originalMessage: userMessage, // Keep original for response
          model,
          temperature,
          max_tokens,
          requestId,
          timestamp: new Date().toISOString()
        }
      };

      console.log('Sending command to R1 devices:', JSON.stringify(command, null, 2));

      let responsesSent = 0;

      if (targetDeviceId) {
        // Send to specific device
        if (deviceIdManager.hasDevice(targetDeviceId)) {
          const socket = connectedR1s.get(targetDeviceId);
          if (socket) {
            console.log(`📤 Sending to device ${targetDeviceId}:`, JSON.stringify(command, null, 2));
            socket.emit('chat_completion', command);
            requestDeviceMap.set(requestId, targetDeviceId);
            responsesSent++;
            console.log(`📊 Sent request ${requestId} to specific device: ${targetDeviceId}`);
          } else {
            console.log(`❌ Device ${targetDeviceId} not connected`);
          }
        } else {
          console.log(`❌ Device ${targetDeviceId} not found`);
          // No devices connected or target device not found
          pendingRequests.delete(requestId);
          clearTimeout(timeout);
          res.status(503).json({
            error: {
              message: `Device ${targetDeviceId} not connected`,
              type: 'service_unavailable'
            }
          });
          return;
        }
      } else {
        // Send to the first available R1 device
        const devices = Array.from(connectedR1s.keys());
        if (devices.length === 0) {
          // No R1 devices connected
          pendingRequests.delete(requestId);
          clearTimeout(timeout);
          res.status(503).json({
            error: {
              message: 'No R1 devices connected',
              type: 'service_unavailable'
            }
          });
          return;
        }

        const deviceId = devices[0]; // Use the first device
        const socket = connectedR1s.get(deviceId);
        console.log(`📤 Sending to device ${deviceId}:`, JSON.stringify(command, null, 2));
        socket.emit('chat_completion', command);
        requestDeviceMap.set(requestId, deviceId); // Track which device gets this request
        responsesSent++;
        console.log(`📊 Sent request ${requestId} to device ${deviceId}`);
      }

      if (responsesSent === 0) {
        // This shouldn't happen with the checks above, but just in case
        pendingRequests.delete(requestId);
        clearTimeout(timeout);
        res.status(503).json({
          error: {
            message: 'No R1 devices available',
            type: 'service_unavailable'
          }
        });
      }
    } catch (error) {
      console.error('Error processing chat completion:', error);
      res.status(500).json({
        error: {
          message: 'Internal server error',
          type: 'server_error'
        }
      });
    }
  }
}

module.exports = { setupOpenAIRoutes };