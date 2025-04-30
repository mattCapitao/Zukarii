import { System } from '../core/Systems.js';
import { InCombatComponent } from '../core/Components.js'; 

export class PlayerTimerSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['PlayerState'];
    }

    init() {
        this.gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
    }

    update(deltaTime) {

        const entities = this.getEntities();
        const deltaMs = deltaTime * 1000; 

        for (const entity of entities) {
            /*
            const combat = entity.getComponent('InCombat');
            if (!combat) continue;
            combat.elapsed += deltaMs;
            const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
            if (combat.elapsed >= combat.duration && gameState) {
                entity.removeComponent('InCombat');
                this.eventBus.emit('LogMessage', { message: 'You are no longer in combat.' });
                gameState.needsRender = true;
                //this.eventBus.emit('RenderNeeded');
            }
            */
            if (entity.hasComponent('InCombat')) {
                const combat = entity.getComponent('InCombat');
                combat.elapsed += deltaMs;
                if (combat.elapsed >= combat.duration && this.gameState) {
                    entity.removeComponent('InCombat');
                    this.eventBus.emit('LogMessage', { message: 'You are no longer in combat.' });
                    this.gameState.needsRender = true;
                }
            }

            if (entity.hasComponent('StairLock')) {
                const stairLock = entity.getComponent('StairLock');
                stairLock.elapsed += deltaMs;
                if (stairLock.elapsed >= stairLock.duration && this.gameState) {
                    entity.removeComponent('StairLock');
                }
            }
        }
    }
}



