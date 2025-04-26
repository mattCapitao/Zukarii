import { System } from '../core/Systems.js';

export class MonsterTimerSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['MonsterData', 'InCombat'];
    }

    init() {

    }

    update(deltaTime) {

        const entities = this.getEntities();
        const deltaMs = deltaTime * 1000;

        for (const entity of entities) {
            const combat = entity.getComponent('InCombat');
            if (!combat) continue;
            combat.elapsed += deltaMs;
            const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
            if (combat.elapsed >= combat.duration && gameState) {
                entity.removeComponent('InCombat');
                gameState.needsRender = true;
                //this.eventBus.emit('RenderNeeded');
            }
        }
    }
}