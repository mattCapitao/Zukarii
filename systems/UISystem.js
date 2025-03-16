// systems/UISystem.js
import { System } from '../core/Systems.js';

export class UISystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['OverlayState'];
        this.playerInfo = null;
        this.playerStatus = null;
        this.tabs = null;
        this.logContent = null;
        this.characterContent = null;
    }

    init() {
        this.playerInfo = document.getElementById('player-info');
        this.playerStatus = document.getElementById('player-status');
        this.tabs = document.getElementById('tabs');
        this.logContent = document.getElementById('log-content');
        this.characterContent = document.getElementById('character-content');
        if (!this.playerInfo || !this.playerStatus || !this.tabs || !this.logContent || !this.characterContent) {
            throw new Error('UI elements not found');
        }

        this.eventBus.on('ToggleOverlay', (data) => this.toggleOverlay(data));
        this.eventBus.on('LogMessage', (data) => this.addLogMessage(data));
        this.eventBus.on('StatsUpdated', (data) => this.updateUI(data));
        this.eventBus.on('GameOver', (data) => {
            console.log('GameOver event received:', data);
            this.handleGameOver(data);
        });

        this.eventBus.on('GearChanged', (data) => this.updateUI(data)); // Add GearChanged listener
        this.updateUI({ entityId: 'player' }); // Initial render
        this.eventBus.emit('GearChanged', { entityId: 'player' }); // Trigger initial stat calculation

        // Initialize drag-and-drop listeners after UI is rendered
        this.setupDragAndDrop();
    }

    toggleOverlay({ tab = null }) {
        console.log(`ToggleOverlay called with tab: ${tab}`);
        const overlayState = this.entityManager.getEntity('overlayState').getComponent('OverlayState');
        const currentTab = overlayState.activeTab;

        console.log(`Current state - isOpen: ${overlayState.isOpen}, activeTab: ${currentTab}`);
        if (tab === currentTab || !tab) {
            overlayState.isOpen = !overlayState.isOpen;
            overlayState.activeTab = overlayState.isOpen ? (currentTab || 'character') : null;
        } else {
            overlayState.isOpen = true;
            overlayState.activeTab = tab;
        }

        console.log(`New state - isOpen: ${overlayState.isOpen}, activeTab: ${overlayState.activeTab}`);
        this.tabs.style.display = overlayState.isOpen ? 'block' : 'none';
        this.tabs.className = overlayState.isOpen ? '' : 'hidden';
        console.log(`Tabs display set to: ${this.tabs.style.display}, className: ${this.tabs.className}`);
        if (overlayState.isOpen) {
            this.renderOverlay(overlayState.activeTab);
        }
    }

    renderOverlay(tab) {
        console.log(`Rendering overlay for tab: ${tab}`);
        const overlayState = this.entityManager.getEntity('overlayState').getComponent('OverlayState');
        const player = this.entityManager.getEntity('player');
        const stats = player.getComponent('Stats');
        const health = player.getComponent('Health');
        const mana = player.getComponent('Mana');
        const inventory = player.getComponent('Inventory');
        const playerState = player.getComponent('PlayerState');
        const resource = player.getComponent('Resource');

        console.log('Overlay data raw:', { stats: Object.assign({}, stats), inventory: Object.assign({}, inventory), resource: Object.assign({}, resource) });

        this.overlayTabButtons(tab);
        this.logContent.style.display = tab === 'log' ? 'block' : 'none';
        this.characterContent.style.display = tab === 'character' ? 'flex' : 'none';
        console.log(`Log display: ${this.logContent.style.display}, Character display: ${this.characterContent.style.display}`);

        if (tab === 'log') {
            this.updateLog(overlayState.logMessages);
        } else if (tab === 'character') {
            this.updateCharacter(stats, health, mana, inventory, playerState, resource);
        }
    }

    overlayTabButtons(activeTab) {
        const tabMenuDiv = document.getElementById('tab-menu');
        if (!tabMenuDiv) return;

        tabMenuDiv.innerHTML = `
            <button id="character-tab" class="tabs-button" style="background: ${activeTab === 'character' ? '#0f0' : '#000'}; color: ${activeTab === 'character' ? '#000' : '#0f0'};">Character</button>
            <button id="log-tab" class="tabs-button" style="background: ${activeTab === 'log' ? '#0f0' : '#000'}; color: ${activeTab === 'log' ? '#000' : '#0f0'};">Log</button>
            <button id="close-tabs">X</button>
        `;

        const logTab = document.getElementById('log-tab');
        const characterTab = document.getElementById('character-tab');
        const closeTabsButton = document.getElementById('close-tabs');

        logTab?.addEventListener('click', () => {
            console.log("Switching to Log tab");
            this.toggleOverlay({ tab: 'log' });
        });
        characterTab?.addEventListener('click', () => {
            console.log("Switching to Character tab");
            this.toggleOverlay({ tab: 'character' });
        });
        closeTabsButton?.addEventListener('click', () => {
            console.log("Overlay closed via close button");
            this.toggleOverlay({});
        });
    }

    updateLog(logMessages) {
        const logDiv = document.getElementById('log');
        logDiv.innerHTML = logMessages.length
            ? logMessages.slice(0, 50).map(line => `<p>${line}</p>`).join('')
            : '<p>Nothing to log yet.</p>';
        console.log('Log content updated');
    }

    updateCharacter(stats, health, mana, inventory, playerState, resource) {
        const statWrapper = document.getElementById('character-stat-wrapper');
        statWrapper.innerHTML = `
            <div>Level: ${playerState.level}</div>
            <div>XP: ${playerState.xp}/${playerState.nextLevelXp}</div>
            <div>HP: ${health.hp}/${health.maxHp}</div>
            <div>Mana: ${mana.mana}/${mana.maxMana}</div>
            <div>Gold: ${inventory.gold !== undefined ? inventory.gold : 'N/A'}</div>
            <div>Torches: ${resource.torches}</div>
            <div><hr></div><div><hr></div>
            <div>${stats.intellect || 0} : Intellect</div>
            <div>${stats.prowess || 0} : Prowess</div>
            <div>${stats.agility || 0} : Agility</div>
            <div>${stats.armor || 0} : Armor</div>
            <div>${stats.block || 0} : Block</div>
            <div>${stats.range || 0} : Range</div>
        `;

        // Update equipped items in existing slots
        const equipSlots = document.querySelectorAll('.equip-slot');
        equipSlots.forEach(slot => {
            const slotData = JSON.parse(slot.getAttribute('data-equip_slot') || '{}');
            const slotName = slotData.slot;
            const equippedItem = inventory.equipped[slotName] || null;

            if (equippedItem) {
                slot.innerHTML = `
                    <img src="img/icons/items/${equippedItem.icon}" alt="${equippedItem.name}" class="item item-icon ${equippedItem.itemTier} ${equippedItem.type}" data-item='${JSON.stringify(equippedItem)}' draggable="true" onerror="this.src='img/icons/items/default.svg';">
                    <span class="item-label ${equippedItem.itemTier}">${slotName}</span>
                `;
                slot.classList.remove('empty');
                slot.classList.add('equipped');
            } else {
                slot.innerHTML = '';
                slot.classList.add('empty');
                slot.classList.remove('equipped');
            }
        });

        const inventoryDiv = document.getElementById('inventory');
        inventoryDiv.innerHTML = `
            <h2>Inventory Items</h2>
            <div class="inventory-item-wrapper">
                ${inventory.items.length ? inventory.items.map((item, index) => `
                    <div class="inventory-item">
                        <p class="inventory-slot ${item.itemTier} ${item.type}">
                            <img src="img/icons/items/${item.icon}" alt="${item.name}" class="item item-icon ${item.itemTier} ${item.type}" data-item='${JSON.stringify(item)}' data-index='${index}' draggable="true" onerror="this.src='img/icons/items/default.svg';">
                            <span class="item-label ${item.itemTier}">${item.type}</span>
                        </p>
                    </div>
                `).join('') : '<p>Inventory empty.</p>'}
            </div>
        `;
        console.log('Character stats and inventory updated:', { stats: Object.assign({}, stats), inventory: Object.assign({}, inventory), resource: Object.assign({}, resource) });

        // Reattach drag-and-drop listeners after rendering
        this.setupDragAndDrop();
    }

    addLogMessage({ message }) {
        const overlayState = this.entityManager.getEntity('overlayState').getComponent('OverlayState');
        overlayState.logMessages.unshift(message);
        if (overlayState.logMessages.length > 50) overlayState.logMessages.pop();
        if (overlayState.isOpen && overlayState.activeTab === 'log') {
            this.renderOverlay('log');
        }
    }

    updateUI({ entityId }) {
        console.log("UISystem.updateUI() called for: ", entityId); 
        if (entityId !== 'player') return;
       
        const player = this.entityManager.getEntity('player');
        console.log("UISystem.updateUI() called for Player : ", player); 
        const stats = player.getComponent('Stats');
        const health = player.getComponent('Health');
        const mana = player.getComponent('Mana');
        const inventory = player.getComponent('Inventory');
        const playerState = player.getComponent('PlayerState');
        const resource = player.getComponent('Resource');

        console.log('UI update data raw:', { stats: Object.assign({}, stats), health: Object.assign({}, health), mana: Object.assign({}, mana), inventory: Object.assign({}, inventory), playerState: Object.assign({}, playerState), resource: Object.assign({}, resource) });

        this.playerInfo.innerHTML = `
            <div class="player-info-child">Player: ${playerState.name}</div>
            <div class="player-info-child">Level: ${playerState.level}</div>
            <div class="player-info-child">Dungeon Tier: ${this.entityManager.getEntity('gameState').getComponent('GameState').tier}</div>
            <div class="player-info-child">Gold: ${inventory.gold !== undefined ? inventory.gold : 'N/A'}</div>
        `;

        this.playerStatus.innerHTML = `
            <div class="player-status-child">Heal Potions: ${resource.healPotions}</div>
            <div class="player-status-child bar">
                <div class="progress-bar">
                    <div class="progress-fill hp-fill" style="width: ${(health.hp / health.maxHp) * 100}%"></div>
                </div>
                HP: ${health.hp}/${health.maxHp}
            </div>
            <div class="player-status-child bar">
                <div class="progress-bar">
                    <div class="progress-fill mana-fill" style="width: ${(mana.mana / mana.maxMana) * 100}%"></div>
                </div>
                Mana: ${mana.mana}/${mana.maxMana}
            </div>
            <div class="player-status-child bar">
                <div class="progress-bar">
                    <div class="progress-fill xp-fill" style="width: ${(playerState.xp / playerState.nextLevelXp) * 100}%"></div>
                </div>
                XP: ${playerState.xp}/${playerState.nextLevelXp}
            </div>
            <div class="player-status-child">Torches: ${resource.torches}</div>
        `;

        const overlayState = this.entityManager.getEntity('overlayState').getComponent('OverlayState');
        if (overlayState.isOpen && overlayState.activeTab === 'character') {
            this.renderOverlay('character'); // Force render if character tab is open
        }
    }

    // Add drag-and-drop setup method
    setupDragAndDrop() {
        // Handle drag start for inventory items
        const inventoryItems = document.querySelectorAll('.inventory-item .item-icon');
        inventoryItems.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                const itemData = JSON.parse(e.target.getAttribute('data-item'));
                const index = e.target.getAttribute('data-index');
                e.dataTransfer.setData('text/plain', JSON.stringify({ item: itemData, index, source: 'inventory' }));
                console.log('Dragging item:', itemData);
            });
        });

        // Handle drag start for equipped items (to unequip)
        const equippedItems = document.querySelectorAll('.equip-slot .item-icon');
        equippedItems.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                const itemData = JSON.parse(e.target.getAttribute('data-item'));
                const slotElement = e.target.closest('.equip-slot');
                const slotData = JSON.parse(slotElement.getAttribute('data-equip_slot') || '{}');
                const slotName = slotData.slot;
                e.dataTransfer.setData('text/plain', JSON.stringify({ item: itemData, slot: slotName, source: 'equip' }));
                console.log('Dragging equipped item:', itemData, 'from slot:', slotName);
            });
        });

        // Make equip slots drop zones
        const equipSlots = document.querySelectorAll('.equip-slot');
        equipSlots.forEach(slot => {
            slot.addEventListener('dragover', (e) => {
                e.preventDefault(); // Allow drop
            });

            slot.addEventListener('dragenter', (e) => {
                e.preventDefault();
                slot.classList.add('drag-over'); // Use existing CSS if defined
            });

            slot.addEventListener('dragleave', () => {
                slot.classList.remove('drag-over');
            });

            slot.addEventListener('drop', (e) => {
                e.preventDefault();
                slot.classList.remove('drag-over');
                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                const slotData = JSON.parse(slot.getAttribute('data-equip_slot') || '{}');
                const slotName = slotData.slot;

                if (data.source === 'inventory') {
                    // Equip item from inventory
                    const item = data.item;
                    const index = data.index;
                    if (this.isSlotCompatible(item, slotName)) {
                        this.eventBus.emit('EquipItem', { entityId: 'player', item, slot: slotName });
                        this.updateUI({ entityId: 'player' }); // Force immediate UI update
                        console.log(`Dropped ${item.name} into ${slotName}`);
                    } else {
                        this.eventBus.emit('LogMessage', { message: `Cannot equip ${item.name} to ${slotName}!` });
                    }
                } else if (data.source === 'equip') {
                    // Unequip by dropping to another slot is not supported; use inventory drop
                    console.log(`Unequip not supported by dragging to another slot; drop back to inventory to unequip.`);
                }
            });
        });

        // Allow dropping back to inventory to unequip
        const inventoryWrapper = document.querySelector('.inventory-item-wrapper');
        if (inventoryWrapper) {
            inventoryWrapper.addEventListener('dragover', (e) => {
                e.preventDefault();
            });

            inventoryWrapper.addEventListener('dragenter', (e) => {
                e.preventDefault();
                inventoryWrapper.classList.add('drag-over'); // Use existing CSS if defined
            });

            inventoryWrapper.addEventListener('dragleave', () => {
                inventoryWrapper.classList.remove('drag-over');
            });

            inventoryWrapper.addEventListener('drop', (e) => {
                e.preventDefault();
                inventoryWrapper.classList.remove('drag-over');
                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                if (data.source === 'equip') {
                    this.eventBus.emit('UnequipItem', { entityId: 'player', slot: data.slot });
                    this.updateUI({ entityId: 'player' }); // Force immediate UI update
                    console.log(`Dropped equipped item from ${data.slot} back to inventory`);
                }
            });
        }
    }

    // Reuse the slot compatibility logic from InventorySystem
    isSlotCompatible(item, slot) {
        const slotMap = {
            amulet: ["amulet"],
            armor: ["armor"],
            ring: ["leftring", "rightring"],
            weapon: ["mainhand", "offhand"]
        };
        const validSlots = slotMap[item.type];
        return validSlots?.includes(slot) || false;
    }
}