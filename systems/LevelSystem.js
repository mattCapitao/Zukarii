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
    RoomComponent,
    HitboxComponent,
    SpatialBucketsComponent,
    NPCDataComponent,
    ShopComponent,
} from '../core/Components.js';

const roomTypes = [
    { type: 'SquareRoom', probability: 45, minW: 15, maxW: 21, minH: 8, maxH: 11 },
    { type: 'VerticalRoom', probability: 30, minW: 8, maxW: 12, minH: 12, maxH: 18 },
    { type: 'HorizontalRoom', probability: 5, minW: 18, maxW: 22, minH: 8, maxH: 12 },
    { type: 'AlcoveSpecial', probability: 15, minW: 10, maxW: 10, minH: 5, maxH: 5 },
    { type: 'BossChamberSpecial', probability: 5, minW: 25, maxW: 30, minH: 15, maxH: 18 }
];
export class LevelSystem extends System {
    constructor(entityManager, eventBus, state, genSys, utilities) {
        super(entityManager, eventBus);
        this.state = state;
        this.genSys = genSys;
        this.utilities = utilities;
        this.generateStairEntity = this.genSys.generateStairEntity.bind(this.genSys);
        this.generatePortal = this.genSys.generatePortal.bind(this.genSys);
        this.generateFountains = this.genSys.generateFountains.bind(this.genSys);
        this.generateLootEntities = this.genSys.generateLootEntities.bind(this.genSys);
        this.generateShopCounter = this.genSys.generateShopCounter.bind(this.genSys);
        this.requiredComponents = ['Map', 'Tier', 'Exploration'];
        this.ROOM_EDGE_BUFFER = 4;
        this.CORRIDOR_EDGE_BUFFER = 2;
        this.MIN_ROOM_SIZE = 5;
        this.MAX_OVERLAP_PERCENT = 0.02;
        this.INITIAL_MIN_DISTANCE = 35;
        this.MIN_DISTANCE_FLOOR = 3;
        this.MIN_BOSS_LEVEL = 3
        this.BOSS_ROOM_EVERY_X_LEVELS = 3;
        this.lastBossTier = 0;
        this.MAX_PLACEMENT_ATTEMPTS = 30; // Reduced to prevent performance issues
        this.roomsPerLevel = 30; // Reduced to prevent performance issues
        this.MIN_STAIR_DISTANCE = 24;
        this.TILE_SIZE = this.state.TILE_SIZE || 32;
        this.isAddingLevel = false; // Guard against re-entrant calls
    }

    init() {
        //console.log('LevelSystem.js: init - Starting');
        this.sfxQueue = this.entityManager.getEntity('gameState').getComponent('AudioQueue').SFX || [];
        this.eventBus.on('AddLevel', (data) => this.addLevel(data));
        this.eventBus.on('CheckLevelAfterTransitions', (data) => this.checkLevelAfterTransitions(data));
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const isNewGame = gameState.tier === 0;

        //console.log(`LevelSystem.js: init - Starting with gameState.tier=${gameState.tier}, isNewGame=${isNewGame}`);

        // Always create Tier 0 with the custom surface level if it doesn't exist
        if (!this.entityManager.getEntitiesWith(['Tier']).some(e => e.getComponent('Tier').value === 0)) {
            this.entityManager.setActiveTier(0);
            //console.log(`LevelSystem.js: init - Set active tier to 0 for tier 0 creation`);
            const levelEntity = this.entityManager.createEntity(`level_0`);
            this.entityManager.addComponentToEntity(levelEntity.id, { type: 'Tier', value: 0 });
            this.entityManager.addComponentToEntity(levelEntity.id, new EntityListComponent());
            this.entityManager.addComponentToEntity(levelEntity.id, new ExplorationComponent());
            this.entityManager.addComponentToEntity(levelEntity.id, new SpatialBucketsComponent());
            //console.log(`LevelSystem.js: Created level entity with ID: ${levelEntity.id} for tier 0 in init`);
            this.addLevel({ tier: 0, customLevel: this.generateCustomLevel(levelEntity) });
            // Explicitly call checkLevelAfterTransitions for tier 0 to ensure shop inventories are generated
            this.checkLevelAfterTransitions({ tier: 0, levelEntity });
        }

        if (isNewGame) {
            gameState.tier = 0;
            this.entityManager.setActiveTier(0);
            //console.log(`LevelSystem.js: init - gameState.tier set to ${gameState.tier} for a new game, active tier: ${this.entityManager.getActiveTier()}`);
        } else {
            // For loaded games, generate levels from 1 up to the current tier (if not already generated)
            for (let tier = 1; tier <= gameState.tier; tier++) {
                if (!this.entityManager.getEntitiesWith(['Tier']).some(e => e.getComponent('Tier').value === tier)) {
                    this.addLevel({ tier });
                }
            }
            // Only set active tier if it hasn't been set by a transition
            if (this.entityManager.getActiveTier() !== gameState.tier) {
                this.entityManager.setActiveTier(gameState.tier);
                //console.log(`LevelSystem.js: init - Preserved loaded tier ${gameState.tier}, active tier set to: ${this.entityManager.getActiveTier()}`);
            } else {
                //console.log(`LevelSystem.js: init - Active tier already set to ${this.entityManager.getActiveTier()}, skipping setActiveTier`);
            }
            // Explicitly call checkLevelAfterTransitions for the loaded tier
            const levelEntity = this.entityManager.getEntitiesWith(['Tier']).find(e => e.getComponent('Tier').value === gameState.tier);
            if (levelEntity) {
                this.checkLevelAfterTransitions({ tier: gameState.tier, levelEntity });
            }
        }
        //console.log('LevelSystem.js: init - Completed');
    }

    removeWallAtPosition(x, y, walls, levelEntity) {
        if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= this.state.WIDTH || y >= this.state.HEIGHT) {
            console.error(`LevelSystem.js: Invalid tile coordinates (${x}, ${y}) on tier ${levelEntity.getComponent('Tier').value}`);
            return;
        }

        const tier = levelEntity.getComponent('Tier').value;
        const pixelX = x * this.TILE_SIZE;
        const pixelY = y * this.TILE_SIZE;
        const wallEntities = this.entityManager.getEntitiesWith(['Position', 'Wall']).filter(e => {
            const pos = e.getComponent('Position');
            return pos.x === pixelX && pos.y === pixelY && e.id.startsWith(`wall_${tier}_`);
        });

        if (wallEntities.length === 0) {
            //console.log(`LevelSystem.js: No wall entities found at pixel (${pixelX}, ${pixelY}) for tile (${x}, ${y}) on tier ${tier}`);
        }

        wallEntities.forEach(wall => {
            const wallId = wall.id;
            this.entityManager.removeEntity(wallId);
            const wallIndex = walls.indexOf(wallId);
            if (wallIndex !== -1) {
                walls.splice(wallIndex, 1);
            }
        });

        const mapComp = levelEntity.getComponent('Map');
        if (mapComp && mapComp.map[y] && mapComp.map[y][x]) {
            mapComp.map[y][x] = ' ';
            const floorId = `floor_${tier}_floor_${y}_${x}`;
            if (!this.entityManager.getEntity(floorId)) {
                const floorEntity = this.entityManager.createEntity(floorId);
                this.entityManager.addComponentToEntity(floorEntity.id, new PositionComponent(pixelX, pixelY));
                this.entityManager.addComponentToEntity(floorEntity.id, new FloorComponent());
                const entityList = levelEntity.getComponent('EntityList');
                if (entityList && entityList.floors) {
                    entityList.floors.push(floorEntity.id);
                } else {
                    console.error(`LevelSystem.js: EntityListComponent missing or invalid for tier ${tier} when adding floor ${floorId}`);
                }
            }
        } else {
            console.error(`LevelSystem.js: Failed to update map at (${x}, ${y}) on tier ${tier} - mapComp or map position invalid`);
        }
    }

    addLevel({ tier, customLevel = null, transitionDirection = null }) {
        if (this.isAddingLevel) {
            console.warn(`LevelSystem.js: addLevel - Re-entrant call detected for tier ${tier}, aborting to prevent loop`);
            return;
        }
        this.isAddingLevel = true;
        //console.log(`LevelSystem.js: addLevel - Starting for tier ${tier}, transitionDirection: ${transitionDirection}`);

        this.entityManager.setActiveTier(tier);
        //console.log(`LevelSystem.js: addLevel - Set active tier to ${tier}, active tier: ${this.entityManager.getActiveTier()}`);
        let levelEntity = this.entityManager.getEntitiesWith(['Tier']).find(e => e.getComponent('Tier').value === tier);

        if (!levelEntity) {
            levelEntity = this.entityManager.createEntity(`level_${tier}`);
            //console.log(`LevelSystem.js: Created level entity with ID: ${levelEntity.id} for tier ${tier}`);
            this.entityManager.addComponentToEntity(levelEntity.id, { type: 'Tier', value: tier });

            let levelData;
            if (customLevel != null || tier === 0) {
                
                if (customLevel == null && tier === 0) {
                    //console.log(`LevelSystem.js: Generating Tier 0 with generateSurfaceLevel`);
                    customLevel = this.generateCustomLevel(levelEntity);
                } else {
                    //console.log(`LevelSystem.js: Using provided customLevel for tier ${tier}`);
                }
                levelData = customLevel;
                levelData.isCustomLevel = true;
                const mapComp = new MapComponent(levelData);
                mapComp.map = this.padMap(levelData.map, levelData.walls, levelData.floors, tier);
                if (levelData.stairsUp) mapComp.stairsUp = levelData.stairsUp;
                if (levelData.stairsDown) mapComp.stairsDown = levelData.stairsDown;
                this.entityManager.addComponentToEntity(levelEntity.id, mapComp);

                const entityListComp = new EntityListComponent({
                    walls: levelData.walls || [],
                    floors: levelData.floors || [],
                    stairs: levelData.stairs || [],
                    portals: levelData.portals || [],
                    monsters: levelData.monsters || [],
                    treasures: levelData.treasures || [],
                    fountains: levelData.fountains || [],
                    rooms: levelData.roomEntityIds || [],
                    npcs: levelData.npcs || []
                });
                this.entityManager.addComponentToEntity(levelEntity.id, entityListComp);
                this.entityManager.addComponentToEntity(levelEntity.id, new ExplorationComponent());
                this.entityManager.addComponentToEntity(levelEntity.id, new SpatialBucketsComponent());
                //console.log(`LevelSystem.js: addLevel - Adjusting player position for tier ${tier}, transitionDirection: ${transitionDirection}`);
                this.adjustPlayerPosition(levelEntity, transitionDirection === 'down' ? levelData.stairsUp : (levelData.stairsDown || levelData.stairsUp));
            } else {

                const journeyBossLevels = [3,6]
                let hasBossRoom = false;

                switch (true) {
                    case (tier - this.lastBossTier >= this.BOSS_ROOM_EVERY_X_LEVELS):
                    case (Math.random() < 0.05) :
                    case journeyBossLevels.includes(tier):
                        hasBossRoom = true;
                        break;
                    default:
                        hasBossRoom = false;
                        break;

                }

                this.sfxQueue.push({ sfx: 'bossLevel0', volume: 0.5 });

                const entityList = new EntityListComponent({
                    walls: [],
                    floors: [],
                    stairs: [],
                    portals: [],
                    monsters: [],
                    treasures: [],
                    fountains: [],
                    rooms: [],
                    npcs: [] // Initialize npcs array
                });
                this.entityManager.addComponentToEntity(levelEntity.id, entityList);
                this.entityManager.addComponentToEntity(levelEntity.id, new ExplorationComponent());
                this.entityManager.addComponentToEntity(levelEntity.id, new SpatialBucketsComponent());

                levelData = this.generateLevel(hasBossRoom, tier, levelEntity.id);
                levelData.isCustomLevel = false;
                const mapComp = new MapComponent(levelData);
                this.entityManager.addComponentToEntity(levelEntity.id, mapComp);

                entityList.walls = levelData.walls;
                entityList.floors = levelData.floors;
                entityList.rooms = levelData.roomEntityIds;
                entityList.fountains = this.generateFountains(tier, levelData, entityList);

                this.placeStairs(levelEntity, levelData, hasBossRoom);
                entityList.treasures = this.generateLootEntities(tier, levelData.map, levelData.roomEntityIds);
                mapComp.stairsUp = levelData.stairsUp;
                mapComp.stairsDown = levelData.stairsDown;
                //console.log(`LevelSystem.js: addLevel - Adjusting player position for tier ${tier}, transitionDirection: ${transitionDirection}`);
                this.adjustPlayerPosition(levelEntity, transitionDirection === 'down' ? levelData.stairsUp : levelData.stairsDown);
                if (hasBossRoom) this.lastBossTier = tier;

                const hasElites = tier > 1;
                this.eventBus.emit('SpawnMonsters', {
                    tier,
                    rooms: levelData.roomEntityIds,
                    hasBossRoom,
                    spawnPool: { randomMonsters: true, uniqueMonsters: hasElites }
                });
            }

            const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
            gameState.needsInitialRender = true;
            gameState.needsRender = true;

            const ercPasses = 3;
            for (let i = 0; i < ercPasses; i++) {
                this.ensureRoomConnections(levelEntity);
            }
            this.checkLevelAfterTransitions({ tier, levelEntity });

            const mapComponent = levelEntity.getComponent('Map');
            if (mapComponent && ((tier === 0 && mapComponent.stairsDown) || (tier !== 0 && mapComponent.stairsUp && mapComponent.stairsDown))) {
                this.eventBus.emit('LevelAdded', { tier, entityId: levelEntity.id });
            } else {
                console.error(`LevelSystem.js: Invalid MapComponent for tier ${tier}`);
            }
        } else {
            this.checkLevelAfterTransitions({ tier, levelEntity });
            const mapComponent = levelEntity.getComponent('Map');
            if (mapComponent && ((tier === 0 && mapComponent.stairsDown) || (tier !== 0 && mapComponent.stairsUp && mapComponent.stairsDown))) {
                this.eventBus.emit('LevelAdded', { tier, entityId: levelEntity.id });
            } else {
                console.error(`LevelSystem: Invalid MapComponent for existing tier ${tier}`);
            }
        }
        this.isAddingLevel = false;
        //console.log(`LevelSystem.js: addLevel - Completed for tier ${tier}`);
    }

    generateLevel(hasBossRoom, tier, levelEntityId) {
        //console.log(`LevelSystem.js: generateLevel - Starting for tier ${tier}, hasBossRoom: ${hasBossRoom}`);
        const levelEntity = this.entityManager.getEntity(levelEntityId);
        const map = Array.from({ length: this.state.HEIGHT }, () => Array(this.state.WIDTH).fill('#'));
        const walls = [];
        const floors = [];
        const floorPositions = new Set();

        const mapComp = new MapComponent({ map, walls, floors });
        this.entityManager.addComponentToEntity(levelEntityId, mapComp);

        for (let y = 0; y < this.state.HEIGHT; y++) {
            for (let x = 0; x < this.state.WIDTH; x++) {
                const wallEntity = this.entityManager.createEntity(`wall_${tier}_wall_${y}_${x}`);
                const pixelX = x * this.TILE_SIZE;
                const pixelY = y * this.TILE_SIZE;
                this.entityManager.addComponentToEntity(wallEntity.id, new PositionComponent(pixelX, pixelY));
                this.entityManager.addComponentToEntity(wallEntity.id, new WallComponent());
                this.entityManager.addComponentToEntity(wallEntity.id, new VisualsComponent(this.TILE_SIZE, this.TILE_SIZE));
                const visuals = wallEntity.getComponent('Visuals');
                visuals.avatar = 'img/map/wall.png';
                this.entityManager.addComponentToEntity(wallEntity.id, new HitboxComponent(this.TILE_SIZE, this.TILE_SIZE));
                walls.push(wallEntity.id);
            }
        }

        const roomEntityIds = this.placeRooms(this.roomsPerLevel, hasBossRoom, levelEntityId, tier);

        for (const roomId of roomEntityIds) {
            const room = this.entityManager.getEntity(roomId).getComponent('Room');
            if (!room || !Number.isFinite(room.left) || !Number.isFinite(room.top) || !Number.isFinite(room.width) || !Number.isFinite(room.height)) {
                console.error(`LevelSystem.js: Invalid room ${roomId} data: ${JSON.stringify(room)}`);
                continue;
            }
            for (let y = room.top; y < room.top + room.height; y++) {
                for (let x = room.left; x < room.left + room.width; x++) {
                    const positionKey = `${y},${x}`;
                    if (floorPositions.has(positionKey)) continue;

                    this.removeWallAtPosition(x, y, walls, levelEntity);
                    floorPositions.add(positionKey);
                    map[y][x] = ' ';
                }
            }
        }

        this.connectRooms(roomEntityIds, map, floors, walls, floorPositions, tier);
        //console.log(`LevelSystem.js: generateLevel - Completed for tier ${tier}`);
        return {
            map,
            roomEntityIds,
            rooms: roomEntityIds.map(id => this.entityManager.getEntity(id).getComponent('Room')),
            walls,
            floors
        };
    }


    placeRooms(numRooms, hasBossRoom, levelEntityId, tier) {
        //console.log(`LevelSystem.js: placeRooms - Improved - Starting for tier ${tier}, numRooms: ${numRooms}, hasBossRoom: ${hasBossRoom}`);
        const roomOrigins = new Set();
        const roomEntityIds = [];
        let bossChamberPlaced = !hasBossRoom;

        // 1. Build a prioritized list: boss, then large to small, then alcoves
        let roomSpecs = [];
        if (hasBossRoom) {
            const bossType = roomTypes.find(rt => rt.type === 'BossChamberSpecial');
            roomSpecs.push(bossType);
        }
        // Fill with other rooms, sorted by area descending
        let otherRooms = [];
        for (let i = 0; i < numRooms - (hasBossRoom ? 1 : 0); i++) {
            let type = this.selectRoomType();
            if (type.type === 'BossChamberSpecial' && bossChamberPlaced) {
                type = roomTypes.find(rt => rt.type === 'AlcoveSpecial');
            }
            otherRooms.push(type);
        }
        otherRooms.sort((a, b) => (b.maxW * b.maxH) - (a.maxW * a.maxH));
        roomSpecs = roomSpecs.concat(otherRooms);

        // 2. Try to place each room
        for (let i = 0; i < roomSpecs.length; i++) {
            const roomType = roomSpecs[i];
            let bestCandidate = null;
            let bestScore = Infinity;
            let placed = false;
            let attempts = 0;
            let minDistance = this.INITIAL_MIN_DISTANCE;
            let maxOverlap = this.MAX_OVERLAP_PERCENT;

            // Try up to MAX_PLACEMENT_ATTEMPTS, relaxing constraints as we go
            while (attempts < this.MAX_PLACEMENT_ATTEMPTS && !placed) {
                // Try several random positions per attempt, pick best
                for (let tryNum = 0; tryNum < 5; tryNum++) {
                    let room = this.generateRoomDimensions(roomType);
                    room.x = Math.floor(Math.random() * (this.state.WIDTH - room.width - 2 * this.ROOM_EDGE_BUFFER)) + this.ROOM_EDGE_BUFFER;
                    room.y = Math.floor(Math.random() * (this.state.HEIGHT - room.height - 2 * this.ROOM_EDGE_BUFFER)) + this.ROOM_EDGE_BUFFER;

                    if (roomOrigins.has(`${room.x},${room.y}`)) continue;

                    const existingRooms = roomEntityIds.map(id => this.entityManager.getEntity(id).getComponent('Room'));
                    // Use relaxed constraints as attempts increase
                    let currentMinDistance = Math.max(this.MIN_DISTANCE_FLOOR, minDistance - Math.floor(attempts / 10));
                    let currentMaxOverlap = Math.min(0.25, maxOverlap + attempts * 0.005);

                    // Overlap and distance checks
                    let overlap = this.doesRoomOverlapCustom(room, existingRooms, currentMaxOverlap);
                    let tooClose = existingRooms.length > 0 && this.isTooClose(room, existingRooms, currentMinDistance);

                    // Score: penalize overlap and closeness, prefer central placement
                    //let centerScore = Math.abs(room.x + room.width / 2 - this.state.WIDTH / 2) + Math.abs(room.y + room.height / 2 - this.state.HEIGHT / 2);
                   // let score = (overlap ? 1000 : 0) + (tooClose ? 500 : 0) + centerScore;

                    // Score: penalize overlap and closeness, prefer decentralized placement
                    let distFromCenter = Math.abs(room.x + room.width / 2 - this.state.WIDTH / 2) + Math.abs(room.y + room.height / 2 - this.state.HEIGHT / 2);
                    let centerScore = -distFromCenter; // Negative means further is better
                    let score = (overlap ? 1000 : 0) + (tooClose ? 500 : 0) + centerScore;

                    if (!overlap && !tooClose) {
                        // Place immediately if perfect
                        bestCandidate = { ...room };
                        bestScore = score;
                        placed = true;
                        break;
                    } else if (score < bestScore) {
                        bestCandidate = { ...room };
                        bestScore = score;
                    }
                }
                attempts++;
            }

            // Fallback: if not placed, use best candidate with minimal constraints
            if (!placed && bestCandidate) {
                console.warn(`LevelSystem.js: placeRooms - Placing room with relaxed constraints: ${roomType.type}`);
                placed = true;
            }

            if (placed && bestCandidate) {
                const roomEntity = this.entityManager.createEntity(`room_${tier}_${bestCandidate.x}_${bestCandidate.y}`);
                this.entityManager.addComponentToEntity(roomEntity.id, new RoomComponent({
                    left: bestCandidate.x,
                    top: bestCandidate.y,
                    width: bestCandidate.width,
                    height: bestCandidate.height,
                    type: bestCandidate.type,
                    centerX: bestCandidate.x + Math.floor(bestCandidate.width / 2),
                    centerY: bestCandidate.y + Math.floor(bestCandidate.height / 2),
                    connections: []
                }));
                roomEntityIds.push(roomEntity.id);
                roomOrigins.add(`${bestCandidate.x},${bestCandidate.y}`);
                if (roomType.type === 'BossChamberSpecial') bossChamberPlaced = true;
            } else {
                console.warn(`LevelSystem.js: placeRooms - Failed to place room of type ${roomType.type} after ${this.MAX_PLACEMENT_ATTEMPTS} attempts`);
            }
        }

        roomOrigins.clear();
        //console.log(`LevelSystem.js: placeRooms - Improved - Placed ${roomEntityIds.length} out of ${numRooms} rooms for tier ${tier}`);
        return roomEntityIds;
    }

    // Helper: allows custom overlap percent per attempt
    doesRoomOverlapCustom(newRoom, existingRooms, maxOverlapPercent) {
        const buffer = newRoom.type === 'BossChamberSpecial' || newRoom.type === 'AlcoveSpecial' ? this.CORRIDOR_EDGE_BUFFER : this.ROOM_EDGE_BUFFER;
        for (const room of existingRooms) {
            const overlapX = Math.max(0, Math.min(newRoom.x + newRoom.width + buffer, room.left + room.width) - Math.max(newRoom.x - buffer, room.left));
            const overlapY = Math.max(0, Math.min(newRoom.y + newRoom.height + buffer, room.top + room.height) - Math.max(newRoom.y - buffer, room.top));
            const overlapArea = overlapX * overlapY;
            const newRoomArea = newRoom.width * newRoom.height;
            const roomArea = room.width * room.height;
            const minArea = Math.min(newRoomArea, roomArea);
            if (overlapArea > minArea * maxOverlapPercent) return true;
        }
        return false;
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
            const overlapX = Math.max(0, Math.min(newRoom.x + newRoom.width + buffer, room.left + room.width) - Math.max(newRoom.x - buffer, room.left));
            const overlapY = Math.max(0, Math.min(newRoom.y + newRoom.height + buffer, room.top + room.height) - Math.max(newRoom.y - buffer, room.top));
            const overlapArea = overlapX * overlapY;
            const newRoomArea = newRoom.width * newRoom.height;
            const roomArea = room.width * room.height;
            const minArea = Math.min(newRoomArea, roomArea);
            if (overlapArea > minArea * this.MAX_OVERLAP_PERCENT) return true;
        }
        return false;
    }

    isTooClose(newRoom, existingRooms, minDistance) {
        return existingRooms.some(room => this.calculateDistance(newRoom.x, newRoom.y, room.centerX, room.centerY) < minDistance);
    }

    connectRooms(roomEntityIds, map, floors, walls, floorPositions, tier) {
        //console.log(`LevelSystem.js: connectRooms (MST) - Starting for tier ${tier}, roomEntityIds: ${roomEntityIds.length}`);
        if (roomEntityIds.length === 0) return;
        const levelEntity = this.entityManager.getEntitiesWith(['Tier']).find(e => e.getComponent('Tier').value === tier);

        // Build a list of room centers for easy access
        const roomCenters = roomEntityIds.map(id => {
            const room = this.entityManager.getEntity(id).getComponent('Room');
            return { id, x: room.centerX, y: room.centerY };
        });

        // Prim's algorithm for MST
        const connected = new Set();
        const edges = [];
        connected.add(roomCenters[0].id);

        while (connected.size < roomCenters.length) {
            let minDist = Infinity;
            let minEdge = null;

            for (const fromId of connected) {
                const fromRoom = roomCenters.find(r => r.id === fromId);
                for (const toRoom of roomCenters) {
                    if (connected.has(toRoom.id)) continue;
                    const dist = this.calculateDistance(fromRoom.x, fromRoom.y, toRoom.x, toRoom.y);
                    if (dist < minDist) {
                        minDist = dist;
                        minEdge = { from: fromRoom.id, to: toRoom.id };
                    }
                }
            }

            if (minEdge) {
                edges.push(minEdge);
                connected.add(minEdge.to);
            } else {
                // Should not happen, but break to avoid infinite loop
                break;
            }
        }

        // Optionally, add a few random extra connections for loops
        const extraConnections = Math.floor(roomEntityIds.length / 8); // tweak as desired
        for (let i = 0; i < extraConnections; i++) {
            const a = roomEntityIds[Math.floor(Math.random() * roomEntityIds.length)];
            let b;
            do {
                b = roomEntityIds[Math.floor(Math.random() * roomEntityIds.length)];
            } while (a === b || edges.some(e => (e.from === a && e.to === b) || (e.from === b && e.to === a)));
            edges.push({ from: a, to: b });
        }

        // Carve corridors and update connections
        for (const edge of edges) {
            this.carveCorridor(edge.from, edge.to, map, roomEntityIds, floors, walls, floorPositions, levelEntity);
            const roomA = this.entityManager.getEntity(edge.from).getComponent('Room');
            const roomB = this.entityManager.getEntity(edge.to).getComponent('Room');
            if (!roomA.connections.includes(edge.to)) roomA.connections.push(edge.to);
            if (!roomB.connections.includes(edge.from)) roomB.connections.push(edge.from);
        }

        // Special handling for alcove/boss rooms (optional, as in your original)
        for (const roomId of roomEntityIds) {
            const room = this.entityManager.getEntity(roomId).getComponent('Room');
            if ((room.roomType === 'AlcoveSpecial' || room.roomType === 'BossChamberSpecial') && room.connections.length > 1) {
                room.connections = [room.connections[0]];
            }
        }

        // Debug output
        //console.log(`LevelSystem.js: Room connections after connectRooms (MST) for tier ${tier}:`);
        for (const roomId of roomEntityIds) {
            const room = this.entityManager.getEntity(roomId).getComponent('Room');
            //console.log(`Room ${roomId} at (${room.left}, ${room.top}), type: ${room.roomType}, connections: ${room.connections.length} (${room.connections.join(', ')})`);
        }
        //console.log(`LevelSystem.js: connectRooms (MST) - Completed for tier ${tier}`);
    }

    carveCorridor(startRoomId, endRoomId, map, roomEntityIds, floors, walls, floorPositions, levelEntity) {
        if (!startRoomId || !endRoomId) {
            console.error(`carveCorridor: Invalid room ID - startRoomId: ${startRoomId}, endRoomId: ${endRoomId}`);
        }
        const rand = Math.random();
        if (rand < 0.05) {
            this.carveStraightCorridor(startRoomId, endRoomId, map, floors, walls, floorPositions, levelEntity);
        } else if (rand < 0.70) {
            this.carveLCorridor(startRoomId, endRoomId, map, floors, walls, floorPositions, levelEntity);
        } else {
            this.carveTCorridor(startRoomId, endRoomId, map, roomEntityIds, floors, walls, floorPositions, levelEntity);
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
        //console.log(`LevelSystem: Carving corridor from (${startX},${startY}) to (${endX},${endY})`);
        // Defensive checks
        if (
            !Number.isFinite(startX) || !Number.isFinite(startY) ||
            !Number.isFinite(endX) || !Number.isFinite(endY) ||
            startX < 0 || startX >= this.state.WIDTH ||
            startY < 0 || startY >= this.state.HEIGHT ||
            endX < 0 || endX >= this.state.WIDTH ||
            endY < 0 || endY >= this.state.HEIGHT
        ) {
            console.error(`LevelSystem: Corridor carving aborted: Invalid room centers: start(${startX},${startY}) end(${endX},${endY})`);
            return;
        }
        if (startX === endX) {
            const yMin = Math.min(startY, endY);
            const yMax = Math.max(startY, endY);
            for (let y = yMin; y <= yMax; y++) {
                const positionKey = `${y},${startX}`;
                if (!floorPositions.has(positionKey)) {
                    this.removeWallAtPosition(startX, y, walls, levelEntity);
                    floorPositions.add(positionKey);
                    map[y][startX] = ' ';
                }
                if (startX + 1 < this.state.WIDTH - this.CORRIDOR_EDGE_BUFFER) {
                    const positionKey2 = `${y},${startX + 1}`;
                    if (!floorPositions.has(positionKey2)) {
                        this.removeWallAtPosition(startX + 1, y, walls, levelEntity);
                        floorPositions.add(positionKey2);
                        map[y][startX + 1] = ' ';
                    }
                }
            }
        } else if (startY === endY) {
            const xMin = Math.min(startX, endX);
            const xMax = Math.max(startX, endX);
            for (let x = xMin; x <= xMax; x++) {
                const positionKey = `${startY},${x}`;
                if (!floorPositions.has(positionKey)) {
                    this.removeWallAtPosition(x, startY, walls, levelEntity);
                    floorPositions.add(positionKey);
                    map[startY][x] = ' ';
                }
                if (startY + 1 < this.state.HEIGHT - this.CORRIDOR_EDGE_BUFFER) {
                    const positionKey2 = `${startY + 1},${x}`;
                    if (!floorPositions.has(positionKey2)) {
                        this.removeWallAtPosition(x, startY + 1, walls, levelEntity);
                        floorPositions.add(positionKey2);
                        map[startY + 1][x] = ' ';
                    }
                }
            }
        }
    }
        /*
    carveLCorridor(startRoomId, endRoomId, map, floors, walls, floorPositions, levelEntity) {
        const tier = levelEntity.getComponent('Tier').value;
        if (!startRoomId || !endRoomId) {
            console.error(`LevelSystem: carveLCorridor: Invalid room IDs - startRoomId: ${startRoomId}, endRoomId: ${endRoomId}`);
            return;
        }
        const startRoom = this.entityManager.getEntity(startRoomId).getComponent('Room');
        const endRoom = this.entityManager.getEntity(endRoomId).getComponent('Room');
        if (!startRoom || !endRoom) {
            console.error(`LevelSystem: carveLCorridor: Failed to retrieve Room components - startRoomId: ${startRoomId}, endRoomId: ${endRoomId}`);
            return;
        }

        const startX = startRoom.centerX;
        const startY = startRoom.centerY;
        const endX = endRoom.centerX;
        const endY = endRoom.centerY;
        const midX = Math.floor((startX + endX) / 2);

        // Helper to carve a 2-tile wide corridor at (x, y) in the given orientation
        const carve2Wide = (x, y, horizontal = true) => {
            // Always carve (x, y) and (x+1, y) for horizontal, or (x, y) and (x, y+1) for vertical
            for (let offset = 0; offset < 2; offset++) {
                let nx = x, ny = y;
                if (horizontal) nx = x + offset;
                else ny = y + offset;
                if (
                    nx >= 0 && nx < this.state.WIDTH &&
                    ny >= 0 && ny < this.state.HEIGHT
                ) {
                    const positionKey = `${ny},${nx}`;
                    if (!floorPositions.has(positionKey)) {
                        this.removeWallAtPosition(nx, ny, walls, levelEntity);
                        floorPositions.add(positionKey);
                        map[ny][nx] = ' ';
                    }
                }
            }
        };



        // Horizontal from startX to midX at startY
        let x = startX;
        const xStep = Math.sign(midX - startX) || 1;
        while (x !== midX) {
            carve2Wide(x, startY, true);
            x += xStep;
        }

        // Vertical from startY to endY at midX
        let y = startY;
        const yStep = Math.sign(endY - startY) || 1;
        while (y !== endY) {
            carve2Wide(midX, y, false);
            y += yStep;
        }

        // Horizontal from midX to endX at endY
        x = midX;
        const xStep2 = Math.sign(endX - midX) || 1;
        while (x !== endX) {
            carve2Wide(x, endY, true);
            x += xStep2;
        }
    }
    */
   /*
    carveLCorridor(startRoomId, endRoomId, map, floors, walls, floorPositions, levelEntity) {
        const tier = levelEntity.getComponent('Tier').value;
        if (!startRoomId || !endRoomId) {
            console.error(`LevelSystem: carveLCorridor: Invalid room IDs - startRoomId: ${startRoomId}, endRoomId: ${endRoomId}`);
            return;
        }
        const startRoom = this.entityManager.getEntity(startRoomId).getComponent('Room');
        const endRoom = this.entityManager.getEntity(endRoomId).getComponent('Room');
        if (!startRoom || !endRoom) {
            console.error(`LevelSystem: carveLCorridor: Failed to retrieve Room components - startRoomId: ${startRoomId}, endRoomId: ${endRoomId}`);
            return;
        }

        const startX = startRoom.centerX;
        const startY = startRoom.centerY;
        const endX = endRoom.centerX;
        const endY = endRoom.centerY;
        const midX = Math.floor((startX + endX) / 2);
        //console.log(`LevelSystem: Carving corridor from (${startX},${startY}) to (${endX},${endY})`);
        // Defensive checks
        if (
            !Number.isFinite(startX) || !Number.isFinite(startY) ||
            !Number.isFinite(endX) || !Number.isFinite(endY) ||
            startX < 0 || startX >= this.state.WIDTH ||
            startY < 0 || startY >= this.state.HEIGHT ||
            endX < 0 || endX >= this.state.WIDTH ||
            endY < 0 || endY >= this.state.HEIGHT
        ) {
            console.error(`LevelSystem: Corridor carving aborted: Invalid room centers: start(${startX},${startY}) end(${endX},${endY})`);
            return;
        }

        let x = startX;
        while (x !== midX) {
            const positionKey = `${startY},${x}`;
            if (!floorPositions.has(positionKey)) {
                this.removeWallAtPosition(x, startY, walls, levelEntity);
                floorPositions.add(positionKey);
                map[startY][x] = ' ';
            }
            if (startY + 1 < this.state.HEIGHT - this.CORRIDOR_EDGE_BUFFER) {
                const positionKey2 = `${startY + 1},${x}`;
                if (!floorPositions.has(positionKey2)) {
                    this.removeWallAtPosition(x, startY + 1, walls, levelEntity);
                    floorPositions.add(positionKey2);
                    map[startY + 1][x] = ' ';
                }
            }
            x += Math.sign(midX - x);
        }

        let y = startY;
        while (y !== endY) {
            const positionKey = `${y},${midX}`;
            if (!floorPositions.has(positionKey)) {
                this.removeWallAtPosition(midX, y, walls, levelEntity);
                floorPositions.add(positionKey);
                map[y][midX] = ' ';
            }
            if (midX + 1 < this.state.WIDTH - this.CORRIDOR_EDGE_BUFFER) {
                const positionKey2 = `${y},${midX + 1}`;
                if (!floorPositions.has(positionKey2)) {
                    this.removeWallAtPosition(midX + 1, y, walls, levelEntity);
                    floorPositions.add(positionKey2);
                    map[y][midX + 1] = ' ';
                }
            }
            y += Math.sign(endY - y);
        }

        x = midX;
        while (x !== endX) {
            const positionKey = `${endY},${x}`;
            if (!floorPositions.has(positionKey)) {
                this.removeWallAtPosition(x, endY, walls, levelEntity);
                floorPositions.add(positionKey);
                map[endY][x] = ' ';
            }
            if (endY + 1 < this.state.HEIGHT - this.CORRIDOR_EDGE_BUFFER) {
                const positionKey2 = `${endY + 1},${x}`;
                if (!floorPositions.has(positionKey2)) {
                    this.removeWallAtPosition(x, endY + 1, walls, levelEntity);
                    floorPositions.add(positionKey2);
                    map[endY + 1][x] = ' ';
                }
            }
            x += Math.sign(endX - x);
        }
    }
    */

    carveLCorridor(startRoomId, endRoomId, map, floors, walls, floorPositions, levelEntity) {
        const tier = levelEntity.getComponent('Tier').value;
        if (!startRoomId || !endRoomId) {
            console.error(`LevelSystem: carveLCorridor: Invalid room IDs - startRoomId: ${startRoomId}, endRoomId: ${endRoomId}`);
            return;
        }
        const startRoom = this.entityManager.getEntity(startRoomId).getComponent('Room');
        const endRoom = this.entityManager.getEntity(endRoomId).getComponent('Room');
        if (!startRoom || !endRoom) {
            console.error(`LevelSystem: carveLCorridor: Failed to retrieve Room components - startRoomId: ${startRoomId}, endRoomId: ${endRoomId}`);
            return;
        }

        const startX = startRoom.centerX;
        const startY = startRoom.centerY;
        const endX = endRoom.centerX;
        const endY = endRoom.centerY;
        const midX = Math.floor((startX + endX) / 2);

        // Horizontal from startX to midX at startY
        let x = startX;
        while (x !== midX) {
            const positionKey = `${startY},${x}`;
            if (!floorPositions.has(positionKey)) {
                this.removeWallAtPosition(x, startY, walls, levelEntity);
                floorPositions.add(positionKey);
                map[startY][x] = ' ';
            }
            if (startY + 1 < this.state.HEIGHT - this.CORRIDOR_EDGE_BUFFER) {
                const positionKey2 = `${startY + 1},${x}`;
                if (!floorPositions.has(positionKey2)) {
                    this.removeWallAtPosition(x, startY + 1, walls, levelEntity);
                    floorPositions.add(positionKey2);
                    map[startY + 1][x] = ' ';
                }
            }
            x += Math.sign(midX - x);
        }

        // --- Carve a 2x2 at the bend (midX, startY) ---
        for (let dx = 0; dx < 2; dx++) {
            for (let dy = 0; dy < 2; dy++) {
                const bx = midX + dx;
                const by = startY + dy;
                if (
                    bx >= 0 && bx < this.state.WIDTH &&
                    by >= 0 && by < this.state.HEIGHT
                ) {
                    const bendKey = `${by},${bx}`;
                    if (!floorPositions.has(bendKey)) {
                        this.removeWallAtPosition(bx, by, walls, levelEntity);
                        floorPositions.add(bendKey);
                        map[by][bx] = ' ';
                    }
                }
            }
        }

        // Vertical from startY to endY at midX
        let y = startY;
        while (y !== endY) {
            const positionKey = `${y},${midX}`;
            if (!floorPositions.has(positionKey)) {
                this.removeWallAtPosition(midX, y, walls, levelEntity);
                floorPositions.add(positionKey);
                map[y][midX] = ' ';
            }
            if (midX + 1 < this.state.WIDTH - this.CORRIDOR_EDGE_BUFFER) {
                const positionKey2 = `${y},${midX + 1}`;
                if (!floorPositions.has(positionKey2)) {
                    this.removeWallAtPosition(midX + 1, y, walls, levelEntity);
                    floorPositions.add(positionKey2);
                    map[y][midX + 1] = ' ';
                }
            }
            y += Math.sign(endY - y);
        }

        // --- Carve a 2x2 at the second bend (midX, endY) ---
        for (let dx = 0; dx < 2; dx++) {
            for (let dy = 0; dy < 2; dy++) {
                const bx = midX + dx;
                const by = endY + dy;
                if (
                    bx >= 0 && bx < this.state.WIDTH &&
                    by >= 0 && by < this.state.HEIGHT
                ) {
                    const bendKey = `${by},${bx}`;
                    if (!floorPositions.has(bendKey)) {
                        this.removeWallAtPosition(bx, by, walls, levelEntity);
                        floorPositions.add(bendKey);
                        map[by][bx] = ' ';
                    }
                }
            }
        }

        // Horizontal from midX to endX at endY
        x = midX;
        while (x !== endX) {
            const positionKey = `${endY},${x}`;
            if (!floorPositions.has(positionKey)) {
                this.removeWallAtPosition(x, endY, walls, levelEntity);
                floorPositions.add(positionKey);
                map[endY][x] = ' ';
            }
            if (endY + 1 < this.state.HEIGHT - this.CORRIDOR_EDGE_BUFFER) {
                const positionKey2 = `${endY + 1},${x}`;
                if (!floorPositions.has(positionKey2)) {
                    this.removeWallAtPosition(x, endY + 1, walls, levelEntity);
                    floorPositions.add(positionKey2);
                    map[endY + 1][x] = ' ';
                }
            }
            x += Math.sign(endX - x);
        }
    }

    carveTCorridor(startRoomId, endRoomId, map, roomEntityIds, floors, walls, floorPositions, levelEntity) {
        const tier = levelEntity.getComponent('Tier').value;
        if (!startRoomId || !endRoomId) {
            console.error(`LevelSystem: carveTCorridor: Invalid room IDs - startRoomId: ${startRoomId}, endRoomId: ${endRoomId}`);
            return;
        }
        const startRoom = this.entityManager.getEntity(startRoomId).getComponent('Room');
        const endRoom = this.entityManager.getEntity(endRoomId).getComponent('Room');
        if (!startRoom || !endRoom) {
            console.error(`LevelSystem: carveTCorridor: Failed to retrieve Room components - startRoomId: ${startRoomId}, endRoomId: ${endRoomId}`);
            return;
        }

        const startX = startRoom.centerX;
        const startY = startRoom.centerY;
        const endX = endRoom.centerX;
        const endY = endRoom.centerY;
        //console.log(`LevelSystem: Carving corridor from (${startX},${startY}) to (${endX},${endY})`);
        // Defensive checks
        if (
            !Number.isFinite(startX) || !Number.isFinite(startY) ||
            !Number.isFinite(endX) || !Number.isFinite(endY) ||
            startX < 0 || startX >= this.state.WIDTH ||
            startY < 0 || startY >= this.state.HEIGHT ||
            endX < 0 || endX >= this.state.WIDTH ||
            endY < 0 || endY >= this.state.HEIGHT
        ) {
            console.error(`LevelSystem: Corridor carving aborted: Invalid room centers: start(${startX},${startY}) end(${endX},${endY})`);
            return;
        }

        let x = startX;
        while (x !== endX) {
            const positionKey = `${startY},${x}`;
            if (!floorPositions.has(positionKey)) {
                this.removeWallAtPosition(x, startY, walls, levelEntity);
                floorPositions.add(positionKey);
                map[startY][x] = ' ';
            }
            if (startY + 1 < this.state.HEIGHT - this.CORRIDOR_EDGE_BUFFER) {
                const positionKey2 = `${startY + 1},${x}`;
                if (!floorPositions.has(positionKey2)) {
                    this.removeWallAtPosition(x, startY + 1, walls, levelEntity);
                    floorPositions.add(positionKey2);
                    map[startY + 1][x] = ' ';
                }
            }
            x += Math.sign(endX - x);
        }

        let y = startY;
        while (y !== endY) {
            const positionKey = `${y},${endX}`;
            if (!floorPositions.has(positionKey)) {
                this.removeWallAtPosition(endX, y, walls, levelEntity);
                floorPositions.add(positionKey);
                map[y][endX] = ' ';
            }
            if (endX + 1 < this.state.WIDTH - this.CORRIDOR_EDGE_BUFFER) {
                const positionKey2 = `${y},${endX + 1}`;
                if (!floorPositions.has(positionKey2)) {
                    this.removeWallAtPosition(endX + 1, y, walls, levelEntity);
                    floorPositions.add(positionKey2);
                    map[y][endX + 1] = ' ';
                }
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
                if (!floorPositions.has(positionKey)) {
                    this.removeWallAtPosition(x, endY, walls, levelEntity);
                    floorPositions.add(positionKey);
                    map[endY][x] = ' ';
                }
                if (endY + 1 < this.state.HEIGHT - this.CORRIDOR_EDGE_BUFFER) {
                    const positionKey2 = `${endY + 1},${x}`;
                    if (!floorPositions.has(positionKey2)) {
                        this.removeWallAtPosition(x, endY + 1, walls, levelEntity);
                        floorPositions.add(positionKey2);
                        map[endY + 1][x] = ' ';
                    }
                }
                x += Math.sign(thirdRoom.centerX - x);
            }

            y = endY;
            while (y !== thirdRoom.centerY) {
                const positionKey = `${y},${thirdRoom.centerX}`;
                if (!floorPositions.has(positionKey)) {
                    this.removeWallAtPosition(thirdRoom.centerX, y, walls, levelEntity);
                    floorPositions.add(positionKey);
                    map[y][thirdRoom.centerX] = ' ';
                }
                if (thirdRoom.centerX + 1 < this.state.WIDTH - this.CORRIDOR_EDGE_BUFFER) {
                    const positionKey2 = `${y},${thirdRoom.centerX + 1}`;
                    if (!floorPositions.has(positionKey2)) {
                        this.removeWallAtPosition(thirdRoom.centerX + 1, y, walls, levelEntity);
                        floorPositions.add(positionKey2);
                        map[y][thirdRoom.centerX + 1] = ' ';
                    }
                    y += Math.sign(thirdRoom.centerY - y);
                }

                thirdRoom.connections.push(endRoomId);
                endRoom.connections.push(thirdRoomId);
            }
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
        //console.log(`LevelSystem.js: placeStairs - Starting for tier ${levelEntity.getComponent('Tier').value}, hasBossRoom: ${hasBossRoom}`);
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

            const stairDownEntity = this.generateStairEntity(levelData, entityList, tier, bossRoomId, 'down', stairDownX, stairDownY, true);

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
                    const stairDownEntity = this.generateStairEntity(levelData, entityList, tier, roomId, 'down', stairDownX, stairDownY, true);
                    room.suppressMonsters = true;
                    break;
                }
                attempts++;
            }
            if (!levelData.stairsDown) {
                console.warn(`Failed to place stairsDown with distance check after 50 attempts`);
                const fallbackRoom = this.entityManager.getEntity(levelData.roomEntityIds[0]).getComponent('Room');
                stairDownX = fallbackRoom.left + 1;
                stairDownY = fallbackRoom.top + 1;
                const stairDownEntity = this.generateStairEntity(levelData, entityList, tier, roomId, 'down', stairDownX, stairDownY, true);
                //console.log(`LevelSystem.js: Placed stairsDown (fallback) at (${stairDownX}, ${stairDownY}) on tier ${tier}`);
                fallbackRoom.suppressMonsters = true;
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
                const stairUpEntity = this.generateStairEntity(levelData, entityList, tier, roomId, 'up', stairUpX, stairUpY, true);
                room.suppressMonsters = true;
                break;
            }
            attempts++;
        }
        if (!levelData.stairsUp) {
            console.warn(`Failed to place stairsUp with distance check after 50 attempts`);
            const fallbackRoom = this.entityManager.getEntity(upRooms[0]).getComponent('Room');
            stairUpX = fallbackRoom.left + 1;
            stairUpY = fallbackRoom.top + 1;
            const stairUpEntity = this.generateStairEntity(levelData, entityList, tier, roomId, 'up', stairUpX, stairUpY, true);
            fallbackRoom.suppressMonsters = true;
            //console.log(`LevelSystem.js: Placed stairsUp (fallback) at (${stairUpX}, ${stairUpY}) on tier ${tier}`);
        }

        if (hasBossRoom) {
            //console.log(`Has boss room = ${hasBossRoom}, checking stairsDown distance to map center`);
            const bossRoomId = levelData.roomEntityIds.find(rId => this.entityManager.getEntity(rId).getComponent('Room').roomType === 'BossChamberSpecial');
            const bossRoom = this.entityManager.getEntity(bossRoomId).getComponent('Room');
            const paddedDistance = this.MIN_STAIR_DISTANCE + Math.floor((bossRoom.width + bossRoom.height) / 2);
            if (this.calculateDistance(levelData.stairsDown.x, levelData.stairsDown.y, this.state.WIDTH / 2, this.state.HEIGHT / 2) < paddedDistance) {
                console.warn(`StairsDown too close to map center with boss padding`);
            }
        }

        levelData.walls = entityList.walls;
        levelData.floors = entityList.floors;
        //console.log(`LevelSystem.js: placeStairs - Completed for tier ${tier}`);
    }



    generateCustomLevel(levelEntity) {
        //console.log(`LevelSystem.js: generateSurfaceLevel - Starting for tier 0`);
        const width = this.state.WIDTH;
        const height = this.state.HEIGHT;
        const map = Array(height).fill().map(() => Array(width).fill('#'));
        const walls = [];
        const floors = [];
        const stairs = [];
        const npcs = [];
        const shopCounters = [];
       
        const tier = 0;
        const stairPos = { upX: 14, upY: 8, downX: 3, downY: 8 }

        for (let y = 1; y <= 9; y++) {
            for (let x = 1; x <= 13; x++) {
                map[y][x] = ' ';
                const floorId = `floor_0_floor_${y}_${x}`;
                const floorEntity = this.entityManager.createEntity(floorId);
                this.entityManager.addComponentToEntity(floorEntity.id, new PositionComponent(x * this.TILE_SIZE, y * this.TILE_SIZE));
                this.entityManager.addComponentToEntity(floorEntity.id, new FloorComponent());
                floors.push(floorEntity.id);
            }
        }

        for (let y = 0; y <= 10; y++) {
            for (let x = 0; x <= 20; x++) {
                if (y === 0 || y === 10 || x === 0 || x === 20) {
                    const wallId = `wall_0_wall_${y}_${x}`;
                    const wallEntity = this.entityManager.createEntity(wallId);
                    const pixelX = x * this.TILE_SIZE;
                    const pixelY = y * this.TILE_SIZE;
                    this.entityManager.addComponentToEntity(wallEntity.id, new PositionComponent(pixelX, pixelY));
                    this.entityManager.addComponentToEntity(wallEntity.id, new WallComponent());
                    this.entityManager.addComponentToEntity(wallEntity.id, new VisualsComponent(this.TILE_SIZE, this.TILE_SIZE));
                    const visuals = wallEntity.getComponent('Visuals');
                    visuals.avatar = 'img/map/wall.png';
                    this.entityManager.addComponentToEntity(wallEntity.id, new HitboxComponent(this.TILE_SIZE, this.TILE_SIZE));
                    walls.push(wallEntity.id);
                }
            }
        }

        // Create a single room entity for the surface level
        const roomEntityId = 'room_0_surface';
        const roomEntity = this.entityManager.createEntity(roomEntityId);
        
        this.entityManager.addComponentToEntity(roomEntityId, new RoomComponent({
            left: 1,
            top: 1,
            width: 13,
            height: 9,
            type: 'SurfaceRoom',
            centerX: 1 + Math.floor(13 / 2),
            centerY: 1 + Math.floor(9 / 2),
            connections: []
        }));
        const roomEntityIds = [roomEntityId] || [];

        const levelData = {
            map: map,
            walls: walls,
            floors: floors,
            stairs: stairs,
            npcs: npcs,
            shopCounters : shopCounters,
            stairsDown: { x: stairPos.downX, y: stairPos.downY },
            stairsUp:  { x: stairPos.upX, y: stairPos.upY },
            roomEntityIds: roomEntityIds,
        };

        const mapComp = new MapComponent(levelData);
        this.entityManager.addComponentToEntity(levelEntity.id, mapComp);
        //console.log(`LevelSystem.js: Added MapComponent to ${levelEntity.id} during generateSurfaceLevel`);

        const entityList = levelEntity.getComponent('EntityList');
        entityList.walls = walls;
        entityList.floors = floors;
        entityList.stairs = stairs;
        entityList.npcs = npcs;
        entityList.shopCounters = shopCounters;
        //console.log(`LevelSystem.js: Updated EntityListComponent for ${levelEntity.id} in generateSurfaceLevel`);
       
       
        const stairUpEntity = this.generateStairEntity(levelData, entityList, tier, roomEntityId, 'up', stairPos.upX, stairPos.upY, true);
        const stairDownEntity = this.generateStairEntity(levelData, entityList, tier, roomEntityId, 'down', stairPos.downX, stairPos.downY, true);
        
        
        this.eventBus.emit('SpawnNPCs', {
            tier: 0,
            npcs: [
                { id: 'sehnrhyx_syliri', x: 8, y: 3 },
                { id: 'shop_keeper', x: 8, y: 8 }
            ]
        });
        const portalPos = { x: 16, y: 2 };
        const portalEntity = this.generatePortal(entityList, tier, mapComp, portalPos.x, portalPos.y);
        const shopCounterPos = { x: 7, y: 8 };
        const shopCounterEntity = this.generateShopCounter(entityList, tier, mapComp, shopCounterPos.x, shopCounterPos.y);

        //console.log(`LevelSystem.js: generateSurfaceLevel - Completed for tier 0`);
        return levelData;
    }

    padMap(map, walls = [], floors = [], tier = 0) {
        //console.log(`LevelSystem.js: padMap - Starting for tier ${tier}`);
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

        //console.log(`LevelSystem.js: padMap - Completed for tier ${tier}`);
        return padded;
    }

    adjustPlayerPosition(levelEntity, stair) {
        //console.log(`LevelSystem.js: adjustPlayerPosition - Starting for tier ${levelEntity.getComponent('Tier').value}`);
        const mapComponent = levelEntity.getComponent('Map');
        if (!mapComponent || !mapComponent.map) {
            console.error(`LevelSystem: No valid MapComponent or map for entity ${levelEntity.id}`);
            return;
        }
        const map = mapComponent.map;
        const tier = levelEntity.getComponent('Tier').value;
        //console.log(`LevelSystem.js: adjustPlayerPosition - Adjusting player position for tier ${tier}, stair: (${stair?.x}, ${stair?.y})`);

        // Log the map state around the stair
        if (stair) {
            const minY = Math.max(0, stair.y - 1);
            const maxY = Math.min(map.length - 1, stair.y + 1);
            const minX = Math.max(0, stair.x - 1);
            const maxX = Math.min(map[0].length - 1, stair.x + 1);
            //console.log(`LevelSystem.js: Map state around stair (${stair.x}, ${stair.y}):`);
            for (let y = minY; y <= maxY; y++) {
                let row = '';
                for (let x = minX; x <= maxX; x++) {
                    row += map[y][x] + ' ';
                }
                //console.log(`Row ${y}: ${row}`);
            }
        }

        const directions = [
            { x: stair.x - 1, y: stair.y }, { x: stair.x + 1, y: stair.y },
            { x: stair.x, y: stair.y - 1 }, { x: stair.x, y: stair.y + 1 }
        ];
        const player = this.entityManager.getEntity('player');
        const pos = player.getComponent('Position');
        const exploration = levelEntity.getComponent('Exploration');

        if (!Number.isFinite(this.TILE_SIZE) || this.TILE_SIZE <= 0) {
            console.error(`LevelSystem.js: Invalid TILE_SIZE (${this.TILE_SIZE}) for player positioning`);
            pos.x = this.TILE_SIZE; // Fallback to (32, 32)
            pos.y = this.TILE_SIZE;
            console.warn(`LevelSystem: Set player position to fallback (${pos.x}, ${pos.y}) due to invalid TILE_SIZE`);
            return;
        }

        for (const dir of directions) {
            if (dir.y >= 0 && dir.y < map.length && dir.x >= 0 && dir.x < map[0].length && map[dir.y][dir.x] === ' ') {
                pos.x = dir.x * this.TILE_SIZE;
                pos.y = dir.y * this.TILE_SIZE;
                if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) {
                    console.error(`LevelSystem.js: Computed NaN player position for tile (${dir.x}, ${dir.y})`);
                    pos.x = this.TILE_SIZE; // Fallback to (32, 32)
                    pos.y = this.TILE_SIZE;
                    console.warn(`LevelSystem: Set player position to fallback (${pos.x}, ${pos.y}) due to NaN`);
                } else {
                    console.warn(`LevelSystem: Set player position to (${pos.x}, ${pos.y}) near stairs at (${stair.x}, ${stair.y})`);
                }

                // Mark player's starting tile and surrounding area as discovered
                const radius = 5; // Mark a 5-tile radius as discovered
                for (let dy = -radius; dy <= radius; dy++) {
                    for (let dx = -radius; dx <= radius; dx++) {
                        const tileX = dir.x + dx;
                        const tileY = dir.y + dy;
                        if (tileX >= 0 && tileX < map[0].length && tileY >= 0 && tileY < map.length) {
                            if (map[tileY][tileX] === ' ') {
                                exploration.discoveredFloors.add(`${tileX},${tileY}`);
                            }
                        }
                    }
                }
                return;
            }
        }

        pos.x = this.TILE_SIZE;
        pos.y = this.TILE_SIZE;
        console.warn(`LevelSystem: No adjacent walkable tile found near (${stair.x}, ${stair.y}), using fallback position (${pos.x}, ${pos.y})`);
        exploration.discoveredFloors.add(`${Math.floor(pos.x / this.TILE_SIZE)},${Math.floor(pos.y / this.TILE_SIZE)}`);
    }

    ensureRoomConnections(levelEntity) {
        const mapComp = levelEntity.getComponent('Map');
        const entityList = levelEntity.getComponent('EntityList');
        const tier = levelEntity.getComponent('Tier').value;
        const rooms = Array.isArray(entityList.rooms) ? entityList.rooms : [];
        if (rooms.length === 0) return;

        // Build adjacency list from room connections
        const adj = {};
        for (const roomId of rooms) {
            const room = this.entityManager.getEntity(roomId).getComponent('Room');
            adj[roomId] = new Set(room.connections || []);
        }

        // Find connected components using BFS
        const visited = new Set();
        const components = [];
        for (const roomId of rooms) {
            if (visited.has(roomId)) continue;
            const queue = [roomId];
            const component = [];
            visited.add(roomId);
            while (queue.length > 0) {
                const curr = queue.shift();
                component.push(curr);
                for (const neighbor of adj[curr]) {
                    if (!visited.has(neighbor)) {
                        visited.add(neighbor);
                        queue.push(neighbor);
                    }
                }
            }
            components.push(component);
        }

        // If only one component, all rooms are connected
        if (components.length <= 1) {
            //console.log(`LevelSystem: All rooms are already connected for tier ${tier}`);
            return;
        }

        // Otherwise, connect components together
        console.warn(`LevelSystem: Found ${components.length} disconnected room clusters on tier ${tier}. Connecting...`);
        while (components.length > 1) {
            // Always connect the first component to the next
            const compA = components[0];
            const compB = components[1];

            // Find the closest pair of rooms between compA and compB
            let minDist = Infinity;
            let pair = null;
            for (const a of compA) {
                const roomA = this.entityManager.getEntity(a).getComponent('Room');
                for (const b of compB) {
                    const roomB = this.entityManager.getEntity(b).getComponent('Room');
                    const dist = this.calculateDistance(roomA.centerX, roomA.centerY, roomB.centerX, roomB.centerY);
                    if (dist < minDist) {
                        minDist = dist;
                        pair = [a, b];
                    }
                }
            }

            // Carve a corridor and update connections
            if (pair) {
                this.carveCorridor(pair[0], pair[1], mapComp.map, rooms, entityList.floors, entityList.walls, new Set(), levelEntity);
                const roomA = this.entityManager.getEntity(pair[0]).getComponent('Room');
                const roomB = this.entityManager.getEntity(pair[1]).getComponent('Room');
                if (!roomA.connections.includes(pair[1])) roomA.connections.push(pair[1]);
                if (!roomB.connections.includes(pair[0])) roomB.connections.push(pair[0]);
                // Merge compB into compA and remove compB from components
                compA.push(...compB);
                components.splice(1, 1);
            } else {
                // Should not happen, but break to avoid infinite loop
                break;
            }
        }
        //console.log(`LevelSystem: All rooms are now connected for tier ${tier}`);
        this.ensureRoomConnectionsPassTwo(levelEntity);
    }


 
    ensureRoomConnectionsPassTwo(levelEntity) {
        const mapComp = levelEntity.getComponent('Map');
        const entityList = levelEntity.getComponent('EntityList');
        const tier = levelEntity.getComponent('Tier').value;

        const rooms = Array.isArray(entityList.rooms) ? entityList.rooms : [];
        //console.log(`LevelSystem: Ensuring room connections for tier ${tier}, rooms: ${JSON.stringify(rooms)}`);

        //console.log(`LevelSystem ensureRoomConnections: Room types and connections before ensuring connections:`);
        for (const roomId of rooms) {
            const room = this.entityManager.getEntity(roomId).getComponent('Room');
            //console.log(`Room ${roomId} at (${room.left}, ${room.top}), type: ${room.roomType}, connections: ${room.connections.length}`);
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
    }

    isWalkable(x, y) {
        const mapComp = this.entityManager.getEntitiesWith(['Map']).find(e => e.getComponent('Tier').value === this.entityManager.getActiveTier())?.getComponent('Map');
        if (!mapComp || !mapComp.map) {
            console.error(`LevelSystem.js: No valid MapComponent for active tier ${this.entityManager.getActiveTier()}`);
            return false;
        }
        return x >= 0 && x < this.state.WIDTH && y >= 0 && y < this.state.HEIGHT && mapComp.map[y][x] === ' ';
    }

    async checkLevelAfterTransitions({ tier, levelEntity = null }) {
        //console.log(`LevelSystem.js: checkLevelAfterTransitions - Starting for tier ${tier}`);
        const entity = levelEntity || this.entityManager.getEntitiesWith(['Tier']).find(e => e.getComponent('Tier').value === tier);
        if (!entity) {
            console.warn(`LevelSystem.js: No level entity found for tier ${tier}`);
            return;
        }
        this.ensureRoomConnections(entity);
        //console.log(`LevelSystem.js: Checking level ${entity.id}, components: ${Array.from(entity.components.keys())}`);

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

        // Ensure entityList.npcs is initialized
        if (!entityList.npcs) {
            entityList.npcs = [];
        }

        //console.log(`LevelSystem.js: EntityListComponent.npcs before spawning:`, entityList.npcs);

        const hasPortal = entityList.portals.length > 0;
        const minPortalPlacementTier = 3;
        if (tier >= minPortalPlacementTier && !hasPortal) {
            const rooms = entityList.rooms.map(id => this.entityManager.getEntity(id).getComponent('Room'));
            const validRooms = rooms.filter(r => r.roomType !== 'BossChamberSpecial');
            if (validRooms.length > 0) {
                const room = validRooms[Math.floor(Math.random() * validRooms.length)];
                let x, y;
                let attempts = 0;
                do {
                    x = room.left + 1 + Math.floor(Math.random() * (room.width - 2));
                    y = room.top + 1 + Math.floor(Math.random() * (room.height - 2));
                    attempts++;
                    if (attempts > 50) {
                        console.error(`LevelSystem.js: Failed to place portal on tier ${tier} after 50 attempts`);
                        break;
                    }
                } while (mapComp.map[y][x] !== ' ');
                if (attempts <= 50) {
                    const portalEntity = this.generatePortal(entityList, tier,  mapComp, x, y);
                    
                }
            }
        }

        // Add a shopkeeper NPC every 10 tiers if none exists
        let randomMerchant = false;
        const merchantChance = 0.1; // 10% chance to spawn a random merchant
        if (Math.random() < merchantChance) {
            randomMerchant = true;
        }
        if (tier > 0 && (tier % 10 === 0 || randomMerchant )) {
            const hasShopkeeper = entityList.npcs.some(npcId => {
                const npc = this.entityManager.getEntity(npcId);
                const npcData = npc.getComponent('NPCData');
                return npcData && npcData.id === 'shop_keeper';
            });

            if (!hasShopkeeper) {
                const rooms = entityList.rooms.map(id => this.entityManager.getEntity(id).getComponent('Room'));
                const validRooms = rooms.filter(r => r.roomType !== 'BossChamberSpecial');
                if (validRooms.length > 0) {
                    const room = validRooms[Math.floor(Math.random() * validRooms.length)];
                    let tileX, tileY;
                    let attempts = 0;
                    do {
                        tileX = room.left + 1 + Math.floor(Math.random() * (room.width - 2));
                        tileY = room.top + 1 + Math.floor(Math.random() * (room.height - 2));
                        attempts++;
                        if (attempts > 50) {
                            console.error(`LevelSystem.js: Failed to place shopkeeper NPC on tier ${tier} after 50 attempts`);
                            break;
                        }
                    } while (!this.isWalkable(tileX, tileY));

                    if (attempts <= 50) {
                        const npcData = { id: 'shop_keeper', x: tileX, y: tileY };
                        // Emit SpawnNPCs and wait for completion before proceeding
                        await new Promise((resolve) => {
                            const onNPCsSpawned = ({ spawnedTier }) => {
                                if (spawnedTier === tier) {
                                    this.eventBus.off('NPCsSpawned', onNPCsSpawned);
                                    //console.log(`LevelSystem.js: Spawned shopkeeper NPC on tier ${tier} at tile (${tileX}, ${tileY})`);
                                    resolve();
                                }
                            };
                            this.eventBus.on('NPCsSpawned', onNPCsSpawned);
                            this.eventBus.emit('SpawnNPCs', {
                                tier,
                                npcs: [npcData]
                            });
                        });
                    } else {
                        console.warn(`LevelSystem.js: No valid position to place shopkeeper NPC on tier ${tier}`);
                    }
                } else {
                    console.warn(`LevelSystem.js: No valid rooms to place shopkeeper NPC on tier ${tier}`);
                }
            } else {
                //console.log(`LevelSystem.js: Shopkeeper NPC already exists on tier ${tier}`);
            }
        }

        // Generate shop inventories only after NPC spawning is confirmed
        //console.log(`LevelSystem.js: Emitting GenerateShopInventories for tier ${tier} after NPC spawning`);
        this.eventBus.emit('GenerateShopInventories', { tier });
        //console.log(`LevelSystem.js: checkLevelAfterTransitions - Completed for tier ${tier}`);

        this.utilities.pushPlayerActions('reachTier', { tier });
    }

    calculateDistance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }
}