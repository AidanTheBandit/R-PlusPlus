import React from 'react';

const TabNavigation = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'chat', label: '💬 Chat', description: 'Chat with your R1 device' },
    { id: 'mcp', label: '🔌 MCP Servers', description: 'Manage MCP servers for your device' }
  ];

  return (
    <div className="card">
      <div className="tab-nav">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
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