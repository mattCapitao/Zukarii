console.log("ui.js loaded");

const tooltipCache = new Map();



function showItemTooltip(itemData, event) {
    if (!itemData || !itemData.uniqueId) {
        console.log("No item data or uniqueId for tooltip", itemData);
        return;
    }

    let tooltip = tooltipCache.get(itemData.uniqueId);
    if (!tooltip) {
        // Create tooltip container
        tooltip = document.createElement('div');
        tooltip.id = `item-tooltip-${itemData.uniqueId}`;
        tooltip.className = `item-tooltip-class ${itemData.itemTier}`;
        tooltip.style.position = 'absolute';
        tooltip.style.whiteSpace = 'pre-wrap';

        // Build HTML content
        const content = document.createElement('div');

        // Item Name
        const name = document.createElement('div');
        name.className = 'item-tooltip-name';
        name.textContent = itemData.name;
        content.appendChild(name);

        // Item Type and Tier
        const typeTier = document.createElement('div');
        typeTier.className = 'item-tooltip-type-tier';
        typeTier.textContent = `${itemData.itemTier} ${itemData.type}`;
        content.appendChild(typeTier);

        // Specific Stats (Weapon or Armor)
        if (itemData.type === "weapon") {
            const damage = document.createElement('div');
            damage.className = 'item-tooltip-damage';
            damage.textContent = `Damage: ${itemData.baseDamageMin}–${itemData.baseDamageMax}`;
            content.appendChild(damage);
        } else if (itemData.type === "armor") {
            const defense = document.createElement('div');
            defense.className = 'item-tooltip-defense';
            defense.textContent = `Defense: ${itemData.defense}`;
            content.appendChild(defense);
        }

        // Stats Section
        if ('stats' in itemData && itemData.stats) {
            const divider = document.createElement('hr');
            divider.className = 'tooltip-divider';
            content.appendChild(divider);

            const propCount = Object.keys(itemData.stats).length;
            if (propCount > 0) {
                const statsContainer = document.createElement('div');
                statsContainer.className = 'tooltip-stats';
                Object.entries(itemData.stats).forEach(([stat, value]) => {

                    if (stat !== 'luck' && stat !== 'maxLuck') {
                        const statLine = document.createElement('div');
                        statLine.className = 'tooltip-stat';

                        statLine.textContent = `${value > 0 ? '+' : ''}${value} : ${window.util.camelToTitleCase(stat)}`;
                        statsContainer.appendChild(statLine);
                    }
                });
                content.appendChild(statsContainer);
            }
        }

        // Description
        const descriptionDivider = document.createElement('hr');
        descriptionDivider.className = 'tooltip-divider';
        content.appendChild(descriptionDivider);

        const description = document.createElement('div');
        description.className = 'tooltip-description';
        description.textContent = `${itemData.description}`;
        content.appendChild(description);

        // Append content to tooltip
        tooltip.appendChild(content);
        document.body.appendChild(tooltip);
        tooltipCache.set(itemData.uniqueId, tooltip);
        console.log(`Created tooltip for ${itemData.name} with ID ${itemData.uniqueId}`);
    }

    // Position the tooltip
    tooltip.style.display = 'block';
    setTimeout(() => {
        const x = event.pageX - tooltip.offsetWidth - 15;
        const y = event.pageY - tooltip.offsetHeight + (tooltip.offsetHeight/2);
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

    window.updateGearStats();

    if (state.ui.overlayOpen) {
        updateStats();
        updateLog();
        updateInventory();
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
            let equippedSlot = item.equippedSlot; // Use provided slot if available

            if (!equippedSlot) {
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
            }

            if (!slots.includes(equippedSlot)) {
                console.error(`Invalid slot ${equippedSlot} for ${item.name}`);
                writeToLog(`Error: Invalid slot for ${item.name}!`);
                return;
            }

            item.equippedSlot = equippedSlot;

            const oldWeapon = state.player.inventory.equipped[equippedSlot];
            console.log(`Old item in ${equippedSlot}:`, oldWeapon);
            if (oldWeapon && oldWeapon.itemTier !== "Empty") {
                state.player.inventory.items.push({ ...oldWeapon, equippedSlot: undefined });
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
                state.player.inventory.items.push({ ...oldArmor, equippedSlot: undefined });
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
                state.player.inventory.items.push({ ...oldAmulet, equippedSlot: undefined });
                writeToLog(`Unequipped ${oldAmulet.name} to inventory`);
            }
            state.player.inventory.equipped.amulet = { ...item };
            writeToLog(`Equipped ${item.name}`);
            break;

        case "ring":
            item.equippedSlot = (state.player.inventory.equipped.leftring.itemTier === "Empty" ? "leftring" : "rightring");
            const oldRing = state.player.inventory.equipped[item.equippedSlot];
            if (oldRing && oldRing.itemTier !== "Empty") {
                state.player.inventory.items.push({ ...oldRing, equippedSlot: undefined });
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

    window.updateGearStats();

    state.ui.activeTab = currentTab;
    if (state.ui.overlayOpen) {
        updateStats();
        updateLog();
        updateInventory();
    }
}

function dropItem(index) {
    const item = state.player.inventory.items[index];
    hideItemTooltip(item);
    writeToLog(`Dropped ${item.name}`);
    state.player.inventory.items.splice(index, 1);
    if (state.ui.overlayOpen) {
        updateStats();
        updateLog();
        updateInventory();
    }
}


function handleDragStart(event, itemData) {
    console.log(`Dragging started for ${itemData.name} (ID: ${itemData.uniqueId})`);
    event.dataTransfer.setData('text/plain', JSON.stringify(itemData));
    event.target.style.opacity = '0.5'; // Visual feedback
}

function handleDragOver(event) {
    event.preventDefault(); // Allow drop
    event.dataTransfer.dropEffect = 'move';
}


function handleDrop(event, targetItemData, isTargetEquipped) {
    event.preventDefault();
    const draggedItemDataStr = event.dataTransfer.getData('text/plain');
    if (!draggedItemDataStr) {
        console.error("No dragged item data found in dataTransfer");
        return;
    }

    let draggedItemData;
    try {
        draggedItemData = JSON.parse(draggedItemDataStr);
        if (!draggedItemData || !draggedItemData.uniqueId) {
            throw new Error("Invalid dragged item data");
        }
        console.log(`Dropped ${draggedItemData.name} onto ${targetItemData.name}`);
    } catch (e) {
        console.error("Error parsing dragged item data:", e);
        return;
    }

    // Case 1: Dragging from inventory to equipped
    if (!draggedItemData.equippedSlot && isTargetEquipped) {
        if (draggedItemData.type === targetItemData.type ||
            (draggedItemData.type === 'weapon' && (targetItemData.equippedSlot === 'mainhand' || targetItemData.equippedSlot === 'offhand')) ||
            (draggedItemData.type === 'ring' && (targetItemData.equippedSlot === 'leftring' || targetItemData.equippedSlot === 'rightring'))) {
            const targetSlot = targetItemData.equippedSlot;
            const currentEquipped = state.player.inventory.equipped[targetSlot];
            if (currentEquipped && currentEquipped.itemTier !== "Empty") {
                unequipItem(currentEquipped, event);
            }
            const draggedCopy = { ...draggedItemData, equippedSlot: targetSlot };
            equipItem(draggedCopy);
        } else {
            writeToLog(`Cannot equip ${draggedItemData.name} to ${targetItemData.equippedSlot}!`);
        }
    }
    // Case 2: Dragging from equipped to inventory
    else if (draggedItemData.equippedSlot && !isTargetEquipped) {
        unequipItem(draggedItemData, event);
    }
    // Case 3: Dragging equipped to equipped (swap)
    else if (draggedItemData.equippedSlot && isTargetEquipped) {
        if (draggedItemData.type === targetItemData.type ||
            (draggedItemData.type === 'weapon' && (targetItemData.equippedSlot === 'mainhand' || targetItemData.equippedSlot === 'offhand')) ||
            (draggedItemData.type === 'ring' && (targetItemData.equippedSlot === 'leftring' || targetItemData.equippedSlot === 'rightring'))) {
            const draggedSlot = draggedItemData.equippedSlot;
            const targetSlot = targetItemData.equippedSlot;

            const draggedCopy = { ...draggedItemData, equippedSlot: targetSlot };
            const targetCopy = { ...targetItemData, equippedSlot: draggedSlot };

            // Unequip both if not empty
            if (draggedItemData.itemTier !== "Empty") {
                unequipItem(draggedItemData, event);
            }
            if (targetItemData.itemTier !== "Empty") {
                unequipItem(targetItemData, event);
            }

            // Equip to swapped slots
            if (draggedItemData.itemTier !== "Empty") {
                equipItem(draggedCopy);
            }
            if (targetItemData.itemTier !== "Empty") {
                equipItem(targetCopy);
            }

            writeToLog(`Swapped ${draggedItemData.name} with ${targetItemData.name}`);
        } else {
            writeToLog(`Cannot swap ${draggedItemData.name} with ${targetItemData.name}!`);
        }
    }
    // Case 4: Inventory to inventory (no action)
    else {
        console.log("Inventory-to-inventory drag, no action taken");
    }

    updateInventory();
}


function handleDragEnd(event) {
    event.target.style.opacity = '1'; // Reset visual feedback
}

function addItemListeners() {
    console.log("Adding item listeners...");

    // Equipped items
    const equipItems = document.querySelectorAll('#equipped-items .item:not([data-listener-added])');
    console.log(`Found ${equipItems.length} new equipped items`);
    equipItems.forEach(p => {
        const itemDataStr = p.dataset.item;
        if (itemDataStr) {
            try {
                const decodedItemDataStr = decodeURIComponent(itemDataStr);
                const itemData = JSON.parse(decodedItemDataStr);
                console.log(`Parsed item data for ${itemData.tier} ${itemData.type} ${itemData.name} with ID ${itemData.uniqueId}`);
                if (itemData && itemData.uniqueId) {
                    p.draggable = true; // Make item draggable
                    p.addEventListener('dragstart', (event) => handleDragStart(event, itemData));
                    p.addEventListener('dragover', handleDragOver);
                    p.addEventListener('drop', (event) => handleDrop(event, itemData, true));
                    p.addEventListener('dragend', handleDragEnd);
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

    // Inventory items
    const inventoryItems = document.querySelectorAll('.inventory-item-wrapper .item:not([data-listener-added])');
    console.log(`Found ${inventoryItems.length} new inventory items`);
    inventoryItems.forEach(p => {
        const itemDataStr = p.dataset.item;
        if (itemDataStr) {
            try {
                const decodedItemDataStr = decodeURIComponent(itemDataStr);
                const itemData = JSON.parse(decodedItemDataStr);
                console.log(`Parsed item data for ${itemData.name} with ID ${itemData.uniqueId}`);
                if (itemData && itemData.uniqueId) {
                    p.draggable = true; // Make item draggable
                    p.addEventListener('dragstart', (event) => handleDragStart(event, itemData));
                    p.addEventListener('dragover', handleDragOver);
                    p.addEventListener('drop', (event) => handleDrop(event, itemData, false));
                    p.addEventListener('dragend', handleDragEnd);
                    p.addEventListener('mouseover', (event) => showItemTooltip(itemData, event));
                    p.addEventListener('mouseout', () => hideItemTooltip(itemData));
                    p.addEventListener('click', (event) => handleInventoryItemClick(itemData, event));
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
function handleInventoryItemClick(item, event) {
    console.log("Handling item click", item, event);
    if (item.itemTier === "Empty") {
        console.log("Empty item, skipping");
        return;
    }
    if (event.ctrlKey) {
        console.log("Ctrl key pressed, dropping item", item, "Event:", event);
        dropItem(event.target.dataset.index);
    } else if (event.shiftKey) {
        console.log("Shift key pressed, no action taken");
        return;
    } else {
        console.log("equipping item", item);
        //console.log("Before equip:", JSON.stringify(state.player.inventory));
        equipItem(item);
        //console.log("After equip:", JSON.stringify(state.player.inventory));
    }
}
function updatePlayerInfo() {

    const playerInfo = document.getElementById('player-info');

    playerInfo.innerHTML = `
    <div class="player-info-child">Player: ${state.player.name}</div>
    <div class="player-info-child">Level: ${state.player.level}</div>
    <div class="player-info-child">Dungeon Tier: ${state.tier}</div>`;

}

function updatePlayerStatus() {

    const playerStatus = document.getElementById('player-status');

    playerStatus.innerHTML = `
    <div class="player-status-child">HP: ${state.player.hp}/${state.player.maxHp}</div>
     <div class="player-status-child">Mana: ${state.player.mana}/${state.player.maxMana}</div>
    <div class="player-status-child">XP: ${state.player.xp}/${state.player.nextLevelXp}</div>
     <div class="player-status-child">Gold: ${state.player.gold}</div>
     <div class="player-status-child">Torches: ${state.player.torches}</div>`; 
}

function updateStats() {
    updatePlayerInfo();
    updatePlayerStatus();
    if (!state.ui.overlayOpen) return;

    const statsDiv = document.getElementById('stats');
    if (statsDiv) {
        statsDiv.innerHTML = `
            <div id="player-name">Player: ${state.player.name}</div>
            <div class="col-50-wrapper">
                <div class="col-50">Player Level: ${state.player.level}</div>
                <div class="col-50">Dungeon Tier: ${state.tier}</div>
            </div>`;
    }
}

function updateLog() {
    if (!state.ui.overlayOpen) return;

    const logContent = document.getElementById('log-content');
    if (logContent) {
        const entries = state.ui.logEntries.slice(0, state.ui.maxLogEntries);
        logContent.innerHTML = `
            <div>Adventure Log</div>
            ${entries.length ? entries.map(line => `<p>${line}</p>`).join('') : '<p>Nothing to log yet.</p>'}`;
    }
}

function updateInventory() {
    if (!state.ui.overlayOpen) { return ''; }

    const inventory = document.getElementById('inventory');
    const equippedItems = document.getElementById('equipped-items');
    const equip = state.player.inventory.equipped || {}; // Safety for undefined

    if (equippedItems) {

        equippedItems.innerHTML = `
            <div style="width: 30%;">
            <div class="equipped-item">
                <p class="equip-slot mainhand">
                    <img src="img/icons/items/${equip.mainhand?.icon || 'no-mainhand.svg'}" alt="${equip.mainhand?.name || 'Mainhand'}" 
                            class="item item-icon ${equip.mainhand?.itemTier || 'Empty'} ${equip.mainhand?.type || 'weapon'}" 
                            data-item='${JSON.stringify(equip.mainhand || { name: "Mainhand", itemTier: "Empty", type: "weapon", slots: ["mainhand"], baseDamageMin: 1, baseDamageMax: 1, uniqueId: generateUniqueId(), icon: "no-mainhand.svg" })}'>
                <br><span class="item-label">Mainhand</span></p>
                </div>
                <div class="equipped-item">
                <p class="equip-slot rightring">
                    <img src="img/icons/items/${equip.rightring?.icon || 'no-rightring.svg'}" alt="${equip.rightring?.name || 'Right Ring'}" 
                            class="item item-icon ${equip.rightring?.itemTier || 'Empty'} ${equip.rightring?.type || 'ring'}" 
                            data-item='${JSON.stringify(equip.rightring || { name: "Right Ring", itemTier: "Empty", type: "ring", slot: "rightring", uniqueId: generateUniqueId(), icon: "no-rightring.svg" })}'>
                <br><span class="item-label">Right Ring </span></p>
                </div>
            </div>
            <div style="width: 30%;">
                <div class="equipped-item">
                <p class="equip-slot amulet"> 
                    <img src="img/icons/items/${equip.amulet?.icon || 'no-amulet.svg'}" alt="${equip.amulet?.name || 'Amulet'}" 
                            class="item item-icon ${equip.amulet?.itemTier || 'Empty'} ${equip.amulet?.type || 'amulet'}" 
                            data-item='${JSON.stringify(equip.amulet || { name: "Amulet", itemTier: "Empty", type: "amulet", slot: "amulet", uniqueId: generateUniqueId(), icon: "no-amulet.svg" })}'>
                <br><span class="item-label">Amulet</span></p>
                </div>
                <div class="equipped-item">
                <p class="equip-slot armor">
                    <img src="img/icons/items/${equip.armor?.icon || 'no-armor.svg'}" alt="${equip.armor?.name || 'Armor'}" 
                            class="item item-icon ${equip.armor?.itemTier || 'Empty'} ${equip.armor?.type || 'armor'}" 
                            data-item='${JSON.stringify(equip.armor || { name: "Armor", itemTier: "Empty", type: "armor", slot: "armor", uniqueId: generateUniqueId(), defense: 0, icon: "no-armor.svg" })}'>
               <br><span class="item-label">Armor</span> </p>
               </div>
            </div>
            <div style="width: 30%;">

                <div class="equipped-item">
                <p class="equip-slot offhand">
                    <img src="img/icons/items/${equip.offhand?.icon || 'no-offhand.svg'}" alt="${equip.offhand?.name || 'Offhand'}" 
                            class="item item-icon ${equip.offhand?.itemTier || 'Empty'} ${equip.offhand?.type || 'weapon'}" 
                            data-item='${JSON.stringify(equip.offhand || { name: "Offhand", itemTier: "Empty", type: "weapon", slots: ["offhand"], baseDamageMin: 0, baseDamageMax: 0, uniqueId: generateUniqueId(), icon: "no-offhand.svg" })}'>
                <br><span class="item-label">Offhand</span></p>
                </div>
                <div class="equipped-item">
                <p class="equip-slot leftring">
                    <img src="img/icons/items/${equip.leftring?.icon || 'no-leftring.svg'}" alt="${equip.leftring?.name || 'Left Ring'}" 
                            class="item item-icon ${equip.leftring?.itemTier || 'Empty'} ${equip.leftring?.type || 'ring'}" 
                            data-item='${JSON.stringify(equip.leftring || { name: "Left Ring", itemTier: "Empty", type: "ring", slot: "leftring", uniqueId: generateUniqueId(), icon: "no-leftring.svg" })}'>
               <br><span class="item-label">Left Ring</span> </p>
               </div>
            </div>`;

        addItemListeners(); // Re-add listeners after updating equipped items
        
     }

    if (inventory) {
        inventory.innerHTML = `

            <div class="inventory-item-wrapper">
            ${state.player.inventory.items?.length ? state.player.inventory.items.map((item, index) => `
                
                <div class="inventory-item">
                    <p class="inventory-slot ${item.itemTier} ${item.type}">
                        <img src="img/icons/items/${item.icon}" alt="${item.name}" class="item item-icon ${item.itemTier} ${item.type}" data-item='${JSON.stringify(item)}' data-index='${index}'>
                        <span class="item-label ${item.itemTier}">(${item.itemTier} ${item.type})</span>
                        
                    </p>
                </div>

                `).join('') + `</div>`: '<p>Inventory empty.</p>'}`;
        addItemListeners(); // Re-add listeners after updating inventory
    }

    return '';
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
        updateStats();
    }

    if (logDiv) {
        logDiv.innerHTML = `
            <div id="tab-menu">      
                <button id="character-tab" class="tabs-button" style="background: ${state.ui.activeTab === 'character' ? '#0f0' : '#000'}; color: ${state.ui.activeTab === 'character' ? '#000' : '#0f0'};">Character</button>
               <!-- <button id="inventory-tab" class="tabs-button" style="background: ${state.ui.activeTab === 'inventory' ? '#0f0' : '#000'}; color: ${state.ui.activeTab === 'inventory' ? '#000' : '#0f0'};">Inventory</button> -->
               <button id="log-tab" class="tabs-button" style="background: ${state.ui.activeTab === 'log' ? '#0f0' : '#000'}; color: ${state.ui.activeTab === 'log' ? '#000' : '#0f0'};">Log</button> 
               <button id="close-tabs" >X</button>
            </div>

            <div id="log-content" class="ui-tab" style="display: ${state.ui.activeTab === 'log' ? 'block' : 'none'}; overflow-y: auto;">
                ${state.ui.logEntries.length ? state.ui.logEntries.slice(0, state.ui.maxLogEntries).map(line => `<p>${line}</p>`).join('') : '<p>Nothing to log yet.</p>'}
            </div>

            <div id="character-content" class="ui-tab" style="display: ${state.ui.activeTab === 'character' ? 'flex' : 'none'} ;">
                <div id="character">
                    <div style="font-size: 18px; font-weight: bold; text-align: center; margin-top: 10px; border-bottom: 1px dashed #090;">Equipped Items</div>
                    <div id="equipped-items">${updateInventory(true)}</div>
                    <div style="font-size: 18px; font-weight: bold; text-align: center; margin-top: 10px; border-bottom: 1px dashed #090;">Effective Stats</div>
                    <div id="character-stat-wrapper">
                       
                        <div>Level: ${state.player.level}</div>
                        <div>XP: ${state.player.xp}/${state.player.nextLevelXp}</div>
                        <div>HP: ${state.player.hp}/${state.player.maxHp}</div>
                        <div>Mana: ${state.player.mana}/${state.player.maxMana}</div>
                        <div>Gold: ${state.player.gold}</div>
                        <div>Torches: ${state.player.torches}</div>
                        <div>${state.player.intellect} : Intellect</div>
                        <div>${state.player.prowess} : Prowess</div>
                        <div>${state.player.agility} : Agility</div>
                        <div>${state.player.defense} : Defense </div>
                        <div>${state.player.damageBonus} : Damage Bonus</div>
                        <div> ${state.player.armor} : Armor</div>  
                        <div>${state.player.meleeDamageBonus} : Melee Dmg</div>
                        <div> ${state.player.block} : Block</div>
                        <div>${state.player.rangedDamageBonus} : Ranged Dmg</div>
                        <div>${state.player.dodge} : Dodge</div>
                    </div> 
                </div>
                <div id="inventory">
                    ${updateInventory()}
                </div>
            </div>
        `;

        // Ensure inventory and equipped items are updated for all tabs on open
        updateInventory(state.ui.activeTab === 'character');

        const logTab = document.getElementById('log-tab');
        const inventoryTab = document.getElementById('inventory-tab');
        const characterTab = document.getElementById('character-tab');
        const closeTabsButton = document.getElementById('close-tabs');

        if (logTab && inventoryTab && characterTab) {
            logTab.addEventListener('click', () => {
                console.log("Switching to Log tab");
                state.ui.activeTab = 'log';
                updateStats();
                renderOverlay();
            });
            /*
            inventoryTab.addEventListener('click', () => {
                console.log("Switching to Inventory tab");
                state.ui.activeTab = 'inventory';
                updateInventory();
                renderOverlay();
            });
            */
            characterTab.addEventListener('click', () => {
                console.log("Switching to Character tab");
                state.ui.activeTab = 'character';
                updateInventory(true); // Update equipped items only
                updateInventory();
                renderOverlay();
            });
        }
        
        if (closeTabsButton) {
            closeTabsButton.addEventListener('click', () => {
                state.ui.overlayOpen = false;
                document.getElementById('tabs').classList.add('hidden');
                window.ui.renderOverlay();
                console.log("Overlay closed via close button");
            });
        }

        // Add item listeners only if not already added
        addItemListeners();
    }
}

function writeToLog(message) {
    state.ui.logEntries.unshift(message);
    if (state.ui.logEntries.length > state.ui.maxLogEntries) {
        state.ui.logEntries.pop();
    }
    if (state.ui.overlayOpen) {
        updateLog();
    }
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



window.ui = {
    dropItem,
    equipItem,
    renderOverlay,
    showItemTooltip,
    hideItemTooltip,
    addItemListeners,
    updateStats,
    updateLog,
    updateInventory,
    writeToLog,
    updatePlayerInfo,
    updatePlayerStatus,
    gameOver
};