import { System } from '../core/Systems.js';
import { DialogueComponent } from '../core/Components.js';

export class DialogueUISystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Dialogue'];
        this.uiLayer = document.getElementById('ui-layer');
        if (!this.uiLayer) {
            console.error('DialogueUISystem: #ui-layer element not found');
        }
    }

    init() {
        this.eventBus.on('OpenDialogue', (data) => this.openDialogue(data));
        this.eventBus.on('CloseDialogue', () => this.closeDialogue());
        console.log('DialogueUISystem: Initialized');
    }

    update(deltaTime) {
        // No per-frame updates needed; DOM events handle interactions
    }

    openDialogue({ npcId, text, shopDialogueText }) {
        const dialogueState = this.entityManager.getEntity('dialogueState');
        if (!dialogueState) {
            console.error('DialogueUISystem: dialogueState entity not found');
            return;
        }
        const dialogueComp = dialogueState.getComponent('Dialogue');
        if (dialogueComp.isOpen) {
            this.closeDialogue();
        }

        dialogueComp.npcId = npcId;
        dialogueComp.text = text;
        dialogueComp.isOpen = true;

        const npc = this.entityManager.getEntity(npcId);
        const hasShop = npc && npc.hasComponent('ShopComponent');
        const dialogueText = hasShop ? npc.getComponent('ShopComponent').dialogueText : null;

        const dialogueWindow = document.createElement('div');
        dialogueWindow.id = 'dialogue-window';
        dialogueWindow.innerHTML = `
            <div id="dialogue-text">${text}</div>
            <div id="dialogue-buttons">
                ${hasShop ? `<button id="dialogue-view-wares">${dialogueText}</button>` : ''}
                <button id="dialogue-close">Close</button>
            </div>
        `;
        this.uiLayer.appendChild(dialogueWindow);

        const closeButton = dialogueWindow.querySelector('#dialogue-close');
        closeButton.addEventListener('click', () => {
            this.eventBus.emit('CloseDialogue');
        });

        if (hasShop) {
            const viewWaresButton = dialogueWindow.querySelector('#dialogue-view-wares');
            viewWaresButton.addEventListener('click', () => {
                this.eventBus.emit('ToggleOverlay', { tab: 'shop' });
                this.closeDialogue();
            });
        }

        console.log(`DialogueUISystem: Opened dialogue for NPC ${npcId} with text: "${text}"${hasShop ? ` and View Wares button ("${dialogueText}")` : ''}`);
    }

    closeDialogue() {
        const dialogueState = this.entityManager.getEntity('dialogueState');
        if (!dialogueState) {
            console.error('DialogueUISystem: dialogueState entity not found');
            return;
        }
        const dialogueComp = dialogueState.getComponent('Dialogue');
        dialogueComp.isOpen = false;
        dialogueComp.npcId = '';
        dialogueComp.text = '';

        const dialogueWindow = document.getElementById('dialogue-window');
        if (dialogueWindow) {
            dialogueWindow.remove();
        }

        console.log('DialogueUISystem: Closed dialogue');
    }

    destroy() {
        this.closeDialogue();
        this.eventBus.off('OpenDialogue');
        this.eventBus.off('CloseDialogue');
        console.log('DialogueUISystem: Destroyed');
    }
}