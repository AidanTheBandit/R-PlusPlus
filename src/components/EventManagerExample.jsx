/**
 * Example component demonstrating EventManager usage
 * This shows how to use the centralized event system in React components
 */

import React, { useState, useRef } from 'react';
import { useEventManager, useEventSubscription, useEventEmitter } from '../hooks/useEventManager.esm.js';

const EventManagerExample = () => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const containerRef = useRef(null);
  
  // Get event management functions
  const {
    subscribe,
    unsubscribe,
    emit,
    subscribeDebounced,
    subscribeThrottled,
    subscribeDOMEvent,
    subscribeDelegated,
    componentId
  } = useEventManager('event-manager-example');

  // Alternative way using the subscription hook
  useEventSubscription('global-message', (event) => {
    setMessages(prev => [...prev, {
      id: Date.now(),
      type: 'global',
      message: event.data.message,
      timestamp: new Date().toLocaleTimeString()
    }]);
  }, {}, []);

  // Example of debounced search
  React.useEffect(() => {
    const searchSubscription = subscribeDebounced('search-input', (event) => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'search',
        message: `Debounced search: "${event.data.query}"`,
        timestamp: new Date().toLocaleTimeString()
      }]);
    }, 500);

    return () => unsubscribe(searchSubscription);
  }, [subscribeDebounced, unsubscribe]);

  // Example of throttled scroll events
  React.useEffect(() => {
    if (!containerRef.current) return;

    const scrollSubscription = subscribeDOMEvent('scroll', containerRef.current, (event) => {
      console.log('Scroll event:', event.target.scrollTop);
    }, { throttle: 100 });

    return () => unsubscribe(scrollSubscription);
  }, [subscribeDOMEvent, unsubscribe]);

  // Example of event delegation for dynamic buttons
  React.useEffect(() => {
    if (!containerRef.current) return;

    const clickSubscription = subscribeDelegated(
      'click',
      containerRef.current,
      '.dynamic-button',
      (event) => {
        const buttonText = event.currentTarget.textContent;
        setMessages(prev => [...prev, {
          id: Date.now(),
          type: 'button',
          message: `Clicked delegated button: "${buttonText}"`,
          timestamp: new Date().toLocaleTimeString()
        }]);
      }
    );

    return () => unsubscribe(clickSubscription);
  }, [subscribeDelegated, unsubscribe]);

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    // Emit a global message event
    emit('global-message', { message: inputValue });
    setInputValue('');
  };

  const handleSearchInput = (e) => {
    const query = e.target.value;
    // Emit search event (will be debounced)
    emit('search-input', { query });
  };

  const addDynamicButton = () => {
    const buttonText = `Button ${Date.now()}`;
    setMessages(prev => [...prev, {
      id: Date.now(),
      type: 'system',
      message: `Added dynamic button: "${buttonText}"`,
      timestamp: new Date().toLocaleTimeString(),
      isButton: true,
      buttonText
    }]);
  };

  const clearMessages = () => {
    setMessages([]);
  };

  return (
    <div className="event-manager-example" style={{ padding: '20px', maxWidth: '800px' }}>
      <h2>EventManager Example</h2>
      <p>Component ID: <code>{componentId}</code></p>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>Send Global Message</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter a message..."
            style={{ flex: 1, padding: '8px' }}
          />
          <button onClick={handleSendMessage} style={{ padding: '8px 16px' }}>
            Send Message
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>Debounced Search</h3>
        <input
          type="text"
          onChange={handleSearchInput}
          placeholder="Type to search (debounced 500ms)..."
          style={{ width: '100%', padding: '8px' }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>Dynamic Buttons (Event Delegation)</h3>
        <button onClick={addDynamicButton} style={{ padding: '8px 16px', marginRight: '10px' }}>
          Add Dynamic Button
        </button>
        <button onClick={clearMessages} style={{ padding: '8px 16px' }}>
          Clear Messages
        </button>
      </div>

      <div 
        ref={containerRef}
        style={{ 
          height: '300px', 
          overflow: 'auto', 
          border: '1px solid #ccc', 
          padding: '10px',
          backgroundColor: '#f9f9f9'
        }}
      >
        <h3>Event Messages (Scrollable - Throttled Events)</h3>
        {messages.length === 0 ? (
          <p style={{ color: '#666' }}>No messages yet. Try the controls above!</p>
        ) : (
          messages.map(msg => (
            <div 
              key={msg.id} 
              style={{ 
                marginBottom: '10px', 
                padding: '8px', 
                backgroundColor: 'white',
                borderRadius: '4px',
                borderLeft: `4px solid ${getTypeColor(msg.type)}`
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  <strong>[{msg.type.toUpperCase()}]</strong> {msg.message}
                </span>
                <small style={{ color: '#666' }}>{msg.timestamp}</small>
              </div>
              {msg.isButton && (
                <button 
                  className="dynamic-button"
                  style={{ 
                    marginTop: '5px', 
                    padding: '4px 8px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer'
                  }}
                >
                  {msg.buttonText}
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
        <h4>Features Demonstrated:</h4>
        <ul>
          <li>✅ Basic event subscription and emission</li>
          <li>✅ Debounced event handlers (search input)</li>
          <li>✅ Throttled DOM events (scroll)</li>
          <li>✅ Event delegation for dynamic elements</li>
          <li>✅ Automatic cleanup on component unmount</li>
          <li>✅ Component-scoped event management</li>
        </ul>
      </div>
    </div>
  );
};

function getTypeColor(type) {
  const colors = {
    global: '#28a745',
    search: '#007bff',
    button: '#ffc107',
    system: '#6c757d'
  };
  return colors[type] || '#6c757d';
}

export default EventManagerExample;