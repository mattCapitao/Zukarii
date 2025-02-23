console.log("ui.js loaded");

function render() {
    if (!state.mapDiv) state.mapDiv = document.getElementById('map');
    if (!state.statsDiv) state.statsDiv = document.getElementById('stats');
    if (!state.logDiv) state.logDiv = document.getElementById('log');

    if (!state.gameStarted || !state.levels[state.currentLevel - 1]) {
        state.mapDiv.innerHTML = titleScreen;
        if (state.statsDiv) state.statsDiv.textContent = '';
        if (state.logDiv) state.logDiv.innerHTML = '';
        return;
    }

    const tier = state.currentLevel - 1;
    let map = state.levels[tier].map;

    if (state.lastPlayerX !== state.player.x || state.lastPlayerY !== state.player.y || state.needsInitialRender) {
        const prevDiscoveredCount = state.discoveredWalls[tier].size;
        state.visibleTiles[tier].clear();

        const minX = Math.max(0, state.player.x - 8);
        const maxX = Math.min(state.WIDTH - 1, state.player.x + 8);
        const minY = Math.max(0, state.player.y - 8);
        const maxY = Math.min(state.HEIGHT - 1, state.player.y + 8);

        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                let distance = Math.sqrt(Math.pow(state.player.x - x, 2) + Math.pow(state.player.y - y, 2));
                let isInRadius = distance <= state.discoveryRadius;
                if (isInRadius && (map[y][x] === '#' || map[y][x] === '<' || map[y][x] === '>')) {
                    state.discoveredWalls[tier].add(`${x},${y}`);
                }
                if (isInRadius) state.visibleTiles[tier].add(`${x},${y}`);
            }
        }

        const newDiscoveredCount = state.discoveredWalls[tier].size;
        state.discoveredTileCount[tier] += newDiscoveredCount - prevDiscoveredCount;
        if (state.discoveredTileCount[tier] >= 1000) {
            state.player.xp += 25;
            writeToLog("Explored 1000 tiles! Gained 25 Exploration XP");
            state.discoveredTileCount[tier] = 0;
            checkLevelUp();
        }
    }

    const tileMap = state.tileMap[tier];
    let mapDisplay = '';
    for (let y = 0; y < state.HEIGHT; y++) {
        for (let x = 0; x < state.WIDTH; x++) {
            let isInRadius = state.visibleTiles[tier].has(`${x},${y}`);
            let isDiscovered = state.discoveredWalls[tier].has(`${x},${y}`);
            let monster = state.monsters[tier].find(m => m.x === x && m.y === y && m.hp > 0);
            let treasure = state.treasures[tier].find(t => t.x === x && t.y === y);
            let fountain = state.fountains[tier].find(f => f.x === x && f.y === y && !f.used);

            let char = map[y][x];
            let className = 'undiscovered';

            if (x === state.player.x && y === state.player.y) {
                char = '@';
                className = 'discovered';
            } else if (state.projectile && x === state.projectile.x && y === state.projectile.y) {
                char = '*';
                className = 'discovered';
            } else if (monster && isInRadius) {
                char = 'M';
                className = 'discovered';
            } else if (treasure && (isInRadius || treasure.discovered)) {
                treasure.discovered = true;
                char = '$';
                className = 'discovered';
            } else if (fountain && (isInRadius || fountain.discovered)) {
                fountain.discovered = true;
                char = 'H';
                className = 'discovered';
            } else if (isDiscovered || isInRadius) {
                className = 'discovered';
            }

            const current = tileMap[y][x];
            if (current.char !== char || current.class !== className) {
                mapDisplay += `<span class="${className}">${char}</span>`;
                tileMap[y][x] = { char, class: className };
            } else {
                mapDisplay += current.spanHTML || `<span class="${className}">${char}</span>`;
            }
            tileMap[y][x].spanHTML = `<span class="${className}">${char}</span>`;
        }
        mapDisplay += '\n';
    }

    state.mapDiv.innerHTML = mapDisplay;

    if (state.statsDiv) {
        state.statsDiv.innerHTML = `
            <div style="font-size: 18px; font-weight: bold;">Current Dungeon Tier: ${state.currentLevel}</div>
            <hr style="border: 1px solid #0f0; margin: 5px 0;">
            <div style="font-size: 16px; font-weight: bold;">Player Info:</div>
            <div style="display: flex; justify-content: space-between;">
                <div style="width: 50%;">
                    <div>HP: ${state.player.hp}/${state.player.maxHp}</div>
                    <div>Prowess: ${state.player.prowess}</div>
                    <div>Intellect: ${state.player.intellect}</div>
                    <div>Agility: ${state.player.agility}</div>
                </div>
                <div style="width: 50%;">
                    <div>Level: ${state.player.level}</div>
                    <div>XP: ${state.player.xp}/${state.player.nextLevelXp}</div>
                    <div>Gold: ${state.player.gold}</div>
                </div>
            </div>
        `;
    }
    if (state.logDiv) {
        state.logDiv.innerHTML = `
            <div style="font-size: 16px; font-weight: bold;">Adventure Log</div>
            <hr style="border: 1px solid #0f0; margin: 5px 0;">
            ${adventureLog.entries.length ? adventureLog.entries.map(line => `<p>${line}</p>`).join('') : '<p>Nothing to log yet.</p>'}
        `;
    }

    if (state.player.hp <= 0) {
        writeToLog('You died! Game Over.');
        document.removeEventListener('keydown', handleInput);
        document.removeEventListener('keydown', toggleRanged);
        document.removeEventListener('keyup', toggleRanged);
    }

    state.lastPlayerX = state.player.x;
    state.lastPlayerY = state.player.y;
    state.lastProjectileX = state.projectile ? state.projectile.x : null;
    state.lastProjectileY = state.projectile ? state.projectile.y : null;
    state.needsInitialRender = false;
}