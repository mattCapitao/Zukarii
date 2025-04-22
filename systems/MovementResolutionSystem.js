import { System } from '../core/Systems.js';
import {NeedsRenderComponent, } from '../core/Components.js';

export class MovementResolutionSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Position', 'MovementIntent'];
    }

    update(deltaTime) {
        const entities = this.entityManager.getEntitiesWith(this.requiredComponents);

        for (const entity of entities) {
            let entityCanMove = entity.hasComponent('MovementIntent') && entity.hasComponent('Position');
            let blockedBy = '';

            const intent = entity.getComponent('MovementIntent');
            //console.log(`MovementResolutionSystem: Processing entity ${entity.id} with intent:`, intent);

            const pos = entity.getComponent('Position');
            let newX = intent.targetX;
            let newY = intent.targetY;

            if (entity.hasComponent('Collision')) {
                //console.log(`MovementResolutionSystem: Entity ${entity.id} has Collision component`, entity.getComponent('Collision'));
                const collisionComponent = entity?.getComponent('Collision');
                const collisions = collisionComponent?.collisions;
                //console.log(`MovementResolutionSystem: Entity ${entity.id} has collisions:`, collisions);

                if (collisions?.length > 0) {
                    // Calculate movement components
                    const moveX = intent.targetX - pos.x;
                    const moveY = intent.targetY - pos.y;

                    let canMoveX = true;
                    let canMoveY = true;
                    let blockedByX = '';
                    let blockedByY = '';

                    for (const collision of collisions) {
                        const targetEntity = this.entityManager.getEntity(collision.targetId);
                        if (!targetEntity) {
                            console.warn(`MovementResolutionSystem: Target entity ${collision.targetId} not found for ${entity.id}`);
                            continue;
                        }
                        if (!entity.hasComponent('Projectile') && targetEntity.hasComponent('Projectile')) {
                            continue;
                        }

                        const targetPos = targetEntity.getComponent('Position');

                        // Check X component
                        const currentDx = targetPos.x - pos.x;
                        const intendedDx = targetPos.x - (pos.x + moveX);
                        const currentDistX = Math.abs(currentDx);
                        const intendedDistX = Math.abs(intendedDx);

                        if (intendedDistX < currentDistX) {
                            // Moving closer in X direction, block it
                            canMoveX = false;
                            blockedByX = collision.targetId;
                            //console.log(`MovementResolutionSystem: Blocking X movement for ${entity.id} as it would increase overlap with ${collision.targetId}`);
                        }

                        // Check Y component
                        const currentDy = targetPos.y - pos.y;
                        const intendedDy = targetPos.y - (pos.y + moveY);
                        const currentDistY = Math.abs(currentDy);
                        const intendedDistY = Math.abs(intendedDy);

                        if (intendedDistY < currentDistY) {
                            // Moving closer in Y direction, block it
                            canMoveY = false;
                            blockedByY = collision.targetId;
                            //console.log(`MovementResolutionSystem: Blocking Y movement for ${entity.id} as it would increase overlap with ${collision.targetId}`);
                        }
                    }

                    // Apply allowed movement components
                    if (!canMoveX && !canMoveY) {
                        entityCanMove = false;
                        blockedBy = `${blockedByX} (X), ${blockedByY} (Y)`;
                    } else {
                        entityCanMove = true;
                        newX = canMoveX ? intent.targetX : pos.x;
                        newY = canMoveY ? intent.targetY : pos.y;
                        //console.log(`MovementResolutionSystem: Allowing partial movement for ${entity.id} - X: ${canMoveX}, Y: ${canMoveY}`);
                    }
                } else {
                    //console.log(`MovementResolutionSystem: No collisions found for Entity ${entity.id} having collision component`, collisionComponent);
                    entity.removeComponent('Collision');
                }
            }

            if (entityCanMove) {
                //console.log(`MovementResolutionSystem: Moving ${entity.id} to (${newX}, ${newY})`);

                const lastPos = entity.getComponent('LastPosition');

                lastPos.x = pos.x;
                lastPos.y = pos.y;

                pos.x = newX;
                pos.y = newY;

                if (!entity.hasComponent('NeedsRender')) {
                    this.entityManager.addComponentToEntity(entity.id, new NeedsRenderComponent(pos.x, pos.y));
                }

                this.eventBus.emit('PositionChanged', { entityId: entity.id, x: pos.x, y: pos.y });
                //console.log(`MovementResolutionSystem: Entity ${entity.id} moved to (${pos.x}, ${pos.y})`);
            } else {
                //console.log(`MovementResolutionSystem: Entity ${entity.id} blocked by ${blockedBy}`);
            }

            entity.removeComponent('MovementIntent');
        }
    }
}

