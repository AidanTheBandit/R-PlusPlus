
// Minimal R1 Creation UI with robust WebSocket and r1-create
let ws = null;
let deviceId = null;
let isConnected = false;
let reconnectTimeout = null;

// Use r1-create for AI (assume it exposes window.r1Create)
let r1Create = null;
if (window.r1Create) {
    r1Create = window.r1Create;
}

const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const reconnectBtn = document.getElementById('reconnectBtn');
let debugLogEl = null; // Will be set when DOM is ready

// Debug logging system
let originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info
};

function addDebugEntry(level, ...args) {
    // Check if debug log element exists
    if (!debugLogEl) {
        debugLogEl = document.getElementById('debugLog');
        if (!debugLogEl) {
            // Fallback to original console if debug element not found
            originalConsole.log(`[DEBUG ${level.toUpperCase()}]`, ...args);
            return;
        }
    }
    
    try {
        const entry = document.createElement('div');
        entry.className = `debug-entry debug-${level}`;
        
        const timestamp = new Date().toLocaleTimeString();
        const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        
        entry.textContent = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
        
        debugLogEl.appendChild(entry);
        debugLogEl.scrollTop = debugLogEl.scrollHeight;
        
        // Keep only last 50 entries
        while (debugLogEl.children.length > 50) {
            debugLogEl.removeChild(debugLogEl.firstChild);
        }
    } catch (error) {
        // If anything fails, fallback to console
        originalConsole.error('Debug logging failed:', error);
        originalConsole.log(`[DEBUG ${level.toUpperCase()}]`, ...args);
    }
}

// Override console methods AFTER DOM is ready
function initializeDebugSystem() {
    console.log = function(...args) {
        originalConsole.log.apply(console, args);
        addDebugEntry('log', ...args);
    };
    
    console.warn = function(...args) {
        originalConsole.warn.apply(console, args);
        addDebugEntry('warn', ...args);
    };
    
    console.error = function(...args) {
        originalConsole.error.apply(console, args);
        addDebugEntry('error', ...args);
    };
    
    console.info = function(...args) {
        originalConsole.info.apply(console, args);
        addDebugEntry('info', ...args);
    };
    
    console.log('Console override initialized');
}

function setStatus(connected, msg = '') {
    isConnected = connected;
    statusEl.className = 'status ' + (connected ? 'connected' : 'disconnected');
    statusEl.textContent = connected ? `Connected${msg ? ' - ' + msg : ''}` : `Disconnected${msg ? ' - ' + msg : ''}`;
    reconnectBtn.disabled = connected;
}

function log(msg) {
    logEl.textContent = msg;
}

function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        console.log('Connection already in progress or established');
        return;
    }
    
    console.log('Starting WebSocket connection process...');
    
    // For Cloudflare tunnel: if page is HTTPS but server is HTTP, show helpful error
    let url;
    if (window.location.protocol === 'https:') {
        console.log('Page is HTTPS - using WSS protocol');
        url = `wss://${window.location.host}/ws`;
        console.log('Attempting connection to:', url);
    } else {
        console.log('Page is HTTP - using WS protocol');
        url = `ws://${window.location.host}/ws`;
        console.log('Attempting connection to:', url);
    }
    
    try {
        console.log('Creating WebSocket instance...');
        ws = new WebSocket(url);
        console.log('WebSocket instance created successfully');
        
        // Set up event handlers immediately
        ws.onopen = () => {
            console.log('WebSocket connection opened successfully');
            setStatus(true);
            log('Connected');
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
                reconnectTimeout = null;
            }
        };

        ws.onmessage = (event) => {
            console.log('WebSocket message received:', event.data);
            try {
                const msg = JSON.parse(event.data);
                console.info('Parsed message type:', msg.type);
                
                if (msg.type === 'connected') {
                    deviceId = msg.deviceId;
                    console.log('Device ID assigned:', deviceId);
                    setStatus(true, `ID: ${deviceId}`);
                } else if (msg.type === 'chat_completion' && r1Create) {
                    console.log('Processing chat completion request:', msg.data.message);
                    // Use onboard AI via r1-create
                    r1Create.process(msg.data.message).then(response => {
                        console.log('AI response generated:', response);
                        ws.send(JSON.stringify({
                            type: 'response',
                            data: {
                                originalMessage: msg.data.message,
                                response,
                                model: msg.data.model,
                                timestamp: new Date().toISOString(),
                                deviceId
                            }
                        }));
                    }).catch(err => {
                        console.error('AI processing error:', err);
                        ws.send(JSON.stringify({
                            type: 'error',
                            data: { error: err.message, deviceId }
                        }));
                    });
                }
            } catch (e) {
                console.error('Message parsing error:', e.message);
                log('Error: ' + e.message);
            }
        };

        ws.onclose = (event) => {
            console.warn('WebSocket connection closed', {
                code: event.code,
                reason: event.reason,
                wasClean: event.wasClean
            });
            setStatus(false);
            log(`Connection closed (code: ${event.code})`);
            scheduleReconnect();
        };

        ws.onerror = (error) => {
            console.error('WebSocket error event fired:', error);
            setStatus(false);
            log('WebSocket error - check Cloudflare tunnel WebSocket support');
            scheduleReconnect();
        };
        
        console.log('WebSocket event handlers set up');
        
    } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        console.error('Error details:', {
            message: error.message,
            name: error.name,
            stack: error.stack
        });
        setStatus(false);
        log(`WebSocket creation failed: ${error.message}`);
        scheduleReconnect();
    }
}

function scheduleReconnect() {
    if (reconnectTimeout) return;
    reconnectTimeout = setTimeout(() => {
        connect();
    }, 3000);
}

function reconnect() {
    if (ws) {
        ws.close();
        ws = null;
    }
    connect();
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialize DOM elements
    debugLogEl = document.getElementById('debugLog');
    const debugStatusEl = document.getElementById('debugStatus');
    
    // Initialize debug system
    initializeDebugSystem();
    
    // Update debug status
    if (debugStatusEl) {
        debugStatusEl.textContent = 'Active';
        debugStatusEl.style.color = '#4ecdc4';
    }
    
    connect();
    setStatus(false);
    log('Ready');
});