# Plugin System Documentation

## Overview

The R-API plugin system allows you to extend the server's functionality without modifying the core codebase. Plugins can add new API endpoints, WebSocket handlers, middleware, and custom logic.

## Plugin Structure

Each plugin is a JavaScript module that exports an object with the following properties:

```javascript
module.exports = {
  name: 'my-plugin',
  version: '1.0.0',
  description: 'Description of what this plugin does',
  init: function(app, io, sharedState) {
    // Plugin initialization code
  }
};
```

## Plugin Lifecycle

1. **Loading**: Plugins are loaded from the `plugins/` directory on server startup
2. **Initialization**: The `init()` function is called with access to:
   - `app`: Express application instance
   - `io`: Socket.IO server instance
   - `sharedState`: Shared state object containing maps and data stores

## Shared State

Plugins have access to the following shared state:

```javascript
{
  connectedR1s,        // Map of connected R1 devices
  conversationHistory, // Map of conversation histories
  pendingRequests,     // Map of pending API requests
  requestDeviceMap,    // Map of request to device mappings
  debugStreams,        // Map of debug data streams
  deviceLogs,          // Map of device logs
  debugDataStore,      // Map of debug data
  performanceMetrics   // Map of performance metrics
}
```

## Example Plugin

### Basic Plugin Template

```javascript
// plugins/example-plugin.js
const express = require('express');

module.exports = {
  name: 'example-plugin',
  version: '1.0.0',
  description: 'Example plugin demonstrating basic functionality',

  init: function(app, io, sharedState) {
    console.log('Example plugin initialized');

    // Add a custom API endpoint
    app.get('/api/example', (req, res) => {
      res.json({
        message: 'Hello from example plugin!',
        connectedDevices: sharedState.connectedR1s.size
      });
    });

    // Add WebSocket event handler
    io.on('connection', (socket) => {
      socket.on('custom_event', (data) => {
        console.log('Custom event received:', data);
        // Broadcast to all connected clients
        socket.broadcast.emit('plugin_response', {
          plugin: 'example',
          data: data
        });
      });
    });

    // Access shared state
    sharedState.connectedR1s.forEach((socket, deviceId) => {
      console.log(`Device ${deviceId} is connected`);
    });
  }
};
```

### Advanced Plugin Example

```javascript
// plugins/analytics-plugin.js
const fs = require('fs').promises;
const path = require('path');

module.exports = {
  name: 'analytics-plugin',
  version: '1.0.0',
  description: 'Analytics and metrics collection plugin',

  init: function(app, io, sharedState) {
    // Store analytics data
    this.analytics = {
      requests: [],
      responses: [],
      errors: []
    };

    // Track API requests
    app.use('/v1/*', (req, res, next) => {
      const startTime = Date.now();
      res.on('finish', () => {
        this.analytics.requests.push({
          endpoint: req.path,
          method: req.method,
          statusCode: res.statusCode,
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString()
        });
      });
      next();
    });

    // Track WebSocket messages
    const originalIo = io;
    io.on('connection', (socket) => {
      const originalEmit = socket.emit;
      socket.emit = function(event, data) {
        if (event === 'response') {
          this.analytics.responses.push({
            deviceId: socket.deviceId,
            data: data,
            timestamp: new Date().toISOString()
          });
        }
        return originalEmit.apply(this, arguments);
      }.bind(this);
    });

    // Add analytics endpoint
    app.get('/analytics', (req, res) => {
      res.json({
        totalRequests: this.analytics.requests.length,
        totalResponses: this.analytics.responses.length,
        totalErrors: this.analytics.errors.length,
        uptime: process.uptime(),
        connectedDevices: sharedState.connectedR1s.size
      });
    });

    // Periodic cleanup
    setInterval(() => {
      const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
      this.analytics.requests = this.analytics.requests.filter(
        req => new Date(req.timestamp).getTime() > cutoff
      );
      this.analytics.responses = this.analytics.responses.filter(
        res => new Date(res.timestamp).getTime() > cutoff
      );
    }, 60 * 60 * 1000); // Clean up every hour
  }
};
```

## Plugin Development Best Practices

### 1. Error Handling
Always wrap plugin code in try-catch blocks:

```javascript
init: function(app, io, sharedState) {
  try {
    // Plugin code here
  } catch (error) {
    console.error(`Plugin ${this.name} initialization failed:`, error);
  }
}
```

### 2. Resource Cleanup
Clean up resources when the plugin is unloaded:

```javascript
module.exports = {
  name: 'cleanup-example',
  init: function(app, io, sharedState) {
    this.interval = setInterval(() => {
      // Do something periodic
    }, 1000);
  },
  cleanup: function() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }
};
```

### 3. State Management
Use the shared state for persistent data, but be careful about memory usage:

```javascript
init: function(app, io, sharedState) {
  // Create plugin-specific state in sharedState
  if (!sharedState.pluginData) {
    sharedState.pluginData = {};
  }
  sharedState.pluginData[this.name] = {
    customData: [],
    settings: {}
  };
}
```

### 4. Naming Conventions
- Use kebab-case for plugin filenames: `my-custom-plugin.js`
- Use descriptive names that indicate functionality
- Avoid conflicts with existing endpoints

### 5. Documentation
Document your plugin with clear comments and examples:

```javascript
/**
 * Custom Plugin
 * Description: This plugin adds custom functionality
 * Endpoints: /api/custom
 * Events: custom_event
 * Dependencies: None
 */
```

## Plugin Loading

Plugins are automatically loaded from the `plugins/` directory when the server starts. The loading process:

1. Scans for `.js` files in `plugins/`
2. Requires each file
3. Validates the plugin structure (must have `name` and `init` properties)
4. Calls `init()` with the required parameters
5. Logs successful loading

## Plugin Management

### Checking Loaded Plugins
The server logs loaded plugins on startup:

```
R-API server running on http://localhost:5482
Loaded plugins: analytics-plugin, example-plugin
```

### Plugin API
The `PluginManager` class provides methods to:
- `loadPlugins()`: Load all plugins
- `initPlugins(app, io, sharedState)`: Initialize all plugins
- `getPlugin(name)`: Get a specific plugin instance
- `getAllPlugins()`: Get list of all plugin names

## Security Considerations

1. **Input Validation**: Always validate inputs in plugin endpoints
2. **Access Control**: Implement proper authentication if needed
3. **Resource Limits**: Be mindful of memory and CPU usage
4. **Error Logging**: Don't expose sensitive information in error messages

## Troubleshooting

### Plugin Not Loading
- Check that the file is in the `plugins/` directory
- Ensure it exports an object with `name` and `init` properties
- Check server logs for error messages

### Plugin Initialization Errors
- Wrap initialization code in try-catch blocks
- Check that required dependencies are available
- Verify that shared state is accessed correctly

### Performance Issues
- Monitor plugin resource usage
- Implement cleanup for periodic tasks
- Use efficient data structures for large datasets