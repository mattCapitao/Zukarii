console.log("state.js loaded");

const state = {
    WIDTH: 100,
    HEIGHT: 60,
    mapDiv: null,
    statsDiv: null,
    logDiv: null,
    levels: [],
    stairsUp: {},
    stairsDown: {},
    currentLevel: 1,
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
        inventory:{
            equipped: {
                mainhand: {
                    name: "Rusty Dagger",
                    type: "weapon",
                    attackType: "melee",
                    slots: ["mainhand", "offhand"],
                    baseDamageMin: 1,
                    baseDamageMax: 3,
                    itemTier: "junk",
                    description: "A rusty dagger, barely sharp."
                },
                offhand: {
                    name: "Crooked Wand",
                    type: "weapon",
                    attackType: "ranged",
                    slots: ["mainhand", "offhand"], 
                    baseDamageMin: 2,
                    baseDamageMax: 4,
                    itemTier: "junk",
                    description: "A crooked wand, hope it shoots straighter than it looks.",
            },
                armor: {
                    name: "Ragged Robes",
                    type: "armor",
                    attackType: null,
                    slot: "armor",
                    defense: 1,
                    itemTier: "junk",
                    description: "Musty old ragged robes. Will this actually protect you from anything?"
                },
                amulet: {name: "None"},
                rightring: { name: "None" },
                leftring: { name: "None" },
            },
            items: [
                {
                    name: "Golden Khepresh",
                    type: "weapon",
                    attackType: "ranged",
                    slots: ["mainhand", "offhand"],
                    baseDamageMin: 10,
                    baseDamageMax: 15,
                    itemTier: "relic",
                    description: "You know it’s gonna be a Griff’s Annihilator, and those are super rare!",
                },
            ],
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
    currentTab: 'log',
};

function initGame() {
    state.treasures[0] = [];
    state.stairsUp = { 1: null };
    state.stairsDown = { 0: null };
    state.levels[0] = generateLevel();
    const GeneratedMonsters = generateLevelMonsters(0);
    state.monsters[0] = GeneratedMonsters;
    console.log(`Tier Monsters: ${GeneratedMonsters}`);
    console.log(`Tier Monsters: ${state.monsters[0]}`);
    state.fountains[0] = generateFountains(0);
    state.discoveredWalls[0] = new Set();
    state.discoveredFloors[0] = new Set();
    state.discoveredTileCount[0] = 0;
    state.visibleTiles[0] = new Set();
    state.tileMap[0] = buildTileMap(0);

    // Pick upstairs room, excluding AlcoveSpecial and BossChamberSpecial
    const upRooms = state.levels[0].rooms.filter(r => r.type !== 'AlcoveSpecial' && r.type !== 'BossChamberSpecial');
    const upRoomIndex = Math.floor(Math.random() * upRooms.length);
    const upRoom = upRooms[upRoomIndex];
    let stairUpX = upRoom.left + 1 + Math.floor(Math.random() * (upRoom.w - 2));
    let stairUpY = upRoom.top + 1 + Math.floor(Math.random() * (upRoom.h - 2));
    state.levels[0].map[stairUpY][stairUpX] = '⇑';
    state.stairsUp[1] = { x: stairUpX, y: stairUpY };

    // Pick downstairs room, aiming for max distance
    let downRoom, stairDownX, stairDownY;
    const downOptions = state.levels[0].rooms.map(room => {
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
    state.levels[0].map[stairDownY][stairDownX] = '⇓';
    state.stairsDown[0] = { x: stairDownX, y: stairDownY };

    console.log(`Tier 0 initialized: stairsUp[1] at (${stairUpX}, ${stairUpY}), stairsDown[0] at (${stairDownX}, ${stairDownY})`);
    console.log("Initializing treasures for tier 0");
    generateTreasures(0);

    state.player.x = stairUpX + 1;
    state.player.y = stairUpY;
    const map = state.levels[0].map;
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