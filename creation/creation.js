
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
const debugLogEl = document.getElementById('debugLog');

// Debug logging system
let originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info
};

function addDebugEntry(level, ...args) {
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
}

// Override console methods
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
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    
    // For Cloudflare tunnel: if page is HTTPS but server is HTTP, show helpful error
    if (window.location.protocol === 'https:') {
        log('HTTPS detected - ensure Cloudflare tunnel supports WebSocket');
        // Try wss:// first (Cloudflare should handle protocol conversion)
        const url = `wss://${window.location.host}/ws`;
        log('Connecting via WSS...');
        ws = new WebSocket(url);
    } else {
        // Direct HTTP connection
        const url = `ws://${window.location.host}/ws`;
        log('Connecting via WS...');
        ws = new WebSocket(url);
    }

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

    ws.onclose = () => {
        console.warn('WebSocket connection closed');
        setStatus(false);
        log('Connection closed');
        scheduleReconnect();
    };

    ws.onerror = (e) => {
        console.error('WebSocket error occurred');
        setStatus(false);
        log('WebSocket error - check Cloudflare tunnel WebSocket support');
        scheduleReconnect();
    };
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
    console.log('R1 Creation UI loaded');
    console.info('Debug logging system initialized');
    console.log('Page protocol:', window.location.protocol);
    console.log('Host:', window.location.host);
    
    connect();
    setStatus(false);
    log('Ready');
    
    console.log('WebSocket connection attempt initiated');
});