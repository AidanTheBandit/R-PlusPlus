const { sendOpenAIResponse } = require('../utils/response-utils');

function setupOpenAIRoutes(app, io, connectedR1s, conversationHistory, pendingRequests, requestDeviceMap, deviceIdManager, mcpManager) {
  // Device-specific endpoints: /device-{deviceId}/v1/chat/completions (legacy format)
  app.post('/device-:deviceId/v1/chat/completions', async (req, res) => {
    const { deviceId } = req.params;
    await handleChatCompletion(req, res, deviceId);
  });

  // Device-specific endpoints: /{deviceId}/v1/chat/completions (new format)
  app.post('/:deviceId/v1/chat/completions', async (req, res) => {
    const { deviceId } = req.params;
    await handleChatCompletion(req, res, deviceId);
  });

  // Device-specific models endpoint (legacy format)
  app.get('/device-:deviceId/v1/models', async (req, res) => {
    const { deviceId } = req.params;
    await handleModelsRequest(req, res, deviceId);
  });

  // Device-specific models endpoint (new format)
  app.get('/:deviceId/v1/models', async (req, res) => {
    const { deviceId } = req.params;
    await handleModelsRequest(req, res, deviceId);
  });

  // Enable PIN for a device
  app.post('/:deviceId/enable-pin', async (req, res) => {
    const { deviceId } = req.params;
    const { newPin } = req.body;

    if (!newPin || newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      return res.status(400).json({ error: { message: 'New PIN must be exactly 6 digits', type: 'validation_error' } });
    }

    try {
      // Check if device exists
      const deviceInfo = await deviceIdManager.getDeviceInfoFromDB(deviceId);
      if (!deviceInfo) {
        return res.status(404).json({ error: { message: 'Device not found', type: 'not_found' } });
      }

      // If PIN is currently enabled, require current PIN for authentication
      if (deviceInfo.pin_code) {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ error: { message: 'Current PIN required to change PIN', type: 'auth_error' } });
        }

        const currentPin = authHeader.substring(7);
        if (currentPin !== deviceInfo.pin_code) {
          return res.status(403).json({ error: { message: 'Invalid current PIN code', type: 'auth_error' } });
        }
      }

      // Enable/update the PIN
      await deviceIdManager.database.updateDevicePin(deviceId, newPin);

      // Update in-memory state
      const deviceData = deviceIdManager.deviceIds.get(deviceId);
      if (deviceData) {
        deviceData.pinCode = newPin;
        console.log(`🔄 Updated in-memory PIN for device`);
      } else {
        console.log(`⚠️ Device not found in memory cache during PIN enable`);
      }

      console.log(`🔐 PIN ${deviceInfo.pin_code ? 'changed' : 'enabled'} for device`);
      res.json({ success: true, message: `PIN ${deviceInfo.pin_code ? 'changed' : 'enabled'} successfully` });
    } catch (error) {
      console.error('Error enabling/changing PIN:', error);
      res.status(500).json({ error: { message: 'Internal server error', type: 'server_error' } });
    }
  });

  // Disable PIN for a device
  app.post('/:deviceId/disable-pin', async (req, res) => {
    const { deviceId } = req.params;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: { message: 'Missing or invalid authorization header', type: 'auth_error' } });
    }

    const pinCode = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      // Verify the PIN matches
      const deviceInfo = await deviceIdManager.getDeviceInfoFromDB(deviceId);
      if (!deviceInfo || deviceInfo.pin_code !== pinCode) {
        return res.status(403).json({ error: { message: 'Invalid PIN code', type: 'auth_error' } });
      }

      // Disable the PIN
      await deviceIdManager.database.disableDevicePin(deviceId);

      // Update in-memory state
      const deviceData = deviceIdManager.deviceIds.get(deviceId);
      if (deviceData) {
        deviceData.pinCode = null;
        console.log(`🔄 Cleared in-memory PIN for device`);
      } else {
        console.log(`⚠️ Device not found in memory cache during PIN disable`);
      }

      console.log(`🔓 PIN disabled for device`);
      res.json({ success: true, message: 'PIN disabled successfully' });
    } catch (error) {
      console.error('Error disabling PIN:', error);
      res.status(500).json({ error: { message: 'Internal server error', type: 'server_error' } });
    }
  });

  // Change PIN for a device
  app.post('/:deviceId/change-pin', async (req, res) => {
    const { deviceId } = req.params;
    const { currentPin, newPin } = req.body;

    if (!currentPin || !newPin) {
      return res.status(400).json({ error: { message: 'Both current and new PIN required', type: 'validation_error' } });
    }

    if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      return res.status(400).json({ error: { message: 'New PIN must be exactly 6 digits', type: 'validation_error' } });
    }

    try {
      // Verify current PIN
      const deviceInfo = await deviceIdManager.getDeviceInfoFromDB(deviceId);
      if (!deviceInfo || deviceInfo.pin_code !== currentPin) {
        return res.status(403).json({ error: { message: 'Invalid current PIN code', type: 'auth_error' } });
      }

      // Update the PIN
      await deviceIdManager.database.updateDevicePin(deviceId, newPin);

      // Update in-memory state
      const deviceData = deviceIdManager.deviceIds.get(deviceId);
      if (deviceData) {
        deviceData.pinCode = newPin;
        console.log(`🔄 Updated in-memory PIN for device`);
      } else {
        console.log(`⚠️ Device not found in memory cache during PIN change`);
      }

      console.log(`🔄 PIN changed for device`);
      res.json({ success: true, message: 'PIN changed successfully' });
    } catch (error) {
      console.error('Error changing PIN:', error);
      res.status(500).json({ error: { message: 'Internal server error', type: 'server_error' } });
    }
  });

  // Get device info
  app.get('/:deviceId/info', async (req, res) => {
    const { deviceId } = req.params;

    if (deviceIdManager.database) {
      try {
        const device = await deviceIdManager.database.getDevice(deviceId);
        if (device) {
          res.json({
            deviceId: device.device_id,
            pinCode: device.pin_code,
            pinEnabled: device.pin_code !== null && device.pin_code !== '',
            createdAt: device.created_at,
            lastSeen: device.last_seen
          });
        } else {
          res.status(404).json({ error: 'Device not found' });
        }
      } catch (error) {
        console.warn('Failed to get device info:', error);
        res.status(500).json({ error: 'Failed to get device info' });
      }
    } else {
      res.status(500).json({ error: 'Database not available' });
    }
  });

  // Test endpoint to manually send chat completion to device
  app.post('/:deviceId/test-chat', async (req, res) => {
    const { deviceId } = req.params;
    const { message = 'Test message from server' } = req.body;

    console.log(`🧪 Manual test chat for device`);

    // Check if device is connected
    if (!deviceIdManager.hasDevice(deviceId)) {
      return res.status(404).json({ error: 'Device not connected in deviceIdManager' });
    }

    if (!connectedR1s.has(deviceId)) {
      return res.status(404).json({ error: 'Device not connected in connectedR1s' });
    }

    const socket = connectedR1s.get(deviceId);
    if (!socket) {
      return res.status(404).json({ error: 'No socket found for device' });
    }

    const testCommand = {
      type: 'chat_completion',
      data: {
        message,
        originalMessage: message,
        model: 'r1-test',
        requestId: `test-${Date.now()}`,
        timestamp: new Date().toISOString()
      }
    };

    console.log(`🧪 Sending test command:`, JSON.stringify(testCommand, null, 2));
    console.log(`🧪 Socket details:`, { id: socket.id, connected: socket.connected });

    try {
      socket.emit('chat_completion', testCommand);
      console.log(`✅ Test command sent successfully`);
      res.json({
        success: true,
        message: 'Test chat completion sent',
        deviceId,
        socketId: socket.id,
        command: testCommand
      });
    } catch (error) {
      console.error(`❌ Error sending test command:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Device sync endpoint to resolve PIN mismatches
  app.post('/:deviceId/sync', async (req, res) => {
    const { deviceId } = req.params;

    if (deviceIdManager.database) {
      try {
        const device = await deviceIdManager.database.getDevice(deviceId);
        if (device) {
          // Update the in-memory device manager with database info
          const deviceData = deviceIdManager.deviceIds.get(deviceId);
          if (deviceData) {
            deviceData.pinCode = device.pin_code;
            console.log(`🔄 Synced device PIN from database: ${device.pin_code ? 'set' : 'none'}`);
          }

          res.json({
            deviceId: device.device_id,
            pinCode: device.pin_code,
            pinEnabled: device.pin_code !== null && device.pin_code !== '',
            synced: true,
            timestamp: new Date().toISOString()
          });
        } else {
          res.status(404).json({ error: 'Device not found' });
        }
      } catch (error) {
        console.warn('Failed to sync device info:', error);
        res.status(500).json({ error: 'Failed to sync device info' });
      }
    } else {
      res.status(500).json({ error: 'Database not available' });
    }
  });



  // Authentication helper function
  async function authenticateDevice(deviceId, authHeader) {
    // Check if device exists and get PIN status
    const deviceInfo = await deviceIdManager.getDeviceInfoFromDB(deviceId);
    if (!deviceInfo) {
      return { authenticated: false, error: 'Device not found' };
    }

    // If PIN is disabled (null or empty), allow access without authentication
    if (!deviceInfo.pin_code) {
      return { authenticated: true };
    }

    // PIN is enabled, require authentication
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { authenticated: false, error: 'PIN code required. Use Authorization: Bearer <pin-code>' };
    }

    const providedPin = authHeader.substring(7); // Remove 'Bearer '

    if (deviceInfo.pin_code !== providedPin) {
      return { authenticated: false, error: 'Invalid PIN code' };
    }

    return { authenticated: true };
  }

  // Models handler
  async function handleModelsRequest(req, res, deviceId) {
    // Check authentication
    const authResult = await authenticateDevice(deviceId, req.headers.authorization);
    if (!authResult.authenticated) {
      return res.status(401).json({
        error: {
          message: authResult.error,
          type: 'authentication_failed'
        }
      });
    }

    res.json({
      object: 'list',
      data: [
        {
          id: 'r1-command',
          object: 'model',
          created: Math.floor(Date.now() / 1000),
          owned_by: 'rabbit-r1'
        }
      ]
    });
  }

  // Shared handler for chat completions
  async function handleChatCompletion(req, res, targetDeviceId) {
    // Check authentication
    const authResult = await authenticateDevice(targetDeviceId, req.headers.authorization);
    if (!authResult.authenticated) {
      return res.status(401).json({
        error: {
          message: authResult.error,
          type: 'authentication_failed'
        }
      });
    }

    try {
      // Debug: Check if req.body exists
      if (!req.body) {
        console.error('req.body is undefined in handleChatCompletion');
        console.error('req.headers:', req.headers);
        console.error('req.method:', req.method);
        console.error('req.url:', req.url);
        return res.status(400).json({
          error: {
            message: 'Request body is required',
            type: 'validation_error'
          }
        });
      }

      const { messages, model = 'gpt-3.5-turbo', temperature = 0.7, max_tokens = 150, stream = false } = req.body;

      // Check if target device already has a pending request
      const existingRequests = Array.from(requestDeviceMap.entries())
        .filter(([_, deviceId]) => deviceId === targetDeviceId);

      if (existingRequests.length > 0) {
        console.log(`❌ Device ${targetDeviceId} already has ${existingRequests.length} pending request(s)`);
        return res.status(429).json({
          error: {
            message: 'Device is currently processing another request. Please wait for it to complete.',
            type: 'device_busy'
          }
        });
      }

      console.log(`📊 Current pending requests: ${pendingRequests.size}`);

      // Extract the latest user message
      const userMessage = messages[messages.length - 1]?.content || '';

      // Generate unique request ID
      const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Build proper conversation history in OpenAI format
      const conversationMessages = [];

      // Add system message with MCP tools and instructions
      if (mcpManager) {
        const mcpPrompt = mcpManager.generateMCPPromptInjection(targetDeviceId);
        if (mcpPrompt) {
          conversationMessages.push({
            role: 'system',
            content: mcpPrompt
          });
        }
      }

      // Add conversation history (excluding system messages)
      const sessionId = targetDeviceId || 'default';
      const history = conversationHistory.get(sessionId) || [];

      // Add previous conversation turns (last 10 exchanges to stay within context limits)
      const recentHistory = history.slice(-20); // Keep last 20 messages (10 exchanges)
      conversationMessages.push(...recentHistory);

      // Add current user message
      conversationMessages.push({
        role: 'user',
        content: userMessage
      });

      // Update stored history with user message
      history.push({
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString()
      });

      // Keep only last 20 messages in storage
      if (history.length > 20) {
        history.splice(0, history.length - 20);
      }
      conversationHistory.set(sessionId, history);

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

      // Create message text from conversation
      let messageText = userMessage;
      let systemPrompt = '';

      // Get MCP system prompt
      if (mcpManager) {
        systemPrompt = mcpManager.generateMCPPromptInjection(targetDeviceId) || '';
        console.log(`🔧 MCP prompt for device ${targetDeviceId}: ${systemPrompt.length} characters`);
        if (systemPrompt.length > 0) {
          console.log(`🔧 MCP prompt preview: ${systemPrompt.substring(0, 100)}...`);
        }
      }

      // Format message with system prompt if available
      if (systemPrompt) {
        messageText = `${systemPrompt}\n\n${userMessage}`;
      }

      // For conversation context, include recent history
      if (conversationMessages.length > 1) {
        const recentMessages = conversationMessages.slice(-6); // Last 3 exchanges
        const contextText = recentMessages
          .filter(msg => msg.role !== 'system') // Exclude system messages from context
          .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
          .join('\n\n');

        if (contextText) {
          messageText = `${systemPrompt ? systemPrompt + '\n\n' : ''}Previous conversation:\n${contextText}\n\nCurrent: ${userMessage}`;
        }
      }

      // Send command to R1 devices
      const command = {
        type: 'chat_completion',
        data: {
          message: messageText, // Formatted message for R1
          messages: conversationMessages, // Full conversation for context
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
        // Debug device state (without exposing device IDs)
        console.log(`🔍 Looking for target device`);
        console.log(`🔍 hasDevice: ${deviceIdManager.hasDevice(targetDeviceId)}`);
        console.log(`🔍 connectedR1s has: ${connectedR1s.has(targetDeviceId)}`);
        console.log(`🔍 Total connected devices: ${connectedR1s.size}`);

        // Send to specific device
        if (deviceIdManager.hasDevice(targetDeviceId)) {
          const socket = connectedR1s.get(targetDeviceId);
          if (socket) {
            console.log(`📤 Sending to device:`, JSON.stringify(command, null, 2));
            console.log(`📤 Socket object:`, { id: socket.id, connected: socket.connected });

            // Send chat completion to device
            socket.emit('chat_completion', command);

            requestDeviceMap.set(requestId, targetDeviceId);
            responsesSent++;
            console.log(`📊 Sent request ${requestId} to specific device`);
          } else {
            console.log(`❌ Device has no socket in connectedR1s`);
          }
        } else {
          console.log(`❌ Device not found in deviceIdManager`);
          console.log(`🔍 DeviceIdManager device info available: ${!!deviceIdManager.getDeviceInfo(targetDeviceId)}`);

          // Try fallback - check if device exists in connectedR1s directly
          if (connectedR1s.has(targetDeviceId)) {
            console.log(`🔄 Fallback: Found device in connectedR1s, sending anyway`);
            const socket = connectedR1s.get(targetDeviceId);
            if (socket) {
              console.log(`📤 Fallback sending to device:`, JSON.stringify(command, null, 2));
              console.log(`📤 Fallback socket object:`, { id: socket.id, connected: socket.connected });
              socket.emit('chat_completion', command);
              requestDeviceMap.set(requestId, targetDeviceId);
              responsesSent++;
              console.log(`📊 Fallback sent request ${requestId} to device`);
            }
          } else {
            // No devices connected or target device not found
            pendingRequests.delete(requestId);
            clearTimeout(timeout);
            res.status(503).json({
              error: {
                message: `Device not connected`,
                type: 'service_unavailable'
              }
            });
            return;
          }
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
        console.log(`📤 Sending to first available device:`, JSON.stringify(command, null, 2));
        socket.emit('chat_completion', command);
        requestDeviceMap.set(requestId, deviceId); // Track which device gets this request
        responsesSent++;
        console.log(`📊 Sent request ${requestId} to first available device`);
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