import { MovementIntentComponent, MouseTargetComponent } from '../core/Components.js';

export class MouseInputSystem {
    constructor(entityManager, eventBus, state) {
        this.entityManager = entityManager;
        this.eventBus = eventBus;
        this.state = state;
        this.canvas = document.getElementById('viewport-canvas');
        this.TILE_SIZE = 32;
        this.SCALE_FACTOR = 2;
        this.isMouseDown = false;
        this.lastClickTime = 0;
        this.MIN_CLICK_INTERVAL = 100; // Debounce clicks (ms)
        if (!this.canvas) {
            console.error('MouseInputSystem: Canvas element with id="viewport-canvas" not found');
            return;
        }
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    async init() {
        console.log('MouseInputSystem initialized');
    }

    handleMouseDown(event) {
        if (event.button !== 0) return; // Only handle left mouse button
        this.isMouseDown = true;
        this.updateTarget(event);
    }

    handleMouseUp(event) {
        if (event.button !== 0) return; // Only handle left mouse button
        this.isMouseDown = false;
        const player = this.entityManager.getEntity('player');
        if (player) {
            this.entityManager.removeComponentFromEntity('player', 'MouseTarget');
        }
    }

    handleMouseMove(event) {
        if (!this.isMouseDown) return;
        this.updateTarget(event);
    }

    updateTarget(event) {
        const now = performance.now();
        if (now - this.lastClickTime < this.MIN_CLICK_INTERVAL) {
            console.log(`MouseInputSystem: Click ignored, too soon (${(now - this.lastClickTime).toFixed(2)}ms < ${this.MIN_CLICK_INTERVAL}ms)`);
            return;
        }
        this.lastClickTime = now;

        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        if (!gameState?.gameStarted || gameState.gameOver || gameState.transitionLock) {
            console.log(`MouseInputSystem: Input blocked (gameStarted: ${gameState?.gameStarted}, gameOver: ${gameState?.gameOver}, transitionLock: ${gameState?.transitionLock})`);
            return;
        }

        const player = this.entityManager.getEntity('player');
        if (!player) {
            console.log('MouseInputSystem: Player entity not found');
            return;
        }
        const attackSpeed = player.getComponent('AttackSpeed');
        const mana = player.getComponent('Mana');
        const inventory = player.getComponent('Inventory');
        if (attackSpeed.elapsedSinceLastAttack < attackSpeed.attackSpeed) {
            console.log(`MouseInputSystem: Attack on cooldown (${attackSpeed.elapsedSinceLastAttack}/${attackSpeed.attackSpeed}ms)`);
            return;
        }
        if (mana.mana < 3) {
            console.log(`MouseInputSystem: Insufficient mana for attack (${mana.mana}/3)`);
            return;
        }

        const rect = this.canvas.getBoundingClientRect();
        const pixelX = (event.clientX - rect.left) / this.SCALE_FACTOR;
        const pixelY = (event.clientY - rect.top) / this.SCALE_FACTOR;

        // Get player position and viewport offset
        const playerPos = player.getComponent('Position');
        const viewportWidth = this.canvas.width / this.SCALE_FACTOR;
        const viewportHeight = this.canvas.height / this.SCALE_FACTOR;
        const mapWidth = this.state.WIDTH * this.TILE_SIZE; // 122 * 32 = 3904
        const mapHeight = this.state.HEIGHT * this.TILE_SIZE; // 67 * 32 = 2144
        let startX = playerPos.x - viewportWidth / 2;
        let startY = playerPos.y - viewportHeight / 2;
        startX = Math.max(0, Math.min(startX, mapWidth - viewportWidth));
        startY = Math.max(0, Math.min(startY, mapHeight - viewportHeight));

        // Convert click to world coordinates
        const worldX = pixelX + startX;
        const worldY = pixelY + startY;
        console.log(`MouseInputSystem: Click at screen (${event.clientX}, ${event.clientY}), pixel (${pixelX.toFixed(2)}, ${pixelY.toFixed(2)}), world (${worldX.toFixed(2)}, ${worldY.toFixed(2)}), playerPos (${playerPos.x.toFixed(2)}, ${playerPos.y.toFixed(2)}), startX/Y (${startX.toFixed(2)}, ${startY.toFixed(2)}), canvas (${this.canvas.width}, ${this.canvas.height}), rect (${rect.left.toFixed(2)}, ${rect.top.toFixed(2)}), viewportWidth/Height (${viewportWidth.toFixed(2)}, ${viewportHeight.toFixed(2)}), mapWidth/Height (${mapWidth}, ${mapHeight})`);

        // Check for monster click or ranged mode
        let attackTriggered = false;
        const monster = this.getMonsterAtPosition(worldX, worldY);
        console.log(`MouseInputSystem: Attack check, monster: ${monster ? monster.id : 'none'}, isRangedMode: ${gameState.isRangedMode}`);
        if (monster || (gameState.isRangedMode && !monster)) {
            const offWeapon = inventory.equipped.offhand;
            const mainWeapon = inventory.equipped.mainhand;
            const hasRangedWeapon = (offWeapon?.attackType === 'ranged' && offWeapon?.baseRange > 0) ||
                (mainWeapon?.attackType === 'ranged' && mainWeapon?.baseRange > 0);
            if (!hasRangedWeapon) {
                this.eventBus.emit('LogMessage', { message: 'You need a valid ranged weapon equipped to use ranged attacks!' });
                console.log('MouseInputSystem: No ranged weapon equipped for attack');
            } else {
                // Target monster center (aligned with Visuals.w, Visuals.h)
                const targetX = monster ? (monster.getComponent('Position').x + monster.getComponent('Visuals').w / 2) : worldX;
                const targetY = monster ? (monster.getComponent('Position').y + monster.getComponent('Visuals').h / 2) : worldY;
                const dx = targetX - playerPos.x;
                const dy = targetY - playerPos.y;
                const direction = { dx, dy, source: monster ? 'mouse_monster' : 'mouse_ranged' };
                this.eventBus.emit('RangedAttack', direction);
                attackSpeed.elapsedSinceLastAttack = 0;
                console.log(`MouseInputSystem: Ranged attack triggered, source: ${direction.source}, target: (${targetX.toFixed(2)}, ${targetY.toFixed(2)}), direction: (${dx.toFixed(2)}, ${dy.toFixed(2)})`);
                attackTriggered = true;
            }
        }

        // Fallback to movement if no attack triggered
        if (!attackTriggered) {
            const tileX = Math.floor(worldX / this.TILE_SIZE);
            const tileY = Math.floor(worldY / this.TILE_SIZE);

            if (tileX < 0 || tileX >= this.state.WIDTH || tileY < 0 || tileY >= this.state.HEIGHT) {
                console.log(`MouseInputSystem: Target tile (${tileX}, ${tileY}) out of bounds (map: ${this.state.WIDTH}x${this.state.HEIGHT})`);
                return;
            }

            const levelEntity = this.entityManager.getEntity(`level_${gameState.tier}`);
            if (!levelEntity) {
                console.warn(`MouseInputSystem: No level entity for tier ${gameState.tier}`);
                return;
            }
            const map = levelEntity.getComponent('Map').map;
            if (!map[tileY] || map[tileY][tileX] === 1) {
                console.log(`MouseInputSystem: Tile (${tileX}, ${tileY}) is a wall`);
                return;
            }

            const targetX = tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
            const targetY = tileY * this.TILE_SIZE + this.TILE_SIZE / 2;

            // Log movement direction
            const moveDx = targetX - playerPos.x;
            const moveDy = targetY - playerPos.y;
            console.log(`MouseInputSystem: Setting movement target to (${targetX.toFixed(2)}, ${targetY.toFixed(2)}) for tile (${tileX}, ${tileY}), direction: (${moveDx.toFixed(2)}, ${moveDy.toFixed(2)})`);

            this.entityManager.addComponentToEntity('player', new MouseTargetComponent(targetX, targetY));
        }
    }

    getMonsterAtPosition(worldX, worldY) {
        const monsters = this.entityManager.getEntitiesWith(['MonsterData', 'Position', 'Hitbox', 'Health', 'Visuals']);
        for (const monster of monsters) {
            if (monster.getComponent('Health').hp <= 0) continue;
            const pos = monster.getComponent('Position');
            const visuals = monster.getComponent('Visuals');

            // Use Visuals.w, Visuals.h for hitbox to align with sprite
            const hitboxWidth = visuals.w;
            const hitboxHeight = visuals.h;
            const hitboxLeft = pos.x;
            const hitboxRight = pos.x + hitboxWidth;
            const hitboxTop = pos.y;
            const hitboxBottom = pos.y + hitboxHeight;

            // Debug logging
            console.log(`MouseInputSystem: Checking monster ${monster.id} at (${pos.x}, ${pos.y}), hitbox: [${hitboxLeft}, ${hitboxTop}] to [${hitboxRight}, ${hitboxBottom}], visuals: (${visuals.w}x${visuals.h}), click: (${worldX}, ${worldY})`);

            if (
                worldX >= hitboxLeft &&
                worldX <= hitboxRight &&
                worldY >= hitboxTop &&
                worldY <= hitboxBottom
            ) {
                // Log distance from click to monster center
                const centerX = pos.x + hitboxWidth / 2;
                const centerY = pos.y + hitboxHeight / 2;
                const dx = worldX - centerX;
                const dy = worldY - centerY;
                console.log(`MouseInputSystem: Hit monster ${monster.id}, distance from center: ${Math.sqrt(dx * dx + dy * dy).toFixed(2)} pixels`);
                return monster;
            }
        }
        console.log(`MouseInputSystem: No monster hit at (${worldX}, ${worldY})`);
        return null;
    }

    update() {
        // No per-frame updates needed
    }

    destroy() {
        if (this.canvas) {
            this.canvas.removeEventListener('mousedown', this.handleMouseDown);
            this.canvas.removeEventListener('mouseup', this.handleMouseUp);
            this.canvas.removeEventListener('mousemove', this.handleMouseMove);
            this.canvas.removeEventListener('contextmenu', (e) => e.preventDefault());
        }
        console.log('MouseInputSystem destroyed');
    }
}