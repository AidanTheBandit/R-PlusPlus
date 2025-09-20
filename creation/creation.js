// R1 Creation JavaScript - Connects to WebSocket backend
let ws = null;
let deviceId = null;
let isConnected = false;

// Get server URL (same host as the creation is served from)
const serverUrl = `ws://${window.location.host}/ws`;

function log(message) {
    const logElement = document.getElementById('log');
    const timestamp = new Date().toLocaleTimeString();
    logElement.textContent += `[${timestamp}] ${message}\n`;
    logElement.scrollTop = logElement.scrollHeight;
}

function updateStatus(connected, message = '') {
    const statusElement = document.getElementById('status');
    const connectBtn = document.getElementById('connectBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');
    
    if (connected) {
        statusElement.className = 'status connected';
        statusElement.textContent = `Status: Connected ${message}`;
        connectBtn.disabled = true;
        disconnectBtn.disabled = false;
        isConnected = true;
    } else {
        statusElement.className = 'status disconnected';
        statusElement.textContent = `Status: Disconnected ${message}`;
        connectBtn.disabled = false;
        disconnectBtn.disabled = true;
        isConnected = false;
    }
}

function connect() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        log('Already connected');
        return;
    }
    
    log(`Connecting to ${serverUrl}...`);
    
    try {
        ws = new WebSocket(serverUrl);
        
        ws.onopen = function(event) {
            log('WebSocket connection established');
            updateStatus(true);
        };
        
        ws.onmessage = function(event) {
            try {
                const message = JSON.parse(event.data);
                log(`Received: ${JSON.stringify(message, null, 2)}`);
                
                // Handle different message types
                switch (message.type) {
                    case 'connected':
                        deviceId = message.deviceId;
                        updateStatus(true, `(ID: ${deviceId})`);
                        log(`Assigned device ID: ${deviceId}`);
                        break;
                        
                    case 'chat_completion':
                        log(`Chat completion request: ${message.data.message}`);
                        handleChatCompletion(message);
                        break;
                        
                    default:
                        log(`Unknown message type: ${message.type}`);
                }
            } catch (error) {
                log(`Error parsing message: ${error.message}`);
                log(`Raw message: ${event.data}`);
            }
        };
        
        ws.onclose = function(event) {
            log(`WebSocket connection closed (code: ${event.code})`);
            updateStatus(false);
            deviceId = null;
        };
        
        ws.onerror = function(error) {
            log(`WebSocket error: ${error.message || 'Unknown error'}`);
            updateStatus(false);
        };
        
    } catch (error) {
        log(`Failed to create WebSocket connection: ${error.message}`);
        updateStatus(false);
    }
}

function disconnect() {
    if (ws) {
        log('Disconnecting...');
        ws.close();
        ws = null;
    }
}

function sendMessage(message) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        log('Error: Not connected to server');
        return false;
    }
    
    try {
        ws.send(JSON.stringify(message));
        log(`Sent: ${JSON.stringify(message, null, 2)}`);
        return true;
    } catch (error) {
        log(`Error sending message: ${error.message}`);
        return false;
    }
}

function sendStatus() {
    const status = {
        type: 'status',
        data: {
            deviceId: deviceId,
            timestamp: new Date().toISOString(),
            uptime: performance.now(),
            userAgent: navigator.userAgent,
            url: window.location.href
        }
    };
    
    sendMessage(status);
}

function sendTestCommand() {
    const input = document.getElementById('commandInput');
    const command = input.value.trim();
    
    if (!command) {
        log('Please enter a command');
        return;
    }
    
    const message = {
        type: 'response',
        data: {
            command: command,
            result: `Executed: ${command}`,
            timestamp: new Date().toISOString(),
            deviceId: deviceId
        }
    };
    
    sendMessage(message);
    input.value = '';
}

function handleChatCompletion(message) {
    // Simulate processing the chat completion request
    log(`Processing chat completion: "${message.data.message}"`);
    
    // Simulate some processing time
    setTimeout(() => {
        const response = {
            type: 'response',
            data: {
                originalMessage: message.data.message,
                response: `R1 processed: "${message.data.message}"`,
                model: message.data.model,
                timestamp: new Date().toISOString(),
                deviceId: deviceId,
                processingTime: Math.random() * 1000 + 500 // Random processing time
            }
        };
        
        sendMessage(response);
    }, 1000 + Math.random() * 2000); // 1-3 second delay
}

function clearLog() {
    document.getElementById('log').textContent = '';
    log('Log cleared');
}

// Handle Enter key in command input
document.addEventListener('DOMContentLoaded', function() {
    const commandInput = document.getElementById('commandInput');
    commandInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            sendTestCommand();
        }
    });
    
    // Auto-connect on page load
    log('R1 Creation loaded. Click Connect to start.');
});

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    if (ws) {
        ws.close();
    }
});