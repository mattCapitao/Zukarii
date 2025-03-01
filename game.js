console.log("game.js loaded");

let lastRenderTime = 0;
let lastInputTime = 0;
const renderThrottle = 70;
const inputThrottle = 70;

function handleInput(event) {
    if (!state.gameStarted) {
        console.log("Starting game...");
        state.gameStarted = true;
        initGame();
        window.needsRender = true;
        console.log("needsRender set to true for init (window.needsRender:", window.needsRender, "typeof:", typeof window.needsRender, ")");
        renderIfNeeded();
        return;
    }

    if (state.gameOver) {
        console.log("Game over, input ignored");
        return;
    }

    const now = Date.now();
    if (now - lastInputTime < inputThrottle) return;
    lastInputTime = now;

    if (now - lastRenderTime < renderThrottle) return;
    lastRenderTime = now;

    let map = state.levels[state.tier].map;
    let newX = state.player.x;
    let newY = state.player.y;

    // Overlay toggle logic
    const tabsDiv = document.getElementById('tabs');
    switch (event.key.toLowerCase()) {
        case 'i':
            if (!state.ui.overlayOpen) {
                state.ui.overlayOpen = true;
                state.ui.activeTab = 'inventory';
                tabsDiv.classList.remove('hidden');
                window.ui.renderOverlay();
            } else if (state.ui.activeTab.toLowerCase() === 'inventory') {
                state.ui.overlayOpen = false;
                tabsDiv.classList.add('hidden');
                window.ui.renderOverlay();
            } else {
                state.ui.activeTab = 'inventory';
                window.ui.renderOverlay();
            }
            return;
        case 'c':
            if (!state.ui.overlayOpen) {
                state.ui.overlayOpen = true;
                state.ui.activeTab = 'character';
                tabsDiv.classList.remove('hidden');
                window.ui.renderOverlay();
            } else if (state.ui.activeTab.toLowerCase() === 'character') {
                state.ui.overlayOpen = false;
                tabsDiv.classList.add('hidden');
                window.ui.renderOverlay();
            } else {
                state.ui.activeTab = 'character';
                window.ui.renderOverlay();
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
    }

    if (event.key === ' ') {
        toggleRanged(event);
        return;
    }

    if (state.isRangedMode) {
        // Map WASD to ranged attacks when in ranged mode
        switch (event.key.toLowerCase()) {
            case 'w': window.rangedAttack('ArrowUp'); break;
            case 's': window.rangedAttack('ArrowDown'); break;
            case 'a': window.rangedAttack('ArrowLeft'); break;
            case 'd': window.rangedAttack('ArrowRight'); break;
            default: return;
        }
        return; // Prevent further processing since we handled the ranged attack
    }

    switch (event.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            newY--;
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            newY++;
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            newX--;
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            newX++;
            break;
        case 't':
        case 'T':
            window.lightTorch();
            window.needsRender = true;
            console.log("needsRender set to true for torch (window.needsRender:", window.needsRender, "typeof:", typeof window.needsRender, ")");
            endTurn();
            return;
        default:
            return;
    }

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
            document.removeEventListener('keydown', toggleRanged);
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
    document.addEventListener('keydown', toggleRanged);
    document.addEventListener('keyup', toggleRanged);

    // Add click handler for #close-tabs
    const closeTabsButton = document.getElementById('close-tabs');
    if (closeTabsButton) {
        closeTabsButton.addEventListener('click', () => {
            state.ui.overlayOpen = false;
            document.getElementById('tabs').classList.add('hidden');
            window.ui.renderOverlay();
            console.log("Overlay closed via close button");
        });
    }
}

window.addEventListener('DOMContentLoaded', init);
window.endTurn = endTurn;