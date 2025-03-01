console.log("state.js loaded");

function generateUniqueId() {
    const time = Date.now().toString(36); // Base-36 timestamp
    const rand1 = Math.random().toString(36).substring(2, 8); // 6 random chars
    const rand2 = Math.random().toString(36).substring(2, 8); // Another 6 random chars
    return `${time}-${rand1}-${rand2}`;
}

const emptyEquipSlots = {
    mainhand: {
        name: "Mainhand",
        type: "weapon",
        attackType: "melee",
        slots: ["mainhand"],
        baseDamageMin: 1,
        baseDamageMax: 1,
        uniqueId: generateUniqueId(),
        itemTier: "Empty",
        description: "Not equipped.",
        icon: "no-mainhand.svg",
    },
    offhand: {
        name: "Offhand",
        type: "weapon",
        slots: ["offhand"],
        baseDamageMin: 0,
        baseDamageMax: 0,
        uniqueId: generateUniqueId(),
        itemTier: "Empty",
        description: "Not equipped.",
        icon: "no-offhand.svg",
    },
    armor: {
        name: "Armor",
        type: "armor",
        slot: "armor",
        uniqueId: generateUniqueId(),
        itemTier: "Empty",
        defense: 0,
        description: "Not equipped.",
        icon: "no-armor.svg",
    },
    amulet: {
        name: "Amulet",
        type: "amulet",
        slot: "amulet",
        uniqueId: generateUniqueId(),
        itemTier: "Empty",
        description: "Not equipped.",
        icon: "no-amulet.svg",
    },
    rightring: {
        name: "Right Ring",
        type: "ring",
        slot: "rightring",
        uniqueId: generateUniqueId(),
        itemTier: "Empty",
        description: "Not equipped.",
        icon: "no-rightring.svg",
    },
    leftring: {
        name: "Left Ring",
        type: "ring",
        slot: "leftring",
        uniqueId: generateUniqueId(),
        itemTier: "Empty",
        description: "Not equipped.",
        icon: "no-leftring.svg",
    }
};

const state = {
    WIDTH: 100,
    HEIGHT: 60,
    mapDiv: null,
    statsDiv: null,
    logDiv: null,
    levels: [],
    stairsUp: {},
    stairsDown: {},
    tier: 1, // Start at tier 1, the first dungeon level
    ui: { // Namespace for UI state
        overlayOpen: false, // Tracks if #tabs overlay is visible
        activeTab: 'log',   // Current active tab, defaults to log
        logEntries: [],     // Cache for log messages, newest first
        maxLogEntries: 20   // Max log entries to display
    },
    player: {
        x: 1, y: 1,
        name: "Leith42",
        hp: 30, maxHp: 30,
        gold: 0,
        level: 1, xp: 0, nextLevelXp: 50,
        dead: false,
        prowess: 5 + Math.floor(Math.random() * 6),
        intellect: 5 + Math.floor(Math.random() * 6),
        agility: 5 + Math.floor(Math.random() * 6),
        armor: 0,
        defense: 0,
        luck: 0,
        maxLuck: 0,
        mana: 10,
        maxMana: 10,
        inventory: {
            equipped: emptyEquipSlots,
            items: [],
        },
        torches: 1,
        torchExpires: 0,
        torchDropFail: 0,
        torchLit: false,
        lampLit: false,
    },
    items: [],
    treasures: {},
    monsters: {},
    fountains: {},
    combatLog: [],
    isRangedMode: false,
    projectile: null,
    highestTier: 1,
    gameStarted: false,
    gameOver: false,
    discoveryRadiusDefault: 2,
    discoveryRadius: 2,
    discoveredWalls: {},
    discoveredFloors: {},
    discoveredTileCount: {},
    visibleTiles: {},
    tileMap: {},
    lastPlayerX: null,
    lastPlayerY: null,
    lastProjectileX: null,
    lastProjectileY: null,
    needsInitialRender: false,
    MIN_STAIR_DISTANCE: 60,
    isVictory: false,
};

// Hardcoded 10x10 surface level (tier 0) with stairs down only
function generateSurfaceLevel() {
    let map = [];
    for (let y = 0; y < 10; y++) {
        map[y] = [];
        for (let x = 0; x < 10; x++) {
            // Walls on borders, empty space inside
            if (y === 0 || y === 9 || x === 0 || x === 9) {
                map[y][x] = '#';
            } else {
                map[y][x] = ' ';
            }
        }
    }
    // Place stairs down at (5, 5) to return to tier 1
    map[5][5] = '⇓';

    // Define a single room for consistency with level structure
    const rooms = [{
        left: 1,
        top: 1,
        w: 8,
        h: 8,
        x: 5, // Center of room
        y: 5,
        type: 'SurfaceRoom',
        connections: []
    }];

    return { map, rooms };
}

function initGame() {
    // Initialize tier 0 (surface/exit) as a fallback
    state.levels[0] = generateSurfaceLevel();
    state.treasures[0] = [];
    state.monsters[0] = []; // No monsters for now
    state.fountains[0] = [];
    state.stairsUp[0] = null; // No stairs up from tier 0 (it's the surface)
    state.stairsDown[0] = { x: 5, y: 5 }; // Stairs down to tier 1
    state.discoveredWalls[0] = new Set();
    state.discoveredFloors[0] = new Set();
    state.discoveredTileCount[0] = 0;
    state.visibleTiles[0] = new Set();
    state.tileMap[0] = buildTileMap(0);
    console.log(`Tier 0 initialized: stairsDown[0] at (5, 5)`);

    // Initialize tier 1 (starting dungeon level)
    state.treasures[1] = [];
    state.stairsUp = { 1: null, ...state.stairsUp }; // Merge with tier 0 setup
    state.stairsDown = { 1: null, ...state.stairsDown };
    state.levels[1] = generateLevel();
    const GeneratedMonsters = generateLevelMonsters(1);
    state.monsters[1] = GeneratedMonsters;
    console.log(`Tier Monsters: ${GeneratedMonsters}`);
    console.log(`Tier Monsters: ${state.monsters[1]}`);
    state.fountains[1] = generateFountains(1);
    state.discoveredWalls[1] = new Set();
    state.discoveredFloors[1] = new Set();
    state.discoveredTileCount[1] = 0;
    state.visibleTiles[1] = new Set();
    state.tileMap[1] = buildTileMap(1);

    // Pick upstairs room for tier 1 (leads to tier 0, the exit)
    const upRooms = state.levels[1].rooms.filter(r => r.type !== 'AlcoveSpecial' && r.type !== 'BossChamberSpecial');
    const upRoomIndex = Math.floor(Math.random() * upRooms.length);
    const upRoom = upRooms[upRoomIndex];
    let stairUpX = upRoom.left + 1 + Math.floor(Math.random() * (upRoom.w - 2));
    let stairUpY = upRoom.top + 1 + Math.floor(Math.random() * (upRoom.h - 2));
    state.levels[1].map[stairUpY][stairUpX] = '⇑';
    state.stairsUp[1] = { x: stairUpX, y: stairUpY };

    // Pick downstairs room for tier 1 (leads to tier 2)
    let downRoom, stairDownX, stairDownY;
    const downOptions = state.levels[1].rooms.map(room => {
        const centerX = room.left + Math.floor(room.w / 2);
        const centerY = room.top + Math.floor(room.h / 2);
        const dx = stairUpX - centerX;
        const dy = stairUpY - centerY;
        return { room, distance: Math.sqrt(dx * dx + dy * dy) };
    }).sort((a, b) => b.distance - a.distance);

    const farRooms = downOptions.filter(opt => opt.distance >= state.MIN_STAIR_DISTANCE);
    downRoom = farRooms.find(opt => opt.room.type === 'BossChamberSpecial')?.room ||
        farRooms.find(opt => opt.room.type === 'AlcoveSpecial')?.room ||
        farRooms[0]?.room || downOptions[0].room;
    stairDownX = downRoom.left + 1 + Math.floor(Math.random() * (downRoom.w - 2));
    stairDownY = downRoom.top + 1 + Math.floor(Math.random() * (downRoom.h - 2));
    state.levels[1].map[stairDownY][stairDownX] = '⇓';
    state.stairsDown[1] = { x: stairDownX, y: stairDownY };

    console.log(`Tier 1 initialized: stairsUp[1] at (${stairUpX}, ${stairUpY}), stairsDown[1] at (${stairDownX}, ${stairDownY})`);
    console.log("Initializing treasures for tier 1");
    generateTreasures(1);

    state.player.x = stairUpX + 1;
    state.player.y = stairUpY;
    addStartingItems();
    const map = state.levels[1].map;
    if (map[state.player.y][state.player.x] !== ' ') {
        const directions = [
            { x: stairUpX - 1, y: stairUpY },
            { x: stairUpX, y: stairUpY + 1 },
            { x: stairUpX, y: stairUpY - 1 }
        ];
        for (let dir of directions) {
            if (map[dir.y][dir.x] === ' ') {
                state.player.x = dir.x;
                state.player.y = dir.y;
                break;
            }
        }
    }
    state.lastPlayerX = null;
    state.lastPlayerY = null;
    state.needsInitialRender = true;
}

window.generateUniqueId = generateUniqueId;