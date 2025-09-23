import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import Header from './components/Header';
import TabNavigation from './components/TabNavigation';
import ChatInterface from './components/ChatInterface';
import MCPManager from './components/MCPManager';
import DeviceManager from './components/DeviceManager';
import DebugTools from './components/DebugTools';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('chat');
  const [socket, setSocket] = useState(null);
  const [connectedDevices, setConnectedDevices] = useState(new Map());
  const [serverStats, setServerStats] = useState({
    connectedDevices: 0,
    totalRequests: 0,
    mcpServers: 0,
    runningServers: 0
  });

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io();
    setSocket(newSocket);

    // Socket event handlers
    newSocket.on('connect', () => {
      console.log('Connected to R-API server');
    });

    newSocket.on('device_connected', (data) => {
      setConnectedDevices(prev => {
        const updated = new Map(prev);
        updated.set(data.deviceId, {
          deviceId: data.deviceId,
          userAgent: data.userAgent,
          connectedAt: data.connectedAt,
          status: 'connected'
        });
        return updated;
      });
    });

    newSocket.on('device_disconnected', (data) => {
      setConnectedDevices(prev => {
        const updated = new Map(prev);
        updated.delete(data.deviceId);
        return updated;
      });
    });

    newSocket.on('mcp_event', (data) => {
      console.log('MCP Event:', data);
      // Handle MCP events for real-time updates
    });

    // Load initial data
    loadServerStats();
    loadConnectedDevices();

    return () => {
      newSocket.close();
    };
  }, []);

  const loadServerStats = async () => {
    try {
      const response = await fetch('/api/mcp/overview');
      if (response.ok) {
        const data = await response.json();
        setServerStats({
          connectedDevices: data.totalDevices || 0,
          totalRequests: 0, // This would come from another endpoint
          mcpServers: data.totalServers || 0,
          runningServers: data.runningServers || 0
        });
      }
    } catch (error) {
      console.error('Failed to load server stats:', error);
    }
  };

  const loadConnectedDevices = async () => {
    try {
      const response = await fetch('/api/devices');
      if (response.ok) {
        const data = await response.json();
        const deviceMap = new Map();
        data.devices.forEach(device => {
          deviceMap.set(device.deviceId, device);
        });
        setConnectedDevices(deviceMap);
      }
    } catch (error) {
      console.error('Failed to load connected devices:', error);
    }
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'chat':
        return <ChatInterface socket={socket} connectedDevices={connectedDevices} />;
      case 'mcp':
        return <MCPManager socket={socket} connectedDevices={connectedDevices} />;
      case 'devices':
        return <DeviceManager socket={socket} connectedDevices={connectedDevices} />;
      case 'debug':
        return <DebugTools socket={socket} connectedDevices={connectedDevices} />;
      default:
        return <ChatInterface socket={socket} connectedDevices={connectedDevices} />;
    }
  };

  return (
    <div className="App">
      <Header serverStats={serverStats} />
      <div className="container">
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="tab-content">
          {renderActiveTab()}
        </div>
      </div>
    </div>
  );
}

export default App;