import { System } from '../core/Systems.js';
export class MovementResolutionSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Position', 'MovementIntent'];
        this.BASE_MOVEMENT_SPEED_PPS = 155;
        this.MAX_ACTUAL_SPEED = 320;
    }

    update(deltaTime) {
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        if (gameState.transitionLock) {
            this.entityManager.getEntitiesWith(['MovementIntent']).forEach(entity => {
                this.entityManager.removeComponentFromEntity(entity.id, 'MovementIntent');
            });
            return;
        }
        const entities = this.entityManager.getEntitiesWith(this.requiredComponents);
        // Cache all entities with hitboxes once per frame
        const hitboxEntities = this.entityManager.getEntitiesWith(['Position', 'Hitbox']);

        for (let i = 0; i < entities.length; i++) {
            const entity = entities[i];
            const isPlayer = entity.id === 'player';
            if (isPlayer && gameState.isRangedMode) {
                // In ranged mode, player movement is handled by PlayerControllerSystem
                continue;
            }
            const hasProjectile = entity.hasComponent('Projectile');
            
            const intent = entity.getComponent('MovementIntent');
            const pos = entity.getComponent('Position');
            let lastPos = null;
            if (entity.hasComponent('LastPosition')) {
                lastPos = entity.getComponent('LastPosition');
            }

            let speedMultiplier = 100;
            let moveSpeedComp = null;
            if (entity.hasComponent('MovementSpeed')) {
                moveSpeedComp = entity.getComponent('MovementSpeed');
                speedMultiplier = moveSpeedComp.movementSpeed;
            }
            let actualSpeed = this.BASE_MOVEMENT_SPEED_PPS * (speedMultiplier / 100);
            if (entity.hasComponent('InCombat') && entity.hasComponent('MovementSpeed')) {
                actualSpeed *= moveSpeedComp.combatSpeedMultiplier;
            }
            if (actualSpeed > this.MAX_ACTUAL_SPEED && !hasProjectile) actualSpeed = this.MAX_ACTUAL_SPEED;

            const dx = intent.targetX - pos.x;
            const dy = intent.targetY - pos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const maxStep = actualSpeed * deltaTime;

            let moveX = 0, moveY = 0;
            if (distance <= maxStep) {
                moveX = dx;
                moveY = dy;
            } else if (distance > 0) {
                moveX = (dx / distance) * maxStep;
                moveY = (dy / distance) * maxStep;
            }

            // Only run overlap checks if CollisionSystem predicted a collision
            const hasPredictedCollision = entity.hasComponent('Collision') && entity.getComponent('Collision').collisions.length > 0;

            if (hasPredictedCollision && !hasProjectile) {

                // Path checking for monsters/NPCs
                if (entity.hasComponent('MonsterData')) {
                    const pathResult = this.pathChecking(entity, pos, moveX, moveY, 5, hitboxEntities);
                    moveX = pathResult.moveX;
                    moveY = pathResult.moveY;
                }
                // General overlap checks
                const newX = pos.x + moveX;
                if (this.wouldOverlap(entity, newX, pos.y, hitboxEntities)) {
                    moveX = 0;
                    intent.targetX = pos.x;
                }
                const newY = pos.y + moveY;
                if (this.wouldOverlap(entity, pos.x, newY, hitboxEntities)) {
                    moveY = 0;
                    intent.targetY = pos.y;
                }
            }

            if (lastPos) {
                lastPos.x = pos.x;
                lastPos.y = pos.y;
            }
            pos.x += moveX;
            pos.y += moveY;

            if (distance <= maxStep) {
                this.entityManager.removeComponentFromEntity(entity.id, 'MovementIntent');
            }
        }
    }

    pathChecking(entity, pos, moveX, moveY, framesAhead = 5, hitboxEntities) {
        let testX = pos.x;
        let testY = pos.y;
        let testMoveX = moveX;
        let testMoveY = moveY;
        for (let i = 0; i < framesAhead; i++) {
            testX += testMoveX;
            testY += testMoveY;
            if (this.wouldOverlap(entity, testX, testY, hitboxEntities)) {
                if (!this.wouldOverlap(entity, testX, pos.y, hitboxEntities)) {
                    return { moveX: testMoveX * 1.25, moveY: 0 };
                }
                if (!this.wouldOverlap(entity, pos.x, testY, hitboxEntities)) {
                    return { moveX: 0, moveY: testMoveY * 1.25};
                }
                return { moveX: 0, moveY: 0 };
            }
        }
        return { moveX, moveY };
    }

    wouldOverlap(entity, newX, newY, hitboxEntities) {
        
        const hitbox = entity.getComponent('Hitbox');
        if (!hitbox) return false;
        for (let i = 0; i < hitboxEntities.length; i++) {
            const other = hitboxEntities[i];
            if (other === entity) continue;
            if (other.hasComponent('TriggerArea') ||
                (entity.id === 'player' && other.hasComponent('Portal')) ||
                (entity.id === 'player' && other.hasComponent('Stair'))
            ) continue;
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
                return true;
            }
        }
        return false;
    }
}

