
// systems/CustomLevelSystem.js
// Manages loading and parsing custom level JSON files

import { System } from '../core/Systems.js';
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
    }

    init() {
        this.eventBus.on('LoadCustomLevel', ({ tier, levelEntity }) => this.loadCustomLevel(tier, levelEntity));
    }

    async loadCustomLevel(tier, levelEntity) {

      
        console.log(`CustomLevelSystem: Loading custom level for tier ${tier}`);
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

        const mapTileLayer = jsonData.layers.find(layer => layer.name === 'Map');
        if (!mapTileLayer) {
            throw new Error('No map tile layer found in JSON');
        }

        const data = mapTileLayer.data;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const tileId = data[y * width + x];
                const pixelX = x * this.TILE_SIZE;
                const pixelY = y * this.TILE_SIZE;

                if (tileId === 1) { // entityType: wall
                    map[y][x] = '#';
                    const wallId = `wall_${tier}_wall_${y}_${x}`;
                    const wallEntity = this.entityManager.createEntity(wallId);
                    this.entityManager.addComponentToEntity(wallId, new PositionComponent(pixelX, pixelY));
                    this.entityManager.addComponentToEntity(wallId, new WallComponent());
                    this.entityManager.addComponentToEntity(wallId, new VisualsComponent(this.TILE_SIZE, this.TILE_SIZE));
                    this.entityManager.addComponentToEntity(wallId, new HitboxComponent(this.TILE_SIZE, this.TILE_SIZE));
                    const visuals = wallEntity.getComponent('Visuals');
                    visuals.avatar = 'img/map/wall.png';
                    walls.push(wallId);
                } else if (tileId === 2) { // entityType: floor
                    map[y][x] = ' ';
                    const floorId = `floor_${tier}_floor_${y}_${x}`;
                    const floorEntity = this.entityManager.createEntity(floorId);
                    this.entityManager.addComponentToEntity(floorId, new PositionComponent(pixelX, pixelY));
                    this.entityManager.addComponentToEntity(floorId, new FloorComponent());
                    floors.push(floorId);
                } else { // tileId === 0 (empty), treat as wall
                    map[y][x] = '#';
                    const wallId = `wall_${tier}_wall_${y}_${x}`;
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

        // Hardcode special entities
        const stairPos = { upX: 23, upY: 19, downX: 23, downY: 29 };
        const portalPos = { x: 28, y: 18 };
        const shopCounterPos = { x: 27, y: 28 };
        const roomEntityId = `room_${tier}_surface`;
        const roomEntity = this.entityManager.createEntity(roomEntityId);
        this.entityManager.addComponentToEntity(roomEntityId, new RoomComponent({
            left: 21,
            top: 21,
            width: 19,
            height: 9,
            type: 'SurfaceRoom',
            centerX: 1 + Math.floor(19 / 2),
            centerY: 1 + Math.floor(9 / 2),
            connections: []
        }));
        const roomEntityIds = [roomEntity.id];

        // Create level data
        const levelData = {
            map,
            walls,
            floors,
            stairs,
            npcs,
            shopCounters,
            portals,
            stairsDown: { x: stairPos.downX, y: stairPos.downY },
            stairsUp: { x: stairPos.upX, y: stairPos.upY },
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
            npcs,
            shopCounters,
            rooms: roomEntityIds
        });
        this.entityManager.addComponentToEntity(levelEntity.id, entityList);
        this.entityManager.addComponentToEntity(levelEntity.id, new ExplorationComponent());
        this.entityManager.addComponentToEntity(levelEntity.id, new SpatialBucketsComponent());

        // Generate special entities
        this.entityGenerationSystem.generateStairEntity(levelData, entityList, tier, roomEntityId, 'up', stairPos.upX, stairPos.upY, true);
        this.entityGenerationSystem.generateStairEntity(levelData, entityList, tier, roomEntityId, 'down', stairPos.downX, stairPos.downY, true);
        this.entityGenerationSystem.generatePortal(entityList, tier, mapComp, portalPos.x, portalPos.y);
        this.entityGenerationSystem.generateShopCounter(entityList, tier, mapComp, shopCounterPos.x, shopCounterPos.y);

        this.eventBus.emit('SpawnNPCs', {
            tier: 0,
            npcs: [
                { id: 'sehnrhyx_syliri', x: 28, y: 23 },
                { id: 'shop_keeper', x: 28, y: 28 }
            ]
        });

        return levelData;
    }
}
