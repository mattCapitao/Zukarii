// systems/TriggerAreaSystem.js
import { System } from '../core/Systems.js';

export class TriggerAreaSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.lastOverlaps = new Set();
        this._debuggedIds = new Set();
        this.lastEnterTimestamps = new Map();
        this.ENTER_COOLDOWN_MS = 1250; // 1 second, adjust as needed
        // No audio-specific or track-specific state
    }

    update(deltaTime) {
        const player = this.entityManager.getEntity('player');
        if (!player) return;
        const playerPos = player.getComponent('Position');
        const playerHitbox = player.getComponent('Hitbox');
        const triggerAreas = this.entityManager.getEntitiesWith(['TriggerArea', 'Position', 'Hitbox']);
        const currentOverlaps = new Set();

        for (const triggerEntity of triggerAreas) {
            const triggerArea = triggerEntity.getComponent('TriggerArea');
            if (triggerArea.mode !== 'Presence') continue;
            const triggerPos = triggerEntity.getComponent('Position');
            const triggerHitbox = triggerEntity.getComponent('Hitbox');

            const playerLeft = playerPos.x + (playerHitbox.offsetX || 0);
            const playerRight = playerLeft + playerHitbox.width;
            const playerTop = playerPos.y + (playerHitbox.offsetY || 0);
            const playerBottom = playerTop + playerHitbox.height;

            const triggerLeft = triggerPos.x + (triggerHitbox.offsetX || 0);
            const triggerRight = triggerLeft + triggerHitbox.width;
            const triggerTop = triggerPos.y + (triggerHitbox.offsetY || 0);
            const triggerBottom = triggerTop + triggerHitbox.height;

            if (
                playerLeft < triggerRight &&
                playerRight > triggerLeft &&
                playerTop < triggerBottom &&
                playerBottom > triggerTop
            ) {
                currentOverlaps.add(triggerEntity.id);
            }
        }

        // Handle exited triggers
        for (const id of this.lastOverlaps) {
            if (!currentOverlaps.has(id)) {
                const triggerEntity = this.entityManager.getEntity(id);
                if (triggerEntity) {
                    const triggerArea = triggerEntity.getComponent('TriggerArea');
                    if (triggerArea && triggerArea.stopAction && triggerArea.stopData) {
                        this.eventBus.emit(triggerArea.stopAction, triggerArea.stopData);
                    }
                }
            }
        }

        // Handle entered triggers
        for (const id of currentOverlaps) {
            if (!this.lastOverlaps.has(id)) {
                const now = Date.now();
                const lastEnter = this.lastEnterTimestamps.get(id) || 0;
                if (now - lastEnter >= this.ENTER_COOLDOWN_MS) {
                    const triggerEntity = this.entityManager.getEntity(id);
                    if (triggerEntity) {
                        const triggerArea = triggerEntity.getComponent('TriggerArea');
                        if (triggerArea && triggerArea.action && triggerArea.data) {
                            this.eventBus.emit(triggerArea.action, triggerArea.data);
                            this.lastEnterTimestamps.set(id, now);
                        }
                    }
                }
            }
        }

        this.lastOverlaps = currentOverlaps;
    }
}
