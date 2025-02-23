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
    needsInitialRender: false
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

    const firstRoom = state.levels[0].rooms[0];
    let stairUpX = firstRoom.left + 1 + Math.floor(Math.random() * (firstRoom.w - 2));
    let stairUpY = firstRoom.top + 1 + Math.floor(Math.random() * (firstRoom.h - 2));
    state.levels[0].map[stairUpY][stairUpX] = '<';
    state.stairsUp[1] = { x: stairUpX, y: stairUpY };

    const downRoomIndex = Math.floor(Math.random() * (state.levels[0].rooms.length - 1)) + 1;
    const downRoom = state.levels[0].rooms[downRoomIndex];
    let stairDownX = downRoom.left + 1 + Math.floor(Math.random() * (downRoom.w - 2));
    let stairDownY = downRoom.top + 1 + Math.floor(Math.random() * (downRoom.h - 2));
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