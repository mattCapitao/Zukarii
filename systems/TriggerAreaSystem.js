import { System } from '../core/Systems.js';

export class TriggerAreaSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.lastOverlaps = new Set();
        this._debuggedIds = new Set();
        this.activeTrackCounts = new Map(); // trackId -> count of overlapping areas
        this.pendingFadeOuts = new Map(); // trackId -> fadeOut time
    }

    update(deltaTime) {
        const player = this.entityManager.getEntity('player');
        if (!player) return;
        const playerPos = player.getComponent('Position');
        const playerHitbox = player.getComponent('Hitbox');
        const triggerAreas = this.entityManager.getEntitiesWith(['TriggerArea', 'Position', 'Hitbox']);
        const currentOverlaps = new Set();

        // Count overlaps per track
        const trackOverlapCounts = new Map();

        for (const triggerEntity of triggerAreas) {
            const triggerArea = triggerEntity.getComponent('TriggerArea');
            if (!this._debuggedIds.has(triggerEntity.id)) {
               
                this._debuggedIds.add(triggerEntity.id);
            }
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
                if (triggerArea.action === 'PlayTrackControl' && triggerArea.data && triggerArea.data.track) {
                    const track = triggerArea.data.track;
                    trackOverlapCounts.set(track, (trackOverlapCounts.get(track) || 0) + 1);
                }
            } else {
               // this.eventBus.emit('PlayTrackControl', { track: 'fountain_loop', play: false, fadeOut: 2.0 });
               // console.log(`TriggerAreaSystem: Player NOT overlapping with ${triggerEntity.id}, track: ${triggerArea.data?.track}`);
            }
        }

        // Handle exited triggers
        for (const id of this.lastOverlaps) {
            if (!currentOverlaps.has(id)) {
                const triggerEntity = this.entityManager.getEntity(id);
                if (triggerEntity) {
                    const triggerArea = triggerEntity.getComponent('TriggerArea');
                    if (triggerArea && triggerArea.stopAction && triggerArea.stopData) {
                        if (triggerArea.stopAction === 'PlayTrackControl' && triggerArea.stopData && triggerArea.stopData.track) {
                            const track = triggerArea.stopData.track;
                            const prevCount = this.activeTrackCounts.get(track) || 1;
                            if (prevCount === 1) {
                                this.activeTrackCounts.delete(track);

                                // Debounce: schedule fade-out, but allow cancel if re-entered
                                const fadeOut = triggerArea.stopData.fadeOut || 0.5;
                                if (this.pendingFadeOuts.has(track)) {
                                    clearTimeout(this.pendingFadeOuts.get(track));
                                }
                                const timeoutId = setTimeout(() => {
                                    this.eventBus.emit(triggerArea.stopAction, triggerArea.stopData);
                                    this.pendingFadeOuts.delete(track);
                                }, fadeOut * 1000);
                                this.pendingFadeOuts.set(track, timeoutId);
                            } else {
                                this.activeTrackCounts.set(track, prevCount - 1);
                            }
                        } else {
                            this.eventBus.emit(triggerArea.stopAction, triggerArea.stopData);
                        }
                    }
                }
            }
        }

        // Handle entered triggers
        for (const id of currentOverlaps) {
            if (!this.lastOverlaps.has(id)) {
                const triggerEntity = this.entityManager.getEntity(id);
                if (triggerEntity) {
                    const triggerArea = triggerEntity.getComponent('TriggerArea');
                    if (triggerArea && triggerArea.action && triggerArea.data) {
                        if (triggerArea.action === 'PlayTrackControl' && triggerArea.data && triggerArea.data.track) {
                            const track = triggerArea.data.track;
                            const prevCount = this.activeTrackCounts.get(track) || 0;
                            // Cancel pending fade-out if any
                            if (this.pendingFadeOuts.has(track)) {
                                clearTimeout(this.pendingFadeOuts.get(track));
                                this.pendingFadeOuts.delete(track);
                            }
                            if (prevCount === 0) {
                                this.activeTrackCounts.set(track, 1);
                                this.eventBus.emit(triggerArea.action, triggerArea.data);
                            } else {
                                this.activeTrackCounts.set(track, prevCount + 1);
                            }
                        } else {
                            this.eventBus.emit(triggerArea.action, triggerArea.data);
                        }
                    }
                }
            }
        }

        this.lastOverlaps = currentOverlaps;
    }
}

