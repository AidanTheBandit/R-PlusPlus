import React from 'react';
import { ChatIcon, SpeechIcon, ImageIcon, ApiDocsIcon } from './Icons';

const TabNavigation = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'chat', label: 'Chat', description: 'Chat with your R1 device', Icon: ChatIcon },
    { id: 'speech', label: 'Speech', description: 'Test text-to-speech functionality', Icon: SpeechIcon },
    { id: 'image', label: 'Image Analysis', description: 'Test image analysis and AI vision', Icon: ImageIcon },
    { id: 'api-docs', label: 'API Docs', description: 'View API documentation and endpoints', Icon: ApiDocsIcon }
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
            <tab.Icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TabNavigation;
