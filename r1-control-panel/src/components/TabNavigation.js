import React from 'react';

const TabNavigation = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'chat', label: '💬 Chat', description: 'Chat with your R1 device' },
    { id: 'speech', label: '🎵 Speech', description: 'Test text-to-speech functionality' },
    //{ id: 'phone', label: '📱 SMS', description: 'Link phone numbers for SMS control' },
    { id: 'api-docs', label: '📚 API Docs', description: 'View API documentation and endpoints' },
    { id: 'mcp', label: '🔌 MCP Servers', description: 'Manage MCP servers for your device' }
  ];

  // Coming soon tabs (disabled)
  const comingSoonTabs = [
    // { id: 'mcp', label: '🔌 MCP Servers', description: 'Coming Soon - Manage MCP servers for your device' }
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
        {comingSoonTabs.map(tab => (
          <button
            key={tab.id}
            className="tab-btn disabled coming-soon"
            title={tab.description}
            disabled
          >
            {tab.label} <span className="coming-soon-badge">Coming Soon</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default TabNavigation;