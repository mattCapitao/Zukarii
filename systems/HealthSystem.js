// systems/HealthSystem.js
import { System } from '../core/Systems.js';
import { DeadComponent } from '../core/Components.js';

export class HealthSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = [];
        this.queues = this.entityManager.getEntity('gameState').getComponent('DataProcessQueues') || {}
;
        this.healthUpdates = this.queues.HealthUpdates || [];
    }

    update(deltaTime) {
        

        if (this.healthUpdates.length > 0) {
            this.healthUpdates.forEach(({ entityId, amount, attackerId }) => {
                this.modifyHealth(entityId, amount, attackerId);
            });
            this.healthUpdates.length = 0; // Clear queue
            console.log('HealthSystem: Processed and cleared HealthUpdates');
        }
        // Future: this.manaUpdates.forEach(...), etc.
    } 

   
    modifyHealth(entityId, amount, attackerId) {
        const entity = this.entityManager.getEntity(entityId);
        if (!entity || entity.hasComponent('Dead')) return;
        const health = entity.getComponent('Health');
        if (!health) return;
        const oldHp = health.hp;
        health.hp = Math.min(Math.max(health.hp + amount, 0), health.maxHp);
        health.updated = true;
        if (health.hp === 0 && oldHp > 0) {
            const expiresAt = Date.now() + 1000;
            entity.addComponent(new DeadComponent(expiresAt));
            if (entity.id === 'player') {
                const source = this.entityManager.getEntity(attackerId)?.getComponent('MonsterData')?.name || 'unknown';
                this.eventBus.emit('PlayerDeath', { source });
            }
        }
    }
}