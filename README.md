# R-API
Interface with your R1 remotely via WebSocket and a REST API

## Overview
R-API provides a bridge between the R1 device and external applications through:
- **OpenAI-compatible REST API** for sending commands
- **WebSocket server** for real-time R1 communication
- **R1 Creation** that runs on the device to connect to the backend
- **Plugin system** for extensibility and custom functionality

## Features
- ✅ OpenAI-compatible API endpoints (`/v1/chat/completions`, `/v1/models`)
- ✅ WebSocket server for bidirectional R1 communication
- ✅ R1 Creation with React web interface for testing
- ✅ Real-time command forwarding from API to R1 devices
- ✅ Multi-device support (multiple R1s can connect)
- ✅ Health monitoring and status reporting
- ✅ Modular architecture with plugin system
- ✅ Streaming response support
- ✅ Comprehensive debug and analytics tools

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm start
# Server runs on http://localhost:5482
```

### 3. Access the R1 Creation
Open your R1 device and navigate to:
```
http://localhost:5482/
```

### 4. Test the API
```bash
node src/tests/test-api.js
```

## API Endpoints

### Chat Completions (OpenAI Compatible)
```http
POST /v1/chat/completions
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

### Available Models
```http
GET /v1/models
```

### Health Check
```http
GET /health
```

### Camera Control
```http
POST /magic-cam/start
POST /magic-cam/stop
POST /magic-cam/capture
POST /magic-cam/switch
GET /magic-cam/status
```

### Debug & Analytics
```http
GET /debug/devices
GET /debug/history/:deviceId
POST /debug/stream/:type
```

## WebSocket Communication

### Connect to WebSocket
```javascript
import io from 'socket.io-client';
const socket = io('http://localhost:5482');
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

## Usage Examples

### Using with OpenAI Client Libraries
```python
import openai

client = openai.OpenAI(
    base_url="http://localhost:5482/v1",
    api_key="not-needed"  # API key not required
)

response = client.chat.completions.create(
    model="r1-command",
    messages=[
        {"role": "user", "content": "Hello R1!"}
    ],
    stream=True  # Enable streaming
)
```

### Direct HTTP Request
```bash
curl -X POST http://localhost:5482/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "r1-command",
    "messages": [{"role": "user", "content": "Status check"}],
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
4. **R1 Creation**: Device-side web interface
5. **Debug Tools**: Monitoring and analytics

### Data Flow
1. **Request** → API Client → Express Routes
2. **Queue** → Pending Requests → WebSocket Broadcast
3. **Process** → R1 Device → Generate Response
4. **Return** → WebSocket → Response Utils → API Client

## Documentation

- [Backend Architecture](docs/backend.md) - Detailed technical documentation
- [Plugin System](docs/plugins.md) - Plugin development guide
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
