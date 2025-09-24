// MCP (Model Context Protocol) API routes
const express = require('express');
const { MCPManager } = require('../utils/mcp-manager');

function setupMCPRoutes(app, io, connectedR1s, mcpManager, deviceIdManager) {
  
  // Get all MCP servers for a device
  app.get('/:deviceId/mcp/servers', async (req, res) => {
    const { deviceId } = req.params;
    
    try {
      // Verify device exists
      const deviceInfo = await deviceIdManager.getDeviceInfoFromDB(deviceId);
      if (!deviceInfo) {
        return res.status(404).json({ 
          error: { message: 'Device not found', type: 'device_error' } 
        });
      }

      const servers = await mcpManager.getDeviceServers(deviceId);
      res.json({ servers });
    } catch (error) {
      console.error('Error getting MCP servers:', error);
      res.status(500).json({ 
        error: { message: 'Internal server error', type: 'server_error' } 
      });
    }
  });

  // Create or update MCP server
  app.post('/:deviceId/mcp/servers', async (req, res) => {
    const { deviceId } = req.params;
    const { serverName, config } = req.body;
    
    try {
      // Verify device exists
      const deviceInfo = await deviceIdManager.getDeviceInfoFromDB(deviceId);
      if (!deviceInfo) {
        return res.status(404).json({ 
          error: { message: 'Device not found', type: 'device_error' } 
        });
      }

      // Validate required fields
      if (!serverName || !config) {
        return res.status(400).json({ 
          error: { message: 'Server name and config are required', type: 'validation_error' } 
        });
      }

      // Validate config structure
      if (!config.command) {
        return res.status(400).json({ 
          error: { message: 'Server command is required', type: 'validation_error' } 
        });
      }

      const result = await mcpManager.initializeServer(deviceId, serverName, config);
      
      // Notify connected R1 device
      const socket = connectedR1s.get(deviceId);
      if (socket) {
        socket.emit('mcp_server_updated', { serverName, config });
      }

      res.json(result);
    } catch (error) {
      console.error('Error creating MCP server:', error);
      res.status(500).json({ 
        error: { message: error.message, type: 'server_error' } 
      });
    }
  });

  // Get specific MCP server
  app.get('/:deviceId/mcp/servers/:serverName', async (req, res) => {
    const { deviceId, serverName } = req.params;
    
    try {
      const status = await mcpManager.getServerStatus(deviceId, serverName);
      if (!status.config) {
        return res.status(404).json({ 
          error: { message: 'Server not found', type: 'server_error' } 
        });
      }
      
      res.json(status);
    } catch (error) {
      console.error('Error getting MCP server:', error);
      res.status(500).json({ 
        error: { message: 'Internal server error', type: 'server_error' } 
      });
    }
  });

  // Delete MCP server
  app.delete('/:deviceId/mcp/servers/:serverName', async (req, res) => {
    const { deviceId, serverName } = req.params;
    
    try {
      // Stop server process
      await mcpManager.stopServerProcess(deviceId, serverName);
      
      // Delete from database
      await mcpManager.database.deleteMCPServer(deviceId, serverName);
      
      // Notify connected R1 device
      const socket = connectedR1s.get(deviceId);
      if (socket) {
        socket.emit('mcp_server_deleted', { serverName });
      }

      res.json({ success: true, message: 'Server deleted successfully' });
    } catch (error) {
      console.error('Error deleting MCP server:', error);
      res.status(500).json({ 
        error: { message: error.message, type: 'server_error' } 
      });
    }
  });

  // Start/stop MCP server
  app.post('/:deviceId/mcp/servers/:serverName/toggle', async (req, res) => {
    const { deviceId, serverName } = req.params;
    const { enabled } = req.body;
    
    try {
      const serverConfig = await mcpManager.database.getMCPServer(deviceId, serverName);
      if (!serverConfig) {
        return res.status(404).json({ 
          error: { message: 'Server not found', type: 'server_error' } 
        });
      }

      // Update database
      await mcpManager.database.updateMCPServerStatus(deviceId, serverName, enabled);
      
      // Start or stop server (prompt injection mode)
      if (enabled) {
        const config = {
          command: serverConfig.command,
          args: serverConfig.args ? JSON.parse(serverConfig.args) : [],
          env: serverConfig.env ? JSON.parse(serverConfig.env) : {},
          autoApprove: serverConfig.auto_approve ? JSON.parse(serverConfig.auto_approve) : [],
          enabled: true
        };
        await mcpManager.initializeServerTools(deviceId, serverName, config);
      } else {
        await mcpManager.stopServerProcess(deviceId, serverName);
      }

      // Notify connected R1 device
      const socket = connectedR1s.get(deviceId);
      if (socket) {
        socket.emit('mcp_server_toggled', { serverName, enabled });
      }

      res.json({ success: true, enabled });
    } catch (error) {
      console.error('Error toggling MCP server:', error);
      res.status(500).json({ 
        error: { message: error.message, type: 'server_error' } 
      });
    }
  });

  // Get MCP tools for a server
  app.get('/:deviceId/mcp/servers/:serverName/tools', async (req, res) => {
    const { deviceId, serverName } = req.params;
    
    try {
      const serverConfig = await mcpManager.database.getMCPServer(deviceId, serverName);
      if (!serverConfig) {
        return res.status(404).json({ 
          error: { message: 'Server not found', type: 'server_error' } 
        });
      }

      const tools = await mcpManager.database.getMCPTools(serverConfig.id);
      res.json({ tools });
    } catch (error) {
      console.error('Error getting MCP tools:', error);
      res.status(500).json({ 
        error: { message: 'Internal server error', type: 'server_error' } 
      });
    }
  });

  // Call MCP tool
  app.post('/:deviceId/mcp/servers/:serverName/tools/:toolName/call', async (req, res) => {
    const { deviceId, serverName, toolName } = req.params;
    const { arguments: toolArgs } = req.body;
    
    try {
      const result = await mcpManager.handleToolCall(deviceId, serverName, toolName, toolArgs || {});
      
      res.json({ 
        success: true, 
        result: result,
        message: 'Tool executed successfully' 
      });
    } catch (error) {
      console.error('Error calling MCP tool:', error);
      res.status(500).json({ 
        error: { message: error.message, type: 'server_error' } 
      });
    }
  });

  // Get MCP logs
  app.get('/:deviceId/mcp/logs', async (req, res) => {
    const { deviceId } = req.params;
    const { serverName, limit = 100 } = req.query;
    
    try {
      const logs = await mcpManager.database.getMCPLogs(deviceId, serverName, parseInt(limit));
      res.json({ logs });
    } catch (error) {
      console.error('Error getting MCP logs:', error);
      res.status(500).json({ 
        error: { message: 'Internal server error', type: 'server_error' } 
      });
    }
  });

  // Create MCP session
  app.post('/:deviceId/mcp/sessions', async (req, res) => {
    const { deviceId } = req.params;
    const { serverName } = req.body;
    
    try {
      if (!serverName) {
        return res.status(400).json({ 
          error: { message: 'Server name is required', type: 'validation_error' } 
        });
      }

      const sessionId = await mcpManager.createSession(deviceId, serverName);
      res.json({ sessionId });
    } catch (error) {
      console.error('Error creating MCP session:', error);
      res.status(500).json({ 
        error: { message: error.message, type: 'server_error' } 
      });
    }
  });

  // Get MCP sessions
  app.get('/:deviceId/mcp/sessions', async (req, res) => {
    const { deviceId } = req.params;
    
    try {
      const sessions = await mcpManager.database.getMCPSessions(deviceId);
      res.json({ sessions });
    } catch (error) {
      console.error('Error getting MCP sessions:', error);
      res.status(500).json({ 
        error: { message: 'Internal server error', type: 'server_error' } 
      });
    }
  });

  // Close MCP session
  app.delete('/:deviceId/mcp/sessions/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    
    try {
      await mcpManager.closeSession(sessionId);
      res.json({ success: true, message: 'Session closed successfully' });
    } catch (error) {
      console.error('Error closing MCP session:', error);
      res.status(500).json({ 
        error: { message: error.message, type: 'server_error' } 
      });
    }
  });

  // Get MCP prompt injection for device
  app.get('/:deviceId/mcp/prompt-injection', async (req, res) => {
    const { deviceId } = req.params;
    
    try {
      // Verify device exists
      const deviceInfo = await deviceIdManager.getDeviceInfoFromDB(deviceId);
      if (!deviceInfo) {
        return res.status(404).json({ 
          error: { message: 'Device not found', type: 'device_error' } 
        });
      }

      const promptInjection = mcpManager.generateMCPPromptInjection(deviceId);
      
      res.json({ 
        deviceId,
        promptInjection,
        hasTools: promptInjection.length > 0,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error generating MCP prompt injection:', error);
      res.status(500).json({ 
        error: { message: 'Internal server error', type: 'server_error' } 
      });
    }
  });

  // Get MCP server templates/presets (root level - no device required)
  app.get('/mcp/templates', (req, res) => {
    const templates = [
      {
        name: 'web-search',
        displayName: 'Web Search',
        description: 'Search the web using various search engines',
        command: 'simulated',
        args: [],
        env: {},
        autoApprove: ['search_web'],
        category: 'web'
      },
      {
        name: 'weather',
        displayName: 'Weather Information',
        description: 'Get current weather information for any location',
        command: 'simulated',
        args: [],
        env: {},
        autoApprove: ['get_weather'],
        category: 'information'
      },
      {
        name: 'calculator',
        displayName: 'Calculator',
        description: 'Perform mathematical calculations',
        command: 'simulated',
        args: [],
        env: {},
        autoApprove: ['calculate'],
        category: 'utility'
      },
      {
        name: 'time',
        displayName: 'Time & Date',
        description: 'Get current time and date information',
        command: 'simulated',
        args: [],
        env: {},
        autoApprove: ['get_current_time'],
        category: 'utility'
      },
      {
        name: 'knowledge',
        displayName: 'Knowledge Base',
        description: 'Search knowledge base for information',
        command: 'simulated',
        args: [],
        env: {},
        autoApprove: [],
        category: 'information'
      }
    ];

    res.json({ templates });
  });



  // Debug endpoint to check device state
  app.get('/debug/device/:deviceId', (req, res) => {
    const { deviceId } = req.params;
    
    const debugInfo = {
      deviceId,
      hasDevice: deviceIdManager.hasDevice(deviceId),
      connectedR1sHas: connectedR1s.has(deviceId),
      deviceInfo: deviceIdManager.getDeviceInfo(deviceId),
      socketId: deviceIdManager.getSocketForDevice(deviceId),
      connectedDevices: Array.from(connectedR1s.keys()),
      timestamp: new Date().toISOString()
    };
    
    console.log(`🔍 Debug info for device ${deviceId}:`, JSON.stringify(debugInfo, null, 2));
    res.json(debugInfo);
  });

  // Debug endpoint to manually test chat completion
  app.post('/debug/test-chat/:deviceId', (req, res) => {
    const { deviceId } = req.params;
    const { message = 'Test message from debug endpoint' } = req.body;
    
    console.log(`🧪 Manual chat test for device: ${deviceId}`);
    
    if (connectedR1s.has(deviceId)) {
      const socket = connectedR1s.get(deviceId);
      const testCommand = {
        type: 'chat_completion',
        data: {
          message,
          originalMessage: message,
          model: 'r1-command',
          temperature: 0.7,
          max_tokens: 150,
          requestId: `debug-${Date.now()}`,
          timestamp: new Date().toISOString()
        }
      };
      
      console.log(`🧪 Sending test command:`, JSON.stringify(testCommand, null, 2));
      socket.emit('chat_completion', testCommand);
      
      res.json({ 
        success: true, 
        message: 'Test command sent',
        command: testCommand
      });
    } else {
      res.status(404).json({ 
        error: 'Device not connected',
        deviceId,
        connectedDevices: Array.from(connectedR1s.keys())
      });
    }
  });

  console.log('MCP routes initialized');
}

module.exports = { setupMCPRoutes };