// MCP (Model Context Protocol) Manager for R1 devices - Remote Support
const { EventEmitter } = require('events');
const { MCPProtocolClient, StdioMCPClient } = require('./mcp-protocol-client');
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
    
    // Reconnection management
    this.reconnectionAttempts = new Map(); // deviceId-serverName -> attempt count
    this.reconnectionTimers = new Map(); // deviceId-serverName -> timer
    this.healthCheckInterval = null;
    this.healthCheckIntervalMs = 30000; // Check every 30 seconds
    
    // Start health monitoring
    this.startHealthMonitoring();
  }

  // Async initialization method
  async initialize() {
    await this.initializeFromDatabase();
  }

  // Start periodic health checks for all MCP servers
  startHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.healthCheckIntervalMs);
    
    console.log(`[MCP] Started MCP server health monitoring (every ${this.healthCheckIntervalMs/1000}s)`);
  }

  // Stop health monitoring
  stopHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('[MCP] Stopped MCP server health monitoring');
    }
  }

  // Perform health checks on all connected servers
  async performHealthChecks() {
    for (const [serverKey, client] of this.activeClients) {
      if (!client || !client.connected) {
        continue;
      }
      
      try {
        // Try to ping the server to check if it's still responsive
        await client.ping();
      } catch (error) {
        console.warn(`⚠️ Health check failed for ${serverKey}: ${error.message}`);
        // Mark as disconnected and attempt reconnection
        this.handleServerDisconnection(serverKey);
      }
    }
  }

  // Handle server disconnection and initiate reconnection
  async handleServerDisconnection(serverKey) {
    const [deviceId, serverName] = serverKey.split('-', 2);
    
    // Remove from active clients
    const client = this.activeClients.get(serverKey);
    if (client) {
      try {
        await client.close();
      } catch (error) {
        console.warn(`Error closing disconnected client ${serverKey}: ${error.message}`);
      }
      this.activeClients.delete(serverKey);
    }
    
    // Clear cached tools
    this.availableTools.delete(serverKey);
    
    // Log disconnection
    await this.database.saveMCPLog(deviceId, serverName, 'warning', 'Server disconnected unexpectedly, attempting reconnection');
    
    // Start reconnection process
    this.attemptReconnection(deviceId, serverName);
  }

  // Attempt to reconnect to a server with exponential backoff
  async attemptReconnection(deviceId, serverName) {
    const serverKey = `${deviceId}-${serverName}`;
    const config = this.serverConfigs.get(serverKey);
    
    if (!config || (!config.url && !config.command)) {
      console.warn(`[MCP] Cannot reconnect ${serverKey}: no url or command configured`);
      return;
    }
    
    // Get current attempt count
    const attemptCount = this.reconnectionAttempts.get(serverKey) || 0;
    
    // Clear any existing reconnection timer
    const existingTimer = this.reconnectionTimers.get(serverKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Calculate delay with exponential backoff (30s, 1m, 2m, 4m, 8m, then every 8m)
    const baseDelay = 30000; // 30 seconds
    const maxDelay = 480000; // 8 minutes
    const delay = Math.min(baseDelay * Math.pow(2, attemptCount), maxDelay);
    
    console.log(`[MCP] Scheduling reconnection attempt ${attemptCount + 1} for ${serverKey} in ${delay/1000}s`);
    
    const timer = setTimeout(async () => {
      try {
        console.log(`[MCP] Attempting to reconnect ${serverKey} (attempt ${attemptCount + 1})`);
        
        // Attempt reconnection (stdio or remote)
        if (config.command) {
          await this.connectToStdioServer(deviceId, serverName, config);
        } else {
          await this.connectToRemoteServer(deviceId, serverName, config);
        }
        
        // Success - reset attempt count and clear timer
        this.reconnectionAttempts.delete(serverKey);
        this.reconnectionTimers.delete(serverKey);
        
        await this.database.saveMCPLog(deviceId, serverName, 'info', `Successfully reconnected after ${attemptCount + 1} attempts`);
        console.log(`[MCP] Successfully reconnected ${serverKey}`);
        
        this.emit('serverReconnected', { deviceId, serverName });
        
      } catch (error) {
        console.warn(`❌ Reconnection attempt ${attemptCount + 1} failed for ${serverKey}: ${error.message}`);
        
        // Increment attempt count and schedule next attempt
        this.reconnectionAttempts.set(serverKey, attemptCount + 1);
        this.attemptReconnection(deviceId, serverName);
      }
    }, delay);
    
    this.reconnectionTimers.set(serverKey, timer);
  }

  // Initialize MCP manager with existing server configurations from database
  async initializeFromDatabase() {
    try {
      if (!this.database) {
        console.warn('Database not available for MCP manager initialization');
        return;
      }

      // Load all MCP servers from database (from all devices)
      const allServers = await this.database.all('SELECT * FROM mcp_servers');
      
      for (const server of allServers) {
        const serverKey = `${server.device_id}-${server.server_name}`;
        
        // Parse server configuration
        let config = null;
        if (server.config) {
          try {
            config = JSON.parse(server.config);
          } catch (error) {
            console.warn(`Failed to parse config for server ${serverKey}:`, error);
            continue;
          }
        }
        
        // Fallback to legacy format
        if (!config) {
          config = {
            url: server.url,
            protocolVersion: server.protocol_version,
            enabled: server.enabled,
            capabilities: {
              tools: {
                enabled: true,
                autoApprove: server.auto_approve ? JSON.parse(server.auto_approve) : []
              }
            }
          };
        }
        
        // Cache server config
        this.serverConfigs.set(serverKey, config);
        
        // Load tools from database if available
        try {
          const dbTools = await this.database.getMCPTools(server.id);
          if (dbTools && dbTools.length > 0) {
            const tools = dbTools.map(dbTool => ({
              name: dbTool.tool_name,
              description: dbTool.tool_description,
              inputSchema: JSON.parse(dbTool.tool_schema),
              serverName: server.server_name
            }));
            this.availableTools.set(serverKey, tools);
          }
        } catch (error) {
          console.warn(`Failed to load tools for server ${serverKey}:`, error);
        }

        // If server is enabled, try to connect to it
        if (config.enabled !== false) {
          try {
            if (config.command) {
              // stdio server
              console.log(`[MCP] Auto-connecting to enabled stdio server: ${serverKey}`);
              await this.connectToStdioServer(server.device_id, server.server_name, config);
            } else if (config.url) {
              // remote server
              console.log(`[MCP] Auto-connecting to enabled remote server: ${serverKey}`);
              await this.connectToRemoteServer(server.device_id, server.server_name, config);
            }
          } catch (connectionError) {
            console.log(`[MCP] Failed to auto-connect to ${serverKey} during init: ${connectionError.message}`);
          }
        }
      }
      
      console.log(`[MCP] Manager initialized with ${allServers.length} servers from database`);
    } catch (error) {
      console.error('Failed to initialize MCP manager from database:', error);
    }
  }

  // Initialize MCP server for a device (remote or stdio)
  async initializeServer(deviceId, serverName, config) {
    const serverKey = `${deviceId}-${serverName}`;

    try {
      // Determine transport type
      const isStdio = !config.url && config.command;

      if (!isStdio && !config.url) {
        throw new Error('Server config must have either a url (remote) or command (stdio)');
      }

      // Save server configuration to database
      await this.database.saveMCPServer(deviceId, serverName, config);

      // Cache server config
      this.serverConfigs.set(serverKey, config);

      if (config.enabled !== false) {
        try {
          if (isStdio) {
            await this.connectToStdioServer(deviceId, serverName, config);
          } else if (config.url && config.url.trim()) {
            await this.connectToRemoteServer(deviceId, serverName, config);
          } else {
            console.log(`[MCP] Server ${serverName} configured but no url/command provided`);
            await this.database.saveMCPLog(deviceId, serverName, 'info', 'Server configured but no url/command provided');
          }
        } catch (connectionError) {
          console.log(`[MCP] Failed to connect to ${serverName} during initialization: ${connectionError.message}`);
          await this.database.saveMCPLog(deviceId, serverName, 'warning', `Connection failed during initialization: ${connectionError.message}`);
        }
      }

      this.emit('serverInitialized', { deviceId, serverName, config });
      return { success: true, message: 'MCP server initialized successfully' };
    } catch (error) {
      await this.database.saveMCPLog(deviceId, serverName, 'error', `Failed to initialize server: ${error.message}`);
      throw error;
    }
  }

  // Connect to a local stdio MCP server (spawn as child process)
  async connectToStdioServer(deviceId, serverName, config) {
    const serverKey = `${deviceId}-${serverName}`;

    try {
      console.log(`[MCP] Connecting to stdio server: ${config.command} ${(config.args || []).join(' ')}`);

      const client = new StdioMCPClient(config.command, config.args || [], {
        protocolVersion: config.protocolVersion || '2025-06-18',
        clientInfo: { name: 'R-API-MCP-Client', version: '1.0.0' },
        capabilities: {
          tools: {},
          ...(config.capabilities?.resources?.enabled ? { resources: {} } : {}),
          ...(config.capabilities?.prompts?.enabled ? { prompts: {} } : {})
        },
        env: config.env || {},
        cwd: config.cwd || null,
        timeout: config.timeout || 30000
      });

      await client.initialize();

      // Store the client
      this.activeClients.set(serverKey, client);

      // Discover tools
      const toolsResponse = await client.listTools();
      const rawTools = toolsResponse.tools || [];
      const tools = rawTools.map(tool => ({ ...tool, serverName }));

      this.availableTools.set(serverKey, tools);

      // Save tools to database
      const serverInfo = await this.database.getMCPServer(deviceId, serverName);
      if (serverInfo) {
        for (const tool of tools) {
          await this.database.saveMCPTool(serverInfo.id, tool.name, tool.description, tool.inputSchema);
        }
      }

      await this.database.saveMCPLog(deviceId, serverName, 'info', `Connected to stdio MCP server with ${tools.length} tools`);
      this.emit('serverStarted', { deviceId, serverName });

    } catch (error) {
      console.error(`[MCP] Failed to connect to stdio server ${serverKey}: ${error.message}`);
      await this.database.saveMCPLog(deviceId, serverName, 'error', `Stdio connection failed: ${error.message}`);
      throw error;
    }
  }

  // Connect to remote MCP server
  async connectToRemoteServer(deviceId, serverName, config) {
    const serverKey = `${deviceId}-${serverName}`;

    try {
      console.log(`[MCP] Connecting to remote MCP server: ${config.url}`);

      // Create MCP protocol client with capabilities from config
      const clientCapabilities = {};
      if (config.capabilities?.tools?.enabled) {
        clientCapabilities.tools = {};
      }
      if (config.capabilities?.resources?.enabled) {
        clientCapabilities.resources = {};
      }
      if (config.capabilities?.prompts?.enabled) {
        clientCapabilities.prompts = {};
      }
      if (config.capabilities?.sampling?.enabled) {
        clientCapabilities.sampling = {};
      }

      // Create MCP protocol client
      const client = new MCPProtocolClient(config.url, {
        protocolVersion: config.protocolVersion || '2025-06-18',
        clientInfo: {
          name: 'R-API-MCP-Client',
          version: '1.0.0'
        },
        capabilities: clientCapabilities,
        headers: config.headers || {},
        timeout: config.timeout || 30000
      });

      // Initialize the connection
      const initResult = await client.initialize();

      // Store the client
      this.activeClients.set(serverKey, client);

      // Get available tools from the server
      const toolsResponse = await client.listTools();
      const rawTools = toolsResponse.tools || [];

      // Add serverName to each tool for consistency
      const tools = rawTools.map(tool => ({
        ...tool,
        serverName: serverName
      }));

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

      // Clear reconnection state
      this.reconnectionAttempts.delete(serverKey);
      const timer = this.reconnectionTimers.get(serverKey);
      if (timer) {
        clearTimeout(timer);
        this.reconnectionTimers.delete(serverKey);
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

  // Generate MCP prompt injection for device
  async generateMCPPromptInjection(deviceId) {
    const tools = await this.getDeviceTools(deviceId);

    if (tools.length === 0) {
      return '';
    }

    let prompt = '## AVAILABLE TOOLS\n\n';
    prompt += 'You have access to external tools via MCP (Model Context Protocol). ';
    prompt += 'When a user asks something that could benefit from a tool, call it.\n\n';

    for (const tool of tools) {
      prompt += `### ${tool.name}\n`;
      prompt += `Server: ${tool.serverName}\n`;
      if (tool.description) {
        prompt += `${tool.description}\n`;
      }
      if (tool.inputSchema && tool.inputSchema.properties) {
        prompt += 'Parameters:\n';
        const props = tool.inputSchema.properties;
        const required = tool.inputSchema.required || [];
        for (const [key, schema] of Object.entries(props)) {
          const req = required.includes(key) ? ' (required)' : ' (optional)';
          prompt += `  - ${key}: ${schema.type || 'any'}${req}`;
          if (schema.description) {
            prompt += ` - ${schema.description}`;
          }
          prompt += '\n';
        }
      }
      prompt += '\n';
    }

    prompt += '## TOOL USAGE FORMAT\n\n';
    prompt += 'To call a tool, respond with ONLY this JSON (no other text):\n';
    prompt += '```json\n';
    prompt += '{"mcp_tool_call": {"server": "serverName", "tool": "toolName", "arguments": {"param": "value"}}}\n';
    prompt += '```\n\n';
    prompt += 'After the tool executes, you will receive the results and should respond naturally using that data.\n';
    prompt += 'Only call a tool when it would genuinely help answer the question.\n\n';

    return prompt;
  }

  // Handle tool call (remote MCP server) - works with servers from any device
  async handleToolCall(deviceId, serverName, toolName, toolArgs) {
    // Find the server config - first check current device, then any device
    let serverKey = `${deviceId}-${serverName}`;
    let config = this.serverConfigs.get(serverKey);
    let actualDeviceId = deviceId;

    if (!config) {
      // Look for the server in any device's config
      for (const [key, serverConfig] of this.serverConfigs) {
        if (key.endsWith(`-${serverName}`)) {
          config = serverConfig;
          actualDeviceId = key.split('-')[0];
          serverKey = key;
          break;
        }
      }
    }

    if (!config) {
      const error = `Server ${serverName} not configured on any device`;
      console.error(`MCP Tool Call Error: ${error}`);
      await this.database.saveMCPLog(deviceId, serverName, 'error', error);
      throw new Error(error);
    }

    const client = this.activeClients.get(serverKey);
    if (!client) {
      const error = `Server ${serverName} not connected`;
      console.error(`MCP Tool Call Error: ${error}`);
      await this.database.saveMCPLog(actualDeviceId, serverName, 'error', error);
      
      // Attempt to reconnect
      console.log(`Attempting to reconnect to ${serverName} for tool call`);
      try {
        await this.connectToRemoteServer(actualDeviceId, serverName, config);
        // If reconnection successful, continue with tool call
      } catch (reconnectError) {
        console.error(`MCP Reconnection failed: ${reconnectError.message}`);
        throw new Error(`Server connection lost. Reconnection failed: ${reconnectError.message}`);
      }
    }

    try {
      console.log(`[MCP] Executing tool: ${serverName}.${toolName} with args:`, toolArgs);
      
      // Call tool on remote server
      const result = await client.callTool(toolName, toolArgs);

      // Update tool usage statistics
      const usageKey = `${serverKey}-${toolName}`;
      const currentUsage = this.toolUsageStats.get(usageKey) || 0;
      this.toolUsageStats.set(usageKey, currentUsage + 1);

      // Update database usage stats
      const serverInfo = await this.database.getMCPServer(actualDeviceId, serverName);
      if (serverInfo) {
        const tools = await this.database.getMCPTools(serverInfo.id);
        const dbTool = tools.find(t => t.tool_name === toolName);
        if (dbTool) {
          await this.database.updateMCPToolUsage(dbTool.id);
        }
      }

      console.log(`MCP tool executed successfully: ${serverName}.${toolName}`);
      await this.database.saveMCPLog(actualDeviceId, serverName, 'info', `Tool ${toolName} executed successfully`);

      return result;

    } catch (error) {
      console.error(`MCP Tool Execution Error: ${error.message}`);
      
      // Check if this is a connection-related error that should trigger reconnection
      if (error.message.includes('connect') || error.message.includes('timeout') || error.message.includes('ECONNREFUSED')) {
        console.warn(`Connection error during tool call for ${serverKey}, triggering reconnection: ${error.message}`);
        this.handleServerDisconnection(serverKey);
        throw new Error(`Server connection lost during tool call. Reconnection initiated. Please retry the operation.`);
      }

      await this.database.saveMCPLog(actualDeviceId, serverName, 'error', `Tool call failed: ${error.message}`);
      throw error;
    }
  }

  // Get server status (remote connection)
  async getServerStatus(deviceId, serverName) {
    const serverKey = `${deviceId}-${serverName}`;
    const client = this.activeClients.get(serverKey);
    const dbInfo = await this.database.getMCPServer(deviceId, serverName);

    let config = null;
    if (dbInfo) {
      // Try to get config from database
      config = this.serverConfigs.get(serverKey);
      if (!config && dbInfo.config) {
        try {
          config = JSON.parse(dbInfo.config);
        } catch (error) {
          console.warn(`Failed to parse config for server ${serverName}:`, error);
          // Create a basic config from legacy fields if parsing fails
          config = {
            url: dbInfo.url || null,
            protocolVersion: dbInfo.protocol_version || '2025-06-18',
            enabled: dbInfo.enabled || false,
            capabilities: {
              tools: {
                enabled: true,
                autoApprove: dbInfo.auto_approve ? JSON.parse(dbInfo.auto_approve) : []
              }
            },
            description: dbInfo.description || null
          };
        }
      }

      // If still no config, create a default one
      if (!config) {
        config = {
          url: null,
          protocolVersion: '2025-06-18',
          enabled: dbInfo ? dbInfo.enabled : false,
          capabilities: {
            tools: {
              enabled: true,
              autoApprove: []
            }
          },
          description: dbInfo ? dbInfo.description : null
        };
      }
    }

    const tools = this.availableTools.get(serverKey) || [];

    return {
      name: serverName,
      enabled: dbInfo ? dbInfo.enabled : false,
      connected: client ? client.connected : false,
      startTime: config ? Date.now() : null,
      tools: tools,
      config: dbInfo,
      url: config ? config.url : 'N/A',
      description: config ? config.description : null,
      protocolVersion: config ? config.protocolVersion : null,
      autoApprove: config && config.capabilities && config.capabilities.tools ? config.capabilities.tools.autoApprove : [],
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



  // Get all available tools for a device (including cached tools from all devices)
  async getDeviceTools(deviceId) {
    const tools = new Map(); // Use Map to avoid duplicates by serverName-toolName key

    // First, add tools from actively connected servers (for any device)
    for (const [serverKey, toolList] of this.availableTools) {
      toolList.forEach(tool => {
        const key = `${tool.serverName}-${tool.name}`;
        tools.set(key, tool);
      });
    }

    // If no connected servers have tools, try to load cached tools from database for all devices
    if (tools.size === 0) {
      try {
        // Get all enabled servers from all devices
        const allServers = await this.database.all('SELECT * FROM mcp_servers WHERE enabled = 1');
        
        for (const server of allServers) {
          const dbTools = await this.database.getMCPTools(server.id);
          if (dbTools && dbTools.length > 0) {
            dbTools.forEach(dbTool => {
              try {
                const toolSchema = JSON.parse(dbTool.input_schema || dbTool.tool_schema);
                const tool = {
                  name: dbTool.tool_name,
                  description: dbTool.description || dbTool.tool_description,
                  inputSchema: toolSchema,
                  serverName: server.server_name
                };
                const key = `${server.server_name}-${dbTool.tool_name}`;
                tools.set(key, tool);
              } catch (error) {
                console.warn(`Failed to parse tool schema for ${dbTool.tool_name}:`, error);
              }
            });
          }
        }
      } catch (error) {
        console.warn(`Failed to load cached tools:`, error);
      }
    }

    return Array.from(tools.values());
  }

  // Check if a tool is auto-approved for any device
  isToolAutoApproved(deviceId, serverName, toolName) {
    // Check current device's config first
    const serverKey = `${deviceId}-${serverName}`;
    let config = this.serverConfigs.get(serverKey);

    if (config && config.capabilities && config.capabilities.tools) {
      const autoApprove = config.capabilities.tools.autoApprove || [];
      if (autoApprove.includes(toolName) || autoApprove.includes('*')) {
        return true;
      }
    }

    // If not found, check configs from all devices
    for (const [key, serverConfig] of this.serverConfigs) {
      if (key.endsWith(`-${serverName}`) && serverConfig.capabilities?.tools?.autoApprove) {
        const autoApprove = serverConfig.capabilities.tools.autoApprove;
        if (autoApprove.includes(toolName) || autoApprove.includes('*')) {
          return true;
        }
      }
    }

    return false;
  }

  // Shutdown the MCP manager and clean up all resources
  async shutdown() {
    console.log('🛑 Shutting down MCP manager...');
    
    // Stop health monitoring
    this.stopHealthMonitoring();
    
    // Clear all reconnection timers
    for (const timer of this.reconnectionTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectionTimers.clear();
    this.reconnectionAttempts.clear();
    
    // Close all active connections
    const shutdownPromises = [];
    for (const [serverKey, client] of this.activeClients) {
      const [deviceId, serverName] = serverKey.split('-', 2);
      shutdownPromises.push(this.stopServerProcess(deviceId, serverName));
    }
    
    try {
      await Promise.all(shutdownPromises);
      console.log('[MCP] Manager shutdown complete');
    } catch (error) {
      console.error('❌ Error during MCP manager shutdown:', error);
    }
  }
}

module.exports = { MCPManager };