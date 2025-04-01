// systems/PlayerTimerSystem.js

import { System } from '../core/Systems.js';
export class PlayerTimerSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.timers = new Map();
        this.requiredComponents = ['PlayerState'];
        // Map timer names to expiration events
        this.timerEvents = {
            'combat': 'CombatEnded'
            // Add more later: 'attack': 'AttackReady', 'buff': 'BuffExpired'
        };
    }

    init() {
        this.eventBus.on('PlayerInitiatedAttack', ({ entityId }) => this.manageTimer(entityId, 'combat', 3000));
        this.eventBus.on('PlayerWasHit', ({ entityId }) => this.manageTimer(entityId, 'combat', 3000));
    }

    update(deltaTime) {
        const deltaMs = deltaTime * 1000;

        for (const [entityId, timers] of this.timers) {
            const entity = this.entityManager.getEntity(entityId);
            if (!entity) {
                this.timers.delete(entityId);
                continue;
            }

            for (const [timerName, timer] of timers) {
                timer.elapsed += deltaMs;
                if (timer.elapsed >= timer.duration) {
                    const eventName = this.timerEvents[timerName];
                    if (eventName) {
                        this.eventBus.emit(eventName, { entityId });
                        timers.delete(timerName); // Clear expired timer
                    }
                }
            }
            /*
            // Special case for combat flag
            const playerState = entity.getComponent('PlayerState');
            if (!timers.has('combat') && playerState.isInCombat) {
                playerState.isInCombat = false; // Optional: Sync state directly
            }
            */
        }
    }

    manageTimer(entityId, timerName, duration) {
        if (!this.timers.has(entityId)) {
            this.timers.set(entityId, new Map());
        }
        const timers = this.timers.get(entityId);
        timers.set(timerName, {
            duration: duration,
            elapsed: 0
        });
    }

    clearTimers(entityId) {
        this.timers.delete(entityId);
    }
}