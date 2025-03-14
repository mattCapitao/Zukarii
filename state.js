//console.log("State.js loaded");
import { Utilities } from './Utilities.js';

export class State {
    constructor(utilities) {
        this.utilities = utilities;
        this.game = null;
        this.needsRender=false
        this.WIDTH = 122;
        this.HEIGHT = 67;
        this.MIN_STAIR_DISTANCE = Math.floor(Math.random()*41) + 20;
        this.mapDiv = null;
        this.statsDiv = null;
        this.logDiv = null;
        this.levels = [];
        this.stairsUp = {};
        this.stairsDown = {};
        this.tier = 0;
        this.ui = {
            overlayOpen: false,
            activeTab: 'log',
            logEntries: [],
            maxLogEntries: 60
        };
        this.player = {
            x: 1, y: 1,
            name: "Leith42",
            level: 1, xp: 0, nextLevelXp: 0,
            dead: false,
            gold: 0,
            hp: 0, maxHp: 0,
            mana: 0, maxMana: 0,
            luck: 0, maxLuck: 0, luckTempMod:0,
            prowess: 0,
            intellect:0,
            agility: 0, 
            armor: 0,
            defense: 0,
            block: 0,
            dodge: 0,
            range: 0,
            damageBonus: 0,
            meleeDamageBonus: 0,
            rangedDamageBonus: 0,
            inventory: {
                equipped: {}, // Initialized in Player now
                items: [],
            },
            healPotions: 0,
            potionDropFail: 0,
            torches: 0,
            torchExpires: 0,
            torchDropFail: 0,
            torchLit: false,
            lampLit: false,
            stats: {
                base: {
                    maxHp: 0,
                    maxMana: 0,
                    maxLuck: 0,
                    prowess: 0,
                    intellect: 0,
                    agility: 0,
                    armor: 0,
                    defense: 0,
                    block: 0,
                    dodge: 0,
                    range: 0,
                    damageBonus: 0,
                    meleeDamageBonus: 0,
                    rangedDamageBonus: 0,
                },
                gear: {
                    maxHp: 0,
                    maxMana: 0,
                    maxLuck: 0,
                    prowess: 0,
                    intellect: 0,
                    agility: 0,
                    armor: 0,
                    defense: 0,
                    block: 0,
                    dodge: 0,
                    range: 0,
                    baseRange: 0,
                    damageBonus: 0,
                    meleeDamageBonus: 0,
                    rangedDamageBonus: 0,
                },
            }
        };
        this.items = [];
        this.possibleItemStats = [
            'maxHp', 'maxMana', 'maxLuck',
            'intellect', 'prowess', 'agility',
            'range', 'block', 'armor', 'defense',
            'baseBlock', 'baseRange', 
            'rangedDamageBonus', 'meleeDamageBonus', 'damageBonus'
        ];
        this.treasures = {};
        this.monsters = {};
        this.fountains = {};
        this.combatLog = [];
        this.isRangedMode = false;
        this.projectile = null;
        this.highestTier = 0;
        this.gameStarted = false;
        this.gameOver = false;
        this.discoveryRadiusDefault = 2;
        this.discoveryRadius = 2;
        this.discoveredWalls = {};
        this.discoveredFloors = {};
        this.discoveredTileCount = {};
        this.visibleTiles = {};
        this.tileMap = {};
        this.lastPlayerX = null;
        this.lastPlayerY = null;
        this.lastProjectileX = null;
        this.lastProjectileY = null;
        this.needsInitialRender = false;
        this.isVictory = false;
        this.torchLitOnTurn = false;
        this.AGGRO_RANGE = 4;
    }

    generateSurfaceLevel() {
        let map = [];
        for (let y = 0; y < 10; y++) {
            map[y] = [];
            for (let x = 0; x < 10; x++) {
                if (y === 0 || y === 9 || x === 0 || x === 9) {
                    map[y][x] = '#';
                } else {
                    map[y][x] = ' ';
                }
            }
        }
        map[5][5] = '⇓';
        const rooms = [{
            left: 1,
            top: 1,
            w: 8,
            h: 8,
            x: 5,
            y: 5,
            type: 'SurfaceRoom',
            connections: []
        }];
        return { map, rooms };
    }
}