//console.log("UI.js loaded");

import { State } from './State.js';

export class UI {
    constructor(state) {
        this.state = state;
        this.utilities = this.state.utilities; // Ensure this line exists
        this.tooltipCache = new Map();
    }

    updatePlayerInfo() {
        const playerInfo = document.getElementById('player-info');
        playerInfo.innerHTML = `
            <div class="player-info-child">Player: ${this.state.player.name}</div>
            <div class="player-info-child">Level: ${this.state.player.level}</div>
            <div class="player-info-child">Dungeon Tier: ${this.state.tier}</div>
            <div class="player-info-child">Gold: ${this.state.player.gold}</div>`;
    }

    updatePlayerStatus() {
        const playerStatus = document.getElementById('player-status');
        playerStatus.innerHTML = `
        <div class="player-status-child">Heal Potions: ${this.state.player.healPotions}</div>
        <div class="player-status-child bar">
            <div class="progress-bar">
                <div class="progress-fill hp-fill" style="width: ${(this.state.player.hp / this.state.player.stats.base.maxHp) * 100}%"></div>
            </div>
             HP: ${this.state.player.hp}/${this.state.player.maxHp}
        </div>
        <div class="player-status-child bar">
            <div class="progress-bar">
                <div class="progress-fill mana-fill" style="width: ${(this.state.player.mana / this.state.player.stats.base.maxMana) * 100}%"></div>
            </div>
            Mana: ${this.state.player.mana}/${this.state.player.maxMana}
        </div>
        <div class="player-status-child bar">
            <div class="progress-bar">
                <div class="progress-fill xp-fill" style="width: ${(this.state.player.xp / this.state.player.nextLevelXp) * 100}%"></div>
            </div>
             XP: ${this.state.player.xp}/${this.state.player.nextLevelXp}
        </div>
        <div class="player-status-child">Torches: ${this.state.player.torches}</div>`;
    }

    getOverlayDiv(divToCheck) {

        // This method handles getting HTML element references and hadnling failures for the #tabs Overlay Child Divs

        const divToReturn = document.getElementById(divToCheck);

        // if Overlay Div is not found, or Tabs Overlay is not open, log it and return false
        if (!divToReturn) { console.error(`div #${divToCheck} not found`); return false; }

        else if (!this.state.ui.overlayOpen) {
            //console.log(`Overlay not open, Skipping #${divToCheck} Resfresh...`); 
            return false;
        }

        // if Overlay Div is found, return it
        else if (divToReturn) { return divToReturn; }
        // if none of the above, log error and return false
        else { //console.log("Error in getOverlayDiv"); 
            return false;
        }

    }

    updateLog() {
        const logTextDiv = this.getOverlayDiv('log');
        if (!logTextDiv) return;
            logTextDiv.innerHTML = `${this.state.ui.logEntries.length
                ? this.state.ui.logEntries.slice(0, this.state.ui.maxLogEntries).map(line => `<p>${line}</p>`).join('')
                : '<p>Nothing to log yet.</p>'}`;
    }

    overlayTabButtons() {
        const tabMenuDiv = this.getOverlayDiv('tab-menu');
        if (!tabMenuDiv) return;

        tabMenuDiv.innerHTML =
            `<button id="character-tab" class="tabs-button" style="background: ${this.state.ui.activeTab === 'character' ? '#0f0' : '#000'}; color: ${this.state.ui.activeTab === 'character' ? '#000' : '#0f0'};">Character</button>
            <button id="log-tab" class="tabs-button" style="background: ${this.state.ui.activeTab === 'log' ? '#0f0' : '#000'}; color: ${this.state.ui.activeTab === 'log' ? '#000' : '#0f0'};">Log</button> 
            <button id="close-tabs">X</button>`;

        const logTab = document.getElementById('log-tab');
        const characterTab = document.getElementById('character-tab');
        const closeTabsButton = document.getElementById('close-tabs');

        if (logTab && characterTab) {
            logTab.addEventListener('click', () => {
                //console.log("Switching to Log tab");
                this.state.ui.activeTab = 'log';
                this.renderOverlay();
            });
            characterTab.addEventListener('click', () => {
                //console.log("Switching to Character tab");
                this.state.ui.activeTab = 'character';
                this.renderOverlay();
            });
        }
        if (closeTabsButton) {
            closeTabsButton.addEventListener('click', () => {
                this.state.ui.overlayOpen = false;
                document.getElementById('tabs').classList.add('hidden');
                this.renderOverlay();
                //console.log("Overlay closed via close button");
            });
        }
    }

    updateInventory() {
        if (!this.state.ui.overlayOpen) return;
        const inventory = document.getElementById('inventory');
        if (!inventory) return;

        inventory.innerHTML = `
        <h2>Inventory Items</h2>
        <div class="inventory-item-wrapper">
        ${this.state.player.inventory.items.length ? this.state.player.inventory.items.map((item, index) => `
            <div class="inventory-item">
                <p class="inventory-slot ${item.itemTier} ${item.type}">
                    <img src="img/icons/items/${item.icon}" alt="${item.name}" class="item item-icon ${item.itemTier} ${item.type}" data-item='${JSON.stringify(item)}' data-index='${index}'>
                    <span class="item-label ${item.itemTier}">${item.type}</span>
                </p>
            </div>
        `).join('') : '<p>Inventory empty.</p>'}
        </div>`;

        const playerService = this.state.game.getService('player');
        const inventoryWrapper = inventory.querySelector('.inventory-item-wrapper');
        if (inventoryWrapper && !inventoryWrapper.dataset.listenersAdded) {
            inventoryWrapper.addEventListener('dragover', (e) => this.handleDragOver(e));
            inventoryWrapper.addEventListener('drop', (e) => {
                const draggedItemData = JSON.parse(e.dataTransfer.getData('text/plain'));
                this.handleDrop(e, draggedItemData, false); // false = not an equipped slot
            });
            inventoryWrapper.dataset.listenersAdded = 'true';
        }

        const inventoryItems = inventory.querySelectorAll('.inventory-item-wrapper .item');
        inventoryItems.forEach(item => {
            if (item.dataset.listenersAdded) return;
            const itemData = JSON.parse(item.getAttribute('data-item'));
            item.draggable = true;
            item.addEventListener('dragstart', (e) => {
                this.handleDragStart(e, itemData);
                this.hideItemTooltip(itemData); // Hide tooltip on drag start
            });
            item.addEventListener('dragover', (e) => this.handleDragOver(e));
            item.addEventListener('drop', (e) => this.handleDrop(e, itemData, false));
            item.addEventListener('dragend', (e) => this.handleDragEnd(e));
            item.addEventListener('mouseover', (e) => this.showItemTooltip(itemData, e));
            item.addEventListener('mouseout', () => this.hideItemTooltip(itemData));
            item.addEventListener('click', (e) => this.handleInventoryItemClick(itemData, e));
            item.dataset.listenersAdded = 'true';
        });
    }

    updateEquippedSlots() {
        const equipSlots = document.querySelectorAll('#equipped-items .equip-slot');
        const playerService = this.state.game.getService('player');
        equipSlots.forEach(slot => {
            const slotData = JSON.parse(slot.getAttribute('data-equip_slot'));
            const item = this.state.player.inventory.equipped[slotData.slot];
            slot.innerHTML = item ? `
            <img src="img/icons/items/${item.icon}" alt="${item.name}" class="item item-icon ${item.itemTier} ${item.type}" data-item='${JSON.stringify(item)}'>
        ` : '';
         
            // Add listeners to slot and item
            if (!slot.dataset.listenersAdded) {
                slot.addEventListener('dragover', (e) => this.handleDragOver(e));
                slot.addEventListener('drop', (e) => this.handleDrop(e, slotData, true));
                slot.dataset.listenersAdded = 'true';
            }

            const itemImg = slot.querySelector('.item');
            if (itemImg && !itemImg.dataset.listenersAdded) {
                const itemData = JSON.parse(itemImg.getAttribute('data-item'));
                itemImg.draggable = true;
                itemImg.addEventListener('dragstart', (e) => {
                    this.handleDragStart(e, itemData);
                    this.hideItemTooltip(itemData); // Hide tooltip on drag start
                });
                itemImg.addEventListener('click', (e) => {
                    if (e.ctrlKey) {
                        playerService.playerInventory.unequipItem(slotData.slot, false);
                        playerService.playerInventory.dropItem(-1);
                    } else {
                        playerService.playerInventory.unequipItem(slotData.slot);
                    }
                });
                itemImg.addEventListener('mouseover', (e) => this.showItemTooltip(itemData, e));
                itemImg.addEventListener('mouseout', () => this.hideItemTooltip(itemData));
                itemImg.dataset.listenersAdded = 'true';
            }
        });
    }

    updateStats() {
        const statsDiv = this.getOverlayDiv('character-stat-wrapper');
        if (!statsDiv) return;

        statsDiv.innerHTML = `<div>Level: ${this.state.player.level}</div>
            <div>XP: ${this.state.player.xp}/${this.state.player.nextLevelXp}</div>
            <div>HP: ${this.state.player.hp}/${this.state.player.maxHp}</div>
            <div>Mana: ${this.state.player.mana}/${this.state.player.maxMana}</div>
            <div>Gold: ${this.state.player.gold}</div>
            <div>Torches: ${this.state.player.torches}</div>
            <div><hr></div><div><hr></div>
            <div>${this.state.player.intellect} : Intellect</div>
            <div>${this.state.player.prowess} : Prowess</div>
            <div>${this.state.player.agility} : Agility</div>
            <div>${this.state.player.defense} : Defense </div>
            <div>${this.state.player.damageBonus} : Damage Bonus</div>
            <div>${this.state.player.armor} : Armor</div>
            <div>${this.state.player.meleeDamageBonus} : Melee Dmg</div>
            <div>${this.state.player.block} : Block</div>
            <div>${this.state.player.rangedDamageBonus} : Ranged Dmg</div>
            <div>${this.state.player.range} : Range</div>`;
    }

    statRefreshUI() {
        this.updatePlayerInfo();
        this.updatePlayerStatus();
        if (!this.state.ui.overlayOpen) return;

        this.updateInventory();
        this.updateEquippedSlots(); // New call
        this.updateStats();
        this.updateLog();
    }  
    renderOverlay() {

        const tabsDiv = document.getElementById('tabs');

        if (!this.state.ui.overlayOpen) {
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

        this.overlayTabButtons();

        document.getElementById('character-content').style.display = this.state.ui.activeTab === 'character' ? 'flex' : 'none';
        document.getElementById('log-content').style.display = this.state.ui.activeTab === 'log' ? 'block' : 'none';

        this.statRefreshUI();

        //this.addItemListeners(); 
    }

    showItemTooltip(itemData, event) {
        if (!itemData || !itemData.uniqueId) {
            //console.log("No item data or uniqueId for tooltip", itemData);
            return;
        }

        let tooltip = this.tooltipCache.get(itemData.uniqueId);
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = `item-tooltip-${itemData.uniqueId}`;
            tooltip.className = `item-tooltip-class ${itemData.itemTier}`;
            tooltip.style.position = 'absolute';
            tooltip.style.whiteSpace = 'pre-wrap';

            const content = document.createElement('div');

            const name = document.createElement('div');
            name.className = 'item-tooltip-name';
            name.textContent = itemData.name;
            content.appendChild(name);

            const typeTier = document.createElement('div');
            typeTier.className = 'item-tooltip-type-tier';
            typeTier.textContent = `${itemData.itemTier} ${itemData.type}`;
            content.appendChild(typeTier);

            if (itemData.type === "weapon") {
                const damage = document.createElement('div');
                damage.className = 'item-tooltip-damage';
                damage.textContent = `Damage: ${itemData.baseDamageMin}–${itemData.baseDamageMax}`;
                content.appendChild(damage);
                switch (itemData.attackType) {
                    case "melee":
                        const baseBlock = document.createElement('div');
                        baseBlock.className = 'item-tooltip-base-block';
                        baseBlock.textContent = `Block: ${itemData.baseBlock}`;
                        content.appendChild(baseBlock);
                        break;
                    case "ranged":
                        const baseRange = document.createElement('div');
                        baseRange.className = 'item-tooltip-base-range';
                        baseRange.textContent = `Range: ${itemData.baseRange}`;
                        content.appendChild(baseRange);
                        break;
                }
            } else if (itemData.type === "armor") {
                const armor = document.createElement('div');
                armor.className = 'item-tooltip-armor';
                armor.textContent = `Armor: ${itemData.armor}`;
                content.appendChild(armor);
            }

            if ('stats' in itemData && itemData.stats) {
                const divider = document.createElement('hr');
                divider.className = 'tooltip-divider';
                content.appendChild(divider);

                const propCount = Object.keys(itemData.stats).length;
                if (propCount > 0) {
                    const statsContainer = document.createElement('div');
                    statsContainer.className = 'tooltip-stats';
                    Object.entries(itemData.stats).forEach(([stat, value]) => {
                        if (true) { // Temporarily show luck stats for testing
                            const statLine = document.createElement('div');
                            statLine.className = 'tooltip-stat';
                            statLine.textContent = `${value > 0 ? '+' : ''}${value} : ${this.state.utilities.camelToTitleCase(stat)}`;
                            statsContainer.appendChild(statLine);
                        }
                    });
                    content.appendChild(statsContainer);
                }
            }

            const descriptionDivider = document.createElement('hr');
            descriptionDivider.className = 'tooltip-divider';
            content.appendChild(descriptionDivider);

            const description = document.createElement('div');
            description.className = 'tooltip-description';
            description.textContent = `${itemData.description}`;
            content.appendChild(description);

            tooltip.appendChild(content);
            document.body.appendChild(tooltip);
            this.tooltipCache.set(itemData.uniqueId, tooltip);
            //console.log(`Created tooltip for ${itemData.name} with ID ${itemData.uniqueId}`);
        }

        tooltip.style.display = 'block';
        setTimeout(() => {
            const x = event.pageX - tooltip.offsetWidth - 15;
            const y = event.pageY - tooltip.offsetHeight + (tooltip.offsetHeight / 2);
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const tooltipWidth = tooltip.offsetWidth;
            const tooltipHeight = tooltip.offsetHeight;

            tooltip.style.left = `${Math.max(10, Math.min(x, viewportWidth - tooltipWidth - 10))}px`;
            tooltip.style.top = `${Math.max(10, Math.min(y, viewportHeight - tooltipHeight - 10))}px`;
            //console.log(`Positioned tooltip for ${itemData.name} at (${tooltip.style.left}, ${tooltip.style.top})`);
        }, 0);
    }

    hideItemTooltip(itemData) {
        if (!itemData || !itemData.uniqueId) {
            //console.log("No item data or uniqueId for tooltip hide", itemData);
            return;
        }
        const tooltip = this.tooltipCache.get(itemData.uniqueId);
        if (tooltip) {
            tooltip.style.display = 'none';
            //console.log(`Hid tooltip for ${itemData.name} with ID ${itemData.uniqueId}`);
        }
    }

    handleDragStart(event, itemData) {
        //console.log(`Dragging started for ${itemData.name} (ID: ${itemData.uniqueId})`);
        event.dataTransfer.setData('text/plain', JSON.stringify(itemData));
        event.target.style.opacity = '0.5';
    }

    handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }

    handleDrop(event, targetItemData, isTargetEquipped) {
        const playerService = this.state.game.getService('player');
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
            //console.log(`Dragged Item and unique ID verified for item: ${draggedItemData.name} | Drop to: ${targetItemData.name}`);
        } catch (e) {
            console.error("Error parsing dragged item data:", e);
            return;
        }
        //console.log('Calling playerService.playerInventory.handleDrop( draggedItemData, targetItemData,  isTargetEquipped)', draggedItemData, targetItemData, isTargetEquipped );

        playerService.playerInventory.handleDrop(draggedItemData, targetItemData, isTargetEquipped);

        this.statRefreshUI()
    }

    handleDragEnd(event) {
        event.target.style.opacity = '1';
    }



    handleInventoryItemClick(item, event) {
        const playerService = this.state.game.getService('player');
        //console.log("Handling item click", item, event);

        if (event.ctrlKey) {
            console.log("Ctrl key pressed, dropping item", item, "Event:", event);
            this.hideItemTooltip(item);
            playerService.playerInventory.dropItem(event.target.dataset.index, item);
            
        } else if (event.shiftKey) {
            //console.log("Shift key pressed, no action taken");
            return;
        } else {
            //console.log("equipping item", item);
           // placholder to equip when empty and log when no available slots
        }
        this.statRefreshUI();
    }
    


    writeToLog(message) {
        this.state.ui.logEntries.unshift(message);
        if (this.state.ui.logEntries.length > this.state.ui.maxLogEntries) {
            this.state.ui.logEntries.pop();
        }
        if (this.state.ui.overlayOpen) {
            this.updateLog();
        }
    }

    logDroppedItems(monster, goldGain, torchDropped, droppedItems) {
        let logMessage = `${monster.name} dropped ${goldGain} gold`;
        if (torchDropped) logMessage += ' and a torch';
        if (droppedItems.length) logMessage += ` and ${droppedItems.map(i => i.name).join(', ')}`;
        this.writeToLog(logMessage + '!');
    }

    gameOver(message) {
        //console.log("gameOver called with message:", message);
        const existingGameOver = document.getElementById('game-over');
        if (existingGameOver) existingGameOver.remove();

        const gameOver = document.createElement('div');
        gameOver.id = 'game-over';
        const headline = this.state.isVictory ? '<h1>VICTORY!</h1>' : '<h1>GAME OVER</h1>';
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

        gameOver.classList.add(this.state.isVictory ? 'victory' : 'death');

        const restartButton = document.createElement('button');
        restartButton.id = 'restart-button';
        restartButton.textContent = 'Play Again?';
        restartButton.onclick = () => {
            //console.log('Restart Clicked');
            location.reload(true);
        };
        gameOver.appendChild(restartButton);
    }
}