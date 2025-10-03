/**
 * Centralized Event Management System (ES6 Module version)
 * Provides subscription/unsubscription handling with debouncing, throttling,
 * automatic cleanup, and event delegation capabilities.
 */

class EventManager {
  constructor() {
    this.subscriptions = new Map();
    this.componentSubscriptions = new Map();
    this.delegatedEvents = new Map();
    this.subscriptionCounter = 0;
    this.cleanupCallbacks = new Map();
  }

  /**
   * Subscribe to an event with optional debouncing/throttling
   * @param {string} event - Event name
   * @param {Function} handler - Event handler function
   * @param {Object} options - Configuration options
   * @returns {string} Subscription ID for unsubscribing
   */
  subscribe(event, handler, options = {}) {
    const subscriptionId = `sub_${++this.subscriptionCounter}`;
    
    const {
      once = false,
      debounce = 0,
      throttle = 0,
      componentId = null,
      target = null,
      selector = null
    } = options;

    let processedHandler = handler;

    // Apply debouncing if specified
    if (debounce > 0) {
      processedHandler = this._debounce(handler, debounce);
    }
    
    // Apply throttling if specified (throttle takes precedence over debounce)
    if (throttle > 0) {
      processedHandler = this._throttle(handler, throttle);
    }

    // Wrap handler for once functionality
    if (once) {
      const originalHandler = processedHandler;
      processedHandler = (...args) => {
        originalHandler(...args);
        this.unsubscribe(subscriptionId);
      };
    }

    const subscription = {
      id: subscriptionId,
      event,
      handler: processedHandler,
      originalHandler: handler,
      options,
      target,
      selector,
      componentId
    };

    // Store subscription
    if (!this.subscriptions.has(event)) {
      this.subscriptions.set(event, new Map());
    }
    this.subscriptions.get(event).set(subscriptionId, subscription);

    // Track component subscriptions for automatic cleanup
    if (componentId) {
      if (!this.componentSubscriptions.has(componentId)) {
        this.componentSubscriptions.set(componentId, new Set());
      }
      this.componentSubscriptions.get(componentId).add(subscriptionId);
    }

    // Handle event delegation
    if (target && selector) {
      this._setupEventDelegation(subscription);
    } else if (target) {
      // Direct event listener
      target.addEventListener(event, processedHandler);
      
      // Store cleanup callback
      this.cleanupCallbacks.set(subscriptionId, () => {
        target.removeEventListener(event, processedHandler);
      });
    }

    return subscriptionId;
  }

  /**
   * Unsubscribe from an event
   * @param {string} subscriptionId - Subscription ID to remove
   */
  unsubscribe(subscriptionId) {
    // Find and remove subscription
    for (const [event, eventSubscriptions] of this.subscriptions) {
      if (eventSubscriptions.has(subscriptionId)) {
        const subscription = eventSubscriptions.get(subscriptionId);
        
        // Execute cleanup callback if exists
        if (this.cleanupCallbacks.has(subscriptionId)) {
          this.cleanupCallbacks.get(subscriptionId)();
          this.cleanupCallbacks.delete(subscriptionId);
        }

        // Remove from component tracking
        if (subscription.componentId) {
          const componentSubs = this.componentSubscriptions.get(subscription.componentId);
          if (componentSubs) {
            componentSubs.delete(subscriptionId);
            if (componentSubs.size === 0) {
              this.componentSubscriptions.delete(subscription.componentId);
            }
          }
        }

        // Remove subscription
        eventSubscriptions.delete(subscriptionId);
        if (eventSubscriptions.size === 0) {
          this.subscriptions.delete(event);
        }

        return true;
      }
    }
    return false;
  }

  /**
   * Emit an event to all subscribers
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    const eventSubscriptions = this.subscriptions.get(event);
    if (!eventSubscriptions) return;

    // Create event object
    const eventObj = {
      type: event,
      data,
      timestamp: Date.now(),
      preventDefault: () => { eventObj.defaultPrevented = true; },
      stopPropagation: () => { eventObj.propagationStopped = true; },
      defaultPrevented: false,
      propagationStopped: false
    };

    // Execute all handlers
    for (const subscription of eventSubscriptions.values()) {
      if (eventObj.propagationStopped) break;
      
      try {
        subscription.handler(eventObj);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    }
  }

  /**
   * Clean up all subscriptions for a component
   * @param {string} componentId - Component identifier
   */
  cleanup(componentId) {
    const componentSubs = this.componentSubscriptions.get(componentId);
    if (!componentSubs) return;

    // Unsubscribe all component subscriptions
    for (const subscriptionId of componentSubs) {
      this.unsubscribe(subscriptionId);
    }
  }

  /**
   * Clean up all subscriptions and reset manager
   */
  cleanupAll() {
    // Execute all cleanup callbacks
    for (const cleanup of this.cleanupCallbacks.values()) {
      try {
        cleanup();
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
    }

    // Clear all maps
    this.subscriptions.clear();
    this.componentSubscriptions.clear();
    this.delegatedEvents.clear();
    this.cleanupCallbacks.clear();
    this.subscriptionCounter = 0;
  }

  /**
   * Get subscription statistics
   * @returns {Object} Statistics about current subscriptions
   */
  getStats() {
    let totalSubscriptions = 0;
    const eventCounts = {};
    
    for (const [event, eventSubs] of this.subscriptions) {
      const count = eventSubs.size;
      totalSubscriptions += count;
      eventCounts[event] = count;
    }

    return {
      totalSubscriptions,
      totalEvents: this.subscriptions.size,
      totalComponents: this.componentSubscriptions.size,
      eventCounts,
      delegatedEvents: this.delegatedEvents.size
    };
  }

  /**
   * Setup event delegation for improved performance
   * @private
   */
  _setupEventDelegation(subscription) {
    const { event, target, selector, handler } = subscription;
    const delegationKey = `${event}:${target}`;

    if (!this.delegatedEvents.has(delegationKey)) {
      // Create delegated handler
      const delegatedHandler = (e) => {
        const matchedElement = e.target.closest(selector);
        if (matchedElement && target.contains(matchedElement)) {
          // Create synthetic event with matched element
          const syntheticEvent = {
            ...e,
            currentTarget: matchedElement,
            delegatedTarget: target
          };
          
          // Find all subscriptions for this delegation
          const eventSubs = this.subscriptions.get(event);
          if (eventSubs) {
            for (const sub of eventSubs.values()) {
              if (sub.target === target && sub.selector === selector) {
                try {
                  sub.handler(syntheticEvent);
                } catch (error) {
                  console.error(`Error in delegated event handler:`, error);
                }
              }
            }
          }
        }
      };

      target.addEventListener(event, delegatedHandler);
      this.delegatedEvents.set(delegationKey, {
        handler: delegatedHandler,
        subscriptions: new Set()
      });
    }

    // Add subscription to delegation tracking
    this.delegatedEvents.get(delegationKey).subscriptions.add(subscription.id);

    // Store cleanup callback for delegation
    this.cleanupCallbacks.set(subscription.id, () => {
      const delegation = this.delegatedEvents.get(delegationKey);
      if (delegation) {
        delegation.subscriptions.delete(subscription.id);
        
        // Remove delegation if no more subscriptions
        if (delegation.subscriptions.size === 0) {
          target.removeEventListener(event, delegation.handler);
          this.delegatedEvents.delete(delegationKey);
        }
      }
    });
  }

  /**
   * Debounce function implementation
   * @private
   */
  _debounce(func, delay) {
    let timeoutId;
    return function debounced(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  /**
   * Throttle function implementation
   * @private
   */
  _throttle(func, delay) {
    let lastCall = 0;
    let timeoutId;
    
    return function throttled(...args) {
      const now = Date.now();
      
      if (now - lastCall >= delay) {
        lastCall = now;
        func.apply(this, args);
      } else {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          lastCall = Date.now();
          func.apply(this, args);
        }, delay - (now - lastCall));
      }
    };
  }
}

// Create singleton instance
const eventManager = new EventManager();

export default eventManager;
export { EventManager };