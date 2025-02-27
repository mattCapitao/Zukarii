console.log("game.js loaded");

let lastRenderTime = 0;
let lastInputTime = 0;
const renderThrottle = 70;
const inputThrottle = 70;
let needsRender = true;

function handleInput(event) {
    if (!state.gameStarted) {
        state.gameStarted = true;
        initGame();
        document.getElementById('info').classList.remove('hidden');
        needsRender = true;
        renderIfNeeded();
        return;
    }

    const now = Date.now();
    if (now - lastInputTime < inputThrottle) return;
    lastInputTime = now;

    if (now - lastRenderTime < renderThrottle) return;
    lastRenderTime = now;

    let map = state.levels[state.currentLevel - 1].map;
    let newX = state.player.x;
    let newY = state.player.y;

    if (event.key === ' ') {
        toggleRanged(event); 
        return;
    }

    if (state.isRangedMode) {
        rangedAttack(event.key);
        return;
    }

    switch (event.key) {
        case 'ArrowUp': newY--; break;
        case 'ArrowDown': newY++; break;
        case 'ArrowLeft': newX--; break;
        case 'ArrowRight': newX++; break;
        case 't': // Add 't' (lowercase) for torch
        case 'T': // Add 'T' (uppercase) for torch (optional, for consistency)
            window.lightTorch();
            needsRender = true;
            endTurn();
            return; // Exit after lighting torch, no movement
        default: return;
    }

    if (map[newY][newX] === '#') {
        endTurn();
        return;
    }

    let monster = state.monsters[state.currentLevel - 1].find(m => m.x === newX && m.y === newY && m.hp > 0);
    let fountain = state.fountains[state.currentLevel - 1].find(f => f.x === newX && f.y === newY && !f.used);
    let treasureIndex = state.treasures[state.currentLevel - 1].findIndex(t => t.x === newX && t.y === newY);

    needsRender = true;

    if (monster) {
        meleeCombat(monster);
        checkLevelUp();
    } else if (map[newY][newX] === '⇓' && state.currentLevel < Number.MAX_SAFE_INTEGER) {
        state.currentLevel++;
        if (state.currentLevel > state.highestTier) {
            state.highestTier = state.currentLevel;
            const newTierXP = 5 * state.currentLevel;
            writeToLog(`You Reached Tier ${ state.currentLevel}`);
            awardXp(newTierXP);
        }
        addLevel(state.currentLevel - 1);
        map = state.levels[state.currentLevel - 1].map;
        const upStair = state.stairsUp[state.currentLevel - 1];
        if (upStair) {
            state.player.x = upStair.x + 1;
            state.player.y = upStair.y;
            console.log(`Moved down to tier ${state.currentLevel}, placed at (${state.player.x}, ${state.player.y}) next to < at (${upStair.x}, ${upStair.y})`);
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
            console.error(`No stairsUp defined for tier ${state.currentLevel - 1}`);
            state.player.x = 1;
            state.player.y = 1;
        }
    } else if (map[newY][newX] === '⇑' && state.currentLevel > 1) {
        state.currentLevel--;
        const downStair = state.stairsDown[state.currentLevel - 1];
        map = state.levels[state.currentLevel - 1].map;
        if (downStair) {
            state.player.x = downStair.x + 1;
            state.player.y = downStair.y;
            console.log(`Moved up to tier ${state.currentLevel}, placed at (${state.player.x}, ${state.player.y}) next to > at (${downStair.x}, ${downStair.y})`);
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
            console.error(`No stairsDown defined for tier ${state.currentLevel - 1}`);
            state.player.x = 1;
            state.player.y = 1;
        }
    } else if (map[newY][newX] === '⇑' && state.currentLevel === 1) {

        playerExit();

    } else if (map[newY][newX] === '≅' && fountain) {
        useFountain(fountain, state.currentLevel - 1);
        state.player.x = newX;
        state.player.y = newY;

    } else if (map[newY][newX] === '$' && treasureIndex !== -1) {
        const treasure = state.treasures[state.currentLevel - 1][treasureIndex];
        const goldGain = treasure.gold || (10 + Math.floor(Math.random() * 41) + state.currentLevel * 10);
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

        state.treasures[state.currentLevel - 1].splice(treasureIndex, 1);
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

function endTurn(){
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
    if (needsRender) {
        console.log("Rendering at", Date.now());
        render();
        needsRender = false;
    }
}

function init() {
    state.mapDiv = document.getElementById('map');
    state.statsDiv = document.getElementById('stats');
    state.logDiv = document.getElementById('log');
    needsRender = true;
    renderIfNeeded();
    document.addEventListener('keydown', handleInput);
    document.addEventListener('keydown', toggleRanged);
    document.addEventListener('keyup', toggleRanged);
}

window.addEventListener('DOMContentLoaded', init);
window.endTurn = endTurn;