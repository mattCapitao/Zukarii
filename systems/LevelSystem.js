// systems/LevelSystem.js
import { System } from '../core/Systems.js';
import { MapComponent, EntityListComponent, PositionComponent, ExplorationComponent } from '../core/Components.js';

const roomTypes = [
    { type: 'SquareRoom', probability: 30, minW: 11, maxW: 15, minH: 6, maxH: 8 },
    { type: 'VerticalRoom', probability: 15, minW: 8, maxW: 11, minH: 8, maxH: 10 },
    { type: 'HorizontalRoom', probability: 40, minW: 14, maxW: 21, minH: 6, maxH: 8 },
    { type: 'AlcoveSpecial', probability: 10, minW: 8, maxW: 8, minH: 4, maxH: 4 },
    { type: 'BossChamberSpecial', probability: 5, minW: 20, maxW: 24, minH: 10, maxH: 12 }
];

export class LevelSystem extends System {
    constructor(entityManager, eventBus, state) {
        super(entityManager, eventBus);
        this.state = state;
        this.requiredComponents = ['Map', 'Tier', 'Exploration']; // Added 'Exploration'
        this.ROOM_EDGE_BUFFER = 4;
        this.CORRIDOR_EDGE_BUFFER = 2;
        this.MIN_ROOM_SIZE = 4;
        this.MAX_OVERLAP_PERCENT = 0.10;
        this.INITIAL_MIN_DISTANCE = 12;
        this.MIN_DISTANCE_FLOOR = 3;
        this.BOSS_ROOM_EVERY_X_LEVELS = 3;
        this.lastBossTier = 0;
        this.MAX_PLACEMENT_ATTEMPTS = 20;
        this.MIN_STAIR_DISTANCE = 12;
    }

    init() {
        this.eventBus.on('AddLevel', (data) => this.addLevel(data));
        this.eventBus.on('CheckLevelAfterTransitions', (data) => this.checkLevelAfterTransitions(data));
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        if (!this.entityManager.getEntitiesWith(['Tier']).some(e => e.getComponent('Tier').value === 0)) {
            this.addLevel({ tier: 0, customLevel: this.generateSurfaceLevel() });
            gameState.tier = 1;
            this.addLevel({ tier: 1 });
        }
    }

    addLevel({ tier, customLevel = null }) {
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        let levelEntity = this.entityManager.getEntitiesWith(['Tier']).find(e => e.getComponent('Tier').value === tier);

        if (!levelEntity) {
            levelEntity = this.entityManager.createEntity(`level_${tier}`);
            console.log(`Created level entity with ID: ${levelEntity.id} for tier ${tier}`);
            this.entityManager.addComponentToEntity(levelEntity.id, { type: 'Tier', value: tier });

            let levelData;
            if (customLevel) {
                const mapComp = new MapComponent(customLevel);
                mapComp.map = this.padMap(customLevel.map);
                if (customLevel.stairsUp) mapComp.stairsUp = customLevel.stairsUp;
                if (customLevel.stairsDown) mapComp.stairsDown = customLevel.stairsDown;
                this.entityManager.addComponentToEntity(levelEntity.id, mapComp);
                console.log(`Added MapComponent to ${levelEntity.id} with map size ${mapComp.map.length}x${mapComp.map[0].length}`);
                this.entityManager.addComponentToEntity(levelEntity.id, new EntityListComponent({
                    monsters: customLevel.monsters || [],
                    treasures: customLevel.treasures || [],
                    fountains: customLevel.fountains || []
                }));
                this.entityManager.addComponentToEntity(levelEntity.id, new ExplorationComponent());
                this.adjustPlayerPosition(levelEntity, customLevel.stairsUp || customLevel.stairsDown);
                levelData = customLevel;
            } else {
                const hasBossRoom = (tier - this.lastBossTier >= this.BOSS_ROOM_EVERY_X_LEVELS) || Math.random() < 0.05;
                levelData = this.generateLevel(hasBossRoom);
                const mapComp = new MapComponent(levelData);
                this.entityManager.addComponentToEntity(levelEntity.id, mapComp);
                const entityList = new EntityListComponent();
                entityList.fountains = this.generateFountains(tier, levelData.map, levelData.rooms);
                this.entityManager.addComponentToEntity(levelEntity.id, entityList);
                this.entityManager.addComponentToEntity(levelEntity.id, new ExplorationComponent());
                this.placeStairs(levelEntity, levelData, hasBossRoom);

                entityList.treasures = this.generateLootEntities(tier, levelData.map, levelData.rooms);
                console.log(`Generated ${entityList.treasures.length} loot entities for tier ${tier}`, entityList.treasures);

                // Ensure stairs are set in mapComp after placeStairs
                mapComp.stairsUp = levelData.stairsUp;
                mapComp.stairsDown = levelData.stairsDown;
                this.adjustPlayerPosition(levelEntity, levelData.stairsUp);
                if (hasBossRoom) this.lastBossTier = tier;

                this.eventBus.emit('SpawnMonsters', {
                    tier,
                    map: levelData.map,
                    rooms: levelData.rooms,
                    hasBossRoom,
                    spawnPool: { monsterTemplates: true, uniqueMonsters: false }
                });
            }

            gameState.needsInitialRender = true;
            gameState.needsRender = true;
            this.checkLevelAfterTransitions({ tier });
            this.ensureRoomConnections(levelEntity); // Added final check for room connections

            // Validate MapComponent before emitting LevelAdded
            const mapComponent = levelEntity.getComponent('Map');
            if (mapComponent) {
                console.log(`MapComponent for tier ${tier} contains map: ${mapComponent.map ? 'yes' : 'no'}`);
                if (tier === 0) {
                    if (mapComponent.stairsDown) {
                        this.eventBus.emit('LevelAdded', { tier, entityId: levelEntity.id });
                    } else {
                        console.error(`LevelSystem: Invalid MapComponent for tier ${tier}, missing stairsDown`);
                    }
                } else {
                    if (mapComponent.stairsUp && mapComponent.stairsDown) {
                        this.eventBus.emit('LevelAdded', { tier, entityId: levelEntity.id });
                    } else {
                        console.error(`LevelSystem: Invalid MapComponent for tier ${tier}, missing stairsUp or stairsDown`);
                    }
                }
            } else {
                console.error(`LevelSystem: No MapComponent found for tier ${tier}`);
            }
        } else {
            this.checkLevelAfterTransitions({ tier });
            const mapComponent = levelEntity.getComponent('Map');
            if (mapComponent) {
                if (tier === 0) {
                    if (mapComponent.stairsDown) {
                        this.eventBus.emit('LevelAdded', { tier, entityId: levelEntity.id });
                    } else {
                        console.error(`LevelSystem: Invalid MapComponent for existing tier ${tier}, missing stairsDown`);
                    }
                } else {
                    if (mapComponent.stairsUp && mapComponent.stairsDown) {
                        this.eventBus.emit('LevelAdded', { tier, entityId: levelEntity.id });
                    } else {
                        console.error(`LevelSystem: Invalid MapComponent for existing tier ${tier}, missing stairsUp or stairsDown`);
                    }
                }
            } else {
                console.error(`LevelSystem: No MapComponent found for existing tier ${tier}`);
            }
        }
    }

    checkLevelAfterTransitions({ tier }) {
        const levelEntity = this.entityManager.getEntitiesWith(['Tier']).find(e => e.getComponent('Tier').value === tier);
        if (!levelEntity) return;

        const mapComp = levelEntity.getComponent('Map');
        const hasPortal = mapComp.map.some(row => row.includes('?'));
        if (tier !== 0 && !hasPortal) {
            const rooms = mapComp.rooms.filter(r => r.type !== 'BossChamberSpecial');
            if (rooms.length > 0) {
                const room = rooms[Math.floor(Math.random() * rooms.length)];
                let x, y;
                do {
                    x = room.left + 1 + Math.floor(Math.random() * (room.w - 2));
                    y = room.top + 1 + Math.floor(Math.random() * (room.h - 2));
                } while (mapComp.map[y][x] !== ' ');
                mapComp.map[y][x] = '?';
                this.eventBus.emit('RenderNeeded');
            }
        }
    }

    generateLevel(hasBossRoom) {
        const map = Array.from({ length: this.state.HEIGHT }, () => Array(this.state.WIDTH).fill('#'));
        const roomsPerLevel = Math.floor(Math.random() * 8) + 28;
        const rooms = this.placeRooms(roomsPerLevel, hasBossRoom);

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

    placeRooms(numRooms, hasBossRoom) {
        const rooms = [];
        let bossChamberPlaced = !hasBossRoom;
        const halfRooms = Math.floor(numRooms / 2);

        if (hasBossRoom) {
            const bossRoomType = roomTypes.find(rt => rt.type === 'BossChamberSpecial');
            let room = this.generateRoomDimensions(bossRoomType);
            let attempts = 0;
            while (attempts < this.MAX_PLACEMENT_ATTEMPTS) {
                room.x = Math.floor(Math.random() * (this.state.WIDTH - room.width - 2 * this.ROOM_EDGE_BUFFER)) + this.ROOM_EDGE_BUFFER;
                room.y = Math.floor(Math.random() * (this.state.HEIGHT - room.height - 2 * this.ROOM_EDGE_BUFFER)) + this.ROOM_EDGE_BUFFER;
                if (!this.doesRoomOverlap(room, rooms)) {
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
                    bossChamberPlaced = true;
                    break;
                } else {
                    room.width = Math.max(this.MIN_ROOM_SIZE, room.width - 1);
                    room.height = Math.max(this.MIN_ROOM_SIZE, room.height - 1);
                    if (room.width < this.MIN_ROOM_SIZE || room.height < this.MIN_ROOM_SIZE) break;
                }
                attempts++;
            }
        }

        for (let i = 0; i < numRooms - (hasBossRoom ? 1 : 0); i++) {
            let roomType = this.selectRoomType();
            if (roomType.type === 'BossChamberSpecial' && bossChamberPlaced) {
                roomType = roomTypes.find(rt => rt.type === 'AlcoveSpecial');
            }
            if (roomType.type === 'BossChamberSpecial') bossChamberPlaced = true;

            let room = this.generateRoomDimensions(roomType);
            const minDistance = i < halfRooms
                ? this.INITIAL_MIN_DISTANCE
                : this.INITIAL_MIN_DISTANCE - ((this.INITIAL_MIN_DISTANCE - this.MIN_DISTANCE_FLOOR) * (i - halfRooms) / (numRooms - halfRooms));
            let attempts = 0;

            while (attempts < this.MAX_PLACEMENT_ATTEMPTS) {
                room.x = Math.floor(Math.random() * (this.state.WIDTH - room.width - 2 * this.ROOM_EDGE_BUFFER)) + this.ROOM_EDGE_BUFFER;
                room.y = Math.floor(Math.random() * (this.state.HEIGHT - room.height - 2 * this.ROOM_EDGE_BUFFER)) + this.ROOM_EDGE_BUFFER;
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
                    break;
                } else {
                    room.width = Math.max(this.MIN_ROOM_SIZE, room.width - 1);
                    room.height = Math.max(this.MIN_ROOM_SIZE, room.height - 1);
                    if (room.width < this.MIN_ROOM_SIZE || room.height < this.MIN_ROOM_SIZE) break;
                }
                attempts++;
            }
        }
        return rooms;
    }

    selectRoomType() {
        const totalProbability = roomTypes.reduce((sum, room) => sum + room.probability, 0);
        let roll = Math.random() * totalProbability;
        for (const roomType of roomTypes) {
            if (roll < roomType.probability) return roomType;
            roll -= roomType.probability;
        }
        return roomTypes[0];
    }

    generateRoomDimensions(roomType) {
        const w = Math.floor(Math.random() * (roomType.maxW - roomType.minW + 1)) + roomType.minW;
        const h = Math.floor(Math.random() * (roomType.maxH - roomType.minH + 1)) + roomType.minH;
        return { width: w, height: h, type: roomType.type };
    }

    doesRoomOverlap(newRoom, existingRooms) {
        const buffer = newRoom.type === 'BossChamberSpecial' || newRoom.type === 'AlcoveSpecial' ? this.CORRIDOR_EDGE_BUFFER : this.ROOM_EDGE_BUFFER;
        for (const room of existingRooms) {
            const overlapX = Math.max(0, Math.min(newRoom.x + newRoom.w + buffer, room.left + room.w) - Math.max(newRoom.x - buffer, room.left));
            const overlapY = Math.max(0, Math.min(newRoom.y + newRoom.h + buffer, room.top + room.h) - Math.max(newRoom.y - buffer, room.top));
            const overlapArea = overlapX * overlapY;
            const newRoomArea = newRoom.w * newRoom.h;
            const roomArea = room.w * room.h;
            const minArea = Math.min(newRoomArea, roomArea);
            if (overlapArea > minArea * this.MAX_OVERLAP_PERCENT) return true;
        }
        return false;
    }

    isTooClose(newRoom, existingRooms, minDistance) {
        return existingRooms.some(room => this.calculateDistance(newRoom.x, newRoom.y, room.x, room.y) < minDistance);
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
            if (room.connections.length < 2 && rooms.length > 2 && room.type !== 'AlcoveSpecial' && room.type !== 'BossChamberSpecial') {
                const farRoom = this.findFarRoom(room, rooms, [room, ...room.connections]);
                if (farRoom) {
                    this.carveCorridor(room, farRoom, map, rooms);
                    room.connections.push(farRoom);
                    farRoom.connections.push(room);
                }
            }
            if ((room.type === 'AlcoveSpecial' || room.type === 'BossChamberSpecial') && room.connections.length > 1) {
                room.connections = [room.connections[0]];
            }
        }
    }

    carveStraightCorridor(startRoom, endRoom, map) {
        const startX = startRoom.x;
        const startY = startRoom.y;
        const endX = endRoom.x;
        const endY = endRoom.y;

        if (startX === endX) {
            const yMin = Math.min(startY, endY);
            const yMax = Math.max(startY, endY);
            for (let y = yMin; y <= yMax; y++) {
                map[y][startX] = ' ';
                if (startX + 1 < this.state.WIDTH - this.CORRIDOR_EDGE_BUFFER) map[y][startX + 1] = ' ';
                else console.warn(`Corridor at (${startX}, ${y}) truncated due to edge`);
            }
        } else if (startY === endY) {
            const xMin = Math.min(startX, endX);
            const xMax = Math.max(startX, endX);
            for (let x = xMin; x <= xMax; x++) {
                map[startY][x] = ' ';
                if (startY + 1 < this.state.HEIGHT - this.CORRIDOR_EDGE_BUFFER) map[startY + 1][x] = ' ';
                else console.warn(`Corridor at (${x}, ${startY}) truncated due to edge`);
            }
        }
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
            if (startY + 1 < this.state.HEIGHT - this.CORRIDOR_EDGE_BUFFER) map[startY + 1][x] = ' ';
            x += Math.sign(midX - x);
        }
        let y = startY;
        while (y !== endY) {
            map[y][midX] = ' ';
            if (midX + 1 < this.state.WIDTH - this.CORRIDOR_EDGE_BUFFER) map[y][midX + 1] = ' ';
            y += Math.sign(endY - y);
        }
        x = midX;
        while (x !== endX) {
            map[endY][x] = ' ';
            if (endY + 1 < this.state.HEIGHT - this.CORRIDOR_EDGE_BUFFER) map[endY + 1][x] = ' ';
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
            if (startY + 1 < this.state.HEIGHT - this.CORRIDOR_EDGE_BUFFER) map[startY + 1][x] = ' ';
            x += Math.sign(endX - x);
        }
        let y = startY;
        while (y !== endY) {
            map[y][endX] = ' ';
            if (endX + 1 < this.state.WIDTH - this.CORRIDOR_EDGE_BUFFER) map[y][endX + 1] = ' ';
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
                if (endY + 1 < this.state.HEIGHT - this.CORRIDOR_EDGE_BUFFER) map[endY + 1][x] = ' ';
                x += Math.sign(thirdRoom.x - x);
            }
            y = endY;
            while (y !== thirdRoom.y) {
                map[y][thirdRoom.x] = ' ';
                if (thirdRoom.x + 1 < this.state.WIDTH - this.CORRIDOR_EDGE_BUFFER) map[y][thirdRoom.x + 1] = ' ';
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

    findNearestRoom(newRoom, existingRooms, excludeRooms = []) {
        let nearestRoom = null;
        let minDistance = Infinity;
        for (const room of existingRooms) {
            if (excludeRooms.includes(room)) continue;
            const distance = this.calculateDistance(newRoom.x, newRoom.y, room.x, room.y);
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
        const sortedRooms = availableRooms.map(room => ({
            room,
            distance: this.calculateDistance(newRoom.x, newRoom.y, room.x, room.y)
        })).sort((a, b) => b.distance - a.distance);
        const farHalf = sortedRooms.slice(0, Math.ceil(sortedRooms.length / 2));
        return farHalf[Math.floor(Math.random() * farHalf.length)]?.room || null;
    }

    placeStairs(levelEntity, levelData, hasBossRoom) {
        const map = levelData.map;
        let stairDownX, stairDownY, stairUpX, stairUpY;

        if (hasBossRoom) {
            const bossRoom = levelData.rooms.find(r => r.type === 'BossChamberSpecial');
            let attempts = 0;
            do {
                stairDownX = bossRoom.left + 1 + Math.floor(Math.random() * (bossRoom.w - 2));
                stairDownY = bossRoom.top + 1 + Math.floor(Math.random() * (bossRoom.h - 2));
                attempts++;
                if (attempts > 50) {
                    console.error('Failed to place stairsDown in boss room after 50 attempts');
                    stairDownX = bossRoom.left + 1;
                    stairDownY = bossRoom.top + 1;
                    break;
                }
            } while (map[stairDownY][stairDownX] !== ' ');
            map[stairDownY][stairDownX] = '⇓';
            levelData.stairsDown = { x: stairDownX, y: stairDownY };
        } else {
            let attempts = 0;
            const mapCenterX = Math.floor(this.state.WIDTH / 2);
            const mapCenterY = Math.floor(this.state.HEIGHT / 2);
            while (attempts < 50) {
                const room = levelData.rooms[Math.floor(Math.random() * levelData.rooms.length)];
                stairDownX = room.left + 1 + Math.floor(Math.random() * (room.w - 2));
                stairDownY = room.top + 1 + Math.floor(Math.random() * (room.h - 2));
                if (map[stairDownY][stairDownX] === ' ' && this.calculateDistance(stairDownX, stairDownY, mapCenterX, mapCenterY) >= this.MIN_STAIR_DISTANCE) {
                    map[stairDownY][stairDownX] = '⇓';
                    levelData.stairsDown = { x: stairDownX, y: stairDownY };
                    break;
                }
                attempts++;
            }
            if (!levelData.stairsDown) {
                console.warn(`Failed to place stairsDown with distance check after 50 attempts`);
                const fallbackRoom = levelData.rooms[0];
                stairDownX = fallbackRoom.left + 1;
                stairDownY = fallbackRoom.top + 1;
                map[stairDownY][stairDownX] = '⇓';
                levelData.stairsDown = { x: stairDownX, y: stairDownY };
            }
        }

        const upRooms = hasBossRoom ? levelData.rooms.filter(r => r.type !== 'BossChamberSpecial') : levelData.rooms;
        let attempts = 0;
        while (attempts < 50) {
            const room = upRooms[Math.floor(Math.random() * upRooms.length)];
            stairUpX = room.left + 1 + Math.floor(Math.random() * (room.w - 2));
            stairUpY = room.top + 1 + Math.floor(Math.random() * (room.h - 2));
            if (map[stairUpY][stairUpX] === ' ' && this.calculateDistance(stairUpX, stairUpY, levelData.stairsDown.x, levelData.stairsDown.y) >= this.MIN_STAIR_DISTANCE) {
                map[stairUpY][stairUpX] = '⇑';
                levelData.stairsUp = { x: stairUpX, y: stairUpY };
                break;
            }
            attempts++;
        }
        if (!levelData.stairsUp) {
            console.warn(`Failed to place stairsUp with distance check after 50 attempts`);
            const fallbackRoom = upRooms[0];
            stairUpX = fallbackRoom.left + 1;
            stairUpY = fallbackRoom.top + 1;
            map[stairUpY][stairUpX] = '⇑';
            levelData.stairsUp = { x: stairUpX, y: stairUpY };
        }

        if (hasBossRoom) {
            const bossRoom = levelData.rooms.find(r => r.type === 'BossChamberSpecial');
            const paddedDistance = this.MIN_STAIR_DISTANCE + Math.floor((bossRoom.w + bossRoom.h) / 2);
            if (this.calculateDistance(levelData.stairsDown.x, levelData.stairsDown.y, this.state.WIDTH / 2, this.state.HEIGHT / 2) < paddedDistance) {
                console.warn(`StairsDown too close to map center with boss padding`);
            }
        }
    }

    generateLootEntities(tier, map, rooms) {
        const lootPerLevel = 10;
        const lootEntityIds = [];
        // Listener to collect entity IDs
        const collectEntityId = (data) => {
            if (data.tier === tier) {
                lootEntityIds.push(data.entityId);
                console.log(`LevelSystem: logged entity ID ${data.entityId} for tier ${tier}`);
            }
        };
        this.eventBus.on('LootEntityCreated', collectEntityId);

        for (let i = 0; i < lootPerLevel; i++) {
            const room = rooms[Math.floor(Math.random() * rooms.length)];
            let x, y;
            let attempts = 0;
            do {
                x = room.left + 1 + Math.floor(Math.random() * (room.w - 2));
                y = room.top + 1 + Math.floor(Math.random() * (room.h - 2));
                attempts++;
                if (attempts > 50) {
                    console.error(`Failed to place loot entity in room after 50 attempts`);
                    break;
                }
            } while (map[y][x] !== ' ');

            if (attempts <= 50) {
                const loot = {
                    x: x,
                    y: y,
                    name: "Loot Pile",
                    gold: 10,
                    torches: 0,
                    healPotions: 0,
                    items: [{
                        name: "Mbphu Greater iLvl Annihilation Staff",
                        type: "weapon",
                        attackType: "ranged",
                        baseRange: 7,
                        slots: ["mainhand", "offhand"],
                        baseDamageMin: 10,
                        baseDamageMax: 15,
                        itemTier: "relic",
                        stats: { intellect: 5, maxMana: 5, agility: 5, damageBonus: 5, rangedDamageBonus: 5 },
                        description: "The Golden Khepresh has got nothing on this babby!",
                        uniqueId: null,
                        icon: "mbphu-staff.svg"
                    }]
                };
                console.log(`LevelSystem: Emitting PlaceTreasure for loot at (${x}, ${y}) with tier ${tier}, using EventBus:`, this.eventBus);
                this.eventBus.emit('PlaceTreasure', { treasure: loot, tier });
            }
        }

        // Clean up the listener after the loop
        this.eventBus.off('LootEntityCreated', collectEntityId);
        console.log(`Generated ${lootPerLevel} loot entity IDs for tier ${tier}`, lootEntityIds);
        return lootEntityIds;
    }

    generateFountains(tier, map, rooms) {
        const fountainsPerLevel = Math.floor(Math.random() * 3) + 1;
        const fountains = [];
        for (let i = 0; i < fountainsPerLevel; i++) {
            const room = rooms[Math.floor(Math.random() * rooms.length)];
            let x, y;
            let attempts = 0;
            do {
                x = room.left + 1 + Math.floor(Math.random() * (room.w - 2));
                y = room.top + 1 + Math.floor(Math.random() * (room.h - 2));
                attempts++;
                if (attempts > 50) {
                    console.error(`Failed to place fountain in room after 50 attempts`);
                    break;
                }
            } while (map[y][x] !== ' ');
            if (attempts <= 50) {
                map[y][x] = '≅';
                const fountainEntity = this.entityManager.createEntity(`fountain_${tier}_${i}`);
                this.entityManager.addComponentToEntity(fountainEntity.id, new PositionComponent(x, y));
                this.entityManager.addComponentToEntity(fountainEntity.id, { type: 'FountainData', used: false, discovered: false });
                fountains.push(fountainEntity.id);
            }
        }
        return fountains;
    }

    generateSurfaceLevel() {
        let map = Array.from({ length: 10 }, () => Array(10).fill(' '));
        for (let y = 0; y < 10; y++) {
            for (let x = 0; x < 10; x++) {
                if (y === 0 || y === 9 || x === 0 || x === 9) map[y][x] = '#';
            }
        }
        map[5][5] = '⇓';
        const rooms = [{ left: 1, top: 1, w: 8, h: 8, x: 5, y: 5, type: 'SurfaceRoom', connections: [] }];
        return {
            map: this.padMap(map),
            rooms,
            stairsDown: { x: 5, y: 5 },
            stairsUp: { x: 0, y: 0 }, // Dummy stairsUp to satisfy validation
            playerSpawn: { x: 1, y: 1 }
        };
    }

    padMap(map) {
        const padded = Array.from({ length: this.state.HEIGHT }, () => Array(this.state.WIDTH).fill('#'));
        for (let y = 0; y < map.length; y++) {
            for (let x = 0; x < map[y].length; x++) {
                padded[y][x] = map[y][x];
            }
        }
        return padded;
    }
    
    adjustPlayerPosition(levelEntity, stair) {
        const mapComponent = levelEntity.getComponent('Map');
        if (!mapComponent || !mapComponent.map) {
            console.error(`LevelSystem: No valid MapComponent or map for entity ${levelEntity.id}`);
            return; // Fallback to prevent crash
        }
        const map = mapComponent.map;
        const directions = [
            { x: stair.x - 1, y: stair.y }, { x: stair.x + 1, y: stair.y },
            { x: stair.x, y: stair.y - 1 }, { x: stair.x, y: stair.y + 1 }
        ];
        const player = this.entityManager.getEntity('player');
        const pos = player.getComponent('Position');


        for (const dir of directions) {
            if (dir.y >= 0 && dir.y < map.length && dir.x >= 0 && dir.x < map[0].length && map[dir.y][dir.x] === ' ') {
                pos.x = dir.x;
                pos.y = dir.y;
                this.eventBus.emit('PositionChanged', { entityId: 'player', x: pos.x, y: pos.y });
               
                console.warn(`LevelSystem:  Set player position to (${pos.x}, ${pos.y}) near stairs at (${stair.x}, ${stair.y})`);
                return;
            }
        }
        // Fallback position if no adjacent walkable tile is found
        pos.x = 1;
        pos.y = 1;
        console.warn(`LevelSystem: No adjacent walkable tile found near (${stair.x}, ${stair.y}), using fallback position (1, 1)`);

       this.eventBus.emit('PositionChanged ', { entityId: 'player', x: pos.x, y: pos.y });
        
    }

    ensureRoomConnections(levelEntity) {
        const mapComp = levelEntity.getComponent('Map');
        const rooms = mapComp.rooms;

        for (const room of rooms) {
            if ((room.type === 'AlcoveSpecial' || room.type === 'BossChamberSpecial') && room.connections.length === 0) {
                console.warn(`Room at (${room.left}, ${room.top}) of type ${room.type} has no connections, adding one`);
                const nearestRoom = this.findNearestRoom(room, rooms, [room]);
                if (nearestRoom) {
                    this.carveCorridor(room, nearestRoom, mapComp.map, rooms);
                    room.connections.push(nearestRoom);
                    nearestRoom.connections.push(room);
                } else {
                    console.error(`No nearest room found for isolated ${room.type} at (${room.left}, ${room.top})`);
                }
            }
        }
    }

    calculateDistance(x1, y1, x2, y2) {
        return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
    }
}