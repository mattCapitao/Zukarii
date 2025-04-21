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

        const AGGRO_RANGE = 4;

        const monsters = this.entityManager.getEntitiesWith(this.requiredComponents);
        
        const now = Date.now();
       
        monsters.forEach(monster => {

            const health = monster.getComponent('Health');
            const hpBarWidth = Math.floor((health.hp / health.maxHp) * (this.TILE_SIZE/2));
            const monsterData = monster.getComponent('MonsterData');
            monsterData.hpBarWidth = hpBarWidth;

            const dead = monster.getComponent('Dead');
            if (dead) {
                if (dead.state === 'new') {
                    this.handleMonsterDeath(monster.id);
                    dead.state = 'handling';
                }
                if ((dead.expiresAt < now && dead.state === 'processed') || dead.expiresAt+2000 < now ) { 
                   // this.entityManager.removeEntity(monster.id);
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

                        if (dir.x < 0) { monster.getComponent('Visuals').faceLeft = true; }
                        if (dir.x > 0) { monster.getComponent('Visuals').faceLeft = false; }

                        const isPlayerPosition = (newX === playerPos.x && newY === playerPos.y);
                        if (!this.isWalkable(newX, newY) || isOccupied || isPlayerPosition) {
                            continue;
                        }

                        this.entityManager.addComponentToEntity(monster.id, new MovementIntentComponent(newX, newY));
                        
                        movementSpeed.elapsedSinceLastMove = 0; // Reset move timer
                        break;
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