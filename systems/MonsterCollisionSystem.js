import { System } from '../core/Systems.js';
import { CollisionComponent } from '../core/Components.js';

export class MonsterCollisionSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['MonsterData', 'Collision'];
        this.sfxQueue = this.entityManager.getEntity('gameState').getComponent('AudioQueue').SFX || [];
    }

    update(deltaTime) {
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        if (!gameState || gameState.gameOver || gameState.transitionLock) return;

        const monsters = this.entityManager.getEntitiesWith(this.requiredComponents);
        if (monsters.length === 0) return;
        
        for (const monster of monsters) {

            if (!monster) continue;

            const collision = monster.getComponent('Collision');
            if ( !collision || collision.collisions.length === 0) continue;

            const attackSpeed = monster.getComponent('AttackSpeed');
            const monsterData = monster.getComponent('MonsterData');
            const movementIntent = monster.getComponent('MovementIntent');
            const movementDirection = movementIntent
                ? { dx: movementIntent.targetX - monster.getComponent('Position').x, dy: movementIntent.targetY - monster.getComponent('Position').y }
                : { dx: 0, dy: 0 };

            // Iterate over the collisions array
            for (let i = collision.collisions.length - 1; i >= 0; i--) {
                const collisionData = collision.collisions[i];
                const target = this.entityManager.getEntity(collisionData.targetId);
                if (!target) {
                    console.warn(`MonsterCollisionSystem: Target entity ${collisionData.targetId} not found for monster ${monster.id}`);
                    continue; // Skip if target entity is not found
                }
                //console.log(`MonsterCollisionSystem: Monster collided with ${target.id}`);

                if (target.hasComponent('MonsterData') && target.getComponent('Health').hp > 0 && !target.hasComponent('Dead')) {
                    const targetMonsterData = target.getComponent('MonsterData');
                    if (monsterData.isAggro) targetMonsterData.isAggro = true;
                    console.log(`MonsterCollisionSystem: Monster ${monster.id} collided with monster ${target.id}`,monster, target);
                }

                if (target.hasComponent('Projectile')) {
                    const projData = target.getComponent('Projectile');
                    const source = this.entityManager.getEntity(projData.sourceEntityId);
                    
                    if (source.id === 'player') {
                        console.log(`MonsterCollisionSystem: Monster ${monster.id} collided with player projectile ${target.id}`);
                        const projectile = target;
                        if (!projectile.hasComponent('Collision')) {
                            console.log(`MonsterCollisionSystem: Attempting to add Collision component to projectile ${projectile.id}`, projectile);
                            projectile.addComponent(new CollisionComponent());
                            
                        }
                       const position = projectile.getComponent('Position');
                        projectile.getComponent('Collision').collisions.push({
                            moverId: projectile.id,
                            targetId: monster.id,
                            collisionType:  "current",
                            normalX: position.x,
                            normalY: position.y,
                            distance: 0,
                        });
                    }
                }
                /*
                if (target.hasComponent('Fountain')) {
                }
                if (target.hasComponent('LootData')) {
                }
                if (target.hasComponent('Stair') && !monster.hasComponent('StairLock')) {
                    console.log(`MonsterCollisionSystem: Monster ${monster.id} collided with stair ${target.id}`);
                }
                if (target.hasComponent('Portal')) {
                    console.log(`MonsterCollisionSystem: Monster ${monster.id} collided with portal ${target.id}`);
                }
                */
            }
        }
    }
}
