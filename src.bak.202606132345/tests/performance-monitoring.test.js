/**
 * Performance Monitoring Tests
 * Tests for memory management, performance monitoring, and leak detection
 */

import memoryManager from '../utils/memory-manager.js';
import performanceMonitor from '../utils/performance-monitor.js';
import memoryLeakDetector from '../utils/memory-leak-detector.js';
import performanceTestFramework from './performance-test-framework.js';

describe('Performance Monitoring System', () => {
  beforeEach(() => {
    // Reset all systems before each test
    memoryManager.cleanup();
    performanceMonitor.resetMetrics();
    memoryLeakDetector.reset();
  });

  afterEach(() => {
    // Clean up after each test
    memoryManager.stopMonitoring();
    performanceMonitor.stopMonitoring();
    memoryLeakDetector.stopDetection();
  });

  describe('MemoryManager', () => {
    test('should track and untrack components', () => {
      const componentId = 'test-component';
      let cleanupCalled = false;
      
      const cleanup = () => {
        cleanupCalled = true;
      };

      // Track component
      memoryManager.trackComponent(componentId, cleanup);
      
      const trackedComponents = memoryManager.getTrackedComponents();
      expect(trackedComponents).toHaveLength(1);
      expect(trackedComponents[0].id).toBe(componentId);

      // Untrack component
      memoryManager.untrackComponent(componentId);
      
      expect(memoryManager.getTrackedComponents()).toHaveLength(0);
      expect(cleanupCalled).toBe(true);
    });

    test('should get memory usage statistics', () => {
      const stats = memoryManager.getMemoryUsage();
      
      expect(stats).toHaveProperty('componentCount');
      expect(stats).toHaveProperty('listenerCount');
      expect(stats).toHaveProperty('heapUsed');
      expect(stats).toHaveProperty('heapTotal');
      expect(stats).toHaveProperty('timestamp');
      
      expect(typeof stats.componentCount).toBe('number');
      expect(typeof stats.timestamp).toBe('number');
    });

    test('should force garbage collection', () => {
      // Track a component
      memoryManager.trackComponent('test', () => {});
      
      // Force GC should not throw
      expect(() => {
        memoryManager.forceGarbageCollection();
      }).not.toThrow();
    });
  });

  describe('PerformanceMonitor', () => {
    test('should record component renders', () => {
      const componentName = 'TestComponent';
      const renderTime = 10;

      performanceMonitor.recordComponentRender(componentName, renderTime);
      
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.componentRenderCount).toBe(1);
    });

    test('should record errors', () => {
      const error = new Error('Test error');
      const context = 'test-context';

      performanceMonitor.recordError(error, context);
      
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.errorCount).toBe(1);
    });

    test('should trigger threshold callbacks', (done) => {
      performanceMonitor.onThresholdExceeded((metric, value) => {
        expect(metric).toBe('errorCount');
        expect(value).toBeGreaterThanOrEqual(10);
        done();
      });

      // Trigger threshold by recording many errors
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordError(new Error(`Error ${i}`), 'test');
      }
    });

    test('should set custom thresholds', () => {
      const customThreshold = 100;
      performanceMonitor.setThreshold('memoryUsage', customThreshold);
      
      // Threshold should be updated (we can't directly test this without accessing private properties)
      expect(() => {
        performanceMonitor.setThreshold('memoryUsage', customThreshold);
      }).not.toThrow();
    });

    test('should generate performance report', () => {
      const report = performanceMonitor.getPerformanceReport();
      
      expect(report).toHaveProperty('metrics');
      expect(report).toHaveProperty('thresholds');
      expect(report).toHaveProperty('isMonitoring');
      expect(report).toHaveProperty('timestamp');
    });
  });

  describe('MemoryLeakDetector', () => {
    test('should take memory snapshots', () => {
      const snapshot = memoryLeakDetector.takeMemorySnapshot();
      
      expect(snapshot).toHaveProperty('timestamp');
      expect(snapshot).toHaveProperty('memoryUsage');
      expect(snapshot).toHaveProperty('performanceMetrics');
      expect(snapshot).toHaveProperty('componentCount');
    });

    test('should get detection status', () => {
      const status = memoryLeakDetector.getDetectionStatus();
      
      expect(status).toHaveProperty('isDetecting');
      expect(status).toHaveProperty('snapshotCount');
      expect(status).toHaveProperty('suspiciousComponentCount');
      expect(status).toHaveProperty('detectionInterval');
    });

    test('should configure detection parameters', () => {
      const config = {
        leakThreshold: 100 * 1024 * 1024, // 100MB
        detectionInterval: 30000, // 30 seconds
        maxSnapshots: 5
      };

      expect(() => {
        memoryLeakDetector.configure(config);
      }).not.toThrow();
    });
  });

  describe('PerformanceTestFramework', () => {
    test('should initialize framework', () => {
      expect(() => {
        performanceTestFramework.initialize();
      }).not.toThrow();
    });

    test('should start and end test sessions', () => {
      performanceTestFramework.initialize();
      
      const baseline = performanceTestFramework.startTestSession('test-session');
      expect(baseline).toHaveProperty('memory');
      expect(baseline).toHaveProperty('performance');
      expect(baseline).toHaveProperty('timestamp');

      const results = performanceTestFramework.endTestSession();
      expect(results).toHaveProperty('duration');
      expect(results).toHaveProperty('baselineMetrics');
      expect(results).toHaveProperty('finalMetrics');
      expect(results).toHaveProperty('deltas');
      expect(results).toHaveProperty('summary');
    });

    test('should run memory benchmark', async () => {
      performanceTestFramework.initialize();
      
      const testFunction = async () => {
        // Simulate some memory allocation
        const data = new Array(1000).fill('test');
        return data;
      };

      const result = await performanceTestFramework.runMemoryBenchmark(testFunction, {
        iterations: 10,
        name: 'test-benchmark'
      });

      expect(result).toHaveProperty('name', 'test-benchmark');
      expect(result).toHaveProperty('iterations', 10);
      expect(result).toHaveProperty('initialMemory');
      expect(result).toHaveProperty('finalMemory');
      expect(result).toHaveProperty('stats');
    });

    test('should run render benchmark', async () => {
      performanceTestFramework.initialize();
      
      const renderFunction = async () => {
        // Simulate render work
        await new Promise(resolve => setTimeout(resolve, 1));
      };

      const result = await performanceTestFramework.runRenderBenchmark(renderFunction, {
        iterations: 5,
        name: 'render-test'
      });

      expect(result).toHaveProperty('name', 'render-test');
      expect(result).toHaveProperty('iterations', 5);
      expect(result).toHaveProperty('renderTimes');
      expect(result).toHaveProperty('stats');
      expect(result.renderTimes).toHaveLength(5);
    });

    test('should test for memory leaks', async () => {
      performanceTestFramework.initialize();
      
      const leakyFunction = async () => {
        // Simulate potential memory leak
        global.testData = global.testData || [];
        global.testData.push(new Array(100).fill('data'));
      };

      const result = await performanceTestFramework.testForMemoryLeaks(leakyFunction, {
        iterations: 10,
        stabilizationTime: 100,
        name: 'leak-test'
      });

      expect(result).toHaveProperty('name', 'leak-test');
      expect(result).toHaveProperty('iterations', 10);
      expect(result).toHaveProperty('initialMemory');
      expect(result).toHaveProperty('finalMemory');
      expect(result).toHaveProperty('memoryGrowth');
      expect(result).toHaveProperty('leakDetected');

      // Clean up test data
      delete global.testData;
    });
  });

  describe('Integration Tests', () => {
    test('should work together without conflicts', () => {
      // Start all systems
      memoryManager.startMonitoring();
      performanceMonitor.startMonitoring();
      memoryLeakDetector.startDetection();

      // Track a component
      memoryManager.trackComponent('integration-test', () => {});

      // Record some performance data
      performanceMonitor.recordComponentRender('integration-test', 15);

      // Take a memory snapshot
      const snapshot = memoryLeakDetector.takeMemorySnapshot();

      // Verify everything is working
      expect(memoryManager.getTrackedComponents()).toHaveLength(1);
      expect(performanceMonitor.getMetrics().componentRenderCount).toBe(1);
      expect(snapshot.componentCount).toBe(1);

      // Clean up
      memoryManager.untrackComponent('integration-test');
    });
  });
});