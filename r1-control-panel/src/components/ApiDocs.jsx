import React from 'react';

const ApiDocs = ({ deviceId }) => {
  const baseUrl = window.location.origin;
  const apiBaseUrl = `${baseUrl}/${deviceId}`;

  const endpoints = [
    {
      method: 'POST',
      path: '/v1/chat/completions',
      description: 'Create chat completions with your R1 device (supports images)',
      example: `curl -X POST "${apiBaseUrl}/v1/chat/completions" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "r1-command",
    "messages": [{"role": "user", "content": "Hello R1!"}],
    "temperature": 0.7,
    "max_tokens": 150
  }'`
    },
    {
      method: 'POST',
      path: '/v1/audio/speech',
      description: 'Generate speech audio from text using your R1 device',
      example: `curl -X POST "${apiBaseUrl}/v1/audio/speech" \\
  -H "Content-Type: application/json" \\
  -d '{
    "input": "Hello, this is a test message",
    "model": "tts-1",
    "voice": "alloy",
    "response_format": "mp3",
    "speed": 1.0
  }'`
    },
    {
      method: 'GET',
      path: '/v1/models',
      description: 'List available models',
      example: `curl "${apiBaseUrl}/v1/models"`
    },
    {
      method: 'POST',
      path: '/magic-cam/start',
      description: 'Start the camera on your R1 device',
      example: `curl -X POST "${apiBaseUrl}/magic-cam/start" \\
  -H "Content-Type: application/json" \\
  -d '{"facingMode": "user"}'`
    },
    {
      method: 'POST',
      path: '/magic-cam/stop',
      description: 'Stop the camera on your R1 device',
      example: `curl -X POST "${apiBaseUrl}/magic-cam/stop"`
    },
    {
      method: 'POST',
      path: '/magic-cam/capture',
      description: 'Capture a photo on your R1 device',
      example: `curl -X POST "${apiBaseUrl}/magic-cam/capture" \\
  -H "Content-Type: application/json" \\
  -d '{"width": 240, "height": 282}'`
    },
    {
      method: 'POST',
      path: '/magic-cam/switch',
      description: 'Switch between front and rear cameras on your R1 device',
      example: `curl -X POST "${apiBaseUrl}/magic-cam/switch"`
    },
    {
      method: 'GET',
      path: '/magic-cam/status',
      description: 'Get camera status for your R1 device',
      example: `curl "${apiBaseUrl}/magic-cam/status"`
    },
    {
      method: 'GET',
      path: '/health',
      description: 'Check server health status',
      example: `curl "${baseUrl}/health"`
    }
  ];

  return (
    <div className="card">
      <div className="api-docs-header">
        <h2>R1 API Documentation</h2>
        <div className="api-base-url">
          <strong>Base URL:</strong>
          <code className="url-code">{apiBaseUrl}</code>
        </div>
        <div className="api-auth-notice">
          <strong>🔐 Authentication Required:</strong> Use your device PIN code in the <code>Authorization: Bearer &lt;your-pin-code&gt;</code> header for all API requests.
        </div>
        <p>
          Your R1 device is accessible via secure, device-specific REST API endpoints. All requests are authenticated and scoped to your individual device for maximum security and privacy.
        </p>
      </div>

      <div className="api-endpoints">
        <h3>Available Endpoints</h3>
        {endpoints.map((endpoint, index) => (
          <div key={index} className="endpoint-card">
            <div className="endpoint-header">
              <span className={`method-badge ${endpoint.method.toLowerCase()}`}>
                {endpoint.method}
              </span>
              <code className="endpoint-path">{endpoint.path}</code>
            </div>
            <p className="endpoint-description">{endpoint.description}</p>
            <div className="endpoint-example">
              <h4>Example:</h4>
              <pre className="code-example">{endpoint.example}</pre>
            </div>
          </div>
        ))}
      </div>

      <div className="api-features">
        <h3>API Features</h3>
        <ul>
          <li><strong>OpenAI-Compatible:</strong> Use standard OpenAI chat completion and TTS formats</li>
          <li><strong>Image Support:</strong> Send images in chat messages for visual analysis</li>
          <li><strong>Text-to-Speech:</strong> Generate audio from text using your R1 device</li>
          <li><strong>Device-Specific Camera Control:</strong> Secure camera control limited to your own R1 device</li>
          <li><strong>Real-time Communication:</strong> WebSocket support for live updates</li>
          <li><strong>Health Monitoring:</strong> Check server and device connectivity</li>
          <li><strong>MCP Integration:</strong> Model Context Protocol support for enhanced AI capabilities</li>
        </ul>
      </div>

      <div className="api-notes">
        <h3>Important Notes</h3>
        <ul>
          <li><strong>Authentication:</strong> Use your device PIN code with <code>Authorization: Bearer &lt;your-pin-code&gt;</code> header</li>
          <li><strong>Device-Specific:</strong> All endpoints are scoped to your specific R1 device - you can only control your own device</li>
          <li><strong>Security:</strong> Camera commands and other device controls are isolated per device for privacy</li>
          <li><strong>Chat Completions:</strong> Support both streaming and non-streaming responses, plus image analysis</li>
          <li><strong>Text-to-Speech:</strong> Generate high-quality audio from text using your R1 device</li>
          <li><strong>MCP Integration:</strong> Enhanced AI capabilities through Model Context Protocol</li>
          <li>All endpoints return JSON responses (except TTS which returns audio data)</li>
        </ul>
      </div>
    </div>
  );
};

export default ApiDocs;