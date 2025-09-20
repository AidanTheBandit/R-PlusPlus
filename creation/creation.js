
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
    const url = `ws://${window.location.host}/ws`;
    log('Connecting...');
    ws = new WebSocket(url);

    ws.onopen = () => {
        setStatus(true);
        log('Connected');
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
        }
    };

    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'connected') {
                deviceId = msg.deviceId;
                setStatus(true, `ID: ${deviceId}`);
            } else if (msg.type === 'chat_completion' && r1Create) {
                // Use onboard AI via r1-create
                r1Create.process(msg.data.message).then(response => {
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
                    ws.send(JSON.stringify({
                        type: 'error',
                        data: { error: err.message, deviceId }
                    }));
                });
            }
        } catch (e) {
            log('Error: ' + e.message);
        }
    };

    ws.onclose = () => {
        setStatus(false);
        log('Connection closed');
        scheduleReconnect();
    };

    ws.onerror = (e) => {
        setStatus(false);
        log('WebSocket error');
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
    connect();
    setStatus(false);
    log('Ready');
});