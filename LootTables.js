console.log("LootTables.js loaded");

import { State } from './State.js';

export class LootTables {
    constructor(state) {
        this.state = state;
        this.data = this.state.game.getService('data');
        this.utilities = this.state.utilities;

        this.itemTiers = ['junk', 'common', 'rare', 'magic', 'mastercraft', 'legendary', 'relic', 'artifact'];
        this.itemTypes = ['weapon', 'armor', 'amulet', 'ring'];

        this.getTierTables = [
            (roll) => {
                if (roll < 0.60) return 0;  // junk
                if (roll < 0.95) return 1;  // common
                if (roll < 0.995) return 2; // rare
                if (roll >= 0.995) return 3; // magic
                return 1;                   // common (default for NaN/edge cases)
            },
            (roll) => {
                if (roll < 0.40) return 0;  // junk
                if (roll < 0.75) return 1;  // common
                if (roll < 0.95) return 2;  // rare
                if (roll < 0.98) return 3;  // magic
                if (roll >= 0.99) return 4; // mastercraft
                return 1;                   // common (default)
            },
            (roll) => {
                if (roll < 0.15) return 0;  // junk
                if (roll < 0.78) return 1;  // common
                if (roll < 0.93) return 2;  // rare
                if (roll < 0.98) return 3;  // magic
                if (roll < 0.99) return 4;  // mastercraft
                if (roll < 0.996) return 5; // legendary
                if (roll < 0.998) return 6; // relic
                if (roll >= 0.999) return 7; // artifact
                return 1;                   // common (default)
            },
            (roll) => {
                if (roll < 0.67) return 2;  // rare
                if (roll < 0.87) return 3;  // magic
                if (roll < 0.93) return 4;  // mastercraft
                if (roll < 0.97) return 5;  // legendary
                if (roll < 0.99) return 6;  // relic
                if (roll >= 0.99) return 7; // artifact
                return 1;                   // common (default)
            }
        ];
    }

    getLuckyTier() {
        let luck = this.state.player.luck * 0.1;
        return Math.floor(this.state.utilities.dRoll(100, 1, luck) / 100);
    }

    getItemTier() {
        console.log("getItemTier() called");
        let tableIndex = 0;
        switch (true) {
            case this.state.tier < 2:
                tableIndex = 0;
                break;
            case this.state.tier < 3:
                tableIndex = 1;
                break;
            case this.state.tier >= 3:
                tableIndex = 2;
                break;
            default:
                tableIndex = 0;
        }

        tableIndex += this.getLuckyTier();
        tableIndex = Math.min(Math.max(tableIndex, 0), this.getTierTables.length - 1);

        const lootTable = this.getTierTables[tableIndex];
        const roll = Math.random();

        console.log(`Table Index: ${tableIndex}, Roll: ${roll}`);

        const itemTier = lootTable(roll);
        console.log(`Item Tier: ${itemTier}`);

        return itemTier // Returns tier index (0-7)
    }
}