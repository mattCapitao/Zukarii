import { System } from '../core/Systems.js';
import { NeedsRenderComponent } from '../core/Components.js';

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
            const pos = entity.getComponent('Position');
            let newX = intent.targetX;
            let newY = intent.targetY;

            if (entity.hasComponent('Collision')) {
                const collisionComponent = entity.getComponent('Collision');
                const collisions = collisionComponent.collisions;
                if (collisions?.length > 0) {
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
                        // Skip if projectile-target collision is already handled
                        if (!entity.hasComponent('Projectile') && targetEntity.hasComponent('Projectile')) {
                            continue;
                        }
                        const targetPos = targetEntity.getComponent('Position');
                        const isCurrentCollision = collision.collisionType === "current";
                        let currentDx = isCurrentCollision ? pos.x - targetPos.x : targetPos.x - pos.x;
                        let intendedDx = isCurrentCollision ? (pos.x + moveX) - targetPos.x : targetPos.x - (pos.x + moveX);
                        let currentDistX = Math.abs(currentDx);
                        let intendedDistX = Math.abs(intendedDx);
                        if (intendedDistX < currentDistX) {
                            canMoveX = false;
                            blockedByX = collision.targetId;
                        }
                        let currentDy = isCurrentCollision ? pos.y - targetPos.y : targetPos.y - pos.y;
                        let intendedDy = isCurrentCollision ? (pos.y + moveY) - targetPos.y : targetPos.y - (pos.y + moveY);
                        let currentDistY = Math.abs(currentDy);
                        let intendedDistY = Math.abs(intendedDy);
                        if (intendedDistY < currentDistY) {
                            canMoveY = false;
                            blockedByY = collision.targetId;
                        }
                    }

                    // Allow sliding: move in any unblocked axis
                    entityCanMove = canMoveX || canMoveY;
                    newX = canMoveX ? intent.targetX : pos.x;
                    newY = canMoveY ? intent.targetY : pos.y;
                    blockedBy = canMoveX && canMoveY ? '' : `${blockedByX} (X), ${blockedByY} (Y)`;
                } else {
                    entity.removeComponent('Collision');
                }
            }

            if (entityCanMove) {
                console.log(`MovementResolutionSystem: Moving ${entity.id} to (${newX}, ${newY})`);

                const lastPos = entity.getComponent('LastPosition');
                lastPos.x = pos.x;
                lastPos.y = pos.y;

                pos.x = newX;
                pos.y = newY;

                if (!entity.hasComponent('NeedsRender')) {
                    this.entityManager.addComponentToEntity(entity.id, new NeedsRenderComponent(pos.x, pos.y));
                }

                this.eventBus.emit('PositionChanged', { entityId: entity.id, x: pos.x, y: pos.y });
                console.log(`MovementResolutionSystem: Entity ${entity.id} moved to (${pos.x}, ${pos.y})`);
            } else {
                console.log(`MovementResolutionSystem: Entity ${entity.id} blocked by ${blockedBy}`);
            }

            entity.removeComponent('MovementIntent');
        }
    }
}