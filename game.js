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
import { createDefaultPlayerComponents } from './core/Components.js';

export class Game {
    constructor() {
        this.state = new State();
        this.entityManager = this.state.entityManager;
        this.systems = {};
        this.lastUpdateTime = 0;
        this.mageNames = [
            "Elarion", "Sylvara", "Tharion", "Lysandra", "Zephyrion", "Morwenna", "Aethric",
            "Vionelle", "Dravenor", "Celestine", "Kaelith", "Seraphine", "Tormund", "Elowen",
            "Zarathis", "Lunara", "Veyron", "Ashka", "Rivenna", "Solthar", "Ysmera", "Drenvar",
            "Thalindra", "Orythia", "Xandrel", "Miravelle", "Korathis", "Eryndor", "Valthira",
            "Nythera"
        ];

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
            player = null;
        }
        if (!player) {
            console.log('Creating new player entity...');
            player = this.entityManager.createEntity('player');
            const defaultComponents = createDefaultPlayerComponents();
            console.log('Default player components:', defaultComponents);
            Object.values(defaultComponents).forEach(comp => this.entityManager.addComponentToEntity('player', comp));
            console.log('Player entity created with default components:', this.entityManager.getEntity('player'));
        }

        const utilities = this.entityManager.getEntity('state').getComponent('Utilities').utilities;
        const stats = player.getComponent('Stats');
        const health = player.getComponent('Health');
        const mana = player.getComponent('Mana');
        const playerState = player.getComponent('PlayerState');
        const inventory = player.getComponent('Inventory');
        const resource = player.getComponent('Resource');
        const position = player.getComponent('Position');
        
        stats.intellect = utilities.dRoll(4, 3, 3);
        stats.prowess = utilities.dRoll(4, 3, 3);
        stats.agility = utilities.dRoll(4, 3, 3);
        health.maxHp = Math.round(5 * stats.prowess * 0.1);
        mana.maxMana = Math.round(10 * stats.intellect * 0.05);
        health.hp = health.maxHp;
        mana.mana = mana.maxMana;
        playerState.nextLevelXp = 125;
        playerState.name = this.mageNames[Math.floor(Math.random() * this.mageNames.length)] || "Mage";
        inventory.items = [];
        inventory.equipped = inventory.equipped || { mainhand: null, offhand: null, amulet: null, armor: null, leftring: null, rightring: null };
        resource.torches = 3;
        resource.healPotions = 1;
        inventory.gold = 100;
        position.x = 1;
        position.y = 1;
        
        const startItems = [
            { name: 'Rusty Dagger', type: 'weapon', attackType: 'melee', baseDamageMin: 1, baseDamageMax: 3, baseBlock: 1, icon: 'dagger.svg', itemTier: 'common' },
            { name: 'Ragged Robes', type: 'armor', armor: 1, icon: 'robe.svg', itemTier: 'common' },
            { name: 'Crooked Wand', type: 'weapon', attackType: 'ranged', baseDamageMin: 1, baseDamageMax: 2, baseRange: 2, icon: 'crooked-wand.svg', itemTier: 'common' }
        ];
        startItems.forEach(item => {
            item.uniqueId = utilities.generateUniqueId();
            inventory.items.push(item);
        });

        this.state.eventBus.emit('LogMessage', { message: `Starting items added to inventory for ${playerState.name}: Rusty Dagger, Ragged Robes, Crooked Wand, 3 Torches, 1 Heal Potion, 100 Gold.` });
        this.state.eventBus.emit('PositionChanged', { entityId: 'player', x: position.x, y: position.y });
        this.state.eventBus.emit('GearChanged', { entityId: 'player' });

        console.log('Player stats after init:', stats);
        console.log('Player inventory after init:', inventory);
        console.log('Player resources after init:', resource);
        console.log('Player fully initialized:', this.entityManager.getEntity('player'));

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
        console.log('Systems initialized');
        this.setupEventListeners();
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
                case 'ArrowUp': newY--; break;
                case 'ArrowDown': newY++; break;
                case 'ArrowLeft': newX--; break;
                case 'ArrowRight': newX++; break;
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

            if (gameState.isRangedMode && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(mappedKey)) {
                console.log(`RangedMode: ${gameState.isRangedMode} , Mapped Key: ${mappedKey}`);
                this.state.eventBus.emit('RangedAttack', { direction: mappedKey });
                this.endTurn('rangedAttack');
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

    calculateInitialStats(player) {
        const stats = player.getComponent('Stats');
        const health = player.getComponent('Health');
        const mana = player.getComponent('Mana');
        const inventory = player.getComponent('Inventory');

        stats.intellect = stats.intellect || 0;
        stats.prowess = stats.prowess || 0;
        stats.agility = stats.agility || 0;

        Object.values(inventory.equipped).forEach(item => {
            if (!item) return;
            if (item.stats) {
                Object.entries(item.stats).forEach(([stat, value]) => {
                    stats[stat] = (stats[stat] || 0) + (value || 0);
                });
            }
            if (item.type === 'armor') stats.armor = (stats.armor || 0) + (item.armor || 0);
            if (item.type === 'weapon' && item.attackType === 'melee') stats.block = (stats.block || 0) + (item.baseBlock || 0);
            if (item.type === 'weapon' && item.attackType === 'ranged') stats.range = Math.max(stats.range || 0, item.baseRange || 0);
        });

        health.maxHp = Math.round(5 * stats.prowess * 0.1);
        mana.maxMana = Math.round(10 * stats.intellect * 0.05);
        health.hp = health.maxHp;
        mana.mana = mana.maxMana;

        console.log('Initial stats calculated:', stats);
    }
}