// Entity.js
// Defines the Entity class as a container for components in the Component-Based Architecture

export class Entity {
    constructor(id) {
        this.id = id;              // Unique identifier (e.g., string or number)
        this.components = new Map(); // Map of component type to component instance
    }

    // Add a component to the entity
    addComponent(component) {
        if (!component || !component.type) {
            throw new Error(`Cannot add invalid component to entity ${this.id}`);
        }
        this.components.set(component.type, component);
        return this; // Chainable
    }

    // Remove a component by type
    removeComponent(type) {
        this.components.delete(type);
        return this; // Chainable
    }

    // Get a component by type
    getComponent(type) {
        return this.components.get(type) || null;
    }

    // Check if entity has specific component(s)
    hasComponent(type) {
        return this.components.has(type);
    }

    hasComponents(types) {
        return types.every(type => this.components.has(type));
    }

    // Get all component types present on the entity
    getComponentTypes() {
        return Array.from(this.components.keys());
    }
}
