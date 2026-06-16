import React, { useState, useEffect } from 'react';
import { HeartIcon } from './components/Icons';
import DeviceLogin from './components/DeviceLogin';
import TabNavigation from './components/TabNavigation';
import ChatInterface from './components/ChatInterface';
import SpeechTest from './components/SpeechTest';
import ImageTest from './components/ImageTest';
import ApiDocs from './components/ApiDocs';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('chat');
  const [deviceId, setDeviceId] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const savedDeviceId = localStorage.getItem('r1-device-id');
    const savedPinCode = localStorage.getItem('r1-pin-code');
    
    if (savedDeviceId) {
      setDeviceId(savedDeviceId);
      setPinCode(savedPinCode || '');
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
        setDeviceId(deviceIdInput);
        setPinCode(pinCodeInput);
        setIsAuthenticated(true);
        
        localStorage.setItem('r1-device-id', deviceIdInput);
        if (pinCodeInput) {
          localStorage.setItem('r1-pin-code', pinCodeInput);
        } else {
          localStorage.removeItem('r1-pin-code');
        }
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
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'chat':
        return <ChatInterface deviceId={deviceId} pinCode={pinCode} />;
      case 'speech':
        return <SpeechTest deviceId={deviceId} pinCode={pinCode} />;
      case 'image':
        return <ImageTest deviceId={deviceId} pinCode={pinCode} />;
      case 'api-docs':
        return <ApiDocs deviceId={deviceId} />;
      default:
        return <ChatInterface deviceId={deviceId} pinCode={pinCode} />;
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
          <span>Made with <HeartIcon size={12} /> by Aidan</span>
        </footer>
      </div>
    </div>
  );
}

export default App;
