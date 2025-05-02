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
            if ((item.tierIndex === 1 && Math.random() < .5) || item.tierIndex > 1) { 
                const bonusStats = this.getBonusStats(statOptions.bonus, item, dungeonTier);
                item.stats = bonusStats.slected;
                item.critStats = bonusStats.crit;
            }
        }

        //Check for affix
        let randomAffix = false;
        if (item.tierIndex > 4 &&  (!item.affixes || item.affixes.length === 0) ) { // Add affix to Legendary and above if template has no affix
            randomAffix = true;
            console.warn('ItemROGSystem: ItemAffix = TRUE');

        } if (randomAffix) {
            const affix = this.getRandomAffix();
            if (affix) {
                item.affixes = [affix];
                console.log('ItemROGSystem: Affix added:', affix);
            } else {
                console.warn('ItemROGSystem: getRandomAffix returned an empty string');
            } 
        }

        // Required properties
        item.name = item.name || `${item.itemTier} ${item.type}`;
        item.uniqueId = item.uniqueId || this.utilities.generateUniqueId();
        item.description = item.description || `${item.itemTier} ${item.type}`;

        console.log(`ItemROGSystem: Generated item:`, item);
        return item;
    }

    getBonusStats(statArray, item, dungeonTier) {
        if (!this.itemStatOptions || !statArray) {
            console.warn('ItemROGSystem: itemStatOptions or statArray not available, returning empty stats');
            return {};
        }
        console.log(`getBonusStats() called with statArray:`, statArray, `for item:`, item);
        const itemTier = item.tierIndex;
        let availableStats = [...statArray];
        let selectedStats = {};

        let count = itemTier;

        if (itemTier > 4) { // Add affix to Legendary and above
            count = 4;
        }

        let critCount = 0;

        if (itemTier === 4 || itemTier === 7){// Chance for bonus stats on Mastercraft and Artifact
            const statCritChance = dungeonTier * .001;
            console.log('ItemROGSystem: Mastercraft stat count roll crit chance:', statCritChance);
            if (Math.random() <= statCritChance) {
                critCount++;
                console.log('ItemROGSystem: Mastercraft stat count roll CRIT - count increased to:', critCount);
                if (Math.random() <= statCritChance) {
                    critCount++;
                    console.log('ItemROGSystem: Mastercraft stat count roll DOUBLE CRIT - count increased to:', critCount);
                    if (Math.random() <= statCritChance) {
                        critCount++;
                        console.log('ItemROGSystem: Mastercraft stat count roll TRIPLE CRIT - count increased to:', critCount);
                        if (Math.random() <= statCritChance) {
                            critCount++;
                            console.log('ItemROGSystem: Mastercraft stat count roll QUAD CRIT - count increased to:', critCount);
                        }
                    }
                }
            }
        } 

        const critStats = [];
        console.log(`ItemROGSystem: Crit count: ${critCount}, available stats:`, availableStats);
        for (let i = 0, c=0; i < count && availableStats.length > 0; i++, c++) {
            const index = Math.floor(Math.random() * availableStats.length);
            const stat = availableStats.splice(index, 1)[0];
            let isCrit = false;
            if (c < critCount) isCrit = true; // Roll for crit stats
            const statValue = this.statRoll(stat, item, isCrit);

            if (isCrit) {   
               critStats.push(stat); 
               console.log('ItemROGSystem: Mastercraft stat roll CRIT - statValue increased to:', statValue);
            }

            if (selectedStats.hasOwnProperty(stat)) {
                selectedStats[stat] += statValue;
            } else {
                selectedStats[stat] = statValue;
            }
        }

        console.log(`Returning selected stats:`, selectedStats);
        return { slected: selectedStats, crit: critStats };
    }

    getRandomAffix() {
        /*if (!this.itemAffixOptions) {
            console.warn('ItemROGSystem: itemStatOptions not available, cannot generate random affix');
            return '';
        }
        */
        const itemAffixOptions = [
            {
                "name": "lifeSteal",
                "type": "combat",
                "trigger": "attackHitTarget",
                "effect": "lifeSteal",
                "params": {
                    "minDmageHealedPercentage": 0.25,
                    "maxDamageHealedPercentage": 0.50,
                    "chanceToStealLife": 0.15
                },
                "description": "Chance to heal for a portion of damage dealt when hitting an enemy."

            },
            {
                "name": "resilience",
                "type": "combat",
                "trigger": "hitByAttack",
                "effect": "instantHeal",
                "params": {
                    "minHealPercentage": 0.05,
                    "maxHealPercentage": 0.10,
                    "chanceToHeal": 0.05
                },
                "description": "Chance to recover a percentage of missing health on being hit."

            },
            {
                "name": "arcaneMirror",
                "type": "combat",
                "trigger": "hitByAttack",
                "effect": "reflectDamage",
                "params": {
                    "minReflectPercentage": 1,
                    "maxReflectPercentage": 0.50,
                    "chanceToReflect": .1
                },
                "description": "Chance to trigger an arcane mirror reflecting damage to your attacker on being hit."

            }

        ];
        const index = Math.floor(Math.random() * itemAffixOptions.length);
        console.log('ItemROGSystem: Random affix rolled:', itemAffixOptions[index]);
        return itemAffixOptions[index];
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

    statRoll(stat, item, isCrit = false) {
        if (item[stat] !== undefined && item[stat] !== 0) return 0; // Skip base stats if provided and non-zero

        let value = 0;

        console.log(`ItemROGSystem: Rolling stat ${stat} crit:${isCrit}, for item:`, item);

        switch (stat) {
            case 'baseDamageMin': value = Math.floor(item.tierIndex * 1.5); break;
            case 'baseDamageMax': value = Math.floor(Math.random() * item.tierIndex) + 1; break;
            case 'baseBlock': value = Math.floor(item.tierIndex) + 1; break;
            case 'baseRange': value = Math.floor(item.tierIndex) + 4; break;
            case 'armor': value = Math.floor(item.tierIndex) + 1; break;
            case 'maxHp': if (isCrit) {
                    value =  item.tierIndex * 10;
                } else {
                   value = item.tierIndex * 5 + Math.round(Math.random() * (item.tierIndex * 5));
                }
              break;
            case 'maxMana': if (isCrit) {
                    value = item.tierIndex * 4;
                } else {
                    value = item.tierIndex * 2 + Math.round(Math.random() * (item.tierIndex * 2));
                }
                break;

            case 'prowess':
            case 'agility': 
            case 'intellect':
                value = Math.round(item.tierIndex / 2) || 1;
                if (isCrit) { value++; }
                break;

            case 'range':
            case 'block':
            case 'defense':
                if (isCrit) {
                value = item.tierIndex * .5;
                } else {
                    value = this.randomizeStatRoll(Math.round(item.tierIndex * .5), item);
                }
                break;

            case 'damageBonus': 
            case 'meleeBonus': 
            case 'rangedBonus': 
            case 'resistMagic':
                if (isCrit) {
                    value = item.tierIndex + 1
                } else {
                    value = this.randomizeStatRoll((item.tierIndex + 1), item);
                }
                break;
            
            default:
                console.log(`Stat ${stat} not found while attempting to generate a value for use on ${item}`);
                return 0;
        }
        console.log(`ItemROGSystem: Rolled value for ${stat}:`, value);
        if (isCrit) {
            value = Math.round(value * 1.5);
            console.log(`ItemROGSystem: ${stat} rolled CRIT - value increased to:`, value);
        }
        return value;
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