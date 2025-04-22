// core/components/MapComponents.js
// Defines map-related components for entities in the Component-Based Architecture

export class MapComponent {
    constructor({
        map = [],
        rooms = [],
        stairsUp = null,
        stairsDown = null
    } = {}) {
        this.type = 'Map';
        this.map = map;           // 2D array (for rendering only)
        this.rooms = rooms;       // Array of room objects
        this.stairsUp = stairsUp; // { x, y }
        this.stairsDown = stairsDown; // { x, y }
    }
}

export class SpatialBucketsComponent {
    constructor() {
        this.type = 'SpatialBuckets';
        this.buckets = new Map(); // Map of bucketKey (`${x},${y}`) to array of entity IDs
    }
}

export class EntityListComponent {
    constructor({ walls = [], floors = [], stairs = [], portals = [], monsters = [], treasures = [], fountains = [], rooms = [] } = {}) {
        this.type = 'EntityList';
        this.walls = walls;
        this.floors = floors;
        this.stairs = stairs;
        this.portals = portals;
        this.monsters = monsters;
        this.treasures = treasures;
        this.fountains = fountains;
        this.rooms = Array.isArray(rooms) ? rooms : []; // Ensure rooms is always an array
        console.log(`EntityListComponent: Initialized with rooms: ${JSON.stringify(this.rooms)}`);
    }
}

export class ExplorationComponent {
    constructor({
        discoveredWalls = new Set(),
        discoveredFloors = new Set()
    } = {}) {
        this.type = 'Exploration';
        this.discoveredWalls = discoveredWalls;     // Set of "x,y" strings
        this.discoveredFloors = discoveredFloors;   // Set of "x,y" strings
    }
}

export class WallComponent {
    constructor() {
        this.type = 'Wall';
    }
}

export class FloorComponent {
    constructor() {
        this.type = 'Floor';
    }
}

export class StairComponent {
    constructor(direction) { // 'up' or 'down'
        this.type = 'Stair';
        this.direction = direction; // 'up' for '⇑', 'down' for '⇓'
    }
}

export class PortalComponent {
    constructor() {
        this.type = 'Portal';
    }
}

export class FountainComponent {
    constructor(used = false, discovered = false) {
        this.type = 'Fountain';
        this.used = used;
        this.discovered = discovered;
        this.useCdExpiresAt = 0;
        this.healCdExpiresAt = 0;
    }
}

export class RoomComponent {
    constructor({ left, top, width, height, type }) {
        this.type = 'Room';
        this.left = left;
        this.top = top;
        this.width = width;
        this.height = height;
        this.centerX = Math.floor(left + width / 2);
        this.centerY = Math.floor(top + height / 2);
        this.roomType = type;
        this.connections = [];
    }
}


