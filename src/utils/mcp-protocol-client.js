// MCP Protocol Client for remote MCP servers
// Implements the Streamable HTTP transport as per MCP specification
const EventEmitter = require('events');

class MCPProtocolClient extends EventEmitter {
  constructor(serverUrl, options = {}) {
    super();
    this.serverUrl = serverUrl;
    this.sessionId = null;
    this.protocolVersion = options.protocolVersion || '2025-06-18';
    this.clientInfo = options.clientInfo || {
      name: 'R-API-MCP-Client',
      version: '1.0.0'
    };
    this.capabilities = options.capabilities || {
      tools: {}
    };
    this.headers = options.headers || {};
    this.timeout = options.timeout || 30000;
    this.messageId = 1;
    this.pendingRequests = new Map();
    this.connected = false;
    this.eventSource = null;
    this.initialized = false;
  }

  // Generate unique message ID
  generateMessageId() {
    return this.messageId++;
  }

  // Initialize connection to MCP server
  async initialize() {
    try {
      console.log(`🔌 Initializing MCP connection to ${this.serverUrl}`);

      // Send initialize request
      const initResult = await this.sendRequest('initialize', {
        protocolVersion: this.protocolVersion,
        capabilities: this.capabilities,
        clientInfo: this.clientInfo
      });

      // Store session ID if provided
      if (initResult.sessionId) {
        this.sessionId = initResult.sessionId;
      }

      // Negotiate protocol version
      this.protocolVersion = initResult.protocolVersion;

      console.log(`✅ MCP initialized with protocol version ${this.protocolVersion}`);
      console.log(`📋 Server capabilities:`, initResult.capabilities);

      // Send initialized notification
      await this.sendNotification('notifications/initialized');

      this.initialized = true;
      this.connected = true;

      // Start listening for server messages
      this.startEventStream();

      return initResult;
    } catch (error) {
      console.error('❌ MCP initialization failed:', error);
      throw error;
    }
  }

  // Start Server-Sent Events stream for receiving messages
  startEventStream() {
    try {
      const url = new URL(this.serverUrl);
      const headers = {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache'
      };

      if (this.sessionId) {
        headers['Mcp-Session-Id'] = this.sessionId;
      }

      headers['MCP-Protocol-Version'] = this.protocolVersion;

      // For Node.js, we'll use a simple polling approach since EventSource isn't built-in
      // In a browser environment, you would use EventSource
      this.pollForMessages();
    } catch (error) {
      console.error('❌ Failed to start event stream:', error);
    }
  }

  // Poll for messages (simplified implementation)
  async pollForMessages() {
    // This is a simplified polling implementation
    // In production, you'd want proper SSE handling
    setInterval(async () => {
      if (!this.connected) return;

      try {
        // Check for pending messages (this would be implemented by the server)
        // For now, we'll skip this as it's complex to implement without proper SSE
      } catch (error) {
        console.error('Error polling for messages:', error);
      }
    }, 5000); // Poll every 5 seconds
  }

  // Send JSON-RPC request
  async sendRequest(method, params = {}) {
    const messageId = this.generateMessageId();
    const message = {
      jsonrpc: '2.0',
      id: messageId,
      method,
      params
    };

    return new Promise(async (resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(messageId);
        reject(new Error(`MCP request timeout: ${method}`));
      }, this.timeout);

      // Store pending request
      this.pendingRequests.set(messageId, { resolve, reject, timeout });

      try {
        const response = await this.sendHttpRequest(message);
        clearTimeout(timeout);
        this.pendingRequests.delete(messageId);

        if (response.error) {
          reject(new Error(response.error.message));
        } else {
          resolve(response.result);
        }
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(messageId);
        reject(error);
      }
    });
  }

  // Send JSON-RPC notification
  async sendNotification(method, params = {}) {
    const message = {
      jsonrpc: '2.0',
      method,
      params
    };

    await this.sendHttpRequest(message);
  }

  // Send HTTP request to MCP server
  async sendHttpRequest(message) {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json,text/event-stream',
      'MCP-Protocol-Version': this.protocolVersion,
      ...this.headers
    };

    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    console.log(`🔄 Sending MCP request to ${this.serverUrl}:`, JSON.stringify(message, null, 2));
    console.log(`🔄 Headers:`, headers);

    const response = await fetch(this.serverUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(message)
    });

    console.log(`📥 MCP response status: ${response.status} ${response.statusText}`);
    console.log(`📥 Response headers:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      let errorText = '';
      try {
        errorText = await response.text();
        console.log(`❌ Error response body:`, errorText);
      } catch (e) {
        console.log(`❌ Could not read error response body`);
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}${errorText ? ` - ${errorText}` : ''}`);
    }

    const contentType = response.headers.get('content-type');

    if (contentType && contentType.includes('text/event-stream')) {
      // Handle SSE response
      return this.handleSSEResponse(response);
    } else {
      // Handle JSON response
      return await response.json();
    }
  }

  // Handle Server-Sent Events response
  async handleSSEResponse(response) {
    // For now, we'll read the response as text and try to parse it
    // In a production implementation, you'd properly handle the SSE stream
    const text = await response.text();
    console.log('SSE Response:', text);

    try {
      // Try to parse as JSON
      return JSON.parse(text);
    } catch (error) {
      console.error('Failed to parse SSE response as JSON:', text);
      throw error;
    }
  }

  // List available tools
  async listTools() {
    return await this.sendRequest('tools/list');
  }

  // Call a tool
  async callTool(toolName, args = {}) {
    return await this.sendRequest('tools/call', {
      name: toolName,
      arguments: args
    });
  }

  // List available resources
  async listResources() {
    return await this.sendRequest('resources/list');
  }

  // Read a resource
  async readResource(uri) {
    return await this.sendRequest('resources/read', { uri });
  }

  // List available prompts
  async listPrompts() {
    return await this.sendRequest('prompts/list');
  }

  // Get a prompt
  async getPrompt(name, args = {}) {
    return await this.sendRequest('prompts/get', {
      name,
      arguments: args
    });
  }

  // Ping the server
  async ping() {
    return await this.sendRequest('ping');
  }

  // Close connection
  async close() {
    this.connected = false;

    if (this.sessionId) {
      try {
        // Send DELETE request to terminate session
        await fetch(this.serverUrl, {
          method: 'DELETE',
          headers: {
            'Mcp-Session-Id': this.sessionId,
            'MCP-Protocol-Version': this.protocolVersion
          }
        });
      } catch (error) {
        console.error('Error closing MCP session:', error);
      }
    }

    // Clear pending requests
    for (const [id, request] of this.pendingRequests) {
      clearTimeout(request.timeout);
      request.reject(new Error('Connection closed'));
    }
    this.pendingRequests.clear();

    this.emit('disconnected');
  }
}

module.exports = { MCPProtocolClient };