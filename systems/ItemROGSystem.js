import { System } from '../core/Systems.js';

export class ItemROGSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus, utilities);
        //this.utilities = this.entityManager.getEntity('state').getComponent('Utilities').utilities;
        this.requestItemStatOptions();
    }

    init() {
        this.eventBus.on('GenerateROGItem', ({ tierIndex, dungeonTier, callback }) => {
            const item = this.generateRogItem({ tierIndex, dungeonTier });
            callback(item);
        });
    }

    requestItemStatOptions() {
        this.eventBus.emit('GetItemStatOptions', {
            callback: (itemStatOptions) => {
                this.itemStatOptions = itemStatOptions;
                console.log('ItemROGSystem: Recieved Item stat options:', this.itemStatOptions);
            }
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

        let statOptions = this.itemStatOptions[item.type];

        if (item.type === 'weapon') {

            item.attackType = Math.random() < 0.5 ? 'melee' : 'ranged';
            item.baseDamageMin = Math.floor(Math.random() * 2) + this.statRoll("baseDamageMin", item) || 1;
            item.baseDamageMax = item.baseDamageMin + Math.floor(Math.random() * 5) + this.statRoll("baseDamageMax", item);
            item.icon = item.attackType === 'melee' ? 'dagger.svg' : 'orb-wand.svg';

            statOptions = statOptions[item.attackType];
            
            if (item.attackType === 'melee') item.baseBlock = Math.floor(Math.random() * 2) + this.statRoll("baseBlock", item);
            if (item.attackType === 'ranged') item.baseRange = Math.floor(Math.random() * 2) + this.statRoll("baseRange", item);

        } else if (item.type === 'armor') {

            item.armor = Math.floor(Math.random() * 2) + this.statRoll("armor", item);
            item.icon = 'armor.svg';

        } else if (item.type === 'amulet' || item.type === 'ring') {

            item.maxLuck = this.rollMaxLuck(item, dungeonTier);
            item.icon = item.type === 'amulet' ? 'amulet.svg' : 'ring.svg';
        }

        if (item.tierIndex > 1) { item.stats = this.getBonusStats(statOptions.bonus, item); }

        item.name = `${item.itemTier} ${item.type}`;
        item.uniqueId = this.utilities.generateUniqueId();
        item.description = `A ${item.itemTier} ${item.type}`;
        console.log(`ItemROGSystem: Generated item:`, item);
        return item;
    }

    getBonusStats(statArray, item) {
        console.log(`getBonusStats() called with statArray:`, statArray, `for item: `, item);
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
        switch (stat) {
            case 'baseDamageMin': return Math.floor(item.tierIndex * 1.5);
            case 'baseDamageMax': return Math.floor(Math.random() * item.tierIndex) + 1;
            case 'range': return Math.floor(Math.random() * 2) + 1;
            case 'block': return Math.floor(Math.random() * 2) + 1;
            case 'armor': return Math.floor(item.tierIndex) + 1;
            case 'maxHp': return item.tierIndex * 2;
            case 'maxMana': return Math.floor(item.tierIndex / 2);
            case 'prowess': return Math.floor(item.tierIndex / 2);
            case 'agility':  return Math.floor(item.tierIndex / 2);
            case 'intellect': return Math.floor(item.tierIndex / 2);
            case 'defense': return Math.floor(item.tierIndex) + 1;
            case 'damageBonus': return Math.floor(item.tierIndex) + 1;
            case 'meleeDamageBonus': return Math.floor(item.tierIndex) + 1;
            case 'rangedDamageBonus': return Math.floor(item.tierIndex) + 1;
            case 'baseBlock': return Math.floor(item.tierIndex) + 1;
            case 'baseRange': return Math.floor(item.tierIndex) + 4;
            default:
                console.log(`Stat ${stat} not found while attempting to generate a value for use on ${item}`);
                return 0;

        }
    }


    
}