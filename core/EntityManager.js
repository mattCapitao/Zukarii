// EntityManager.js
// Manages entities and provides querying for systems in the Component-Based Architecture

import { Entity } from './Entity.js'; // Added missing import

export class EntityManager {
    constructor() {
        this.entities = new Map(); // Map of entity ID to Entity instance
        this.nextId = 0;           // Simple incrementing ID for new entities
    }

    // Create a new entity with an optional ID (auto-generates if not provided)
    createEntity(id = null) {
        const entityId = id !== null ? id : `entity_${this.nextId++}`;
        if (this.entities.has(entityId)) {
            throw new Error(`Entity ID ${entityId} already exists`);
        }
        const entity = new Entity(entityId);
        this.entities.set(entityId, entity);
        return entity;
    }

    // Remove an entity by ID
    removeEntity(id) {
        this.entities.delete(id);
    }

    // Get an entity by ID
    getEntity(id) {
        return this.entities.get(id) || null;
    }

    // Get all entities
    getAllEntities() {
        return Array.from(this.entities.values());
    }

    // Get entities with specific component types
    getEntitiesWith(componentTypes) {
        if (!Array.isArray(componentTypes)) {
            componentTypes = [componentTypes]; // Allow single type as string
        }
        return this.getAllEntities().filter(entity =>
            entity.hasComponents(componentTypes)
        );
    }

    // Add a component to an entity by ID
    addComponentToEntity(entityId, component) {
       // console.log('EntityManager: Adding component to entity', entityId, 'component:', component, 'timestamp:', Date.now());
        const entity = this.getEntity(entityId);
        if (!entity) {
            throw new Error(`Entity ${entityId} not found`);
        }
        entity.addComponent(component);
        return entity;
    }

    // Remove a component from an entity by ID and type
    removeComponentFromEntity(entityId, componentType) {
        const entity = this.getEntity(entityId);
        if (!entity) {
            throw new Error(`Entity ${entityId} not found`);
        }
        entity.removeComponent(componentType);
        return entity;
    }

    // Clear all entities
    clear() {
        this.entities.clear();
        this.nextId = 0;
    }
}