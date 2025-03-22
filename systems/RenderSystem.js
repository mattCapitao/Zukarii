// systems/RenderSystem.js - Updated
import { System } from '../core/Systems.js';
import { titleScreen } from '../titlescreen.js';

export class RenderSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = [];
        this.mapDiv = document.getElementById('map');
        this.tileMap = {};
        this.lastTier = null;
        console.log('RenderSystem: Render Lock initialized');
    }

    init() {
        this.eventBus.on('RenderNeeded', () => this.render(true));
        this.eventBus.on('PositionChanged', (data) => {
            this.render(true);
            this.viewportEdgeScroll();
        });
        this.eventBus.on('DiscoveredStateUpdated', () => this.render(true));
    }

    update() {
        this.render(false); // Continuous render without forcing needsRender
    }

    render(force = false) {
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        const renderState = this.entityManager.getEntity('renderState')?.getComponent('RenderState');
        const renderControl = this.entityManager.getEntity('renderState')?.getComponent('RenderControl');
        const player = this.entityManager.getEntity('player');
        const titleScreenContainer = document.getElementById('splash');

        if (!gameState) return;
        if (renderControl.locked) {
            console.warn('RenderSystem: Render is locked, skipping render');
            return;
        }
        if (!force && !gameState.needsRender) return;

        if (!gameState.gameStarted) {
            titleScreenContainer.style.display = 'flex';
            titleScreenContainer.innerHTML = titleScreen;
            this.mapDiv.style.display = 'none';
            gameState.needsRender = false;
            return;
        }

        titleScreenContainer.style.display = 'none';
        this.mapDiv.style.display = 'block';

        const currentTier = gameState.tier;
        if (currentTier !== this.lastTier) {
            this.tileMap = {};
            this.lastTier = currentTier;
        }

        const tierEntity = this.entityManager.getEntitiesWith(['Map', 'Tier', 'Exploration']).find(e => e.getComponent('Tier').value === currentTier);
        if (!tierEntity) {
            console.error(`RenderSystem: No level entity found for tier ${currentTier}`);
            gameState.needsRender = false;
            return;
        }

        const map = tierEntity.getComponent('Map').map;
        const exploration = tierEntity.getComponent('Exploration');
        const height = map.length;
        const width = map[0].length;
        console.log(`RenderSystem: Rendering map with dimensions ${width}x${height} for tier ${currentTier}`);
        const playerPos = player.getComponent('Position');
        console.log('RenderSystem: Rendering map for player at', playerPos);
        const playerState = player.getComponent('PlayerState');
        console.log('RenderSystem: Player state:', playerState);
        const renderRadius = renderState.renderRadius; // Updated to use renderRadius

        if (!Object.keys(this.tileMap).length) {
            let mapDisplay = '';
            let playerSpawnLocations = '';
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    let char = map[y][x];
                    let className = 'undiscovered';
                    if (exploration.discoveredWalls.has(`${x},${y}`) || exploration.discoveredFloors.has(`${x},${y}`)) {
                        className = 'discovered';
                    }
                    const projectiles = this.entityManager.getEntitiesWith(['Position', 'Projectile']);
                    const projectileMatch = projectiles.some(p => p.getComponent('Position').x === x && p.getComponent('Position').y === y);
                    if (projectileMatch) {
                        char = '*';
                        className = 'discovered projectile';
                    } else if (x === playerPos.x && y === playerPos.y) {
                        playerSpawnLocations += `Rendering player at${x},${y}`;
                        char = '𓀠';
                        className = 'player';
                        if (playerState.torchLit) className += ' torch flicker';
                    }
                    mapDisplay += `<span class="${className}" data-x="${x}" data-y="${y}">${char}</span>`;
                }
                mapDisplay += '\n';
            }
            console.log("Player Avatar Locations", playerSpawnLocations);
            this.mapDiv.innerHTML = mapDisplay;

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const element = this.mapDiv.querySelector(`span[data-x="${x}"][data-y="${y}"]`);
                    this.tileMap[`${x},${y}`] = { char: map[y][x], class: element.className, element };
                }
            }

            this.setInitialScroll();
        } else {
            const minX = Math.max(0, playerPos.x - renderRadius); // Updated to use renderRadius
            const maxX = Math.min(width - 1, playerPos.x + renderRadius);
            const minY = Math.max(0, playerPos.y - renderRadius);
            const maxY = Math.min(height - 1, playerPos.y + renderRadius);

            const monsters = this.entityManager.getEntitiesWith(['Position', 'Health', 'MonsterData']);
            const projectiles = this.entityManager.getEntitiesWith(['Position', 'Projectile']);
            const treasures = this.entityManager.getEntitiesWith(['Position', 'TreasureData']);

            for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
                    const distance = Math.sqrt(Math.pow(playerPos.x - x, 2) + Math.pow(playerPos.y - y, 2));
                    if (distance <= renderRadius) { // Updated to use renderRadius
                        const tileKey = `${x},${y}`;
                        const tile = this.tileMap[tileKey];
                        let char = map[y][x];
                        let className = exploration.discoveredWalls.has(tileKey) || exploration.discoveredFloors.has(tileKey) ? 'discovered' : 'undiscovered';

                        tile.element.textContent = char;
                        tile.element.className = className;
                        tile.char = char;
                        tile.class = className;

                        const treasureMatch = treasures.some(t => t.getComponent('Position').x === x && t.getComponent('Position').y === y);
                        const projectileMatch = projectiles.some(p => p.getComponent('Position').x === x && p.getComponent('Position').y === y);
                        if (projectileMatch) {
                            char = '*';
                            className = 'discovered projectile';
                        } else if (treasureMatch) {
                            char = '$';
                            className = 'discovered';
                        } else if (x === playerPos.x && y === playerPos.y) {
                            char = '𓀠';
                            className = 'player';
                            if (playerState.torchLit) className += ' torch flicker';
                        } else {
                            const monster = monsters.find(m => m.getComponent('Position').x === x && m.getComponent('Position').y === y && m.getComponent('Health').hp > 0);
                            if (monster && (distance <= renderRadius || monster.getComponent('MonsterData').isAggro)) { // Updated to use renderRadius
                                const monsterData = monster.getComponent('MonsterData');
                                monsterData.isDetected = true;
                                char = monsterData.avatar;
                                className = `discovered monster detected ${monsterData.classes}`;
                                if (monsterData.isElite) className += ' elite';
                                if (monsterData.isBoss) className += ' boss';
                                monsterData.affixes.forEach(affix => className += ` ${affix}`);
                            }
                        }

                        if (tile.char !== char || tile.class !== className) {
                            tile.element.textContent = char;
                            tile.element.className = className;
                            tile.char = char;
                            tile.class = className;
                        }
                    }
                }
            }
        }

        if (force) gameState.needsRender = false;
        gameState.needsInitialRender = false;
    }

    viewportEdgeScroll() {
        const mapElement = document.getElementById('map');
        const player = document.querySelector('.player');
        if (!player || !mapElement) {
            return;
        }

        const TILE_SIZE = 16;
        const SCROLL_SPEED = 1;
        const VIEWPORT_EDGE_THRESHOLD_PERCENT = 0.25;

        const viewportWidth = mapElement.clientWidth;
        const viewportHeight = mapElement.clientHeight;
        const mapWidth = mapElement.scrollWidth;
        const mapHeight = mapElement.scrollHeight;

        const thresholdX = viewportWidth * VIEWPORT_EDGE_THRESHOLD_PERCENT;
        const thresholdY = viewportHeight * VIEWPORT_EDGE_THRESHOLD_PERCENT;

        const playerX = player.offsetLeft;
        const playerY = player.offsetTop;
        const currentScrollX = mapElement.scrollLeft;
        const currentScrollY = mapElement.scrollTop;

        const playerViewportX = playerX - currentScrollX;
        const playerViewportY = playerY - currentScrollY;

        let targetScrollX = currentScrollX;
        let targetScrollY = currentScrollY;

        if (playerViewportX < thresholdX) {
            targetScrollX = playerX - thresholdX;
        } else if (playerViewportX + TILE_SIZE > viewportWidth - thresholdX) {
            targetScrollX = playerX + TILE_SIZE - (viewportWidth - thresholdX);
        }

        if (playerViewportY < thresholdY) {
            targetScrollY = playerY - thresholdY;
        } else if (playerViewportY + TILE_SIZE > viewportHeight - thresholdY) {
            targetScrollY = playerY + TILE_SIZE - (viewportHeight - thresholdY);
        }

        targetScrollX = Math.max(0, Math.min(targetScrollX, mapWidth - viewportWidth));
        targetScrollY = Math.max(0, Math.min(targetScrollY, mapHeight - viewportHeight));

        const scrollThreshold = 4;
        if (Math.abs(targetScrollX - currentScrollX) < scrollThreshold && Math.abs(targetScrollY - currentScrollY) < scrollThreshold) {
            return;
        }

        const duration = 300;
        let startTime = null;
        const easeInOutQuad = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

        const animateScroll = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = easeInOutQuad(progress);

            const currentX = currentScrollX + (targetScrollX - currentScrollX) * easedProgress;
            const currentY = currentScrollY + (targetScrollY - currentScrollY) * easedProgress;

            mapElement.scrollLeft = Math.max(0, Math.min(currentX, mapWidth - viewportWidth));
            mapElement.scrollTop = Math.max(0, Math.min(currentY, mapHeight - viewportHeight));

            if (progress < 1) {
                this.animationFrame = requestAnimationFrame(animateScroll);
            } else {
                this.animationFrame = null;
            }
        };

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        this.animationFrame = requestAnimationFrame(animateScroll);
    }

    setInitialScroll() {
        const mapElement = document.getElementById('map');
        const player = this.entityManager.getEntity('player');
        const playerPos = player.getComponent('Position');
        const viewportWidth = mapElement.clientWidth;
        const viewportHeight = mapElement.clientHeight;
        const mapWidth = mapElement.scrollWidth;
        const mapHeight = mapElement.scrollHeight;

        let scrollX = (playerPos.x * 16) - (viewportWidth / 2);
        let scrollY = (playerPos.y * 16) - (viewportHeight / 2);

        scrollX = Math.max(0, Math.min(scrollX, mapWidth - viewportWidth));
        scrollY = Math.max(0, Math.min(scrollY, mapHeight - viewportHeight));

        mapElement.scrollLeft = scrollX;
        mapElement.scrollTop = scrollY;
        console.log(`RenderSystem: Set initial scroll to (${scrollX}, ${scrollY}) for player at (${playerPos.x}, ${playerPos.y})`);
    }
}