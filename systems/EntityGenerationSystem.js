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

export class EntityGenerationSystem extends System {

    constructor(entityManager, eventBus, state) {
        super(entityManager, eventBus);
        this.state = state;
        this.TILE_SIZE = this.state.TILE_SIZE || 32;
        
    }


    generateStairEntity(levelData, entityList, tier, direction, x, y, returnEntity = false) {
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState')
        const map = levelData.map;
        const lockedLevels = [6, 11];
        let active = true;
        if (direction === 'down' && lockedLevels.includes(tier) && gameState.highestTier <= tier) {
            active = false;
        }
        const stairId = `stair_${tier}_stair_${direction}_${x}_${y}`
        const stairEntity = this.entityManager.createEntity(stairId);
        this.entityManager.addComponentToEntity(stairEntity.id, new PositionComponent(x * this.TILE_SIZE, y * this.TILE_SIZE));
        this.entityManager.addComponentToEntity(stairEntity.id, new StairComponent(direction, active));
        this.entityManager.addComponentToEntity(stairEntity.id, new VisualsComponent(32, 42));
        this.entityManager.addComponentToEntity(stairEntity.id, new HitboxComponent(28, 38));
        const visuals = stairEntity.getComponent('Visuals');
        visuals.avatar = `img/avatars/stairs${direction}.png`;
        entityList.stairs.push(stairEntity.id);
        const stairChar = direction === 'down' ? '⇓' : '⇑';
        map[y][x] = stairChar;
        if (direction === 'down') { levelData.stairsDown = { x, y }; } else { levelData.stairsUp = { x, y } }
        console.log(`LevelSystem.js: Placed stairs ${direction} at (${x}, ${y}) on tier ${tier}`, stairEntity);

        if (returnEntity) return stairEntity;
    }

    generatePortal(entityList, tier, mapComp, x, y, active = true) {
        const portalEntity = this.entityManager.createEntity(`portal_${tier}_portal_${entityList.portals.length}`);
        this.entityManager.addComponentToEntity(portalEntity.id, new PositionComponent(x * this.TILE_SIZE, y * this.TILE_SIZE));
        this.entityManager.addComponentToEntity(portalEntity.id, new PortalComponent());
        const portalComp = portalEntity.getComponent('Portal');
        if (tier < 7) active = false; // Disable portal for tiers below 7
        portalComp.active = active;
        

        this.entityManager.addComponentToEntity(portalEntity.id, new VisualsComponent(128, 128));
        this.entityManager.addComponentToEntity(portalEntity.id, new HitboxComponent(90, 90));
        const visuals = portalEntity.getComponent('Visuals');
        visuals.avatar = portalComp.active ? 'img/anim/Portal-Animation.png' : 'img/avatars/inactive-portal.png';
        entityList.portals.push(portalEntity.id);
        mapComp.map[y][x] = '?';
        this.eventBus.emit('PortalAdded');

        console.log(`LevelSystem - PORTAL - Portal Entity Created on tier: ${tier} at x:${x}, y:${y}`, portalEntity);
        return portalEntity;
    }

    generateFountains(tier, map, roomEntityIds) {
        console.log(`LevelSystem.js: generateFountains - Starting for tier ${tier}`);
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
                this.entityManager.addComponentToEntity(fountainEntity.id, new PositionComponent(x * this.TILE_SIZE, y * this.TILE_SIZE));
                this.entityManager.addComponentToEntity(fountainEntity.id, new FountainComponent(false, false));
                this.entityManager.addComponentToEntity(fountainEntity.id, new VisualsComponent(this.TILE_SIZE, this.TILE_SIZE));
                this.entityManager.addComponentToEntity(fountainEntity.id, new HitboxComponent(this.TILE_SIZE, this.TILE_SIZE));
                const visuals = fountainEntity.getComponent('Visuals');
                visuals.avatar = 'img/avatars/fountain.png';
                fountains.push(fountainEntity.id);
                map[y][x] = '≅';
            }
        }
        console.log(`LevelSystem.js: generateFountains - Completed for tier ${tier}`);
        return fountains;
    }

    generateLootEntities(tier, map, roomEntityIds) {
        console.log(`LevelSystem.js: generateLootEntities - Starting for tier ${tier}`);
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
            let tileX, tileY;
            let attempts = 0;
            do {
                tileX = room.left + 1 + Math.floor(Math.random() * (room.width - 2));
                tileY = room.top + 1 + Math.floor(Math.random() * (room.height - 2));
                attempts++;
                if (attempts > 50) {
                    console.error(`Failed to place loot entity in room after 50 attempts`);
                    break;
                }
            } while (map[tileY][tileX] !== ' ');

            if (attempts <= 50) {
                const pixelX = tileX * this.TILE_SIZE;
                const pixelY = tileY * this.TILE_SIZE;
                const lootSource = this.entityManager.createEntity(`loot_source_${tier}_${Date.now()}_${i}`);
                this.entityManager.addComponentToEntity(lootSource.id, new LootSourceData({
                    sourceType: "container",
                    name: "Treasure Chest",
                    tier: tier,
                    position: { x: pixelX, y: pixelY },
                    sourceDetails: { id: roomId },
                    chanceModifiers: {
                        torches: 1,
                        healPotions: 1,
                        gold: 1.5,
                        item: 0.25,
                        uniqueItem: 0.8
                    },
                    maxItems: 1,
                    items: [],
                }));

                console.log(`LevelSystem: Generated loot source at pixel (${pixelX}, ${pixelY}) for tile (${tileX}, ${tileY}) on tier ${tier}`);
                this.eventBus.emit('DropLoot', { lootSource });
            }
        }

        this.eventBus.off('LootEntityCreated', collectEntityId);
        console.log(`Generated ${lootPerLevel} loot entity IDs for tier ${tier}`, lootEntityIds);
        console.log(`LevelSystem.js: generateLootEntities - Completed for tier ${tier}`);
        return lootEntityIds;
    }

}