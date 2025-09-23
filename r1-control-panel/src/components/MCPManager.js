import React, { useState, useEffect } from 'react';
import MCPServerCard from './MCPServerCard';
import AddServerModal from './AddServerModal';
import LogsModal from './LogsModal';

const MCPManager = ({ socket, deviceId, pinCode }) => {
  const [servers, setServers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);

  useEffect(() => {
    loadTemplates();
    loadServers();
  }, [deviceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTemplates = async () => {
    try {
      const response = await fetch('/mcp/templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const loadServers = async () => {
    if (!deviceId) return;
    
    setIsLoading(true);
    try {
      const headers = {};
      if (pinCode) {
        headers['Authorization'] = `Bearer ${pinCode}`;
      }

      const response = await fetch(`/${deviceId}/mcp/servers`, { headers });
      if (response.ok) {
        const data = await response.json();
        setServers(data.servers || []);
      } else {
        console.error('Failed to load servers');
        setServers([]);
      }
    } catch (error) {
      console.error('Failed to load servers:', error);
      setServers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddServer = async (serverConfig) => {
    if (!deviceId) return;

    try {
      const headers = {
        'Content-Type': 'application/json'
      };
      if (pinCode) {
        headers['Authorization'] = `Bearer ${pinCode}`;
      }

      const response = await fetch(`/${deviceId}/mcp/servers`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(serverConfig)
      });

      if (response.ok) {
        setShowAddModal(false);
        loadServers();
      } else {
        const error = await response.json();
        alert(`Failed to add server: ${error.error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      alert(`Error adding server: ${error.message}`);
    }
  };

  const handleToggleServer = async (serverName, enabled) => {
    if (!deviceId) return;

    try {
      const headers = {
        'Content-Type': 'application/json'
      };
      if (pinCode) {
        headers['Authorization'] = `Bearer ${pinCode}`;
      }

      const response = await fetch(`/${deviceId}/mcp/servers/${serverName}/toggle`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ enabled })
      });

      if (response.ok) {
        loadServers();
      } else {
        const error = await response.json();
        alert(`Failed to toggle server: ${error.error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      alert(`Error toggling server: ${error.message}`);
    }
  };

  const handleDeleteServer = async (serverName) => {
    if (!deviceId) return;
    if (!window.confirm(`Are you sure you want to delete the MCP server '${serverName}'?`)) {
      return;
    }

    try {
      const headers = {};
      if (pinCode) {
        headers['Authorization'] = `Bearer ${pinCode}`;
      }

      const response = await fetch(`/${deviceId}/mcp/servers/${serverName}`, {
        method: 'DELETE',
        headers: headers
      });

      if (response.ok) {
        loadServers();
      } else {
        const error = await response.json();
        alert(`Failed to delete server: ${error.error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      alert(`Error deleting server: ${error.message}`);
    }
  };

  return (
    <div className="card">
      <div className="mcp-header">
        <div>
          <h2>MCP Server Management</h2>
          <p>Manage Model Context Protocol servers for {deviceId}</p>
        </div>
        <div className="mcp-actions">
          <button 
            className="btn"
            onClick={() => setShowAddModal(true)}
          >
            Add Server
          </button>
          <button 
            className="btn btn-secondary"
            onClick={loadServers}
          >
            Refresh
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => setShowLogsModal(true)}
          >
            View Logs
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="loading-container">
          <span className="loading"></span>
          Loading MCP servers...
        </div>
      ) : servers.length === 0 ? (
        <div className="empty-state">
          <h3>No MCP servers configured</h3>
          <p>Add your first MCP server to extend your R1's capabilities</p>
          <button className="btn" onClick={() => setShowAddModal(true)}>
            Add Your First Server
          </button>
        </div>
      ) : (
        <div className="mcp-grid">
          {servers.map(server => (
            <MCPServerCard
              key={server.name}
              server={server}
              deviceId={deviceId}
              pinCode={pinCode}
              onToggle={handleToggleServer}
              onDelete={handleDeleteServer}
            />
          ))}
        </div>
      )}

      {showAddModal && (
        <AddServerModal
          templates={templates}
          onAdd={handleAddServer}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {showLogsModal && (
        <LogsModal
          deviceId={deviceId}
          pinCode={pinCode}
          onClose={() => setShowLogsModal(false)}
        />
      )}
    </div>
  );
};

export default MCPManager;