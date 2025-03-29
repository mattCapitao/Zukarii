// PlayerInputSystem.js
import { InputStateComponent } from '../core/Components.js';

export class PlayerInputSystem {
    constructor(entityManager, eventBus) {
        this.entityManager = entityManager;
        this.eventBus = eventBus;
        this.keysPressed = {};
        this.keyMap = {
            'w': 'ArrowUp', 'W': 'ArrowUp', 'ArrowUp': 'ArrowUp',
            'a': 'ArrowLeft', 'A': 'ArrowLeft', 'ArrowLeft': 'ArrowLeft',
            's': 'ArrowDown', 'S': 'ArrowDown', 'ArrowDown': 'ArrowDown',
            'd': 'ArrowRight', 'D': 'ArrowRight', 'ArrowRight': 'ArrowRight',
            'i': 'c', 'I': 'c', 'c': 'c', 'C': 'c',
            'l': 'l', 'L': 'l',
            'escape': 'escape', 'Escape': 'escape',
            't': 't', 'T': 't',
            'h': 'h', 'H': 'h',
            ' ': ' ', 'Space': ' '
        };

        this.keydownHandler = (e) => this.handleKeyDown(e);
        this.keyupHandler = (e) => this.handleKeyUp(e);

        window.addEventListener('keydown', this.keydownHandler, { capture: true });
        window.addEventListener('keyup', this.keyupHandler, { capture: true });
        console.log('PlayerInputSystem: Key listeners attached to window');
    }

    async init() {
        const player = this.entityManager.getEntity('player');
        if (!player.hasComponent('InputState')) {
            this.entityManager.addComponentToEntity('player', new InputStateComponent());
        }
        console.log('PlayerInputSystem initialized');
    }

    handleKeyDown(event) {
        console.log('PlayerInputSystem: handleKeyDown - raw key:', event.key);
        const mappedKey = this.keyMap[event.key];
        console.log('PlayerInputSystem: handleKeyDown - mappedKey:', mappedKey);

        if (document.activeElement.id === 'save-name-input' && mappedKey != 'escape') {
            return; // Ignore keypresses when the save-name-input field is focused
        }
        if (event.repeat) return;
        
        if (mappedKey) {
            this.keysPressed[mappedKey] = true;
            this.updateInputState();
            console.log('Key Down:', mappedKey, 'keysPressed:', JSON.stringify(this.keysPressed));
            this.handleNonMovementKeys(event, mappedKey, true);
        }
    }

    handleKeyUp(event) {
        console.log('PlayerInputSystem: handleKeyUp - raw key:', event.key);
        const mappedKey = this.keyMap[event.key];
        console.log('KeyUp Event Fired:', event.key, 'Mapped:', mappedKey);

        
        
        if (mappedKey) {
            if (document.activeElement.id === 'save-name-input' && mappedKey != 'escape') {
                return; // Ignore keypresses when the save-name-input field is focused
            }

            delete this.keysPressed[mappedKey];
            this.updateInputState();
            console.log('Key Up:', mappedKey, 'keysPressed:', JSON.stringify(this.keysPressed));
            if (mappedKey === ' ') {
                this.handleNonMovementKeys(event, mappedKey, false);
            }
        }
    }

    updateInputState() {
        const player = this.entityManager.getEntity('player');
        if (player) {
            const inputState = player.getComponent('InputState');
            inputState.keys = { ...this.keysPressed };
            console.log('PlayerInputSystem: InputState updated with keys:', JSON.stringify(inputState.keys));
        }
    }

    handleNonMovementKeys(event, mappedKey, isKeyDown) {
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');

        if (!gameState || gameState.gameOver || event.repeat) return;

        if (!gameState.gameStarted) {
            gameState.gameStarted = true;
            gameState.needsRender = true;
            this.eventBus.emit('ToggleBackgroundMusic', { play: true });
            this.eventBus.emit('RenderNeeded');
            return;
        }

            switch (mappedKey) {
                case 'c':
                    this.eventBus.emit('ToggleOverlay', { tab: 'character' });
                    break;
                case 'l':
                    this.eventBus.emit('ToggleOverlay', { tab: 'log' });
                    break;
                case 'escape':
                    this.eventBus.emit('ToggleOverlay', {});
                    break;
                case 't':
                    this.eventBus.emit('LightTorch');
                    this.eventBus.emit('RenderNeeded');
                    break;
                case 'h':
                    this.eventBus.emit('DrinkHealPotion');
                    break;
                case ' ':
                    event.preventDefault();
                    this.eventBus.emit('ToggleRangedMode', { event });
                    console.log('PlayerInputSystem: Emitting ToggleRangedMode - event:', event.type, 'key:', event.key);
                    break;
            
        }
    }

    update() { }

    destroy() {
        window.removeEventListener('keydown', this.keydownHandler, { capture: true });
        window.removeEventListener('keyup', this.keyupHandler, { capture: true });
        console.log('PlayerInputSystem destroyed, listeners removed');
    }
}