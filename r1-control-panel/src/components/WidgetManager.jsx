/**
 * WidgetManager - Control panel component for managing R1 device widgets
 * Allows users to add, configure, and manage widgets on their R1 device
 */

import React, { useState, useEffect } from 'react';
import { WidgetRegistry, WidgetManager as WidgetManagerCore } from '../widgets';
import './WidgetManager.css';

const WidgetManager = ({ socket, deviceId, pinCode }) => {
  const [widgetRegistry] = useState(() => new WidgetRegistry());
  const [widgetManager, setWidgetManager] = useState(null);
  const [activeWidgets, setActiveWidgets] = useState([]);
  const [availableWidgets, setAvailableWidgets] = useState([]);
  const [selectedWidget, setSelectedWidget] = useState(null);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Initialize widget manager when socket is available
  useEffect(() => {
    if (socket && deviceId) {
      const manager = new WidgetManagerCore(widgetRegistry, socket);
      manager.setDeviceId(deviceId);
      setWidgetManager(manager);

      // Listen for widget events
      manager.on('instanceCreated', (instance) => {
        setActiveWidgets(prev => [...prev, instance]);
      });

      manager.on('instanceRemoved', (data) => {
        setActiveWidgets(prev => prev.filter(w => w.id !== data.id));
      });

      manager.on('instanceConfigUpdated', (instance) => {
        setActiveWidgets(prev => prev.map(w => w.id === instance.id ? instance : w));
      });

      setIsConnected(true);
    }

    return () => {
      if (widgetManager) {
        widgetManager.removeAllListeners();
      }
    };
  }, [socket, deviceId, widgetRegistry]);

  // Register sample widgets
  useEffect(() => {
    // Register some sample widgets
    const sampleWidgets = [
      {
        id: 'clock-widget',
        name: 'Digital Clock',
        description: 'Shows current time and date',
        category: 'monitoring',
        component: 'ClockWidget',
        defaultSize: { width: 200, height: 100 },
        minSize: { width: 150, height: 80 },
        maxSize: { width: 300, height: 150 },
        configSchema: {
          type: 'object',
          properties: {
            format24h: {
              type: 'boolean',
              default: true,
              title: '24-hour format'
            },
            showSeconds: {
              type: 'boolean',
              default: false,
              title: 'Show seconds'
            },
            timezone: {
              type: 'string',
              default: 'local',
              title: 'Timezone'
            }
          }
        },
        defaultConfig: {
          format24h: true,
          showSeconds: false,
          timezone: 'local'
        }
      },
      {
        id: 'weather-widget',
        name: 'Weather',
        description: 'Current weather conditions',
        category: 'monitoring',
        component: 'WeatherWidget',
        defaultSize: { width: 200, height: 150 },
        configSchema: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              default: 'auto',
              title: 'Location'
            },
            units: {
              type: 'string',
              enum: ['metric', 'imperial'],
              default: 'metric',
              title: 'Units'
            }
          }
        },
        defaultConfig: {
          location: 'auto',
          units: 'metric'
        }
      },
      {
        id: 'system-monitor',
        name: 'System Monitor',
        description: 'Device performance metrics',
        category: 'monitoring',
        component: 'SystemMonitorWidget',
        defaultSize: { width: 250, height: 200 },
        configSchema: {
          type: 'object',
          properties: {
            showCPU: {
              type: 'boolean',
              default: true,
              title: 'Show CPU usage'
            },
            showMemory: {
              type: 'boolean',
              default: true,
              title: 'Show memory usage'
            },
            refreshRate: {
              type: 'integer',
              minimum: 1000,
              maximum: 10000,
              default: 2000,
              title: 'Refresh rate (ms)'
            }
          }
        },
        defaultConfig: {
          showCPU: true,
          showMemory: true,
          refreshRate: 2000
        }
      },
      {
        id: 'quick-actions',
        name: 'Quick Actions',
        description: 'Customizable action buttons',
        category: 'control',
        component: 'QuickActionsWidget',
        defaultSize: { width: 200, height: 100 },
        configSchema: {
          type: 'object',
          properties: {
            actions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string' },
                  action: { type: 'string' },
                  icon: { type: 'string' }
                }
              },
              default: [
                { label: 'Voice', action: 'voice', icon: '🎤' },
                { label: 'Camera', action: 'camera', icon: '📷' }
              ],
              title: 'Action buttons'
            }
          }
        },
        defaultConfig: {
          actions: [
            { label: 'Voice', action: 'voice', icon: '🎤' },
            { label: 'Camera', action: 'camera', icon: '📷' }
          ]
        }
      }
    ];

    sampleWidgets.forEach(widget => {
      try {
        widgetRegistry.register(widget);
      } catch (error) {
        console.warn(`Failed to register widget ${widget.id}:`, error);
      }
    });

    setAvailableWidgets(widgetRegistry.getAllWidgets());
  }, [widgetRegistry]);

  const handleAddWidget = async (widgetId) => {
    if (!widgetManager) return;

    try {
      const widget = widgetRegistry.getWidget(widgetId);
      const instanceId = await widgetManager.createInstance(
        widgetId,
        widget.defaultConfig,
        {
          x: Math.random() * 200,
          y: Math.random() * 200,
          width: widget.defaultSize.width,
          height: widget.defaultSize.height
        }
      );
      
      console.log(`Widget added: ${instanceId}`);
      setShowAddWidget(false);
    } catch (error) {
      console.error('Failed to add widget:', error);
      alert(`Failed to add widget: ${error.message}`);
    }
  };

  const handleRemoveWidget = async (instanceId) => {
    if (!widgetManager) return;

    try {
      await widgetManager.removeInstance(instanceId);
      console.log(`Widget removed: ${instanceId}`);
    } catch (error) {
      console.error('Failed to remove widget:', error);
      alert(`Failed to remove widget: ${error.message}`);
    }
  };

  const handleConfigureWidget = (widget) => {
    setSelectedWidget(widget);
  };

  const handleUpdateConfig = async (instanceId, newConfig) => {
    if (!widgetManager) return;

    try {
      await widgetManager.updateConfig(instanceId, newConfig);
      console.log(`Widget config updated: ${instanceId}`);
      setSelectedWidget(null);
    } catch (error) {
      console.error('Failed to update widget config:', error);
      alert(`Failed to update widget: ${error.message}`);
    }
  };

  if (!isConnected) {
    return (
      <div className="widget-manager">
        <div className="connection-status">
          <div className="status-icon">🔌</div>
          <div className="status-text">
            <h3>Connecting to R1 Device...</h3>
            <p>Please wait while we establish connection to your R1 device.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="widget-manager">
      <div className="widget-manager-header">
        <h2>Widget Manager</h2>
        <p>Customize your R1 device with interactive widgets</p>
        <button 
          className="add-widget-btn"
          onClick={() => setShowAddWidget(true)}
        >
          + Add Widget
        </button>
      </div>

      {/* Active Widgets */}
      <div className="widget-section">
        <h3>Active Widgets ({activeWidgets.length})</h3>
        {activeWidgets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📱</div>
            <p>No widgets active on your R1 device</p>
            <button 
              className="add-first-widget-btn"
              onClick={() => setShowAddWidget(true)}
            >
              Add Your First Widget
            </button>
          </div>
        ) : (
          <div className="widget-grid">
            {activeWidgets.map(widget => (
              <div key={widget.id} className="widget-card">
                <div className="widget-card-header">
                  <h4>{widgetRegistry.getWidget(widget.widgetId)?.name || widget.widgetId}</h4>
                  <div className="widget-actions">
                    <button 
                      className="config-btn"
                      onClick={() => handleConfigureWidget(widget)}
                      title="Configure"
                    >
                      ⚙️
                    </button>
                    <button 
                      className="remove-btn"
                      onClick={() => handleRemoveWidget(widget.id)}
                      title="Remove"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                <div className="widget-info">
                  <div className="widget-size">
                    {widget.position.width}×{widget.position.height}px
                  </div>
                  <div className="widget-position">
                    Position: ({Math.round(widget.position.x)}, {Math.round(widget.position.y)})
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Widget Modal */}
      {showAddWidget && (
        <div className="modal-overlay" onClick={() => setShowAddWidget(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Widget</h3>
              <button 
                className="close-btn"
                onClick={() => setShowAddWidget(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-content">
              <div className="available-widgets">
                {availableWidgets.map(widget => (
                  <div key={widget.id} className="available-widget">
                    <div className="widget-info">
                      <h4>{widget.name}</h4>
                      <p>{widget.description}</p>
                      <div className="widget-meta">
                        <span className="widget-category">{widget.category}</span>
                        <span className="widget-size">
                          {widget.defaultSize.width}×{widget.defaultSize.height}
                        </span>
                      </div>
                    </div>
                    <button 
                      className="add-btn"
                      onClick={() => handleAddWidget(widget.id)}
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Widget Configuration Modal */}
      {selectedWidget && (
        <div className="modal-overlay" onClick={() => setSelectedWidget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Configure Widget</h3>
              <button 
                className="close-btn"
                onClick={() => setSelectedWidget(null)}
              >
                ×
              </button>
            </div>
            <div className="modal-content">
              <WidgetConfigForm
                widget={selectedWidget}
                widgetDef={widgetRegistry.getWidget(selectedWidget.widgetId)}
                onSave={(config) => handleUpdateConfig(selectedWidget.id, config)}
                onCancel={() => setSelectedWidget(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Widget configuration form component
const WidgetConfigForm = ({ widget, widgetDef, onSave, onCancel }) => {
  const [config, setConfig] = useState(widget.config || {});

  const handleInputChange = (key, value) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(config);
  };

  if (!widgetDef || !widgetDef.configSchema) {
    return (
      <div className="config-form">
        <p>No configuration options available for this widget.</p>
        <div className="form-actions">
          <button type="button" onClick={onCancel}>Close</button>
        </div>
      </div>
    );
  }

  const { properties } = widgetDef.configSchema;

  return (
    <form className="config-form" onSubmit={handleSubmit}>
      {Object.entries(properties).map(([key, schema]) => (
        <div key={key} className="form-field">
          <label htmlFor={key}>{schema.title || key}</label>
          {schema.type === 'boolean' ? (
            <input
              type="checkbox"
              id={key}
              checked={config[key] || false}
              onChange={(e) => handleInputChange(key, e.target.checked)}
            />
          ) : schema.type === 'integer' || schema.type === 'number' ? (
            <input
              type="number"
              id={key}
              value={config[key] || schema.default || 0}
              min={schema.minimum}
              max={schema.maximum}
              onChange={(e) => handleInputChange(key, parseInt(e.target.value))}
            />
          ) : schema.enum ? (
            <select
              id={key}
              value={config[key] || schema.default || ''}
              onChange={(e) => handleInputChange(key, e.target.value)}
            >
              {schema.enum.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              id={key}
              value={config[key] || schema.default || ''}
              onChange={(e) => handleInputChange(key, e.target.value)}
            />
          )}
        </div>
      ))}
      <div className="form-actions">
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="submit">Save Changes</button>
      </div>
    </form>
  );
};

export default WidgetManager;