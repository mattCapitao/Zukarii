import { System } from '../core/Systems.js';
import { StairLockComponent } from '../core/Components.js';

export class PlayerCollisionSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['PlayerStateComponent', 'Collision'];
        this.sfxQueue = this.entityManager.getEntity('gameState').getComponent('AudioQueue').SFX || [];
    }

    update(deltaTime) {
        const player = this.entityManager.getEntity('player');
        if (!player) return;

        const collision = player.getComponent('Collision');
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');

        if (!collision ||  !gameState || gameState.gameOver || gameState.transitionLock) {
            return;
        }
        if (collision.collisions.length === 0) {
            return; // No collisions to process
        }
        const attackSpeed = player.getComponent('AttackSpeed');

        const movementIntent = player.getComponent('MovementIntent');
        const movementDirection = movementIntent
            ? { dx: movementIntent.targetX - player.getComponent('Position').x, dy: movementIntent.targetY - player.getComponent('Position').y }
            : { dx: 0, dy: 0 };

        // Iterate over the collisions array
        for (let i = collision.collisions.length - 1; i >= 0; i--) {
            const collisionData = collision.collisions[i];
            const target = this.entityManager.getEntity(collisionData.targetId);
            if (!target) {
                console.warn(`PlayerCollisionSystem: Target entity ${collisionData.targetId} not found for player ${player.id}`);
                continue; // Skip if target entity is not found
            }
            //console.log(`PlayerCollisionSystem: Player collided with ${target.id}`);

            if (target.hasComponent('MonsterData') && target.getComponent('Health').hp > 0) {
                if (attackSpeed.elapsedSinceLastAttack >= attackSpeed.attackSpeed) {
                    this.eventBus.emit('MeleeAttack', { targetEntityId: target.id });
                    attackSpeed.elapsedSinceLastAttack = 0;
                    this.endTurn('meleeAttack');
                }
                // Remove the processed collision entry
                collision.collisions.splice(i, 1);
                //break;
            }
            if (target.hasComponent('Fountain')) {
                this.eventBus.emit('UseFountain', { fountainEntityId: target.id });
                this.endTurn('useFountain');
                // Remove the processed collision entry
                collision.collisions.splice(i, 1);
  
            }
            if (target.hasComponent('LootData')) {
                const pos = target.getComponent('Position');
                this.eventBus.emit('PickupTreasure', { x: pos.x, y: pos.y });
                // Remove the processed collision entry
                collision.collisions.splice(i, 1);

            }
            if (target.hasComponent('Stair') && !player.hasComponent('StairLock')) {
                const levelTransition = this.entityManager.getEntity('gameState').getComponent('LevelTransition');
                player.addComponent(new StairLockComponent());
                if (levelTransition && levelTransition.pendingTransition === null) {
                    const stairComp = target.getComponent('Stair');
                    levelTransition.lastMovementDirection = movementDirection;
                    if (stairComp.direction === 'down') {
                        levelTransition.pendingTransition = 'down';
                        this.endTurn('transitionDown');
                    } else if (stairComp.direction === 'up') {
                        levelTransition.pendingTransition = 'up';
                        this.endTurn('transitionUp');
                    }
                    
                    // Remove the processed collision entry
                    collision.collisions.splice(i, 1);
                    break;
                }
            }
            if (target.hasComponent('Portal')) {
                const portalComp = target.getComponent('Portal');
                if (!portalComp.active) return;
                this.sfxQueue.push({ sfx: 'portal0', volume: 0.5 });
                const levelTransition = this.entityManager.getEntity('gameState').getComponent('LevelTransition');
                this.entityManager.getEntity('gameState').getComponent('GameState').transitionLock = true;
                
                if (levelTransition && levelTransition.pendingTransition === null) {
                    levelTransition.lastMovementDirection = movementDirection;
                    levelTransition.pendingTransition = 'portal';
                    this.endTurn('transitionPortal');
                }
                // Remove the processed collision entry
                collision.collisions.splice(i, 1);
                break;
            }
        }
    }

    endTurn(source) {
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        if (!gameState || gameState.gameOver) return;
        gameState.transitionLock = false;
        gameState.needsRender = true;
    }
}
