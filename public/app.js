// R-API Control Panel Client
class RAPIClient {
    constructor() {
        this.apiCalls = 0;
        this.connectedDevices = new Map();
        this.messageHistory = [];
        this.serverStatus = 'checking';
        this.debugData = new Map(); // deviceId -> debug streams
        this.socket = null;
        this.metrics = {
            activeConnections: 0,
            messagesPerSecond: 0,
            avgResponseTime: 0,
            memoryUsage: 0,
            responseTimes: []
        };
        this.charts = {};
        this.logFilters = ['all', 'info', 'warn', 'error', 'debug'];
        this.activeLogFilter = 'all';
        this.enhancedLogs = [];
        this.messageCounter = 0;
        this.lastMessageTime = Date.now();

        this.init();
    }

    async init() {
        this.log('Initializing R-API Control Panel...');
        this.initSocketConnection();
        await this.checkServerStatus();
        this.startStatusPolling();
        this.loadDebugTool();
        this.initMetrics();
        this.initCharts();
        this.initConnectionStatus();
        this.loadMCPManager();
        this.log('Control panel ready');
    }

    initMetrics() {
        // Update metrics every second
        setInterval(() => {
            this.updateMetricsDisplay();
        }, 1000);

        // Calculate messages per second
        setInterval(() => {
            const now = Date.now();
            const timeDiff = (now - this.lastMessageTime) / 1000;
            this.metrics.messagesPerSecond = Math.round(this.messageCounter / timeDiff);
            this.messageCounter = 0;
            this.lastMessageTime = now;
        }, 5000);
    }

    initCharts() {
        // Initialize simple canvas-based charts
        this.createChart('connectionsChart', 'Connections Over Time');
        this.createChart('performanceChart', 'Performance Metrics');
        this.createChart('memoryChart', 'Memory Usage');
    }

    initConnectionStatus() {
        // Add connection status indicator
        const statusPanel = document.querySelector('.device-panel');
        if (statusPanel) {
            const statusDiv = document.createElement('div');
            statusDiv.className = 'connection-status';
            statusDiv.innerHTML = `
                <div class="status-indicator"></div>
                <div class="status-text">Connecting...</div>
                <div class="status-details">Initializing connection</div>
            `;
            statusPanel.insertBefore(statusDiv, statusPanel.firstChild);
        }
    }

    createChart(canvasId, title) {
        const container = document.createElement('div');
        container.className = 'chart-container';
        container.innerHTML = `
            <div class="chart-title">${title}</div>
            <canvas class="chart-canvas" id="${canvasId}"></canvas>
        `;

        // Add to a charts container if it exists, otherwise create one
        let chartsContainer = document.getElementById('chartsContainer');
        if (!chartsContainer) {
            chartsContainer = document.createElement('div');
            chartsContainer.id = 'chartsContainer';
            chartsContainer.style.display = 'grid';
            chartsContainer.style.gridTemplateColumns = 'repeat(auto-fit, minmax(200px, 1fr))';
            chartsContainer.style.gap = '12px';
            chartsContainer.style.marginBottom = '20px';

            const devicePanel = document.querySelector('.device-panel');
            if (devicePanel) {
                devicePanel.insertBefore(chartsContainer, devicePanel.querySelector('.quick-actions-panel'));
            }
        }
        chartsContainer.appendChild(container);

        this.charts[canvasId] = {
            canvas: document.getElementById(canvasId),
            data: [],
            maxDataPoints: 50
        };
    }

    updateChart(chartId, value) {
        const chart = this.charts[chartId];
        if (!chart || !chart.canvas) return;

        chart.data.push(value);
        if (chart.data.length > chart.maxDataPoints) {
            chart.data.shift();
        }

        this.drawChart(chart);
    }

    drawChart(chart) {
        const canvas = chart.canvas;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        if (chart.data.length === 0) return;

        // Find min/max values
        const maxValue = Math.max(...chart.data);
        const minValue = Math.min(...chart.data);

        // Draw line
        ctx.strokeStyle = '#007bff';
        ctx.lineWidth = 2;
        ctx.beginPath();

        chart.data.forEach((value, index) => {
            const x = (index / (chart.data.length - 1)) * width;
            const y = height - ((value - minValue) / (maxValue - minValue || 1)) * height;

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();
    }

    updateMetrics() {
        this.metrics.activeConnections = this.connectedDevices.size;

        // Calculate average response time
        if (this.metrics.responseTimes.length > 0) {
            this.metrics.avgResponseTime = Math.round(
                this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length
            );
        }

        // Update memory usage (simulated for demo)
        this.metrics.memoryUsage = Math.round(Math.random() * 50 + 20); // 20-70MB range

        this.updateMetricsDisplay();
    }

    updateMetricsDisplay() {
        document.getElementById('activeConnections').textContent = this.metrics.activeConnections;
        document.getElementById('messagesPerSecond').textContent = this.metrics.messagesPerSecond;
        document.getElementById('avgResponseTime').textContent = `${this.metrics.avgResponseTime}ms`;
        document.getElementById('memoryUsage').textContent = `${this.metrics.memoryUsage}MB`;

        // Update charts
        this.updateChart('connectionsChart', this.metrics.activeConnections);
        this.updateChart('performanceChart', this.metrics.avgResponseTime);
        this.updateChart('memoryChart', this.metrics.memoryUsage);
    }

    async loadDebugTool() {
        const debugContainer = document.getElementById('debugContainer');
        if (!debugContainer) return;

        try {
            // Load the debug tool HTML structure
            debugContainer.innerHTML = this.getDebugToolHTML();

            // Initialize debug tool functionality
            this.initDebugTool();

            this.log('Debug tool loaded successfully');
        } catch (error) {
            this.log(`Failed to load debug tool: ${error.message}`);
            debugContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #dc3545;">
                    Failed to load debug tool: ${error.message}
                </div>
            `;
        }
    }

    getDebugToolHTML() {
        return `
            <div class="debug-tool">
                <div class="debug-tabs">
                    <button class="debug-tab active" data-tab="hardware">Hardware</button>
                    <button class="debug-tab" data-tab="camera">Camera</button>
                    <button class="debug-tab" data-tab="llm">LLM</button>
                    <button class="debug-tab" data-tab="storage">Storage</button>
                    <button class="debug-tab" data-tab="audio">Audio</button>
                    <button class="debug-tab" data-tab="performance">Performance</button>
                    <button class="debug-tab" data-tab="device">Device Info</button>
                    <button class="debug-tab" data-tab="logs">Logs</button>
                </div>
                <div class="debug-content">
                    <div id="debug-sections">
                        ${this.getHardwareSectionHTML()}
                        ${this.getCameraSectionHTML()}
                        ${this.getLLMSectionHTML()}
                        ${this.getStorageSectionHTML()}
                        ${this.getAudioSectionHTML()}
                        ${this.getPerformanceSectionHTML()}
                        ${this.getDeviceSectionHTML()}
                        ${this.getLogsSectionHTML()}
                    </div>
                </div>
            </div>
        `;
    }

    getHardwareSectionHTML() {
        return `
            <div id="hardware-section" class="debug-section active">
                <h3>Hardware Debug</h3>
                <div class="debug-subsection">
                    <h4>Accelerometer</h4>
                    <div class="accelerometer-controls">
                        <button class="hw-btn" onclick="startAccelerometer()">Start Accelerometer</button>
                        <button class="hw-btn" onclick="stopAccelerometer()">Stop Accelerometer</button>
                    </div>
                    <div class="accelerometer-display">
                        <div class="accel-value">X: <span id="accel-x">0.00</span></div>
                        <div class="accel-value">Y: <span id="accel-y">0.00</span></div>
                        <div class="accel-value">Z: <span id="accel-z">0.00</span></div>
                    </div>
                </div>
                <div class="debug-subsection">
                    <h4>Hardware Buttons</h4>
                    <div class="button-indicators">
                        <div class="button-indicator">Side Button: Released</div>
                        <div class="button-indicator">Scroll Up: Released</div>
                        <div class="button-indicator">Scroll Down: Released</div>
                    </div>
                </div>
                <div class="debug-subsection">
                    <h4>Touch Simulation</h4>
                    <div class="touch-buttons">
                        <button class="hw-btn" onclick="simulateTouch(120, 141)">Center Tap</button>
                        <button class="hw-btn" onclick="simulateTouch(60, 70)">Top-Left</button>
                        <button class="hw-btn" onclick="simulateTouch(180, 212)">Bottom-Right</button>
                    </div>
                </div>
                <div class="debug-subsection">
                    <h4>Hardware Events</h4>
                    <div id="hardware-events" class="event-log"></div>
                </div>
            </div>
        `;
    }

    getCameraSectionHTML() {
        return `
            <div id="camera-section" class="debug-section">
                <h3>Camera Debug</h3>
                <div class="debug-subsection">
                    <h4>Camera Controls</h4>
                    <div class="camera-controls">
                        <button class="cam-btn" onclick="startCamera()">Start Camera</button>
                        <button class="cam-btn" onclick="stopCamera()">Stop Camera</button>
                        <button class="cam-btn" onclick="capturePhoto()">Capture Photo</button>
                        <button class="cam-btn" onclick="switchCamera()">Switch Camera</button>
                        <button class="cam-btn" onclick="testCameraCapabilities()">Test Capabilities</button>
                    </div>
                    <div class="camera-status">Status: Inactive</div>
                </div>
                <div class="debug-subsection">
                    <h4>Video Preview</h4>
                    <div class="video-container">
                        <div class="video-placeholder">Camera not active</div>
                    </div>
                </div>
                <div class="debug-subsection">
                    <h4>Camera Events</h4>
                    <div id="camera-events" class="event-log"></div>
                </div>
            </div>
        `;
    }

    getLLMSectionHTML() {
        return `
            <div id="llm-section" class="debug-section">
                <h3>LLM & Messaging Debug</h3>
                <div class="debug-subsection">
                    <h4>Send Message</h4>
                    <div class="message-input">
                        <textarea id="llm-message" placeholder="Type a message to send to the LLM..." rows="2"></textarea>
                        <div class="message-controls">
                            <label><input type="checkbox" id="use-llm" checked> Use LLM</label>
                            <button class="llm-btn" onclick="sendLLMMessage()">Send</button>
                        </div>
                    </div>
                </div>
                <div class="debug-subsection">
                    <h4>Quick Actions</h4>
                    <div class="quick-actions">
                        <button class="llm-btn" onclick="askLLMSpeak()">Ask to Speak</button>
                        <button class="llm-btn" onclick="askLLMJSON()">Request JSON</button>
                        <button class="llm-btn" onclick="testQuickResponses()">Test Responses</button>
                        <button class="llm-btn clear" onclick="clearLLMHistory()">Clear History</button>
                    </div>
                </div>
                <div class="debug-subsection">
                    <h4>Message History</h4>
                    <div id="message-history" class="message-history"></div>
                </div>
                <div class="debug-subsection">
                    <h4>LLM Events</h4>
                    <div id="llm-events" class="event-log"></div>
                </div>
            </div>
        `;
    }

    getStorageSectionHTML() {
        return `
            <div id="storage-section" class="debug-section">
                <h3>Storage Debug</h3>
                <div class="debug-subsection">
                    <h4>Storage Operations</h4>
                    <div class="storage-controls">
                        <button class="storage-btn" onclick="loadStorageData()">Refresh Data</button>
                        <button class="storage-btn" onclick="testStorageCapabilities()">Test Capabilities</button>
                        <button class="storage-btn clear" onclick="clearStorage('plain')">Clear Plain</button>
                        <button class="storage-btn clear" onclick="clearStorage('secure')">Clear Secure</button>
                    </div>
                </div>
                <div class="debug-subsection">
                    <h4>Add Storage Item</h4>
                    <div class="add-item-form">
                        <select id="storage-type">
                            <option value="plain">Plain Storage</option>
                            <option value="secure">Secure Storage</option>
                        </select>
                        <input type="text" id="storage-key" placeholder="Key" />
                        <textarea id="storage-value" placeholder="Value (JSON for plain storage)" rows="2"></textarea>
                        <button class="storage-btn" onclick="setStorageItem()">Set Item</button>
                    </div>
                </div>
                <div class="debug-subsection">
                    <h4>Plain Storage</h4>
                    <div id="plain-storage" class="storage-items"></div>
                </div>
                <div class="debug-subsection">
                    <h4>Secure Storage</h4>
                    <div id="secure-storage" class="storage-items"></div>
                </div>
                <div class="debug-subsection">
                    <h4>Storage Events</h4>
                    <div id="storage-events" class="event-log"></div>
                </div>
            </div>
        `;
    }

    getAudioSectionHTML() {
        return `
            <div id="audio-section" class="debug-section">
                <h3>Audio Debug</h3>
                <div class="debug-subsection">
                    <h4>Audio Controls</h4>
                    <div class="audio-controls">
                        <button class="audio-btn" onclick="startRecording()">Start Recording</button>
                        <button class="audio-btn" onclick="stopRecording()">Stop Recording</button>
                        <button class="audio-btn" onclick="testAudioCapabilities()">Test Capabilities</button>
                        <button class="audio-btn clear" onclick="clearAudioHistory()">Clear History</button>
                    </div>
                    <div class="microphone-level">
                        <div class="level-label">Mic Level: <span id="mic-level">0</span></div>
                        <div class="level-bar">
                            <div id="level-fill" class="level-fill"></div>
                        </div>
                    </div>
                </div>
                <div class="debug-subsection">
                    <h4>Tone Generation</h4>
                    <div class="tone-controls">
                        <button class="audio-btn" onclick="playTone(440, 1000)">A4 (440Hz)</button>
                        <button class="audio-btn" onclick="playTone(523, 1000)">C5 (523Hz)</button>
                        <button class="audio-btn" onclick="playTone(659, 1000)">E5 (659Hz)</button>
                        <button class="audio-btn" onclick="playTone(784, 1000)">G5 (784Hz)</button>
                    </div>
                </div>
                <div class="debug-subsection">
                    <h4>Audio Recordings</h4>
                    <div id="audio-history" class="audio-history"></div>
                </div>
                <div class="debug-subsection">
                    <h4>Audio Events</h4>
                    <div id="audio-events" class="event-log"></div>
                </div>
            </div>
        `;
    }

    getPerformanceSectionHTML() {
        return `
            <div id="performance-section" class="debug-section">
                <h3>Performance Debug</h3>
                <div class="debug-subsection">
                    <h4>Performance Monitoring</h4>
                    <div class="performance-controls">
                        <button class="perf-btn" onclick="startFPSMonitoring()">Start FPS</button>
                        <button class="perf-btn" onclick="stopFPSMonitoring()">Stop FPS</button>
                        <button class="perf-btn" onclick="measureMemoryUsage()">Check Memory</button>
                        <button class="perf-btn" onclick="measureNetworkInfo()">Check Network</button>
                        <button class="perf-btn" onclick="runPerformanceTest()">Run Tests</button>
                        <button class="perf-btn" onclick="collectSystemInfo()">System Info</button>
                    </div>
                </div>
                <div class="debug-subsection">
                    <h4>Real-time Metrics</h4>
                    <div class="metrics-display">
                        <div class="metric-item">
                            <span class="metric-label">FPS:</span>
                            <span class="metric-value" id="fps-value">0</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">Memory:</span>
                            <span class="metric-value" id="memory-value">0MB / 0MB</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">Battery:</span>
                            <span class="metric-value" id="battery-value">0% ⚡</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">Network:</span>
                            <span class="metric-value" id="network-value">unknown</span>
                        </div>
                    </div>
                </div>
                <div class="debug-subsection">
                    <h4>Performance Events</h4>
                    <div id="performance-events" class="event-log"></div>
                </div>
            </div>
        `;
    }

    getDeviceSectionHTML() {
        return `
            <div id="device-section" class="debug-section">
                <h3>Device Information</h3>
                <div class="debug-subsection">
                    <h4>Device Diagnostics</h4>
                    <div class="device-controls">
                        <button class="device-btn" onclick="collectDeviceInfo()">Collect Info</button>
                        <button class="device-btn" onclick="detectCapabilities()">Detect Capabilities</button>
                        <button class="device-btn" onclick="testAPIConnectivity()">Test APIs</button>
                        <button class="device-btn" onclick="getR1Specifications()">R1 Specs</button>
                    </div>
                </div>
                <div class="debug-subsection">
                    <h4>R1 SDK Status</h4>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="info-label">Available:</span>
                            <span class="info-value" id="sdk-available">No</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Version:</span>
                            <span class="info-value" id="sdk-version">unknown</span>
                        </div>
                        <div class="info-item full-width">
                            <span class="info-label">Available APIs:</span>
                            <div id="api-list" class="api-list"></div>
                        </div>
                    </div>
                </div>
                <div class="debug-subsection">
                    <h4>Hardware APIs</h4>
                    <div id="hardware-apis" class="hardware-grid"></div>
                </div>
                <div class="debug-subsection">
                    <h4>Browser Capabilities</h4>
                    <div id="browser-capabilities" class="capabilities-grid"></div>
                </div>
                <div class="debug-subsection">
                    <h4>Device Events</h4>
                    <div id="device-events" class="event-log"></div>
                </div>
            </div>
        `;
    }

    getLogsSectionHTML() {
        return `
            <div id="logs-section" class="debug-section">
                <h3>Logs & Debugging</h3>
                <div class="debug-subsection">
                    <h4>Log Controls</h4>
                    <div class="log-controls">
                        <select id="log-filter">
                            <option value="all">All Levels</option>
                            <option value="debug">Debug</option>
                            <option value="info">Info</option>
                            <option value="warn">Warning</option>
                            <option value="error">Error</option>
                        </select>
                        <label class="auto-scroll">
                            <input type="checkbox" id="auto-scroll" checked>
                            Auto-scroll
                        </label>
                        <button class="log-btn" onclick="clearLogs()">Clear Logs</button>
                        <button class="log-btn" onclick="exportLogs()">Export Logs</button>
                        <button class="log-btn" onclick="fetchServerLogs()">Fetch Server Logs</button>
                        <button class="log-btn" onclick="testLogging()">Test Logging</button>
                    </div>
                </div>
                <div class="debug-subsection">
                    <h4>Log Statistics</h4>
                    <div class="log-stats">
                        <div class="stat-item">
                            <span class="stat-label">Total Logs:</span>
                            <span class="stat-value" id="total-logs">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Filtered:</span>
                            <span class="stat-value" id="filtered-logs">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Errors:</span>
                            <span class="stat-value error" id="error-count">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Warnings:</span>
                            <span class="stat-value warning" id="warning-count">0</span>
                        </div>
                    </div>
                </div>
                <div class="debug-subsection">
                    <h4>Log Output</h4>
                    <div class="logs-container">
                        <div id="logs-display" class="logs-display"></div>
                    </div>
                </div>
            </div>
        `;
    }

    initDebugTool() {
        // Initialize interface tabs
        const tabs = document.querySelectorAll('.interface-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const interfaceName = e.target.dataset.interface;
                this.switchInterface(interfaceName);
            });
        });

        // Initialize debug functionality
        this.initHardwareDebug();
        this.initCameraDebug();
        this.initLLMDebug();
        this.initStorageDebug();
        this.initAudioDebug();
        this.initPerformanceDebug();
        this.initDeviceDebug();
        this.initLogsDebug();
    }

    switchInterface(interfaceName) {
        // Update tab active states
        document.querySelectorAll('.interface-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-interface="${interfaceName}"]`).classList.add('active');

        // Update interface visibility
        document.querySelectorAll('.interface-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${interfaceName}Interface`).classList.add('active');

        // Load interface-specific data
        if (interfaceName === 'mcp') {
            this.loadMCPOverview();
            this.loadMCPData();
        }
    }

    async loadMCPManager() {
        const mcpContainer = document.getElementById('mcpContainer');
        if (!mcpContainer) return;

        try {
            mcpContainer.innerHTML = this.getMCPManagerHTML();
            this.initMCPManager();
            this.log('MCP manager loaded successfully');
        } catch (error) {
            this.log(`Failed to load MCP manager: ${error.message}`);
            mcpContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #dc3545;">
                    Failed to load MCP manager: ${error.message}
                </div>
            `;
        }
    }

    getMCPManagerHTML() {
        return `
            <div class="mcp-container">
                <div class="mcp-header">
                    <div>
                        <h3 style="margin: 0;">MCP Server Management</h3>
                        <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 12px;">Manage Model Context Protocol servers for connected R1 devices</p>
                    </div>
                    <div class="mcp-stats">
                        <div class="mcp-stat">
                            <div class="mcp-stat-value" id="mcp-total-servers">0</div>
                            <div class="mcp-stat-label">Total Servers</div>
                        </div>
                        <div class="mcp-stat">
                            <div class="mcp-stat-value" id="mcp-running-servers">0</div>
                            <div class="mcp-stat-label">Running</div>
                        </div>
                        <div class="mcp-stat">
                            <div class="mcp-stat-value" id="mcp-total-tools">0</div>
                            <div class="mcp-stat-label">Available Tools</div>
                        </div>
                    </div>
                    <div class="mcp-actions">
                        <button class="mcp-btn" onclick="showAddServerModal()">Add Server</button>
                        <button class="mcp-btn secondary" onclick="refreshMCPData()">Refresh</button>
                        <button class="mcp-btn secondary" onclick="showMCPLogs()">View Logs</button>
                    </div>
                </div>

                <div class="device-selector" style="margin-bottom: 15px;">
                    <label for="mcp-device-select" style="margin-right: 10px; font-weight: bold;">Select Device:</label>
                    <select id="mcp-device-select" onchange="loadMCPData()" style="padding: 5px; border-radius: 4px; border: 1px solid #ddd;">
                        <option value="">Select a device...</option>
                    </select>
                </div>

                <div id="mcp-servers-container">
                    <div style="text-align: center; padding: 40px; color: #666;">
                        Select a device to view MCP servers
                    </div>
                </div>
            </div>

            <!-- Add Server Modal -->
            <div id="addServerModal" class="mcp-modal">
                <div class="mcp-modal-content">
                    <div class="mcp-modal-header">
                        <div class="mcp-modal-title">Add MCP Server</div>
                        <button class="mcp-modal-close" onclick="hideAddServerModal()">&times;</button>
                    </div>
                    <div id="addServerForm">
                        <div class="mcp-form-group">
                            <label class="mcp-form-label">Choose Template:</label>
                            <div id="mcp-templates-container" class="mcp-templates-grid">
                                <!-- Templates will be loaded here -->
                            </div>
                        </div>
                        <div class="mcp-form-group">
                            <label class="mcp-form-label" for="server-name">Server Name:</label>
                            <input type="text" id="server-name" class="mcp-form-input" placeholder="e.g., filesystem, web-search" required>
                        </div>
                        <div class="mcp-form-group">
                            <label class="mcp-form-label" for="server-description">Description:</label>
                            <input type="text" id="server-description" class="mcp-form-input" placeholder="Brief description of the server">
                        </div>
                        <div class="mcp-form-group">
                            <label class="mcp-form-label" for="server-command">Command:</label>
                            <input type="text" id="server-command" class="mcp-form-input" placeholder="e.g., uvx, python, node" required>
                        </div>
                        <div class="mcp-form-group">
                            <label class="mcp-form-label" for="server-args">Arguments (JSON array):</label>
                            <textarea id="server-args" class="mcp-form-textarea" placeholder='["mcp-server-filesystem"]'></textarea>
                        </div>
                        <div class="mcp-form-group">
                            <label class="mcp-form-label" for="server-env">Environment Variables (JSON object):</label>
                            <textarea id="server-env" class="mcp-form-textarea" placeholder='{"API_KEY": "your-key"}'></textarea>
                        </div>
                        <div class="mcp-form-group">
                            <label class="mcp-form-label" for="server-auto-approve">Auto-approve Tools (JSON array):</label>
                            <textarea id="server-auto-approve" class="mcp-form-textarea" placeholder='["search", "read_file"]'></textarea>
                        </div>
                        <div class="mcp-form-group">
                            <label class="mcp-form-label">
                                <input type="checkbox" id="server-enabled" class="mcp-form-checkbox" checked>
                                Enable server immediately
                            </label>
                        </div>
                        <div style="display: flex; gap: 10px; justify-content: flex-end;">
                            <button class="mcp-btn secondary" onclick="hideAddServerModal()">Cancel</button>
                            <button class="mcp-btn" onclick="addMCPServer()">Add Server</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Logs Modal -->
            <div id="mcpLogsModal" class="mcp-modal">
                <div class="mcp-modal-content" style="max-width: 800px;">
                    <div class="mcp-modal-header">
                        <div class="mcp-modal-title">MCP Server Logs</div>
                        <button class="mcp-modal-close" onclick="hideMCPLogs()">&times;</button>
                    </div>
                    <div class="mcp-form-group">
                        <label class="mcp-form-label" for="log-server-filter">Filter by Server:</label>
                        <select id="log-server-filter" class="mcp-form-select" onchange="loadMCPLogs()">
                            <option value="">All Servers</option>
                        </select>
                    </div>
                    <div id="mcp-logs-display" class="mcp-logs-container">
                        Loading logs...
                    </div>
                    <div style="margin-top: 10px; display: flex; gap: 10px;">
                        <button class="mcp-btn secondary" onclick="loadMCPLogs()">Refresh</button>
                        <button class="mcp-btn secondary" onclick="clearMCPLogs()">Clear</button>
                    </div>
                </div>
            </div>
        `;
    }

    initMCPManager() {
        // Load device list
        this.loadDeviceList();

        // Load MCP templates
        this.loadMCPTemplates();

        // Load MCP overview
        this.loadMCPOverview();

        // Initialize MCP data
        this.mcpData = {
            servers: [],
            templates: [],
            logs: []
        };
        this.mcpOverview = null;
    }

    async loadDeviceList() {
        const deviceSelect = document.getElementById('mcp-device-select');
        if (!deviceSelect) return;

        try {
            // Clear existing options except the first one
            while (deviceSelect.children.length > 1) {
                deviceSelect.removeChild(deviceSelect.lastChild);
            }

            // Fetch devices from API
            const response = await fetch('/api/devices');
            const data = await response.json();

            if (response.ok && data.devices) {
                for (const device of data.devices) {
                    const option = document.createElement('option');
                    option.value = device.deviceId;
                    option.textContent = device.deviceId;
                    deviceSelect.appendChild(option);
                }
            } else {
                // Fallback to connected devices from socket
                for (const [deviceId] of this.connectedDevices) {
                    const option = document.createElement('option');
                    option.value = deviceId;
                    option.textContent = deviceId;
                    deviceSelect.appendChild(option);
                }
            }
        } catch (error) {
            this.log(`Failed to load device list: ${error.message}`);

            // Fallback to connected devices from socket
            for (const [deviceId] of this.connectedDevices) {
                const option = document.createElement('option');
                option.value = deviceId;
                option.textContent = deviceId;
                deviceSelect.appendChild(option);
            }
        }
    }

    async loadMCPTemplates() {
        try {
            const response = await fetch('/mcp/templates');
            const data = await response.json();

            this.mcpData.templates = data.templates;
            this.renderMCPTemplates();
        } catch (error) {
            this.log(`Failed to load MCP templates: ${error.message}`);
        }
    }

    renderMCPTemplates() {
        const container = document.getElementById('mcp-templates-container');
        if (!container) return;

        container.innerHTML = '';

        this.mcpData.templates.forEach(template => {
            const card = document.createElement('div');
            card.className = 'mcp-template-card';
            card.onclick = () => this.selectTemplate(template);
            card.innerHTML = `
                <div class="mcp-template-name">${template.displayName}</div>
                <div class="mcp-template-description">${template.description}</div>
            `;
            container.appendChild(card);
        });
    }

    selectTemplate(template) {
        // Remove previous selection
        document.querySelectorAll('.mcp-template-card').forEach(card => {
            card.classList.remove('selected');
        });

        // Select current template
        event.target.closest('.mcp-template-card').classList.add('selected');

        // Fill form with template data
        document.getElementById('server-name').value = template.name;
        document.getElementById('server-description').value = template.description;
        document.getElementById('server-command').value = template.command;
        document.getElementById('server-args').value = JSON.stringify(template.args, null, 2);
        document.getElementById('server-env').value = JSON.stringify(template.env, null, 2);
        document.getElementById('server-auto-approve').value = JSON.stringify(template.autoApprove, null, 2);
    }

    async loadMCPData() {
        const deviceId = document.getElementById('mcp-device-select').value;
        if (!deviceId) {
            document.getElementById('mcp-servers-container').innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666;">
                    Select a device to view MCP servers
                </div>
            `;
            return;
        }

        try {
            const response = await fetch(`/${deviceId}/mcp/servers`);
            const data = await response.json();

            this.mcpData.servers = data.servers || [];
            this.renderMCPServers();
            this.updateMCPStats();
        } catch (error) {
            this.log(`Failed to load MCP data: ${error.message}`);
            document.getElementById('mcp-servers-container').innerHTML = `
                <div style="text-align: center; padding: 40px; color: #dc3545;">
                    Failed to load MCP servers: ${error.message}
                </div>
            `;
        }
    }

    renderMCPServers() {
        const container = document.getElementById('mcp-servers-container');
        if (!container) return;

        if (this.mcpData.servers.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666;">
                    No MCP servers configured for this device
                    <br><br>
                    <button class="mcp-btn" onclick="showAddServerModal()">Add Your First Server</button>
                </div>
            `;
            return;
        }

        const serversGrid = document.createElement('div');
        serversGrid.className = 'mcp-servers-grid';

        this.mcpData.servers.forEach(server => {
            const card = this.createServerCard(server);
            serversGrid.appendChild(card);
        });

        container.innerHTML = '';
        container.appendChild(serversGrid);
    }

    createServerCard(server) {
        const card = document.createElement('div');
        card.className = `mcp-server-card ${server.running ? 'running' : (server.enabled ? 'stopped' : 'disabled')}`;

        const statusClass = server.running ? 'running' : (server.enabled ? 'stopped' : 'disabled');
        const statusText = server.running ? 'Running' : (server.enabled ? 'Stopped' : 'Disabled');

        card.innerHTML = `
            <div class="mcp-server-header">
                <div class="mcp-server-name">${server.name}</div>
                <div class="mcp-server-status ${statusClass}">${statusText}</div>
            </div>
            <div class="mcp-server-description">${server.config?.description || 'No description'}</div>
            <div class="mcp-server-details">
                <div class="mcp-server-detail">
                    <span class="mcp-server-detail-label">Command:</span>
                    <span>${server.config?.command || 'N/A'}</span>
                </div>
                <div class="mcp-server-detail">
                    <span class="mcp-server-detail-label">Tools:</span>
                    <span>${server.tools?.length || 0}</span>
                </div>
                <div class="mcp-server-detail">
                    <span class="mcp-server-detail-label">Uptime:</span>
                    <span>${server.running && server.startTime ? this.formatUptime(Date.now() - server.startTime) : 'N/A'}</span>
                </div>
                <div class="mcp-server-detail">
                    <span class="mcp-server-detail-label">Auto-approve:</span>
                    <span>${server.config?.auto_approve ? JSON.parse(server.config.auto_approve).length : 0} tools</span>
                </div>
            </div>
            <div class="mcp-server-actions">
                <button class="mcp-btn ${server.enabled ? 'danger' : ''}" onclick="toggleMCPServer('${server.name}', ${!server.enabled})">
                    ${server.enabled ? 'Disable' : 'Enable'}
                </button>
                <button class="mcp-btn secondary" onclick="viewServerTools('${server.name}')">Tools</button>
                <button class="mcp-btn secondary" onclick="editMCPServer('${server.name}')">Edit</button>
                <button class="mcp-btn danger" onclick="deleteMCPServer('${server.name}')">Delete</button>
            </div>
            ${server.tools && server.tools.length > 0 ? `
                <div class="mcp-tools-list">
                    <div class="mcp-tools-header">Available Tools:</div>
                    ${server.tools.slice(0, 3).map(tool => `
                        <div class="mcp-tool-item">
                            <span class="mcp-tool-name">${tool.name}</span>
                            <span class="mcp-tool-usage">Used ${tool.usage_count || 0} times</span>
                        </div>
                    `).join('')}
                    ${server.tools.length > 3 ? `<div style="font-size: 10px; color: #666; text-align: center;">+${server.tools.length - 3} more tools</div>` : ''}
                </div>
            ` : ''}
        `;

        return card;
    }

    updateMCPStats() {
        const totalServers = this.mcpData.servers.length;
        const runningServers = this.mcpData.servers.filter(s => s.running).length;
        const totalTools = this.mcpData.servers.reduce((sum, s) => sum + (s.tools?.length || 0), 0);

        document.getElementById('mcp-total-servers').textContent = totalServers;
        document.getElementById('mcp-running-servers').textContent = runningServers;
        document.getElementById('mcp-total-tools').textContent = totalTools;
    }

    async loadMCPOverview() {
        try {
            const response = await fetch('/api/mcp/overview');
            const data = await response.json();

            if (response.ok) {
                // Update global stats
                document.getElementById('mcp-total-servers').textContent = data.totalServers;
                document.getElementById('mcp-running-servers').textContent = data.runningServers;
                document.getElementById('mcp-total-tools').textContent = data.totalTools;

                // Store overview data
                this.mcpOverview = data;
            }
        } catch (error) {
            console.error('Failed to load MCP overview:', error);
        }
    }

    formatUptime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    initHardwareDebug() {
        // Hardware debug initialization
        this.hardwareEvents = [];
    }

    initCameraDebug() {
        // Camera debug initialization
        this.cameraEvents = [];
    }

    initLLMDebug() {
        // LLM debug initialization
        this.messageHistory = [];
        this.llmEvents = [];
    }

    initStorageDebug() {
        // Storage debug initialization
        this.storageEvents = [];
    }

    initAudioDebug() {
        // Audio debug initialization
        this.audioEvents = [];
        this.audioHistory = [];
    }

    initPerformanceDebug() {
        // Performance debug initialization
        this.performanceEvents = [];
        this.isMonitoringFPS = false;
    }

    initDeviceDebug() {
        // Device debug initialization
        this.deviceEvents = [];
    }

    initLogsDebug() {
        // Logs debug initialization
        this.clientLogs = [];
        this.serverLogs = [];

        // Override console methods to capture logs
        const originalConsole = {
            log: console.log,
            info: console.info,
            warn: console.warn,
            error: console.error,
            debug: console.debug
        };

        console.log = (...args) => {
            this.addClientLog('info', args.join(' '), 'console');
            originalConsole.log.apply(console, args);
        };

        console.info = (...args) => {
            this.addClientLog('info', args.join(' '), 'console');
            originalConsole.info.apply(console, args);
        };

        console.warn = (...args) => {
            this.addClientLog('warn', args.join(' '), 'console');
            originalConsole.warn.apply(console, args);
        };

        console.error = (...args) => {
            this.addClientLog('error', args.join(' '), 'console');
            originalConsole.error.apply(console, args);
        };

        console.debug = (...args) => {
            this.addClientLog('debug', args.join(' '), 'console');
            originalConsole.debug.apply(console, args);
        };

        this.addClientLog('info', 'Debug logging system initialized', 'system');
    }

    addClientLog(level, message, source = 'client') {
        const logEntry = {
            id: Date.now(),
            timestamp: new Date().toLocaleTimeString(),
            level,
            message,
            source
        };
        this.clientLogs.push(logEntry);
        this.updateLogsDisplay();

        // Send to server for centralized logging
        if (this.socket && this.socket.connected) {
            this.socket.emit('client_log', {
                deviceId: 'web-client',
                log: logEntry
            });
        }
    }

    updateLogsDisplay() {
        const logsDisplay = document.getElementById('logs-display');
        if (!logsDisplay) return;

        const filter = document.getElementById('log-filter').value;
        const autoScroll = document.getElementById('auto-scroll').checked;

        let filteredLogs = this.clientLogs;
        if (filter !== 'all') {
            filteredLogs = this.clientLogs.filter(log => log.level === filter);
        }

        // Update statistics
        document.getElementById('total-logs').textContent = this.clientLogs.length;
        document.getElementById('filtered-logs').textContent = filteredLogs.length;
        document.getElementById('error-count').textContent = this.clientLogs.filter(l => l.level === 'error').length;
        document.getElementById('warning-count').textContent = this.clientLogs.filter(l => l.level === 'warn').length;

        // Update display
        logsDisplay.innerHTML = filteredLogs.map(log =>
            `<div class="log-entry log-${log.level} log-source-${log.source}">
                <span class="log-timestamp">[${log.timestamp}]</span>
                <span class="log-level">[${log.level.toUpperCase()}]</span>
                <span class="log-source">[${log.source}]</span>
                <span class="log-message">${log.message}</span>
            </div>`
        ).join('');

        if (autoScroll) {
            logsDisplay.scrollTop = logsDisplay.scrollHeight;
        }
    }

    initSocketConnection() {
        // Initialize Socket.IO connection for real-time debug data
        this.socket = io('/', {
            path: '/socket.io',
            transports: ['websocket', 'polling']
        });

        this.socket.on('connect', () => {
            this.log('Connected to debug streaming server');
            this.updateConnectionStatus(true);
        });

        this.socket.on('disconnect', () => {
            this.log('Disconnected from debug streaming server');
            this.updateConnectionStatus(false);
        });

        // Listen for debug data from all devices
        this.socket.on('debug_data', (data) => {
            this.handleDebugData(data);
        });

        // Listen for device connections/disconnections
        this.socket.on('device_connected', (data) => {
            this.handleDeviceConnected(data);
        });

        this.socket.on('device_disconnected', (data) => {
            this.handleDeviceDisconnected(data);
        });

        this.socket.on('connect_error', (error) => {
            this.log(`Socket connection error: ${error.message}`);
            this.updateConnectionStatus(false);
        });
    }

    handleDeviceConnected(data) {
        this.connectedDevices.set(data.deviceId, {
            ...data,
            connectedAt: new Date().toISOString()
        });
        this.updateDeviceList();
        this.updateMetrics();
        this.log(`Device connected: ${data.deviceId}`);
        this.messageCounter++;
    }

    handleDeviceDisconnected(data) {
        this.connectedDevices.delete(data.deviceId);
        this.updateDeviceList();
        this.updateMetrics();
        this.log(`Device disconnected: ${data.deviceId}`);
    }

    updateConnectionStatus(connected) {
        const statusElement = document.querySelector('.connection-status');
        if (statusElement) {
            statusElement.classList.toggle('disconnected', !connected);
            const statusText = statusElement.querySelector('.status-text');
            const statusDetails = statusElement.querySelector('.status-details');
            if (statusText) {
                statusText.textContent = connected ? 'Connected' : 'Disconnected';
            }
            if (statusDetails) {
                statusDetails.textContent = connected ?
                    `Active connections: ${this.connectedDevices.size}` :
                    'Attempting to reconnect...';
            }
        }
    }

    handleDebugData(data) {
        const { type, deviceId, data: debugData, timestamp } = data;

        // Store debug data
        if (!this.debugData.has(deviceId)) {
            this.debugData.set(deviceId, {
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

        const deviceDebug = this.debugData.get(deviceId);
        if (deviceDebug[type]) {
            deviceDebug[type].push({
                ...debugData,
                timestamp,
                receivedAt: new Date().toISOString()
            });

            // Keep last 50 entries per type
            if (deviceDebug[type].length > 50) {
                deviceDebug[type].shift();
            }
        }

        // Log to console and update UI
        this.log(`[${deviceId}] ${type.toUpperCase()}: ${debugData.description || debugData.message || 'Debug data received'}`);

        // Update debug panel if visible
        this.updateDebugPanel(deviceId, type, debugData);
    }

    updateDebugPanel(deviceId, type, data) {
        // This would update a debug panel in the UI
        // For now, just log to the main log
        const logMessage = `[${deviceId}:${type}] ${data.description || data.message || JSON.stringify(data)}`;
        this.addChatMessage('system', 'Debug', logMessage);
    }

    // Debug data management methods
    async getDebugDevices() {
        try {
            const response = await fetch('/debug/devices');
            if (response.ok) {
                const data = await response.json();
                this.log(`Found ${data.devices.length} debug-enabled devices`);
                return data.devices;
            }
        } catch (error) {
            this.log(`Error fetching debug devices: ${error.message}`);
        }
        return [];
    }

    async getDeviceDebugHistory(deviceId, type = null, limit = 20) {
        try {
            const url = type
                ? `/debug/history/${deviceId}?type=${type}&limit=${limit}`
                : `/debug/history/${deviceId}?limit=${limit}`;

            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                this.log(`Fetched debug history for ${deviceId}`);
                return data.data;
            }
        } catch (error) {
            this.log(`Error fetching debug history: ${error.message}`);
        }
        return {};
    }

    async clearDeviceDebugData(deviceId, type = null) {
        try {
            const url = type
                ? `/debug/clear/${deviceId}?type=${type}`
                : `/debug/clear/${deviceId}`;

            const response = await fetch(url, { method: 'DELETE' });
            if (response.ok) {
                const data = await response.json();
                this.log(`Cleared debug data for ${deviceId}`);
                return data;
            }
        } catch (error) {
            this.log(`Error clearing debug data: ${error.message}`);
        }
        return null;
    }

    // Server status and health checks
    async checkServerStatus() {
        try {
            const response = await fetch('/health');
            if (response.ok) {
                const data = await response.json();
                this.serverStatus = 'online';
                this.updateServerStatus('●', '#28a745');
                this.updateDeviceCount(data.connectedDevices || 0);
                this.log(`Server online - ${data.connectedDevices || 0} devices connected`);
                return true;
            }
        } catch (error) {
            this.serverStatus = 'offline';
            this.updateServerStatus('●', '#dc3545');
            this.log(`Server offline: ${error.message}`);
            return false;
        }
    }

    startStatusPolling() {
        // Poll server status every 5 seconds
        setInterval(() => {
            this.checkServerStatus();
        }, 5000);
    }

    // UI Update methods
    updateServerStatus(indicator, color) {
        const element = document.getElementById('serverStatus');
        element.textContent = indicator;
        element.style.color = color;
    }

    updateDeviceCount(count) {
        document.getElementById('deviceCount').textContent = count;
    }

    updateApiCalls() {
        this.apiCalls++;
        document.getElementById('apiCalls').textContent = this.apiCalls;
    }

    // Chat interface methods
    async sendMessage() {
        const input = document.getElementById('messageInput');
        const message = input.value.trim();

        if (!message) {
            this.showError('Please enter a message');
            return;
        }

        if (this.serverStatus !== 'online') {
            this.showError('Server is offline');
            return;
        }

        // Clear input and disable send button
        input.value = '';
        const sendBtn = document.getElementById('sendBtn');
        sendBtn.disabled = true;
        sendBtn.textContent = 'Sending...';

        // Add user message to chat
        this.addChatMessage('user', 'You', message);
        this.log(`Sending command: "${message}"`);

        try {
            // Send to OpenAI-compatible API
            const response = await fetch('/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'r1-command',
                    messages: [
                        {
                            role: 'user',
                            content: message
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 150
                })
            });

            this.updateApiCalls();

            if (response.ok) {
                const data = await response.json();
                const assistantMessage = data.choices[0].message.content;

                this.addChatMessage('assistant', 'R-API', assistantMessage);
                this.log(`API Response: ${assistantMessage}`);

                // Store in message history
                this.messageHistory.push({
                    user: message,
                    assistant: assistantMessage,
                    timestamp: new Date().toISOString()
                });
            } else {
                const error = await response.text();
                this.addChatMessage('system', 'Error', `API Error: ${error}`);
                this.log(`API Error: ${error}`);
            }
        } catch (error) {
            this.addChatMessage('system', 'Error', `Connection failed: ${error.message}`);
            this.log(`Connection error: ${error.message}`);
        } finally {
            // Re-enable send button
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send';
        }
    }

    addChatMessage(type, sender, content) {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return; // Debug tool doesn't have chat messages

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;

        const timestamp = new Date().toLocaleTimeString();
        messageDiv.innerHTML = `
            <div class="message-header">${sender} - ${timestamp}</div>
            ${content}
        `;

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Utility methods
    handleKeyPress(event) {
        if (event.key === 'Enter') {
            this.sendMessage();
        }
    }

    clearMessages() {
        // Clear server-side chat history first
        fetch('/clear-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }).then(response => {
            if (response.ok) {
                this.log('Server chat history cleared');
            } else {
                this.log('Failed to clear server chat history');
            }
        }).catch(error => {
            this.log(`Error clearing server chat history: ${error.message}`);
        });

        // Clear client-side messages
        const messagesContainer = document.getElementById('chatMessages');
        messagesContainer.innerHTML = `
            <div class="message system">
                <div class="message-header">System</div>
                Chat cleared. Ready to send commands to R1 devices.
            </div>
        `;
        this.log('Chat messages cleared');
    }

    async refreshStatus() {
        this.log('Refreshing status...');
        await this.checkServerStatus();

        // Refresh device list
        try {
            const response = await fetch('/health');
            if (response.ok) {
                const data = await response.json();
                this.updateDeviceList(data.connectedDevices || 0);
            }
        } catch (error) {
            this.log(`Error refreshing: ${error.message}`);
        }
    }

    async testConnection() {
        this.log('Testing connection...');
        const testMessage = "System test - please respond with your status";

        // Simulate sending a test message
        document.getElementById('messageInput').value = testMessage;
        await this.sendMessage();
    }

    updateDeviceList() {
        const deviceList = document.getElementById('deviceList');

        if (this.connectedDevices.size === 0) {
            deviceList.innerHTML = `
                <div style="text-align: center; color: #666; padding: 20px;">
                    No devices connected
                </div>
            `;
        } else {
            let deviceHTML = '';
            for (const [deviceId, deviceData] of this.connectedDevices) {
                const connectedTime = new Date(deviceData.connectedAt);
                const timeAgo = Math.round((Date.now() - connectedTime.getTime()) / 1000 / 60); // minutes ago

                deviceHTML += `
                    <div class="device-item">
                        <strong>${deviceId}</strong><br>
                        <small>Status: <span style="color: #28a745;">Connected</span></small><br>
                        <small>Connected: ${timeAgo} min ago</small><br>
                        <small>User-Agent: ${deviceData.userAgent || 'Unknown'}</small>
                    </div>
                `;
            }
            deviceList.innerHTML = deviceHTML;
        }
    }

    // Logging methods
    log(message) {
        const logContent = document.getElementById('logContent');
        const timestamp = new Date().toLocaleTimeString();
        logContent.textContent += `[${timestamp}] ${message}\n`;
        logContent.scrollTop = logContent.scrollHeight;
    }

    clearLog() {
        const logContent = document.getElementById('logContent');
        logContent.textContent = '[System] Log cleared\n';
        this.log('Log cleared by user');
    }

    exportLog() {
        const logContent = document.getElementById('logContent').textContent;
        const blob = new Blob([logContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `r-api-log-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.log('Log exported');
    }

    // Camera control methods
    async startCamera() {
        try {
            this.log('Starting magic cam...');
            const response = await fetch('/magic-cam/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ facingMode: 'user' })
            });

            const result = await response.json();
            if (response.ok) {
                this.log(`Camera start command sent to ${result.devices} device(s)`);
                this.updateCameraStatus('Starting camera...');
            } else {
                this.showError(`Failed to start camera: ${result.error}`);
            }
        } catch (error) {
            this.showError(`Camera start error: ${error.message}`);
        }
    }

    async stopCamera() {
        try {
            this.log('Stopping magic cam...');
            const response = await fetch('/magic-cam/stop', {
                method: 'POST'
            });

            const result = await response.json();
            if (response.ok) {
                this.log(`Camera stop command sent to ${result.devices} device(s)`);
                this.updateCameraStatus('Stopping camera...');
            } else {
                this.showError(`Failed to stop camera: ${result.error}`);
            }
        } catch (error) {
            this.showError(`Camera stop error: ${error.message}`);
        }
    }

    async capturePhoto() {
        try {
            this.log('Capturing photo...');
            const response = await fetch('/magic-cam/capture', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ width: 240, height: 282 })
            });

            const result = await response.json();
            if (response.ok) {
                this.log(`Photo capture command sent to ${result.devices} device(s)`);
                this.updateCameraStatus('Capturing photo...');
            } else {
                this.showError(`Failed to capture photo: ${result.error}`);
            }
        } catch (error) {
            this.showError(`Photo capture error: ${error.message}`);
        }
    }

    async switchCamera() {
        try {
            this.log('Switching camera...');
            const response = await fetch('/magic-cam/switch', {
                method: 'POST'
            });

            const result = await response.json();
            if (response.ok) {
                this.log(`Camera switch command sent to ${result.devices} device(s)`);
                this.updateCameraStatus('Switching camera...');
            } else {
                this.showError(`Failed to switch camera: ${result.error}`);
            }
        } catch (error) {
            this.showError(`Camera switch error: ${error.message}`);
        }
    }

    async getCameraStatus() {
        try {
            this.log('Getting camera status...');
            const response = await fetch('/magic-cam/status');

            const result = await response.json();
            if (response.ok) {
                this.updateCameraStatus(`Connected devices: ${result.connectedDevices}, Commands: ${result.cameraCommands.join(', ')}`);
                this.log(`Camera status: ${JSON.stringify(result)}`);
            } else {
                this.showError(`Failed to get camera status: ${result.error}`);
            }
        } catch (error) {
            this.showError(`Camera status error: ${error.message}`);
        }
    }

    updateCameraStatus(status) {
        const cameraStatus = document.getElementById('cameraStatus');
        if (cameraStatus) {
            cameraStatus.textContent = status;
        }
    }

    showError(message) {
        this.addChatMessage('system', 'Error', message);
        this.log(`Error: ${message}`);
    }
}

// Global functions for HTML onclick handlers
let client;

function sendMessage() {
    client.sendMessage();
}

function handleKeyPress(event) {
    client.handleKeyPress(event);
}

function clearMessages() {
    client.clearMessages();
}

function refreshStatus() {
    client.refreshStatus();
}

function testConnection() {
    client.testConnection();
}

function clearLog() {
    client.clearLog();
}

function exportLog() {
    client.exportLog();
}

// Camera control functions
function startCamera() {
    client.startCamera();
}

function stopCamera() {
    client.stopCamera();
}

function capturePhoto() {
    client.capturePhoto();
}

function switchCamera() {
    client.switchCamera();
}

function getCameraStatus() {
    client.getCameraStatus();
}

// Debug tool functions
function startAccelerometer() {
    client.sendCommandToDevices('start_accelerometer', {});
}

function stopAccelerometer() {
    client.sendCommandToDevices('stop_accelerometer', {});
}

function simulateTouchCenter() {
    client.sendCommandToDevices('simulate_touch', { x: 120, y: 141 });
}

function testHardwareButtons() {
    client.sendCommandToDevices('test_hardware_buttons', {});
}

function sendLLMMessage(message) {
    if (!message) {
        const input = document.getElementById('llm-message');
        if (input) message = input.value.trim();
    }
    if (!message) return;

    client.sendCommandToDevices('llm_message', { message, useLLM: true });
    const input = document.getElementById('llm-message');
    if (input) input.value = '';
}

function askLLMSpeak() {
    client.sendCommandToDevices('llm_speak', { message: 'Hello, how are you today?' });
}

function askLLMJSON() {
    client.sendCommandToDevices('llm_json', { prompt: 'List 3 facts about rabbits in JSON format' });
}

function testQuickResponses() {
    const messages = ['Hello', 'What time is it?', 'Tell me a joke'];
    messages.forEach((msg, index) => {
        setTimeout(() => {
            client.sendCommandToDevices('llm_message', { message: msg, useLLM: true });
        }, index * 1000);
    });
}

function clearLLMHistory() {
    document.getElementById('message-history').innerHTML = '';
}

function loadStorageData() {
    client.sendCommandToDevices('load_storage', {});
}

function setStorageItem() {
    const type = document.getElementById('storage-type').value;
    const key = document.getElementById('storage-key').value.trim();
    const value = document.getElementById('storage-value').value.trim();

    if (!key || !value) return;

    client.sendCommandToDevices('set_storage', { type, key, value });
    document.getElementById('storage-key').value = '';
    document.getElementById('storage-value').value = '';
}

function clearStorage(type) {
    client.sendCommandToDevices('clear_storage', { type });
}

function testStorageCapabilities() {
    client.sendCommandToDevices('test_storage', {});
}

function startRecording() {
    client.sendCommandToDevices('start_recording', {});
}

function stopRecording() {
    client.sendCommandToDevices('stop_recording', {});
}

function playTone440() {
    client.sendCommandToDevices('play_tone', { frequency: 440, duration: 1000 });
}

function playTone523() {
    client.sendCommandToDevices('play_tone', { frequency: 523, duration: 1000 });
}

function clearAudioHistory() {
    document.getElementById('audio-history').innerHTML = '';
}

function testAudioCapabilities() {
    client.sendCommandToDevices('test_audio', {});
}

function startFPSMonitoring() {
    client.sendCommandToDevices('start_fps', {});
}

function stopFPSMonitoring() {
    client.sendCommandToDevices('stop_fps', {});
}

function measureMemoryUsage() {
    client.sendCommandToDevices('measure_memory', {});
}

function measureNetworkInfo() {
    client.sendCommandToDevices('measure_network', {});
}

function runPerformanceTest() {
    client.sendCommandToDevices('run_perf_test', {});
}

function collectSystemInfo() {
    client.sendCommandToDevices('collect_system_info', {});
}

function collectDeviceInfo() {
    client.sendCommandToDevices('collect_device_info', {});
}

function detectCapabilities() {
    client.sendCommandToDevices('detect_capabilities', {});
}

function testAPIConnectivity() {
    client.sendCommandToDevices('test_api_connectivity', {});
}

function getR1Specifications() {
    client.sendCommandToDevices('get_r1_specs', {});
}

function clearLogs() {
    client.clientLogs = [];
    client.updateLogsDisplay();
}

function exportLogs() {
    const logText = client.clientLogs.map(log =>
        `[${log.timestamp}] ${log.level.toUpperCase()} [${log.source}]: ${log.message}`
    ).join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `r1-debug-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function fetchServerLogs() {
    if (!client.socket || !client.socket.connected) return;

    client.socket.emit('get_server_logs', { deviceId: 'web-client' }, (response) => {
        if (response && response.logs) {
            client.serverLogs = response.logs;
            client.log(`Fetched ${response.logs.length} server logs`);
        }
    });
}

function testLogging() {
    client.addClientLog('info', 'Test info message', 'test');
    client.addClientLog('warn', 'Test warning message', 'test');
    client.addClientLog('error', 'Test error message', 'test');
    client.addClientLog('debug', 'Test debug message', 'test');
}

// Add sendCommandToDevices method to RAPIClient
RAPIClient.prototype.sendCommandToDevices = function (command, data) {
    if (!this.socket || !this.socket.connected) {
        this.log(`Cannot send command: socket not connected`);
        return;
    }

    this.log(`Sending command to devices: ${command}`);

    // Emit command to all connected R1 devices
    this.socket.emit(command, {
        ...data,
        timestamp: new Date().toISOString(),
        from: 'web-client'
    });
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    client = new RAPIClient();
});

// Handle page visibility changes to manage polling
document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && client) {
        client.refreshStatus();
    }
});
// MCP Ma
nagement Functions
function showAddServerModal() {
    document.getElementById('addServerModal').classList.add('show');
}

function hideAddServerModal() {
    document.getElementById('addServerModal').classList.remove('show');
    // Clear form
    document.getElementById('server-name').value = '';
    document.getElementById('server-description').value = '';
    document.getElementById('server-command').value = '';
    document.getElementById('server-args').value = '';
    document.getElementById('server-env').value = '';
    document.getElementById('server-auto-approve').value = '';
    document.getElementById('server-enabled').checked = true;

    // Clear template selection
    document.querySelectorAll('.mcp-template-card').forEach(card => {
        card.classList.remove('selected');
    });
}

async function addMCPServer() {
    const deviceId = document.getElementById('mcp-device-select').value;
    if (!deviceId) {
        alert('Please select a device first');
        return;
    }

    const serverName = document.getElementById('server-name').value.trim();
    const description = document.getElementById('server-description').value.trim();
    const command = document.getElementById('server-command').value.trim();
    const argsText = document.getElementById('server-args').value.trim();
    const envText = document.getElementById('server-env').value.trim();
    const autoApproveText = document.getElementById('server-auto-approve').value.trim();
    const enabled = document.getElementById('server-enabled').checked;

    if (!serverName || !command) {
        alert('Server name and command are required');
        return;
    }

    try {
        // Parse JSON fields
        let args = [];
        let env = {};
        let autoApprove = [];

        if (argsText) {
            args = JSON.parse(argsText);
        }
        if (envText) {
            env = JSON.parse(envText);
        }
        if (autoApproveText) {
            autoApprove = JSON.parse(autoApproveText);
        }

        const config = {
            command,
            args,
            env,
            enabled,
            autoApprove,
            description
        };

        const response = await fetch(`/${deviceId}/mcp/servers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                serverName,
                config
            })
        });

        const result = await response.json();

        if (response.ok) {
            hideAddServerModal();
            loadMCPData();
            window.rapi.log(`MCP server '${serverName}' added successfully`);
        } else {
            alert(`Failed to add server: ${result.error?.message || 'Unknown error'}`);
        }
    } catch (error) {
        alert(`Error adding server: ${error.message}`);
    }
}

async function toggleMCPServer(serverName, enabled) {
    const deviceId = document.getElementById('mcp-device-select').value;
    if (!deviceId) return;

    try {
        const response = await fetch(`/${deviceId}/mcp/servers/${serverName}/toggle`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ enabled })
        });

        const result = await response.json();

        if (response.ok) {
            loadMCPData();
            window.rapi.log(`MCP server '${serverName}' ${enabled ? 'enabled' : 'disabled'}`);
        } else {
            alert(`Failed to toggle server: ${result.error?.message || 'Unknown error'}`);
        }
    } catch (error) {
        alert(`Error toggling server: ${error.message}`);
    }
}

async function deleteMCPServer(serverName) {
    if (!confirm(`Are you sure you want to delete the MCP server '${serverName}'?`)) {
        return;
    }

    const deviceId = document.getElementById('mcp-device-select').value;
    if (!deviceId) return;

    try {
        const response = await fetch(`/${deviceId}/mcp/servers/${serverName}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (response.ok) {
            loadMCPData();
            window.rapi.log(`MCP server '${serverName}' deleted successfully`);
        } else {
            alert(`Failed to delete server: ${result.error?.message || 'Unknown error'}`);
        }
    } catch (error) {
        alert(`Error deleting server: ${error.message}`);
    }
}

async function viewServerTools(serverName) {
    const deviceId = document.getElementById('mcp-device-select').value;
    if (!deviceId) return;

    try {
        const response = await fetch(`/${deviceId}/mcp/servers/${serverName}/tools`);
        const result = await response.json();

        if (response.ok) {
            const tools = result.tools || [];
            let toolsHtml = '<h3>Available Tools</h3>';

            if (tools.length === 0) {
                toolsHtml += '<p>No tools available for this server.</p>';
            } else {
                toolsHtml += '<ul>';
                tools.forEach(tool => {
                    toolsHtml += `
                        <li>
                            <strong>${tool.tool_name}</strong><br>
                            <small>${tool.tool_description || 'No description'}</small><br>
                            <small>Used ${tool.usage_count || 0} times</small>
                        </li>
                    `;
                });
                toolsHtml += '</ul>';
            }

            // Show in a simple alert for now (could be enhanced with a modal)
            const toolsWindow = window.open('', '_blank', 'width=600,height=400');
            toolsWindow.document.write(`
                <html>
                    <head><title>MCP Tools - ${serverName}</title></head>
                    <body style="font-family: Arial, sans-serif; padding: 20px;">
                        ${toolsHtml}
                    </body>
                </html>
            `);
        } else {
            alert(`Failed to load tools: ${result.error?.message || 'Unknown error'}`);
        }
    } catch (error) {
        alert(`Error loading tools: ${error.message}`);
    }
}

function editMCPServer(serverName) {
    // For now, just show an alert (could be enhanced with an edit modal)
    alert(`Edit functionality for '${serverName}' coming soon!`);
}

function refreshMCPData() {
    window.rapi.loadMCPOverview();
    loadMCPData();
}

function showMCPLogs() {
    document.getElementById('mcpLogsModal').classList.add('show');
    loadMCPLogs();
}

function hideMCPLogs() {
    document.getElementById('mcpLogsModal').classList.remove('show');
}

async function loadMCPLogs() {
    const deviceId = document.getElementById('mcp-device-select').value;
    if (!deviceId) {
        document.getElementById('mcp-logs-display').innerHTML = 'Please select a device first';
        return;
    }

    const serverName = document.getElementById('log-server-filter').value;

    try {
        let url = `/${deviceId}/mcp/logs?limit=100`;
        if (serverName) {
            url += `&serverName=${encodeURIComponent(serverName)}`;
        }

        const response = await fetch(url);
        const result = await response.json();

        if (response.ok) {
            const logs = result.logs || [];
            const logsDisplay = document.getElementById('mcp-logs-display');

            if (logs.length === 0) {
                logsDisplay.innerHTML = 'No logs available';
                return;
            }

            logsDisplay.innerHTML = logs.map(log => `
                <div class="mcp-log-entry mcp-log-${log.level}">
                    <span class="mcp-log-timestamp">${new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span class="mcp-log-level">[${log.level.toUpperCase()}]</span>
                    <span class="mcp-log-server">${log.server_name}</span>
                    <span class="mcp-log-message">${log.message}</span>
                </div>
            `).join('');

            // Auto-scroll to bottom
            logsDisplay.scrollTop = logsDisplay.scrollHeight;
        } else {
            document.getElementById('mcp-logs-display').innerHTML = `Error loading logs: ${result.error?.message || 'Unknown error'}`;
        }
    } catch (error) {
        document.getElementById('mcp-logs-display').innerHTML = `Error loading logs: ${error.message}`;
    }
}

function clearMCPLogs() {
    if (confirm('Are you sure you want to clear the logs display?')) {
        document.getElementById('mcp-logs-display').innerHTML = 'Logs cleared';
    }
}

// Make functions globally available
window.showAddServerModal = showAddServerModal;
window.hideAddServerModal = hideAddServerModal;
window.addMCPServer = addMCPServer;
window.toggleMCPServer = toggleMCPServer;
window.deleteMCPServer = deleteMCPServer;
window.viewServerTools = viewServerTools;
window.editMCPServer = editMCPServer;
window.refreshMCPData = refreshMCPData;
window.showMCPLogs = showMCPLogs;
window.hideMCPLogs = hideMCPLogs;
window.loadMCPLogs = loadMCPLogs;
window.clearMCPLogs = clearMCPLogs;
window.loadMCPData = loadMCPData;