// Example R1 MCP Integration
// This demonstrates how to use MCP tools from an R1 device

// Import the MCP client (this would be included in the R1 environment)
// const { MCPClient } = require('../src/utils/mcp-client');

class R1MCPIntegration {
  constructor(socket, deviceId) {
    this.socket = socket;
    this.deviceId = deviceId;
    this.mcpClient = null;
    this.availableTools = new Map();
  }

  async initialize() {
    console.log('🔌 Initializing R1 MCP integration...');
    
    try {
      // Initialize MCP client
      this.mcpClient = new MCPClient(this.socket, this.deviceId);
      await this.mcpClient.initialize();
      
      // Load available tools
      await this.loadAvailableTools();
      
      console.log(`✅ MCP integration initialized with ${this.availableTools.size} tool categories`);
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize MCP integration:', error);
      return false;
    }
  }

  async loadAvailableTools() {
    const servers = await this.mcpClient.getServers();
    
    for (const server of servers) {
      if (server.running && server.tools) {
        for (const tool of server.tools) {
          const toolKey = `${server.name}/${tool.name}`;
          this.availableTools.set(toolKey, {
            serverName: server.name,
            toolName: tool.name,
            description: tool.description,
            schema: tool.inputSchema,
            autoApproved: !this.mcpClient.needsApproval(server.name, tool.name)
          });
        }
      }
    }
  }

  // Enhanced AI assistant with MCP tool capabilities
  async processUserRequest(userMessage) {
    console.log(`🤖 Processing user request: "${userMessage}"`);
    
    // Analyze the request to determine if MCP tools are needed
    const toolsNeeded = this.analyzeRequestForTools(userMessage);
    
    if (toolsNeeded.length === 0) {
      // Regular AI response without tools
      return this.generateRegularResponse(userMessage);
    }

    // Execute tools and generate enhanced response
    const toolResults = [];
    
    for (const toolInfo of toolsNeeded) {
      try {
        const result = await this.executeTool(toolInfo);
        toolResults.push(result);
      } catch (error) {
        console.error(`❌ Tool execution failed: ${toolInfo.toolKey}`, error);
        toolResults.push({
          toolKey: toolInfo.toolKey,
          error: error.message
        });
      }
    }

    return this.generateEnhancedResponse(userMessage, toolResults);
  }

  // Analyze user request to determine which tools might be helpful
  analyzeRequestForTools(userMessage) {
    const message = userMessage.toLowerCase();
    const toolsNeeded = [];

    // File system operations
    if (message.includes('read file') || message.includes('open file') || message.includes('file content')) {
      const tool = this.findTool('filesystem', 'read_file');
      if (tool) {
        toolsNeeded.push({
          toolKey: 'filesystem/read_file',
          ...tool,
          args: this.extractFilePathFromMessage(userMessage)
        });
      }
    }

    // Web search
    if (message.includes('search') || message.includes('find information') || message.includes('look up')) {
      const tool = this.findTool('web-search', 'search');
      if (tool) {
        toolsNeeded.push({
          toolKey: 'web-search/search',
          ...tool,
          args: this.extractSearchQueryFromMessage(userMessage)
        });
      }
    }

    // GitHub operations
    if (message.includes('github') || message.includes('repository') || message.includes('repo')) {
      const tool = this.findTool('github', 'search_repositories');
      if (tool) {
        toolsNeeded.push({
          toolKey: 'github/search_repositories',
          ...tool,
          args: this.extractGitHubQueryFromMessage(userMessage)
        });
      }
    }

    // Database queries
    if (message.includes('database') || message.includes('query') || message.includes('sql')) {
      const tool = this.findTool('sqlite', 'execute_query');
      if (tool) {
        toolsNeeded.push({
          toolKey: 'sqlite/execute_query',
          ...tool,
          args: this.extractSQLFromMessage(userMessage)
        });
      }
    }

    return toolsNeeded;
  }

  findTool(serverName, toolName) {
    const toolKey = `${serverName}/${toolName}`;
    return this.availableTools.get(toolKey);
  }

  async executeTool(toolInfo) {
    console.log(`🔧 Executing tool: ${toolInfo.toolKey}`);
    
    try {
      const result = await this.mcpClient.callTool(
        toolInfo.serverName,
        toolInfo.toolName,
        toolInfo.args
      );
      
      return {
        toolKey: toolInfo.toolKey,
        success: true,
        result: result
      };
    } catch (error) {
      throw new Error(`Tool execution failed: ${error.message}`);
    }
  }

  // Extract file path from user message
  extractFilePathFromMessage(message) {
    // Simple pattern matching - could be enhanced with NLP
    const pathMatch = message.match(/["']([^"']+)["']/) || message.match(/\/[^\s]+/);
    return {
      path: pathMatch ? pathMatch[1] || pathMatch[0] : '/default/path'
    };
  }

  // Extract search query from user message
  extractSearchQueryFromMessage(message) {
    // Remove common prefixes and extract the main query
    const query = message
      .replace(/^(search for|find|look up|search)\s+/i, '')
      .replace(/\s+(on the web|online|internet)$/i, '')
      .trim();
    
    return {
      query: query || 'general information',
      max_results: 5
    };
  }

  // Extract GitHub query from user message
  extractGitHubQueryFromMessage(message) {
    const query = message
      .replace(/^(find|search)\s+/i, '')
      .replace(/\s+(on github|github|repository|repo)$/i, '')
      .trim();
    
    return {
      query: query || 'popular repositories',
      sort: 'stars',
      order: 'desc',
      per_page: 5
    };
  }

  // Extract SQL query from user message
  extractSQLFromMessage(message) {
    // Look for SQL keywords or quoted queries
    const sqlMatch = message.match(/SELECT\s+.+/i) || message.match(/"([^"]+)"/);
    return {
      query: sqlMatch ? sqlMatch[0] : 'SELECT * FROM sqlite_master WHERE type="table";'
    };
  }

  // Generate regular AI response without tools
  async generateRegularResponse(userMessage) {
    return {
      type: 'regular',
      message: `I understand you said: "${userMessage}". How can I help you further?`,
      toolsUsed: []
    };
  }

  // Generate enhanced response using tool results
  async generateEnhancedResponse(userMessage, toolResults) {
    let response = `Based on your request "${userMessage}", I've gathered the following information:\n\n`;
    
    const successfulTools = toolResults.filter(r => r.success);
    const failedTools = toolResults.filter(r => !r.success);

    // Add successful tool results
    for (const toolResult of successfulTools) {
      response += `📋 ${toolResult.toolKey}:\n`;
      response += this.formatToolResult(toolResult.result);
      response += '\n\n';
    }

    // Add failed tool information
    if (failedTools.length > 0) {
      response += '⚠️ Some tools encountered issues:\n';
      for (const failedTool of failedTools) {
        response += `- ${failedTool.toolKey}: ${failedTool.error}\n`;
      }
      response += '\n';
    }

    response += 'Is there anything specific you'd like me to explain or help you with based on this information?';

    return {
      type: 'enhanced',
      message: response,
      toolsUsed: toolResults.map(r => r.toolKey),
      toolResults: toolResults
    };
  }

  // Format tool results for display
  formatToolResult(result) {
    if (typeof result === 'string') {
      return result.length > 200 ? result.substring(0, 200) + '...' : result;
    }
    
    if (typeof result === 'object') {
      return JSON.stringify(result, null, 2);
    }
    
    return String(result);
  }

  // Check if a specific tool is available
  isToolAvailable(serverName, toolName) {
    return this.availableTools.has(`${serverName}/${toolName}`);
  }

  // Get list of available tools
  getAvailableTools() {
    return Array.from(this.availableTools.entries()).map(([key, tool]) => ({
      key,
      serverName: tool.serverName,
      toolName: tool.toolName,
      description: tool.description,
      autoApproved: tool.autoApproved
    }));
  }

  // Cleanup
  destroy() {
    if (this.mcpClient) {
      this.mcpClient.destroy();
    }
    this.availableTools.clear();
  }
}

// Example usage in R1 environment
async function initializeR1WithMCP(socket, deviceId) {
  const r1Integration = new R1MCPIntegration(socket, deviceId);
  
  if (await r1Integration.initialize()) {
    console.log('🎉 R1 MCP integration ready!');
    
    // Example: Process a user request
    const response = await r1Integration.processUserRequest(
      'Search for the latest AI research papers'
    );
    
    console.log('🤖 AI Response:', response.message);
    console.log('🔧 Tools Used:', response.toolsUsed);
    
    return r1Integration;
  } else {
    console.error('❌ Failed to initialize R1 MCP integration');
    return null;
  }
}

// Export for use in R1 environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { R1MCPIntegration, initializeR1WithMCP };
} else if (typeof window !== 'undefined') {
  window.R1MCPIntegration = R1MCPIntegration;
  window.initializeR1WithMCP = initializeR1WithMCP;
}