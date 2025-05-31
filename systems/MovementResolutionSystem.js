import { System } from '../core/Systems.js';

export class MovementResolutionSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Position', 'MovementIntent'];
        this.BASE_MOVEMENT_SPEED_PPS = 155; 
    }

    update(deltaTime) {

        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        if (gameState.transitionLock) {
            console.log('MovementResolutionSystem: Skipped update due to transitionLock');
            // Clear any existing movement intents
            this.entityManager.getEntitiesWith(['MovementIntent']).forEach(entity => {
                this.entityManager.removeComponentFromEntity(entity.id, 'MovementIntent');
            });
            return;
        }
        const entities = this.entityManager.getEntitiesWith(this.requiredComponents);

        for (const entity of entities) {
            // Skip entities without MovementIntent
            const intent = entity.getComponent('MovementIntent');
            const pos = entity.getComponent('Position');
            let lastPos = null;
            if (entity.hasComponent('LastPosition')) {
                lastPos = entity.getComponent('LastPosition');
            }
            let deltaX = intent.targetX - pos.x;
            let deltaY = intent.targetY - pos.y;

            if (entity.hasComponent('Projectile')) {

                if (lastPos) {
                    lastPos.x = pos.x;
                    lastPos.y = pos.y;
                }
                pos.x += deltaX;
                pos.y += deltaY;

                // Emit position change event
                
                continue;
            }

            if (entity.hasComponent('Collision').collisions) {
                const collisions = entity.getComponent('Collision').collisions;
                if (!collisions || collisions.length < 1) return;
                
                //console.log(`MovementResolutionSystem: Checking entity ${entity.id} collisions:`, collisions);

                for (const collision of collisions) {
                    //console.log('MovementResolutionSystem: Collision detected:', collision);

                    // Block movement along the colliding axis
                    if (collision.normalX !== 0) {
                        deltaX = 0; // Stop X movement
                        intent.targetX = pos.x; // Adjust intent to stop X movement
                    }
                    if (collision.normalY !== 0) {
                        deltaY = 0; // Stop Y movement
                        intent.targetY = pos.y; // Adjust intent to stop Y movement
                    }
                }
            }

            // Check for potential overlap along the X-axis
            const newX = pos.x + deltaX;
            if (this.wouldOverlap(entity, newX, pos.y)) {
                //console.log('MovementResolutionSystem: Overlap detected along X-axis, stopping X movement.', deltaX);
                deltaX = 0;
                intent.targetX = pos.x; // Stop X movement
            }

            // Check for potential overlap along the Y-axis
            const newY = pos.y + deltaY;
            if (this.wouldOverlap(entity, pos.x, newY)) {
                //console.log('MovementResolutionSystem: Overlap detected along Y-axis, stopping Y movement.', deltaY);
                deltaY = 0;
                intent.targetY = pos.y; // Stop Y movement
            }

            if (lastPos) {
                lastPos.x = pos.x;
                lastPos.y = pos.y;
            }
            // Apply remaining movement
            pos.x += deltaX;
            pos.y += deltaY;

            // Emit position change event
            
        }
    }


    /**
     * Check if moving the entity to (newX, newY) would cause overlap with other entities.
     */
    wouldOverlap(entity, newX, newY) {
        if (entity.hasComponent('Projectile')) { return false; }
        const hitbox = entity.getComponent('Hitbox');
        const entities = this.entityManager.getEntitiesWith(['Position', 'Hitbox']);


        for (const other of entities) {
            if (other === entity || other.hasComponent('Projectile')) continue; // Skip self
            if (other.hasComponent('TriggerArea')) continue;
            const otherPos = other.getComponent('Position');
            const otherHitbox = other.getComponent('Hitbox');

            const thisLeft = newX + (hitbox.offsetX || 0);
            const thisTop = newY + (hitbox.offsetY || 0);
            const thisRight = thisLeft + hitbox.width;
            const thisBottom = thisTop + hitbox.height;

            const otherLeft = otherPos.x + (otherHitbox.offsetX || 0);
            const otherTop = otherPos.y + (otherHitbox.offsetY || 0);
            const otherRight = otherLeft + otherHitbox.width;
            const otherBottom = otherTop + otherHitbox.height;

            if (
                thisLeft < otherRight &&
                thisRight > otherLeft &&
                thisTop < otherBottom &&
                thisBottom > otherTop
            ) {
                return true; // Overlap detected
            }

        }

        return false; // No overlap
    }
}
