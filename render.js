console.log("render.js loaded");

// Removed: let needsRender = true; (we’ll use window.needsRender globally)

const adventureLog = {
    entries: [],
    maxEntries: 20
};

function writeToLog(message) {
    adventureLog.entries.unshift(message);
    if (adventureLog.entries.length > adventureLog.maxEntries) {
        adventureLog.entries.pop();
    }
}

function clearLog() {
    adventureLog.entries = [];
}

function render() {
    console.log("Rendering...", window.needsRender, "typeof:", typeof window.needsRender);
    if (!window.needsRender) return; // Use window.needsRender

    const titleScreenContainer = document.getElementById('splash');

    if (!state.mapDiv) state.mapDiv = document.getElementById('map');
    if (!state.statsDiv) state.statsDiv = document.getElementById('stats');
    if (!state.logDiv) state.logDiv = document.getElementById('log');

    if (!state.gameStarted || !state.levels[state.tier]) {
        document.getElementById('splash').style.display = 'flex';
        titleScreenContainer.innerHTML = titleScreen;
        state.mapDiv.style.border = 'none';
        if (state.statsDiv) state.statsDiv.textContent = '';
        if (state.logDiv) state.logDiv.innerHTML = '';
        return;
    }

    const tier = state.tier;
    let map = state.levels[tier].map;
    const height = map.length;
    const width = map[0].length;

    if (state.lastPlayerX !== state.player.x || state.lastPlayerY !== state.player.y || state.needsInitialRender) {
        document.getElementById('splash').style.display = 'none';
        titleScreenContainer.innerHTML = '';
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
    state.mapDiv.style.borderRight = '1px solid #0f0';
    const equip = state.player.inventory.equipped;

    if (state.statsDiv) {
        state.statsDiv.innerHTML = `
            <div id="player-name">Player: ${state.player.name}</div>
            <div class="col-50-wrapper">
                <div class="col-50">Player Level: ${state.player.level}</div>
                <div class="col-50">Dungeon Tier: ${state.tier}</div>
            </div>`;
    }

    if (state.logDiv) {
        state.logDiv.innerHTML = `
            <div id="tab-menu">
                <button id="log-tab" style="flex: 1; background: ${state.currentTab === 'log' ? '#0f0' : '#000'}; color: ${state.currentTab === 'log' ? '#000' : '#0f0'}; ">Log</button>
                <button id="character-tab" style="flex: 1; background: ${state.currentTab === 'character' ? '#0f0' : '#000'}; color: ${state.currentTab === 'character' ? '#000' : '#0f0'}; ">Character</button>
                <button id="inventory-tab" style="flex: 1; background: ${state.currentTab === 'inventory' ? '#0f0' : '#000'}; color: ${state.currentTab === 'inventory' ? '#000' : '#0f0'}; ">Inventory</button>
            </div>

            <div id="log-content" class="ui-tab" style="display: ${state.currentTab === 'log' ? 'block' : 'none'}; overflow-y: auto;">
                <div>Adventure Log</div>
                ${adventureLog.entries.length ? adventureLog.entries.map(line => `<p>${line}</p>`).join('') : '<p>Nothing to log yet.</p>'}
            </div>

            <div id="inventory-content" class="ui-tab" style="display: ${state.currentTab === 'inventory' ? 'block' : 'none'}; overflow-y: auto;">
                <div style="font-size: 18px; font-weight: bold;">Inventory</div>
                <hr style="border: 1px solid #0f0; margin: 0;">
                ${state.player.inventory.items.length ? state.player.inventory.items.map((item, index) => `
                    <div class="inventory-item" style="display: flex; justify-content: space-between; border-bottom:1px dashed #090;">
                        <div style="width: 50%;">
                            <p class="inventory-slot ${item.itemTier} ${item.type}">
                                <img src="img/icons/items/${item.icon}" alt="${item.name}" 
                                     class="item item-icon ${item.itemTier} ${item.type}" 
                                     data-item='${JSON.stringify(item)}' data-index='${index}'>
                            </p>
                        </div>
                        <div style="width: 50%;">
                            <p class="item-name">${item.name}<br />(${item.itemTier} ${item.type})</p>
                            <p><button onclick="dropItem(${index})">Drop</button></p>
                        </div>
                    </div>`).join('') : '<p>Inventory empty.</p>'}
            </div>

            <div id="character-content" class="ui-tab" style="display: ${state.currentTab === 'character' ? 'block' : 'none'}; overflow-y: auto;">
                <div style="font-size: 18px; font-weight: bold; text-align: center; margin-top: 10px; border-bottom: 1px dashed #090;">Vital Stats</div>
                <div style="display: flex; justify-content: space-between; margin-top: 5px;">
                    <div style="width: 50%;">
                        <div>Prowess: ${state.player.prowess}</div>
                        <div>Intellect: ${state.player.intellect}</div>
                        <div>Agility: ${state.player.agility}</div>
                        <div>Armor: ${state.player.armor}</div>
                        <div>Defense: ${state.player.defense}</div>
                    </div>
                    <div style="width: 50%;">
                        <div>HP: ${state.player.hp}/${state.player.maxHp}</div>
                        <div>Mana: ${state.player.mana}/${state.player.maxMana}</div>
                        <div>XP: ${state.player.xp}/${state.player.nextLevelXp}</div>
                        <div>Gold: ${state.player.gold}</div>
                        <div>Torches: ${state.player.torches}</div>
                    </div>
                </div>

                <div style="font-size: 18px; font-weight: bold; text-align: center; margin-top: 10px; border-bottom: 1px dashed #090;">Equipped Items</div>
                <div id="equipped-items">
                    <div style="width: 30%;">
                        <p class="equip-slot mainhand">
                            Mainhand:
                            <img src="img/icons/items/${equip.mainhand.icon}" alt="${equip.mainhand.name}" 
                                 class="item item-icon ${equip.mainhand.itemTier} ${equip.mainhand.type}" 
                                 data-item='${JSON.stringify(equip.mainhand)}'>
                        </p>
                        <p class="equip-slot rightring">
                            Right Ring:
                            <img src="img/icons/items/${equip.rightring.icon}" alt="${equip.rightring.name}" 
                                 class="item item-icon ${equip.rightring.itemTier} ${equip.rightring.type}" 
                                 data-item='${JSON.stringify(equip.rightring)}'>
                        </p>
                    </div>
                    <div style="width: 30%;">
                        <p class="equip-slot amulet">
                            Amulet:
                            <img src="img/icons/items/${equip.amulet.icon}" alt="${equip.amulet.name}" 
                                 class="item item-icon ${equip.amulet.itemTier} ${equip.amulet.type}" 
                                 data-item='${JSON.stringify(equip.amulet)}'>
                        </p>
                        <p class="equip-slot armor">
                            Armor:
                            <img src="img/icons/items/${equip.armor.icon}" alt="${equip.armor.name}" 
                                 class="item item-icon ${equip.armor.itemTier} ${equip.armor.type}" 
                                 data-item='${JSON.stringify(equip.armor)}'>
                        </p>
                    </div>
                    <div style="width: 30%;">
                        <p class="equip-slot offhand">
                            Offhand:
                            <img src="img/icons/items/${equip.offhand.icon}" alt="${equip.offhand.name}" 
                                 class="item item-icon ${equip.offhand.itemTier} ${equip.offhand.type}" 
                                 data-item='${JSON.stringify(equip.offhand)}'>
                        </p>
                        <p class="equip-slot leftring">
                            Left Ring:
                            <img src="img/icons/items/${equip.leftring.icon}" alt="${equip.leftring.name}" 
                                 class="item item-icon ${equip.leftring.itemTier} ${equip.leftring.type}" 
                                 data-item='${JSON.stringify(equip.leftring)}'>
                        </p>
                    </div>
                </div>
            </div>
        `;

        if (state.currentTab === 'inventory') {
            const inventoryContent = document.getElementById('inventory-content');
            if (inventoryContent) inventoryContent.innerHTML = `
                <div style="font-size: 18px; font-weight: bold;">Inventory</div>
                <hr style="border: 1px solid #0f0; margin: 0;">
                ${state.player.inventory.items.length ? state.player.inventory.items.map((item, index) => `
                    <div class="inventory-item" style="display: flex; justify-content: space-between; border-bottom:1px dashed #090;">
                        <div style="width: 50%;">
                            <p class="inventory-slot ${item.itemTier} ${item.type}">
                                <img src="img/icons/items/${item.icon}" alt="${item.name}" 
                                     class="item item-icon ${item.itemTier} ${item.type}" 
                                     data-item='${JSON.stringify(item)}' data-index='${index}'>
                            </p>
                        </div>
                        <div style="width: 50%;">
                            <p class="item-name">${item.name}<br />(${item.itemTier} ${item.type})</p>
                            <p><button onclick="dropItem(${index})">Drop</button></p>
                        </div>
                    </div>`).join('') : '<p>Inventory empty.</p>'}
            `;
        }

        const logTab = document.getElementById('log-tab');
        const inventoryTab = document.getElementById('inventory-tab');
        const characterTab = document.getElementById('character-tab');
        if (logTab && inventoryTab && characterTab) {
            logTab.addEventListener('click', () => {
                console.log("Switching to Log tab");
                state.currentTab = 'log';
                window.needsRender = true; // Use window.needsRender
                render();
            });
            inventoryTab.addEventListener('click', () => {
                console.log("Switching to Inventory tab");
                state.currentTab = 'inventory';
                window.needsRender = true; // Use window.needsRender
                render();
            });
            characterTab.addEventListener('click', () => {
                console.log("Switching to Character tab");
                state.currentTab = 'character';
                window.needsRender = true; // Use window.needsRender
                render();
            });
        }
    }

    if (!document.querySelector('.item[data-listener-added]')) {
        addItemListeners();
        document.querySelectorAll('.item').forEach(item => item.setAttribute('data-listener-added', 'true'));
    }

    state.lastPlayerX = state.player.x;
    state.lastPlayerY = state.player.y;
    state.lastProjectileX = state.projectile ? state.projectile.x : null;
    state.lastProjectileY = state.projectile ? state.projectile.y : null;

    if (state.needsInitialRender) {
        setInitialScroll();
    }

    state.needsInitialRender = false;
    window.needsRender = false; // Use window.needsRender
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