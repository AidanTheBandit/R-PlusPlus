const { sendOpenAIResponse } = require('../utils/response-utils');
const { DeviceIdManager } = require('../utils/device-id-manager');

function setupSocketHandler(io, connectedR1s, conversationHistory, pendingRequests, requestDeviceMap, debugStreams, deviceLogs, debugDataStore, performanceMetrics, deviceIdManager = null, mcpManager = null) {
  // Initialize device ID manager if not provided
  if (!deviceIdManager) {
    deviceIdManager = new DeviceIdManager();
  }

  // Get PIN configuration from environment
  const enablePin = process.env.DISABLE_PIN !== 'true'; // Default to enabled, disable if DISABLE_PIN=true

  // Socket.IO connection handling
  io.on('connection', async (socket) => {
    // Get client info for device identification
    const userAgent = socket.handshake.headers['user-agent'];
    const ipAddress = socket.handshake.address || socket.request.connection.remoteAddress;
    
    // Extract device secret from cookie
    const cookies = socket.handshake.headers.cookie;
    let deviceSecret = null;
    if (cookies) {
      const cookieMatch = cookies.match(/r1_device_secret=([^;]+)/);
      if (cookieMatch) {
        deviceSecret = decodeURIComponent(cookieMatch[1]);
      }
    }

    // Get or create persistent device ID
    console.log(`🔌 New socket connection: ${socket.id}`);
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
      connectedR1s.delete(deviceId);
      deviceIdManager.unregisterDevice(socket.id);

      // Shutdown MCP servers for this device
      if (mcpManager) {
        mcpManager.shutdownDeviceServers(deviceId).catch(error => {
          console.error(`Error shutting down MCP servers:`, error);
        });
      }

      console.log(`Total connected devices after disconnect: ${connectedR1s.size}`);
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

    // MCP-specific event handlers
    socket.on('mcp_tool_call', async (data) => {
      console.log(`MCP tool call received`);
      
      if (mcpManager) {
        try {
          const { serverName, toolName, arguments: toolArgs, requestId } = data;
          
          // Handle the tool call using the new prompt injection system
          const result = await mcpManager.handleToolCall(deviceId, serverName, toolName, toolArgs || {});
          
          // Send result back to the R1 device
          socket.emit('mcp_tool_result', {
            requestId: requestId || mcpManager.generateId(),
            serverName,
            toolName,
            result,
            success: true,
            timestamp: new Date().toISOString()
          });
          
          // Don't broadcast MCP events to prevent device ID leakage
        } catch (error) {
          console.error(`Error handling MCP tool call:`, error);
          
          // Send error back to the R1 device
          socket.emit('mcp_tool_result', {
            requestId: data.requestId || mcpManager.generateId(),
            serverName: data.serverName,
            toolName: data.toolName,
            error: error.message,
            success: false,
            timestamp: new Date().toISOString()
          });
          
          socket.emit('mcp_error', {
            error: error.message,
            serverName: data.serverName,
            toolName: data.toolName
          });
        }
      }
    });

    socket.on('mcp_server_status', (data) => {
      console.log(`MCP server status received`);
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

    // Handle test messages for debugging
    socket.on('test_message', (data) => {
      console.log(`🧪 Test message received`);
      // Send test event back to verify bidirectional communication
      socket.emit('test_event', {
        message: 'Test response from server',
        timestamp: new Date().toISOString()
      });
    });

    socket.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        console.log(`Message from ${deviceId}:`, message);

        // Handle different message types from R1
        switch (message.type) {
          case 'status':
            console.log(`R1 ${deviceId} status:`, message.data);
            break;
          case 'response':
            console.log(`R1 ${deviceId} response:`, message.data);
            break;
          case 'error':
            console.error(`R1 ${deviceId} error:`, message.data);
            break;
          default:
            console.log(`Unknown message type from ${deviceId}:`, message);
        }
      } catch (error) {
        console.error(`Error parsing message from ${deviceId}:`, error);
      }
    });

    // Handle response events from R1 devices
    socket.on('response', (data) => {
      console.log(`🔄 Socket Response received`);

      const { requestId, response, originalMessage, model, timestamp } = data;

      console.log(`Looking for pending request: ${requestId}`);

      // Only process responses with valid request IDs to prevent cross-contamination
      if (requestId && pendingRequests.has(requestId)) {
        console.log(`✅ Found matching request, sending response to client`);
        const { res, timeout, stream } = pendingRequests.get(requestId);

        // Verify this request was actually sent to this device
        const expectedDeviceId = requestDeviceMap.get(requestId);
        if (expectedDeviceId !== deviceId) {
          console.log(`❌ Security violation: Response from wrong device`);
          return;
        }

        // Clear timeout and remove from pending requests
        clearTimeout(timeout);
        pendingRequests.delete(requestId);
        requestDeviceMap.delete(requestId);
        console.log(`🗑️ Removed pending request, remaining: ${pendingRequests.size}`);

        sendOpenAIResponse(res, response, originalMessage, model, stream);
      }
      else {
        console.log(`❌ No matching requests found for response`);
      }
    });

    // Handle error events from R1 devices
    socket.on('error', (data) => {
      console.error(`Error from device:`, data);

      const { requestId, error } = data;

      // Only process errors with valid request IDs to prevent cross-contamination
      if (requestId && pendingRequests.has(requestId)) {
        // Verify this request was actually sent to this device
        const expectedDeviceId = requestDeviceMap.get(requestId);
        if (expectedDeviceId !== deviceId) {
          console.log(`❌ Security violation: Error from wrong device`);
          return;
        }

        const { res, timeout } = pendingRequests.get(requestId);

        // Clear timeout and remove from pending requests
        clearTimeout(timeout);
        pendingRequests.delete(requestId);
        requestDeviceMap.delete(requestId);

        // Send error response
        res.status(500).json({
          error: {
            message: error || 'Error from R1 device',
            type: 'r1_error'
          }
        });
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
