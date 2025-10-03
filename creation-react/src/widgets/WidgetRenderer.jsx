/**
 * WidgetRenderer - Renders widgets on R1 device display
 * Handles widget display, positioning, and real-time updates from control panel
 */

import React, { Component } from 'react';
import BaseWidget from './BaseWidget';
import './WidgetRenderer.css';

class WidgetRenderer extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      widgets: new Map(),
      widgetComponents: new Map()
    };

    this.containerRef = React.createRef();
  }

  componentDidMount() {
    this.setupSocketListeners();
  }

  componentWillUnmount() {
    this.cleanupSocketListeners();
  }

  /**
   * Setup WebSocket listeners for widget commands from control panel
   */
  setupSocketListeners() {
    const { socket } = this.props;
    if (!socket) return;

    // Handle widget creation from control panel
    socket.on('widget:create', this.handleWidgetCreate);
    
    // Handle widget removal
    socket.on('widget:remove', this.handleWidgetRemove);
    
    // Handle widget configuration updates
    socket.on('widget:updateConfig', this.handleWidgetConfigUpdate);
    
    // Handle widget position updates
    socket.on('widget:updatePosition', this.handleWidgetPositionUpdate);
    
    // Handle widget visibility changes
    socket.on('widget:setVisibility', this.handleWidgetVisibilityChange);
    
    // Handle widget z-index changes
    socket.on('widget:bringToFront', this.handleWidgetBringToFront);
  }

  /**
   * Cleanup WebSocket listeners
   */
  cleanupSocketListeners() {
    const { socket } = this.props;
    if (!socket) return;

    socket.off('widget:create', this.handleWidgetCreate);
    socket.off('widget:remove', this.handleWidgetRemove);
    socket.off('widget:updateConfig', this.handleWidgetConfigUpdate);
    socket.off('widget:updatePosition', this.handleWidgetPositionUpdate);
    socket.off('widget:setVisibility', this.handleWidgetVisibilityChange);
    socket.off('widget:bringToFront', this.handleWidgetBringToFront);
  }

  /**
   * Handle widget creation command from control panel
   */
  handleWidgetCreate = (data, callback) => {
    try {
      const { instanceId, widgetId, config, position, visible, zIndex } = data;
      
      // Get widget component from registry
      const WidgetComponent = this.getWidgetComponent(widgetId);
      if (!WidgetComponent) {
        throw new Error(`Widget component not found: ${widgetId}`);
      }

      // Create widget instance data
      const widget = {
        instanceId,
        widgetId,
        config,
        position,
        visible,
        zIndex,
        component: WidgetComponent
      };

      // Add to state
      this.setState(prevState => {
        const newWidgets = new Map(prevState.widgets);
        newWidgets.set(instanceId, widget);
        return { widgets: newWidgets };
      });

      // Initialize widget in store
      if (this.props.store) {
        this.props.store.initializeWidget(instanceId, config);
      }

      console.log(`Widget created on device: ${instanceId}`);
      
      if (callback) {
        callback({ success: true, data: { instanceId } });
      }
    } catch (error) {
      console.error('Failed to create widget:', error);
      if (callback) {
        callback({ success: false, error: error.message });
      }
    }
  };

  /**
   * Handle widget removal command
   */
  handleWidgetRemove = (data, callback) => {
    try {
      const { instanceId } = data;
      
      // Remove from state
      this.setState(prevState => {
        const newWidgets = new Map(prevState.widgets);
        newWidgets.delete(instanceId);
        return { widgets: newWidgets };
      });

      // Remove from store
      if (this.props.store) {
        this.props.store.removeWidget(instanceId);
      }

      console.log(`Widget removed from device: ${instanceId}`);
      
      if (callback) {
        callback({ success: true });
      }
    } catch (error) {
      console.error('Failed to remove widget:', error);
      if (callback) {
        callback({ success: false, error: error.message });
      }
    }
  };

  /**
   * Handle widget configuration update
   */
  handleWidgetConfigUpdate = (data, callback) => {
    try {
      const { instanceId, config } = data;
      
      this.setState(prevState => {
        const newWidgets = new Map(prevState.widgets);
        const widget = newWidgets.get(instanceId);
        if (widget) {
          widget.config = { ...widget.config, ...config };
          newWidgets.set(instanceId, widget);
        }
        return { widgets: newWidgets };
      });

      // Update store
      if (this.props.store) {
        this.props.store.updateWidgetConfig(instanceId, config);
      }

      if (callback) {
        callback({ success: true });
      }
    } catch (error) {
      console.error('Failed to update widget config:', error);
      if (callback) {
        callback({ success: false, error: error.message });
      }
    }
  };

  /**
   * Handle widget position update
   */
  handleWidgetPositionUpdate = (data, callback) => {
    try {
      const { instanceId, position } = data;
      
      this.setState(prevState => {
        const newWidgets = new Map(prevState.widgets);
        const widget = newWidgets.get(instanceId);
        if (widget) {
          widget.position = { ...widget.position, ...position };
          newWidgets.set(instanceId, widget);
        }
        return { widgets: newWidgets };
      });

      if (callback) {
        callback({ success: true });
      }
    } catch (error) {
      console.error('Failed to update widget position:', error);
      if (callback) {
        callback({ success: false, error: error.message });
      }
    }
  };

  /**
   * Handle widget visibility change
   */
  handleWidgetVisibilityChange = (data, callback) => {
    try {
      const { instanceId, visible } = data;
      
      this.setState(prevState => {
        const newWidgets = new Map(prevState.widgets);
        const widget = newWidgets.get(instanceId);
        if (widget) {
          widget.visible = visible;
          newWidgets.set(instanceId, widget);
        }
        return { widgets: newWidgets };
      });

      if (callback) {
        callback({ success: true });
      }
    } catch (error) {
      console.error('Failed to update widget visibility:', error);
      if (callback) {
        callback({ success: false, error: error.message });
      }
    }
  };

  /**
   * Handle widget bring to front
   */
  handleWidgetBringToFront = (data, callback) => {
    try {
      const { instanceId, zIndex } = data;
      
      this.setState(prevState => {
        const newWidgets = new Map(prevState.widgets);
        const widget = newWidgets.get(instanceId);
        if (widget) {
          widget.zIndex = zIndex;
          newWidgets.set(instanceId, widget);
        }
        return { widgets: newWidgets };
      });

      if (callback) {
        callback({ success: true });
      }
    } catch (error) {
      console.error('Failed to update widget z-index:', error);
      if (callback) {
        callback({ success: false, error: error.message });
      }
    }
  };

  /**
   * Get widget component class by widget ID
   */
  getWidgetComponent(widgetId) {
    // This would normally look up registered widget components
    // For now, return a default widget component
    return this.createDefaultWidget(widgetId);
  }

  /**
   * Create a default widget component for testing
   */
  createDefaultWidget(widgetId) {
    return class DefaultWidget extends BaseWidget {
      renderContent() {
        return (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: '14px', marginBottom: '8px' }}>
              {widgetId}
            </div>
            <div style={{ fontSize: '10px', color: '#928374' }}>
              Widget ID: {this.props.instanceId}
            </div>
            <div style={{ fontSize: '10px', color: '#928374', marginTop: '4px' }}>
              {JSON.stringify(this.props.config, null, 2)}
            </div>
          </div>
        );
      }
    };
  }

  /**
   * Render all widgets
   */
  renderWidgets() {
    const widgets = Array.from(this.state.widgets.values());
    
    return widgets.map(widget => {
      const WidgetComponent = widget.component;
      
      return (
        <WidgetComponent
          key={widget.instanceId}
          instanceId={widget.instanceId}
          widgetId={widget.widgetId}
          config={widget.config}
          position={widget.position}
          visible={widget.visible}
          zIndex={widget.zIndex}
          store={this.props.store}
        />
      );
    });
  }

  render() {
    return (
      <div 
        ref={this.containerRef}
        className="widget-renderer"
      >
        {this.renderWidgets()}
      </div>
    );
  }
}

export default WidgetRenderer;