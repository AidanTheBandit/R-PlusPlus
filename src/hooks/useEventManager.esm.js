/**
 * React hook for integrating with the centralized EventManager (ES6 Module version)
 * Provides automatic cleanup on component unmount
 */

import { useEffect, useRef, useCallback } from 'react';
import eventManager from '../utils/event-manager.esm.js';

/**
 * Hook for managing event subscriptions with automatic cleanup
 * @param {string} componentId - Unique identifier for the component
 * @returns {Object} Event management functions
 */
export function useEventManager(componentId) {
  const componentIdRef = useRef(componentId || `component_${Date.now()}_${Math.random()}`);
  const subscriptionsRef = useRef(new Set());

  // Subscribe to an event
  const subscribe = useCallback((event, handler, options = {}) => {
    const subscriptionId = eventManager.subscribe(event, handler, {
      ...options,
      componentId: componentIdRef.current
    });
    
    subscriptionsRef.current.add(subscriptionId);
    return subscriptionId;
  }, []);

  // Unsubscribe from a specific event
  const unsubscribe = useCallback((subscriptionId) => {
    const success = eventManager.unsubscribe(subscriptionId);
    if (success) {
      subscriptionsRef.current.delete(subscriptionId);
    }
    return success;
  }, []);

  // Emit an event
  const emit = useCallback((event, data) => {
    eventManager.emit(event, data);
  }, []);

  // Subscribe with debouncing
  const subscribeDebounced = useCallback((event, handler, delay, options = {}) => {
    return subscribe(event, handler, { ...options, debounce: delay });
  }, [subscribe]);

  // Subscribe with throttling
  const subscribeThrottled = useCallback((event, handler, delay, options = {}) => {
    return subscribe(event, handler, { ...options, throttle: delay });
  }, [subscribe]);

  // Subscribe to DOM events with delegation
  const subscribeDOMEvent = useCallback((event, target, handler, options = {}) => {
    return subscribe(event, handler, { ...options, target });
  }, [subscribe]);

  // Subscribe to DOM events with delegation and selector
  const subscribeDelegated = useCallback((event, target, selector, handler, options = {}) => {
    return subscribe(event, handler, { ...options, target, selector });
  }, [subscribe]);

  // Subscribe once (auto-unsubscribe after first trigger)
  const subscribeOnce = useCallback((event, handler, options = {}) => {
    return subscribe(event, handler, { ...options, once: true });
  }, [subscribe]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up all component subscriptions
      eventManager.cleanup(componentIdRef.current);
    };
  }, []);

  return {
    subscribe,
    unsubscribe,
    emit,
    subscribeDebounced,
    subscribeThrottled,
    subscribeDOMEvent,
    subscribeDelegated,
    subscribeOnce,
    componentId: componentIdRef.current
  };
}

/**
 * Hook for subscribing to a specific event with automatic cleanup
 * @param {string} event - Event name
 * @param {Function} handler - Event handler
 * @param {Object} options - Subscription options
 * @param {Array} deps - Dependency array for handler
 */
export function useEventSubscription(event, handler, options = {}, deps = []) {
  const { subscribe } = useEventManager();
  
  useEffect(() => {
    if (!event || !handler) return;
    
    const subscriptionId = subscribe(event, handler, options);
    
    return () => {
      eventManager.unsubscribe(subscriptionId);
    };
  }, [event, subscribe, ...deps]);
}

/**
 * Hook for emitting events
 * @returns {Function} Emit function
 */
export function useEventEmitter() {
  return useCallback((event, data) => {
    eventManager.emit(event, data);
  }, []);
}

export default useEventManager;