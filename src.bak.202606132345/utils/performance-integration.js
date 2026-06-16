/**
 * Performance Integration - Makes performance utilities available to frontend applications
 * Addresses requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6 for cross-application integration
 */

import memoryManager from './memory-manager.js';
import performanceMonitor from './performance-monitor.js';
import memoryLeakDetector from './memory-leak-detector.js';

class PerformanceIntegration {
  constructor() {
    this.isInitialized = false;
    this.socketConnections = new Set();
  }

  /**
   * Initialize performance monitoring for the application
   */
  initialize() {
    if (this.isInitialized) {
      return;
    }

    console.log('PerformanceIntegration: Initializing performance monitoring');

    // Start all monitoring systems
    memoryManager.startMonitoring();
    performanceMonitor.startMonitoring();
    memoryLeakDetector.startDetection();

    // Set up global error handling
    this.setupGlobalErrorHandling();

    // Make utilities available globally for frontend access
    this.exposeUtilities();

    this.isInitialized = true;
    console.log('PerformanceIntegration: Initialization complete');
  }

  /**
   * Set up global error handling
   */
  setupGlobalErrorHandling() {
    // Handle unhandled promise rejections
    if (typeof process !== 'undefined') {
      process.on('unhandledRejection', (reason, promise) => {
        performanceMonitor.recordError(
          new Error(`Unhandled Promise Rejection: ${reason}`),
          'global'
        );
      });

      process.on('uncaughtException', (error) => {
        performanceMonitor.recordError(error, 'global');
      });
    }

    // Handle browser errors
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        performanceMonitor.recordError(event.error, 'global');
      });

      window.addEventListener('unhandledrejection', (event) => {
        performanceMonitor.recordError(
          new Error(`Unhandled Promise Rejection: ${event.reason}`),
          'global'
        );
      });
    }
  }

  /**
   * Expose utilities globally for frontend access
   */
  exposeUtilities() {
    if (typeof global !== 'undefined') {
      // Node.js environment
      global.memoryManager = memoryManager;
      global.performanceMonitor = performanceMonitor;
      global.memoryLeakDetector = memoryLeakDetector;
    }

    if (typeof window !== 'undefined') {
      // Browser environment
      window.memoryManager = memoryManager;
      window.performanceMonitor = performanceMonitor;
      window.memoryLeakDetector = memoryLeakDetector;
    }
  }

  /**
   * Register a socket connection for monitoring
   * @param {Object} socket - Socket.IO socket instance
   * @param {string} connectionId - Unique identifier for the connection
   */
  registerSocketConnection(socket, connectionId) {
    if (this.socketConnections.has(connectionId)) {
      console.warn(`Socket connection ${connectionId} already registered`);
      return;
    }

    console.log(`PerformanceIntegration: Registering socket connection ${connectionId}`);

    // Track the socket connection
    const cleanup = () => {
      console.log(`Cleaning up socket connection ${connectionId}`);
      if (socket && socket.disconnect) {
        socket.disconnect();
      }
      this.socketConnections.delete(connectionId);
    };

    memoryManager.trackComponent(`socket_${connectionId}`, cleanup);
    this.socketConnections.add(connectionId);

    // Monitor socket events for performance
    if (socket) {
      const originalEmit = socket.emit;
      socket.emit = function(...args) {
        const startTime = performance.now();
        const result = originalEmit.apply(this, args);
        const duration = performance.now() - startTime;
        
        performanceMonitor.recordComponentRender(`socket_emit_${args[0]}`, duration);
        return result;
      };

      // Track socket errors
      socket.on('error', (error) => {
        performanceMonitor.recordError(error, `socket_${connectionId}`);
      });

      // Track disconnections
      socket.on('disconnect', () => {
        memoryManager.untrackComponent(`socket_${connectionId}`);
        this.socketConnections.delete(connectionId);
      });
    }
  }

  /**
   * Unregister a socket connection
   * @param {string} connectionId - Connection identifier
   */
  unregisterSocketConnection(connectionId) {
    if (this.socketConnections.has(connectionId)) {
      memoryManager.untrackComponent(`socket_${connectionId}`);
      this.socketConnections.delete(connectionId);
      console.log(`PerformanceIntegration: Unregistered socket connection ${connectionId}`);
    }
  }

  /**
   * Get performance metrics for API endpoints
   * @returns {Object} Performance metrics
   */
  getPerformanceMetrics() {
    return {
      memory: memoryManager.getMemoryUsage(),
      performance: performanceMonitor.getMetrics(),
      leakDetection: memoryLeakDetector.getDetectionStatus(),
      socketConnections: this.socketConnections.size,
      timestamp: Date.now()
    };
  }

  /**
   * Create middleware for Express.js to track request performance
   * @returns {Function} Express middleware
   */
  createExpressMiddleware() {
    return (req, res, next) => {
      const startTime = performance.now();
      const requestId = `${req.method}_${req.path}_${Date.now()}`;

      // Track the request
      memoryManager.trackComponent(`request_${requestId}`, () => {
        console.debug(`Request ${requestId} cleanup`);
      });

      // Override res.end to measure response time
      const originalEnd = res.end;
      res.end = function(...args) {
        const duration = performance.now() - startTime;
        performanceMonitor.recordComponentRender(`request_${req.path}`, duration);
        
        // Clean up request tracking
        memoryManager.untrackComponent(`request_${requestId}`);
        
        return originalEnd.apply(this, args);
      };

      // Track request errors
      res.on('error', (error) => {
        performanceMonitor.recordError(error, `request_${req.path}`);
        memoryManager.untrackComponent(`request_${requestId}`);
      });

      next();
    };
  }

  /**
   * Create Socket.IO middleware for performance tracking
   * @returns {Function} Socket.IO middleware
   */
  createSocketMiddleware() {
    return (socket, next) => {
      const connectionId = socket.id;
      this.registerSocketConnection(socket, connectionId);

      // Track socket event performance
      const originalOnevent = socket.onevent;
      socket.onevent = function(packet) {
        const startTime = performance.now();
        const result = originalOnevent.call(this, packet);
        const duration = performance.now() - startTime;
        
        if (packet && packet.data && packet.data[0]) {
          performanceMonitor.recordComponentRender(`socket_event_${packet.data[0]}`, duration);
        }
        
        return result;
      };

      next();
    };
  }

  /**
   * Cleanup all performance monitoring
   */
  cleanup() {
    console.log('PerformanceIntegration: Starting cleanup');

    // Stop all monitoring
    performanceMonitor.stopMonitoring();
    memoryManager.stopMonitoring();
    memoryLeakDetector.stopDetection();

    // Clean up all tracked components
    memoryManager.cleanup();

    // Clear socket connections
    this.socketConnections.clear();

    this.isInitialized = false;
    console.log('PerformanceIntegration: Cleanup complete');
  }

  /**
   * Get comprehensive performance report
   * @returns {Object} Detailed performance report
   */
  getPerformanceReport() {
    return {
      system: {
        isInitialized: this.isInitialized,
        socketConnections: this.socketConnections.size,
        trackedComponents: memoryManager.getTrackedComponents().length
      },
      memory: memoryManager.getMemoryUsage(),
      performance: performanceMonitor.getPerformanceReport(),
      leakDetection: memoryLeakDetector.getDetectionStatus(),
      memorySnapshots: memoryLeakDetector.getMemorySnapshots().slice(-5), // Last 5 snapshots
      timestamp: Date.now()
    };
  }

  /**
   * Configure performance monitoring thresholds
   * @param {Object} config - Configuration options
   */
  configure(config) {
    if (config.memoryThreshold) {
      performanceMonitor.setThreshold('memoryUsage', config.memoryThreshold);
    }

    if (config.renderTimeThreshold) {
      performanceMonitor.setThreshold('renderTime', config.renderTimeThreshold);
    }

    if (config.leakDetection) {
      memoryLeakDetector.configure(config.leakDetection);
    }

    console.log('PerformanceIntegration: Configuration updated', config);
  }
}

// Create singleton instance
const performanceIntegration = new PerformanceIntegration();

export default performanceIntegration;