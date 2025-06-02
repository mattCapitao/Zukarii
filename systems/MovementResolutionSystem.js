import { System } from '../core/Systems.js';

export class MovementResolutionSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Position', 'MovementIntent'];
        this.BASE_MOVEMENT_SPEED_PPS = 155; // Base movement speed in pixels per second
        this.MAX_ACTUAL_SPEED = 320;         // Maximum allowed speed in pixels per second
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
            const intent = entity.getComponent('MovementIntent');
            const pos = entity.getComponent('Position');
            let lastPos = null;
            if (entity.hasComponent('LastPosition')) {
                lastPos = entity.getComponent('LastPosition');
            }
            let deltaX = intent.targetX - pos.x;
            let deltaY = intent.targetY - pos.y;
          
            // Calculate movement speed multiplier (default 100 = 1.0x)
            let speedMultiplier = 100;
            let moveSpeedComp = null;
            if (entity.hasComponent('MovementSpeed')) {
                moveSpeedComp = entity.getComponent('MovementSpeed');
                speedMultiplier = moveSpeedComp.movementSpeed;
            }
           
            // Calculate actual speed in pixels per second, clamp to MAX_ACTUAL_SPEED
            let actualSpeed = this.BASE_MOVEMENT_SPEED_PPS * (speedMultiplier / 100);

            if (entity.hasComponent('InCombat') && entity.hasComponent('MovementSpeed')) {
                actualSpeed *= moveSpeedComp.combatSpeedMultiplier; 
            }

            if (actualSpeed > this.MAX_ACTUAL_SPEED && !entity.hasComponent('Projectile')) actualSpeed = this.MAX_ACTUAL_SPEED;

            // Calculate direction and distance to target
            const dx = intent.targetX - pos.x;
            const dy = intent.targetY - pos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Calculate max distance this frame
            const maxStep = actualSpeed * deltaTime;

            let moveX = 0, moveY = 0;
            if (distance <= maxStep) {
                moveX = dx;
                moveY = dy;
            } else if (distance > 0) {
                moveX = (dx / distance) * maxStep;
                moveY = (dy / distance) * maxStep;
            }

            // Collision handling
            if (entity.hasComponent('Collision').collisions) {
                const collisions = entity.getComponent('Collision').collisions;
                if (!collisions || collisions.length < 1) continue;

                for (const collision of collisions) {
                    if (collision.normalX !== 0) {
                        moveX = 0;
                        intent.targetX = pos.x;
                    }
                    if (collision.normalY !== 0) {
                        moveY = 0;
                        intent.targetY = pos.y;
                    }
                }
            }

            // Overlap checks
            const newX = pos.x + moveX;
            if (this.wouldOverlap(entity, newX, pos.y)) {
                moveX = 0;
                intent.targetX = pos.x;
            }
            const newY = pos.y + moveY;
            if (this.wouldOverlap(entity, pos.x, newY)) {
                moveY = 0;
                intent.targetY = pos.y;
            }

            if (lastPos) {
                lastPos.x = pos.x;
                lastPos.y = pos.y;
            }
            pos.x += moveX;
            pos.y += moveY;

            // Remove MovementIntent if arrived at target
            if (distance <= maxStep) {
                this.entityManager.removeComponentFromEntity(entity.id, 'MovementIntent');
            }
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
            if (other === entity /*|| other.hasComponent('Projectile')*/) continue; // Skip self
            if (other.hasComponent('TriggerArea') || other.hasComponent('Portal') || other.hasComponent('Stair') ) { continue; }
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
