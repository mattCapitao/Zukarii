// core/Systems.js
export class System {
    constructor(entityManager, eventBus) {
        this.entityManager = entityManager;
        this.eventBus = eventBus;
        this.requiredComponents = [];
    }

    init() { }

    update() {
        if (this.requiredComponents.length > 0) {
            const entities = this.getEntities();
            entities.forEach(entity => this.processEntity(entity));
        }
    }

    getEntities() {
        if (!this.requiredComponents.length) {
            throw new Error('System must define requiredComponents');
        }
        return this.entityManager.getEntitiesWith(this.requiredComponents);
    }

    processEntity(entity) {
        // console.warn(`processEntity not implemented in ${this.constructor.name}`);
    }

    destroy() { }
}