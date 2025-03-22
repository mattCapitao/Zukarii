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
import { ItemROGSystem } from './systems/ItemROGSystem.js';
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

        // Create state entity (global)
        let stateEntity = this.entityManager.getEntity('state');
        if (!stateEntity) {
            stateEntity = this.entityManager.createEntity('state', true);
            this.entityManager.addComponentToEntity('state', { type: 'DiscoveryRadius', discoveryRadiusDefault: 2 });
        }

        // Create player entity (global)
        let player = this.entityManager.getEntity('player');
        if (player) {
            this.entityManager.removeEntity('player');
        }
        player = this.entityManager.createEntity('player', true);
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

        // Create overlayState entity (global)
        let overlayState = this.entityManager.getEntity('overlayState');
        if (!overlayState) {
            overlayState = this.entityManager.createEntity('overlayState', true);
            this.entityManager.addComponentToEntity('overlayState', {
                type: 'OverlayState',
                isOpen: false,
                activeTab: null,
                logMessages: []
            });
        }

        // renderState is already created in State.js as a global entity, no need to create it here

        this.initializeSystems().then(() => {
            this.state.eventBus.emit('InitializePlayer');
            this.state.eventBus.emit('RenderNeeded');
            console.log('Systems initialized and player initialized');
        });
        this.setupEventListeners();
        this.startGameLoop();
    }

    async initializeSystems() {
        console.log('Game.js: initializeSystems start, gameState:', this.state.getGameState()?.getComponent('GameState'), 'entity ID:', this.state.getGameState()?.id, 'timestamp:', Date.now());
        console.log('Game.js: EventBus instance:', this.state.eventBus);

        this.systems.data = new DataSystem(this.entityManager, this.state.eventBus);
        this.systems.action = new ActionSystem(this.entityManager, this.state.eventBus);
        this.systems.damageCalculation = new DamageCalculationSystem(this.entityManager, this.state.eventBus);
        this.systems.combat = new CombatSystem(this.entityManager, this.state.eventBus);
        this.systems.render = new RenderSystem(this.entityManager, this.state.eventBus);
        this.systems.lootSpawn = new LootSpawnSystem(this.entityManager, this.state.eventBus);
        this.systems.lootCollection = new LootCollectionSystem(this.entityManager, this.state.eventBus);
        this.systems.itemROG = new ItemROGSystem(this.entityManager, this.state.eventBus, this.utilities);
        this.systems.lootManager = new LootManagerSystem(this.entityManager, this.state.eventBus, this.utilities);
        this.systems.player = new PlayerSystem(this.entityManager, this.state.eventBus, this.utilities);
        this.systems.monster = new MonsterSystem(this.entityManager, this.state.eventBus, this.systems.data);
        this.systems.level = new LevelSystem(this.entityManager, this.state.eventBus, this.state);
        this.systems.inventory = new InventorySystem(this.entityManager, this.state.eventBus, this.utilities);
        this.systems.ui = new UISystem(this.entityManager, this.state.eventBus, this.utilities);
        this.systems.levelTransition = new LevelTransitionSystem(this.entityManager, this.state.eventBus);
        this.systems.audio = new AudioSystem(this.entityManager, this.state.eventBus);

        // Await all system initializations
        await Promise.all(Object.values(this.systems).map(system => {
            console.log(`Game.js: Initializing system ${system.constructor.name} with EventBus:`, this.state.eventBus);
            return system.init();
        }));

        console.log('Game.js: initializeSystems end, gameState:', this.state.getGameState()?.getComponent('GameState'), 'entity ID:', this.state.getGameState()?.id, 'timestamp:', Date.now());
    }

    setupEventListeners() {
        document.addEventListener('keydown', (event) => this.handleInput(event));
        document.addEventListener('keyup', (event) => this.handleInput(event));
        document.addEventListener('mousedown', () => this.updateLastMouseEvent());
        document.addEventListener('mousemove', () => this.updateLastMouseEvent());
    }

    updateLastMouseEvent() {
        this.lastMouseEventTime = Date.now();
    }

    handleInput(event) {
        const gameState = this.state.getGameState()?.getComponent('GameState');
        if (!gameState) {
            console.error('Game.js: gameState not found or missing GameState component');
        } else {
            //console.log('Game.js: handleInput start, gameState:', gameState, 'entity ID:', this.state.getGameState()?.id, 'timestamp:', Date.now());
        }

        if (gameState && !gameState.gameStarted) {
            gameState.gameStarted = true;
            gameState.needsRender = true;
            this.state.eventBus.emit('ToggleBackgroundMusic', { play: true });
            this.state.eventBus.emit('RenderNeeded');
            this.updateSystems(['audio', 'render', 'ui']);
            return;
        }

        if (gameState.gameOver) {
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
            return;
        }

        if (event.type === 'keydown' && !event.repeat) {
            //console.log(`Key pressed: ${mappedKey}`);
        }

        const isClickContext = Date.now() - this.lastMouseEventTime < 500;
        if (event.type === 'keydown' && event.key === 'Control' && isClickContext) {
            return;
        }

        if (event.type === 'keyup' && mappedKey === ' ') {
            event.preventDefault();
            this.state.eventBus.emit('ToggleRangedMode', { event });
            this.updateSystems(['player', 'render']);
            return;
        }

        if (event.type === 'keydown') {
            const player = this.state.getPlayer();
            if (!player) {
                return;
            }
            const playerPos = player.getComponent('Position');
            const levelEntity = this.entityManager.getEntitiesWith(['Map', 'Tier']).find(e => e.getComponent('Tier').value === gameState.tier);
            if (!levelEntity) {
                return;
            }

            console.log(`Game.js: Current tier: ${gameState.tier}, Player position: (${playerPos.x}, ${playerPos.y})`);

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
                    this.state.eventBus.emit('ToggleOverlay', { tab: 'character' });
                    this.updateSystems(['ui']);
                    return;
                case 'l':
                    this.state.eventBus.emit('ToggleOverlay', { tab: 'log' });
                    this.updateSystems(['ui']);
                    return;
                case 'escape':
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
                    }
                    return;
            }

            const entitiesAtTarget = this.entityManager.getEntitiesWith(['Position']).filter(e => {
                const pos = e.getComponent('Position');
                return pos.x === newX && pos.y === newY;
            });
            console.log(`Game.js: Entities at (${newX}, ${newY}):`, entitiesAtTarget.map(e => ({
                id: e.id,
                components: e.getComponentTypes()
            })));

            const mapComp = levelEntity.getComponent('Map');
            console.log(`Game.js: Map tile at (${newX}, ${newY}): ${mapComp.map[newY][newX]}`);

            const monster = entitiesAtTarget.find(e =>
                e.hasComponent('Health') && e.hasComponent('MonsterData') &&
                e.getComponent('Health').hp > 0
            );
            if (monster) {
                this.state.eventBus.emit('MeleeAttack', { targetEntityId: monster.id });
                this.endTurn('meleeAttack');
                return;
            }

            const fountain = entitiesAtTarget.find(e =>
                e.hasComponent('Fountain') && !e.getComponent('Fountain').used
            );
            if (fountain) {
                this.state.eventBus.emit('UseFountain', { fountainEntityId: fountain.id, tierEntityId: levelEntity.id });
                this.endTurn('useFountain');
                return;
            }

            const loot = entitiesAtTarget.find(e => e.hasComponent('LootData'));
            if (loot) {
                this.state.eventBus.emit('PickupTreasure', { x: newX, y: newY });
                this.endTurn('pickupLoot');
                return;
            }

            const stair = entitiesAtTarget.find(e => e.hasComponent('Stair'));
            if (stair) {
                const stairComp = stair.getComponent('Stair');
                if (stairComp.direction === 'down') {
                    this.state.eventBus.emit('RenderLock');
                    console.log('Game: Render Locked for TransitionDown');
                    this.state.eventBus.emit('TransitionDown');
                    this.endTurn('transitionDown');
                    return;
                } else if (stairComp.direction === 'up') {
                    this.state.eventBus.emit('RenderLock');
                    this.state.eventBus.emit('TransitionUp');
                    this.endTurn('transitionUp');
                    return;
                }
            }

            const portal = entitiesAtTarget.find(e => e.hasComponent('Portal'));
            if (portal) {
                this.state.eventBus.emit('RenderLock');
                this.state.eventBus.emit('TransitionViaPortal', { x: newX, y: newY });
                this.endTurn('transitionPortal');
                return;
            }

            const wall = entitiesAtTarget.find(e => e.hasComponent('Wall'));
            if (wall) {
                console.log(`Game.js: Wall found at (${newX}, ${newY}), blocking movement`);
                return;
            }

            const floor = entitiesAtTarget.find(e => e.hasComponent('Floor'));
            console.log(`Game.js: Floor at (${newX}, ${newY}):`, floor ? floor.id : 'none');
            console.log(`Game.js: Conditions - transitionLock: ${gameState.transitionLock}, isRangedMode: ${gameState.isRangedMode}, throttle: ${Date.now() - this.lastMovementTime < this.movementThrottleInterval}`);
            if (!gameState.transitionLock && !gameState.isRangedMode && floor) {
                const now = Date.now();
                if (now - this.lastMovementTime < this.movementThrottleInterval) {
                    console.log(`Game.js: Movement throttled at (${newX}, ${newY})`);
                    return;
                }
                this.lastMovementTime = now;

                playerPos.x = newX;
                playerPos.y = newY;
                this.state.eventBus.emit('PositionChanged', { entityId: 'player', x: newX, y: newY });
                console.log(`Game.js: Player moved to (${newX}, ${newY})`);
                this.endTurn('movement');
            } else {
                console.log(`Game.js: Movement blocked at (${newX}, ${newY}) - transitionLock: ${gameState.transitionLock}, isRangedMode: ${gameState.isRangedMode}, floor: ${!!floor}`);
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

            const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
            if (!gameState.gameOver) {
                requestAnimationFrame(gameLoop);
            }
        };
        requestAnimationFrame(gameLoop);
    }
}