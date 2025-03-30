// systems/ItemROGSystem.js
import { System } from '../core/Systems.js';

export class ItemROGSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus, utilities);
        this.itemStatOptions = null; // Initialize as null, will be set asynchronously
    }

    async init() {
        await this.requestItemStatOptions(); // Wait for itemStatOptions to be loaded
        this.eventBus.on('GenerateROGItem', ({ partialItem, dungeonTier, callback }) => {
            const item = this.generateRogItem({ partialItem, dungeonTier });
            callback(item);
        });
    }

    async requestItemStatOptions() {
        return new Promise((resolve) => {
            this.eventBus.emit('GetItemStatOptions', {
                callback: (itemStatOptions) => {
                    this.itemStatOptions = itemStatOptions;
                    console.log('ItemROGSystem: Received Item stat options:', this.itemStatOptions);
                    resolve(); // Resolve the promise once data is received
                }
            });
        });
    }

    generateRogItem({ partialItem = { tierIndex: 0 }, dungeonTier }) {
        if (!this.itemStatOptions) {
            console.warn('ItemROGSystem: itemStatOptions not loaded, using fallback behavior');
            return this.generateFallbackItem(partialItem, dungeonTier); // Fallback if data isn’t available
        }

        const item = { ...partialItem };
        const itemTiers = ['junk', 'common', 'rare', 'magic', 'mastercraft', 'legendary', 'relic', 'artifact'];
        const itemTypes = ['weapon', 'armor', 'amulet', 'ring'];

        // Tier handling
        if (item.tierIndex === undefined) {
            console.warn("tierIndex missing in partialItem, defaulting to 0 (junk)");
            item.tierIndex = 0;
        }
        item.itemTier = itemTiers[item.tierIndex];
        if (partialItem.itemTier && partialItem.itemTier !== item.itemTier) {
            console.warn(`Tier mismatch: partialItem.itemTier '${partialItem.itemTier}' ignored, using tierIndex ${item.tierIndex} ('${item.itemTier}')`);
        }

        // Type handling
        if (item.type) {
            if (!itemTypes.includes(item.type)) {
                console.warn(`Invalid type '${item.type}' provided, randomizing instead`);
                delete item.type;
            }
        }
        if (!item.type) {
            item.type = itemTypes[Math.floor(Math.random() * itemTypes.length)];
            if (item.tierIndex < 2) {
                if (item.type === 'ring') item.type = 'weapon';
                if (item.type === 'amulet') item.type = 'armor';
            }
        }

        // Base stats and weapon-specific logic
        let statOptions = this.itemStatOptions[item.type];
        if (item.type === 'weapon') {
            if (item.attackType) {
                if (!['melee', 'ranged'].includes(item.attackType)) {
                    console.warn(`Invalid attackType '${item.attackType}' provided, randomizing instead`);
                    delete item.attackType;
                }
            }
            if (!item.attackType) {
                item.attackType = Math.random() < 0.5 ? 'melee' : 'ranged';
            }
            statOptions = statOptions[item.attackType];
            if (item.baseDamageMin === undefined || item.baseDamageMin === 0) {
                item.baseDamageMin = Math.floor(Math.random() * 2) + this.statRoll("baseDamageMin", item) || 1;
                if (item.tierIndex === 0) item.baseDamageMin = 1;
            }
            if (item.baseDamageMax === undefined || item.baseDamageMax === 0) {
                item.baseDamageMax = item.baseDamageMin + Math.floor(Math.random() * 5) + this.statRoll("baseDamageMax", item);
                if (item.tierIndex === 0) item.baseDamageMax = item.baseDamageMin + 1;
                if (item.tierIndex === 0 && item.attackType === 'ranged') item.baseDamageMax++;
            }
            item.icon = item.attackType === 'melee' ? 'dagger.svg' : 'orb-wand.svg';
            if (item.attackType === 'melee' && (item.baseBlock === undefined || item.baseBlock === 0)) {
                item.baseBlock = Math.floor(Math.random() * 2) + this.statRoll("baseBlock", item);
                if (item.tierIndex === 0) item.baseBlock = 1;
            }
            if (item.attackType === 'ranged' && (item.baseRange === undefined || item.baseRange === 0)) {
                item.baseRange = Math.floor(Math.random() * 2) + this.statRoll("baseRange", item);
                if (item.tierIndex === 0 && item.baseRange > 3) item.baseRange = 3;
            }
        } else if (item.type === 'armor') {
            if (item.armor === undefined || item.armor === 0) {
                item.armor = Math.floor(Math.random() * 2) + this.statRoll("armor", item);
                if (item.tierIndex === 0) item.armor = 1;
            }
            item.icon = 'armor.svg';
        } else if (item.type === 'amulet' || item.type === 'ring') {
            if (item.maxLuck === undefined || item.maxLuck === 0) {
                item.maxLuck = this.rollMaxLuck(item, dungeonTier);
            }
            item.icon = item.type === 'amulet' ? 'amulet.svg' : 'ring.svg';
        }

        // Bonus stats
        if (!item.stats || Object.keys(item.stats).length === 0) {
            if (item.tierIndex > 1) {
                item.stats = this.getBonusStats(statOptions.bonus, item);
            }
        }

        // Required properties
        item.name = item.name || `${item.itemTier} ${item.type}`;
        item.uniqueId = item.uniqueId || this.utilities.generateUniqueId();
        item.description = item.description || `${item.itemTier} ${item.type}`;

        console.log(`ItemROGSystem: Generated item:`, item);
        return item;
    }

    getBonusStats(statArray, item) {
        if (!this.itemStatOptions || !statArray) {
            console.warn('ItemROGSystem: itemStatOptions or statArray not available, returning empty stats');
            return {};
        }
        console.log(`getBonusStats() called with statArray:`, statArray, `for item:`, item);
        const itemTier = item.tierIndex;
        let availableStats = [...statArray];
        let selectedStats = {};

        const count = itemTier;
        for (let i = 0; i < count && availableStats.length > 0; i++) {
            const index = Math.floor(Math.random() * availableStats.length);
            const stat = availableStats.splice(index, 1)[0];
            const statValue = this.statRoll(stat, item);

            if (selectedStats.hasOwnProperty(stat)) {
                selectedStats[stat] += statValue;
            } else {
                selectedStats[stat] = statValue;
            }
        }
        console.log(`Returning selected stats:`, selectedStats);
        return selectedStats;
    }

    rollMaxLuck(item, dungeonTier) {
        const baseRoll = Math.floor(Math.random() * 12) - 4;
        const tierFactor = item.tierIndex + Math.floor(dungeonTier / 5);
        const positiveCap = tierFactor * 2 + 1;
        const negativeCap = -Math.floor(tierFactor * 2 / 3);
        let scaledRoll = baseRoll < 0 ? baseRoll : baseRoll + 1;
        scaledRoll = Math.max(Math.min(scaledRoll, positiveCap), negativeCap);
        const finalRoll = scaledRoll + Math.floor(Math.random() * 2);
        const rangeWidth = positiveCap - negativeCap + 1;
        const gapSize = Math.floor(rangeWidth * 0.5);
        const centerThresholdLow = Math.floor((negativeCap + positiveCap) / 2 - gapSize / 2);
        const centerThresholdHigh = centerThresholdLow + gapSize - 1;
        return (finalRoll >= centerThresholdLow && finalRoll <= centerThresholdHigh) ? 0 : finalRoll;
    }

    statRoll(stat, item) {
        if (item[stat] !== undefined && item[stat] !== 0) return 0; // Skip base stats if provided and non-zero

        switch (stat) {
            case 'baseDamageMin': return Math.floor(item.tierIndex * 1.5);
            case 'baseDamageMax': return Math.floor(Math.random() * item.tierIndex) + 1;
            case 'baseBlock': return Math.floor(item.tierIndex) + 1;
            case 'baseRange': return Math.floor(item.tierIndex) + 4;
            case 'armor': return Math.floor(item.tierIndex) + 1;
            case 'maxHp': return item.tierIndex * 5 + Math.round(Math.random() * (item.tierIndex * 5));

            case 'maxMana': return Math.floor(item.tierIndex / 2);
            case 'prowess': return Math.floor(item.tierIndex / 2);
            case 'agility': return Math.floor(item.tierIndex / 2);
            case 'intellect': return Math.floor(item.tierIndex / 2);

            case 'range': return randomizeStatRoll(Math.round(item.tierIndex * .5), item);
            case 'block': return randomizeStatRoll(Math.round(item.tierIndex * .5), item);
            case 'defense': return randomizeStatRoll(Math.round(item.tierIndex * .5), item);

            case 'damageBonus': return randomizeStatRoll((item.tierIndex + 1), item);
            case 'meleeBonus': return randomizeStatRoll((item.tierIndex + 1), item);
            case 'rangedBonus': return randomizeStatRoll((item.tierIndex + 1), item);
            case 'resistMagic': return randomizeStatRoll((item.tierIndex + 1), item); 
            
            default:
                console.log(`Stat ${stat} not found while attempting to generate a value for use on ${item}`);
                return 0;
        }
    }

    randomizeStatRoll(max, item) {
        const baseroll = Math.floor(Math.random() * max) + 1;
        let roll = baseroll;

        if (item.tierIndex >= 3 && roll < (max - 1) && Math.random() < .05) {
            roll++;
        } else if ((item.tierIndex >= 3 && roll < (max - 1) && Math.random() < .01)) {
            roll++;
        } else if (item.tierIndex >= 3 && roll === max && Math.random() < .001) {
            roll++;
        }
        if (item.tierIndex >= 5 && roll < max && Math.random() < .005) { roll++; }
        return roll;
    }

    // Fallback method if itemStatOptions is not available
    generateFallbackItem(partialItem, dungeonTier) {
        const item = { ...partialItem };
        item.tierIndex = item.tierIndex || 0;
        item.itemTier = ['junk', 'common', 'rare', 'magic', 'mastercraft', 'legendary', 'relic', 'artifact'][item.tierIndex];
        item.type = item.type || ['weapon', 'armor'][Math.floor(Math.random() * 2)];
        item.name = `${item.itemTier} ${item.type}`;
        item.uniqueId = this.utilities.generateUniqueId();
        item.description = `${item.itemTier} ${item.type}`;
        console.warn('ItemROGSystem: Generated fallback item:', item);
        return item;
    }
}