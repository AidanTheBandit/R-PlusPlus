/**
 * WidgetManager - Manages widget instances from control panel
 * Handles widget creation, updates, removal, and sends commands to R1 device
 */

// Simple EventEmitter implementation for browser compatibility
class EventEmitter {
  constructor() {
    this.events = {};
  }

  on(event, listener) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }

  off(event, listener) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(l => l !== listener);
  }

  emit(event, ...args) {
    if (!this.events[event]) return;
    this.events[event].forEach(listener => listener(...args));
  }

  removeAllListeners(event) {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
  }
}

class WidgetManager extends EventEmitter {
  constructor(widgetRegistry, socket) {
    super();
    this.registry = widgetRegistry;
    this.socket = socket;
    this.instances = new Map();
    this.nextInstanceId = 1;
    this.deviceId = null;
  }

  /**
   * Set the target device ID
   * @param {string} deviceId - Target R1 device ID
   */
  setDeviceId(deviceId) {
    this.deviceId = deviceId;
  }

  /**
   * Create a new widget instance on R1 device
   * @param {string} widgetId - Widget definition ID
   * @param {Object} config - Widget configuration
   * @param {Object} position - Widget position {x, y, width, height}
   * @returns {Promise<string>} Instance ID
   */
  async createInstance(widgetId, config = {}, position = {}) {
    if (!this.deviceId) {
      throw new Error('No device ID set');
    }

    const widgetDef = this.registry.getWidget(widgetId);
    if (!widgetDef) {
      throw new Error(`Widget definition not found: ${widgetId}`);
    }

    // Validate configuration against schema
    if (widgetDef.configSchema) {
      this._validateConfig(config, widgetDef.configSchema);
    }

    // Generate unique instance ID
    const instanceId = `${widgetId}-${this.nextInstanceId++}`;

    // Create widget instance data
    const instance = {
      id: instanceId,
      widgetId: widgetId,
      config: { ...widgetDef.defaultConfig, ...config },
      position: {
        x: position.x || 0,
        y: position.y || 0,
        width: position.width || widgetDef.defaultSize?.width || 200,
        height: position.height || widgetDef.defaultSize?.height || 150
      },
      state: 'creating',
      createdAt: new Date(),
      lastUpdated: new Date(),
      visible: true,
      zIndex: this._getNextZIndex()
    };

    // Validate size constraints
    this._validateInstanceSize(instance, widgetDef);

    // Store instance locally
    this.instances.set(instanceId, instance);

    // Send create command to R1 device
    try {
      await this._sendToDevice('widget:create', {
        instanceId,
        widgetId,
        config: instance.config,
        position: instance.position,
        visible: instance.visible,
        zIndex: instance.zIndex
      });

      instance.state = 'active';
      this.emit('instanceCreated', instance);
      console.log(`Widget instance created on device: ${instanceId} (${widgetId})`);
      
      return instanceId;
    } catch (error) {
      // Remove from local storage if device creation failed
      this.instances.delete(instanceId);
      throw new Error(`Failed to create widget on device: ${error.message}`);
    }
  }

  /**
   * Remove a widget instance from R1 device
   * @param {string} instanceId - Instance ID to remove
   */
  async removeInstance(instanceId) {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Widget instance not found: ${instanceId}`);
    }

    // Update state to removing
    instance.state = 'removing';
    this.emit('instanceStateChanged', instance);

    try {
      // Send remove command to R1 device
      await this._sendToDevice('widget:remove', { instanceId });

      // Remove from local storage
      this.instances.delete(instanceId);

      // Emit removal event
      this.emit('instanceRemoved', { id: instanceId, widgetId: instance.widgetId });
      console.log(`Widget instance removed from device: ${instanceId}`);
    } catch (error) {
      instance.state = 'error';
      throw new Error(`Failed to remove widget from device: ${error.message}`);
    }
  }

  /**
   * Update widget instance configuration
   * @param {string} instanceId - Instance ID
   * @param {Object} newConfig - New configuration
   */
  async updateConfig(instanceId, newConfig) {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Widget instance not found: ${instanceId}`);
    }

    const widgetDef = this.registry.getWidget(instance.widgetId);
    
    // Validate new configuration
    if (widgetDef.configSchema) {
      this._validateConfig(newConfig, widgetDef.configSchema);
    }

    // Update local configuration
    const oldConfig = { ...instance.config };
    instance.config = { ...instance.config, ...newConfig };
    instance.lastUpdated = new Date();

    try {
      // Send update to R1 device
      await this._sendToDevice('widget:updateConfig', {
        instanceId,
        config: instance.config
      });

      // Emit update event
      this.emit('instanceConfigUpdated', instance);
      console.log(`Widget instance config updated on device: ${instanceId}`);
    } catch (error) {
      // Revert local changes on failure
      instance.config = oldConfig;
      throw new Error(`Failed to update widget config on device: ${error.message}`);
    }
  }

  /**
   * Update widget instance position
   * @param {string} instanceId - Instance ID
   * @param {Object} position - New position {x, y, width, height}
   */
  async updatePosition(instanceId, position) {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Widget instance not found: ${instanceId}`);
    }

    const widgetDef = this.registry.getWidget(instance.widgetId);
    const oldPosition = { ...instance.position };

    // Update local position
    instance.position = { ...instance.position, ...position };
    instance.lastUpdated = new Date();

    // Validate size constraints
    try {
      this._validateInstanceSize(instance, widgetDef);
    } catch (error) {
      instance.position = oldPosition;
      throw error;
    }

    try {
      // Send position update to R1 device
      await this._sendToDevice('widget:updatePosition', {
        instanceId,
        position: instance.position
      });

      // Emit position update event
      this.emit('instancePositionUpdated', instance);
      console.log(`Widget instance position updated on device: ${instanceId}`);
    } catch (error) {
      // Revert local changes on failure
      instance.position = oldPosition;
      throw new Error(`Failed to update widget position on device: ${error.message}`);
    }
  }

  /**
   * Set widget visibility
   * @param {string} instanceId - Instance ID
   * @param {boolean} visible - Visibility state
   */
  async setVisibility(instanceId, visible) {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Widget instance not found: ${instanceId}`);
    }

    const oldVisible = instance.visible;
    instance.visible = visible;
    instance.lastUpdated = new Date();

    try {
      await this._sendToDevice('widget:setVisibility', {
        instanceId,
        visible
      });

      this.emit('instanceVisibilityChanged', instance);
    } catch (error) {
      instance.visible = oldVisible;
      throw new Error(`Failed to update widget visibility on device: ${error.message}`);
    }
  }

  /**
   * Bring widget to front
   * @param {string} instanceId - Instance ID
   */
  async bringToFront(instanceId) {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Widget instance not found: ${instanceId}`);
    }

    const oldZIndex = instance.zIndex;
    instance.zIndex = this._getNextZIndex();

    try {
      await this._sendToDevice('widget:bringToFront', {
        instanceId,
        zIndex: instance.zIndex
      });

      this.emit('instanceZIndexChanged', instance);
    } catch (error) {
      instance.zIndex = oldZIndex;
      throw new Error(`Failed to update widget z-index on device: ${error.message}`);
    }
  }

  /**
   * Send command to R1 device via WebSocket
   * @private
   */
  _sendToDevice(event, data) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error('Not connected to device'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Device command timeout'));
      }, 5000);

      this.socket.emit(event, {
        deviceId: this.deviceId,
        ...data
      }, (response) => {
        clearTimeout(timeout);
        if (response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response.error || 'Device command failed'));
        }
      });
    });
  }

  /**
   * Get widget instance
   * @param {string} instanceId - Instance ID
   * @returns {Object|null} Widget instance or null
   */
  getInstance(instanceId) {
    return this.instances.get(instanceId) || null;
  }

  /**
   * Get all widget instances
   * @returns {Object[]} Array of all widget instances
   */
  getAllInstances() {
    return Array.from(this.instances.values());
  }

  /**
   * Get instances by widget type
   * @param {string} widgetId - Widget definition ID
   * @returns {Object[]} Array of instances for the widget type
   */
  getInstancesByWidget(widgetId) {
    return this.getAllInstances().filter(instance => instance.widgetId === widgetId);
  }

  /**
   * Get visible instances
   * @returns {Object[]} Array of visible widget instances
   */
  getVisibleInstances() {
    return this.getAllInstances()
      .filter(instance => instance.visible)
      .sort((a, b) => a.zIndex - b.zIndex);
  }

  /**
   * Validate configuration against JSON schema
   * @private
   */
  _validateConfig(config, schema) {
    // Basic validation - in a real implementation, use a JSON Schema validator
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in config)) {
          throw new Error(`Required configuration field missing: ${field}`);
        }
      }
    }
  }

  /**
   * Validate instance size against widget constraints
   * @private
   */
  _validateInstanceSize(instance, widgetDef) {
    const { width, height } = instance.position;

    if (widgetDef.minSize) {
      if (width < widgetDef.minSize.width || height < widgetDef.minSize.height) {
        throw new Error(`Widget size below minimum: ${widgetDef.minSize.width}x${widgetDef.minSize.height}`);
      }
    }

    if (widgetDef.maxSize) {
      if (width > widgetDef.maxSize.width || height > widgetDef.maxSize.height) {
        throw new Error(`Widget size above maximum: ${widgetDef.maxSize.width}x${widgetDef.maxSize.height}`);
      }
    }
  }

  /**
   * Get next z-index value
   * @private
   */
  _getNextZIndex() {
    const maxZ = Math.max(0, ...this.getAllInstances().map(i => i.zIndex || 0));
    return maxZ + 1;
  }

  /**
   * Get manager statistics
   * @returns {Object} Manager statistics
   */
  getStats() {
    const instances = this.getAllInstances();
    return {
      totalInstances: instances.length,
      visibleInstances: instances.filter(i => i.visible).length,
      instancesByWidget: instances.reduce((acc, instance) => {
        acc[instance.widgetId] = (acc[instance.widgetId] || 0) + 1;
        return acc;
      }, {}),
      deviceConnected: this.socket && this.socket.connected
    };
  }
}

export default WidgetManager;