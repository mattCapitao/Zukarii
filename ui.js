console.log("ui.js loaded");

const tooltipCache = new Map();

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
    if (!item || item.itemTier === "Empty") return;

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
    let emptyItemName = item.equippedSlot === "mainhand" ? "Main Hand" : item.equippedSlot === "offhand" ? "Off Hand" : item.equippedSlot.charAt(0).toUpperCase() + item.equippedSlot.slice(1);
    state.player.inventory.equipped[item.equippedSlot] = {
        name: emptyItemName,
        itemTier: "Empty",
        type: item.equippedSlot,
        slot: item.equippedSlot,
        uniqueId: generateUniqueId(),
        icon: `no-${item.equippedSlot}.svg`,
    };

    if (state.ui.overlayOpen) {
        renderOverlay();
    }
}

function equipItem(item) {
    hideItemTooltip(item);

    if (item.levelRequirement && state.player.level < item.levelRequirement) {
        writeToLog(`You need to be level ${item.levelRequirement} to equip ${item.name}!`);
        return;
    }

    const currentTab = state.ui.activeTab;
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

    switch (item.type) {
        case "weapon":
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

            const oldWeapon = state.player.inventory.equipped[equippedSlot];
            console.log(`Old item in ${equippedSlot}:`, oldWeapon);
            if (oldWeapon && oldWeapon.itemTier !== "Empty") {
                state.player.inventory.items.push({ ...oldWeapon });
                writeToLog(`Unequipped ${oldWeapon.name} to inventory`);
            } else {
                console.log(`No old item in ${equippedSlot}, skipping push`);
            }

            state.player.inventory.equipped[equippedSlot] = { ...item };
            console.log("After equip, equipped state:", JSON.stringify(state.player.inventory.equipped));
            writeToLog(`Equipped ${item.name} to ${equippedSlot}`);
            break;

        case "armor":
            const oldArmor = state.player.inventory.equipped.armor;
            if (oldArmor && oldArmor.itemTier !== "Empty") {
                state.player.inventory.items.push({ ...oldArmor });
                writeToLog(`Unequipped ${oldArmor.name} to inventory`);
            }
            state.player.inventory.equipped.armor = { ...item };
            item.equippedSlot = "armor";
            writeToLog(`Equipped ${item.name}`);
            break;

        case "amulet":
            item.equippedSlot = "amulet";
            const oldAmulet = state.player.inventory.equipped.amulet;
            if (oldAmulet && oldAmulet.itemTier !== "Empty") {
                state.player.inventory.items.push({ ...oldAmulet });
                writeToLog(`Unequipped ${oldAmulet.name} to inventory`);
            }
            state.player.inventory.equipped.amulet = { ...item };
            writeToLog(`Equipped ${item.name}`);
            break;

        case "ring":
            item.equippedSlot = (state.player.inventory.equipped.leftring.name === "None" ? "leftring" : "rightring");
            const oldRing = state.player.inventory.equipped[item.equippedSlot];
            if (oldRing && oldRing.itemTier !== "Empty") {
                state.player.inventory.items.push({ ...oldRing });
                writeToLog(`Unequipped ${oldRing.name} to inventory`);
            }
            state.player.inventory.equipped[item.equippedSlot] = { ...item };
            writeToLog(`Equipped ${item.name}`);
            break;

        default:
            console.error(`Unknown item type: ${item.type}`);
            writeToLog(`Error: Unknown item type ${item.type}!`);
            return;
    }

    state.ui.activeTab = currentTab;
    if (state.ui.overlayOpen) {
        renderOverlay();
    }
}

function dropItem(index) {
    const item = state.player.inventory.items[index];
    writeToLog(`Dropped ${item.name}`);
    state.player.inventory.items.splice(index, 1);
    if (state.ui.overlayOpen) {
        renderOverlay();
    }
}

function addItemListeners() {
    console.log("Adding tooltip listeners...");
    const equipItems = document.querySelectorAll('#equipped-items .item:not([data-listener-added])');
    console.log(`Found ${equipItems.length} new equipped items`);
    equipItems.forEach(p => {
        const itemDataStr = p.dataset.item;
        if (itemDataStr) {
            try {
                const decodedItemDataStr = decodeURIComponent(itemDataStr);
                console.log("Decoded JSON string:", decodedItemDataStr);
                const itemData = JSON.parse(decodedItemDataStr);
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
                console.log("Problematic JSON string:", itemDataStr);
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
                const decodedItemDataStr = decodeURIComponent(itemDataStr);
                console.log("Decoded JSON string:", decodedItemDataStr);
                const itemData = JSON.parse(decodedItemDataStr);
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
                console.log("Problematic JSON string:", itemDataStr);
            }
        } else {
            console.warn("No data-item attribute on inventory item", p);
        }
    });
}

function renderOverlay() {
    const tabsDiv = document.getElementById('tabs');
    if (!state.ui.overlayOpen) {
        if (tabsDiv) {
            tabsDiv.style.display = 'none';
            tabsDiv.classList.add('hidden');
        }
        return;
    }

    if (tabsDiv) {
        tabsDiv.style.display = 'block';
        tabsDiv.classList.remove('hidden');
    }

    const statsDiv = document.getElementById('stats');
    const logDiv = document.getElementById('log');
    const equip = state.player.inventory.equipped;

    if (statsDiv) {
        statsDiv.innerHTML = `
            <div id="player-name">Player: ${state.player.name}</div>
            <div class="col-50-wrapper">
                <div class="col-50">Player Level: ${state.player.level}</div>
                <div class="col-50">Dungeon Tier: ${state.tier}</div>
            </div>`;
    }

    if (logDiv) {
        logDiv.innerHTML = `
            <div id="tab-menu">
                <button id="log-tab" style="flex: 1; background: ${state.ui.activeTab === 'log' ? '#0f0' : '#000'}; color: ${state.ui.activeTab === 'log' ? '#000' : '#0f0'};">Log</button>
                <button id="character-tab" style="flex: 1; background: ${state.ui.activeTab === 'character' ? '#0f0' : '#000'}; color: ${state.ui.activeTab === 'character' ? '#000' : '#0f0'};">Character</button>
                <button id="inventory-tab" style="flex: 1; background: ${state.ui.activeTab === 'inventory' ? '#0f0' : '#000'}; color: ${state.ui.activeTab === 'inventory' ? '#000' : '#0f0'};">Inventory</button>
            </div>

            <div id="log-content" class="ui-tab" style="display: ${state.ui.activeTab === 'log' ? 'block' : 'none'}; overflow-y: auto;">
                <div>Adventure Log</div>
                ${state.ui.logEntries.length ? state.ui.logEntries.slice(0, state.ui.maxLogEntries).map(line => `<p>${line}</p>`).join('') : '<p>Nothing to log yet.</p>'}
            </div>

            <div id="inventory-content" class="ui-tab" style="display: ${state.ui.activeTab === 'inventory' ? 'block' : 'none'}; overflow-y: auto;">
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
                            <p><button onclick="window.ui.dropItem(${index})">Drop</button></p>
                        </div>
                    </div>`).join('') : '<p>Inventory empty.</p>'}
            </div>

            <div id="character-content" class="ui-tab" style="display: ${state.ui.activeTab === 'character' ? 'block' : 'none'}; overflow-y: auto;">
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

        const logTab = document.getElementById('log-tab');
        const inventoryTab = document.getElementById('inventory-tab');
        const characterTab = document.getElementById('character-tab');
        if (logTab && inventoryTab && characterTab) {
            logTab.addEventListener('click', () => {
                console.log("Switching to Log tab");
                state.ui.activeTab = 'log';
                renderOverlay();
            });
            inventoryTab.addEventListener('click', () => {
                console.log("Switching to Inventory tab");
                state.ui.activeTab = 'inventory';
                renderOverlay();
            });
            characterTab.addEventListener('click', () => {
                console.log("Switching to Character tab");
                state.ui.activeTab = 'character';
                renderOverlay();
            });
        }

        // Add item listeners only if not already added
        if (!document.querySelector('#tabs [data-listener-added]')) {
            addItemListeners();
        }
    }
}

// Namespace exports
window.ui = {
    dropItem,
    equipItem,
    renderOverlay,
    showItemTooltip,
    hideItemTooltip,
    addItemListeners
};