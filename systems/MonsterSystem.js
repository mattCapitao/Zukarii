// systems/MonsterSystem.js
import { System } from '../core/Systems.js';
import { PositionComponent, HealthComponent, LootSourceData } from '../core/Components.js';

export class MonsterSystem extends System {
    constructor(entityManager, eventBus, dataSystem) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Position', 'Health', 'MonsterData'];
        this.dataSystem = dataSystem;
    }

    init() {
        this.eventBus.on('MoveMonsters', () => this.moveMonsters());
        this.eventBus.on('MonsterDied', (data) => {
            console.log(`MonsterSystem: Received MonsterDied event with data:`, data);
            this.handleMonsterDeath(data.entityId);
    });
        this.eventBus.on('SpawnMonsters', (data) => this.handleSpawnMonsters(data));
    }

    handleSpawnMonsters({ tier, map, rooms, hasBossRoom, spawnPool }) {
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

        hasBossRoom = true; // For testing
        const promises = [];
        if (spawnPool.monsterTemplates) {
            promises.push(fetchData('GetMonsterTemplates'));
        }
        if (spawnPool.uniqueMonsters) {
            promises.push(fetchData('GetUniqueMonsters'));
        }
        if (hasBossRoom) {
            promises.push(fetchData('GetBossMonsters'));
        }

        Promise.all(promises).then(([monsterTemplates, uniqueMonsters, bossMonsters]) => {
            const allTemplates = [
                ...(monsterTemplates || []),
                ...(uniqueMonsters || [])
            ];
            console.log('Monster Templates:', monsterTemplates);
            console.log('All monster templates:', allTemplates); 
            console.log('Unique monsters:', uniqueMonsters);
            console.log('Boss monsters:', bossMonsters);
            console.log('Monster spawn pool:', spawnPool); 
            console.log(`MonsterSystem: Spawning ${monsterCount} monsters for tier ${tier}`);

            if (hasBossRoom) {
                const bossRoom = rooms.find(r => r.type === 'BossChamberSpecial');
                if (bossRoom && bossMonsters) {
                    const bossTemplate = bossMonsters[Math.floor(Math.random() * bossMonsters.length)];
                    const boss = this.createMonsterEntity(bossTemplate, tier, map, [bossRoom], playerX, playerY);
                    boss.getComponent('MonsterData').isBoss = true;
                    console.log(`Boss ${boss.getComponent('MonsterData').name} spawned at (${boss.getComponent('Position').x}, ${boss.getComponent('Position').y})`);
                }
            }

            const normalRooms = hasBossRoom ? rooms.filter(r => r.type !== 'BossChamberSpecial') : rooms;
            for (let i = 0; i < monsterCount; i++) {
                let template = monsterTemplates[Math.floor(Math.random() * monsterTemplates.length)];

                if (spawnPool.uniqueMonsters && Math.randon() > .05 * tier) {
                    template = uniqueTemplates[Math.floor(Math.random() * uniqueTemplates.length)];
                }

                this.createMonsterEntity(template, tier, map, normalRooms, playerX, playerY);
            }
        }).catch(err => {
            console.error('Failed to fetch monster data:', err);
        });
    }

    createMonsterEntity(template, tier, map, rooms, playerX, playerY) {
        const entity = this.entityManager.createEntity(`monster_${tier}_${Math.random().toString(36).substr(2, 9)}`);
        const room = rooms[Math.floor(Math.random() * rooms.length)];
        let x, y;
        do {
            x = room.left + 1 + Math.floor(Math.random() * (room.w - 2));
            y = room.top + 1 + Math.floor(Math.random() * (room.h - 2));
        } while (map[y][x] !== ' ' || (x === playerX && y === playerY));

        const maxHp = this.calculateMonsterMaxHp(template.baseHp, tier);
        this.entityManager.addComponentToEntity(entity.id, new PositionComponent(x, y));
        this.entityManager.addComponentToEntity(entity.id, new HealthComponent(maxHp, maxHp));
        this.entityManager.addComponentToEntity(entity.id, {
            type: 'MonsterData',
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
            affixes: template.affixes || []
        });
        return entity;
    }

    calculateMonsterMaxHp(baseHp, tier) {
        const BASE_GROWTH_RATE = 0.15;
        const INITIAL_VARIANCE_FACTOR = 0.1;
        const VARIANCE_GROWTH_RATE = 0.005;
        const tierAdjustment = tier - 1;
        const varianceScaling = 1 + VARIANCE_GROWTH_RATE * tierAdjustment;
        const variance = Math.random() * INITIAL_VARIANCE_FACTOR * varianceScaling;
        return Math.round(baseHp * (1 + BASE_GROWTH_RATE * tierAdjustment + variance));
    }

    moveMonsters() {
        const player = this.entityManager.getEntity('player');
        if (!player || player.getComponent('PlayerState').dead) return;

        const tier = this.entityManager.getEntity('gameState').getComponent('GameState').tier;
        const levelEntity = this.entityManager.getEntitiesWith(['Map', 'Tier']).find(e => e.getComponent('Tier').value === tier);
        if (!levelEntity) return;

        const map = levelEntity.getComponent('Map').map;
        const monsters = this.entityManager.getEntitiesWith(this.requiredComponents);
        const AGGRO_RANGE = 4;

        monsters.forEach(monster => {
            const health = monster.getComponent('Health');
            if (health.hp <= 0) return;

            const pos = monster.getComponent('Position');
            const monsterData = monster.getComponent('MonsterData');
            const playerPos = player.getComponent('Position');
            const dx = playerPos.x - pos.x;
            const dy = playerPos.y - pos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= AGGRO_RANGE + 2) {
                monsterData.isDetected = true;
            }

            if (distance <= AGGRO_RANGE) {
                monsterData.isAggro = true;
            }

            if (monsterData.isAggro) {
                const isAdjacentCardinal = (dx === 0 && Math.abs(dy) === 1) || (dy === 0 && Math.abs(dx) === 1);
                if (isAdjacentCardinal) {
                    this.eventBus.emit('MonsterAttack', { entityId: monster.id });
                    return;
                }

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

                    if (map[newY][newX] === '#' ||
                        map[newY][newX] === '⇑' ||
                        map[newY][newX] === '⇓' ||
                        map[newY][newX] === '?' ||
                        (newX === playerPos.x && newY === playerPos.y) ||
                        isOccupied) {
                        continue;
                    }

                    pos.x = newX;
                    pos.y = newY;
                    this.eventBus.emit('PositionChanged', { entityId: monster.id, x: newX, y: newY });
                    break;
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
        console.log(`Monster defeated: ${monsterData.name}, XP calc - maxHp: ${health.maxHp}, minDmg: ${monsterData.minBaseDamage}, maxDmg: ${monsterData.maxBaseDamage}, tier: ${tier}, baseXp: ${baseXp}`);
        this.eventBus.emit('LogMessage', { message: `${monsterData.name} defeated!` });
        this.eventBus.emit('AwardXp', { amount: baseXp });

        const lootSource = this.entityManager.createEntity(`loot_source_${monsterData.tier}_${Date.now()}`);
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
            maxItems: 1,            // Default to 1 item drop
            hasCustomUnique: false, // No custom unique yet
            uniqueItemIndex: 0      // Default index
        }));
        this.eventBus.emit('DropLoot', { lootSource });
        console.log(`Emitting DropLoot for ${monsterData.name}`);
    }
}