// systems/ComponentManagerSystem.js
import { System } from '../core/Systems.js';

export class ComponentManagerSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = [];
        this.queues = this.entityManager.getEntity('gameState').getComponent('DataProcessQueues') || {}
;
        this.healthUpdates = this.queues.HealthUpdates || [];
    }

    init() {
        // No events needed—game loop drives update
    }

    update(deltaTime) {
        

        if (this.healthUpdates.length > 0) {
            this.healthUpdates.forEach(({ entityId, amount }) => {
                this.modifyHealth(entityId, amount);
            });
            this.healthUpdates.length = 0; // Clear queue
            console.log('ComponentManagerSystem: Processed and cleared HealthUpdates');
        }
        // Future: this.manaUpdates.forEach(...), etc.
    }

    modifyHealth(entityId, amount) {
        const entity = this.entityManager.getEntity(entityId);
        if (!entity) {
            console.warn(`ComponentManagerSystem: Entity ${entityId} not found for modifyHealth`);
            return;
        }

        const health = entity.getComponent('Health');
        if (!health) {
            console.warn(`ComponentManagerSystem: Entity ${entityId} has no Health component`);
            return;
        }

        if (health.hp <= 0) {
            health.hp = 0; // Ensure HP doesn't go negative
            // Optionally, you could emit an event or log a message here
            console.warn(`ComponentManagerSystem: Entity ${entityId} is already dead, cannot modify health`);
            return;
        }

        health.hp = Math.min(Math.max(health.hp + amount, 0), health.maxHp);
        console.log(`ComponentManagerSystem: Modified health for ${entityId} by ${amount}. Now: ${health.hp}/${health.maxHp}`);
        /*
        if (health.hp > 0) {
            this.eventBus.emit('LogMessage', {
                message: `Health changed for ${entityId} by ${amount} (${health.hp}/${health.maxHp})`
            });
        }
        */
    }
}