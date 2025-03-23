// systems/ExplorationSystem.js - Updated with Debug Logging
import { System } from '../core/Systems.js';

export class ExplorationSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Position', 'PlayerState'];
    }

    init() {
        this.eventBus.on('PositionChanged', (data) => {
            if (data.entityId === 'player') {
                this.updateExploration();
            }
        });
        this.eventBus.on('InitializePlayer', () => {
            console.log('ExplorationSystem: InitializePlayer event received, setting initial visible radius');
            this.updateExploration();
        });
        this.eventBus.on('LightingStateChanged', (data) => {
            console.log('ExplorationSystem: LightingStateChanged event received, visibleRadius:', data.visibleRadius);
            const renderState = this.entityManager.getEntity('renderState').getComponent('RenderState');
            renderState.visibleRadius = data.visibleRadius;
            console.log('ExplorationSystem: Updated renderState:', renderState);
            this.updateExploration();
        });
    }

    isTileVisible(playerX, playerY, targetX, targetY, walls, renderState) {
        let x0 = playerX;
        let y0 = playerY;
        const x1 = targetX;
        const y1 = targetY;

        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;

        const visibleRadius = renderState.visibleRadius;
        const dxTarget = Math.abs(targetX - playerX);
        const dyTarget = Math.abs(targetY - playerY);
        const distanceToTarget = Math.sqrt(dxTarget * dxTarget + dyTarget * dyTarget);

        if (distanceToTarget <= visibleRadius) {
            renderState.activeRenderZone.add(`${targetX},${targetY}`);
            return true;
        }

        while (true) {
            const tileKey = `${x0},${y0}`;
            const isWall = walls.some(w => {
                const pos = w.getComponent('Position');
                return pos.x === x0 && pos.y === y0;
            });
            if (isWall && (x0 !== playerX || y0 !== playerY)) {
                renderState.activeRenderZone.add(tileKey);
                return false;
            }
            if (x0 === x1 && y0 === y1) break;
            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x0 += sx;
            }
            if (e2 < dx) {
                err += dx;
                y0 += sy;
            }
        }
        return true;
    }

    updateExploration() {
        const player = this.entityManager.getEntity('player');
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const renderState = this.entityManager.getEntity('renderState').getComponent('RenderState');
        const state = this.entityManager.getEntity('state');
        if (!player || !gameState || !renderState || !state) {
            console.warn('ExplorationSystem: Missing required entities or components');
            return;
        }

        console.log(`ExplorationSystem: Updating exploration - tier: ${gameState.tier}, player position: (${player.getComponent('Position').x}, ${player.getComponent('Position').y}), visibleRadius: ${renderState.visibleRadius}`);
        console.log('ExplorationSystem: RenderState:', renderState);

        const playerState = player.getComponent('PlayerState');
        const playerPos = player.getComponent('Position');
        const playerX = playerPos.x;
        const playerY = playerPos.y;
        const visibleRadius = renderState.visibleRadius;
        const renderRadius = renderState.renderRadius;

        const levelEntity = this.entityManager.getEntitiesWith(['Tier']).find(e => e.getComponent('Tier').value === gameState.tier);
        if (!levelEntity) return;

        const exploration = levelEntity.getComponent('Exploration');
        const WIDTH = state.getComponent('LevelDimensions').WIDTH;
        const HEIGHT = state.getComponent('LevelDimensions').HEIGHT;
        const walls = this.entityManager.getEntitiesWith(['Position', 'Wall']);
        renderState.activeRenderZone = renderState.activeRenderZone || new Set();
        renderState.activeRenderZone.clear();

        let newDiscoveryCount = 0;

        for (let y = Math.max(0, playerY - visibleRadius); y <= Math.min(HEIGHT - 1, playerY + visibleRadius); y++) {
            for (let x = Math.max(0, playerX - visibleRadius); x <= Math.min(WIDTH - 1, playerX + visibleRadius); x++) {
                const dx = x - playerX;
                const dy = y - playerY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance <= visibleRadius) {
                    const tileKey = `${x},${y}`;
                    const wasDiscovered = exploration.discoveredWalls.has(tileKey) || exploration.discoveredFloors.has(tileKey);
                    const entitiesAtTarget = this.entityManager.getEntitiesWith(['Position']).filter(e => {
                        const pos = e.getComponent('Position');
                        return pos.x === x && pos.y === y;
                    });
                    const isWall = entitiesAtTarget.some(e => e.hasComponent('Wall'));
                    console.log(`ExplorationSystem: Tile (${x},${y}) - entitiesAtTarget: ${entitiesAtTarget.length}, isWall: ${isWall}, wasDiscovered: ${wasDiscovered}`);
                    if (!wasDiscovered) {
                        if (isWall) {
                            exploration.discoveredWalls.add(tileKey);
                        } else {
                            exploration.discoveredFloors.add(tileKey);
                        }
                        newDiscoveryCount++;
                    }
                }
            }
        }

        for (let y = Math.max(0, playerY - renderRadius); y <= Math.min(HEIGHT - 1, playerY + renderRadius); y++) {
            for (let x = Math.max(0, playerX - renderRadius); x <= Math.min(WIDTH - 1, playerX + renderRadius); x++) {
                const dx = x - playerX;
                const dy = y - playerY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance <= renderRadius) {
                    if (this.isTileVisible(playerX, playerY, x, y, walls, renderState)) {
                        renderState.activeRenderZone.add(`${x},${y}`);
                    }
                }
            }
        }

        console.log(`ExplorationSystem: Updated - new discoveries: ${newDiscoveryCount}, activeRenderZone size: ${renderState.activeRenderZone.size}`);

        if (newDiscoveryCount > 0) {
            playerState.discoveredTileCount += newDiscoveryCount;
            this.eventBus.emit('TilesDiscovered', { count: newDiscoveryCount, total: playerState.discoveredTileCount });
        }

        this.eventBus.emit('RenderNeeded');
    }
}