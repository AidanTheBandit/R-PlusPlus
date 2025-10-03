/**
 * Performance Testing Framework - Memory usage benchmarks and performance tests
 * Addresses requirements 1.1, 1.2, 1.5, 1.6 for performance testing
 */

import memoryManager from '../utils/memory-manager.js';
import performanceMonitor from '../utils/performance-monitor.js';
import memoryLeakDetector from '../utils/memory-leak-detector.js';

class PerformanceTestFramework {
  constructor() {
    this.testResults = [];
    this.benchmarks = new Map();
    this.isRunning = false;
    this.testStartTime = null;
    this.baselineMetrics = null;
  }

  /**
   * Initialize the testing framework
   */
  initialize() {
    console.log('PerformanceTestFramework: Initializing');
    
    // Start monitoring systems
    performanceMonitor.startMonitoring();
    memoryManager.startMonitoring();
    memoryLeakDetector.startDetection();

    // Set up error handling
    performanceMonitor.onThresholdExceeded((metric, value) => {
      this.recordTestResult({
        type: 'threshold_exceeded',
        metric,
        value,
        timestamp: Date.now(),
        status: 'warning'
      });
    });

    memoryLeakDetector.onLeakDetected((leak) => {
      this.recordTestResult({
        type: 'memory_leak',
        leak,
        timestamp: Date.now(),
        status: 'error'
      });
    });
  }

  /**
   * Start a performance test session
   * @param {string} testName - Name of the test session
   */
  startTestSession(testName = 'default') {
    if (this.isRunning) {
      throw new Error('Test session already running');
    }

    this.isRunning = true;
    this.testStartTime = Date.now();
    this.testResults = [];
    
    // Capture baseline metrics
    this.baselineMetrics = {
      memory: memoryManager.getMemoryUsage(),
      performance: performanceMonitor.getMetrics(),
      timestamp: this.testStartTime
    };

    console.log(`PerformanceTestFramework: Started test session "${testName}"`);
    return this.baselineMetrics;
  }

  /**
   * End the current test session
   * @returns {Object} Test session results
   */
  endTestSession() {
    if (!this.isRunning) {
      throw new Error('No test session running');
    }

    const endTime = Date.now();
    const duration = endTime - this.testStartTime;

    // Capture final metrics
    const finalMetrics = {
      memory: memoryManager.getMemoryUsage(),
      performance: performanceMonitor.getMetrics(),
      timestamp: endTime
    };

    // Calculate deltas
    const deltas = this.calculateMetricDeltas(this.baselineMetrics, finalMetrics);

    const sessionResults = {
      duration,
      baselineMetrics: this.baselineMetrics,
      finalMetrics,
      deltas,
      testResults: [...this.testResults],
      summary: this.generateTestSummary(deltas)
    };

    this.isRunning = false;
    this.testStartTime = null;
    this.baselineMetrics = null;

    console.log('PerformanceTestFramework: Test session ended', sessionResults.summary);
    return sessionResults;
  }

  /**
   * Run memory usage benchmark
   * @param {Function} testFunction - Function to benchmark
   * @param {Object} options - Benchmark options
   * @returns {Object} Benchmark results
   */
  async runMemoryBenchmark(testFunction, options = {}) {
    const {
      iterations = 100,
      warmupIterations = 10,
      name = 'memory_benchmark'
    } = options;

    console.log(`Running memory benchmark: ${name}`);

    // Warmup phase
    for (let i = 0; i < warmupIterations; i++) {
      await testFunction();
    }

    // Force garbage collection before benchmark
    memoryManager.forceGarbageCollection();
    await this.sleep(100); // Allow GC to complete

    // Capture initial memory
    const initialMemory = memoryManager.getMemoryUsage();

    // Run benchmark iterations
    const iterationResults = [];
    for (let i = 0; i < iterations; i++) {
      const iterationStart = performance.now();
      const memoryBefore = memoryManager.getMemoryUsage();

      await testFunction();

      const iterationEnd = performance.now();
      const memoryAfter = memoryManager.getMemoryUsage();

      iterationResults.push({
        iteration: i,
        duration: iterationEnd - iterationStart,
        memoryBefore: memoryBefore.heapUsed,
        memoryAfter: memoryAfter.heapUsed,
        memoryDelta: memoryAfter.heapUsed - memoryBefore.heapUsed
      });
    }

    // Capture final memory
    const finalMemory = memoryManager.getMemoryUsage();

    // Calculate statistics
    const stats = this.calculateBenchmarkStats(iterationResults);
    
    const benchmarkResult = {
      name,
      iterations,
      initialMemory: initialMemory.heapUsed,
      finalMemory: finalMemory.heapUsed,
      totalMemoryGrowth: finalMemory.heapUsed - initialMemory.heapUsed,
      stats,
      iterationResults,
      timestamp: Date.now()
    };

    this.benchmarks.set(name, benchmarkResult);
    this.recordTestResult({
      type: 'memory_benchmark',
      result: benchmarkResult,
      status: benchmarkResult.totalMemoryGrowth > 10 * 1024 * 1024 ? 'warning' : 'pass'
    });

    return benchmarkResult;
  }

  /**
   * Run render performance benchmark
   * @param {Function} renderFunction - Function that triggers renders
   * @param {Object} options - Benchmark options
   * @returns {Object} Render benchmark results
   */
  async runRenderBenchmark(renderFunction, options = {}) {
    const {
      iterations = 50,
      name = 'render_benchmark'
    } = options;

    console.log(`Running render benchmark: ${name}`);

    const renderTimes = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      await renderFunction();
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      renderTimes.push(renderTime);
      performanceMonitor.recordComponentRender(`benchmark_${i}`, renderTime);
    }

    const stats = {
      min: Math.min(...renderTimes),
      max: Math.max(...renderTimes),
      average: renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length,
      median: this.calculateMedian(renderTimes),
      p95: this.calculatePercentile(renderTimes, 95),
      p99: this.calculatePercentile(renderTimes, 99)
    };

    const benchmarkResult = {
      name,
      iterations,
      renderTimes,
      stats,
      timestamp: Date.now()
    };

    this.benchmarks.set(name, benchmarkResult);
    this.recordTestResult({
      type: 'render_benchmark',
      result: benchmarkResult,
      status: stats.p95 > 16 ? 'warning' : 'pass' // 60fps threshold
    });

    return benchmarkResult;
  }

  /**
   * Run component lifecycle benchmark
   * @param {Function} createComponent - Function to create component
   * @param {Function} destroyComponent - Function to destroy component
   * @param {Object} options - Benchmark options
   * @returns {Object} Lifecycle benchmark results
   */
  async runLifecycleBenchmark(createComponent, destroyComponent, options = {}) {
    const {
      iterations = 100,
      name = 'lifecycle_benchmark'
    } = options;

    console.log(`Running lifecycle benchmark: ${name}`);

    const components = [];
    const createTimes = [];
    const destroyTimes = [];

    // Test component creation
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      const component = await createComponent();
      const endTime = performance.now();

      components.push(component);
      createTimes.push(endTime - startTime);
    }

    // Test component destruction
    for (let i = 0; i < components.length; i++) {
      const startTime = performance.now();
      await destroyComponent(components[i]);
      const endTime = performance.now();

      destroyTimes.push(endTime - startTime);
    }

    const createStats = {
      min: Math.min(...createTimes),
      max: Math.max(...createTimes),
      average: createTimes.reduce((a, b) => a + b, 0) / createTimes.length
    };

    const destroyStats = {
      min: Math.min(...destroyTimes),
      max: Math.max(...destroyTimes),
      average: destroyTimes.reduce((a, b) => a + b, 0) / destroyTimes.length
    };

    const benchmarkResult = {
      name,
      iterations,
      createStats,
      destroyStats,
      createTimes,
      destroyTimes,
      timestamp: Date.now()
    };

    this.benchmarks.set(name, benchmarkResult);
    this.recordTestResult({
      type: 'lifecycle_benchmark',
      result: benchmarkResult,
      status: 'pass'
    });

    return benchmarkResult;
  }

  /**
   * Test for memory leaks in a function
   * @param {Function} testFunction - Function to test for leaks
   * @param {Object} options - Test options
   * @returns {Object} Leak test results
   */
  async testForMemoryLeaks(testFunction, options = {}) {
    const {
      iterations = 1000,
      stabilizationTime = 5000,
      name = 'memory_leak_test'
    } = options;

    console.log(`Testing for memory leaks: ${name}`);

    // Force garbage collection and wait for stabilization
    memoryManager.forceGarbageCollection();
    await this.sleep(stabilizationTime);

    const initialMemory = memoryManager.getMemoryUsage();
    const memorySnapshots = [initialMemory.heapUsed];

    // Run test iterations
    for (let i = 0; i < iterations; i++) {
      await testFunction();
      
      // Take memory snapshot every 100 iterations
      if (i % 100 === 0) {
        const currentMemory = memoryManager.getMemoryUsage();
        memorySnapshots.push(currentMemory.heapUsed);
      }
    }

    // Force garbage collection and wait
    memoryManager.forceGarbageCollection();
    await this.sleep(stabilizationTime);

    const finalMemory = memoryManager.getMemoryUsage();
    memorySnapshots.push(finalMemory.heapUsed);

    // Analyze memory growth
    const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
    const growthPerIteration = memoryGrowth / iterations;
    const leakDetected = memoryGrowth > 10 * 1024 * 1024; // 10MB threshold

    const leakTestResult = {
      name,
      iterations,
      initialMemory: initialMemory.heapUsed,
      finalMemory: finalMemory.heapUsed,
      memoryGrowth,
      growthPerIteration,
      memorySnapshots,
      leakDetected,
      timestamp: Date.now()
    };

    this.recordTestResult({
      type: 'memory_leak_test',
      result: leakTestResult,
      status: leakDetected ? 'fail' : 'pass'
    });

    return leakTestResult;
  }

  /**
   * Calculate benchmark statistics
   * @param {Array} results - Array of iteration results
   * @returns {Object} Statistics
   */
  calculateBenchmarkStats(results) {
    const durations = results.map(r => r.duration);
    const memoryDeltas = results.map(r => r.memoryDelta);

    return {
      duration: {
        min: Math.min(...durations),
        max: Math.max(...durations),
        average: durations.reduce((a, b) => a + b, 0) / durations.length,
        median: this.calculateMedian(durations)
      },
      memory: {
        min: Math.min(...memoryDeltas),
        max: Math.max(...memoryDeltas),
        average: memoryDeltas.reduce((a, b) => a + b, 0) / memoryDeltas.length,
        total: memoryDeltas.reduce((a, b) => a + b, 0)
      }
    };
  }

  /**
   * Calculate metric deltas between baseline and final metrics
   * @param {Object} baseline - Baseline metrics
   * @param {Object} final - Final metrics
   * @returns {Object} Metric deltas
   */
  calculateMetricDeltas(baseline, final) {
    return {
      memory: {
        heapUsed: final.memory.heapUsed - baseline.memory.heapUsed,
        componentCount: final.memory.componentCount - baseline.memory.componentCount
      },
      performance: {
        renderTime: final.performance.renderTime - baseline.performance.renderTime,
        errorCount: final.performance.errorCount - baseline.performance.errorCount
      }
    };
  }

  /**
   * Generate test summary
   * @param {Object} deltas - Metric deltas
   * @returns {Object} Test summary
   */
  generateTestSummary(deltas) {
    const issues = [];
    
    if (deltas.memory.heapUsed > 50 * 1024 * 1024) {
      issues.push('High memory growth detected');
    }
    
    if (deltas.memory.componentCount > 10) {
      issues.push('Component count increased significantly');
    }
    
    if (deltas.performance.errorCount > 0) {
      issues.push('Errors occurred during test');
    }

    return {
      status: issues.length === 0 ? 'pass' : 'warning',
      issues,
      memoryGrowth: deltas.memory.heapUsed,
      componentGrowth: deltas.memory.componentCount,
      errorCount: deltas.performance.errorCount
    };
  }

  /**
   * Record a test result
   * @param {Object} result - Test result to record
   */
  recordTestResult(result) {
    this.testResults.push({
      ...result,
      timestamp: result.timestamp || Date.now()
    });
  }

  /**
   * Get all benchmark results
   * @returns {Object} All benchmark results
   */
  getBenchmarkResults() {
    return Object.fromEntries(this.benchmarks);
  }

  /**
   * Get test results
   * @returns {Array} Test results
   */
  getTestResults() {
    return [...this.testResults];
  }

  /**
   * Calculate median of an array
   * @param {Array} arr - Array of numbers
   * @returns {number} Median value
   */
  calculateMedian(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  }

  /**
   * Calculate percentile of an array
   * @param {Array} arr - Array of numbers
   * @param {number} percentile - Percentile to calculate (0-100)
   * @returns {number} Percentile value
   */
  calculatePercentile(arr, percentile) {
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} Promise that resolves after sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clean up the testing framework
   */
  cleanup() {
    performanceMonitor.stopMonitoring();
    memoryManager.stopMonitoring();
    memoryLeakDetector.stopDetection();
    
    this.testResults = [];
    this.benchmarks.clear();
    this.isRunning = false;
    
    console.log('PerformanceTestFramework: Cleanup completed');
  }
}

// Create singleton instance
const performanceTestFramework = new PerformanceTestFramework();

export default performanceTestFramework;