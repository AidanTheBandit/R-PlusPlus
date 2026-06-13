/**
 * WidgetStore - Centralized state management for widgets on R1 device
 * Handles widget state, real-time updates, and data synchronization
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

class WidgetStore extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.widgets = new Map();
    this.globalState = {};
    this.subscriptions = new Map();
    
    this._setupSocketListeners();
  }

  /**
   * Initialize widget state
   * @param {string} instanceId - Widget instance ID
   * @param {Object} initialConfig - Initial widget configuration
   */
  initializeWidget(instanceId, initialConfig) {
    const widgetState = {
      instanceId,
      config: initialConfig,
      data: {},
      status: 'active',
      lastUpdated: new Date(),
      subscriptions: new Set()
    };

    this.widgets.set(instanceId, widgetState);
    this.emit('widgetInitialized', { instanceId, state: widgetState });
    
    console.log(`Widget state initialized: ${instanceId}`);
  }

  /**
   * Update widget configuration
   * @param {string} instanceId - Widget instance ID
   * @param {Object} newConfig - New configuration
   */
  updateWidgetConfig(instanceId, newConfig) {
    const widget = this.widgets.get(instanceId);
    if (!widget) {
      console.warn(`Widget not found for config update: ${instanceId}`);
      return;
    }

    widget.config = { ...widget.config, ...newConfig };
    widget.lastUpdated = new Date();

    this.emit('widgetConfigUpdated', { instanceId, config: widget.config });
    console.log(`Widget config updated: ${instanceId}`);
  }

  /**
   * Update widget data
   * @param {string} instanceId - Widget instance ID
   * @param {Object} newData - New data to merge
   */
  updateWidgetData(instanceId, newData) {
    const widget = this.widgets.get(instanceId);
    if (!widget) {
      console.warn(`Widget not found for data update: ${instanceId}`);
      return;
    }

    widget.data = { ...widget.data, ...newData };
    widget.lastUpdated = new Date();

    this.emit('widgetDataUpdated', { instanceId, data: widget.data });
  }

  /**
   * Set widget data (replace existing data)
   * @param {string} instanceId - Widget instance ID
   * @param {Object} data - New data to set
   */
  setWidgetData(instanceId, data) {
    const widget = this.widgets.get(instanceId);
    if (!widget) {
      console.warn(`Widget not found for data set: ${instanceId}`);
      return;
    }

    widget.data = data;
    widget.lastUpdated = new Date();

    this.emit('widgetDataUpdated', { instanceId, data: widget.data });
  }

  /**
   * Remove widget from store
   * @param {string} instanceId - Widget instance ID
   */
  removeWidget(instanceId) {
    const widget = this.widgets.get(instanceId);
    if (!widget) {
      return;
    }

    // Clean up subscriptions
    widget.subscriptions.forEach(subscription => {
      this._unsubscribeFromDataSource(instanceId, subscription);
    });

    this.widgets.delete(instanceId);
    this.emit('widgetRemoved', { instanceId });
    
    console.log(`Widget removed from store: ${instanceId}`);
  }

  /**
   * Get widget state
   * @param {string} instanceId - Widget instance ID
   * @returns {Object|null} Widget state or null if not found
   */
  getWidgetState(instanceId) {
    return this.widgets.get(instanceId) || null;
  }

  /**
   * Get widget data
   * @param {string} instanceId - Widget instance ID
   * @returns {Object} Widget data
   */
  getWidgetData(instanceId) {
    const widget = this.widgets.get(instanceId);
    return widget ? widget.data : {};
  }

  /**
   * Get widget configuration
   * @param {string} instanceId - Widget instance ID
   * @returns {Object} Widget configuration
   */
  getWidgetConfig(instanceId) {
    const widget = this.widgets.get(instanceId);
    return widget ? widget.config : {};
  }

  /**
   * Subscribe widget to data source
   * @param {string} instanceId - Widget instance ID
   * @param {string} dataSource - Data source identifier
   * @param {Object} options - Subscription options
   */
  subscribeToDataSource(instanceId, dataSource, options = {}) {
    const widget = this.widgets.get(instanceId);
    if (!widget) {
      console.warn(`Widget not found for subscription: ${instanceId}`);
      return;
    }

    const subscriptionKey = `${instanceId}:${dataSource}`;
    
    // Add to widget subscriptions
    widget.subscriptions.add(dataSource);

    // Add to global subscriptions map
    if (!this.subscriptions.has(dataSource)) {
      this.subscriptions.set(dataSource, new Set());
    }
    this.subscriptions.get(dataSource).add(instanceId);

    // Request data source subscription via socket
    if (this.socket && this.socket.connected) {
      this.socket.emit('widget:subscribe', {
        instanceId,
        dataSource,
        options
      });
    }

    console.log(`Widget subscribed to data source: ${instanceId} -> ${dataSource}`);
  }

  /**
   * Unsubscribe widget from data source
   * @param {string} instanceId - Widget instance ID
   * @param {string} dataSource - Data source identifier
   */
  unsubscribeFromDataSource(instanceId, dataSource) {
    this._unsubscribeFromDataSource(instanceId, dataSource);
  }

  /**
   * Internal unsubscribe method
   * @private
   */
  _unsubscribeFromDataSource(instanceId, dataSource) {
    const widget = this.widgets.get(instanceId);
    if (widget) {
      widget.subscriptions.delete(dataSource);
    }

    // Remove from global subscriptions
    if (this.subscriptions.has(dataSource)) {
      this.subscriptions.get(dataSource).delete(instanceId);
      if (this.subscriptions.get(dataSource).size === 0) {
        this.subscriptions.delete(dataSource);
      }
    }

    // Notify server via socket
    if (this.socket && this.socket.connected) {
      this.socket.emit('widget:unsubscribe', {
        instanceId,
        dataSource
      });
    }

    console.log(`Widget unsubscribed from data source: ${instanceId} -> ${dataSource}`);
  }

  /**
   * Update global state
   * @param {Object} newState - New global state data
   */
  updateGlobalState(newState) {
    this.globalState = { ...this.globalState, ...newState };
    this.emit('globalStateUpdated', this.globalState);
  }

  /**
   * Get global state
   * @returns {Object} Global state
   */
  getGlobalState() {
    return this.globalState;
  }

  /**
   * Setup socket event listeners for real-time updates
   * @private
   */
  _setupSocketListeners() {
    if (!this.socket) return;

    // Handle widget data updates from server
    this.socket.on('widget:dataUpdate', (data) => {
      const { instanceId, update } = data;
      this.updateWidgetData(instanceId, update);
    });

    // Handle widget configuration updates from control panel
    this.socket.on('widget:configUpdate', (data) => {
      const { instanceId, config } = data;
      this.updateWidgetConfig(instanceId, config);
    });

    // Handle global state updates
    this.socket.on('widget:globalStateUpdate', (data) => {
      this.updateGlobalState(data);
    });

    // Handle data source broadcasts
    this.socket.on('widget:dataSourceUpdate', (data) => {
      const { dataSource, update } = data;
      
      // Update all widgets subscribed to this data source
      if (this.subscriptions.has(dataSource)) {
        this.subscriptions.get(dataSource).forEach(instanceId => {
          this.updateWidgetData(instanceId, { [dataSource]: update });
        });
      }
    });

    // Handle reconnection
    this.socket.on('connect', () => {
      console.log('Widget store reconnected to server');
      this._resubscribeAll();
    });

    this.socket.on('disconnect', () => {
      console.log('Widget store disconnected from server');
    });
  }

  /**
   * Resubscribe all widgets to their data sources after reconnection
   * @private
   */
  _resubscribeAll() {
    this.widgets.forEach((widget, instanceId) => {
      widget.subscriptions.forEach(dataSource => {
        this.socket.emit('widget:subscribe', {
          instanceId,
          dataSource,
          options: {}
        });
      });
    });
  }

  /**
   * Get store statistics
   * @returns {Object} Store statistics
   */
  getStats() {
    return {
      totalWidgets: this.widgets.size,
      totalSubscriptions: Array.from(this.subscriptions.values())
        .reduce((sum, set) => sum + set.size, 0),
      dataSourcesActive: this.subscriptions.size,
      socketConnected: this.socket && this.socket.connected
    };
  }

  /**
   * Clear all widget data (for cleanup)
   */
  clear() {
    // Unsubscribe all widgets
    this.widgets.forEach((widget, instanceId) => {
      widget.subscriptions.forEach(dataSource => {
        this._unsubscribeFromDataSource(instanceId, dataSource);
      });
    });

    this.widgets.clear();
    this.subscriptions.clear();
    this.globalState = {};
    
    this.emit('storeCleared');
    console.log('Widget store cleared');
  }
}

export default WidgetStore;