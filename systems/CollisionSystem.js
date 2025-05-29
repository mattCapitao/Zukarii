import { System } from '../core/Systems.js';
import { CollisionComponent } from '../core/Components.js';

export class CollisionSystem extends System {
    constructor(entityManager) {
        super(entityManager);
        this.requiredComponents = ['Position', 'Hitbox'];
    }

    update(deltaTime) {
        const entities = this.entityManager.getEntitiesWith(['Position', 'Hitbox']);
        const movingEntities = this.entityManager.getEntitiesWith(['Position', 'Hitbox', 'MovementIntent']);

        // Clear previous collision results
        for (const entity of entities) {
            if (entity.hasComponent('Collision')) {
                entity.getComponent('Collision').collisions = [];
            }
        }

        // Detect collisions for moving entities
        for (const mover of movingEntities) {
            const moverPos = mover.getComponent('Position');
            const moverHitbox = mover.getComponent('Hitbox');
            const intent = mover.getComponent('MovementIntent');

            const deltaX = intent.targetX - moverPos.x;
            const deltaY = intent.targetY - moverPos.y;

            const range = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            const nearbyEntities = entities.filter(target => this.isWithinProjectedPath(
                {
                    x: moverPos.x + (moverHitbox.offsetX || 0),
                    y: moverPos.y + (moverHitbox.offsetY || 0),
                    width: moverHitbox.width,
                    height: moverHitbox.height
                },
                {
                    x: target.getComponent('Position').x + (target.getComponent('Hitbox').offsetX || 0),
                    y: target.getComponent('Position').y + (target.getComponent('Hitbox').offsetY || 0),
                    width: target.getComponent('Hitbox').width,
                    height: target.getComponent('Hitbox').height
                },
                deltaX,
                deltaY
            ));


            for (const target of nearbyEntities) {
                if (mover === target) continue;

                const targetPos = target.getComponent('Position');
                const targetHitbox = target.getComponent('Hitbox');

                const collision = this.sweptAABB(
                    {
                        x: moverPos.x + (moverHitbox.offsetX || 0),
                        y: moverPos.y + (moverHitbox.offsetY || 0),
                        width: moverHitbox.width,
                        height: moverHitbox.height
                    },
                    {
                        x: targetPos.x + (targetHitbox.offsetX || 0),
                        y: targetPos.y + (targetHitbox.offsetY || 0),
                        width: targetHitbox.width,
                        height: targetHitbox.height
                    },
                    deltaX,
                    deltaY
                );

                if (collision) {
                    if (!mover.hasComponent('Collision')) {
                        mover.addComponent(new CollisionComponent());
                    }

                    mover.getComponent('Collision').collisions.push({
                        moverId: mover.id,
                        targetId: target.id,
                        collisionType: collision.entryTime === 0 ? "current" : "dynamic",
                        normalX: collision.normalX,
                        normalY: collision.normalY,
                        distance: collision.entryTime * range,
                    });

                }
            }
        }
    }

    // Helper function to check if a target is within range
    isWithinRange(moverPos, targetPos, range) {
        const dx = moverPos.x - targetPos.x;
        const dy = moverPos.y - targetPos.y;
        return dx * dx + dy * dy <= range * range;
    }

    // Helper function to check if a target is within the mover's projected path
    isWithinProjectedPath(mover, target, deltaX, deltaY) {
        const moverLeft = mover.x;
        const moverRight = mover.x + mover.width;
        const moverTop = mover.y;
        const moverBottom = mover.y + mover.height;

        const targetLeft = target.x;
        const targetRight = target.x + target.width;
        const targetTop = target.y;
        const targetBottom = target.y + target.height;

        // Expand the mover's bounding box to include its projected path
        const pathLeft = Math.min(moverLeft, moverLeft + deltaX);
        const pathRight = Math.max(moverRight, moverRight + deltaX);
        const pathTop = Math.min(moverTop, moverTop + deltaY);
        const pathBottom = Math.max(moverBottom, moverBottom + deltaY);

        // Check if the target's bounding box overlaps with the projected path
        return (
            pathLeft < targetRight &&
            pathRight > targetLeft &&
            pathTop < targetBottom &&
            pathBottom > targetTop
        );
    }

    // Swept AABB collision detection
    sweptAABB(mover, target, deltaX, deltaY) {
        //console.log(`Swept AABB called with : mover(${mover.x}, ${mover.y}), target(${target.x}, ${target.y}), deltaX: ${deltaX}, deltaY: ${deltaY}`);
        const moverLeft = mover.x;
        const moverRight = mover.x + mover.width;
        const moverTop = mover.y;
        const moverBottom = mover.y + mover.height;

        const targetLeft = target.x;
        const targetRight = target.x + target.width;
        const targetTop = target.y;
        const targetBottom = target.y + target.height;

        let xEntry, xExit, yEntry, yExit;

        // Handle X-axis movement
        if (deltaX === 0) {
            xEntry = -Infinity;
            xExit = Infinity;
        } else {
            xEntry = deltaX > 0
                ? (targetLeft - moverRight) / deltaX
                : (targetRight - moverLeft) / deltaX;
            xExit = deltaX > 0
                ? (targetRight - moverLeft) / deltaX
                : (targetLeft - moverRight) / deltaX;
        }

        // Handle Y-axis movement
        if (deltaY === 0) {
            yEntry = -Infinity;
            yExit = Infinity;
        } else {
            yEntry = deltaY > 0
                ? (targetTop - moverBottom) / deltaY
                : (targetBottom - moverTop) / deltaY;
            yExit = deltaY > 0
                ? (targetBottom - moverTop) / deltaY
                : (targetTop - moverBottom) / deltaY;
        }

        const entryTime = Math.max(xEntry, yEntry);
        const exitTime = Math.min(xExit, yExit);

        if (entryTime > exitTime || (xEntry < 0 && yEntry < 0) || xEntry > 1 || yEntry > 1) {
            return null; // No collision
        }

        const normalX = xEntry > yEntry ? (deltaX > 0 ? -1 : 1) : 0;
        const normalY = xEntry <= yEntry ? (deltaY > 0 ? -1 : 1) : 0;

        return { entryTime, normalX, normalY };
    }

}
