/**
 * BaseWidget - Base React component for all widgets on R1 device
 * Provides common functionality, lifecycle management, and standardized interface
 */

import React, { Component } from 'react';
import './BaseWidget.css';

class BaseWidget extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      data: {},
      loading: false,
      error: null,
      lastUpdated: null
    };

    this.widgetRef = React.createRef();
    this.updateInterval = null;
  }

  componentDidMount() {
    this.initialize();
    this.setupAutoRefresh();
    this.subscribeToStore();
  }

  componentDidUpdate(prevProps) {
    // Handle configuration changes
    if (JSON.stringify(prevProps.config) !== JSON.stringify(this.props.config)) {
      this.onConfigChanged(prevProps.config, this.props.config);
    }

    // Handle position changes
    if (JSON.stringify(prevProps.position) !== JSON.stringify(this.props.position)) {
      this.onPositionChanged(prevProps.position, this.props.position);
    }

    // Handle visibility changes
    if (prevProps.visible !== this.props.visible) {
      this.onVisibilityChanged(this.props.visible);
    }
  }

  componentWillUnmount() {
    this.cleanup();
    this.clearAutoRefresh();
    this.unsubscribeFromStore();
  }

  /**
   * Initialize widget - override in child components
   */
  initialize() {
    console.log(`Widget initialized: ${this.props.instanceId}`);
  }

  /**
   * Cleanup widget resources - override in child components
   */
  cleanup() {
    console.log(`Widget cleanup: ${this.props.instanceId}`);
  }

  /**
   * Handle configuration changes - override in child components
   */
  onConfigChanged(oldConfig, newConfig) {
    console.log(`Widget config changed: ${this.props.instanceId}`, { oldConfig, newConfig });
  }

  /**
   * Handle position changes - override in child components
   */
  onPositionChanged(oldPosition, newPosition) {
    console.log(`Widget position changed: ${this.props.instanceId}`, { oldPosition, newPosition });
  }

  /**
   * Handle visibility changes - override in child components
   */
  onVisibilityChanged(visible) {
    console.log(`Widget visibility changed: ${this.props.instanceId}`, visible);
  }

  /**
   * Update widget data
   */
  updateData(newData) {
    this.setState(prevState => ({
      data: { ...prevState.data, ...newData },
      lastUpdated: new Date()
    }));
  }

  /**
   * Set loading state
   */
  setLoading(loading) {
    this.setState({ loading });
  }

  /**
   * Set error state
   */
  setError(error) {
    this.setState({ 
      error: error ? error.message || error : null,
      loading: false
    });
  }

  /**
   * Clear error state
   */
  clearError() {
    this.setState({ error: null });
  }

  /**
   * Setup automatic refresh based on configuration
   */
  setupAutoRefresh() {
    const refreshInterval = this.props.config?.refreshInterval;
    if (refreshInterval && refreshInterval > 0) {
      this.updateInterval = setInterval(() => {
        this.refresh();
      }, refreshInterval);
    }
  }

  /**
   * Clear automatic refresh
   */
  clearAutoRefresh() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Refresh widget data - override in child components
   */
  refresh() {
    console.log(`Widget refresh: ${this.props.instanceId}`);
  }

  /**
   * Subscribe to widget store updates
   */
  subscribeToStore() {
    if (this.props.store) {
      this.props.store.on('widgetDataUpdated', this.handleStoreUpdate);
      this.props.store.on('widgetConfigUpdated', this.handleConfigUpdate);
    }
  }

  /**
   * Unsubscribe from widget store updates
   */
  unsubscribeFromStore() {
    if (this.props.store) {
      this.props.store.off('widgetDataUpdated', this.handleStoreUpdate);
      this.props.store.off('widgetConfigUpdated', this.handleConfigUpdate);
    }
  }

  /**
   * Handle store data updates
   */
  handleStoreUpdate = (event) => {
    if (event.instanceId === this.props.instanceId) {
      this.updateData(event.data);
    }
  };

  /**
   * Handle store config updates
   */
  handleConfigUpdate = (event) => {
    if (event.instanceId === this.props.instanceId) {
      // Config updates are handled by parent component re-rendering
      this.forceUpdate();
    }
  };

  /**
   * Get widget style based on position and visibility
   */
  getWidgetStyle() {
    const { position, visible, zIndex } = this.props;
    
    return {
      position: 'absolute',
      left: `${position.x}px`,
      top: `${position.y}px`,
      width: `${position.width}px`,
      height: `${position.height}px`,
      zIndex: zIndex || 1,
      display: visible ? 'block' : 'none',
      ...this.getCustomStyle()
    };
  }

  /**
   * Get custom styling - override in child components
   */
  getCustomStyle() {
    return {};
  }

  /**
   * Render error state
   */
  renderError() {
    return (
      <div className="widget-error">
        <div className="widget-error-icon">⚠️</div>
        <div className="widget-error-message">{this.state.error}</div>
        <button 
          className="widget-error-retry"
          onClick={() => {
            this.clearError();
            this.refresh();
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  /**
   * Render loading state
   */
  renderLoading() {
    return (
      <div className="widget-loading">
        <div className="widget-loading-spinner"></div>
        <div className="widget-loading-text">Loading...</div>
      </div>
    );
  }

  /**
   * Render widget header with title and controls
   */
  renderHeader() {
    const title = this.props.config?.title || 'Widget';
    
    return (
      <div className="widget-header">
        <div className="widget-title">{title}</div>
        <div className="widget-controls">
          {this.renderCustomControls()}
        </div>
      </div>
    );
  }

  /**
   * Render custom controls - override in child components
   */
  renderCustomControls() {
    return null;
  }

  /**
   * Render widget content - must be implemented by child components
   */
  renderContent() {
    throw new Error('renderContent() must be implemented by child components');
  }

  /**
   * Main render method
   */
  render() {
    const { instanceId, className = '' } = this.props;
    const { error, loading } = this.state;

    return (
      <div
        ref={this.widgetRef}
        className={`base-widget ${className}`}
        style={this.getWidgetStyle()}
        data-widget-id={instanceId}
      >
        {this.renderHeader()}
        <div className="widget-body">
          {error ? this.renderError() : 
           loading ? this.renderLoading() : 
           this.renderContent()}
        </div>
        {this.state.lastUpdated && (
          <div className="widget-footer">
            Last updated: {this.state.lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </div>
    );
  }
}

// Default props
BaseWidget.defaultProps = {
  config: {},
  position: { x: 0, y: 0, width: 200, height: 150 },
  visible: true,
  zIndex: 1
};

export default BaseWidget;