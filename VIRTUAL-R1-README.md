# Virtual R1 Test Client

A test client that simulates an R1 device using OpenRouter for testing the MCP system without physical hardware.

## Setup

1. **Get an OpenRouter API key** from [openrouter.ai](https://openrouter.ai)

2. **Set the environment variable:**
   ```bash
   export OPENROUTER_API_KEY=your_api_key_here
   ```

3. **Run the virtual R1 client:**
   ```bash
   npm run virtual-r1 <deviceId> [serverUrl]
   ```

   Example:
   ```bash
   npm run virtual-r1 virtual-r1-test http://localhost:3000
   ```

## How it works

The Virtual R1 client:

1. **Connects** to your R-API server like a real R1 device
2. **Receives** chat completion requests with MCP data and system prompts
3. **Uses OpenRouter** to generate intelligent responses based on the injected prompts
4. **Sends responses** back to the server

## Testing MCP Features

Use the virtual R1 to test MCP functionality:

```bash
# Test repository lookup
curl -X POST http://localhost:3000/virtual-r1-test/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "facebook/react using mcp"}],
    "model": "r1-command",
    "temperature": 0.7
  }'
```

The virtual R1 will:
- Receive the MCP tool results from the server
- Use OpenRouter to generate a natural response
- Return a proper answer about the React repository structure

## Features

- ✅ **MCP Tool Integration**: Processes tool results and system prompts
- ✅ **OpenRouter AI**: Uses Claude-3-Haiku for fast, capable responses
- ✅ **Real-time Communication**: WebSocket connection like real R1 devices
- ✅ **Error Handling**: Graceful error responses
- ✅ **Conversation Context**: Maintains conversation history

## Environment Variables

- `OPENROUTER_API_KEY`: Required API key for OpenRouter

## Usage Examples

```bash
# Basic usage
npm run virtual-r1 my-test-device

# Custom server
npm run virtual-r1 my-test-device https://my-server.com

# With environment variable
OPENROUTER_API_KEY=sk-or-... npm run virtual-r1 my-test-device
```