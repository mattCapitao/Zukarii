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
        console.log('DialogueUISystem: DOM elements', {
            dialogueWindow: this.dialogueWindow,
            dialogueButtons: this.dialogueButtons,
            dialogueText: this.dialogueText
        });
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
            console.log('DialogueUISystem: Click event on dialogue-buttons', event.target);
            const button = event.target.closest('button');
            if (!button) {
                console.log('DialogueUISystem: No button found for click');
                return;
            }

            const action = button.dataset.action;
            const params = button.dataset.params ? JSON.parse(button.dataset.params) : {};

            const player = this.entityManager.getEntity('player');
            let intent = player.getComponent('InteractionIntent') || new InteractionIntentComponent();
            intent.intents.push({ action, params });
            player.addComponent(intent);
            console.log(`DialogueUISystem: Added ${action} intent`, params);

            if (action !== 'closeDialogue') {
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
                    console.log('DialogueUISystem: Closed dialogue after 600ms timeout');
                }, 10000);
            } else {
                const dialogue = this.entityManager.getEntity('dialogueState').getComponent('Dialogue');
                dialogue.isOpen = false;
                dialogue.text = '';
                dialogue.options = [];
                dialogue.npcId = '';
                dialogue.dialogueStage = 'greeting';
                this.lastRenderedText = null;
                this.lastRenderedOptions = null;
                console.log('DialogueUISystem: Closed dialogue via button click');
            }
        });
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
            this.dialogueButtons.style.display = 'block';
            this.dialogueText.style.display = 'block';
            this.lastRenderedText = dialogue.text;
            this.lastRenderedOptions = optionsString;
            console.log('DialogueUISystem: Rendered dialogue, text:', dialogue.text, 'options:', dialogue.options, 'window display:', this.dialogueWindow.style.display);
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
        console.log('DialogueUISystem: Destroyed');
    }
}