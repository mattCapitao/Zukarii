// systems/RenderSystem.js - Corrected
import { System } from '../core/Systems.js';
import { titleScreen } from '../titlescreen.js';

export class RenderSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = [];
        this.mapDiv = document.getElementById('map');
        this.tileMap = {};
        this.lastTier = null;
        this.SCALE_FACTOR = 2
        this.TILE_SIZE = 32;
        this.SCROLL_SPEED = 1;
        this.VIEWPORT_EDGE_THRESHOLD_PERCENT = 0.25;
        this.SCROLL_THRESHOLD = 4;
        this.SCROLL_DURATION = 250;
        this.previousProjectilePositions = new Map();
    }

    init() {
        this.eventBus.on('RenderNeeded', () => this.render(true));
        this.eventBus.on('PositionChanged', (data) => {
            if (data.entityId.startsWith('projectile_')) {
                const projectile = this.entityManager.getEntity(data.entityId);
                if (projectile) {
                    const oldPos = this.previousProjectilePositions.get(data.entityId);
                    if (oldPos) {
                        const renderState = this.entityManager.getEntity('renderState')?.getComponent('RenderState');
                        if (renderState && renderState.activeRenderZone) {
                            renderState.activeRenderZone.add(`${oldPos.x},${oldPos.y}`);
                        }
                    }
                    this.previousProjectilePositions.set(data.entityId, { x: data.x, y: data.y });
                }
            }
            this.render(true);
            this.viewportEdgeScroll();
        });
        this.eventBus.on('DiscoveredStateUpdated', () => this.render(true));
        this.eventBus.on('LightingStateChanged', () => { this.render(true); });
    }

    update() {
        this.render(false);
    }

    render(force = false) {
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        const renderState = this.entityManager.getEntity('renderState')?.getComponent('RenderState');
        const redrawTiles = renderState.redrawTiles || new Set();
        const renderControl = this.entityManager.getEntity('renderState')?.getComponent('RenderControl');
        const player = this.entityManager.getEntity('player');
        const titleScreenContainer = document.getElementById('splash');
        const state = this.entityManager.getEntity('state');

        if (force) {
            //console.log(`RenderSystem: Accessing gameState - tier: ${gameState?.tier}, gameStarted: ${gameState?.gameStarted}, needsRender: ${gameState?.needsRender}, needsInitialRender: ${gameState?.needsInitialRender}`);
            //console.log(`RenderSystem: Accessing renderState - renderRadius: ${renderState?.renderRadius}, activeRenderZone: ${renderState?.activeRenderZone?.size}`);
            //console.log(`RenderSystem: Accessing renderControl - locked: ${renderControl?.locked}`);
            //console.log(`RenderSystem: Accessing player - position: (${player?.getComponent('Position')?.x}, ${player?.getComponent('Position')?.y})`);
        }

        if (!gameState) return;
        if (renderControl.locked) {
            console.warn('RenderSystem: Render is locked, skipping render');
            return;
        }


        // Check for entities with the NeedsRender component
        const renderEntities = this.entityManager.getEntitiesWith('NeedsRender');
        if (renderEntities.length > 0) {
           gameState.needsRender = true;
            force = true;
            // Remove the NeedsRender component from all entities
            renderEntities.forEach(entity => {
                this.entityManager.removeComponentFromEntity(entity.id, 'NeedsRender');
            });
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

        const tierEntity = this.entityManager.getEntitiesWith(['Tier', 'Exploration']).find(e => e.getComponent('Tier').value === currentTier);
        if (!tierEntity) {
            console.error(`RenderSystem: No level entity found for tier ${currentTier}`);
            gameState.needsRender = false;
            return;
        }

        const exploration = tierEntity.getComponent('Exploration');
        const WIDTH = state.getComponent('LevelDimensions').WIDTH;
        const HEIGHT = state.getComponent('LevelDimensions').HEIGHT;
        const playerPos = player.getComponent('Position');
        const playerState = player.getComponent('PlayerState');
        const renderRadius = renderState.renderRadius;

        if (force) {
            ////console.log(`RenderSystem: Accessing exploration state - discoveredWalls: ${exploration.discoveredWalls.size}, discoveredFloors: ${exploration.discoveredFloors.size}`);
        }

        const walls = this.entityManager.getEntitiesWith(['Position', 'Wall']);
        const floors = this.entityManager.getEntitiesWith(['Position', 'Floor']);
        const monsters = this.entityManager.getEntitiesWith(['Position', 'Health', 'MonsterData']);
        const projectiles = this.entityManager.getEntitiesWith(['Position', 'Projectile']);
        const treasures = this.entityManager.getEntitiesWith(['Position', 'LootData']);
        const fountains = this.entityManager.getEntitiesWith(['Position', 'Fountain']);
        const stairs = this.entityManager.getEntitiesWith(['Position', 'Stair']);
        const portals = this.entityManager.getEntitiesWith(['Position', 'Portal']);

        if (force) {
            ////console.log(`RenderSystem: Entity query - walls: ${walls.length}, floors: ${floors.length}, monsters: ${monsters.length}, projectiles: ${projectiles.length}, treasures: ${treasures.length}, fountains: ${fountains.length}, stairs: ${stairs.length}, portals: ${portals.length}`);
        }
        let avatar = '';


        if (!Object.keys(this.tileMap).length) {
            let mapDisplay = '';
            let playerSpawnLocations = '';
            for (let y = 0; y < HEIGHT; y++) {
                for (let x = 0; x < WIDTH; x++) {
                    const tileKey = `${x},${y}`;
                    let char = ' ';
                    let className = 'undiscovered';

                    if (exploration.discoveredWalls.has(tileKey)) {
                        className = 'discovered floor';
                    }
                    if(exploration.discoveredFloors.has(tileKey)) {
                        className = 'discovered floor';
                    }

                    const wall = walls.find(w => {
                        const pos = w.getComponent('Position');
                        return pos.x === x && pos.y === y;
                    });
                    if (wall) {
                       // char = '#';
                        className = exploration.discoveredWalls.has(tileKey) ? 'discovered' : 'undiscovered';
                        className += ' wall';
                        char = ' ';
                    }

                    const floor = floors.find(f => {
                        const pos = f.getComponent('Position');
                        return pos.x === x && pos.y === y;
                    });
                    if (floor && !wall) {
                        char = ' ';
                        className = exploration.discoveredFloors.has(tileKey) ? 'discovered' : 'undiscovered';
                        className += ' floor';
                    }

                    const projectile = projectiles.find(p => {
                        const pos = p.getComponent('Position');
                        return pos.x === x && pos.y === y;
                    });
                    if (x === playerPos.x && y === playerPos.y) {
                        playerSpawnLocations += `Rendering player at${x},${y}`;
                        avatar = player.getComponent('Visuals').avatar;
                        const playerHealth = player.getComponent('Health');

                        char = `<img src="${avatar}" height="28px" width="32px" style="" />`;
                        className = 'player floor';

                        
                        if (player.hasComponent('InCombat')) {
                            const hpBarWidth = Math.floor((playerHealth.hp / playerHealth.maxHp) * (this.TILE_SIZE/2));
                            char = `<img src="${avatar}" height="28px" width="32px" style="background-size:${hpBarWidth}px 2px;  background-position:8px 0;"" />`;
                            className = 'player has-hp-bar floor';
                        }

                        const lightingState = this.entityManager.getEntity('lightingState')?.getComponent('LightingState');
                        if (lightingState?.isLit) { className += ' torch flicker'; }
                        mapDisplay += `<span class="${className}" data-x="${x}" data-y="${y}">${char}</span>`;
                        avatar = '';
                        continue; // Skip the default append logic

                    } else if (projectile) {
                        char = '*';
                        className = 'discovered floor projectile';
                    } else {
                        const fountain = fountains.find(f => {
                            const pos = f.getComponent('Position');
                            const fountainData = f.getComponent('Fountain');
                            return pos.x === x && pos.y === y && !fountainData.used;
                        });
                        if (fountain) {
                            char = '≅';
                            className = exploration.discoveredFloors.has(tileKey) ? 'discovered' : 'undiscovered';
                            className += ' fountain';
                        } else {
                            const stair = stairs.find(s => {
                                const pos = s.getComponent('Position');
                                return pos.x === x && pos.y === y;
                            });
                            if (stair) {
                                const stairComp = stair.getComponent('Stair');
                                const a = stair.getComponent('Visuals').avatar;

                                switch (stairComp.direction) {
                                    case 'up':
                                        avatar = a || 'img/avatars/stairsup.png';
                                        char = `<img src="${avatar}" height="32px;" width="32px;"/>` || '⇓';
                                        break;
                                    case 'down':
                                        avatar = a || 'img/avatars/stairsdown.png';
                                        char = `<img src="${avatar}"  height="32px;" width="32px;" />` || '⇑';
                                        break;
                                }
                                
                                className = exploration.discoveredFloors.has(tileKey) ? 'discovered' : 'undiscovered';
                                className += stairComp.direction === 'down' ? ' stair down floor' : ' stair down floor';
                            } else {
                                const portal = portals.find(p => {
                                    const pos = p.getComponent('Position');
                                    return pos.x === x && pos.y === y;
                                });
                                if (portal) {
                                    console.log('RenderSystem: Found portal at', x, y, portal);
                                    const a = portal.getComponent('Visuals').avatar;
                                    console.log('RenderSystem: Found portal avatar', a);
                                    if (a) {
                                        char = `<img src="${avatar}" height="326px" width="32px;"/>`;
                                    } else {
                                        char = '?';
                                    }
                                   
                                    className = exploration.discoveredFloors.has(tileKey) ? 'discovered' : 'undiscovered';
                                    className += ' portal floor';
                                } else {
                                    const treasure = treasures.find(t => {
                                        const pos = t.getComponent('Position');
                                        const source = t.getComponent('LootData');
                                        return pos.x === x && pos.y === y;
                                    });
                                    if (treasure) {
                                        console.log('RenderSystem: Found treasure at', x, y, treasure);
                                        const a = treasure.getComponent('Visuals').avatar;
                                        console.log('RenderSystem: Found treasure avatar', a);
                                        if (a) {
                                            char = `<img src="${avatar}" height="16px" width="24px;"/>`;
                                        } else {
                                            char = '$';
                                        }
                                        className += ' treasure';
                                    } else {
                                        const monster = monsters.find(m => {
                                            const pos = m.getComponent('Position');
                                            return pos.x === x && pos.y === y && m.getComponent('Health').hp > 0;
                                        });

                                        if (monster && (renderState.activeRenderZone.has(tileKey) || monster.getComponent('MonsterData').isAggro)) {
                                            const a = monster?.getComponent('Visuals').avatar;
                                            avatar = a.avatar || 'img/avatars/monsters/skeleton.png';
                                            const monsterData = monster.getComponent('MonsterData');
                                            monsterData.isDetected = true;

                                            const health = monster.getComponent('Health');
                                            const hpBarWidth = Math.floor((health.hp / health.maxHp) * (this.TILE_SIZE/2));

                                            char = avatar ? `<img src="${avatar}" height="30px" width="32px" style ="background-size:${hpBarWidth}px, 2px;  background-position:8px 0;" />` : monsterData.avatar;
                                           

                                            className = `monster detected has-hp-bar ${monsterData.classes}`;

                                            const faceLeft = monster.getComponent('Visuals').faceLeft;
                                            if (faceLeft) { className += ' face-left'; }

                                            if (monsterData.isElite) className += ' elite';
                                            if (monsterData.isBoss) className += ' boss';
                                            monsterData.affixes.forEach(affix => className += ` ${affix}`);
                                        }
                                        if (monster) {
                                            const monsterData = monster.getComponent('MonsterData');
                                            char = ' ';
                                            avatar = '';
                                            //tile.element.style.backgroundSize = `${monsterData.hpBarWidth}px 1px`;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if (avatar) {

                        mapDisplay += `<span class="${className}" data-x="${x}" data-y="${y}"><img src="${avatar}" /></span>`;
                        avatar = '';
                    } else {
                        mapDisplay += `<span class="${className}" data-x="${x}" data-y="${y}">${char}</span>`;
                    }

                    
                }
                mapDisplay += '\n';
            }
            ////console.log("Player Avatar Locations", playerSpawnLocations);
            this.mapDiv.innerHTML = mapDisplay;

            for (let y = 0; y < HEIGHT; y++) {
                for (let x = 0; x < WIDTH; x++) {
                    const element = this.mapDiv.querySelector(`span[data-x="${x}"][data-y="${y}"]`);
                    const tileKey = `${x},${y}`;
                    let char = ' ';
                    if (walls.some(w => w.getComponent('Position').x === x && w.getComponent('Position').y === y)) {
                        //char = '#';

                        if (!element.classList.contains('wall')){ element.className += 'wall'; }
                       
                    }
                    this.tileMap[tileKey] = { char, class: element.className, element };
                }
            }

            this.setInitialScroll();
        } else {
            // *** CHANGED: Force re-render of all old projectile positions ***
            const playerTileKey = `${playerPos.x},${playerPos.y}`;
            const tilesToClear = new Set();
            projectiles.forEach(proj => {
                const projId = proj.id;
                const currentPos = proj.getComponent('Position');
                const oldPos = this.previousProjectilePositions.get(projId);
                if (oldPos && (oldPos.x !== currentPos.x || oldPos.y !== currentPos.y)) {
                    const oldTileKey = `${oldPos.x},${oldPos.y}`;
                    // Only add to tilesToClear if it's not the player's current position
                    if (oldTileKey !== playerTileKey) {

                        redrawTiles.add(oldTileKey);
                        //tilesToClear.add(oldTileKey);
                    }
                }
            });

            
            redrawTiles.forEach(tileKey => {
                renderState.activeRenderZone.add(tileKey);
            });
            redrawTiles.clear();

            const aggroMonsters = monsters.filter(m => m.getComponent('MonsterData').isAggro);
            aggroMonsters.forEach(monster => {
                const pos = monster.getComponent('Position');
                const tileKey = `${pos.x},${pos.y}`;
                renderState.activeRenderZone.add(tileKey);
            });

            for (const tileKey of renderState.activeRenderZone) {
                const [x, y] = tileKey.split(',').map(Number);
                const tile = this.tileMap[tileKey];
                let char = ' ';
                let className = 'undiscovered';

                if (exploration.discoveredWalls.has(tileKey)) {
                    className = 'discovered wall';
                }

                if (exploration.discoveredFloors.has(tileKey)){
                    className = 'discovered floor';
                }

                const wall = walls.find(w => {
                    const pos = w.getComponent('Position');
                    return pos.x === x && pos.y === y;
                });
                if (wall) {
                    className = 'discovered wall';
                }

                const treasure = treasures.find(t => {
                    const pos = t.getComponent('Position');
                    return pos.x === x && pos.y === y;
                });
                const projectile = projectiles.find(p => {
                    const pos = p.getComponent('Position');
                    return pos.x === x && pos.y === y;
                });
                if (treasure) {
                    avatar = 'img/avatars/chest.png'; 
                    char = `<img src="${avatar}" height="16px" width="24px;"/>`;
                    className = 'discovered treasure floor';
                } else if (x === playerPos.x && y === playerPos.y) {

                    avatar = player.getComponent('Visuals').avatar;
                    const faceLeft = player.getComponent('Visuals').faceLeft;
                    const playerHealth = player.getComponent('Health');

                    char = `<img src="${avatar}" height="28px" width="32px" style="" />`;
                    className = 'player floor';

                    if (player.hasComponent('InCombat')) {
                        const hpBarWidth = Math.floor((playerHealth.hp / playerHealth.maxHp) * (this.TILE_SIZE/2));
                        char = `<img src="${avatar}" height="28px" width="32px" style="background-size:${hpBarWidth}px 2px;  background-position:8px 0;"" />`;
                        className = 'player has-hp-bar floor';
                    }

                    if (faceLeft) { className += ' face-left'; }

                    const lightingState = this.entityManager.getEntity('lightingState')?.getComponent('LightingState');
                    if (lightingState?.isLit) { className += ' torch flicker'; }

                    tile.element.innerHTML = char;
                    tile.element.className = className;
                    tile.char = char;
                    tile.class = className;
                    avatar = '';

                } else if (projectile) {
                    char = '*';
                    className = 'discovered floor projectile';
                } else {
                    const fountain = fountains.find(f => {
                        const pos = f.getComponent('Position');
                        const fountainData = f.getComponent('Fountain');
                        return pos.x === x && pos.y === y && !fountainData.used;
                    });
                    if (fountain) {
                        char = '≅';
                    } else {
                        const stair = stairs.find(s => {
                            const pos = s.getComponent('Position');
                            return pos.x === x && pos.y === y;
                        });
                        if (stair) {
                            const stairComp = stair.getComponent('Stair');
                            const a = stair.getComponent('Visuals').avatar;

                            switch (stairComp.direction) {
                                case 'up':
                                    avatar = a || 'img/avatars/stairsup.png';
                                    char = `<img src="${avatar}"  height="32px;" width="32px;" />` || '⇓';
                                    break;
                                case 'down':
                                    avatar = a || 'img/avatars/stairsdown.png';
                                    char = `<img src="${avatar}"  height="32px;" width="32px;" />` || '⇑';
                                    break;
                            }

                            className = exploration.discoveredFloors.has(tileKey) ? 'discovered' : 'undiscovered';
                            className += stairComp.direction === 'down' ? ' stair down floor' : ' stair down floor';
                            
                        } else {
                            const portal = portals.find(p => {
                                const pos = p.getComponent('Position');
                                return pos.x === x && pos.y === y;
                            });
                            if (portal) {
                                avatar = portal.getComponent('Visuals').avatar || 'img/avatars/portal.png';;
                                char = `<img src="${avatar}" />`;
                                className = 'portal discovered floor';
                            } else {
                                const monster = monsters.find(m => {
                                    const pos = m.getComponent('Position');
                                    return pos.x === x && pos.y === y && m.getComponent('Health').hp > 0;
                                });
                                const visuals = monster?.getComponent('Visuals');
                                avatar = visuals?.avatar || 'img/avatars/monsters/skeleton.png';

                                if (monster && (renderState.activeRenderZone.has(tileKey) || monster.getComponent('MonsterData').isAggro)) {
                                    const monsterData = monster.getComponent('MonsterData');
                                    monsterData.isDetected = true;
                                    const health = monster.getComponent('Health');
                                    const hpBarWidth = Math.floor((health.hp / health.maxHp) * (this.TILE_SIZE/2));
                                    const charAvatar = avatar ? avatar : monsterData.avatar;
                                    char = `<img src="${charAvatar}" height="32px" width="32px" style="background-size:${hpBarWidth}px 2px; background-position:8px 0;" />`;
                                    
                                    className = `monster detected has-hp-bar ${monsterData.classes}`;
                                    if (monsterData.isElite) className += ' elite';
                                    if (monsterData.isBoss) className += ' boss';
                                    monsterData.affixes.forEach(affix => className += ` ${affix}`);

                                    const faceLeft = monster.getComponent('Visuals').faceLeft;
                                    if (faceLeft) { className += ' face-left'; }

                                    tile.element.innerHTML = char;
                                    tile.element.className = className;
                                    tile.char = char;
                                    tile.class = className;
                                    avatar = '';
                                }
                              
                                if (monster) {
                                    const monsterData = monster.getComponent('MonsterData');
                                }
                                
                            }
                        }
                    }
                }

                if (tile.char !== char || tile.class !== className) {

                    if (avatar) {
                        // Use innerHTML for entities that have an avatar to render the image
                       // console.log(`RenderSystem: Rendering avatar for entity at (${x}, ${y})`, avatar);
                        tile.element.innerHTML = char;
                        // console.log(`RenderSystem: Avatar for entity at (${x}, ${y})`, tile);
                      
                        avatar = '';
                    } else {
                        // Use textContent for other tiles
                        tile.element.textContent = char;
                    }
                    tile.element.className = className;
                    tile.char = char;
                    tile.class = className;
                }

               
            }

            // *** CHANGED: Clean up removed projectiles ***
            const currentProjectileIds = new Set(projectiles.map(p => p.id));
            for (const [projId] of this.previousProjectilePositions) {
                if (!currentProjectileIds.has(projId)) {
                    const oldPos = this.previousProjectilePositions.get(projId);
                    const oldTileKey = `${oldPos.x},${oldPos.y}`;
                    if (oldTileKey !== playerTileKey) {
                        renderState.activeRenderZone.add(oldTileKey);
                    }
                    this.previousProjectilePositions.delete(projId);
                }
            }
        }

        if (force) gameState.needsRender = false;
        gameState.needsInitialRender = false;
    }

    viewportEdgeScroll() {
        const mapElement = document.getElementById('map');
        const player = this.entityManager.getEntity('player');
        const state = this.entityManager.getEntity('state');
        if (!player || !mapElement || !state) {
            console.warn('RenderSystem: viewportEdgeScroll - Missing required elements', { player, mapElement, state });
            return;
        }

        const viewportWidth = mapElement.clientWidth;
        const viewportHeight = mapElement.clientHeight;
        const mapWidth = state.getComponent('LevelDimensions').WIDTH * this.TILE_SIZE;
        const mapHeight = state.getComponent('LevelDimensions').HEIGHT * this.TILE_SIZE;

        const thresholdX = viewportWidth * this.VIEWPORT_EDGE_THRESHOLD_PERCENT;
        const thresholdY = viewportHeight * this.VIEWPORT_EDGE_THRESHOLD_PERCENT;

        const playerPos = player.getComponent('Position');
        const playerX = playerPos.x * this.TILE_SIZE;
        const playerY = playerPos.y * this.TILE_SIZE;
        const currentScrollX = mapElement.scrollLeft;
        const currentScrollY = mapElement.scrollTop;

        const playerViewportX = playerX - currentScrollX;
        const playerViewportY = playerY - currentScrollY;

        let targetScrollX = currentScrollX;
        let targetScrollY = currentScrollY;

        if (playerViewportX < thresholdX) {
            targetScrollX = playerX - thresholdX;
        } else if (playerViewportX + this.TILE_SIZE > viewportWidth - thresholdX) {
            targetScrollX = playerX + this.TILE_SIZE - (viewportWidth - thresholdX);
        }

        if (playerViewportY < thresholdY) {
            targetScrollY = playerY - thresholdY;
        } else if (playerViewportY + this.TILE_SIZE > viewportHeight - thresholdY) {
            targetScrollY = playerY + this.TILE_SIZE - (viewportHeight - thresholdY);
        }

        targetScrollX = Math.max(0, Math.min(targetScrollX, mapWidth - viewportWidth));
        targetScrollY = Math.max(0, Math.min(targetScrollY, mapHeight - viewportHeight));

        if (Math.abs(targetScrollX - currentScrollX) < this.SCROLL_THRESHOLD && Math.abs(targetScrollY - currentScrollY) < this.SCROLL_THRESHOLD) {
            return;
        }

        let startTime = null;
        const easeInOutQuad = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

        const animateScroll = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / this.SCROLL_DURATION, 1);
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
        const state = this.entityManager.getEntity('state');
        if (!mapElement || !player || !state) {
            console.warn('RenderSystem: setInitialScroll - Missing required elements', { mapElement, player, state });
            return;
        }
        const playerPos = player.getComponent('Position');
        const viewportWidth = mapElement.clientWidth;
        const viewportHeight = mapElement.clientHeight;
        const mapWidth = state.getComponent('LevelDimensions').WIDTH * this.TILE_SIZE;
        const mapHeight = state.getComponent('LevelDimensions').HEIGHT * this.TILE_SIZE;

        let scrollX = (playerPos.x * this.TILE_SIZE ) - (viewportWidth /2 );
        let scrollY = (playerPos.y * this.TILE_SIZE ) - (viewportHeight /2 );

        scrollX = Math.max(0, Math.min(scrollX, mapWidth - viewportWidth));
        scrollY = Math.max(0, Math.min(scrollY, mapHeight- viewportHeight));

        mapElement.scrollLeft = scrollX;
        mapElement.scrollTop = scrollY;
    }
}