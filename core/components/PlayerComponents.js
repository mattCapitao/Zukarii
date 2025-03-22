// core/components/PlayerComponents.js
// Defines player-related components for entities in the Component-Based Architecture



export class ManaComponent {
    constructor(mana = 0, maxMana = 0) {
        this.type = 'Mana';
        this.mana = mana;
        this.maxMana = maxMana;
    }
}

export class StatsComponent {
    constructor({
        intellect = 0, prowess = 0, agility = 0, maxHp = 0, maxMana = 0,
        armor = 0, defense = 0, block = 0, dodge = 0, range = 0, baseRange = 0,
        damageBonus = 0, meleeDamageBonus = 0, rangedDamageBonus = 0, luck = 0, maxLuck = 0
    } = {}) {
        this.type = 'Stats';
        this.intellect = intellect;
        this.prowess = prowess;
        this.agility = agility;
        this.maxHp = maxHp;
        this.maxMana = maxMana;
        this.armor = armor;
        this.defense = defense;
        this.block = block;
        this.dodge = dodge;
        this.range = range;
        this.baseRange = baseRange;
        this.damageBonus = damageBonus;
        this.meleeDamageBonus = meleeDamageBonus;
        this.rangedDamageBonus = rangedDamageBonus;
        this.luck = luck;
        this.maxLuck = maxLuck;
        this._internal = {
            base: {
                intellect: 0, prowess: 0, agility: 0, maxHp: 0, maxMana: 0,
                armor: 0, defense: 0, block: 0, dodge: 0, range: 0, baseRange: 0,
                damageBonus: 0, meleeDamageBonus: 0, rangedDamageBonus: 0, luck: 0, maxLuck: 0
            },
            gear: {
                intellect: 0, prowess: 0, agility: 0, maxHp: 0, maxMana: 0,
                armor: 0, defense: 0, block: 0, dodge: 0, range: 0, baseRange: 0,
                damageBonus: 0, meleeDamageBonus: 0, rangedDamageBonus: 0, luck: 0, maxLuck: 0
            },
            temp: {
                intellect: 0, prowess: 0, agility: 0, maxHp: 0, maxMana: 0,
                armor: 0, defense: 0, block: 0, dodge: 0, range: 0, baseRange: 0,
                damageBonus: 0, meleeDamageBonus: 0, rangedDamageBonus: 0, luck: 0, maxLuck: 0
            }
        };
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
        lampLit = false,
        discoveredTileCount = 0
    } = {}) {
        this.type = 'PlayerState';
        this.name = name;
        this.level = level;
        this.xp = xp;
        this.nextLevelXp = nextLevelXp;
        this.dead = dead;
        this.torchLit = torchLit;
        this.lampLit = lampLit;
        this.discoveredTileCount = discoveredTileCount;
    }
}