// State.js (Updated)
// Manages high-level game state using EntityManager and EventBus, stripped of God Object tendencies

import { Utilities } from './Utilities.js';
import { EntityManager } from './core/EntityManager.js';
import { EventBus } from './core/EventBus.js';
import {
    PositionComponent,
    HealthComponent,
    ManaComponent,
    StatsComponent,
    InventoryComponent,
    ResourceComponent,
    PlayerStateComponent,
    MapComponent,
    EntityListComponent,
    UIComponent,
    RenderStateComponent,
    GameStateComponent,
    createDefaultPlayerComponents,
    createDefaultLevelComponents
} from './core/Components.js';

export class State {
    constructor(utilities = new Utilities()) {
        this.utilities = utilities;

        // Core managers replacing old state structure
        this.entityManager = new EntityManager();
        this.eventBus = new EventBus();

        // Constants (to be moved later)
        this.WIDTH = 122;
        this.HEIGHT = 67;
        this.MIN_STAIR_DISTANCE = Math.floor(Math.random() * 41) + 20;
        this.AGGRO_RANGE = 4;
        this.discoveryRadiusDefault = 2;

        // DOM references (preserved for now, to be handled by RenderSystem)
        this.mapDiv = null;
        this.statsDiv = null;
        this.logDiv = null;
        this.tabsDiv = null;

        // Possible item stats (preserved for PlayerSystem)
        this.possibleItemStats = [
            'maxHp', 'maxMana', 'maxLuck',
            'intellect', 'prowess', 'agility',
            'range', 'block', 'armor', 'defense',
            'baseBlock', 'baseRange',
            'rangedDamageBonus', 'meleeDamageBonus', 'damageBonus'
        ];

        // Initialize core entities
        this.initializeCoreEntities();
    }

    initializeCoreEntities() {
        // Game state entity
        const gameState = this.entityManager.createEntity('gameState');
        this.entityManager.addComponentToEntity('gameState',
            new GameStateComponent({
                gameStarted: false,
                needsRender: true,          // Set to true to ensure initial render
                needsInitialRender: true    // Set to true for initial render
            })
        );
        console.log('State.js: Created gameState entity with GameState component:', this.entityManager.getEntity('gameState'));

        // UI entity
        const ui = this.entityManager.createEntity('ui');
        this.entityManager.addComponentToEntity('ui',
            new UIComponent()
        );

        // Render state entity
        const renderState = this.entityManager.createEntity('renderState');
        this.entityManager.addComponentToEntity('renderState',
            new RenderStateComponent()
        );

        // Levels will be added dynamically by LevelSystem
        // Placeholder for tier 0 (surface level) will be handled in LevelSystem
    }

    // Temporary method to generate surface level (to be moved to LevelSystem)
    generateSurfaceLevel() {
        let map = [];
        for (let y = 0; y < 10; y++) {
            map[y] = [];
            for (let x = 0; x < 10; x++) {
                if (y === 0 || y === 9 || x === 0 || x === 9) {
                    map[y][x] = '#';
                } else {
                    map[y][x] = ' ';
                }
            }
        }
        map[5][5] = '⇓';
        const rooms = [{
            left: 1,
            top: 1,
            w: 8,
            h: 8,
            x: 5,
            y: 5,
            type: 'SurfaceRoom',
            connections: []
        }];
        return { map, rooms };
    }

    // Helper to get the player entity (convenience for now)
    getPlayer() {
        return this.entityManager.getEntity('player');
    }

    // Helper to get game state (convenience for now)
    getGameState() {
        const entity = this.entityManager.getEntity('gameState');
        const component = entity?.getComponent('GameState');
       // console.log('State.js: getGameState called, entity ID:', entity?.id, 'component reference:', component, 'timestamp:', Date.now());
        return entity;
    }
}