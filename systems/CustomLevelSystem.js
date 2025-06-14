
// systems/CustomLevelSystem.js
// Manages loading and parsing custom level JSON files

import { System } from '../core/Systems.js';
import { customLevels } from '../data/cfg/customLevels.js';

import {
    MapComponent,
    EntityListComponent,
    PositionComponent,
    VisualsComponent,
    WallComponent,
    FloorComponent,
    ExplorationComponent,
    SpatialBucketsComponent,
    HitboxComponent,
    RoomComponent
} from '../core/Components.js';

export class CustomLevelSystem extends System {
    constructor(entityManager, eventBus, state, entityGenerationSystem) {
        super(entityManager, eventBus);
        this.state = state;
        this.entityGenerationSystem = entityGenerationSystem;
        this.TILE_SIZE = state.TILE_SIZE || 32;
        this.customLevels = customLevels; 
    }

    init() {
        this.eventBus.on('LoadCustomLevel', ({ tier, levelEntity }) => this.loadCustomLevel(tier, levelEntity));
    }

    async loadCustomLevel(tier, levelEntity) {
        console.log(`CustomLevelSystem: Loading custom level for tier ${tier}`);
        // Clean up existing entities for this tier to prevent ID conflicts
        const existingEntities = this.entityManager.getEntitiesWith(['Tier']).filter(e => e.getComponent('Tier').value === tier);
        existingEntities.forEach(entity => {
            if (entity.id !== levelEntity.id) {
                this.entityManager.removeEntity(entity.id);
            }
        });

        return new Promise((resolve, reject) => {
            this.eventBus.emit('GetCustomLevelJSON', {
                tier,
                callback: (jsonData) => {
                    if (!jsonData) {
                        console.error(`CustomLevelSystem: No JSON data for tier ${tier}`);
                        reject(new Error(`Failed to load tier_${tier}.json`));
                        return;
                    }
                    try {
                        const levelData = this.parseLevelJSON(jsonData, tier, levelEntity);
                        resolve(levelData);
                    } catch (error) {
                        console.error(`CustomLevelSystem: Error parsing JSON for tier ${tier}:`, error);
                        reject(error);
                    }
                }
            });
        });
    }
    spawnRandomMonsters() {
        const hasElites = tier > 1;
        this.eventBus.emit('SpawnMonsters', {
            tier,
            rooms: levelData.roomEntityIds,
            hasBossRoom,
            spawnPool: { randomMonsters: true, uniqueMonsters: hasElites }
        });
    }

    parseLevelJSON(jsonData, tier, levelEntity) {
        console.log(`CustomLevelSystem: Parsing JSON for tier ${tier}`);
        const width = jsonData.width;
        const height = jsonData.height;

        if (width !== this.state.WIDTH || height !== this.state.HEIGHT) {
            throw new Error(`Map dimensions (${width}x${height}) do not match expected (${this.state.WIDTH}x${this.state.HEIGHT})`);
        }

        const map = Array(height).fill().map(() => Array(width).fill('#'));
        const walls = [];
        const floors = [];
        const stairs = [];
        const npcs = [];
        const shopCounters = [];
        const portals = [];
        const fountains = [];
        const treasures = [];
        let stairsUp = null;
        let stairsDown = null;

       

        // Create room entity first
        const roomEntityId = `room_${tier}_surface`;
        if (this.entityManager.getEntity(roomEntityId)) {
            this.entityManager.removeEntity(roomEntityId);
        }
        const roomEntity = this.entityManager.createEntity(roomEntityId);
        this.entityManager.addComponentToEntity(roomEntityId, new RoomComponent({
            left: 21,
            top: 21,
            width: 12,
            height: 7,
            type: 'SurfaceRoom',
            centerX: 21 + Math.floor(12 / 2),
            centerY: 21 + Math.floor(7 / 2),
            connections: []
        }));
        const roomEntityIds = [roomEntity.id];

        const entityBuildList = new EntityListComponent({
            walls,
            floors,
            stairs,
            portals,
            fountains,
            treasures,
            npcs,
            shopCounters,
            rooms: roomEntityIds
        });

        // Define tile-to-entity mapping for StaticEntities layer (adjust tile IDs based on StaticEntites.tsx)
        const tileEntityMap = {
            3: { type: 'Stair', direction: 'up' }, // StairsUp
            4: { type: 'Stair', direction: 'down' }, // StairsDown
            5: { type: 'Portal' }, // Portal
            6: { type: 'Fountain' }, // Fountain 
            7: { type: 'TreasureChest' }, // TreasureChest}
            8: { type: 'ShopCounter' }, // ShopCounter
            9: { type: 'NPC', id: 'sehnrhyx_syliri' }, // SehnrhyxSyliri
            10: { type: 'NPC', id: 'shop_keeper' } // ShopKeeper
            // Add mappings for larger entities if needed
        };

        // Parse Map tile layer (terrain)
        const mapTileLayer = jsonData.layers.find(layer => layer.name === 'Map' && layer.type === 'tilelayer');
        if (!mapTileLayer) {
            throw new Error('No Map tile layer found in JSON');
        }

        const mapData = mapTileLayer.data;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const tileId = mapData[y * width + x];
                const pixelX = x * this.TILE_SIZE;
                const pixelY = y * this.TILE_SIZE;

                const wallId = `wall_${tier}_wall_${y}_${x}`;
                const floorId = `floor_${tier}_floor_${y}_${x}`;
                if (this.entityManager.getEntity(wallId)) {
                    this.entityManager.removeEntity(wallId);
                }
                if (this.entityManager.getEntity(floorId)) {
                    this.entityManager.removeEntity(floorId);
                }

                if (tileId === 1) { // Wall
                    map[y][x] = '#';
                    const wallEntity = this.entityManager.createEntity(wallId);
                    this.entityManager.addComponentToEntity(wallId, new PositionComponent(pixelX, pixelY));
                    this.entityManager.addComponentToEntity(wallId, new WallComponent());
                    this.entityManager.addComponentToEntity(wallId, new VisualsComponent(this.TILE_SIZE, this.TILE_SIZE));
                    this.entityManager.addComponentToEntity(wallId, new HitboxComponent(this.TILE_SIZE, this.TILE_SIZE));
                    const visuals = wallEntity.getComponent('Visuals');
                    visuals.avatar = 'img/map/wall.png';
                    walls.push(wallId);
                } else if (tileId === 2) { // Floor
                    map[y][x] = ' ';
                    const floorEntity = this.entityManager.createEntity(floorId);
                    this.entityManager.addComponentToEntity(floorId, new PositionComponent(pixelX, pixelY));
                    this.entityManager.addComponentToEntity(floorId, new FloorComponent());
                    floors.push(floorId);
                } else { // Empty (tileId === 0), treat as wall
                    map[y][x] = '#';
                    const wallEntity = this.entityManager.createEntity(wallId);
                    this.entityManager.addComponentToEntity(wallId, new PositionComponent(pixelX, pixelY));
                    this.entityManager.addComponentToEntity(wallId, new WallComponent());
                    this.entityManager.addComponentToEntity(wallId, new VisualsComponent(this.TILE_SIZE, this.TILE_SIZE));
                    this.entityManager.addComponentToEntity(wallId, new HitboxComponent(this.TILE_SIZE, this.TILE_SIZE));
                    const visuals = wallEntity.getComponent('Visuals');
                    visuals.avatar = 'img/map/wall.png';
                    walls.push(wallId);
                }
            }
        }

        // Parse StaticEntities tile layer
        const entitiesLayer = jsonData.layers.find(layer => layer.name === 'StaticEntities' && layer.type === 'tilelayer');
        if (!entitiesLayer) {
            console.warn(`CustomLevelSystem: No StaticEntities tile layer found in tier ${tier} JSON, using fallback entities`);
            stairsUp = { x: 23, y: 19 };
            stairsDown = { x: 23, y: 29 };
            this.entityGenerationSystem.generateStairEntity(
                { map, walls, floors, stairs, npcs, shopCounters, portals, roomEntityIds: [roomEntityId] },
                { stairs },
                tier,
                roomEntityId,
                'up',
                23,
                19,
                true
            );
            this.entityGenerationSystem.generateStairEntity(
                { map, walls, floors, stairs, npcs, shopCounters, portals, roomEntityIds: [roomEntityId] },
                { stairs },
                tier,
                roomEntityId,
                'down',
                23,
                29,
                true
            );
            portals.push(this.entityGenerationSystem.generatePortal({ portals }, tier, { map }, 28, 18));
            shopCounters.push(this.entityGenerationSystem.generateShopCounter({ shopCounters }, tier, { map }, 27, 28));
            npcs.push({ id: 'sehnrhyx_syliri', x: 28, y: 23 }, { id: 'shop_keeper', x: 28, y: 28 });
        } else {
            const entitiesData = entitiesLayer.data;

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const tileId = entitiesData[y * width + x];
                    if (tileId === 0) continue; // Empty tile

                    const entityInfo = tileEntityMap[tileId];
                    if (!entityInfo) {
                        console.warn(`CustomLevelSystem: Unknown tile ID ${tileId} at (${x}, ${y}) in StaticEntities layer`);
                        continue;
                    }

                    const pixelX = x * this.TILE_SIZE;
                    const pixelY = y * this.TILE_SIZE;

                    // Debug log
                    console.log(`Processing entity ${entityInfo.type} at tile (${x}, ${y})`);

                    // Size for visuals/hitbox
                    const widthTiles = entityInfo.widthTiles || 1;
                    const heightTiles = entityInfo.heightTiles || 1;
                    const visualWidth = widthTiles * this.TILE_SIZE;
                    const visualHeight = heightTiles * this.TILE_SIZE;

                    switch (entityInfo.type) {
                        case 'Stair':
                            const direction = entityInfo.direction || 'up';
                            const stairId = this.entityGenerationSystem.generateStairEntity(
                                { map, walls, floors, stairs, npcs, shopCounters, portals, roomEntityIds: [roomEntityId] },
                                { stairs },
                                tier,
                                roomEntityId,
                                direction,
                                x,
                                y,
                                true
                            );
                            stairs.push(stairId);
                            if (direction === 'up') {
                                stairsUp = { x, y };
                            } else if (direction === 'down') {
                                stairsDown = { x, y };
                            }
                            break;
                        case 'Portal':
                            const portalId = this.entityGenerationSystem.generatePortal(
                                { portals },
                                tier,
                                { map },
                                x,
                                y
                            );
                            portals.push(portalId);
                            break;
                        case 'Fountain':
                            const fountainId = this.entityGenerationSystem.generateFountainEntity(
                                { fountains },
                                tier,
                                { map },
                                x,
                                y
                            );
                            fountains.push(fountainId);
                            break;

                        case 'TreasureChest':
                            const treasuresEntityId = this.entityGenerationSystem.generateLootEntity(
                                { entityList: entityBuildList },
                                tier,
                                { map },
                                x,
                                y
                            );
                            treasures.push(treasuresEntityId);
                            entityBuildList.treasures.push(treasuresEntityId);
                            break;
   
                        case 'ShopCounter':
                            const shopCounterId = this.entityGenerationSystem.generateShopCounter(
                                { shopCounters },
                                tier,
                                { map },
                                x,
                                y
                            );
                            shopCounters.push(shopCounterId);
                            break;

                        case 'NPC':
                            const npcId = entityInfo.id;
                            if (npcId) {
                                npcs.push({ id: npcId, x, y });
                            } else {
                                console.warn(`NPC at (${x}, ${y}) missing 'id'`);
                            }
                            break;
                            /*
                        case 'Decoration':
                            const decorationId = this.entityManager.createEntity(`decoration_${tier}_${x}_${y}`);
                            this.entityManager.addComponentToEntity(decorationId, new PositionComponent(pixelX, pixelY));
                            this.entityManager.addComponentToEntity(decorationId, new VisualsComponent(visualWidth, visualHeight));
                            this.entityManager.addComponentToEntity(decorationId, new HitboxComponent(visualWidth, visualHeight));
                            const visuals = this.entityManager.getEntity(decorationId).getComponent('Visuals');
                            visuals.avatar = entityInfo.image || 'img/decorations/default.png';
                            break;
                           */
                        default:
                            
                            console.warn(`Unknown entity type '${entityInfo.type}' at (${x}, ${y})`);
                            break;
                    }
                }
            }
        }

        // Create level data
        const levelData = {
            map,
            walls,
            floors,
            stairs,
            npcs,
            shopCounters,
            portals,
            treasures,
            stairsDown,
            stairsUp,
            roomEntityIds,
            isCustomLevel: true
        };

        // Add components to level entity
        const mapComp = new MapComponent(levelData);
        this.entityManager.addComponentToEntity(levelEntity.id, mapComp);

        const entityList = new EntityListComponent({
            walls,
            floors,
            stairs,
            portals,
            fountains,
            treasures,
            npcs,
            shopCounters,
            rooms: roomEntityIds
        });
        this.entityManager.addComponentToEntity(levelEntity.id, entityList);
        this.entityManager.addComponentToEntity(levelEntity.id, new ExplorationComponent());
        this.entityManager.addComponentToEntity(levelEntity.id, new SpatialBucketsComponent());

        // Spawn NPCs if defined in StaticEntities
        if (npcs.length > 0) {
            this.eventBus.emit('SpawnNPCs', {
                tier: 0,
                npcs
            });
        }

        return levelData;
    }
    
    spawnRandomMonsters() {
        const hasElites = tier > 1;
        this.eventBus.emit('SpawnMonsters', {
            tier,
            rooms: levelData.roomEntityIds,
            hasBossRoom,
            spawnPool: { randomMonsters: true, uniqueMonsters: hasElites }
        });
    }
}



