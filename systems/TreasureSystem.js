// systems/TreasureSystem.js
// Manages treasure placement, pickup, and drops

import { System } from '../core/Systems.js';

export class TreasureSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Position', 'TreasureData']; // For treasure entities
    }

    init() {
        this.eventBus.on('PlaceTreasure', (data) => this.placeTreasure(data));
        this.eventBus.on('PickupTreasure', (data) => this.pickupTreasure(data));
        this.eventBus.on('DropTreasure', (data) => this.dropTreasure(data));
    }

    placeTreasure({ treasure, tier }) {
        const levelEntity = this.entityManager.getEntitiesWith(['Map', 'Tier']).find(e => e.getComponent('Tier').value === tier);
        if (!levelEntity) return;

        const map = levelEntity.getComponent('Map').map;
        const entityList = levelEntity.getComponent('EntityList');
        const treasureEntity = this.entityManager.createEntity(`treasure_${tier}_${entityList.treasures.length}`);

        this.entityManager.addComponentToEntity(treasureEntity.id, new PositionComponent(treasure.x, treasure.y));
        this.entityManager.addComponentToEntity(treasureEntity.id, {
            type: 'TreasureData',
            name: treasure.name || "Treasure Chest",
            gold: treasure.gold || 0,
            torches: treasure.torches || 0,
            healPotions: treasure.healPotions || 0,
            items: treasure.items || [],
            suppressRender: treasure.suppressRender || false
        });

        map[treasure.y][treasure.x] = '$';
        entityList.treasures.push(treasureEntity.id);

        if (!treasure.suppressRender) {
            this.eventBus.emit('RenderNeeded');
        }
    }

    pickupTreasure({ x, y }) {
        const player = this.entityManager.getEntity('player');
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const levelEntity = this.entityManager.getEntitiesWith(['Map', 'Tier']).find(e => e.getComponent('Tier').value === gameState.tier);
        if (!player || !levelEntity) return;

        const entityList = levelEntity.getComponent('EntityList');
        const treasureIndex = entityList.treasures.findIndex(tId => {
            const t = this.entityManager.getEntity(tId);
            const pos = t.getComponent('Position');
            return pos.x === x && pos.y === y;
        });

        if (treasureIndex === -1) return;

        const treasureEntity = this.entityManager.getEntity(entityList.treasures[treasureIndex]);
        const treasureData = treasureEntity.getComponent('TreasureData');
        const playerInventory = player.getComponent('Inventory');
        const playerResource = player.getComponent('Resource');

        let pickupMessage = [];
        if (treasureData.gold) {
            playerResource.gold += treasureData.gold;
            pickupMessage.push(`${treasureData.gold} gold`);
        }
        if (treasureData.torches) {
            playerResource.torches += treasureData.torches;
            pickupMessage.push(`${treasureData.torches} torch${treasureData.torches > 1 ? 'es' : ''}`);
        }
        if (treasureData.healPotions) {
            playerResource.healPotions += treasureData.healPotions;
            pickupMessage.push(`${treasureData.healPotions} heal potion${treasureData.healPotions > 1 ? 's' : ''}`);
        }
        if (treasureData.items && treasureData.items.length) {
            treasureData.items.forEach(item => {
                playerInventory.items.push(item);
                pickupMessage.push(item.name);
            });
        }

        if (pickupMessage.length) {
            this.eventBus.emit('LogMessage', { message: `Found ${pickupMessage.join(', ')} from ${treasureData.name}!` });
        }

        entityList.treasures.splice(treasureIndex, 1);
        this.entityManager.removeEntity(treasureEntity.id);
        levelEntity.getComponent('Map').map[y][x] = ' ';
        this.eventBus.emit('RenderNeeded');
        this.eventBus.emit('StatsUpdated', { entityId: 'player' });

        if (playerResource.gold >= 1e12) {
            gameState.isVictory = true;
            this.eventBus.emit('GameOver', { message: "You amassed a trillion gold! Victory!" });
        }
    }

    dropTreasure({ entityId }) {
        const sourceEntity = this.entityManager.getEntity(entityId);
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        if (!sourceEntity) return;

        const sourcePos = sourceEntity.getComponent('Position');
        const treasure = {
            x: sourcePos.x,
            y: sourcePos.y,
            name: `${sourceEntity.name || 'Unknown'} Treasure`,
            gold: this.calculateGoldGain(),
            torches: this.calculateTorchDrop() ? 1 : 0,
            healPotions: this.calculatePotionDrop() ? 1 : 0,
            items: this.generateDropItems(sourceEntity)
        };

        this.placeTreasure({ treasure, tier: gameState.tier });
        this.eventBus.emit('LogMessage', { message: `${sourceEntity.name} dropped ${treasure.gold} gold${treasure.torches ? ' and a torch' : ''}${treasure.items.length ? ` and ${treasure.items.map(i => i.name).join(', ')}` : ''}!` });
    }

    calculateGoldGain() {
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        return Math.random() < 0.85 ? 10 + Math.floor(Math.random() * 41) + (gameState.tier * 10) : 0;
    }

    calculateTorchDrop() {
        const playerResource = this.entityManager.getEntity('player').getComponent('Resource');
        const playerState = this.entityManager.getEntity('player').getComponent('PlayerState');
        let torchChance;

        if (playerResource.torches === 0 && !playerState.torchLit) {
            torchChance = 0.20;
            playerResource.torchDropFail = (playerResource.torchDropFail || 0) + 1;
            if (playerResource.torchDropFail >= 3) {
                playerResource.torches = 1;
                playerResource.torchDropFail = 0;
                this.eventBus.emit('LogMessage', { message: 'You found a discarded torch lying on the ground!' });
                return true;
            }
        } else if (playerResource.torches < 2) {
            torchChance = 0.125;
        } else if (playerResource.torches <= 5) {
            torchChance = 0.075;
        } else {
            torchChance = 0.025;
        }
        return Math.random() < torchChance;
    }

    calculatePotionDrop() {
        const playerResource = this.entityManager.getEntity('player').getComponent('Resource');
        const playerHealth = this.entityManager.getEntity('player').getComponent('Health');
        let chance = playerResource.healPotions === 0 ? 0.5 : playerResource.healPotions < 3 ? 0.30 : playerResource.healPotions < 5 ? 0.125 : 0.05;
        chance += playerHealth.hp / playerHealth.maxHp < 0.5 ? 0.1 : playerHealth.hp / playerHealth.maxHp < 0.25 ? 0.2 : playerHealth.hp / playerHealth.maxHp < 0.1 ? 0.3 : 0;
        return Math.random() < chance;
    }

    generateDropItems(sourceEntity) {
        const items = [];
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');

        if (sourceEntity.getComponent('MonsterData')?.uniqueItemsDropped?.length) {
            const uniqueItem = sourceEntity.getComponent('MonsterData').uniqueItemsDropped[0];
            uniqueItem.uniqueId = this.entityManager.getEntity('state').utilities.generateUniqueId();
            items.push(uniqueItem);
        } else if (Math.random() < 0.3) { // Simplified chance from Items.js
            const tierIndex = Math.floor(Math.random() * 3); // Junk to rare for now
            this.eventBus.emit('GenerateItem', { tierIndex, callback: (item) => items.push(item) });
        }

        return items;
    }
}