import { System } from '../core/Systems.js';

export class PlayerCollisionSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['PlayerStateComponent', 'Collision'];
        this.sfxQueue = this.entityManager.getEntity('gameState').getComponent('AudioQueue').SFX || []
    }

    update(deltaTime) {
        const player = this.entityManager.getEntitiesWith(this.requiredComponents);

        const collision = player.getComponent('Collision');

        for (const collisionData of collision.collisions) {
            const target = this.entityManager.getEntity(collisionData.targetId);
            console.log(`PlayerCollisionSystem: Player collided with ${target.id}`);
        }
        player.removeComponent('Collision');
    }
}