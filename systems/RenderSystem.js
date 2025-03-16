// systems/RenderSystem.js
import { System } from '../core/Systems.js';
import { titleScreen } from '../titleScreen.js';

export class RenderSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Position', 'RenderState'];
        this.mageNames = [
            "Elarion", "Sylvara", "Tharion", "Lysandra", "Zephyrion", "Morwenna", "Aethric",
            "Vionelle", "Dravenor", "Celestine", "Kaelith", "Seraphine", "Tormund", "Elowen",
            "Zarathis", "Lunara", "Veyron", "Ashka", "Rivenna", "Solthar", "Ysmera", "Drenvar",
            "Thalindra", "Orythia", "Xandrel", "Miravelle", "Korathis", "Eryndor", "Valthira",
            "Nythera"
        ];
        this.mapDiv = null;
        this.tileMap = {}; // Cache DOM elements like old Render.js
    }

    init() {
        this.mapDiv = document.getElementById('map');
        if (!this.mapDiv) throw new Error('Map div not found');

        this.eventBus.on('RenderNeeded', () => {
            const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
            if (!gameState) {
                console.warn('GameState not found in RenderNeeded handler');
                return;
            }
            const player = this.entityManager.getEntity('player');
            if (player) {
                const playerPos = player.getComponent('Position');
                gameState.needsRender = true;
                this.updateVisibility({ entityId: 'player', x: playerPos.x, y: playerPos.y });
                this.render();
            }
        });
        this.eventBus.on('PositionChanged', (data) => {
            this.updateVisibility(data);
            this.updateMapScroll(data);
            this.render();
        });
    }

    updateVisibility({ entityId, x, y }) {
        if (entityId !== 'player') return;
        const renderState = this.entityManager.getEntity('renderState').getComponent('RenderState');
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const levelEntity = this.entityManager.getEntitiesWith(['Map', 'Tier']).find(e => e.getComponent('Tier').value === gameState.tier);
        const map = levelEntity.getComponent('Map').map;

        const discoveryRadius = renderState.discoveryRadius;
        for (let dy = -discoveryRadius; dy <= discoveryRadius; dy++) {
            for (let dx = -discoveryRadius; dx <= discoveryRadius; dx++) {
                const newX = x + dx;
                const newY = y + dy;
                if (newX >= 0 && newX < map[0].length && newY >= 0 && newY < map.length) {
                    if (Math.sqrt(dx * dx + dy * dy) <= discoveryRadius) {
                        const tile = this.tileMap[`${newX},${newY}`];
                        if (tile && !tile.element.classList.contains('discovered')) {
                            tile.element.classList.add('discovered');
                        }
                    }
                }
            }
        }
    }

    render() {
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        const renderState = this.entityManager.getEntity('renderState')?.getComponent('RenderState');
        const player = this.entityManager.getEntity('player');
        const titleScreenContainer = document.getElementById('splash');

        if (!gameState || !gameState.needsRender) return;
        if (!gameState.gameStarted) {
            titleScreenContainer.style.display = 'flex';
            titleScreenContainer.innerHTML = titleScreen;
            this.mapDiv.style.display = 'none';
            gameState.needsRender = false;
            return;
        }

        titleScreenContainer.style.display = 'none';
        this.mapDiv.style.display = 'block';

        const tierEntity = this.entityManager.getEntitiesWith(['Map', 'Tier']).find(e => e.getComponent('Tier').value === gameState.tier);
        if (!tierEntity) return;
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
            for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
                    const distance = Math.sqrt(Math.pow(playerPos.x - x, 2) + Math.pow(playerPos.y - y, 2));
                    if (distance <= visibilityRadius) {
                        const tile = this.tileMap[`${x},${y}`];
                        let char = map[y][x];
                        let className = tile.element.classList.contains('discovered') ? 'discovered' : 'undiscovered';

                        const monster = monsters.find(m => m.getComponent('Position').x === x && m.getComponent('Position').y === y && m.getComponent('Health').hp > 0);
                        if (x === playerPos.x && y === playerPos.y) {
                            char = '𓀠';
                            className = 'player';
                            if (playerState.torchLit) className += ' torch flicker';
                        } else if (monster && (distance <= visibilityRadius || monster.getComponent('MonsterData').isAggro)) {
                            const monsterData = monster.getComponent('MonsterData');
                            monsterData.isDetected = true;
                            char = monsterData.avatar;
                            className = `discovered monster detected ${monsterData.classes}`;
                            if (monsterData.isElite) className += ' elite';
                            if (monsterData.isBoss) className += ' boss';
                            monsterData.affixes.forEach(affix => className += ` ${affix}`);
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

    updateMapScroll({ entityId, x, y }) {
        const player = this.entityManager.getEntity(entityId);
        if (entityId !== 'player' || !player) return;

        const playerSpan = this.mapDiv.querySelector('.player');
        if (!playerSpan) return;

        const spanWidth = 16;
        const spanHeight = 16;
        const playerX = x * spanWidth;
        const playerY = y * spanHeight;
        const viewportWidth = this.mapDiv.clientWidth;
        const viewportHeight = this.mapDiv.clientHeight;
        const currentScrollX = this.mapDiv.scrollLeft;
        const currentScrollY = this.mapDiv.scrollTop;

        const paddingX = viewportWidth * 0.25;
        const paddingY = viewportHeight * 0.25;
        let targetScrollX = currentScrollX;
        let targetScrollY = currentScrollY;

        const playerViewportX = playerX - currentScrollX;
        const playerViewportY = playerY - currentScrollY;
        if (playerViewportX < paddingX) targetScrollX = playerX - paddingX;
        else if (playerViewportX + spanWidth > viewportWidth - paddingX) targetScrollX = playerX + spanWidth - (viewportWidth - paddingX);
        if (playerViewportY < paddingY) targetScrollY = playerY - paddingY;
        else if (playerViewportY + spanHeight > viewportHeight - paddingY) targetScrollY = playerY + spanHeight - (viewportHeight - paddingY);

        targetScrollX = Math.max(0, Math.min(targetScrollX, this.mapDiv.scrollWidth - viewportWidth));
        targetScrollY = Math.max(0, Math.min(targetScrollY, this.mapDiv.scrollHeight - viewportHeight));

        this.mapDiv.scrollLeft = targetScrollX;
        this.mapDiv.scrollTop = targetScrollY;
    }

    setInitialScroll() {
        const playerSpan = this.mapDiv.querySelector('.player');
        if (!playerSpan) return;

        const spanWidth = 16;
        const spanHeight = 16;
        const playerX = playerSpan.offsetLeft;
        const playerY = playerSpan.offsetTop;
        const mapWidth = this.mapDiv.clientWidth;
        const mapHeight = this.mapDiv.clientHeight;

        this.mapDiv.scrollLeft = Math.max(0, playerX - (mapWidth / 2) + (spanWidth / 2));
        this.mapDiv.scrollTop = Math.max(0, playerY - (mapHeight / 2) + (spanHeight / 2));
    }
}