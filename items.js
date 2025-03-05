console.log("items.js loaded");

class Items {
    constructor(state, data, ui) {
        this.state = state;
        this.data = data;
        this.ui = ui;

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
                    'rangedDamageBonus', 'damageBonus'
                ],
            },
            ring: {
                base: ['luck'],
                bonus: [
                    'maxHp', 'maxMana', 'maxLuck',
                    'intellect', 'prowess', 'agility',
                    'range', 'block', 'defense',
                    'rangedDamageBonus', 'damageBonus'
                ],
            },
        };
    }

    logDroppedItems(monster, goldGain, torchDropped, droppedItems) {
        let logMessage = `${monster.name} dropped ${goldGain} gold`;
        if (torchDropped) logMessage += ' and a torch';
        if (droppedItems.length) logMessage += ` and ${droppedItems.map(i => i.name).join(', ')}`;
        this.ui.writeToLog(logMessage + '!');
    }

    getBonusStats(statArray, itemTier) {
        let availableStats = [...statArray];
        let selectedStats = {};

        const count = itemTier;

        for (let i = 0; i < count && availableStats.length > 0; i++) {
            const index = Math.floor(Math.random() * availableStats.length);
            const stat = availableStats.splice(index, 1)[0];
            selectedStats[stat] = Math.floor(Math.random() * 10) + 1;
        }
        return selectedStats;
    }

    rogItem(rollTotal) {
        let item = {};
        switch (true) {
            case rollTotal < 0.30: item.tier = this.itemTiers[0]; item.tierIndex = 0; break; // 'junk'
            case rollTotal < 0.55: item.tier = this.itemTiers[1]; item.tierIndex = 1; break; // 'common'
            case rollTotal < 0.75: item.tier = this.itemTiers[2]; item.tierIndex = 2; break; // 'rare'
            case rollTotal < 0.88: item.tier = this.itemTiers[3]; item.tierIndex = 3; break; // 'mastercraft'
            case rollTotal < 0.95: item.tier = this.itemTiers[4]; item.tierIndex = 4; break; // 'magic'
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
        let statOptions = this.itemStatOptions[type];

        item.type = type;

        const tierStatMods = {
            hp: item.tierIndex * 2,
            mana: Math.floor(item.tierIndex / 2),
            luck: Math.min(Math.floor(Math.random() * 5) + Math.floor(Math.random() * 5) - 4, item.tierIndex * 2 + 1) + Math.floor(Math.random() * 2),
            prowess: Math.floor(item.tierIndex / 2),
            agility: Math.floor(item.tierIndex / 2),
            intellect: Math.floor(item.tierIndex / 2),
            defense: Math.floor(item.tierIndex) + 1,
            baseDamageMin: Math.floor(item.tierIndex * 1.5),
            baseDamageMax: Math.floor(Math.random() * item.tierIndex) + 1,
        };

        switch (type) {
            case 'weapon':
                item.attackType = this.weaponAttackTypes[Math.floor(Math.random() * this.weaponAttackTypes.length)];
                item.baseDamageMin = Math.floor(Math.random() * 2) + tierStatMods.baseDamageMin;
                item.baseDamageMax = item.baseDamageMin + Math.floor(Math.random() * 5) + tierStatMods.baseDamageMax;
                statOptions = statOptions[item.attackType];
                if (item.tierIndex > 1) { item.stats = this.getBonusStats(statOptions.bonus, item.tierIndex); }
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
                item.defense = Math.floor(Math.random() * 2) + tierStatMods.defense;
                if (item.tierIndex > 1) { item.stats = this.getBonusStats(statOptions.bonus, item.tierIndex); }
                item.icon = 'armor.svg';
                break;
            case 'amulet':
                item.luck = Math.floor(Math.random() * 2) + tierStatMods.luck;
                if (item.tierIndex > 1) { item.stats = this.getBonusStats(statOptions.bonus, item.tierIndex); }
                item.icon = 'amulet.svg';
                break;
            case 'ring':
                item.luck = Math.floor(Math.random() * 2) + tierStatMods.luck;
                if (item.tierIndex > 1) { item.stats = this.getBonusStats(statOptions.bonus, item.tierIndex); }
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

    itemDropRoll() {
        let randomValue = Math.random() * 1;
        console.log(`itemDropRoll() randomValue: ${randomValue}`);
        let dungeonTierBonus = this.state.tier * 0.01;
        let playerLevelBonus = this.state.player.level * 0.01;
        let playerLuckBonus = this.state.player.luck * 0.01;

        let rollTotal = randomValue + dungeonTierBonus + playerLevelBonus + playerLuckBonus;

        console.log(`itemDropRoll() rollTotal: ${rollTotal}`);

        let itemDropData = { roll: rollTotal, itemTier: '' };

        switch (true) {
            case randomValue < 0.95:
                itemDropData.itemTier = 'rog';
                break;
            case randomValue < 0.99:
                itemDropData.itemTier = 'artifact';
                break;
            default:
                itemDropData.itemTier = 'relic';
        }

        console.log(`itemDropRoll() returning: { roll: ,${itemDropData.roll} itemTier: ${itemDropData.itemTier}}`);
        return itemDropData;
    }

    dropTreasure(monster, tier) {
        const map = this.state.levels[tier].map;
        const tierTreasures = this.state.treasures[tier];
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
                    randomItem = this.startItems[Math.floor(Math.random() * this.startItems.length)];
            }
            console.log(`Dropping Random item:`, randomItem);

            const escapedItem = this.escapeItemProperties(randomItem);

            droppedItems.push({ ...escapedItem, uniqueId: this.ui.utilities.generateUniqueId() });
        }

        const existingTreasure = tierTreasures.find(t => t.x === monster.x && t.y === monster.y);

        if (existingTreasure) {
            existingTreasure.gold = (existingTreasure.gold || 0) + goldGain;
            console.log(`Treasure updated at (${monster.x}, ${monster.y}) to ${existingTreasure.gold} gold`);
            if (torchDropped) {
                this.state.player.torchDropFail = 0;
                existingTreasure.torches = (existingTreasure.torches || 0) + 1;
                console.log(`Added a torch to treasure at (${monster.x}, ${monster.y}), now ${existingTreasure.torches} torches`);
            }
            droppedItems.forEach(droppedItem => {
                existingTreasure.items = existingTreasure.items || [];
                if (!existingTreasure.items.some(i => JSON.stringify(i) === JSON.stringify(droppedItem))) {
                    existingTreasure.items.push(droppedItem);
                    console.log(`Added ${droppedItem.name} to treasure at (${monster.x}, ${monster.y}) with ID ${droppedItem.uniqueId}`);
                } else {
                    console.log(`Duplicate ${droppedItem.name} ignored at (${monster.x}, ${monster.y})`);
                }
            });
        } else {
            const newTreasure = { x: monster.x, y: monster.y, gold: goldGain, discovered: false };
            if (torchDropped) {
                this.state.player.torchDropFail = 0;
                newTreasure.torches = 1;
                console.log(`Dropping new treasure with a torch at (${monster.x}, ${monster.y})`);
            }
            droppedItems.forEach(droppedItem => {
                newTreasure.items = newTreasure.items || [];
                if (!newTreasure.items.some(i => JSON.stringify(i) === JSON.stringify(droppedItem))) {
                    newTreasure.items.push(droppedItem);
                    console.log(`Dropping new treasure with ${droppedItem.name} at (${monster.x}, ${monster.y}) with ID ${droppedItem.uniqueId}`);
                } else {
                    console.log(`Duplicate ${droppedItem.name} ignored at (${monster.x}, ${monster.y})`);
                }
            });
            tierTreasures.push(newTreasure);
            map[monster.y][monster.x] = '$';
            console.log(`Dropping new treasure at (${monster.x}, ${monster.y}) with ${goldGain} gold`);
        }

        this.logDroppedItems(monster, goldGain, torchDropped, droppedItems);
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