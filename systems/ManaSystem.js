import { System } from '../core/Systems.js';

export class ManaSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = [];
        this.queues = this.entityManager.getEntity('gameState').getComponent('DataProcessQueues') || {};
        this.manaUpdates = this.queues.ManaUpdates || [];
        this.manaRegenAccumulator = {};
        this.manaRegenBuffer = {}; // Buffer to accumulate regen before applying
    }

    update(deltaTime) {
        if (this.manaUpdates.length > 0) {
            this.manaUpdates.forEach(({ entityId, amount, attackerId }) => {
               // //console.log(`ManaSystem: Processing ManaUpdate - entityId: ${entityId}, amount: ${amount}, attackerId: ${attackerId}`);
                this.modifyMana(entityId, amount, attackerId);
            });
            this.manaUpdates.length = 0;
           // //console.log('ManaSystem: Processed and cleared ManaUpdates');
        }

        // Handle mana regeneration
        const entities = this.entityManager.getEntitiesWith(['Mana']);
        entities.forEach(entity => {
            const mana = entity.getComponent('Mana');
            if (!mana.manaRegen || mana.manaRegen <= 0) return;
            if (!this.manaRegenAccumulator[entity.id]) {
                this.manaRegenAccumulator[entity.id] = 0;
                this.manaRegenBuffer[entity.id] = 0;
            }
            if (mana.mana >= mana.maxMana) {
                this.manaRegenAccumulator[entity.id] = 0;
                this.manaRegenBuffer[entity.id] = 0;
                mana.updated = false;
                return;
            }

            const timePerMana = 1 / mana.manaRegen; // e.g., 4 seconds for 1 mana
            this.manaRegenAccumulator[entity.id] += deltaTime;

            if (this.manaRegenAccumulator[entity.id] >= timePerMana) {
                const regenTicks = Math.floor(this.manaRegenAccumulator[entity.id] / timePerMana);
                const manaToRegen = regenTicks; // Typically 1 per 4 seconds
                this.manaRegenBuffer[entity.id] += manaToRegen;

                // Apply regen only when buffer reaches 2 mana (e.g., every 8 seconds)
                if (this.manaRegenBuffer[entity.id] >= 1) {
                    this.modifyMana(entity.id, this.manaRegenBuffer[entity.id], null);
                    this.manaRegenBuffer[entity.id] = 0;
                   // //console.log(`ManaSystem: Applied buffered regen for entity ${entity.id}, amount: ${manaToRegen}`);
                }

                this.manaRegenAccumulator[entity.id] -= regenTicks * timePerMana;
            }
        });
    }

    modifyMana(entityId, amount, attackerId) {
        const entity = this.entityManager.getEntity(entityId);
        if (!entity || entity.hasComponent('Dead')) return;
        const mana = entity.getComponent('Mana');
        if (!mana) return;

        const oldMana = mana.mana;
        mana.mana = Math.min(Math.max(mana.mana + amount, 0), mana.maxMana);
        // Only set updated if mana changes by at least 1
        mana.updated = Math.abs(mana.mana - oldMana) >= 1;
        if (mana.updated) {
           // //console.log(`ManaSystem: Modified mana for entity ${entityId} by ${amount}. New mana: ${mana.mana}/${mana.maxMana}`);
        }
    }
}