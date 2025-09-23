import React, { useState, useEffect } from 'react';

const DebugTools = ({ socket, connectedDevices }) => {
  const [debugData, setDebugData] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [debugFilter, setDebugFilter] = useState('all');

  useEffect(() => {
    if (!socket) return;

    const handleDebugData = (data) => {
      setDebugData(prev => [...prev.slice(-99), { // Keep last 100 entries
        id: Date.now() + Math.random(),
        ...data,
        timestamp: data.timestamp || new Date().toISOString()
      }]);
    };

    socket.on('debug_data', handleDebugData);
    socket.on('mcp_event', handleDebugData);

    return () => {
      socket.off('debug_data', handleDebugData);
      socket.off('mcp_event', handleDebugData);
    };
  }, [socket]);

  const filteredData = debugData.filter(item => {
    if (selectedDevice && item.deviceId !== selectedDevice) return false;
    if (debugFilter !== 'all' && item.type !== debugFilter) return false;
    return true;
  });

  const clearDebugData = () => {
    setDebugData([]);
  };

  const exportDebugData = () => {
    const dataStr = JSON.stringify(filteredData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `debug-data-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getTypeColor = (type) => {
    const colors = {
      hardware: '#28a745',
      camera: '#17a2b8',
      llm: '#6f42c1',
      storage: '#fd7e14',
      audio: '#20c997',
      performance: '#dc3545',
      device: '#6c757d',
      logs: '#495057',
      mcp_event: '#007bff'
    };
    return colors[type] || '#6c757d';
  };

  const formatData = (data) => {
    if (typeof data === 'string') return data;
    return JSON.stringify(data, null, 2);
  };

  return (
    <div className="card">
      <h2 style={{ marginBottom: '20px' }}>Debug Tools</h2>
      
      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ minWidth: '200px' }}>
          <label className="form-label">Filter by Device:</label>
          <select 
            className="form-select"
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
          >
            <option value="">All Devices</option>
            {Array.from(connectedDevices.values()).map(device => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.deviceId}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ minWidth: '200px' }}>
          <label className="form-label">Filter by Type:</label>
          <select 
            className="form-select"
            value={debugFilter}
            onChange={(e) => setDebugFilter(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="hardware">Hardware</option>
            <option value="camera">Camera</option>
            <option value="llm">LLM</option>
            <option value="storage">Storage</option>
            <option value="audio">Audio</option>
            <option value="performance">Performance</option>
            <option value="device">Device</option>
            <option value="logs">Logs</option>
            <option value="mcp_event">MCP Events</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'end' }}>
          <button className="btn btn-secondary" onClick={clearDebugData}>
            Clear Data
          </button>
          <button className="btn btn-secondary" onClick={exportDebugData}>
            Export Data
          </button>
        </div>
      </div>

      <div style={{ 
        background: '#f8f9fa', 
        border: '1px solid #dee2e6', 
        borderRadius: '8px', 
        padding: '15px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>Debug Data Stream</strong>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
              Showing {filteredData.length} of {debugData.length} entries
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            Real-time updates from connected R1 devices
          </div>
        </div>
      </div>

      <div className="logs-container" style={{ height: '400px' }}>
        {filteredData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            {debugData.length === 0 ? 
              'No debug data received yet. Connect R1 devices and interact with them to see debug information.' :
              'No data matches the current filters.'
            }
          </div>
        ) : (
          filteredData.map(item => (
            <div key={item.id} className="log-entry" style={{ 
              borderLeft: `3px solid ${getTypeColor(item.type)}`,
              marginBottom: '8px',
              padding: '8px 12px',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '4px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{ 
                    background: getTypeColor(item.type), 
                    color: 'white', 
                    padding: '2px 8px', 
                    borderRadius: '12px', 
                    fontSize: '10px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase'
                  }}>
                    {item.type}
                  </span>
                  <span style={{ fontWeight: 'bold', color: '#007bff' }}>
                    {item.deviceId}
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: '#666' }}>
                  {new Date(item.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div style={{ fontSize: '12px', fontFamily: 'Monaco, monospace' }}>
                {formatData(item.data)}
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
        <h4>Debug Information</h4>
        <p style={{ fontSize: '14px', color: '#666', margin: '8px 0' }}>
          This panel shows real-time debug data from connected R1 devices including:
        </p>
        <ul style={{ fontSize: '14px', color: '#666', margin: '8px 0', paddingLeft: '20px' }}>
          <li><strong>Hardware Events:</strong> Accelerometer, buttons, touch interactions</li>
          <li><strong>Camera Events:</strong> Camera operations and status changes</li>
          <li><strong>LLM Events:</strong> AI model interactions and responses</li>
          <li><strong>Storage Events:</strong> Data storage operations</li>
          <li><strong>Audio Events:</strong> Microphone and audio processing</li>
          <li><strong>Performance Events:</strong> System performance metrics</li>
          <li><strong>MCP Events:</strong> Model Context Protocol server interactions</li>
        </ul>
      </div>
    </div>
  );
};

export default DebugTools;