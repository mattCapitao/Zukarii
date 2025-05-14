import { AttackSpeedComponent, MovementSpeedComponent, NeedsRenderComponent, VisualsComponent, MovementIntentComponent } from '../core/Components.js';

export class PlayerControllerSystem {
    constructor(entityManager, eventBus) {
        this.entityManager = entityManager;
        this.eventBus = eventBus;
        this.lastInputState = {};
        this.previousKeyStates = {
            ArrowUp: false,
            ArrowDown: false,
            ArrowLeft: false,
            ArrowRight: false
        };
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
    }

    update(deltaTime) {
        const player = this.entityManager.getEntity('player');
        if (!player) return;

        const inputState = player.getComponent('InputState');
        const position = player.getComponent('Position');
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        const attackSpeed = player.getComponent('AttackSpeed');
        const mouseTarget = player.getComponent('MouseTarget');

        attackSpeed.elapsedSinceLastAttack += deltaTime * 1000;

        if (!gameState || gameState.gameOver || gameState.transitionLock) return;

        const currentKeys = JSON.stringify(inputState.keys);
        const lastKeys = JSON.stringify(this.lastInputState);
        if (currentKeys !== lastKeys) {
            this.lastInputState = { ...inputState.keys };
        }

        // Ranged mode (keyboard input)
        if (gameState.isRangedMode) {
            if (this.entityManager.getEntity('player').getComponent('Mana').mana <=2) {
                this.eventBus.emit('LogMessage', { message: `you cannot cast ranged attacks without mana!` });
                return;
            }

            let dx = 0, dy = 0;
            if (inputState.keys['ArrowUp'] || inputState.keys['w']) dy -= 1;
            if (inputState.keys['ArrowDown'] || inputState.keys['s']) dy += 1;
            if (inputState.keys['ArrowLeft'] || inputState.keys['a']) dx -= 1;
            if (inputState.keys['ArrowRight'] || inputState.keys['d']) dx += 1;

            const direction = { dx, dy, source: 'keyboard' };
            if (attackSpeed.elapsedSinceLastAttack >= attackSpeed.attackSpeed && (direction.dx !== 0 || direction.dy !== 0)) {
                console.log(`PlayerControllerSystem: Emitting RangedAttack - direction: `, direction);
                this.eventBus.emit('RangedAttack', direction);
                attackSpeed.elapsedSinceLastAttack = 0;
                this.endTurn('rangedAttack');
                if (dx < 0) this.VisualsComponent.faceLeft = true;
                if (dx > 0) this.VisualsComponent.faceLeft = false;
            }

            return;
        }

        // Movement (keyboard or mouse)
        let speed = player.getComponent('MovementSpeed').movementSpeed;
        if (player.hasComponent('InCombat')) {
            speed = Math.round(speed * 0.66);
            console.log(`PlayerControllerSystem: Player speed reduced to ${speed} due to combat!`);
        }

        let vx = 0, vy = 0;
        let hasKeyboardInput = false;

        // Keyboard movement
        if (inputState.keys['ArrowUp'] || inputState.keys['w']) {
            vy -= speed;
            hasKeyboardInput = true;
        }
        if (inputState.keys['ArrowDown'] || inputState.keys['s']) {
            vy += speed;
            hasKeyboardInput = true;
        }
        if (inputState.keys['ArrowLeft'] || inputState.keys['a']) {
            vx -= speed;
            this.VisualsComponent.faceLeft = true;
            hasKeyboardInput = true;
        }
        if (inputState.keys['ArrowRight'] || inputState.keys['d']) {
            vx += speed;
            this.VisualsComponent.faceLeft = false;
            hasKeyboardInput = true;
        }

        // Normalize diagonal keyboard movement
        if (vx !== 0 && vy !== 0) {
            const magnitude = Math.sqrt(vx * vx + vy * vy);
            vx = (vx / magnitude) * speed;
            vy = (vy / magnitude) * speed;
        }

        // Mouse movement
        if (mouseTarget && !hasKeyboardInput) {
            const dx = mouseTarget.targetX - position.x;
            const dy = mouseTarget.targetY - position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 2) {
                const magnitude = distance;
                vx = (dx / magnitude) * speed;
                vy = (dy / magnitude) * speed;
                this.VisualsComponent.faceLeft = dx < 0;
            } else {
                this.entityManager.removeComponentFromEntity('player', 'MouseTarget');
                vx = 0;
                vy = 0;
            }
        }

        // Clear MouseTarget if keyboard input is used
        if (hasKeyboardInput && mouseTarget) {
            this.entityManager.removeComponentFromEntity('player', 'MouseTarget');
        }

        // Set or remove movement intent
        if (vx !== 0 || vy !== 0) {
            const newX = position.x + vx * deltaTime;
            const newY = position.y + vy * deltaTime;
            this.entityManager.addComponentToEntity('player', new MovementIntentComponent(newX, newY));
            this.entityManager.addComponentToEntity('player', new NeedsRenderComponent(newX, newY));
            gameState.needsRender = true;
        } else {
            // Remove MovementIntentComponent when there's no movement
            if (player.hasComponent('MovementIntent')) {
                this.entityManager.removeComponentFromEntity('player', 'MovementIntent');
                console.log('PlayerControllerSystem: Removed MovementIntentComponent as player stopped moving');
            }
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
                gameState.isRangedMode = true;
            } else {
                this.eventBus.emit('LogMessage', { message: 'You need a valid ranged weapon equipped to use ranged mode!' });
            }
        }
    }
}