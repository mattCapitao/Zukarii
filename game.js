let lastRenderTime = 0;
const renderThrottle = 16;
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
    if (now - lastRenderTime < renderThrottle) return;
    lastRenderTime = now;

    let map = state.levels[state.currentLevel - 1].map;
    let newX = state.player.x;
    let newY = state.player.y;

    if (state.isRangedMode) {
        rangedAttack(event.key);
        return;
    }

    switch (event.key) {
        case 'ArrowUp': newY--; break;
        case 'ArrowDown': newY++; break;
        case 'ArrowLeft': newX--; break;
        case 'ArrowRight': newX++; break;
        default: return;
    }

    if (map[newY][newX] === '#') return;

    let monster = state.monsters[state.currentLevel - 1].find(m => m.x === newX && m.y === newY && m.hp > 0);
    let fountain = state.fountains[state.currentLevel - 1].find(f => f.x === newX && f.y === newY && !f.used);
    let treasureIndex = state.treasures[state.currentLevel - 1].findIndex(t => t.x === newX && t.y === newY);

    needsRender = true;

    if (monster) {
        if (typeof meleeCombat === 'function') {
            meleeCombat(monster);
            checkLevelUp();
        } else {
            console.error("meleeCombat is not defined. Check script loading order.");
        }
    } else if (map[newY][newX] === '>' && state.currentLevel < Number.MAX_SAFE_INTEGER) {
        state.currentLevel++;
        if (state.currentLevel > state.highestTier) {
            state.highestTier = state.currentLevel;
            state.player.xp += 5 * state.currentLevel;
            state.combatLog.push(`New tier reached! +${5 * state.currentLevel} XP`);
            checkLevelUp();
        }
        addLevel(state.currentLevel - 1);
        map = state.levels[state.currentLevel - 1].map;
    } else if (map[newY][newX] === '<') {
        if (state.currentLevel === 1) {
            state.combatLog.push("You exited the dungeon!");
            document.removeEventListener('keydown', handleInput);
            document.removeEventListener('keydown', toggleRanged);
            document.removeEventListener('keyup', toggleRanged);
        } else {
            state.currentLevel--;
            const downStair = state.stairsDown[state.currentLevel];
            state.player.x = downStair.x + 1;
            state.player.y = downStair.y;
            map = state.levels[state.currentLevel - 1].map;
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
                        break;
                    }
                }
            }
        }
    } else if (map[newY][newX] === 'H' && fountain) {
        if (typeof useFountain === 'function') {
            useFountain(fountain, state.currentLevel - 1);
            state.player.x = newX;
            state.player.y = newY;
        } else {
            console.error("useFountain is not defined. Check script loading order.");
        }
    } else if (map[newY][newX] === '$' && treasureIndex !== -1) {
        let goldGain = 10 + Math.floor(Math.random() * 41) + state.currentLevel * 10;
        state.player.gold += goldGain;
        state.treasures[state.currentLevel - 1].splice(treasureIndex, 1);
        map[newY][newX] = ' ';
        state.combatLog.push(`Found treasure! Gained ${goldGain} gold`);
        if (state.combatLog.length > 5) state.combatLog.shift();
        state.player.x = newX;
        state.player.y = newY;
        if (state.player.gold >= 1e12) {
            state.combatLog.push("You amassed a trillion gold! Victory!");
            document.removeEventListener('keydown', handleInput);
            document.removeEventListener('keydown', toggleRanged);
            document.removeEventListener('keyup', toggleRanged);
        }
    } else {
        state.player.x = newX;
        state.player.y = newY;
    }

    moveMonsters();
    renderIfNeeded();
}

function renderIfNeeded() {
    if (needsRender) {
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