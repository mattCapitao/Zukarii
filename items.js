console.log("items.js loaded");

const itemTiers = ['junk', 'common', 'rare', 'mastercraft', 'magic', 'artifact', 'relic'];

const uniqueItems = [
    {
        name: "Mbphu Staff of iLvl Annihilation",
        type: "weapon",
        attackType: "ranged",
        slots: ["mainhand", "offhand"],
        baseDamageMin: 10,
        baseDamageMax: 15,
        itemTier: "relic",
        description: "The Golden Khepresh has got nothing on this babby! ",
        uniqueId: null,
        icon: "mbphu-staff.svg",
    },
];

const junkItems = [
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


function randomItemGenerator() {
    /* Placeholder for future item generation */
    return null;
}

function logDroppedItems(monster, goldGain, torchDropped, droppedItems) {
    let logMessage = `${monster.name} dropped ${goldGain} gold`;
    if (torchDropped) logMessage += ' and a torch';
    if (droppedItems.length) logMessage += ` and ${droppedItems.map(i => i.name).join(', ')}`;
    writeToLog(logMessage + '!');
}

function escapeJsonString(str) {
    return str.replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
}

function escapeItemProperties(item) {
    return {
        ...item,
        name: escapeJsonString(item.name),
        description: escapeJsonString(item.description),
        // Add other properties that need escaping if necessary
    };
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

    const itemChance = 0.90;
    let droppedItems = [];
    let torchDropped = Math.random() < torchChance;

    if (Math.random() < itemChance) {
        const randomItem = junkItems[Math.floor(Math.random() * junkItems.length)];
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


window.junkItems = junkItems;
window.uniqueItems = uniqueItems;
window.dropTreasure = dropTreasure;
window.randomItemGenerator = randomItemGenerator;
window.escapeJsonString = escapeJsonString;
window.escapeItemProperties = escapeItemProperties;