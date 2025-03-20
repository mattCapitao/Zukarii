// systems/LevelTransitionSystem.js
// Manages level transitions (up, down, portals)

import { System } from '../core/Systems.js';

export class LevelTransitionSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Map', 'Tier', 'Exploration']; // For level entities
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
        this.eventBus.emit('RenderNeeded');
        this.eventBus.emit('AddLevel', { tier: destinationTier });
    }


    clearPlayerPosition() {
        const player = this.entityManager.getEntity('player');
        const playerPos = player.getComponent('Position');
        const oldPlayerPos = { x: playerPos.x, y: playerPos.y };

        this.eventBus.emit('ClearOldPlayerPosition', oldPlayerPos);
    }

    handleLevelAdded({ tier, entityId }) {
        console.log(`LevelAdded event for tier ${tier}, entityId: ${entityId}`);
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const player = this.entityManager.getEntity('player');
        const levelEntity = this.entityManager.getEntity(entityId);
        const renderState = this.entityManager.getEntity('renderState').getComponent('RenderState');

        if (!levelEntity) {
            console.error(`Level entity for tier ${tier} not found after LevelAdded event`);
            return;
        }

        const mapComp = levelEntity.getComponent('Map');
        const explorationComp = levelEntity.getComponent('Exploration');
        const playerPos = player.getComponent('Position');
        let pos;

        // Determine if this is a new tier (first visit) by checking if highestTier needs updating
        const isNewTier = tier > gameState.highestTier;

        if (this.pendingTransition === 'down') {
            const upStair = mapComp.stairsUp;
            pos = this.findAdjacentTile(mapComp.map, upStair.x, upStair.y);
        } else if (this.pendingTransition === 'up') {
            const downStair = mapComp.stairsDown;
            pos = this.findAdjacentTile(mapComp.map, downStair.x, downStair.y);
        } else if (this.pendingTransition === 'portal') {
            const upStair = mapComp.stairsUp;
            pos = this.findAdjacentTile(mapComp.map, upStair.x, upStair.y);
        }

        if (tier > 1) {
            // Clear any old player position data from the previous level
            const oldPlayerPos = { x: playerPos.x, y: playerPos.y };
            this.eventBus.emit('ClearOldPlayerPosition', oldPlayerPos);
        }

        //Ensure the player's position is correctly updated
       playerPos.x = pos.x;
       playerPos.y = pos.y;

        // Log the player's new position
      console.log(`LevelTransitionSystem: Player position updated to: (${playerPos.x}, ${playerPos.y})`);

        // Handle exploration state
        if (isNewTier) {
            // New tier: reset exploration and populate initial discovery radius
            explorationComp.discoveredWalls.clear();
            explorationComp.discoveredFloors.clear();
            const discoveryRadius = renderState.discoveryRadius;
            const height = mapComp.map.length;
            const width = mapComp.map[0].length;
            const minX = Math.max(0, pos.x - discoveryRadius);
            const maxX = Math.min(width - 1, pos.x + discoveryRadius);
            const minY = Math.max(0, pos.y - discoveryRadius);
            const maxY = Math.min(height - 1, pos.y + discoveryRadius);

            for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
                    const distance = Math.sqrt(Math.pow(pos.x - x, 2) + Math.pow(pos.y - y, 2));
                    if (distance <= discoveryRadius) {
                        const tileKey = `${x},${y}`;
                        if (mapComp.map[y][x] === '#') {
                            explorationComp.discoveredWalls.add(tileKey);
                        } else {
                            explorationComp.discoveredFloors.add(tileKey);
                        }
                    }
                }
            }
        } // Revisited tiers retain their existing explorationComp state

        gameState.needsInitialRender = true;
        gameState.needsRender = true;
        gameState.transitionLock = true;
    
        this.eventBus.emit('RenderUnlock');
        console.log('LevelTransitionSystem emitting RenderUnlock');

        this.eventBus.emit('PositionChanged', { entityId: 'player', x: pos.x, y: pos.y });
        console.log('LevelTransitionSystem emitting PositionChanged', { entityId: 'player', x: pos.x, y: pos.y });

        this.eventBus.emit('DiscoveredStateUpdated', { tier, entityId });
        
        this.eventBus.emit('RenderNeeded');

        console.log('Pending transition after switch:', this.pendingTransition, 'Tier:', tier);
        console.log('PositionChanged', { entityId: 'player', x: pos.x, y: pos.y });
        this.pendingTransition = null; // Reset pending transition
    }

}