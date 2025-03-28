export class Game {
    constructor() {
        // ... (existing constructor code remains unchanged)
        this.keysPressed = {}; // New: Track all currently pressed keys
        this.movementSpeed = 1; // Adjust this for smoothness (pixels or tiles per frame)
        this.lastMovementTime = 0;
        this.movementThrottleInterval = 50; // Reduced for smoother feel (optional)
    }

    setupEventListeners() {
        this.keydownHandler = (event) => this.handleKeyDown(event);
        this.keyupHandler = (event) => this.handleKeyUp(event);
        this.mousedownHandler = () => this.updateLastMouseEvent();
        this.mousemoveHandler = () => this.updateLastMouseEvent();

        document.addEventListener('keydown', this.keydownHandler);
        document.addEventListener('keyup', this.keyupHandler);
        document.addEventListener('mousedown', this.mousedownHandler);
        document.addEventListener('mousemove', this.mousemoveHandler);
    }

    handleKeyDown(event) {
        if (event.repeat) return; // Ignore repeated keydown events
        const keyMap = {
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
        const mappedKey = keyMap[event.key];
        if (mappedKey) {
            this.keysPressed[mappedKey] = true; // Track key as pressed
            this.handleInput(event, mappedKey, true); // Process non-movement keys immediately
        }
    }

    handleKeyUp(event) {
        const keyMap = { /* same as above */ };
        const mappedKey = keyMap[event.key];
        if (mappedKey) {
            delete this.keysPressed[mappedKey]; // Remove key from tracking
            this.handleInput(event, mappedKey, false); // Handle keyup-specific logic
        }
    }

    handleInput(event, mappedKey, isKeyDown) {
        const gameState = this.state.getGameState()?.getComponent('GameState');
        if (!gameState || gameState.gameOver) return;

        if (!gameState.gameStarted && isKeyDown) {
            gameState.gameStarted = true;
            gameState.needsRender = true;
            this.state.eventBus.emit('ToggleBackgroundMusic', { play: true });
            this.state.eventBus.emit('RenderNeeded');
            this.updateSystems(['audio', 'render', 'ui']);
            return;
        }

        if (isKeyDown && !event.repeat) {
            switch (mappedKey) {
                case 'c':
                    this.state.eventBus.emit('ToggleOverlay', { tab: 'character' });
                    this.updateSystems(['ui']);
                    return;
                case 'l':
                    this.state.eventBus.emit('ToggleOverlay', { tab: 'log' });
                    this.updateSystems(['ui']);
                    return;
                case 'escape':
                    this.state.eventBus.emit('ToggleOverlay', {});
                    this.updateSystems(['ui']);
                    return;
                case 't':
                    this.state.eventBus.emit('LightTorch');
                    this.updateSystems(['player', 'render', 'ui', 'audio']);
                    this.state.eventBus.emit('RenderNeeded');
                    this.endTurn('lightTorch');
                    return;
                case 'h':
                    this.state.eventBus.emit('DrinkHealPotion');
                    this.updateSystems(['player', 'render']);
                    return;
                case ' ':
                    event.preventDefault();
                    this.state.eventBus.emit('ToggleRangedMode', { event });
                    this.updateSystems(['player', 'render']);
                    return;
            }
        }
        // Movement and ranged attacks will be handled in updateMovement
    }

    updateMovement(deltaTime) {
        const now = Date.now();
        if (now - this.lastMovementTime < this.movementThrottleInterval) return; // Optional throttle

        const gameState = this.state.getGameState()?.getComponent('GameState');
        if (!gameState || gameState.gameOver || gameState.transitionLock || gameState.isRangedMode) return;

        const player = this.state.getPlayer();
        if (!player) return;
        const playerPos = player.getComponent('Position');
        const levelEntity = this.entityManager.getEntitiesWith(['Map', 'Tier']).find(e => e.getComponent('Tier').value === gameState.tier);
        if (!levelEntity) return;

        let newX = playerPos.x;
        let newY = playerPos.y;
        let moved = false;

        // Process all pressed keys
        if (this.keysPressed['ArrowUp']) {
            newY--;
            moved = true;
        }
        if (this.keysPressed['ArrowDown']) {
            newY++;
            moved = true;
        }
        if (this.keysPressed['ArrowLeft']) {
            newX--;
            moved = true;
        }
        if (this.keysPressed['ArrowRight']) {
            newX++;
            moved = true;
        }

        if (!moved) return;

        const entitiesAtTarget = this.entityManager.getEntitiesWith(['Position']).filter(e => {
            const pos = e.getComponent('Position');
            return pos.x === newX && pos.y === newY;
        });

        const mapComp = levelEntity.getComponent('Map');
        const floor = entitiesAtTarget.find(e => e.hasComponent('Floor'));

        if (floor) {
            playerPos.x = newX;
            playerPos.y = newY;
            this.lastMovementTime = now;
            this.state.eventBus.emit('PositionChanged', { entityId: 'player', x: newX, y: newY });
            this.endTurn('movement');
        }
    }

    startGameLoop() {
        let lastTime = performance.now();
        const gameLoop = (currentTime) => {
            this.gameLoopId = requestAnimationFrame(gameLoop);
            const deltaTime = (currentTime - lastTime) / 1000; // Time in seconds
            lastTime = currentTime;

            this.updateMovement(deltaTime);
            this.updateSystems(['combat', 'render', 'player', 'monster', 'ui', 'exploration']);
        };
        this.gameLoopId = requestAnimationFrame(gameLoop);
    }

    // ... (rest of the code like endTurn, updateSystems, etc., remains unchanged)
}