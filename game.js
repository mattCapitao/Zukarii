//console.log("game.js loaded");

import { Data } from './Data.js';
import { Utilities } from './Utilities.js';
import { AudioManager } from './AudioManager.js';
import { State } from './State.js';
import { Level } from './Level.js';
import { UI } from './UI.js';
import { Render } from './Render.js';
import { LootTables } from './LootTables.js';
import { Items } from './Items.js';
import { Player } from './Player.js';
import { Monsters } from './Monsters.js';
import { Combat } from './Combat.js';
import { Actions } from './Actions.js';
import { PlayerInventory } from './PlayerInventory.js';
import { LevelTransition } from './LevelTransition.js';

export class Game {
    constructor() {
        this.data = new Data();
        this.state = new State(new Utilities());
        this.state.game = this; // Ensure Game instance is accessible via state
        this.audioManager = new AudioManager();
        this.level = new Level(this.state);
        this.ui = new UI(this.state);
        this.render = new Render(this.state);
        this.lootTables = new LootTables(this.state);
        this.items = new Items(this.state);
        this.playerInventory = new PlayerInventory(this.state); // Initialize before Player
        this.player = new Player(this.state);
        this.player.playerInventory = this.playerInventory; // Link to player
        this.monsters = new Monsters(this.state, this);
        this.actions = new Actions(this.state);
        this.combat = new Combat(this.state, this);
        this.levelTransition = new LevelTransition(this.state); // New class

        // Ensure handleInput is defined before binding
        if (typeof this.handleInput !== 'function') {
            console.error('handleInput is not defined in Game class');
        }
        this.handleInput = this.handleInput.bind(this); // Bind only if defined
        this.lastRenderTime = 0;
        this.lastInputTime = 0;
        this.renderThrottle = 20;
        this.inputThrottle = 20;

        this.init(); // Set up DOM and listeners
    }

    getService(serviceName) {
        const services = {
            'audio': this.audioManager,
            'level': this.level,
            'ui': this.ui,
            'render': this.render,
            'lootTables': this.lootTables,
            'items': this.items,
            'player': this.player,
            'playerInventory': this.playerInventory,
            'monsters': this.monsters,
            'actions': this.actions,
            'combat': this.combat,
            'data': this.data,
            'levelTransition': this.levelTransition,
        };
        const service = services[serviceName];
        if (!service) console.error(`Service '${serviceName}' not found!`);
        return service;
    }

    handleInput(event) {
        if (!this.state.gameStarted) {
            this.state.gameStarted = true;
            this.initGame();
            this.state.needsRender = true;
            this.getService('render').renderIfNeeded();
            this.getService('audio').playBackgroundMusic();
            return;
        }

        if (this.state.gameOver) {
            return;
        }

        if (event.key === ' ') {
            if (event.type === 'keydown' && this.state.isRangedMode) {
                event.preventDefault();
                return;
            }
        }

        const now = Date.now();
        if (now - this.lastInputTime < this.inputThrottle) return;
        this.lastInputTime = now;

        if (now - this.lastRenderTime < this.renderThrottle) return;
        this.lastRenderTime = now;

        let map = this.state.levels[this.state.tier]?.map;
        if (!map) {
            console.warn(`Map for tier ${this.state.tier} not found, initializing...`);
            this.getService('level').addLevel(this.state.tier);
            map = this.state.levels[this.state.tier].map;
            if (!map) throw new Error(`Failed to initialize map for tier ${this.state.tier}`);
        }

        let newX = this.state.player.x;
        let newY = this.state.player.y;

        const keyMap = {
            'w': 'ArrowUp', 'W': 'ArrowUp', 'ArrowUp': 'ArrowUp',
            'a': 'ArrowLeft', 'A': 'ArrowLeft', 'ArrowLeft': 'ArrowLeft',
            's': 'ArrowDown', 'S': 'ArrowDown', 'ArrowDown': 'ArrowDown',
            'd': 'ArrowRight', 'D': 'ArrowRight', 'ArrowRight': 'ArrowRight',
            'i': 'c', 'I': 'c', 'c': 'c', 'C': 'c', 'l': 'l', 'L': 'l',
            'escape': 'escape', 'Escape': 'escape', 't': 't', 'T': 't',
            'h': 'h', 'H': 'h', ' ': ' ', 'Space': ' '
        };

        const mappedKeys = new Set(Object.keys(keyMap));
        if (!mappedKeys.has(event.key)) return;

        const mappedKey = keyMap[event.key] || event.key;

        if (event.type === 'keyup') {
            if (mappedKey === ' ') {
                this.state.isRangedMode = false;
                return;
            }
        }

        if (event.type === 'keydown') {
            const directionalKeys = new Set(['w', 'W', 'a', 'A', 's', 'S', 'd', 'D', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);

            if (this.state.isRangedMode && directionalKeys.has(event.key)) {
                const rangedEventKey = keyMap[event.key];
                this.getService('combat').rangedAttack(rangedEventKey);
                this.#endTurn('rangedAttack');
                return;
            }




            switch (mappedKey) {
                case 'ArrowUp': newY--; break;
                case 'ArrowDown': newY++; break;
                case 'ArrowLeft': newX--; break;
                case 'ArrowRight': newX++; break;
                case 'c':
                    if (!this.state.ui.overlayOpen) {
                        this.state.ui.overlayOpen = true;
                        this.state.ui.activeTab = 'character';
                        if (this.state.tabsDiv) this.state.tabsDiv.classList.remove('hidden');
                        this.getService('ui').renderOverlay();
                    } else if (this.state.ui.activeTab.toLowerCase() === 'character') {
                        this.state.ui.overlayOpen = false;
                        if (this.state.tabsDiv) this.state.tabsDiv.classList.add('hidden');
                        this.getService('ui').renderOverlay();
                    } else {
                        this.state.ui.activeTab = 'character';
                        this.getService('ui').renderOverlay();
                    }
                    return;
                case 'l':
                    if (!this.state.ui.overlayOpen) {
                        this.state.ui.overlayOpen = true;
                        this.state.ui.activeTab = 'log';
                        if (this.state.tabsDiv) this.state.tabsDiv.classList.remove('hidden');
                        this.getService('ui').renderOverlay();
                    } else if (this.state.ui.activeTab.toLowerCase() === 'log') {
                        this.state.ui.overlayOpen = false;
                        if (this.state.tabsDiv) this.state.tabsDiv.classList.add('hidden');
                        this.getService('ui').renderOverlay();
                    } else {
                        this.state.ui.activeTab = 'log';
                        this.getService('ui').renderOverlay();
                    }
                    return;
                case 'escape':
                    if (this.state.ui.overlayOpen) {
                        this.state.ui.overlayOpen = false;
                        if (this.state.tabsDiv) this.state.tabsDiv.classList.add('hidden');
                        this.getService('ui').renderOverlay();
                    }
                    return;
                case 't':
                    this.getService('actions').lightTorch();
                    this.#endTurn('light Torch');
                    return;
                case 'h':
                    this.getService('actions').drinkHealPotion();
                    this.#endTurn('drink potion');
                    return;
                case ' ':
                    this.getService('combat').toggleRanged(event);
                    console.log('Ranged mode:', this.state.isRangedMode);
            }
        }

        // Check interactions (move player at end)
        let monster = this.state.monsters[this.state.tier].find(m => m.x === newX && m.y === newY && m.hp > 0);
        let fountain = this.state.fountains[this.state.tier].find(f => f.x === newX && f.y === newY && !f.used);
        let treasureIndex = this.state.treasures[this.state.tier].findIndex(t => t.x === newX && t.y === newY);
        console.log(`Checking interactions at (${newX}, ${newY}): map[${newY}][${newX}]='${map[newY][newX]}', monster=${!!monster}, fountain=${!!fountain}, treasureIndex=${treasureIndex}`);

        if (monster) {
            if (this.getService('combat').meleeAttack(monster)) {
                this.#endTurn('melee attack');
            }
            return;
        }

        if (fountain) {
            this.getService('actions').useFountain(fountain, this.state.tier);
            this.#endTurn('use fountain');
        }

        if (treasureIndex !== -1) {
            console.log(`Treasure found at (${newX}, ${newY}), index: ${treasureIndex}`);
            this.getService('actions').pickupTreasure(newX, newY);
            this.state.needsRender = true;
            if (this.state.player.gold >= 1e12) {
                this.getService('ui').writeToLog("You amassed a trillion gold! Victory!");
                this.state.isVictory = true;
                document.removeEventListener('keydown', this.handleInput);
                document.removeEventListener('keyup', this.handleInput);
            }
        }

        if (map[newY][newX] === '#') {
            return;
        }

        let transitioned = false;
        if (map[newY][newX] === '⇓' && this.state.tier < Number.MAX_SAFE_INTEGER) {
            console.log(`Transition down triggered at (${newX}, ${newY}) with map value '${map[newY][newX]}'`);
            this.getService('levelTransition').transitionDown();
            this.state.transitionLock = true;
            transitioned = true;
        } else if (map[newY][newX] === '⇑' && this.state.tier > 0) {
            console.log(`Transition up triggered at (${newX}, ${newY}) with map value '${map[newY][newX]}'`);
            this.getService('levelTransition').transitionUp();
            this.state.transitionLock = true;
            transitioned = true;
        } else if (map[newY][newX] === '?') {
            console.log(`Portal transition triggered at (${newX}, ${newY}) with map value '${map[newY][newX]}'`);
            this.getService('levelTransition').transitionViaPortal(newX, newY);
            this.state.transitionLock = true;
            transitioned = true;
        }

        if (!transitioned && !this.state.transitionLock) {
            let movement = false;
            if (this.state.player.x != newX || this.state.player.y != newY ) movement = true;

            this.state.player.x = newX;
            this.state.player.y = newY;
            if (movement) {
                movement = false;
                this.state.player.x === newX && this.state.player.y === newY
                this.getService('render').updateMapScroll();
                this.#endTurn('movement');
            }
        }

        if (this.state.transitionLock) {
            this.state.transitionLock = false; // Reset for next frame
            this.#endTurn('transition');
            this.getService('render').updateMapScroll();

        }

    }

    #endTurn(source) {
        console.warn('endTurn called by ', source);
        console.log(`Player location in state at endTurn: T:${this.state.tier}, x:${this.state.player.x}, y:${this.state.player.y}`);
        if (this.state.gameOver) {
            return;
        }
        if (this.state.torchExpires > 0) {
            this.state.torchExpires--;
            if (this.state.torchExpires < 1) {
                this.getService('actions').torchExpired();
            }
        }
        this.getService('player').calculateStats();
        this.getService('ui').statRefreshUI();
        this.getService('monsters').moveMonsters();
        this.state.needsRender = true;
        this.getService('render').renderIfNeeded();
    }

    init() {
        this.state.mapDiv = document.getElementById('map');
        this.state.statsDiv = document.getElementById('stats');
        this.state.logDiv = document.getElementById('log');
        this.state.tabsDiv = document.getElementById('tabs'); // Added tabsDiv
        this.state.needsRender = true;
        this.getService('render').renderIfNeeded();
        document.addEventListener('keydown', this.handleInput);
        document.addEventListener('keyup', this.handleInput);
        this.getService('ui').statRefreshUI();
    }

    initGame() {
        const levelService = this.state.game.getService('level');
        const dataService = this.state.game.getService('data');
        const splash = document.getElementById('splash');
        if (splash) splash.remove();

        levelService.addLevel(0, dataService.getCustomLevel(0));
        if (!this.state.levels[0]) throw new Error('Failed to initialize tier 0');

        const startLevel = 1;
        this.state.highestTier = startLevel;
        levelService.addLevel(startLevel);
        this.state.tier = startLevel; 

        this.state.lastPlayerX = null;
        this.state.lastPlayerY = null;
        this.state.needsInitialRender = true;
        this.state.needsRender = true;
    }
}