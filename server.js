const express = require('express');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const path = require('path');
const http = require('http');

const app = express();
const server = http.createServer(app);

// WebSocket server for R1 communication
const wss = new WebSocketServer({ server, path: '/ws' });

// Store connected R1 devices
const connectedR1s = new Map();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Serve creation assets with proper MIME types
app.use('/creation', express.static(path.join(__dirname, 'creation'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Serve the R1 creation at /creation
app.get('/creation', (req, res) => {
  res.sendFile(path.join(__dirname, 'creation', 'index.html'));
});

// OpenAI-compatible API endpoints
app.post('/v1/chat/completions', async (req, res) => {
  try {
    const { messages, model = 'gpt-3.5-turbo', temperature = 0.7, max_tokens = 150 } = req.body;
    
    // Extract the latest user message
    const userMessage = messages[messages.length - 1]?.content || '';
    
    // Send command to all connected R1 devices via WebSocket
    const command = {
      type: 'chat_completion',
      data: {
        message: userMessage,
        model,
        temperature,
        max_tokens
      },
      timestamp: new Date().toISOString()
    };
    
    console.log('Sending command to R1 devices:', command);
    
    // Broadcast to all connected R1s
    let responsesSent = 0;
    connectedR1s.forEach((ws, deviceId) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(command));
        responsesSent++;
      }
    });
    
    // Send OpenAI-compatible response
    const response = {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: `Command sent to ${responsesSent} R1 device(s): ${userMessage}`
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: userMessage.length,
        completion_tokens: 50,
        total_tokens: userMessage.length + 50
      }
    };
    
    res.json(response);
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

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  const deviceId = `r1-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  connectedR1s.set(deviceId, ws);
  
  console.log(`R1 device connected: ${deviceId}`);
  console.log(`Total connected devices: ${connectedR1s.size}`);
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    deviceId: deviceId,
    message: 'Connected to R-API server'
  }));
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
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
  
  ws.on('close', () => {
    connectedR1s.delete(deviceId);
    console.log(`R1 device disconnected: ${deviceId}`);
    console.log(`Total connected devices: ${connectedR1s.size}`);
  });
  
  ws.on('error', (error) => {
    console.error(`WebSocket error for ${deviceId}:`, error);
    connectedR1s.delete(deviceId);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    connectedDevices: connectedR1s.size,
    timestamp: new Date().toISOString()
  });
});

// Start server
const PORT = process.env.PORT || 5482;
server.listen(PORT, () => {
  console.log(`R-API server running on http://localhost:${PORT}`);
  console.log(`WebSocket server available at ws://localhost:${PORT}/ws`);
  console.log(`R1 Creation available at http://localhost:${PORT}/creation`);
  console.log(`OpenAI-compatible API at http://localhost:${PORT}/v1/chat/completions`);
});