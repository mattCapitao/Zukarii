// Game.js - Updated
import { State } from './State.js';
 
import { ActionSystem } from './systems/ActionSystem.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { SpatialBucketsSystem } from './systems/SpatialBucketsSystem.js'; 
import { MapRenderSystem } from './systems/MapRenderSystem.js';
import { PlayerSystem } from './systems/PlayerSystem.js';
import { MonsterControllerSystem } from './systems/MonsterControllerSystem.js';
import { MonsterSpawnSystem } from './systems/MonsterSpawnSystem.js';
import { MonsterCollisionSystem } from './systems/MonsterCollisionSystem.js';
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
import { JourneySystem } from './systems/JourneySystem.js';
import { PathSystem } from './systems/PathSystem.js';
import { InteractionSystem } from './systems/InteractionSystem.js';
import { MouseInputSystem } from './systems/MouseInputSystem.js'; 
import { AnimationSystem } from './systems/AnimationSystem.js'; 
import { NPCSpawnSystem } from './systems/NPCSpawnSystem.js';
import { DialogueUISystem } from './systems/DialogueUISystem.js';
import {
    PositionComponent, VisualsComponent, HealthComponent, ManaComponent, StatsComponent, InventoryComponent, ResourceComponent,
    PlayerStateComponent, LightingState, LightSourceDefinitions, OverlayStateComponent, InputStateComponent,
    AttackSpeedComponent, MovementSpeedComponent, AffixComponent, DataProcessQueues, DeadComponent, NeedsRenderComponent, AudioQueueComponent,
    LevelTransitionComponent, HitboxComponent, LastPositionComponent, UIComponent, RenderStateComponent, GameStateComponent, RenderControlComponent,
    AnimationComponent, AnimationStateComponent, JourneyStateComponent, JourneyPathComponent, DialogueComponent,
} from './core/Components.js';

export class Game {
    constructor() {
        this.PLAYER_DEFAULT_MOVE_SPEED = 155; // Default player movement speed
        this.state = new State();
        this.entityManager = this.state.entityManager;
        this.utilities = this.state.utilities;
        this.systems = {};
        this.lastUpdateTime = 0;
        this.lastMouseEventTime = 0;
        this.gameLoopId = null;
        this.RENDER_RADIUS_MODIFIER = 2;
        this.GameLoopRunning = false;

        let player = this.entityManager.getEntity('player');
        if (player) {
            this.entityManager.removeEntity('player');
        }
        player = this.entityManager.createEntity('player', true);
        this.entityManager.addComponentToEntity('player', new PositionComponent(64, 112));
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
        this.entityManager.addComponentToEntity('player', new JourneyStateComponent());
        this.entityManager.addComponentToEntity('player', new InputStateComponent());
        this.entityManager.addComponentToEntity('player', new AttackSpeedComponent(500));
        this.entityManager.addComponentToEntity('player', new MovementSpeedComponent(155));
        this.entityManager.addComponentToEntity('player', new AffixComponent());
        this.entityManager.addComponentToEntity('player', new NeedsRenderComponent(32, 32));
        this.entityManager.addComponentToEntity('player', new HitboxComponent(28, 28)); 

        this.entityManager.addComponentToEntity('player', new AnimationStateComponent());
        this.entityManager.addComponentToEntity('player', new AnimationComponent());
        const animation = player.getComponent('Animation');
        animation.spriteSheets = {
            'idle': new Image(),
            'walk': new Image(),
            'attack': new Image() // Add attack sprite sheet
        };
        animation.spriteSheets['idle'].src = 'img/anim/Player/Idle.png';
        animation.spriteSheets['walk'].src = 'img/anim/Player/Walk.png';
        animation.spriteSheets['attack'].src = 'img/anim/Player/Attack_Fire_2.png';
        animation.animations = {
            'idle': {
                frames: [
                    { x: 0 }, { x: 128 }, { x: 256 }, { x: 384 },
                    { x: 512 }, { x: 640 }, { x: 768 }, { x: 896 }
                ],
                frameWidth: 128,
                frameHeight: 128,
                frameTime: 100
            },
            'walk': {
                frames: [
                    { x: 0 }, { x: 128 }, { x: 256 }, { x: 384 },
                    { x: 512 }, { x: 640 }, { x: 768 }
                ],
                frameWidth: 128,
                frameHeight: 128,
                frameTime: 100
            },
            'attack': { // Add attack animation
                frames: [
                    { x: 0 }, { x: 128 }, { x: 256 }, { x: 384 },
                    { x: 512 }, { x: 640 }, { x: 768 }, { x: 896 },
                    { x: 1024 }
                ],
                frameWidth: 128,
                frameHeight: 128,
                frameTime: 56 // 9 frames at 75ms = 0.675s per loop
            }
        };



        // Initialize a single JourneyPathComponent and populate its paths array
        const journeyPaths = new JourneyPathComponent();
        journeyPaths.paths = [
            {
                id: 'master_whispers',
                parentId: 'master_whispers',
                nextPathId: '',
                completed: false,
                title: 'Whispers of Zukarath',
                description: 'Follow the guidance of the Zukran Masters to prove your worth.',
                completionCondition: null,
                rewards: [],
                completionText: '',
                logCompletion: false
            },
            {
                id: 'master_echoes',
                parentId: 'master_echoes',
                nextPathId: '',
                completed: false,
                title: 'Forgotten Echoes',
                description: 'Discover the echoes of the past hidden within the fortress.',
                completionCondition: null,
                rewards: [],
                completionText: '',
                logCompletion: false
            },
            {
                id: 'master_lore',
                parentId: 'master_lore',
                nextPathId: '',
                completed: false,
                title: 'Arcane Legends',
                description: 'Uncover the ancient knowledge of the Zukran.',
                completionCondition: null,
                rewards: [],
                completionText: '',
                logCompletion: false
            },
            {
                id: 'whisper_parent_1',
                parentId: 'master_whispers',
                nextPathId: 'whisper_parent_2',
                completed: false,
                title: 'The First Descent',
                description: 'The Zukran Masters have spoken: Prove your resolve.',
                completionCondition: null,
                rewards: [{ type: 'item', itemId: 'torch', quantity: 2, rewarded: false }],
                completionText: 'You have proven your resolve.',
                logCompletion: true
            },
            {
                id: 'whisper_child_1_1',
                parentId: 'whisper_parent_1',
                nextPathId: '',
                completed: false,
                title: 'Reach Tier 1',
                description: 'Descend to Tier 1 of the Bottomless Fortress.',
                completionCondition: { type: 'reachTier', tier: 1 },
                rewards: [],
                completionText: 'You have reached Tier 1.',
                logCompletion: true
            },
            {
                id: 'whisper_child_1_2',
                parentId: 'whisper_parent_1',
                nextPathId: '',
                completed: false,
                title: 'Find the Key',
                description: 'Locate the Key of Zukarath on Tier 1.',
                completionCondition: { type: 'findArtifact', artifactId: 'keyOfZukarath', tier: 1 },
                rewards: [],
                completionText: 'You have found the Key of Zukarath.',
                logCompletion: true
            }
        ];
        this.entityManager.addComponentToEntity('player', journeyPaths);
        
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

        // Dialogue state entity (global)
        let dialogueState = this.entityManager.getEntity('dialogueState');
        if (!dialogueState) {
            dialogueState = this.entityManager.createEntity('dialogueState', true);
            this.entityManager.addComponentToEntity('dialogueState', new DialogueComponent());
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
        renderState.getComponent('RenderState').renderRadius = visibilityRadius + this.RENDER_RADIUS_MODIFIER;
        
        this.entityManager.addComponentToEntity('renderState',
            new RenderControlComponent()
        );
       
        this.entityManager.addComponentToEntity('gameState', new DataProcessQueues());
        // Initialize pathTransfers queue in DataProcessQueues
        const dataProcessQueues = this.entityManager.getEntity('gameState').getComponent('DataProcessQueues');
        dataProcessQueues.pathTransfers = [];
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
        this.systems.npcSpawn = new NPCSpawnSystem(this.entityManager, this.state.eventBus, this.systems.data);
        this.systems.level = new LevelSystem(this.entityManager, this.state.eventBus, this.state);
        this.systems.inventory = new InventorySystem(this.entityManager, this.state.eventBus, this.utilities);
        this.systems.path = new PathSystem(this.entityManager, this.state.eventBus, this.utilities); // Add PathSystem before JourneySystem
        this.systems.journey = new JourneySystem(this.entityManager, this.state.eventBus, this.utilities);
        this.systems.interaction = new InteractionSystem(this.entityManager, this.state.eventBus, this.utilities); // Add InteractionSystem
        this.systems.ui = new UISystem(this.entityManager, this.state.eventBus, this.utilities);
        this.systems.levelTransition = new LevelTransitionSystem(this.entityManager, this.state.eventBus);
        this.systems.audio = new AudioSystem(this.entityManager, this.state.eventBus);
        this.systems.exploration = new ExplorationSystem(this.entityManager, this.state.eventBus);
        this.systems.lighting = new LightingSystem(this.entityManager, this.state.eventBus);
        this.systems.gameDataIO = new GameDataIOSystem(this.entityManager, this.state.eventBus, this.utilities);
        this.systems.playerInput = new PlayerInputSystem(this.entityManager, this.state.eventBus); 
        this.systems.playerController = new PlayerControllerSystem(this.entityManager, this.state.eventBus); 
        this.systems.affix = new AffixSystem(this.entityManager, this.state.eventBus);
        this.systems.effects = new EffectsSystem(this.entityManager, this.state.eventBus); // New system added
        this.systems.health = new HealthSystem(this.entityManager, this.state.eventBus);
        this.systems.mana = new ManaSystem(this.entityManager, this.state.eventBus);
        this.systems.spatialBuckets = new SpatialBucketsSystem(this.entityManager, this.state.eventBus, this.state);
        this.systems.mouseInput = new MouseInputSystem(this.entityManager, this.state.eventBus, this.state);
        this.systems.animation = new AnimationSystem(this.entityManager, this.state.eventBus);
        
        this.systems.dialogueUI = new DialogueUISystem(this.entityManager, this.state.eventBus);
        await Promise.all(Object.values(this.systems).map(system => system.init()));
    }

    iniitalizeActiveGameSystems() {
        let activeGameSystems = {}
        activeGameSystems.playerTimer = new PlayerTimerSystem(this.entityManager, this.state.eventBus); 
        activeGameSystems.monsterController = new MonsterControllerSystem(this.entityManager, this.state.eventBus);
        activeGameSystems.monsterTimer = new MonsterTimerSystem(this.entityManager, this.state.eventBus);
        activeGameSystems.monsterCollision = new MonsterCollisionSystem(this.entityManager, this.state.eventBus);
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
        this.GameLoopRunning = true;
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
                'mouseInput',
                'playerController',
                'playerTimer',
                'player',
                'exploration',
                'projectile',
                'monsterController',
                'monsterTimer',
                'collisions',
                'playerCollision', 
                'monsterCollision',
                'projectileCollisions',
                'movementResolution',
                'combat',
                'damageCalculation',
                'health',
                'mana',
                'path', // Add PathSystem to the update loop
                'journey',
                'interaction',
                'ui',
                'dialogueUI',
                'audio',
                'levelTransition',
                'spatialBuckets',
                'animation',
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
            if (!gameStateComp.gameStarted) gameStateComp.gameStarted = true;
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
            movementSpeed.movementSpeed = 155; // Set default value
        }
        // START TEMPORARY CODE TO RESET MOVE SPEED FOR SAVED GAMES WITH MS COMPONENT
        const newPlayerComp = player.getComponent('NewCharacter');
        if (newPlayerComp) {
            const saveId = null;
            this.state.eventBus.emit('RequestSaveGame', { saveId });
            player.removeComponent('NewCharacter');
            setTimeout(() => { this.state.eventBus.emit('PlaySfxImmediate', { sfx: 'intro', volume: 0.25 }); }, 2000);
            
        }
        this.state.eventBus.emit('PlaySfxImmediate', { sfx: 'portal1', volume: 0.05 });

        if (!this.GameLoopRunning) {
            this.startGameLoop();
        }
        console.log('Game.js: Game started');
    }
}