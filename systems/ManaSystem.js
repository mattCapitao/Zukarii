// systems/ManaSystem.js
import { System } from '../core/Systems.js';

export class ManaSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = [];
        this.queues = this.entityManager.getEntity('gameState').getComponent('DataProcessQueues') || {};
        this.manaUpdates = this.queues.ManaUpdates || [];
        this.manaRegenAccumulator = {};
    }

    update(deltaTime) {

        if (this.manaUpdates.length > 0) {
            this.manaUpdates.forEach(({ entityId, amount, attackerId }) => {
                this.modifyMana(entityId, amount, attackerId);
            });
            this.manaUpdates.length = 0; // Clear queue
            console.log('ManaSystem: Processed and cleared ManaUpdates');
        }

        // Handle mana regeneration
        const entities = this.entityManager.getEntitiesWith(['Mana']);
        entities.forEach(entity => {
            const mana = entity.getComponent('Mana');
            if (!mana.manaRegen || mana.manaRegen <= 0) return;

            const timePerMana = 1 / mana.manaRegen; 

            if (!this.manaRegenAccumulator[entity.id]) { this.manaRegenAccumulator[entity.id] = 0;}
            this.manaRegenAccumulator[entity.id] += deltaTime;

            if (this.manaRegenAccumulator[entity.id] >= timePerMana) {
                const regenTicks = Math.floor(this.manaRegenAccumulator[entity.id] / timePerMana); // Number of whole seconds
                const manaToRegen = regenTicks;

                mana.mana = Math.min(mana.mana + manaToRegen, mana.maxMana);
                mana.updated = true;

                console.log(`ManaSystem: Regenerated ${manaToRegen} mana for entity ${entity.id}. Current mana: ${mana.mana}/${mana.maxMana}`);

                this.manaRegenAccumulator[entity.id] -= regenTicks * timePerMana;
            }
        });
    }

    modifyMana(entityId, amount, attackerId) {
        const entity = this.entityManager.getEntity(entityId);
        if (!entity || entity.hasComponent('Dead')) return;
        const mana = entity.getComponent('Mana');
        if (!mana) return;
        mana.mana = Math.min(Math.max(mana.mana + amount, 0), mana.maxMana);
        mana.updated = true;
    }
}