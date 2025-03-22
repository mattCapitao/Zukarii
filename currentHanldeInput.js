handleInput(event) {
    //console.log(`Game.js: Handling ${event.type} event for key: ${event.key}`);
    const gameState = this.state.getGameState()?.getComponent('GameState');
    if (!gameState) {
        console.error('Game.js: gameState not found or missing GameState component');
    } else {
        //console.log('Game.js: handleInput start, gameState:', gameState, 'entity ID:', this.state.getGameState()?.id, 'timestamp:', Date.now());
    }

    if (gameState && !gameState.gameStarted) {
        //console.log('Game.js: Starting game on first keypress');
        gameState.gameStarted = true;
        gameState.needsRender = true;
        this.state.eventBus.emit('ToggleBackgroundMusic', { play: true });
        this.state.eventBus.emit('RenderNeeded');
        this.updateSystems(['audio', 'render', 'ui']);
        return;
    }

    if (gameState.gameOver) {
        //console.log('Game.js: Game over, ignoring input');
        return;
    }

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
    if (!mappedKey) {
        //console.log(`Game.js: Key ${event.key} not mapped, ignoring`);
        return;
    }

    if (event.type === 'keydown' && !event.repeat) {
        //console.log(`Key pressed: ${mappedKey}`);
    }

    const isClickContext = Date.now() - this.lastMouseEventTime < 500;
    if (event.type === 'keydown' && event.key === 'Control' && isClickContext) {
        //console.log('Game.js: Ignoring Ctrl key in click context');
        return;
    }

    if (event.type === 'keyup' && mappedKey === ' ') {
        event.preventDefault();
        this.state.eventBus.emit('ToggleRangedMode', { event });
        //console.log('space keyUp detected');
        this.updateSystems(['player', 'render']);
        return;
    }

    if (event.type === 'keydown') {
        //console.log('Game.js: Processing keydown, gameState before switch:', gameState, 'entity ID:', this.state.getGameState()?.id, 'timestamp:', Date.now());
        const player = this.state.getPlayer();
        if (!player) {
            //console.log('Game.js: Player entity not found');
            return;
        }
        const playerPos = player.getComponent('Position');
        const levelEntity = this.entityManager.getEntitiesWith(['Map', 'Tier']).find(e => e.getComponent('Tier').value === gameState.tier);
        if (!levelEntity) {
            //console.log('Game.js: Level entity not found for current tier');
            return;
        }

        // Log current tier and player position
        console.log(`Game.js: Current tier: ${gameState.tier}, Player position: (${playerPos.x}, ${playerPos.y})`);

        let newX = playerPos.x;
        let newY = playerPos.y;

        switch (mappedKey) {
            case 'ArrowUp':
                if (gameState.isRangedMode) {
                    this.state.eventBus.emit('RangedAttack', { direction: mappedKey });
                    this.endTurn('rangedAttack');
                    return;
                }
                newY--;
                break;
            case 'ArrowDown':
                if (gameState.isRangedMode) {
                    this.state.eventBus.emit('RangedAttack', { direction: mappedKey });
                    this.endTurn('rangedAttack');
                    return;
                }
                newY++;
                break;
            case 'ArrowLeft':
                if (gameState.isRangedMode) {
                    this.state.eventBus.emit('RangedAttack', { direction: mappedKey });
                    this.endTurn('rangedAttack');
                    return;
                }
                newX--;
                break;
            case 'ArrowRight':
                if (gameState.isRangedMode) {
                    this.state.eventBus.emit('RangedAttack', { direction: mappedKey });
                    this.endTurn('rangedAttack');
                    return;
                }
                newX++;
                break;
            case 'c':
                //console.log('Emitting ToggleOverlay for character tab');
                this.state.eventBus.emit('ToggleOverlay', { tab: 'character' });
                this.updateSystems(['ui']);
                return;
            case 'l':
                //console.log('Emitting ToggleOverlay for log tab');
                this.state.eventBus.emit('ToggleOverlay', { tab: 'log' });
                this.updateSystems(['ui']);
                return;
            case 'escape':
                //console.log('Emitting ToggleOverlay to close');
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
                if (!event.repeat) {
                    this.state.eventBus.emit('ToggleRangedMode', { event });
                    this.updateSystems(['player', 'render']);
                    //console.log('space keyDown detected');
                }
                return;
        }

        // Query entities at the target position
        const entitiesAtTarget = this.entityManager.getEntitiesWith(['Position']).filter(e => {
            const pos = e.getComponent('Position');
            return pos.x === newX && pos.y === newY;
        });
        console.log(`Game.js: Entities at (${newX}, ${newY}):`, entitiesAtTarget.map(e => ({
            id: e.id,
            components: e.getComponentTypes()
        })));

        // Check for interactable entities
        const monster = entitiesAtTarget.find(e =>
            e.hasComponent('Health') && e.hasComponent('MonsterData') &&
            e.getComponent('Health').hp > 0
        );
        if (monster) {
            this.state.eventBus.emit('MeleeAttack', { targetEntityId: monster.id });
            this.endTurn('meleeAttack');
            return;
        }

        const fountain = entitiesAtTarget.find(e =>
            e.hasComponent('Fountain') && !e.getComponent('Fountain').used
        );
        if (fountain) {
            this.state.eventBus.emit('UseFountain', { fountainEntityId: fountain.id, tierEntityId: levelEntity.id });
            this.endTurn('useFountain');
            return;
        }

        const loot = entitiesAtTarget.find(e => e.hasComponent('LootData'));
        if (loot) {
            this.state.eventBus.emit('PickupTreasure', { x: newX, y: newY });
            this.endTurn('pickupLoot');
            return;
        }

        const stair = entitiesAtTarget.find(e => e.hasComponent('Stair'));
        if (stair) {
            const stairComp = stair.getComponent('Stair');
            if (stairComp.direction === 'down') {
                this.state.eventBus.emit('RenderLock');
                console.log('Game: Render Locked for TransitionDown');
                this.state.eventBus.emit('TransitionDown');
                this.endTurn('transitionDown');
                return;
            } else if (stairComp.direction === 'up') {
                this.state.eventBus.emit('RenderLock');
                this.state.eventBus.emit('TransitionUp');
                this.endTurn('transitionUp');
                return;
            }
        }

        const portal = entitiesAtTarget.find(e => e.hasComponent('Portal'));
        if (portal) {
            this.state.eventBus.emit('RenderLock');
            this.state.eventBus.emit('TransitionViaPortal', { x: newX, y: newY });
            this.endTurn('transitionPortal');
            return;
        }

        const wall = entitiesAtTarget.find(e => e.hasComponent('Wall'));
        if (wall) {
            console.log(`Game.js: Wall found at (${newX}, ${newY}), blocking movement`);
            return;
        }

        const floor = entitiesAtTarget.find(e => e.hasComponent('Floor'));
        console.log(`Game.js: Floor at (${newX}, ${newY}):`, floor ? floor.id : 'none');
        console.log(`Game.js: Conditions - transitionLock: ${gameState.transitionLock}, isRangedMode: ${gameState.isRangedMode}, throttle: ${Date.now() - this.lastMovementTime < this.movementThrottleInterval}`);
        if (!gameState.transitionLock && !gameState.isRangedMode && floor) {
            const now = Date.now();
            if (now - this.lastMovementTime < this.movementThrottleInterval) {
                console.log(`Game.js: Movement throttled at (${newX}, ${newY})`);
                return;
            }
            this.lastMovementTime = now;

            playerPos.x = newX;
            playerPos.y = newY;
            this.state.eventBus.emit('PositionChanged', { entityId: 'player', x: newX, y: newY });
            console.log(`Game.js: Player moved to (${newX}, ${newY})`);
            this.endTurn('movement');
        } else {
            console.log(`Game.js: Movement blocked at (${newX}, ${newY}) - transitionLock: ${gameState.transitionLock}, isRangedMode: ${gameState.isRangedMode}, floor: ${!!floor}`);
        }
    }
}