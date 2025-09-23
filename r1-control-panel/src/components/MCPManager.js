import React, { useState, useEffect } from 'react';
import MCPServerCard from './MCPServerCard';
import AddServerModal from './AddServerModal';
import LogsModal from './LogsModal';

const MCPManager = ({ socket, connectedDevices }) => {
  const [selectedDevice, setSelectedDevice] = useState('');
  const [servers, setServers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [overview, setOverview] = useState({
    totalServers: 0,
    runningServers: 0,
    totalTools: 0
  });

  useEffect(() => {
    loadTemplates();
    loadOverview();
  }, []);

  useEffect(() => {
    if (selectedDevice) {
      loadServers();
    } else {
      setServers([]);
    }
  }, [selectedDevice]);

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

  const loadOverview = async () => {
    try {
      const response = await fetch('/api/mcp/overview');
      if (response.ok) {
        const data = await response.json();
        setOverview({
          totalServers: data.totalServers || 0,
          runningServers: data.runningServers || 0,
          totalTools: data.totalTools || 0
        });
      }
    } catch (error) {
      console.error('Failed to load overview:', error);
    }
  };

  const loadServers = async () => {
    if (!selectedDevice) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/${selectedDevice}/mcp/servers`);
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
    if (!selectedDevice) return;

    try {
      const response = await fetch(`/${selectedDevice}/mcp/servers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(serverConfig)
      });

      if (response.ok) {
        setShowAddModal(false);
        loadServers();
        loadOverview();
      } else {
        const error = await response.json();
        alert(`Failed to add server: ${error.error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      alert(`Error adding server: ${error.message}`);
    }
  };

  const handleToggleServer = async (serverName, enabled) => {
    if (!selectedDevice) return;

    try {
      const response = await fetch(`/${selectedDevice}/mcp/servers/${serverName}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enabled })
      });

      if (response.ok) {
        loadServers();
        loadOverview();
      } else {
        const error = await response.json();
        alert(`Failed to toggle server: ${error.error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      alert(`Error toggling server: ${error.message}`);
    }
  };

  const handleDeleteServer = async (serverName) => {
    if (!selectedDevice) return;
    if (!window.confirm(`Are you sure you want to delete the MCP server '${serverName}'?`)) {
      return;
    }

    try {
      const response = await fetch(`/${selectedDevice}/mcp/servers/${serverName}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        loadServers();
        loadOverview();
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
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px' 
      }}>
        <div>
          <h2 style={{ margin: 0 }}>MCP Server Management</h2>
          <p style={{ margin: '5px 0 0 0', color: '#666' }}>
            Manage Model Context Protocol servers for R1 devices
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="btn"
            onClick={() => setShowAddModal(true)}
            disabled={!selectedDevice}
          >
            Add Server
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => {
              loadServers();
              loadOverview();
            }}
          >
            Refresh
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => setShowLogsModal(true)}
            disabled={!selectedDevice}
          >
            View Logs
          </button>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-card">
          <div className="stat-value">{overview.totalServers}</div>
          <div className="stat-label">Total Servers</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{overview.runningServers}</div>
          <div className="stat-label">Running</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{overview.totalTools}</div>
          <div className="stat-label">Available Tools</div>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Select Device:</label>
        <select 
          className="form-select"
          value={selectedDevice}
          onChange={(e) => setSelectedDevice(e.target.value)}
        >
          <option value="">Choose a device...</option>
          {Array.from(connectedDevices.values()).map(device => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.deviceId}
            </option>
          ))}
        </select>
      </div>

      {!selectedDevice ? (
        <div className="text-center" style={{ padding: '40px', color: '#666' }}>
          Select a device to view MCP servers
        </div>
      ) : isLoading ? (
        <div className="text-center" style={{ padding: '40px' }}>
          <span className="loading"></span>
          Loading MCP servers...
        </div>
      ) : servers.length === 0 ? (
        <div className="text-center" style={{ padding: '40px', color: '#666' }}>
          No MCP servers configured for this device
          <br /><br />
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
          deviceId={selectedDevice}
          onClose={() => setShowLogsModal(false)}
        />
      )}
    </div>
  );
};

export default MCPManager;