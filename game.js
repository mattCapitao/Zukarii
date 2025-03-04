console.log("game.js loaded");

let lastRenderTime = 0;
let lastInputTime = 0;
const renderThrottle = 70;
const inputThrottle = 70;

function handleInput(event) {

    //////////////////////////////// BEGIN INPUT VALIDATION

    if (!state.gameStarted) {
        console.log("Starting game...");
        state.gameStarted = true;
        initGame();
        window.needsRender = true;
        console.log("needsRender set to true for init (window.needsRender:", window.needsRender, "typeof:", typeof window.needsRender, ")");
        renderIfNeeded();
        return;
    }

    if (state.gameOver) {console.log("Game over, input ignored");return;}

    const now = Date.now();
    if (now - lastInputTime < inputThrottle) return;
    lastInputTime = now;

    if (now - lastRenderTime < renderThrottle) return;
    lastRenderTime = now;

    let map = state.levels[state.tier].map;
    let newX = state.player.x;
    let newY = state.player.y;

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

    if (mappedKeys.has(event.key) !== true) {
        //console.log(`unmapped/unmanaged key press event ${event} exiting handleInput()`);
        return;
    }

    ///// END INPUT VALIDATION

    event.key = keyMap[event.key] || event.key; //reassign pressed event key to mapped value
    console.log(`Mapped key: ${event.key}`);

    ///// START KEY UP

    if (event.type === 'keyup') {

       if(event.key === ' ' && state.isRangedMode) {
            console.log(`Spacebar released detected state.isRangedMode = ${state.isRangedMode} : toggling ranged mode`);
            toggleRanged(event); return;
        }
    }

    ///// END KEY UP

    ///// START KEY DOWN

    if (event.type === 'keydown') {

        const directionalKeys = new Set(['w', 'W', 'a', 'A', 's', 'S', 'd', 'D', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);

        if (state.isRangedMode && directionalKeys.has(event.key)) {

            const rangedEventKey = keyMap[event.key];
            console.log(`Directional key pressed: ${event.key} - rangedKey: ${rangedEventKey} state.isRangedMode = ${state.isRangedMode}`);
            window.rangedAttack(rangedEventKey);
            console.log(`directional key pressed: ${event.key} state.isRanged = ${state.isRangedMode} : Ranged attack triggered for`, rangedEventKey);

            return;
        }

        switch (keyMap[event.key]) {
            case 'ArrowUp':newY--; break;
            case 'ArrowDown':newY++; break;
            case 'ArrowLeft':newX--; break;
            case 'ArrowRight': newX++;break;
        }

        switch (event.key.toLowerCase()) {
            case 'i':
              /*  if (!state.ui.overlayOpen) {
                    state.ui.overlayOpen = true;
                    state.ui.activeTab = 'inventory';
                    tabsDiv.classList.remove('hidden');
                    window.ui.renderOverlay();
                    window.ui.updateInventory(); // Ensure immediate inventory update
                } else if (state.ui.activeTab.toLowerCase() === 'inventory') {
                    state.ui.overlayOpen = false;
                    tabsDiv.classList.add('hidden');
                    window.ui.renderOverlay();
                } else {
                    state.ui.activeTab = 'inventory';
                    window.ui.renderOverlay();
                    window.ui.updateInventory(); // Ensure immediate inventory update
                }
                return;*/
            case 'c':
                if (!state.ui.overlayOpen) {
                    state.ui.overlayOpen = true;
                    state.ui.activeTab = 'character';
                    tabsDiv.classList.remove('hidden');
                    window.ui.renderOverlay();
                    window.ui.updateInventory(true); // Ensure immediate equipped items update
                } else if (state.ui.activeTab.toLowerCase() === 'character') {
                    state.ui.overlayOpen = false;
                    tabsDiv.classList.add('hidden');
                    window.ui.renderOverlay();
                } else {
                    state.ui.activeTab = 'character';
                    window.ui.renderOverlay();
                    window.ui.updateInventory(true); // Ensure immediate equipped items update
                }
                return;
            case 'l':
                if (!state.ui.overlayOpen) {
                    state.ui.overlayOpen = true;
                    state.ui.activeTab = 'log';
                    tabsDiv.classList.remove('hidden');
                    window.ui.renderOverlay();
                } else if (state.ui.activeTab.toLowerCase() === 'log') {
                    state.ui.overlayOpen = false;
                    tabsDiv.classList.add('hidden');
                    window.ui.renderOverlay();
                } else {
                    state.ui.activeTab = 'log';
                    window.ui.renderOverlay();
                }
                return;
            case 'escape':
                if (state.ui.overlayOpen) {
                    state.ui.overlayOpen = false;
                    tabsDiv.classList.add('hidden');
                    window.ui.renderOverlay();
                }
                return;
            case 't':
                window.lightTorch();
                endTurn();
                return;
            case ' ':
               if(!state.isRangedMode) toggleRanged(event);
                return;
        }

    } // END keydown

    if (map[newY][newX] === '#') {
        endTurn();
        return;
    }

    let monster = state.monsters[state.tier].find(m => m.x === newX && m.y === newY && m.hp > 0);
    let fountain = state.fountains[state.tier].find(f => f.x === newX && f.y === newY && !f.used);
    let treasureIndex = state.treasures[state.tier].findIndex(t => t.x === newX && t.y === newY);

    window.needsRender = true;
    console.log("needsRender set to true for action at", newX, newY, "(window.needsRender:", window.needsRender, "typeof:", typeof window.needsRender, ")");

    if (monster) {
        meleeCombat(monster);
        checkLevelUp();
    } else if (map[newY][newX] === '⇓' && state.tier < Number.MAX_SAFE_INTEGER) {
        state.tier++;
        if (state.tier > state.highestTier) {
            state.highestTier = state.tier;
            const newTierXP = 5 * state.tier;
            writeToLog(`You Reached Tier ${state.tier}`);
            awardXp(newTierXP);
        }
        addLevel(state.tier);
        map = state.levels[state.tier].map;
        const upStair = state.stairsUp[state.tier];
        if (upStair) {
            state.player.x = upStair.x + 1;
            state.player.y = upStair.y;
            console.log(`Moved down to tier ${state.tier}, placed at (${state.player.x}, ${state.player.y}) next to < at (${upStair.x}, ${upStair.y})`);
            if (map[state.player.y][state.player.x] !== ' ') {
                const directions = [
                    { x: upStair.x - 1, y: upStair.y },
                    { x: upStair.x, y: upStair.y + 1 },
                    { x: upStair.x, y: upStair.y - 1 }
                ];
                for (let dir of directions) {
                    if (map[dir.y][dir.x] === ' ') {
                        state.player.x = dir.x;
                        state.player.y = dir.y;
                        console.log(`Adjusted down position to (${state.player.x}, ${state.player.y})`);
                        break;
                    }
                }
                if (map[state.player.y][state.player.x] !== ' ') {
                    console.error(`No free space near < at (${upStair.x}, ${upStair.y}), defaulting to (1, 1)`);
                    state.player.x = 1;
                    state.player.y = 1;
                }
            }
        } else {
            console.error(`No stairsUp defined for tier ${state.tier}`);
            state.player.x = 1;
            state.player.y = 1;
        }
    } else if (map[newY][newX] === '⇑' && state.tier > 0) {
        state.tier--;
        if (state.tier === 0) {
            window.playerExit();
        } else {
            const downStair = state.stairsDown[state.tier];
            map = state.levels[state.tier].map;
            if (downStair) {
                state.player.x = downStair.x + 1;
                state.player.y = downStair.y;
                console.log(`Moved up to tier ${state.tier}, placed at (${state.player.x}, ${state.player.y}) next to > at (${downStair.x}, ${downStair.y})`);
                if (map[state.player.y][state.player.x] !== ' ') {
                    const directions = [
                        { x: downStair.x - 1, y: downStair.y },
                        { x: downStair.x, y: downStair.y + 1 },
                        { x: downStair.x, y: downStair.y - 1 }
                    ];
                    for (let dir of directions) {
                        if (map[dir.y][dir.x] === ' ') {
                            state.player.x = dir.x;
                            state.player.y = dir.y;
                            console.log(`Adjusted up position to (${state.player.x}, ${state.player.y})`);
                            break;
                        }
                    }
                    if (map[state.player.y][state.player.x] !== ' ') {
                        console.error(`No free space near > at (${downStair.x}, ${downStair.y}), defaulting to (1, 1)`);
                        state.player.x = 1;
                        state.player.y = 1;
                    }
                }
            } else {
                console.error(`No stairsDown defined for tier ${state.tier}`);
                state.player.x = 1;
                state.player.y = 1;
            }

            // Trigger a full render for the new tier
            state.needsInitialRender = true;
            window.needsRender = true;
            console.log("Triggered initial render for tier", state.tier);

        }
    } else if (map[newY][newX] === '≅' && fountain) {
        useFountain(fountain, state.tier);
        state.player.x = newX;
        state.player.y = newY;
    } else if (map[newY][newX] === '$' && treasureIndex !== -1) {
        const treasure = state.treasures[state.tier][treasureIndex];
        const goldGain = treasure.gold || (10 + Math.floor(Math.random() * 41) + state.tier * 10);
        state.player.gold += goldGain;
        let pickupMessage = `Found treasure! Gained ${goldGain} gold`;

        if (treasure.torches) {
            state.player.torches += treasure.torches;
            state.player.torchDropFail = 0;
            pickupMessage += ` and ${treasure.torches} torch${treasure.torches > 1 ? 'es' : ''}`;
        }
        if (treasure.items && treasure.items.length) {
            treasure.items.forEach(item => {
                if (!state.player.inventory.items.some(i => JSON.stringify(i) === JSON.stringify(item))) {
                    state.player.inventory.items.push({ ...item });
                    pickupMessage += ` and picked up ${item.name}`;
                } else {
                    console.log(`Duplicate ${item.name} ignored in pickup with ID ${item.uniqueId}`);
                }
            });
        }

        state.treasures[state.tier].splice(treasureIndex, 1);
        map[newY][newX] = ' ';
        writeToLog(pickupMessage);
        state.player.x = newX;
        state.player.y = newY;
        if (state.player.gold >= 1e12) {
            writeToLog("You amassed a trillion gold! Victory!");
            state.isVictory = true;
            document.removeEventListener('keydown', handleInput);
            document.removeEventListener('keyup', toggleRanged);
        }
    } else {
        state.player.x = newX;
        state.player.y = newY;
    }

    if (state.player.x === newX && state.player.y === newY) {
        updateMapScroll();
    }

    endTurn();
}

function endTurn() {
    if (state.gameOver) {
        console.log("endTurn skipped due to gameOver");
        return;
    }
    if (state.torchExpires > 0) {
        state.torchExpires--;
        console.log(`Torch expires in ${state.torchExpires} turns`);

        if (state.torchExpires < 1) {
            torchExpired();
        }
    }
    window.calculateStats();
    window.ui.updateStats();
    moveMonsters();
    renderIfNeeded();

}

function renderIfNeeded() {
    if (state.gameOver) {
        console.log("renderIfNeeded skipped due to gameOver");
        return;
    }
    console.log("Checking renderIfNeeded, needsRender:", window.needsRender, "typeof:", typeof window.needsRender);
    if (window.needsRender === true) { // Explicit boolean check
        console.log("Rendering at", Date.now(), "with needsRender:", window.needsRender, "typeof:", typeof window.needsRender);
        window.render();
        window.needsRender = false;
        console.log("needsRender set to false after render (window.needsRender:", window.needsRender, "typeof:", typeof window.needsRender, ")");
    } else {
        console.log("renderIfNeeded called but needsRender is", window.needsRender, "typeof:", typeof window.needsRender);
    }
}

function init() {
    state.mapDiv = document.getElementById('map');
    state.statsDiv = document.getElementById('stats');
    state.logDiv = document.getElementById('log');
    window.needsRender = true;
    console.log("needsRender set to true for init (window.needsRender:", window.needsRender, "typeof:", typeof window.needsRender, ")");
    renderIfNeeded();
    document.addEventListener('keydown', handleInput);

    document.addEventListener('keyup', toggleRanged);
    updateStats();
    
}

window.addEventListener('DOMContentLoaded', init);
window.endTurn = endTurn;