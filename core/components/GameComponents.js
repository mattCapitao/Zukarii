// core/components/GameComponents.js - Updated
export class UIComponent {
    constructor({
        overlayOpen = false,
        activeTab = 'log',
        logEntries = [],
        maxLogEntries = 60,
    } = {}) {
        this.type = 'UI';
        this.overlayOpen = overlayOpen;
        this.activeTab = activeTab;
        this.logEntries = logEntries;
        this.maxLogEntries = maxLogEntries;
    }
}

export class MouseTargetComponent {
    constructor(targetX, targetY) {
        this.type = 'MouseTarget';
        this.targetX = targetX;
        this.targetY = targetY;
    }
}

export class OverlayStateComponent {
    constructor({
        isOpen = false,
        activeTab = null,
        logMessages = [],
        activeMenuSection = 'controls-button' // Add this property
    } = {}) {
        this.type = 'OverlayState';
        this.isOpen = isOpen;           // Boolean: Whether the overlay is open
        this.activeTab = activeTab;     // String: The currently active tab ('menu', 'log', 'character', or null)
        this.logMessages = logMessages; // Array: List of log messages
        this.activeMenuSection = activeMenuSection; // Persist the active menu
    }
}

export class RenderStateComponent {
    constructor({
        activeRenderZone = new Set(),
        redrawTiles = new Set(), // set of tiles to be added to activeRenderZone at next render (old moster positions)
        projectile = null,
        torchLitOnTurn = false,
        renderRadius = 6
    } = {}) {
        this.type = 'RenderState';
        this.activeRenderZone = activeRenderZone;
        this.redrawTiles = redrawTiles; 
        this.projectile = projectile;
        this.torchLitOnTurn = torchLitOnTurn;
        this.renderRadius = renderRadius;
    }
}
 
export class GameStateComponent {
    constructor({
        tier = 0,
        highestTier = 1,
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

export class ProjectileComponent {
    constructor(direction, rangeLeft, sourceEntityId, weapon = null, isPiercing = false) {
        this.type = 'Projectile';
        this.direction = direction;
        this.rangeLeft = rangeLeft;
        this.sourceEntityId = sourceEntityId;
        this.weapon = weapon;
        this.isPiercing = isPiercing;
        this.removeAfterRender = false; // Flag to indicate if the projectile should be removed after rendering
        this.finalRenderApplied = false; // Flag to indicate if the final render has been applied
    }
}

export class LootSourceData {
    constructor({ sourceType = "unknown", name = "Unknown", tier = 0, position = { x: 0, y: 0 }, sourceDetails = {}, chanceModifiers = {}, maxItems = 1, items = [] } = {}) {
        this.type = 'LootSourceData';
        this.sourceType = sourceType;
        this.name = name;
        this.tier = tier;
        this.position = position;
        this.sourceDetails = sourceDetails;
        this.chanceModifiers = {
            torches: chanceModifiers.torches || 1,
            healPotions: chanceModifiers.healPotions || 1,
            gold: chanceModifiers.gold || 1,
            item: chanceModifiers.item || 1,
            uniqueItem: chanceModifiers.uniqueItem || 1
        };
        this.maxItems = maxItems;
        this.items = items;
    }
}

export class LootData {
    constructor({
        name = "Loot Pile",
        gold = 0,
        torches = 0,
        healPotions = 0,
        items = [],
        stones = {},
        suppressRender = false
    } = {}) {
        this.type = 'LootData';
        this.name = name;
        this.gold = gold;
        this.torches = torches;
        this.healPotions = healPotions;
        this.items = items;
        this.stones = stones;
        this.suppressRender = suppressRender;
    }
}

export class RenderControlComponent {
    constructor({
        locked = false
    } = {}) {
        this.type = 'RenderControl';
        this.locked = locked;
    }
}

// Add to GameComponents.js
export class LightingState {
    constructor({ isLit = false, expiresOnTurn = 0, visibleRadius = 4 } = {}) {
        this.type = 'LightingState';
        this.isLit = isLit;
        this.expiresOnTurn = expiresOnTurn;
        this.visibleRadius = visibleRadius;
        this.remainingDuration = 0; // Number of turns left for the light source
    }
}

export class LightSourceDefinitions {
    constructor() {
        this.type = 'LightSourceDefinitions';
        this.definitions = {
            unlit: { duration: 0, visibleRadius: 0 }, // No light source
            torch: { duration: 300, visibleRadius: 4 }, // Adjusted for testing
            lamp: { duration: 500, visibleRadius: 5 } // For future extensibility
        };
    }
}

export class DataProcessQueues {
    constructor() {
        this.type = 'DataProcessQueues';
        this.HealthUpdates = [];
        this.ManaUpdates = [];
        
    }
}

export class AudioQueueComponent {
    constructor() {
        this.type = 'AudioQueue';
        this.SFX = []; // {sfx:'SfxName', volume: .1}
        this.TrackControl = []; // {track:'TrackName', play: true, volume: .1}
    }
}

export class LevelTransitionComponent {
    constructor(pendingTransition = null) {
        this.type = 'LevelTransition';
        this.pendingTransition = pendingTransition; // Indicates if a level transition is pending
        this.lastMovementDirection = { dx: 0, dy: 0 }
    }
}

export class ShopComponent {
    constructor({
        dialogueText = "Browse my wares!",
        shopType = "EquipmentShop",
        items = [],
        sellMultiplier = 3.0
    } = {}) {
        this.type = 'ShopComponent';
        this.dialogueText = dialogueText;
        this.shopType = shopType;
        this.items = items;
        this.sellMultiplier = sellMultiplier;
    }
}
export class JourneyPathsComponent {
    constructor() {
        this.type = 'JourneyPaths';
        this.paths = []; // Array of all journey paths loaded from journeyPaths.json
    }
}

export class OfferedJourneysComponent {
    constructor() {
        this.type = 'OfferedJourneys';
        this.journeys = []; // Array of offered journey objects { journeyId, offeredBy }
    }
}

export class JourneyUpdateQueueComponent {
    constructor() {
        this.type = 'JourneyUpdateQueue';
        this.queue = []; // [{ type: string, data: object, timestamp: number }]
    }
}

export class AchievementUpdateQueueComponent {
    constructor() {
        this.type = 'AchievementUpdateQueue';
        this.queue = []; // [{ type: string, data: object, timestamp: number }]
    }
}