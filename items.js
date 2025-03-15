//console.log("Items.js loaded");

import { State } from './State.js';

export class Items {
    constructor(state) {
        this.state = state;
        this.data = this.state.game.getService('data'); // Access Data via State
        this.legendaryItems = this.data.getUniqueItems();
        this.relicItems = this.data.getUniqueItems();
        this.artifactItems = this.data.getUniqueItems();
        this.lootTables = this.state.game.getService('lootTables');

        this.itemTiers = ['junk', 'common', 'rare', 'magic', 'mastercraft', 'legendary', 'relic', 'artifact'];
        this.itemTypes = ['weapon', 'armor', 'amulet', 'ring'];
        this.weaponAttackTypes = ['melee', 'ranged'];

        this.itemStatOptions = {
            weapon: {
                ranged: {
                    base: ['baseDamageMin', 'baseDamageMax', 'attackType', 'baseRange'],
                    bonus: ['intellect', 'agility', 'range', 'rangedDamageBonus', 'damageBonus'],
                },
                melee: {
                    base: ['baseDamageMin', 'baseDamageMax', 'attackType', 'baseBlock'],
                    bonus: ['prowess', 'agility', 'block', 'meleeDamageBonus', 'damageBonus'],
                },
            },
            armor: {
                base: ['armor'],
                bonus: ['maxHp', 'prowess', 'agility', 'block', 'defense'],
            },
            amulet: {
                base: ['maxLuck'],
                bonus: [
                    'maxHp', 'maxMana',
                    'intellect', 'prowess', 'agility',
                    'range', 'block', 'defense',
                    'meleeDamageBonus', 'rangedDamageBonus', 'damageBonus'
                ],
            },
            ring: {
                base: ['maxLuck'],
                bonus: [
                    'maxHp', 'maxMana',
                    'intellect', 'prowess', 'agility',
                    'range', 'block', 'defense',
                    'meleeDamageBonus', 'rangedDamageBonus', 'damageBonus'
                ],
            },
        };
    }


    getItem(tierIndex, item = {}) {
        console.log(`getItem(${tierIndex}) called with item:`, item);
        console.log('this is Items:', this instanceof Items);
        const maxRogTier = 4;

        if (item.tierIndex > maxRogTier) {

            item.tierIndex = tierIndex;
            item.itemTier = this.itemTiers[tierIndex];

            return this.#getUniqueItem(item);

        } else if (tierIndex > -1) {

            item.tierIndex = tierIndex;
            item.itemTier = this.itemTiers[tierIndex];
            console.log(`getItem(${tierIndex}) calling this.#rogItem(${item})`, item);
            try {
                return this.#rogItem(item);
            } catch (err) {
                console.error(`Error in getItem(${tierIndex}) calling this.#rogItem(${item}):`, err);
                return null;
            }

        } else if (!item) {
            error.log('getItem() called with insufficient data to generate an item: ', item);
        }
    }

    #getUniqueItem(item) {

        switch (item.itemTier || item.tierIndex) {

            case 'legendary': case 5: newItem = this.legendaryItmes[Math.floor(Math.random() * this.legendaryItems.length)]; break;
            case 'relic': case 6: newItem = this.relicItems[Math.floor(Math.random() * this.relicItems.length)]; break;
            case 'artifact': case 7: newItem = this.artifactItems[Math.floor(Math.random() * this.artifactItems.length)]; break;

            default: error.log('No Unique Item table could be fond for Item: ', item); return null;
        }
        return newItem;
    }

    #rogItem(item) {

        console.log('Generating rogItem for: ', item);

        if (!item.itemTier && item.tierIndex > -1) {
            item.itemTier = this.itemTiers[tierIndex];
        } else if (!(item.tierIndex > -1) && item.itemTier) {
            item.tierIndex = this.itemTiers.indexOf(item.itemTier);
        } else if (!item.itemTier && !item.tierIndex) {
            error.log('the passed item:{} contains insufficient data to generate a ROG item : ', item);
            return;
        }

        if (!item.type || item.type === '') {
            let randomType = this.itemTypes[Math.floor(Math.random() * this.itemTypes.length)];

            if (item.tierIndex < 2) {
                switch (randomType) {
                    case 'ring':
                        randomType = 'weapon';
                        break;
                    case 'amulet':
                        randomType = 'armor';
                        break;
                    default:
                        break;
                }
            }
            item.type = randomType;
        }

        console.log(`Generating item of type ${item.type} with itemTier: ${item.itemTier}, and tierIndex: ${item.tierIndex}`);
        let statOptions = this.itemStatOptions[item.type];
        //console.log(`Stat options for item:`, statOptions);

        switch (item.type) {
            case 'weapon':
                if (!item.attackType || item.attackType === '') {
                    item.attackType = this.weaponAttackTypes[Math.floor(Math.random() * this.weaponAttackTypes.length)];
                }
                item.baseDamageMin = Math.floor(Math.random() * 2) + this.statRoll("baseDamageMin", item) || 1;
                item.baseDamageMax = item.baseDamageMin + Math.floor(Math.random() * 5) + this.statRoll("baseDamageMax", item);
                statOptions = statOptions[item.attackType];
                if (item.tierIndex > 1) { item.stats = this.getBonusStats(statOptions.bonus, item); }
                switch (item.attackType) {
                    case 'melee':
                        item.icon = 'dagger.svg';
                        item.baseBlock = Math.floor(Math.random() * 2) + this.statRoll("baseBlock", item);
                        break;
                    case 'ranged':
                        item.icon = 'orb-wand.svg';
                        item.baseRange = Math.floor(Math.random() * 2) + this.statRoll("baseRange", item);
                        break;
                }
                break;
            case 'armor':
                item.armor = Math.floor(Math.random() * 2) + this.statRoll("armor", item);
                if (item.tierIndex > 1) {
                    //console.log(`requesting bonus stats for item:`, item);
                    item.stats = this.getBonusStats(statOptions.bonus, item);
                }
                item.icon = 'armor.svg';
                break;
            case 'amulet':

                const luckRollAmulet = this.rollMaxLuck(item);
                if (luckRollAmulet !== 0) item.maxLuck = luckRollAmulet;

                if (item.tierIndex > 1) {
                    //console.log(`requesting bonus stats for item:`, item);
                    item.stats = this.getBonusStats(statOptions.bonus, item);
                }
                item.icon = 'amulet.svg';
                break;
            case 'ring':

                const luckRollRing = this.rollMaxLuck(item);
                if (luckRollRing !== 0) item.maxLuck = luckRollRing;

                if (item.tierIndex > 1) {
                    //console.log(`requesting bonus stats for item:`, item);
                    item.stats = this.getBonusStats(statOptions.bonus, item);
                }
                item.icon = 'ring.svg';
                break;
        }


        item.name = `${item.itemTier} ${item.type}`;
        //console.log(`Generated item:`, item);
        let statsText = '';
        if (typeof item.stats === 'object' && item.stats !== null) {
            statsText = `with ${Object.keys(item.stats).map(stat => `${stat}: ${item.stats[stat]}`).join(', ')}`;
        }
        item.description = `A ${item.itemTier} ${item.type} ${statsText}`;
        return item;
    }


    rollMaxLuck(item) {
        const dungeonTier = this.state.tier || 1;
        const baseRoll = Math.floor(Math.random() * 12) - 4; // -4 to 7
        const tierFactor = item.tierIndex + Math.floor(dungeonTier / 5);
        const positiveCap = tierFactor * 2 + 1;
        const negativeCap = -Math.floor(tierFactor * 2 / 3);
        let scaledRoll = baseRoll < 0 ? baseRoll : baseRoll + 1; // -4 to -1, 1 to 8
        scaledRoll = Math.max(Math.min(scaledRoll, positiveCap), negativeCap);
        const finalRoll = scaledRoll + Math.floor(Math.random() * 2);

        const rangeWidth = positiveCap - negativeCap + 1;
        const gapSize = Math.floor(rangeWidth * 0.5);
        const centerThresholdLow = Math.floor((negativeCap + positiveCap) / 2 - gapSize / 2);
        const centerThresholdHigh = centerThresholdLow + gapSize - 1;

        if (finalRoll >= centerThresholdLow && finalRoll <= centerThresholdHigh) {
            return 0; // 50% no luck
        }
        return finalRoll; // 50% luck
    }

    statRoll(stat, item) {
        switch (stat) {
            case 'baseDamageMin':
                return Math.floor(item.tierIndex * 1.5);
            case 'baseDamageMax':
                return Math.floor(Math.random() * item.tierIndex) + 1;
            case 'range':
                return Math.floor(Math.random() * 2) + 1;
            case 'block':
                return Math.floor(Math.random() * 2) + 1;
            case 'armor':
                return Math.floor(item.tierIndex) + 1;
            case 'maxHp':
                return item.tierIndex * 2;
            case 'maxMana':
                return Math.floor(item.tierIndex / 2);
            case 'prowess':
                return Math.floor(item.tierIndex / 2);
            case 'agility':
                return Math.floor(item.tierIndex / 2);
            case 'intellect':
                return Math.floor(item.tierIndex / 2);
            case 'defense':
                return Math.floor(item.tierIndex) + 1;
            case 'damageBonus':
                return Math.floor(item.tierIndex) + 1;
            case 'meleeDamageBonus':
                return Math.floor(item.tierIndex) + 1;
            case 'rangedDamageBonus':
                return Math.floor(item.tierIndex) + 1;
            case 'baseBlock':
                return Math.floor(item.tierIndex) + 1;
            case 'baseRange':
                return Math.floor(item.tierIndex) + 4;
            default:
                //console.log(`Stat ${stat} not found while attempting to generate a value for use on ${item}`);
                return 0;
        }
    }

    getBonusStats(statArray, item) {
        //console.log(`getBonusStats() called with statArray:`, statArray, `for item: `, item);
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
        //console.log(`Returning selected stats:`, selectedStats);
        return selectedStats;
    }

    calculateTorchChance(m) {
        let torchChance;
        if (this.state.player.torches === 0 && !this.state.player.torchLit) {
            torchChance = 0.20;
            this.state.player.torchDropFail++;
            if (this.state.player.torchDropFail === 3) {
                this.state.player.torches = 1;
                this.state.player.torchDropFail = 0;
                //console.log(`Player found a torch after 3 failed attempts`);
                this.state.game.getService('ui').writeToLog('You found a discarded torch lying on the ground!');
            }
        } else if (this.state.player.torches < 2) {
            torchChance = 0.125;
        } else if (this.state.player.torches <= 5) {
            torchChance = 0.075;
        } else {
            torchChance = 0.025;
        }
        return torchChance * m;
    }

    calculatePotionChance(m) {
        const p = this.state.player.healPotions
        let chance = 0.05;       
        switch (true) {
            case p === 0: chance = 0.5;
            case p < 3: chance =  0.30;
            case p < 5: chance = 0.125;
        }
        switch (true) {
            case this.state.player.hp / this.state.player.maxHp < .5: chance += 0.1;
            case this.state.player.hp / this.state.player.maxHp < .25: chance += 0.1;
            case this.state.player.hp / this.state.player.maxHp < .1: chance += 0.1;
        }
        return chance * m;
    }

    calculateItemChance(m) {
        let itemChance = 0.3 * m ; // Placeholder as per original
        return itemChance;
    }

    calculateUniqueItemChance(m) {
        let itemChance = 0.1 * m ; // Placeholder as per original
        return itemChance;
    }

    calculateGoldgain(m) {
        let goldGain = 0;
        if (Math.random() < .85 * m) {
           goldGain = 10 + Math.floor(Math.random() * 41) + (this.state.tier) * 10;
        }
        return goldGain;
    }

    dropTreasure(treasureSource, tier, map, treasures) {
        // currently treasureSource can be a monster or a tile treasure (Treasure Chest, Items dropped by Player)
        //likey want to look at Monsters.hanldeDeath() and Actions.placeTreasure() for more context
        const uiService = this.state.game.getService('ui');
        const actionsService = this.state.game.getService('actions');

        treasureSource.chanceModifiers = {
            torches: treasureSource?.chanceModifiers?.torches || 1,
            healPotions: treasureSource?.chanceModifiers?.healPotions || 1,
            uniqueItem: treasureSource?.chanceModifiers?.uniqueItem || 1,
            gold: treasureSource?.chanceModifiers?.gold || 1,
            item: treasureSource?.chanceModifiers?.item || 1,
        }; 

        const goldGain = this.calculateGoldgain(treasureSource.chanceModifiers.gold);
        const torchChance = this.calculateTorchChance(treasureSource.chanceModifiers.torches);
        const potionChance = this.calculatePotionChance(treasureSource.chanceModifiers.healPotions);
        const itemChance = this.calculateItemChance(treasureSource.chanceModifiers.item);
        const uniqueItemChance = this.calculateUniqueItemChance(treasureSource.chanceModifiers.uniqueItem);

        let droppedItems = [];
        let torchDropped = Math.random() < torchChance;
        if (torchDropped) { this.state.player.torchDropFail = 0; }
        let potionDropped = Math.random() < potionChance;
        if (potionDropped) { this.state.player.potionDropFail = 0; }

        if (Math.random() < uniqueItemChance) {

            if (treasureSource.uniqueItemsDropped && treasureSource.uniqueItemsDropped.length > 0) {
                const newItem = treasureSource.uniqueItemsDropped[0]; // First unique for now
                const escapedItem = this.escapeItemProperties(newItem);
                droppedItems.push({ ...escapedItem });
            }
        }
        if (Math.random() < itemChance) {
            const newItemTier = this.lootTables.getItemTier();

            console.log(`Calling getItem(${newItemTier})`);
            const newItem = this.getItem(newItemTier);

            console.log(`Adding item to treasure object:`, newItem);
            const escapedItem = this.escapeItemProperties(newItem);
            droppedItems.push({ ...escapedItem });

        }

        const treasure = {
            x: treasureSource.x,
            y: treasureSource.y,
            name: treasureSource.name || "Treasure Chest",
            gold: goldGain,
            torches: torchDropped ? 1 : 0,
            healPotions: potionDropped ? 1 : 0,
            items: droppedItems,
            suppressRender: treasureSource.suppressRender,
        };

        actionsService.placeTreasure(treasure, tier, map, treasures);

        if (treasureSource.name && treasureSource.name !== "Treasure Chest") {
            uiService.logDroppedItems(treasureSource, goldGain, torchDropped, droppedItems);
        }
    }

    escapeItemProperties(item) {
        const uiService = this.state.game.getService('ui');
        //console.log("Fetching uiService in escapeItemProperties:", uiService);
        if (!uiService || !uiService.utilities) {
            console.error("uiService or uiService.utilities is undefined! Using fallback for item:", item);
            return { ...item };
        }
        //console.log("Escaping item properties for item", item);
        return {
            ...item,
            name: uiService.utilities.escapeJsonString(item.name),
            description: uiService.utilities.escapeJsonString(item.description),
        };
    }

}