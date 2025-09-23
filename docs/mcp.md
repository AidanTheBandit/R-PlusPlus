# MCP (Model Context Protocol) Integration

## Overview

The R-API now includes comprehensive support for MCP (Model Context Protocol), allowing R1 devices to connect to and use external tools and services through standardized MCP servers. This enables powerful extensibility while maintaining security and control.

## Features

- **Server Management**: Register, configure, and manage MCP servers per device
- **Tool Discovery**: Automatically discover and catalog available tools from MCP servers
- **Security Controls**: Auto-approval lists and manual approval workflows
- **Real-time Monitoring**: Live status monitoring and logging
- **Template System**: Pre-configured templates for popular MCP servers
- **Session Management**: Persistent sessions with automatic cleanup

## Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ R1 Device   │────│ R-API Server│────│ MCP Servers │
│             │    │             │    │             │
│ • MCP Client│    │ • MCP Mgr   │    │ • Tools     │
│ • Tool Calls│    │ • Security  │    │ • Resources │
│ • Sessions  │    │ • Logging   │    │ • Prompts   │
└─────────────┘    └─────────────┘    └─────────────┘
```

## Web UI Management

### Accessing MCP Management

1. Open the R-API Control Panel in your browser
2. Navigate to the "MCP Servers" tab
3. Select your R1 device from the dropdown

### Adding MCP Servers

1. Click "Add Server" button
2. Choose from pre-configured templates or create custom configuration
3. Configure server settings:
   - **Server Name**: Unique identifier for the server
   - **Description**: Brief description of server functionality
   - **Command**: Executable command (e.g., `uvx`, `python`, `node`)
   - **Arguments**: Command arguments as JSON array
   - **Environment**: Environment variables as JSON object
   - **Auto-approve**: Tools that don't require manual approval

### Managing Servers

- **Enable/Disable**: Toggle server availability
- **View Tools**: See available tools and usage statistics
- **Edit Configuration**: Modify server settings
- **Delete Server**: Remove server and all associated data
- **View Logs**: Monitor server activity and debug issues

## Pre-configured Templates

### File System Access
```json
{
  "name": "filesystem",
  "command": "uvx",
  "args": ["mcp-server-filesystem"],
  "description": "Access and manipulate files and directories"
}
```

### Web Search
```json
{
  "name": "web-search",
  "command": "uvx", 
  "args": ["mcp-server-web-search"],
  "description": "Search the web using various search engines"
}
```

### GitHub Integration
```json
{
  "name": "github",
  "command": "uvx",
  "args": ["mcp-server-github"],
  "env": {
    "GITHUB_TOKEN": "your-github-token"
  },
  "description": "Interact with GitHub repositories and issues"
}
```

### SQLite Database
```json
{
  "name": "sqlite",
  "command": "uvx",
  "args": ["mcp-server-sqlite"],
  "description": "Query and manipulate SQLite databases"
}
```

### AWS Documentation
```json
{
  "name": "aws-docs",
  "command": "uvx",
  "args": ["awslabs.aws-documentation-mcp-server@latest"],
  "env": {
    "FASTMCP_LOG_LEVEL": "ERROR"
  },
  "description": "Search and access AWS documentation"
}
```

## API Endpoints

### Server Management

#### Get All Servers
```http
GET /{deviceId}/mcp/servers
```

#### Create/Update Server
```http
POST /{deviceId}/mcp/servers
Content-Type: application/json

{
  "serverName": "filesystem",
  "config": {
    "command": "uvx",
    "args": ["mcp-server-filesystem"],
    "env": {},
    "enabled": true,
    "autoApprove": ["read_file"],
    "description": "File system access"
  }
}
```

#### Get Server Details
```http
GET /{deviceId}/mcp/servers/{serverName}
```

#### Delete Server
```http
DELETE /{deviceId}/mcp/servers/{serverName}
```

#### Toggle Server Status
```http
POST /{deviceId}/mcp/servers/{serverName}/toggle
Content-Type: application/json

{
  "enabled": true
}
```

### Tool Management

#### Get Server Tools
```http
GET /{deviceId}/mcp/servers/{serverName}/tools
```

#### Call Tool
```http
POST /{deviceId}/mcp/servers/{serverName}/tools/{toolName}/call
Content-Type: application/json

{
  "arguments": {
    "path": "/path/to/file",
    "content": "file content"
  }
}
```

### Session Management

#### Create Session
```http
POST /{deviceId}/mcp/sessions
Content-Type: application/json

{
  "serverName": "filesystem"
}
```

#### Get Sessions
```http
GET /{deviceId}/mcp/sessions
```

#### Close Session
```http
DELETE /{deviceId}/mcp/sessions/{sessionId}
```

### Logging

#### Get MCP Logs
```http
GET /{deviceId}/mcp/logs?serverName={serverName}&limit=100
```

## R1 Device Integration

### MCP Client Usage

```javascript
// Initialize MCP client
const mcpClient = new MCPClient(socket, deviceId);
await mcpClient.initialize();

// Call a tool
try {
  const result = await mcpClient.callTool('filesystem', 'read_file', {
    path: '/path/to/file.txt'
  });
  console.log('File content:', result);
} catch (error) {
  console.error('Tool call failed:', error);
}

// Check tool availability
if (mcpClient.hasToolAvailable('web-search', 'search')) {
  const results = await mcpClient.callTool('web-search', 'search', {
    query: 'latest AI news',
    max_results: 5
  });
}
```

### Socket Events

#### Tool Call
```javascript
socket.emit('mcp_tool_call', {
  deviceId: 'your-device-id',
  serverName: 'filesystem',
  toolName: 'read_file',
  arguments: { path: '/path/to/file.txt' },
  requestId: 'unique-request-id'
});
```

#### Server Status
```javascript
socket.emit('mcp_server_status', {
  deviceId: 'your-device-id',
  serverName: 'filesystem',
  status: 'running',
  toolCount: 5
});
```

## Security Considerations

### Auto-approval Lists
- Configure which tools can be called without manual approval
- Useful for safe, read-only operations
- Review and update regularly

### Manual Approval
- High-risk operations require explicit user approval
- Approval requests are logged for audit purposes
- Timeout after 30 seconds if no response

### Environment Variables
- Sensitive data (API keys, tokens) stored securely
- Not exposed in logs or client-side code
- Encrypted at rest in database

### Process Isolation
- Each MCP server runs in its own process
- Automatic cleanup on device disconnect
- Resource limits and monitoring

## Troubleshooting

### Common Issues

#### Server Won't Start
1. Check command and arguments are correct
2. Verify required dependencies are installed
3. Check environment variables are set
4. Review server logs for error messages

#### Tool Calls Failing
1. Verify server is running and healthy
2. Check tool name and arguments
3. Review auto-approval settings
4. Check network connectivity

#### Performance Issues
1. Monitor server resource usage
2. Check for memory leaks in long-running servers
3. Review tool call frequency and patterns
4. Consider server restart if needed

### Debugging

#### Enable Debug Logging
Set environment variable:
```bash
FASTMCP_LOG_LEVEL=DEBUG
```

#### View Server Logs
Use the web UI "View Logs" feature or API:
```http
GET /{deviceId}/mcp/logs?serverName={serverName}
```

#### Monitor Server Status
Check server health via API:
```http
GET /{deviceId}/mcp/servers/{serverName}
```

## Best Practices

### Server Configuration
- Use descriptive server names and descriptions
- Set appropriate auto-approval lists
- Configure environment variables securely
- Test servers before enabling

### Tool Usage
- Validate tool arguments before calling
- Handle errors gracefully
- Implement retry logic for transient failures
- Log tool usage for monitoring

### Security
- Regularly review and update auto-approval lists
- Monitor tool usage patterns
- Keep MCP servers updated
- Use least-privilege principles

### Performance
- Monitor server resource usage
- Implement caching where appropriate
- Use connection pooling for database servers
- Clean up unused sessions regularly

## Development

### Adding New Templates
1. Add template to `/mcp/templates` endpoint
2. Include proper categorization
3. Provide clear documentation
4. Test with real R1 devices

### Custom MCP Servers
1. Follow MCP protocol specification
2. Implement proper error handling
3. Support graceful shutdown
4. Include comprehensive logging

### Testing
1. Test server startup and shutdown
2. Verify tool discovery and calling
3. Test error conditions
4. Validate security controls

## Future Enhancements

- **Resource Management**: Support for MCP resources and prompts
- **Advanced Security**: Role-based access control
- **Monitoring**: Enhanced metrics and alerting
- **Clustering**: Multi-server deployments
- **Caching**: Intelligent response caching
- **Webhooks**: Event-driven integrations