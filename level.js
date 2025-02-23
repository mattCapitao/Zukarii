console.log("level.js loaded");

const roomTypes = [
    { type: 'SquareRoom', probability: 30, minW: 9, maxW: 13, minH: 4, maxH: 6 },
    { type: 'VerticalRoom', probability: 15, minW: 6, maxW: 9, minH: 6, maxH: 8 },
    { type: 'HorizontalRoom', probability: 40, minW: 12, maxW: 19, minH: 4, maxH: 6 },
    { type: 'AlcoveSpecial', probability: 10, minW: 8, maxW: 8, minH: 4, maxH: 4 },
    { type: 'BossChamberSpecial', probability: 5, minW: 20, maxW: 24, minH: 5, maxH: 8 }
];

// Select a room type based on probability
function selectRoomType() {
    const rand = Math.floor(Math.random() * 100);
    let cumulativeProbability = 0;
    for (const roomType of roomTypes) {
        cumulativeProbability += roomType.probability;
        if (rand < cumulativeProbability) {
            return roomType;
        }
    }
    return roomTypes[roomTypes.length - 1]; // Fallback
}

// Generate room dimensions
function generateRoomDimensions(roomType) {
    const width = Math.floor(Math.random() * (roomType.maxW - roomType.minW + 1)) + roomType.minW;
    const height = Math.floor(Math.random() * (roomType.maxH - roomType.minH + 1)) + roomType.minH;
    return { width, height, type: roomType.type };
}

// Constants for placement
const BUFFER_SIZE = 1;
const MIN_ROOM_SIZE = 4;

function doesRoomOverlap(newRoom, existingRooms) {
    const newRoomWithBuffer = {
        x: newRoom.x - BUFFER_SIZE,
        y: newRoom.y - BUFFER_SIZE,
        w: newRoom.w + 2 * BUFFER_SIZE,
        h: newRoom.h + 2 * BUFFER_SIZE
    };
    for (const room of existingRooms) {
        const existingRoomWithBuffer = {
            x: room.left - BUFFER_SIZE,
            y: room.top - BUFFER_SIZE,
            w: room.w + 2 * BUFFER_SIZE,
            h: room.h + 2 * BUFFER_SIZE
        };
        if (
            newRoomWithBuffer.x < existingRoomWithBuffer.x + existingRoomWithBuffer.w &&
            newRoomWithBuffer.x + newRoomWithBuffer.w > existingRoomWithBuffer.x &&
            newRoomWithBuffer.y < existingRoomWithBuffer.y + existingRoomWithBuffer.h &&
            newRoomWithBuffer.y + newRoomWithBuffer.h > existingRoomWithBuffer.y
        ) {
            return true;
        }
    }
    return false;
}

function placeRooms(numRooms) {
    const rooms = [];
    let bossChamberPlaced = false;

    for (let i = 0; i < numRooms; i++) {
        let roomType = selectRoomType();
        if (roomType.type === 'BossChamberSpecial' && bossChamberPlaced) {
            roomType = roomTypes.find(rt => rt.type === 'AlcoveSpecial');
        }
        if (roomType.type === 'BossChamberSpecial') {
            bossChamberPlaced = true;
        }

        let room = generateRoomDimensions(roomType);
        let placed = false;
        let attempts = 0;
        const MAX_PLACEMENT_ATTEMPTS = 10;

        while (!placed && attempts < MAX_PLACEMENT_ATTEMPTS) {
            room.x = Math.floor(Math.random() * (state.WIDTH - room.width));
            room.y = Math.floor(Math.random() * (state.HEIGHT - room.height));

            if (!doesRoomOverlap(room, rooms)) {
                rooms.push({
                    left: room.x,
                    top: room.y,
                    w: room.width,
                    h: room.height,
                    x: Math.floor(room.x + room.width / 2),
                    y: Math.floor(room.y + room.height / 2),
                    type: room.type
                });
                console.log(`Room ${rooms.length} (${room.type}) placed at (${room.x}, ${room.y}) size ${room.width}x${room.height}`);
                placed = true;
            } else {
                room.width = Math.max(MIN_ROOM_SIZE, room.width - 1);
                room.height = Math.max(MIN_ROOM_SIZE, room.height - 1);
                if (room.width <= MIN_ROOM_SIZE && room.height <= MIN_ROOM_SIZE) {
                    break;
                }
            }
            attempts++;
        }
    }
    console.log(`Placed ${rooms.length} out of ${numRooms} rooms`);
    return rooms;
}

function findNearestRoom(newRoom, existingRooms) {
    let nearestRoom = null;
    let minDistance = Infinity;
    for (const room of existingRooms) {
        const dx = newRoom.x - room.x;
        const dy = newRoom.y - room.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < minDistance) {
            minDistance = distance;
            nearestRoom = room;
        }
    }
    return nearestRoom;
}

function carveCorridor(startRoom, endRoom, map) {
    const startX = startRoom.x;
    const startY = startRoom.y;
    const endX = endRoom.x;
    const endY = endRoom.y;

    // Horizontal then vertical (L-shaped)
    let x = startX;
    let y = startY;
    while (x !== endX) {
        map[y][x] = ' ';
        x += Math.sign(endX - x);
    }
    while (y !== endY) {
        map[y][x] = ' ';
        y += Math.sign(endY - y);
    }
}

function generateLevel() {
    let map = [];
    for (let y = 0; y < state.HEIGHT; y++) {
        map[y] = [];
        for (let x = 0; x < state.WIDTH; x++) {
            map[y][x] = '#';
        }
    }

    const rooms = placeRooms(18);

    for (const room of rooms) {
        for (let y = room.top; y < room.top + room.h; y++) {
            for (let x = room.left; x < room.left + room.w; x++) {
                map[y][x] = ' ';
            }
        }
    }

    if (rooms.length > 0) {
        const connectedRooms = [rooms[0]];
        for (let i = 1; i < rooms.length; i++) {
            const newRoom = rooms[i];
            const nearestRoom = findNearestRoom(newRoom, connectedRooms);
            carveCorridor(newRoom, nearestRoom, map);
            connectedRooms.push(newRoom);
        }
    }

    return { map, rooms };
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
        state.stairsUp[tier] = null;
        state.stairsDown[tier] = null;
        state.discoveredWalls[tier] = new Set();
        state.discoveredTileCount[tier] = 0;
        state.visibleTiles[tier] = new Set();
        state.tileMap[tier] = buildTileMap(tier);

        const firstRoom = newLevelData.rooms[0];
        let stairUpX = firstRoom.left + 1 + Math.floor(Math.random() * (firstRoom.w - 2));
        let stairUpY = firstRoom.top + 1 + Math.floor(Math.random() * (firstRoom.h - 2));
        state.levels[tier].map[stairUpY][stairUpX] = '<';
        state.stairsUp[tier] = { x: stairUpX, y: stairUpY };

        const downRoomIndex = Math.floor(Math.random() * (newLevelData.rooms.length - 1)) + 1;
        const downRoom = newLevelData.rooms[downRoomIndex];
        let stairDownX = downRoom.left + 1 + Math.floor(Math.random() * (downRoom.w - 2));
        let stairDownY = downRoom.top + 1 + Math.floor(Math.random() * (downRoom.h - 2));
        state.levels[tier].map[stairDownY][stairDownX] = '>';
        state.stairsDown[tier] = { x: stairDownX, y: stairDownY };

        state.monsters[tier] = generateLevelMonsters(tier);
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