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
        this.MONSTER_WANDER_CHANCE = .001;
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
                        //////console.log(`MonsterControllerSystem: ${monsterData.name} attacked player at distance ${distance.toFixed(2)} pixels`);
                    }
                    return; // Stop moving if in melee range
                }

                // Set facing direction
                 monster.getComponent('Visuals').faceLeft = dx < 0 ? true : dx > 0 ? false : monster.getComponent('Visuals').faceLeft;

                // Set MovementIntent destimnation as the player's current position
                this.entityManager.addComponentToEntity(monster.id, new MovementIntentComponent(playerPos.x, playerPos.y));

            } else {
            /*    
                if (!monster.hasComponent('MovementIntent') && !monsterData.isAggro && !monsterData.isBoss && monsterData.isElite) {

                    const { tileX, tileY } = this.utilities.getTileFromPixel(pos.x, pos.y);

                    let setNextWanderTile = false;

                    // Check if monster is currently wandering
                    if (monsterData.isWandering && monsterData.wanderTile) {
                        const nextTile = monsterData.wanderTile;
                        if (tileX === nextTile.x && tileY === nextTile.y) {
                            this.entityManager.removeComponentFromEntity(monster.id, 'MovementIntent');
                            monsterData.wanderCycles--;

                            if (monsterData.wanderCycles && monsterData.wanderCycles > 0) {
                                setNextWanderTile = true;
                            } else {
                                //console.log(`MonsterControllerSystem: ${monsterData.name} finished wandering`);
                                monsterData.isWandering = false;
                                monsterData.wanderTile = null;
                                return;
                            }
                        }
                        if (!setNextWanderTile) {
                            return; // Skip further processing if already wandering
                        }
                    }

                    if (Math.random() < this.MONSTER_WANDER_CHANCE || setNextWanderTile) {

                        let wanderTile = null;
                        let attempts = 0;
                        const maxAttempts = 10;
                        const maxOffset = 4; // ±4 tiles

                        while (attempts < maxAttempts && !wanderTile) {
                            const offsetX = Math.floor(Math.random() * (2 * maxOffset + 1)) - maxOffset;
                            const offsetY = Math.floor(Math.random() * (2 * maxOffset + 1)) - maxOffset;
                            const targetTileX = tileX + offsetX;
                            const targetTileY = tileY + offsetY;

                            if (
                                (targetTileX !== tileX || targetTileY !== tileY) &&
                                targetTileX >= 0 && targetTileX < 120 && targetTileY >= 0 && targetTileY < 67// Map bounds
                                && this.utilities.isWalkable(monster, targetTileX, targetTileY) // Exclude all MonsterData
                            ) {
                                wanderTile = { x: targetTileX, y: targetTileY };
                            }
                            attempts++;
                        }

                        if (wanderTile) {
                            if (!setNextWanderTile) {
                                monsterData.wanderCycles = Math.floor(Math.random() * 3) + 2; // Random cycles between 2 and 4
                            }
                            //console.log(`MonsterControllerSystem: ${monsterData.name} found wander target tile (${wanderTile.x}, ${wanderTile.y})  after ${attempts} attempts`);
                            monsterData.wanderTile = wanderTile;
                            monsterData.isWandering = true;
                            const nextPixel = this.utilities.getPixelFromTile(wanderTile.x, wanderTile.y);
                            this.entityManager.addComponentToEntity(monster.id, new MovementIntentComponent(nextPixel.x, nextPixel.y));
                        } else {
                            monsterData.isWandering = false;
                            monsterData.wanderTile = null;
                            this.entityManager.removeComponentFromEntity(monster.id, 'MovementIntent');
                            console.warn(`MonsterControllerSystem: ${monsterData.name} has to wanderTile set)`);
                        }
                    }

                }
            */
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
            ////console.log(`MonsterControllerSystem: Boss defeated: ${monsterData.name}, awarding special actions and loot.`);
        } else {
            this.utilities.pushPlayerActions('monsterKill', { monsterId: monsterData.id, tier });
            ////console.log(`MonsterControllerSystem: Monster defeated: ${monsterData.name}, awarding actions and loot.`);
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

}
