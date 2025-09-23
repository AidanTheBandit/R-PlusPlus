// MCP (Model Context Protocol) Manager for R1 devices
const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const crypto = require('crypto');

class MCPManager extends EventEmitter {
  constructor(database, deviceIdManager) {
    super();
    this.database = database;
    this.deviceIdManager = deviceIdManager;
    this.activeSessions = new Map(); // sessionId -> session info
    this.serverProcesses = new Map(); // deviceId-serverName -> process
    this.serverCapabilities = new Map(); // deviceId-serverName -> capabilities
    this.toolSchemas = new Map(); // deviceId-serverName -> tools
  }

  // Initialize MCP server for a device
  async initializeServer(deviceId, serverName, config) {
    const serverKey = `${deviceId}-${serverName}`;
    
    try {
      // Save server configuration to database
      await this.database.saveMCPServer(deviceId, serverName, config);
      
      // Start server process if enabled
      if (config.enabled !== false) {
        await this.startServerProcess(deviceId, serverName, config);
      }
      
      this.emit('serverInitialized', { deviceId, serverName, config });
      return { success: true, message: 'MCP server initialized successfully' };
    } catch (error) {
      await this.database.saveMCPLog(deviceId, serverName, 'error', `Failed to initialize server: ${error.message}`);
      throw error;
    }
  }

  // Start MCP server process
  async startServerProcess(deviceId, serverName, config) {
    const serverKey = `${deviceId}-${serverName}`;
    
    // Stop existing process if running
    await this.stopServerProcess(deviceId, serverName);
    
    try {
      const process = spawn(config.command, config.args || [], {
        env: { ...process.env, ...(config.env || {}) },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.serverProcesses.set(serverKey, {
        process,
        config,
        startTime: Date.now(),
        status: 'starting'
      });

      // Handle process events
      process.on('spawn', () => {
        this.serverProcesses.get(serverKey).status = 'running';
        this.database.saveMCPLog(deviceId, serverName, 'info', 'MCP server process started');
        this.emit('serverStarted', { deviceId, serverName });
      });

      process.on('error', (error) => {
        this.database.saveMCPLog(deviceId, serverName, 'error', `Process error: ${error.message}`);
        this.emit('serverError', { deviceId, serverName, error });
      });

      process.on('exit', (code, signal) => {
        this.serverProcesses.delete(serverKey);
        this.database.saveMCPLog(deviceId, serverName, 'info', `Process exited with code ${code}, signal ${signal}`);
        this.emit('serverStopped', { deviceId, serverName, code, signal });
      });

      // Handle stdout/stderr
      process.stdout.on('data', (data) => {
        this.handleServerOutput(deviceId, serverName, 'stdout', data.toString());
      });

      process.stderr.on('data', (data) => {
        this.handleServerOutput(deviceId, serverName, 'stderr', data.toString());
      });

      // Initialize server capabilities
      await this.initializeServerCapabilities(deviceId, serverName);
      
      return process;
    } catch (error) {
      await this.database.saveMCPLog(deviceId, serverName, 'error', `Failed to start process: ${error.message}`);
      throw error;
    }
  }

  // Stop MCP server process
  async stopServerProcess(deviceId, serverName) {
    const serverKey = `${deviceId}-${serverName}`;
    const serverInfo = this.serverProcesses.get(serverKey);
    
    if (!serverInfo || !serverInfo.process) {
      return; // Already stopped or never started
    }
    
    try {
      const process = serverInfo.process;
      
      // Check if process is still running
      if (process.killed || process.exitCode !== null) {
        this.serverProcesses.delete(serverKey);
        return;
      }
      
      // Try graceful shutdown first
      process.kill('SIGTERM');
      
      // Force kill after 5 seconds if not terminated
      const forceKillTimeout = setTimeout(() => {
        if (this.serverProcesses.has(serverKey) && !process.killed) {
          console.log(`Force killing MCP server: ${serverKey}`);
          process.kill('SIGKILL');
        }
      }, 5000);
      
      // Clean up timeout when process exits
      process.once('exit', () => {
        clearTimeout(forceKillTimeout);
        this.serverProcesses.delete(serverKey);
      });
      
      if (this.database) {
        await this.database.saveMCPLog(deviceId, serverName, 'info', 'MCP server process stopped');
      }
    } catch (error) {
      console.error(`Error stopping MCP server ${serverKey}:`, error);
      if (this.database) {
        await this.database.saveMCPLog(deviceId, serverName, 'error', `Failed to stop process: ${error.message}`);
      }
      // Remove from tracking even if there was an error
      this.serverProcesses.delete(serverKey);
    }
  }

  // Handle server output
  async handleServerOutput(deviceId, serverName, stream, data) {
    try {
      // Try to parse as JSON (MCP protocol messages)
      const lines = data.trim().split('\n');
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const message = JSON.parse(line);
            await this.handleMCPMessage(deviceId, serverName, message);
          } catch (parseError) {
            // Not JSON, treat as regular log
            await this.database.saveMCPLog(deviceId, serverName, 'debug', `${stream}: ${line}`);
          }
        }
      }
    } catch (error) {
      await this.database.saveMCPLog(deviceId, serverName, 'error', `Error handling output: ${error.message}`);
    }
  }

  // Handle MCP protocol messages
  async handleMCPMessage(deviceId, serverName, message) {
    try {
      switch (message.method) {
        case 'tools/list':
          await this.handleToolsList(deviceId, serverName, message);
          break;
        case 'tools/call':
          await this.handleToolCall(deviceId, serverName, message);
          break;
        case 'resources/list':
          await this.handleResourcesList(deviceId, serverName, message);
          break;
        case 'prompts/list':
          await this.handlePromptsList(deviceId, serverName, message);
          break;
        default:
          await this.database.saveMCPLog(deviceId, serverName, 'debug', `Received MCP message: ${message.method}`, message);
      }
    } catch (error) {
      await this.database.saveMCPLog(deviceId, serverName, 'error', `Error handling MCP message: ${error.message}`);
    }
  }

  // Initialize server capabilities
  async initializeServerCapabilities(deviceId, serverName) {
    const serverKey = `${deviceId}-${serverName}`;
    
    try {
      // Send initialization message
      const initMessage = {
        jsonrpc: '2.0',
        id: this.generateId(),
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {},
            prompts: {}
          },
          clientInfo: {
            name: 'R-API',
            version: '1.0.0'
          }
        }
      };

      await this.sendMessageToServer(deviceId, serverName, initMessage);
      
      // Request available tools
      const toolsMessage = {
        jsonrpc: '2.0',
        id: this.generateId(),
        method: 'tools/list'
      };

      await this.sendMessageToServer(deviceId, serverName, toolsMessage);
      
    } catch (error) {
      await this.database.saveMCPLog(deviceId, serverName, 'error', `Failed to initialize capabilities: ${error.message}`);
    }
  }

  // Send message to MCP server
  async sendMessageToServer(deviceId, serverName, message) {
    const serverKey = `${deviceId}-${serverName}`;
    const serverInfo = this.serverProcesses.get(serverKey);
    
    if (!serverInfo || !serverInfo.process) {
      throw new Error('Server process not running');
    }

    try {
      const messageStr = JSON.stringify(message) + '\n';
      serverInfo.process.stdin.write(messageStr);
      
      await this.database.saveMCPLog(deviceId, serverName, 'debug', `Sent message: ${message.method}`, message);
    } catch (error) {
      await this.database.saveMCPLog(deviceId, serverName, 'error', `Failed to send message: ${error.message}`);
      throw error;
    }
  }

  // Handle tools list response
  async handleToolsList(deviceId, serverName, message) {
    if (message.result && message.result.tools) {
      const serverInfo = await this.database.getMCPServer(deviceId, serverName);
      if (serverInfo) {
        // Save tools to database
        for (const tool of message.result.tools) {
          await this.database.saveMCPTool(
            serverInfo.id,
            tool.name,
            tool.description,
            tool.inputSchema
          );
        }
        
        // Cache tools
        const serverKey = `${deviceId}-${serverName}`;
        this.toolSchemas.set(serverKey, message.result.tools);
        
        await this.database.saveMCPLog(deviceId, serverName, 'info', `Loaded ${message.result.tools.length} tools`);
      }
    }
  }

  // Handle tool call
  async handleToolCall(deviceId, serverName, message) {
    // This would be called when the R1 wants to use an MCP tool
    const serverKey = `${deviceId}-${serverName}`;
    const serverInfo = this.serverProcesses.get(serverKey);
    
    if (!serverInfo) {
      throw new Error('Server not running');
    }

    try {
      // Check if tool is auto-approved
      const serverConfig = await this.database.getMCPServer(deviceId, serverName);
      const autoApprove = serverConfig.auto_approve ? JSON.parse(serverConfig.auto_approve) : [];
      
      if (!autoApprove.includes(message.params.name)) {
        // Request approval from user (this would integrate with the R1 UI)
        const approved = await this.requestToolApproval(deviceId, serverName, message.params);
        if (!approved) {
          throw new Error('Tool call not approved by user');
        }
      }

      // Forward tool call to server
      await this.sendMessageToServer(deviceId, serverName, message);
      
      // Update tool usage statistics
      const tools = await this.database.getMCPTools(serverConfig.id);
      const tool = tools.find(t => t.tool_name === message.params.name);
      if (tool) {
        await this.database.updateMCPToolUsage(tool.id);
      }
      
    } catch (error) {
      await this.database.saveMCPLog(deviceId, serverName, 'error', `Tool call failed: ${error.message}`);
      throw error;
    }
  }

  // Request tool approval (placeholder - would integrate with R1 UI)
  async requestToolApproval(deviceId, serverName, toolParams) {
    // For now, return true (auto-approve)
    // In a real implementation, this would show a prompt on the R1 device
    await this.database.saveMCPLog(deviceId, serverName, 'info', `Tool approval requested: ${toolParams.name}`);
    return true;
  }

  // Get server status
  async getServerStatus(deviceId, serverName) {
    const serverKey = `${deviceId}-${serverName}`;
    const serverInfo = this.serverProcesses.get(serverKey);
    const dbInfo = await this.database.getMCPServer(deviceId, serverName);
    
    return {
      name: serverName,
      enabled: dbInfo ? dbInfo.enabled : false,
      running: serverInfo ? serverInfo.status === 'running' : false,
      startTime: serverInfo ? serverInfo.startTime : null,
      tools: this.toolSchemas.get(serverKey) || [],
      config: dbInfo
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

  // Shutdown all servers
  async shutdown() {
    if (this.serverProcesses.size === 0) {
      return; // Already shut down
    }
    
    console.log(`Shutting down ${this.serverProcesses.size} MCP servers...`);
    
    const shutdownPromises = [];
    for (const [serverKey] of this.serverProcesses) {
      const [deviceId, serverName] = serverKey.split('-', 2);
      shutdownPromises.push(this.stopServerProcess(deviceId, serverName));
    }
    
    try {
      await Promise.all(shutdownPromises);
    } catch (error) {
      console.error('Error during MCP shutdown:', error);
    }
    
    this.activeSessions.clear();
    this.serverProcesses.clear();
    this.serverCapabilities.clear();
    this.toolSchemas.clear();
  }
}

module.exports = { MCPManager };