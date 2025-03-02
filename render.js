console.log("render.js loaded");

function writeToLog(message) {
    window.ui.writeToLog(message);
}

function clearLog() {
    state.ui.logEntries = [];
    if (state.ui.overlayOpen) {
        window.ui.updateLog();
    }
}

function render() {
    console.log("Rendering...", window.needsRender, "typeof:", typeof window.needsRender);
    if (!window.needsRender) return;

    const titleScreenContainer = document.getElementById('splash');

    if (!state.mapDiv) state.mapDiv = document.getElementById('map');
    if (!state.statsDiv) state.statsDiv = document.getElementById('stats');
    if (!state.logDiv) state.logDiv = document.getElementById('log');

    if (!state.gameStarted || !state.levels[state.tier]) {
        document.getElementById('splash').style.display = 'flex';
        titleScreenContainer.innerHTML = titleScreen;
        state.mapDiv.style.border = 'none';
        return;
    }

    const tier = state.tier;
    let map = state.levels[tier].map;
    const height = map.length;
    const width = map[0].length;

    if (state.lastPlayerX !== state.player.x || state.lastPlayerY !== state.player.y || state.needsInitialRender) {
        const prevDiscoveredCount = state.discoveredWalls[tier].size;
        state.visibleTiles[tier].clear();

        const minX = Math.max(0, state.player.x - state.discoveryRadius);
        const maxX = Math.min(width - 1, state.player.x + state.discoveryRadius);
        const minY = Math.max(0, state.player.y - state.discoveryRadius);
        const maxY = Math.min(height - 1, state.player.y + state.discoveryRadius);

        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                let distance = Math.sqrt(Math.pow(state.player.x - x, 2) + Math.pow(state.player.y - y, 2));
                let isInRadius = distance <= state.discoveryRadius;
                if (isInRadius && (map[y][x] === '#' || map[y][x] === '⇑' || map[y][x] === '⇓')) {
                    state.discoveredWalls[tier].add(`${x},${y}`);
                }
                if (isInRadius && (map[y][x] === ' ')) {
                    state.discoveredFloors[tier] = state.discoveredFloors[tier] || new Set();
                    state.discoveredFloors[tier].add(`${x},${y}`);
                }
                if (isInRadius) state.visibleTiles[tier].add(`${x},${y}`);
            }
        }

        const newDiscoveredCount = state.discoveredWalls[tier].size;
        state.discoveredTileCount[tier] += newDiscoveredCount - prevDiscoveredCount;
        if (state.discoveredTileCount[tier] >= 1000) {
            state.discoveredTileCount[tier] = 0;
            const exploreXP = 25;
            writeToLog("Explored 1000 tiles!");
            awardXp(exploreXP);
        }
    }

    const tileMap = state.tileMap[tier];
    let mapDisplay = '';
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let isInRadius = state.visibleTiles[tier].has(`${x},${y}`);
            let isDiscovered = state.discoveredWalls[tier].has(`${x},${y}`);
            let isFloor = state.discoveredFloors[tier].has(`${x},${y}`);
            let monster = state.monsters[tier].find(m => m.x === x && m.y === y && m.hp > 0);
            let treasure = state.treasures[tier].find(t => t.x === x && t.y === y);
            let fountain = state.fountains[tier].find(f => f.x === x && f.y === y && !f.used);

            let char = map[y][x];
            let className = 'undiscovered';

            if (x === state.player.x && y === state.player.y) {
                char = '𓀠';
                className = 'player';
                if (state.player.torchLit) {
                    className += ' torch';
                }
                if (state.player.lampLit) {
                    className += ' lamp';
                    state.discoveryRadius = 6;
                }
            } else if (state.projectile && x === state.projectile.x && y === state.projectile.y) {
                char = '*';
                className = 'discovered';
            } else if (monster && (isInRadius || monster.isAgro)) {
                char = monster.avatar;
                className = 'discovered monster ' + monster.classes;
                if (monster.isElite) className += ' elite';
                if (monster.isBoss) className += ' boss';
                monster.affixes.forEach(affix => className += ` ${affix}`);
            } else if (treasure && (isInRadius || treasure.discovered)) {
                treasure.discovered = true;
                char = '$';
                className = 'discovered treasure';
            } else if (fountain && (isInRadius || fountain.discovered)) {
                fountain.discovered = true;
                char = '≅';
                className = 'discovered fountain';
            } else if (isDiscovered || isInRadius) {
                className = 'discovered';
            } else if (map[y][x] === ' ' && isFloor) {
                className = 'discovered floor';
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
    state.mapDiv.style.border = 'none';

    if (state.needsInitialRender) {
        setInitialScroll();

    }

    state.lastPlayerX = state.player.x;
    state.lastPlayerY = state.player.y;
    state.lastProjectileX = state.projectile ? state.projectile.x : null;
    state.lastProjectileY = state.projectile ? state.projectile.y : null;
    state.needsInitialRender = false;
    window.needsRender = false;
    console.log("needsRender after render:", window.needsRender, "typeof:", typeof window.needsRender);
}

let animationFrame = null;

function updateMapScroll() {
    const map = document.getElementById('map');
    const player = document.querySelector('.player');
    if (!player || !map) {
        console.log("Scroll update failed: Player or map not found");
        return;
    }

    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
    }

    const spanWidth = 16;
    const spanHeight = 16;
    const playerX = player.offsetLeft;
    const playerY = player.offsetTop;
    const viewportWidth = map.clientWidth;
    const viewportHeight = map.clientHeight;
    const currentScrollX = map.scrollLeft;
    const currentScrollY = map.scrollTop;

    const paddingX = viewportWidth * 0.15;
    const paddingY = viewportHeight * 0.15;

    const playerViewportX = playerX - currentScrollX;
    const playerViewportY = playerY - currentScrollY;

    let targetScrollX = currentScrollX;
    let targetScrollY = currentScrollY;

    if (playerViewportX < paddingX) {
        targetScrollX = playerX - paddingX;
    } else if (playerViewportX + spanWidth > viewportWidth - paddingX) {
        targetScrollX = playerX + spanWidth - (viewportWidth - paddingX);
    }

    if (playerViewportY < paddingY) {
        targetScrollY = playerY - paddingY;
    } else if (playerViewportY + spanHeight > viewportHeight - paddingY) {
        targetScrollY = playerY + spanHeight - (viewportHeight - paddingY);
    }

    targetScrollX = Math.max(0, Math.min(targetScrollX, map.scrollWidth - viewportWidth));
    targetScrollY = Math.max(0, Math.min(targetScrollY, map.scrollHeight - viewportHeight));

    const scrollThreshold = 4;
    if (Math.abs(targetScrollX - currentScrollX) < scrollThreshold && Math.abs(targetScrollY - currentScrollY) < scrollThreshold) {
        return;
    }

    const duration = 200;
    let startTime = null;
    const easeInOutQuad = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    function animateScroll(timestamp) {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeInOutQuad(progress);

        const currentX = currentScrollX + (targetScrollX - currentScrollX) * easedProgress;
        const currentY = currentScrollY + (targetScrollY - currentScrollY) * easedProgress;

        map.scrollLeft = Math.max(0, Math.min(currentX, map.scrollWidth - viewportWidth));
        map.scrollTop = Math.max(0, Math.min(currentY, map.scrollHeight - viewportHeight));

        if (progress < 1) {
            animationFrame = requestAnimationFrame(animateScroll);
        } else {
            animationFrame = null;
            console.log(`Scroll adjusted to (${map.scrollLeft}, ${map.scrollTop}) for player at (${playerX}, ${playerY})`);
        }
    }

    animationFrame = requestAnimationFrame(animateScroll);
}

function setInitialScroll() {
    const map = document.getElementById('map');
    const player = document.querySelector('.player');
    if (!player || !map) {
        console.log("Initial scroll failed: Player or map not found");
        return;
    }

    const spanWidth = 16;
    const spanHeight = 16;
    const playerX = player.offsetLeft;
    const playerY = player.offsetTop;
    const mapWidth = map.clientWidth;
    const mapHeight = map.clientHeight;

    const scrollX = playerX - (mapWidth / 2) + (spanWidth / 2);
    const scrollY = playerY - (mapHeight / 2) + (spanHeight / 2);

    map.scrollLeft = Math.max(0, Math.min(scrollX, map.scrollWidth - mapWidth));
    map.scrollTop = Math.max(0, Math.min(scrollY, map.scrollHeight - mapHeight));

    console.log(`Initial scroll set to (${map.scrollLeft}, ${map.scrollTop}) for player at (${playerX}, ${playerY})`);
}

function gameOver(message) {
    console.log("gameOver called with message:", message);
    const existingGameOver = document.getElementById('game-over');
    if (existingGameOver) existingGameOver.remove();

    const gameOver = document.createElement('div');
    gameOver.id = 'game-over';
    const headline = state.isVictory ? '<h1>VICTORY!</h1>' : '<h1>GAME OVER</h1>';
    gameOver.innerHTML = headline + '<p>' + message + '</p>';
    document.getElementById('map').appendChild(gameOver);

    const mapElement = document.getElementById('map');
    const mapWidth = mapElement.clientWidth;
    const mapHeight = mapElement.clientHeight;
    const scrollLeft = mapElement.scrollLeft;
    const scrollTop = mapElement.scrollTop;
    const centerX = scrollLeft + (mapWidth / 2);
    const centerY = scrollTop + (mapHeight / 2);

    gameOver.style.left = `${centerX - (gameOver.offsetWidth / 2)}px`;
    gameOver.style.top = `${centerY - (gameOver.offsetHeight / 2)}px`;

    gameOver.classList.add(state.isVictory ? 'victory' : 'death');

    const restartButton = document.createElement('button');
    restartButton.id = 'restart-button';
    restartButton.textContent = 'Play Again?';
    restartButton.onclick = () => {
        console.log('Restart Clicked');
        location.reload(true);
    };
    gameOver.appendChild(restartButton);
}

window.render = render;
window.setInitialScroll = setInitialScroll;
window.updateMapScroll = updateMapScroll;
window.gameOver = gameOver;
window.writeToLog = writeToLog;
window.clearLog = clearLog;