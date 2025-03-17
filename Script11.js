// Game.js
import { State } from './State.js';
import { ActionSystem } from './systems/ActionSystem.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { RenderSystem } from './systems/RenderSystem.js';
import { PlayerSystem } from './systems/PlayerSystem.js';
import { MonsterSystem } from './systems/MonsterSystem.js';
import { LevelSystem } from './systems/LevelSystem.js';
import { ItemSystem } from './systems/ItemSystem.js';
import { TreasureSystem } from './systems/TreasureSystem.js';
import { InventorySystem } from './systems/InventorySystem.js';
import { UISystem } from './systems/UISystem.js';
import { LevelTransitionSystem } from './systems/LevelTransitionSystem.js';
import { AudioSystem } from './systems/AudioSystem.js';
import { DataSystem } from './systems/DataSystem.js';
import { LootTableSystem } from './systems/LootTableSystem.js';
import { PositionComponent, HealthComponent, ManaComponent, StatsComponent, InventoryComponent, ResourceComponent, PlayerStateComponent } from './core/Components.js';

export class Game {
    constructor() {
        this.state = new State();
        this.entityManager = this.state.entityManager;
        this.systems = {};
        this.lastUpdateTime = 0;

        console.log('Creating state entity...');
        let stateEntity = this.entityManager.getEntity('state');
        if (!stateEntity) {
            stateEntity = this.entityManager.createEntity('state');
            this.entityManager.addComponentToEntity('state', {
                type: 'Utilities',
                utilities: {
                    dRoll: (sides, numDice, rolls) => {
                        let results = [];
                        for (let i = 0; i < rolls; i++) {
                            let sum = 0;
                            for (let j = 0; j < numDice; j++) {
                                sum += Math.floor(Math.random() * sides) + 1;
                            }
                            results.push(sum);
                        }
                        return Math.max(...results);
                    },
                    generateUniqueId: () => Math.random().toString(36).substr(2, 9)
                }
            });
            this.entityManager.addComponentToEntity('state', { type: 'DiscoveryRadius', discoveryRadiusDefault: 2 });
            console.log('State entity created:', this.entityManager.getEntity('state'));
        }

        console.log('Checking for existing player entity...');
        let player = this.entityManager.getEntity('player');
        if (player) {
            console.log('Player entity exists, resetting it...');
            this.entityManager.removeEntity('player');
        }
        console.log('Creating new player entity...');
        player = this.entityManager.createEntity('player');
        this.entityManager.addComponentToEntity('player', new PositionComponent(1, 1));
        this.entityManager.addComponentToEntity('player', new HealthComponent(0, 0));
        this.entityManager.addComponentToEntity('player', new ManaComponent(0, 0));
        this.entityManager.addComponentToEntity('player', new StatsComponent());
        this.entityManager.addComponentToEntity('player', new InventoryComponent({
            equipped: { mainhand: null, offhand: null, armor: null, amulet: null, leftring: null, rightring: null },
            items: []
        }));
        this.entityManager.addComponentToEntity('player', new ResourceComponent(0, 0, 0, 0, 0, 0));
        this.entityManager.addComponentToEntity('player', new PlayerStateComponent(0, 1, 0, false, false, false, ''));
        console.log('Player entity created with default components:', this.entityManager.getEntity('player'));

        console.log('Creating overlayState entity...');
        let overlayState = this.entityManager.getEntity('overlayState');
        if (!overlayState) {
            overlayState = this.entityManager.createEntity('overlayState');
            this.entityManager.addComponentToEntity('overlayState', {
                type: 'OverlayState',
                isOpen: false,
                activeTab: null,
                logMessages: []
            });
            console.log('OverlayState entity created:', this.entityManager.getEntity('overlayState'));
        }

        console.log('Creating renderState entity...');
        let renderStateEntity = this.entityManager.getEntity('renderState');
        if (!renderStateEntity) {
            renderStateEntity = this.entityManager.createEntity('renderState');
            this.entityManager.addComponentToEntity('renderState', {
                type: 'RenderState',
                discoveryRadius: 2
            });
            console.log('RenderState entity created:', this.entityManager.getEntity('renderState'));
        }

        console.log('Entities before systems:', this.entityManager.getAllEntities());
        this.initializeSystems();
        this.state.eventBus.emit('InitializePlayer');
        console.log('Systems initialized');
        this.setupEventListeners();
        this.startGameLoop(); // New method to initiate continuous updates
    }

    initializeSystems() {
        this.systems = {
            data: new DataSystem(this.entityManager, this.state.eventBus),
            action: new ActionSystem(this.entityManager, this.state.eventBus),
            combat: new CombatSystem(this.entityManager, this.state.eventBus),
            render: new RenderSystem(this.entityManager, this.state.eventBus),
            player: new PlayerSystem(this.entityManager, this.state.eventBus),
            monster: new MonsterSystem(this.entityManager, this.state.eventBus, this.systems.data),
            level: new LevelSystem(this.entityManager, this.state.eventBus, this.state),
            item: new ItemSystem(this.entityManager, this.state.eventBus),
            treasure: new TreasureSystem(this.entityManager, this.state.eventBus),
            inventory: new InventorySystem(this.entityManager, this.state.eventBus),
            ui: new UISystem(this.entityManager, this.state.eventBus),
            levelTransition: new LevelTransitionSystem(this.entityManager, this.state.eventBus),
            audio: new AudioSystem(this.entityManager, this.state.eventBus),
            lootTable: new LootTableSystem(this.entityManager, this.state.eventBus)
        };

        Object.values(this.systems).forEach(system => system.init());
    }

    setupEventListeners() {
        document.addEventListener('keydown', (event) => this.handleInput(event));
        document.addEventListener('keyup', (event) => this.handleInput(event));
    }

    handleInput(event) {
        const gameState = this.state.getGameState()?.getComponent('GameState');
        if (!gameState) return;

        if (!gameState.gameStarted) {
            gameState.gameStarted = true;
            this.state.eventBus.emit('ToggleBackgroundMusic', { play: true });
            this.state.eventBus.emit('RenderNeeded');
            this.updateSystems(['audio', 'render', 'ui']);
            return;
        }

        if (gameState.gameOver) return;

        const keyMap = {
            'w': 'ArrowUp', 'W': 'ArrowUp', 'ArrowUp': 'ArrowUp',
            'a': 'ArrowLeft', 'A': 'ArrowLeft', 'ArrowLeft': 'ArrowLeft',
            's': 'ArrowDown', 'S': 'ArrowDown', 'ArrowDown': 'ArrowDown',
            'd': 'ArrowRight', 'D': 'ArrowRight', 'ArrowRight': 'ArrowRight',
            'i': 'c', 'I': 'c', 'c': 'c', 'C': 'c',
            'l': 'l', 'L': 'l',
            'escape': 'escape', 'Escape': 'escape',
            't': 't', 'T': 't',
            'h': 'h', 'H': 'h',
            ' ': ' ', 'Space': ' '
        };

        const mappedKey = keyMap[event.key];
        if (!mappedKey) return;

        if (event.type === 'keydown' && !event.repeat) {
            console.log(`Key pressed: ${mappedKey}`);
        }

        if (event.type === 'keyup' && mappedKey === ' ') {
            this.state.eventBus.emit('ToggleRangedMode', { event });
            console.log('space keyUp detected');
            this.updateSystems(['player', 'render']);
            return;
        }

        if (event.type === 'keydown' && !event.repeat) {
            const player = this.state.getPlayer();
            if (!player) return;
            const playerPos = player.getComponent('Position');
            const levelEntity = this.entityManager.getEntitiesWith(['Map', 'Tier']).find(e => e.getComponent('Tier').value === gameState.tier);
            if (!levelEntity) return;
            const map = levelEntity.getComponent('Map').map;

            let newX = playerPos.x;
            let newY = playerPos.y;

            switch (mappedKey) {
                case 'ArrowUp':
                    if (gameState.isRangedMode) {
                        this.state.eventBus.emit('RangedAttack', { direction: mappedKey });
                        this.endTurn('rangedAttack');
                        return;
                    }
                    newY--;
                    break;
                case 'ArrowDown':
                    if (gameState.isRangedMode) {
                        this.state.eventBus.emit('RangedAttack', { direction: mappedKey });
                        this.endTurn('rangedAttack');
                        return;
                    }
                    newY++;
                    break;
                case 'ArrowLeft':
                    if (gameState.isRangedMode) {
                        this.state.eventBus.emit('RangedAttack', { direction: mappedKey });
                        this.endTurn('rangedAttack');
                        return;
                    }
                    newX--;
                    break;
                case 'ArrowRight':
                    if (gameState.isRangedMode) {
                        this.state.eventBus.emit('RangedAttack', { direction: mappedKey });
                        this.endTurn('rangedAttack');
                        return;
                    }
                    newX++;
                    break;
                case 'c':
                    console.log('Emitting ToggleOverlay for character tab');
                    this.state.eventBus.emit('ToggleOverlay', { tab: 'character' });
                    this.updateSystems(['ui']);
                    return;
                case 'l':
                    console.log('Emitting ToggleOverlay for log tab');
                    this.state.eventBus.emit('ToggleOverlay', { tab: 'log' });
                    this.updateSystems(['ui']);
                    return;
                case 'escape':
                    console.log('Emitting ToggleOverlay to close');
                    this.state.eventBus.emit('ToggleOverlay', {});
                    this.updateSystems(['ui']);
                    return;
                case 't':
                    this.state.eventBus.emit('LightTorch');
                    this.updateSystems(['player', 'render', 'ui', 'audio']);
                    this.state.eventBus.emit('RenderNeeded');
                    this.endTurn('lightTorch');
                    return;
                case 'h':
                    this.state.eventBus.emit('DrinkHealPotion');
                    this.updateSystems(['player', 'render']);
                    return;
                case ' ':
                    this.state.eventBus.emit('ToggleRangedMode', { event });
                    this.updateSystems(['player', 'render']);
                    console.log('space keyDown detected');
                    return;
            }

            const monsters = this.entityManager.getEntitiesWith(['Position', 'Health', 'MonsterData']);
            const monster = monsters.find(m => m.getComponent('Position').x === newX && m.getComponent('Position').y === newY && m.getComponent('Health').hp > 0);
            const fountain = this.entityManager.getEntitiesWith(['Position', 'FountainData']).find(f => f.getComponent('Position').x === newX && f.getComponent('Position').y === newY && !f.getComponent('FountainData').used);
            const treasure = this.entityManager.getEntitiesWith(['Position', 'TreasureData']).find(t => t.getComponent('Position').x === newX && t.getComponent('Position').y === newY);

            if (monster) {
                this.state.eventBus.emit('MeleeAttack', { targetEntityId: monster.id });
                this.endTurn('meleeAttack');
                return;
            }
            if (fountain) {
                this.state.eventBus.emit('UseFountain', { fountainEntityId: fountain.id, tierEntityId: levelEntity.id });
                this.endTurn('useFountain');
                return;
            }
            if (treasure) {
                this.state.eventBus.emit('PickupTreasure', { x: newX, y: newY });
                this.endTurn('pickupTreasure');
                return;
            }
            if (map[newY][newX] === '#') return;

            if (map[newY][newX] === '⇓') {
                this.state.eventBus.emit('TransitionDown');
                this.endTurn('transitionDown');
                return;
            }
            if (map[newY][newX] === '⇑') {
                this.state.eventBus.emit('TransitionUp');
                this.endTurn('transitionUp');
                return;
            }
            if (map[newY][newX] === '?') {
                this.state.eventBus.emit('TransitionViaPortal', { x: newX, y: newY });
                this.endTurn('transitionPortal');
                return;
            }

            if (!gameState.transitionLock && !gameState.isRangedMode) {
                playerPos.x = newX;
                playerPos.y = newY;
                this.state.eventBus.emit('PositionChanged', { entityId: 'player', x: newX, y: newY });
                this.endTurn('movement');
            }
        }
    }

    endTurn(source) {
        const gameState = this.state.getGameState()?.getComponent('GameState');
        if (!gameState || gameState.gameOver) return;

        const player = this.entityManager.getEntity('player');
        if (player) {
            const resource = player.getComponent('Resource');
            const playerState = player.getComponent('PlayerState');
            const renderState = this.entityManager.getEntity('renderState')?.getComponent('RenderState');
            const state = this.entityManager.getEntity('state');

            if (resource.torchExpires > 0) {
                resource.torchExpires--;
                if (resource.torchExpires < 1) {
                    this.state.eventBus.emit('TorchExpired');
                }
            }

            renderState.discoveryRadius = playerState.torchLit ?
                state.getComponent('DiscoveryRadius').discoveryRadiusDefault + 2 :
                state.getComponent('DiscoveryRadius').discoveryRadiusDefault;
            console.log('endTurn - discoveryRadius:', renderState.discoveryRadius);
        }

        this.state.eventBus.emit('MoveMonsters');
        gameState.transitionLock = false;
        gameState.needsRender = true;
        this.state.eventBus.emit('RenderNeeded');
        this.updateSystems(['player', 'monster', 'render', 'ui']);
    }

    updateSystems(systemsToUpdate) {
        systemsToUpdate.forEach(systemName => this.systems[systemName].update());
        this.lastUpdateTime = Date.now();
    }

    startGameLoop() {
        const gameLoop = () => {
            this.updateSystems(['combat', 'render', 'player', 'monster', 'ui']); // Update key systems each frame
            this.state.eventBus.emit('RenderNeeded'); // Ensure rendering is triggered
            requestAnimationFrame(gameLoop);
        };
        requestAnimationFrame(gameLoop);
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
        // Update tiles within visibilityRadius in a single pass
        const minX = Math.max(0, playerPos.x - visibilityRadius);
        const maxX = Math.min(width - 1, playerPos.x + visibilityRadius);
        const minY = Math.max(0, playerPos.y - visibilityRadius);
        const maxY = Math.min(height - 1, playerPos.y + visibilityRadius);

        const monsters = this.entityManager.getEntitiesWith(['Position', 'Health', 'MonsterData']);
        const projectiles = this.entityManager.getEntitiesWith(['Position', 'Projectile']);
        const projectilePositions = new Set(projectiles.map(p => `${p.getComponent('Position').x},${p.getComponent('Position').y}`));

        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const distance = Math.sqrt(Math.pow(playerPos.x - x, 2) + Math.pow(playerPos.y - y, 2));
                if (distance <= visibilityRadius) {
                    const tileKey = `${x},${y}`;
                    const tile = this.tileMap[tileKey];
                    let char = map[y][x];
                    let className = tile.element.classList.contains('discovered') ? 'discovered' : 'undiscovered';

                    // Reset to map state unless an entity is present
                    if (!projectilePositions.has(tileKey) && !(x === playerPos.x && y === playerPos.y)) {
                        const monster = monsters.find(m => m.getComponent('Position').x === x && m.getComponent('Position').y === y && m.getComponent('Health').hp > 0);
                        if (!monster) {
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
                    } else if (projectilePositions.has(tileKey)) {
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

// systems/CombatSystem.js
import { System } from '../core/Systems.js';
import { PositionComponent, HealthComponent } from '../core/Components.js';
import { ProjectileComponent } from '../core/Components.js';

export class CombatSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Position', 'Health'];
        this.frameDelay = 3; // Number of frames to wait before moving projectile (e.g., 3 frames ~50ms at 60 FPS)
        this.currentFrame = 0; // Counter for frame delay
    }

    init() {
        this.eventBus.on('MeleeAttack', (data) => this.handleMeleeAttack(data));
        this.eventBus.on('RangedAttack', (data) => this.handleRangedAttack(data));
        this.eventBus.on('ToggleRangedMode', (data) => this.toggleRangedMode(data));
    }

    update() {
        this.currentFrame = (this.currentFrame + 1) % this.frameDelay; // Increment and wrap around
        if (this.currentFrame !== 0) return; // Skip update if not at delay threshold

        const projectiles = this.entityManager.getEntitiesWith(['Position', 'Projectile']);
        projectiles.forEach(proj => {
            const pos = proj.getComponent('Position');
            const projData = proj.getComponent('Projectile');
            const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
            const tier = gameState.tier;
            const levelEntity = this.entityManager.getEntitiesWith(['Map', 'Tier']).find(e => e.getComponent('Tier').value === tier);
            if (!levelEntity) return;

            const map = levelEntity.getComponent('Map').map;
            const monsters = this.entityManager.getEntitiesWith(['Position', 'Health', 'MonsterData']);

            if (projData.rangeLeft > 0) {
                let dx = 0, dy = 0;
                switch (projData.direction) {
                    case 'ArrowUp': dy = -1; break;
                    case 'ArrowDown': dy = 1; break;
                    case 'ArrowLeft': dx = -1; break;
                    case 'ArrowRight': dx = 1; break;
                }

                const newX = pos.x + dx;
                const newY = pos.y + dy;

                // Check for wall collision
                if (newX < 0 || newX >= map[0].length || newY < 0 || newY >= map.length || map[newY][newX] === '#') {
                    this.entityManager.removeEntity(proj.id);
                    this.eventBus.emit('LogMessage', { message: 'Your shot hit a wall.' });
                    this.eventBus.emit('RenderNeeded');
                    return;
                }

                // Check for monster collision
                const target = monsters.find(m => {
                    const mPos = m.getComponent('Position');
                    const mHealth = m.getComponent('Health');
                    return mPos.x === newX && mPos.y === newY && mHealth.hp > 0;
                });

                if (target) {
                    const player = this.entityManager.getEntity('player');
                    const playerInventory = player.getComponent('Inventory');
                    const playerStats = player.getComponent('Stats');
                    const weapon = playerInventory.equipped.offhand || playerInventory.equipped.mainhand || { baseDamageMin: 1, baseDamageMax: 2, name: 'Fists' };
                    const damage = Math.floor(Math.random() * (weapon.baseDamageMax - weapon.baseDamageMin + 1)) + weapon.baseDamageMin + (playerStats.intellect || 0) + (playerStats.rangedDamageBonus || 0);
                    const targetHealth = target.getComponent('Health');
                    const targetMonsterData = target.getComponent('MonsterData');

                    targetHealth.hp -= damage;
                    this.eventBus.emit('LogMessage', {
                        message: `You dealt ${damage} damage to ${targetMonsterData.name} with your ${weapon.name} (${targetHealth.hp}/${targetHealth.maxHp})`
                    });

                    if (targetHealth.hp <= 0) {
                        this.eventBus.emit('MonsterDied', { entityId: target.id });
                    }
                    // Continue moving after hitting a monster
                }

                // Move projectile
                pos.x = newX;
                pos.y = newY;
                projData.rangeLeft--;
                this.eventBus.emit('PositionChanged', { entityId: proj.id, x: newX, y: newY });
                this.eventBus.emit('RenderNeeded');
            } else {
                this.entityManager.removeEntity(proj.id);
                this.eventBus.emit('RenderNeeded');
            }
        });
    }

    handleMeleeAttack({ targetEntityId }) {
        const player = this.entityManager.getEntity('player');
        const target = this.entityManager.getEntity(targetEntityId);
        if (!player || !target) return;

        const playerStats = player.getComponent('Stats');
        const playerInventory = player.getComponent('Inventory');
        const targetHealth = target.getComponent('Health');
        const targetMonsterData = target.getComponent('MonsterData');

        const weapon = playerInventory.equipped.mainhand || { baseDamageMin: 1, baseDamageMax: 2, name: 'Fists' };
        const damage = Math.floor(Math.random() * (weapon.baseDamageMax - weapon.baseDamageMin + 1)) + weapon.baseDamageMin + (playerStats.prowess || 0);
        targetHealth.hp -= damage;

        this.eventBus.emit('LogMessage', {
            message: `You dealt ${damage} damage to ${targetMonsterData.name} with your ${weapon.name} (${targetHealth.hp}/${targetHealth.maxHp})`
        });

        if (targetHealth.hp <= 0) {
            this.eventBus.emit('MonsterDied', { entityId: targetEntityId });
        }
    }

    handleRangedAttack({ direction }) {
        const player = this.entityManager.getEntity('player');
        if (!player) return;

        const playerPos = player.getComponent('Position');
        const playerInventory = player.getComponent('Inventory');
        const weapon = playerInventory.equipped.offhand || playerInventory.equipped.mainhand || { baseDamageMin: 1, baseDamageMax: 2, baseRange: 1, name: 'Fists' };
        const range = weapon.baseRange || 1;

        const projectile = this.entityManager.createEntity(`projectile_${Date.now()}`);
        this.entityManager.addComponentToEntity(projectile.id, new PositionComponent(playerPos.x, playerPos.y));
        this.entityManager.addComponentToEntity(projectile.id, new ProjectileComponent(direction, range));
        this.eventBus.emit('RenderNeeded');
    }

    toggleRangedMode({ event }) {
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const playerInventory = this.entityManager.getEntity('player').getComponent('Inventory');
        const offWeapon = playerInventory.equipped.offhand;
        const mainWeapon = playerInventory.equipped.mainhand;

        if (event.type === 'keyup' && event.key === ' ') {
            gameState.isRangedMode = false;
            console.log('Ranged mode off');
        } else if (event.type === 'keydown' && event.key === ' ' && !event.repeat) {
            if ((offWeapon?.attackType === 'ranged' && offWeapon?.baseRange > 0) ||
                (mainWeapon?.attackType === 'ranged' && mainWeapon?.baseRange > 0)) {
                gameState.isRangedMode = true;
                console.log('Ranged mode on');
            } else {
                this.eventBus.emit('LogMessage', { message: 'You need a valid ranged weapon equipped to use ranged mode!' });
            }
        }
    }
}