import React, { useState, useEffect, useRef } from 'react';

const ChatInterface = ({ socket, connectedDevices }) => {
  const [selectedDevice, setSelectedDevice] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Add initial system message
    setMessages([{
      id: Date.now(),
      type: 'system',
      content: 'R1 Control Panel initialized. Select a device and start chatting!',
      timestamp: new Date().toISOString()
    }]);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!selectedDevice || !message.trim()) {
      alert('Please select a device and enter a message');
      return;
    }

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch(`/${selectedDevice}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: message }],
          model: 'r1-command',
          temperature: 0.7,
          max_tokens: 150
        })
      });

      const data = await response.json();

      if (response.ok) {
        const assistantMessage = {
          id: Date.now() + 1,
          type: 'assistant',
          content: data.choices?.[0]?.message?.content || 'Response received',
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        const errorMessage = {
          id: Date.now() + 1,
          type: 'system',
          content: `Error: ${data.error?.message || 'Unknown error'}`,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        type: 'system',
        content: `Network error: ${error.message}`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setMessage('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearMessages = () => {
    setMessages([{
      id: Date.now(),
      type: 'system',
      content: 'Chat cleared',
      timestamp: new Date().toISOString()
    }]);
  };

  return (
    <div className="card">
      <h2 style={{ marginBottom: '20px' }}>Chat with R1 Devices</h2>
      
      <div className="chat-container">
        <div className="chat-main">
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

          <div className="chat-messages">
            {messages.map(msg => (
              <div key={msg.id} className={`message ${msg.type}`}>
                <div className="message-header">
                  {msg.type.charAt(0).toUpperCase() + msg.type.slice(1)} - {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
                <div>{msg.content}</div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-area">
            <textarea
              className="chat-input form-textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message to the R1 device..."
              rows="3"
              disabled={isLoading}
            />
            <button 
              className="btn"
              onClick={handleSendMessage}
              disabled={isLoading || !selectedDevice || !message.trim()}
            >
              {isLoading ? <><span className="loading"></span>Sending...</> : 'Send'}
            </button>
          </div>
        </div>

        <div className="chat-sidebar">
          <h3 style={{ marginBottom: '15px' }}>Controls</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button className="btn btn-secondary btn-sm" onClick={clearMessages}>
              Clear Chat
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => window.location.reload()}>
              Refresh
            </button>
          </div>

          <h4 style={{ marginTop: '20px', marginBottom: '10px' }}>Connected Devices</h4>
          <div style={{ fontSize: '12px' }}>
            {connectedDevices.size === 0 ? (
              <p className="text-muted">No devices connected</p>
            ) : (
              Array.from(connectedDevices.values()).map(device => (
                <div key={device.deviceId} style={{ 
                  padding: '8px', 
                  background: '#f8f9fa', 
                  borderRadius: '4px', 
                  marginBottom: '5px' 
                }}>
                  <div style={{ fontWeight: 'bold' }}>{device.deviceId}</div>
                  <div className="text-muted">
                    Connected: {new Date(device.connectedAt).toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;