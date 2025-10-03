/**
 * PerformanceMonitor - Real-time metrics collection and monitoring
 * Addresses requirements 1.1, 1.2, 1.5, 1.6 for performance optimization
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      memoryUsage: 0,
      cpuUsage: 0,
      renderTime: 0,
      bundleSize: 0,
      networkLatency: 0,
      errorCount: 0,
      componentRenderCount: 0,
      eventListenerCount: 0
    };

    this.thresholds = {
      memoryUsage: 200 * 1024 * 1024, // 200MB
      cpuUsage: 15, // 15%
      renderTime: 16, // 16ms (60fps)
      networkLatency: 1000, // 1 second
      errorCount: 10 // 10 errors per minute
    };

    this.callbacks = new Map();
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.renderTimeObserver = null;
    this.errorCount = 0;
    this.errorResetInterval = null;
  }

  /**
   * Start performance monitoring
   */
  startMonitoring() {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    console.log('PerformanceMonitor: Starting monitoring');

    // Start memory and CPU monitoring
    this.monitoringInterval = setInterval(() => {
      this.updateMetrics();
      this.checkThresholds();
    }, 5000); // Check every 5 seconds

    // Start render time monitoring if available
    this.startRenderTimeMonitoring();

    // Reset error count every minute
    this.errorResetInterval = setInterval(() => {
      this.errorCount = 0;
      this.metrics.errorCount = 0;
    }, 60000);
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    console.log('PerformanceMonitor: Stopping monitoring');

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.errorResetInterval) {
      clearInterval(this.errorResetInterval);
      this.errorResetInterval = null;
    }

    this.stopRenderTimeMonitoring();
  }

  /**
   * Update performance metrics
   */
  updateMetrics() {
    // Update memory usage
    if (process && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      this.metrics.memoryUsage = memUsage.heapUsed;
    } else if (performance && performance.memory) {
      this.metrics.memoryUsage = performance.memory.usedJSHeapSize;
    }

    // Update CPU usage (Node.js only)
    if (process && process.cpuUsage) {
      const cpuUsage = process.cpuUsage();
      this.metrics.cpuUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to percentage
    }

    // Update network latency (if WebSocket is available)
    this.measureNetworkLatency();

    // Update bundle size (browser only)
    if (typeof window !== 'undefined') {
      this.updateBundleSize();
    }
  }

  /**
   * Measure network latency using ping
   */
  measureNetworkLatency() {
    const startTime = performance.now();
    
    // Use fetch with a small request to measure latency
    if (typeof fetch !== 'undefined') {
      fetch('/health', { method: 'HEAD' })
        .then(() => {
          const latency = performance.now() - startTime;
          this.metrics.networkLatency = latency;
        })
        .catch(() => {
          // Ignore errors for latency measurement
        });
    }
  }

  /**
   * Update bundle size metrics
   */
  updateBundleSize() {
    if (performance && performance.getEntriesByType) {
      const resources = performance.getEntriesByType('resource');
      let totalSize = 0;

      resources.forEach(resource => {
        if (resource.name.includes('.js') || resource.name.includes('.css')) {
          totalSize += resource.transferSize || 0;
        }
      });

      this.metrics.bundleSize = totalSize;
    }
  }

  /**
   * Start render time monitoring using Performance Observer
   */
  startRenderTimeMonitoring() {
    if (typeof PerformanceObserver === 'undefined') {
      return;
    }

    try {
      this.renderTimeObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.entryType === 'measure' && entry.name.includes('React')) {
            this.metrics.renderTime = Math.max(this.metrics.renderTime, entry.duration);
          }
        });
      });

      this.renderTimeObserver.observe({ entryTypes: ['measure'] });
    } catch (error) {
      console.warn('PerformanceMonitor: Could not start render time monitoring:', error);
    }
  }

  /**
   * Stop render time monitoring
   */
  stopRenderTimeMonitoring() {
    if (this.renderTimeObserver) {
      this.renderTimeObserver.disconnect();
      this.renderTimeObserver = null;
    }
  }

  /**
   * Record a component render
   * @param {string} componentName - Name of the component
   * @param {number} renderTime - Time taken to render
   */
  recordComponentRender(componentName, renderTime) {
    this.metrics.componentRenderCount++;
    
    if (renderTime > this.metrics.renderTime) {
      this.metrics.renderTime = renderTime;
    }

    // Log slow renders
    if (renderTime > this.thresholds.renderTime) {
      console.warn(`Slow render detected: ${componentName} took ${renderTime}ms`);
    }
  }

  /**
   * Record an error
   * @param {Error} error - The error that occurred
   * @param {string} context - Context where the error occurred
   */
  recordError(error, context = 'unknown') {
    this.errorCount++;
    this.metrics.errorCount = this.errorCount;

    console.error(`PerformanceMonitor: Error in ${context}:`, error);

    // Check error threshold
    if (this.errorCount >= this.thresholds.errorCount) {
      this.triggerThresholdCallback('errorCount', this.errorCount);
    }
  }

  /**
   * Check if any thresholds are exceeded
   */
  checkThresholds() {
    Object.keys(this.thresholds).forEach(metric => {
      const currentValue = this.metrics[metric];
      const threshold = this.thresholds[metric];

      if (currentValue > threshold) {
        this.triggerThresholdCallback(metric, currentValue);
      }
    });
  }

  /**
   * Trigger threshold exceeded callback
   * @param {string} metric - The metric that exceeded threshold
   * @param {number} value - Current value of the metric
   */
  triggerThresholdCallback(metric, value) {
    console.warn(`Performance threshold exceeded: ${metric} = ${value}`);
    
    const callback = this.callbacks.get('thresholdExceeded');
    if (callback && typeof callback === 'function') {
      try {
        callback(metric, value);
      } catch (error) {
        console.error('Error in threshold callback:', error);
      }
    }
  }

  /**
   * Register callback for threshold exceeded events
   * @param {Function} callback - Callback function
   */
  onThresholdExceeded(callback) {
    this.callbacks.set('thresholdExceeded', callback);
  }

  /**
   * Get current performance metrics
   * @returns {Object} Current metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Set custom threshold for a metric
   * @param {string} metric - Metric name
   * @param {number} value - Threshold value
   */
  setThreshold(metric, value) {
    if (this.thresholds.hasOwnProperty(metric)) {
      this.thresholds[metric] = value;
      console.log(`PerformanceMonitor: Set ${metric} threshold to ${value}`);
    } else {
      console.warn(`PerformanceMonitor: Unknown metric ${metric}`);
    }
  }

  /**
   * Get performance report
   * @returns {Object} Detailed performance report
   */
  getPerformanceReport() {
    return {
      metrics: this.getMetrics(),
      thresholds: { ...this.thresholds },
      isMonitoring: this.isMonitoring,
      timestamp: Date.now()
    };
  }

  /**
   * Reset all metrics
   */
  resetMetrics() {
    Object.keys(this.metrics).forEach(key => {
      this.metrics[key] = 0;
    });
    this.errorCount = 0;
    console.log('PerformanceMonitor: Metrics reset');
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

export default performanceMonitor;