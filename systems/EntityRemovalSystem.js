import { System } from '../core/Systems.js';

export class EntityRemovalSystem extends System {
    constructor(entityManager) {
        super(entityManager);
        this.requiredComponents = ['RemoveEntity'];
    }

    update(deltaTime) {
        const entitiesToRemove = this.entityManager.getEntitiesWith(this.requiredComponents);

        for (const entity of entitiesToRemove) {
            //console.log(`EntityRemovalSystem: Removing entity ${entity.id}`);
            this.entityManager.removeEntity(entity.id);
        }
    }
}
