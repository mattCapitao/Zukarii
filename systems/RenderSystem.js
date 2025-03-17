// systems/RenderSystem.js
import { System } from '../core/Systems.js';
import { titleScreen } from '../titlescreen.js'; // Import titleScreen

export class RenderSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = [];
        this.mapDiv = document.getElementById('map');
        this.tileMap = {};
        this.lastTier = null;
    }

    init() {
        this.eventBus.on('RenderNeeded', () => this.render());
        this.eventBus.on('PositionChanged', (data) => this.render());
    }

    render() {
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        const renderState = this.entityManager.getEntity('renderState')?.getComponent('RenderState');
        const player = this.entityManager.getEntity('player');
        const titleScreenContainer = document.getElementById('splash');

        if (!gameState || !gameState.needsRender) return;
        if (!gameState.gameStarted) {
            titleScreenContainer.style.display = 'flex';
            titleScreenContainer.innerHTML = titleScreen; // Use imported titleScreen
            this.mapDiv.style.display = 'none';
            gameState.needsRender = false;
            return;
        }

        titleScreenContainer.style.display = 'none';
        this.mapDiv.style.display = 'block';

        const currentTier = gameState.tier;
        if (currentTier !== this.lastTier) {
            // Reinitialize tileMap when tier changes
            this.tileMap = {};
            this.lastTier = currentTier;
        }

        const tierEntity = this.entityManager.getEntitiesWith(['Map', 'Tier']).find(e => e.getComponent('Tier').value === currentTier);
        if (!tierEntity) {
            console.error(`RenderSystem: No level entity found for tier ${currentTier}`);
            gameState.needsRender = false;
            return;
        }

        const map = tierEntity.getComponent('Map').map;
        const height = map.length;
        const width = map[0].length;
        const playerPos = player.getComponent('Position');
        const playerState = player.getComponent('PlayerState');
        const visibilityRadius = 6; // AGGRO_RANGE (4) + 2, consistent with old code

        if (!Object.keys(this.tileMap).length) {
            // Initial full render
            let mapDisplay = '';
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    let char = map[y][x];
                    let className = 'undiscovered';
                    if (x === playerPos.x && y === playerPos.y) {
                        char = '𓀠';
                        className = 'player';
                        if (playerState.torchLit) className += ' torch flicker';
                    }
                    mapDisplay += `<span class="${className}" data-x="${x}" data-y="${y}">${char}</span>`;
                }
                mapDisplay += '\n';
            }
            this.mapDiv.innerHTML = mapDisplay;

            // Populate tileMap
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const element = this.mapDiv.querySelector(`span[data-x="${x}"][data-y="${y}"]`);
                    this.tileMap[`${x},${y}`] = { char: map[y][x], class: element.className, element };
                }
            }
            this.setInitialScroll();
        } else {
            // Update tiles within visibilityRadius
            const minX = Math.max(0, playerPos.x - visibilityRadius);
            const maxX = Math.min(width - 1, playerPos.x + visibilityRadius);
            const minY = Math.max(0, playerPos.y - visibilityRadius);
            const maxY = Math.min(height - 1, playerPos.y + visibilityRadius);

            const monsters = this.entityManager.getEntitiesWith(['Position', 'Health', 'MonsterData']);
            const projectiles = this.entityManager.getEntitiesWith(['Position', 'Projectile']);

            for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
                    const distance = Math.sqrt(Math.pow(playerPos.x - x, 2) + Math.pow(playerPos.y - y, 2));
                    if (distance <= visibilityRadius) {
                        const tileKey = `${x},${y}`;
                        const tile = this.tileMap[tileKey];
                        let char = map[y][x];
                        let className = tile.element.classList.contains('discovered') ? 'discovered' : 'undiscovered';

                        // Reset to map state unless an entity is present
                        if (!(x === playerPos.x && y === playerPos.y)) {
                            const monster = monsters.find(m => m.getComponent('Position').x === x && m.getComponent('Position').y === y && m.getComponent('Health').hp > 0);
                            const projectile = projectiles.find(p => p.getComponent('Position').x === x && p.getComponent('Position').y === y);
                            if (!monster && !projectile) {
                                tile.element.textContent = char;
                                tile.element.className = className;
                                tile.char = char;
                                tile.class = className;
                            }
                        }

                        // Render entities
                        if (x === playerPos.x && y === playerPos.y) {
                            char = '𓀠';
                            className = 'player';
                            if (playerState.torchLit) className += ' torch flicker';
                        } else if (projectiles.some(p => p.getComponent('Position').x === x && p.getComponent('Position').y === y)) {
                            char = '*';
                            className = 'discovered projectile';
                        } else {
                            const monster = monsters.find(m => m.getComponent('Position').x === x && m.getComponent('Position').y === y && m.getComponent('Health').hp > 0);
                            if (monster && (distance <= visibilityRadius || monster.getComponent('MonsterData').isAggro)) {
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

        console.log('Render completed. Discovery:', renderState.discoveryRadius, 'Visibility:', visibilityRadius);
        gameState.needsRender = false;
        gameState.needsInitialRender = false;
    }

    setInitialScroll() {
        const mapElement = document.getElementById('map');
        const player = this.entityManager.getEntity('player');
        const playerPos = player.getComponent('Position');
        mapElement.scrollLeft = (playerPos.x * 16) - (mapElement.clientWidth / 2);
        mapElement.scrollTop = (playerPos.y * 16) - (mapElement.clientHeight / 2);
    }
}