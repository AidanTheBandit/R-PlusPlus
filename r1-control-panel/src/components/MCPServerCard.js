import React from 'react';

const MCPServerCard = ({ server, deviceId, pinCode, onToggle, onDelete }) => {
  const getStatusClass = () => {
    if (server.connected) return 'running';
    if (server.enabled) return 'stopped';
    return 'disabled';
  };

  const getStatusText = () => {
    if (server.connected) return 'Connected';
    if (server.enabled) return 'Disconnected';
    return 'Disabled';
  };

  const formatUptime = (startTime) => {
    if (!startTime) return 'N/A';
    const ms = Date.now() - startTime;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const handleViewTools = async () => {
    try {
      const headers = {};
      if (pinCode) {
        headers['Authorization'] = `Bearer ${pinCode}`;
      }

      const response = await fetch(`/${deviceId}/mcp/servers/${server.name}/tools`, { headers });
      if (response.ok) {
        const data = await response.json();
        const tools = data.tools || [];
        
        let toolsHtml = `<h3>Available Tools for ${server.name}</h3>`;
        if (tools.length === 0) {
          toolsHtml += '<p>No tools available for this server.</p>';
        } else {
          toolsHtml += '<ul>';
          tools.forEach(tool => {
            toolsHtml += `
              <li style="margin-bottom: 10px;">
                <strong>${tool.tool_name}</strong><br>
                <small style="color: #666;">${tool.tool_description || 'No description'}</small><br>
                <small style="color: #999;">Used ${tool.usage_count || 0} times</small>
              </li>
            `;
          });
          toolsHtml += '</ul>';
        }

        const toolsWindow = window.open('', '_blank', 'width=600,height=400');
        toolsWindow.document.write(`
          <html>
            <head>
              <title>MCP Tools - ${server.name}</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; background: #282828; color: #ebdbb2; }
                ul { list-style-type: none; padding: 0; }
                li { padding: 10px; border: 1px solid #504945; margin-bottom: 5px; border-radius: 4px; background: #3c3836; }
              </style>
            </head>
            <body>${toolsHtml}</body>
          </html>
        `);
      } else {
        alert('Failed to load tools');
      }
    } catch (error) {
      alert(`Error loading tools: ${error.message}`);
    }
  };

  return (
    <div className={`mcp-server-card ${getStatusClass()}`}>
      <div className="mcp-server-header">
        <div className="mcp-server-name">{server.name}</div>
        <div className={`device-status ${getStatusClass()}`}>
          <span className={`status-indicator status-${getStatusClass()}`}></span>
          {getStatusText()}
        </div>
      </div>

      <div className="mcp-server-description">
        {server.config?.description || 'No description'}
      </div>

      <div className="mcp-server-details">
        <div className="mcp-server-detail">
          <span className="mcp-server-detail-label">URL:</span>
          <span>{server.config?.url || 'N/A'}</span>
        </div>
        <div className="mcp-server-detail">
          <span className="mcp-server-detail-label">Tools:</span>
          <span>{server.tools?.length || 0}</span>
        </div>
        <div className="mcp-server-detail">
          <span className="mcp-server-detail-label">Protocol:</span>
          <span>{server.config?.protocolVersion || '2025-06-18'}</span>
        </div>
        <div className="mcp-server-detail">
          <span className="mcp-server-detail-label">Auto-approve:</span>
          <span>
            {server.config?.auto_approve ? 
              JSON.parse(server.config.auto_approve).length : 0} tools
          </span>
        </div>
      </div>

      <div className="mcp-server-actions">
        <button 
          className={`btn btn-sm ${server.enabled ? 'btn-danger' : 'btn-success'}`}
          onClick={() => onToggle(server.name, !server.enabled)}
        >
          {server.enabled ? 'Disconnect' : 'Connect'}
        </button>
        <button 
          className="btn btn-secondary btn-sm"
          onClick={handleViewTools}
        >
          Tools ({server.tools?.length || 0})
        </button>
        <button 
          className="btn btn-danger btn-sm"
          onClick={() => onDelete(server.name)}
        >
          Delete
        </button>
      </div>

      {server.tools && server.tools.length > 0 && (
        <div className="mcp-tools-list">
          <div className="mcp-tools-header">Available Tools:</div>
          {server.tools.slice(0, 3).map(tool => (
            <div key={tool.name} className="mcp-tool-item">
              <span className="mcp-tool-name">{tool.name}</span>
              <span className="mcp-tool-usage">Used {tool.usage_count || 0} times</span>
            </div>
          ))}
          {server.tools.length > 3 && (
            <div style={{ fontSize: '0.8em', color: '#666', textAlign: 'center', marginTop: '5px' }}>
              +{server.tools.length - 3} more tools
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MCPServerCard;