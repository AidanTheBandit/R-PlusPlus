// MCP (Model Context Protocol) Manager for R1 devices - Prompt Injection Based
const { EventEmitter } = require('events');
const crypto = require('crypto');

class MCPManager extends EventEmitter {
  constructor(database, deviceIdManager) {
    super();
    this.database = database;
    this.deviceIdManager = deviceIdManager;
    this.activeSessions = new Map(); // sessionId -> session info
    this.availableTools = new Map(); // deviceId-serverName -> tools
    this.serverConfigs = new Map(); // deviceId-serverName -> config
    this.toolUsageStats = new Map(); // deviceId-serverName-toolName -> usage count
  }

  // Initialize MCP server for a device (prompt injection based)
  async initializeServer(deviceId, serverName, config) {
    const serverKey = `${deviceId}-${serverName}`;
    
    try {
      // Save server configuration to database
      await this.database.saveMCPServer(deviceId, serverName, config);
      
      // Cache server config and initialize tools
      this.serverConfigs.set(serverKey, config);
      
      if (config.enabled !== false) {
        await this.initializeServerTools(deviceId, serverName, config);
      }
      
      this.emit('serverInitialized', { deviceId, serverName, config });
      return { success: true, message: 'MCP server initialized successfully' };
    } catch (error) {
      await this.database.saveMCPLog(deviceId, serverName, 'error', `Failed to initialize server: ${error.message}`);
      throw error;
    }
  }

  // Initialize server tools (prompt injection based)
  async initializeServerTools(deviceId, serverName, config) {
    const serverKey = `${deviceId}-${serverName}`;
    
    try {
      // Define available tools based on server type
      const tools = this.getToolsForServerType(serverName, config);
      
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
      
      await this.database.saveMCPLog(deviceId, serverName, 'info', `Initialized ${tools.length} tools for prompt injection`);
      this.emit('serverStarted', { deviceId, serverName });
      
    } catch (error) {
      await this.database.saveMCPLog(deviceId, serverName, 'error', `Failed to initialize tools: ${error.message}`);
      throw error;
    }
  }

  // Stop MCP server (prompt injection based)
  async stopServerProcess(deviceId, serverName) {
    const serverKey = `${deviceId}-${serverName}`;
    
    try {
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
        await this.database.saveMCPLog(deviceId, serverName, 'info', 'MCP server stopped (prompt injection mode)');
      }
      
      this.emit('serverStopped', { deviceId, serverName });
    } catch (error) {
      console.error(`Error stopping MCP server ${serverKey}:`, error);
      if (this.database) {
        await this.database.saveMCPLog(deviceId, serverName, 'error', `Failed to stop server: ${error.message}`);
      }
    }
  }

  // Get tools for server type (prompt injection based)
  getToolsForServerType(serverName, config) {
    const tools = [];
    
    switch (serverName) {
      case 'web-search':
        tools.push({
          name: 'search_web',
          description: 'Search the web for information',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              max_results: { type: 'number', description: 'Maximum number of results', default: 5 }
            },
            required: ['query']
          }
        });
        break;
        
      case 'weather':
        tools.push({
          name: 'get_weather',
          description: 'Get current weather information',
          inputSchema: {
            type: 'object',
            properties: {
              location: { type: 'string', description: 'Location to get weather for' },
              units: { type: 'string', description: 'Temperature units (celsius/fahrenheit)', default: 'celsius' }
            },
            required: ['location']
          }
        });
        break;
        
      case 'calculator':
        tools.push({
          name: 'calculate',
          description: 'Perform mathematical calculations',
          inputSchema: {
            type: 'object',
            properties: {
              expression: { type: 'string', description: 'Mathematical expression to evaluate' }
            },
            required: ['expression']
          }
        });
        break;
        
      case 'time':
        tools.push({
          name: 'get_current_time',
          description: 'Get current date and time',
          inputSchema: {
            type: 'object',
            properties: {
              timezone: { type: 'string', description: 'Timezone (optional)', default: 'UTC' }
            }
          }
        });
        break;
        
      case 'knowledge':
        tools.push({
          name: 'search_knowledge',
          description: 'Search knowledge base for information',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Knowledge search query' },
              category: { type: 'string', description: 'Knowledge category (optional)' }
            },
            required: ['query']
          }
        });
        break;
        
      default:
        // Generic tools for unknown server types
        tools.push({
          name: 'generic_tool',
          description: `Generic tool for ${serverName} server`,
          inputSchema: {
            type: 'object',
            properties: {
              action: { type: 'string', description: 'Action to perform' },
              parameters: { type: 'object', description: 'Action parameters' }
            },
            required: ['action']
          }
        });
    }
    
    return tools;
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

  // Handle tool call (prompt injection based)
  async handleToolCall(deviceId, serverName, toolName, toolArgs) {
    const serverKey = `${deviceId}-${serverName}`;
    const tools = this.availableTools.get(serverKey);
    const config = this.serverConfigs.get(serverKey);
    
    if (!tools || !config) {
      throw new Error('Server not configured or tools not available');
    }

    const tool = tools.find(t => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found in server ${serverName}`);
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

      // Simulate tool execution based on tool type
      const result = await this.executeToolSimulation(serverName, toolName, toolArgs);
      
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

  // Get server status (prompt injection based)
  async getServerStatus(deviceId, serverName) {
    const serverKey = `${deviceId}-${serverName}`;
    const config = this.serverConfigs.get(serverKey);
    const tools = this.availableTools.get(serverKey) || [];
    const dbInfo = await this.database.getMCPServer(deviceId, serverName);
    
    return {
      name: serverName,
      enabled: dbInfo ? dbInfo.enabled : false,
      running: config ? config.enabled !== false : false,
      startTime: config ? Date.now() : null,
      tools: tools,
      config: dbInfo,
      mode: 'prompt_injection'
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

  // Create MCP session
  async createSession(deviceId, serverName) {
    const sessionId = this.generateId();
    
    try {
      await this.database.createMCPSession(deviceId, serverName, sessionId);
      
      this.activeSessions.set(sessionId, {
        deviceId,
        serverName,
        createdAt: Date.now(),
        lastActivity: Date.now()
      });
      
      return sessionId;
    } catch (error) {
      await this.database.saveMCPLog(deviceId, serverName, 'error', `Failed to create session: ${error.message}`);
      throw error;
    }
  }

  // Close MCP session
  async closeSession(sessionId) {
    try {
      await this.database.closeMCPSession(sessionId);
      this.activeSessions.delete(sessionId);
    } catch (error) {
      console.error('Failed to close MCP session:', error);
    }
  }

  // Generate unique ID
  generateId() {
    return crypto.randomBytes(16).toString('hex');
  }

  // Cleanup inactive sessions
  async cleanupSessions() {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (now - session.lastActivity > maxAge) {
        await this.closeSession(sessionId);
      }
    }
  }

  // Shutdown all servers for a device
  async shutdownDeviceServers(deviceId) {
    const servers = await this.database.getMCPServers(deviceId);
    
    for (const server of servers) {
      await this.stopServerProcess(deviceId, server.server_name);
    }
  }

  // Shutdown all servers (prompt injection based)
  async shutdown() {
    console.log(`Shutting down MCP manager (prompt injection mode)...`);
    
    try {
      // Clear all cached data
      this.activeSessions.clear();
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