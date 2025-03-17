// systems/LevelTransitionSystem.js
// Manages level transitions (up, down, portals)

import { System } from '../core/Systems.js';

export class LevelTransitionSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Map', 'Tier']; // For level entities
        this.pendingTransition = null; // Track pending transition type
    }

    init() {
        this.eventBus.on('TransitionDown', () => {
            this.pendingTransition = 'down';
            this.transitionDown();
        });
        this.eventBus.on('TransitionUp', () => {
            this.pendingTransition = 'up';
            this.transitionUp();
        });
        this.eventBus.on('TransitionViaPortal', (data) => {
            this.pendingTransition = 'portal';
            this.transitionViaPortal(data);
        });
        this.eventBus.on('LevelAdded', (data) => this.handleLevelAdded(data));
    }

    findAdjacentTile(map, stairX, stairY) {
        const directions = [
            { x: stairX - 1, y: stairY }, { x: stairX + 1, y: stairY },
            { x: stairX, y: stairY - 1 }, { x: stairX, y: stairY + 1 }
        ];
        for (const dir of directions) {
            if (dir.y >= 0 && dir.y < map.length && dir.x >= 0 && dir.x < map[dir.y].length && map[dir.y][dir.x] === ' ') {
                return { x: dir.x, y: dir.y };
            }
        }
        throw new Error(`No adjacent walkable tile found near (${stairX}, ${stairY})`);
    }

    transitionDown() {
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        if (gameState.tier >= Number.MAX_SAFE_INTEGER) return;

        const newTier = gameState.tier + 1;
        gameState.tier = newTier;
        if (newTier > gameState.highestTier) {
            gameState.highestTier = newTier;
            this.eventBus.emit('AwardXp', { amount: 5 * newTier });
            this.eventBus.emit('LogMessage', { message: `You Reached Tier ${newTier}` });
        }

        // Emit AddLevel and wait for LevelAdded
        this.eventBus.emit('AddLevel', { tier: newTier });
    }

    transitionUp() {
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        if (gameState.tier === 0 || gameState.tier === 1) {
            this.eventBus.emit('PlayerExit', {});
            return;
        }

        const newTier = gameState.tier - 1;
        gameState.tier = newTier;

        // Emit AddLevel and wait for LevelAdded
        this.eventBus.emit('AddLevel', { tier: newTier });
    }

    transitionViaPortal({ x, y }) {
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const currentLevel = this.entityManager.getEntitiesWith(['Tier']).find(e => e.getComponent('Tier').value === gameState.tier);
        if (!currentLevel) return;

        currentLevel.getComponent('Map').map[y][x] = ' ';
        const currentTier = gameState.tier;
        let minTier = currentTier - 3;
        let maxTier = currentTier + 3;
        let destinationTier;

        do {
            destinationTier = Math.floor(Math.random() * (maxTier - minTier + 1)) + minTier;
        } while (destinationTier === currentTier);
        if (destinationTier < 1) destinationTier = 1;

        const riskChance = Math.floor(currentTier / 10);
        if (Math.random() < riskChance / 100) {
            minTier = currentTier - 8;
            maxTier = currentTier + 8;
            do {
                destinationTier = Math.floor(Math.random() * (maxTier - minTier + 1)) + minTier;
            } while (destinationTier === currentTier);
            if (destinationTier < 1) destinationTier = 1;
        }

        this.eventBus.emit('LogMessage', { message: `You step through a mysterious portal surging with chaotic energy and are transported to Tier ${destinationTier}!` });
        gameState.tier = destinationTier;

        // Emit AddLevel and wait for LevelAdded
        this.eventBus.emit('AddLevel', { tier: destinationTier });
    }

    handleLevelAdded({ tier, entityId }) {
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const player = this.entityManager.getEntity('player');
        const levelEntity = this.entityManager.getEntity(entityId);

        if (!levelEntity) {
            console.error(`Level entity for tier ${tier} not found after LevelAdded event`);
            return;
        }

        if (this.pendingTransition === 'down') {
            const upStair = levelEntity.getComponent('Map').stairsUp;
            const pos = this.findAdjacentTile(levelEntity.getComponent('Map').map, upStair.x, upStair.y);
            const playerPos = player.getComponent('Position');
            playerPos.x = pos.x;
            playerPos.y = pos.y;

            gameState.needsInitialRender = true;
            gameState.needsRender = true;
            gameState.transitionLock = true;
            this.eventBus.emit('PositionChanged', { entityId: 'player', x: pos.x, y: pos.y });
            this.eventBus.emit('RenderNeeded');
        } else if (this.pendingTransition === 'up') {
            const downStair = levelEntity.getComponent('Map').stairsDown;
            const pos = this.findAdjacentTile(levelEntity.getComponent('Map').map, downStair.x, downStair.y);
            const playerPos = player.getComponent('Position');
            playerPos.x = pos.x;
            playerPos.y = pos.y;

            gameState.needsInitialRender = true;
            gameState.needsRender = true;
            gameState.transitionLock = true;
            this.eventBus.emit('PositionChanged', { entityId: 'player', x: pos.x, y: pos.y });
            this.eventBus.emit('RenderNeeded');
        } else if (this.pendingTransition === 'portal') {
            const upStair = levelEntity.getComponent('Map').stairsUp;
            const pos = this.findAdjacentTile(levelEntity.getComponent('Map').map, upStair.x, upStair.y);
            const playerPos = player.getComponent('Position');
            playerPos.x = pos.x;
            playerPos.y = pos.y;

            gameState.needsInitialRender = true;
            gameState.needsRender = true;
            gameState.transitionLock = true;
            this.eventBus.emit('PositionChanged', { entityId: 'player', x: pos.x, y: pos.y });
            this.eventBus.emit('RenderNeeded');
        }

        this.pendingTransition = null; // Reset pending transition
    }
}