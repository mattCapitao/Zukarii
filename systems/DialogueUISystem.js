import { System } from '../core/Systems.js';
import { DialogueComponent, InteractionIntentComponent } from '../core/Components.js';

export class DialogueUISystem extends System {
    constructor(entityManager, eventBus, utilities, interactionSystem) {
        super(entityManager, eventBus);
        this.requiredComponents = [];
        this.utilities = utilities;
        this.interactionSystem = interactionSystem;
        this.dialogueWindow = document.getElementById('dialogue-window');
        this.dialogueButtons = document.getElementById('dialogue-buttons');
        this.dialogueText = document.getElementById('dialogue-text');
        this.closeTimeout = null;
        this.lastRenderedText = null;
        this.lastRenderedOptions = null;
        //console.log('DialogueUISystem: DOM elements', {dialogueWindow: this.dialogueWindow,dialogueButtons: this.dialogueButtons,dialogueText: this.dialogueText});
        if (!this.dialogueButtons) {
            console.error('DialogueUISystem: Failed to find dialogue-buttons element');
        }
        if (!this.dialogueText) {
            console.error('DialogueUISystem: Failed to find dialogue-text element');
        }
        if (!this.dialogueWindow) {
            console.error('DialogueUISystem: Failed to find dialogue-window element');
        }
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        if (!this.dialogueButtons) {
            console.error('DialogueUISystem: Cannot setup event listeners, dialogue-buttons element is missing');
            return;
        }
        this.dialogueButtons.addEventListener('click', (event) => {
            //console.log('DialogueUISystem: Click event on dialogue-buttons', event.target);
            const button = event.target.closest('button');
            if (!button) {
                //console.log('DialogueUISystem: No button found for click');
                return;
            }

            const action = button.dataset.action;
            const params = button.dataset.params ? JSON.parse(button.dataset.params) : {};

            const player = this.entityManager.getEntity('player');
            let intent = player.getComponent('InteractionIntent') || new InteractionIntentComponent();
            intent.intents.push({ action, params });
            player.addComponent(intent);
            //console.log(`DialogueUISystem: Added ${action} intent`, params);

            if (action !== 'closeDialogue' && action !== 'openShop') {
                this.refreshDialogueTimeout();
            } else {
                const dialogue = this.entityManager.getEntity('dialogueState').getComponent('Dialogue');
                dialogue.isOpen = false;
                dialogue.text = '';
                dialogue.options = [];
                dialogue.npcId = '';
                dialogue.dialogueStage = 'greeting';
                this.lastRenderedText = null;
                this.lastRenderedOptions = null;
                //console.log('DialogueUISystem: Closed dialogue via button click');
            }
        });

        this.eventBus.on('DialogueMessage', ({ message }) => {
            const dialogue = this.entityManager.getEntity('dialogueState').getComponent('Dialogue');
            console.log('DialogueUISystem: Received DialogueMessage', { message, dialogue });
            if (!dialogue) return;

            // If message is an object (from a trigger area)
            if (typeof message === 'object' && message !== null && message.message) {
                dialogue.text = message.message;
                dialogue.options = [{ label: 'Close', action: 'closeDialogue', params: {} }];
                console.log('DialogueUISystem: processing options', message.options);
                if (message.options && Array.isArray(message.options)) {
                    message.options.forEach(option => {
                        if (option.label && option.action) {
                            dialogue.options.push({
                                label: option.label,
                                action: option.action,
                                params: option.params || {}
                            });
                        }
                    });
                }
                console.log('DialogueUISystem: Updated dialogue with trigger message', { message, dialogue });
                dialogue.isOpen = true;
                dialogue.dialogueStage = 'greeting';
                //console.log(`DialogueUISystem: Updated dialogue for trigger message`, { message });
                this.refreshDialogueTimeout();
            }
            // If message is a string (legacy/NPC)
            else if (typeof message === 'string') {
                if (message.includes('delivered') || message.includes('completed')) {
                    dialogue.text = message;
                    dialogue.options = [{ label: 'Close', action: 'closeDialogue', params: {} }];
                    dialogue.isOpen = true;
                    dialogue.dialogueStage = 'taskCompletion';
                    //console.log(`DialogueUISystem: Updated dialogue for completion message`, { message });
                    this.refreshDialogueTimeout();
                } else {
                    /*
                    dialogue.text = message;
                    dialogue.options = [{ label: 'Close', action: 'closeDialogue', params: {} }];
                    dialogue.isOpen = true;
                    dialogue.dialogueStage = 'greeting';
                    //console.log(`DialogueUISystem: Updated dialogue for string message`, { message });
                    this.refreshDialogueTimeout();
                    */
                }
            }
        });

    }
    refreshDialogueTimeout() {
        if (this.closeTimeout) {
            clearTimeout(this.closeTimeout);
        }
        this.closeTimeout = setTimeout(() => {
            const dialogue = this.entityManager.getEntity('dialogueState').getComponent('Dialogue');
            dialogue.isOpen = false;
            dialogue.text = '';
            dialogue.options = [];
            dialogue.npcId = '';
            dialogue.dialogueStage = 'greeting';
            this.closeTimeout = null;
            this.lastRenderedText = null;
            this.lastRenderedOptions = null;
            //console.log('DialogueUISystem: Closed dialogue after 30000ms timeout');
        }, 30000);
    }


    update(deltaTime) {
        const dialogue = this.entityManager.getEntity('dialogueState').getComponent('Dialogue');
        if (!dialogue) {
            console.error('DialogueUISystem: Dialogue component not found on dialogueState');
            return;
        }
        this.renderDialogue(dialogue);
    }

    renderDialogue(dialogue) {
        const optionsString = JSON.stringify(dialogue.options);
        const needsRender = dialogue.isOpen && (
            this.lastRenderedText !== dialogue.text ||
            this.lastRenderedOptions !== optionsString
        );

        if (dialogue.isOpen && needsRender) {
            this.dialogueText.innerHTML = this.utilities.encodeHTMLEntities(dialogue.text);
            this.dialogueButtons.innerHTML = '';

            dialogue.options.forEach((option, index) => {
                const button = document.createElement('button');
                button.textContent = option.label;
                button.dataset.action = option.action;
                button.dataset.params = JSON.stringify(option.params || {});
                button.className = 'dialogue-button';
                this.dialogueButtons.appendChild(button);
            });
          
            this.dialogueWindow.style.display = 'flex';
            this.dialogueButtons.style.display = 'flex';
            this.dialogueText.style.display = 'flex';

            if (dialogue.npcId) {
                const npc = this.entityManager.getEntity(dialogue.npcId);
                if (npc && npc.hasComponent('Position')) {
                    const npcPos = npc.getComponent('Position');
                    const player = this.entityManager.getEntity('player');
                    const playerPos = player.getComponent('Position');
                    const canvas = document.getElementById('viewport-canvas');
                    const SCALE_FACTOR = 2;
                    const TILE_SIZE = 32;
                    const mapWidth = 122 * TILE_SIZE;
                    const mapHeight = 67 * TILE_SIZE;

                    const viewportWidth = canvas.width / SCALE_FACTOR;
                    const viewportHeight = canvas.height / SCALE_FACTOR;

                    let startX = playerPos.x - viewportWidth / 2;
                    let startY = playerPos.y - viewportHeight / 2;
                    startX = Math.max(0, Math.min(startX, mapWidth - viewportWidth));
                    startY = Math.max(0, Math.min(startY, mapHeight - viewportHeight));

                    const screenX = (npcPos.x - startX) * SCALE_FACTOR;
                    const screenY = (npcPos.y - startY) * SCALE_FACTOR;

                    // Clamp to viewport if needed
                    const dialogueWidth = this.dialogueWindow.offsetWidth;
                    const dialogueHeight = this.dialogueWindow.offsetHeight;
                    const maxX = canvas.width - dialogueWidth;
                    const maxY = canvas.height - dialogueHeight;

                    const X_OFFSET = 48; // pixels to the right
                    const Y_OFFSET = 64; // pixels down

                    let left = Math.max(0, Math.min(screenX + X_OFFSET, maxX));
                    let top = Math.max(0, Math.min(screenY - dialogueHeight - 20 + Y_OFFSET, maxY));

                    this.dialogueWindow.style.position = 'absolute';
                    this.dialogueWindow.style.left = `${left}px`;
                    this.dialogueWindow.style.top = `${top}px`;
                }
            }

            this.lastRenderedText = dialogue.text;
            this.lastRenderedOptions = optionsString;
            //console.log('DialogueUISystem: Rendered dialogue, text:', dialogue.text, 'options:', dialogue.options, 'window display:', this.dialogueWindow.style.display);
        } else if (!dialogue.isOpen) {
            this.dialogueWindow.style.display = 'none';
            this.dialogueButtons.style.display = 'none';
            this.dialogueText.style.display = 'none';
            this.lastRenderedText = null;
            this.lastRenderedOptions = null;
        }
    }

    destroy() {
        this.dialogueButtons.innerHTML = '';
        this.dialogueText.innerHTML = '';
        this.dialogueWindow.style.display = 'none';
        this.dialogueButtons.style.display = 'none';
        this.dialogueText.style.display = 'none';
        if (this.closeTimeout) {
            clearTimeout(this.closeTimeout);
            this.closeTimeout = null;
        }
        //console.log('DialogueUISystem: Destroyed');
    }
}