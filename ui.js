console.log("ui.js loaded");

const tooltipCache = new Map(); // Cache tooltips by uniqueId

function showItemTooltip(itemData, event) {
    if (!itemData || !itemData.uniqueId) {
        console.log("No item data or uniqueId for tooltip", itemData);
        return;
    }

    let tooltip = tooltipCache.get(itemData.uniqueId);
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = `item-tooltip-${itemData.uniqueId}`;
        tooltip.style.position = 'absolute';
        tooltip.style.background = '#000';
        tooltip.style.border = '1px solid #0f0';
        tooltip.style.padding = '5px';
        tooltip.style.fontSize = '14px';
        tooltip.style.color = '#0f0';
        tooltip.style.zIndex = '1000';
        tooltip.style.maxWidth = '200px';
        tooltip.style.whiteSpace = 'pre-wrap';

        let content = `Name: ${itemData.name}\n`;
        content += `Tier: ${itemData.itemTier}\n`;
        content += `Description: ${itemData.description}\n`;

        if (itemData.type === "weapon") {
            content += `Damage: ${itemData.baseDamageMin}–${itemData.baseDamageMax}\n`;
        } else if (itemData.type === "armor") {
            content += `Defense: ${itemData.defense}\n`;
        }

        tooltip.textContent = content;
        document.body.appendChild(tooltip);
        tooltipCache.set(itemData.uniqueId, tooltip);
        console.log(`Created tooltip for ${itemData.name} with ID ${itemData.uniqueId}`);
    }

    tooltip.style.display = 'block';
    setTimeout(() => {
        const x = event.pageX - tooltip.offsetWidth - 15;
        const y = event.pageY - tooltip.offsetHeight - 15;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const tooltipWidth = tooltip.offsetWidth;
        const tooltipHeight = tooltip.offsetHeight;

        tooltip.style.left = `${Math.max(10, Math.min(x, viewportWidth - tooltipWidth - 10))}px`;
        tooltip.style.top = `${Math.max(10, Math.min(y, viewportHeight - tooltipHeight - 10))}px`;
        console.log(`Positioned tooltip for ${itemData.name} at (${tooltip.style.left}, ${tooltip.style.top})`);
    }, 0);
}

function hideItemTooltip(itemData) {
    if (!itemData || !itemData.uniqueId) {
        console.log("No item data or uniqueId for tooltip hide", itemData);
        return;
    }
    const tooltip = tooltipCache.get(itemData.uniqueId);
    if (tooltip) {
        tooltip.style.display = 'none';
        console.log(`Hid tooltip for ${itemData.name} with ID ${itemData.uniqueId}`);
    }
}

function unequipItem(item, event) {
    hideItemTooltip(item);

    console.log("Unequipping item ", item, " Event Data ", event, "Current state:", JSON.stringify(state.player.inventory));
    if (!item || item.name === "None") return;

    if (!item.equippedSlot) {
        const slotMap = {
            amulet: "amulet",
            armor: "armor",
            ring: ["leftring", "rightring"],
            weapon: ["mainhand", "offhand"]
        };
        for (let [slotType, slotName] of Object.entries(slotMap)) {
            if (item.type === slotType) {
                if (Array.isArray(slotName)) {
                    item.equippedSlot = slotName.find(s => state.player.inventory.equipped[s].name === item.name) || slotName[0];
                } else {
                    item.equippedSlot = slotName;
                }
                break;
            }
        }
        if (!item.equippedSlot) {
            console.error("Could not determine equippedSlot for", item);
            writeToLog(`Error: Could not unequip ${item.name}—slot not found!`);
            return;
        }
    }

    const isDuplicate = state.player.inventory.items.some(i => i.uniqueId === item.uniqueId);
    if (!isDuplicate) {
        const indexAdded = state.player.inventory.items.push({ ...item }) - 1;
        console.log(`Added ${item.name} to inventory at index ${indexAdded}, New state:`, JSON.stringify(state.player.inventory));
    } else {
        console.log(`Duplicate ${item.name} (ID: ${item.uniqueId}) prevented from adding to inventory`);
    }

    writeToLog(`Unequipped ${item.name} to inventory`);
    state.player.inventory.equipped[item.equippedSlot] = {
        name: "None",
        type: item.equippedSlot,
        slot: item.equippedSlot,
        uniqueId: generateUniqueId(),
        icon: `no-${item.equippedSlot}.svg`,
    };

    needsRender = true;
    render();
}

function equipItem(item) {
    hideItemTooltip(item);

    if (item.levelRequirement && state.player.level < item.levelRequirement) {
        writeToLog(`You need to be level ${item.levelRequirement} to equip ${item.name}!`);
        return;
    }

    const currentTab = state.currentTab;
    console.log("Equipping item:", item, "Current equipped state:", JSON.stringify(state.player.inventory.equipped));

    const indexToRemove = state.player.inventory.items.findIndex(i => i.uniqueId === item.uniqueId);
    console.log("Index to remove:", indexToRemove, "Items:", state.player.inventory.items);
    if (indexToRemove === -1) {
        console.error(`Item ${item.name} (ID: ${item.uniqueId}) not found in inventory—cannot equip!`);
        writeToLog(`Error: Couldn't equip ${item.name}—not in inventory!`);
        return;
    }
    state.player.inventory.items.splice(indexToRemove, 1);
    console.log("After splice, items:", state.player.inventory.items);

    if (item.type === "weapon") {
        const slots = ["mainhand", "offhand"];
        let equippedSlot = null;

        if (item.attackType === "melee") {
            equippedSlot = slots.find(slot => state.player.inventory.equipped[slot]?.attackType === "melee") || "mainhand";
            console.log(`Melee weapon, selected slot: ${equippedSlot}`);
        } else if (item.attackType === "ranged") {
            equippedSlot = slots.find(slot => state.player.inventory.equipped[slot]?.attackType === "ranged") || "offhand";
            console.log(`Ranged weapon, selected slot: ${equippedSlot}`);
        } else {
            equippedSlot = "mainhand";
            console.log(`Unknown attack type, defaulting to mainhand`);
        }

        if (!equippedSlot || !state.player.inventory.equipped.hasOwnProperty(equippedSlot)) {
            console.error(`Invalid slot ${equippedSlot} for ${item.name}`);
            writeToLog(`Error: Invalid slot for ${item.name}!`);
            return;
        }

        item.equippedSlot = equippedSlot;

        const oldItem = state.player.inventory.equipped[equippedSlot];
        console.log(`Old item in ${equippedSlot}:`, oldItem);
        if (oldItem && oldItem.name !== "None") {
            state.player.inventory.items.push({ ...oldItem });
            writeToLog(`Unequipped ${oldItem.name} to inventory`);
        } else {
            console.log(`No old item in ${equippedSlot}, skipping push`);
        }

        state.player.inventory.equipped[equippedSlot] = { ...item };
        console.log("After equip, equipped state:", JSON.stringify(state.player.inventory.equipped));
        writeToLog(`Equipped ${item.name} to ${equippedSlot}`);
    } else if (item.type === "armor") {
        const oldItem = state.player.inventory.equipped.armor;
        if (oldItem && oldItem.name !== "None") {
            state.player.inventory.items.push({ ...oldItem });
            writeToLog(`Unequipped ${oldItem.name} to inventory`);
        }
        state.player.inventory.equipped.armor = { ...item };
        item.equippedSlot = "armor";
        writeToLog(`Equipped ${item.name}`);
    } else if (item.type === "amulet") {
        item.equippedSlot = "amulet";
        const oldItem = state.player.inventory.equipped.amulet;
        if (oldItem && oldItem.name !== "None") {
            state.player.inventory.items.push({ ...oldItem });
            writeToLog(`Unequipped ${oldItem.name} to inventory`);
        }
        state.player.inventory.equipped.amulet = { ...item };
        writeToLog(`Equipped ${item.name}`);
    } else if (item.type === "ring") {
        item.equippedSlot = (state.player.inventory.equipped.leftring.name === "None" ? "leftring" : "rightring");
        const oldItem = state.player.inventory.equipped[item.equippedSlot];
        if (oldItem && oldItem.name !== "None") {
            state.player.inventory.items.push({ ...oldItem });
            writeToLog(`Unequipped ${oldItem.name} to inventory`);
        }
        state.player.inventory.equipped[item.equippedSlot] = { ...item };
        writeToLog(`Equipped ${item.name}`);
    }

    state.currentTab = currentTab;
    needsRender = true;
    render();
}

window.dropItem = function (index) {
    const item = state.player.inventory.items[index];
    writeToLog(`Dropped ${item.name}`);
    state.player.inventory.items.splice(index, 1);
    needsRender = true;
    render();
};

function addItemListeners() {
    console.log("Adding tooltip listeners...");
    const equipItems = document.querySelectorAll('#equipped-items .item:not([data-listener-added])');
    console.log(`Found ${equipItems.length} new equipped items`);
    equipItems.forEach(p => {
        const itemDataStr = p.dataset.item;
        if (itemDataStr) {
            try {
                const itemData = JSON.parse(itemDataStr);
                console.log(`Parsed item data for ${itemData.name} with ID ${itemData.uniqueId}`);
                if (itemData && itemData.uniqueId) {
                    p.addEventListener('mouseover', (event) => showItemTooltip(itemData, event));
                    p.addEventListener('mouseout', () => hideItemTooltip(itemData));
                    p.addEventListener('click', (event) => unequipItem(itemData, event));
                    p.setAttribute('data-listener-added', 'true');
                } else {
                    console.warn("Missing uniqueId in equipped item", itemData);
                }
            } catch (e) {
                console.error("Failed to parse item data:", e, itemDataStr);
            }
        } else {
            console.warn("No data-item attribute on equipped item", p);
        }
    });

    const inventoryItems = document.querySelectorAll('#inventory-content .item:not([data-listener-added])');
    console.log(`Found ${inventoryItems.length} new inventory items`);
    inventoryItems.forEach(p => {
        const itemDataStr = p.dataset.item;
        if (itemDataStr) {
            try {
                const itemData = JSON.parse(itemDataStr);
                console.log(`Parsed item data for ${itemData.name} with ID ${itemData.uniqueId}`);
                if (itemData && itemData.uniqueId) {
                    p.addEventListener('mouseover', (event) => showItemTooltip(itemData, event));
                    p.addEventListener('mouseout', () => hideItemTooltip(itemData));
                    p.addEventListener('click', () => {
                        console.log("Before equip:", JSON.stringify(state.player.inventory));
                        equipItem(itemData);
                        console.log("After equip:", JSON.stringify(state.player.inventory));
                    });
                    p.setAttribute('data-listener-added', 'true');
                } else {
                    console.warn("Missing uniqueId in inventory item", itemData);
                }
            } catch (e) {
                console.error("Failed to parse item data:", e, itemDataStr);
            }
        } else {
            console.warn("No data-item attribute on inventory item", p);
        }
    });
}

function render() {
    console.log("Rendering...", needsRender); // Debug render calls
    if (!needsRender) return; // Guard against recursive calls

    const titleScreenContainer = document.getElementById('splash');

    if (!state.mapDiv) state.mapDiv = document.getElementById('map');
    if (!state.statsDiv) state.statsDiv = document.getElementById('stats');
    if (!state.logDiv) state.logDiv = document.getElementById('log');

    if (!state.gameStarted || !state.levels[state.currentLevel - 1]) {
        document.getElementById('splash').style.display = 'flex';
        titleScreenContainer.innerHTML = titleScreen;
        state.mapDiv.style.border = 'none';
        if (state.statsDiv) state.statsDiv.textContent = '';
        if (state.logDiv) state.logDiv.innerHTML = '';
        return;
    }

    const tier = state.currentLevel - 1;
    let map = state.levels[tier].map;

    if (state.lastPlayerX !== state.player.x || state.lastPlayerY !== state.player.y || state.needsInitialRender) {
        document.getElementById('splash').style.display = 'none';
        titleScreenContainer.innerHTML = '';
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
    const equip = state.player.inventory.equipped;

    if (state.statsDiv) {
        state.statsDiv.innerHTML = `
            <div id="player-name">Player: ${state.player.name}</div>
            <div class="col-50-wrapper">
                <div class="col-50">Player Level: ${state.player.level}</div>
                <div class="col-50">Dungeon Tier: ${state.currentLevel}</div>
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
                needsRender = true;
                render();
            });
            inventoryTab.addEventListener('click', () => {
                console.log("Switching to Inventory tab");
                state.currentTab = 'inventory';
                needsRender = true;
                render();
            });
            characterTab.addEventListener('click', () => {
                console.log("Switching to Character tab");
                state.currentTab = 'character';
                needsRender = true;
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
    needsRender = false;
}

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

window.equipItem = equipItem;
window.gameOver = gameOver;
window.setInitialScroll = setInitialScroll;
window.updateMapScroll = updateMapScroll;
window.writeToLog = writeToLog;
window.clearLog = clearLog;