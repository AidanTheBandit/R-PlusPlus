# MCP (Model Context Protocol) Integration - Remote Server Mode ✅

## Overview

The R-API includes MCP (Model Context Protocol) support through **remote server connections**, allowing R1 devices to connect to external MCP servers over HTTP. Instead of running local MCP server processes, the system connects to remote MCP servers that implement the MCP protocol, providing access to real tools and capabilities.

**Status: ✅ Fully Implemented and Working**

## Features

- **Remote Server Connections**: Connect to external MCP servers over HTTP
- **MCP Protocol Compliance**: Full implementation of MCP protocol version 2025-06-18
- **Server Management**: Register, configure, and manage remote MCP server connections per device
- **Real Tool Access**: Access actual tools provided by remote MCP servers
- **Security Controls**: Auto-approval lists and manual approval workflows
- **Real-time Monitoring**: Live status monitoring and logging
- **Device Isolation**: Each device maintains its own MCP server connections

## Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────────┐
│ R1 Device   │────│ R-API Server│────│ Remote MCP     │
│             │    │             │    │ Servers         │
│ • Chat API  │    │ • HTTP MCP  │    │ • Web Search    │
│ • Tool Calls│    │   Client    │    │ • Weather API   │
│ • Responses │    │ • Prompt    │    │ • Calculator    │
│             │    │   Injection │    │ • File System   │
└─────────────┘    └─────────────┘    └─────────────────┘
```

## Web UI Management

### Accessing MCP Management

1. Open the R-API Control Panel in your browser
2. Navigate to the "MCP Servers" tab
3. Select your R1 device from the dropdown

### Adding Remote MCP Servers

1. Click "Add Server" button
2. Choose from pre-configured templates or create custom configuration
3. Configure server settings:
   - **Server Name**: Unique identifier for the server
   - **Description**: Brief description of server functionality
   - **Server URL**: HTTP endpoint of the remote MCP server
   - **Protocol Version**: MCP protocol version (default: 2025-06-18)
   - **Auto-approve**: Tools that don't require manual approval

### Managing Servers

- **Enable/Disable**: Toggle server availability
- **View Tools**: See available tools and usage statistics
- **Edit Configuration**: Modify server settings
- **Delete Server**: Remove server and all associated data
- **View Logs**: Monitor server activity and debug issues

## Pre-configured Templates

Templates provide starting points for common MCP server types. You'll need to provide the actual server URL when configuring.

### Web Search
- **Purpose**: Search the web using various search engines
- **Example URL**: `https://api.example.com/mcp/web-search`
- **Auto-approved Tools**: `search_web`

### Weather Information
- **Purpose**: Get current weather information for any location
- **Example URL**: `https://api.example.com/mcp/weather`
- **Auto-approved Tools**: `get_weather`

### Calculator
- **Purpose**: Perform mathematical calculations
- **Example URL**: `https://api.example.com/mcp/calculator`
- **Auto-approved Tools**: `calculate`

### Time & Date
- **Purpose**: Get current time and date information
- **Example URL**: `https://api.example.com/mcp/time`
- **Auto-approved Tools**: `get_current_time`

### Knowledge Base
- **Purpose**: Search knowledge base for information
- **Example URL**: `https://api.example.com/mcp/knowledge`
- **Auto-approved Tools**: None (requires approval)

### Test MCP Server
- **Purpose**: Verify your MCP client setup works correctly
- **URL**: `http://localhost:{PORT}/mcp/test-server` (replace {PORT} with your R-API port)
- **Tools**: `test_echo`, `test_calculator`
- **Description**: Local test server included with R-API for testing MCP connections

## API Endpoints

### Prompt Injection

#### Get MCP Prompt Injection
```http
GET /{deviceId}/mcp/prompt-injection
```

Returns the MCP prompt injection text that should be prepended to chat completions for the specified device.

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
  "serverName": "web-search",
  "config": {
    "url": "https://api.example.com/mcp/web-search",
    "protocolVersion": "2025-06-18",
    "enabled": true,
    "autoApprove": ["search_web"],
    "description": "Web search capabilities"
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
- Each MCP server connection is isolated per device
- No local process execution on the R-API server
- Remote server handles all tool execution
- Connection timeouts and automatic cleanup

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

#### 400 Bad Request Errors
1. Verify the MCP server URL is correct and accessible
2. Check that the server supports MCP protocol over HTTP
3. Try adding the server with "Connect to server immediately" unchecked first
4. Use the Test MCP Server template to verify your setup works
5. Check server logs for more detailed error information

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
- Use HTTPS URLs for remote MCP servers
- Verify server endpoints before configuration
- Set appropriate auto-approval lists based on trust level
- Monitor connection status and tool usage
- Use descriptive server names and descriptions

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
1. Implement MCP protocol over HTTP transport
2. Follow MCP protocol specification version 2025-06-18
3. Support JSON-RPC 2.0 message format
4. Provide proper tool schemas and descriptions
5. Handle connection lifecycle (initialize, tools/list, tools/call)
6. Implement proper error handling and timeouts

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