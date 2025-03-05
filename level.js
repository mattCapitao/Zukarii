console.log("level.js loaded");

const roomTypes = [
    { type: 'SquareRoom', probability: 30, minW: 11, maxW: 15, minH: 6, maxH: 8 },
    { type: 'VerticalRoom', probability: 15, minW: 8, maxW: 11, minH: 8, maxH: 10 },
    { type: 'HorizontalRoom', probability: 40, minW: 14, maxW: 21, minH: 6, maxH: 8 },
    { type: 'AlcoveSpecial', probability: 10, minW: 8, maxW: 8, minH: 4, maxH: 4 },
    { type: 'BossChamberSpecial', probability: 5, minW: 20, maxW: 24, minH: 5, maxH: 8 }
];

class Level {
    constructor(state, game) {
        this.state = state;
        this.game = game;
        this.BUFFER_SIZE = 1;
        this.SPECIAL_BUFFER_SIZE = 2;
        this.MIN_ROOM_SIZE = 4;
        this.EDGE_BUFFER = 2;
        this.MAX_OVERLAP_PERCENT = 0.10;
        this.INITIAL_MIN_DISTANCE = 10;
        this.MIN_DISTANCE_FLOOR = 3;
    }

    selectRoomType() {
        const rand = Math.floor(Math.random() * 100);
        let cumulativeProbability = 0;
        for (const roomType of roomTypes) {
            cumulativeProbability += roomType.probability;
            if (rand < cumulativeProbability) {
                return roomType;
            }
        }
        return roomTypes[roomTypes.length - 1];
    }

    generateRoomDimensions(roomType) {
        const width = Math.floor(Math.random() * (roomType.maxW - roomType.minW + 1)) + roomType.minW;
        const height = Math.floor(Math.random() * (roomType.maxH - roomType.minH + 1)) + roomType.minH;
        return { width, height, type: roomType.type };
    }

    doesRoomOverlap(newRoom, existingRooms) {
        const buffer = (newRoom.type === 'AlcoveSpecial' || newRoom.type === 'BossChamberSpecial') ? this.SPECIAL_BUFFER_SIZE : this.BUFFER_SIZE;
        const newRoomWithBuffer = {
            x: newRoom.x - buffer,
            y: newRoom.y - buffer,
            w: newRoom.w + 2 * buffer,
            h: newRoom.h + 2 * buffer
        };
        const newRoomArea = newRoom.w * newRoom.h;

        for (const room of existingRooms) {
            const existingBuffer = (room.type === 'AlcoveSpecial' || room.type === 'BossChamberSpecial') ? this.SPECIAL_BUFFER_SIZE : this.BUFFER_SIZE;
            const existingRoomWithBuffer = {
                x: room.left - existingBuffer,
                y: room.top - existingBuffer,
                w: room.w + 2 * existingBuffer,
                h: room.h + 2 * existingBuffer
            };

            if (
                newRoomWithBuffer.x < existingRoomWithBuffer.x + existingRoomWithBuffer.w &&
                newRoomWithBuffer.x + newRoomWithBuffer.w > existingRoomWithBuffer.x &&
                newRoomWithBuffer.y < existingRoomWithBuffer.y + existingRoomWithBuffer.h &&
                newRoomWithBuffer.y + newRoomWithBuffer.h > existingRoomWithBuffer.y
            ) {
                const overlapX = Math.min(
                    newRoomWithBuffer.x + newRoomWithBuffer.w,
                    existingRoomWithBuffer.x + existingRoomWithBuffer.w
                ) - Math.max(newRoomWithBuffer.x, existingRoomWithBuffer.x);
                const overlapY = Math.min(
                    newRoomWithBuffer.y + newRoomWithBuffer.h,
                    existingRoomWithBuffer.y + existingRoomWithBuffer.h
                ) - Math.max(newRoomWithBuffer.y, existingRoomWithBuffer.y);
                const overlapArea = overlapX * overlapY;
                const overlapPercentage = overlapArea / newRoomArea;
                if (overlapPercentage > this.MAX_OVERLAP_PERCENT) {
                    return true;
                }
            }
        }
        return false;
    }

    isTooClose(newRoom, existingRooms, minDistance) {
        for (const room of existingRooms) {
            const dx = newRoom.x - room.x;
            const dy = newRoom.y - room.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < minDistance) {
                return true;
            }
        }
        return false;
    }

    placeRooms(numRooms) {
        const rooms = [];
        let bossChamberPlaced = false;
        const halfRooms = Math.floor(numRooms / 2);

        for (let i = 0; i < numRooms; i++) {
            let roomType = this.selectRoomType();
            if (roomType.type === 'BossChamberSpecial' && bossChamberPlaced) {
                roomType = roomTypes.find(rt => rt.type === 'AlcoveSpecial');
            }
            if (roomType.type === 'BossChamberSpecial') {
                bossChamberPlaced = true;
            }

            let room = this.generateRoomDimensions(roomType);
            let placed = false;
            let attempts = 0;
            const MAX_PLACEMENT_ATTEMPTS = 20;

            const minDistance = i < halfRooms
                ? this.INITIAL_MIN_DISTANCE
                : this.INITIAL_MIN_DISTANCE - ((this.INITIAL_MIN_DISTANCE - this.MIN_DISTANCE_FLOOR) * (i - halfRooms) / (numRooms - halfRooms));

            while (!placed && attempts < MAX_PLACEMENT_ATTEMPTS) {
                room.x = Math.floor(Math.random() * (this.state.WIDTH - room.width - 2 * this.EDGE_BUFFER)) + this.EDGE_BUFFER;
                room.y = Math.floor(Math.random() * (this.state.HEIGHT - room.height - 2 * this.EDGE_BUFFER)) + this.EDGE_BUFFER;

                if (!this.doesRoomOverlap(room, rooms) && (rooms.length === 0 || !this.isTooClose(room, rooms, minDistance))) {
                    rooms.push({
                        left: room.x,
                        top: room.y,
                        w: room.width,
                        h: room.height,
                        x: Math.floor(room.x + room.width / 2),
                        y: Math.floor(room.y + room.height / 2),
                        type: room.type,
                        connections: []
                    });
                    console.log(`Room ${rooms.length} (${room.type}) placed at (${room.x}, ${room.y}) size ${room.width}x${room.height}, minDistance: ${minDistance.toFixed(2)}`);
                    placed = true;
                } else {
                    room.width = Math.max(this.MIN_ROOM_SIZE, room.width - 1);
                    room.height = Math.max(this.MIN_ROOM_SIZE, room.height - 1);
                    if (room.width <= this.MIN_ROOM_SIZE && room.height <= this.MIN_ROOM_SIZE) {
                        break;
                    }
                }
                attempts++;
            }
        }
        console.log(`Placed ${rooms.length} out of ${numRooms} rooms`);
        return rooms;
    }

    findNearestRoom(newRoom, existingRooms, excludeRooms = []) {
        let nearestRoom = null;
        let minDistance = Infinity;
        for (const room of existingRooms) {
            if (excludeRooms.includes(room)) continue;
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

    findFarRoom(newRoom, existingRooms, excludeRooms = []) {
        const availableRooms = existingRooms.filter(r => !excludeRooms.includes(r));
        if (availableRooms.length === 0) return null;

        const sortedRooms = availableRooms.map(room => {
            const dx = newRoom.x - room.x;
            const dy = newRoom.y - room.y;
            return { room, distance: Math.sqrt(dx * dx + dy * dy) };
        }).sort((a, b) => b.distance - a.distance);

        const farHalf = sortedRooms.slice(0, Math.ceil(sortedRooms.length / 2));
        return farHalf[Math.floor(Math.random() * farHalf.length)]?.room || null;
    }

    carveStraightCorridor(startRoom, endRoom, map) {
        const startX = startRoom.x;
        const startY = startRoom.y;
        const endX = endRoom.x;
        const endY = endRoom.y;

        let x = startX;
        while (x !== endX) {
            map[startY][x] = ' ';
            map[startY + 1 > this.state.HEIGHT - 1 ? startY : startY + 1][x] = ' ';
            x += Math.sign(endX - x);
        }
        let y = startY;
        while (y !== endY) {
            map[y][endX] = ' ';
            map[y][endX + 1 > this.state.WIDTH - 1 ? endX : endX + 1] = ' ';
            y += Math.sign(endY - y);
        }
        map[endY][endX] = ' ';
        map[endY + 1 > this.state.HEIGHT - 1 ? endY : endY + 1][endX] = ' ';
    }

    carveLCorridor(startRoom, endRoom, map) {
        const startX = startRoom.x;
        const startY = startRoom.y;
        const endX = endRoom.x;
        const endY = endRoom.y;
        const midX = Math.floor((startX + endX) / 2);

        let x = startX;
        while (x !== midX) {
            map[startY][x] = ' ';
            map[startY + 1 > this.state.HEIGHT - 1 ? startY : startY + 1][x] = ' ';
            x += Math.sign(midX - x);
        }
        let y = startY;
        while (y !== endY) {
            map[y][midX] = ' ';
            map[y][midX + 1 > this.state.WIDTH - 1 ? midX : midX + 1] = ' ';
            y += Math.sign(endY - y);
        }
        x = midX;
        while (x !== endX) {
            map[endY][x] = ' ';
            map[endY + 1 > this.state.HEIGHT - 1 ? endY : endY + 1][x] = ' ';
            x += Math.sign(endX - x);
        }
    }

    carveTCorridor(startRoom, endRoom, map, rooms) {
        const startX = startRoom.x;
        const startY = startRoom.y;
        const endX = endRoom.x;
        const endY = endRoom.y;

        let x = startX;
        while (x !== endX) {
            map[startY][x] = ' ';
            map[startY + 1 > this.state.HEIGHT - 1 ? startY : startY + 1][x] = ' ';
            x += Math.sign(endX - x);
        }
        let y = startY;
        while (y !== endY) {
            map[y][endX] = ' ';
            map[y][endX + 1 > this.state.WIDTH - 1 ? endX : endX + 1] = ' ';
            y += Math.sign(endY - y);
        }

        const thirdRoom = rooms.find(r => {
            if (r === startRoom || r === endRoom) return false;
            const dx = r.x - endX;
            const dy = r.y - endY;
            return Math.sqrt(dx * dx + dy * dy) < 10;
        });
        if (thirdRoom) {
            x = endX;
            while (x !== thirdRoom.x) {
                map[endY][x] = ' ';
                map[endY + 1 > this.state.HEIGHT - 1 ? endY : endY + 1][x] = ' ';
                x += Math.sign(thirdRoom.x - x);
            }
            y = endY;
            while (y !== thirdRoom.y) {
                map[y][thirdRoom.x] = ' ';
                map[y][thirdRoom.x + 1 > this.state.WIDTH - 1 ? thirdRoom.x : thirdRoom.x + 1] = ' ';
                y += Math.sign(thirdRoom.y - y);
            }
            thirdRoom.connections.push(endRoom);
            endRoom.connections.push(thirdRoom);
        }
    }

    carveCorridor(startRoom, endRoom, map, rooms) {
        const rand = Math.random();
        if (rand < 0.2) {
            this.carveStraightCorridor(startRoom, endRoom, map);
        } else if (rand < 0.6) {
            this.carveLCorridor(startRoom, endRoom, map);
        } else {
            this.carveTCorridor(startRoom, endRoom, map, rooms);
        }
    }

    connectRooms(rooms, map) {
        if (rooms.length === 0) return;

        const connectedRooms = [rooms[0]];
        for (let i = 1; i < rooms.length; i++) {
            const newRoom = rooms[i];
            const nearestRoom = this.findNearestRoom(newRoom, connectedRooms);
            this.carveCorridor(newRoom, nearestRoom, map, rooms);
            newRoom.connections.push(nearestRoom);
            nearestRoom.connections.push(newRoom);
            connectedRooms.push(newRoom);
        }

        for (const room of rooms) {
            if (room.connections.length < 2 && rooms.length > 2) {
                const farRoom = this.findFarRoom(room, rooms, [room, ...room.connections]);
                if (farRoom && (room.type !== 'AlcoveSpecial' && room.type !== 'BossChamberSpecial')) {
                    this.carveCorridor(room, farRoom, map, rooms);
                    room.connections.push(farRoom);
                    farRoom.connections.push(room);
                }
            }
        }

        for (const room of rooms) {
            if ((room.type === 'AlcoveSpecial' || room.type === 'BossChamberSpecial') && room.connections.length > 1) {
                room.connections = [room.connections[0]];
            }
        }
    }

    generateLevel() {
        let map = [];
        for (let y = 0; y < this.state.HEIGHT; y++) {
            map[y] = [];
            for (let x = 0; x < this.state.WIDTH; x++) {
                map[y][x] = '#';
            }
        }

        const rooms = this.placeRooms(22);

        for (const room of rooms) {
            for (let y = room.top; y < room.top + room.h; y++) {
                for (let x = room.left; x < room.left + room.w; x++) {
                    map[y][x] = ' ';
                }
            }
        }

        this.connectRooms(rooms, map);

        return { map, rooms };
    }

    generateFountains(tier) {
        const map = this.state.levels[tier].map;
        const rooms = this.state.levels[tier].rooms;
        let levelFountains = [];
        for (let i = 0; i < 2; i++) {
            const room = rooms[Math.floor(Math.random() * rooms.length)];
            let x, y;
            do {
                x = room.left + 1 + Math.floor(Math.random() * (room.w - 2));
                y = room.top + 1 + Math.floor(Math.random() * (room.h - 2));
            } while (map[y][x] !== ' ');
            map[y][x] = '≅';
            levelFountains.push({ x, y, used: false, discovered: false });
        }
        return levelFountains;
    }

    generateTreasures(tier) {
        const map = this.state.levels[tier].map;
        const rooms = this.state.levels[tier].rooms;
        for (let i = 0; i < 3; i++) {
            const room = rooms[Math.floor(Math.random() * rooms.length)];
            let x, y;
            do {
                x = room.left + 1 + Math.floor(Math.random() * (room.w - 2));
                y = room.top + 1 + Math.floor(Math.random() * (room.h - 2));
            } while (map[y][x] !== ' ');
            const goldGain = 10 + Math.floor(Math.random() * 41) + tier * 10;
            map[y][x] = '$';
            this.state.treasures[tier].push({ x, y, gold: goldGain, discovered: false });
        }
    }

    addLevel(tier) {
        if (!this.state.levels[tier]) {
            const newLevelData = this.generateLevel();
            this.state.levels[tier] = newLevelData;
            this.state.treasures[tier] = [];
            this.state.monsters[tier] = [];
            this.state.fountains[tier] = [];
            this.state.stairsUp[tier] = null;
            this.state.stairsDown[tier] = null;
            this.state.discoveredWalls[tier] = new Set();
            this.state.discoveredTileCount[tier] = 0;
            this.state.visibleTiles[tier] = new Set();
            this.state.tileMap[tier] = this.buildTileMap(tier);

            const upRooms = newLevelData.rooms.filter(r => r.type !== 'AlcoveSpecial' && r.type !== 'BossChamberSpecial');
            const upRoomIndex = Math.floor(Math.random() * upRooms.length);
            const upRoom = upRooms[upRoomIndex];
            let stairUpX = upRoom.left + 1 + Math.floor(Math.random() * (upRoom.w - 2));
            let stairUpY = upRoom.top + 1 + Math.floor(Math.random() * (upRoom.h - 2));
            this.state.levels[tier].map[stairUpY][stairUpX] = '⇑';
            this.state.stairsUp[tier] = { x: stairUpX, y: stairUpY };

            let downRoom, stairDownX, stairDownY;
            const downOptions = newLevelData.rooms.map(room => {
                const centerX = room.left + Math.floor(room.w / 2);
                const centerY = room.top + Math.floor(room.h / 2);
                const dx = stairUpX - centerX;
                const dy = stairUpY - centerY;
                return { room, distance: Math.sqrt(dx * dx + dy * dy) };
            }).sort((a, b) => b.distance - a.distance);

            const farRooms = downOptions.filter(opt => opt.distance >= this.state.MIN_STAIR_DISTANCE);
            downRoom = farRooms.find(opt => opt.room.type === 'BossChamberSpecial')?.room ||
                farRooms.find(opt => opt.room.type === 'AlcoveSpecial')?.room ||
                farRooms[0]?.room || downOptions[0].room;
            stairDownX = downRoom.left + 1 + Math.floor(Math.random() * (downRoom.w - 2));
            stairDownY = downRoom.top + 1 + Math.floor(Math.random() * (downRoom.h - 2));
            this.state.levels[tier].map[stairDownY][stairDownX] = '⇓';
            this.state.stairsDown[tier] = { x: stairDownX, y: stairDownY };

            this.state.monsters[tier] = this.game.monsters.generateLevelMonsters(tier);
            console.log(`Tier Monsters: ${this.state.monsters[tier]}`);
            this.state.fountains[tier] = this.generateFountains(tier);
            console.log(`Initializing treasures for tier ${tier}`);
            this.generateTreasures(tier);

            this.state.player.x = stairUpX + 1;
            this.state.player.y = stairUpY;
            const map = this.state.levels[tier].map;
            if (map[this.state.player.y][this.state.player.x] !== ' ') {
                const directions = [
                    { x: stairUpX - 1, y: stairUpY },
                    { x: stairUpX, y: stairUpY + 1 },
                    { x: stairUpX, y: stairUpY - 1 }
                ];
                for (let dir of directions) {
                    if (map[dir.y][dir.x] === ' ') {
                        this.state.player.x = dir.x;
                        this.state.player.y = dir.y;
                        break;
                    }
                }
            }
            this.state.lastPlayerX = null;
            this.state.lastPlayerY = null;
            this.state.needsInitialRender = true;
            console.log(`Tier ${tier} added: stairsUp[${tier}] at (${this.state.stairsUp[tier]?.x}, ${this.state.stairsUp[tier]?.y}), stairsDown[${tier}] at (${this.state.stairsDown[tier]?.x}, ${this.state.stairsDown[tier]?.y})`);
        } else {
            this.state.needsInitialRender = true;
            window.needsRender = true;
            console.log("Triggered initial render for tier", this.state.tier);
        }
    }

    buildTileMap(tier) {
        let map = this.state.levels[tier].map;
        const height = map.length;
        const width = map[0].length;
        let tileMap = [];
        for (let y = 0; y < height; y++) {
            tileMap[y] = [];
            for (let x = 0; x < width; x++) {
                tileMap[y][x] = { char: map[y][x], class: 'undiscovered' };
            }
        }
        return tileMap;
    }
}

// Note: Level instance will be created in game.js or state.js where needed