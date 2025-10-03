/**
 * Widget Socket Handler - Backend coordination for widget system
 * Handles WebSocket communication between control panel and R1 devices
 */

class WidgetSocketHandler {
  constructor(io) {
    this.io = io;
    this.deviceSockets = new Map(); // deviceId -> socket
    this.controlPanelSockets = new Map(); // socketId -> deviceId
    this.widgetInstances = new Map(); // deviceId -> Map(instanceId -> widgetData)
  }

  /**
   * Initialize socket handlers
   */
  initialize() {
    this.io.on('connection', (socket) => {
      console.log(`Socket connected: ${socket.id}`);

      // Handle device registration
      socket.on('device:register', (data) => {
        this.handleDeviceRegister(socket, data);
      });

      // Handle control panel connection
      socket.on('controlPanel:connect', (data) => {
        this.handleControlPanelConnect(socket, data);
      });

      // Widget management commands from control panel
      socket.on('widget:create', (data, callback) => {
        this.handleWidgetCreate(socket, data, callback);
      });

      socket.on('widget:remove', (data, callback) => {
        this.handleWidgetRemove(socket, data, callback);
      });

      socket.on('widget:updateConfig', (data, callback) => {
        this.handleWidgetUpdateConfig(socket, data, callback);
      });

      socket.on('widget:updatePosition', (data, callback) => {
        this.handleWidgetUpdatePosition(socket, data, callback);
      });

      socket.on('widget:setVisibility', (data, callback) => {
        this.handleWidgetSetVisibility(socket, data, callback);
      });

      socket.on('widget:bringToFront', (data, callback) => {
        this.handleWidgetBringToFront(socket, data, callback);
      });

      // Widget data subscriptions from R1 devices
      socket.on('widget:subscribe', (data) => {
        this.handleWidgetSubscribe(socket, data);
      });

      socket.on('widget:unsubscribe', (data) => {
        this.handleWidgetUnsubscribe(socket, data);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  /**
   * Handle R1 device registration
   */
  handleDeviceRegister(socket, data) {
    const { deviceId } = data;
    
    // Store device socket
    this.deviceSockets.set(deviceId, socket);
    socket.deviceId = deviceId;
    
    // Initialize widget instances for device
    if (!this.widgetInstances.has(deviceId)) {
      this.widgetInstances.set(deviceId, new Map());
    }

    console.log(`R1 device registered: ${deviceId}`);
    
    // Notify control panels about device connection
    this.broadcastToControlPanels('device:connected', { deviceId });
  }

  /**
   * Handle control panel connection
   */
  handleControlPanelConnect(socket, data) {
    const { deviceId } = data;
    
    // Store control panel socket mapping
    this.controlPanelSockets.set(socket.id, deviceId);
    socket.controlPanelDeviceId = deviceId;

    console.log(`Control panel connected for device: ${deviceId}`);

    // Send current widget state to control panel
    const widgets = this.widgetInstances.get(deviceId);
    if (widgets) {
      socket.emit('widget:stateSync', {
        widgets: Array.from(widgets.values())
      });
    }
  }

  /**
   * Handle widget creation from control panel
   */
  handleWidgetCreate(socket, data, callback) {
    const deviceId = this.controlPanelSockets.get(socket.id);
    if (!deviceId) {
      callback({ success: false, error: 'No device associated with control panel' });
      return;
    }

    const deviceSocket = this.deviceSockets.get(deviceId);
    if (!deviceSocket) {
      callback({ success: false, error: 'Device not connected' });
      return;
    }

    // Store widget instance data
    const widgets = this.widgetInstances.get(deviceId);
    widgets.set(data.instanceId, {
      instanceId: data.instanceId,
      widgetId: data.widgetId,
      config: data.config,
      position: data.position,
      visible: data.visible,
      zIndex: data.zIndex,
      createdAt: new Date()
    });

    // Forward to R1 device
    deviceSocket.emit('widget:create', data, (response) => {
      if (response.success) {
        console.log(`Widget created on device ${deviceId}: ${data.instanceId}`);
      } else {
        // Remove from storage if device creation failed
        widgets.delete(data.instanceId);
      }
      callback(response);
    });
  }

  /**
   * Handle widget removal from control panel
   */
  handleWidgetRemove(socket, data, callback) {
    const deviceId = this.controlPanelSockets.get(socket.id);
    if (!deviceId) {
      callback({ success: false, error: 'No device associated with control panel' });
      return;
    }

    const deviceSocket = this.deviceSockets.get(deviceId);
    if (!deviceSocket) {
      callback({ success: false, error: 'Device not connected' });
      return;
    }

    // Remove from storage
    const widgets = this.widgetInstances.get(deviceId);
    widgets.delete(data.instanceId);

    // Forward to R1 device
    deviceSocket.emit('widget:remove', data, (response) => {
      if (response.success) {
        console.log(`Widget removed from device ${deviceId}: ${data.instanceId}`);
      }
      callback(response);
    });
  }

  /**
   * Handle widget config update from control panel
   */
  handleWidgetUpdateConfig(socket, data, callback) {
    const deviceId = this.controlPanelSockets.get(socket.id);
    if (!deviceId) {
      callback({ success: false, error: 'No device associated with control panel' });
      return;
    }

    const deviceSocket = this.deviceSockets.get(deviceId);
    if (!deviceSocket) {
      callback({ success: false, error: 'Device not connected' });
      return;
    }

    // Update storage
    const widgets = this.widgetInstances.get(deviceId);
    const widget = widgets.get(data.instanceId);
    if (widget) {
      widget.config = { ...widget.config, ...data.config };
      widget.lastUpdated = new Date();
    }

    // Forward to R1 device
    deviceSocket.emit('widget:updateConfig', data, callback);
  }

  /**
   * Handle widget position update from control panel
   */
  handleWidgetUpdatePosition(socket, data, callback) {
    const deviceId = this.controlPanelSockets.get(socket.id);
    if (!deviceId) {
      callback({ success: false, error: 'No device associated with control panel' });
      return;
    }

    const deviceSocket = this.deviceSockets.get(deviceId);
    if (!deviceSocket) {
      callback({ success: false, error: 'Device not connected' });
      return;
    }

    // Update storage
    const widgets = this.widgetInstances.get(deviceId);
    const widget = widgets.get(data.instanceId);
    if (widget) {
      widget.position = { ...widget.position, ...data.position };
      widget.lastUpdated = new Date();
    }

    // Forward to R1 device
    deviceSocket.emit('widget:updatePosition', data, callback);
  }

  /**
   * Handle widget visibility change from control panel
   */
  handleWidgetSetVisibility(socket, data, callback) {
    const deviceId = this.controlPanelSockets.get(socket.id);
    if (!deviceId) {
      callback({ success: false, error: 'No device associated with control panel' });
      return;
    }

    const deviceSocket = this.deviceSockets.get(deviceId);
    if (!deviceSocket) {
      callback({ success: false, error: 'Device not connected' });
      return;
    }

    // Update storage
    const widgets = this.widgetInstances.get(deviceId);
    const widget = widgets.get(data.instanceId);
    if (widget) {
      widget.visible = data.visible;
      widget.lastUpdated = new Date();
    }

    // Forward to R1 device
    deviceSocket.emit('widget:setVisibility', data, callback);
  }

  /**
   * Handle widget bring to front from control panel
   */
  handleWidgetBringToFront(socket, data, callback) {
    const deviceId = this.controlPanelSockets.get(socket.id);
    if (!deviceId) {
      callback({ success: false, error: 'No device associated with control panel' });
      return;
    }

    const deviceSocket = this.deviceSockets.get(deviceId);
    if (!deviceSocket) {
      callback({ success: false, error: 'Device not connected' });
      return;
    }

    // Update storage
    const widgets = this.widgetInstances.get(deviceId);
    const widget = widgets.get(data.instanceId);
    if (widget) {
      widget.zIndex = data.zIndex;
      widget.lastUpdated = new Date();
    }

    // Forward to R1 device
    deviceSocket.emit('widget:bringToFront', data, callback);
  }

  /**
   * Handle widget data subscription from R1 device
   */
  handleWidgetSubscribe(socket, data) {
    const { instanceId, dataSource, options } = data;
    
    // Store subscription info
    socket.widgetSubscriptions = socket.widgetSubscriptions || new Map();
    socket.widgetSubscriptions.set(`${instanceId}:${dataSource}`, {
      instanceId,
      dataSource,
      options
    });

    console.log(`Widget subscribed to data source: ${instanceId} -> ${dataSource}`);
  }

  /**
   * Handle widget data unsubscription from R1 device
   */
  handleWidgetUnsubscribe(socket, data) {
    const { instanceId, dataSource } = data;
    
    if (socket.widgetSubscriptions) {
      socket.widgetSubscriptions.delete(`${instanceId}:${dataSource}`);
    }

    console.log(`Widget unsubscribed from data source: ${instanceId} -> ${dataSource}`);
  }

  /**
   * Handle socket disconnection
   */
  handleDisconnect(socket) {
    // Handle device disconnection
    if (socket.deviceId) {
      this.deviceSockets.delete(socket.deviceId);
      console.log(`R1 device disconnected: ${socket.deviceId}`);
      
      // Notify control panels about device disconnection
      this.broadcastToControlPanels('device:disconnected', { 
        deviceId: socket.deviceId 
      });
    }

    // Handle control panel disconnection
    if (socket.controlPanelDeviceId) {
      this.controlPanelSockets.delete(socket.id);
      console.log(`Control panel disconnected for device: ${socket.controlPanelDeviceId}`);
    }
  }

  /**
   * Broadcast message to all control panels
   */
  broadcastToControlPanels(event, data) {
    this.controlPanelSockets.forEach((deviceId, socketId) => {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit(event, data);
      }
    });
  }

  /**
   * Send data update to specific widget
   */
  sendWidgetDataUpdate(deviceId, instanceId, data) {
    const deviceSocket = this.deviceSockets.get(deviceId);
    if (deviceSocket) {
      deviceSocket.emit('widget:dataUpdate', {
        instanceId,
        update: data
      });
    }
  }

  /**
   * Broadcast data source update to all subscribed widgets
   */
  broadcastDataSourceUpdate(dataSource, data) {
    this.deviceSockets.forEach((socket, deviceId) => {
      if (socket.widgetSubscriptions) {
        socket.widgetSubscriptions.forEach((subscription, key) => {
          if (subscription.dataSource === dataSource) {
            socket.emit('widget:dataSourceUpdate', {
              dataSource,
              update: data
            });
          }
        });
      }
    });
  }

  /**
   * Get statistics about widget system
   */
  getStats() {
    let totalWidgets = 0;
    this.widgetInstances.forEach(widgets => {
      totalWidgets += widgets.size;
    });

    return {
      connectedDevices: this.deviceSockets.size,
      connectedControlPanels: this.controlPanelSockets.size,
      totalWidgets,
      devicesWithWidgets: Array.from(this.widgetInstances.entries())
        .filter(([_, widgets]) => widgets.size > 0)
        .map(([deviceId, widgets]) => ({
          deviceId,
          widgetCount: widgets.size
        }))
    };
  }
}

module.exports = WidgetSocketHandler;