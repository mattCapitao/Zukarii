// PlayerCollisionSystem.js
import { System } from '../core/Systems.js';
import { NeedsRenderComponent } from '../core/Components.js';

export class PlayerCollisionSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['PlayerStateComponent', 'Collision'];
        this.sfxQueue = this.entityManager.getEntity('gameState').getComponent('AudioQueue').SFX || [];
    }

    update(deltaTime) {
        //console.log('PlayerCollisionSystem: Running update');
        const player = this.entityManager.getEntity('player');
        if (!player) return;

        const collision = player.getComponent('Collision');
        if (collision) console.log('PlayerCollisionSystem: Collision component:', collision);
        const position = player.getComponent('Position');
        //const intent = player.getComponent('MovementIntent');
        const attackSpeed = player.getComponent('AttackSpeed');
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');

        if (!collision ||  !gameState || gameState.gameOver || gameState.transitionLock) {
            if (collision) player.removeComponent('Collision');
            return;
        }

        let moved = false;
        for (const collisionData of collision.collisions) {
            const target = this.entityManager.getEntity(collisionData.targetId);
            if (!target) {
                console.warn(`PlayerCollisionSystem: Target entity ${collisionData.targetId} not found for player ${player.id}`);
                continue; // Skip if target entity is not found
            }
            console.log(`PlayerCollisionSystem: Player collided with ${target.id}`);
            


            if (target.hasComponent('Wall')) {
                // Block movement
                moved = false;
                break;
            }
            if (target.hasComponent('MonsterData') && target.getComponent('Health').hp > 0) {
                if (attackSpeed.elapsedSinceLastAttack >= attackSpeed.attackSpeed) {
                    this.eventBus.emit('MeleeAttack', { targetEntityId: target.id });
                    attackSpeed.elapsedSinceLastAttack = 0;
                    this.endTurn('meleeAttack');
                }
                moved = false;
                break;
            }
            if (target.hasComponent('Fountain')) {
                const levelEntity = this.entityManager.getEntitiesWith(['Map', 'Tier']).find(e => e.getComponent('Tier').value === gameState.tier);
                this.eventBus.emit('UseFountain', { fountainEntityId: target.id, tierEntityId: levelEntity.id });
                this.endTurn('useFountain');
                moved = false;
                break;
            }
            if (target.hasComponent('LootData')) {
                const pos = target.getComponent('Position');

                this.eventBus.emit('PickupTreasure', { x: pos.x , y: pos.y  });
                this.endTurn('pickupLoot');
                moved = false;
                break;
            }
            if (target.hasComponent('Stair')) {
                const levelTransition = this.entityManager.getEntity('gameState').getComponent('LevelTransition');
                if (levelTransition && levelTransition.pendingTransition === null) {
                    const stairComp = target.getComponent('Stair');
                    if (stairComp) console.log(`PlayerCollisionSystem: Stair component:`, stairComp);
                    if (stairComp.direction === 'down') {
                        levelTransition.pendingTransition = 'down';
                        this.endTurn('transitionDown');
                    } else if (stairComp.direction === 'up') {
                        levelTransition.pendingTransition = 'up';
                        this.endTurn('transitionUp');
                    }
                    moved = false;
                    break;
                }
            }
            if (target.hasComponent('Portal')) {
                this.sfxQueue.push({ sfx: 'portal0', volume: 0.5 });
                const levelTransition = this.entityManager.getEntity('gameState').getComponent('LevelTransition');
                if (levelTransition && levelTransition.pendingTransition === null) {
                    levelTransition.pendingTransition = 'portal';
                    this.endTurn('transitionPortal');
                }
                moved = false;
                break;
            }
            if (target.hasComponent('Floor')) {
                moved = true; // Allow movement
            }
        }

        // Apply movement if no blocking collisions
        if (moved) {
            position.x = pos.x;
            position.y = pos.y;
            this.entityManager.addComponentToEntity('player', new NeedsRenderComponent(position.x, position.y));
            gameState.needsRender = true;
        }

        // Clear collision and intent
        player.removeComponent('Collision');
        player.removeComponent('MovementIntent');
    }

    endTurn(source) {
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        if (!gameState || gameState.gameOver) return;

        this.eventBus.emit('TurnEnded');
        gameState.transitionLock = false;
        gameState.needsRender = true;
    }
}