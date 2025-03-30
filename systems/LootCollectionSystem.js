// systems/LootCollectionSystem.js
import { System } from '../core/Systems.js';

export class LootCollectionSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Position', 'TreasureData'];
    }

    init() {
        this.eventBus.on('PickupTreasure', (data) => this.collectLoot(data));
    }

    // systems/LootCollectionSystem.js - Updated collectLoot method
    collectLoot({ x, y }) {
        const player = this.entityManager.getEntity('player');
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const levelEntity = this.entityManager.getEntitiesWith(['Map', 'Tier']).find(e => e.getComponent('Tier').value === gameState.tier);
        if (!player || !levelEntity) {
            console.error('LootCollectionSystem: Player or levelEntity is null');
            return;
        }

        const entityList = levelEntity.getComponent('EntityList');
        console.log('LootCollectionSystem: Checking treasures at (x, y):', x, y, 'with entityList.treasures:', entityList.treasures);
        const lootIndex = entityList.treasures.findIndex(tId => {
            const t = this.entityManager.getEntity(tId);
            if (!t) {
                console.error('LootCollectionSystem: Entity not found for ID:', tId);
                return false;
            }
            const pos = t.getComponent('Position');
            if (!pos) {
                console.error('LootCollectionSystem: Position component not found for entity ID:', tId);
                return false;
            }
            console.log('LootCollectionSystem: Checking entity ID:', tId, 'at position:', pos.x, pos.y);
            return pos.x === x && pos.y === y;
        });

        if (lootIndex === -1) {
            console.log('LootCollectionSystem: No loot found at (', x, ',', y, ')');
            return;
        }

        const lootEntity = this.entityManager.getEntity(entityList.treasures[lootIndex]);
        if (!lootEntity) {
            console.error('LootCollectionSystem: Failed to retrieve loot entity at index:', lootIndex);
            return;
        }
        const lootData = lootEntity.getComponent('LootData');
        const playerInventory = player.getComponent('Inventory');
        const playerResource = player.getComponent('Resource');

        let pickupMessage = [];
        if (lootData.gold) {
            playerResource.gold += lootData.gold;
            pickupMessage.push(`${lootData.gold} gold`);
        }
        if (lootData.torches) {
            playerResource.torches += lootData.torches;
            pickupMessage.push(`${lootData.torches} torch${lootData.torches > 1 ? 'es' : ''}`);
        }
        if (lootData.healPotions) {
            playerResource.healPotions += lootData.healPotions;
            pickupMessage.push(`${lootData.healPotions} heal potion${lootData.healPotions > 1 ? 's' : ''}`);
        }
        if (lootData.items && lootData.items.length) {
            lootData.items.forEach(item => {
                playerInventory.items.push(item);
                pickupMessage.push(item.name);
            });
        }

        if (pickupMessage.length) {
            this.eventBus.emit('LogMessage', { message: `Found ${pickupMessage.join(', ')} from ${lootData.name}!` });
        }

        entityList.treasures.splice(lootIndex, 1);
        this.entityManager.removeEntity(lootEntity.id);
        this.eventBus.emit('RenderNeeded');
        this.eventBus.emit('StatsUpdated', { entityId: 'player' });
        const sfx = 'loot0';
        this.eventBus.emit('PlaySfx', { sfx, volume: .7 }); 

        if (playerResource.gold >= 1e12) {
            gameState.isVictory = true;
            this.eventBus.emit('GameOver', { message: "You amassed a trillion gold! Victory!" });
        }
    }

}