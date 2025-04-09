import { System } from '../core/Systems.js';
import { InCombatComponent } from '../core/Components.js'; 

export class PlayerTimerSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['PlayerState', 'InCombat'];
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

            if (combat.elapsed >= combat.duration) {
                entity.removeComponent('InCombat');
                this.eventBus.emit('LogMessage', { message: 'You are no longer in combat.' });
            }
        }
    }
}