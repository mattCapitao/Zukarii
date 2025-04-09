// systems/MonsterSystem.js
import { System } from '../core/Systems.js';
import { PositionComponent, HealthComponent, LootSourceData, AttackSpeedComponent, MovementSpeedComponent, AffixComponent } from '../core/Components.js';

export class MonsterSystem extends System {
    constructor(entityManager, eventBus, dataSystem) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Position', 'Health', 'MonsterData'];
        this.dataSystem = dataSystem;

        this.MIN_SPAWN_DISTANCE = 6; 

        // Temporary static affix map (to be moved to DataSystem later)
        this.AFFIX_MAP = {
            "goldTheft": {
                type: "combat",
                trigger: "attackHitTarget",
                effect: "stealGold",
                params: { stealPercentage: 0.1, minSteal: 1 }
            }
        };
    }

    init() {
       // this.eventBus.on('MoveMonsters', () => this.moveMonsters());
        this.eventBus.on('MonsterDied', (data) => {
            console.log(`MonsterSystem: Received MonsterDied event with data:`, data);
            this.handleMonsterDeath(data.entityId);
        });
        this.eventBus.on('SpawnMonsters', (data) => this.handleSpawnMonsters(data));
    }

    update(deltaTime) {

        const player = this.entityManager.getEntity('player');
        if (!player || player.getComponent('PlayerState').dead) return;



        const tier = this.entityManager.getEntity('gameState').getComponent('GameState').tier;
        const levelEntity = this.entityManager.getEntitiesWith(['Map', 'Tier']).find(e => e.getComponent('Tier').value === tier);
        if (!levelEntity) return;
        const AGGRO_RANGE = 4;

        const monsters = this.entityManager.getEntitiesWith(this.requiredComponents);
        
        const now = Date.now();
        monsters.forEach(monster => {

            const health = monster.getComponent('Health');
            const hpBarWidth = Math.floor((health.hp / health.maxHp) * 16);
            const monsterData = monster.getComponent('MonsterData');
            monsterData.hpBarWidth = hpBarWidth;

            const dead = monster.getComponent('Dead');
            if (dead) {
                if (dead.state === 'new') {
                    this.handleMonsterDeath(monster.id);
                    dead.state = 'handling';
                }
                if (dead.expiresAt < now && dead.state === 'processed') { 
                    this.entityManager.removeEntity(monster.id);
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

            // Accumulate time (deltaTime in seconds, convert to ms)
            attackSpeed.elapsedSinceLastAttack += deltaTime * 1000;
            movementSpeed.elapsedSinceLastMove += deltaTime * 1000;

            if (distance <= AGGRO_RANGE + 2) {monsterData.isDetected = true;}

            if (distance <= AGGRO_RANGE) {monsterData.isAggro = true;}

            if (monsterData.isAggro) {
                const isAdjacentCardinal = (dx === 0 && Math.abs(dy) === 1) || (dy === 0 && Math.abs(dx) === 1);
                if (isAdjacentCardinal) {
                    if (attackSpeed.elapsedSinceLastAttack >= attackSpeed.attackSpeed) {
                        this.eventBus.emit('MonsterAttack', { entityId: monster.id });
                        attackSpeed.elapsedSinceLastAttack = 0;
                    }
                    return;
                }

                if (movementSpeed.elapsedSinceLastMove >= movementSpeed.movementSpeed) {

                    const directions = [
                        { x: Math.sign(dx), y: 0, dist: Math.abs(dx) },
                        { x: 0, y: Math.sign(dy), dist: Math.abs(dy) }
                    ].sort((a, b) => b.dist - a.dist);

                    for (const dir of directions) {
                        const newX = pos.x + dir.x;
                        const newY = pos.y + dir.y;
                        const isOccupied = monsters.some(m =>
                            m.id !== monster.id &&
                            m.getComponent('Health').hp > 0 &&
                            m.getComponent('Position').x === newX &&
                            m.getComponent('Position').y === newY
                        );
                        const isPlayerPosition = (newX === playerPos.x && newY === playerPos.y);
                        if (!this.isWalkable(newX, newY) || isOccupied || isPlayerPosition) {
                            continue;
                        }
                        pos.x = newX;
                        pos.y = newY;
                        this.eventBus.emit('PositionChanged', { entityId: monster.id, x: newX, y: newY });
                        movementSpeed.elapsedSinceLastMove = 0; // Reset move timer
                        break;
                    }
                }
            }
        });
    }

    // systems/MonsterSystem.js - Updated handleSpawnMonsters method // remove map from signature when updating LevelSsytem.
    async handleSpawnMonsters({ tier, map, rooms, hasBossRoom, spawnPool }) {
        const baseMonsterCount = 15;
        const densityFactor = 1 + tier * 0.1;
        const monsterCount = Math.floor(baseMonsterCount * densityFactor);
        const player = this.entityManager.getEntity('player');
        const playerX = player.getComponent('Position').x;
        const playerY = player.getComponent('Position').y;

        const fetchData = (eventName) => {
            return new Promise((resolve) => {
                this.eventBus.emit(eventName, {
                    callback: (data) => resolve(data)
                });
            });
        };

        const promises = [];
        if (spawnPool.randomMonsters) {
            promises.push(fetchData('GetRandomMonsters'));
        } else {
            promises.push(Promise.resolve([])); // Placeholder for randomMonsters
        }
        if (spawnPool.uniqueMonsters) {
            promises.push(fetchData('GetUniqueMonsters'));
        } else {
            promises.push(Promise.resolve([])); // Placeholder for uniqueMonsters
        }
        if (hasBossRoom) {
            promises.push(fetchData('GetBossMonsters'));
        } else {
            promises.push(Promise.resolve([])); // Placeholder for bossMonsters
        }

        Promise.all(promises).then(([randomMonsters, uniqueMonsters, bossMonsters]) => {
            const allTemplates = [
                ...(randomMonsters || []),
                ...(uniqueMonsters || [])
            ];
            console.log('MonsterSystem: Random monsters:', randomMonsters);
            console.log('MonsterSystem: Unique monsters:', uniqueMonsters);
            console.log('MonsterSystem: Boss monsters:', bossMonsters);
            console.log('MonsterSystem: Monster spawn pool:', spawnPool);
            console.log(`MonsterSystem: Spawning ${monsterCount} monsters for tier ${tier}`);

            this.entityManager.setActiveTier(tier); // NEW: Ensure tier sync
            console.log(`MonsterSystem: Active tier set to ${tier}, rooms: ${rooms}`);

            if (hasBossRoom) {
                console.log('MonsterSystem: Starting Boss Monster RoomSelection');
                const bossRoomId = rooms.find(roomId => {
                    const roomEntity = this.entityManager.getEntity(roomId);
                    if (!roomEntity) {
                        console.error(`MonsterSystem: Entity ${roomId} not found in tier ${tier}`);
                        return false;
                    }

                    const roomComp = roomEntity.getComponent('Room');
                    if (!roomComp) {
                        console.error(`MonsterSystem: No Room component for ${roomId}`);
                        return false;
                    }
                    return roomComp.roomType === 'BossChamberSpecial';

                });
                console.log(`MonsterSystem: Boss room ID: ${bossRoomId}`);
                if (bossRoomId && bossMonsters) {
                    const bossTemplate = bossMonsters[1]; // hard code specific boss for testing
                    //const bossTemplate = bossMonsters[Math.floor(Math.random() * bossMonsters.length)];
                    const boss = this.createMonsterEntity(bossTemplate, tier, [bossRoomId], playerX, playerY);
                    console.log(`MonsterSystem: Selected Boss ${bossTemplate.name} to spawn at (${boss.getComponent('Position').x}, ${boss.getComponent('Position').y})`, boss);

                    if (boss) {
                        boss.getComponent('MonsterData').isBoss = true;
                        console.log(`MonsterSystem: Boss ${boss.getComponent('MonsterData').name} spawned at (${boss.getComponent('Position').x}, ${boss.getComponent('Position').y})`);
                        const entityList = this.entityManager.getEntitiesWith(['Tier']).find(e => e.getComponent('Tier').value === tier).getComponent('EntityList');
                        entityList.monsters.push(boss.id);
                    } else {
                        console.error(`MonsterSystem: Failed to spawn boss ${bossTemplate.name} in room ${bossRoomId}`);
                    }
                } else {
                    console.error(`MonsterSystem: No boss room (${bossRoomId}) or bossMonsters (${bossMonsters.length}) for tier ${tier}`);
                }
            }

            const normalRoomIds = hasBossRoom ? rooms.filter(roomId => {
                const roomEntity = this.entityManager.getEntity(roomId);
                const roomComp = roomEntity.getComponent('Room');
                return roomComp.type !== 'BossChamberSpecial';
            }) : rooms;
            let eliteMonsterCount = 0;

            const tierMonsters = (randomMonsters || []).filter(m => m.minDungeonTier <= tier);
            const tierUniqueMonsters = (uniqueMonsters || []).filter(m => m.minDungeonTier <= tier);

            if (tierMonsters.length === 0 && tierUniqueMonsters.length === 0) {
                console.warn(`MonsterSystem: No monsters available for tier ${tier}`);
                return;
            }

            for (let i = 0; i < monsterCount; i++) {
                if (!tierMonsters || tierMonsters.length === 0) {
                    console.warn('MonsterSystem: No random monsters available to spawn');
                    break;
                }
                
                let template = tierMonsters[Math.floor(Math.random() * tierMonsters.length)];
                //let template = randomMonsters[Math.floor(Math.random() * randomMonsters.length)];

                if (spawnPool.uniqueMonsters && Math.random() < .05 * tier && eliteMonsterCount <= monsterCount * .2) { 

                    if (tierUniqueMonsters.length > 0) {
                        eliteMonsterCount++;
                        template = tierUniqueMonsters[Math.floor(Math.random() * tierUniqueMonsters.length)];
                    } else {
                        console.warn('MonsterSystem: No unique monsters available, falling back to random monster');
                    }
                }
                const monster = this.createMonsterEntity(template, tier, normalRoomIds, playerX, playerY);
                if (monster) {
                    const entityList = this.entityManager.getEntitiesWith(['Tier']).find(e => e.getComponent('Tier').value === tier).getComponent('EntityList');
                    entityList.monsters.push(monster.id);
                }
            }
        }).catch(err => {
            console.error('MonsterSystem: Failed to fetch monster data:', err);
        });
    }

    // systems/MonsterSystem.js - Updated createMonsterEntity method
    createMonsterEntity(template, tier, roomIds, playerX, playerY) {
        if (!roomIds || roomIds.length === 0) {
            console.error(`MonsterSystem.js: No rooms provided for spawning monsters on tier ${tier}`);
            return null;
        }
        const entity = this.entityManager.createEntity(`monster_${tier}_${Math.random().toString(36).substring(2, 11)}`);
        const roomId = roomIds[Math.floor(Math.random() * roomIds.length)];
        const roomEntity = this.entityManager.getEntity(roomId);
        if (!roomEntity) {
            console.error(`MonsterSystem.js: Room entity ${roomId} not found`);
            return null;
        }
        const room = roomEntity.getComponent('Room');
        if (!room) {
            console.error(`MonsterSystem.js: RoomComponent not found for room ${roomId}`);
            return null;
        }
        let x, y;
        let attempts = 0;
        const maxAttempts = 50; // Prevent infinite loop
        let isOccupied = false; // Declare outside the do block

        const MIN_SPAWN_DISTANCE = this.MIN_SPAWN_DISTANCE; // Aggro range (4) + 2 buffer

        let distance;
        do {
            if (attempts >= maxAttempts) {
                console.warn(`MonsterSystem.js: Failed to find valid spawn position for ${template.name} in room ${roomId} after ${maxAttempts} attempts`);
                return null;
            }
            x = room.left + 1 + Math.floor(Math.random() * (room.width - 2));
            y = room.top + 1 + Math.floor(Math.random() * (room.height - 2));
            const entitiesAtTarget = this.entityManager.getEntitiesWith(['Position']).filter(e => {
                const ePos = e.getComponent('Position');
                return ePos.x === x && ePos.y === y;
            });
            isOccupied = entitiesAtTarget.some(e => e.hasComponent('MonsterData'));

            const dx = playerX - x;
            const dy = playerY - y;
            distance = Math.sqrt(dx * dx + dy * dy);
            attempts++;
        } while (
            !this.isWalkable(x, y) ||
            isOccupied ||
            (x === playerX && y === playerY) || // Keep exact position check
             distance < MIN_SPAWN_DISTANCE// NEW: Enforce min distance
        );

        const maxHp = this.calculateMonsterMaxHp(template.baseHp, tier);
        this.entityManager.addComponentToEntity(entity.id, new PositionComponent(x, y));
        this.entityManager.addComponentToEntity(entity.id, new HealthComponent(maxHp, maxHp));
        this.entityManager.addComponentToEntity(entity.id, new AttackSpeedComponent(1000));
        this.entityManager.addComponentToEntity(entity.id, new MovementSpeedComponent(500));
        this.entityManager.addComponentToEntity(entity.id, {
            type: 'MonsterData',
            hpBarWidth: 16,
            name: template.name,
            tier: tier,
            classes: template.classes,
            avatar: template.avatar,
            minBaseDamage: template.minBaseDamage + Math.floor(tier / 3),
            maxBaseDamage: template.maxBaseDamage + Math.floor(tier / 2),
            isAggro: false,
            isDetected: false,
            isElite: template.isElite || false,
            isBoss: template.isBoss || false,
            affixes: template.affixes || [],
            uniqueItemsDropped: template.uniqueItemsDropped || []
        });

        // Add AffixComponent for each affix in template.affixes
        const affixDefinitions = (template.affixes || []).map(affixName => {
            const affixData = this.AFFIX_MAP[affixName];
            if (affixData) {
                return {
                    type: affixData.type, // e.g., 'combat'
                    trigger: affixData.trigger,
                    effect: affixData.effect,
                    params: affixData.params
                };
            }
            console.warn(`MonsterSystem: Unknown affix ${affixName} for ${template.name}`);
            return null;
        }).filter(Boolean);

        if (affixDefinitions.length > 0) {
            this.entityManager.addComponentToEntity(entity.id, new AffixComponent(affixDefinitions));
            console.log(`MonsterSystem: Added affixes to ${template.name}:`, affixDefinitions);
        }

        console.log(`MonsterSystem: Entity ${entity.id} components:`, Array.from(entity.components.keys()));


        console.log(`MonsterSystem.js: Spawned monster ${entity.id} at (${x}, ${y}) on tier ${tier}`, entity);
        return entity;
    }

    calculateMonsterMaxHp(baseHp, tier) {
        const BASE_GROWTH_RATE = 0.25;
        const INITIAL_VARIANCE_FACTOR = 0.1;
        const VARIANCE_GROWTH_RATE = 0.005;
        const tierAdjustment = tier - 1;
        const varianceScaling = 1 + VARIANCE_GROWTH_RATE * tierAdjustment;
        const variance = Math.random() * INITIAL_VARIANCE_FACTOR * varianceScaling;
        return Math.round(baseHp * (1 + BASE_GROWTH_RATE * tierAdjustment + variance));
    }

    moveMonsters(deltaTime) {
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
        console.log(`MonsterSystem: Monster defeated: ${monsterData.name}, XP calc - maxHp: ${health.maxHp}, minDmg: ${monsterData.minBaseDamage}, maxDmg: ${monsterData.maxBaseDamage}, tier: ${tier}, baseXp: ${baseXp}`);
        this.eventBus.emit('LogMessage', { message: `${monsterData.name} defeated!` });
        this.eventBus.emit('AwardXp', { amount: baseXp });

        const lootSource = this.entityManager.createEntity(`loot_source_${monsterData.tier}_${Date.now()}`);
        // Validate and process uniqueItemsDropped
        const items = Array.isArray(monsterData.uniqueItemsDropped)
            ? monsterData.uniqueItemsDropped.filter(item => {
                if (!item || typeof item !== 'object' || !item.type || !item.data) {
                    console.warn(`MonsterSystem: Invalid uniqueItemsDropped entry for ${monsterData.name}:`, item);
                    return false;
                }
                // Only require data.name for customUnique type
                if (item.type === 'customUnique' && typeof item.data.name !== 'string') {
                    console.warn(`MonsterSystem: Invalid customUnique entry for ${monsterData.name} (missing or invalid name):`, item);
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
        console.log(`MonsterSystem: Emitting DropLoot for ${monsterData.name} with items:`, items);
        this.eventBus.emit('DropLoot', { lootSource });
    }

    // systems/MonsterSystem.js - New isWalkable method
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