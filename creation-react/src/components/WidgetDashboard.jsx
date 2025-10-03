/**
 * WidgetDashboard - Minimal widget interface optimized for R1's 240x282 display
 * Clean, swipeable interface with maximum screen real estate for widgets
 */

import React, { useState, useEffect, useRef } from 'react';
import { WidgetRenderer, WidgetStore } from '../widgets';
import './WidgetDashboard.css';

const WidgetDashboard = ({ socket, isConnected, deviceId, deviceInfo, onChangePin, onTogglePin }) => {
  const [widgetStore] = useState(() => new WidgetStore(socket));
  const [currentView, setCurrentView] = useState(0); // 0 = widgets, 1 = menu, 2 = console
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const dashboardRef = useRef(null);

  // No need for separate device registration - it's handled by useSocket hook

  // Handle touch events for swiping (only horizontal)
  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
  };

  const onTouchMove = (e) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = Math.abs(touchStart.y - touchEnd.y);
    
    // Only handle horizontal swipes (ignore if vertical movement is too large)
    if (distanceY > 50) return;
    
    const isLeftSwipe = distanceX > 50;
    const isRightSwipe = distanceX < -50;

    if (isLeftSwipe && currentView === 0) {
      setCurrentView(1); // Swipe left to menu
    }
    if (isRightSwipe && currentView >= 1) {
      setCurrentView(Math.max(0, currentView - 1)); // Swipe right to go back
    }
  };

  // Handle PIN management using passed functions
  const handleChangePIN = () => {
    if (onChangePin) {
      onChangePin();
    } else {
      alert('PIN management not available');
    }
  };

  const handleTogglePIN = () => {
    if (onTogglePin) {
      onTogglePin();
    } else {
      alert('PIN management not available');
    }
  };

  return (
    <div 
      className="widget-dashboard"
      ref={dashboardRef}
    >
      <div 
        className={`dashboard-container view-${currentView}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Main Widget View */}
        <div className="widget-view">
          <div className="widget-grid">
            <WidgetRenderer 
              socket={socket}
              store={widgetStore}
            />
            
            {/* Placeholder when no widgets */}
            <div className="no-widgets-message">
              <div className="no-widgets-text">
                Swipe left for menu
              </div>
            </div>
          </div>
        </div>

        {/* Menu View */}
        <div className="menu-view">
          <div className="menu-header">
            <h3>R1 Menu</h3>
          </div>
          <div className="menu-items">
            <button className="menu-item" onClick={() => setCurrentView(0)}>
              <span className="menu-icon">📱</span>
              <span className="menu-label">Widgets</span>
            </button>
            <button className="menu-item" onClick={() => setCurrentView(2)}>
              <span className="menu-icon">🖥️</span>
              <span className="menu-label">Console</span>
            </button>
            <button className="menu-item">
              <span className="menu-icon">⚙️</span>
              <span className="menu-label">Settings</span>
            </button>
          </div>
          
          <div className="device-info">
            <div className="device-section">
              <h4>Device Info</h4>
              <div className="device-details">
                <div className="detail-row">
                  <span className="detail-label">ID:</span>
                  <span className="detail-value device-id">
                    {deviceId || 'Unknown'}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Status:</span>
                  <span className={`detail-value ${isConnected ? 'connected' : 'disconnected'}`}>
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">PIN:</span>
                  <span className="detail-value">
                    {deviceInfo?.pinEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="pin-section">
              <h4>PIN Management</h4>
              <div className="pin-controls">
                <button className="pin-btn" onClick={handleChangePIN}>
                  <span className="pin-icon">🔒</span>
                  <span className="pin-text">Change PIN</span>
                </button>
                <button className="pin-btn" onClick={handleTogglePIN}>
                  <span className="pin-icon">{deviceInfo?.pinEnabled ? '🔓' : '🔒'}</span>
                  <span className="pin-text">
                    {deviceInfo?.pinEnabled ? 'Disable PIN' : 'Enable PIN'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Console View */}
        <div className="console-view">
          <div className="console-header">
            <h3>R1 Console</h3>
            <button className="back-btn" onClick={() => setCurrentView(1)}>
              ← Back
            </button>
          </div>
          <div className="console-content">
            <div className="console-info">
              <div className="info-row">
                <span className="info-label">Device ID:</span>
                <span className="info-value device-id">{deviceId || 'Unknown'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Connection:</span>
                <span className={`info-value ${isConnected ? 'connected' : 'disconnected'}`}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Widgets:</span>
                <span className="info-value">0 active</span>
              </div>
              <div className="info-row">
                <span className="info-label">PIN Status:</span>
                <span className="info-value">
                  {deviceInfo?.pinEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Minimal swipe indicator */}
      <div className="swipe-indicator">
        <div className={`indicator-dot ${currentView === 0 ? 'active' : ''}`}></div>
        <div className={`indicator-dot ${currentView === 1 ? 'active' : ''}`}></div>
        <div className={`indicator-dot ${currentView === 2 ? 'active' : ''}`}></div>
      </div>
    </div>
  );
};

export default WidgetDashboard;