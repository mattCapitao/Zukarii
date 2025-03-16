// systems/ItemSystem.js
// Manages RNG, unique item lookups, and ROG item generation

import { System } from '../core/Systems.js';

export class ItemSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Inventory']; // For entities that can hold items
        this.itemTiers = ['junk', 'common', 'rare', 'magic', 'mastercraft', 'legendary', 'relic', 'artifact'];
        this.itemTypes = ['weapon', 'armor', 'amulet', 'ring'];
        this.weaponAttackTypes = ['melee', 'ranged'];

        // Static data from Data.js (simplified for now, to be sourced later)
        this.uniqueItems = [
            { name: "Mbphu Greater iLvl Annihilation Staff", type: "weapon", attackType: "ranged", baseRange: 7, slots: ["mainhand", "offhand"], baseDamageMin: 10, baseDamageMax: 15, itemTier: "relic", stats: { intellect: 5, maxMana: 5, agility: 5, damageBonus: 5, rangedDamageBonus: 5 }, description: "The Golden Khepresh has got nothing on this babby!", uniqueId: null, icon: "mbphu-staff.svg" },
            { name: "The Preciousss", type: "ring", slot: "ring", luck: -15, itemTier: "relic", stats: { maxHp: 20, damageBonus: 10 }, description: "A plain simple gold band, that you mussst possesss.", uniqueId: null, icon: "golden-khepresh.svg" }
        ];

        this.itemStatOptions = {
            weapon: {
                ranged: { base: ['baseDamageMin', 'baseDamageMax', 'attackType', 'baseRange'], bonus: ['intellect', 'agility', 'range', 'rangedDamageBonus', 'damageBonus'] },
                melee: { base: ['baseDamageMin', 'baseDamageMax', 'attackType', 'baseBlock'], bonus: ['prowess', 'agility', 'block', 'meleeDamageBonus', 'damageBonus'] }
            },
            armor: { base: ['armor'], bonus: ['maxHp', 'prowess', 'agility', 'block', 'defense'] },
            amulet: { base: ['maxLuck'], bonus: ['maxHp', 'maxMana', 'intellect', 'prowess', 'agility', 'range', 'block', 'defense', 'meleeDamageBonus', 'rangedDamageBonus', 'damageBonus'] },
            ring: { base: ['maxLuck'], bonus: ['maxHp', 'maxMana', 'intellect', 'prowess', 'agility', 'range', 'block', 'defense', 'meleeDamageBonus', 'rangedDamageBonus', 'damageBonus'] }
        };
    }

    init() {
        this.eventBus.on('GenerateItem', (data) => this.generateItem(data));
    }

    generateItem({ tierIndex = -1, itemData = {} } = {}) {
        const player = this.entityManager.getEntity('player');
        const state = this.entityManager.getEntity('state');
        const maxRogTier = 4;

        if (tierIndex > maxRogTier) {
            itemData.tierIndex = tierIndex;
            itemData.itemTier = this.itemTiers[tierIndex];
            return this.getUniqueItem(itemData);
        } else if (tierIndex >= 0) {
            itemData.tierIndex = tierIndex;
            itemData.itemTier = this.itemTiers[tierIndex];
            return this.generateRogItem(itemData);
        } else {
            console.error('Invalid item generation data:', itemData);
            return null;
        }
    }

    getUniqueItem(item) {
        const tier = item.itemTier || this.itemTiers[item.tierIndex];
        const uniqueItem = this.uniqueItems.find(i => i.itemTier === tier);
        if (!uniqueItem) {
            console.error('No unique item found for tier:', tier);
            return null;
        }
        return { ...uniqueItem, uniqueId: this.entityManager.getEntity('state').utilities.generateUniqueId() };
    }

    generateRogItem(item) {
        const state = this.entityManager.getEntity('state');
        if (!item.itemTier && item.tierIndex >= 0) item.itemTier = this.itemTiers[item.tierIndex];
        if (!item.tierIndex && item.itemTier) item.tierIndex = this.itemTiers.indexOf(item.itemTier);
        if (!item.itemTier || item.tierIndex < 0) {
            console.error('Insufficient data for ROG item:', item);
            return null;
        }

        if (!item.type) {
            item.type = this.itemTypes[Math.floor(Math.random() * this.itemTypes.length)];
            if (item.tierIndex < 2) {
                if (item.type === 'ring') item.type = 'weapon';
                if (item.type === 'amulet') item.type = 'armor';
            }
        }

        let statOptions = this.itemStatOptions[item.type];
        switch (item.type) {
            case 'weapon':
                item.attackType = item.attackType || this.weaponAttackTypes[Math.floor(Math.random() * this.weaponAttackTypes.length)];
                item.baseDamageMin = Math.floor(Math.random() * 2) + this.statRoll("baseDamageMin", item) || 1;
                item.baseDamageMax = item.baseDamageMin + Math.floor(Math.random() * 5) + this.statRoll("baseDamageMax", item);
                statOptions = statOptions[item.attackType];
                if (item.tierIndex > 1) item.stats = this.getBonusStats(statOptions.bonus, item);
                item.icon = item.attackType === 'melee' ? 'dagger.svg' : 'orb-wand.svg';
                if (item.attackType === 'melee') item.baseBlock = Math.floor(Math.random() * 2) + this.statRoll("baseBlock", item);
                if (item.attackType === 'ranged') item.baseRange = Math.floor(Math.random() * 2) + this.statRoll("baseRange", item);
                break;
            case 'armor':
                item.armor = Math.floor(Math.random() * 2) + this.statRoll("armor", item);
                if (item.tierIndex > 1) item.stats = this.getBonusStats(statOptions.bonus, item);
                item.icon = 'armor.svg';
                break;
            case 'amulet':
                const luckAmulet = this.rollMaxLuck(item);
                if (luckAmulet !== 0) item.maxLuck = luckAmulet;
                if (item.tierIndex > 1) item.stats = this.getBonusStats(statOptions.bonus, item);
                item.icon = 'amulet.svg';
                break;
            case 'ring':
                const luckRing = this.rollMaxLuck(item);
                if (luckRing !== 0) item.maxLuck = luckRing;
                if (item.tierIndex > 1) item.stats = this.getBonusStats(statOptions.bonus, item);
                item.icon = 'ring.svg';
                break;
        }

        item.name = `${item.itemTier} ${item.type}`;
        item.uniqueId = state.utilities.generateUniqueId();
        item.description = `A ${item.itemTier} ${item.type}${item.stats ? ` with ${Object.entries(item.stats).map(([stat, val]) => `${stat}: ${val}`).join(', ')}` : ''}`;
        return item;
    }

    rollMaxLuck(item) {
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const dungeonTier = gameState.tier || 1;
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
        switch (stat) {
            case 'baseDamageMin': return Math.floor(item.tierIndex * 1.5);
            case 'baseDamageMax': return Math.floor(Math.random() * item.tierIndex) + 1;
            case 'range': return Math.floor(Math.random() * 2) + 1;
            case 'block': return Math.floor(Math.random() * 2) + 1;
            case 'armor': return Math.floor(item.tierIndex) + 1;
            case 'maxHp': return item.tierIndex * 2;
            case 'maxMana': return Math.floor(item.tierIndex / 2);
            case 'prowess': return Math.floor(item.tierIndex / 2);
            case 'agility': return Math.floor(item.tierIndex / 2);
            case 'intellect': return Math.floor(item.tierIndex / 2);
            case 'defense': return Math.floor(item.tierIndex) + 1;
            case 'damageBonus': return Math.floor(item.tierIndex) + 1;
            case 'meleeDamageBonus': return Math.floor(item.tierIndex) + 1;
            case 'rangedDamageBonus': return Math.floor(item.tierIndex) + 1;
            case 'baseBlock': return Math.floor(item.tierIndex) + 1;
            case 'baseRange': return Math.floor(item.tierIndex) + 4;
            default: return 0;
        }
    }

    getBonusStats(statArray, item) {
        const count = item.tierIndex;
        const availableStats = [...statArray];
        const selectedStats = {};

        for (let i = 0; i < count && availableStats.length > 0; i++) {
            const index = Math.floor(Math.random() * availableStats.length);
            const stat = availableStats.splice(index, 1)[0];
            selectedStats[stat] = (selectedStats[stat] || 0) + this.statRoll(stat, item);
        }
        return selectedStats;
    }
}