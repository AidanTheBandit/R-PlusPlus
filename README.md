# R-API
Interface with your R1 remotely via WebSocket and a REST API

## Overview
R-API provides a bridge between the R1 device and external applications through:
- **OpenAI-compatible REST API** for sending commands
- **WebSocket server** for real-time R1 communication
- **R1 Anywhere** that runs on the device to connect to the backend
- **Plugin system** for extensibility and custom functionality

## Features
- ✅ OpenAI-compatible API endpoints (`/v1/chat/completions`, `/v1/models`)
- ✅ WebSocket server for bidirectional R1 communication
- ✅ R1 Anywhere with React web interface for testing
- ✅ Real-time command forwarding from API to R1 devices
- ✅ Multi-device support (multiple R1s can connect)
- ✅ Health monitoring and status reporting
- ✅ Modular architecture with plugin system
- ✅ Streaming response support
- ✅ Comprehensive debug and analytics tools
- ✅ **MCP (Model Context Protocol) integration** for extensible tool support

## Configuration

### Environment Variables

- `PORT`: Server port (default: 5482)
- `DISABLE_PIN`: Set to `true` to disable PIN code authentication (default: false)

### Hosted Service

This R-API instance is hosted at `https://r1a.boondit.site`. All endpoints are available at this base URL.

### Disabling PIN Codes

By default, each R1 device gets a unique 6-digit PIN code that must be used for API authentication. To disable PIN authentication:

```bash
DISABLE_PIN=true npm start
```

When PIN codes are disabled, API endpoints can be accessed without authentication.

### Device Identification

R1 devices are automatically assigned persistent IDs based on their user agent and IP address. Device IDs follow the format: `{adjective}-{noun}-{number}` (e.g., `green-wolf-23`, `blue-eagle-8`).

**Note:** Certain device IDs used in documentation examples (like `red-fox-42`) are blacklisted to prevent accidental assignment to real devices.

## API Authentication

### PIN Code Authentication

When PIN codes are enabled (default), include the PIN code in API requests:

```bash
curl -X POST https://r1a.boondit.site/device-red-fox-42/v1/chat/completions \
  -H "Authorization: Bearer 123456" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello R1!"}],
    "model": "r1-command"
  }'
```

The PIN code is displayed on the R1 device's console when it connects.

## API Endpoints

### Device-Specific Chat Completions
```http
POST /device-{deviceId}/v1/chat/completions
Authorization: Bearer {pin-code}  # Required unless DISABLE_PIN=true
Content-Type: application/json

{
  "model": "r1-command",
  "messages": [
    {
      "role": "user",
      "content": "Turn on the lights"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 150,
  "stream": true
}
```

### Device-Specific Models
```http
GET /device-{deviceId}/v1/models
Authorization: Bearer {pin-code}  # Required unless DISABLE_PIN=true
```

### Health Check
```http
GET /health
```

### Camera Control (Device-Specific)
```http
POST /{deviceId}/magic-cam/start
POST /{deviceId}/magic-cam/stop
POST /{deviceId}/magic-cam/capture
POST /{deviceId}/magic-cam/switch
GET /{deviceId}/magic-cam/status
```

**Note:** Camera commands are now device-specific and require authentication. Only the device owner can control their camera.

### MCP (Model Context Protocol)
```http
GET /{deviceId}/mcp/servers
POST /{deviceId}/mcp/servers
GET /{deviceId}/mcp/servers/{serverName}
DELETE /{deviceId}/mcp/servers/{serverName}
POST /{deviceId}/mcp/servers/{serverName}/toggle
GET /{deviceId}/mcp/servers/{serverName}/tools
POST /{deviceId}/mcp/servers/{serverName}/tools/{toolName}/call
GET /{deviceId}/mcp/logs
GET /mcp/templates
```

## WebSocket Communication

### Connect to WebSocket
```javascript
import io from 'socket.io-client';
const socket = io('https://r1a.boondit.site');
```

### Message Types

#### From Server to R1:
```json
{
  "type": "chat_completion",
  "data": {
    "message": "Turn on the lights",
    "model": "r1-command",
    "temperature": 0.7,
    "max_tokens": 150
  },
  "timestamp": "2025-09-23T12:00:00.000Z"
}
```

#### From R1 to Server:
```json
{
  "type": "response",
  "data": {
    "response": "Lights turned on successfully",
    "originalMessage": "Turn on the lights",
    "model": "r1-llm",
    "timestamp": "2025-09-23T12:00:00.000Z",
    "deviceId": "r1-12345"
  }
}
```

## Plugin System

Extend R-API functionality with plugins:

```javascript
// plugins/my-plugin.js
module.exports = {
  name: 'my-plugin',
  version: '1.0.0',
  description: 'Custom functionality',

  init: function(app, io, sharedState) {
    // Add custom endpoints, WebSocket handlers, etc.
    app.get('/api/custom', (req, res) => {
      res.json({ message: 'Custom endpoint' });
    });
  }
};
```

See [Plugin Documentation](docs/plugins.md) for detailed information.

## File Structure
```
src/
├── routes/
│   ├── openai.js          # OpenAI API endpoints
│   ├── magic-cam.js       # Camera control endpoints
│   ├── health.js          # Health monitoring
│   └── debug.js           # Debug & analytics
├── socket/
│   └── socket-handler.js  # WebSocket management
├── utils/
│   └── response-utils.js  # Response formatting
└── tests/
    └── test-api.js        # API testing

plugins/                    # Plugin directory
creation-react/             # React web interface
docs/                       # Documentation
├── backend.md             # Backend architecture
└── plugins.md             # Plugin system guide
```

## Quick Start

### One Command Setup
```bash
# Build all React UIs and start the server
npm run all
```

This will:
1. Install dependencies for both React apps
2. Build the creation-react interface
3. Build the r1-control-panel interface  
4. Start the R-API server

Then visit `https://r1a.boondit.site` for the secure, device-specific control panel with MCP management.

**Note**: The control panel now requires device authentication - enter your R1 device ID and PIN to access your device securely.

## Usage Examples

### Using with OpenAI Client Libraries
```python
import openai

# Replace 'your-device-id' and 'your-pin-code' with actual values
client = openai.OpenAI(
    base_url="https://r1a.boondit.site/device-your-device-id/v1",
    api_key="your-pin-code"  # PIN code as API key
)

response = client.chat.completions.create(
    model="r1-command",
    messages=[
        {"role": "user", "content": "Hello R1!"}
    ],
    stream=True
)
```

### Direct HTTP Request
```bash
# Replace 'your-device-id' and '123456' with actual values
curl -X POST https://r1a.boondit.site/device-your-device-id/v1/chat/completions \
  -H "Authorization: Bearer 123456" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Status check"}],
    "model": "r1-command",
    "temperature": 0.7,
    "stream": true
  }'
```

### WebSocket Connection
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5482');

socket.on('connect', () => {
  console.log('Connected to R-API');
});

socket.on('response', (data) => {
  console.log('Received response:', data);
});
```

## Development

### Running in Development Mode
```bash
npm run dev
```

### Testing the API
```bash
node src/tests/test-api.js
```

### Adding New Features
1. Create route modules in `src/routes/`
2. Add WebSocket handlers in `src/socket/`
3. Update imports in `src/server.js`
4. Test functionality
5. Update documentation

### Plugin Development
1. Create plugin file in `plugins/` directory
2. Implement required interface
3. Restart server to load plugin
4. Test plugin functionality

## Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ API Clients │────│ R-API Server│────│ R1 Devices  │
│             │    │             │    │             │
│ • OpenAI    │    │ • Express   │    │ • Creation  │
│ • Custom    │    │ • Socket.IO │    │ • Hardware  │
│ • Frontend  │    │ • Plugins   │    │ • Sensors   │
└─────────────┘    └─────────────┘    └─────────────┘
```

### Core Components
1. **Express Server**: REST API endpoints
2. **Socket.IO Server**: Real-time WebSocket communication
3. **Plugin System**: Extensible functionality
4. **R1 Anywhere**: Device-side web interface
5. **Debug Tools**: Monitoring and analytics

### Data Flow
1. **Request** → API Client → Express Routes
2. **Queue** → Pending Requests → WebSocket Broadcast
3. **Process** → R1 Device → Generate Response
4. **Return** → WebSocket → Response Utils → API Client

## Virtual R1 Test Client 🤖

Test the MCP system without physical R1 hardware using OpenRouter-powered virtual devices:

### Setup
```bash
# Install dependencies
npm install

# Set OpenRouter API key
export OPENROUTER_API_KEY=your_api_key_here

# Run virtual R1 client
npm run virtual-r1 <deviceId> [serverUrl]

# Example
npm run virtual-r1 virtual-r1-test http://localhost:3000
```

### Testing MCP Features
```bash
# Run automated tests with virtual R1
npm run test-virtual-r1
```

The virtual R1 client simulates a real R1 device, processing MCP tool results and system prompts through OpenRouter's Claude model. Perfect for testing MCP integration without physical hardware.

See [Virtual R1 README](VIRTUAL-R1-README.md) for detailed setup and usage instructions.

## Documentation

- [Backend Architecture](docs/backend.md) - Detailed technical documentation
- [Plugin System](docs/plugins.md) - Plugin development guide
- [MCP Integration](docs/mcp.md) - Model Context Protocol setup and usage
- [API Reference](docs/api.md) - Complete API documentation (planned)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Update documentation
6. Submit a pull request

## License
GPL-3.0
