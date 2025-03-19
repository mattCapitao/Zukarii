import { System } from '../core/Systems.js';

export class ItemROGSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.utilities = this.entityManager.getEntity('state').getComponent('Utilities').utilities;
    }

    init() {
        this.eventBus.on('GenerateROGItem', ({ tierIndex, dungeonTier, callback }) => {
            const item = this.generateRogItem({ tierIndex, dungeonTier });
            callback(item);
        });
    }

    generateRogItem({ tierIndex, dungeonTier }) {
        const itemTiers = ['junk', 'common', 'rare', 'magic', 'mastercraft', 'legendary', 'relic', 'artifact'];
        const item = { tierIndex, itemTier: itemTiers[tierIndex] };

        const itemTypes = ['weapon', 'armor', 'amulet', 'ring'];
        item.type = itemTypes[Math.floor(Math.random() * itemTypes.length)];
        if (tierIndex < 2) {
            if (item.type === 'ring') item.type = 'weapon';
            if (item.type === 'amulet') item.type = 'armor';
        }

        if (item.type === 'weapon') {
            item.attackType = Math.random() < 0.5 ? 'melee' : 'ranged';
            item.baseDamageMin = Math.floor(Math.random() * 2) + this.statRoll("baseDamageMin", item) || 1;
            item.baseDamageMax = item.baseDamageMin + Math.floor(Math.random() * 5) + this.statRoll("baseDamageMax", item);
            item.icon = item.attackType === 'melee' ? 'dagger.svg' : 'orb-wand.svg';
            if (item.attackType === 'melee') item.baseBlock = Math.floor(Math.random() * 2) + this.statRoll("baseBlock", item);
            if (item.attackType === 'ranged') item.baseRange = Math.floor(Math.random() * 2) + this.statRoll("baseRange", item);
        } else if (item.type === 'armor') {
            item.armor = Math.floor(Math.random() * 2) + this.statRoll("armor", item);
            item.icon = 'armor.svg';
        } else if (item.type === 'amulet' || item.type === 'ring') {
            item.maxLuck = this.rollMaxLuck(item, dungeonTier);
            item.icon = item.type === 'amulet' ? 'amulet.svg' : 'ring.svg';
        }

        item.name = `${item.itemTier} ${item.type}`;
        item.uniqueId = this.utilities.generateUniqueId();
        item.description = `A ${item.itemTier} ${item.type}`;
        return item;
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
        switch (stat) {
            case 'baseDamageMin': return Math.floor(item.tierIndex * 1.5);
            case 'baseDamageMax': return Math.floor(Math.random() * item.tierIndex) + 1;
            case 'baseBlock': return Math.floor(item.tierIndex) + 1;
            case 'baseRange': return Math.floor(item.tierIndex) + 4;
            case 'armor': return Math.floor(item.tierIndex) + 1;
            default: return 0;
        }
    }
}