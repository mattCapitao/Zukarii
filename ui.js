console.log("ui.js loaded");

function render() {
    if (!state.mapDiv) state.mapDiv = document.getElementById('map');
    if (!state.statsDiv) state.statsDiv = document.getElementById('stats');
    if (!state.logDiv) state.logDiv = document.getElementById('log');

    if (!state.gameStarted || !state.levels[state.currentLevel - 1]) {
        state.mapDiv.innerHTML = titleScreen;
        state.mapDiv.style.borderRight = 'none';
        if (state.statsDiv) state.statsDiv.textContent = '';
        if (state.logDiv) state.logDiv.innerHTML = '';
        return;
    }

    const tier = state.currentLevel - 1;
    let map = state.levels[tier].map;

    if (state.lastPlayerX !== state.player.x || state.lastPlayerY !== state.player.y || state.needsInitialRender) {
        const prevDiscoveredCount = state.discoveredWalls[tier].size;
        state.visibleTiles[tier].clear();

        const minX = Math.max(0, state.player.x - state.discoveryRadius);
        const maxX = Math.min(state.WIDTH - 1, state.player.x + state.discoveryRadius);
        const minY = Math.max(0, state.player.y - state.discoveryRadius);
        const maxY = Math.min(state.HEIGHT - 1, state.player.y + state.discoveryRadius);

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
    for (let y = 0; y < state.HEIGHT; y++) {
        for (let x = 0; x < state.WIDTH; x++) {
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
    equip = state.player.inventory.equipped;

    if (state.statsDiv) {
        state.statsDiv.innerHTML = `
            <div style="font-size: 22px; font-weight: bold;text-align:center; border-bottom:1px dashed #090;">
             Player: ${state.player.name}
            </div>

            <div style="display: flex; justify-content: space-between; font-size: 18px; margin-top:10px;font-weight: bold; border-bottom:1px dashed #090;">
                <div style="width: 50%;">Player Level: ${state.player.level}</div>
                <div style="width: 50%;">Dungeon Tier: ${state.currentLevel}</div>
            </div>

            <div style="font-size: 18px; font-weight: bold;text-align:center;bold;margin-top:10px;border-bottom:1px dashed #090;">Vital Stats</div>
            <div style="display: flex; justify-content: space-between; margin-top:5px;">
                <div style="width: 50%;">
                    <div>Prowess: ${state.player.prowess}</div>
                    <div>Intellect: ${state.player.intellect}</div>
                    <div>Agility: ${state.player.agility}</div>
                    <div>Armor: ${state.player.armor}</div>
                    <div>Defense: ${state.player.defense}</div>
                </div><div style="width: 50%;">
                     <div>HP: ${state.player.hp}/${state.player.maxHp}</div>
                     <div>Mana: ${state.player.mana}/${state.player.maxMana}</div>
                    <div>XP: ${state.player.xp}/${state.player.nextLevelXp}</div>
                    <div>Gold: ${state.player.gold}</div>
                    <div>Torches: ${state.player.torches}</div>
                </div>
              </div> 

              <div style="font-size: 18px; font-weight: bold;text-align:center;bold;margin-top:10px;border-bottom:1px dashed #090;">
              Equipped Items
              </div>
              <div style="display: flex; justify-content: space-between; margin-top:5px; ">
                 <div style="width: 50%;">
                    <div>Armor: ${equip.armor.name}</div>
                    <div>Mainhand: ${equip.mainhand.name}</div>
                    <div>Offhand: ${equip.offhand.name}</div>
                 </div><div style="width: 50%;">
                    <div>Amulet: ${equip.amulet.name}</div>
                    <div>Right Ring: ${equip.rightring.name}</div>
                    <div>Left Ring: ${equip.leftring.name}</div>
                 </div>
              </div>
        `;
    }

    if (state.logDiv) {
        state.logDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <button id="log-tab" style="flex: 1; background: ${state.currentTab === 'log' ? '#0f0' : '#000'}; color: ${state.currentTab === 'log' ? '#000' : '#0f0'}; border: none; padding: 5px;">Adventure Log</button>
                <button id="inventory-tab" style="flex: 1; background: ${state.currentTab === 'inventory' ? '#0f0' : '#000'}; color: ${state.currentTab === 'inventory' ? '#000' : '#0f0'}; border: 1px solid #0f0; padding: 5px;">Inventory</button>
            </div>
            <div id="log-content" style="font-size: 16px; height: calc(60% - 30px); padding: 10px; border: 1px solid #0f0; overflow-y: auto; ${state.currentTab === 'log' ? 'display: block' : 'display: none'}">
                <div style="font-size: 18px; font-weight: bold;">Adventure Log</div>
                <hr style="border: 1px solid #0f0; margin: 5px 0;">
                ${adventureLog.entries.length ? adventureLog.entries.map(line => `<p>${line}</p>`).join('') : '<p>Nothing to log yet.</p>'}
            </div>
            <div id="inventory-content" style="display: ${state.currentTab === 'inventory' ? 'block' : 'none'}; font-size: 16px; height: calc(60% - 30px); padding: 10px; border: 1px solid #0f0; overflow-y: auto;">
                <div style="font-size: 18px; font-weight: bold;">Inventory</div>
                <hr style="border: 1px solid #0f0; margin: 5px 0;">
                ${state.player.inventory.items.length ? state.player.inventory.items.map((item, index) => `
                    <p>${item.name} (${item.itemTier}) - ${item.description}
                        <button onclick="equipItem(${index})">Equip</button>
                        <button onclick="dropItem(${index})">Drop</button>
                    </p>`).join('') : '<p>Inventory empty.</p>'}
            </div>
        `;

        // Re-attach tab listeners after render
        const logTab = document.getElementById('log-tab');
        const inventoryTab = document.getElementById('inventory-tab');
        if (logTab && inventoryTab) {
            logTab.addEventListener('click', () => {
                state.currentTab = 'log';
                render();
            });
            inventoryTab.addEventListener('click', () => {
                state.currentTab = 'inventory';
                render();
            });
        }
    }

    state.lastPlayerX = state.player.x;
    state.lastPlayerY = state.player.y;
    state.lastProjectileX = state.projectile ? state.projectile.x : null;
    state.lastProjectileY = state.projectile ? state.projectile.y : null;

    if (state.needsInitialRender) {
        setInitialScroll();
    }

    state.needsInitialRender = false;
    needsRender = false;
}


window.equipItem = function (index) {
    const item = state.player.inventory.items[index];
    if (item.levelRequirement && state.player.level < item.levelRequirement) {
        writeToLog(`You need to be level ${item.levelRequirement} to equip ${item.name}!`);
        return;
    }

    const currentTab = state.currentTab; // Save current tab

    if (item.type === "weapon") {
        const slots = ["mainhand", "offhand"];
        let equippedSlot = null;

        // Prefer slot based on attack type (melee prefers mainhand, ranged prefers offhand)
        if (item.attackType === "melee") {
            equippedSlot = slots.find(slot => state.player.inventory.equipped[slot]?.attackType === "melee") || "mainhand";
        } else if (item.attackType === "ranged") {
            equippedSlot = slots.find(slot => state.player.inventory.equipped[slot]?.attackType === "ranged") || "offhand";
        } else {
            equippedSlot = "mainhand"; // Default to mainhand for unknown types
        }

        // Save the old item to inventory if it exists
        const oldItem = state.player.inventory.equipped[equippedSlot];
        if (oldItem && oldItem.name !== "None") {
            state.player.inventory.items.push(oldItem);
            writeToLog(`Unequipped ${oldItem.name} to inventory`);
        }

        // Equip the new item
        state.player.inventory.equipped[equippedSlot] = item;
        writeToLog(`Equipped ${item.name} to ${equippedSlot}`);
    } else if (item.type === "armor") {
        // Save the old armor to inventory if it exists
        const oldItem = state.player.inventory.equipped.armor;
        if (oldItem && oldItem.name !== "None") {
            state.player.inventory.items.push(oldItem);
            writeToLog(`Unequipped ${oldItem.name} to inventory`);
        }

        // Equip the new armor
        state.player.inventory.equipped.armor = item;
        writeToLog(`Equipped ${item.name}`);
    }

    // Remove the equipped item from inventory
    state.player.inventory.items.splice(index, 1);

    // Preserve tab state
    state.currentTab = currentTab; // Restore saved tab
    render(); // Re-render with the correct tab
};

window.dropItem = function (index) {
    const item = state.player.inventory.items[index];
    writeToLog(`Dropped ${item.name}`);
    state.player.inventory.items.splice(index, 1);
    render();
};

const adventureLog = {
    entries: [],
    maxEntries: 20
};

function writeToLog(message) {
    adventureLog.entries.unshift(message); // Add to the top
    if (adventureLog.entries.length > adventureLog.maxEntries) {
        adventureLog.entries.pop(); // Remove from the bottom
    }
}

function clearLog() {
    adventureLog.entries = [];
}

function gameOver(message) {
    const existingGameOver = document.getElementById('game-over');
    if (existingGameOver) existingGameOver.remove();

    const gameOver = document.createElement('div');
    gameOver.id = 'game-over';
    const headline = state.isVictory ? '<h1>VICTORY!</h1>' : '<h1>GAME OVER</h1>';
    gameOver.innerHTML = headline+'<p>'+message+'</p>';
    document.getElementById('map').appendChild(gameOver);

    mapElement = document.getElementById('map');

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


function setInitialScroll() {
    const map = document.getElementById('map');
    const player = document.querySelector('.player'); // Consistent with render()
    if (!player || !map) {
        console.log("Initial scroll failed: Player or map not found");
        return;
    }

    const spanWidth = 16;  // Matches CSS span width
    const spanHeight = 16; // Matches CSS span height
    const playerX = player.offsetLeft;  // Player's pixel position in map
    const playerY = player.offsetTop;
    const mapWidth = map.clientWidth;   // Visible width
    const mapHeight = map.clientHeight; // Visible height

    // Center player in viewport
    const scrollX = playerX - (mapWidth / 2) + (spanWidth / 2);
    const scrollY = playerY - (mapHeight / 2) + (spanHeight / 2);

    // Apply scroll, ensuring it stays within map bounds
    map.scrollLeft = Math.max(0, Math.min(scrollX, map.scrollWidth - mapWidth));
    map.scrollTop = Math.max(0, Math.min(scrollY, map.scrollHeight - mapHeight));

    console.log(`Initial scroll set to (${map.scrollLeft}, ${map.scrollTop}) for player at (${playerX}, ${playerY})`);
}

let animationFrame = null;

// Replace this in ui.js
function updateMapScroll() {
    const map = document.getElementById('map');
    const player = document.querySelector('.player');
    if (!player || !map) {
        console.log("Scroll update failed: Player or map not found");
        return;
    }

    if (animationFrame) {
        cancelAnimationFrame(animationFrame); // Cancel any ongoing animation
    }

    const spanWidth = 16;
    const spanHeight = 16;
    const playerX = player.offsetLeft;  // Player's pixel position in map
    const playerY = player.offsetTop;
    const mapWidth = map.clientWidth;   // Visible width
    const mapHeight = map.clientHeight; // Visible height
    const currentScrollX = map.scrollLeft;
    const currentScrollY = map.scrollTop;

    // Define padding as 25% of viewport dimensions (adjustable)
    const paddingX = mapWidth * 0.15; // 25% of width from each edge
    const paddingY = mapHeight * 0.15; // 25% of height from each edge

    // Calculate player's position relative to the viewport
    const playerViewportX = playerX - currentScrollX;
    const playerViewportY = playerY - currentScrollY;

    // Target scroll positions (only adjust if near edge)
    let targetScrollX = currentScrollX;
    let targetScrollY = currentScrollY;

    // Check horizontal edges
    if (playerViewportX < paddingX) {
        targetScrollX = playerX - paddingX; // Scroll left to keep player in padding zone
    } else if (playerViewportX > mapWidth - paddingX) {
        targetScrollX = playerX - (mapWidth - paddingX); // Scroll right
    }

    // Check vertical edges
    if (playerViewportY < paddingY) {
        targetScrollY = playerY - paddingY; // Scroll up
    } else if (playerViewportY > mapHeight - paddingY) {
        targetScrollY = playerY - (mapHeight - paddingY); // Scroll down
    }

    // Clamp target scroll positions to map bounds
    targetScrollX = Math.max(0, Math.min(targetScrollX, map.scrollWidth - mapWidth));
    targetScrollY = Math.max(0, Math.min(targetScrollY, map.scrollHeight - mapHeight));

    // If no scrolling needed, exit early
    const scrollThreshold = 4; // Small threshold to avoid jitter
    if (Math.abs(targetScrollX - currentScrollX) < scrollThreshold && Math.abs(targetScrollY - currentScrollY) < scrollThreshold) {
        return;
    }

    const duration = 200; // Keep it snappy
    let startTime = null;
    const easeInOutQuad = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    function animateScroll(timestamp) {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeInOutQuad(progress);

        const currentX = currentScrollX + (targetScrollX - currentScrollX) * easedProgress;
        const currentY = currentScrollY + (targetScrollY - currentScrollY) * easedProgress;

        map.scrollLeft = Math.max(0, Math.min(currentX, map.scrollWidth - mapWidth));
        map.scrollTop = Math.max(0, Math.min(currentY, map.scrollHeight - mapHeight));

        if (progress < 1) {
            animationFrame = requestAnimationFrame(animateScroll);
        } else {
            animationFrame = null;
            console.log(`Scroll adjusted to (${map.scrollLeft}, ${map.scrollTop}) for player at (${playerX}, ${playerY})`);
        }
    }

    animationFrame = requestAnimationFrame(animateScroll);
}


window.gameOver = gameOver;
window.setInitialScroll = setInitialScroll;
window.updateMapScroll = updateMapScroll;
window.writeToLog = writeToLog;
window.clearLog = clearLog;


