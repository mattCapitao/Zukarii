// systems/LevelTransitionSystem.js - Updated
import { System } from '../core/Systems.js';

export class LevelTransitionSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Map', 'Tier', 'Exploration'];
        this.pendingTransition = null;
    }

    init() {
        this.eventBus.on('TransitionDown', () => { this.pendingTransition = 'down'; this.transitionDown(); });
        this.eventBus.on('TransitionUp', () => { this.pendingTransition = 'up'; this.transitionUp(); });
        this.eventBus.on('TransitionViaPortal', (data) => { this.pendingTransition = 'portal'; this.transitionViaPortal(data); });
        this.eventBus.on('LevelAdded', (data) => this.handleLevelAdded(data));
        this.eventBus.on('TransitionLoad', ({ tier, data }) => this.transitionViaLoad(tier, data));
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
        const renderControl = this.entityManager.getEntity('renderState').getComponent('RenderControl');
        if (gameState.tier >= Number.MAX_SAFE_INTEGER) return;

        renderControl.locked = true;
        console.log('LevelTransitionSystem: Render locked for TransitionDown');

        const newTier = gameState.tier + 1;
        gameState.tier = newTier;
        if (newTier > gameState.highestTier) {
            gameState.highestTier = newTier;
            this.eventBus.emit('AwardXp', { amount: 5 * newTier });
            this.eventBus.emit('LogMessage', { message: `You Reached Tier ${newTier}` });
        }

        this.eventBus.emit('AddLevel', { tier: newTier });
    }

    transitionUp() {
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const renderControl = this.entityManager.getEntity('renderState').getComponent('RenderControl');
        if (gameState.tier === 0 || gameState.tier === 1) {
            this.eventBus.emit('PlayerExit', {});
            return;
        }

        renderControl.locked = true;
        console.log('LevelTransitionSystem: Render locked for TransitionUp');

        const newTier = gameState.tier - 1;
        gameState.tier = newTier;

        this.eventBus.emit('AddLevel', { tier: newTier });
    }

    transitionViaPortal({ x, y }) {
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const renderControl = this.entityManager.getEntity('renderState').getComponent('RenderControl');
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

        renderControl.locked = true;
        console.log('LevelTransitionSystem: Render locked for TransitionViaPortal');

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
        const renderControl = this.entityManager.getEntity('renderState').getComponent('RenderControl');
        const player = this.entityManager.getEntity('player');
        const levelEntity = this.entityManager.getEntity(entityId);
        const renderState = this.entityManager.getEntity('renderState').getComponent('RenderState');

        console.log("LevelTransitionSystem: Initial transitionLock:", gameState.transitionLock);


        if (!levelEntity) {
            console.error(`Level entity for tier ${tier} not found after LevelAdded event`);
            return;
        }

        const mapComp = levelEntity.getComponent('Map');
        const explorationComp = levelEntity.getComponent('Exploration');
        const entityList = levelEntity.getComponent('EntityList');
        const playerPos = player.getComponent('Position');
        let pos;

        const isNewTier = tier > gameState.highestTier;

        if (this.pendingTransition === 'down') {
            const upStair = mapComp.stairsUp;
            pos = this.findAdjacentTile(mapComp.map, upStair.x, upStair.y);
        } else if (this.pendingTransition === 'up') {
            const downStair = mapComp.stairsDown;
            pos = this.findAdjacentTile(mapComp.map, downStair.x, downStair.y);
        } else if (this.pendingTransition === 'portal' || this.pendingTransition === 'load') {
            const upStair = mapComp.stairsUp;
            pos = this.findAdjacentTile(mapComp.map, upStair.x, upStair.y);
        } else {
            // Fallback case (shouldn't typically happen, but preserved for safety)
            const stairsDown = entityList.stairsDown || { x: 5, y: 5 };
            pos = this.findAdjacentTile(mapComp.map, stairsDown.x, stairsDown.y);
        }

        if (tier > 1) {
            this.eventBus.emit('ClearOldPlayerPosition', { x: playerPos.x, y: playerPos.y });
        }

        playerPos.x = pos.x;
        playerPos.y = pos.y;

        console.log(`LevelTransitionSystem: Player position updated to: (${playerPos.x}, ${playerPos.y})`);
        console.log("LevelTransitionSystem: Tile at player position:", mapComp.map[playerPos.y][playerPos.x]);

        if (isNewTier) {
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
        }

        gameState.needsInitialRender = true;
        gameState.needsRender = true;
        gameState.transitionLock = true;

        renderControl.locked = false;
        console.log('LevelTransitionSystem: Render unlocked');

        this.eventBus.emit('PositionChanged', { entityId: 'player', x: pos.x, y: pos.y });
        console.log('LevelTransitionSystem emitting PositionChanged', { entityId: 'player', x: pos.x, y: pos.y });

        this.eventBus.emit('DiscoveredStateUpdated', { tier, entityId });

        this.eventBus.emit('RenderNeeded');

        if (this.pendingTransition === 'load') {
            gameState.transitionLock = false;
            console.log("LevelTransitionSystem: transitionLock reset to false after load");
        }

        console.log('Pending transition after switch:', this.pendingTransition, 'Tier:', tier);
        console.log('PositionChanged', { entityId: 'player', x: pos.x, y: pos.y });
        this.pendingTransition = null;

        // Trigger UI update after loading
        this.eventBus.emit('PlayerStateUpdated', { entityId: 'player' });
    }

    transitionViaLoad(tier, data) {
        console.log('LevelTransitionSystem: Starting transitionViaLoad for tier:', tier);

        // Update gameState
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        Object.assign(gameState, data.gameState.GameState);
        gameState.tier = tier;

        // Update player (exclude Position)
        const player = this.entityManager.getEntity('player');
        console.log('Player Data: ', data.player);
        Object.entries(data.player).forEach(([compName, compData]) => {
            if (compName !== 'Position') {
                const comp = player.getComponent(compName);
                if (comp) Object.assign(comp, compData);
            }
        });

        // Update overlay
        const overlayState = this.entityManager.getEntity('overlayState').getComponent('OverlayState');
        Object.assign(overlayState, data.overlayState.OverlayState);

        // Clear and regenerate level
        let levelEntity = this.entityManager.getEntitiesWith(['Map', 'Tier']).find(e => e.getComponent('Tier').value === tier);
        if (levelEntity) {
            this.clearLevelEntities(tier);
        }

        // Set pendingTransition to 'load' to indicate a load operation
        this.pendingTransition = 'load';
        this.eventBus.emit('AddLevel', { tier });

    }

    clearLevelEntities(tier) {
        const entities = this.entityManager.getEntitiesWith(['Tier']).filter(e => e.getComponent('Tier').value === tier);
        entities.forEach(entity => this.entityManager.removeEntity(entity.id));
        const tierEntities = this.entityManager.entitiesByTier.get(tier) || new Map();
        tierEntities.forEach((_, id) => this.entityManager.removeEntity(id));
    }
}