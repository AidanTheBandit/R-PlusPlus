import React from 'react';

const Header = ({ serverStats }) => {
  return (
    <header className="card" style={{ marginBottom: '20px' }}>
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h1 style={{ color: '#667eea', margin: '0 0 10px 0', fontSize: '2.5em' }}>
          R1 Control Panel
        </h1>
        <p style={{ color: '#666', margin: 0 }}>
          Manage R1 devices, MCP servers, and API interactions
        </p>
      </div>
      
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{serverStats.connectedDevices}</div>
          <div className="stat-label">Connected R1s</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{serverStats.totalRequests}</div>
          <div className="stat-label">API Requests</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{serverStats.mcpServers}</div>
          <div className="stat-label">MCP Servers</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{serverStats.runningServers}</div>
          <div className="stat-label">Running Servers</div>
        </div>
      </div>
    </header>
  );
};

export default Header;