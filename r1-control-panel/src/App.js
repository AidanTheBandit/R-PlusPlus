import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import DeviceLogin from './components/DeviceLogin';
import TabNavigation from './components/TabNavigation';
import ChatInterface from './components/ChatInterface';
import ApiDocs from './components/ApiDocs';
import Apps from './components/Apps';
// import MCPManager from './components/MCPManager'; // Coming soon
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('chat');
  const [socket, setSocket] = useState(null);
  const [deviceId, setDeviceId] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    // Check for saved credentials
    const savedDeviceId = localStorage.getItem('r1-device-id');
    const savedPinCode = localStorage.getItem('r1-pin-code');
    
    if (savedDeviceId) {
      setDeviceId(savedDeviceId);
      setPinCode(savedPinCode || '');
      // Auto-authenticate if we have saved credentials
      handleLogin(savedDeviceId, savedPinCode || '');
    }
  }, []);

  const handleLogin = async (deviceIdInput, pinCodeInput) => {
    setAuthError('');
    
    if (!deviceIdInput.trim()) {
      setAuthError('Device ID is required');
      return;
    }

    try {
      // Test the device connection
      const headers = {
        'Content-Type': 'application/json'
      };

      if (pinCodeInput.trim()) {
        headers['Authorization'] = `Bearer ${pinCodeInput}`;
      }

      const response = await fetch(`/${deviceIdInput}/v1/models`, {
        headers: headers
      });

      if (response.ok) {
        // Authentication successful
        setDeviceId(deviceIdInput);
        setPinCode(pinCodeInput);
        setIsAuthenticated(true);
        
        // Save credentials
        localStorage.setItem('r1-device-id', deviceIdInput);
        if (pinCodeInput) {
          localStorage.setItem('r1-pin-code', pinCodeInput);
        } else {
          localStorage.removeItem('r1-pin-code');
        }

        // Initialize socket connection
        const newSocket = io();
        setSocket(newSocket);

        newSocket.on('connect', () => {
          console.log('Connected to R-API server');
        });

        newSocket.on('mcp_event', (data) => {
          console.log('MCP Event:', data);
        });

      } else {
        const error = await response.json();
        setAuthError(error.error?.message || 'Authentication failed');
      }
    } catch (error) {
      setAuthError(`Connection failed: ${error.message}`);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setDeviceId('');
    setPinCode('');
    setAuthError('');
    localStorage.removeItem('r1-device-id');
    localStorage.removeItem('r1-pin-code');
    
    if (socket) {
      socket.close();
      setSocket(null);
    }
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'chat':
        return <ChatInterface socket={socket} deviceId={deviceId} pinCode={pinCode} />;
      case 'api-docs':
        return <ApiDocs deviceId={deviceId} />;
      case 'mcp':
        // MCP is coming soon, redirect to chat
        setActiveTab('chat');
        return <ChatInterface socket={socket} deviceId={deviceId} pinCode={pinCode} />;
      default:
        return <ChatInterface socket={socket} deviceId={deviceId} pinCode={pinCode} />;
    }
  };

  if (!isAuthenticated) {
    return (
      <DeviceLogin
        deviceId={deviceId}
        pinCode={pinCode}
        onDeviceIdChange={setDeviceId}
        onPinCodeChange={setPinCode}
        onLogin={handleLogin}
        error={authError}
      />
    );
  }

  return (
    <div className="App">
      <div className="container">
        <div className="device-header">
          <div className="device-info">
            <h1>R1 Control Panel</h1>
            <div className="device-id">Device: {deviceId}</div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
        
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="tab-content">
          {renderActiveTab()}
        </div>
        
        <footer className="app-footer">
          <a href="https://barkle.chat/@Aidan" target="_blank" rel="noopener noreferrer">
            Barkle Account
          </a>
          <span>Made with ❤️ by Aidan and <a href="https://boondit.site/r1-generator" target="_blank" rel="noopener noreferrer">R1 QR code gen</a></span>
        </footer>
      </div>
    </div>
  );
}

export default App;