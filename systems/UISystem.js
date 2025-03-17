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
            this.gameOver(data);
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
                            <img src="img/icons/items/${item.icon}" alt="${item.name}" class="item item-icon ${item.itemTier} ${item.type}" data-item='${JSON.stringify(item)}' data-index='${index}' draggable="true";">
                            <span class="item-label ${item.itemTier}">${item.type}</span>
                        </p>
                    </div>
                `).join('') : '<p>Inventory empty.</p>'}
            </div>
        `;
        console.log('Character stats and inventory updated:', { stats: Object.assign({}, stats), inventory: Object.assign({}, inventory), resource: Object.assign({}, resource) });

        // Reattach drag-and-drop listeners after rendering
        this.setupInventoryDragAndDrop();
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
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');

        console.log('UI update data raw:', { stats: Object.assign({}, stats), health: Object.assign({}, health), mana: Object.assign({}, mana), inventory: Object.assign({}, inventory), playerState: Object.assign({}, playerState), resource: Object.assign({}, resource) });

        // @Grok - REPLACE THIS WITH YOUR CODE TO UPDATE CHILD ELEMENTS OF playerInfo
        if (this.playerInfo) {
            const playerNameSpan = this.playerInfo.querySelector('#playerName');
            const playerLevelSpan = this.playerInfo.querySelector('#playerLevel');
            const dungeonTierSpan = this.playerInfo.querySelector('#dungeonTier');
            const playerGoldSpan = this.playerInfo.querySelector('#playerGold');
            if (playerNameSpan) playerNameSpan.textContent = playerState.name;
            if (playerLevelSpan) playerLevelSpan.textContent = playerState.level;
            if (dungeonTierSpan) dungeonTierSpan.textContent = gameState.tier;
            if (playerGoldSpan) playerGoldSpan.textContent = resource.gold !== undefined ? resource.gold : 'N/A';
        }

        // @Grok - REPLACE THIS WITH YOUR CODE TO UPDATE CHILD ELEMENTS OF playerStatus
        if (this.playerStatus) {
            const healPotionCountSpan = this.playerStatus.querySelector('#healPotionCount');
            const hpTextSpan = this.playerStatus.querySelector('#hpText');
            const manaTextSpan = this.playerStatus.querySelector('#manaText');
            const manaBarDiv = this.playerStatus.querySelector('#manaBar');
            const xpTextSpan = this.playerStatus.querySelector('#xpText');
            const torchCountSpan = this.playerStatus.querySelector('#torchCount');
            const hpBarDiv = this.playerStatus.querySelector('#hpBar');
            const xpBarDiv = this.playerStatus.querySelector('#xpBar');

            if (healPotionCountSpan) healPotionCountSpan.textContent = resource.healPotions;
            if (hpTextSpan) hpTextSpan.textContent = `${health.hp}/${health.maxHp}`;
            if (manaTextSpan) manaTextSpan.textContent = `${mana.mana}/${mana.maxMana}`;
            if (manaBarDiv) manaBarDiv.style.width = `${(mana.mana / mana.maxMana) * 100}%`;
            if (xpTextSpan) xpTextSpan.textContent = `${playerState.xp}/${playerState.nextLevelXp}`;
            if (torchCountSpan) torchCountSpan.textContent = resource.torches;
            if (hpBarDiv) hpBarDiv.style.width = `${(health.hp / health.maxHp) * 100}%`;
            if (xpBarDiv) xpBarDiv.style.width = `${(playerState.xp / playerState.nextLevelXp) * 100}%`;
        }

        const overlayState = this.entityManager.getEntity('overlayState').getComponent('OverlayState');
        if (overlayState.isOpen && overlayState.activeTab === 'character') {
            this.renderOverlay('character'); // Force render if character tab is open
        }
    }

    setupDragAndDrop() {
        this.setupEquipDragAndDrop();
        this.setupInventoryDragAndDrop();
    }

    // Add drag-and-drop setup method
    setupInventoryDragAndDrop() {
        const inventoryItems = document.querySelectorAll('.inventory-item .item-icon');
        inventoryItems.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                const itemData = JSON.parse(e.target.getAttribute('data-item') || '{}');
                const index = e.target.getAttribute('data-index');
                e.dataTransfer.setData('text/plain', JSON.stringify({ item: itemData, index, source: 'inventory' }));
                console.log('Dragging item:', itemData);
            });
        });

        const inventoryWrapper = document.querySelector('.inventory-item-wrapper');
        if (inventoryWrapper) {
            inventoryWrapper.addEventListener('dragover', (e) => e.preventDefault());
            inventoryWrapper.addEventListener('drop', (e) => {
                e.preventDefault();
                const rawData = e.dataTransfer.getData('text/plain');
                let data;
                try {
                    data = JSON.parse(rawData);
                } catch (err) {
                    console.error('Inventory drop failed - invalid data:', rawData, err);
                    return;
                }
                if (data.source === 'equip') {
                    this.eventBus.emit('UnequipItem', { entityId: 'player', slot: data.slot });
                    this.updateUI({ entityId: 'player' });
                    console.log(`Dropped equipped item from ${data.slot} to inventory`);
                }
            });
        }
    }

    setupEquipDragAndDrop() {
        const equipSlots = document.querySelectorAll('.equip-slot');
        equipSlots.forEach(slot => {
            slot.addEventListener('dragstart', (e) => {
                const itemElement = e.target.closest('.item-icon');
                if (!itemElement) return;
                const itemData = JSON.parse(itemElement.getAttribute('data-item') || '{}');
                const slotName = JSON.parse(slot.getAttribute('data-equip_slot') || '{}').slot;
                e.dataTransfer.setData('text/plain', JSON.stringify({ item: itemData, slot: slotName, source: 'equip' }));
                console.log('Dragging equipped item:', itemData);
            });
            slot.addEventListener('dragover', (e) => e.preventDefault());
            slot.addEventListener('drop', (e) => {
                e.preventDefault();
                slot.classList.remove('drag-over');
                const rawData = e.dataTransfer.getData('text/plain');
                let data;
                try {
                    data = JSON.parse(rawData);
                } catch (err) {
                    console.error('Equip drop failed - invalid data:', rawData, err);
                    return;
                }
                const slotName = JSON.parse(slot.getAttribute('data-equip_slot') || '{}').slot;
                if (data.source === 'inventory' && this.isSlotCompatible(data.item, slotName)) {
                    this.eventBus.emit('EquipItem', { entityId: 'player', item: data.item, slot: slotName });
                    this.updateUI({ entityId: 'player' });
                    console.log(`Dropped ${data.item.name} into ${slotName}`);
                }
            });
        });
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

    gameOver(message) {
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const existingGameOver = document.getElementById('game-over');
        if (existingGameOver) existingGameOver.remove();

        const gameOver = document.createElement('div');
        gameOver.id = 'game-over';
        const headline = gameState.isVictory ? '<h1>VICTORY!</h1>' : '<h1>GAME OVER</h1>';
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

        gameOver.classList.add(gameState.isVictory ? 'victory' : 'death');

        const restartButton = document.createElement('button');
        restartButton.id = 'restart-button';
        restartButton.textContent = 'Play Again?';
        restartButton.onclick = () => {
            location.reload(true);
        };
        gameOver.appendChild(restartButton);

        // Emit GameOverRendered once the overlay is fully rendered
        this.eventBus.emit('GameOverRendered');
    }
}