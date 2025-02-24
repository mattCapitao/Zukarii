console.log("state.js loaded");

const state = {
    WIDTH: 120,
    HEIGHT: 50,
    mapDiv: null,
    statsDiv: null,
    logDiv: null,
    levels: [],
    stairsUp: {},
    stairsDown: {},
    currentLevel: 1,
    player: {
        x: 1, y: 1,
        hp: 30, maxHp: 30,
        gold: 0,
        level: 1, xp: 0, nextLevelXp: 50,
        prowess: 5 + Math.floor(Math.random() * 6),
        intellect: 5 + Math.floor(Math.random() * 6),
        agility: 5 + Math.floor(Math.random() * 6)
    },
    treasures: {},
    monsters: {},
    fountains: {},
    combatLog: [],
    isRangedMode: false,
    projectile: null,
    highestTier: 1,
    gameStarted: false,
    discoveryRadius: 8,
    discoveredWalls: {},
    discoveredTileCount: {},
    visibleTiles: {},
    tileMap: {},
    lastPlayerX: null,
    lastPlayerY: null,
    lastProjectileX: null,
    lastProjectileY: null,
    needsInitialRender: false,
    MIN_STAIR_DISTANCE: 60 // Moved here, set to your current tweak
};

function initGame() {
    state.treasures[0] = [];
    state.stairsUp = { 1: null };
    state.stairsDown = { 0: null };
    state.levels[0] = generateLevel();
    state.monsters[0] = generateLevelMonsters(0);
    state.fountains[0] = generateFountains(0);
    state.discoveredWalls[0] = new Set();
    state.discoveredTileCount[0] = 0;
    state.visibleTiles[0] = new Set();
    state.tileMap[0] = buildTileMap(0);

    // Pick upstairs room, excluding AlcoveSpecial and BossChamberSpecial
    const upRooms = state.levels[0].rooms.filter(r => r.type !== 'AlcoveSpecial' && r.type !== 'BossChamberSpecial');
    const upRoomIndex = Math.floor(Math.random() * upRooms.length);
    const upRoom = upRooms[upRoomIndex];
    let stairUpX = upRoom.left + 1 + Math.floor(Math.random() * (upRoom.w - 2));
    let stairUpY = upRoom.top + 1 + Math.floor(Math.random() * (upRoom.h - 2));
    state.levels[0].map[stairUpY][stairUpX] = '<';
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
    state.levels[0].map[stairDownY][stairDownX] = '>';
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