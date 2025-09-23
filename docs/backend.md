# Backend Architecture Documentation

## Overview

R-API is a modular Node.js backend that provides an OpenAI-compatible interface for communicating with R1 devices. The system uses Express.js for REST APIs, Socket.IO for real-time WebSocket communication, and a plugin system for extensibility.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Clients   │────│   R-API Server  │────│   R1 Devices    │
│                 │    │                 │    │                 │
│ • ChatGPT       │    │ • Express API   │    │ • R1 Creation   │
│ • Custom Apps   │    │ • WebSocket     │    │ • Hardware      │
│ • OpenAI SDK    │    │ • Plugins       │    │ • Sensors       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Core Components

### 1. Server (`src/server.js`)
The main entry point that orchestrates all components:

- Initializes Express app and Socket.IO server
- Loads and initializes route modules
- Sets up middleware and static file serving
- Manages plugin system
- Starts the HTTP server

### 2. Route Modules (`src/routes/`)

#### OpenAI Routes (`openai.js`)
Handles OpenAI-compatible API endpoints:
- `POST /v1/chat/completions` - Chat completion requests
- `GET /v1/models` - Available models list
- Streaming and non-streaming response support
- Request queuing and timeout management

#### Magic Cam Routes (`magic-cam.js`)
Camera control endpoints:
- `POST /magic-cam/start` - Start camera
- `POST /magic-cam/stop` - Stop camera
- `POST /magic-cam/capture` - Capture photo
- `POST /magic-cam/switch` - Switch camera
- `GET /magic-cam/status` - Camera status

#### Health Routes (`health.js`)
System monitoring:
- `GET /health` - Server health and connected devices

#### Debug Routes (`debug.js`)
Development and debugging endpoints:
- `/debug/stream/*` - Debug data streaming
- `/debug/history/*` - Debug data history
- `/debug/devices` - Connected device info
- Various hardware, camera, LLM, storage, audio, performance endpoints

### 3. Socket Handler (`src/socket/socket-handler.js`)
Manages WebSocket connections and real-time communication:

- Device connection/disconnection handling
- Message routing between API clients and R1 devices
- Debug event broadcasting
- Response correlation and delivery

### 4. Response Utils (`src/utils/response-utils.js`)
OpenAI-compatible response formatting:

- `sendOpenAIResponse()` - Formats responses for API clients
- Streaming support with Server-Sent Events (SSE)
- Conversation history management
- Token usage calculation

### 5. Plugin System (`plugins/plugin-manager.js`)
Extensible plugin architecture:

- Dynamic plugin loading from `plugins/` directory
- Plugin lifecycle management
- Shared state access
- Error isolation

## Data Flow

### Chat Completion Request

```
1. API Client → POST /v1/chat/completions
2. OpenAI Routes → Validate request, extract parameters
3. Routes → Store in pendingRequests, set timeout
4. Routes → Broadcast to connected R1 devices via Socket.IO
5. R1 Device → Process request, generate response
6. R1 Device → Send response via WebSocket
7. Socket Handler → Match response to pending request
8. Socket Handler → Call sendOpenAIResponse()
9. Response Utils → Format OpenAI-compatible response
10. API Client ← Formatted response
```

### Streaming Response Flow

```
API Client → Request with stream: true
    ↓
Server → Send SSE headers
    ↓
Server → Send role chunk
    ↓
Server → Send content chunks (word by word)
    ↓
Server → Send finish chunk
    ↓
Server → Send [DONE]
    ↓
API Client ← Progressive response display
```

## State Management

### Shared State Objects

```javascript
const connectedR1s = new Map();           // deviceId → socket
const conversationHistory = new Map();    // sessionId → messages[]
const pendingRequests = new Map();        // requestId → {res, timeout, stream}
const requestDeviceMap = new Map();       // requestId → deviceId
const debugStreams = new Map();           // deviceId → debug data streams
const deviceLogs = new Map();             // deviceId → logs[]
const debugDataStore = new Map();         // deviceId → debug data
const performanceMetrics = new Map();     // deviceId → metrics
```

### State Persistence
- In-memory storage (not persistent across restarts)
- Conversation history limited to last 10 messages per session
- Debug data limited to prevent memory leaks
- Automatic cleanup of expired requests

## Error Handling

### Request Timeouts
- Default 60-second timeout for R1 responses
- Graceful fallback responses instead of 504 errors
- Automatic cleanup of timed-out requests

### Connection Errors
- Automatic reconnection handling via Socket.IO
- Device disconnection broadcasting
- Request redistribution to available devices

### Plugin Isolation
- Plugins run in isolated error contexts
- Plugin failures don't crash the main server
- Comprehensive error logging

## Performance Considerations

### Memory Management
- Limited conversation history (10 messages)
- Debug data capped at 100 entries per type
- Automatic cleanup of old data
- Efficient Map-based data structures

### Concurrent Requests
- Multiple R1 devices can be connected
- Requests distributed across available devices
- Non-blocking I/O operations
- Streaming responses for large content

### Scalability
- Modular architecture allows horizontal scaling
- Plugin system enables feature extension
- WebSocket connection pooling
- Efficient event-driven architecture

## Security

### Input Validation
- Request parameter validation
- JSON parsing with error handling
- Device ID validation
- Content length limits

### CORS Configuration
- Configurable origin policies
- Method restrictions
- Header validation

### Access Control
- No authentication required by default
- Plugin-based authentication extensions possible
- Request rate limiting via plugins

## Monitoring and Debugging

### Health Endpoints
- `/health` - Server status and connected devices
- Real-time metrics collection
- Performance monitoring

### Debug System
- Comprehensive debug event logging
- Hardware, camera, LLM, storage, audio monitoring
- Performance metrics collection
- Real-time data streaming

### Logging
- Structured logging with timestamps
- Error categorization
- Device-specific logging
- Plugin execution logging

## Configuration

### Environment Variables
- `PORT` - Server port (default: 5482)
- Plugin-specific configuration via shared state

### File Structure
```
src/
├── routes/          # API route handlers
├── socket/          # WebSocket management
├── utils/           # Utility functions
└── tests/           # Test files

plugins/             # Plugin directory
creation-react/      # Frontend application
public/              # Static web interface
docs/                # Documentation
```

## Development Workflow

### Adding New Features
1. Create route module in `src/routes/`
2. Add to server.js imports and setup
3. Test with existing test suite
4. Update documentation

### Plugin Development
1. Create plugin in `plugins/` directory
2. Implement required interface (`name`, `init`)
3. Access shared state for data persistence
4. Test plugin loading and functionality

### Testing
- Unit tests for individual modules
- Integration tests for API endpoints
- WebSocket connection testing
- Plugin compatibility testing

## Deployment

### Production Considerations
- Process management (PM2, systemd)
- Reverse proxy configuration (nginx)
- SSL/TLS termination
- Log aggregation
- Monitoring setup

### Docker Support
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5482
CMD ["npm", "start"]
```

### Environment Setup
```bash
# Production
NODE_ENV=production
PORT=5482

# Development
NODE_ENV=development
DEBUG=r-api:*
```

## Troubleshooting

### Common Issues

#### High Memory Usage
- Check debug data accumulation
- Monitor conversation history size
- Review plugin resource usage

#### Connection Drops
- Verify network connectivity
- Check Socket.IO configuration
- Monitor device heartbeat

#### Slow Responses
- Check R1 device performance
- Monitor pending request queue
- Review timeout configurations

#### Plugin Conflicts
- Check plugin loading order
- Verify shared state access
- Review plugin error logs

### Debug Tools
- Health endpoint monitoring
- Debug data streaming
- Performance metrics
- WebSocket connection logs

## Future Enhancements

### Planned Features
- Authentication and authorization
- Request queuing and prioritization
- Advanced analytics and monitoring
- Multi-region deployment support
- API rate limiting
- Response caching

### Plugin Ecosystem
- Official plugin registry
- Plugin dependency management
- Plugin update system
- Community contribution guidelines