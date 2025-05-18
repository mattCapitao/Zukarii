import { System } from '../core/Systems.js';

export class ExplorationSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Position', 'PlayerState'];
        this.minimapCanvas = null;
        this.minimapCtx = null;
        this.isMinimapVisible = true;
        this.PIXELS_PER_TILE = 2;
        this.WIDTH = 122;
        this.HEIGHT = 67;
        this.TILE_SIZE = 32;
    }

    init() {
        this.eventBus.on('ToggleMinimap', () => {
            this.isMinimapVisible = !this.isMinimapVisible;
            this.minimapCanvas.style.display = this.isMinimapVisible ? 'block' : 'none';
            if (this.isMinimapVisible) this.renderMinimap();
        });

        this.minimapCanvas = document.getElementById('minimap-canvas');
        if (!this.minimapCanvas) {
            return;
        }
        this.minimapCtx = this.minimapCanvas.getContext('2d');
        this.minimapCanvas.style.display = this.isMinimapVisible ? 'block' : 'none';
    }

    update(deltaTime) {
        this.updateExploration();
    }

    renderMinimap() {
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const levelEntity = this.entityManager.getEntitiesWith(['Tier']).find(e => e.getComponent('Tier').value === gameState.tier);
        if (!levelEntity) {
            return;
        }

        const exploration = levelEntity.getComponent('Exploration');
        if (!exploration) {
            return;
        }

        this.minimapCtx.fillStyle = '#111';
        this.minimapCtx.fillRect(0, 0, this.minimapCanvas.width, this.minimapCanvas.height);

        this.minimapCtx.fillStyle = '#333';
        for (const tileKey of exploration.discoveredFloors) {
            const [x, y] = tileKey.split(',').map(Number);
            if (x >= 0 && x < this.WIDTH && y >= 0 && y < this.HEIGHT) {
                this.minimapCtx.fillRect(x * this.PIXELS_PER_TILE, y * this.PIXELS_PER_TILE, this.PIXELS_PER_TILE, this.PIXELS_PER_TILE);
            }
        }

        this.minimapCtx.fillStyle = '#26214b';
        for (const tileKey of exploration.discoveredWalls) {
            const [x, y] = tileKey.split(',').map(Number);
            if (x >= 0 && x < this.WIDTH && y >= 0 && y < this.HEIGHT) {
                this.minimapCtx.fillRect(x * this.PIXELS_PER_TILE, y * this.PIXELS_PER_TILE, this.PIXELS_PER_TILE, this.PIXELS_PER_TILE);
            }
        }

        // Render markers for stairs, fountains, and portals
        const markerEntities = [
            ...this.entityManager.getEntitiesWith(['Position', 'Stair']),
            ...this.entityManager.getEntitiesWith(['Position', 'Fountain']),
            ...this.entityManager.getEntitiesWith(['Position', 'Portal'])
        ];

        for (const entity of markerEntities) {
            const pos = entity.getComponent('Position');
            const tileX = Math.floor(pos.x / this.TILE_SIZE);
            const tileY = Math.floor(pos.y / this.TILE_SIZE);
            const tileKey = `${tileX},${tileY}`;

            // Only render if the tile is discovered
            if (exploration.discoveredFloors.has(tileKey) || exploration.discoveredWalls.has(tileKey)) {
                if (entity.hasComponent('Stair')) {
                    const stairComp = entity.getComponent('Stair');
                    this.minimapCtx.fillStyle = stairComp.direction === 'up' ? '#fff' : '#ff2'; // white for up, Dark Gray for down
                } else if (entity.hasComponent('Fountain')) {
                    this.minimapCtx.fillStyle = '#F00'; // Red for fountains
                } else if (entity.hasComponent('Portal')) {
                    this.minimapCtx.fillStyle = '#00f'; // Blue for portals
                }
                this.minimapCtx.fillRect(
                    tileX * this.PIXELS_PER_TILE,
                    tileY * this.PIXELS_PER_TILE,
                    this.PIXELS_PER_TILE,
                    this.PIXELS_PER_TILE
                );
            }
        }

        const player = this.entityManager.getEntity('player');
        if (player) {
            const playerPos = player.getComponent('Position');
            const playerX = Math.floor(playerPos.x / this.TILE_SIZE);
            const playerY = Math.floor(playerPos.y / this.TILE_SIZE);
            this.minimapCtx.fillStyle = '#0f0';
            this.minimapCtx.fillRect(playerX * this.PIXELS_PER_TILE, playerY * this.PIXELS_PER_TILE, this.PIXELS_PER_TILE, this.PIXELS_PER_TILE);
        }
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

        let visible = true;
        while (true) {
            const tileKey = `${x0},${y0}`;
            const isWall = walls.some(w => {
                const pos = w.getComponent('Position');
                return pos.x === x0 && pos.y === y0;
            });
            if (isWall && (x0 !== playerX || y0 !== playerY)) {
                renderState.activeRenderZone.add(tileKey);
                visible = false;
                break;
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
        if (visible) {
            renderState.activeRenderZone.add(`${targetX},${targetY}`);
        }
        return visible;
    }

    updateExploration() {
        const player = this.entityManager.getEntity('player');
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const renderState = this.entityManager.getEntity('renderState').getComponent('RenderState');
        const lightingState = this.entityManager.getEntity('lightingState').getComponent('LightingState');
        const pendingTransition = this.entityManager.getEntity('gameState').getComponent('LevelTransition');
        const state = this.entityManager.getEntity('state');
        if (!player || !gameState || !renderState || !state) {
            console.warn('ExplorationSystem: Missing required entities or components');
            return;
        }

        const playerState = player.getComponent('PlayerState');
        const playerPos = player.getComponent('Position');
        const playerX = Math.floor(playerPos.x / this.TILE_SIZE);
        const playerY = Math.floor(playerPos.y / this.TILE_SIZE);
        const lastPos = player.getComponent('LastPosition');

        if (((playerPos.x === lastPos.x && playerPos.y === lastPos.y) || (lastPos.x === 0 && lastPos.y === 0))
            && (gameState.needsInitialRender !== true)
        ) { return; }

        const renderRadius = renderState.renderRadius;
        const visibleRadius = lightingState.visibleRadius;
        const levelEntity = this.entityManager.getEntitiesWith(['Tier']).find(e => e.getComponent('Tier').value === gameState.tier);
        if (!levelEntity) return;

        const exploration = levelEntity.getComponent('Exploration');
        const walls = this.entityManager.getEntitiesWith(['Position', 'Wall']);
        renderState.activeRenderZone = renderState.activeRenderZone || new Set();
        renderState.activeRenderZone.clear();

        let newDiscoveryCount = 0;

        for (let y = Math.max(0, playerY - visibleRadius); y <= Math.min(this.HEIGHT - 1, playerY + visibleRadius); y++) {
            for (let x = Math.max(0, playerX - visibleRadius); x <= Math.min(this.WIDTH - 1, playerX + visibleRadius); x++) {
                const dx = x - playerX;
                const dy = y - playerY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance <= visibleRadius) {
                    const tileKey = `${x},${y}`;
                    const wasDiscovered = exploration.discoveredWalls.has(tileKey) || exploration.discoveredFloors.has(tileKey);
                    const entitiesAtTarget = this.entityManager.getEntitiesWith(['Position']).filter(e => {
                        const pos = e.getComponent('Position');
                        return Math.floor(pos.x / this.TILE_SIZE) === x && Math.floor(pos.y / this.TILE_SIZE) === y;
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
                }
            }
        }

        for (let y = Math.max(0, playerY - renderRadius); y <= Math.min(this.HEIGHT - 1, playerY + renderRadius); y++) {
            for (let x = Math.max(0, playerX - renderRadius); x <= Math.min(this.WIDTH - 1, playerX + renderRadius); x++) {
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

        if (newDiscoveryCount > 0) {
            playerState.discoveredTileCount += newDiscoveryCount;
            this.eventBus.emit('TilesDiscovered', { count: newDiscoveryCount, total: playerState.discoveredTileCount });
            if (this.isMinimapVisible) {
                this.renderMinimap();
                return;
            }
        }

        const lastTileX = Math.floor(lastPos.x / this.TILE_SIZE);
        const lastTileY = Math.floor(lastPos.y / this.TILE_SIZE);

        if (!lastPos || (lastPos.x === 0 && lastPos.y === 0)) {

        } else {
            const shouldRenderMinimap = this.isMinimapVisible && (
                playerX !== lastTileX || playerY !== lastTileY
            );

            if (shouldRenderMinimap) {
                this.renderMinimap();
            }
        }
    }
}