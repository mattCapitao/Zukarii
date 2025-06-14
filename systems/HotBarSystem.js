// systems/HotBarSystem.js

import { System } from '../core/Systems.js';

export class HotBarSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus, utilities);
        this.requiredComponents = ['HotBarIntent'];
    }

    update(deltaTime) {
        // Get all entities with HotBarIntent
        const entities = this.entityManager.getEntitiesWith(this.requiredComponents);
        for (const entity of entities) {
            const intent = entity.getComponent('HotBarIntent');
            if (!intent) {
                return;
            }  
            const hotBarKey = intent.hotBarKey; // e.g., 1, 2, 3, etc.
            // Find the corresponding .hotbar-slot element
            const slot = document.querySelector(`.hotbar-slot[data-hotbar-id="${hotBarKey}"]`);
            if (slot) {
                const data = slot.getAttribute('data-hotbar-data');
                //console.log(`Hotbar Key ${hotBarKey}:`, data);
            } else {
                //console.log(`No hotbar slot found for key: ${hotBarKey}`);
            }
            entity.removeComponent('HotBarIntent');
        }
    }
}
