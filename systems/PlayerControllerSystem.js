// PlayerControllerSystem.js (Pre-deltaTime)
export class PlayerControllerSystem {
    constructor(entityManager, eventBus) {
        this.entityManager = entityManager;
        this.eventBus = eventBus;
        this.lastMovementTime = 0;
        this.movementThrottleInterval = 200 ; // 100ms throttle (original value)
        this.lastInputState = {};

        this.previousKeyStates = {
            ArrowUp: false,
            ArrowDown: false,
            ArrowLeft: false,
            ArrowRight: false
        };

    }

    async init() {
        console.log('PlayerControllerSystem initialized');
        const player = this.entityManager.getEntity('player');
        if (player) {
            const position = player.getComponent('Position');
            // *** NEW: Ensure position is set correctly ***
            this.lastInputState = {};
            console.log('PlayerControllerSystem: Initial player position:', position.x, position.y);
        }
        this.eventBus.on('ToggleRangedMode', (data) => this.toggleRangedMode(data));
    }

    update() {
        const player = this.entityManager.getEntity('player');
        if (!player) return;

        const inputState = player.getComponent('InputState');
        const position = player.getComponent('Position');
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');


        // ADDED LOGGING: Check if transitionLock or gameOver is blocking movement
        //console.log("PlayerControllerSystem: gameState checks - transitionLock:", gameState?.transitionLock, "gameOver:", gameState?.gameOver);

        if (!gameState || gameState.gameOver || gameState.transitionLock) return;

        const currentKeys = JSON.stringify(inputState.keys);
        const lastKeys = JSON.stringify(this.lastInputState);
        if (currentKeys !== lastKeys) {
            console.log('PlayerControllerSystem: InputState changed - current:', inputState.keys, 'last:', this.lastInputState);
            this.lastInputState = { ...inputState.keys };
        }

        const now = Date.now();
        if (now - this.lastMovementTime < this.movementThrottleInterval) return;

        let newX = position.x;
        let newY = position.y;
        let moved = false;

        const directions = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
        for (const direction of directions) {
            const isPressed = !!inputState.keys[direction];
            const wasPressed = this.previousKeyStates[direction];

            if (isPressed && !wasPressed && gameState.isRangedMode) {
                // Key was just pressed, emit RangedAttack
                console.log(`PlayerControllerSystem: Emitting RangedAttack - direction: ${direction}`);
                this.eventBus.emit('RangedAttack', { direction });
                this.endTurn('rangedAttack');
                this.previousKeyStates[direction] = true;
                return;
            } else if (!isPressed && wasPressed) {
                // Key was released, update state
                this.previousKeyStates[direction] = false;
            }
        }
        if (gameState.isRangedMode) { return; }

        if (inputState.keys['ArrowUp']) {
            newY--;
            moved = true;
        }
        if (inputState.keys['ArrowDown']) {
            newY++;
            moved = true;
        }
        if (inputState.keys['ArrowLeft']) {
            newX--;
            moved = true;
        }
        if (inputState.keys['ArrowRight']) {
            newX++;
            moved = true;
        }

        if (!moved) return;
        console.log('PlayerControllerSystem: Attempting move to:', newX, newY);

        const levelEntity = this.entityManager.getEntitiesWith(['Map', 'Tier']).find(e => e.getComponent('Tier').value === gameState.tier);
        if (!levelEntity) return;

        const entitiesAtTarget = this.entityManager.getEntitiesWith(['Position']).filter(e => {
            const pos = e.getComponent('Position');
            return pos.x === newX && pos.y === newY;
        });

        const monster = entitiesAtTarget.find(e => e.hasComponent('Health') && e.hasComponent('MonsterData') && e.getComponent('Health').hp > 0);
        if (monster) {
            this.eventBus.emit('MeleeAttack', { targetEntityId: monster.id });
            this.endTurn('meleeAttack');
            return;
        }

        const fountain = entitiesAtTarget.find(e => e.hasComponent('Fountain') && !e.getComponent('Fountain').used);
        if (fountain) {
            this.eventBus.emit('UseFountain', { fountainEntityId: fountain.id, tierEntityId: levelEntity.id });
            this.endTurn('useFountain');
            return;
        }

        const loot = entitiesAtTarget.find(e => e.hasComponent('LootData'));
        if (loot) {
            this.eventBus.emit('PickupTreasure', { x: newX, y: newY });
            this.endTurn('pickupLoot');
            return;
        }

        const stair = entitiesAtTarget.find(e => e.hasComponent('Stair'));
        if (stair) {
            const stairComp = stair.getComponent('Stair');
            if (stairComp.direction === 'down') {
                this.eventBus.emit('RenderLock');
                this.eventBus.emit('TransitionDown');
                this.endTurn('transitionDown');
                return;
            } else if (stairComp.direction === 'up') {
                this.eventBus.emit('RenderLock');
                this.eventBus.emit('TransitionUp');
                this.endTurn('transitionUp');
                return;
            }
        }

        const portal = entitiesAtTarget.find(e => e.hasComponent('Portal'));
        if (portal) {
            this.eventBus.emit('RenderLock');
            this.eventBus.emit('TransitionViaPortal', { x: newX, y: newY });
            this.endTurn('transitionPortal');
            return;
        }

        const wall = entitiesAtTarget.find(e => e.hasComponent('Wall'));
        if (wall) return;

        const floor = entitiesAtTarget.find(e => e.hasComponent('Floor'));
        if (floor) {
            position.x = newX;
            position.y = newY;
            this.lastMovementTime = now;
            this.eventBus.emit('PositionChanged', { entityId: 'player', x: newX, y: newY });
            this.endTurn('movement');
        }
    }

    endTurn(source) {
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        if (!gameState || gameState.gameOver) return;

        this.eventBus.emit('TurnEnded');
        this.eventBus.emit('MoveMonsters');
        gameState.transitionLock = false;
        gameState.needsRender = true;
        this.eventBus.emit('RenderNeeded');
    }


    toggleRangedMode({ event }) {
        console.log('PlayerControllerSystem: toggleRangedMode - event:', event.type, 'key:', event.key, 'repeat:', event.repeat);

        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const playerInventory = this.entityManager.getEntity('player').getComponent('Inventory');
        const offWeapon = playerInventory.equipped.offhand;
        const mainWeapon = playerInventory.equipped.mainhand;

        if (event.type === 'keyup' && event.key === ' ') {
            gameState.isRangedMode = false;
            console.log('Ranged mode off');
            this.eventBus.emit('RenderNeeded');
        } else if (event.type === 'keydown' && event.key === ' ' && !event.repeat) {
            if ((offWeapon?.attackType === 'ranged' && offWeapon?.baseRange > 0) ||
                (mainWeapon?.attackType === 'ranged' && mainWeapon?.baseRange > 0)) {
                gameState.isRangedMode = true;
                console.log('Ranged mode on', 'gameState:', gameState);
                this.eventBus.emit('RenderNeeded');
            } else {
                this.eventBus.emit('LogMessage', { message: 'You need a valid ranged weapon equipped to use ranged mode!' });
            }
        }
    }
}