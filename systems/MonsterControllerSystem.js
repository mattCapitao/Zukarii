// systems/MonsterControllerSystem.js
import { System } from '../core/Systems.js';
import { LootSourceData, MovementIntentComponent, RemoveEntityComponent } from '../core/Components.js';

export class MonsterControllerSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Position', 'Health', 'MonsterData'];
    }

    init() {

    }
    update(deltaTime) {
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        if (gameState?.gameOver) return;

        const player = this.entityManager.getEntity('player');
        if (!player || player.getComponent('PlayerState').dead || player.hasComponent('Dead')) return;

        const tier = this.entityManager.getEntity('gameState').getComponent('GameState').tier;
        const levelEntity = this.entityManager.getEntitiesWith(['Map', 'Tier']).find(e => e.getComponent('Tier').value === tier);
        if (!levelEntity) return;

        const AGGRO_RANGE = 4 * 32; // 4 tiles in pixels (32 pixels per tile)
        const MELEE_RANGE = 40; // Pixel distance to trigger melee attack
        const TILE_SIZE = 32;

        const monsters = this.entityManager.getEntitiesWith(this.requiredComponents);

        const now = Date.now();

        monsters.forEach(monster => {
            const health = monster.getComponent('Health');
            const hpBarWidth = Math.floor((health.hp / health.maxHp) * (TILE_SIZE / 2));
            const monsterData = monster.getComponent('MonsterData');
            monsterData.hpBarWidth = hpBarWidth;

            const dead = monster.getComponent('Dead');
            if (dead) {
                if (dead.state === 'new') {
                    this.handleMonsterDeath(monster.id);
                    dead.state = 'handling';
                }
                if ((dead.expiresAt < now && dead.state === 'processed') || dead.expiresAt + 2000 < now) {
                    if (!monster.hasComponent('RemoveEntity')) {
                        monster.addComponent(new RemoveEntityComponent());
                    }
                }
                return;
            }

            const pos = monster.getComponent('Position');
            const attackSpeed = monster.getComponent('AttackSpeed');
            const movementSpeed = monster.getComponent('MovementSpeed');
            const playerPos = player.getComponent('Position');
            const dx = playerPos.x - pos.x;
            const dy = playerPos.y - pos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Accumulate time for attacks (deltaTime in seconds, convert to ms)
            attackSpeed.elapsedSinceLastAttack += deltaTime * 1000;

            if (distance <= AGGRO_RANGE + (2 * TILE_SIZE)) { monsterData.isDetected = true; }

            if (distance <= AGGRO_RANGE) { monsterData.isAggro = true; }

            if (distance > AGGRO_RANGE * 2 ) { monsterData.isAggro = false; }

            if (monsterData.isAggro) {
                if (distance <= MELEE_RANGE) {
                    if (attackSpeed.elapsedSinceLastAttack >= attackSpeed.attackSpeed) {
                        this.eventBus.emit('MonsterAttack', { entityId: monster.id });
                        attackSpeed.elapsedSinceLastAttack = 0;
                        console.log(`MonsterControllerSystem: ${monsterData.name} attacked player at distance ${distance.toFixed(2)} pixels`);
                    }
                    return; // Stop moving if in melee range
                }

                // Smooth movement toward the player using MovementIntent (allow diagonal movement)
                const speed = movementSpeed.movementSpeed; // Pixels per second (e.g., 100)
                const moveDistance = speed * deltaTime; // Distance to move this frame

                // Move directly toward the player (diagonal movement allowed)
                const magnitude = Math.sqrt(dx * dx + dy * dy);
                if (magnitude > 0) {
                    const moveX = (dx / magnitude) * moveDistance;
                    const moveY = (dy / magnitude) * moveDistance;

                    const newX = pos.x + moveX;
                    const newY = pos.y + moveY;

                    const lastX = monster.getComponent('LastPosition').x;

                    // Set facing direction
                    if ( dx <= 0) { monster.getComponent('Visuals').faceLeft = true; }
                    if ( dx > 0) { monster.getComponent('Visuals').faceLeft = false; }

                    // Set MovementIntent for collision detection and resolution
                    this.entityManager.addComponentToEntity(monster.id, new MovementIntentComponent(newX, newY));
                    console.log(`MonsterControllerSystem: ${monsterData.name} intends to move to (${newX.toFixed(2)}, ${newY.toFixed(2)}), distance to player: ${distance.toFixed(2)} pixels`);
                }
            }
        });
    }

    handleMonsterDeath(entityId) {
        const monster = this.entityManager.getEntity(entityId);
        const player = this.entityManager.getEntity('player');
        if (!monster || !player) return;

        const monsterData = monster.getComponent('MonsterData');
        const health = monster.getComponent('Health');
        health.hp = 0;
        monsterData.isAggro = false;

        const tier = this.entityManager.getEntity('gameState').getComponent('GameState').tier;
        const baseXp = Math.round((health.maxHp / 3 + (monsterData.minBaseDamage + monsterData.maxBaseDamage * 1.5)) * (1 + tier * 0.1));
        console.log(`MonsterControllerSystem: Monster defeated: ${monsterData.name}, XP calc - maxHp: ${health.maxHp}, minDmg: ${monsterData.minBaseDamage}, maxDmg: ${monsterData.maxBaseDamage}, tier: ${tier}, baseXp: ${baseXp}`);
        this.eventBus.emit('LogMessage', { message: `${monsterData.name} defeated!` });
        this.eventBus.emit('AwardXp', { amount: baseXp });

        const lootSource = this.entityManager.createEntity(`loot_source_${monsterData.tier}_${Date.now()}`);
        // Validate and process uniqueItemsDropped
        const items = Array.isArray(monsterData.uniqueItemsDropped)
            ? monsterData.uniqueItemsDropped.filter(item => {
                if (!item || typeof item !== 'object' || !item.type || !item.data) {
                    console.warn(`MonsterControllerSystem: Invalid uniqueItemsDropped entry for ${monsterData.name}:`, item);
                    return false;
                }
                // Only require data.name for customUnique type
                if (item.type === 'customUnique' && typeof item.data.name !== 'string') {
                    console.warn(`MonsterControllerSystem: Invalid customUnique entry for ${monsterData.name} (missing or invalid name):`, item);
                    return false;
                }
                return true;
            })
            : [];
        this.entityManager.addComponentToEntity(lootSource.id, new LootSourceData({
            sourceType: "monster",
            name: monsterData.name,
            tier: monsterData.tier,
            position: monster.getComponent('Position'),
            sourceDetails: { id: monster.id },
            chanceModifiers: {
                torches: 1,
                healPotions: 1,
                gold: 1,
                item: 1,
                uniqueItem: 1
            },
            maxItems: items.length > 0 ? items.length : 1, // Use number of valid drops, default to 1
            items: items
        }));
        console.log(`MonsterControllerSystem: Emitting DropLoot for ${monsterData.name} with items:`, items);
        this.eventBus.emit('DropLoot', { lootSource });
    }

    // systems/MonsterControllerSystem.js - New isWalkable method
    isWalkable(x, y) {
        const entitiesAtTarget = this.entityManager.getEntitiesWith(['Position']).filter(e => {
            const ePos = e.getComponent('Position');
            return ePos.x === x && ePos.y === y;
        });
        const isBlocked = entitiesAtTarget.some(e =>
            e.hasComponent('Wall') ||
            e.hasComponent('Stair') ||
            e.hasComponent('Portal') ||
            e.hasComponent('Fountain')
        );
        const hasFloor = entitiesAtTarget.some(e => e.hasComponent('Floor'));
        return !isBlocked && hasFloor;
    }
}