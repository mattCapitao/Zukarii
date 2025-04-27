import { System } from '../core/Systems.js';
import { DeadComponent, HpBarComponent } from '../core/Components.js';

export class HealthSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = [];
        this.queues = this.entityManager.getEntity('gameState').getComponent('DataProcessQueues') || {};
        this.healthUpdates = this.queues.HealthUpdates || [];
    }

    init() {
        this.eventBus.on('UpdateHpBar', (data) => this.updateHealthBar(data));
    }

    update(deltaTime) {
        if (this.healthUpdates.length > 0) {
            this.healthUpdates.forEach(({ entityId, amount, attackerId }) => {
                this.modifyHealth(entityId, amount, attackerId);
            });
            this.healthUpdates.length = 0; // Clear queue
            console.log('HealthSystem: Processed and cleared HealthUpdates');
        }
    }

    modifyHealth(entityId, amount, attackerId) {
        const entity = this.entityManager.getEntity(entityId);
        if (!entity || entity.hasComponent('Dead')) return;
        const health = entity.getComponent('Health');
        if (!health) return;

        const oldHp = health.hp;
        health.hp = Math.min(Math.max(health.hp + amount, 0), health.maxHp);
        health.updated = true;

        // Update or add HpBarComponent based on health status
        this.updateHealthBar(entityId, health.hp, health.maxHp, oldHp);

        if (health.hp === 0 && oldHp > 0) {
            const expiresAt = Date.now() + 69;
            entity.addComponent(new DeadComponent(expiresAt));
            entity.removeComponent('HpBar'); // Remove health bar on death
            if (entity.id === 'player') {
                const source = this.entityManager.getEntity(attackerId)?.getComponent('MonsterData')?.name || 'unknown';
                this.eventBus.emit('PlayerDeath', { source });
            }
        }
    }

    updateHealthBar(entityId, hp, maxHp, oldHp) {
        if (!entityId) return;
        const entity = this.entityManager.getEntity(entityId);
        if (!entity || entity.hasComponent('Dead')) return;

        const fillPercent = hp / maxHp; // Value between 0 and 1
        const lastFillPercent =  oldHp / maxHp;
        let fillColor = 'green';
        if (fillPercent < 0.40) fillColor = 'red';
        else if (fillPercent < 0.60) fillColor = 'orange';
        else if (fillPercent < 0.80) fillColor = 'yellow';

        let lastFillColor = 'green';
        if (lastFillPercent < 0.40) lastFillColor = 'red';
        else if (lastFillPercent < 0.60) lastFillColor = 'orange';
        else if (lastFillPercent < 0.80) lastFillColor = 'yellow';
        // Check if the entity has a Health component



        if (hp > 0 && hp < maxHp) {
            // Add or update HpBarComponent
            if (entity.hasComponent('HpBar')) {
                const hpBar = entity.getComponent('HpBar');
                hpBar.lastFillColor = hpBar.fillColor;
                hpBar.lastFillPercent = hpBar.fillPercent;
                hpBar.fillPercent = fillPercent;
                hpBar.fillColor = fillColor;
                hpBar.animationStartTime = Date.now(); // Start animation
                hpBar.updated = true;
            } else {
                entity.addComponent(new HpBarComponent(fillPercent, fillColor, lastFillPercent, lastFillColor));
                const hpBar = entity.getComponent('HpBar');
                hpBar.animationStartTime = Date.now(); // Start animation
                hpBar.updated = true;
            }
            console.log(`HealthSystem: Updated HpBar for ${entityId} - fillPercent: ${fillPercent}, fillColor: ${fillColor}`);
        } else {
            // Remove HpBarComponent if health is full or zero
            entity.removeComponent('HpBar');
            console.log(`HealthSystem: Removed HpBar for ${entityId} - hp: ${hp}, maxHp: ${maxHp}`);
        }
    }
}