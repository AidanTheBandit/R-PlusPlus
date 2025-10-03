/**
 * PerformanceMonitor Component - Displays real-time performance metrics
 * Demonstrates the performance monitoring system integration
 */

import React, { useState, useEffect } from 'react';
import { 
  useComponentPerformance, 
  useMemoryMonitoring, 
  usePerformanceMetrics 
} from '../hooks/usePerformanceMonitoring';

const PerformanceMonitor = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [performanceData, setPerformanceData] = useState(null);

  // Use performance monitoring hooks
  const { recordRender, recordError, getComponentStats } = useComponentPerformance('PerformanceMonitor');
  const { memoryStats, startMonitoring, stopMonitoring, isMonitoring } = useMemoryMonitoring();
  const { metrics, startMonitoring: startPerfMonitoring, stopMonitoring: stopPerfMonitoring } = usePerformanceMetrics();

  // Record render on every render
  useEffect(() => {
    recordRender();
  });

  // Start monitoring when component mounts
  useEffect(() => {
    startMonitoring(2000); // Update every 2 seconds
    startPerfMonitoring();

    return () => {
      stopMonitoring();
      stopPerfMonitoring();
    };
  }, [startMonitoring, stopMonitoring, startPerfMonitoring, stopPerfMonitoring]);

  // Fetch performance data from server
  useEffect(() => {
    const fetchPerformanceData = async () => {
      try {
        const response = await fetch('/performance/metrics');
        if (response.ok) {
          const data = await response.json();
          setPerformanceData(data);
        }
      } catch (error) {
        recordError(error, 'fetch-performance-data');
      }
    };

    if (isVisible) {
      fetchPerformanceData();
      const interval = setInterval(fetchPerformanceData, 5000);
      return () => clearInterval(interval);
    }
  }, [isVisible, recordError]);

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatNumber = (num) => {
    return typeof num === 'number' ? num.toFixed(2) : '0.00';
  };

  const componentStats = getComponentStats();

  if (!isVisible) {
    return (
      <div style={{ 
        position: 'fixed', 
        top: '10px', 
        right: '10px', 
        zIndex: 1000,
        background: '#282828',
        border: '1px solid #fabd2f',
        borderRadius: '4px',
        padding: '8px'
      }}>
        <button 
          onClick={() => setIsVisible(true)}
          style={{
            background: '#fabd2f',
            color: '#282828',
            border: 'none',
            padding: '4px 8px',
            borderRadius: '2px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold'
          }}
        >
          📊 Performance
        </button>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      width: '320px',
      maxHeight: '500px',
      background: '#282828',
      border: '2px solid #fabd2f',
      borderRadius: '8px',
      padding: '16px',
      color: '#ebdbb2',
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: 1000,
      overflow: 'auto',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '12px',
        borderBottom: '1px solid #504945',
        paddingBottom: '8px'
      }}>
        <h3 style={{ margin: 0, color: '#fabd2f', fontSize: '14px' }}>
          📊 Performance Monitor
        </h3>
        <button 
          onClick={() => setIsVisible(false)}
          style={{
            background: '#fb4934',
            color: '#282828',
            border: 'none',
            padding: '2px 6px',
            borderRadius: '2px',
            cursor: 'pointer',
            fontSize: '10px'
          }}
        >
          ✕
        </button>
      </div>

      {/* Component Stats */}
      <div style={{ marginBottom: '12px' }}>
        <h4 style={{ margin: '0 0 4px 0', color: '#8ec07c', fontSize: '12px' }}>
          Component Stats
        </h4>
        <div style={{ background: '#3c3836', padding: '6px', borderRadius: '4px' }}>
          <div>Renders: {componentStats.renderCount}</div>
          <div>Uptime: {formatNumber(componentStats.uptime / 1000)}s</div>
          <div>Monitoring: {isMonitoring ? '✅' : '❌'}</div>
        </div>
      </div>

      {/* Memory Stats */}
      {memoryStats && (
        <div style={{ marginBottom: '12px' }}>
          <h4 style={{ margin: '0 0 4px 0', color: '#83a598', fontSize: '12px' }}>
            Memory Usage (Client)
          </h4>
          <div style={{ background: '#3c3836', padding: '6px', borderRadius: '4px' }}>
            <div>Heap Used: {formatBytes(memoryStats.heapUsed)}</div>
            <div>Components: {memoryStats.componentCount}</div>
            <div>Listeners: {memoryStats.listenerCount}</div>
          </div>
        </div>
      )}

      {/* Performance Metrics */}
      {metrics && (
        <div style={{ marginBottom: '12px' }}>
          <h4 style={{ margin: '0 0 4px 0', color: '#d3869b', fontSize: '12px' }}>
            Performance Metrics
          </h4>
          <div style={{ background: '#3c3836', padding: '6px', borderRadius: '4px' }}>
            <div>Render Time: {formatNumber(metrics.renderTime)}ms</div>
            <div>Renders: {metrics.componentRenderCount}</div>
            <div>Errors: {metrics.errorCount}</div>
            <div>Memory: {formatBytes(metrics.memoryUsage)}</div>
          </div>
        </div>
      )}

      {/* Server Performance Data */}
      {performanceData && (
        <div style={{ marginBottom: '12px' }}>
          <h4 style={{ margin: '0 0 4px 0', color: '#fe8019', fontSize: '12px' }}>
            Server Performance
          </h4>
          <div style={{ background: '#3c3836', padding: '6px', borderRadius: '4px' }}>
            <div>Heap Used: {formatBytes(performanceData.memory?.heapUsed || 0)}</div>
            <div>Components: {performanceData.memory?.componentCount || 0}</div>
            <div>Socket Connections: {performanceData.socketConnections || 0}</div>
            <div>Render Time: {formatNumber(performanceData.performance?.renderTime || 0)}ms</div>
            <div>Errors: {performanceData.performance?.errorCount || 0}</div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ 
        borderTop: '1px solid #504945', 
        paddingTop: '8px',
        display: 'flex',
        gap: '4px',
        flexWrap: 'wrap'
      }}>
        <button 
          onClick={() => {
            try {
              throw new Error('Test error from Performance Monitor');
            } catch (error) {
              recordError(error, 'test-button');
            }
          }}
          style={{
            background: '#fb4934',
            color: '#282828',
            border: 'none',
            padding: '4px 8px',
            borderRadius: '2px',
            cursor: 'pointer',
            fontSize: '10px'
          }}
        >
          Test Error
        </button>
        
        <button 
          onClick={() => {
            // Force a re-render to test render tracking
            setPerformanceData(prev => ({ ...prev, timestamp: Date.now() }));
          }}
          style={{
            background: '#b8bb26',
            color: '#282828',
            border: 'none',
            padding: '4px 8px',
            borderRadius: '2px',
            cursor: 'pointer',
            fontSize: '10px'
          }}
        >
          Force Render
        </button>

        <button 
          onClick={async () => {
            try {
              const response = await fetch('/performance/report');
              if (response.ok) {
                const report = await response.json();
                console.log('Performance Report:', report);
              }
            } catch (error) {
              recordError(error, 'fetch-report');
            }
          }}
          style={{
            background: '#83a598',
            color: '#282828',
            border: 'none',
            padding: '4px 8px',
            borderRadius: '2px',
            cursor: 'pointer',
            fontSize: '10px'
          }}
        >
          Log Report
        </button>
      </div>

      <div style={{ 
        marginTop: '8px', 
        fontSize: '10px', 
        color: '#928374',
        textAlign: 'center'
      }}>
        Last updated: {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
};

export default PerformanceMonitor;