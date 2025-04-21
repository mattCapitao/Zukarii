// systems/RenderSystem.js - Corrected
import { System } from '../core/Systems.js';
import { titleScreen } from '../titlescreen.js';

export class RenderSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Position', 'Visuals'];
        this.mapDiv = document.getElementById('map');
        this.tileMap = {};
        this.lastTier = null;
        this.SCALE_FACTOR = 2
        this.TILE_SIZE = 32;
        this.VIEWPORT_EDGE_THRESHOLD_PERCENT = 0.33;
        this.SCROLL_THRESHOLD = 4;
        this.SCROLL_DURATION = 250;
    }
    
    init() {
       // this.eventBus.on('RenderNeeded', () => this.render(true));
        this.eventBus.on('PositionChanged', (data) => {

            if (data.entityId === 'player') {
                // Handle player repositioning (e.g., level start)
                const renderState = this.entityManager.getEntity('renderState')?.getComponent('RenderState');
                const pos = this.entityManager.getEntity(data.entityId)?.getComponent('Position');
                if (pos) {
                    renderState.activeRenderZone.add(`${pos.x},${pos.y}`);
                    renderState.activeRenderZone.add(`${data.x},${data.y}`);
                    pos.x = data.x;
                    pos.y = data.y;
                }
            }
            
            this.viewportEdgeScroll();
        });
        this.eventBus.on('DiscoveredStateUpdated', () => this.render(true));
        this.eventBus.on('LightingStateChanged', () => this.render(true));

        this.titleScreenContainer = document.getElementById('splash');
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        if (!gameState.gameStarted) {
            this.displayTitleScreen();
        }
    }
   

 

    update() {  
        this.render();
    }

    displayTitleScreen() {
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        this.titleScreenContainer.style.display = 'flex';
        this.titleScreenContainer.innerHTML = titleScreen;
        this.mapDiv.style.display = 'none';
        gameState.needsRender = false;
    }


    render() {
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        const renderState = this.entityManager.getEntity('renderState')?.getComponent('RenderState');
        const renderControl = this.entityManager.getEntity('renderState')?.getComponent('RenderControl');
        const player = this.entityManager.getEntity('player');
        const state = this.entityManager.getEntity('state');

        if (!gameState || !gameState?.gameStarted) {
            console.warn('RenderSystem: Game not started or gameState missing');
            return;
        }
        if (renderControl.locked) {
            console.warn('RenderSystem: Render is locked, skipping render');
            return;
        }

        // Check for entities with the NeedsRender component
        const renderEntities = this.entityManager.getEntitiesWith('NeedsRender');
        const removeEntities = this.entityManager.getEntitiesWith('RemoveEntityComponent');
        if (renderEntities.length > 0 || removeEntities.length > 0) {
            gameState.needsRender = true;
            // Remove the NeedsRender component from all entities
            renderEntities.forEach(entity => {
                this.entityManager.removeComponentFromEntity(entity.id, 'NeedsRender');
            });
        }

        if (!gameState.needsRender) return;

        this.titleScreenContainer.style.display = 'none';
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

        const walls = this.entityManager.getEntitiesWith(['Position', 'Wall']);
        const floors = this.entityManager.getEntitiesWith(['Position', 'Floor']);
        const monsters = this.entityManager.getEntitiesWith(['Position', 'Health', 'MonsterData']);
        const projectiles = this.entityManager.getEntitiesWith(['Position', 'Projectile']);
        const treasures = this.entityManager.getEntitiesWith(['Position', 'LootData']);
        const fountains = this.entityManager.getEntitiesWith(['Position', 'Fountain']);
        const stairs = this.entityManager.getEntitiesWith(['Position', 'Stair']);
        const portals = this.entityManager.getEntitiesWith(['Position', 'Portal']);

        let avatar = '';
        let imgElement = '';

        // Collect all DOM updates for batching
        const updates = [];

        if (!Object.keys(this.tileMap).length) {
            let mapDisplay = '';
            let playerSpawnLocations = '';
            for (let y = 0; y < HEIGHT; y++) {
                for (let x = 0; x < WIDTH; x++) {
                    const tileKey = `${x},${y}`;
                    let char = ' ';
                    let className = 'undiscovered';

                    if (exploration.discoveredWalls.has(tileKey)) {
                        className = 'discovered wall';
                    }
                    if (exploration.discoveredFloors.has(tileKey)) {
                        className = 'discovered';
                    }

                    const wall = walls.find(w => {
                        const pos = w.getComponent('Position');
                        return pos.x === x && pos.y === y;
                    });
                    if (wall) {
                        className = exploration.discoveredWalls.has(tileKey) ? 'discovered wall' : 'undiscovered wall';
                        char = ' ';
                    }

                    const floor = floors.find(f => {
                        const pos = f.getComponent('Position');
                        return pos.x === x && pos.y === y;
                    });
                    if (floor && !wall) {
                        char = ' ';
                        className = exploration.discoveredFloors.has(tileKey) ? 'discovered floor' : 'undiscovered floor';
                    }

                    const projectile = projectiles.find(p => {
                        const pos = p.getComponent('Position');
                        return pos.x === x && pos.y === y;
                    });
                    if (x === playerPos.x && y === playerPos.y) {
                        playerSpawnLocations += `Rendering player at${x},${y}`;
                        avatar = player.getComponent('Visuals').avatar;
                        const faceLeft = player.getComponent('Visuals').faceLeft;
                        const playerHealth = player.getComponent('Health');

                        imgElement = `<img src="${avatar}" height="28px" width="32px" style="" />`;
                        className = 'player';

                        if (player.hasComponent('InCombat')) {
                            const hpBarWidth = Math.floor((playerHealth.hp / playerHealth.maxHp) * (this.TILE_SIZE / 2));
                            imgElement = `<img src="${avatar}" height="28px" width="32px" style="background-size:${hpBarWidth}px 2px; background-position:8px 0;" />`;
                            className += ' has-hp-bar';
                        }

                        let torchAlignClass = '';
                        if (faceLeft) {
                            className += ' face-left';
                            torchAlignClass = 'torch-left';
                        }

                        const lightingState = this.entityManager.getEntity('lightingState')?.getComponent('LightingState');
                        let torch = '';
                        if (lightingState?.isLit) {
                            torch = `<span id="torch" class="flicker ${torchAlignClass}"></span>`;
                        }

                        imgElement += torch;
                    } else if (projectile) {
                        if (projectile.hasComponent('RemoveEntityComponent')) {
                            char = ' ';
                            className = 'discovered';
                        } else {
                            char = '*';
                            className = 'discovered projectile';
                        }
                    } else {
                        let fountainData = null;
                        const fountain = fountains.find(f => {
                            const pos = f.getComponent('Position');
                            fountainData = f.getComponent('Fountain');
                            return pos.x === x && pos.y === y;
                        });
                        if (fountain) {
                            const a = fountain.getComponent('Visuals').avatar;
                            if (a) {
                                avatar = a;
                            } else {
                                console.warn('RenderSystem: No avatar found for fountain. Rendering Fallback');
                                avatar = 'img/avatars/fountain.png';
                            }
                            imgElement = `<img src="${avatar}" height="32px" width="32px"/>`;
                            className = exploration.discoveredFloors.has(tileKey) ? 'discovered' : 'undiscovered';
                            className += ' fountain';
                            if (fountainData.used) {
                                className += ' used';
                            }
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
                                        imgElement = `<img src="${avatar}" height="32px;" width="32px;"/>`;
                                        break;
                                    case 'down':
                                        avatar = a || 'img/avatars/stairsdown.png';
                                        imgElement = `<img src="${avatar}" height="32px;" width="32px;"/>`;
                                        break;
                                }
                                className = exploration.discoveredFloors.has(tileKey) ? 'discovered' : 'undiscovered';
                                className += stairComp.direction === 'down' ? ' stair down' : ' stair down';
                            } else {
                                const portal = portals.find(p => {
                                    const pos = p.getComponent('Position');
                                    return pos.x === x && pos.y === y;
                                });
                                if (portal) {
                                    console.log('RenderSystem: Found portal at', x, y, portal);
                                    const a = portal.getComponent('Visuals').avatar;
                                    if (a) {
                                        avatar = a;
                                    } else {
                                        console.warn('RenderSystem: No avatar found for portal. Rendering Fallback');
                                        avatar = 'img/avatars/portal.png';
                                    }
                                    imgElement = `<img src="${avatar}" height="40" width="32"/>`;
                                    className = exploration.discoveredFloors.has(tileKey) ? 'discovered' : 'undiscovered';
                                    className += ' portal';
                                } else {
                                    const treasure = treasures.find(t => {
                                        const pos = t.getComponent('Position');
                                        return pos.x === x && pos.y === y;
                                    });
                                    if (treasure) {
                                        console.log('RenderSystem: Found treasure at', x, y, treasure);
                                        const lootVisuals = treasure.getComponent('Visuals');
                                        console.log('RenderSystem: Found treasure visuals', lootVisuals);
                                        const a = lootVisuals.avatar;
                                        if (a) {
                                            avatar = a;
                                        } else {
                                            console.warn('RenderSystem: No avatar found for treasure. Rendering Fallback');
                                            avatar = `img/avatars/chest.png`;
                                        }
                                        imgElement = `<img src="${avatar}" height="16px" width="24px;"/>`;
                                        className += ' treasure';
                                    } else {
                                        const monster = monsters.find(m => {
                                            const pos = m.getComponent('Position');
                                            return pos.x === x && pos.y === y && m.getComponent('Health').hp > 0;
                                        });
                                        let monsterData = null;
                                        className = exploration.discoveredFloors.has(tileKey) ? 'discovered' : 'undiscovered';
                                        if (monster) {
                                            monsterData = monster.getComponent('MonsterData');
                                            char = ' ';
                                            avatar = '';
                                            className += ` monster ${monsterData.classes}`;
                                           
                                            const health = monster.getComponent('Health');
                                            let hpBarWidth = 0;
                                            if (health.hp !== health.maxHp) {
                                                hpBarWidth = Math.floor((health.hp / health.maxHp) * (this.TILE_SIZE / 2));
                                                className += ' has-hp-bar';
                                            }
                                            const faceLeft = monster.getComponent('Visuals').faceLeft;
                                            if (faceLeft) {
                                                className += ' face-left';
                                            }
                                            if (monsterData.isElite) className += ' elite';
                                            if (monsterData.isBoss) className += ' boss';
                                            monsterData.affixes.forEach(affix => className += ` ${affix}`);
                                            const a = monster?.getComponent('Visuals').avatar;
                                            if (a) {
                                                avatar = a;
                                            } else if (monsterData.avatar) {
                                                console.log('RenderSystem: No monster avatar found is Visuals. Rendering MonsterData Fallback: ', monsterData.avatar);
                                                avatar = monsterData.avatar;
                                            } else {
                                                console.warn('RenderSystem: No avatar found for monster in MonsterData. Rendering static Fallback');
                                                avatar = 'img/avatars/monsters/skeleton.png';
                                            }
                                            imgElement = `<img src="${avatar}" height="30px" width="32px" style="background-size:${hpBarWidth}px 2px; background-position:8px 0;" />`;
                                            avatar = '';
                                            console.log(`Initial render - Monster with Classes: ${className} at ${x},${y}`); 
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if (imgElement) {
                        mapDisplay += `<span class="${className}" data-x="${x}" data-y="${y}">${imgElement}</span>`;
                        imgElement = '';
                        avatar = '';
                        char = '';
                    } else if (avatar) {
                        mapDisplay += `<span class="${className}" data-x="${x}" data-y="${y}"><img src="${avatar}" /></span>`;
                        avatar = '';
                        char = '';
                    } else {
                        mapDisplay += `<span class="${className}" data-x="${x}" data-y="${y}">${char}</span>`;
                        char = '';
                    }
                }
                mapDisplay += '\n';
            }
            this.mapDiv.innerHTML = mapDisplay;

            for (let y = 0; y < HEIGHT; y++) {
                for (let x = 0; x < WIDTH; x++) {
                    const element = this.mapDiv.querySelector(`span[data-x="${x}"][data-y="${y}"]`);
                    const tileKey = `${x},${y}`;
                    let char = ' ';
                    if (walls.some(w => w.getComponent('Position').x === x && w.getComponent('Position').y === y)) {
                        if (!element.classList.contains('wall')) {
                            element.className += ' wall';
                        }
                    }
                    this.tileMap[tileKey] = { char, class: element.className, element };
                }
            }

            this.setInitialScroll();
        } else {
            const exploration = tierEntity.getComponent('Exploration');
            const movables = this.entityManager.getEntitiesWith(['Position', 'LastPosition']);

            // Update active render zone for movables
            for (const entity of movables) {
                const pos = entity.getComponent('Position');
                const lastPos = entity.getComponent('LastPosition');
                if (pos.x !== lastPos.x || pos.y !== lastPos.y) {
                    renderState.activeRenderZone.add(`${pos.x},${pos.y}`);
                    renderState.activeRenderZone.add(`${lastPos.x},${lastPos.y}`);
                    if (!exploration.discoveredFloors.has(`${pos.x},${pos.y}`)) {
                        exploration.discoveredFloors.add(`${pos.x},${pos.y}`);
                    }
                }
            }

            // Phase 1: Update static objects (walls, floors, fountains, stairs, portals, treasures)
            for (const tileKey of renderState.activeRenderZone) {
                const [x, y] = tileKey.split(',').map(Number);
                const tile = this.tileMap[tileKey];
                let className = 'undiscovered';
                let char = tile.char;

                // Static object checks
                const wall = walls.find(w => w.getComponent('Position').x === x && w.getComponent('Position').y === y);
                const fountain = fountains.find(f => f.getComponent('Position').x === x && f.getComponent('Position').y === y);
                const stair = stairs.find(s => s.getComponent('Position').x === x && s.getComponent('Position').y === y);
                const portal = portals.find(p => p.getComponent('Position').x === x && p.getComponent('Position').y === y);
                const treasure = treasures.find(t => t.getComponent('Position').x === x && t.getComponent('Position').y === y);

                if (wall) {
                    className = exploration.discoveredWalls.has(tileKey) ? 'discovered wall' : 'undiscovered wall';
                } else if (exploration.discoveredFloors.has(tileKey)) {
                    className = 'discovered';
                    if (fountain) {
                        const fountainData = fountain.getComponent('Fountain');
                        className += ' fountain';
                        if (fountainData.used) className += ' used';
                    } else if (stair) {
                        const stairComp = stair.getComponent('Stair');
                        className += stairComp.direction === 'down' ? ' stair down' : ' stair up';
                    } else if (portal) {
                        className += ' portal';
                    } else if (treasure) {
                        const a = treasure.getComponent('Visuals').avatar;
                        if (a) {
                            avatar = a;
                        } else {
                            console.warn('RenderSystem: No avatar found for treasure. Rendering Fallback');
                            avatar = 'img/avatars/chest.png';
                        }
                        const treasureImg = `<img src="${avatar}" height="16px" width="24px;"/>`;
                        className += ' treasure';
                        if (tile.char !== treasureImg && exploration.discoveredFloors.has(tileKey)) {
                            char = treasureImg;
                            updates.push({ element: tile.element, innerHTML: char, updateInnerHTML: true, className });
                            tile.char = char;
                            tile.class = className;
                        } else if (tile.class !== className) {
                            updates.push({ element: tile.element, innerHTML: false, className });
                            tile.class = className;
                        }
                        continue; // Skip moving phase for this tile
                    }
                }

                // Collect static tile update if class has changed
                if (tile.class !== className) {
                    updates.push({ element: tile.element, innerHTML: false, className });
                    tile.class = className;
                }
            }

            // Phase 2: Update moving objects (player, monsters, projectiles)
            // Build entity position index
            const entitiesByPosition = new Map();
            [player, ...monsters, ...projectiles].forEach(entity => {
                const pos = entity.getComponent('Position');
                const key = `${pos.x},${pos.y}`;
                if (!entitiesByPosition.has(key)) entitiesByPosition.set(key, []);
                entitiesByPosition.get(key).push(entity);
            });

            for (const tileKey of renderState.activeRenderZone) {
                const [x, y] = tileKey.split(',').map(Number);
                const tile = this.tileMap[tileKey];
                let char = ' ';
                let className = tile.class; // Start with static class
                let avatar = '';

                // Skip tiles handled by treasures in static phase
                if (className.includes('treasure')) continue;

                // Get entities at this tile using the index
                const entitiesAtTile = entitiesByPosition.get(tileKey) || [];
                const projectile = entitiesAtTile.find(e => e.hasComponent('Projectile'));
                const monster = entitiesAtTile.find(e => e.hasComponent('MonsterData') && e.getComponent('Health').hp > 0);
                const isPlayer = playerPos.x === x && playerPos.y === y;

                if (isPlayer) {
                    avatar = player.getComponent('Visuals').avatar;
                    const faceLeft = player.getComponent('Visuals').faceLeft;
                    const playerHealth = player.getComponent('Health');

                    char = `<img src="${avatar}" height="28px" width="32px" style="" />`;
                    className = 'player';

                    if (player.hasComponent('InCombat')) {
                        const hpBarWidth = Math.floor((playerHealth.hp / playerHealth.maxHp) * (this.TILE_SIZE / 2));
                        char = `<img src="${avatar}" height="28px" width="32px" style="background-size:${hpBarWidth}px 2px; background-position:8px 0;" />`;
                        className += ' has-hp-bar';
                    }

                    let torchAlignClass = '';
                    if (faceLeft) {
                        className += ' face-left';
                        torchAlignClass = 'torch-left';
                    }

                    const lightingState = this.entityManager.getEntity('lightingState')?.getComponent('LightingState');
                    if (lightingState?.isLit) {
                        char += `<span id="torch" class="flicker ${torchAlignClass}"></span>`;
                    }
                } else if (projectile) {
                    if (projectile.hasComponent('RemoveEntityComponent')) {
                        char = ' ';
                        className = 'discovered';
                    } else {
                        char = '*';
                        className = 'discovered projectile';
                    }
                } else if (monster) {
                    const visuals = monster.getComponent('Visuals');
                    avatar = visuals?.avatar || 'img/avatars/monsters/skeleton.png';
                    const monsterData = monster.getComponent('MonsterData');
                    className = `monster ${monsterData.classes}`;

                    if (monsterData.isDetected || monsterData.isAggro) {
                        monsterData.isDetected = true;
                        className += ' detected';
                    } else {
                        monsterData.isDetected = false;
                        className += ' undiscovered';
                    }

                    const health = monster.getComponent('Health');
                    let hpBarWidth = 0;
                    if (health.hp !== health.maxHp) {
                        hpBarWidth = Math.floor((health.hp / health.maxHp) * (this.TILE_SIZE / 2));
                        className += ' has-hp-bar';
                    }

                    if (monsterData.isElite) className += ' elite';
                    if (monsterData.isBoss) className += ' boss';
                    monsterData.affixes.forEach(affix => className += ` ${affix}`);

                    const faceLeft = visuals.faceLeft;
                    if (faceLeft) className += ' face-left';

                    char = `<img src="${avatar}" height="32px" width="32px" style="background-size:${hpBarWidth}px 2px; background-position:8px 0;" />`;
                }

                // Collect moving tile update if content or class has changed
                if (tile.char !== char || tile.class !== className) {
                    updates.push({ element: tile.element, innerHTML: char, updateInnerHTML: true, className });
                    tile.char = char;
                    tile.class = className;
                }
            }

            // Apply all DOM updates in a single requestAnimationFrame
            requestAnimationFrame(() => {
                updates.forEach(({ element, innerHTML, updateInnerHTML, className }) => {
                    if (updateInnerHTML) {
                        element.innerHTML = innerHTML;
                    }
                    element.className = className;
                });
            });
        }

        gameState.needsRender = false;
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
        const thresholdY = viewportHeight * this.VIEWPORT_EDGE_THRESHOLD_PERCENT * 1.2;

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