console.log("items.js loaded");

class Items {
    constructor(state, data, ui, game) {
        this.state = state;
        this.data = data;
        this.ui = ui;
        this.game = game;

        this.relicItems = this.data.getUniqueItems();
        this.artifactItems = this.data.getUniqueItems();

        this.itemTiers = ['junk', 'common', 'rare', 'mastercraft', 'magic', 'artifact', 'relic'];

        this.itemTypes = ['weapon', 'armor', 'amulet', 'ring'];

        this.weaponAttackTypes = ['melee', 'ranged'];

        this.itemStatOptions = {
            weapon: {
                ranged: {
                    base: ['baseDamageMin', 'baseDamageMax', 'attackType', 'range'],
                    bonus: ['intellect', 'agility', 'range', 'rangedDamageBonus', 'damageBonus'],
                },
                melee: {
                    base: ['baseDamageMin', 'baseDamageMax', 'attackType', 'block'],
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
                    'maxHp', 'maxMana', 'maxLuck',
                    'intellect', 'prowess', 'agility',
                    'range', 'block', 'defense',
                    'meleeDamageBonus', 'rangedDamageBonus', 'damageBonus'
                ],
            },
            ring: {
                base: ['maxLuck'],
                bonus: [
                    'maxHp', 'maxMana', 'maxLuck',
                    'intellect', 'prowess', 'agility',
                    'range', 'block', 'defense',
                    'meleeDamageBonus', 'rangedDamageBonus', 'damageBonus'
                ],
            },
        };


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
            case 'maxLuck':
                return Math.min(Math.floor(Math.random() * 5) + Math.floor(Math.random() * 5) - 4, item.tierIndex * 2 + 1) + Math.floor(Math.random() * 2);
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
            default:
                console.log(`Stat ${stat} not found while attempting to generate a value for use on ${item}`);
                return 0;
        }
        
    };

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

    itemDropRoll() {
        let randomValue = Math.random() * 1;
        console.log(`itemDropRoll() randomValue: ${randomValue}`);
        let dungeonTierBonus = this.state.tier * 0.01;
        let playerLuckBonus = this.state.player.luck * 0.01;

        let rollTotal = randomValue + dungeonTierBonus + playerLuckBonus;

        console.log(`itemDropRoll() : dungeonTierBonus = ${dungeonTierBonus} : playerLuckBonus = ${dungeonTierBonus} : rollTotal: ${rollTotal}`);

        let itemDropData = { roll: rollTotal, itemTier: '' };

        switch (true) {
            case randomValue < 0.99:
                itemDropData.itemTier = 'rog';
                break;
            case randomValue < 0.999:
                itemDropData.itemTier = 'artifact';
                break;
            default:
                itemDropData.itemTier = 'relic';
        }

        console.log(`itemDropRoll() returning: { roll: ,${itemDropData.roll} itemTier: ${itemDropData.itemTier}}`);
        return itemDropData;
    }

    rogItem(rollTotal) {
        let item = {};
        switch (true) {
            case rollTotal < 0.15: item.tier = this.itemTiers[0]; item.tierIndex = 0; break; // 'junk'
            case rollTotal < 0.78: item.tier = this.itemTiers[1]; item.tierIndex = 1; break; // 'common'
            case rollTotal < 0.93: item.tier = this.itemTiers[2]; item.tierIndex = 2; break; // 'rare'
            case rollTotal < 0.98: item.tier = this.itemTiers[3]; item.tierIndex = 3; break; // 'mastercraft'
            case rollTotal < 0.99: item.tier = this.itemTiers[4]; item.tierIndex = 4; break; // 'magic'
        }

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
        const type = randomType;
        console.log(`Generating item of type ${type} with tier ${item.tier}`);
        let statOptions = this.itemStatOptions[type];
        console.log(`Stat options for item:`, statOptions);
        item.type = type;


        switch (type) {
            case 'weapon':
                item.attackType = this.weaponAttackTypes[Math.floor(Math.random() * this.weaponAttackTypes.length)];
                item.baseDamageMin = Math.floor(Math.random() * 2) + this.statRoll("baseDamageMin", item);
                item.baseDamageMax = item.baseDamageMin + Math.floor(Math.random() * 5) + this.statRoll("baseDamageMax",item);
                statOptions = statOptions[item.attackType];
                if (item.tierIndex > 1) { item.stats = this.getBonusStats(statOptions.bonus, item); }
                switch (item.attackType) {
                    case 'melee':
                        item.icon = 'dagger.svg';
                        break;
                    case 'ranged':
                        item.icon = 'orb-wand.svg';
                        break;
                }
                break;
            case 'armor':
                item.armor = Math.floor(Math.random() * 2) + this.statRoll("armor", item);
                if (item.tierIndex > 1) {

                    console.log(`requsting bonus stats for item:`, item);
                    item.stats = this.getBonusStats(statOptions.bonus, item);
                }
                item.icon = 'armor.svg';
                break;
            case 'amulet':
                item.maxLuck = Math.floor(Math.random() * 2) + this.statRoll("maxLuck", item);
                if (item.tierIndex > 1) {
                    console.log(`requsting bonus stats for item:`, item);
                    item.stats = this.getBonusStats(statOptions.bonus, item);
                }
                item.icon = 'amulet.svg';
                break;
            case 'ring':
                item.maxLuck = Math.floor(Math.random() * 2) + this.statRoll("maxLuck", item);
               
                if (item.tierIndex > 1) {
                    console.log(`requsting bonus stats for item:`, item);
                    item.stats = this.getBonusStats(statOptions.bonus, item);
                }
                item.icon = 'ring.svg';
                break;
        }

        item.itemTier = item.tier;
        item.name = `${item.tier} ${item.type}`;
        console.log(`Generated item:`, item);
        let statsText = '';
        if (typeof item.stats === 'object' && item.stats !== null) {
            statsText = `with ${Object.keys(item.stats).map(stat => `${stat}: ${item.stats[stat]}`).join(', ')}`;
        }
        item.description = `A ${item.tier} ${item.type} ${statsText}`;
        return item;
    }



    dropTreasure(monster, tier) {
        const goldGain = 10 + Math.floor(Math.random() * 41) + (tier + 1) * 10;

        let torchChance;
        if (this.state.player.torches === 0 && !this.state.player.torchLit) {
            torchChance = 0.20;
            this.state.player.torchDropFail++;
            if (this.state.player.torchDropFail === 3) {
                this.state.player.torches = 1;
                this.state.player.torchDropFail = 0;
                console.log(`Player found a torch after 3 failed attempts`);
                this.ui.writeToLog('You found a discarded torch lying on the ground!');
            }
        } else if (this.state.player.torches < 2) {
            torchChance = 0.15;
        } else if (this.state.player.torches <= 5) {
            torchChance = 0.10;
        } else {
            torchChance = 0.05;
        }

        const itemChance = 1.0;
        let droppedItems = [];
        let torchDropped = Math.random() < torchChance;

        if (Math.random() < itemChance) {
            let randomItem = {};
            const dropRoll = this.itemDropRoll();
            switch (dropRoll.itemTier) {
                case 'rog':
                    randomItem = this.rogItem(dropRoll.roll);
                    break;
                case 'artifact':
                    randomItem = this.artifactItems[Math.floor(Math.random() * this.artifactItems.length)];
                    break;
                case 'relic':
                    randomItem = this.relicItems[Math.floor(Math.random() * this.relicItems.length)];
                    break;
                default:
                    randomItem = this.rogItem(50); // Set to a common rog item as a fallback
                    break;
            }
            console.log(`Dropping Random item:`, randomItem);
            const escapedItem = this.escapeItemProperties(randomItem);
            droppedItems.push({ ...escapedItem });
        }

        const treasure = {
            x: monster.x,
            y: monster.y,
            name: monster.name || "Treasure Chest", // Use monster.name for monsters, "Treasure Chest" for level treasures
            gold: goldGain,
            torches: torchDropped ? 1 : 0,
            items: droppedItems,
            suppressRender: monster.suppressRender,
        };

        this.game.actions.placeTreasure(treasure);

        if (monster.name && monster.name !== "Treasure Chest") {
            this.ui.logDroppedItems(monster, goldGain, torchDropped, droppedItems);
        }
    }

    escapeItemProperties(item) {
        console.log("Escaping item properties for item", item);
        return {
            ...item,
            name: this.ui.utilities.escapeJsonString(item.name),
            description: this.ui.utilities.escapeJsonString(item.description),
        };
    }
}