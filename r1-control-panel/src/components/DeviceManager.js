import React from 'react';

const DeviceManager = ({ socket, connectedDevices }) => {
  const formatUptime = (connectedAt) => {
    const ms = Date.now() - new Date(connectedAt).getTime();
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const testDevice = async (deviceId) => {
    try {
      const response = await fetch(`/${deviceId}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello! This is a test message.' }],
          model: 'r1-command',
          temperature: 0.7,
          max_tokens: 50
        })
      });

      if (response.ok) {
        alert(`Device ${deviceId} responded successfully!`);
      } else {
        const error = await response.json();
        alert(`Device ${deviceId} error: ${error.error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      alert(`Failed to test device ${deviceId}: ${error.message}`);
    }
  };

  const getModels = async (deviceId) => {
    try {
      const response = await fetch(`/${deviceId}/v1/models`);
      if (response.ok) {
        const data = await response.json();
        const models = data.data || [];
        alert(`Device ${deviceId} models:\n${models.map(m => m.id).join('\n')}`);
      } else {
        const error = await response.json();
        alert(`Failed to get models: ${error.error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      alert(`Failed to get models: ${error.message}`);
    }
  };

  return (
    <div className="card">
      <h2 style={{ marginBottom: '20px' }}>Connected R1 Devices</h2>
      
      {connectedDevices.size === 0 ? (
        <div className="text-center" style={{ padding: '40px', color: '#666' }}>
          <h3>No R1 devices connected</h3>
          <p>Connect your R1 device to the R-API server to see it here.</p>
          <div style={{ marginTop: '20px', padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
            <h4>How to connect your R1:</h4>
            <ol style={{ textAlign: 'left', maxWidth: '400px', margin: '0 auto' }}>
              <li>Open R1 Anywhere on your R1 device</li>
              <li>Enter the server URL: <code>http://your-server:5482</code></li>
              <li>Your device will appear here automatically</li>
            </ol>
          </div>
        </div>
      ) : (
        <div className="device-grid">
          {Array.from(connectedDevices.values()).map(device => (
            <div key={device.deviceId} className="device-card">
              <div className="device-header">
                <div className="device-id">{device.deviceId}</div>
                <div className="device-status online">Online</div>
              </div>
              
              <div className="device-info">
                <div><strong>Connected:</strong> {formatUptime(device.connectedAt)} ago</div>
                <div><strong>User Agent:</strong> {device.userAgent?.substring(0, 50)}...</div>
                <div><strong>Status:</strong> {device.status || 'Connected'}</div>
              </div>

              <div className="device-actions">
                <button 
                  className="btn btn-sm"
                  onClick={() => testDevice(device.deviceId)}
                >
                  Test Device
                </button>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => getModels(device.deviceId)}
                >
                  Get Models
                </button>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const url = `/${device.deviceId}/v1/chat/completions`;
                    navigator.clipboard.writeText(url);
                    alert('API URL copied to clipboard!');
                  }}
                >
                  Copy API URL
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: '30px', padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
        <h3>API Usage Examples</h3>
        <div style={{ marginTop: '15px' }}>
          <h4>cURL Example:</h4>
          <pre style={{ 
            background: '#1e1e1e', 
            color: '#d4d4d4', 
            padding: '15px', 
            borderRadius: '4px', 
            overflow: 'auto',
            fontSize: '12px'
          }}>
{`curl -X POST http://localhost:5482/{your-device-id}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [{"role": "user", "content": "Hello R1!"}],
    "model": "r1-command",
    "temperature": 0.7
  }'`}
          </pre>
        </div>
        
        <div style={{ marginTop: '15px' }}>
          <h4>Python Example:</h4>
          <pre style={{ 
            background: '#1e1e1e', 
            color: '#d4d4d4', 
            padding: '15px', 
            borderRadius: '4px', 
            overflow: 'auto',
            fontSize: '12px'
          }}>
{`import openai

client = openai.OpenAI(
    base_url="http://localhost:5482/{your-device-id}/v1",
    api_key="not-required"
)

response = client.chat.completions.create(
    model="r1-command",
    messages=[
        {"role": "user", "content": "Hello R1!"}
    ]
)`}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default DeviceManager;