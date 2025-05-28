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
       // console.log(`EventBus: Registered listener for event: ${eventName}`);
        return () => this.off(eventName, callback); // Return unsubscribe function
    }

    // Unsubscribe from an event
    off(eventName, callback) {
        if (!this.listeners.has(eventName)) return;
        const callbacks = this.listeners.get(eventName);
        const index = callbacks.indexOf(callback);
        if (index !== -1) {
            callbacks.splice(index, 1);
           // console.log(`EventBus: Removed listener for event: ${eventName}`);
        }
        if (callbacks.length === 0) {
            this.listeners.delete(eventName);
        }
    }

    emit(eventName, ...args) {
        //console.log(`EventBus: Emitting event: ${eventName}`, args);
        if (!this.listeners.has(eventName)) {
           // console.log(`EventBus: No listeners for event: ${eventName}`);
            return;
        }
        const callbacks = this.listeners.get(eventName).slice(); // Copy to avoid mutation issues
        callbacks.forEach((callback, index) => {
            try {
               // console.log(`EventBus: Invoking callback ${index} for event: ${eventName}`, args);
                callback(...args);
              //  console.log(`EventBus: Callback ${index} for event ${eventName} executed successfully`);
            } catch (error) {
                console.error(`EventBus: Error in callback ${index} for event ${eventName}:`, error);
            }
        });
    }

    // Clear all listeners for an event or all events
    clear(eventName = null) {
        if (eventName) {
            this.listeners.delete(eventName);
            //console.log(`EventBus: Cleared listeners for event: ${eventName}`);
        } else {
            this.listeners.clear();
            //console.log('EventBus: Cleared all listeners');
        }
    }
}