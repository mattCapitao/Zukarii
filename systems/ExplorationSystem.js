// systems/ExplorationSystem.js
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
        this.eventBus.on('TorchExpired', () => this.updateExploration());
        this.eventBus.on('LightTorch', () => this.updateExploration());
    }

    updateExploration() {
        const player = this.entityManager.getEntity('player');
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const renderState = this.entityManager.getEntity('renderState').getComponent('RenderState');
        if (!player || !gameState || !renderState) return;

        const playerState = player.getComponent('PlayerState');
        const playerPos = player.getComponent('Position');
        const playerX = playerPos.x;
        const playerY = playerPos.y;
        const discoveryRadius = renderState.discoveryRadius;

        const levelEntity = this.entityManager.getEntitiesWith(['Map', 'Tier']).find(e => e.getComponent('Tier').value === gameState.tier);
        if (!levelEntity) return;

        const map = levelEntity.getComponent('Map').map; // Temporary for bounds
        const exploration = levelEntity.getComponent('Exploration');
        renderState.visibleTiles.clear();

        let newDiscoveryCount = 0;

        for (let y = Math.max(0, playerY - discoveryRadius); y <= Math.min(map.length - 1, playerY + discoveryRadius); y++) {
            for (let x = Math.max(0, playerX - discoveryRadius); x <= Math.min(map[0].length - 1, playerX + discoveryRadius); x++) {
                const dx = x - playerX;
                const dy = y - playerY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance <= discoveryRadius) {
                    const tileKey = `${x},${y}`;
                    const wasDiscovered = exploration.discoveredWalls.has(tileKey) || exploration.discoveredFloors.has(tileKey);
                    const entitiesAtTarget = this.entityManager.getEntitiesWith(['Position']).filter(e => {
                        const pos = e.getComponent('Position');
                        return pos.x === x && pos.y === y;
                    });
                    const isWall = entitiesAtTarget.some(e => e.hasComponent('Wall'));
                    if (!wasDiscovered) {
                        if (isWall) {
                            exploration.discoveredWalls.add(tileKey);
                        } else {
                            exploration.discoveredFloors.add(tileKey);
                        }
                        newDiscoveryCount++;
                    }
                    renderState.visibleTiles.add(tileKey); // Temporary for RenderSystem compatibility
                }
            }
        }

        if (newDiscoveryCount > 0) {
            playerState.discoveredTileCount += newDiscoveryCount;
            this.eventBus.emit('TilesDiscovered', { count: newDiscoveryCount, total: playerState.discoveredTileCount });
        }

        this.eventBus.emit('RenderNeeded');
    }
}