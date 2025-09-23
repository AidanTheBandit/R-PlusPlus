const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const http = require('http');

const app = express();
const server = http.createServer(app);

// Socket.IO server for R1 communication - compatible with ancient Android WebView
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store connected R1 devices
const connectedR1s = new Map();

// Store conversation history (simple in-memory storage)
const conversationHistory = new Map(); // deviceId -> array of messages

// Store pending chat completion requests
const pendingRequests = new Map();

// Store which device is handling which request
const requestDeviceMap = new Map();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Trust proxy for Cloudflare Tunnel
app.set('trust proxy', 1);

// Serve React creation assets from root for proper loading
app.use('/assets', express.static(path.join(__dirname, 'creation-react', 'dist', 'assets'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
  }
}));

// Serve creation assets with proper MIME types
app.use('/creation', express.static(path.join(__dirname, 'creation-react', 'dist'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Serve the laptop control panel at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve the R1 creation at /creation
app.get('/creation', (req, res) => {
  res.sendFile(path.join(__dirname, 'creation-react', 'dist', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('💚 Health check called');
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    connectedDevices: connectedR1s.size,
    server: 'R-API',
    version: '1.0.0'
  });
});

// Response endpoint for R1 devices to send responses via HTTP
app.post('/response', (req, res) => {
  try {
    const { requestId, response, originalMessage, model, deviceId } = req.body;
    
    console.log(`HTTP Response from ${deviceId}:`, { requestId, response: response?.substring(0, 100) });
    
    if (requestId && pendingRequests.has(requestId)) {
      const { res: clientRes, timeout } = pendingRequests.get(requestId);
      
      // Clear timeout and remove from pending requests
      clearTimeout(timeout);
      pendingRequests.delete(requestId);
      requestDeviceMap.delete(requestId);
      
      // Send OpenAI-compatible response
      const openaiResponse = {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: model || 'r1-llm',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: response || 'No response from R1'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: originalMessage ? originalMessage.length : 0,
          completion_tokens: response ? response.length : 0,
          total_tokens: (originalMessage ? originalMessage.length : 0) + (response ? response.length : 0)
        }
      };
      
      console.log(`Sending HTTP response for request ${requestId} to client`);
      clientRes.json(openaiResponse);
      res.json({ status: 'response_sent' });
    } else {
      console.log(`No pending request found for HTTP response with requestId: ${requestId}`);
      res.status(404).json({ error: 'No pending request found' });
    }
  } catch (error) {
    console.error('Error processing HTTP response:', error);
    res.status(500).json({ error: 'Failed to process response' });
  }
});

// Magic Cam control endpoints
app.post('/magic-cam/start', (req, res) => {
  try {
    const { facing = 'user' } = req.body;
    console.log(`Magic cam start requested with facing: ${facing}`);
    
    // Broadcast to all connected R1 devices
    let devicesSent = 0;
    connectedR1s.forEach((socket, deviceId) => {
      socket.emit('magic_cam_start', { facing });
      devicesSent++;
    });
    
    console.log(`Magic cam start command sent to ${devicesSent} devices`);
    res.json({ 
      status: 'sent', 
      devices: devicesSent,
      command: 'start',
      facing 
    });
  } catch (error) {
    console.error('Error sending magic cam start:', error);
    res.status(500).json({ error: 'Failed to send camera start command' });
  }
});

app.post('/magic-cam/stop', (req, res) => {
  try {
    console.log('Magic cam stop requested');
    
    // Broadcast to all connected R1 devices
    let devicesSent = 0;
    connectedR1s.forEach((socket, deviceId) => {
      socket.emit('magic_cam_stop', {});
      devicesSent++;
    });
    
    console.log(`Magic cam stop command sent to ${devicesSent} devices`);
    res.json({ 
      status: 'sent', 
      devices: devicesSent,
      command: 'stop'
    });
  } catch (error) {
    console.error('Error sending magic cam stop:', error);
    res.status(500).json({ error: 'Failed to send camera stop command' });
  }
});

app.post('/magic-cam/capture', (req, res) => {
  try {
    const { width = 240, height = 282 } = req.body;
    console.log(`Magic cam capture requested with dimensions: ${width}x${height}`);
    
    // Broadcast to all connected R1 devices
    let devicesSent = 0;
    connectedR1s.forEach((socket, deviceId) => {
      socket.emit('magic_cam_capture', { width, height });
      devicesSent++;
    });
    
    console.log(`Magic cam capture command sent to ${devicesSent} devices`);
    res.json({ 
      status: 'sent', 
      devices: devicesSent,
      command: 'capture',
      dimensions: { width, height }
    });
  } catch (error) {
    console.error('Error sending magic cam capture:', error);
    res.status(500).json({ error: 'Failed to send camera capture command' });
  }
});

app.post('/magic-cam/switch', (req, res) => {
  try {
    console.log('Magic cam switch requested');
    
    // Broadcast to all connected R1 devices
    let devicesSent = 0;
    connectedR1s.forEach((socket, deviceId) => {
      socket.emit('magic_cam_switch', {});
      devicesSent++;
    });
    
    console.log(`Magic cam switch command sent to ${devicesSent} devices`);
    res.json({ 
      status: 'sent', 
      devices: devicesSent,
      command: 'switch'
    });
  } catch (error) {
    console.error('Error sending magic cam switch:', error);
    res.status(500).json({ error: 'Failed to send camera switch command' });
  }
});

app.get('/magic-cam/status', (req, res) => {
  try {
    console.log('Magic cam status requested');
    res.json({
      connectedDevices: connectedR1s.size,
      cameraCommands: ['start', 'stop', 'capture', 'switch'],
      status: connectedR1s.size > 0 ? 'ready' : 'no_devices'
    });
  } catch (error) {
    console.error('Error getting magic cam status:', error);
    res.status(500).json({ error: 'Failed to get camera status' });
  }
});

// OpenAI-compatible API endpoints

// Magic Cam API endpoints
app.post('/magic-cam/start', (req, res) => {
  try {
    const { facingMode = 'user' } = req.body;
    
    console.log(`Magic cam start command: facingMode=${facingMode}`);
    
    // Broadcast to all connected R1 devices
    let devicesSent = 0;
    connectedR1s.forEach((socket, deviceId) => {
      socket.emit('magic_cam_start', { facingMode });
      devicesSent++;
    });
    
    res.json({ 
      success: true, 
      devices: devicesSent,
      message: `Camera start command sent to ${devicesSent} device(s)`
    });
  } catch (error) {
    console.error('Error sending magic cam start:', error);
    res.status(500).json({ error: 'Failed to send camera start command' });
  }
});

app.post('/magic-cam/stop', (req, res) => {
  try {
    console.log('Magic cam stop command');
    
    // Broadcast to all connected R1 devices
    let devicesSent = 0;
    connectedR1s.forEach((socket, deviceId) => {
      socket.emit('magic_cam_stop', {});
      devicesSent++;
    });
    
    res.json({ 
      success: true, 
      devices: devicesSent,
      message: `Camera stop command sent to ${devicesSent} device(s)`
    });
  } catch (error) {
    console.error('Error sending magic cam stop:', error);
    res.status(500).json({ error: 'Failed to send camera stop command' });
  }
});

app.post('/magic-cam/capture', (req, res) => {
  try {
    const { width = 240, height = 282 } = req.body;
    
    console.log(`Magic cam capture command: ${width}x${height}`);
    
    // Broadcast to all connected R1 devices
    let devicesSent = 0;
    connectedR1s.forEach((socket, deviceId) => {
      socket.emit('magic_cam_capture', { width, height });
      devicesSent++;
    });
    
    res.json({ 
      success: true, 
      devices: devicesSent,
      message: `Photo capture command sent to ${devicesSent} device(s)`
    });
  } catch (error) {
    console.error('Error sending magic cam capture:', error);
    res.status(500).json({ error: 'Failed to send photo capture command' });
  }
});

app.post('/magic-cam/switch', (req, res) => {
  try {
    console.log('Magic cam switch command');
    
    // Broadcast to all connected R1 devices
    let devicesSent = 0;
    connectedR1s.forEach((socket, deviceId) => {
      socket.emit('magic_cam_switch', {});
      devicesSent++;
    });
    
    res.json({ 
      success: true, 
      devices: devicesSent,
      message: `Camera switch command sent to ${devicesSent} device(s)`
    });
  } catch (error) {
    console.error('Error sending magic cam switch:', error);
    res.status(500).json({ error: 'Failed to send camera switch command' });
  }
});

app.get('/magic-cam/status', (req, res) => {
  try {
    res.json({
      connectedDevices: connectedR1s.size,
      cameraCommands: ['start', 'stop', 'capture', 'switch'],
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting magic cam status:', error);
    res.status(500).json({ error: 'Failed to get camera status' });
  }
});

// OpenAI-compatible API endpoints

// Magic Cam control endpoints
app.post('/magic-cam/start', (req, res) => {
  try {
    const { facingMode = 'user' } = req.body;
    
    console.log(`Starting magic cam with facing mode: ${facingMode}`);
    
    // Broadcast camera start command to all R1 devices
    connectedR1s.forEach((socket, deviceId) => {
      socket.emit('magic_cam_start', { facingMode });
    });
    
    res.json({ 
      status: 'command_sent',
      command: 'start',
      facingMode,
      devices: connectedR1s.size
    });
  } catch (error) {
    console.error('Error starting magic cam:', error);
    res.status(500).json({ error: 'Failed to start camera' });
  }
});

app.post('/magic-cam/stop', (req, res) => {
  try {
    console.log('Stopping magic cam');
    
    // Broadcast camera stop command to all R1 devices
    connectedR1s.forEach((socket, deviceId) => {
      socket.emit('magic_cam_stop', {});
    });
    
    res.json({ 
      status: 'command_sent',
      command: 'stop',
      devices: connectedR1s.size
    });
  } catch (error) {
    console.error('Error stopping magic cam:', error);
    res.status(500).json({ error: 'Failed to stop camera' });
  }
});

app.post('/magic-cam/capture', (req, res) => {
  try {
    const { width = 240, height = 282 } = req.body;
    
    console.log(`Capturing photo with dimensions: ${width}x${height}`);
    
    // Broadcast photo capture command to all R1 devices
    connectedR1s.forEach((socket, deviceId) => {
      socket.emit('magic_cam_capture', { width, height });
    });
    
    res.json({ 
      status: 'command_sent',
      command: 'capture',
      dimensions: `${width}x${height}`,
      devices: connectedR1s.size
    });
  } catch (error) {
    console.error('Error capturing photo:', error);
    res.status(500).json({ error: 'Failed to capture photo' });
  }
});

app.post('/magic-cam/switch', (req, res) => {
  try {
    console.log('Switching magic cam');
    
    // Broadcast camera switch command to all R1 devices
    connectedR1s.forEach((socket, deviceId) => {
      socket.emit('magic_cam_switch', {});
    });
    
    res.json({ 
      status: 'command_sent',
      command: 'switch',
      devices: connectedR1s.size
    });
  } catch (error) {
    console.error('Error switching magic cam:', error);
    res.status(500).json({ error: 'Failed to switch camera' });
  }
});

app.get('/magic-cam/status', (req, res) => {
  try {
    res.json({
      connectedDevices: connectedR1s.size,
      cameraCommands: ['start', 'stop', 'capture', 'switch'],
      supportedFacingModes: ['user', 'environment']
    });
  } catch (error) {
    console.error('Error getting magic cam status:', error);
    res.status(500).json({ error: 'Failed to get camera status' });
  }
});

// OpenAI-compatible API endpoints
app.post('/v1/chat/completions', async (req, res) => {
  try {
    const { messages, model = 'gpt-3.5-turbo', temperature = 0.7, max_tokens = 150, stream = false } = req.body;
    
    // Extract the latest user message
    const userMessage = messages[messages.length - 1]?.content || '';
    
    // Generate unique request ID
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Get conversation history for this "session" (using a simple approach)
    // In a real implementation, you'd use proper session management
    const sessionId = 'default'; // For now, use a single conversation per device
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
      pendingRequests.delete(requestId);
      requestDeviceMap.delete(requestId);
      console.log(`Request ${requestId} timed out`);
      res.status(504).json({
        error: {
          message: 'Request timed out waiting for R1 response',
          type: 'timeout_error'
        }
      });
    }, 30000); // 30 second timeout
    
    pendingRequests.set(requestId, { res, timeout, stream });
    
    // Send command to all connected R1 devices via WebSocket
    const command = {
      type: 'chat_completion',
      data: {
        message: messageWithContext, // Use message with conversation context
        originalMessage: userMessage, // Keep original for response
        model,
        temperature,
        max_tokens,
        requestId
      },
      timestamp: new Date().toISOString()
    };
    
    console.log('Sending command to R1 devices:', command);
    
    // Broadcast to all connected R1s via Socket.IO
    let responsesSent = 0;
    connectedR1s.forEach((socket, deviceId) => {
      socket.emit('chat_completion', command.data);
      requestDeviceMap.set(requestId, deviceId); // Track which device gets this request
      responsesSent++;
    });
    
    if (responsesSent === 0) {
      // No R1 devices connected
      pendingRequests.delete(requestId);
      clearTimeout(timeout);
      res.status(503).json({
        error: {
          message: 'No R1 devices connected',
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

// Socket.IO connection handling
io.on('connection', (socket) => {
  const deviceId = `r1-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  connectedR1s.set(deviceId, socket);
  
  console.log(`R1 device connected: ${deviceId}`);
  console.log(`Total connected devices: ${connectedR1s.size}`);
  
  // Broadcast device connection to all clients
  socket.broadcast.emit('device_connected', {
    deviceId: deviceId,
    userAgent: socket.handshake.headers['user-agent'],
    connectedAt: new Date().toISOString()
  });
  
  // Send welcome message
  socket.emit('connected', {
    deviceId: deviceId,
    message: 'Connected to R-API server'
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`R1 device disconnected: ${deviceId}`);
    connectedR1s.delete(deviceId);
    
    // Broadcast device disconnection to all clients
    socket.broadcast.emit('device_disconnected', {
      deviceId: deviceId,
      disconnectedAt: new Date().toISOString()
    });
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

  socket.on('system_info', (data) => {
    console.log(`System info from ${deviceId}:`, data);
    // Store system info for analytics
    if (!global.systemInfo) global.systemInfo = {};
    global.systemInfo[deviceId] = {
      ...data.systemInfo,
      lastUpdated: new Date().toISOString()
    };
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
    console.log(`🔄 Socket Response from ${deviceId}:`, data);
    
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
      
      sendOpenAIResponse(res, response, originalMessage, model, stream);
    } 
    // If no requestId or it doesn't match, but we have pending requests, use the first one
    else if (pendingRequests.size > 0) {
      console.log(`⚠️ No matching requestId, using first pending request`);
      const [firstRequestId, { res, timeout, stream }] = pendingRequests.entries().next().value;
      
      // Clear timeout and remove from pending requests
      clearTimeout(timeout);
      pendingRequests.delete(firstRequestId);
      requestDeviceMap.delete(firstRequestId);
      
      sendOpenAIResponse(res, response, originalMessage, model, stream);
    } else {
      console.log(`❌ No pending requests found for response from ${deviceId}`);
    }
  });
  
  // Helper function to send OpenAI-compatible response
  function sendOpenAIResponse(clientRes, response, originalMessage, model, stream = false) {
    if (stream) {
      // Set headers for SSE
      clientRes.setHeader('Content-Type', 'text/plain; charset=utf-8');
      clientRes.setHeader('Cache-Control', 'no-cache');
      clientRes.setHeader('Connection', 'keep-alive');

      const id = `chatcmpl-${Date.now()}`;
      const created = Math.floor(Date.now() / 1000);

      // Send the completion chunk
      const chunk = {
        id,
        object: 'chat.completion.chunk',
        created,
        model: model || 'r1-llm',
        choices: [{
          index: 0,
          delta: {
            role: 'assistant',
            content: response || 'No response from R1'
          },
          finish_reason: 'stop'
        }]
      };

      clientRes.write(`data: ${JSON.stringify(chunk)}\n\n`);
      clientRes.write(`data: [DONE]\n\n`);
      clientRes.end();
    } else {
      const openaiResponse = {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: model || 'r1-llm',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: response || 'No response from R1'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: originalMessage ? originalMessage.length : 0,
          completion_tokens: response ? response.length : 0,
          total_tokens: (originalMessage ? originalMessage.length : 0) + (response ? response.length : 0)
        }
      };
      
      clientRes.json(openaiResponse);
    }
    
    console.log(`📤 Sending ${stream ? 'streaming' : 'normal'} OpenAI response to client:`, (response || 'No response from R1').substring(0, 100));
    
    // Add assistant response to conversation history
    const sessionId = 'default';
    const history = conversationHistory.get(sessionId) || [];
    history.push({
      role: 'assistant',
      content: response || 'No response from R1',
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 10 messages
    if (history.length > 10) {
      history.splice(0, history.length - 10);
    }
    conversationHistory.set(sessionId, history);
  }
  
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
  });
  
  socket.on('disconnect', () => {
    connectedR1s.delete(deviceId);
    console.log(`R1 device disconnected: ${deviceId}`);
    console.log(`Total connected devices: ${connectedR1s.size}`);
  });
});

// Error logging endpoint for R1 browser debugging
app.post('/errors', (req, res) => {
  try {
    const { level, message, stack, url, userAgent, timestamp, deviceId } = req.body;
    
    console.log(`[R1 ERROR ${level.toUpperCase()}] ${deviceId || 'unknown'}: ${message}`);
    if (stack) {
      console.log(`Stack trace: ${stack}`);
    }
    console.log(`URL: ${url}, User-Agent: ${userAgent}, Time: ${timestamp}`);
    
    res.json({ status: 'logged' });
  } catch (error) {
    console.error('Error logging failed:', error);
    res.status(500).json({ error: 'Failed to log error' });
  }
});

// Store debug data streams
const debugStreams = new Map(); // deviceId -> debug data history
const activeStreams = new Map(); // streamId -> { deviceId, type, clients }

// Debug data streaming endpoints
app.post('/debug/stream/:type', (req, res) => {
  try {
    const { type } = req.params;
    const { deviceId, data, timestamp } = req.body;
    
    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId required' });
    }
    
    // Store debug data
    if (!debugStreams.has(deviceId)) {
      debugStreams.set(deviceId, {
        hardware: [],
        camera: [],
        llm: [],
        storage: [],
        audio: [],
        performance: [],
        device: [],
        logs: []
      });
    }
    
    const deviceStreams = debugStreams.get(deviceId);
    if (deviceStreams[type]) {
      // Keep last 100 entries per type
      deviceStreams[type].push({
        data,
        timestamp: timestamp || new Date().toISOString(),
        id: Date.now()
      });
      
      if (deviceStreams[type].length > 100) {
        deviceStreams[type].shift();
      }
    }
    
    // Broadcast to all connected clients (not the device itself)
    io.sockets.sockets.forEach((socket) => {
      if (socket.deviceId !== deviceId) {
        socket.emit('debug_data', {
          type,
          deviceId,
          data,
          timestamp: timestamp || new Date().toISOString()
        });
      }
    });
    
    res.json({ status: 'streamed', type, deviceId });
  } catch (error) {
    console.error('Error streaming debug data:', error);
    res.status(500).json({ error: 'Failed to stream debug data' });
  }
});

// Get debug data history
app.get('/debug/history/:deviceId', (req, res) => {
  try {
    const { deviceId } = req.params;
    const { type, limit = 50 } = req.query;
    
    if (!debugStreams.has(deviceId)) {
      return res.json({ data: [] });
    }
    
    const deviceStreams = debugStreams.get(deviceId);
    
    if (type) {
      const data = deviceStreams[type] || [];
      res.json({ 
        data: data.slice(-limit),
        type,
        deviceId,
        count: data.length
      });
    } else {
      // Return all types
      const result = {};
      Object.keys(deviceStreams).forEach(streamType => {
        result[streamType] = deviceStreams[streamType].slice(-limit);
      });
      res.json({ 
        data: result,
        deviceId,
        types: Object.keys(deviceStreams)
      });
    }
  } catch (error) {
    console.error('Error getting debug history:', error);
    res.status(500).json({ error: 'Failed to get debug history' });
  }
});

// Clear debug data
app.delete('/debug/clear/:deviceId', (req, res) => {
  try {
    const { deviceId } = req.params;
    const { type } = req.query;
    
    if (!debugStreams.has(deviceId)) {
      return res.json({ status: 'no_data' });
    }
    
    const deviceStreams = debugStreams.get(deviceId);
    
    if (type) {
      deviceStreams[type] = [];
      res.json({ status: 'cleared', type, deviceId });
    } else {
      Object.keys(deviceStreams).forEach(streamType => {
        deviceStreams[streamType] = [];
      });
      res.json({ status: 'cleared_all', deviceId });
    }
  } catch (error) {
    console.error('Error clearing debug data:', error);
    res.status(500).json({ error: 'Failed to clear debug data' });
  }
});

// Get connected devices with debug info
app.get('/debug/devices', (req, res) => {
  try {
    const devices = [];
    connectedR1s.forEach((socket, deviceId) => {
      const streams = debugStreams.get(deviceId);
      devices.push({
        deviceId,
        connected: true,
        lastSeen: new Date().toISOString(),
        streams: streams ? Object.keys(streams).reduce((acc, type) => {
          acc[type] = streams[type].length;
          return acc;
        }, {}) : {}
      });
    });
    
    res.json({ devices, total: devices.length });
  } catch (error) {
    console.error('Error getting debug devices:', error);
    res.status(500).json({ error: 'Failed to get debug devices' });
  }
});

// Debug data collection endpoints

// Store debug data from devices
const debugDataStore = new Map(); // deviceId -> debug data
const deviceLogs = new Map(); // deviceId -> logs array
const performanceMetrics = new Map(); // deviceId -> metrics array

// Hardware events endpoint
app.post('/debug/hardware-event', (req, res) => {
  try {
    const { deviceId, event } = req.body;
    
    if (!deviceId || !event) {
      return res.status(400).json({ error: 'Missing deviceId or event data' });
    }
    
    // Store hardware event
    if (!debugDataStore.has(deviceId)) {
      debugDataStore.set(deviceId, { hardware: [], camera: [], llm: [], storage: [], audio: [], performance: [], device: [] });
    }
    
    const deviceData = debugDataStore.get(deviceId);
    deviceData.hardware.push({
      ...event,
      serverTimestamp: new Date().toISOString()
    });
    
    // Keep only last 100 hardware events per device
    if (deviceData.hardware.length > 100) {
      deviceData.hardware = deviceData.hardware.slice(-100);
    }
    
    console.log(`Hardware event from ${deviceId}: ${event.type}`);
    res.json({ status: 'stored' });
  } catch (error) {
    console.error('Error storing hardware event:', error);
    res.status(500).json({ error: 'Failed to store hardware event' });
  }
});

// Camera events endpoint
app.post('/debug/camera-event', (req, res) => {
  try {
    const { deviceId, event } = req.body;
    
    if (!deviceId || !event) {
      return res.status(400).json({ error: 'Missing deviceId or event data' });
    }
    
    if (!debugDataStore.has(deviceId)) {
      debugDataStore.set(deviceId, { hardware: [], camera: [], llm: [], storage: [], audio: [], performance: [], device: [] });
    }
    
    const deviceData = debugDataStore.get(deviceId);
    deviceData.camera.push({
      ...event,
      serverTimestamp: new Date().toISOString()
    });
    
    if (deviceData.camera.length > 50) {
      deviceData.camera = deviceData.camera.slice(-50);
    }
    
    console.log(`Camera event from ${deviceId}: ${event.type}`);
    res.json({ status: 'stored' });
  } catch (error) {
    console.error('Error storing camera event:', error);
    res.status(500).json({ error: 'Failed to store camera event' });
  }
});

// LLM events endpoint
app.post('/debug/llm-event', (req, res) => {
  try {
    const { deviceId, event } = req.body;
    
    if (!deviceId || !event) {
      return res.status(400).json({ error: 'Missing deviceId or event data' });
    }
    
    if (!debugDataStore.has(deviceId)) {
      debugDataStore.set(deviceId, { hardware: [], camera: [], llm: [], storage: [], audio: [], performance: [], device: [] });
    }
    
    const deviceData = debugDataStore.get(deviceId);
    deviceData.llm.push({
      ...event,
      serverTimestamp: new Date().toISOString()
    });
    
    if (deviceData.llm.length > 50) {
      deviceData.llm = deviceData.llm.slice(-50);
    }
    
    console.log(`LLM event from ${deviceId}: ${event.type}`);
    res.json({ status: 'stored' });
  } catch (error) {
    console.error('Error storing LLM event:', error);
    res.status(500).json({ error: 'Failed to store LLM event' });
  }
});

// Storage events endpoint
app.post('/debug/storage-event', (req, res) => {
  try {
    const { deviceId, event } = req.body;
    
    if (!deviceId || !event) {
      return res.status(400).json({ error: 'Missing deviceId or event data' });
    }
    
    if (!debugDataStore.has(deviceId)) {
      debugDataStore.set(deviceId, { hardware: [], camera: [], llm: [], storage: [], audio: [], performance: [], device: [] });
    }
    
    const deviceData = debugDataStore.get(deviceId);
    deviceData.storage.push({
      ...event,
      serverTimestamp: new Date().toISOString()
    });
    
    if (deviceData.storage.length > 50) {
      deviceData.storage = deviceData.storage.slice(-50);
    }
    
    console.log(`Storage event from ${deviceId}: ${event.type}`);
    res.json({ status: 'stored' });
  } catch (error) {
    console.error('Error storing storage event:', error);
    res.status(500).json({ error: 'Failed to store storage event' });
  }
});

// Audio events endpoint
app.post('/debug/audio-event', (req, res) => {
  try {
    const { deviceId, event } = req.body;
    
    if (!deviceId || !event) {
      return res.status(400).json({ error: 'Missing deviceId or event data' });
    }
    
    if (!debugDataStore.has(deviceId)) {
      debugDataStore.set(deviceId, { hardware: [], camera: [], llm: [], storage: [], audio: [], performance: [], device: [] });
    }
    
    const deviceData = debugDataStore.get(deviceId);
    deviceData.audio.push({
      ...event,
      serverTimestamp: new Date().toISOString()
    });
    
    if (deviceData.audio.length > 50) {
      deviceData.audio = deviceData.audio.slice(-50);
    }
    
    console.log(`Audio event from ${deviceId}: ${event.type}`);
    res.json({ status: 'stored' });
  } catch (error) {
    console.error('Error storing audio event:', error);
    res.status(500).json({ error: 'Failed to store audio event' });
  }
});

// Performance events endpoint
app.post('/debug/performance-event', (req, res) => {
  try {
    const { deviceId, event } = req.body;
    
    if (!deviceId || !event) {
      return res.status(400).json({ error: 'Missing deviceId or event data' });
    }
    
    if (!debugDataStore.has(deviceId)) {
      debugDataStore.set(deviceId, { hardware: [], camera: [], llm: [], storage: [], audio: [], performance: [], device: [] });
    }
    
    const deviceData = debugDataStore.get(deviceId);
    deviceData.performance.push({
      ...event,
      serverTimestamp: new Date().toISOString()
    });
    
    if (deviceData.performance.length > 50) {
      deviceData.performance = deviceData.performance.slice(-50);
    }
    
    console.log(`Performance event from ${deviceId}: ${event.type}`);
    res.json({ status: 'stored' });
  } catch (error) {
    console.error('Error storing performance event:', error);
    res.status(500).json({ error: 'Failed to store performance event' });
  }
});

// Device info endpoint
app.post('/debug/device-event', (req, res) => {
  try {
    const { deviceId, event } = req.body;
    
    if (!deviceId || !event) {
      return res.status(400).json({ error: 'Missing deviceId or event data' });
    }
    
    if (!debugDataStore.has(deviceId)) {
      debugDataStore.set(deviceId, { hardware: [], camera: [], llm: [], storage: [], audio: [], performance: [], device: [] });
    }
    
    const deviceData = debugDataStore.get(deviceId);
    deviceData.device.push({
      ...event,
      serverTimestamp: new Date().toISOString()
    });
    
    if (deviceData.device.length > 20) {
      deviceData.device = deviceData.device.slice(-20);
    }
    
    console.log(`Device event from ${deviceId}: ${event.type}`);
    res.json({ status: 'stored' });
  } catch (error) {
    console.error('Error storing device event:', error);
    res.status(500).json({ error: 'Failed to store device event' });
  }
});

// Client logs endpoint
app.post('/debug/client-log', (req, res) => {
  try {
    const { deviceId, log } = req.body;
    
    if (!deviceId || !log) {
      return res.status(400).json({ error: 'Missing deviceId or log data' });
    }
    
    if (!deviceLogs.has(deviceId)) {
      deviceLogs.set(deviceId, []);
    }
    
    const logs = deviceLogs.get(deviceId);
    logs.push({
      ...log,
      serverTimestamp: new Date().toISOString()
    });
    
    // Keep only last 500 logs per device
    if (logs.length > 500) {
      logs.splice(0, logs.length - 500);
    }
    
    console.log(`Client log from ${deviceId}: [${log.level}] ${log.message.substring(0, 50)}...`);
    res.json({ status: 'logged' });
  } catch (error) {
    console.error('Error storing client log:', error);
    res.status(500).json({ error: 'Failed to store client log' });
  }
});

// Get debug data endpoint
app.get('/debug/data/:deviceId', (req, res) => {
  try {
    const { deviceId } = req.params;
    const data = debugDataStore.get(deviceId) || { hardware: [], camera: [], llm: [], storage: [], audio: [], performance: [], device: [] };
    
    res.json({
      deviceId,
      data,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error retrieving debug data:', error);
    res.status(500).json({ error: 'Failed to retrieve debug data' });
  }
});

// Get device logs endpoint
app.get('/debug/logs/:deviceId', (req, res) => {
  try {
    const { deviceId } = req.params;
    const logs = deviceLogs.get(deviceId) || [];
    
    res.json({
      deviceId,
      logs,
      count: logs.length,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error retrieving device logs:', error);
    res.status(500).json({ error: 'Failed to retrieve device logs' });
  }
});

// Get all connected devices debug summary
app.get('/debug/devices', (req, res) => {
  try {
    const devices = Array.from(connectedR1s.keys()).map(deviceId => {
      const data = debugDataStore.get(deviceId);
      const logs = deviceLogs.get(deviceId);
      
      return {
        deviceId,
        connected: true,
        dataPoints: data ? {
          hardware: data.hardware.length,
          camera: data.camera.length,
          llm: data.llm.length,
          storage: data.storage.length,
          audio: data.audio.length,
          performance: data.performance.length,
          device: data.device.length
        } : { hardware: 0, camera: 0, llm: 0, storage: 0, audio: 0, performance: 0, device: 0 },
        logCount: logs ? logs.length : 0,
        lastActivity: data ? Math.max(
          ...data.hardware.map(d => new Date(d.serverTimestamp)),
          ...data.camera.map(d => new Date(d.serverTimestamp)),
          ...data.llm.map(d => new Date(d.serverTimestamp)),
          ...data.storage.map(d => new Date(d.serverTimestamp)),
          ...data.audio.map(d => new Date(d.serverTimestamp)),
          ...data.performance.map(d => new Date(d.serverTimestamp)),
          ...data.device.map(d => new Date(d.serverTimestamp))
        ) : null
      };
    });
    
    res.json({
      devices,
      totalDevices: devices.length,
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error retrieving devices summary:', error);
    res.status(500).json({ error: 'Failed to retrieve devices summary' });
  }
});

// Clear debug data endpoint
app.post('/debug/clear/:deviceId', (req, res) => {
  try {
    const { deviceId } = req.params;
    
    debugDataStore.delete(deviceId);
    deviceLogs.delete(deviceId);
    
    console.log(`Cleared debug data for device: ${deviceId}`);
    res.json({ status: 'cleared', deviceId });
  } catch (error) {
    console.error('Error clearing debug data:', error);
    res.status(500).json({ error: 'Failed to clear debug data' });
  }
});

// System info endpoint
app.post('/debug/system-info', (req, res) => {
  try {
    const { deviceId, systemInfo } = req.body;
    
    if (!deviceId || !systemInfo) {
      return res.status(400).json({ error: 'Missing deviceId or systemInfo' });
    }
    
    // Store system info in performance metrics
    if (!performanceMetrics.has(deviceId)) {
      performanceMetrics.set(deviceId, []);
    }
    
    const metrics = performanceMetrics.get(deviceId);
    metrics.push({
      type: 'system_info',
      data: systemInfo,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 10 system info entries
    if (metrics.length > 10) {
      metrics.splice(0, metrics.length - 10);
    }
    
    console.log(`System info received from ${deviceId}`);
    res.json({ status: 'stored' });
  } catch (error) {
    console.error('Error storing system info:', error);
    res.status(500).json({ error: 'Failed to store system info' });
  }
});

// Photo capture endpoint
app.post('/debug/photo-captured', (req, res) => {
  try {
    const { deviceId, photo, timestamp } = req.body;
    
    if (!deviceId || !photo) {
      return res.status(400).json({ error: 'Missing deviceId or photo data' });
    }
    
    // Store photo info in camera data
    if (!debugDataStore.has(deviceId)) {
      debugDataStore.set(deviceId, { hardware: [], camera: [], llm: [], storage: [], audio: [], performance: [], device: [] });
    }
    
    const deviceData = debugDataStore.get(deviceId);
    deviceData.camera.push({
      type: 'photo_captured',
      photoSize: photo.length,
      timestamp: timestamp || new Date().toISOString(),
      serverTimestamp: new Date().toISOString()
    });
    
    if (deviceData.camera.length > 20) {
      deviceData.camera = deviceData.camera.slice(-20);
    }
    
    console.log(`Photo captured from ${deviceId}, size: ${photo.length} bytes`);
    res.json({ status: 'stored' });
  } catch (error) {
    console.error('Error storing photo data:', error);
    res.status(500).json({ error: 'Failed to store photo data' });
  }
});

// Audio capture endpoint
app.post('/debug/audio-captured', (req, res) => {
  try {
    const { deviceId, audio, timestamp } = req.body;
    
    if (!deviceId || !audio) {
      return res.status(400).json({ error: 'Missing deviceId or audio data' });
    }
    
    if (!debugDataStore.has(deviceId)) {
      debugDataStore.set(deviceId, { hardware: [], camera: [], llm: [], storage: [], audio: [], performance: [], device: [] });
    }
    
    const deviceData = debugDataStore.get(deviceId);
    deviceData.audio.push({
      type: 'audio_captured',
      audioSize: audio.length,
      timestamp: timestamp || new Date().toISOString(),
      serverTimestamp: new Date().toISOString()
    });
    
    if (deviceData.audio.length > 20) {
      deviceData.audio = deviceData.audio.slice(-20);
    }
    
    console.log(`Audio captured from ${deviceId}, size: ${audio.length} bytes`);
    res.json({ status: 'stored' });
  } catch (error) {
    console.error('Error storing audio data:', error);
    res.status(500).json({ error: 'Failed to store audio data' });
  }
});

// Start server
const PORT = process.env.PORT || 5482;
server.listen(PORT, () => {
  console.log(`R-API server running on http://localhost:${PORT}`);
  console.log(`Socket.IO server available at /socket.io (WebSocket+polling compatible)`);
  console.log(`R1 Creation available at http://localhost:${PORT}/creation`);
  console.log(`OpenAI-compatible API at http://localhost:${PORT}/v1/chat/completions`);
});