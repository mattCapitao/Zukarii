// systems/UISystem.js
import { System } from '../core/Systems.js';

export class UISystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus, utilities);
        this.requiredComponents = ['OverlayState'];
        this.playerInfo = null;
        this.playerStatus = null;
        this.tabs = null;
        this.logContent = null;
        this.characterContent = null;
        this.menuContent = null;
        this.activeMenuSection = 'controls-button'; // Default to 'controls'
        this.tooltipCache = new Map();

        this.statusDOM = {
            hpBar: null,
            hpText: null,
            manaBar: null,
            manaText: null,
            xpBar: null,
            xpText: null,
            healPotionCount: null,
            torchCount: null
        };

        this.statusUpdates = {};
        this.needsUpdate = false;
        this.rafPending = null;
    }

    init() {
        this.playerInfo = document.getElementById('player-info');
        this.playerStatus = document.getElementById('player-status');
        this.tabs = document.getElementById('tabs');
        this.logContent = document.getElementById('log-content');
        this.characterContent = document.getElementById('character-content');
        this.menuContent = document.getElementById('menu-content');

        if (!this.playerInfo || !this.playerStatus || !this.tabs || !this.logContent || !this.characterContent || !this.menuContent) {
            console.log("Menu", this.menuContent);
            throw new Error('UI elements not found');
        }

        this.statusDOM.hpBar = this.playerStatus.querySelector('#hpBar');
        this.statusDOM.hpText = this.playerStatus.querySelector('#hpText');
        this.statusDOM.manaBar = this.playerStatus.querySelector('#manaBar');
        this.statusDOM.manaText = this.playerStatus.querySelector('#manaText');
        this.statusDOM.xpBar = this.playerStatus.querySelector('#xpBar');
        this.statusDOM.xpText = this.playerStatus.querySelector('#xpText');
        this.statusDOM.healPotionCount = this.playerStatus.querySelector('#healPotionCount');
        this.statusDOM.torchCount = this.playerStatus.querySelector('#torchCount');

        if (!this.statusDOM.hpBar || !this.statusDOM.hpText ||
            !this.statusDOM.manaBar || !this.statusDOM.manaText ||
            !this.statusDOM.xpBar || !this.statusDOM.xpText ||
            !this.statusDOM.healPotionCount || !this.statusDOM.torchCount) {
            throw new Error('Player status elements not found');
        }

        // EventBus listeners
        this.eventBus.on('ToggleOverlay', (data) => this.toggleOverlay(data));
        this.eventBus.on('LogMessage', (data) => {
            console.log('UISystem: LogMessage event received:', data);
            this.addLogMessage(data);
        });
        this.eventBus.on('StatsUpdated', (data) => this.updateUI(data));
        this.eventBus.on('GameOver', (data) => this.gameOver(data));
        this.eventBus.on('GearChanged', (data) => this.updateUI(data));
        this.eventBus.on('GameSaved', ({ key, success, message }) => {
            console.log('UISystem: GameSaved event received:', { key, success, message });
            this.eventBus.emit('LogMessage', { message });
            if (success) {
                this.updateMenu();
            }
        });
        this.eventBus.on('GameLoaded', ({ saveId, success, message }) => {
            console.log('UISystem: GameLoaded event received:', { saveId, success, message });
            this.eventBus.emit('LogMessage', { message });
        });
        this.eventBus.on('SaveCompleted', ({ key, success, message }) => {
            console.log('UISystem: SaveCompleted event received:', { key, success, message });
            this.eventBus.emit('LogMessage', { message });
            if (success) {
                this.updateMenu();
            }
        });

        // Initial render
        this.updateUI({ entityId: 'player' });
        this.eventBus.emit('GearChanged', { entityId: 'player' });

        // Setup all event listeners once during init
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Menu buttons (delegated listener for menu section buttons)
        const menuButtons = document.getElementById('menu-buttons');
        if (menuButtons) {
            menuButtons.addEventListener('click', (event) => {
                const button = event.target.closest('button');
                if (button) {
                    this.activeMenuSection = button.id;
                    this.updateMenu();
                }
            });
        }

        // Save/load/delete buttons (delegated listener for menu-data-wrapper)
        const menuDataWrapper = document.getElementById('menu-data-wrapper');
        if (menuDataWrapper) {
            menuDataWrapper.addEventListener('click', (event) => {
                const saveButton = event.target.closest('.save-game');
                const overwriteButton = event.target.closest('.overwrite-game');
                const loadButton = event.target.closest('.load-game');
                const deleteButton = event.target.closest('.delete-game');

                if (saveButton) {
                    const saveId = saveButton.dataset.saveId === 'new' ? null : saveButton.dataset.saveId;
                    this.eventBus.emit('RequestSaveGame', { saveId });
                }

                if (overwriteButton) {
                    const saveId = overwriteButton.dataset.saveId;
                    this.eventBus.emit('RequestSaveGame', { saveId });
                }

                if (loadButton && !loadButton.disabled) {
                    const saveId = loadButton.dataset.saveId;
                    this.eventBus.emit('RequestLoadGame', { saveId }, (result) => {
                        if (result.success) {
                            window.restartGame(saveId);
                        }
                    });
                }

                if (deleteButton) {
                    const saveId = deleteButton.dataset.saveId;
                    this.eventBus.emit('DeleteSave', { saveId });
                    this.updateMenu();
                }
            });
        }

        // Tab buttons (delegated listener for tab-menu)
        const tabMenu = document.getElementById('tab-menu');
        if (tabMenu) {
            tabMenu.addEventListener('click', (event) => {
                const target = event.target;
                if (target.id === 'menu-tab') {
                    this.toggleOverlay({ tab: 'menu' });
                } else if (target.id === 'character-tab') {
                    this.toggleOverlay({ tab: 'character' });
                } else if (target.id === 'log-tab') {
                    this.toggleOverlay({ tab: 'log' });
                } else if (target.id === 'close-tabs') {
                    this.toggleOverlay({});
                }
            });
        }

        // Inventory drag-and-drop and discard
        const inventory = document.getElementById('inventory');
        if (inventory) {
            inventory.addEventListener('dragstart', (event) => {
                const target = event.target.closest('.item-icon');
                if (!target) return;
                const itemData = JSON.parse(target.getAttribute('data-item') || '{}');
                const index = parseInt(target.closest('.inventory-item').dataset.index, 10);
                event.dataTransfer.setData('text/plain', JSON.stringify({ item: itemData, index, source: 'inventory' }));
                this.hideItemTooltip(itemData);
            }, { capture: true });

            inventory.addEventListener('dragover', (e) => e.preventDefault());
            inventory.addEventListener('drop', (e) => {
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
                }
            });

            inventory.addEventListener('contextmenu', (event) => {
                event.preventDefault();
                const target = event.target.closest('.inventory-item');
                if (!target) return;
                const index = parseInt(target.dataset.index, 10);
                if (isNaN(index)) return;
                const itemElement = event.target.closest('.item-icon');
                if (itemElement) {
                    const itemData = JSON.parse(itemElement.getAttribute('data-item') || '{}');
                    this.hideItemTooltip(itemData);
                }
                this.eventBus.emit('DropItem', { itemIndex: index });
            });
        }

        // Equip drag-and-drop
        const equippedItems = document.getElementById('equipped-items');
        if (equippedItems) {
            equippedItems.addEventListener('dragstart', (event) => {
                const slot = event.target.closest('.equip-slot');
                if (!slot) return;
                const itemElement = event.target.closest('.item-icon');
                if (!itemElement) return;
                const itemData = JSON.parse(itemElement.getAttribute('data-item') || '{}');
                const slotName = JSON.parse(slot.getAttribute('data-equip_slot') || '{}').slot;
                event.dataTransfer.setData('text/plain', JSON.stringify({ item: itemData, slot: slotName, source: 'equip' }));
                this.hideItemTooltip(itemData);
            });

            equippedItems.addEventListener('dragover', (e) => e.preventDefault());
            equippedItems.addEventListener('drop', (e) => {
                e.preventDefault();
                const slot = e.target.closest('.equip-slot');
                if (!slot) return;
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
                }
            });
        }

        // Tooltip listeners
        const characterContent = document.getElementById('character-content');
        if (characterContent) {
            characterContent.addEventListener('mouseover', (event) => {
                const target = event.target.closest('.item-icon');
                if (!target) return;
                const itemData = JSON.parse(target.getAttribute('data-item') || '{}');
                this.showItemTooltip(itemData, event);
            }, { capture: true });

            characterContent.addEventListener('mouseout', (event) => {
                const target = event.target.closest('.item-icon');
                if (!target) return;
                const itemData = JSON.parse(target.getAttribute('data-item') || '{}');
                this.hideItemTooltip(itemData);
            }, { capture: true });

            characterContent.addEventListener('dragstart', (event) => {
                const target = event.target.closest('.item-icon');
                if (!target) return;
                const itemData = JSON.parse(target.getAttribute('data-item') || '{}');
                this.hideItemTooltip(itemData);
            }, { capture: true });

            characterContent.addEventListener('contextmenu', (event) => {
                const target = event.target.closest('.item-icon');
                if (!target) return;
                const itemData = JSON.parse(target.getAttribute('data-item') || '{}');
                this.hideItemTooltip(itemData);
            }, { capture: true });
        }

        // Stat increment listeners
        const statWrapper = document.getElementById('character-stat-wrapper');
        if (statWrapper) {
            statWrapper.addEventListener('click', (event) => {
                const target = event.target.closest('.increment:not(.hidden)');
                if (!target) return;

                const currentStats = this.entityManager.getEntity('player').getComponent('Stats');
                if (currentStats.unallocated < 1 || currentStats.isLocked) {
                    return;
                }

                const statId = target.id;
                if (!statId) return;
                const stat = statId.replace('increment-', '');
                this.eventBus.emit('AllocateStat', { stat });
            });
        }

        // Game over buttons
        const gameOver = document.getElementById('game-over');
        if (gameOver) {
            gameOver.addEventListener('click', (event) => {
                const target = event.target;
                if (target.id === 'view-log') {
                    this.toggleOverlay({ tab: 'log' });
                } else if (target.id === 'restart-button') {
                    location.reload(true);
                } else if (target.id === 'menu') {
                    // Menu hook
                }
            });
        }
    }

    applyStatusUpdates() {
        if (this.statusUpdates.hp) {
            this.statusDOM.hpText.textContent = `${this.statusUpdates.hp.value}/${this.statusUpdates.hp.max}`;
            this.statusDOM.hpBar.style.width = `${(this.statusUpdates.hp.value / this.statusUpdates.hp.max) * 100}%`;
        }
        if (this.statusUpdates.mana) {
            this.statusDOM.manaText.textContent = `${this.statusUpdates.mana.value}/${this.statusUpdates.mana.max}`;
            this.statusDOM.manaBar.style.width = `${(this.statusUpdates.mana.value / this.statusUpdates.mana.max) * 100}%`;
        }
        if (this.statusUpdates.xp) {
            this.statusDOM.xpText.textContent = `${this.statusUpdates.xp.value}/${this.statusUpdates.xp.next}`;
            this.statusDOM.xpBar.style.width = `${(this.statusUpdates.xp.value / this.statusUpdates.xp.next) * 100}%`;
        }
        if (this.statusUpdates.healPotions !== undefined) {
            this.statusDOM.healPotionCount.textContent = this.statusUpdates.healPotions;
        }
        if (this.statusUpdates.torches !== undefined) {
            this.statusDOM.torchCount.textContent = this.statusUpdates.torches;
        }
        this.statusUpdates = {};
    }

    toggleOverlay({ tab = null }) {
        const overlayState = this.entityManager.getEntity('overlayState').getComponent('OverlayState');
        const currentTab = overlayState.activeTab;

        if (tab === currentTab || !tab) {
            overlayState.isOpen = !overlayState.isOpen;
            overlayState.activeTab = overlayState.isOpen ? (currentTab || 'menu') : null;
        } else {
            overlayState.isOpen = true;
            overlayState.activeTab = tab;
        }

        this.tabs.style.display = overlayState.isOpen ? 'block' : 'none';
        this.tabs.className = overlayState.isOpen ? '' : 'hidden';
        if (overlayState.isOpen) {
            this.renderOverlay(overlayState.activeTab);
        }
    }

    renderOverlay(tab) {
        const overlayState = this.entityManager.getEntity('overlayState').getComponent('OverlayState');
        const player = this.entityManager.getEntity('player');
        const stats = player.getComponent('Stats');
        const health = player.getComponent('Health');
        const mana = player.getComponent('Mana');
        const inventory = player.getComponent('Inventory');
        const playerState = player.getComponent('PlayerState');
        const resource = player.getComponent('Resource');

        this.overlayTabButtons(tab);
        this.menuContent.style.display = tab === 'menu' ? 'flex' : 'none';
        this.logContent.style.display = tab === 'log' ? 'block' : 'none';
        this.characterContent.style.display = tab === 'character' ? 'flex' : 'none';

        if (tab === 'log') {
            this.updateLog(overlayState.logMessages);
        } else if (tab === 'character') {
            this.updateCharacter(stats, inventory);
        } else if (tab === 'menu') {
            this.activeMenuSection = 'controls-button';
            this.updateMenu();
        }
    }

    overlayTabButtons(activeTab) {
        const tabMenuDiv = document.getElementById('tab-menu');
        if (!tabMenuDiv) return;

        tabMenuDiv.innerHTML = `
            <button id="menu-tab" class="tabs-button" style="background: ${activeTab === 'menu' ? '#0f0' : '#2c672c'};">Menu</button>
            <button id="character-tab" class="tabs-button" style="background: ${activeTab === 'character' ? '#0f0' : '#2c672c'}; ">Character</button>
            <button id="log-tab" class="tabs-button" style="background: ${activeTab === 'log' ? '#0f0' : '#2c672c'};">Log</button>
            <button id="close-tabs">X</button>
        `;
    }

    updateMenu() {
        const menuSections = {
            'controls-button': 'controls-data',
            'map-key-button': 'map-key-data',
            'options-button': 'options-data',
            'save-games-button': 'save-games-data',
            'load-games-button': 'load-games-data',
            'restart-button': 'new-game-data',
            'credits-button': 'credits-data'
        };

        const menuDataWrapper = document.getElementById('menu-data-wrapper');
        if (menuDataWrapper) {
            Object.values(menuSections).forEach(sectionId => {
                const sectionDiv = document.getElementById(sectionId);
                if (sectionDiv) {
                    sectionDiv.style.display = sectionId === menuSections[this.activeMenuSection] ? 'block' : 'none';
                }
            });

            if (this.activeMenuSection === 'save-games-button' || this.activeMenuSection === 'load-games-button') {
                const isSaveMode = this.activeMenuSection === 'save-games-button';
                const targetDiv = document.getElementById(isSaveMode ? 'save-games-data' : 'load-games-data');
                if (targetDiv) {
                    this.eventBus.emit('GetSavedGamesMetadata', (metadata) => {
                        let html = `<h3>${isSaveMode ? 'Save Game' : 'Load Game'}</h3>`;
                        html += '<ul>';

                        if (isSaveMode) {
                            html += `<li>New Save <button class="save-game" data-save-id="new">Save</button></li>`;
                        }

                        metadata.forEach(save => {
                            if (isSaveMode) {
                                html += `<li>${save.characterName}, Tier ${save.tier} - Saved on ${save.timestamp} <button class="overwrite-game" data-save-id="${save.saveId}">Overwrite</button> <button class="delete-game" data-save-id="${save.saveId}" style="background: red;">Delete</button></li>`;
                            } else {
                                if (save.isDead) {
                                    html += `<li>${save.characterName}, Tier ${save.tier} - Saved on ${save.timestamp} <button class="load-game" data-save-id="${save.saveId}" disabled>Dead</button> <button class="delete-game" data-save-id="${save.saveId}" style="background: red;">Delete</button></li>`;
                                } else {
                                    html += `<li>${save.characterName}, Tier ${save.tier} - Saved on ${save.timestamp} <button class="load-game" data-save-id="${save.saveId}">Load</button> <button class="delete-game" data-save-id="${save.saveId}" style="background: red;">Delete</button></li>`;
                                }
                            }
                        });

                        html += '</ul>';
                        targetDiv.innerHTML = html;
                    });
                }
            }
        }

        const menuButtons = document.getElementById('menu-buttons');
        if (menuButtons) {
            const buttons = menuButtons.querySelectorAll('button');
            buttons.forEach(button => {
                button.style.background = button.id === this.activeMenuSection ? '#0f0' : '#2c672c';
            });
        }

        console.log(`Menu content updated: Active section is ${this.activeMenuSection}`);
    }

    updateLog(logMessages) {
        const logDiv = document.getElementById('log');
        logDiv.innerHTML = logMessages.length
            ? logMessages.slice(0, 200).map(line => `<p>${line}</p>`).join('')
            : '<p>Nothing to log yet.</p>';
    }

    updateCharacter(stats, inventory) {
        const statWrapper = document.getElementById('character-stat-wrapper');

        const statList = [
            { stat: 'intellect', incrementable: true },
            { stat: 'resistMagic', incrementable: false },
            { stat: 'prowess', incrementable: true },
            { stat: 'block', incrementable: false },
            { stat: 'agility', incrementable: true },
            { stat: 'dodge', incrementable: false },
            { stat: 'defense', incrementable: false },
            { stat: 'damageBonus', incrementable: false },
            { stat: 'meleeBonus', incrementable: false },
            { stat: 'rangedBonus', incrementable: false }
        ];

        let statHtml = `
        <div>Stat Points: <span>${stats.unallocated}</span></div>
        <div>Skill Points: <span>0</span></div>
        <div><span class="increment hidden"> </span><span class="stat-value">${stats.armor || 0}</span> : Armor</div>
        <div><span class="increment hidden"> </span><span class="stat-value">${stats.range || 0}</span> : Range</div>
        <div><hr></div><div><hr></div>`;

        statList.forEach(statEntry => {
            const statName = statEntry.stat;
            const isIncrementable = statEntry.incrementable;
            const displayName = this.utilities.camelToTitleCase(statName);
            const statValue = stats[statName] || 0;
            const incrementSpan = isIncrementable
                ? `<span id="increment-${statName}" title="Add point to ${displayName}" class="increment hidden">+</span>`
                : `<span class="increment hidden"> </span>`;
            statHtml += `
            <div>${incrementSpan}<span class="stat-value">${statValue}</span> : ${displayName}</div>`;
        });

        statWrapper.innerHTML = statHtml;

        const canAllocate = stats.unallocated > 0 && !stats.isLocked;
        statList.forEach(statEntry => {
            if (statEntry.incrementable) {
                const incrementSpan = document.getElementById(`increment-${statEntry.stat}`);
                if (incrementSpan) {
                    incrementSpan.classList.toggle('hidden', !canAllocate);
                }
            }
        });

        const equipSlots = document.querySelectorAll('.equip-slot');
        equipSlots.forEach(slot => {
            const slotData = JSON.parse(slot.getAttribute('data-equip_slot') || '{}');
            const slotName = slotData.slot;
            const equippedItem = inventory.equipped[slotName] || null;

            if (equippedItem) {
                slot.innerHTML = `<img src="img/icons/items/${equippedItem.icon}" alt="${equippedItem.name}" 
                class="item item-icon ${equippedItem.itemTier} ${equippedItem.type}" data-item='${JSON.stringify(equippedItem)}' 
                draggable="true" onerror="this.src='img/icons/items/default.svg';">`;
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
                    <div class="inventory-item" data-index="${index}">
                        <p class="inventory-slot ${item.itemTier} ${item.type}">
                            <img src="img/icons/items/${item.icon}" alt="${item.name}" class="item item-icon ${item.itemTier} ${item.type}" data-item='${JSON.stringify(item)}' data-index='${index}' draggable="true">
                            <span class="item-label ${item.itemTier}">${item.type}</span>
                        </p>
                    </div>
                `).join('') : '<p>Inventory empty.</p>'}
            </div>
        `;
    }

    addLogMessage({ message }) {
        const overlayState = this.entityManager.getEntity('overlayState').getComponent('OverlayState');
        overlayState.logMessages.unshift(message);
        console.log('UISystem: Added message to log:', message, 'Current log messages:', overlayState.logMessages);
        if (overlayState.logMessages.length > 200) overlayState.logMessages.pop();
        if (overlayState.isOpen && overlayState.activeTab === 'log') {
            this.renderOverlay('log');
        }
    }

    updateUI({ entityId }) {
        if (entityId !== 'player') return;

        const player = this.entityManager.getEntity('player');
        const health = player.getComponent('Health');
        const mana = player.getComponent('Mana');
        const playerState = player.getComponent('PlayerState');
        const resource = player.getComponent('Resource');
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');

        this.statusUpdates.hp = { value: health.hp, max: health.maxHp };
        this.statusUpdates.mana = { value: mana.mana, max: mana.maxMana };
        this.statusUpdates.xp = { value: playerState.xp, next: playerState.nextLevelXp };
        this.statusUpdates.healPotions = resource.healPotions;
        this.statusUpdates.torches = resource.torches;

        if (!this.needsUpdate) {
            this.needsUpdate = true;
            this.rafPending = requestAnimationFrame(() => {
                this.applyStatusUpdates();
                this.needsUpdate = false;
                this.rafPending = null;
            });
        }

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

        const overlayState = this.entityManager.getEntity('overlayState').getComponent('OverlayState');
        if (overlayState.isOpen && overlayState.activeTab === 'character') {
            this.renderOverlay('character');
        }
    }

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

    gameOver(dataObj) {
        const gameOverDiv = document.getElementById('game-over');
        gameOverDiv.style.display = 'block';

        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        gameOverDiv.classList.add(gameState.isVictory ? 'victory' : 'death');

        document.getElementById('game-over-message').textContent = dataObj.message;
        this.eventBus.emit('GameOverRendered');
    }

    showItemTooltip(itemData, event) {
        if (!itemData || !itemData.uniqueId) {
            return;
        }

        if (!this.tooltipCache) {
            console.error("Tooltip cache not initialized");
            this.tooltipCache = new Map();
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
            name.textContent = this.utilities.encodeHTMLEntities(itemData.name);
            content.appendChild(name);

            const iconContainerParagraph = document.createElement('p');
            iconContainerParagraph.className = `item-tooltip-icon-wrap ${itemData.itemTier}`;
            content.appendChild(iconContainerParagraph);

            const icon = document.createElement('img');
            icon.className = `item-tooltip-icon ${itemData.itemTier}`;
            icon.src = `img/icons/items/${itemData.icon}`;
            icon.alt = itemData.name;
            iconContainerParagraph.appendChild(icon);

            const typeTier = document.createElement('div');
            typeTier.className = 'item-tooltip-type-tier';
            typeTier.textContent = `${itemData.itemTier} ${itemData.type}`;
            content.appendChild(typeTier);

            if (itemData.type === "weapon") {
                const damage = document.createElement('div');
                damage.className = 'item-tooltip-damage';
                damage.textContent = `Damage: ${itemData.baseDamageMin}-${itemData.baseDamageMax}`;
                content.appendChild(damage);
                switch (itemData.attackType) {
                    case "melee":
                        const baseBlock = document.createElement('div');
                        baseBlock.className = 'item-tooltip-base-block';
                        baseBlock.textContent = `Block: ${itemData.baseBlock || 0}`;
                        content.appendChild(baseBlock);
                        break;
                    case "ranged":
                        const baseRange = document.createElement('div');
                        baseRange.className = 'item-tooltip-base-range';
                        baseRange.textContent = `Range: ${itemData.baseRange || 0}`;
                        content.appendChild(baseRange);
                        break;
                }
            } else if (itemData.type === "armor") {
                const armor = document.createElement('div');
                armor.className = 'item-tooltip-armor';
                armor.textContent = `Armor: ${itemData.armor || 0}`;
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
                        const statLine = document.createElement('div');
                        statLine.className = 'tooltip-stat';
                        statLine.textContent = `${value > 0 ? '+' : ''}${value} : ${this.utilities.encodeHTMLEntities(stat)}`;
                        statsContainer.appendChild(statLine);
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
        }, 0);
    }

    hideItemTooltip(itemData) {
        if (!itemData || !itemData.uniqueId) {
            return;
        }
        if (!this.tooltipCache) {
            console.error("Tooltip cache not initialized");
            this.tooltipCache = new Map();
        }
        const tooltip = this.tooltipCache.get(itemData.uniqueId);
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }
}