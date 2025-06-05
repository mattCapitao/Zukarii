﻿import { MovementIntentComponent, NeedsRenderComponent } from '../core/Components.js';

const BASE_MOVE_DISTANCE = 32; // Set to your tile size or desired step in pixels

export class PlayerControllerSystem {
    constructor(entityManager, eventBus) {
        this.entityManager = entityManager;
        this.eventBus = eventBus;
        this.lastInputState = {};
    }

    async init() {
        const player = this.entityManager.getEntity('player');
        if (player) {
            this.position = player.getComponent('Position');
            this.VisualsComponent = player.getComponent('Visuals');
        }
        this.eventBus.on('ToggleRangedMode', (data) => this.toggleRangedMode(data));
        this.sfxQueue = this.entityManager.getEntity('gameState').getComponent('AudioQueue').SFX || [];
        this.healthUpdates = this.entityManager.getEntity('gameState').getComponent('DataProcessQueues').HealthUpdates;
        this.TILE_SIZE = 32;
        this.MELEE_RANGE = 1.5 * this.TILE_SIZE;
    }

    update(deltaTime) {
        const player = this.entityManager.getEntity('player');
        if (!player) return;

        const inputState = player.getComponent('InputState');
        const position = player.getComponent('Position');
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        const attackSpeed = player.getComponent('AttackSpeed');
        const mouseTarget = player.getComponent('MouseTarget');
        const playerState = player.getComponent('PlayerState');
        attackSpeed.elapsedSinceLastAttack += deltaTime * 1000;

        if (!gameState || gameState.gameOver || gameState.transitionLock) return;

        // Ranged mode (keyboard input)
        if (gameState.isRangedMode) {
            if (player.getComponent('Mana').mana <= 2) {
                this.eventBus.emit('LogMessage', { message: `you cannot cast ranged attacks without mana!` });
                return;
            }

            let dx = 0, dy = 0;
            if (inputState.keys['ArrowUp'] || inputState.keys['w']) dy -= 1;
            if (inputState.keys['ArrowDown'] || inputState.keys['s']) dy += 1;
            if (inputState.keys['ArrowLeft'] || inputState.keys['a']) dx -= 1;
            if (inputState.keys['ArrowRight'] || inputState.keys['d']) dx += 1;

            const direction = { dx, dy, source: 'keyboard' };
            if (attackSpeed.elapsedSinceLastAttack >= attackSpeed.attackSpeed
                && (direction.dx !== 0 || direction.dy !== 0)
                && !playerState.isCasting) {
                this.eventBus.emit('RangedAttack', direction);
                attackSpeed.elapsedSinceLastAttack = 0;
                this.endTurn('rangedAttack');
                if (dx < 0) this.VisualsComponent.faceLeft = true;
                if (dx > 0) this.VisualsComponent.faceLeft = false;
            }
            return;
        }

        // Movement (keyboard or mouse)
        let hasKeyboardInput = false;
        let dx = 0, dy = 0;

        // Keyboard movement: set intent as a fixed step in the direction
        if (inputState.keys['ArrowUp'] || inputState.keys['w']) {
            dy -= 1;
            hasKeyboardInput = true;
        }
        if (inputState.keys['ArrowDown'] || inputState.keys['s']) {
            dy += 1;
            hasKeyboardInput = true;
        }
        if (inputState.keys['ArrowLeft'] || inputState.keys['a']) {
            dx -= 1;
            this.VisualsComponent.faceLeft = true;
            hasKeyboardInput = true;
        }
        if (inputState.keys['ArrowRight'] || inputState.keys['d']) {
            dx += 1;
            this.VisualsComponent.faceLeft = false;
            hasKeyboardInput = true;
        }

        // Only set a new intent if a direction is pressed
        if (hasKeyboardInput && (dx !== 0 || dy !== 0)) {
            // Normalize for diagonal movement
            const magnitude = Math.sqrt(dx * dx + dy * dy);
            const stepX = (dx / magnitude) * BASE_MOVE_DISTANCE;
            const stepY = (dy / magnitude) * BASE_MOVE_DISTANCE;
            const targetX = position.x + stepX;
            const targetY = position.y + stepY;

            this.entityManager.addComponentToEntity('player', new MovementIntentComponent(targetX, targetY));
            this.entityManager.addComponentToEntity('player', new NeedsRenderComponent(targetX, targetY));
            gameState.needsRender = true;

            // Remove MouseTarget if keyboard input is used
            if (player.hasComponent('MouseTarget')) {
                this.entityManager.removeComponentFromEntity('player', 'MouseTarget');
            }
            return;
        }

        // Mouse movement: set intent as the mouse target position
        if (mouseTarget && !hasKeyboardInput) {
            const targetX = mouseTarget.targetX;
            const targetY = mouseTarget.targetY;
            // Only set intent if not already at target
            const dx = targetX - position.x;
            const dy = targetY - position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance >  1) {
                this.entityManager.addComponentToEntity('player', new MovementIntentComponent(targetX, targetY));
                this.entityManager.addComponentToEntity('player', new NeedsRenderComponent(targetX, targetY));
                gameState.needsRender = true;
                this.VisualsComponent.faceLeft = dx < 0;
            } else {
                this.entityManager.removeComponentFromEntity('player', 'MouseTarget');
                if (player.hasComponent('MovementIntent')) {
                    this.entityManager.removeComponentFromEntity('player', 'MovementIntent');
                }
            }
            return;
        }

        // No movement input: remove intent if present
        if (player.hasComponent('MovementIntent')) {
            this.entityManager.removeComponentFromEntity('player', 'MovementIntent');
        }
    }

    endTurn(source) {
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        if (!gameState || gameState.gameOver) return;

        this.eventBus.emit('TurnEnded');
        gameState.transitionLock = false;
        gameState.needsRender = true;
    }

    toggleRangedMode({ event }) {
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const playerInventory = this.entityManager.getEntity('player').getComponent('Inventory');
        const offWeapon = playerInventory.equipped.offhand;
        const mainWeapon = playerInventory.equipped.mainhand;

        if (event.type === 'keyup' && event.key === ' ') {
            gameState.isRangedMode = false;
        } else if (event.type === 'keydown' && event.key === ' ' && !event.repeat) {
            if ((offWeapon?.attackType === 'ranged' && offWeapon?.baseRange > 0) ||
                (mainWeapon?.attackType === 'ranged' && mainWeapon?.baseRange > 0)) {
                    //keeping this here as a reminder that this could be a place to hook into cast supression for projectiles
               // this.entityManager.removeComponentFromEntity('player', 'MovementIntent');

                gameState.isRangedMode = true;
            } else {
                this.eventBus.emit('LogMessage', { message: 'You need a valid ranged weapon equipped to use ranged mode!' });
            }
        }
    }
}
