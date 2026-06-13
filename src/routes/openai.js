const { sendOpenAIResponse } = require('../utils/response-utils');
const { processWithGroq } = require('../utils/groq-handler');
// Using built-in fetch (Node.js 18+)

function setupOpenAIRoutes(app, io, connectedR1s, pendingRequests, requestDeviceMap, deviceIdManager, mcpManager) {
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

      const { messages, model = 'gpt-3.5-turbo', temperature = 0.7, max_tokens = 150, stream = false, response_format } = req.body;

      // Check if target device already has a pending TEXT request
      const existingTextRequests = Array.from(requestDeviceMap.entries())
        .filter(([_, deviceId]) => deviceId === targetDeviceId)
        .filter(([requestId]) => {
          const request = pendingRequests.get(requestId);
          return request && !request.isTTS; // Only count non-TTS requests
        });

      if (existingTextRequests.length > 0) {
        console.log(`❌ Device ${targetDeviceId} already has ${existingTextRequests.length} pending text request(s)`);
        return res.status(429).json({
          error: {
            message: 'Device is currently processing another text request. Please wait for it to complete.',
            type: 'device_busy_text'
          }
        });
      }

      console.log(`📊 Current pending requests: ${pendingRequests.size}`);

      // Extract the latest user message and check for images
      const userMessage = messages[messages.length - 1]?.content || '';
      let imageBase64 = null;
      let pluginId = null;

      // Check if the message contains image data (R1 Create SDK format)
      if (messages[messages.length - 1]?.imageBase64) {
        imageBase64 = messages[messages.length - 1].imageBase64;
        console.log(`📸 Image base64 data detected in message (${imageBase64.length} chars)`);
      }

      // Check if the message contains an image URL that needs to be converted to base64
      if (!imageBase64 && messages[messages.length - 1]?.imageUrl) {
        const imageUrl = messages[messages.length - 1].imageUrl;
        console.log(`🌐 Image URL detected, converting to base64: ${imageUrl}`);

        try {
          // Fetch the image from the URL
          const response = await fetch(imageUrl);

          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
          }

          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.startsWith('image/')) {
            throw new Error(`URL does not point to a valid image: ${contentType}`);
          }

          const imageBuffer = await response.buffer();
          imageBase64 = imageBuffer.toString('base64');
          console.log(`✅ Successfully converted image URL to base64 (${imageBase64.length} chars)`);
        } catch (error) {
          console.error(`❌ Failed to convert image URL to base64:`, error.message);
          // Continue without image data rather than failing the request
          console.log(`⚠️ Continuing request without image data`);
        }
      }

      // Check for plugin ID
      if (messages[messages.length - 1]?.pluginId) {
        pluginId = messages[messages.length - 1].pluginId;
        console.log(`🔌 Plugin ID detected: ${pluginId}`);
      }

      // Generate unique request ID
      const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Check if this is a test request (skip timeouts)
      const isTestRequest = req.headers['x-test-request'] === 'true';

      let timeout;
      if (!isTestRequest) {
        // Set up timeout for request
        timeout = setTimeout(() => {
          console.log(`⏰ Request ${requestId} timed out after 30 seconds`);
          pendingRequests.delete(requestId);
          requestDeviceMap.delete(requestId);
          res.status(504).json({
            error: {
              message: 'Request timeout - R1 device did not respond within 30 seconds',
              type: 'timeout'
            }
          });
        }, 30000);
      }

      // Store the request for response handling
      pendingRequests.set(requestId, { res, timeout, stream, response_format });

      // Initialize MCP request detection variables
      let isMCPRequest = false;
      let mcpToolCall = null;

      // Check if this is an MCP tool request that should be handled server-side
      if (mcpManager) {
        // Get available tools for this device
        const tools = await mcpManager.getDeviceTools(targetDeviceId);

        // Analyze user message to detect MCP tool requests
        const lowerMessage = userMessage.toLowerCase();

        // Check for explicit MCP requests
        if (lowerMessage.includes('mcp') || lowerMessage.includes('use tool') || lowerMessage.includes('using mcp')) {
          // Try to match the request to available tools
          for (const tool of tools) {
            if (tool.serverName === 'deepwiki') {
              // Handle deepwiki requests - look for repository references
              const repoPatterns = [
                /([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)/, // owner/repo format
                /(?:see|check|browse|explore)\s+(?:the\s+)?(?:repo|repository|github)?\s*([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)/i,
                /([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)\s+(?:using|with)\s+mcp/i
              ];

              for (const pattern of repoPatterns) {
                const repoMatch = userMessage.match(pattern);
                if (repoMatch) {
                  let repoName = repoMatch[1];

                  // Handle common repository shortcuts
                  if (repoName.toLowerCase() === 'vscode') {
                    repoName = 'microsoft/vscode';
                  } else if (repoName.toLowerCase() === 'react') {
                    repoName = 'facebook/react';
                  }

                  isMCPRequest = true;
                  mcpToolCall = {
                    server: tool.serverName,
                    tool: tool.name,
                    arguments: { repoName }
                  };
                  console.log(`🔧 Detected MCP request for repository ${repoName}, will execute ${tool.name} tool`);
                  break;
                }
              }

              if (isMCPRequest) break;
            }
          }

          // Special handling for deepwiki mentions
          if (!isMCPRequest && lowerMessage.includes('deepwiki')) {
            const deepwikiTool = tools.find(t => t.serverName === 'deepwiki' && t.name === 'read_wiki_structure');
            if (deepwikiTool) {
              let repoName = 'microsoft/vscode'; // default fallback

              // Try to extract repo name from the message
              const repoMatch = userMessage.match(/for\s+(\w+)/i);
              if (repoMatch) {
                const repoPart = repoMatch[1].toLowerCase();
                if (repoPart === 'vscode') {
                  repoName = 'microsoft/vscode';
                } else if (repoPart === 'react') {
                  repoName = 'facebook/react';
                } else {
                  repoName = `microsoft/${repoPart}`; // assume microsoft org
                }
              }

              isMCPRequest = true;
              mcpToolCall = {
                server: deepwikiTool.serverName,
                tool: deepwikiTool.name,
                arguments: { repoName }
              };
              console.log(`🔧 Detected deepwiki mention, will execute ${deepwikiTool.name} tool for ${repoName}`);
            }
          }
        }

        // Also check for implicit tool requests (e.g., "what's the weather in NYC")
        if (!isMCPRequest) {
          // Example: weather tool matching
          const weatherMatch = lowerMessage.match(/(?:weather|temperature|forecast).*(?:in|for|at)\s+([a-zA-Z\s,]+)/i);
          if (weatherMatch) {
            const location = weatherMatch[1].trim();
            const weatherTool = tools.find(t => t.name.includes('weather') || t.name.includes('get_weather'));
            if (weatherTool) {
              isMCPRequest = true;
              mcpToolCall = {
                server: weatherTool.serverName,
                tool: weatherTool.name,
                arguments: { location, units: 'celsius' }
              };
              console.log(`🔧 Detected weather request for ${location}, will execute ${weatherTool.name} tool`);
            }
          }

          // Example: calculator tool matching
          const calcMatch = lowerMessage.match(/(?:calculate|compute|what is|what's)\s+(.+)/i);
          if (calcMatch) {
            const expression = calcMatch[1].trim();
            const calcTool = tools.find(t => t.name.includes('calculate') || t.name.includes('calculator'));
            if (calcTool) {
              isMCPRequest = true;
              mcpToolCall = {
                server: calcTool.serverName,
                tool: calcTool.name,
                arguments: { expression }
              };
              console.log(`🔧 Detected calculation request: ${expression}, will execute ${calcTool.name} tool`);
            }
          }
        }
      }

      // Build conversation context from messages array
      let conversationContext = '';
      if (messages.length > 1) {
        // Convert messages to a readable conversation format
        const historyMessages = messages.slice(0, -1); // Exclude the current user message
        conversationContext = '## CONVERSATION HISTORY\n\n';
        for (const msg of historyMessages) {
          if (msg.role === 'user') {
            conversationContext += `User: ${msg.content}\n\n`;
          } else if (msg.role === 'assistant') {
            conversationContext += `Assistant: ${msg.content}\n\n`;
          }
        }
        conversationContext += '## CURRENT MESSAGE\n\n';
      }

      // Get MCP system prompt for injection
      let mcpPrompt = '';
      if (mcpManager) {
        mcpPrompt = await mcpManager.generateMCPPromptInjection(targetDeviceId) || '';
      }

      // Combine context, MCP prompt, and current message
      let messageText = userMessage;
      if (conversationContext || mcpPrompt) {
        messageText = `${conversationContext}${mcpPrompt}User: ${userMessage}`;
      }

      // For json_object format, add instruction to return only JSON (but not for MCP requests)
      let processedMessage = messageText;
      if (response_format && response_format.type === 'json_object' && !isMCPRequest) {
        // Add explicit instruction to return only JSON
        processedMessage = `${messageText}\n\nIMPORTANT: Respond with ONLY a valid JSON object. Do not include any other text, markdown, or explanation.`;
      }

      // For MCP requests, execute the tool server-side first
      if (isMCPRequest && mcpToolCall) {
        try {
          console.log(`🔧 Executing MCP tool server-side: ${mcpToolCall.server}.${mcpToolCall.tool}`);
          const toolResult = await mcpManager.handleToolCall(targetDeviceId, mcpToolCall.server, mcpToolCall.tool, mcpToolCall.arguments);

          // For MCP requests, inject tool results into the message
          const toolContext = `## TOOL RESULTS\n\n${JSON.stringify(toolResult, null, 2)}\n\nUse this data to answer: `;
          messageText = `${conversationContext}${mcpPrompt}${toolContext}${userMessage}`;

          console.log(`✅ MCP tool executed successfully, result injected into message`);
        } catch (toolError) {
          console.error(`❌ MCP tool execution failed:`, toolError);
          const errorContext = `## ERROR\n\n${toolError.message}\n\nPlease respond appropriately to: `;
          messageText = `${conversationContext}${mcpPrompt}${errorContext}${userMessage}`;
        }
      }
      // Process server-side using Groq instead of forwarding to device
      try {
        clearTimeout(timeout);
        pendingRequests.delete(requestId);
        requestDeviceMap.delete(requestId);

        const groqResult = await processWithGroq(messages, {
          model,
          temperature,
          max_tokens,
          response_format,
        });

        // Inject conversation context into the response if MCP was used
        const finalContent = groqResult.content;

        sendOpenAIResponse(res, finalContent, userMessage, model, stream);
        console.log('[groq] Chat completion processed server-side successfully');
      } catch (groqError) {
        clearTimeout(timeout);
        pendingRequests.delete(requestId);
        requestDeviceMap.delete(requestId);
        console.error('[groq] Error:', groqError.message);
        res.status(502).json({
          error: {
            message: 'AI processing failed: ' + groqError.message,
            type: 'server_error'
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