console.log("items.js loaded");

const uniqueItems = [
    {
        name: "Mbphu Staff ",
        type: "weapon",
        attackType: "ranged",
        range: 10,
        slots: ["mainhand", "offhand"],
        baseDamageMin: 10,
        baseDamageMax: 15,
        itemTier: "relic",
        stats: {intellect: 10, maxMana: 10, agility: 10, maxLuck: 10, maxHp: 15, damageBonus: 5}, 
        description: "The Golden Khepresh has got nothing on this babby! ",
        uniqueId: null,
        icon: "mbphu-staff.svg",
    },
];

const relicItems = uniqueItems;
const artifactItems = uniqueItems;

const itemTiers = ['junk', 'common', 'rare', 'mastercraft', 'magic', 'artifact', 'relic'];
const itemTypes = ['weapon', 'armor', 'amulet', 'ring'];
const weaponAttackTypes = ['melee', 'ranged'];

const itemStatOptions = {
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
            'rangedDamageBonus', 'damageBonus'],
    },
    ring: {
        base: ['luck'],
        bonus: [
            'maxHp', 'maxMana', 'maxLuck',
            'intellect', 'prowess', 'agility',
            'range', 'block', 'defense',
            'rangedDamageBonus', 'damageBonus'],
    },

};


function logDroppedItems(monster, goldGain, torchDropped, droppedItems) {
    let logMessage = `${monster.name} dropped ${goldGain} gold`;
    if (torchDropped) logMessage += ' and a torch';
    if (droppedItems.length) logMessage += ` and ${droppedItems.map(i => i.name).join(', ')}`;
    writeToLog(logMessage + '!');
}

function getBonusStats(statArray, itemTier) {

    let availableStats = [...statArray];
    let selectedStats = {};

    const count = itemTier;

    for (let i = 0; i < count && availableStats.length > 0; i++) {
        const index = Math.floor(Math.random() * availableStats.length);
        const stat = availableStats.splice(index, 1)[0];
        selectedStats[stat] = Math.floor(Math.random() * 10) + 1; // 1-10 value
    }
    return selectedStats;
}


function rogItem(rollTotal) {
    let item = {};
    switch (true) {
        case rollTotal < 0.30: item.tier = itemTiers[0]; item.tierIndex = 0; break;// 'junk'// 30% chance
        case rollTotal < 0.55: item.tier = itemTiers[1]; item.tierIndex = 1; break;// 'common'// 25% chance
        case rollTotal < 0.75: item.tier = itemTiers[2]; item.tierIndex = 2; break;// 'rare'// 20% chance
        case rollTotal < 0.88: item.tier = itemTiers[3]; item.tierIndex = 3; break;// 'mastercraft'// 13% chance
        case rollTotal < 0.95: item.tier = itemTiers[4]; item.tierIndex = 4; break;// 'magic'// 7% chance
    }

    let randomType = itemTypes[Math.floor(Math.random() * itemTypes.length)];

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
    let statOptions = itemStatOptions[type];

    item.type = type;

    const tierStatMods = {
        hp: item.tierIndex * 2,
        mana: Math.floor(item.tierIndex / 2),
        luck: Math.min(Math.floor(Math.random() * 5) + Math.floor(Math.random() * 5) - 4, item.tierIndex * 2 + 1) + Math.floor(Math.random() * 2), //
        prowess: Math.floor(item.tierIndex / 2), 
        agility: Math.floor(item.tierIndex / 2), 
        intellect: Math.floor(item.tierIndex / 2), 
        defense: Math.floor(item.tierIndex) + 1 ,
        baseDamageMin: Math.floor(item.tierIndex * 1.5) , // 0-6
        baseDamageMax: Math.floor(Math.random() * item.tierIndex) +1,
    }
    
    switch (type) {
        case 'weapon':

            item.attackType = weaponAttackTypes[Math.floor(Math.random() * weaponAttackTypes.length)];
            item.baseDamageMin = Math.floor(Math.random() * 2) + tierStatMods.baseDamageMin; // 1-7
            item.baseDamageMax = item.baseDamageMin + Math.floor(Math.random() * 5) +  tierStatMods.baseDamageMax; // Min + 0-8

            statOptions = statOptions[item.attackType];

            // if tier better than common roll random stats
            if (item.tierIndex > 1) {item.stats = getBonusStats(statOptions.bonus, item.tierIndex);}
            
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
            if (item.tierIndex > 1) { item.stats = getBonusStats(statOptions.bonus, item.tierIndex); }
            item.icon = 'armor.svg';
            break;
        case 'amulet':
            item.luck = Math.floor(Math.random() * 2) + tierStatMods.luck; 
            if (item.tierIndex > 1) { item.stats = getBonusStats(statOptions.bonus, item.tierIndex); }
            item.icon = 'amulet.svg';
            break;
        case 'ring':
            item.luck = Math.floor(Math.random() * 2) + tierStatMods.luck;
            if (item.tierIndex > 1) { item.stats = getBonusStats(statOptions.bonus, item.tierIndex); }
            item.icon = 'ring.svg';
            break;
    }
   
    item.itemTier = item.tier;
    item.name = `${item.tier} ${item.type}`;
    console.log(`Generated item:`, item);
    let statsText = '';
    if (typeof item.stats === 'object' && item.stats !== null) {
        statsText  = `with ${Object.keys(item.stats).map(stat => `${stat}: ${item.stats[stat]}`).join(', ')}`
    }
    item.description = `A ${item.tier} ${item.type} ${statsText}`;
    return item;
}

function itemDropRoll() {

    let randomValue = Math.random() * 1; // Generates a number between 0 and 1
    console.log(`itemDropRoll() randomValue: ${randomValue}`);
    let dungeonTierBonus = state.tier * 0.01; // 5% increase per dungeon tier
    let playerLevelBonus = state.player.level * 0.01; // 1% increase per player level
    let playerLuckBonus = state.player.luck * 0.01; // 1% increase per player luck

    let rollTotal = randomValue + dungeonTierBonus + playerLevelBonus + playerLuckBonus;

    console.log(`itemDropRoll() rollTotal: ${rollTotal}`);

    let itemDropData = {roll: rollTotal , itemTier: ''};

    switch (true) {

        case randomValue < 0.95: // 7% chance (0.88 - 0.94)
            itemDropData.itemTier = 'rog';
            break;
        case randomValue < 0.99: // 4% chance (0.95 - 0.98)
            itemDropData.itemTier = 'artifact'
            itemTier = itemTiers[5]; // 'artifact'
            break;
        default:                // 1% chance (0.99 - 1.00)
            itemDropData.itemTier = 'relic'
            itemTier= itemTiers[6]; // 'relic'
    }


    // Optional: for testing
    //console.log(`Random: ${randomValue.toFixed(2)}, Tier: ${itemTierDropped}`);
    console.log(`itemDropRoll() returning: { roll: ,${itemDropData.roll} itemTier: ${itemDropData.itemTier}}`);
    return itemDropData;
}


function dropTreasure(monster, tier) {
    const map = state.levels[tier].map;
    const tierTreasures = state.treasures[tier];
    const goldGain = 10 + Math.floor(Math.random() * 41) + (tier + 1) * 10;

    let torchChance;
    if (state.player.torches === 0 && !state.player.torchLit) {
        torchChance = 0.20;
        state.player.torchDropFail++;
        if (state.player.torchDropFail === 3) {
            state.player.torches = 1;
            state.player.torchDropFail = 0;
            console.log(`Player found a torch after 3 failed attempts`);
            writeToLog('You found a discarded torch lying on the ground!');
        }
    } else if (state.player.torches < 2) {
        torchChance = 0.15;
    } else if (state.player.torches <= 5) {
        torchChance = 0.10;
    } else {
        torchChance = 0.05;
    }

    const itemChance = 1.0;
    let droppedItems = [];
    let torchDropped = Math.random() < torchChance;

    if (Math.random() < itemChance) {
        let randomItem = {};

        const dropRoll = itemDropRoll();

        switch (dropRoll.itemTier) {
            case 'rog':
                randomItem = rogItem(dropRoll.roll);
                break;
            case 'artifact':
                randomItem = artifactItems[Math.floor(Math.random() * artifactItems.length)];
                break;
            case 'relic':
                randomItem = relicItems[Math.floor(Math.random() * relicItems.length)];
                break;
            default:
                randomItem = startItems[Math.floor(Math.random() * startItems.length)];

        } 
        console.log(`Dropping Random item:`, randomItem);

        const escapedItem = escapeItemProperties(randomItem);
        
        droppedItems.push({ ...escapedItem, uniqueId: generateUniqueId() }); // Use new UUID
    }

    const existingTreasure = tierTreasures.find(t => t.x === monster.x && t.y === monster.y);

    if (existingTreasure) {
        existingTreasure.gold = (existingTreasure.gold || 0) + goldGain;
        console.log(`Treasure updated at (${monster.x}, ${monster.y}) to ${existingTreasure.gold} gold`);
        if (torchDropped) {
            state.player.torchDropFail = 0;
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
            state.player.torchDropFail = 0;
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

    logDroppedItems(monster, goldGain, torchDropped, droppedItems);
}


function escapeJsonString(str) {
    return str.replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
}

function escapeItemProperties(item) {
    console.log("Escaping item properties for item", item);
    return {
        ...item,
        name: escapeJsonString(item.name),
        description: escapeJsonString(item.description),
        // Add other properties that need escaping if necessary
    };
}


const startItems = [
    {
        name: "Rusty Dagger",
        type: "weapon",
        attackType: "melee",
        slots: ["mainhand", "offhand"],
        baseDamageMin: 1,
        baseDamageMax: 3,
        itemTier: "junk",
        description: "A rusty dagger, barely sharp.",
        uniqueId: null,
        icon: "dagger.svg",
    },
    {
        name: "Ragged Robes",
        type: "armor",
        attackType: null,
        slot: "armor",
        defense: 1,
        itemTier: "junk",
        description: "Musty old ragged robes. Will this actually protect you from anything?",
        uniqueId: null,
        icon: "robe.svg",
    },
    {
        name: "Crooked Wand",
        type: "weapon",
        attackType: "ranged",
        slots: ["mainhand", "offhand"], // Can go in either
        baseDamageMin: 2,
        baseDamageMax: 3,
        itemTier: "junk",
        description: "A crooked wand, hope it shoots straighter than it looks.",
        uniqueId: null,
        icon: "crooked-wand.svg",
    },
    {
        name: "Bronze Dagger",
        type: "weapon",
        attackType: "melee",
        slots: ["mainhand", "offhand"], // Can go in either
        baseDamageMin: 2,
        baseDamageMax: 3,
        itemTier: "common",
        description: "The blade is sharp but the metal is soft.",
        uniqueId: null,
        icon: "dagger.svg",
    },

    {
        name: "Willow Wand",
        type: "weapon",
        attackType: "ranged",
        slots: ["mainhand", "offhand"], // Can go in either
        baseDamageMin: 2,
        baseDamageMax: 4,
        itemTier: "common",
        description: `No sense any innate power here, but it should do the trick.`,
        uniqueId: null,
        icon: "willow-wand.svg",
    },

    {
        name: "Apprentice Robes",
        type: "armor",
        attackType: null,
        slot: "armor",
        defense: 2,
        itemTier: "common",
        description: "Plain and ordinary, but there are no holes and the fabric is heavy",
        uniqueId: null,
        icon: "robe.svg",
    },
];


window.startItems = startItems;
window.uniqueItems = uniqueItems;
window.dropTreasure = dropTreasure;
window.rogItem = rogItem;
window.escapeJsonString = escapeJsonString;
window.escapeItemProperties = escapeItemProperties;