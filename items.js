console.log("items.js loaded");


const itemTiers = ['junk', 'common', 'rare', 'mastercraft', 'magic', 'artifact', 'relic'];

const uniqueItems = [
    {
        name: "Golden Khepresh",
        type: "weapon",
        attackType: "ranged",
        slots: ["mainhand", "offhand"], // Can go in either
        baseDamageMin: 10,
        baseDamageMax: 15,
        itemTier: "relic",
        description: "You know it's gonna be a Griff's Annihilator, and those are super rare!",
        uniqueId: null,
        icon: "golden-kheepresh.svg",
    },
    {
        name: "Rusty Dagger",
        type: "weapon",
        attackType: "melee",
        slots: ["mainhand", "offhand"], // Can go in either
        baseDamageMin: 1,
        baseDamageMax: 3,
        itemTier: "junk",
        description: "A rusty dagger, barely sharp.",
        uniqueId: null,
        icon: "dagger.svg",
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
        name: "Willow Wand",
        type: "weapon",
        attackType: "ranged",
        slots: ["mainhand", "offhand"], // Can go in either
        baseDamageMin: 2,
        baseDamageMax: 4,
        itemTier: "junk",
        description: "You don't sense any innate power here, but it should do the trick.",
        uniqueId: null,
        icon: "willow-wand.svg",
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
        droppedItems.push({ ...uniqueItems[Math.floor(Math.random() * uniqueItems.length)], uniqueId: generateUniqueId() }); // Use new UUID
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

    console.log(`Map tile after drop: ${map[monster.y][monster.x]}, treasures:`, tierTreasures);
    let logMessage = `${monster.name} dropped ${goldGain} gold`;
    if (torchDropped) logMessage += ' and a torch';
    if (droppedItems.length) logMessage += ` and ${droppedItems.map(i => i.name).join(', ')}`;
    writeToLog(logMessage + '!');
}
function randomItemGenerator() {
    /* Placeholder for future item generation */
    return null;
}


window.uniqueItems = uniqueItems;
window.dropTreasure = dropTreasure;
window.randomItemGenerator = randomItemGenerator;
