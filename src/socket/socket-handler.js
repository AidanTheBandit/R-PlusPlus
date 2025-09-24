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

    // Get or create persistent device ID
    console.log(`🔌 New socket connection: ${socket.id}, userAgent: ${userAgent?.substring(0, 50)}..., ipAddress: ${ipAddress}`);
    const { deviceId, pinCode } = await deviceIdManager.registerDevice(socket.id, null, userAgent, ipAddress, enablePin);
    connectedR1s.set(deviceId, socket);

    console.log(`R1 device connected: ${deviceId}`);
    console.log(`Total connected devices: ${connectedR1s.size}`);

    // Broadcast device connection to all clients
    socket.broadcast.emit('device_connected', {
      deviceId: deviceId,
      userAgent: socket.handshake.headers['user-agent'],
      connectedAt: new Date().toISOString()
    });

    // Send welcome message with device ID and PIN code
    socket.emit('connected', {
      deviceId: deviceId,
      pinCode: pinCode,
      pinEnabled: pinCode !== null,
      message: 'Connected to R-API server'
    });
    
    // Add debugging to track what events we're sending to this device
    const originalEmit = socket.emit;
    socket.emit = function(eventName, ...args) {
      console.log(`📤 EMIT to ${deviceId}: ${eventName}`, args.length > 0 ? JSON.stringify(args[0]).substring(0, 100) + '...' : '');
      return originalEmit.apply(this, [eventName, ...args]);
    };

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`R1 device disconnected: ${deviceId}, socket: ${socket.id}`);
      connectedR1s.delete(deviceId);
      deviceIdManager.unregisterDevice(socket.id);

      // Shutdown MCP servers for this device
      if (mcpManager) {
        mcpManager.shutdownDeviceServers(deviceId).catch(error => {
          console.error(`Error shutting down MCP servers for ${deviceId}:`, error);
        });
      }

      // Broadcast device disconnection to all clients
      socket.broadcast.emit('device_disconnected', {
        deviceId: deviceId,
        disconnectedAt: new Date().toISOString()
      });

      console.log(`Total connected devices after disconnect: ${connectedR1s.size}`);
    });

    // Debug data streaming handlers
    socket.on('hardware_event', (data) => {
      console.log(`Hardware event from ${deviceId}:`, data);
      // Broadcast to all connected clients (including web clients)
      socket.broadcast.emit('debug_data', {
        type: 'hardware',
        deviceId: data.deviceId,
        data: data.event,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('camera_event', (data) => {
      console.log(`Camera event from ${deviceId}:`, data);
      socket.broadcast.emit('debug_data', {
        type: 'camera',
        deviceId: data.deviceId,
        data: data.event,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('llm_event', (data) => {
      console.log(`LLM event from ${deviceId}:`, data);
      socket.broadcast.emit('debug_data', {
        type: 'llm',
        deviceId: data.deviceId,
        data: data.event,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('storage_event', (data) => {
      console.log(`Storage event from ${deviceId}:`, data);
      socket.broadcast.emit('debug_data', {
        type: 'storage',
        deviceId: data.deviceId,
        data: data.event,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('audio_event', (data) => {
      console.log(`Audio event from ${deviceId}:`, data);
      socket.broadcast.emit('debug_data', {
        type: 'audio',
        deviceId: data.deviceId,
        data: data.event,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('performance_event', (data) => {
      console.log(`Performance event from ${deviceId}:`, data);
      socket.broadcast.emit('debug_data', {
        type: 'performance',
        deviceId: data.deviceId,
        data: data.event,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('device_event', (data) => {
      console.log(`Device event from ${deviceId}:`, data);
      socket.broadcast.emit('debug_data', {
        type: 'device',
        deviceId: data.deviceId,
        data: data.event,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('client_log', (data) => {
      console.log(`Client log from ${deviceId}:`, data);
      socket.broadcast.emit('debug_data', {
        type: 'logs',
        deviceId: data.deviceId,
        data: data.log,
        timestamp: new Date().toISOString()
      });
    });

    // MCP-specific event handlers
    socket.on('mcp_tool_call', async (data) => {
      console.log(`MCP tool call from ${deviceId}:`, data);
      
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
          
          // Broadcast tool call event
          socket.broadcast.emit('mcp_event', {
            type: 'tool_call',
            deviceId,
            serverName,
            toolName,
            result,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          console.error(`Error handling MCP tool call from ${deviceId}:`, error);
          
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
      console.log(`MCP server status from ${deviceId}:`, data);
      socket.broadcast.emit('mcp_event', {
        type: 'server_status',
        deviceId,
        data,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('system_info', (data) => {
      console.log(`System info from ${deviceId}:`, data);
      // Store system info for analytics
      if (!global.systemInfo) global.systemInfo = {};
      global.systemInfo[deviceId] = {
        ...data.systemInfo,
        lastUpdated: new Date().toISOString()
      };
    });

    // Handle ping/heartbeat from client
    socket.on('ping', (data) => {
      console.log(`🏓 Ping from ${deviceId}:`, data);
      // Respond with pong to keep connection alive
      socket.emit('pong', {
        timestamp: Date.now(),
        deviceId,
        serverTime: new Date().toISOString()
      });
      
      // Since ping/pong works, let's test if we can send other events
      console.log(`🧪 Ping received, testing if we can send test events to ${deviceId}...`);
      socket.emit('debug_test', {
        message: 'Debug test from server after ping',
        timestamp: Date.now(),
        deviceId
      });
    });

    // Handle test messages for debugging
    socket.on('test_message', (data) => {
      console.log(`🧪 Test message from ${deviceId}:`, data);
      // Send test event back to verify bidirectional communication
      socket.emit('test_event', {
        message: 'Test response from server',
        originalData: data,
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
      console.log(`🔄 Socket Response from ${deviceId}:`, JSON.stringify(data, null, 2));

      const { requestId, response, originalMessage, model, timestamp } = data;

      console.log(`Looking for pending request: ${requestId}`);
      console.log(`Pending requests:`, Array.from(pendingRequests.keys()));

      // If we have a requestId and it matches, use it
      if (requestId && pendingRequests.has(requestId)) {
        console.log(`✅ Found matching request ${requestId}, sending response to client`);
        const { res, timeout, stream } = pendingRequests.get(requestId);

        // Clear timeout and remove from pending requests
        clearTimeout(timeout);
        pendingRequests.delete(requestId);
        requestDeviceMap.delete(requestId);
        console.log(`🗑️ Removed pending request: ${requestId}, remaining: ${pendingRequests.size}`);

        sendOpenAIResponse(res, response, originalMessage, model, stream);
      }
      // If requestId is null/undefined but we have pending requests, try to match by device
      else if (!requestId && pendingRequests.size > 0) {
        console.log(`⚠️ No requestId provided, trying to match by device ${deviceId}`);

        // Find requests that were sent to this device
        const deviceRequests = Array.from(requestDeviceMap.entries())
          .filter(([reqId, devId]) => devId === deviceId)
          .map(([reqId]) => reqId);

        if (deviceRequests.length > 0) {
          const matchingRequestId = deviceRequests[0]; // Use the first one
          console.log(`✅ Matched request ${matchingRequestId} by device ${deviceId}`);

          const { res, timeout, stream } = pendingRequests.get(matchingRequestId);

          // Clear timeout and remove from pending requests
          clearTimeout(timeout);
          pendingRequests.delete(matchingRequestId);
          requestDeviceMap.delete(matchingRequestId);
          console.log(`🗑️ Removed pending request: ${matchingRequestId}, remaining: ${pendingRequests.size}`);

          sendOpenAIResponse(res, response, originalMessage, model, stream);
        } else {
          console.log(`❌ No requests found for device ${deviceId}`);
        }
      }
      // If no requestId or it doesn't match, but we have pending requests, use the first one (fallback)
      else if (pendingRequests.size > 0) {
        console.log(`⚠️ No matching requestId, using first pending request as fallback`);
        const [firstRequestId, { res, timeout, stream }] = pendingRequests.entries().next().value;

        // Clear timeout and remove from pending requests
        clearTimeout(timeout);
        pendingRequests.delete(firstRequestId);
        requestDeviceMap.delete(firstRequestId);
        console.log(`🗑️ Removed pending request (fallback): ${firstRequestId}, remaining: ${pendingRequests.size}`);

        sendOpenAIResponse(res, response, originalMessage, model, stream);
      } else {
        console.log(`❌ No pending requests found for response from ${deviceId}`);
      }
    });

    // Handle error events from R1 devices
    socket.on('error', (data) => {
      console.error(`Error from ${deviceId}:`, data);

      const { requestId, error } = data;

      if (requestId && pendingRequests.has(requestId)) {
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
      // If no requestId, try to match by device
      else if (!requestId && pendingRequests.size > 0) {
        const deviceRequests = Array.from(requestDeviceMap.entries())
          .filter(([reqId, devId]) => devId === deviceId)
          .map(([reqId]) => reqId);

        if (deviceRequests.length > 0) {
          const matchingRequestId = deviceRequests[0];
          console.log(`✅ Matched error for request ${matchingRequestId} by device ${deviceId}`);

          const { res, timeout } = pendingRequests.get(matchingRequestId);

          // Clear timeout and remove from pending requests
          clearTimeout(timeout);
          pendingRequests.delete(matchingRequestId);
          requestDeviceMap.delete(matchingRequestId);

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
      console.log(`R1 device disconnected: ${deviceId}`);
      console.log(`Total connected devices: ${connectedR1s.size}`);
    });
  });
}

module.exports = { setupSocketHandler };
