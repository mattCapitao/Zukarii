// EventBus.js
// Provides a simple event system for loose coupling between systems in the Component-Based Architecture

export class EventBus {
    constructor() {
        this.listeners = new Map(); // Map of event names to arrays of callback functions
    }

    // Subscribe to an event
    on(eventName, callback) {
        if (typeof callback !== 'function') {
            throw new Error(`Callback for event ${eventName} must be a function`);
        }
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, []);
        }
        this.listeners.get(eventName).push(callback);
        return () => this.off(eventName, callback); // Return unsubscribe function
    }

    // Unsubscribe from an event
    off(eventName, callback) {
        if (!this.listeners.has(eventName)) return;
        const callbacks = this.listeners.get(eventName);
        const index = callbacks.indexOf(callback);
        if (index !== -1) {
            callbacks.splice(index, 1);
        }
        if (callbacks.length === 0) {
            this.listeners.delete(eventName);
        }
    }

    // Emit an event with optional data
    emit(eventName, data = null) {
        if (!this.listeners.has(eventName)) return;
        const callbacks = this.listeners.get(eventName).slice(); // Copy to avoid mutation issues
        callbacks.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in callback for event ${eventName}:`, error);
            }
        });
    }

    // Clear all listeners for an event or all events
    clear(eventName = null) {
        if (eventName) {
            this.listeners.delete(eventName);
        } else {
            this.listeners.clear();
        }
    }
}