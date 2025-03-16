// Components.js
// Defines pure data components for entities in the Component-Based Architecture

export class PositionComponent {
    constructor(x = 0, y = 0) {
        this.type = 'Position';
        this.x = x;
        this.y = y;
    }
}

export class HealthComponent {
    constructor(hp = 0, maxHp = 0) {
        this.type = 'Health';
        this.hp = hp;
        this.maxHp = maxHp;
    }
}

export class ManaComponent {
    constructor(mana = 0, maxMana = 0) {
        this.type = 'Mana';
        this.mana = mana;
        this.maxMana = maxMana;
    }
}

export class StatsComponent {
    constructor({
        intellect = 0,
        prowess = 0,
        agility = 0,
        armor = 0,
        defense = 0,
        block = 0,
        dodge = 0,
        range = 0,
        damageBonus = 0,
        meleeDamageBonus = 0,
        rangedDamageBonus = 0,
        luck = 0,
        maxLuck = 0
    } = {}) {
        this.type = 'Stats';
        this.intellect = intellect;
        this.prowess = prowess;
        this.agility = agility;
        this.armor = armor;
        this.defense = defense;
        this.block = block;
        this.dodge = dodge;
        this.range = range;
        this.damageBonus = damageBonus;
        this.meleeDamageBonus = meleeDamageBonus;
        this.rangedDamageBonus = rangedDamageBonus;
        this.luck = luck;
        this.maxLuck = maxLuck;
    }
}

export class InventoryComponent {
    constructor({
        equipped = {},
        items = []
    } = {}) {
        this.type = 'Inventory';
        this.equipped = equipped; // { slot: item }
        this.items = items;       // Array of item objects
    }
}

export class ResourceComponent {
    constructor({
        gold = 0,
        torches = 0,
        healPotions = 0,
        torchExpires = 0,
        torchDropFail = 0,
        potionDropFail = 0
    } = {}) {
        this.type = 'Resource';
        this.gold = gold;
        this.torches = torches;
        this.healPotions = healPotions;
        this.torchExpires = torchExpires;
        this.torchDropFail = torchDropFail;
        this.potionDropFail = potionDropFail;
    }
}

export class PlayerStateComponent {
    constructor({
        name = "Leith42",
        level = 1,
        xp = 0,
        nextLevelXp = 0,
        dead = false,
        torchLit = false,
        lampLit = false
    } = {}) {
        this.type = 'PlayerState';
        this.name = name;
        this.level = level;
        this.xp = xp;
        this.nextLevelXp = nextLevelXp;
        this.dead = dead;
        this.torchLit = torchLit;
        this.lampLit = lampLit;
    }
}

export class MapComponent {
    constructor({
        map = [],
        rooms = [],
        stairsUp = null,
        stairsDown = null
    } = {}) {
        this.type = 'Map';
        this.map = map;           // 2D array
        this.rooms = rooms;       // Array of room objects
        this.stairsUp = stairsUp; // { x, y }
        this.stairsDown = stairsDown; // { x, y }
    }
}

export class EntityListComponent {
    constructor({
        monsters = [],
        treasures = [],
        fountains = []
    } = {}) {
        this.type = 'EntityList';
        this.monsters = monsters;   // Array of monster objects
        this.treasures = treasures; // Array of treasure objects
        this.fountains = fountains; // Array of fountain objects
    }
}

export class UIComponent {
    constructor({
        overlayOpen = false,
        activeTab = 'log',
        logEntries = [],
        maxLogEntries = 60
    } = {}) {
        this.type = 'UI';
        this.overlayOpen = overlayOpen;
        this.activeTab = activeTab;
        this.logEntries = logEntries;
        this.maxLogEntries = maxLogEntries;
    }
}

export class RenderStateComponent {
    constructor({
        discoveryRadius = 2,
        discoveredWalls = new Set(),
        discoveredFloors = new Set(),
        discoveredTileCount = 0,
        visibleTiles = new Set(),
        projectile = null,
        torchLitOnTurn = false
    } = {}) {
        this.type = 'RenderState';
        this.discoveryRadius = discoveryRadius;
        this.discoveredWalls = discoveredWalls;     // Set of "x,y" strings
        this.discoveredFloors = discoveredFloors;   // Set of "x,y" strings
        this.discoveredTileCount = discoveredTileCount;
        this.visibleTiles = visibleTiles;           // Set of "x,y" strings
        this.projectile = projectile;               // { x, y } or null
        this.torchLitOnTurn = torchLitOnTurn;
    }
}

export class GameStateComponent {
    constructor({
        tier = 0,
        highestTier = 0,
        gameStarted = false,
        gameOver = false,
        isVictory = false,
        isRangedMode = false,
        transitionLock = false,
        needsRender = false,
        needsInitialRender = false
    } = {}) {
        this.type = 'GameState';
        this.tier = tier;
        this.highestTier = highestTier;
        this.gameStarted = gameStarted;
        this.gameOver = gameOver;
        this.isVictory = isVictory;
        this.isRangedMode = isRangedMode;
        this.transitionLock = transitionLock;
        this.needsRender = needsRender;
        this.needsInitialRender = needsInitialRender;
    }
}

// Utility function to create default player components (for initialization)
export function createDefaultPlayerComponents() {
    return {
        position: new PositionComponent(1, 1),
        health: new HealthComponent(0, 0),
        mana: new ManaComponent(0, 0),
        stats: new StatsComponent(),
        inventory: new InventoryComponent(),
        resource: new ResourceComponent(),
        playerState: new PlayerStateComponent()
    };
}

// Utility function to create default level components (for initialization)
export function createDefaultLevelComponents() {
    return {
        map: new MapComponent(),
        entityList: new EntityListComponent()
    };
}