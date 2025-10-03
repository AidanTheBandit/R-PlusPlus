/**
 * MemoryLeakDetector - Automated memory leak detection and cleanup
 * Addresses requirements 1.1, 1.3, 1.4 for memory leak prevention
 */

import memoryManager from './memory-manager.js';
import performanceMonitor from './performance-monitor.js';

class MemoryLeakDetector {
  constructor() {
    this.detectionInterval = null;
    this.isDetecting = false;
    this.memorySnapshots = [];
    this.maxSnapshots = 10;
    this.leakThreshold = 50 * 1024 * 1024; // 50MB growth threshold
    this.detectionIntervalMs = 60000; // Check every minute
    this.callbacks = new Map();
    this.suspiciousComponents = new Set();
  }

  /**
   * Start memory leak detection
   */
  startDetection() {
    if (this.isDetecting) {
      return;
    }

    this.isDetecting = true;
    console.log('MemoryLeakDetector: Starting leak detection');

    // Take initial snapshot
    this.takeMemorySnapshot();

    // Start periodic detection
    this.detectionInterval = setInterval(() => {
      this.detectLeaks();
    }, this.detectionIntervalMs);
  }

  /**
   * Stop memory leak detection
   */
  stopDetection() {
    if (!this.isDetecting) {
      return;
    }

    this.isDetecting = false;
    console.log('MemoryLeakDetector: Stopping leak detection');

    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
  }

  /**
   * Take a memory snapshot
   */
  takeMemorySnapshot() {
    const snapshot = {
      timestamp: Date.now(),
      memoryUsage: memoryManager.getMemoryUsage(),
      performanceMetrics: performanceMonitor.getMetrics(),
      componentCount: memoryManager.getTrackedComponents().length,
      suspiciousComponents: Array.from(this.suspiciousComponents)
    };

    this.memorySnapshots.push(snapshot);

    // Keep only the last N snapshots
    if (this.memorySnapshots.length > this.maxSnapshots) {
      this.memorySnapshots.shift();
    }

    return snapshot;
  }

  /**
   * Detect memory leaks by analyzing snapshots
   */
  detectLeaks() {
    const currentSnapshot = this.takeMemorySnapshot();
    
    if (this.memorySnapshots.length < 3) {
      return; // Need at least 3 snapshots for trend analysis
    }

    const leaks = this.analyzeMemoryTrend();
    
    if (leaks.length > 0) {
      console.warn('Memory leaks detected:', leaks);
      this.handleDetectedLeaks(leaks);
    }

    // Check for component-specific leaks
    this.detectComponentLeaks();
  }

  /**
   * Analyze memory usage trend to detect leaks
   * @returns {Array} Array of detected leak information
   */
  analyzeMemoryTrend() {
    const leaks = [];
    const recentSnapshots = this.memorySnapshots.slice(-5); // Last 5 snapshots
    
    if (recentSnapshots.length < 3) {
      return leaks;
    }

    // Check for consistent memory growth
    const memoryGrowth = this.calculateMemoryGrowth(recentSnapshots);
    
    if (memoryGrowth.trend === 'increasing' && memoryGrowth.totalGrowth > this.leakThreshold) {
      leaks.push({
        type: 'memory_growth',
        severity: 'high',
        growth: memoryGrowth.totalGrowth,
        rate: memoryGrowth.averageRate,
        snapshots: recentSnapshots.length
      });
    }

    // Check for component count growth
    const componentGrowth = this.calculateComponentGrowth(recentSnapshots);
    
    if (componentGrowth.trend === 'increasing' && componentGrowth.totalGrowth > 10) {
      leaks.push({
        type: 'component_growth',
        severity: 'medium',
        growth: componentGrowth.totalGrowth,
        rate: componentGrowth.averageRate,
        snapshots: recentSnapshots.length
      });
    }

    return leaks;
  }

  /**
   * Calculate memory growth trend
   * @param {Array} snapshots - Memory snapshots to analyze
   * @returns {Object} Growth analysis
   */
  calculateMemoryGrowth(snapshots) {
    if (snapshots.length < 2) {
      return { trend: 'unknown', totalGrowth: 0, averageRate: 0 };
    }

    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    
    const totalGrowth = last.memoryUsage.heapUsed - first.memoryUsage.heapUsed;
    const timeSpan = last.timestamp - first.timestamp;
    const averageRate = totalGrowth / (timeSpan / 1000); // bytes per second

    // Determine trend
    let increasingCount = 0;
    for (let i = 1; i < snapshots.length; i++) {
      if (snapshots[i].memoryUsage.heapUsed > snapshots[i - 1].memoryUsage.heapUsed) {
        increasingCount++;
      }
    }

    const trend = increasingCount > snapshots.length / 2 ? 'increasing' : 'stable';

    return {
      trend,
      totalGrowth,
      averageRate,
      increasingCount,
      totalSnapshots: snapshots.length
    };
  }

  /**
   * Calculate component count growth trend
   * @param {Array} snapshots - Memory snapshots to analyze
   * @returns {Object} Component growth analysis
   */
  calculateComponentGrowth(snapshots) {
    if (snapshots.length < 2) {
      return { trend: 'unknown', totalGrowth: 0, averageRate: 0 };
    }

    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    
    const totalGrowth = last.componentCount - first.componentCount;
    const timeSpan = last.timestamp - first.timestamp;
    const averageRate = totalGrowth / (timeSpan / 1000); // components per second

    // Determine trend
    let increasingCount = 0;
    for (let i = 1; i < snapshots.length; i++) {
      if (snapshots[i].componentCount > snapshots[i - 1].componentCount) {
        increasingCount++;
      }
    }

    const trend = increasingCount > snapshots.length / 2 ? 'increasing' : 'stable';

    return {
      trend,
      totalGrowth,
      averageRate,
      increasingCount,
      totalSnapshots: snapshots.length
    };
  }

  /**
   * Detect component-specific memory leaks
   */
  detectComponentLeaks() {
    const trackedComponents = memoryManager.getTrackedComponents();
    const now = Date.now();
    const staleThreshold = 10 * 60 * 1000; // 10 minutes

    trackedComponents.forEach(component => {
      const age = now - component.registeredAt;
      
      // Flag components that have been around too long
      if (age > staleThreshold) {
        this.suspiciousComponents.add(component.id);
        console.warn(`Suspicious component detected: ${component.id} (age: ${age}ms)`);
      }
    });
  }

  /**
   * Handle detected memory leaks
   * @param {Array} leaks - Array of detected leaks
   */
  handleDetectedLeaks(leaks) {
    leaks.forEach(leak => {
      // Record the leak in performance monitor
      performanceMonitor.recordError(
        new Error(`Memory leak detected: ${leak.type}`),
        'MemoryLeakDetector'
      );

      // Trigger callbacks
      const callback = this.callbacks.get('leakDetected');
      if (callback && typeof callback === 'function') {
        try {
          callback(leak);
        } catch (error) {
          console.error('Error in leak detection callback:', error);
        }
      }

      // Attempt automatic cleanup for severe leaks
      if (leak.severity === 'high') {
        this.attemptAutomaticCleanup(leak);
      }
    });
  }

  /**
   * Attempt automatic cleanup for detected leaks
   * @param {Object} leak - Leak information
   */
  attemptAutomaticCleanup(leak) {
    console.log(`Attempting automatic cleanup for ${leak.type} leak`);

    switch (leak.type) {
      case 'memory_growth':
        // Force garbage collection
        memoryManager.forceGarbageCollection();
        break;
        
      case 'component_growth':
        // Clean up suspicious components
        this.cleanupSuspiciousComponents();
        break;
        
      default:
        console.warn(`No automatic cleanup available for leak type: ${leak.type}`);
    }
  }

  /**
   * Clean up suspicious components
   */
  cleanupSuspiciousComponents() {
    const componentsToCleanup = Array.from(this.suspiciousComponents);
    
    componentsToCleanup.forEach(componentId => {
      console.log(`Cleaning up suspicious component: ${componentId}`);
      memoryManager.untrackComponent(componentId);
      this.suspiciousComponents.delete(componentId);
    });

    if (componentsToCleanup.length > 0) {
      console.log(`Cleaned up ${componentsToCleanup.length} suspicious components`);
    }
  }

  /**
   * Register callback for leak detection events
   * @param {Function} callback - Callback function
   */
  onLeakDetected(callback) {
    this.callbacks.set('leakDetected', callback);
  }

  /**
   * Get current detection status
   * @returns {Object} Detection status and statistics
   */
  getDetectionStatus() {
    return {
      isDetecting: this.isDetecting,
      snapshotCount: this.memorySnapshots.length,
      suspiciousComponentCount: this.suspiciousComponents.size,
      lastSnapshot: this.memorySnapshots[this.memorySnapshots.length - 1] || null,
      detectionInterval: this.detectionIntervalMs
    };
  }

  /**
   * Get memory snapshots for analysis
   * @returns {Array} Array of memory snapshots
   */
  getMemorySnapshots() {
    return [...this.memorySnapshots];
  }

  /**
   * Clear all snapshots and reset detection
   */
  reset() {
    this.memorySnapshots = [];
    this.suspiciousComponents.clear();
    console.log('MemoryLeakDetector: Reset completed');
  }

  /**
   * Configure detection parameters
   * @param {Object} config - Configuration options
   */
  configure(config) {
    if (config.leakThreshold) {
      this.leakThreshold = config.leakThreshold;
    }
    
    if (config.detectionInterval) {
      this.detectionIntervalMs = config.detectionInterval;
      
      // Restart detection with new interval if currently running
      if (this.isDetecting) {
        this.stopDetection();
        this.startDetection();
      }
    }
    
    if (config.maxSnapshots) {
      this.maxSnapshots = config.maxSnapshots;
    }

    console.log('MemoryLeakDetector: Configuration updated', config);
  }
}

// Create singleton instance
const memoryLeakDetector = new MemoryLeakDetector();

export default memoryLeakDetector;