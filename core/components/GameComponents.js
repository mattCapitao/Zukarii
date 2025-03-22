// core/components/GameComponents.js - Updated
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
        visibleTiles = new Set(),
        projectile = null,
        torchLitOnTurn = false,
        renderRadius = 6 // Added renderRadius with default of 6
    } = {}) {
        this.type = 'RenderState';
        this.discoveryRadius = discoveryRadius;
        this.visibleTiles = visibleTiles;
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
    constructor(direction, rangeLeft) {
        this.type = 'Projectile';
        this.direction = direction;
        this.rangeLeft = rangeLeft;
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
        suppressRender = false
    } = {}) {
        this.type = 'LootData';
        this.name = name;
        this.gold = gold;
        this.torches = torches;
        this.healPotions = healPotions;
        this.items = items;
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