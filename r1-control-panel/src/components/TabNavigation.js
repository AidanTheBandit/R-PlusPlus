import React from 'react';

const TabNavigation = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'chat', label: '💬 Chat', description: 'Test R1 devices' },
    { id: 'mcp', label: '🔌 MCP Servers', description: 'Manage MCP servers' },
    { id: 'devices', label: '📱 Devices', description: 'Connected devices' },
    { id: 'debug', label: '🔧 Debug', description: 'Debug tools' }
  ];

  return (
    <div className="card">
      <div style={{ 
        display: 'flex', 
        gap: '4px', 
        background: '#f0f0f0', 
        borderRadius: '8px', 
        padding: '4px' 
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`btn ${activeTab === tab.id ? '' : 'btn-secondary'}`}
            style={{
              flex: 1,
              background: activeTab === tab.id ? '#667eea' : 'transparent',
              color: activeTab === tab.id ? 'white' : '#666',
              border: 'none',
              padding: '12px 16px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: activeTab === tab.id ? 'bold' : 'normal',
              transition: 'all 0.2s'
            }}
            title={tab.description}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TabNavigation;