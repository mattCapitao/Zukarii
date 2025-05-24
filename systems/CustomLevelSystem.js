import { System } from '../core/Systems.js';

export class CustomLevelSystem extends System {

    constructor(entityManager, eventBus, state) {
        super(entityManager, eventBus);
        this.state = state;
        this.requiredComponents = ['Map', 'Tier', 'Exploration'];
        this.ROOM_EDGE_BUFFER = 4;
        this.CORRIDOR_EDGE_BUFFER = 2;
        this.MIN_ROOM_SIZE = 8;
        this.MAX_OVERLAP_PERCENT = 0.10;
        this.INITIAL_MIN_DISTANCE = 30;
        this.MIN_DISTANCE_FLOOR = 3;
        this.BOSS_ROOM_EVERY_X_LEVELS = 3;
        this.lastBossTier = 0;
        this.MAX_PLACEMENT_ATTEMPTS = 100; // Reduced to prevent performance issues
        this.roomsPerLevel = 30; // Reduced to prevent performance issues
        this.MIN_STAIR_DISTANCE = 18;
        this.TILE_SIZE = this.state.TILE_SIZE || 32;
        this.isAddingLevel = false; // Guard against re-entrant calls
    }


}