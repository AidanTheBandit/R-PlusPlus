import React from 'react';

const ApiDocs = ({ deviceId }) => {
  const baseUrl = window.location.origin;
  const apiBaseUrl = `${baseUrl}/${deviceId}`;

  const endpoints = [
    {
      method: 'POST',
      path: '/v1/chat/completions',
      description: 'Create chat completions with your R1 device',
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
      description: 'Stop the camera',
      example: `curl -X POST "${apiBaseUrl}/magic-cam/stop"`
    },
    {
      method: 'POST',
      path: '/magic-cam/capture',
      description: 'Capture a photo',
      example: `curl -X POST "${apiBaseUrl}/magic-cam/capture" \\
  -H "Content-Type: application/json" \\
  -d '{"width": 240, "height": 282}'`
    },
    {
      method: 'GET',
      path: '/health',
      description: 'Check server health status',
      example: `curl "${apiBaseUrl}/health"`
    },
    {
      method: 'GET',
      path: '/debug/devices',
      description: 'List connected devices with debug info',
      example: `curl "${apiBaseUrl}/debug/devices"`
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
        <p>
          Your R1 device is accessible via REST API endpoints. All requests should be made to URLs starting with your device ID.
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
          <li><strong>OpenAI-Compatible:</strong> Use standard OpenAI chat completion format</li>
          <li><strong>Camera Control:</strong> Start, stop, capture photos, and switch cameras</li>
          <li><strong>Real-time Communication:</strong> WebSocket support for live updates</li>
          <li><strong>Debug Tools:</strong> Monitor device status and debug information</li>
          <li><strong>Health Monitoring:</strong> Check server and device connectivity</li>
        </ul>
      </div>

      <div className="api-notes">
        <h3>Important Notes</h3>
        <ul>
          <li>Replace <code>{baseUrl}</code> with your actual server URL</li>
          <li><strong>API Key:</strong> If you have set a PIN code for your device, use it as your API key with <code>Authorization: Bearer &lt;your-pin-code&gt;</code></li>
          <li>Include <code>Authorization: Bearer &lt;pin-code&gt;</code> header if your device requires authentication</li>
          <li>All endpoints return JSON responses</li>
          <li>Camera commands are sent to all connected R1 devices</li>
          <li>Chat completions support both streaming and non-streaming responses</li>
        </ul>
      </div>
    </div>
  );
};

export default ApiDocs;