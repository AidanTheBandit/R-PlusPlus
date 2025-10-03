/**
 * React hook for performance monitoring integration
 * Provides React components with performance monitoring capabilities
 */

import { useEffect, useRef, useCallback, useState } from 'react';

// Import performance utilities (will be available after backend integration)
let memoryManager, performanceMonitor, memoryLeakDetector;

// Fallback implementations for development
const createFallbackManager = () => ({
  trackComponent: () => {},
  untrackComponent: () => {},
  getMemoryUsage: () => ({ heapUsed: 0, componentCount: 0 }),
  startMonitoring: () => {},
  stopMonitoring: () => {}
});

const createFallbackMonitor = () => ({
  recordComponentRender: () => {},
  recordError: () => {},
  getMetrics: () => ({ memoryUsage: 0, renderTime: 0 }),
  startMonitoring: () => {},
  stopMonitoring: () => {}
});

const createFallbackDetector = () => ({
  startDetection: () => {},
  stopDetection: () => {},
  getDetectionStatus: () => ({ isDetecting: false })
});

// Initialize with fallbacks
if (typeof window !== 'undefined') {
  // Try to get from global scope (will be set by backend integration)
  memoryManager = window.memoryManager || createFallbackManager();
  performanceMonitor = window.performanceMonitor || createFallbackMonitor();
  memoryLeakDetector = window.memoryLeakDetector || createFallbackDetector();
} else {
  memoryManager = createFallbackManager();
  performanceMonitor = createFallbackMonitor();
  memoryLeakDetector = createFallbackDetector();
}

/**
 * Hook for component performance monitoring
 * @param {string} componentName - Name of the component
 * @param {Object} options - Monitoring options
 */
export const useComponentPerformance = (componentName, options = {}) => {
  const {
    trackMemory = true,
    trackRenders = true,
    autoCleanup = true
  } = options;

  const renderCount = useRef(0);
  const mountTime = useRef(null);
  const lastRenderTime = useRef(null);

  useEffect(() => {
    mountTime.current = performance.now();
    
    if (trackMemory) {
      const cleanup = () => {
        console.debug(`Component ${componentName} cleanup`);
      };
      
      memoryManager.trackComponent(componentName, cleanup);
    }

    return () => {
      if (trackMemory && autoCleanup) {
        memoryManager.untrackComponent(componentName);
      }
    };
  }, [componentName, trackMemory, autoCleanup]);

  const recordRender = useCallback(() => {
    if (!trackRenders) return;

    const now = performance.now();
    renderCount.current++;

    if (lastRenderTime.current) {
      const renderTime = now - lastRenderTime.current;
      performanceMonitor.recordComponentRender(componentName, renderTime);
    }

    lastRenderTime.current = now;
  }, [componentName, trackRenders]);

  const recordError = useCallback((error, context = 'component') => {
    performanceMonitor.recordError(error, `${componentName}:${context}`);
  }, [componentName]);

  const getComponentStats = useCallback(() => {
    const now = performance.now();
    const uptime = mountTime.current ? now - mountTime.current : 0;

    return {
      componentName,
      renderCount: renderCount.current,
      uptime,
      lastRenderTime: lastRenderTime.current,
      mountTime: mountTime.current
    };
  }, [componentName]);

  return {
    recordRender,
    recordError,
    getComponentStats,
    renderCount: renderCount.current
  };
};

/**
 * Hook for memory usage monitoring
 */
export const useMemoryMonitoring = () => {
  const [memoryStats, setMemoryStats] = useState(null);
  const intervalRef = useRef(null);

  const startMonitoring = useCallback((interval = 5000) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    const updateStats = () => {
      const stats = memoryManager.getMemoryUsage();
      setMemoryStats(stats);
    };

    updateStats(); // Initial update
    intervalRef.current = setInterval(updateStats, interval);
  }, []);

  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopMonitoring();
    };
  }, [stopMonitoring]);

  return {
    memoryStats,
    startMonitoring,
    stopMonitoring,
    isMonitoring: intervalRef.current !== null
  };
};

/**
 * Hook for performance metrics monitoring
 */
export const usePerformanceMetrics = () => {
  const [metrics, setMetrics] = useState(null);
  const [isMonitoring, setIsMonitoring] = useState(false);

  const startMonitoring = useCallback(() => {
    performanceMonitor.startMonitoring();
    setIsMonitoring(true);

    // Set up threshold callback
    performanceMonitor.onThresholdExceeded((metric, value) => {
      console.warn(`Performance threshold exceeded: ${metric} = ${value}`);
    });
  }, []);

  const stopMonitoring = useCallback(() => {
    performanceMonitor.stopMonitoring();
    setIsMonitoring(false);
  }, []);

  const updateMetrics = useCallback(() => {
    const currentMetrics = performanceMonitor.getMetrics();
    setMetrics(currentMetrics);
  }, []);

  useEffect(() => {
    const interval = setInterval(updateMetrics, 2000);
    return () => clearInterval(interval);
  }, [updateMetrics]);

  return {
    metrics,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    updateMetrics
  };
};

/**
 * Hook for memory leak detection
 */
export const useMemoryLeakDetection = () => {
  const [detectionStatus, setDetectionStatus] = useState(null);
  const [leaks, setLeaks] = useState([]);

  const startDetection = useCallback(() => {
    memoryLeakDetector.startDetection();
    
    // Set up leak detection callback
    memoryLeakDetector.onLeakDetected((leak) => {
      setLeaks(prev => [...prev, leak]);
      console.warn('Memory leak detected:', leak);
    });
  }, []);

  const stopDetection = useCallback(() => {
    memoryLeakDetector.stopDetection();
  }, []);

  const updateStatus = useCallback(() => {
    const status = memoryLeakDetector.getDetectionStatus();
    setDetectionStatus(status);
  }, []);

  useEffect(() => {
    const interval = setInterval(updateStatus, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, [updateStatus]);

  const clearLeaks = useCallback(() => {
    setLeaks([]);
  }, []);

  return {
    detectionStatus,
    leaks,
    startDetection,
    stopDetection,
    clearLeaks,
    updateStatus
  };
};

/**
 * Hook for render performance optimization
 */
export const useRenderOptimization = (dependencies = []) => {
  const renderStartTime = useRef(null);
  const renderCount = useRef(0);

  const startRenderMeasurement = useCallback(() => {
    renderStartTime.current = performance.now();
  }, []);

  const endRenderMeasurement = useCallback((componentName) => {
    if (renderStartTime.current) {
      const renderTime = performance.now() - renderStartTime.current;
      renderCount.current++;
      
      performanceMonitor.recordComponentRender(componentName, renderTime);
      
      if (renderTime > 16) { // Slower than 60fps
        console.warn(`Slow render: ${componentName} took ${renderTime}ms`);
      }
    }
  }, []);

  // Measure render on dependency changes
  useEffect(() => {
    startRenderMeasurement();
  }, dependencies);

  return {
    startRenderMeasurement,
    endRenderMeasurement,
    renderCount: renderCount.current
  };
};

/**
 * Hook for automatic cleanup management
 */
export const useAutoCleanup = (componentName) => {
  const cleanupFunctions = useRef([]);

  const addCleanup = useCallback((cleanupFn) => {
    cleanupFunctions.current.push(cleanupFn);
  }, []);

  const removeCleanup = useCallback((cleanupFn) => {
    const index = cleanupFunctions.current.indexOf(cleanupFn);
    if (index > -1) {
      cleanupFunctions.current.splice(index, 1);
    }
  }, []);

  useEffect(() => {
    return () => {
      // Run all cleanup functions
      cleanupFunctions.current.forEach(cleanup => {
        try {
          cleanup();
        } catch (error) {
          console.error(`Cleanup error in ${componentName}:`, error);
        }
      });
      
      // Clear the array
      cleanupFunctions.current = [];
    };
  }, [componentName]);

  return {
    addCleanup,
    removeCleanup
  };
};