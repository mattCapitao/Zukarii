// systems/LootTableSystem.js
// Manages loot tier generation

import { System } from '../core/Systems.js';

export class LootTableSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = []; // No entity requirements, acts as a utility

        this.itemTiers = ['junk', 'common', 'rare', 'magic', 'mastercraft', 'legendary', 'relic', 'artifact'];
        this.tierTables = [
            (roll) => roll < 0.60 ? 0 : roll < 0.95 ? 1 : roll < 0.995 ? 2 : 3, // Tier 0-1
            (roll) => roll < 0.40 ? 0 : roll < 0.75 ? 1 : roll < 0.95 ? 2 : roll < 0.98 ? 3 : 4, // Tier 2
            (roll) => roll < 0.15 ? 0 : roll < 0.55 ? 1 : roll < 0.90 ? 2 : roll < 0.95 ? 3 : roll < 0.98 ? 4 : roll < 0.996 ? 5 : roll < 0.998 ? 6 : 7, // Tier 3+
            (roll) => roll < 0.67 ? 2 : roll < 0.87 ? 3 : roll < 0.93 ? 4 : roll < 0.97 ? 5 : roll < 0.99 ? 6 : 7 // High-tier adjustment
        ];
    }

    init() {
        this.eventBus.on('GetItemTier', (data) => this.getItemTier(data));
    }

    getItemTier({ callback }) {
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const player = this.entityManager.getEntity('player');
        const state = this.entityManager.getEntity('state');

        let tableIndex = gameState.tier < 2 ? 0 : gameState.tier < 3 ? 1 : 2;
        tableIndex = Math.min(tableIndex + this.getLuckyTier(player), this.tierTables.length - 1);

        const roll = Math.random();
        const tierIndex = this.tierTables[tableIndex](roll);
        callback(tierIndex); // Returns tier index (0-7)
    }

    getLuckyTier(player) {
        const stats = player.getComponent('Stats');
        const luck = stats.luck * 0.1;
        const roll = state.utilities.dRoll(100, 1, luck);
        return Math.floor(roll / 100);
    }
}