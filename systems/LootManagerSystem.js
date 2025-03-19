import { System } from '../core/Systems.js';
import { PositionComponent, LootData } from '../core/Components.js';

export class LootManagerSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.tierTables = [
            (roll) => {
                if (roll < 0.60) return 0;  // junk
                if (roll < 0.95) return 1;  // common
                if (roll < 0.995) return 2; // rare
                if (roll >= 0.995) return 3; // magic
                return 1;                   // common (default)
            },
            (roll) => {
                if (roll < 0.40) return 0;  // junk
                if (roll < 0.75) return 1;  // common
                if (roll < 0.95) return 2;  // rare
                if (roll < 0.98) return 3;  // magic
                if (roll >= 0.98) return 4; // mastercraft
                return 1;                   // common (default)
            },
            (roll) => {
                if (roll < 0.15) return 0;  // junk
                if (roll < 0.55) return 1;  // common
                if (roll < 0.90) return 2;  // rare
                if (roll < 0.95) return 3;  // magic
                if (roll < 0.98) return 4;  // mastercraft
                if (roll < 0.996) return 5; // legendary
                if (roll < 0.998) return 6; // relic
                if (roll >= 0.998) return 7; // artifact
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
        this.itemTiers = ['junk', 'common', 'rare', 'magic', 'mastercraft', 'legendary', 'relic', 'artifact'];
        this.uniqueItems = [
            { name: "Mbphu Greater iLvl Annihilation Staff", type: "weapon", attackType: "ranged", baseRange: 7, slots: ["mainhand", "offhand"], baseDamageMin: 10, baseDamageMax: 15, itemTier: "relic", stats: { intellect: 5, maxMana: 5, agility: 5, damageBonus: 5, rangedDamageBonus: 5 }, description: "The Golden Khepresh has got nothing on this babby!", uniqueId: null, icon: "mbphu-staff.svg" },
            { name: "The Preciousss", type: "ring", slot: "ring", luck: -15, itemTier: "relic", stats: { maxHp: 20, damageBonus: 10 }, description: "A plain simple gold band, that you mussst possesss.", uniqueId: null, icon: "golden-khepresh.svg" }
        ];
        this.utilities = this.entityManager.getEntity('state').getComponent('Utilities').utilities;
    }

    init() {
        this.eventBus.on('DropLoot', (data) => this.handleLootDrop(data));
    }

    handleLootDrop({ lootSource }) {
        const sourceData = lootSource.getComponent('LootSourceData');
        if (!sourceData) {
            console.error('LootManagerSystem: No LootSourceData found on lootSource entity');
            return;
        }

        if (Math.random() >= 0.85) {
            this.eventBus.emit('LogMessage', { message: `The ${sourceData.name} dropped nothing.` });
            return;
        }

        const player = this.entityManager.getEntity('player');
        const playerResource = player ? player.getComponent('Resource') : { torches: 0, healPotions: 0 };
        const playerState = player ? player.getComponent('PlayerState') : { torchLit: false };
        const playerHealth = player ? player.getComponent('Health') : { hp: 0, maxHp: 1 };

        const modifiers = sourceData.chanceModifiers || {};
        const gold = this.calculateGoldGain(modifiers.gold || 1);
        const torches = this.calculateTorchDrop(playerResource, playerState, modifiers.torches || 1);
        const healPotions = this.calculatePotionDrop(playerResource, playerHealth, modifiers.healPotions || 1);

        let items = [];
        if (Math.random() < this.calculateItemChance(modifiers.item || 1)) {
            for (let i = 0; i < sourceData.maxItems; i++) {
                const tierIndex = this.getItemTier(sourceData.tier, player);
                if (tierIndex >= 0) {
                    if (tierIndex <= 4) {
                        this.eventBus.emit('GenerateROGItem', {
                            tierIndex,
                            dungeonTier: sourceData.tier,
                            callback: (item) => {
                                if (item) items.push(item);
                            }
                        });
                    } else if (Math.random() < this.calculateUniqueItemChance(modifiers.uniqueItem || 1)) {
                        const item = this.getUniqueItem({ tierIndex, hasCustomUnique: sourceData.hasCustomUnique, uniqueItemIndex: sourceData.uniqueItemIndex });
                        if (item) items.push(item);
                    }
                }
            }
        }

        const uniqueId = this.generateUniqueId(); // Use SL-style ID
        const lootEntity = this.entityManager.createEntity(`loot_${sourceData.tier}_${uniqueId}`);
        const position = new PositionComponent(sourceData.position.x, sourceData.position.y);
        const lootData = new LootData({
            name: `The ${sourceData.name} Loot`,
            gold,
            torches,
            healPotions,
            items
        });
        this.entityManager.addComponentToEntity(lootEntity.id, position);
        this.entityManager.addComponentToEntity(lootEntity.id, lootData);

        const dropMessage = [
            gold ? `${gold} gold` : '',
            torches ? `${torches} torch${torches > 1 ? 'es' : ''}` : '',
            healPotions ? `${healPotions} heal potion${healPotions > 1 ? 's' : ''}` : '',
            items.length ? items.map(i => i.name).join(', ') : ''
        ].filter(Boolean).join(', ');
        this.eventBus.emit('LogMessage', { message: `The ${sourceData.name} dropped ${dropMessage}!` });

        this.eventBus.emit('SpawnLoot', {
            treasure: lootEntity,
            tier: sourceData.tier
        });
    }

    generateUniqueId() {
        const time = Date.now().toString(36);
        const rand1 = Math.random().toString(36).substring(2, 8);
        const rand2 = Math.random().toString(36).substring(2, 8);
        return `${time}-${rand1}-${rand2}`;
    }

    calculateTorchDrop(resource, state, multiplier) {
        let torchChance;
        if (resource.torches === 0 && !state.torchLit) {
            torchChance = 0.20;
            resource.torchDropFail = (resource.torchDropFail || 0) + 1;
            if (resource.torchDropFail >= 3) {
                resource.torches = 1;
                resource.torchDropFail = 0;
                this.eventBus.emit('LogMessage', { message: 'You found a discarded torch lying on the ground!' });
                return 1; // Mercy torch
            }
        } else if (resource.torches < 2) {
            torchChance = 0.125;
        } else if (resource.torches <= 5) {
            torchChance = 0.075;
        } else {
            torchChance = 0.025;
        }
        return Math.random() < torchChance * multiplier ? 1 : 0;
    }

    calculatePotionDrop(resource, health, multiplier) {
        let chance = 0.05;
        switch (true) {
            case resource.healPotions === 0: chance = 0.5; break;
            case resource.healPotions < 3: chance = 0.30; break;
            case resource.healPotions < 5: chance = 0.125; break;
            default: chance = 0.05;
        }
        switch (true) {
            case health.hp / health.maxHp < 0.5: chance += 0.1;
            case health.hp / health.maxHp < 0.25: chance += 0.1;
            case health.hp / health.maxHp < 0.1: chance += 0.1;
        }
        return Math.random() < chance * multiplier ? 1 : 0;
    }

    calculateGoldGain(multiplier) {
        return Math.random() < 0.85 * multiplier ? 10 + Math.floor(Math.random() * 41) + this.entityManager.getEntity('gameState').getComponent('GameState').tier * 10 : 0;
    }

    calculateItemChance(multiplier) {
        return 1; // Always drop an item for testing
    }

    calculateUniqueItemChance(multiplier) {
        return 1; // Always drop a unique item for testing
    }

    getItemTier(dungeonTier, player) {
        console.log("getItemTier() called");
        let tableIndex = 0;
        switch (true) {
            case dungeonTier < 2:
                tableIndex = 0;
                break;
            case dungeonTier < 3:
                tableIndex = 1;
                break;
            case dungeonTier >= 3:
                tableIndex = 2;
                break;
            default:
                tableIndex = 0;
        }

        tableIndex += this.getLuckyTier(player);
        tableIndex = Math.min(Math.max(tableIndex, 0), this.tierTables.length - 1);

        const roll = Math.random();
        console.log(`LootManagerSystem: tableIndex=${tableIndex}, dungeonTier=${dungeonTier}, luckAdjustment=${this.getLuckyTier(player)}, roll=${roll}`);
        return this.tierTables[tableIndex](roll);
    }

    getLuckyTier(player) {
        if (!player) return 0;
        const stats = player.getComponent('Stats');
        const luck = stats.luck * 0.1;
        return Math.floor(this.utilities.dRoll(100, 1, luck) / 100);
    }

    getUniqueItem({ tierIndex, hasCustomUnique = false, uniqueItemIndex = 0 }) {
        if (hasCustomUnique) {
            console.warn('Custom unique not implemented yet, falling back to default uniqueItems');
        }
        const tier = this.itemTiers[tierIndex];
        const uniqueItem = this.uniqueItems.find(i => i.itemTier === tier);
        if (!uniqueItem) return null;
        return { ...uniqueItem, uniqueId: this.utilities.generateUniqueId() };
    }
}