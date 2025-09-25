const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const http = require('http');

// Load environment variables
require('dotenv').config();

// Import modular components
const { setupOpenAIRoutes } = require('./routes/openai');
const { setupMagicCamRoutes } = require('./routes/magic-cam');
const { setupHealthRoutes } = require('./routes/health');
const { setupDebugRoutes } = require('./routes/debug');
const { setupMCPRoutes } = require('./routes/mcp');
const { setupTwilioRoutes } = require('./routes/twilio');
const { setupSocketHandler } = require('./socket/socket-handler');
const { DeviceIdManager } = require('./utils/device-id-manager');
const { DatabaseManager } = require('./utils/database');
const { MCPManager } = require('./utils/mcp-manager');
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

// Initialize database and device ID manager
const database = new DatabaseManager();
const deviceIdManager = new DeviceIdManager(database);
const mcpManager = new MCPManager(database, deviceIdManager);

// Middleware
app.use(cors());
app.use(express.json());

// Trust proxy for Cloudflare Tunnel
app.set('trust proxy', 1);

// Setup routes FIRST (before static file serving)
setupOpenAIRoutes(app, io, connectedR1s, conversationHistory, pendingRequests, requestDeviceMap, deviceIdManager, mcpManager);
setupMagicCamRoutes(app, connectedR1s);
setupHealthRoutes(app, connectedR1s);
setupDebugRoutes(app, connectedR1s, debugStreams, deviceLogs, debugDataStore, performanceMetrics);
setupMCPRoutes(app, io, connectedR1s, mcpManager, deviceIdManager);
setupTwilioRoutes(app, io, connectedR1s, conversationHistory, pendingRequests, requestDeviceMap, database);

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

// Serve React control panel build files
app.use(express.static(path.join(__dirname, '..', 'r1-control-panel', 'build')));

// Serve the React control panel at root (LAST)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'r1-control-panel', 'build', 'index.html'));
});

// Serve public static files for fallback (CSS, JS, images)
app.use('/static', express.static(path.join(__dirname, '..', 'public')));

// Note: No catch-all route needed since React app is served at root with static files

// Serve the device testing interface at /test
app.get('/test', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>R1 Device API Tester</title>
    <style>
        :root {
            --bg0: #282828;
            --bg1: #3c3836;
            --bg2: #504945;
            --bg3: #665c54;
            --bg4: #7c6f64;
            --fg0: #fbf1c7;
            --fg1: #ebdbb2;
            --fg2: #d5c4a1;
            --fg3: #bdae93;
            --fg4: #a89984;
            --red: #fb4934;
            --green: #b8bb26;
            --yellow: #fabd2f;
            --blue: #83a598;
            --purple: #d3869b;
            --aqua: #8ec07c;
            --orange: #fe8019;
            --red-dim: #cc241d;
            --green-dim: #98971a;
            --yellow-dim: #d79921;
            --blue-dim: #458588;
            --purple-dim: #b16286;
            --aqua-dim: #689d6a;
            --orange-dim: #d65d0e;
        }

        * {
            box-sizing: border-box;
        }

        body {
            font-family: 'JetBrains Mono', 'Fira Code', 'Monaco', monospace;
            background: linear-gradient(135deg, var(--bg0) 0%, var(--bg1) 100%);
            color: var(--fg1);
            margin: 0;
            padding: 20px;
            min-height: 100vh;
            position: relative;
            overflow-x: hidden;
        }

        body::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background:
                radial-gradient(circle at 20% 80%, rgba(168, 153, 132, 0.1) 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, rgba(131, 165, 152, 0.1) 0%, transparent 50%);
            pointer-events: none;
            animation: pulse 4s ease-in-out infinite alternate;
        }

        @keyframes pulse {
            from { opacity: 0.3; }
            to { opacity: 0.6; }
        }

        .container {
            max-width: 900px;
            margin: 0 auto;
            position: relative;
            z-index: 1;
        }

        h1 {
            color: var(--yellow);
            text-align: center;
            margin-bottom: 30px;
            font-size: 2.5em;
            font-weight: 700;
            text-shadow: 0 0 20px rgba(250, 189, 47, 0.5);
            letter-spacing: 2px;
            animation: glow 2s ease-in-out infinite alternate;
        }

        @keyframes glow {
            from { text-shadow: 0 0 20px rgba(250, 189, 47, 0.5); }
            to { text-shadow: 0 0 30px rgba(250, 189, 47, 0.8); }
        }

        .device-input {
            background: linear-gradient(135deg, var(--bg1) 0%, var(--bg2) 100%);
            border: 2px solid var(--yellow);
            border-radius: 12px;
            padding: 25px;
            margin-bottom: 25px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(10px);
            position: relative;
            overflow: hidden;
        }

        .device-input::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(250, 189, 47, 0.1), transparent);
            transition: left 0.5s;
        }

        .device-input:hover::before {
            left: 100%;
        }

        .input-group {
            margin-bottom: 20px;
            position: relative;
        }

        label {
            display: block;
            margin-bottom: 8px;
            color: var(--aqua);
            font-weight: 600;
            font-size: 14px;
            text-shadow: 0 0 5px rgba(142, 192, 124, 0.5);
            letter-spacing: 0.5px;
        }

        input, textarea {
            width: 100%;
            padding: 12px 16px;
            background: linear-gradient(135deg, var(--bg0), var(--bg1));
            border: 2px solid var(--bg3);
            border-radius: 8px;
            color: var(--fg1);
            font-family: inherit;
            font-size: 14px;
            transition: all 0.3s ease;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        input:focus, textarea:focus {
            outline: none;
            border-color: var(--yellow);
            box-shadow: 0 0 12px rgba(250, 189, 47, 0.3);
            transform: translateY(-1px);
        }

        textarea {
            resize: vertical;
            min-height: 80px;
        }

        button {
            background: linear-gradient(135deg, var(--green-dim), var(--green));
            color: var(--bg0);
            border: 2px solid var(--green);
            padding: 12px 24px;
            border-radius: 8px;
            cursor: pointer;
            font-family: inherit;
            font-size: 14px;
            font-weight: 600;
            margin-right: 12px;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            position: relative;
            overflow: hidden;
        }

        button::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
            transition: left 0.5s;
        }

        button:hover::before {
            left: 100%;
        }

        button:hover {
            background: linear-gradient(135deg, var(--green), var(--aqua));
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
        }

        button:disabled {
            background: var(--bg3);
            color: var(--fg4);
            border-color: var(--bg4);
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }

        .response {
            background: linear-gradient(135deg, var(--bg1) 0%, var(--bg2) 100%);
            border: 2px solid var(--blue);
            border-radius: 12px;
            padding: 25px;
            margin-top: 25px;
            white-space: pre-wrap;
            font-family: inherit;
            max-height: 500px;
            overflow-y: auto;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(10px);
            position: relative;
        }

        .response::-webkit-scrollbar {
            width: 8px;
        }

        .response::-webkit-scrollbar-track {
            background: var(--bg2);
            border-radius: 4px;
        }

        .response::-webkit-scrollbar-thumb {
            background: var(--blue);
            border-radius: 4px;
        }

        .response::-webkit-scrollbar-thumb:hover {
            background: var(--aqua);
        }

        .status {
            text-align: center;
            margin: 25px 0;
            padding: 15px;
            border-radius: 8px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border: 2px solid transparent;
            position: relative;
            overflow: hidden;
        }

        .status::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
            transition: left 0.5s;
        }

        .status.success {
            background: linear-gradient(135deg, var(--green-dim), var(--green));
            color: var(--bg0);
            border-color: var(--green);
            box-shadow: 0 0 15px rgba(184, 187, 38, 0.3);
        }

        .status.error {
            background: linear-gradient(135deg, var(--red-dim), var(--red));
            color: var(--fg0);
            border-color: var(--red);
            box-shadow: 0 0 15px rgba(251, 73, 52, 0.3);
        }

        .status.info {
            background: linear-gradient(135deg, var(--blue-dim), var(--blue));
            color: var(--fg0);
            border-color: var(--blue);
            box-shadow: 0 0 15px rgba(131, 165, 152, 0.3);
        }

        .examples {
            background: linear-gradient(135deg, var(--bg1) 0%, var(--bg2) 100%);
            border: 2px solid var(--orange);
            border-radius: 12px;
            padding: 25px;
            margin-bottom: 25px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(10px);
        }

        .examples h3 {
            color: var(--orange);
            margin-top: 0;
            font-size: 18px;
            text-shadow: 0 0 10px rgba(254, 128, 25, 0.5);
            letter-spacing: 0.5px;
        }

        .example-code {
            background: linear-gradient(135deg, var(--bg0), var(--bg1));
            padding: 15px;
            border-radius: 8px;
            margin: 15px 0;
            font-family: inherit;
            overflow-x: auto;
            border: 1px solid var(--bg3);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            position: relative;
        }

        .example-code::before {
            content: '$';
            position: absolute;
            top: 15px;
            left: 15px;
            color: var(--green);
            font-weight: bold;
        }

        .example-code pre {
            margin: 0 0 0 20px;
            color: var(--fg1);
        }

        .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid var(--bg3);
            border-radius: 50%;
            border-top-color: var(--yellow);
            animation: spin 1s ease-in-out infinite;
            margin-right: 10px;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
            body {
                padding: 15px;
            }

            h1 {
                font-size: 2em;
            }

            .device-input, .examples, .response {
                padding: 20px;
            }

            button {
                padding: 10px 20px;
                font-size: 13px;
                margin-right: 8px;
                margin-bottom: 6px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>R1 Device API Tester</h1>

        <div class="examples">
            <h3>Device ID Format</h3>
            <p>Device IDs follow the format: <code>adjective-noun-number</code></p>
            <p>Examples: <code>red-fox-42</code>, <code>blue-wolf-7</code>, <code>quick-bird-15</code></p>

            <h3>API Usage with PIN Authentication</h3>
            <div class="example-code">
curl -X POST http://localhost:5482/red-fox-42/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer 123456" \\
  -d '{
    "messages": [{"role": "user", "content": "Hello R1!"}],
    "model": "r1-command",
    "temperature": 0.7
  }'
            </div>
            <p><strong>Note:</strong> Each device has a unique 6-digit PIN code displayed on the device. Use this PIN as the Bearer token for authentication.</p>
        </div>

        <div class="device-input">
            <div class="input-group">
                <label for="deviceId">Device ID:</label>
                <input type="text" id="deviceId" placeholder="e.g., red-fox-42" />
            </div>

            <div class="input-group">
                <label for="pinCode">PIN Code (API Key):</label>
                <input type="text" id="pinCode" placeholder="6-digit PIN code" />
            </div>

            <div class="input-group">
                <label for="message">Message:</label>
                <textarea id="message" rows="3" placeholder="Enter your message to the R1 device...">Hello R1! How are you today?</textarea>
            </div>

            <button onclick="testDevice()">Test Device</button>
            <button onclick="getModels()">Get Models</button>
            <button onclick="clearResponse()">Clear</button>
        </div>

        <div id="status" class="status info" style="display: none;"></div>

        <div class="response" id="response" style="display: none;"></div>
    </div>

    <script>
        async function showStatus(message, type = 'info') {
            const statusEl = document.getElementById('status');
            statusEl.textContent = message;
            statusEl.className = \`status \${type}\`;
            statusEl.style.display = 'block';
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 5000);
        }

        async function testDevice() {
            const deviceId = document.getElementById('deviceId').value.trim();
            const pinCode = document.getElementById('pinCode').value.trim();
            const message = document.getElementById('message').value.trim();

            if (!deviceId) {
                showStatus('Please enter a device ID', 'error');
                return;
            }

            if (!message) {
                showStatus('Please enter a message', 'error');
                return;
            }

            // Check if PIN is required
            const deviceInfo = await checkDeviceInfo(deviceId);
            if (!deviceInfo) return;

            if (deviceInfo.pinEnabled && !pinCode) {
                showStatus('Please enter a PIN code', 'error');
                return;
            }

            const button = document.querySelector('button[onclick="testDevice()"]');
            const originalText = button.textContent;
            button.innerHTML = '<div class="loading"></div> Testing...';
            button.disabled = true;

            try {
                const headers = {
                    'Content-Type': 'application/json'
                };

                if (deviceInfo.pinEnabled && pinCode) {
                    headers['Authorization'] = \`Bearer \${pinCode}\`;
                }

                const response = await fetch(\`/\${deviceId}/v1/chat/completions\`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({
                        messages: [{ role: 'user', content: message }],
                        model: 'r1-command',
                        temperature: 0.7,
                        max_tokens: 150
                    })
                });

                const data = await response.json();

                if (response.ok) {
                    showStatus('Request sent successfully!', 'success');
                    displayResponse(data);
                } else {
                    showStatus(\`Error: \${data.error?.message || 'Unknown error'}\`, 'error');
                }
            } catch (error) {
                showStatus(\`Network error: \${error.message}\`, 'error');
            } finally {
                button.textContent = originalText;
                button.disabled = false;
            }
        }

        async function getModels() {
            const deviceId = document.getElementById('deviceId').value.trim();
            const pinCode = document.getElementById('pinCode').value.trim();

            if (!deviceId) {
                showStatus('Please enter a device ID', 'error');
                return;
            }

            // Check if PIN is required
            const deviceInfo = await checkDeviceInfo(deviceId);
            if (!deviceInfo) return;

            if (deviceInfo.pinEnabled && !pinCode) {
                showStatus('Please enter a PIN code', 'error');
                return;
            }

            try {
                const headers = {};
                if (deviceInfo.pinEnabled && pinCode) {
                    headers['Authorization'] = \`Bearer \${pinCode}\`;
                }

                const response = await fetch(\`/\${deviceId}/v1/models\`, {
                    headers: headers
                });
                const data = await response.json();

                if (response.ok) {
                    showStatus('Models retrieved successfully!', 'success');
                    displayResponse(data);
                } else {
                    showStatus(\`Error: \${data.error?.message || 'Unknown error'}\`, 'error');
                }
            } catch (error) {
                showStatus(\`Network error: \${error.message}\`, 'error');
            }
        }

        async function checkDeviceInfo(deviceId) {
            try {
                const response = await fetch(\`/\${deviceId}/info\`);
                if (response.ok) {
                    return await response.json();
                } else {
                    showStatus('Device not found', 'error');
                    return null;
                }
            } catch (error) {
                showStatus('Failed to check device info', 'error');
                return null;
            }
        }

        function displayResponse(data) {
            const responseEl = document.getElementById('response');
            responseEl.textContent = JSON.stringify(data, null, 2);
            responseEl.style.display = 'block';
        }

        function clearResponse() {
            document.getElementById('response').style.display = 'none';
            document.getElementById('status').style.display = 'none';
        }

        // Auto-focus device ID input
        document.getElementById('deviceId').focus();
    </script>
</body>
</html>
  `);
});

// PIN management endpoints
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
    await database.disableDevicePin(deviceId);

    console.log(`🔓 PIN disabled for device: ${deviceId}`);
    res.json({ success: true, message: 'PIN disabled successfully' });
  } catch (error) {
    console.error('Error disabling PIN:', error);
    res.status(500).json({ error: { message: 'Internal server error', type: 'server_error' } });
  }
});

app.post('/:deviceId/enable-pin', async (req, res) => {
  const { deviceId } = req.params;
  const { newPin } = req.body;

  if (!newPin || newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
    return res.status(400).json({ error: { message: 'PIN must be exactly 6 digits', type: 'validation_error' } });
  }

  try {
    // Update the PIN in database
    await database.updateDevicePin(deviceId, newPin);

    console.log(`🔐 PIN enabled for device: ${deviceId}`);
    res.json({ success: true, message: 'PIN enabled successfully', pinCode: newPin });
  } catch (error) {
    console.error('Error enabling PIN:', error);
    res.status(500).json({ error: { message: 'Internal server error', type: 'server_error' } });
  }
});

app.post('/:deviceId/change-pin', async (req, res) => {
  const { deviceId } = req.params;
  const { currentPin, newPin } = req.body;

  if (!currentPin || !newPin || newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
    return res.status(400).json({ error: { message: 'Invalid PIN format', type: 'validation_error' } });
  }

  try {
    // Verify current PIN
    const deviceInfo = await deviceIdManager.getDeviceInfoFromDB(deviceId);
    if (!deviceInfo || deviceInfo.pin_code !== currentPin) {
      return res.status(403).json({ error: { message: 'Invalid current PIN code', type: 'auth_error' } });
    }

    // Update the PIN
    await database.updateDevicePin(deviceId, newPin);

    console.log(`🔄 PIN changed for device: ${deviceId}`);
    res.json({ success: true, message: 'PIN changed successfully', pinCode: newPin });
  } catch (error) {
    console.error('Error changing PIN:', error);
    res.status(500).json({ error: { message: 'Internal server error', type: 'server_error' } });
  }
});

// Setup socket handler
setupSocketHandler(io, connectedR1s, conversationHistory, pendingRequests, requestDeviceMap, debugStreams, deviceLogs, debugDataStore, performanceMetrics, deviceIdManager, mcpManager);

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
  performanceMetrics,
  deviceIdManager,
  mcpManager
};

pluginManager.initPlugins(app, io, sharedState);

// Start server
const PORT = process.env.PORT || 5482;

// Check if React builds exist
const checkBuilds = () => {
  const controlPanelBuild = path.join(__dirname, '..', 'r1-control-panel', 'build', 'index.html');
  const creationBuild = path.join(__dirname, '..', 'creation-react', 'dist', 'index.html');
  
  const fs = require('fs');
  
  if (!fs.existsSync(controlPanelBuild)) {
    console.warn('⚠️  R1 Control Panel build not found. Run: npm run build-control-panel');
  }
  
  if (!fs.existsSync(creationBuild)) {
    console.warn('⚠️  Creation React build not found. Run: npm run build-creation');
  }
  
  if (!fs.existsSync(controlPanelBuild) && !fs.existsSync(creationBuild)) {
    console.warn('💡 Build all React UIs with: npm run build-all');
  }
};

// Initialize database before starting server
database.init().then(async () => {
  console.log('Database initialized successfully');
  
  // Initialize MCP manager after database is ready
  await mcpManager.initialize();
  console.log('MCP manager initialized successfully');
  
  checkBuilds();

  server.listen(PORT, () => {
    console.log(`🚀 R-API server running on http://localhost:${PORT}`);
    console.log(`📡 Socket.IO server available at /socket.io (WebSocket+polling compatible)`);
    console.log(`🎛️  React Control Panel available at http://localhost:${PORT}`);
    console.log(`🔌 MCP Management available at http://localhost:${PORT} (MCP Servers tab)`);
    console.log(`🎨 Creation React UI available at http://localhost:${PORT}/creation`);
    console.log(`🔗 Device-specific API at http://localhost:${PORT}/[device-id]/v1/chat/completions`);
    console.log(`🔧 Loaded plugins: ${pluginManager.getAllPlugins().join(', ') || 'none'}`);
    console.log(`\n💡 Quick start: npm run all`);
  });
}).catch((error) => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});

// Graceful shutdown handling
let isShuttingDown = false;
let shutdownAttempts = 0;

async function gracefulShutdown(signal) {
  shutdownAttempts++;
  
  if (shutdownAttempts > 1) {
    console.log(`\n🚨 Force shutdown requested (attempt ${shutdownAttempts})`);
    console.log('💀 Forcing immediate exit...');
    process.exit(1);
  }
  
  if (isShuttingDown) {
    console.log('⚠️ Shutdown already in progress... Press Ctrl+C again to force exit');
    return;
  }
  
  isShuttingDown = true;
  console.log(`\n🛑 Received ${signal}, shutting down R-API server...`);
  console.log('💡 Press Ctrl+C again to force immediate shutdown');
  
  try {
    // Shutdown MCP manager first with timeout
    if (mcpManager) {
      console.log('🔄 Shutting down MCP manager...');
      const mcpShutdownPromise = mcpManager.shutdown();
      const mcpTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('MCP shutdown timeout')), 5000)
      );
      
      try {
        await Promise.race([mcpShutdownPromise, mcpTimeout]);
        console.log('✅ MCP servers shut down');
      } catch (error) {
        console.log('⚠️ MCP shutdown timed out, continuing...');
      }
    }
    
    // Close database connection
    if (database) {
      try {
        database.close();
        console.log('✅ Database connection closed');
      } catch (error) {
        console.log('⚠️ Database close error, continuing...');
      }
    }
    
    // Close HTTP server
    server.close(() => {
      console.log('✅ HTTP server closed');
      process.exit(0);
    });
    
    // Force exit after 3 seconds if graceful shutdown fails
    setTimeout(() => {
      console.log('⚠️ Forcing shutdown after timeout');
      process.exit(1);
    }, 3000);
    
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});
