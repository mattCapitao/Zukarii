// EntityManager.js
// Manages entities and provides querying for systems in the Component-Based Architecture

import { Entity } from './Entity.js';

export class EntityManager {
    constructor() {
        // Map of tier to Map of entity ID to Entity instance
        this.entitiesByTier = new Map();
        // Map of global entities (accessible across tiers)
        this.globalEntities = new Map();
        this.nextId = 0; // Simple incrementing ID for new entities
        this.activeTier = 0; // Default to tier 0
    }

    // Set the active tier for entity operations
    setActiveTier(tier) {
        if (tier === undefined || tier === null) {
            console.error(`EntityManager: Attempted to set active tier to an invalid value: ${tier}`);
            console.trace();
        }
        this.activeTier = tier;
        if (!this.entitiesByTier.has(tier)) {
            this.entitiesByTier.set(tier, new Map());
        }
        console.log(`EntityManager: Set active tier to ${tier}, entitiesByTier:`, this.entitiesByTier.keys());
    }

    // Get the active tier
    getActiveTier() {
        return this.activeTier;
    }

    // Create a new entity with an optional ID (auto-generates if not provided)
    createEntity(id = null, isGlobal = false) {
        const entityId = id !== null ? id : `entity_${this.nextId++}`;
        let targetMap;

        if (isGlobal) {
            targetMap = this.globalEntities;
        } else {
            if (!this.entitiesByTier.has(this.activeTier)) {
                this.entitiesByTier.set(this.activeTier, new Map());
            }
            targetMap = this.entitiesByTier.get(this.activeTier);
        }

        if (targetMap.has(entityId)) {
            throw new Error(`Entity ID ${entityId} already exists in ${isGlobal ? 'global' : `tier ${this.activeTier}`}`);
        }

        const entity = new Entity(entityId);
        targetMap.set(entityId, entity);

        if (id.startsWith('level_')) {
            console.log(`EntityManager: Created entity ${id} ${isGlobal ? 'in global' : 'in tier ' + this.activeTier}`);
        }
        
        return entity;
    }

    // Remove an entity by ID
    removeEntity(id) {
        // Check global entities first
        if (this.globalEntities.has(id)) {
            this.globalEntities.delete(id);
            console.log(`EntityManager: Removed global entity ${id}`);
            return;
        }

        // Then check the active tier
        const tierMap = this.entitiesByTier.get(this.activeTier);
        if (tierMap && tierMap.has(id)) {
            tierMap.delete(id);
            console.log(`EntityManager: Removed entity ${id} from tier ${this.activeTier}`);
        } else {
            console.warn(`EntityManager: Entity ${id} not found in global or tier ${this.activeTier}`);
        }
    }

    // Get an entity by ID
    getEntity(id) {
        // Check global entities first
        if (this.globalEntities.has(id)) {
            return this.globalEntities.get(id);
        }

        // Then check the active tier
        const tierMap = this.entitiesByTier.get(this.activeTier);
        if (tierMap && tierMap.has(id)) {
            return tierMap.get(id);
        }

        return null;
    }

    // Get all entities (global + active tier)
    getAllEntities() {
        const tierEntities = this.entitiesByTier.get(this.activeTier) || new Map();
        return [...this.globalEntities.values(), ...tierEntities.values()];
    }

    // Get entities with specific component types (global + active tier)
    getEntitiesWith(componentTypes) {
        if (!Array.isArray(componentTypes)) {
            componentTypes = [componentTypes]; // Allow single type as string
        }

        const tierEntities = this.entitiesByTier.get(this.activeTier) || new Map();
        const allEntities = [...this.globalEntities.values(), ...tierEntities.values()];
        return allEntities.filter(entity => entity.hasComponents(componentTypes));
    }

    // Add a component to an entity by ID
    addComponentToEntity(entityId, component) {
        const entity = this.getEntity(entityId);
        if (!entity) {
            throw new Error(`Entity ${entityId} not found in global or tier ${this.activeTier}`);
        }
        entity.addComponent(component);

        
        //console.log(`EntityManager: Added component ${component.type} to entity ${entityId} in ${this.globalEntities.has(entityId) ? 'global' : `tier ${this.activeTier}`}`);
        return entity;
    }

    // Remove a component from an entity by ID and type
    removeComponentFromEntity(entityId, componentType) {
        const entity = this.getEntity(entityId);
        if (!entity) {
            throw new Error(`Entity ${entityId} not found in global or tier ${this.activeTier}`);
        }
        entity.removeComponent(componentType);
       // console.log(`EntityManager: Removed component ${componentType} from entity ${entityId} in ${this.globalEntities.has(entityId) ? 'global' : `tier ${this.activeTier}`}`);
        return entity;
    }

    // Clear all entities for a specific tier
    clearTier(tier) {
        if (this.entitiesByTier.has(tier)) {
            this.entitiesByTier.delete(tier);
            console.log(`EntityManager: Cleared entities for tier ${tier}`);
        }
    }

    // Clear all entities (global and all tiers)
    clear() {
        this.globalEntities.clear();
        this.entitiesByTier.clear();
        this.nextId = 0;
        this.activeTier = 0;
        console.log(`EntityManager: Cleared all entities`);
    }
}