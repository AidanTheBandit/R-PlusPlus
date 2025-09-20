
// Minimal R1 Creation UI with robust Socket.IO and r1-create
console.log('Script loaded, initializing...');
let socket = null;
let deviceId = null;
let isConnected = false;

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
    addDebugEntry('info', 'Starting Socket.IO connection attempt');
    
    if (socket && socket.connected) {
        addDebugEntry('info', 'Socket.IO already connected, skipping');
        return;
    }
    
    // Socket.IO automatically handles WebSocket vs polling fallback
    addDebugEntry('info', 'Initializing Socket.IO connection');
    socket = io('/', {
        path: '/ws',
        timeout: 5000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    });
    
    // Connection events
    socket.on('connect', () => {
        addDebugEntry('info', 'Socket.IO connected successfully');
        console.log('Socket.IO connected');
        setStatus(true);
        log('Connected');
    });
    
    socket.on('disconnect', () => {
        addDebugEntry('warn', 'Socket.IO disconnected');
        console.log('Socket.IO disconnected');
        setStatus(false);
        log('Disconnected');
    });
    
    socket.on('connect_error', (error) => {
        addDebugEntry('error', `Socket.IO connection error: ${error.message}`);
        console.error('Socket.IO connection error:', error);
        setStatus(false);
        log(`Connection error: ${error.message}`);
    });
    
    socket.on('reconnect', (attemptNumber) => {
        addDebugEntry('info', `Socket.IO reconnected after ${attemptNumber} attempts`);
        console.log('Socket.IO reconnected');
    });
    
    socket.on('reconnect_error', (error) => {
        addDebugEntry('error', `Socket.IO reconnection failed: ${error.message}`);
        console.error('Socket.IO reconnection failed:', error);
    });
    
    // Application-specific events
    socket.on('connected', (data) => {
        deviceId = data.deviceId;
        setStatus(true, `ID: ${deviceId}`);
        addDebugEntry('info', `Connected with device ID: ${deviceId}`);
    });
    
    socket.on('chat_completion', (data) => {
        addDebugEntry('info', `Received chat completion: ${JSON.stringify(data).substring(0, 100)}...`);
        console.log('Chat completion:', data);
        
        if (r1Create) {
            r1Create.process(data.message).then(response => {
                socket.emit('response', {
                    originalMessage: data.message,
                    response,
                    model: data.model,
                    timestamp: new Date().toISOString(),
                    deviceId
                });
            }).catch(err => {
                socket.emit('error', { 
                    error: err.message, 
                    deviceId 
                });
            });
        }
    });
}

function reconnect() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    deviceId = null;
    connect();
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded fired');
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
    
    // Reset connection state
    deviceId = null;
    
    connect();
    setStatus(false);
    log('Ready');
});

// Fallback check in case DOMContentLoaded doesn't fire
setTimeout(() => {
    const debugStatusEl = document.getElementById('debugStatus');
    if (debugStatusEl && debugStatusEl.textContent === 'Initializing...') {
        console.error('DOMContentLoaded did not fire - JavaScript may be disabled or script failed to load');
        debugStatusEl.textContent = 'Error: JS Disabled';
        debugStatusEl.style.color = '#ff4444';
        addDebugEntry('error', 'Page initialization failed. Check if JavaScript is enabled and server is running.');
        setStatus(false);
        log('Initialization failed - check server and JavaScript');
    }
}, 5000);