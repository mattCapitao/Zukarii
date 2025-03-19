import { System } from '../core/Systems.js';
import { PositionComponent, LootData } from '../core/Components.js';

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

    spawnLootEntity({ treasure, tier }) {
        console.log('LootSpawnSystem: Spawning loot entity with treasure:', treasure, 'tier:', tier);

        // treasure is now an Entity from LootManagerSystem
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

        const map = levelEntity.getComponent('Map').map;
        const entityList = levelEntity.getComponent('EntityList');

        // Use the existing entity instead of creating a new one
        const lootEntity = treasure; // Already created by LootManagerSystem
        map[position.y][position.x] = '$';
        console.log(`LootSpawnSystem: Set map[${position.y}][${position.x}] to '$', actual value: ${map[position.y][position.x]}`);
        entityList.treasures.push(lootEntity.id);
        this.eventBus.emit('LootEntityCreated', { entityId: lootEntity.id, tier });

        if (!lootData.suppressRender) {
            this.eventBus.emit('RenderNeeded');
        }
    }

    // Remove generateMonsterLoot and related methods since they're now in LootManagerSystem
}