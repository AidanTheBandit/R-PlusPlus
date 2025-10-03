/**
 * Unit tests for EventManager
 */

const { EventManager } = require('../utils/event-manager.js');

describe('EventManager', () => {
  let eventManager;

  beforeEach(() => {
    eventManager = new EventManager();
  });

  afterEach(() => {
    eventManager.cleanupAll();
  });

  describe('Basic Subscription and Emission', () => {
    test('should subscribe and emit events', () => {
      const handler = jest.fn();
      const subscriptionId = eventManager.subscribe('test-event', handler);

      expect(subscriptionId).toBeDefined();
      expect(typeof subscriptionId).toBe('string');

      eventManager.emit('test-event', { message: 'hello' });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'test-event',
          data: { message: 'hello' },
          timestamp: expect.any(Number)
        })
      );
    });

    test('should handle multiple subscribers for same event', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      eventManager.subscribe('test-event', handler1);
      eventManager.subscribe('test-event', handler2);

      eventManager.emit('test-event', { data: 'test' });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    test('should unsubscribe correctly', () => {
      const handler = jest.fn();
      const subscriptionId = eventManager.subscribe('test-event', handler);

      eventManager.emit('test-event', {});
      expect(handler).toHaveBeenCalledTimes(1);

      const unsubscribed = eventManager.unsubscribe(subscriptionId);
      expect(unsubscribed).toBe(true);

      eventManager.emit('test-event', {});
      expect(handler).toHaveBeenCalledTimes(1); // Should not be called again
    });
  });

  describe('Debouncing', () => {
    test('should debounce event handlers', (done) => {
      const handler = jest.fn();
      eventManager.subscribe('debounced-event', handler, { debounce: 100 });

      // Emit multiple events quickly
      eventManager.emit('debounced-event', { count: 1 });
      eventManager.emit('debounced-event', { count: 2 });
      eventManager.emit('debounced-event', { count: 3 });

      // Handler should not be called immediately
      expect(handler).not.toHaveBeenCalled();

      // Wait for debounce delay
      setTimeout(() => {
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            data: { count: 3 }
          })
        );
        done();
      }, 150);
    });
  });

  describe('Throttling', () => {
    test('should throttle event handlers', (done) => {
      const handler = jest.fn();
      eventManager.subscribe('throttled-event', handler, { throttle: 100 });

      // Emit events rapidly
      eventManager.emit('throttled-event', { count: 1 });
      eventManager.emit('throttled-event', { count: 2 });
      eventManager.emit('throttled-event', { count: 3 });

      // First call should happen immediately
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { count: 1 }
        })
      );

      // Wait for throttle delay
      setTimeout(() => {
        expect(handler).toHaveBeenCalledTimes(2);
        expect(handler).toHaveBeenLastCalledWith(
          expect.objectContaining({
            data: { count: 3 }
          })
        );
        done();
      }, 150);
    });
  });

  describe('Once Subscription', () => {
    test('should auto-unsubscribe after first emission', () => {
      const handler = jest.fn();
      eventManager.subscribe('once-event', handler, { once: true });

      eventManager.emit('once-event', { first: true });
      expect(handler).toHaveBeenCalledTimes(1);

      eventManager.emit('once-event', { second: true });
      expect(handler).toHaveBeenCalledTimes(1); // Should not be called again
    });
  });

  describe('Component Cleanup', () => {
    test('should track component subscriptions', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const handler3 = jest.fn();

      eventManager.subscribe('event1', handler1, { componentId: 'component1' });
      eventManager.subscribe('event2', handler2, { componentId: 'component1' });
      eventManager.subscribe('event3', handler3, { componentId: 'component2' });

      // Verify subscriptions work
      eventManager.emit('event1', {});
      eventManager.emit('event2', {});
      eventManager.emit('event3', {});

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);

      // Cleanup component1
      eventManager.cleanup('component1');

      // Emit events again
      eventManager.emit('event1', {});
      eventManager.emit('event2', {});
      eventManager.emit('event3', {});

      // component1 handlers should not be called, component2 should
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(2);
    });
  });

  describe('DOM Event Integration', () => {
    test('should handle DOM event listeners', () => {
      const mockElement = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      };

      const handler = jest.fn();
      const subscriptionId = eventManager.subscribe('click', handler, {
        target: mockElement
      });

      expect(mockElement.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));

      // Unsubscribe should remove listener
      eventManager.unsubscribe(subscriptionId);
      expect(mockElement.removeEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });
  });

  describe('Event Delegation', () => {
    test('should setup event delegation', () => {
      const mockContainer = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        contains: jest.fn(() => true)
      };

      const mockTarget = {
        closest: jest.fn(() => mockTarget)
      };

      const handler = jest.fn();
      const subscriptionId = eventManager.subscribe('click', handler, {
        target: mockContainer,
        selector: '.button'
      });

      expect(mockContainer.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));

      // Simulate delegated event
      const delegatedHandler = mockContainer.addEventListener.mock.calls[0][1];
      const mockEvent = {
        target: mockTarget
      };

      delegatedHandler(mockEvent);

      expect(mockTarget.closest).toHaveBeenCalledWith('.button');
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          currentTarget: mockTarget,
          delegatedTarget: mockContainer
        })
      );

      // Cleanup should remove delegation
      eventManager.unsubscribe(subscriptionId);
      expect(mockContainer.removeEventListener).toHaveBeenCalled();
    });
  });

  describe('Event Propagation Control', () => {
    test('should support preventDefault and stopPropagation', () => {
      const handler1 = jest.fn((event) => {
        event.stopPropagation();
      });
      const handler2 = jest.fn();

      eventManager.subscribe('test-event', handler1);
      eventManager.subscribe('test-event', handler2);

      eventManager.emit('test-event', {});

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).not.toHaveBeenCalled(); // Should be stopped by handler1
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should provide subscription statistics', () => {
      eventManager.subscribe('event1', jest.fn());
      eventManager.subscribe('event1', jest.fn());
      eventManager.subscribe('event2', jest.fn());

      const stats = eventManager.getStats();

      expect(stats).toEqual({
        totalSubscriptions: 3,
        totalEvents: 2,
        totalComponents: 0,
        eventCounts: {
          event1: 2,
          event2: 1
        },
        delegatedEvents: 0
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle errors in event handlers gracefully', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      const errorHandler = jest.fn(() => {
        throw new Error('Handler error');
      });
      const normalHandler = jest.fn();

      eventManager.subscribe('error-event', errorHandler);
      eventManager.subscribe('error-event', normalHandler);

      eventManager.emit('error-event', {});

      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('Error in event handler'),
        expect.any(Error)
      );
      expect(normalHandler).toHaveBeenCalledTimes(1); // Should still be called

      consoleError.mockRestore();
    });
  });

  describe('Cleanup All', () => {
    test('should cleanup all subscriptions and reset state', () => {
      const mockElement = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      };

      eventManager.subscribe('event1', jest.fn());
      eventManager.subscribe('click', jest.fn(), { target: mockElement });

      let stats = eventManager.getStats();
      expect(stats.totalSubscriptions).toBeGreaterThan(0);

      eventManager.cleanupAll();

      stats = eventManager.getStats();
      expect(stats.totalSubscriptions).toBe(0);
      expect(stats.totalEvents).toBe(0);
      expect(mockElement.removeEventListener).toHaveBeenCalled();
    });
  });
});