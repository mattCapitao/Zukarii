console.log("game.js loaded");

import { Data } from './data.js';
import { Utilities } from './utilities.js';
import { AudioManager } from './audioManager.js';
import { State } from './state.js';
import { Level } from './level.js';
import { UI } from './ui.js';
import { Render } from './render.js';
import { Items } from './items.js';
import { Player } from './player.js';
import { Monsters } from './monsters.js';
import { Combat } from './Combat.js';
import { Actions } from './actions.js';
import { PlayerInventory } from './playerInventory.js';

export class Game {
    constructor() {
        this.state = new State(new Data(), new Utilities());
        this.state.game = this; // Ensure Game instance is accessible via state
        this.audioManager = new AudioManager();
        this.level = new Level(this.state);
        this.ui = new UI(this.state);
        this.render = new Render(this.state);
        this.items = new Items(this.state);
        this.playerInventory = new PlayerInventory(this.state); // Initialize before Player
        this.player = new Player(this.state);
        this.player.playerInventory = this.playerInventory; // Link to player
        this.monsters = new Monsters(this.state); // Fixed: No Lawnmower Man!
        this.actions = new Actions(this.state);
        this.combat = new Combat(this.state, this); // Pass game instance

        // Ensure handleInput is defined before binding
        if (typeof this.handleInput !== 'function') {
            console.error('handleInput is not defined in Game class');
            this.handleInput = () => console.log('handleInput placeholder'); // Temporary fallback
        }
        this.handleInput = this.handleInput.bind(this); // Bind only if defined
        this.lastRenderTime = 0;
        this.lastInputTime = 0;
        this.renderThrottle = 70;
        this.inputThrottle = 70;

        this.init(); // Set up DOM and listeners
    }

    getService(serviceName) {
        const services = {
            'audio': this.audioManager,
            'level': this.level,
            'ui': this.ui,
            'render': this.render,
            'items': this.items,
            'player': this.player,
            'playerInventory': this.playerInventory,
            'monsters': this.monsters,
            'actions': this.actions,
            'combat': this.combat
        };
        const service = services[serviceName];
        if (!service) console.error(`Service '${serviceName}' not found!`);
        return service;
    }

   handleInput(event) {
    if (!this.state.gameStarted) {
        console.log("Starting game...");
        this.state.gameStarted = true;
        this.initGame();
        this.state.needsRender = true;
        console.log("needsRender set to true for init (this.state.needsRender:", this.state.needsRender, "typeof:", typeof this.state.needsRender, ")");
        this.getService('render').renderIfNeeded();
        this.getService('audio').playBackgroundMusic();
        return;
    }

    if (this.state.gameOver) {
        console.log("Game over, input ignored");
        return;
    }


    if (event.key === ' ') {
        console.log(`Spacebar detected eventData: `,event );

        if (event.type === 'keydown' && this.state.isRangedMode) {
                event.preventDefault();
                console.log(`Spacebar pressed detected state.isRangedMode = ${this.state.isRangedMode} : skipping input`);
                return false;
        }

    }

    

   

    const now = Date.now();
    if (now - this.lastInputTime < this.inputThrottle) return;
    this.lastInputTime = now;

    if (now - this.lastRenderTime < this.renderThrottle) return;
    this.lastRenderTime = now;

    let map = this.state.levels[this.state.tier].map;
    let newX = this.state.player.x;
    let newY = this.state.player.y;

    const tabsDiv = document.getElementById('tabs');
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
    console.log(`Mapped key: ${mappedKey}`);

    if (event.type === 'keyup') {
        if (mappedKey === ' ') {
            
            this.state.isRangedMode = false;
            console.log(`Spacebar released detected, ranged mode`,  this.state.isRangedMode);
            //this.getService('combat').toggleRanged(event); // Always call toggleRanged on keyup
            return;
        }
    }

    if (event.type === 'keydown') {
        const directionalKeys = new Set(['w', 'W', 'a', 'A', 's', 'S', 'd', 'D', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);
        if (this.state.isRangedMode && directionalKeys.has(event.key)) {
            const rangedEventKey = keyMap[event.key];
            console.log(`Directional key pressed: ${event.key} - rangedKey: ${rangedEventKey} state.isRangedMode = ${this.state.isRangedMode}`);
            this.getService('combat').rangedAttack(rangedEventKey);
            console.log(`directional key pressed: ${event.key} state.isRanged = ${this.state.isRangedMode} : Ranged attack triggered for`, rangedEventKey);
            return;
        }

        switch (mappedKey) {
            case 'ArrowUp': newY--; break;
            case 'ArrowDown': newY++; break;
            case 'ArrowLeft': newX--; break;
            case 'ArrowRight': newX++; break;
        }

        switch (mappedKey) {
            case 'c':
                if (!this.state.ui.overlayOpen) {
                    this.state.ui.overlayOpen = true;
                    this.state.ui.activeTab = 'character';
                    tabsDiv.classList.remove('hidden');
                    this.getService('ui').renderOverlay();
                    this.getService('ui').updateInventory(true);
                } else if (this.state.ui.activeTab.toLowerCase() === 'character') {
                    this.state.ui.overlayOpen = false;
                    tabsDiv.classList.add('hidden');
                    this.getService('ui').renderOverlay();
                } else {
                    this.state.ui.activeTab = 'character';
                    this.getService('ui').renderOverlay();
                    this.getService('ui').updateInventory(true);
                }
                return;
            case 'l':
                if (!this.state.ui.overlayOpen) {
                    this.state.ui.overlayOpen = true;
                    this.state.ui.activeTab = 'log';
                    tabsDiv.classList.remove('hidden');
                    this.getService('ui').renderOverlay();
                } else if (this.state.ui.activeTab.toLowerCase() === 'log') {
                    this.state.ui.overlayOpen = false;
                    tabsDiv.classList.add('hidden');
                    this.getService('ui').renderOverlay();
                } else {
                    this.state.ui.activeTab = 'log';
                    this.getService('ui').renderOverlay();
                }
                return;
            case 'escape':
                if (this.state.ui.overlayOpen) {
                    this.state.ui.overlayOpen = false;
                    tabsDiv.classList.add('hidden');
                    this.getService('ui').renderOverlay();
                }
                return;
            case 't':
                this.getService('actions').lightTorch();
                this.endTurn();
                return;
            case 'h':
                this.getService('actions').drinkHealPotion();
                this.endTurn();
                return;
            case ' ':
                this.getService('combat').toggleRanged(event);
                console.log(`Spacebar pressed detected state.isRangedMode = ${this.state.isRangedMode} : before toggleRanged`);
                return;
        }
    }

    if (map[newY][newX] === '#') {
        this.endTurn();
        return;
    }

    let monster = this.state.monsters[this.state.tier].find(m => m.x === newX && m.y === newY && m.hp > 0);
    let fountain = this.state.fountains[this.state.tier].find(f => f.x === newX && f.y === newY && !f.used);
    let treasureIndex = this.state.treasures[this.state.tier].findIndex(t => t.x === newX && t.y === newY);

    this.state.needsRender = true;
    console.log("needsRender set to true for action at", newX, newY, "(this.state.needsRender:", this.state.needsRender, "typeof:", typeof this.state.needsRender, ")");
    console.log(`Checking for treasure at (${newX}, ${newY}): map tile = '${map[newY][newX]}', treasureIndex = ${treasureIndex}`);
    if (monster) {
        this.getService('combat').meleeAttack(monster);
        this.getService('player').checkLevelUp();
    } else if (map[newY][newX] === '⇓' && this.state.tier < Number.MAX_SAFE_INTEGER) {
        this.state.tier++;
        if (this.state.tier > this.state.highestTier) {
            this.state.highestTier = this.state.tier;
            const newTierXP = 5 * this.state.tier;
            this.getService('ui').writeToLog(`You Reached Tier ${this.state.tier}`);
            this.getService('player').awardXp(newTierXP);
        }
        this.getService('level').addLevel(this.state.tier);
        map = this.state.levels[this.state.tier].map;
        const upStair = this.state.stairsUp[this.state.tier];
        if (upStair) {
            this.state.player.x = upStair.x + 1;
            this.state.player.y = upStair.y;
            console.log(`Moved down to tier ${this.state.tier}, placed at (${this.state.player.x}, ${this.state.player.y}) next to < at (${upStair.x}, ${upStair.y})`);
            if (map[this.state.player.y][this.state.player.x] !== ' ') {
                const directions = [
                    { x: upStair.x - 1, y: upStair.y },
                    { x: upStair.x, y: upStair.y + 1 },
                    { x: upStair.x, y: upStair.y - 1 }
                ];
                for (let dir of directions) {
                    if (map[dir.y][dir.x] === ' ') {
                        this.state.player.x = dir.x;
                        this.state.player.y = dir.y;
                        console.log(`Adjusted down position to (${this.state.player.x}, ${this.state.player.y})`);
                        break;
                    }
                }
                if (map[this.state.player.y][this.state.player.x] !== ' ') {
                    console.error(`No free space near < at (${upStair.x}, ${upStair.y}), defaulting to (1, 1)`);
                    this.state.player.x = 1;
                    this.state.player.y = 1;
                }
            }
        } else {
            console.error(`No stairsUp defined for tier ${this.state.tier}`);
            this.state.player.x = 1;
            this.state.player.y = 1;
        }
    } else if (map[newY][newX] === '⇑' && this.state.tier > 0) {
        this.state.tier--;
        if (this.state.tier === 0) {
            this.getService('player').exit();
        } else {
            const downStair = this.state.stairsDown[this.state.tier];
            map = this.state.levels[this.state.tier].map;
            if (downStair) {
                this.state.player.x = downStair.x + 1;
                this.state.player.y = downStair.y;
                console.log(`Moved up to tier ${this.state.tier}, placed at (${this.state.player.x}, ${this.state.player.y}) next to > at (${downStair.x}, ${downStair.y})`);
                if (map[this.state.player.y][this.state.player.x] !== ' ') {
                    const directions = [
                        { x: downStair.x - 1, y: downStair.y },
                        { x: downStair.x, y: downStair.y + 1 },
                        { x: downStair.x, y: downStair.y - 1 }
                    ];
                    for (let dir of directions) {
                        if (map[dir.y][dir.x] === ' ') {
                            this.state.player.x = dir.x;
                            this.state.player.y = dir.y;
                            console.log(`Adjusted up position to (${this.state.player.x}, ${this.state.player.y})`);
                            break;
                        }
                    }
                    if (map[this.state.player.y][this.state.player.x] !== ' ') {
                        console.error(`No free space near > at (${downStair.x}, ${downStair.y}), defaulting to (1, 1)`);
                        this.state.player.x = 1;
                        this.state.player.y = 1;
                    }
                }
            } else {
                console.error(`No stairsDown defined for tier ${this.state.tier}`);
                this.state.player.x = 1;
                this.state.player.y = 1;
            }
            this.state.needsInitialRender = true;
            this.state.needsRender = true;
            console.log("Triggered initial render for tier", this.state.tier);
        }
    } else if (map[newY][newX] === '≅' && fountain) {
        this.getService('actions').useFountain(fountain, this.state.tier);
        this.state.player.x = newX;
        this.state.player.y = newY;
    } else if (map[newY][newX] === '$' && treasureIndex !== -1) {
        console.log(`Treasure found at (${newX}, ${newY})! Picking up...`);
        this.state.player.x = newX;
        this.state.player.y = newY;
        this.getService('actions').pickupTreasure(newX, newY);
        if (this.state.player.gold >= 1e12) {
            this.getService('ui').writeToLog("You amassed a trillion gold! Victory!");
            this.state.isVictory = true;
            document.removeEventListener('keydown', this.handleInput);
            document.removeEventListener('keyup', this.handleInput);
        }
    } else {
        this.state.player.x = newX;
        this.state.player.y = newY;
    }

    if (this.state.player.x === newX && this.state.player.y === newY) {
        this.getService('render').updateMapScroll();
    }

    this.endTurn();
}

    endTurn() {
        if (this.state.gameOver) {
            console.log("endTurn skipped due to gameOver");
            return;
        }
        if (this.state.torchExpires > 0) {
            this.state.torchExpires--;
            console.log(`Torch expires in ${this.state.torchExpires} turns`);
            if (this.state.torchExpires < 1) {
                this.getService('actions').torchExpired();
            }
        }
        this.getService('player').calculateStats();
        this.getService('ui').updateStats();
        this.getService('monsters').moveMonsters();
        this.getService('render').renderIfNeeded();
    }

    init() {
        this.state.mapDiv = document.getElementById('map');
        this.state.statsDiv = document.getElementById('stats');
        this.state.logDiv = document.getElementById('log');
        console.log("Game init - DOM elements:", {
            mapDiv: this.state.mapDiv,
            statsDiv: this.state.statsDiv,
            logDiv: this.state.logDiv
        });
        this.state.needsRender = true;
        console.log("needsRender set to true for init (this.state.needsRender:", this.state.needsRender, "typeof:", typeof this.state.needsRender, ")");
        this.getService('render').renderIfNeeded();
        document.addEventListener('keydown', this.handleInput);
        document.addEventListener('keyup', this.handleInput);
        this.getService('ui').updatePlayerInfo(); // Ensure top bar updates
        this.getService('ui').updatePlayerStatus(); // Ensure bottom bar updates
        this.getService('ui').updateStats(); // Ensure overlay stats update if open
    }

    initGame() {
        this.state.initGame();
        console.log("Treasures after initGame:", this.state.treasures[this.state.tier]);
    }
}