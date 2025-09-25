// MCP (Model Context Protocol) Manager for R1 devices - Remote Server Support
const { EventEmitter } = require('events');
const { MCPProtocolClient } = require('./mcp-protocol-client');
const crypto = require('crypto');

class MCPManager extends EventEmitter {
  constructor(database, deviceIdManager) {
    super();
    this.database = database;
    this.deviceIdManager = deviceIdManager;
    this.activeClients = new Map(); // deviceId-serverName -> MCPProtocolClient
    this.availableTools = new Map(); // deviceId-serverName -> tools
    this.serverConfigs = new Map(); // deviceId-serverName -> config
    this.toolUsageStats = new Map(); // deviceId-serverName-toolName -> usage count
  }

  // Initialize MCP server for a device (remote server connection)
  async initializeServer(deviceId, serverName, config) {
    const serverKey = `${deviceId}-${serverName}`;

    try {
      // Validate config for remote server
      if (!config.url) {
        throw new Error('Server URL is required for remote MCP servers');
      }

      // Save server configuration to database
      await this.database.saveMCPServer(deviceId, serverName, config);

      // Cache server config
      this.serverConfigs.set(serverKey, config);

      if (config.enabled !== false) {
        // Only try to connect if enabled and has a valid URL
        if (config.url && config.url.trim()) {
          try {
            await this.connectToRemoteServer(deviceId, serverName, config);
          } catch (connectionError) {
            console.log(`⚠️ Failed to connect to ${serverName} during initialization, but server configuration saved: ${connectionError.message}`);
            await this.database.saveMCPLog(deviceId, serverName, 'warning', `Connection failed during initialization: ${connectionError.message}`);
            // Don't throw error - server is configured but not connected
          }
        } else {
          console.log(`⚠️ Server ${serverName} configured but no URL provided - skipping connection`);
          await this.database.saveMCPLog(deviceId, serverName, 'info', 'Server configured but no URL provided - connection skipped');
        }
      }

      this.emit('serverInitialized', { deviceId, serverName, config });
      return { success: true, message: 'MCP server initialized successfully' };
    } catch (error) {
      await this.database.saveMCPLog(deviceId, serverName, 'error', `Failed to initialize server: ${error.message}`);
      throw error;
    }
  }

  // Connect to remote MCP server
  async connectToRemoteServer(deviceId, serverName, config) {
    const serverKey = `${deviceId}-${serverName}`;

    try {
      console.log(`🔌 Connecting to remote MCP server: ${config.url}`);

      // Create MCP protocol client
      const client = new MCPProtocolClient(config.url, {
        protocolVersion: config.protocolVersion || '2025-06-18',
        clientInfo: {
          name: 'R-API-MCP-Client',
          version: '1.0.0'
        },
        capabilities: {
          tools: {}
        }
      });

      // Initialize the connection
      const initResult = await client.initialize();

      // Store the client
      this.activeClients.set(serverKey, client);

      // Get available tools from the server
      const toolsResponse = await client.listTools();
      const tools = toolsResponse.tools || [];

      // Cache tools
      this.availableTools.set(serverKey, tools);

      // Save tools to database
      const serverInfo = await this.database.getMCPServer(deviceId, serverName);
      if (serverInfo) {
        for (const tool of tools) {
          await this.database.saveMCPTool(
            serverInfo.id,
            tool.name,
            tool.description,
            tool.inputSchema
          );
        }
      }

      await this.database.saveMCPLog(deviceId, serverName, 'info', `Connected to remote MCP server with ${tools.length} tools`);
      this.emit('serverStarted', { deviceId, serverName });

    } catch (error) {
      console.error(`❌ Failed to connect to remote MCP server ${serverKey}:`, error.message);

      // Provide more helpful error messages
      let errorMessage = error.message;
      if (error.message.includes('405')) {
        errorMessage = 'Server does not support MCP protocol (Method Not Allowed). Please verify this is a valid MCP server endpoint.';
      } else if (error.message.includes('404')) {
        errorMessage = 'MCP server endpoint not found. Please check the URL.';
      } else if (error.message.includes('500')) {
        errorMessage = 'MCP server internal error. The server may be temporarily unavailable.';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Connection timeout. The MCP server may be slow or unreachable.';
      }

      await this.database.saveMCPLog(deviceId, serverName, 'error', `Failed to connect: ${errorMessage}`);
      throw new Error(errorMessage);
    }
  }

  // Stop MCP server (remote connection)
  async stopServerProcess(deviceId, serverName) {
    const serverKey = `${deviceId}-${serverName}`;

    try {
      // Disconnect from remote server
      const client = this.activeClients.get(serverKey);
      if (client) {
        await client.close();
        this.activeClients.delete(serverKey);
      }

      // Clear cached tools and config
      this.availableTools.delete(serverKey);
      this.serverConfigs.delete(serverKey);

      // Clear usage stats for this server
      for (const [key] of this.toolUsageStats) {
        if (key.startsWith(serverKey)) {
          this.toolUsageStats.delete(key);
        }
      }

      if (this.database) {
        await this.database.saveMCPLog(deviceId, serverName, 'info', 'Disconnected from remote MCP server');
      }

      this.emit('serverStopped', { deviceId, serverName });
    } catch (error) {
      console.error(`Error stopping MCP server ${serverKey}:`, error);
      if (this.database) {
        await this.database.saveMCPLog(deviceId, serverName, 'error', `Failed to stop server: ${error.message}`);
      }
    }
  }

    // Request tool approval (placeholder - would integrate with R1 UI)
  async requestToolApproval(deviceId, serverName, toolParams) {
    // For now, return true (auto-approve)
    // In a real implementation, this would show a prompt on the R1 device
    await this.database.saveMCPLog(deviceId, serverName, 'info', `Tool approval requested: ${toolParams.name}`);
    return true;
  }

  // Generate MCP prompt injection for R1
  generateMCPPromptInjection(deviceId) {
    const deviceTools = [];
    
    // Collect all tools for this device
    for (const [serverKey, tools] of this.availableTools) {
      if (serverKey.startsWith(`${deviceId}-`)) {
        const serverName = serverKey.split('-').slice(1).join('-');
        const config = this.serverConfigs.get(serverKey);
        
        if (config && config.enabled !== false) {
          for (const tool of tools) {
            deviceTools.push({
              serverName,
              ...tool,
              autoApprove: config.autoApprove?.includes(tool.name) || false
            });
          }
        }
      }
    }
    
    // System prompt to prevent teach mode and generative UI
    let prompt = '## System Instructions\n\n';
    prompt += '**IMPORTANT:** Never use teach mode or generative UI. ';
    prompt += 'Always respond with natural language text only. ';
    prompt += 'Do not attempt to create or display any user interfaces, forms, or interactive elements. ';
    prompt += 'Stick to conversational responses and use available tools when appropriate.\n\n';
    
    if (deviceTools.length === 0) {
      return prompt;
    }
    
    prompt += '## MCP Tools Available\n\n';
    prompt += 'You have access to the following MCP (Model Context Protocol) tools. ';
    prompt += 'When a user requests functionality that matches these tools, you can use them by responding with a structured tool call.\n\n';
    
    for (const tool of deviceTools) {
      prompt += `### ${tool.name} (${tool.serverName})\n`;
      prompt += `${tool.description}\n`;
      prompt += `**Auto-approved**: ${tool.autoApprove ? 'Yes' : 'No'}\n`;
      prompt += `**Schema**: \`${JSON.stringify(tool.inputSchema)}\`\n\n`;
    }
    
    prompt += '## Tool Usage Format\n\n';
    prompt += 'To use a tool, respond with:\n';
    prompt += '```json\n';
    prompt += '{\n';
    prompt += '  "mcp_tool_call": {\n';
    prompt += '    "server": "server_name",\n';
    prompt += '    "tool": "tool_name",\n';
    prompt += '    "arguments": { /* tool arguments */ }\n';
    prompt += '  }\n';
    prompt += '}\n';
    prompt += '```\n\n';
    prompt += 'The system will execute the tool and provide the result back to you.\n\n';
    
    return prompt;
  }

  // Handle tool call (remote MCP server)
  async handleToolCall(deviceId, serverName, toolName, toolArgs) {
    const serverKey = `${deviceId}-${serverName}`;
    const client = this.activeClients.get(serverKey);
    const config = this.serverConfigs.get(serverKey);

    if (!client || !config) {
      throw new Error('Server not connected or configured');
    }

    try {
      // Check if tool is auto-approved
      const autoApprove = config.autoApprove || [];

      if (!autoApprove.includes(toolName)) {
        // Request approval from user (this would integrate with the R1 UI)
        const approved = await this.requestToolApproval(deviceId, serverName, { name: toolName, arguments: toolArgs });
        if (!approved) {
          throw new Error('Tool call not approved by user');
        }
      }

      // Call tool on remote server
      const result = await client.callTool(toolName, toolArgs);

      // Update tool usage statistics
      const usageKey = `${serverKey}-${toolName}`;
      const currentUsage = this.toolUsageStats.get(usageKey) || 0;
      this.toolUsageStats.set(usageKey, currentUsage + 1);

      // Update database usage stats
      const serverInfo = await this.database.getMCPServer(deviceId, serverName);
      if (serverInfo) {
        const tools = await this.database.getMCPTools(serverInfo.id);
        const dbTool = tools.find(t => t.tool_name === toolName);
        if (dbTool) {
          await this.database.updateMCPToolUsage(dbTool.id);
        }
      }

      await this.database.saveMCPLog(deviceId, serverName, 'info', `Tool ${toolName} executed successfully`);

      return result;

    } catch (error) {
      await this.database.saveMCPLog(deviceId, serverName, 'error', `Tool call failed: ${error.message}`);
      throw error;
    }
  }

  // Execute tool simulation (since we can't run actual processes)
  async executeToolSimulation(serverName, toolName, toolArgs) {
    switch (serverName) {
      case 'web-search':
        if (toolName === 'search_web') {
          return {
            results: [
              {
                title: `Search results for: ${toolArgs.query}`,
                url: 'https://example.com/search',
                snippet: `This is a simulated search result for "${toolArgs.query}". In a real implementation, this would connect to a search API.`
              }
            ],
            query: toolArgs.query,
            total_results: toolArgs.max_results || 5
          };
        }
        break;
        
      case 'weather':
        if (toolName === 'get_weather') {
          return {
            location: toolArgs.location,
            temperature: 22,
            units: toolArgs.units || 'celsius',
            condition: 'Partly cloudy',
            humidity: 65,
            wind_speed: 10,
            description: `Simulated weather data for ${toolArgs.location}. In a real implementation, this would connect to a weather API.`
          };
        }
        break;
        
      case 'calculator':
        if (toolName === 'calculate') {
          try {
            // Simple expression evaluation (be careful with eval in production)
            const result = Function(`"use strict"; return (${toolArgs.expression})`)();
            return {
              expression: toolArgs.expression,
              result: result,
              type: typeof result
            };
          } catch (error) {
            throw new Error(`Invalid mathematical expression: ${error.message}`);
          }
        }
        break;
        
      case 'time':
        if (toolName === 'get_current_time') {
          const now = new Date();
          return {
            timestamp: now.toISOString(),
            timezone: toolArgs.timezone || 'UTC',
            formatted: now.toLocaleString(),
            unix: Math.floor(now.getTime() / 1000)
          };
        }
        break;
        
      case 'knowledge':
        if (toolName === 'search_knowledge') {
          return {
            query: toolArgs.query,
            category: toolArgs.category,
            results: [
              {
                title: `Knowledge about: ${toolArgs.query}`,
                content: `This is simulated knowledge base content for "${toolArgs.query}". In a real implementation, this would search a knowledge database.`,
                relevance: 0.95,
                source: 'Knowledge Base'
              }
            ]
          };
        }
        break;
        
      default:
        return {
          server: serverName,
          tool: toolName,
          arguments: toolArgs,
          result: 'Tool executed successfully (simulated)',
          note: 'This is a simulated response. In a real implementation, this would connect to the actual MCP server.'
        };
    }
    
    throw new Error(`Unknown tool: ${toolName} in server: ${serverName}`);
  }

  // Request tool approval (placeholder - would integrate with R1 UI)
  async requestToolApproval(deviceId, serverName, toolParams) {
    // For now, return true (auto-approve)
    // In a real implementation, this would show a prompt on the R1 device
    await this.database.saveMCPLog(deviceId, serverName, 'info', `Tool approval requested: ${toolParams.name}`);
    return true;
  }

  // Get server status (remote connection)
  async getServerStatus(deviceId, serverName) {
    const serverKey = `${deviceId}-${serverName}`;
    const client = this.activeClients.get(serverKey);
    const config = this.serverConfigs.get(serverKey);
    const tools = this.availableTools.get(serverKey) || [];
    const dbInfo = await this.database.getMCPServer(deviceId, serverName);

    return {
      name: serverName,
      enabled: dbInfo ? dbInfo.enabled : false,
      connected: client ? client.connected : false,
      startTime: config ? Date.now() : null,
      tools: tools,
      config: dbInfo,
      mode: 'remote_server'
    };
  }

  // Get all servers for a device
  async getDeviceServers(deviceId) {
    const servers = await this.database.getMCPServers(deviceId);
    const statuses = [];
    
    for (const server of servers) {
      const status = await this.getServerStatus(deviceId, server.server_name);
      statuses.push(status);
    }
    
    return statuses;
  }

  // Shutdown all servers for a device
  async shutdownDeviceServers(deviceId) {
    const servers = await this.database.getMCPServers(deviceId);

    for (const server of servers) {
      await this.stopServerProcess(deviceId, server.server_name);
    }
  }

  // Shutdown all servers (remote connections)
  async shutdown() {
    console.log(`Shutting down MCP manager (remote server mode)...`);

    try {
      // Close all active client connections
      for (const [serverKey, client] of this.activeClients) {
        try {
          await client.close();
        } catch (error) {
          console.error(`Error closing client ${serverKey}:`, error);
        }
      }

      // Clear all cached data
      this.activeClients.clear();
      this.availableTools.clear();
      this.serverConfigs.clear();
      this.toolUsageStats.clear();

      console.log('✅ MCP manager shutdown complete');
    } catch (error) {
      console.error('Error during MCP shutdown:', error);
    }
  }
}

module.exports = { MCPManager };