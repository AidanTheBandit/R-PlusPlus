/**
 * MemoryManager - Tracks components and manages memory cleanup
 * Addresses requirements 1.1, 1.2, 1.3, 1.4 for memory leak prevention
 */

class MemoryManager {
  constructor() {
    this.components = new Map();
    this.cleanupCallbacks = new Map();
    this.memoryThreshold = 200 * 1024 * 1024; // 200MB threshold
    this.monitoringInterval = null;
    this.isMonitoring = false;
  }

  /**
   * Track a component with its cleanup function
   * @param {string} componentId - Unique identifier for the component
   * @param {Function} cleanup - Cleanup function to call on unmount
   */
  trackComponent(componentId, cleanup) {
    if (this.components.has(componentId)) {
      console.warn(`Component ${componentId} is already being tracked`);
      return;
    }

    this.components.set(componentId, {
      id: componentId,
      registeredAt: Date.now(),
      cleanup: cleanup
    });

    this.cleanupCallbacks.set(componentId, cleanup);
    
    console.debug(`MemoryManager: Tracking component ${componentId}`);
  }

  /**
   * Untrack a component and run its cleanup
   * @param {string} componentId - Component to untrack
   */
  untrackComponent(componentId) {
    const component = this.components.get(componentId);
    if (!component) {
      console.warn(`Component ${componentId} is not being tracked`);
      return;
    }

    try {
      // Run cleanup function
      if (component.cleanup && typeof component.cleanup === 'function') {
        component.cleanup();
      }
    } catch (error) {
      console.error(`Error during cleanup for component ${componentId}:`, error);
    }

    this.components.delete(componentId);
    this.cleanupCallbacks.delete(componentId);
    
    console.debug(`MemoryManager: Untracked component ${componentId}`);
  }

  /**
   * Force garbage collection optimization
   */
  forceGarbageCollection() {
    // Clean up any orphaned components
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [componentId, component] of this.components.entries()) {
      if (now - component.registeredAt > staleThreshold) {
        console.warn(`Cleaning up stale component: ${componentId}`);
        this.untrackComponent(componentId);
      }
    }

    // Suggest garbage collection if available
    if (global.gc) {
      global.gc();
    } else if (window && window.gc) {
      window.gc();
    }
  }

  /**
   * Get current memory usage statistics
   * @returns {Object} Memory statistics
   */
  getMemoryUsage() {
    const stats = {
      componentCount: this.components.size,
      listenerCount: this.cleanupCallbacks.size,
      heapUsed: 0,
      heapTotal: 0,
      timestamp: Date.now()
    };

    // Get memory info if available (Node.js)
    if (process && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      stats.heapUsed = memUsage.heapUsed;
      stats.heapTotal = memUsage.heapTotal;
    }
    // Get memory info if available (Browser)
    else if (performance && performance.memory) {
      stats.heapUsed = performance.memory.usedJSHeapSize;
      stats.heapTotal = performance.memory.totalJSHeapSize;
    }

    return stats;
  }

  /**
   * Start memory monitoring
   * @param {number} interval - Monitoring interval in milliseconds
   */
  startMonitoring(interval = 30000) {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      const stats = this.getMemoryUsage();
      
      // Check if memory usage exceeds threshold
      if (stats.heapUsed > this.memoryThreshold) {
        console.warn('Memory threshold exceeded:', stats);
        this.forceGarbageCollection();
      }

      // Log memory stats periodically
      console.debug('Memory stats:', stats);
    }, interval);

    console.log('MemoryManager: Started monitoring');
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    console.log('MemoryManager: Stopped monitoring');
  }

  /**
   * Clean up all tracked components
   */
  cleanup() {
    console.log('MemoryManager: Cleaning up all components');
    
    for (const componentId of this.components.keys()) {
      this.untrackComponent(componentId);
    }

    this.stopMonitoring();
  }

  /**
   * Get list of currently tracked components
   * @returns {Array} List of tracked components
   */
  getTrackedComponents() {
    return Array.from(this.components.values());
  }
}

// Create singleton instance
const memoryManager = new MemoryManager();

export default memoryManager;