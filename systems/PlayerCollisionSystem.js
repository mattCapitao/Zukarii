﻿import { System } from '../core/Systems.js';
import { StairLockComponent } from '../core/Components.js';

export class PlayerCollisionSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus);
        this.requiredComponents = ['PlayerStateComponent', 'Collision'];
        this.sfxQueue = this.entityManager.getEntity('gameState').getComponent('AudioQueue').SFX || [];
        this.utilities = utilities;
        this.utilities.entityManager = this.entityManager;
    }

    update(deltaTime) {
        const player = this.entityManager.getEntity('player');
        if (!player) return;

        const collision = player.getComponent('Collision');
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');

        if (!collision || !gameState || gameState.gameOver || gameState.transitionLock) {
            return;
        }

        // If no collisions, skip the rest (but after overlap check!)
        if (!collision.collisions || collision.collisions.length === 0) {
            return;
        }

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
                continue;
            }
            const isAdjacent = this.isAdjacentToPlayer(player, target);
            const isOverlapping = this.isOverlappingPlayer(player, target);

            if (target.hasComponent('MonsterData') && target.getComponent('Health').hp > 0) {
                const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
                // Only allow melee if NOT in ranged mode
                if (!gameState?.isRangedMode) {
                    // Adjacency check (melee range)          
                    if (isAdjacent || isOverlapping) {
                        const attackSpeed = player.getComponent('AttackSpeed');
                        if (attackSpeed.elapsedSinceLastAttack >= attackSpeed.attackSpeed) {
                            this.eventBus.emit('MeleeAttack', { targetEntityId: target.id });
                            attackSpeed.elapsedSinceLastAttack = 0;
                            this.endTurn('meleeAttack');
                        }
                        collision.collisions.splice(i, 1);
                    }
                }
                continue;
            }

            // Entry (one-shot) triggers: fire once per entry, then cooldown
            if (target.hasComponent('TriggerArea')) {
                if (isOverlapping) { 
                    const triggerArea = target.getComponent('TriggerArea');
                    if (triggerArea.mode !== 'Presence' && triggerArea.active) {
                        this.eventBus.emit(triggerArea.action, triggerArea.data);
                        triggerArea.active = false;
                        setTimeout(() => {
                            triggerArea.active = true;
                        }, triggerArea.resetDelay || 120000);
                    }
                }
                continue;
            } 

            if (target.hasComponent('NPCData')) {
                if (isAdjacent || isOverlapping) { 
                    this.entityManager.removeComponentFromEntity('player', 'MovementIntent');
                    collision.collisions.splice(i, 1);
                }
               
                continue;
            }
            if (target.hasComponent('Fountain')) {
                if (isAdjacent || isOverlapping) {
                    this.eventBus.emit('UseFountain', { fountainEntityId: target.id });
                    this.endTurn('useFountain');
                }
                collision.collisions.splice(i, 1);
                continue;
            }
            if (target.hasComponent('LootData')) {
                const pos = target.getComponent('Position');
                this.eventBus.emit('PickupTreasure', { x: pos.x, y: pos.y });
                collision.collisions.splice(i, 1);
                continue;
            }
            if (target.hasComponent('Stair') && !player.hasComponent('StairLock')) {
                if (isAdjacent || isOverlapping) {

                    const stairComp = target.getComponent('Stair');
                    if (!stairComp.active) {
                        const highestTier = this.entityManager.getEntity('gameState').getComponent('GameState').highestTier;
                        const currentTier = this.entityManager.getActiveTier();
                        if (highestTier > currentTier && stairComp.direction === 'down') {
                            console.warn(`PlayerCollisionSystem: Stairs down at tier ${currentTier} unocked for highest tier: .`, highestTier);
                            stairComp.active = true;
                        } else {
                            player.addComponent(new StairLockComponent());
                            this.eventBus.emit('LogMessage', { message: 'The Stairs are blocked by a magical barrier' });
                            const fromTier = this.entityManager.getActiveTier();
                            if (fromTier === undefined || fromTier === null) {
                                console.error('PlayerCollisionSystem: getActiveTier returned invalid value', { fromTier });
                                player.removeComponent(new StairLockComponent());
                                continue;
                            }
                            const toTier = stairComp.direction === 'down' ? fromTier + 1 : fromTier - 1;
                            try {
                                this.utilities.pushPlayerActions('attemptStairs', { fromTier, toTier, success: false });
                                console.log(`PlayerCollisionSystem: Pushed attemptStairs action`, { fromTier, toTier, success: false });
                            } catch (error) {
                                console.error('PlayerCollisionSystem: Failed to push attemptStairs action', { error: error.message });
                            }
                            setTimeout(() => {
                                player.removeComponent(new StairLockComponent());
                            }, 2000);
                            continue;

                        }
                    }
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
                            collision.collisions.splice(i, 1);
                            break;
                        }
                    
                }
            }
            if (target.hasComponent('Portal')) {
                if (!isAdjacent && !isOverlapping) {
                    continue; // Only process portal if adjacent or overlapping
                }
                const portalComp = target.getComponent('Portal');
                if (!portalComp.active) continue;
                this.sfxQueue.push({ sfx: 'portal0', volume: 0.5 });
                const levelTransition = this.entityManager.getEntity('gameState').getComponent('LevelTransition');
                this.entityManager.getEntity('gameState').getComponent('GameState').transitionLock = true;

                if (levelTransition && levelTransition.pendingTransition === null) {
                    levelTransition.lastMovementDirection = movementDirection;
                    levelTransition.pendingTransition = 'portal';
                    this.endTurn('transitionPortal');
                }
                collision.collisions.splice(i, 1);
                break;
            }
        }
    }

    isAdjacentToPlayer(player, target, range = 1.5 * 32) {
        const playerPos = player.getComponent('Position');
        const targetPos = target.getComponent('Position');
        if (!playerPos || !targetPos) return false;
        const dx = targetPos.x - playerPos.x;
        const dy = targetPos.y - playerPos.y;
        return Math.sqrt(dx * dx + dy * dy) <= range;
    }

    isOverlappingPlayer(player, target) {
        const playerPos = player.getComponent('Position');
        if (!playerPos) return false;
        if (!target.hasComponent('TriggerArea')) return false;
        const triggerArea = target.getComponent('TriggerArea');
        // Assume triggerArea has x, y, width, height
        if (
            typeof triggerArea.x === 'number' &&
            typeof triggerArea.y === 'number' &&
            typeof triggerArea.width === 'number' &&
            typeof triggerArea.height === 'number'
        ) {
            return (
                playerPos.x >= triggerArea.x &&
                playerPos.x < triggerArea.x + triggerArea.width &&
                playerPos.y >= triggerArea.y &&
                playerPos.y < triggerArea.y + triggerArea.height
            );
        }
        return false;
    }



    endTurn(source) {
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        if (!gameState || gameState.gameOver) return;
        gameState.transitionLock = false;
        gameState.needsRender = true;
    }
}
