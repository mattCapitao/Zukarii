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
            if (actualSpeed > this.MAX_ACTUAL_SPEED && !entity.hasComponent('Projectile')) actualSpeed = this.MAX_ACTUAL_SPEED;

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

            // Path checking for monsters/NPCs
            if (entity.hasComponent('MonsterData')) {
                const pathResult = this.pathChecking(entity, pos, moveX, moveY, 2, hitboxEntities);
                moveX = pathResult.moveX;
                moveY = pathResult.moveY;
            }

            // Overlap checks
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

    pathChecking(entity, pos, moveX, moveY, framesAhead = 10, hitboxEntities) {
        if (entity.id === 'player' || entity.hasComponent('Projectile')) return { moveX, moveY };
        let testX = pos.x;
        let testY = pos.y;
        let testMoveX = moveX;
        let testMoveY = moveY;
        for (let i = 0; i < framesAhead; i++) {
            testX += testMoveX;
            testY += testMoveY;
            if (this.wouldOverlap(entity, testX, testY, hitboxEntities)) {
                if (!this.wouldOverlap(entity, testX, pos.y, hitboxEntities)) {
                    return { moveX: testMoveX, moveY: 0 };
                }
                if (!this.wouldOverlap(entity, pos.x, testY, hitboxEntities)) {
                    return { moveX: 0, moveY: testMoveY };
                }
                return { moveX: 0, moveY: 0 };
            }
        }
        return { moveX, moveY };
    }

    wouldOverlap(entity, newX, newY, hitboxEntities) {
        if (entity.hasComponent('Projectile')) return false;
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

/*

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

            // Path checking for monsters/NPCs
            if (entity.hasComponent('MonsterData')) {
                const pathResult = this.pathChecking(entity, pos, moveX, moveY, 2);
                moveX = pathResult.moveX;
                moveY = pathResult.moveY;
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

    pathChecking(entity, pos, moveX, moveY, framesAhead = 5) {
        // Only apply to monsters/NPCs
        if (entity.id === 'player' || entity.hasComponent('Projectile')) return { moveX, moveY };

        let testX = pos.x;
        let testY = pos.y;
        let testMoveX = moveX;
        let testMoveY = moveY;

        for (let i = 0; i < framesAhead; i++) {
            testX += testMoveX;
            testY += testMoveY;
            if (this.wouldOverlap(entity, testX, testY)) {
                // Try sliding along X only
                if (!this.wouldOverlap(entity, testX, pos.y)) {
                    return { moveX: testMoveX, moveY: 0 };
                }
                // Try sliding along Y only
                if (!this.wouldOverlap(entity, pos.x, testY)) {
                    return { moveX: 0, moveY: testMoveY };
                }
                // If both axes blocked, stop movement
                return { moveX: 0, moveY: 0 };
            }
        }
        // No predicted collision, proceed as normal
        return { moveX, moveY };
    }




    wouldOverlap(entity, newX, newY) {
        if (entity.hasComponent('Projectile')) { return false; }
        const hitbox = entity.getComponent('Hitbox');
        const entities = this.entityManager.getEntitiesWith(['Position', 'Hitbox']);

        for (const other of entities) {
            if (other === entity ) continue; // Skip self
            if (other.hasComponent('TriggerArea') ||
                (entity.id === 'player' && other.hasComponent('Portal')) ||
                (entity.id === 'player' && other.hasComponent('Stair'))
            ){ continue; }

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

*/