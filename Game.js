// Game.js - Updated
import { State } from './State.js';
 
import { ActionSystem } from './systems/ActionSystem.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { SpatialBucketsSystem } from './systems/SpatialBucketsSystem.js'; 
import { MapRenderSystem } from './systems/MapRenderSystem.js';
import { PlayerSystem } from './systems/PlayerSystem.js';
import { MonsterControllerSystem } from './systems/MonsterControllerSystem.js';
import { MonsterSpawnSystem } from './systems/MonsterSpawnSystem.js';
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
import { ExplorationSystem } from './systems/ExplorationSystem.js';
import { LightingSystem } from './systems/LightingSystem.js';
import { GameDataIOSystem } from './systems/GameDataIOSystem.js';
import { PlayerInputSystem } from './systems/PlayerInputSystem.js'; 
import { PlayerControllerSystem } from './systems/PlayerControllerSystem.js'; 
import { PlayerTimerSystem } from './systems/PlayerTimerSystem.js'; 
import { MonsterTimerSystem } from './systems/MonsterTimerSystem.js';
import { AffixSystem } from './systems/AffixSystem.js'; 
import { EffectsSystem } from './systems/EffectsSystem.js'; 
import { HealthSystem } from './systems/HealthSystem.js'; 
import { ManaSystem } from './systems/ManaSystem.js';
import { ProjectileSystem } from './systems/ProjectileSystem.js'; 
import { CollisionSystem } from './systems/CollisionSystem.js';
import { MovementResolutionSystem } from './systems/MovementResolutionSystem.js'; 
import { PlayerCollisionSystem } from './systems/PlayerCollisionSystem.js';
import { ProjectileCollisionSystem } from './systems/ProjectileCollisionSystem.js'; 
import { SplashSystem } from './systems/SplashSystem.js';
import { EntityRemovalSystem } from './systems/EntityRemovalSystem.js'; 
import {
    PositionComponent, VisualsComponent, HealthComponent, ManaComponent, StatsComponent, InventoryComponent, ResourceComponent,
    PlayerStateComponent, LightingState, LightSourceDefinitions, OverlayStateComponent, InputStateComponent,
    AttackSpeedComponent, MovementSpeedComponent, AffixComponent, DataProcessQueues, DeadComponent, NeedsRenderComponent, AudioQueueComponent,
    LevelTransitionComponent, HitboxComponent, LastPositionComponent, UIComponent, RenderStateComponent, GameStateComponent, RenderControlComponent,
} from './core/Components.js';

export class Game {
    constructor() {
        this.PLAYER_DEFAULT_MOVE_SPEED = 100; // Default player movement speed
        this.state = new State();
        this.entityManager = this.state.entityManager;
        this.utilities = this.state.utilities;
        this.systems = {};
        this.lastUpdateTime = 0;
        this.lastMouseEventTime = 0;
        this.gameLoopId = null;
        this.RENDER_RADIUS_MODIFIER = 2;

        let player = this.entityManager.getEntity('player');
        if (player) {
            this.entityManager.removeEntity('player');
        }
        player = this.entityManager.createEntity('player', true);
        this.entityManager.addComponentToEntity('player', new PositionComponent(32, 32));
        this.entityManager.addComponentToEntity('player', new LastPositionComponent(0, 0));
        this.entityManager.addComponentToEntity('player', new VisualsComponent(32, 32));
        const visuals = this.entityManager.getEntity('player').getComponent('Visuals');
        visuals.avatar = 'img/avatars/player.png'; 
        this.entityManager.addComponentToEntity('player', new HealthComponent(0, 0));
        this.entityManager.addComponentToEntity('player', new ManaComponent(0, 0));
        this.entityManager.addComponentToEntity('player', new StatsComponent());
        this.entityManager.addComponentToEntity('player', new InventoryComponent({
            equipped: { mainhand: null, offhand: null, armor: null, amulet: null, leftring: null, rightring: null },
            items: []
        }));
        this.entityManager.addComponentToEntity('player', new ResourceComponent(0, 0, 0, 0, 0));
        this.entityManager.addComponentToEntity('player', new PlayerStateComponent(0, 1, 0, false, false, ''));
        this.entityManager.addComponentToEntity('player', new InputStateComponent());
        this.entityManager.addComponentToEntity('player', new AttackSpeedComponent(500));
        this.entityManager.addComponentToEntity('player', new MovementSpeedComponent(192));
        this.entityManager.addComponentToEntity('player', new AffixComponent()); // New component added
        this.entityManager.addComponentToEntity('player', new NeedsRenderComponent(32,32));
        this.entityManager.addComponentToEntity('player', new HitboxComponent(28,28)); 
        
        let overlayState = this.entityManager.getEntity('overlayState');
        if (!overlayState) {
            overlayState = this.entityManager.createEntity('overlayState', true);
            this.entityManager.addComponentToEntity('overlayState', new OverlayStateComponent({
                isOpen: false,
                activeTab: null,
                logMessages: [],
                activeMenuSection: 'controls-button'
            }));
        }

        let lightingState = this.entityManager.getEntity('lightingState');
        if (lightingState) {
            this.entityManager.removeEntity('lightingState');
        }
        lightingState = this.entityManager.createEntity('lightingState', true);
        this.entityManager.addComponentToEntity('lightingState', new LightingState());
        this.entityManager.addComponentToEntity('lightingState', new LightSourceDefinitions());
        const visibilityRadius = lightingState.getComponent('LightingState').visibilityRadius;


        // Render state entity (global)
        const renderState = this.entityManager.createEntity('renderState', true);
        this.entityManager.addComponentToEntity('renderState',
            new RenderStateComponent()
        );
        renderState.getComponent('RenderState').renderRadius = visibilityRadius +  this.RENDER_RADIUS_MODIFIER ;
        
        this.entityManager.addComponentToEntity('renderState',
            new RenderControlComponent()
        );
       
        this.entityManager.addComponentToEntity('gameState', new DataProcessQueues());
        this.entityManager.addComponentToEntity('gameState', new AudioQueueComponent());
        this.entityManager.addComponentToEntity('gameState', new LevelTransitionComponent());

        this.initializeSystems().then(() => {
            this.state.eventBus.emit('InitializePlayer');
            console.log('Systems initialized and player initialized');
            
        });
        this.setupEventListeners();

        this.trackControlQueue = this.entityManager.getEntity('gameState')?.getComponent('AudioQueue')?.TrackControl || [];
        this.sfxQueue = this.entityManager.getEntity('gameState')?.getComponent('AudioQueue')?.SFX || [];
        this.splashScreen = document.getElementById('splash');
        this.splashScreen.style.display = 'flex';
 

    }

    async initializeSystems() {
        this.systems.data = new DataSystem(this.entityManager, this.state.eventBus);
        this.systems.splash = new SplashSystem(this.entityManager, this.state.eventBus);
        this.systems.action = new ActionSystem(this.entityManager, this.state.eventBus);
        this.systems.damageCalculation = new DamageCalculationSystem(this.entityManager, this.state.eventBus);
        this.systems.combat = new CombatSystem(this.entityManager, this.state.eventBus);
        this.systems.projectile = new ProjectileSystem(this.entityManager, this.state.eventBus);
        this.systems.mapRender = new MapRenderSystem(this.entityManager, this.state.eventBus, this.state);
        this.systems.lootSpawn = new LootSpawnSystem(this.entityManager, this.state.eventBus);
        this.systems.lootCollection = new LootCollectionSystem(this.entityManager, this.state.eventBus);
        this.systems.itemROG = new ItemROGSystem(this.entityManager, this.state.eventBus, this.utilities);
        this.systems.lootManager = new LootManagerSystem(this.entityManager, this.state.eventBus, this.utilities);
        this.systems.player = new PlayerSystem(this.entityManager, this.state.eventBus, this.utilities);
        //this.systems.monsterController = new MonsterControllerSystem(this.entityManager, this.state.eventBus);
        this.systems.monsterSpawn = new MonsterSpawnSystem(this.entityManager, this.state.eventBus, this.systems.data);
        this.systems.level = new LevelSystem(this.entityManager, this.state.eventBus, this.state);
        this.systems.inventory = new InventorySystem(this.entityManager, this.state.eventBus, this.utilities);
        this.systems.ui = new UISystem(this.entityManager, this.state.eventBus, this.utilities);
        this.systems.levelTransition = new LevelTransitionSystem(this.entityManager, this.state.eventBus);
        this.systems.audio = new AudioSystem(this.entityManager, this.state.eventBus);
        this.systems.exploration = new ExplorationSystem(this.entityManager, this.state.eventBus);
        this.systems.lighting = new LightingSystem(this.entityManager, this.state.eventBus);
        this.systems.gameDataIO = new GameDataIOSystem(this.entityManager, this.state.eventBus, this.utilities);
        this.systems.playerInput = new PlayerInputSystem(this.entityManager, this.state.eventBus); 
        this.systems.playerController = new PlayerControllerSystem(this.entityManager, this.state.eventBus); 
        //this.systems.playerTimer = new PlayerTimerSystem(this.entityManager, this.state.eventBus); 
        this.systems.affix = new AffixSystem(this.entityManager, this.state.eventBus);
        this.systems.effects = new EffectsSystem(this.entityManager, this.state.eventBus); // New system added
        this.systems.health = new HealthSystem(this.entityManager, this.state.eventBus);
        this.systems.mana = new ManaSystem(this.entityManager, this.state.eventBus);
        //this.systems.collisions = new CollisionSystem(this.entityManager, this.state.eventBus);
        //this.systems.movementResolution = new MovementResolutionSystem(this.entityManager,this.state.eventBus );
        //this.systems.projectileCollisions = new ProjectileCollisionSystem(this.entityManager, this.state.eventBus);
        //this.systems.playerCollision = new PlayerCollisionSystem(this.entityManager, this.state.eventBus);
        //this.systems.entityRemoval = new EntityRemovalSystem(this.entityManager);
        this.systems.spatialBuckets = new SpatialBucketsSystem(this.entityManager, this.state.eventBus, this.state);

        await Promise.all(Object.values(this.systems).map(system => system.init()));
        
    }

    iniitalizeActiveGameSystems() {
        let activeGameSystems = {}
        activeGameSystems.playerTimer= new PlayerTimerSystem(this.entityManager, this.state.eventBus); 
        activeGameSystems.monsterController = new MonsterControllerSystem(this.entityManager, this.state.eventBus);
        activeGameSystems.monsterTimer = new MonsterTimerSystem(this.entityManager, this.state.eventBus);
        activeGameSystems.collisions = new CollisionSystem(this.entityManager, this.state.eventBus);
        activeGameSystems.movementResolution = new MovementResolutionSystem(this.entityManager, this.state.eventBus);
        activeGameSystems.projectileCollisions = new ProjectileCollisionSystem(this.entityManager, this.state.eventBus);
        activeGameSystems.playerCollision = new PlayerCollisionSystem(this.entityManager, this.state.eventBus);
        activeGameSystems.entityRemoval = new EntityRemovalSystem(this.entityManager);
        
        Object.values(activeGameSystems).forEach(system => system.init());
        this.systems = { ...this.systems, ...activeGameSystems };

        console.log('Game: Active game systems initialized.');
    }

    setupEventListeners() {
        this.mousedownHandler = () => this.updateLastMouseEvent();
        this.mousemoveHandler = () => this.updateLastMouseEvent();
        document.addEventListener('mousedown', this.mousedownHandler);
        document.addEventListener('mousemove', this.mousemoveHandler);
        this.state.eventBus.on('StartGame', () => this.start());
    }

    destroy() {
        document.removeEventListener('mousedown', this.mousedownHandler);
        document.removeEventListener('mousemove', this.mousemoveHandler);
        Object.values(this.systems).forEach(system => system.destroy?.());
        if (this.gameLoopId) {
            cancelAnimationFrame(this.gameLoopId);
            console.log('Game.js: Game loop stopped');
        }
        console.log('Game.js: Instance destroyed');
    }

    updateLastMouseEvent() {
        this.lastMouseEventTime = Date.now();
    }

    updateSystems(systemsToUpdate, deltaTime) { // *** CHANGED: Added deltaTime parameter ***
        systemsToUpdate.forEach(systemName => {
            // *** CHANGED: Pass deltaTime to system update ***
            this.systems[systemName].update(deltaTime);
        });
        this.lastUpdateTime = Date.now();
    }

    startGameLoop() {
        let lastTime = performance.now();
        const gameLoop = (currentTime) => {
            this.gameLoopId = requestAnimationFrame(gameLoop);
            const deltaTime = (currentTime - lastTime) / 1000; // Time in seconds
            lastTime = currentTime;

            // *** NEW: Log deltaTime ***
            // console.log('Game.js: Game loop - deltaTime:', deltaTime);

            // *** CHANGED: Pass deltaTime to updateSystems ***
            this.updateSystems([
                
                'playerInput',
                'playerController',
                'playerTimer',
                'player',
                'exploration',
                'projectile',
                'monsterController',
                'monsterTimer',
                'collisions',
                'playerCollision', 
                'projectileCollisions',
                'movementResolution',
                'combat',
                'damageCalculation',
                'health',
                'mana',
                'ui',
                'audio',
                'levelTransition',
                'spatialBuckets',
                'mapRender',
                'entityRemoval',
                
            ], deltaTime);

            const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
            if (!gameState?.gameOver) {
                // Continue the loop
            }
            gameState.transitionLock = false;
        };
        this.gameLoopId = requestAnimationFrame(gameLoop);
    }

    start() {
        let gameState = this.entityManager.getEntity('gameState');

        if (!gameState) {
          
            this.entityManager.addComponentToEntity('gameState', new GameStateComponent({
                gameStarted: true, // Set to true when starting
                gameOver: false,
                tier: 1, // Assuming initial tier
                // Add other GameState properties as needed
            }));
            gameState = this.entityManager.getEntity('gameState');
        } else {
            const gameStateComp = gameState.getComponent('GameState');
            if (!gameStateComp.gameStarted)  gameStateComp.gameStarted = true;
        }

        this.iniitalizeActiveGameSystems();

        this.splashScreen.style.display = 'none';
        document.getElementById('hud-layer').style.visibility = 'visible';
        gameState.needsRender = true;
        this.trackControlQueue.push({ track: 'backgroundMusic', play: true, volume: .05 });

        const player = this.entityManager.getEntity('player');
        // START TEMPORARY CODE TO RESET MOVE SPEED FOR SAVED GAMES WITH MS COMPONENT
        const movementSpeed = player.getComponent('MovementSpeed');
        if (movementSpeed) {
            movementSpeed.movementSpeed = 192; // Set default value
        }
        // START TEMPORARY CODE TO RESET MOVE SPEED FOR SAVED GAMES WITH MS COMPONENT
        const newPlayerComp = player.getComponent('NewCharacter');
        if (newPlayerComp) {
            const saveId = null;
            this.state.eventBus.emit('RequestSaveGame', { saveId });
            player.removeComponent('NewCharacter');
        }
        this.state.eventBus.emit('PlaySfxImmediate', { sfx: 'portal1', volume: 0.05 });
        this.startGameLoop();
        console.log('Game.js: Game started');
    }
}






