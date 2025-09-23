// MCP Client for R1 devices - simplified implementation for limited environments
class MCPClient {
  constructor(socket, deviceId) {
    this.socket = socket;
    this.deviceId = deviceId;
    this.servers = new Map(); // serverName -> server info
    this.sessions = new Map(); // sessionId -> session info
    this.messageId = 0;
    this.pendingRequests = new Map(); // messageId -> { resolve, reject, timeout }
    
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // Listen for MCP events from server
    this.socket.on('mcp_server_updated', (data) => {
      console.log('MCP server updated:', data);
      this.refreshServerInfo(data.serverName);
    });

    this.socket.on('mcp_server_deleted', (data) => {
      console.log('MCP server deleted:', data);
      this.servers.delete(data.serverName);
    });

    this.socket.on('mcp_server_toggled', (data) => {
      console.log('MCP server toggled:', data);
      const server = this.servers.get(data.serverName);
      if (server) {
        server.enabled = data.enabled;
      }
    });

    this.socket.on('mcp_error', (data) => {
      console.error('MCP error:', data);
    });
  }

  // Generate unique message ID
  generateMessageId() {
    return ++this.messageId;
  }

  // Send MCP message to server
  async sendMessage(serverName, method, params = {}, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const messageId = this.generateMessageId();
      
      const message = {
        jsonrpc: '2.0',
        id: messageId,
        method,
        params
      };

      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(messageId);
        reject(new Error(`MCP request timeout: ${method}`));
      }, timeout);

      // Store pending request
      this.pendingRequests.set(messageId, {
        resolve,
        reject,
        timeout: timeoutId,
        serverName,
        method
      });

      // Send via socket
      this.socket.emit('mcp_message', {
        deviceId: this.deviceId,
        serverName,
        message
      });
    });
  }

  // Call an MCP tool
  async callTool(serverName, toolName, args = {}) {
    try {
      console.log(`Calling MCP tool: ${serverName}/${toolName}`, args);
      
      // Emit tool call event
      this.socket.emit('mcp_tool_call', {
        deviceId: this.deviceId,
        serverName,
        toolName,
        arguments: args,
        requestId: this.generateMessageId()
      });

      // For now, return a success response
      // In a full implementation, this would wait for the actual response
      return {
        success: true,
        message: `Tool ${toolName} called successfully`
      };
    } catch (error) {
      console.error(`Error calling MCP tool ${serverName}/${toolName}:`, error);
      throw error;
    }
  }

  // Get available tools for a server
  async getTools(serverName) {
    try {
      const response = await fetch(`/${this.deviceId}/mcp/servers/${serverName}/tools`);
      const data = await response.json();
      return data.tools || [];
    } catch (error) {
      console.error(`Error getting tools for ${serverName}:`, error);
      return [];
    }
  }

  // Get server status
  async getServerStatus(serverName) {
    try {
      const response = await fetch(`/${this.deviceId}/mcp/servers/${serverName}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error getting server status for ${serverName}:`, error);
      return null;
    }
  }

  // Get all servers for this device
  async getServers() {
    try {
      const response = await fetch(`/${this.deviceId}/mcp/servers`);
      const data = await response.json();
      return data.servers || [];
    } catch (error) {
      console.error('Error getting MCP servers:', error);
      return [];
    }
  }

  // Refresh server information
  async refreshServerInfo(serverName) {
    try {
      const serverInfo = await this.getServerStatus(serverName);
      if (serverInfo) {
        this.servers.set(serverName, serverInfo);
      }
    } catch (error) {
      console.error(`Error refreshing server info for ${serverName}:`, error);
    }
  }

  // Initialize MCP client
  async initialize() {
    try {
      console.log('Initializing MCP client...');
      
      // Load all servers
      const servers = await this.getServers();
      for (const server of servers) {
        this.servers.set(server.name, server);
      }
      
      console.log(`MCP client initialized with ${servers.length} servers`);
      return true;
    } catch (error) {
      console.error('Error initializing MCP client:', error);
      return false;
    }
  }

  // Helper method to check if a tool is available
  hasToolAvailable(serverName, toolName) {
    const server = this.servers.get(serverName);
    if (!server || !server.running) {
      return false;
    }
    
    return server.tools && server.tools.some(tool => tool.name === toolName);
  }

  // Helper method to get auto-approved tools
  getAutoApprovedTools(serverName) {
    const server = this.servers.get(serverName);
    if (!server || !server.config) {
      return [];
    }
    
    try {
      return server.config.auto_approve ? JSON.parse(server.config.auto_approve) : [];
    } catch (error) {
      console.error(`Error parsing auto-approve list for ${serverName}:`, error);
      return [];
    }
  }

  // Check if a tool call needs approval
  needsApproval(serverName, toolName) {
    const autoApproved = this.getAutoApprovedTools(serverName);
    return !autoApproved.includes(toolName);
  }

  // Cleanup
  destroy() {
    // Clear all pending requests
    for (const [messageId, request] of this.pendingRequests) {
      clearTimeout(request.timeout);
      request.reject(new Error('MCP client destroyed'));
    }
    this.pendingRequests.clear();
    
    // Clear servers and sessions
    this.servers.clear();
    this.sessions.clear();
  }
}

// Export for use in R1 environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MCPClient };
} else if (typeof window !== 'undefined') {
  window.MCPClient = MCPClient;
}