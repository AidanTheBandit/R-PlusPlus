// MCP Protocol Client using official @modelcontextprotocol/sdk
// Implements proper MCP protocol compliance with official SDK
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { SSEClientTransport } = require('@modelcontextprotocol/sdk/client/sse.js');

class MCPProtocolClient {
  constructor(serverUrl, options = {}) {
    this.serverUrl = serverUrl;
    this.client = new Client(
      {
        name: options.clientInfo?.name || 'R-API-MCP-Client',
        version: options.clientInfo?.version || '1.0.0'
      },
      {
        capabilities: options.capabilities || {
          tools: {},
          resources: {},
          prompts: {}
        }
      }
    );

    this.transport = null;
    this.connected = false;
    this.initialized = false;
    this.timeout = options.timeout || 30000;
  }

  // Initialize connection to MCP server
  async initialize() {
    try {
      console.log(`🔌 Initializing MCP connection to ${this.serverUrl}`);

      // Create appropriate transport based on URL
      if (this.serverUrl.includes('/sse')) {
        this.transport = new SSEClientTransport(
          new URL(this.serverUrl),
          {
            requestInit: {
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json,text/event-stream',
                ...this.client._options.headers
              }
            }
          }
        );
      } else {
        // For HTTP transport, we'll use a custom implementation
        // since the SDK doesn't have a built-in HTTP transport
        throw new Error('HTTP transport not yet implemented. Use /sse endpoint for now.');
      }

      // Connect to the server
      await this.client.connect(this.transport);

      console.log(`✅ MCP initialized with protocol version ${this.client.getServerVersion()}`);
      console.log(`📋 Server capabilities:`, this.client.getServerCapabilities());

      this.initialized = true;
      this.connected = true;

      return {
        protocolVersion: this.client.getServerVersion(),
        capabilities: this.client.getServerCapabilities()
      };
    } catch (error) {
      console.error('❌ MCP initialization failed:', error);
      throw error;
    }
  }

  // List available tools
  async listTools() {
    if (!this.connected) {
      throw new Error('Client not connected');
    }

    try {
      const response = await this.client.listTools();
      return response;
    } catch (error) {
      console.error('❌ Failed to list tools:', error);
      throw error;
    }
  }

  // Call a tool
  async callTool(toolName, args = {}) {
    if (!this.connected) {
      throw new Error('Client not connected');
    }

    try {
      const response = await this.client.callTool({
        name: toolName,
        arguments: args
      });
      return response;
    } catch (error) {
      console.error(`❌ Failed to call tool ${toolName}:`, error);
      throw error;
    }
  }

  // List available resources
  async listResources() {
    if (!this.connected) {
      throw new Error('Client not connected');
    }

    try {
      const response = await this.client.listResources();
      return response;
    } catch (error) {
      console.error('❌ Failed to list resources:', error);
      throw error;
    }
  }

  // Read a resource
  async readResource(uri) {
    if (!this.connected) {
      throw new Error('Client not connected');
    }

    try {
      const response = await this.client.readResource({ uri });
      return response;
    } catch (error) {
      console.error(`❌ Failed to read resource ${uri}:`, error);
      throw error;
    }
  }

  // List available prompts
  async listPrompts() {
    if (!this.connected) {
      throw new Error('Client not connected');
    }

    try {
      const response = await this.client.listPrompts();
      return response;
    } catch (error) {
      console.error('❌ Failed to list prompts:', error);
      throw error;
    }
  }

  // Get a prompt
  async getPrompt(name, args = {}) {
    if (!this.connected) {
      throw new Error('Client not connected');
    }

    try {
      const response = await this.client.getPrompt({
        name,
        arguments: args
      });
      return response;
    } catch (error) {
      console.error(`❌ Failed to get prompt ${name}:`, error);
      throw error;
    }
  }

  // Ping the server
  async ping() {
    if (!this.connected) {
      throw new Error('Client not connected');
    }

    try {
      await this.client.ping();
      return { success: true };
    } catch (error) {
      console.error('❌ Ping failed:', error);
      throw error;
    }
  }

  // Close connection
  async close() {
    this.connected = false;
    this.initialized = false;

    try {
      await this.client.close();
      console.log('🔌 MCP connection closed');
    } catch (error) {
      console.error('Error closing MCP connection:', error);
    }
  }
}

module.exports = { MCPProtocolClient };