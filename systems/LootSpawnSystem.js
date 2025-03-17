// systems/LootSpawnSystem.js
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
        this.eventBus.on('DropTreasure', (data) => this.dropTreasure(data));
        this.eventBus.on('DiscardItem', (data) => this.spawnLootEntity(data));
    }

    spawnLootEntity({ treasure, tier }) {

        console.log('LootSpawnSystem: Spawning loot entity with treasure:', treasure, 'tier:', tier);

        const levelEntity = this.entityManager.getEntitiesWith(['Map', 'Tier']).find(e => e.getComponent('Tier').value === tier);
        if (!levelEntity) {
            console.error(`LootSpawnSystem: No level entity found for tier ${tier}`);
            return;
        }

        const map = levelEntity.getComponent('Map').map;
        const entityList = levelEntity.getComponent('EntityList');
        const lootEntity = this.entityManager.createEntity(`loot_${tier}_${Date.now()}_${entityList.treasures.length}`);

        this.entityManager.addComponentToEntity(lootEntity.id, new PositionComponent(treasure.x, treasure.y));
        this.entityManager.addComponentToEntity(lootEntity.id, new LootData({
            name: treasure.name || "Loot Pile",
            gold: treasure.gold || 0,
            torches: treasure.torches || 0,
            healPotions: treasure.healPotions || 0,
            items: treasure.items || [],
            suppressRender: treasure.suppressRender || false
        }));

        map[treasure.y][treasure.x] = '$';
        console.log(`LootSpawnSystem: Set map[${treasure.y}][${treasure.x}] to '$', actual value: ${map[treasure.y][treasure.x]}`);
        entityList.treasures.push(lootEntity.id);
        this.eventBus.emit('LootEntityCreated', { entityId: lootEntity.id, tier }); // Emit event with entity ID

        if (!treasure.suppressRender) {
            this.eventBus.emit('RenderNeeded');
        }
    }

    dropTreasure({ entityId }) {
        const sourceEntity = this.entityManager.getEntity(entityId);
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        if (!sourceEntity) return;

        const sourcePos = sourceEntity.getComponent('Position');
        const loot = {
            x: sourcePos.x,
            y: sourcePos.y,
            name: `${sourceEntity.name || 'Unknown'} Loot`,
            gold: this.calculateGoldGain(),
            torches: this.calculateTorchDrop() ? 1 : 0,
            healPotions: this.calculatePotionDrop() ? 1 : 0,
            items: this.generateDropItems(sourceEntity)
        };

        this.spawnLootEntity({ loot, tier: gameState.tier });
        this.eventBus.emit('LogMessage', { message: `${sourceEntity.name} dropped ${loot.gold} gold${loot.torches ? ' and a torch' : ''}${loot.items.length ? ` and ${loot.items.map(i => i.name).join(', ')}` : ''}!` });
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
        return [{
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
        }];
    }
}