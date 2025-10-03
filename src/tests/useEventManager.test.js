/**
 * Unit tests for useEventManager React hook
 */

const { renderHook, act } = require('@testing-library/react');
const { useEventManager, useEventSubscription, useEventEmitter } = require('../hooks/useEventManager.js');
const eventManager = require('../utils/event-manager.js');

// Mock the event manager
jest.mock('../utils/event-manager.js', () => ({
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  emit: jest.fn(),
  cleanup: jest.fn()
}));

describe('useEventManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    eventManager.subscribe.mockImplementation(() => 'mock-subscription-id');
    eventManager.unsubscribe.mockImplementation(() => true);
  });

  test('should provide event management functions', () => {
    const { result } = renderHook(() => useEventManager('test-component'));

    expect(result.current).toHaveProperty('subscribe');
    expect(result.current).toHaveProperty('unsubscribe');
    expect(result.current).toHaveProperty('emit');
    expect(result.current).toHaveProperty('subscribeDebounced');
    expect(result.current).toHaveProperty('subscribeThrottled');
    expect(result.current).toHaveProperty('subscribeDOMEvent');
    expect(result.current).toHaveProperty('subscribeDelegated');
    expect(result.current).toHaveProperty('subscribeOnce');
    expect(result.current).toHaveProperty('componentId');
  });

  test('should generate component ID if not provided', () => {
    const { result } = renderHook(() => useEventManager());
    
    expect(result.current.componentId).toBeDefined();
    expect(typeof result.current.componentId).toBe('string');
    expect(result.current.componentId).toMatch(/^component_\d+_/);
  });

  test('should use provided component ID', () => {
    const { result } = renderHook(() => useEventManager('custom-component'));
    
    expect(result.current.componentId).toBe('custom-component');
  });

  test('should subscribe to events with component ID', () => {
    const { result } = renderHook(() => useEventManager('test-component'));
    const handler = jest.fn();

    act(() => {
      result.current.subscribe('test-event', handler, { debounce: 100 });
    });

    expect(eventManager.subscribe).toHaveBeenCalledWith('test-event', handler, {
      debounce: 100,
      componentId: 'test-component'
    });
  });

  test('should unsubscribe from events', () => {
    const { result } = renderHook(() => useEventManager('test-component'));

    act(() => {
      const success = result.current.unsubscribe('mock-subscription-id');
      expect(success).toBe(true);
    });

    expect(eventManager.unsubscribe).toHaveBeenCalledWith('mock-subscription-id');
  });

  test('should emit events', () => {
    const { result } = renderHook(() => useEventManager('test-component'));

    act(() => {
      result.current.emit('test-event', { data: 'test' });
    });

    expect(eventManager.emit).toHaveBeenCalledWith('test-event', { data: 'test' });
  });

  test('should subscribe with debouncing', () => {
    const { result } = renderHook(() => useEventManager('test-component'));
    const handler = jest.fn();

    act(() => {
      result.current.subscribeDebounced('test-event', handler, 200, { once: true });
    });

    expect(eventManager.subscribe).toHaveBeenCalledWith('test-event', handler, {
      once: true,
      debounce: 200,
      componentId: 'test-component'
    });
  });

  test('should subscribe with throttling', () => {
    const { result } = renderHook(() => useEventManager('test-component'));
    const handler = jest.fn();

    act(() => {
      result.current.subscribeThrottled('test-event', handler, 300);
    });

    expect(eventManager.subscribe).toHaveBeenCalledWith('test-event', handler, {
      throttle: 300,
      componentId: 'test-component'
    });
  });

  test('should subscribe to DOM events', () => {
    const { result } = renderHook(() => useEventManager('test-component'));
    const handler = jest.fn();
    const mockElement = document.createElement('div');

    act(() => {
      result.current.subscribeDOMEvent('click', mockElement, handler);
    });

    expect(eventManager.subscribe).toHaveBeenCalledWith('click', handler, {
      target: mockElement,
      componentId: 'test-component'
    });
  });

  test('should subscribe with delegation', () => {
    const { result } = renderHook(() => useEventManager('test-component'));
    const handler = jest.fn();
    const mockElement = document.createElement('div');

    act(() => {
      result.current.subscribeDelegated('click', mockElement, '.button', handler);
    });

    expect(eventManager.subscribe).toHaveBeenCalledWith('click', handler, {
      target: mockElement,
      selector: '.button',
      componentId: 'test-component'
    });
  });

  test('should subscribe once', () => {
    const { result } = renderHook(() => useEventManager('test-component'));
    const handler = jest.fn();

    act(() => {
      result.current.subscribeOnce('test-event', handler);
    });

    expect(eventManager.subscribe).toHaveBeenCalledWith('test-event', handler, {
      once: true,
      componentId: 'test-component'
    });
  });

  test('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useEventManager('test-component'));

    unmount();

    expect(eventManager.cleanup).toHaveBeenCalledWith('test-component');
  });
});

describe('useEventSubscription', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    eventManager.subscribe.mockImplementation(() => 'mock-subscription-id');
    eventManager.unsubscribe.mockImplementation(() => true);
  });

  test('should subscribe to event on mount', () => {
    const handler = jest.fn();
    
    renderHook(() => useEventSubscription('test-event', handler, { debounce: 100 }));

    expect(eventManager.subscribe).toHaveBeenCalledWith('test-event', handler, {
      debounce: 100,
      componentId: expect.any(String)
    });
  });

  test('should unsubscribe on unmount', () => {
    const handler = jest.fn();
    
    const { unmount } = renderHook(() => 
      useEventSubscription('test-event', handler)
    );

    unmount();

    expect(eventManager.unsubscribe).toHaveBeenCalledWith('mock-subscription-id');
  });

  test('should resubscribe when dependencies change', () => {
    const handler = jest.fn();
    let eventName = 'event1';
    
    const { rerender } = renderHook(() => 
      useEventSubscription(eventName, handler, {}, [eventName])
    );

    expect(eventManager.subscribe).toHaveBeenCalledTimes(1);
    expect(eventManager.subscribe).toHaveBeenCalledWith('event1', handler, {
      componentId: expect.any(String)
    });

    // Change dependency
    eventName = 'event2';
    rerender();

    expect(eventManager.unsubscribe).toHaveBeenCalledWith('mock-subscription-id');
    expect(eventManager.subscribe).toHaveBeenCalledTimes(2);
    expect(eventManager.subscribe).toHaveBeenLastCalledWith('event2', handler, {
      componentId: expect.any(String)
    });
  });

  test('should not subscribe if event or handler is null', () => {
    renderHook(() => useEventSubscription(null, jest.fn()));
    renderHook(() => useEventSubscription('test-event', null));

    expect(eventManager.subscribe).not.toHaveBeenCalled();
  });
});

describe('useEventEmitter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should provide emit function', () => {
    const { result } = renderHook(() => useEventEmitter());

    expect(typeof result.current).toBe('function');
  });

  test('should emit events', () => {
    const { result } = renderHook(() => useEventEmitter());

    act(() => {
      result.current('test-event', { data: 'test' });
    });

    expect(eventManager.emit).toHaveBeenCalledWith('test-event', { data: 'test' });
  });

  test('should maintain stable reference', () => {
    const { result, rerender } = renderHook(() => useEventEmitter());
    const firstEmit = result.current;

    rerender();

    expect(result.current).toBe(firstEmit);
  });
});