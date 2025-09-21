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

// OpenAI-compatible API endpoints
app.post('/v1/chat/completions', async (req, res) => {
  try {
    const { messages, model = 'gpt-3.5-turbo', temperature = 0.7, max_tokens = 150 } = req.body;
    
    // Extract the latest user message
    const userMessage = messages[messages.length - 1]?.content || '';
    
    // Generate unique request ID
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
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
    
    pendingRequests.set(requestId, { res, timeout });
    
    // Send command to all connected R1 devices via WebSocket
    const command = {
      type: 'chat_completion',
      data: {
        message: userMessage,
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
  
  // Send welcome message
  socket.emit('connected', {
    deviceId: deviceId,
    message: 'Connected to R-API server'
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
    console.log(`Response from ${deviceId}:`, data);
    
    const { requestId, response, originalMessage, model, timestamp } = data;
    
    // Check if this device was assigned to handle this request
    const assignedDevice = requestDeviceMap.get(requestId);
    
    if (requestId && pendingRequests.has(requestId) && (!assignedDevice || assignedDevice === deviceId)) {
      const { res, timeout } = pendingRequests.get(requestId);
      
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
      
      console.log(`Sending response for request ${requestId} to client`);
      res.json(openaiResponse);
    } else if (requestId && assignedDevice && assignedDevice !== deviceId) {
      console.log(`Ignoring response from ${deviceId} for request ${requestId} (assigned to ${assignedDevice})`);
    } else {
      console.log(`No pending request found for response from ${deviceId} with requestId: ${requestId}`);
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

// Start server
const PORT = process.env.PORT || 5482;
server.listen(PORT, () => {
  console.log(`R-API server running on http://localhost:${PORT}`);
  console.log(`Socket.IO server available at /socket.io (WebSocket+polling compatible)`);
  console.log(`R1 Creation available at http://localhost:${PORT}/creation`);
  console.log(`OpenAI-compatible API at http://localhost:${PORT}/v1/chat/completions`);
});