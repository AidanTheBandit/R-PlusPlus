/**
 * WidgetDashboard - Minimal widget interface optimized for R1's 240x282 display
 * Clean, swipeable interface with maximum screen real estate for widgets
 */

import React, { useState, useEffect, useRef } from 'react';
import { WidgetRenderer, WidgetStore } from '../widgets';
import './WidgetDashboard.css';

const WidgetDashboard = ({ socket, isConnected }) => {
  const [widgetStore] = useState(() => new WidgetStore(socket));
  const [currentView, setCurrentView] = useState(0); // 0 = widgets, 1 = menu
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const dashboardRef = useRef(null);

  // Register device with backend when connected
  useEffect(() => {
    if (socket && isConnected) {
      socket.emit('device:register', { 
        deviceId: socket._deviceId || 'unknown',
        type: 'r1-device'
      });
    }
  }, [socket, isConnected]);

  // Handle touch events for swiping
  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && currentView === 0) {
      setCurrentView(1); // Swipe left to menu
    }
    if (isRightSwipe && currentView === 1) {
      setCurrentView(0); // Swipe right to widgets
    }
  };

  return (
    <div 
      className="widget-dashboard"
      ref={dashboardRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className={`dashboard-container view-${currentView}`}>
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
            <button className="menu-item">
              <span className="menu-icon">🖥️</span>
              <span className="menu-label">Console</span>
            </button>
            <button className="menu-item">
              <span className="menu-icon">⚙️</span>
              <span className="menu-label">Settings</span>
            </button>
            <div className="menu-info">
              <div className="info-item">
                <span className="info-label">Device:</span>
                <span className="info-value">{socket?._deviceId?.slice(-8) || 'Unknown'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Status:</span>
                <span className={`info-value ${isConnected ? 'connected' : 'disconnected'}`}>
                  {isConnected ? 'Connected' : 'Disconnected'}
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
      </div>
    </div>
  );
};

export default WidgetDashboard;