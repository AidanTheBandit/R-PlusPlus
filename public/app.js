// R-API Control Panel Client
class RAPIClient {
    constructor() {
        this.apiCalls = 0;
        this.connectedDevices = new Map();
        this.messageHistory = [];
        this.serverStatus = 'checking';
        
        this.init();
    }

    async init() {
        this.log('Initializing R-API Control Panel...');
        await this.checkServerStatus();
        this.startStatusPolling();
        this.log('Control panel ready');
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

    updateDeviceList(deviceCount) {
        const deviceList = document.getElementById('deviceList');
        
        if (deviceCount === 0) {
            deviceList.innerHTML = `
                <div style="text-align: center; color: #666; padding: 20px;">
                    No devices connected
                </div>
            `;
        } else {
            // For now, show generic device entries
            // In a real implementation, you'd track actual device IDs
            let deviceHTML = '';
            for (let i = 1; i <= deviceCount; i++) {
                deviceHTML += `
                    <div class="device-item">
                        Device-${i}<br>
                        <small>Status: Connected</small><br>
                        <small>Last seen: ${new Date().toLocaleTimeString()}</small>
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

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    client = new RAPIClient();
});

// Handle page visibility changes to manage polling
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible' && client) {
        client.refreshStatus();
    }
});