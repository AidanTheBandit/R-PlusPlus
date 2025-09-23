const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const http = require('http');

// Import modular components
const { setupOpenAIRoutes } = require('./routes/openai');
const { setupMagicCamRoutes } = require('./routes/magic-cam');
const { setupHealthRoutes } = require('./routes/health');
const { setupDebugRoutes } = require('./routes/debug');
const { setupSocketHandler } = require('./socket/socket-handler');
const PluginManager = require('./plugins/plugin-manager');

const app = express();
const server = http.createServer(app);

// Socket.IO server for R1 communication - compatible with ancient Android WebView
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Shared state
const connectedR1s = new Map();
const conversationHistory = new Map(); // deviceId -> array of messages
const pendingRequests = new Map();
const requestDeviceMap = new Map();

// Debug data stores
const debugStreams = new Map(); // deviceId -> debug data history
const deviceLogs = new Map(); // deviceId -> logs array
const debugDataStore = new Map(); // deviceId -> debug data
const performanceMetrics = new Map(); // deviceId -> metrics array

// Middleware
app.use(cors());
app.use(express.json());

// Trust proxy for Cloudflare Tunnel
app.set('trust proxy', 1);

// Serve React creation assets from root for proper loading
app.use('/assets', express.static(path.join(__dirname, '..', 'creation-react', 'dist', 'assets'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
  }
}));

// Serve creation assets with proper MIME types
app.use('/creation', express.static(path.join(__dirname, '..', 'creation-react', 'dist'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Serve the R1 creation at root (updated to serve React app)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'creation-react', 'dist', 'index.html'));
});

// Setup routes
setupOpenAIRoutes(app, io, connectedR1s, conversationHistory, pendingRequests, requestDeviceMap);
setupMagicCamRoutes(app, connectedR1s);
setupHealthRoutes(app, connectedR1s);
setupDebugRoutes(app, connectedR1s, debugStreams, deviceLogs, debugDataStore, performanceMetrics);

// Setup socket handler
setupSocketHandler(io, connectedR1s, conversationHistory, pendingRequests, requestDeviceMap, debugStreams, deviceLogs, debugDataStore, performanceMetrics);

// Plugin system
const pluginManager = new PluginManager();
pluginManager.loadPlugins();

const sharedState = {
  connectedR1s,
  conversationHistory,
  pendingRequests,
  requestDeviceMap,
  debugStreams,
  deviceLogs,
  debugDataStore,
  performanceMetrics
};

pluginManager.initPlugins(app, io, sharedState);

// Start server
const PORT = process.env.PORT || 5482;
server.listen(PORT, () => {
  console.log(`R-API server running on http://localhost:${PORT}`);
  console.log(`Socket.IO server available at /socket.io (WebSocket+polling compatible)`);
  console.log(`R1 Creation available at http://localhost:${PORT}`);
  console.log(`OpenAI-compatible API at http://localhost:${PORT}/v1/chat/completions`);
  console.log(`Loaded plugins: ${pluginManager.getAllPlugins().join(', ') || 'none'}`);
});
