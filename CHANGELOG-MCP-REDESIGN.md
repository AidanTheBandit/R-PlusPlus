# MCP System Redesign - Prompt Injection Mode

## Overview

The MCP (Model Context Protocol) system has been completely redesigned to work in a public server environment without requiring direct file system or database access. The new system uses **prompt injection** instead of spawning actual MCP server processes.

## Key Changes

### 1. Architecture Change
- **Before**: Spawned actual MCP server processes using `child_process.spawn()`
- **After**: Injects tool descriptions directly into chat prompts
- **Benefit**: Safe for public server deployment, no process spawning required

### 2. New MCP Manager (`src/utils/mcp-manager.js`)
- Removed process spawning functionality
- Added prompt injection generation
- Added tool simulation system
- Maintained compatibility with existing API endpoints

### 3. Tool Simulation System
- **Web Search**: Simulated search results
- **Weather**: Simulated weather data
- **Calculator**: Real mathematical calculations using `Function()`
- **Time & Date**: Real current time/date
- **Knowledge Base**: Simulated knowledge responses
- **Generic**: Fallback for unknown tool types

### 4. Prompt Injection Format
```
## MCP Tools Available

You have access to the following MCP (Model Context Protocol) tools...

### tool_name (server_name)
Tool description
**Auto-approved**: Yes/No
**Schema**: `{JSON schema}`

## Tool Usage Format

To use a tool, respond with:
```json
{
  "mcp_tool_call": {
    "server": "server_name",
    "tool": "tool_name", 
    "arguments": { /* tool arguments */ }
  }
}
```

### 5. Updated API Endpoints

#### New Endpoint
- `GET /{deviceId}/mcp/prompt-injection` - Get MCP prompt injection text

#### Modified Endpoints
- `POST /{deviceId}/mcp/servers/{serverName}/tools/{toolName}/call` - Now returns actual results
- `POST /{deviceId}/mcp/servers/{serverName}/toggle` - Uses tool initialization instead of process spawning

### 6. Updated Templates
- Removed file system and database access templates
- Added safe simulation-based templates:
  - `web-search`: Web search simulation
  - `weather`: Weather information simulation
  - `calculator`: Mathematical calculations
  - `time`: Current time and date
  - `knowledge`: Knowledge base simulation

### 7. Integration with Chat Completions
- Modified `src/routes/openai.js` to inject MCP prompts into chat messages
- Added `mcpManager` parameter to OpenAI routes
- Automatic prompt injection for devices with configured MCP tools

### 8. Socket Handler Updates
- Updated MCP tool call handling to use new simulation system
- Added `mcp_tool_result` event for returning tool results
- Improved error handling and logging

## Files Modified

### Core Files
- `src/utils/mcp-manager.js` - Complete rewrite for prompt injection
- `src/routes/mcp.js` - Updated for new system
- `src/routes/openai.js` - Added MCP prompt injection
- `src/socket/socket-handler.js` - Updated tool call handling
- `src/server.js` - Updated to pass mcpManager to routes

### Documentation
- `docs/mcp.md` - Updated for prompt injection mode
- `README.md` - Updated MCP section
- `CHANGELOG-MCP-REDESIGN.md` - This file

### Testing
- `scripts/test-mcp-prompt-injection.js` - New test script
- `examples/mcp-prompt-injection-example.js` - Example R1 client
- `package.json` - Added test-mcp script

## Benefits of New System

### Security
- ✅ No process spawning
- ✅ No file system access
- ✅ No database access beyond configuration
- ✅ Safe for public server deployment

### Functionality
- ✅ Maintains MCP-like tool interface
- ✅ Supports auto-approval workflows
- ✅ Provides realistic tool simulations
- ✅ Compatible with existing UI

### Reliability
- ✅ No process management complexity
- ✅ No process crashes or hangs
- ✅ Simpler error handling
- ✅ More predictable behavior

## Migration Guide

### For Existing Users
1. Existing MCP server configurations will continue to work
2. Tools will now be simulated instead of calling real processes
3. No changes needed to the web UI
4. API endpoints remain the same

### For Developers
1. Tool calls now return immediate simulated results
2. No need to handle process lifecycle
3. Tool simulations can be customized in `executeToolSimulation()`
4. Prompt injection can be customized in `generateMCPPromptInjection()`

## Testing

Run the test suite to verify the new system:

```bash
# Test MCP prompt injection system
npm run test-mcp

# Run all tests including MCP
npm test

# Test with example R1 client
node examples/mcp-prompt-injection-example.js
```

## Error Resolution

The original error `"Cannot access 'process' before initialization"` has been resolved by:
1. Removing all `child_process.spawn()` calls
2. Eliminating process management code
3. Using in-memory tool simulation instead
4. Maintaining the same API interface for compatibility

## Future Enhancements

1. **Enhanced Simulations**: More realistic tool responses
2. **Custom Tool Types**: Easy addition of new tool simulations
3. **Real API Integration**: Optional real API calls for specific tools
4. **Advanced Prompt Templates**: More sophisticated prompt injection formats
5. **Tool Result Caching**: Cache simulation results for consistency