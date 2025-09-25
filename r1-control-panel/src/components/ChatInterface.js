import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

const ChatInterface = ({ socket, deviceId, pinCode }) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // No need to load chat history - OpenAI API handles conversation context
    setMessages([{
      id: Date.now(),
      type: 'system',
      content: `Connected to device: ${deviceId}. Start chatting with your R1!`,
      timestamp: new Date().toISOString()
    }]);
  }, [deviceId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!message.trim()) {
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
      const headers = {
        'Content-Type': 'application/json'
      };

      if (pinCode) {
        headers['Authorization'] = `Bearer ${pinCode}`;
      }

      const response = await fetch(`/${deviceId}/v1/chat/completions`, {
        method: 'POST',
        headers: headers,
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
          type: 'error',
          content: `Error: ${data.error?.message || 'Unknown error'}`,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        type: 'error',
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
      content: 'Chat cleared. Previous messages are still available on the server.',
      timestamp: new Date().toISOString()
    }]);
  };

  return (
    <div className="card">
      <div className="chat-header">
        <h2>Chat with {deviceId}</h2>
        <button className="btn btn-secondary btn-sm" onClick={clearMessages}>
          Clear Chat
        </button>
      </div>
      
      <div className="chat-messages">
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.type}`}>
            <div className="message-header">
              {msg.type.charAt(0).toUpperCase() + msg.type.slice(1)} - {new Date(msg.timestamp).toLocaleTimeString()}
            </div>
            <div className="message-content">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <textarea
          className="form-textarea"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message to your R1 device..."
          rows="3"
          disabled={isLoading}
        />
        <button 
          className="btn"
          onClick={handleSendMessage}
          disabled={isLoading || !message.trim()}
        >
          {isLoading ? <><span className="loading"></span>Sending...</> : 'Send'}
        </button>
      </div>
    </div>
  );
};

export default ChatInterface;