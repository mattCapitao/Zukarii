console.log("level.js loaded");

function generateLevel() {
    let map = [];
    for (let y = 0; y < state.HEIGHT; y++) {
        map[y] = [];
        for (let x = 0; x < state.WIDTH; x++) {
            map[y][x] = '#';
        }
    }

    const rooms = [];
    const targetRooms = 12;
    const zoneWidth = Math.floor(state.WIDTH / 6);
    const zoneHeight = Math.floor(state.HEIGHT / 2);
    const buffer = 1;
    const usableWidth = zoneWidth - buffer - 2;
    const usableHeight = zoneHeight - buffer - 2;
    const zoneGrid = [
        { x: 1, y: 1 }, { x: zoneWidth, y: 1 }, { x: 2 * zoneWidth, y: 1 }, { x: 3 * zoneWidth, y: 1 },
        { x: 4 * zoneWidth, y: 1 }, { x: 5 * zoneWidth, y: 1 }, { x: 1, y: zoneHeight },
        { x: zoneWidth, y: zoneHeight }, { x: 2 * zoneWidth, y: zoneHeight }, { x: 3 * zoneWidth, y: zoneHeight },
        { x: 4 * zoneWidth, y: zoneHeight }, { x: 5 * zoneWidth, y: zoneHeight }
    ];

    for (let i = 0; i < targetRooms; i++) {
        const zone = zoneGrid[i];
        const w = 9 + Math.floor(Math.random() * 4);
        const h = 9 + Math.floor(Math.random() * 4);
        const x = zone.x + buffer + Math.floor(Math.random() * (usableWidth - w));
        const y = zone.y + buffer + Math.floor(Math.random() * (usableHeight - h));

        for (let ry = y; ry < y + h; ry++) {
            for (let rx = x; rx < x + w; rx++) {
                map[ry][rx] = ' ';
            }
        }
        rooms.push({ x: x + Math.floor(w / 2), y: y + Math.floor(h / 2), w, h, left: x, top: y });
        console.log(`Room ${i + 1} placed at (${x}, ${y}) size ${w}x${h}`);
    }

    console.log(`Placed ${rooms.length} out of ${targetRooms} rooms`);

    for (let i = 1; i < rooms.length; i++) {
        const r1 = rooms[i - 1];
        const r2 = rooms[i];
        let x1 = r1.x, y1 = r1.y;
        let x2 = r2.x, y2 = r2.y;

        while (x1 !== x2) {
            map[y1][x1] = ' ';
            map[y1 + 1][x1] = ' ';
            x1 += Math.sign(x2 - x1);
        }
        while (y1 !== y2) {
            map[y1][x1] = ' ';
            map[y1][x1 + 1] = ' ';
            y1 += Math.sign(y2 - y1);
        }
    }

    const extraCorridors = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < extraCorridors; i++) {
        const r1Index = Math.floor(Math.random() * rooms.length);
        let r2Index;
        do {
            r2Index = Math.floor(Math.random() * rooms.length);
        } while (r2Index === r1Index || Math.abs(r1Index - r2Index) === 1);

        const r1 = rooms[r1Index];
        const r2 = rooms[r2Index];
        let x1 = r1.x, y1 = r1.y;
        let x2 = r2.x, y2 = r2.y;

        while (x1 !== x2) {
            map[y1][x1] = ' ';
            map[y1 + 1][x1] = ' ';
            x1 += Math.sign(x2 - x1);
        }
        while (y1 !== y2) {
            map[y1][x1] = ' ';
            map[y1][x1 + 1] = ' ';
            y1 += Math.sign(y2 - y1);
        }
        console.log(`Added extra corridor from room ${r1Index + 1} to ${r2Index + 1}`);
    }

    return { map, rooms };
}

function generateMonsters(tier) {
    const map = state.levels[tier].map;
    const rooms = state.levels[tier].rooms;
    let levelMonsters = [];
    for (let i = 0; i < 5; i++) {
        const room = rooms[Math.floor(Math.random() * rooms.length)];
        let x, y;
        do {
            x = room.left + 1 + Math.floor(Math.random() * (room.w - 2));
            y = room.top + 1 + Math.floor(Math.random() * (room.h - 2));
        } while (map[y][x] !== ' ' || (x === state.player.x && y === state.player.y));
        const minDamage = 1 + Math.floor(tier / 3);
        const maxDamage = 3 + Math.floor(tier / 2);
        const damage = Math.floor(Math.random() * (maxDamage - minDamage + 1)) + minDamage;
        levelMonsters.push({ x, y, hp: 15 + tier * 3, attack: damage });
    }
    return levelMonsters;
}

function generateFountains(tier) {
    const map = state.levels[tier].map;
    const rooms = state.levels[tier].rooms;
    let levelFountains = [];
    for (let i = 0; i < 2; i++) {
        const room = rooms[Math.floor(Math.random() * rooms.length)];
        let x, y;
        do {
            x = room.left + 1 + Math.floor(Math.random() * (room.w - 2));
            y = room.top + 1 + Math.floor(Math.random() * (room.h - 2));
        } while (map[y][x] !== ' ');
        map[y][x] = 'H';
        levelFountains.push({ x, y, used: false, discovered: false });
    }
    return levelFountains;
}

function generateTreasures(tier) {
    const map = state.levels[tier].map;
    const rooms = state.levels[tier].rooms;
    for (let i = 0; i < 3; i++) {
        const room = rooms[Math.floor(Math.random() * rooms.length)];
        let x, y;
        do {
            x = room.left + 1 + Math.floor(Math.random() * (room.w - 2));
            y = room.top + 1 + Math.floor(Math.random() * (room.h - 2));
        } while (map[y][x] !== ' ');
        const goldGain = 10 + Math.floor(Math.random() * 41) + tier * 10;
        map[y][x] = '$';
        state.treasures[tier].push({ x, y, gold: goldGain, discovered: false });
    }
}

function addLevel(tier) {
    if (!state.levels[tier]) {
        const newLevelData = generateLevel();
        state.levels[tier] = newLevelData;
        state.treasures[tier] = [];
        state.monsters[tier] = [];
        state.fountains[tier] = [];
        state.stairsUp[tier] = null; // Stairs up to this level
        state.stairsDown[tier] = null; // Stairs down from this level
        state.discoveredWalls[tier] = new Set();
        state.discoveredTileCount[tier] = 0;
        state.visibleTiles[tier] = new Set();
        state.tileMap[tier] = buildTileMap(tier);

        const firstRoom = newLevelData.rooms[0];
        let stairUpX = firstRoom.left + 1 + Math.floor(Math.random() * (firstRoom.w - 2));
        let stairUpY = firstRoom.top + 1 + Math.floor(Math.random() * (firstRoom.h - 2));
        state.levels[tier].map[stairUpY][stairUpX] = '<';
        state.stairsUp[tier] = { x: stairUpX, y: stairUpY }; // To this level

        const downRoomIndex = Math.floor(Math.random() * (newLevelData.rooms.length - 1)) + 1;
        const downRoom = newLevelData.rooms[downRoomIndex];
        let stairDownX = downRoom.left + 1 + Math.floor(Math.random() * (downRoom.w - 2));
        let stairDownY = downRoom.top + 1 + Math.floor(Math.random() * (downRoom.h - 2));
        state.levels[tier].map[stairDownY][stairDownX] = '>';
        state.stairsDown[tier] = { x: stairDownX, y: stairDownY }; // From this level

        state.monsters[tier] = generateMonsters(tier);
        state.fountains[tier] = generateFountains(tier);
        console.log(`Initializing treasures for tier ${tier}`);
        generateTreasures(tier);

        state.player.x = stairUpX + 1;
        state.player.y = stairUpY;
        const map = state.levels[tier].map;
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
        console.log(`Tier ${tier} added: stairsUp[${tier}] at (${state.stairsUp[tier]?.x}, ${state.stairsUp[tier]?.y}), stairsDown[${tier}] at (${state.stairsDown[tier]?.x}, ${state.stairsDown[tier]?.y})`);
    }
}

function buildTileMap(tier) {
    let map = state.levels[tier].map;
    let tileMap = [];
    for (let y = 0; y < state.HEIGHT; y++) {
        tileMap[y] = [];
        for (let x = 0; x < state.WIDTH; x++) {
            tileMap[y][x] = { char: map[y][x], class: 'undiscovered' };
        }
    }
    return tileMap;
}