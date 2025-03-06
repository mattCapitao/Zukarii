console.log("game.js loaded");

class Game {
    constructor() {
        this.data = new Data();
        this.state = new State(this.data);
        this.utilities = new Utilities();
        this.level = new Level(this.state, this);
        this.ui = new UI(this.state, this, this.utilities);
        this.render = new Render(this.state, this.ui, this);
        this.items = new Items(this.state, this.data, this.ui, this);
        this.player = new Player(this.state, this.ui, this, this.utilities); // Added this.utilities
        this.monsters = new Monsters(this.state, this.data, this.ui, this.items);
        this.actions = new Actions(this.state, this, this.ui, this.render, this.player.playerInventory); // Pass PlayerInventory to Actions
        this.combat = new Combat(this.state, this, this.ui, this.player, this.monsters, this.items);

        this.combat.toggleRanged = this.combat.toggleRanged.bind(this.combat);

        this.lastRenderTime = 0;
        this.lastInputTime = 0;
        this.renderThrottle = 70;
        this.inputThrottle = 70;

        this.handleInput = this.handleInput.bind(this);
    }

    handleInput(event) {
        if (!this.state.gameStarted) {
            console.log("Starting game...");
            this.state.gameStarted = true;
            this.initGame();
            this.state.needsRender = true;
            console.log("needsRender set to true for init (this.state.needsRender:", this.state.needsRender, "typeof:", typeof this.state.needsRender, ")");
            this.render.renderIfNeeded();
            return;
        }

        if (this.state.gameOver) {
            console.log("Game over, input ignored");
            return;
        }



        const now = Date.now();
        if (now - this.lastInputTime < this.inputThrottle) return;
        this.lastInputTime = now;

        if (now - this.lastRenderTime < this.renderThrottle) return;
        this.lastRenderTime = now;

        if (event.type === 'keydown' && this.state.isRangedMode && event.key === ' ') {
            console.log(`Spacebar pressed detected state.isRangedMode = ${this.state.isRangedMode} : skipping input`);
            return;
        }

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
            ' ': ' ', 'Space': ' '
        };

        const mappedKeys = new Set(Object.keys(keyMap));
        if (!mappedKeys.has(event.key)) {
            return;
        }

        const mappedKey = keyMap[event.key] || event.key;
        console.log(`Mapped key: ${mappedKey}`);

        if (event.type === 'keyup') {
            if (mappedKey === ' ' && this.state.isRangedMode) {
                console.log(`Spacebar released detected state.isRangedMode = ${this.state.isRangedMode} : toggling ranged mode`);
                this.combat.toggleRanged(event);
                return;
            }
        }

        if (event.type === 'keydown') {
            const directionalKeys = new Set(['w', 'W', 'a', 'A', 's', 'S', 'd', 'D', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);

            if (this.state.isRangedMode && directionalKeys.has(event.key)) {
                const rangedEventKey = keyMap[event.key];
                console.log(`Directional key pressed: ${event.key} - rangedKey: ${rangedEventKey} state.isRangedMode = ${this.state.isRangedMode}`);
                this.combat.rangedAttack(rangedEventKey);
                console.log(`directional key pressed: ${event.key} state.isRanged = ${this.state.isRangedMode} : Ranged attack triggered for`, rangedEventKey);
                return;
            }

            switch (mappedKey) {
                case 'ArrowUp': newY--; break;
                case 'ArrowDown': newY++; break;
                case 'ArrowLeft': newX--; break;
                case 'ArrowRight': newX++; break;
            }

            switch (event.key.toLowerCase()) {
                case 'c':
                    if (!this.state.ui.overlayOpen) {
                        this.state.ui.overlayOpen = true;
                        this.state.ui.activeTab = 'character';
                        tabsDiv.classList.remove('hidden');
                        this.ui.renderOverlay();
                        this.ui.updateInventory(true);
                    } else if (this.state.ui.activeTab.toLowerCase() === 'character') {
                        this.state.ui.overlayOpen = false;
                        tabsDiv.classList.add('hidden');
                        this.ui.renderOverlay();
                    } else {
                        this.state.ui.activeTab = 'character';
                        this.ui.renderOverlay();
                        this.ui.updateInventory(true);
                    }
                    return;
                case 'l':
                    if (!this.state.ui.overlayOpen) {
                        this.state.ui.overlayOpen = true;
                        this.state.ui.activeTab = 'log';
                        tabsDiv.classList.remove('hidden');
                        this.ui.renderOverlay();
                    } else if (this.state.ui.activeTab.toLowerCase() === 'log') {
                        this.state.ui.overlayOpen = false;
                        tabsDiv.classList.add('hidden');
                        this.ui.renderOverlay();
                    } else {
                        this.state.ui.activeTab = 'log';
                        this.ui.renderOverlay();
                    }
                    return;
                case 'escape':
                    if (this.state.ui.overlayOpen) {
                        this.state.ui.overlayOpen = false;
                        tabsDiv.classList.add('hidden');
                        this.ui.renderOverlay();
                    }
                    return;
                case 't':
                    this.actions.lightTorch();
                    this.endTurn();
                    return;
                case ' ':
                    if (!this.state.isRangedMode) this.combat.toggleRanged(event);
                    console.log(`Spacebar pressed detected state.isRangedMode = ${this.state.isRangedMode} : toggling ranged mode`);
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
            this.combat.meleeCombat(monster);
            this.player.checkLevelUp();
        } else if (map[newY][newX] === '⇓' && this.state.tier < Number.MAX_SAFE_INTEGER) {
            this.state.tier++;
            if (this.state.tier > this.state.highestTier) {
                this.state.highestTier = this.state.tier;
                const newTierXP = 5 * this.state.tier;
                this.ui.writeToLog(`You Reached Tier ${this.state.tier}`);
                this.player.awardXp(newTierXP);
            }
            this.level.addLevel(this.state.tier);
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
                this.player.exit();
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
            this.actions.useFountain(fountain, this.state.tier);
            this.state.player.x = newX;
            this.state.player.y = newY;
        } else if (map[newY][newX] === '$' && treasureIndex !== -1) {
            console.log(`Treasure found at (${newX}, ${newY})! Picking up...`);
            this.actions.pickupTreasure(newX, newY);
            this.state.player.x = newX;
            this.state.player.y = newY;
            if (this.state.player.gold >= 1e12) {
                this.ui.writeToLog("You amassed a trillion gold! Victory!");
                this.state.isVictory = true;
                document.removeEventListener('keydown', this.handleInput);
                document.removeEventListener('keyup', this.combat.toggleRanged);
            }
        } else {
            this.state.player.x = newX;
            this.state.player.y = newY;
        }

        if (this.state.player.x === newX && this.state.player.y === newY) {
            this.render.updateMapScroll();
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
                this.actions.torchExpired();
            }
        }
        this.player.calculateStats();
        this.ui.updateStats();
        this.monsters.moveMonsters();
        this.render.renderIfNeeded();
    }

    init() {
        this.state.mapDiv = document.getElementById('map');
        this.state.statsDiv = document.getElementById('stats');
        this.state.logDiv = document.getElementById('log');
        this.state.needsRender = true;
        console.log("needsRender set to true for init (this.state.needsRender:", this.state.needsRender, "typeof:", typeof this.state.needsRender, ")");
        this.render.renderIfNeeded();
        document.addEventListener('keydown', this.handleInput);
        document.addEventListener('keyup', this.combat.toggleRanged);
        this.ui.updateStats();
    }

    initGame() {
        this.state.initGame(this.level, this.monsters, this.items, this.player); 

        console.log("Treasures after initGame:", this.state.treasures[this.state.tier]);

        //////////////////////INACTIVE DO NOT UNCOMMENT OR DELETE
        //this.player.promptForName(0); // Moved from Render
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const gameInstance = new Game();
    gameInstance.init();
});