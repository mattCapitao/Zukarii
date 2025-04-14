// systems/LevelSystem.js
import { System } from '../core/Systems.js';
import {
    MapComponent,
    EntityListComponent,
    PositionComponent,
    VisualsComponent,
    ExplorationComponent,
    LootSourceData,
    WallComponent,
    FloorComponent,
    StairComponent,
    PortalComponent,
    FountainComponent,
    RoomComponent
} from '../core/Components.js';

/*
const roomTypes = [
    { type: 'SquareRoom', probability: 30, minW: 11, maxW: 15, minH: 6, maxH: 8 },
    { type: 'VerticalRoom', probability: 15, minW: 8, maxW: 11, minH: 8, maxH: 10 },
    { type: 'HorizontalRoom', probability: 40, minW: 14, maxW: 21, minH: 6, maxH: 8 },
    { type: 'AlcoveSpecial', probability: 10, minW: 8, maxW: 8, minH: 4, maxH: 4 },
    { type: 'BossChamberSpecial', probability: 5, minW: 20, maxW: 24, minH: 10, maxH: 12 }
];
*/

const roomTypes = [
    { type: 'SquareRoom', probability: 30, minW: 17, maxW: 23, minH: 9, maxH: 12 },
    { type: 'VerticalRoom', probability: 20, minW: 12, maxW: 14, minH: 14, maxH: 18 },
    { type: 'HorizontalRoom', probability: 35, minW: 21, maxW: 32, minH: 9, maxH: 12 },
    { type: 'AlcoveSpecial', probability: 10, minW: 12, maxW: 12, minH: 6, maxH: 6 },
    { type: 'BossChamberSpecial', probability: 5, minW: 30, maxW: 36, minH: 15, maxH: 18 }
];

export class LevelSystem extends System {
    constructor(entityManager, eventBus, state) {
        super(entityManager, eventBus);
        this.state = state;
        this.requiredComponents = ['Map', 'Tier', 'Exploration'];
        this.ROOM_EDGE_BUFFER = 4;
        this.CORRIDOR_EDGE_BUFFER = 2;
        this.MIN_ROOM_SIZE = 8;
        this.MAX_OVERLAP_PERCENT = 0.10;
        this.INITIAL_MIN_DISTANCE =  30;
        this.MIN_DISTANCE_FLOOR = 3;
        this.BOSS_ROOM_EVERY_X_LEVELS = 3;
        this.lastBossTier = 0;
        this.MAX_PLACEMENT_ATTEMPTS = 200;
        this.MIN_STAIR_DISTANCE = 18;
        this.roomsPerLevel = 50;
    }

    init() {
        this.eventBus.on('AddLevel', (data) => this.addLevel(data));
        this.eventBus.on('CheckLevelAfterTransitions', (data) => this.checkLevelAfterTransitions(data));
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const isNewGame = gameState.tier === 0; // Tier 0 indicates a new game (default before save load)
        if (!this.entityManager.getEntitiesWith(['Tier']).some(e => e.getComponent('Tier').value === 0)) {
            // Set active tier to 0 before creating level_0
            this.entityManager.setActiveTier(0);
            const levelEntity = this.entityManager.createEntity(`level_0`);
            this.entityManager.addComponentToEntity(levelEntity.id, { type: 'Tier', value: 0 });
            console.log(`LevelSystem.js: Created level entity with ID: ${levelEntity.id} for tier 0 in init`);
            this.addLevel({ tier: 0, customLevel: this.generateSurfaceLevel(levelEntity) });

            if (isNewGame) {
                gameState.tier = 1;
                this.addLevel({ tier: 1 });
                console.log(`LevelSystem.js: init - gameState.tier set to ${gameState.tier} after creating levels 0 and 1 (new game)`);
            } else {
                // Generate levels up to the loaded tier
                for (let tier = 1; tier <= gameState.tier; tier++) {
                    this.addLevel({ tier });
                }
                console.log(`LevelSystem.js: init - Preserved loaded tier ${gameState.tier}, generated levels 0 to ${gameState.tier}`);
            }
        }
    }

    removeWallAtPosition(x, y, walls, levelEntity) {
        const tier = levelEntity.getComponent('Tier').value;
        const wallEntities = this.entityManager.getEntitiesWith(['Position', 'Wall']).filter(e => {
            const pos = e.getComponent('Position');
            return pos.x === x && pos.y === y && e.id.startsWith(`wall_${tier}_`);
        });
        if (wallEntities.length === 0 && tier !== 0) {
            console.log(`LevelSystem.js: No wall entities found at (${x}, ${y}) on tier ${tier}`);
        }
        wallEntities.forEach(wall => {
            const wallId = wall.id;
            this.entityManager.removeEntity(wallId);
            const wallIndex = walls.indexOf(wallId);
            if (wallIndex !== -1) {
                walls.splice(wallIndex, 1);
            }
           // console.log(`LevelSystem.js: Removed wall ${wallId} at (${x}, ${y}) on tier ${tier}`);
        });

        const mapComp = levelEntity.getComponent('Map');
        if (mapComp && mapComp.map[y] && mapComp.map[y][x]) {
            mapComp.map[y][x] = ' ';
           // console.log(`LevelSystem.js: Updated map at (${x}, ${y}) to floor on tier ${tier}`);
        } else {
            console.error(`LevelSystem.js: Failed to update map at (${x}, ${y}) on tier ${tier} - mapComp or map position invalid`);
        }

        const remainingWalls = this.entityManager.getEntitiesWith(['Position', 'Wall']).filter(e => {
            const pos = e.getComponent('Position');
            return pos.x === x && pos.y === y && e.id.startsWith(`wall_${tier}_`);
        });
        if (remainingWalls.length > 0) {
            console.error(`LevelSystem.js: Wall entities still exist at (${x}, ${y}) on tier ${tier} after removal:`, remainingWalls.map(e => e.id));
        }
    }

    addLevel({ tier, customLevel = null }) {
        // Set the active tier before creating any entities for this level
        this.entityManager.setActiveTier(tier);
        console.log(`LevelSystem.js: Starting level generation for tier ${tier}, active tier: ${this.entityManager.getActiveTier()}`);

        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        let levelEntity = this.entityManager.getEntitiesWith(['Tier']).find(e => e.getComponent('Tier').value === tier);
        if (!levelEntity) {
            levelEntity = this.entityManager.createEntity(`level_${tier}`);
            console.log(`LevelSystem.js: Created level entity with ID: ${levelEntity.id} for tier ${tier}`);
            this.entityManager.addComponentToEntity(levelEntity.id, { type: 'Tier', value: tier });
            console.log(`LevelSystem.js: Added Tier component to ${levelEntity.id}`);

            let levelData;
            if (customLevel) {
                levelData = customLevel;
                const mapComp = new MapComponent(levelData);
                mapComp.map = this.padMap(levelData.map, levelData.walls, levelData.floors, tier);
                if (levelData.stairsUp) mapComp.stairsUp = levelData.stairsUp;
                if (levelData.stairsDown) mapComp.stairsDown = levelData.stairsDown;
                this.entityManager.addComponentToEntity(levelEntity.id, mapComp);
                console.log(`LevelSystem.js: Added MapComponent to ${levelEntity.id} with map size ${mapComp.map.length}x${mapComp.map[0].length}`);

                const entityListComp = new EntityListComponent({
                    walls: levelData.walls || [],
                    floors: levelData.floors || [],
                    stairs: levelData.stairs || [],
                    portals: levelData.portals || [],
                    monsters: levelData.monsters || [],
                    treasures: levelData.treasures || [],
                    fountains: levelData.fountains || [],
                    rooms: levelData.roomEntityIds || []
                });
                console.log(`LevelSystem.js: Initializing EntityListComponent with rooms: ${JSON.stringify(entityListComp.rooms)}`);
                this.entityManager.addComponentToEntity(levelEntity.id, entityListComp);
                const entityList = levelEntity.getComponent('EntityList');
                console.log(`LevelSystem.js: Added EntityListComponent to ${levelEntity.id}, portals: ${entityList.portals.length}, rooms: ${JSON.stringify(entityList.rooms)}`);

                this.entityManager.addComponentToEntity(levelEntity.id, new ExplorationComponent());
                console.log(`LevelSystem.js: Added ExplorationComponent to ${levelEntity.id}`);

                this.adjustPlayerPosition(levelEntity, levelData.stairsUp || levelData.stairsDown);
            } else {
                const hasBossRoom = (tier - this.lastBossTier >= this.BOSS_ROOM_EVERY_X_LEVELS) || Math.random() < 0.05;
                this.eventBus.emit('PlaySfx', { sfx: 'bossLevel0', volume: 0.5 }); 
                console.log(`Has boss room = ${hasBossRoom} for tier ${tier}, last boss tier: ${this.lastBossTier}`);
                levelData = this.generateLevel(hasBossRoom, tier, levelEntity.id);
                console.log(`LevelSystem.js: Generated level data for tier ${tier}, roomEntityIds: ${JSON.stringify(levelData.roomEntityIds)}`);

                const mapComp = new MapComponent(levelData);
                this.entityManager.addComponentToEntity(levelEntity.id, mapComp);
                console.log(`LevelSystem.js: Added MapComponent to ${levelEntity.id} with map size ${mapComp.map.length}x${mapComp.map[0].length}`);

                const entityList = new EntityListComponent({
                    walls: levelData.walls,
                    floors: levelData.floors,
                    stairs: [],
                    portals: [],
                    monsters: [],
                    treasures: [],
                    fountains: [],
                    rooms: levelData.roomEntityIds
                });
                console.log(`LevelSystem.js: Initializing EntityListComponent with rooms: ${JSON.stringify(entityList.rooms)}`);
                entityList.fountains = this.generateFountains(tier, levelData.map, levelData.roomEntityIds);
                console.log(`LevelSystem.js: After fountains, entityList.rooms: ${JSON.stringify(entityList.rooms)}`);
                this.entityManager.addComponentToEntity(levelEntity.id, entityList);
                const updatedEntityList = levelEntity.getComponent('EntityList');
                console.log(`LevelSystem.js: Added EntityListComponent to ${levelEntity.id}, portals: ${updatedEntityList.portals.length}, rooms: ${JSON.stringify(updatedEntityList.rooms)}`);

                this.entityManager.addComponentToEntity(levelEntity.id, new ExplorationComponent());
                console.log(`LevelSystem.js: Added ExplorationComponent to ${levelEntity.id}`);

                this.placeStairs(levelEntity, levelData, hasBossRoom);
                console.log(`LevelSystem.js: After placeStairs, entityList.rooms: ${JSON.stringify(updatedEntityList.rooms)}`);
                updatedEntityList.treasures = this.generateLootEntities(tier, levelData.map, levelData.roomEntityIds);
                console.log(`LevelSystem.js: Generated ${updatedEntityList.treasures.length} loot entities for tier ${tier}, rooms: ${JSON.stringify(updatedEntityList.rooms)}`, updatedEntityList.treasures);

                mapComp.stairsUp = levelData.stairsUp;
                mapComp.stairsDown = levelData.stairsDown;
                this.adjustPlayerPosition(levelEntity, levelData.stairsUp);
                if (hasBossRoom) this.lastBossTier = tier;

                const hasElites = tier > 1;
                console.log(`LevelSystem.js: Before SpawnMonsters, entityList.rooms: ${JSON.stringify(updatedEntityList.rooms)}`);
                this.eventBus.emit('SpawnMonsters', {
                    tier,
                    map: levelData.map,
                    rooms: levelData.roomEntityIds,
                    hasBossRoom,
                    spawnPool: { randomMonsters: true, uniqueMonsters: hasElites }
                });
            }

            gameState.needsInitialRender = true;
            gameState.needsRender = true;
            this.ensureRoomConnections(levelEntity);

            this.checkLevelAfterTransitions({ tier, levelEntity });

            const mapComponent = levelEntity.getComponent('Map');
            if (mapComponent) {
                console.log(`LevelSystem.js: MapComponent for tier ${tier} contains map: ${mapComponent.map ? 'yes' : 'no'}`);
                if (tier === 0) {
                    if (mapComponent.stairsDown) {
                        this.eventBus.emit('LevelAdded', { tier, entityId: levelEntity.id });
                    } else {
                        console.error(`LevelSystem.js: Invalid MapComponent for tier ${tier}, missing stairsDown`);
                    }
                } else {
                    if (mapComponent.stairsUp && mapComponent.stairsDown) {
                        this.eventBus.emit('LevelAdded', { tier, entityId: levelEntity.id });
                    } else {
                        console.error(`LevelSystem.js: Invalid MapComponent for tier ${tier}, missing stairsUp or stairsDown`);
                    }
                }
            } else {
                console.error(`LevelSystem.js: No MapComponent found for tier ${tier}`);
            }
        } else {
            this.checkLevelAfterTransitions({ tier, levelEntity });
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

    checkLevelAfterTransitions({ tier, levelEntity = null }) {
        const entity = levelEntity || this.entityManager.getEntitiesWith(['Tier']).find(e => e.getComponent('Tier').value === tier);
        if (!entity) {
            console.warn(`LevelSystem.js: No level entity found for tier ${tier}`);
            return;
        }
        if (!levelEntity) {
            console.log(`LevelSystem.js: Fetched entity ${entity.id} via getEntitiesWith for tier ${tier}`);
        }
        console.log(`LevelSystem.js: Checking level ${entity.id}, components: ${Array.from(entity.components.keys())}`);

        const mapComp = entity.getComponent('Map');
        if (!mapComp) {
            console.error(`LevelSystem.js: MapComponent missing for level ${entity.id}`);
            return;
        }

        const entityList = entity.getComponent('EntityList');
        if (!entityList) {
            console.error(`LevelSystem.js: EntityListComponent missing for level ${entity.id}`);
            return;
        }

        const hasPortal = entityList.portals.length > 0;
        const minPortalPlacementTier = 1;
        if (tier >= minPortalPlacementTier && !hasPortal) {
            const rooms = entityList.rooms.map(id => this.entityManager.getEntity(id).getComponent('Room'));
            const validRooms = rooms.filter(r => r.roomType !== 'BossChamberSpecial');
            if (validRooms.length > 0) {
                const room = validRooms[Math.floor(Math.random() * validRooms.length)];
                let x, y;
                do {
                    x = room.left + 1 + Math.floor(Math.random() * (room.width - 2));
                    y = room.top + 1 + Math.floor(Math.random() * (room.height - 2));
                } while (mapComp.map[y][x] !== ' ');
                const portalEntity = this.entityManager.createEntity(`portal_${tier}_portal_${entityList.portals.length}`);
                this.entityManager.addComponentToEntity(portalEntity.id, new PositionComponent(x, y));
                this.entityManager.addComponentToEntity(portalEntity.id, new PortalComponent());
                const visuals = this.entityManager.addComponentToEntity(portalEntity.id, new VisualsComponent(32, 32));
                visuals.avatar = 'img/avatars/portal.png';
                entityList.portals.push(portalEntity.id);
                mapComp.map[y][x] = '?';
                this.eventBus.emit('dd');
            }
        }
    }

    generateLevel(hasBossRoom, tier, levelEntityId) {
        const levelEntity = this.entityManager.getEntity(levelEntityId);
        const map = Array.from({ length: this.state.HEIGHT }, () => Array(this.state.WIDTH).fill('#'));
        const walls = [];
        const floors = [];
        const floorPositions = new Set();

        const mapComp = new MapComponent({ map, walls, floors });
        this.entityManager.addComponentToEntity(levelEntityId, mapComp);
        console.log(`LevelSystem.js: Added MapComponent to ${levelEntityId} during generateLevel`);

        for (let y = 0; y < this.state.HEIGHT; y++) {
            for (let x = 0; x < this.state.WIDTH; x++) {
                const wallEntity = this.entityManager.createEntity(`wall_${tier}_wall_${y}_${x}`);
                this.entityManager.addComponentToEntity(wallEntity.id, new PositionComponent(x, y));
                this.entityManager.addComponentToEntity(wallEntity.id, new WallComponent());
                walls.push(wallEntity.id);
            }
        }

        const roomEntityIds = this.placeRooms(this.roomsPerLevel, hasBossRoom, levelEntityId, tier);

        for (const roomId of roomEntityIds) {
            const room = this.entityManager.getEntity(roomId).getComponent('Room');
            for (let y = room.top; y < room.top + room.height; y++) {
                for (let x = room.left; x < room.left + room.width; x++) {
                    const positionKey = `${y},${x}`;
                    if (floorPositions.has(positionKey)) continue;

                    this.removeWallAtPosition(x, y, walls, levelEntity);
                    const floorId = `floor_${tier}_floor_${y}_${x}`;
                    if (!this.entityManager.getEntity(floorId)) {
                        const floorEntity = this.entityManager.createEntity(floorId);
                        this.entityManager.addComponentToEntity(floorEntity.id, new PositionComponent(x, y));
                        this.entityManager.addComponentToEntity(floorEntity.id, new FloorComponent());
                        floors.push(floorEntity.id);
                        floorPositions.add(positionKey);
                       // console.log(`LevelSystem.js: Added floor ${floorEntity.id} at (${x}, ${y}) on tier ${tier}`);
                    }
                    map[y][x] = ' ';
                }
            }
        }

        this.connectRooms(roomEntityIds, map, floors, walls, floorPositions, tier);
        return {
            map,
            roomEntityIds,
            rooms: roomEntityIds.map(id => this.entityManager.getEntity(id).getComponent('Room')),
            walls,
            floors
        };
    }

    placeRooms(numRooms, hasBossRoom, levelEntityId, tier) {
        const roomOrigins = new Set();
        const roomEntityIds = [];
        let bossChamberPlaced = !hasBossRoom;
        const halfRooms = Math.floor(numRooms / 2);

        if (hasBossRoom) {
            const bossRoomType = roomTypes.find(rt => rt.type === 'BossChamberSpecial');
            let room = this.generateRoomDimensions(bossRoomType);
            let attempts = 0;
            while (attempts < this.MAX_PLACEMENT_ATTEMPTS) {
                room.x = Math.floor(Math.random() * (this.state.WIDTH - room.width - 2 * this.ROOM_EDGE_BUFFER)) + this.ROOM_EDGE_BUFFER;
                room.y = Math.floor(Math.random() * (this.state.HEIGHT - room.height - 2 * this.ROOM_EDGE_BUFFER)) + this.ROOM_EDGE_BUFFER;

                if (roomOrigins.has(`${room.x},${room.y}`)) {
                    attempts++;
                    continue;
                }

                const existingRooms = roomEntityIds.map(id => this.entityManager.getEntity(id).getComponent('Room'));
                if (!this.doesRoomOverlap(room, existingRooms)) {
                    const roomEntity = this.entityManager.createEntity(`room_${tier}_${room.x}_${room.y}`);
                    this.entityManager.addComponentToEntity(roomEntity.id, new RoomComponent({
                        left: room.x,
                        top: room.y,
                        width: room.width,
                        height: room.height,
                        type: room.type
                    }));
                    roomEntityIds.push(roomEntity.id);
                    roomOrigins.add(`${room.x},${room.y}`);
                    bossChamberPlaced = true;
                    break;
                } else {
                    room.width = Math.max(this.MIN_ROOM_SIZE, room.width - 1);
                    room.height = Math.max(this.MIN_ROOM_SIZE, room.height - 1);
                    if (room.width < this.MIN_ROOM_SIZE || room.height < this.MIN_ROOM_SIZE) break;
                }
                attempts++;
            }
            if (attempts >= this.MAX_PLACEMENT_ATTEMPTS) {
                console.warn(`LevelSystem.js: Failed to place BossChamberSpecial after ${this.MAX_PLACEMENT_ATTEMPTS} attempts`);
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

                if (roomOrigins.has(`${room.x},${room.y}`)) {
                    attempts++;
                    continue;
                }

                const existingRooms = roomEntityIds.map(id => this.entityManager.getEntity(id).getComponent('Room'));
                if (!this.doesRoomOverlap(room, existingRooms) && (roomEntityIds.length === 0 || !this.isTooClose(room, existingRooms, minDistance))) {
                    const roomEntity = this.entityManager.createEntity(`room_${tier}_${room.x}_${room.y}`);
                    this.entityManager.addComponentToEntity(roomEntity.id, new RoomComponent({
                        left: room.x,
                        top: room.y,
                        width: room.width,
                        height: room.height,
                        type: room.type
                    }));
                    roomEntityIds.push(roomEntity.id);
                    roomOrigins.add(`${room.x},${room.y}`);
                    break;
                } else {
                    room.width = Math.max(this.MIN_ROOM_SIZE, room.width - 1);
                    room.height = Math.max(this.MIN_ROOM_SIZE, room.height - 1);
                    if (room.width < this.MIN_ROOM_SIZE || room.height < this.MIN_ROOM_SIZE) break;
                }
                attempts++;
            }
            if (attempts >= this.MAX_PLACEMENT_ATTEMPTS) {
                console.warn(`LevelSystem.js: Failed to place room of type ${roomType.type} after ${this.MAX_PLACEMENT_ATTEMPTS} attempts`);
            }
        }
        console.log(`LevelSystem.js: Placed ${roomEntityIds.length} out of ${numRooms} rooms for tier ${tier}`);
        roomOrigins.clear();
        return roomEntityIds;
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
        const width = Math.floor(Math.random() * (roomType.maxW - roomType.minW + 1)) + roomType.minW;
        const height = Math.floor(Math.random() * (roomType.maxH - roomType.minH + 1)) + roomType.minH;
        return { width, height, type: roomType.type };
    }

    doesRoomOverlap(newRoom, existingRooms) {
        const buffer = newRoom.type === 'BossChamberSpecial' || newRoom.type === 'AlcoveSpecial' ? this.CORRIDOR_EDGE_BUFFER : this.ROOM_EDGE_BUFFER;
        for (const room of existingRooms) {
            const overlapX = Math.max(0, Math.min(newRoom.x + newRoom.w + buffer, room.left + room.width) - Math.max(newRoom.x - buffer, room.left));
            const overlapY = Math.max(0, Math.min(newRoom.y + newRoom.h + buffer, room.top + room.height) - Math.max(newRoom.y - buffer, room.top));
            const overlapArea = overlapX * overlapY;
            const newRoomArea = newRoom.w * newRoom.h;
            const roomArea = room.width * room.height;
            const minArea = Math.min(newRoomArea, roomArea);
            if (overlapArea > minArea * this.MAX_OVERLAP_PERCENT) return true;
        }
        return false;
    }

    isTooClose(newRoom, existingRooms, minDistance) {
        return existingRooms.some(room => this.calculateDistance(newRoom.x, newRoom.y, room.centerX, room.centerY) < minDistance);
    }
    /*
    connectRooms(roomEntityIds, map, floors, walls, floorPositions, tier) {
        if (roomEntityIds.length === 0) return;
        const levelEntity = this.entityManager.getEntitiesWith(['Tier']).find(e => e.getComponent('Tier').value === tier);
        const connectedRooms = [roomEntityIds[0]];
        for (let i = 1; i < roomEntityIds.length; i++) {
            const newRoomId = roomEntityIds[i];
            const nearestRoomId = this.findNearestRoom(newRoomId, connectedRooms);
            this.carveCorridor(newRoomId, nearestRoomId, map, roomEntityIds, floors, walls, floorPositions, levelEntity);
            const newRoom = this.entityManager.getEntity(newRoomId).getComponent('Room');
            const nearestRoom = this.entityManager.getEntity(nearestRoomId).getComponent('Room');
            newRoom.connections.push(nearestRoomId);
            nearestRoom.connections.push(newRoomId);
            connectedRooms.push(newRoomId);
        }

        for (const roomId of roomEntityIds) {
            const room = this.entityManager.getEntity(roomId).getComponent('Room');
            if (room.connections.length < 2 && roomEntityIds.length > 2 && room.roomType !== 'AlcoveSpecial' && room.roomType !== 'BossChamberSpecial') {
                const farRoomId = this.findFarRoom(roomId, roomEntityIds, [roomId, ...room.connections]);
                if (farRoomId) {
                    this.carveCorridor(roomId, farRoomId, map, roomEntityIds, floors, walls, floorPositions, levelEntity);
                    const farRoom = this.entityManager.getEntity(farRoomId).getComponent('Room');
                    room.connections.push(farRoomId);
                    farRoom.connections.push(roomId);
                }
            }
            if ((room.roomType === 'AlcoveSpecial' || room.roomType === 'BossChamberSpecial') && room.connections.length > 1) {
                room.connections = [room.connections[0]];
            }
        }

        // Add logging to check room types and connections
        console.log(`LevelSystem.js: Room connections after connectRooms for tier ${tier}:`);
        for (const roomId of roomEntityIds) {
            const room = this.entityManager.getEntity(roomId).getComponent('Room');
            console.log(`Room ${roomId} at (${room.left}, ${room.top}), type: ${room.roomType}, connections: ${room.connections.length} (${room.connections.join(', ')})`);
        }
    }
    */

    connectRooms(roomEntityIds, map, floors, walls, floorPositions, tier) {
        if (roomEntityIds.length === 0) return;
        const levelEntity = this.entityManager.getEntitiesWith(['Tier']).find(e => e.getComponent('Tier').value === tier);
        const connectedRooms = [roomEntityIds[0]];

        for (let i = 1; i < roomEntityIds.length; i++) {
            const newRoomId = roomEntityIds[i];
            const newRoom = this.entityManager.getEntity(newRoomId).getComponent('Room');
            // Prefer non-special rooms for special room connections
            let nearestRoomId = this.findNearestRoom(newRoomId, connectedRooms,
                newRoom.roomType === 'AlcoveSpecial' || newRoom.roomType === 'BossChamberSpecial'
                    ? connectedRooms.map(id => this.entityManager.getEntity(id).getComponent('Room').roomType)
                        .filter(type => type === 'AlcoveSpecial' || type === 'BossChamberSpecial')
                        .map((_, idx) => connectedRooms[idx])
                    : []
            );
            this.carveCorridor(newRoomId, nearestRoomId, map, roomEntityIds, floors, walls, floorPositions, levelEntity);
            newRoom.connections.push(nearestRoomId);
            const nearestRoom = this.entityManager.getEntity(nearestRoomId).getComponent('Room');
            if (!nearestRoomId) {
                console.warn(`connectRooms: No nearest room found for room ${newRoomId}`);
                continue;
            }
            nearestRoom.connections.push(newRoomId);
            connectedRooms.push(newRoomId);
        }

        // Existing extra connection logic for non-special rooms
        for (const roomId of roomEntityIds) {
            const room = this.entityManager.getEntity(roomId).getComponent('Room');
            if (room.connections.length < 2 && roomEntityIds.length > 2 && room.roomType !== 'AlcoveSpecial' && room.roomType !== 'BossChamberSpecial') {
                const farRoomId = this.findFarRoom(roomId, roomEntityIds, [roomId, ...room.connections]);
                if (farRoomId) {
                    this.carveCorridor(roomId, farRoomId, map, roomEntityIds, floors, walls, floorPositions, levelEntity);
                    const farRoom = this.entityManager.getEntity(farRoomId).getComponent('Room');
                    room.connections.push(farRoomId);
                    farRoom.connections.push(roomId);
                }
            }
            if ((room.roomType === 'AlcoveSpecial' || room.roomType === 'BossChamberSpecial') && room.connections.length > 1) {
                room.connections = [room.connections[0]];
            }
        }

        // New check for special room pairs
        for (const roomId of roomEntityIds) {
            const room = this.entityManager.getEntity(roomId).getComponent('Room');
            if ((room.roomType === 'AlcoveSpecial' || room.roomType === 'BossChamberSpecial') && room.connections.length === 1) {
                const connectedRoomId = room.connections[0];
                const connectedRoom = this.entityManager.getEntity(connectedRoomId).getComponent('Room');
                if (connectedRoom.roomType === 'AlcoveSpecial' || connectedRoom.roomType === 'BossChamberSpecial') {
                    // Isolated pair detected
                    console.warn(`Isolated pair detected: ${roomId} (${room.roomType}) and ${connectedRoomId} (${connectedRoom.roomType})`);
                    const nonSpecialRoomId = this.findNearestRoom(roomId, roomEntityIds,
                        roomEntityIds.filter(id => {
                            const r = this.entityManager.getEntity(id).getComponent('Room');
                            return r.roomType === 'AlcoveSpecial' || r.roomType === 'BossChamberSpecial' || id === roomId || id === connectedRoomId;
                        })
                    );
                    if (nonSpecialRoomId) {
                        this.carveCorridor(roomId, nonSpecialRoomId, map, roomEntityIds, floors, walls, floorPositions, levelEntity);
                        const nonSpecialRoom = this.entityManager.getEntity(nonSpecialRoomId).getComponent('Room');
                        room.connections = [nonSpecialRoomId]; // Replace connection to other special room
                        nonSpecialRoom.connections.push(roomId);
                        connectedRoom.connections = []; // Will be caught by ensureRoomConnections if still isolated
                    }
                }
            }
        }

        // Log final connections
        console.log(`LevelSystem.js: Room connections after connectRooms for tier ${tier}:`);
        for (const roomId of roomEntityIds) {
            const room = this.entityManager.getEntity(roomId).getComponent('Room');
            console.log(`Room ${roomId} at (${room.left}, ${room.top}), type: ${room.roomType}, connections: ${room.connections.length} (${room.connections.join(', ')})`);
        }
    }

    carveStraightCorridor(startRoomId, endRoomId, map, floors, walls, floorPositions, levelEntity) {
        const tier = levelEntity.getComponent('Tier').value;
        const startRoom = this.entityManager.getEntity(startRoomId).getComponent('Room');
        const endRoom = this.entityManager.getEntity(endRoomId).getComponent('Room');
        const startX = startRoom.centerX;
        const startY = startRoom.centerY;
        const endX = endRoom.centerX;
        const endY = endRoom.centerY;

        if (startX === endX) {
            const yMin = Math.min(startY, endY);
            const yMax = Math.max(startY, endY);
            for (let y = yMin; y <= yMax; y++) {
                const positionKey = `${y},${startX}`;
                const floorId = `floor_${tier}_floor_${y}_${startX}`;
                if (!floorPositions.has(positionKey) && !this.entityManager.getEntity(floorId)) {
                    this.removeWallAtPosition(startX, y, walls, levelEntity);
                    const floorEntity = this.entityManager.createEntity(floorId);
                    this.entityManager.addComponentToEntity(floorEntity.id, new PositionComponent(startX, y));
                    this.entityManager.addComponentToEntity(floorEntity.id, new FloorComponent());
                    floors.push(floorEntity.id);
                    floorPositions.add(positionKey);
                   // console.log(`LevelSystem.js: Added floor ${floorEntity.id} at (${startX}, ${y}) on tier ${tier}`);
                }
                map[y][startX] = ' ';

                if (startX + 1 < this.state.WIDTH - this.CORRIDOR_EDGE_BUFFER) {
                    const positionKey2 = `${y},${startX + 1}`;
                    const floorId2 = `floor_${tier}_floor_${y}_${startX + 1}`;
                    if (!floorPositions.has(positionKey2) && !this.entityManager.getEntity(floorId2)) {
                        this.removeWallAtPosition(startX + 1, y, walls, levelEntity);
                        const floorEntity2 = this.entityManager.createEntity(floorId2);
                        this.entityManager.addComponentToEntity(floorEntity2.id, new PositionComponent(startX + 1, y));
                        this.entityManager.addComponentToEntity(floorEntity2.id, new FloorComponent());
                        floors.push(floorEntity2.id);
                        floorPositions.add(positionKey2);
                        //console.log(`LevelSystem.js: Added floor ${floorEntity2.id} at (${startX + 1}, ${y}) on tier ${tier}`);
                    }
                    map[y][startX + 1] = ' ';
                } else {
                    console.warn(`Corridor at (${startX}, ${y}) truncated due to edge`);
                }
            }
        } else if (startY === endY) {
            const xMin = Math.min(startX, endX);
            const xMax = Math.max(startX, endX);
            for (let x = xMin; x <= xMax; x++) {
                const positionKey = `${startY},${x}`;
                const floorId = `floor_${tier}_floor_${startY}_${x}`;
                if (!floorPositions.has(positionKey) && !this.entityManager.getEntity(floorId)) {
                    this.removeWallAtPosition(x, startY, walls, levelEntity);
                    const floorEntity = this.entityManager.createEntity(floorId);
                    this.entityManager.addComponentToEntity(floorEntity.id, new PositionComponent(x, startY));
                    this.entityManager.addComponentToEntity(floorEntity.id, new FloorComponent());
                    floors.push(floorEntity.id);
                    floorPositions.add(positionKey);
                   // console.log(`LevelSystem.js: Added floor ${floorEntity.id} at (${x}, ${startY}) on tier ${tier}`);
                }
                map[startY][x] = ' ';

                if (startY + 1 < this.state.HEIGHT - this.CORRIDOR_EDGE_BUFFER) {
                    const positionKey2 = `${startY + 1},${x}`;
                    const floorId2 = `floor_${tier}_floor_${startY + 1}_${x}`;
                    if (!floorPositions.has(positionKey2) && !this.entityManager.getEntity(floorId2)) {
                        this.removeWallAtPosition(x, startY + 1, walls, levelEntity);
                        const floorEntity2 = this.entityManager.createEntity(floorId2);
                        this.entityManager.addComponentToEntity(floorEntity2.id, new PositionComponent(x, startY + 1));
                        this.entityManager.addComponentToEntity(floorEntity2.id, new FloorComponent());
                        floors.push(floorEntity2.id);
                        floorPositions.add(positionKey2);
                       // console.log(`LevelSystem.js: Added floor ${floorEntity2.id} at (${x}, ${startY + 1}) on tier ${tier}`);
                    }
                    map[startY + 1][x] = ' ';
                } else {
                    console.warn(`Corridor at (${x}, ${startY}) truncated due to edge`);
                }
            }
        }
    }

    carveLCorridor(startRoomId, endRoomId, map, floors, walls, floorPositions, levelEntity) {
        const tier = levelEntity.getComponent('Tier').value;
        const startRoom = this.entityManager.getEntity(startRoomId).getComponent('Room');
        const endRoom = this.entityManager.getEntity(endRoomId).getComponent('Room');
        const startX = startRoom.centerX;
        const startY = startRoom.centerY;
        const endX = endRoom.centerX;
        const endY = endRoom.centerY;
        const midX = Math.floor((startX + endX) / 2);

        let x = startX;
        while (x !== midX) {
            const positionKey = `${startY},${x}`;
            const floorId = `floor_${tier}_floor_${startY}_${x}`;
            if (!floorPositions.has(positionKey) && !this.entityManager.getEntity(floorId)) {
                this.removeWallAtPosition(x, startY, walls, levelEntity);
                const floorEntity = this.entityManager.createEntity(floorId);
                this.entityManager.addComponentToEntity(floorEntity.id, new PositionComponent(x, startY));
                this.entityManager.addComponentToEntity(floorEntity.id, new FloorComponent());
                floors.push(floorEntity.id);
                floorPositions.add(positionKey);
               // console.log(`LevelSystem.js: Added floor ${floorEntity.id} at (${x}, ${startY}) on tier ${tier}`);
            }
            map[startY][x] = ' ';

            if (startY + 1 < this.state.HEIGHT - this.CORRIDOR_EDGE_BUFFER) {
                const positionKey2 = `${startY + 1},${x}`;
                const floorId2 = `floor_${tier}_floor_${startY + 1}_${x}`;
                if (!floorPositions.has(positionKey2) && !this.entityManager.getEntity(floorId2)) {
                    this.removeWallAtPosition(x, startY + 1, walls, levelEntity);
                    const floorEntity2 = this.entityManager.createEntity(floorId2);
                    this.entityManager.addComponentToEntity(floorEntity2.id, new PositionComponent(x, startY + 1));
                    this.entityManager.addComponentToEntity(floorEntity2.id, new FloorComponent());
                    floors.push(floorEntity2.id);
                    floorPositions.add(positionKey2);
                  //  console.log(`LevelSystem.js: Added floor ${floorEntity2.id} at (${x}, ${startY + 1}) on tier ${tier}`);
                }
                map[startY + 1][x] = ' ';
            }
            x += Math.sign(midX - x);
        }

        let y = startY;
        while (y !== endY) {
            const positionKey = `${y},${midX}`;
            const floorId = `floor_${tier}_floor_${y}_${midX}`;
            if (!floorPositions.has(positionKey) && !this.entityManager.getEntity(floorId)) {
                this.removeWallAtPosition(midX, y, walls, levelEntity);
                const floorEntity = this.entityManager.createEntity(floorId);
                this.entityManager.addComponentToEntity(floorEntity.id, new PositionComponent(midX, y));
                this.entityManager.addComponentToEntity(floorEntity.id, new FloorComponent());
                floors.push(floorEntity.id);
                floorPositions.add(positionKey);
               // console.log(`LevelSystem.js: Added floor ${floorEntity.id} at (${midX}, ${y}) on tier ${tier}`);
            }
            map[y][midX] = ' ';

            if (midX + 1 < this.state.WIDTH - this.CORRIDOR_EDGE_BUFFER) {
                const positionKey2 = `${y},${midX + 1}`;
                const floorId2 = `floor_${tier}_floor_${y}_${midX + 1}`;
                if (!floorPositions.has(positionKey2) && !this.entityManager.getEntity(floorId2)) {
                    this.removeWallAtPosition(midX + 1, y, walls, levelEntity);
                    const floorEntity2 = this.entityManager.createEntity(floorId2);
                    this.entityManager.addComponentToEntity(floorEntity2.id, new PositionComponent(midX + 1, y));
                    this.entityManager.addComponentToEntity(floorEntity2.id, new FloorComponent());
                    floors.push(floorEntity2.id);
                    floorPositions.add(positionKey2);
                   // console.log(`LevelSystem.js: Added floor ${floorEntity2.id} at (${midX + 1}, ${y}) on tier ${tier}`);
                }
                map[y][midX + 1] = ' ';
            }
            y += Math.sign(endY - y);
        }

        x = midX;
        while (x !== endX) {
            const positionKey = `${endY},${x}`;
            const floorId = `floor_${tier}_floor_${endY}_${x}`;
            if (!floorPositions.has(positionKey) && !this.entityManager.getEntity(floorId)) {
                this.removeWallAtPosition(x, endY, walls, levelEntity);
                const floorEntity = this.entityManager.createEntity(floorId);
                this.entityManager.addComponentToEntity(floorEntity.id, new PositionComponent(x, endY));
                this.entityManager.addComponentToEntity(floorEntity.id, new FloorComponent());
                floors.push(floorEntity.id);
                floorPositions.add(positionKey);
                //console.log(`LevelSystem.js: Added floor ${floorEntity.id} at (${x}, ${endY}) on tier ${tier}`);
            }
            map[endY][x] = ' ';

            if (endY + 1 < this.state.HEIGHT - this.CORRIDOR_EDGE_BUFFER) {
                const positionKey2 = `${endY + 1},${x}`;
                const floorId2 = `floor_${tier}_floor_${endY + 1}_${x}`;
                if (!floorPositions.has(positionKey2) && !this.entityManager.getEntity(floorId2)) {
                    this.removeWallAtPosition(x, endY + 1, walls, levelEntity);
                    const floorEntity2 = this.entityManager.createEntity(floorId2);
                    this.entityManager.addComponentToEntity(floorEntity2.id, new PositionComponent(x, endY + 1));
                    this.entityManager.addComponentToEntity(floorEntity2.id, new FloorComponent());
                    floors.push(floorEntity2.id);
                    floorPositions.add(positionKey2);
                    //console.log(`LevelSystem.js: Added floor ${floorEntity2.id} at (${x}, ${endY + 1}) on tier ${tier}`);
                }
                map[endY + 1][x] = ' ';
            }
            x += Math.sign(endX - x);
        }
    }

    carveTCorridor(startRoomId, endRoomId, map, roomEntityIds, floors, walls, floorPositions, levelEntity) {
        const tier = levelEntity.getComponent('Tier').value;
        if (!startRoomId || !endRoomId) {
            console.error(`carveTCorridor: Invalid room IDs - startRoomId: ${startRoomId}, endRoomId: ${endRoomId}`);
            return;
        }
        const startRoom = this.entityManager.getEntity(startRoomId).getComponent('Room');
        const endRoom = this.entityManager.getEntity(endRoomId).getComponent('Room');

        if (!startRoom || !endRoom) {
            console.error(`carveTCorridor: Failed to retrieve Room components - startRoomId: ${startRoomId}, endRoomId: ${endRoomId}`);
            return;
        }

        const startX = startRoom.centerX;
        const startY = startRoom.centerY;
        const endX = endRoom.centerX;
        const endY = endRoom.centerY;

        let x = startX;
        while (x !== endX) {
            const positionKey = `${startY},${x}`;
            const floorId = `floor_${tier}_floor_${startY}_${x}`;
            if (!floorPositions.has(positionKey) && !this.entityManager.getEntity(floorId)) {
                this.removeWallAtPosition(x, startY, walls, levelEntity);
                const floorEntity = this.entityManager.createEntity(floorId);
                this.entityManager.addComponentToEntity(floorEntity.id, new PositionComponent(x, startY));
                this.entityManager.addComponentToEntity(floorEntity.id, new FloorComponent());
                floors.push(floorEntity.id);
                floorPositions.add(positionKey);
                //console.log(`LevelSystem.js: Added floor ${floorEntity.id} at (${x}, ${startY}) on tier ${tier}`);
            }
            map[startY][x] = ' ';

            if (startY + 1 < this.state.HEIGHT - this.CORRIDOR_EDGE_BUFFER) {
                const positionKey2 = `${startY + 1},${x}`;
                const floorId2 = `floor_${tier}_floor_${startY + 1}_${x}`;
                if (!floorPositions.has(positionKey2) && !this.entityManager.getEntity(floorId2)) {
                    this.removeWallAtPosition(x, startY + 1, walls, levelEntity);
                    const floorEntity2 = this.entityManager.createEntity(floorId2);
                    this.entityManager.addComponentToEntity(floorEntity2.id, new PositionComponent(x, startY + 1));
                    this.entityManager.addComponentToEntity(floorEntity2.id, new FloorComponent());
                    floors.push(floorEntity2.id);
                    floorPositions.add(positionKey2);
                   // console.log(`LevelSystem.js: Added floor ${floorEntity2.id} at (${x}, ${startY + 1}) on tier ${tier}`);
                }
                map[startY + 1][x] = ' ';
            }
            x += Math.sign(endX - x);
        }

        let y = startY;
        while (y !== endY) {
            const positionKey = `${y},${endX}`;
            const floorId = `floor_${tier}_floor_${y}_${endX}`;
            if (!floorPositions.has(positionKey) && !this.entityManager.getEntity(floorId)) {
                this.removeWallAtPosition(endX, y, walls, levelEntity);
                const floorEntity = this.entityManager.createEntity(floorId);
                this.entityManager.addComponentToEntity(floorEntity.id, new PositionComponent(endX, y));
                this.entityManager.addComponentToEntity(floorEntity.id, new FloorComponent());
                floors.push(floorEntity.id);
                floorPositions.add(positionKey);
               // console.log(`LevelSystem.js: Added floor ${floorEntity.id} at (${endX}, ${y}) on tier ${tier}`);
            }
            map[y][endX] = ' ';

            if (endX + 1 < this.state.WIDTH - this.CORRIDOR_EDGE_BUFFER) {
                const positionKey2 = `${y},${endX + 1}`;
                const floorId2 = `floor_${tier}_floor_${y}_${endX + 1}`;
                if (!floorPositions.has(positionKey2) && !this.entityManager.getEntity(floorId2)) {
                    this.removeWallAtPosition(endX + 1, y, walls, levelEntity);
                    const floorEntity2 = this.entityManager.createEntity(floorId2);
                    this.entityManager.addComponentToEntity(floorEntity2.id, new PositionComponent(endX + 1, y));
                    this.entityManager.addComponentToEntity(floorEntity2.id, new FloorComponent());
                    floors.push(floorEntity2.id);
                    floorPositions.add(positionKey2);
                   // console.log(`LevelSystem.js: Added floor ${floorEntity2.id} at (${endX + 1}, ${y}) on tier ${tier}`);
                }
                map[y][endX + 1] = ' ';
            }
            y += Math.sign(endY - y);
        }

        const thirdRoomId = roomEntityIds.find(rId => {
            const r = this.entityManager.getEntity(rId).getComponent('Room');
            if (rId === startRoomId || rId === endRoomId) return false;
            const dx = r.centerX - endX;
            const dy = r.centerY - endY;
            return Math.sqrt(dx * dx + dy * dy) < 10;
        });
        if (thirdRoomId) {
            const thirdRoom = this.entityManager.getEntity(thirdRoomId).getComponent('Room');
            x = endX;
            while (x !== thirdRoom.centerX) {
                const positionKey = `${endY},${x}`;
                const floorId = `floor_${tier}_floor_${endY}_${x}`;
                if (!floorPositions.has(positionKey) && !this.entityManager.getEntity(floorId)) {
                    this.removeWallAtPosition(x, endY, walls, levelEntity);
                    const floorEntity = this.entityManager.createEntity(floorId);
                    this.entityManager.addComponentToEntity(floorEntity.id, new PositionComponent(x, endY));
                    this.entityManager.addComponentToEntity(floorEntity.id, new FloorComponent());
                    floors.push(floorEntity.id);
                    floorPositions.add(positionKey);
                    //console.log(`LevelSystem.js: Added floor ${floorEntity.id} at (${x}, ${endY}) on tier ${tier}`);
                }
                map[endY][x] = ' ';

                if (endY + 1 < this.state.HEIGHT - this.CORRIDOR_EDGE_BUFFER) {
                    const positionKey2 = `${endY + 1},${x}`;
                    const floorId2 = `floor_${tier}_floor_${endY + 1}_${x}`;
                    if (!floorPositions.has(positionKey2) && !this.entityManager.getEntity(floorId2)) {
                        this.removeWallAtPosition(x, endY + 1, walls, levelEntity);
                        const floorEntity2 = this.entityManager.createEntity(floorId2);
                        this.entityManager.addComponentToEntity(floorEntity2.id, new PositionComponent(x, endY + 1));
                        this.entityManager.addComponentToEntity(floorEntity2.id, new FloorComponent());
                        floors.push(floorEntity2.id);
                        floorPositions.add(positionKey2);
                       // console.log(`LevelSystem.js: Added floor ${floorEntity2.id} at (${x}, ${endY + 1}) on tier ${tier}`);
                    }
                    map[endY + 1][x] = ' ';
                }
                x += Math.sign(thirdRoom.centerX - x);
            }

            y = endY;
            while (y !== thirdRoom.centerY) {
                const positionKey = `${y},${thirdRoom.centerX}`;
                const floorId = `floor_${tier}_floor_${y}_${thirdRoom.centerX}`;
                if (!floorPositions.has(positionKey) && !this.entityManager.getEntity(floorId)) {
                    this.removeWallAtPosition(thirdRoom.centerX, y, walls, levelEntity);
                    const floorEntity = this.entityManager.createEntity(floorId);
                    this.entityManager.addComponentToEntity(floorEntity.id, new PositionComponent(thirdRoom.centerX, y));
                    this.entityManager.addComponentToEntity(floorEntity.id, new FloorComponent());
                    floors.push(floorEntity.id);
                    floorPositions.add(positionKey);
                    //console.log(`LevelSystem.js: Added floor ${floorEntity.id} at (${thirdRoom.centerX}, ${y}) on tier ${tier}`);
                }
                map[y][thirdRoom.centerX] = ' ';

                if (thirdRoom.centerX + 1 < this.state.WIDTH - this.CORRIDOR_EDGE_BUFFER) {
                    const positionKey2 = `${y},${thirdRoom.centerX + 1}`;
                    const floorId2 = `floor_${tier}_floor_${y}_${thirdRoom.centerX + 1}`;
                    if (!floorPositions.has(positionKey2) && !this.entityManager.getEntity(floorId2)) {
                        this.removeWallAtPosition(thirdRoom.centerX + 1, y, walls, levelEntity);
                        const floorEntity2 = this.entityManager.createEntity(floorId2);
                        this.entityManager.addComponentToEntity(floorEntity2.id, new PositionComponent(thirdRoom.centerX + 1, y));
                        this.entityManager.addComponentToEntity(floorEntity2.id, new FloorComponent());
                        floors.push(floorEntity2.id);
                        floorPositions.add(positionKey2);
                       // console.log(`LevelSystem.js: Added floor ${floorEntity2.id} at (${thirdRoom.centerX + 1}, ${y}) on tier ${tier}`);
                    }
                    map[y][thirdRoom.centerX + 1] = ' ';
                }
                y += Math.sign(thirdRoom.centerY - y);
            }

            thirdRoom.connections.push(endRoomId);
            endRoom.connections.push(thirdRoomId);
        }
    }

    carveCorridor(startRoomId, endRoomId, map, roomEntityIds, floors, walls, floorPositions, levelEntity) {
        const rand = Math.random();
        if (rand < 0.2) {
            this.carveStraightCorridor(startRoomId, endRoomId, map, floors, walls, floorPositions, levelEntity);
        } else if (rand < 0.6) {
            this.carveLCorridor(startRoomId, endRoomId, map, floors, walls, floorPositions, levelEntity);
        } else {
            this.carveTCorridor(startRoomId, endRoomId, map, roomEntityIds, floors, walls, floorPositions, levelEntity);
        }
    }

    findNearestRoom(roomId, existingRoomIds, excludeRoomIds = []) {
        const room = this.entityManager.getEntity(roomId).getComponent('Room');
        let nearestRoomId = null;
        let minDistance = Infinity;
        for (const existingId of existingRoomIds) {
            if (excludeRoomIds.includes(existingId)) continue;
            const existingRoom = this.entityManager.getEntity(existingId).getComponent('Room');
            const distance = this.calculateDistance(room.centerX, room.centerY, existingRoom.centerX, existingRoom.centerY);
            if (distance < minDistance) {
                minDistance = distance;
                nearestRoomId = existingId;
            }
        }
        return nearestRoomId;
    }

    findFarRoom(roomId, existingRoomIds, excludeRoomIds = []) {
        const room = this.entityManager.getEntity(roomId).getComponent('Room');
        const availableRooms = existingRoomIds.filter(rId => !excludeRoomIds.includes(rId));
        if (availableRooms.length === 0) return null;
        const sortedRooms = availableRooms.map(rId => {
            const r = this.entityManager.getEntity(rId).getComponent('Room');
            return {
                roomId: rId,
                distance: this.calculateDistance(room.centerX, room.centerY, r.centerX, r.centerY)
            };
        }).sort((a, b) => b.distance - a.distance);
        const farHalf = sortedRooms.slice(0, Math.ceil(sortedRooms.length / 2));
        return farHalf[Math.floor(Math.random() * farHalf.length)]?.roomId || null;
    }

    placeStairs(levelEntity, levelData, hasBossRoom) {
        const map = levelData.map;
        const entityList = levelEntity.getComponent('EntityList');
        const tier = levelEntity.getComponent('Tier').value;
        let stairDownX, stairDownY, stairUpX, stairUpY;

        if (hasBossRoom) {
            const bossRoomId = levelData.roomEntityIds.find(rId => this.entityManager.getEntity(rId).getComponent('Room').roomType === 'BossChamberSpecial');
            const bossRoom = this.entityManager.getEntity(bossRoomId).getComponent('Room');
            let attempts = 0;
            do {
                stairDownX = bossRoom.left + 1 + Math.floor(Math.random() * (bossRoom.width - 2));
                stairDownY = bossRoom.top + 1 + Math.floor(Math.random() * (bossRoom.height - 2));
                attempts++;
                if (attempts > 50) {
                    console.error('Failed to place stairsDown in boss room after 50 attempts');
                    stairDownX = bossRoom.left + 1;
                    stairDownY = bossRoom.top + 1;
                    break;
                }
            } while (map[stairDownY][stairDownX] !== ' ');

            const stairDownEntity = this.entityManager.createEntity(`stair_${tier}_stair_down_${stairDownX}_${stairDownY}`);
            this.entityManager.addComponentToEntity(stairDownEntity.id, new PositionComponent(stairDownX, stairDownY));
            this.entityManager.addComponentToEntity(stairDownEntity.id, new StairComponent('down'));
            const visuals = this.entityManager.addComponentToEntity(stairDownEntity.id, new VisualsComponent(32, 32));
            visuals.avatar = 'img/avatars/stairsdown.png';
            entityList.stairs.push(stairDownEntity.id);

            map[stairDownY][stairDownX] = '⇓';
            levelData.stairsDown = { x: stairDownX, y: stairDownY };
        } else {
            let attempts = 0;
            const mapCenterX = Math.floor(this.state.WIDTH / 2);
            const mapCenterY = Math.floor(this.state.HEIGHT / 2);
            while (attempts < 50) {
                const roomId = levelData.roomEntityIds[Math.floor(Math.random() * levelData.roomEntityIds.length)];
                const room = this.entityManager.getEntity(roomId).getComponent('Room');
                stairDownX = room.left + 1 + Math.floor(Math.random() * (room.width - 2));
                stairDownY = room.top + 1 + Math.floor(Math.random() * (room.height - 2));
                if (map[stairDownY][stairDownX] === ' ' && this.calculateDistance(stairDownX, stairDownY, mapCenterX, mapCenterY) >= this.MIN_STAIR_DISTANCE) {
                    const stairDownEntity = this.entityManager.createEntity(`stair_${tier}_stair_down_${stairDownX}_${stairDownY}`);
                    this.entityManager.addComponentToEntity(stairDownEntity.id, new PositionComponent(stairDownX, stairDownY));
                    this.entityManager.addComponentToEntity(stairDownEntity.id, new StairComponent('down'));
                    const visuals = this.entityManager.addComponentToEntity(stairDownEntity.id, new VisualsComponent(32, 32));
                    visuals.avatar = 'img/avatars/stairsdown.png';
                    entityList.stairs.push(stairDownEntity.id);

                    map[stairDownY][stairDownX] = '⇓';
                    levelData.stairsDown = { x: stairDownX, y: stairDownY };
                    break;
                }
                attempts++;
            }
            if (!levelData.stairsDown) {
                console.warn(`Failed to place stairsDown with distance check after 50 attempts`);
                const fallbackRoom = this.entityManager.getEntity(levelData.roomEntityIds[0]).getComponent('Room');
                stairDownX = fallbackRoom.left + 1;
                stairDownY = fallbackRoom.top + 1;

                const stairDownEntity = this.entityManager.createEntity(`stair_${tier}_stair_down_${stairDownX}_${stairDownY}`);
                this.entityManager.addComponentToEntity(stairDownEntity.id, new PositionComponent(stairDownX, stairDownY));
                this.entityManager.addComponentToEntity(stairDownEntity.id, new StairComponent('down'));
                const visuals = this.entityManager.addComponentToEntity(stairDownEntity.id, new VisualsComponent(32, 32));
                visuals.avatar = 'img/avatars/stairsdown.png';
                entityList.stairs.push(stairDownEntity.id);

                map[stairDownY][stairDownX] = '⇓';
                levelData.stairsDown = { x: stairDownX, y: stairDownY };
            }
        }

        const upRooms = hasBossRoom ? levelData.roomEntityIds.filter(rId => this.entityManager.getEntity(rId).getComponent('Room').roomType !== 'BossChamberSpecial') : levelData.roomEntityIds;
        let attempts = 0;
        while (attempts < 50) {
            const roomId = upRooms[Math.floor(Math.random() * upRooms.length)];
            const room = this.entityManager.getEntity(roomId).getComponent('Room');
            stairUpX = room.left + 1 + Math.floor(Math.random() * (room.width - 2));
            stairUpY = room.top + 1 + Math.floor(Math.random() * (room.height - 2));
            if (map[stairUpY][stairUpX] === ' ' && this.calculateDistance(stairUpX, stairUpY, levelData.stairsDown.x, levelData.stairsDown.y) >= this.MIN_STAIR_DISTANCE) {
                const stairUpEntity = this.entityManager.createEntity(`stair_${tier}_stair_up_${stairUpX}_${stairUpY}`);
                this.entityManager.addComponentToEntity(stairUpEntity.id, new PositionComponent(stairUpX, stairUpY));
                this.entityManager.addComponentToEntity(stairUpEntity.id, new StairComponent('up'));
                const visuals = this.entityManager.addComponentToEntity(stairUpEntity.id, new VisualsComponent(32, 32));
                visuals.avatar = 'img/avatars/stairsup.png';
                entityList.stairs.push(stairUpEntity.id);

                map[stairUpY][stairUpX] = '⇑';
                levelData.stairsUp = { x: stairUpX, y: stairUpY };
                break;
            }
            attempts++;
        }
        if (!levelData.stairsUp) {
            console.warn(`Failed to place stairsUp with distance check after 50 attempts`);
            const fallbackRoom = this.entityManager.getEntity(upRooms[0]).getComponent('Room');
            stairUpX = fallbackRoom.left + 1;
            stairUpY = fallbackRoom.top + 1;

            const stairUpEntity = this.entityManager.createEntity(`stair_${tier}_stair_up_${stairUpX}_${stairUpY}`);
            this.entityManager.addComponentToEntity(stairUpEntity.id, new PositionComponent(stairUpX, stairUpY));
            this.entityManager.addComponentToEntity(stairUpEntity.id, new StairComponent('up'));
            const visuals = this.entityManager.addComponentToEntity(stairUpEntity.id, new VisualsComponent(32, 32));
            visuals.avatar = 'img/avatars/stairsup.png';
            entityList.stairs.push(stairUpEntity.id);

            map[stairUpY][stairUpX] = '⇑';
            levelData.stairsUp = { x: stairUpX, y: stairUpY };
        }

        if (hasBossRoom) {
            console.log(`Has boss room = ${hasBossRoom}, checking stairsDown distance to map center`);
            const bossRoomId = levelData.roomEntityIds.find(rId => this.entityManager.getEntity(rId).getComponent('Room').roomType === 'BossChamberSpecial');
            const bossRoom = this.entityManager.getEntity(bossRoomId).getComponent('Room');
            const paddedDistance = this.MIN_STAIR_DISTANCE + Math.floor((bossRoom.width + bossRoom.height) / 2);
            if (this.calculateDistance(levelData.stairsDown.x, levelData.stairsDown.y, this.state.WIDTH / 2, this.state.HEIGHT / 2) < paddedDistance) {
                console.warn(`StairsDown too close to map center with boss padding`);
            }
        }

        levelData.walls = entityList.walls;
        levelData.floors = entityList.floors;
    }

    generateLootEntities(tier, map, roomEntityIds) {
        const lootPerLevel = 5;
        const lootEntityIds = [];
        const collectEntityId = (data) => {
            if (data.tier === tier) {
                lootEntityIds.push(data.entityId);
                console.log(`LevelSystem: logged entity ID ${data.entityId} for tier ${tier}`);
            }
        };
        this.eventBus.on('LootEntityCreated', collectEntityId);

        for (let i = 0; i < lootPerLevel; i++) {
            const roomId = roomEntityIds[Math.floor(Math.random() * roomEntityIds.length)];
            const room = this.entityManager.getEntity(roomId).getComponent('Room');
            let x, y;
            let attempts = 0;
            do {
                x = room.left + 1 + Math.floor(Math.random() * (room.width - 2));
                y = room.top + 1 + Math.floor(Math.random() * (room.height - 2));
                attempts++;
                if (attempts > 50) {
                    console.error(`Failed to place loot entity in room after 50 attempts`);
                    break;
                }
            } while (map[y][x] !== ' ');

            if (attempts <= 50) {
                const lootSource = this.entityManager.createEntity(`loot_source_${tier}_${Date.now()}_${i}`);
                this.entityManager.addComponentToEntity(lootSource.id, new LootSourceData({
                    sourceType: "container",
                    name: "Treasure Chest",
                    tier: tier,
                    position: { x, y },
                    sourceDetails: {},
                    chanceModifiers: {
                        torches: 1,
                        healPotions: 1,
                        gold: 1.5,
                        item: 0.5,
                        uniqueItem: 0.8
                    },
                    maxItems: 1,
                    items: [],
                }));
                const lootVisuals =  lootSource.addComponent(new VisualsComponent(16, 24));       
                lootVisuals.avatar = 'img/avatars/chest.png'; 


                this.eventBus.emit('DropLoot', { lootSource });
            }
        }

        this.eventBus.off('LootEntityCreated', collectEntityId);
        console.log(`Generated ${lootPerLevel} loot entity IDs for tier ${tier}`, lootEntityIds);
        return lootEntityIds;
    }

    generateFountains(tier, map, roomEntityIds) {
        const fountainsPerLevel = Math.floor(Math.random() * 2) + 1;
        const fountains = [];
        for (let i = 0; i < fountainsPerLevel; i++) {
            const roomId = roomEntityIds[Math.floor(Math.random() * roomEntityIds.length)];
            const room = this.entityManager.getEntity(roomId).getComponent('Room');
            let x, y;
            let attempts = 0;
            do {
                x = room.left + 1 + Math.floor(Math.random() * (room.width - 2));
                y = room.top + 1 + Math.floor(Math.random() * (room.height - 2));
                attempts++;
                if (attempts > 50) {
                    console.error(`Failed to place fountain in room after 50 attempts`);
                    break;
                }
            } while (map[y][x] !== ' ');
            if (attempts <= 50) {
                const fountainEntity = this.entityManager.createEntity(`fountain_${tier}_fountain_${i}`);
                this.entityManager.addComponentToEntity(fountainEntity.id, new PositionComponent(x, y));
                this.entityManager.addComponentToEntity(fountainEntity.id, new FountainComponent(false, false));
                fountains.push(fountainEntity.id);
                map[y][x] = '≅';
            }
        }
        return fountains;
    }

    generateSurfaceLevel(levelEntity) {
        const width = this.state.WIDTH;
        const height = this.state.HEIGHT;
        const map = Array(height).fill().map(() => Array(width).fill('#'));
        const walls = [];
        const floors = [];
        const stairs = [];

        // Create a small 8x8 open area
        for (let y = 1; y <= 8; y++) {
            for (let x = 1; x <= 8; x++) {
                map[y][x] = ' ';
                const floorId = `floor_0_floor_${y}_${x}`;
                const floorEntity = this.entityManager.createEntity(floorId);
                this.entityManager.addComponentToEntity(floorEntity.id, new PositionComponent(x, y));
                this.entityManager.addComponentToEntity(floorEntity.id, new FloorComponent());
                floors.push(floorEntity.id);
            }
        }

        // Add walls around the open area
        for (let y = 0; y <= 9; y++) {
            for (let x = 0; x <= 9; x++) {
                if (y === 0 || y === 9 || x === 0 || x === 9) {
                    const wallId = `wall_0_wall_${y}_${x}`;
                    const wallEntity = this.entityManager.createEntity(wallId);
                    this.entityManager.addComponentToEntity(wallEntity.id, new PositionComponent(x, y));
                    this.entityManager.addComponentToEntity(wallEntity.id, new WallComponent());
                    walls.push(wallEntity.id);
                }
            }
        }

        // Place stairs down at (9, 6)
        const stairId = `stair_0_stair_down_9_6`;
        const stairEntity = this.entityManager.createEntity(stairId);
        this.entityManager.addComponentToEntity(stairEntity.id, new PositionComponent(9, 6));
        this.entityManager.addComponentToEntity(stairEntity.id, new StairComponent('down'));
        stairs.push(stairId);
        map[6][9] = '⇓';

        const levelData = {
            map: map,
            walls: walls,
            floors: floors,
            stairs: stairs,
            stairsDown: { x: 9, y: 6 },
            roomEntityIds: []
        };

        const mapComp = new MapComponent(levelData);
        this.entityManager.addComponentToEntity(levelEntity.id, mapComp);
        console.log(`LevelSystem.js: Added MapComponent to ${levelEntity.id} during generateSurfaceLevel`);

        // Add EntityListComponent
        const entityListComp = new EntityListComponent({
            walls: walls,
            floors: floors,
            stairs: stairs,
            portals: [],
            monsters: [],
            treasures: [],
            fountains: [],
            rooms: []
        });
        this.entityManager.addComponentToEntity(levelEntity.id, entityListComp);
        console.log(`LevelSystem.js: Added EntityListComponent to ${levelEntity.id} in generateSurfaceLevel`);

        return levelData;
    }

    padMap(map, walls = [], floors = [], tier = 0) {
        const padded = Array.from({ length: this.state.HEIGHT }, () => Array(this.state.WIDTH).fill('#'));

        for (let y = 0; y < map.length; y++) {
            for (let x = 0; x < map[y].length; x++) {
                padded[y][x] = map[y][x];
            }
        }

        for (let y = 0; y < this.state.HEIGHT; y++) {
            for (let x = 0; x < this.state.WIDTH; x++) {
                if (y < map.length && x < map[y].length) continue;

                const wallEntity = this.entityManager.createEntity(`wall_${tier}_wall_${y}_${x}`);
                this.entityManager.addComponentToEntity(wallEntity.id, new PositionComponent(x, y));
                this.entityManager.addComponentToEntity(wallEntity.id, new WallComponent());
                walls.push(wallEntity.id);
            }
        }

        return padded;
    }

    adjustPlayerPosition(levelEntity, stair) {
        const mapComponent = levelEntity.getComponent('Map');
        if (!mapComponent || !mapComponent.map) {
            console.error(`LevelSystem: No valid MapComponent or map for entity ${levelEntity.id}`);
            return;
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
                console.warn(`LevelSystem: Set player position to (${pos.x}, ${pos.y}) near stairs at (${stair.x}, ${stair.y})`);
                return;
            }
        }
         
        pos.x = 1;
        pos.y = 1;
        console.warn(`LevelSystem: No adjacent walkable tile found near (${stair.x}, ${stair.y}), using fallback position (1, 1)`);
        this.eventBus.emit('PositionChanged', { entityId: 'player', x: pos.x, y: pos.y });
    }

    ensureRoomConnections(levelEntity) {
        const mapComp = levelEntity.getComponent('Map');
        const entityList = levelEntity.getComponent('EntityList');
        const tier = levelEntity.getComponent('Tier').value;

        const rooms = Array.isArray(entityList.rooms) ? entityList.rooms : [];
        console.log(`LevelSystem.js: Ensuring room connections for tier ${tier}, rooms: ${JSON.stringify(rooms)}`);

        // Log room types and initial connection counts
        console.log(`LevelSystem.ensureRoomConnections: Room types and connections before ensuring connections:`);
        for (const roomId of rooms) {
            const room = this.entityManager.getEntity(roomId).getComponent('Room');
            console.log(`Room ${roomId} at (${room.left}, ${room.top}), type: ${room.roomType}, connections: ${room.connections.length}`);
        }

        for (const roomId of rooms) {
            const room = this.entityManager.getEntity(roomId).getComponent('Room');
            if (room.connections.length === 0) {
                console.warn(`LevelSystem.ensureRoomConnections: Room ${roomId} has no connections, attempting to connect`);
                const nearestRoomId = this.findNearestRoom(roomId, rooms, [roomId]);
                if (nearestRoomId) {
                    this.carveCorridor(roomId, nearestRoomId, mapComp.map, rooms, entityList.floors, entityList.walls, new Set(), levelEntity);
                    const nearestRoom = this.entityManager.getEntity(nearestRoomId).getComponent('Room');
                    room.connections.push(nearestRoomId);
                    nearestRoom.connections.push(roomId);
                } else {
                    console.error(`LevelSystem.ensureRoomConnections: No nearest room found for isolated non-special room ${roomId}`);
                }
            }
        }

        for (const roomId of rooms) {
            const room = this.entityManager.getEntity(roomId).getComponent('Room');
            if ((room.roomType === 'AlcoveSpecial' || room.roomType === 'BossChamberSpecial') && room.connections.length === 0) {
                console.warn(`Room at (${room.left}, ${room.top}) of type ${room.roomType} has no connections, adding one`);
                const nearestRoomId = this.findNearestRoom(roomId, entityList.rooms, [roomId]);
                if (nearestRoomId) {
                    this.carveCorridor(roomId, nearestRoomId, mapComp.map, entityList.rooms, entityList.floors, entityList.walls, new Set(), levelEntity);
                    const nearestRoom = this.entityManager.getEntity(nearestRoomId).getComponent('Room');
                    room.connections.push(nearestRoomId);
                    nearestRoom.connections.push(roomId);
                } else {
                    console.error(`No nearest room found for isolated ${room.roomType} at (${room.left}, ${room.top})`);
                }
            }
        }

    }

    calculateDistance(x1, y1, x2, y2) {
        return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
    }
}