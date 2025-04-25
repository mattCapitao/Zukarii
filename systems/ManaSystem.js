// systems/HealthSystem.js
import { System } from '../core/Systems.js';
import { DeadComponent } from '../core/Components.js';

export class HealthSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = [];
        this.queues = this.entityManager.getEntity('gameState').getComponent('DataProcessQueues') || {}
            ;
        this.manaUpdates = this.queues.HealthUpdates || [];
    }

    update(deltaTime) {


        if (this.manaUpdates.length > 0) {
            this.manaUpdates.forEach(({ entityId, amount, attackerId }) => {
                this.modifyHealth(entityId, amount, attackerId);
            });
            this.manaUpdates.length = 0; // Clear queue
            console.log('HealthSystem: Processed and cleared HealthUpdates');
        }
        // Future: this.manaUpdates.forEach(...), etc.
    }


    modifyHealth(entityId, amount, attackerId) {
        const entity = this.entityManager.getEntity(entityId);
        if (!entity || entity.hasComponent('Dead')) return;
        const mana = entity.getComponent('Health');
        if (!mana) return;
        const oldHp = mana.hp;
        mana.hp = Math.min(Math.max(mana.hp + amount, 0), mana.maxHp);
        mana.updated = true;
        if (mana.hp === 0 && oldHp > 0) {
            const expiresAt = Date.now() + 69;
            entity.addComponent(new DeadComponent(expiresAt));
            if (entity.id === 'player') {
                const source = this.entityManager.getEntity(attackerId)?.getComponent('MonsterData')?.name || 'unknown';
                this.eventBus.emit('PlayerDeath', { source });
            }
        }
    }
}