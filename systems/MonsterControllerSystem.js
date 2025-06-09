// systems/MonsterControllerSystem.js
import { System } from '../core/Systems.js';
import { LootSourceData, MovementIntentComponent, RemoveEntityComponent } from '../core/Components.js';

export class MonsterControllerSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Position', 'Health', 'MonsterData'];
        this.utilities = utilities;
        this.utilities.entityManager = this.entityManager; // Ensure utilities have access to the entity manager
    }

    init() {
        this.TILE_SIZE = this.utilities.TILE_SIZE
        this.AGGRO_RANGE = 4 * this.TILE_SIZE; // 4 tiles in pixels (32 pixels per tile)
        this.MELEE_RANGE = 1.5 * this.TILE_SIZE; // Pixel distance to trigger melee attack
        this.MONSTER_WANDER_CHANCE = .5;
    }
    update(deltaTime) {
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        if (gameState?.gameOver) return;

        const player = this.entityManager.getEntity('player');
        if (!player || player.getComponent('PlayerState').dead || player.hasComponent('Dead')) return;

        const tier = this.entityManager.getEntity('gameState').getComponent('GameState').tier;
        const levelEntity = this.entityManager.getEntitiesWith(['Map', 'Tier']).find(e => e.getComponent('Tier').value === tier);
        if (!levelEntity) return;

        const monsters = this.entityManager.getEntitiesWith(this.requiredComponents);

        const now = Date.now();

        monsters.forEach(monster => {
            const health = monster.getComponent('Health');
            const hpBarWidth = Math.floor((health.hp / health.maxHp) * (this.TILE_SIZE / 2));
            const monsterData = monster.getComponent('MonsterData');
            monsterData.hpBarWidth = hpBarWidth;

            const dead = monster.getComponent('Dead');
            if (dead) {
                if (dead.state === 'new') {
                    this.handleMonsterDeath(monster.id);
                    dead.state = 'handling';
                }
                if ((dead.expiresAt < now && dead.state === 'processed') || dead.expiresAt + 200 < now) {
                    if (!monster.hasComponent('RemoveEntity')) {
                        monster.addComponent(new RemoveEntityComponent());
                    }
                }
                return;
            }

            const isInCombat = monster.getComponent('InCombat');

            const pos = monster.getComponent('Position');
            const attackSpeed = monster.getComponent('AttackSpeed');
            // const movementSpeed = monster.getComponent('MovementSpeed'); // No longer needed
            const playerPos = player.getComponent('Position');
            const dx = playerPos.x - pos.x;
            const dy = playerPos.y - pos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Accumulate time for attacks (deltaTime in seconds, convert to ms)
            attackSpeed.elapsedSinceLastAttack += deltaTime * 1000;

            if (distance <= this.AGGRO_RANGE + (2 * this.TILE_SIZE)) { monsterData.isDetected = true; }

            if (distance <= this.AGGRO_RANGE) { monsterData.isAggro = true; }

            if (distance > this.AGGRO_RANGE * 2 && !isInCombat) { monsterData.isAggro = false; }

            if (monsterData.isAggro) {
                if (distance <= this.MELEE_RANGE) {
                    if (attackSpeed.elapsedSinceLastAttack >= attackSpeed.attackSpeed) {
                        this.eventBus.emit('MonsterAttack', { entityId: monster.id });
                        attackSpeed.elapsedSinceLastAttack = 0;
                        ////console.log(`MonsterControllerSystem: ${monsterData.name} attacked player at distance ${distance.toFixed(2)} pixels`);
                    }
                    return; // Stop moving if in melee range
                }

                // Set facing direction
                if (dx <= 0) { monster.getComponent('Visuals').faceLeft = true; }
                if (dx > 0) { monster.getComponent('Visuals').faceLeft = false; }

                // Set MovementIntent for collision detection and resolution
                // Destination is always the player's current position
                this.entityManager.addComponentToEntity(
                    monster.id,
                    new MovementIntentComponent(playerPos.x, playerPos.y)
                );
                ////console.log(`MonsterControllerSystem: ${monsterData.name} intends to move to player at (${playerPos.x}, ${playerPos.y}), distance to player: ${distance.toFixed(2)} pixels`);
            } else {
                if (
                    !monster.hasComponent('MovementIntent') &&
                    !monsterData.isAggro &&
                    !monsterData.isBoss &&
                    Math.random() < this.MONSTER_WANDER_CHANCE / 100
                ) {
                    const { tileX, tileY } = this.utilities.getTileFromPixel(pos.x, pos.y);
                    const startPixel = this.utilities.getPixelFromTile(tileX, tileY);

                    // Validate current position using rounded pixel coordinates
                    if (!this.isWalkable(monster, startPixel.x, startPixel.y)) {
                        console.warn(`MonsterControllerSystem: ${monsterData.name} at pixel (${pos.x}, ${pos.y}) tile (${tileX}, ${tileY}) is not walkable at rounded (${startPixel.x}, ${startPixel.y})`);
                        return;
                    }

                    // Generate random offset (-1, 0, or 1 tile)
                    const offsetX = Math.floor(Math.random() * 3) - 1;
                    const offsetY = Math.floor(Math.random() * 3) - 1;

                    // Skip if no movement
                    if (offsetX === 0 && offsetY === 0) {
                        return;
                    }

                    const wanderTileX = tileX + offsetX;
                    const wanderTileY = tileY + offsetY;
                    const wanderPixel = this.utilities.getPixelFromTile(wanderTileX, wanderTileY);

                    if (this.isWalkable(monster, wanderPixel.x, wanderPixel.y)) {
                        this.entityManager.addComponentToEntity(
                            monster.id,
                            new MovementIntentComponent(wanderPixel.x, wanderPixel.y)
                        );
                        console.log(`MonsterControllerSystem: ${monsterData.name} wandering to pixel (${wanderPixel.x}, ${wanderPixel.y}) tile (${wanderTileX}, ${wanderTileY})`);
                    } else {
                        console.log(`MonsterControllerSystem: ${monsterData.name} wander target pixel (${wanderPixel.x}, ${wanderPixel.y}) tile (${wanderTileX}, ${wanderTileY}) is not walkable`);
                    }
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
        this.eventBus.emit('LogMessage', { message: `${monsterData.name} defeated!` });
        this.eventBus.emit('AwardXp', { amount: baseXp });

        if (monsterData.isBoss) {
            this.utilities.pushPlayerActions('bossKill', { monsterId: monsterData.id, tier });
            //console.log(`MonsterControllerSystem: Boss defeated: ${monsterData.name}, awarding special actions and loot.`);
        } else {
            this.utilities.pushPlayerActions('monsterKill', { monsterId: monsterData.id, tier });
            //console.log(`MonsterControllerSystem: Monster defeated: ${monsterData.name}, awarding actions and loot.`);
        }

        const lootSource = this.entityManager.createEntity(`loot_source_${monsterData.tier}_${Date.now()}`);
        const items = Array.isArray(monsterData.uniqueItemsDropped)
            ? monsterData.uniqueItemsDropped.filter(item => {
                if (!item || typeof item !== 'object' || !item.type || !item.data) {
                    console.warn(`MonsterControllerSystem: Invalid uniqueItemsDropped entry for ${monsterData.name}:`, item);
                    return false;
                }
                if (item.type === 'customUnique' && typeof item.data.name !== 'string') {
                    console.warn(`MonsterControllerSystem: Invalid customUnique entry for ${monsterData.name}:`, item);
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
            maxItems: items.length > 0 ? items.length : 1,
            items: items
        }));
        this.eventBus.emit('DropLoot', { lootSource });


    }

    // systems/MonsterControllerSystem.js - New isWalkable method
    isWalkable(walker, x, y) {
        // Round pixel coordinates to the nearest tile boundary to handle floating-point drift
        const { tileX, tileY } = this.utilities.getTileFromPixel(x, y);
        const roundedPixel = this.utilities.getPixelFromTile(tileX, tileY);

        const entitiesAtTarget = this.entityManager.getEntitiesWith(['Position']).filter(e => {
            const ePos = e.getComponent('Position');
            return ePos.x === roundedPixel.x && ePos.y === roundedPixel.y;
        });

        const isBlocked = entitiesAtTarget.some(e =>
            e.hasComponent('Wall') ||
            e.hasComponent('Stair') ||
            e.hasComponent('Portal') ||
            e.hasComponent('Fountain') ||
            (walker.id !== e.id && e.hasComponent('MonsterData')) ||
            (walker.id !== e.id && e.hasComponent('NPCData'))
        );
        const hasFloor = entitiesAtTarget.some(e => e.hasComponent('Floor'));

        if (!hasFloor || isBlocked) {
            console.log(`MonsterControllerSystem.isWalkable: Pixel (${x}, ${y}) rounded to (${roundedPixel.x}, ${roundedPixel.y}) blocked=${isBlocked}, hasFloor=${hasFloor}, entities:`,
                entitiesAtTarget.map(e => ({ id: e.id, components: Array.from(e.components.keys()) })));
        }

        return !isBlocked && hasFloor;
    }
}
