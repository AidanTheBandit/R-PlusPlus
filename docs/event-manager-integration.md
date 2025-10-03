# EventManager Integration Guide

This document explains how to integrate and use the centralized EventManager system in the R-API applications.

## Overview

The EventManager provides a centralized event system with the following features:

- ✅ Subscription/unsubscription handling
- ✅ Debouncing and throttling capabilities  
- ✅ Automatic cleanup on component unmount
- ✅ Event delegation for improved performance
- ✅ Component-scoped event management
- ✅ Memory leak prevention

## Installation

The EventManager is already installed and ready to use. It consists of:

- `src/utils/event-manager.js` - CommonJS version (for Node.js/Jest)
- `src/utils/event-manager.esm.js` - ES6 module version (for React apps)
- `src/hooks/useEventManager.js` - CommonJS React hooks
- `src/hooks/useEventManager.esm.js` - ES6 React hooks

## Usage in React Applications

### Basic Usage

```jsx
import React, { useState } from 'react';
import { useEventManager } from '../hooks/useEventManager.esm.js';

function MyComponent() {
  const [messages, setMessages] = useState([]);
  const { subscribe, emit, componentId } = useEventManager('my-component');

  // Subscribe to events
  React.useEffect(() => {
    const subscription = subscribe('new-message', (event) => {
      setMessages(prev => [...prev, event.data]);
    });

    // Cleanup is automatic on unmount
    return () => unsubscribe(subscription);
  }, [subscribe]);

  const sendMessage = () => {
    emit('new-message', { text: 'Hello World!', timestamp: Date.now() });
  };

  return (
    <div>
      <button onClick={sendMessage}>Send Message</button>
      {messages.map(msg => <div key={msg.timestamp}>{msg.text}</div>)}
    </div>
  );
}
```

### Debounced Events

```jsx
import { useEventManager } from '../hooks/useEventManager.esm.js';

function SearchComponent() {
  const { subscribeDebounced, emit } = useEventManager();

  React.useEffect(() => {
    // Debounce search events by 500ms
    const subscription = subscribeDebounced('search-query', (event) => {
      console.log('Performing search:', event.data.query);
      // Perform actual search here
    }, 500);

    return () => unsubscribe(subscription);
  }, [subscribeDebounced]);

  const handleSearchInput = (e) => {
    emit('search-query', { query: e.target.value });
  };

  return <input onChange={handleSearchInput} placeholder="Search..." />;
}
```

### Event Delegation

```jsx
import { useEventManager } from '../hooks/useEventManager.esm.js';

function DynamicButtonList() {
  const [buttons, setButtons] = useState([]);
  const containerRef = useRef(null);
  const { subscribeDelegated } = useEventManager();

  React.useEffect(() => {
    if (!containerRef.current) return;

    // Use event delegation for dynamic buttons
    const subscription = subscribeDelegated(
      'click',
      containerRef.current,
      '.dynamic-button',
      (event) => {
        console.log('Button clicked:', event.currentTarget.textContent);
      }
    );

    return () => unsubscribe(subscription);
  }, [subscribeDelegated]);

  const addButton = () => {
    setButtons(prev => [...prev, `Button ${prev.length + 1}`]);
  };

  return (
    <div ref={containerRef}>
      <button onClick={addButton}>Add Button</button>
      {buttons.map((text, index) => (
        <button key={index} className="dynamic-button">
          {text}
        </button>
      ))}
    </div>
  );
}
```

## Integration with Existing Socket Connections

Replace existing socket event handling with the EventManager:

### Before (useSocket.js)
```javascript
// Old approach with potential memory leaks
useEffect(() => {
  const handleMessage = (data) => {
    setMessages(prev => [...prev, data]);
  };

  socket.on('message', handleMessage);
  
  return () => {
    socket.off('message', handleMessage); // Easy to forget
  };
}, []);
```

### After (with EventManager)
```javascript
import { useEventManager } from '../hooks/useEventManager.esm.js';

function useSocket() {
  const { subscribe, emit } = useEventManager('socket-manager');

  useEffect(() => {
    // Subscribe to socket events through EventManager
    const messageSubscription = subscribe('socket-message', (event) => {
      setMessages(prev => [...prev, event.data]);
    });

    // Bridge socket events to EventManager
    const handleSocketMessage = (data) => {
      emit('socket-message', data);
    };

    socket.on('message', handleSocketMessage);
    
    return () => {
      socket.off('message', handleSocketMessage);
      // EventManager cleanup is automatic
    };
  }, [subscribe, emit]);
}
```

## Performance Optimizations

### 1. Throttled Scroll Events
```javascript
const { subscribeDOMEvent } = useEventManager();

useEffect(() => {
  const subscription = subscribeDOMEvent('scroll', window, (event) => {
    console.log('Scroll position:', window.scrollY);
  }, { throttle: 100 }); // Throttle to 100ms

  return () => unsubscribe(subscription);
}, [subscribeDOMEvent]);
```

### 2. Component Communication
```javascript
// Parent component
function ParentComponent() {
  const { subscribe } = useEventManager('parent');

  useEffect(() => {
    const subscription = subscribe('child-action', (event) => {
      console.log('Child performed action:', event.data);
    });
  }, [subscribe]);

  return <ChildComponent />;
}

// Child component
function ChildComponent() {
  const { emit } = useEventManager('child');

  const handleClick = () => {
    emit('child-action', { action: 'button-click', timestamp: Date.now() });
  };

  return <button onClick={handleClick}>Click Me</button>;
}
```

## Memory Leak Prevention

The EventManager automatically prevents memory leaks by:

1. **Automatic Cleanup**: All subscriptions are cleaned up when components unmount
2. **Component Tracking**: Events are scoped to components and cleaned up together
3. **Weak References**: Internal data structures prevent memory retention
4. **DOM Event Cleanup**: Automatically removes DOM event listeners

## Testing

The EventManager includes comprehensive tests. Run them with:

```bash
# Run EventManager tests
npx jest src/tests/event-manager.test.js

# Run React hook tests  
npx jest src/tests/useEventManager.test.js

# Run all event-related tests
npx jest --testPathPattern=event-manager
```

## Migration Strategy

1. **Identify Problem Areas**: Look for components with:
   - Multiple `addEventListener` calls
   - Socket event handlers
   - Interval/timeout management
   - Component communication

2. **Gradual Migration**: Start with the most problematic components first

3. **Test Memory Usage**: Use browser dev tools to monitor memory usage before and after migration

4. **Monitor Performance**: Check that debouncing/throttling improves performance

## Best Practices

1. **Use Descriptive Event Names**: `user-login-success` instead of `login`
2. **Namespace Events**: Use prefixes like `socket:`, `ui:`, `api:`
3. **Clean Data**: Ensure event data is serializable and doesn't contain circular references
4. **Error Handling**: Wrap event handlers in try-catch blocks for critical events
5. **Documentation**: Document custom events and their expected data structure

## Example Integration Points

### 1. Socket Handler (src/socket/socket-handler.js)
Replace direct socket event handling with EventManager emissions

### 2. Performance Monitor (src/utils/performance-monitor.js)  
Use EventManager for performance metric events

### 3. React Components
- ConsolePanel.jsx - Use for log events
- PerformanceMonitor.jsx - Use for metric updates
- DeviceInfo.jsx - Use for device status changes

### 4. Cross-App Communication
Use EventManager to sync state between control panel and creation app

This integration will significantly improve memory management and provide a solid foundation for the widget system implementation.