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
        console.log(`🔄 Updated in-memory PIN for device ${deviceId}: ${newPin}`);
      } else {
        console.log(`⚠️ Device ${deviceId} not found in memory cache during PIN enable`);
      }

      console.log(`🔐 PIN ${deviceInfo.pin_code ? 'changed' : 'enabled'} for device: ${deviceId}`);
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
        console.log(`🔄 Cleared in-memory PIN for device ${deviceId}`);
      } else {
        console.log(`⚠️ Device ${deviceId} not found in memory cache during PIN disable`);
      }

      console.log(`🔓 PIN disabled for device: ${deviceId}`);
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
        console.log(`🔄 Updated in-memory PIN for device ${deviceId}: ${newPin}`);
      } else {
        console.log(`⚠️ Device ${deviceId} not found in memory cache during PIN change`);
      }

      console.log(`🔄 PIN changed for device: ${deviceId}`);
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

    console.log(`🧪 Manual test chat for device: ${deviceId}`);

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

    console.log(`🧪 Sending test command to ${deviceId}:`, JSON.stringify(testCommand, null, 2));
    console.log(`🧪 Socket details:`, { id: socket.id, connected: socket.connected });

    try {
      socket.emit('chat_completion', testCommand);
      console.log(`✅ Test command sent successfully to ${deviceId}`);
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
            console.log(`🔄 Synced device ${deviceId} PIN from database: ${device.pin_code ? 'set' : 'none'}`);
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

  // Diagnostic endpoint to check for duplicate device IDs
  app.get('/admin/check-duplicate-devices', async (req, res) => {
    try {
      const connectedDevices = deviceIdManager.getConnectedDevices();
      const deviceIdCounts = new Map();
      const duplicates = [];
      
      // Count occurrences of each device ID
      connectedDevices.forEach(device => {
        const count = deviceIdCounts.get(device.deviceId) || 0;
        deviceIdCounts.set(device.deviceId, count + 1);
      });
      
      // Find duplicates
      for (const [deviceId, count] of deviceIdCounts) {
        if (count > 1) {
          const devicesWithSameId = connectedDevices.filter(d => d.deviceId === deviceId);
          duplicates.push({
            deviceId,
            count,
            devices: devicesWithSameId
          });
        }
      }
      
      res.json({
        totalConnectedDevices: connectedDevices.length,
        uniqueDeviceIds: deviceIdCounts.size,
        duplicatesFound: duplicates.length,
        duplicates,
        allDevices: connectedDevices,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // EMERGENCY: Force regenerate all device IDs (security fix)
  app.post('/admin/emergency-regenerate-device-ids', async (req, res) => {
    try {
      console.log('🚨 EMERGENCY: Admin triggered device ID regeneration');
      
      const regeneratedCount = await deviceIdManager.forceRegenerateAllDeviceIds();
      
      // Notify all connected devices of their new IDs
      for (const [deviceId, socket] of connectedR1s) {
        const deviceInfo = deviceIdManager.getDeviceInfo(deviceId);
        if (deviceInfo && socket) {
          socket.emit('device_id_changed', {
            oldDeviceId: deviceInfo.regeneratedFrom || 'unknown',
            newDeviceId: deviceId,
            message: 'Your device ID has been regenerated for security reasons',
            timestamp: new Date().toISOString()
          });
        }
      }
      
      res.json({
        success: true,
        message: 'Emergency device ID regeneration completed',
        regeneratedCount,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Emergency regeneration failed:', error);
      res.status(500).json({
        error: 'Emergency regeneration failed',
        message: error.message
      });
    }
  });

  // Device status endpoint for debugging
  app.get('/:deviceId/status', async (req, res) => {
    const { deviceId } = req.params;

    const status = {
      deviceId,
      connected: deviceIdManager.hasDevice(deviceId),
      socketConnected: connectedR1s.has(deviceId),
      inMemoryInfo: deviceIdManager.getDeviceInfo(deviceId),
      timestamp: new Date().toISOString()
    };

    if (deviceIdManager.database) {
      try {
        const dbDevice = await deviceIdManager.database.getDevice(deviceId);
        status.databaseInfo = dbDevice;
        status.pinMismatch = false;

        // Check for PIN mismatch between memory and database
        const memoryDevice = deviceIdManager.getDeviceInfo(deviceId);
        if (memoryDevice && dbDevice) {
          const memoryPin = memoryDevice.pinCode;
          const dbPin = dbDevice.pin_code;
          if (memoryPin !== dbPin) {
            status.pinMismatch = true;
            status.pinMismatchDetails = {
              memory: memoryPin,
              database: dbPin
            };
            console.log(`⚠️ PIN mismatch detected for ${deviceId}: memory=${memoryPin}, db=${dbPin}`);
          }
        }
      } catch (error) {
        status.databaseError = error.message;
      }
    }

    res.json(status);
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
      const { messages, model = 'gpt-3.5-turbo', temperature = 0.7, max_tokens = 150, stream = false } = req.body;

      // Allow multiple concurrent requests - removed the busy check
      console.log(`📊 Current pending requests: ${pendingRequests.size}`);

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

      // Create message with conversation context and MCP injection
      let messageWithContext = userMessage;
      if (history.length > 1) {
        // Get only the last assistant response for context
        const lastAssistantMessage = history.slice(-2).find(msg => msg.role === 'assistant');
        if (lastAssistantMessage) {
          messageWithContext = `Previous assistant response: ${lastAssistantMessage.content}\n\nCurrent question: ${userMessage}`;
        }
      }

      // Inject MCP prompt if available
      if (mcpManager) {
        const mcpPrompt = mcpManager.generateMCPPromptInjection(targetDeviceId);
        if (mcpPrompt) {
          messageWithContext = mcpPrompt + '\n\n' + messageWithContext;
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
        // Debug device state
        console.log(`🔍 Looking for device: ${targetDeviceId}`);
        console.log(`🔍 hasDevice: ${deviceIdManager.hasDevice(targetDeviceId)}`);
        console.log(`🔍 connectedR1s has: ${connectedR1s.has(targetDeviceId)}`);
        console.log(`🔍 All connected devices: ${Array.from(connectedR1s.keys()).join(', ')}`);

        // Send to specific device
        if (deviceIdManager.hasDevice(targetDeviceId)) {
          const socket = connectedR1s.get(targetDeviceId);
          if (socket) {
            console.log(`📤 Sending to device ${targetDeviceId}:`, JSON.stringify(command, null, 2));
            console.log(`📤 Socket object:`, { id: socket.id, connected: socket.connected });

            // First, test with a simple event to verify socket works
            console.log(`🧪 Testing socket with simple event first...`);
            socket.emit('test_from_server', {
              message: 'Server test before chat_completion',
              timestamp: Date.now(),
              deviceId: targetDeviceId
            });

            // Add a small delay then emit chat_completion
            setTimeout(() => {
              console.log(`📤 Now emitting chat_completion event...`);
              socket.emit('chat_completion', command, (ack) => {
                console.log(`📤 Chat completion emit callback received:`, ack);
              });

              // Also try emitting with different event name to test
              console.log(`🧪 Also trying alternative event name...`);
              socket.emit('chat_request', command);
              socket.emit('completion_request', command);
            }, 100);

            requestDeviceMap.set(requestId, targetDeviceId);
            responsesSent++;
            console.log(`📊 Sent request ${requestId} to specific device: ${targetDeviceId}`);
          } else {
            console.log(`❌ Device ${targetDeviceId} has no socket in connectedR1s`);
          }
        } else {
          console.log(`❌ Device ${targetDeviceId} not found in deviceIdManager`);
          console.log(`🔍 DeviceIdManager device info: ${JSON.stringify(deviceIdManager.getDeviceInfo(targetDeviceId))}`);

          // Try fallback - check if device exists in connectedR1s directly
          if (connectedR1s.has(targetDeviceId)) {
            console.log(`🔄 Fallback: Found device in connectedR1s, sending anyway`);
            const socket = connectedR1s.get(targetDeviceId);
            if (socket) {
              console.log(`📤 Fallback sending to device ${targetDeviceId}:`, JSON.stringify(command, null, 2));
              console.log(`📤 Fallback socket object:`, { id: socket.id, connected: socket.connected });
              socket.emit('chat_completion', command);
              requestDeviceMap.set(requestId, targetDeviceId);
              responsesSent++;
              console.log(`📊 Fallback sent request ${requestId} to device: ${targetDeviceId}`);
            }
          } else {
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