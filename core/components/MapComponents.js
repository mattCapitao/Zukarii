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
    constructor({ walls = [], floors = [], stairs = [], portals = [], monsters = [], treasures = [], fountains = [], shopCounters = [], triggerAreas = [], rooms = [] } = {}) {
        this.type = 'EntityList';
        this.walls = walls;
        this.floors = floors;
        this.stairs = stairs;
        this.portals = portals;
        this.monsters = monsters;
        this.treasures = treasures;
        this.fountains = fountains;
        this.shopCounters = shopCounters
        this.triggerAreas = triggerAreas
        this.rooms = rooms;
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

export class ShopCounterComponent {
    constructor() {
        this.type = 'ShopCounter';
    }
}

export class StairComponent {
    constructor(direction, active = true) { // 'up' or 'down'
        this.type = 'Stair';
        this.direction = direction; // 'up' for '⇑', 'down' for '⇓'
        this.active = active;

    }
}

export class PortalComponent {
    constructor(active = true) {
        this.type = 'Portal';
        this.active = active;
        this.cleansed = false;
        this.destinationTier =  null; // Tier number for the destination portal
    }
    
}

export class FountainComponent {
    constructor(used = false, discovered = false, active=true) {
        this.type = 'Fountain';
        this.used = used;
        this.discovered = discovered;
        this.active = active;
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
        this.suppressMonsters = false;
        this.hasEntities = []; //{ id: '', type: ''  } // Track entities in this room}
    }
}

export class TriggerAreaComponent {
    constructor(action = null, data = {}, stopAction = null, stopData = {}, mode = 'Entry', active = true) {
        this.type = 'TriggerArea';
        this.action = action; // e.g., a string or function name
        this.data = data;
        this.stopAction = stopAction;
        this.stopData = stopData;
        this.active = active;
        this.mode = mode; // Entry or Presence
    }
}


