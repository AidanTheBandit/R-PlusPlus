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

// OpenAI-compatible API endpoints
app.post('/v1/chat/completions', async (req, res) => {
  try {
    const { messages, model = 'gpt-3.5-turbo', temperature = 0.7, max_tokens = 150 } = req.body;
    
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
      // Get the last few exchanges
      const recentHistory = history.slice(-4);
      const contextParts = [];
      
      for (let i = 0; i < recentHistory.length - 1; i++) { // Exclude the current message
        const msg = recentHistory[i];
        contextParts.push(`${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`);
      }
      
      if (contextParts.length > 0) {
        messageWithContext = `Context from previous messages:\n${contextParts.join('\n')}\n\nCurrent question: ${userMessage}`;
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
    
    pendingRequests.set(requestId, { res, timeout });
    
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
    console.log(`🔄 Socket Response from ${deviceId}:`, data);
    
    const { requestId, response, originalMessage, model, timestamp } = data;
    
    console.log(`Looking for pending request: ${requestId}`);
    console.log(`Pending requests:`, Array.from(pendingRequests.keys()));
    
    // If we have a requestId and it matches, use it
    if (requestId && pendingRequests.has(requestId)) {
      console.log(`✅ Found matching request ${requestId}, sending response to client`);
      const { res, timeout } = pendingRequests.get(requestId);
      
      // Clear timeout and remove from pending requests
      clearTimeout(timeout);
      pendingRequests.delete(requestId);
      requestDeviceMap.delete(requestId);
      
      sendOpenAIResponse(res, response, originalMessage, model);
    } 
    // If no requestId or it doesn't match, but we have pending requests, use the first one
    else if (pendingRequests.size > 0) {
      console.log(`⚠️ No matching requestId, using first pending request`);
      const [firstRequestId, { res, timeout }] = pendingRequests.entries().next().value;
      
      // Clear timeout and remove from pending requests
      clearTimeout(timeout);
      pendingRequests.delete(firstRequestId);
      requestDeviceMap.delete(firstRequestId);
      
      sendOpenAIResponse(res, response, originalMessage, model);
    } else {
      console.log(`❌ No pending requests found for response from ${deviceId}`);
    }
  });
  
  // Helper function to send OpenAI-compatible response
  function sendOpenAIResponse(clientRes, response, originalMessage, model) {
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
    
      console.log(`📤 Sending OpenAI response to client:`, openaiResponse.choices[0].message.content.substring(0, 100));
      
      // Add assistant response to conversation history
      const sessionId = 'default';
      const history = conversationHistory.get(sessionId) || [];
      history.push({
        role: 'assistant',
        content: openaiResponse.choices[0].message.content,
        timestamp: new Date().toISOString()
      });
      
      // Keep only last 10 messages
      if (history.length > 10) {
        history.splice(0, history.length - 10);
      }
      conversationHistory.set(sessionId, history);
      
      clientRes.json(openaiResponse);
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

// Start server
const PORT = process.env.PORT || 5482;
server.listen(PORT, () => {
  console.log(`R-API server running on http://localhost:${PORT}`);
  console.log(`Socket.IO server available at /socket.io (WebSocket+polling compatible)`);
  console.log(`R1 Creation available at http://localhost:${PORT}/creation`);
  console.log(`OpenAI-compatible API at http://localhost:${PORT}/v1/chat/completions`);
});