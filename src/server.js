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
const { DeviceIdManager } = require('./utils/device-id-manager');
const { DatabaseManager } = require('./utils/database');
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

// Middleware
app.use(cors());
app.use(express.json());

// Trust proxy for Cloudflare Tunnel
app.set('trust proxy', 1);

// Setup routes FIRST (before static file serving)
setupOpenAIRoutes(app, io, connectedR1s, conversationHistory, pendingRequests, requestDeviceMap, deviceIdManager);
setupMagicCamRoutes(app, connectedR1s);
setupHealthRoutes(app, connectedR1s);
setupDebugRoutes(app, connectedR1s, debugStreams, deviceLogs, debugDataStore, performanceMetrics);

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

// Serve the device testing interface at root (LAST)
app.get('/', (req, res) => {
  res.send(`
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>R1 Device API Tester</title>
    <style>
        body {
            font-family: 'Monaco', 'Menlo', monospace;
            background: #1a1a1a;
            color: #d4d4d4;
            margin: 0;
            padding: 20px;
            min-height: 100vh;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        h1 {
            color: #4ecdc4;
            text-align: center;
            margin-bottom: 30px;
        }
        .device-input {
            background: #2d2d2d;
            border: 1px solid #444;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }
        .input-group {
            margin-bottom: 15px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            color: #80ccff;
        }
        input, textarea {
            width: 100%;
            padding: 8px 12px;
            background: #1a1a1a;
            border: 1px solid #444;
            border-radius: 4px;
            color: #d4d4d4;
            font-family: inherit;
            font-size: 14px;
        }
        input:focus, textarea:focus {
            outline: none;
            border-color: #4ecdc4;
        }
        button {
            background: #28a745;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-family: inherit;
            font-size: 14px;
            margin-right: 10px;
        }
        button:hover {
            background: #218838;
        }
        button:disabled {
            background: #6c757d;
            cursor: not-allowed;
        }
        .response {
            background: #2d2d2d;
            border: 1px solid #444;
            border-radius: 8px;
            padding: 20px;
            margin-top: 20px;
            white-space: pre-wrap;
            font-family: inherit;
            max-height: 400px;
            overflow-y: auto;
        }
        .status {
            text-align: center;
            margin: 20px 0;
            padding: 10px;
            border-radius: 4px;
        }
        .status.success {
            background: #155724;
            color: #d4edda;
            border: 1px solid #28a745;
        }
        .status.error {
            background: #721c24;
            color: #f8d7da;
            border: 1px solid #dc3545;
        }
        .status.info {
            background: #1a2a3a;
            color: #80ccff;
            border: 1px solid #4ecdc4;
        }
        .examples {
            background: #2d2d2d;
            border: 1px solid #444;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }
        .examples h3 {
            color: #ffcc80;
            margin-top: 0;
        }
        .example-code {
            background: #1a1a1a;
            padding: 10px;
            border-radius: 4px;
            margin: 10px 0;
            font-family: inherit;
            overflow-x: auto;
        }
        .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 2px solid #444;
            border-radius: 50%;
            border-top-color: #4ecdc4;
            animation: spin 1s ease-in-out infinite;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
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
curl -X POST http://localhost:5482/device-red-fox-42/v1/chat/completions \\
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

            if (!pinCode) {
                showStatus('Please enter a PIN code', 'error');
                return;
            }

            if (!message) {
                showStatus('Please enter a message', 'error');
                return;
            }

            const button = document.querySelector('button[onclick="testDevice()"]');
            const originalText = button.textContent;
            button.innerHTML = '<div class="loading"></div> Testing...';
            button.disabled = true;

            try {
                const response = await fetch(\`/device-\${deviceId}/v1/chat/completions\`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': \`Bearer \${pinCode}\`
                    },
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

            if (!pinCode) {
                showStatus('Please enter a PIN code', 'error');
                return;
            }

            try {
                const response = await fetch(\`/device-\${deviceId}/v1/models\`, {
                    headers: {
                        'Authorization': \`Bearer \${pinCode}\`
                    }
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

// Setup socket handler
setupSocketHandler(io, connectedR1s, conversationHistory, pendingRequests, requestDeviceMap, debugStreams, deviceLogs, debugDataStore, performanceMetrics, deviceIdManager);

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
  deviceIdManager
};

pluginManager.initPlugins(app, io, sharedState);

// Start server
const PORT = process.env.PORT || 5482;

// Initialize database before starting server
database.init().then(() => {
  console.log('Database initialized successfully');

  server.listen(PORT, () => {
    console.log(`R-API server running on http://localhost:${PORT}`);
    console.log(`Socket.IO server available at /socket.io (WebSocket+polling compatible)`);
    console.log(`R1 Creation available at http://localhost:${PORT}`);
    console.log(`Device-specific API at http://localhost:${PORT}/device-{deviceId}/v1/chat/completions`);
    console.log(`Loaded plugins: ${pluginManager.getAllPlugins().join(', ') || 'none'}`);
  });
}).catch((error) => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});
