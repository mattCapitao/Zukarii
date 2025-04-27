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
            const expiresAt = Date.now() + 69;
            entity.addComponent(new DeadComponent(expiresAt));
            if (entity.id === 'player') {
                const source = this.entityManager.getEntity(attackerId)?.getComponent('MonsterData')?.name || 'unknown';
                this.eventBus.emit('PlayerDeath', { source });
            }
        }
        if (health.updated && !entity.hasComponent('Dead')) {
            hpBar(entityId, health.hp, health.maxHp);
        }
    }

    hpBar(entityId, hp, maxHp) {
        if (!entityId) return;
        const hasHpBar = this.entityManager.getEntity(entityId).hasComponent('HealthBar');
        const fillPercent = Math.floor((hp / maxHp));
        let fillColor = 'green';
        if (fillPercent < 0.25) fillColor = 'red';
        else if (fillPercent < 0.5) fillColor = 'orange';
        else if (fillPercent < 0.75) fillColor = 'yellow'; 

        switch (hasHpBar) {
            case true:
                if (hp > 0 && hp !== maxHp) {
                    hpBar = this.entityManager.getEntity(entityId).getComponent('HealthBar');
                    hpBar.fillPercent = fillPercent;
                    hpBar.fillColor = fillColor;
                    hpBar.updated = true;
                } else {
                    this.entityManager.getEntity(entityId).removeComponent('HealthBar');
                }
                break;
            case false:
                // Add new hp bar
                if (hp > 0 && hp !== maxHp) {
                    this.entityManager.getEntity(entityId).addComponent(new HealthBarComponent(fillPercent, fillColor));
                } 
                break;
        }
    }
}