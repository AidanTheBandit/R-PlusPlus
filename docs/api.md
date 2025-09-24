# API Reference

## OpenAI-Compatible Endpoints

### POST /v1/chat/completions

Creates a chat completion using the R1 device.

**Request Body:**
```json
{
  "model": "r1-command",
  "messages": [
    {
      "role": "user",
      "content": "Your message here"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 150,
  "stream": false
}
```

**Parameters:**
- `model` (string): Model to use (currently only "r1-command" supported)
- `messages` (array): Array of message objects with `role` and `content`
- `temperature` (number, optional): Sampling temperature (0.0 to 1.0)
- `max_tokens` (number, optional): Maximum tokens to generate
- `stream` (boolean, optional): Enable streaming responses

**Response (Non-streaming):**
```json
{
  "id": "chatcmpl-1234567890",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "r1-llm",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Response from R1 device"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30
  }
}
```

**Response (Streaming):**
```
data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"r1-llm","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"r1-llm","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"r1-llm","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"r1-llm","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

### GET /v1/models

Lists available models.

**Response:**
```json
{
  "object": "list",
  "data": [
    {
      "id": "r1-command",
      "object": "model",
      "created": 1677652288,
      "owned_by": "rabbit-r1"
    }
  ]
}
```

## Camera Control Endpoints (Device-Specific)

### POST /{deviceId}/magic-cam/start

Starts the camera on a specific R1 device.

**Authentication:** Required (device PIN)

**Request Body:**
```json
{
  "facingMode": "user"
}
```

**Parameters:**
- `facingMode` (string, optional): "user" or "environment"

**Response:**
```json
{
  "status": "command_sent",
  "command": "start",
  "facingMode": "user",
  "deviceId": "your-device-id"
}
```

### POST /{deviceId}/magic-cam/stop

Stops the camera on a specific R1 device.

**Authentication:** Required (device PIN)

**Response:**
```json
{
  "status": "command_sent",
  "command": "stop",
  "deviceId": "your-device-id"
}
```

### POST /{deviceId}/magic-cam/capture

Captures a photo on a specific R1 device.

**Authentication:** Required (device PIN)

**Request Body:**
```json
{
  "width": 240,
  "height": 282
}
```

**Response:**
```json
{
  "status": "command_sent",
  "command": "capture",
  "dimensions": "240x282",
  "deviceId": "your-device-id"
}
```

### POST /{deviceId}/magic-cam/switch

Switches between front and rear cameras on a specific R1 device.

**Authentication:** Required (device PIN)

**Response:**
```json
{
  "status": "command_sent",
  "command": "switch",
  "deviceId": "your-device-id"
}
```

### GET /{deviceId}/magic-cam/status

Gets camera status for a specific R1 device.

**Authentication:** Required (device PIN)

**Response:**
```json
{
  "deviceId": "your-device-id",
  "connected": true,
  "cameraCommands": ["start", "stop", "capture", "switch"],
  "supportedFacingModes": ["user", "environment"]
}
```

## Health & Monitoring

### GET /health

Gets server health status.

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2025-09-23T12:00:00.000Z",
  "connectedDevices": 2,
  "server": "R-API",
  "version": "1.0.0"
}
```

## WebSocket Events

### Connection Events

#### connect
Fired when a client connects to the WebSocket server.

#### disconnect
Fired when a client disconnects.

### Device Events

#### device_connected
```json
{
  "deviceId": "r1-1234567890",
  "userAgent": "Mozilla/5.0...",
  "connectedAt": "2025-09-23T12:00:00.000Z"
}
```

#### device_disconnected
```json
{
  "deviceId": "r1-1234567890",
  "disconnectedAt": "2025-09-23T12:00:00.000Z"
}
```

### Debug Events

#### debug_data
```json
{
  "type": "hardware",
  "deviceId": "r1-1234567890",
  "data": {...},
  "timestamp": "2025-09-23T12:00:00.000Z"
}
```

### R1 Communication

#### chat_completion (Server → R1)
```json
{
  "type": "chat_completion",
  "data": {
    "message": "Hello R1",
    "originalMessage": "Hello R1",
    "model": "r1-command",
    "temperature": 0.7,
    "max_tokens": 150,
    "requestId": "req-1234567890"
  },
  "timestamp": "2025-09-23T12:00:00.000Z"
}
```

#### response (R1 → Server)
```json
{
  "requestId": "req-1234567890",
  "response": "Hello! How can I help you?",
  "originalMessage": "Hello R1",
  "model": "r1-llm",
  "timestamp": "2025-09-23T12:00:00.000Z",
  "deviceId": "r1-1234567890"
}
```

#### error (R1 → Server)
```json
{
  "requestId": "req-1234567890",
  "error": "Device error occurred",
  "timestamp": "2025-09-23T12:00:00.000Z",
  "deviceId": "r1-1234567890"
}
```

## Error Responses

### 400 Bad Request
```json
{
  "error": {
    "message": "Missing required parameters",
    "type": "validation_error"
  }
}
```

### 404 Not Found
```json
{
  "error": {
    "message": "Endpoint not found",
    "type": "not_found"
  }
}
```

### 500 Internal Server Error
```json
{
  "error": {
    "message": "Internal server error",
    "type": "server_error"
  }
}
```

### 503 Service Unavailable
```json
{
  "error": {
    "message": "No R1 devices connected",
    "type": "service_unavailable"
  }
}
```

### 504 Gateway Timeout
```json
{
  "error": {
    "message": "Request timed out waiting for R1 response",
    "type": "timeout_error"
  }
}
```

## Rate Limiting

Currently no rate limiting is implemented. This can be added via plugins.

## Authentication

Currently no authentication is required. Authentication can be added via plugins.

## Content Types

- API requests: `application/json`
- Streaming responses: `text/plain; charset=utf-8`
- Static files: Appropriate MIME types based on file extension

## CORS

CORS is enabled for all origins by default. This can be configured via plugins.