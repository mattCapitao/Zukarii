// Game.js
import { State } from './State.js';
import { ActionSystem } from './systems/ActionSystem.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { RenderSystem } from './systems/RenderSystem.js';
import { PlayerSystem } from './systems/PlayerSystem.js';
import { MonsterSystem } from './systems/MonsterSystem.js';
import { DamageCalculationSystem } from './systems/DamageCalculationSystem.js'; 
import { LevelSystem } from './systems/LevelSystem.js';
import { LootSpawnSystem } from './systems/LootSpawnSystem.js';
import { LootCollectionSystem } from './systems/LootCollectionSystem.js';
import { ItemROGSystem } from './systems/ItemROGSystem.js'; // Add this
import { LootManagerSystem } from './systems/LootManagerSystem.js';
import { InventorySystem } from './systems/InventorySystem.js';
import { UISystem } from './systems/UISystem.js';
import { LevelTransitionSystem } from './systems/LevelTransitionSystem.js';
import { AudioSystem } from './systems/AudioSystem.js';
import { DataSystem } from './systems/DataSystem.js';
import { PositionComponent, HealthComponent, ManaComponent, StatsComponent, InventoryComponent, ResourceComponent, PlayerStateComponent } from './core/Components.js';

export class Game {
    constructor() {
        this.state = new State();
        this.entityManager = this.state.entityManager;
        this.utilities = this.state.utilities;
        this.systems = {};
        this.lastUpdateTime = 0;
        this.lastMouseEventTime = 0; // Track last mouse event timestamp
        this.lastMovementTime = 0; // Track last movement timestamp
        this.movementThrottleInterval = 100; // Throttle interval in milliseconds

        //console.log('Creating state entity...');
        let stateEntity = this.entityManager.getEntity('state');
        if (!stateEntity) {
            stateEntity = this.entityManager.createEntity('state');
            this.entityManager.addComponentToEntity('state', { type: 'DiscoveryRadius', discoveryRadiusDefault: 2 });
            //console.log('State entity created:', this.entityManager.getEntity('state'));
        }

        //console.log('Checking for existing player entity...');
        let player = this.entityManager.getEntity('player');
        if (player) {
            //console.log('Player entity exists, resetting it...');
            this.entityManager.removeEntity('player');
        }
        //console.log('Creating new player entity...');
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
        //console.log('Player entity created with default components:', this.entityManager.getEntity('player'));

        //console.log('Creating overlayState entity...');
        let overlayState = this.entityManager.getEntity('overlayState');
        if (!overlayState) {
            overlayState = this.entityManager.createEntity('overlayState');
            this.entityManager.addComponentToEntity('overlayState', {
                type: 'OverlayState',
                isOpen: false,
                activeTab: null,
                logMessages: []
            });
            //console.log('OverlayState entity created:', this.entityManager.getEntity('overlayState'));
        }

        //console.log('Creating renderState entity...');
        let renderStateEntity = this.entityManager.getEntity('renderState');
        if (!renderStateEntity) {
            renderStateEntity = this.entityManager.createEntity('renderState');
            this.entityManager.addComponentToEntity('renderState', {
                type: 'RenderState',
                discoveryRadius: 2
            });
            //console.log('RenderState entity created:', this.entityManager.getEntity('renderState'));
        }

        //console.log('Entities before systems:', this.entityManager.getAllEntities());
        this.initializeSystems();
        this.state.eventBus.emit('InitializePlayer');
        this.state.eventBus.emit('RenderNeeded');
        //console.log('Systems initialized');
        this.setupEventListeners();
        this.startGameLoop();
    }

    initializeSystems() {
        //console.log('Game.js: initializeSystems start, gameState:', this.state.getGameState()?.getComponent('GameState'), 'entity ID:', this.state.getGameState()?.id, 'timestamp:', Date.now());
        //console.log('Game.js: EventBus instance:', this.state.eventBus);
        this.systems.data = new DataSystem(this.entityManager, this.state.eventBus);
        this.systems.data.init();


        this.systems = {
            
            action: new ActionSystem(this.entityManager, this.state.eventBus),
            damageCalculation: new DamageCalculationSystem(this.entityManager, this.state.eventBus),
            combat: new CombatSystem(this.entityManager, this.state.eventBus),
            render: new RenderSystem(this.entityManager, this.state.eventBus),
            lootSpawn: new LootSpawnSystem(this.entityManager, this.state.eventBus),
            lootCollection: new LootCollectionSystem(this.entityManager, this.state.eventBus),
            itemROG: new ItemROGSystem(this.entityManager, this.state.eventBus, this.utilities), 
            lootManager: new LootManagerSystem(this.entityManager, this.state.eventBus, this.utilities),
            player: new PlayerSystem(this.entityManager, this.state.eventBus, this.utilities),
            monster: new MonsterSystem(this.entityManager, this.state.eventBus, this.systems.data),
            level: new LevelSystem(this.entityManager, this.state.eventBus, this.state),
            inventory: new InventorySystem(this.entityManager, this.state.eventBus, this.utilities),
            ui: new UISystem(this.entityManager, this.state.eventBus, this.utilities),
            levelTransition: new LevelTransitionSystem(this.entityManager, this.state.eventBus),
            audio: new AudioSystem(this.entityManager, this.state.eventBus),
        };

        Object.values(this.systems).forEach(system => {
            //console.log(`Game.js: Initializing system ${system.constructor.name} with EventBus:`, this.state.eventBus);
            system.init();
        });

        //console.log('Game.js: initializeSystems end, gameState:', this.state.getGameState()?.getComponent('GameState'), 'entity ID:', this.state.getGameState()?.id, 'timestamp:', Date.now());
    }

    setupEventListeners() {
        document.addEventListener('keydown', (event) => this.handleInput(event));
        document.addEventListener('keyup', (event) => this.handleInput(event));
        document.addEventListener('mousedown', () => this.updateLastMouseEvent()); // Track mouse clicks
        document.addEventListener('mousemove', () => this.updateLastMouseEvent()); // Optional: track movement
    }

    updateLastMouseEvent() {
        this.lastMouseEventTime = Date.now();
       // //console.log('Mouse event detected, lastMouseEventTime updated:', this.lastMouseEventTime);
    }

    handleInput(event) {
        //console.log(`Game.js: Handling ${event.type} event for key: ${event.key}`);
        const gameState = this.state.getGameState()?.getComponent('GameState');
        if (!gameState) {
            console.error('Game.js: gameState not found or missing GameState component');
        } else {
            //console.log('Game.js: handleInput start, gameState:', gameState, 'entity ID:', this.state.getGameState()?.id, 'timestamp:', Date.now());
        }

        if (gameState && !gameState.gameStarted) {
            //console.log('Game.js: Starting game on first keypress');
            gameState.gameStarted = true;
            gameState.needsRender = true;
            this.state.eventBus.emit('ToggleBackgroundMusic', { play: true });
            this.state.eventBus.emit('RenderNeeded');
            this.updateSystems(['audio', 'render', 'ui']);
            return;
        }

        if (gameState.gameOver) {
            //console.log('Game.js: Game over, ignoring input');
            return;
        }

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
        if (!mappedKey) {
            //console.log(`Game.js: Key ${event.key} not mapped, ignoring`);
            return;
        }

        if (event.type === 'keydown' && !event.repeat) {
            //console.log(`Key pressed: ${mappedKey}`);
        }

        // Check if Ctrl is part of a recent click context
        const isClickContext = Date.now() - this.lastMouseEventTime < 500; // 500ms threshold
        if (event.type === 'keydown' && event.key === 'Control' && isClickContext) {
            //console.log('Game.js: Ignoring Ctrl key in click context');
            return; // Allow Ctrl to propagate to click handlers
        }

        if (event.type === 'keyup' && mappedKey === ' ') {
            event.preventDefault();
            this.state.eventBus.emit('ToggleRangedMode', { event });
            //console.log('space keyUp detected');
            this.updateSystems(['player', 'render']);
            return;
        }

        if (event.type === 'keydown') { // removed  && !event.repeat
            //console.log('Game.js: Processing keydown, gameState before switch:', gameState, 'entity ID:', this.state.getGameState()?.id, 'timestamp:', Date.now());
            const player = this.state.getPlayer();
            if (!player) {
                //console.log('Game.js: Player entity not found');
                return;
            }
            const playerPos = player.getComponent('Position');
            const levelEntity = this.entityManager.getEntitiesWith(['Map', 'Tier']).find(e => e.getComponent('Tier').value === gameState.tier);
            if (!levelEntity) {
                //console.log('Game.js: Level entity not found for current tier');
                return;
            }
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
                    //console.log('Emitting ToggleOverlay for character tab');
                    this.state.eventBus.emit('ToggleOverlay', { tab: 'character' });
                    this.updateSystems(['ui']);
                    return;
                case 'l':
                    //console.log('Emitting ToggleOverlay for log tab');
                    this.state.eventBus.emit('ToggleOverlay', { tab: 'log' });
                    this.updateSystems(['ui']);
                    return;
                case 'escape':
                    //console.log('Emitting ToggleOverlay to close');
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
                    event.preventDefault();
                    if (!event.repeat) {
                        
                        this.state.eventBus.emit('ToggleRangedMode', { event });
                        this.updateSystems(['player', 'render']);
                        //console.log('space keyDown detected');
                    }
                    return;
            }

            const monsters = this.entityManager.getEntitiesWith(['Position', 'Health', 'MonsterData']);
            const monster = monsters.find(m => m.getComponent('Position').x === newX && m.getComponent('Position').y === newY && m.getComponent('Health').hp > 0);
            const fountain = this.entityManager.getEntitiesWith(['Position', 'FountainData']).find(f => f.getComponent('Position').x === newX && f.getComponent('Position').y === newY && !f.getComponent('FountainData').used);
            const loot = this.entityManager.getEntitiesWith(['Position', 'LootData']).find(t => t.getComponent('Position').x === newX && t.getComponent('Position').y === newY);
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
            if (loot) {
                this.state.eventBus.emit('PickupTreasure', { x: newX, y: newY });
                this.endTurn('pickupLoot');
                return;
            }
            if (map[newY][newX] === '#') return;

            if (map[newY][newX] === '⇓') {
                this.state.eventBus.emit('RenderLock');
                console.log('Game: Render Locked for  TransitionDown');
                this.state.eventBus.emit('TransitionDown');
                
                this.endTurn('transitionDown');
                return;
            }
            if (map[newY][newX] === '⇑') {
                this.state.eventBus.emit('RenderLock');
                this.state.eventBus.emit('TransitionUp');
                this.endTurn('transitionUp');
                return;
            }
            if (map[newY][newX] === '?') {
                this.state.eventBus.emit('RenderLock');
                this.state.eventBus.emit('TransitionViaPortal', { x: newX, y: newY });
                this.endTurn('transitionPortal');
                return;
            }

            if (!gameState.transitionLock && !gameState.isRangedMode) {

                const now = Date.now();
                if (now - this.lastMovementTime < this.movementThrottleInterval) {
                    return; // Throttle movement
                }
                this.lastMovementTime = now; // Update the last movement time

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
            //console.log('endTurn - discoveryRadius:', renderState.discoveryRadius);
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
        let frameCount = 0;
        const gameLoop = () => {
            frameCount++;
            if (frameCount % 60 === 0) {
                //console.log('Game.js: Game loop heartbeat, frame:', frameCount, 'timestamp:', Date.now());
            }
            this.updateSystems(['combat', 'render', 'player', 'monster', 'ui']);
            //this.state.eventBus.emit('RenderNeeded');

            // Only recurse if game isn't over
            const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
            if (!gameState.gameOver) {
                requestAnimationFrame(gameLoop);
            }
        };
        requestAnimationFrame(gameLoop);
    }
}