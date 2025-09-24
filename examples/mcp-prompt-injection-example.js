// Example: MCP Prompt Injection Integration for R1 Devices
// This example shows how the R1 device would interact with the new MCP system

const io = require('socket.io-client');

class R1MCPClient {
  constructor(serverUrl, deviceId) {
    this.serverUrl = serverUrl;
    this.deviceId = deviceId;
    this.socket = null;
    this.mcpTools = new Map();
  }

  async connect() {
    console.log(`🔌 Connecting R1 device ${this.deviceId} to ${this.serverUrl}...`);
    
    this.socket = io(this.serverUrl);
    
    this.socket.on('connect', () => {
      console.log('✅ Connected to R-API server');
    });

    this.socket.on('connected', (data) => {
      console.log('📱 Device registered:', data);
    });

    this.socket.on('chat_completion', async (command) => {
      console.log('💬 Received chat completion request:', command.data.message);
      
      // Check if the message contains MCP tool information
      if (command.data.message.includes('## MCP Tools Available')) {
        console.log('🔧 MCP tools detected in prompt');
        this.parseMCPTools(command.data.message);
      }
      
      // Check if the message requests a tool call
      const toolCallMatch = command.data.message.match(/use the (\w+) tool/i);
      if (toolCallMatch) {
        const toolName = toolCallMatch[1];
        await this.handleToolRequest(toolName, command);
      } else {
        // Regular response
        this.sendResponse(command.data.requestId, 'I understand your request. How can I help you?', command.data.originalMessage, command.data.model);
      }
    });

    this.socket.on('mcp_tool_result', (data) => {
      console.log('🔧 MCP tool result received:', data);
    });

    this.socket.on('mcp_error', (data) => {
      console.error('❌ MCP tool error:', data);
    });
  }

  parseMCPTools(message) {
    // Parse the MCP tools from the injected prompt
    const toolMatches = message.match(/### (\w+) \(([^)]+)\)\n([^\n]+)\n\*\*Auto-approved\*\*: ([^\n]+)\n\*\*Schema\*\*: `([^`]+)`/g);
    
    if (toolMatches) {
      toolMatches.forEach(match => {
        const [, toolName, serverName, description, autoApproved, schema] = match.match(/### (\w+) \(([^)]+)\)\n([^\n]+)\n\*\*Auto-approved\*\*: ([^\n]+)\n\*\*Schema\*\*: `([^`]+)`/);
        
        this.mcpTools.set(toolName, {
          serverName: serverName.split('-').slice(2).join('-'), // Remove device prefix
          description,
          autoApproved: autoApproved === 'Yes',
          schema: JSON.parse(schema)
        });
        
        console.log(`🔧 Registered MCP tool: ${toolName} (${serverName})`);
      });
    }
  }

  async handleToolRequest(toolName, command) {
    console.log(`🔧 Handling tool request: ${toolName}`);
    
    if (toolName.toLowerCase() === 'search') {
      // Use web search tool
      await this.callMCPTool('web-search', 'search_web', {
        query: 'latest AI news',
        max_results: 3
      });
      
      this.sendResponse(command.data.requestId, 'I searched for the latest AI news and found some interesting articles. Here are the top results...', command.data.originalMessage, command.data.model);
    } else if (toolName.toLowerCase() === 'calculate') {
      // Use calculator tool
      await this.callMCPTool('calculator', 'calculate', {
        expression: '2 + 2 * 3'
      });
      
      this.sendResponse(command.data.requestId, 'I calculated the expression and the result is 8.', command.data.originalMessage, command.data.model);
    } else {
      this.sendResponse(command.data.requestId, `I don't have access to the ${toolName} tool right now.`, command.data.originalMessage, command.data.model);
    }
  }

  async callMCPTool(serverName, toolName, args) {
    console.log(`🔧 Calling MCP tool: ${serverName}/${toolName}`, args);
    
    this.socket.emit('mcp_tool_call', {
      serverName,
      toolName,
      arguments: args,
      requestId: `tool-${Date.now()}`
    });
  }

  sendResponse(requestId, response, originalMessage, model) {
    console.log(`📤 Sending response: ${response}`);
    
    this.socket.emit('response', {
      requestId,
      response,
      originalMessage,
      model,
      timestamp: new Date().toISOString()
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      console.log('🔌 Disconnected from server');
    }
  }
}

// Example usage
async function runExample() {
  const client = new R1MCPClient('http://localhost:5482', 'example-r1-device');
  
  try {
    await client.connect();
    
    // Keep the connection alive for testing
    console.log('🔄 R1 MCP client is running. Send chat requests to test MCP integration.');
    console.log('💡 Try: "Use the search tool to find AI news" or "Use the calculate tool for math"');
    
    // Simulate staying connected
    await new Promise(resolve => setTimeout(resolve, 30000));
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.disconnect();
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  runExample().catch(console.error);
}

module.exports = { R1MCPClient };