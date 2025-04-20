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

        // Detect collisions at intended positions
        for (const mover of movingEntities) {
            const moverPos = mover.getComponent('Position');
            const moverHitbox = mover.getComponent('Hitbox');
            const intent = mover.getComponent('MovementIntent');

            for (const target of entities) {
                if (mover === target) continue;

                const targetPos = target.getComponent('Position');
                const targetHitbox = target.getComponent('Hitbox');

                // Check collision at intended position
                if (this.isColliding(
                    { x: intent.targetX, y: intent.targetY },
                    moverHitbox,
                    targetPos,
                    targetHitbox
                )) {
                    console.log(`CollisionSystem: Collision detected: ${mover.id} (collider) -> ${target.id} (collided)`);

                    // Add collision results
                    if (!mover.hasComponent('Collision')) {
                        mover.addComponent(new CollisionComponent());
                    }
                    if (!target.hasComponent('Collision') ){
                        target.addComponent(new CollisionComponent());
                    }

                    mover.getComponent('Collision').collisions.push({
                        moverId: mover.id,
                        targetId: target.id,
                        collisionType: "dynamic"
                    });

                    target.getComponent('Collision').collisions.push({
                        moverId: mover.id,
                        targetId: target.id,
                        collisionType: "dynamic"
                    });

                }
            }
            const moverCollision = mover?.getComponent('Collision');
            if (moverCollision) {
                console.log(`CollisionSystem: ${mover.id} collisions:`, moverCollision.collisions);
            }
           
        }
    }



    isColliding(posA, hitboxA, posB, hitboxB) {
        return (
            posA.x + hitboxA.offsetX < posB.x + hitboxB.offsetX + hitboxB.width &&
            posA.x + hitboxA.offsetX + hitboxA.width > posB.x + hitboxB.offsetX &&
            posA.y + hitboxA.offsetY < posB.y + hitboxB.offsetY + hitboxB.height &&
            posA.y + hitboxA.offsetY + hitboxA.height > posB.y + hitboxB.offsetY
        );
    }
}
