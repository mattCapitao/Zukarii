﻿import { System } from '../core/Systems.js';
import { PositionComponent, VisualsComponent, NeedsRenderComponent, HitboxComponent } from '../core/Components.js';

export class LootSpawnSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Position', 'TreasureData']; // For loot entities
    }

    init() {
        console.log('LootSpawnSystem: Initializing with EventBus:', this.eventBus);
        this.eventBus.on('PlaceTreasure', (data) => {
            console.log('LootSpawnSystem: Received PlaceTreasure event with raw data:', data);
            if (data && data.treasure && data.tier !== undefined) {
                console.log('LootSpawnSystem: Processed data - treasure:', data.treasure, 'tier:', data.tier);
                this.spawnLootEntity({ treasure: data.treasure, tier: data.tier });
            } else {
                console.error('LootSpawnSystem: Invalid data structure:', data);
            }
        });
        this.eventBus.on('SpawnLoot', (data) => {
            console.log('LootSpawnSystem: Received SpawnLoot event with raw data:', data);
            this.spawnLootEntity(data);
        });
        this.eventBus.on('DiscardItem', (data) => this.spawnLootEntity(data));
    }

    // systems/LootSpawnSystem.js - Updated spawnLootEntity method
    spawnLootEntity({ treasure, tier }) {
        console.log('LootSpawnSystem: Spawning loot entity with treasure:', treasure, 'tier:', tier);

        const position = treasure.getComponent('Position');
        const lootData = treasure.getComponent('LootData');
        if (!position || !lootData) {
            console.error('LootSpawnSystem: Missing Position or LootData components on treasure entity:', treasure);
            return;
        }

        const levelEntity = this.entityManager.getEntitiesWith(['Map', 'Tier']).find(e => e.getComponent('Tier').value === tier);
        if (!levelEntity) {
            console.error(`LootSpawnSystem: No level entity found for tier ${tier}`);
            return;
        }

        const entityList = levelEntity.getComponent('EntityList');

        const lootEntity = treasure;
        entityList.treasures.push(lootEntity.id);

        lootEntity.addComponent(new PositionComponent(position.x, position.y));
        lootEntity.addComponent(new VisualsComponent(24, 30));
        const lootVisuals = lootEntity.getComponent('Visuals');
        lootVisuals.avatar = 'img/avatars/chest.png';
        lootEntity.addComponent(new HitboxComponent(24, 30));

        this.eventBus.emit('LootEntityCreated', { entityId: lootEntity.id, tier });
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        if (!lootData.suppressRender && gameState) {
            lootEntity.addComponent(new NeedsRenderComponent());
        }
    }
}