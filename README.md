# R-API
Interface with your R1 remotely via WebSocket and a REST API

## Overview
R-API provides a bridge between the R1 device and external applications through:
- **OpenAI-compatible REST API** for sending commands
- **WebSocket server** for real-time R1 communication
- **R1 Creation** that runs on the device to connect to the backend

## Features
- ✅ OpenAI-compatible API endpoints (`/v1/chat/completions`, `/v1/models`)
- ✅ WebSocket server for bidirectional R1 communication
- ✅ R1 Creation with web interface for testing
- ✅ Real-time command forwarding from API to R1 devices
- ✅ Multi-device support (multiple R1s can connect)
- ✅ Health monitoring and status reporting

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
http://localhost:5482/creation
```

### 4. Test the API
```bash
node test-api.js
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
  "max_tokens": 150
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

## WebSocket Communication

### Connect to WebSocket
```javascript
const ws = new WebSocket('ws://localhost:5482/ws');
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
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### From R1 to Server:
```json
{
  "type": "response",
  "data": {
    "command": "Turn on the lights",
    "result": "Lights turned on successfully",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "deviceId": "r1-12345"
  }
}
```

## File Structure
```
├── server.js              # Main server (Express + WebSocket)
├── creation/
│   ├── index.html         # R1 Creation web interface
│   ├── creation.js        # R1 Creation WebSocket client
│   └── manifest.json      # Creation metadata
├── test-api.js            # API testing script
└── package.json           # Project configuration
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
    ]
)
```

### Direct HTTP Request
```bash
curl -X POST http://localhost:5482/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "r1-command",
    "messages": [{"role": "user", "content": "Status check"}],
    "temperature": 0.7
  }'
```

## Development

### Running in Development Mode
```bash
npm run dev
```

### Testing the API
```bash
node test-api.js
```

## Architecture

1. **Express Server**: Hosts the OpenAI-compatible REST API
2. **WebSocket Server**: Manages real-time connections with R1 devices
3. **R1 Creation**: Web-based interface that runs on the R1 device
4. **Command Flow**: API → WebSocket → R1 Creation → R1 Device

## License
GPL-3.0
