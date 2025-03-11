//console.log("State.js loaded");

import { Data } from './Data.js';
import { Utilities } from './Utilities.js';

export class State {
    constructor(data, utilities) {
        this.data = data;
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
        this.tier = 1;
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
            healPotions: 5,
            potionDropFail: 0,
            torches: 1,
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
        this.highestTier = 1;
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

   initGame() {
    const levelService = this.game.getService('level');
    const monstersService = this.game.getService('monsters');
    const splash = document.getElementById('splash');
    if (splash) splash.remove();

    this.levels[0] = this.generateSurfaceLevel();
    this.treasures[0] = [];
    this.monsters[0] = [];
    this.fountains[0] = [];
    this.stairsUp[0] = null;
    this.stairsDown[0] = { x: 5, y: 5 };
    this.discoveredWalls[0] = new Set();
    this.discoveredFloors[0] = new Set();
    this.discoveredTileCount[0] = 0;
    this.visibleTiles[0] = new Set();
    this.tileMap[0] = levelService.buildTileMap(0);
    //console.log(`Tier 0 initialized: stairsDown[0] at (5, 5)`);

    this.treasures[1] = [];
    this.stairsUp = { 1: null, ...this.stairsUp };
    this.stairsDown = { 1: null, ...this.stairsDown };
    this.levels[1] = levelService.generateLevel();
    const GeneratedMonsters = monstersService.generateLevelMonsters(1);
    this.monsters[1] = GeneratedMonsters;
    //console.log(`Tier Monsters: ${GeneratedMonsters}`);
    //console.log(`Tier Monsters: ${this.monsters[1]}`);
    this.fountains[1] = levelService.generateFountains(1);
    this.discoveredWalls[1] = new Set();
    this.discoveredFloors[1] = new Set();
    this.discoveredTileCount[1] = 0;
    this.visibleTiles[1] = new Set();
    this.tileMap[1] = levelService.buildTileMap(1);

    const upRooms = this.levels[1].rooms.filter(r => r.type !== 'AlcoveSpecial' && r.type !== 'BossChamberSpecial');
    const upRoomIndex = Math.floor(Math.random() * upRooms.length);
    const upRoom = upRooms[upRoomIndex];
    let stairUpX = upRoom.left + 1 + Math.floor(Math.random() * (upRoom.w - 2));
    let stairUpY = upRoom.top + 1 + Math.floor(Math.random() * (upRoom.h - 2));
    this.levels[1].map[stairUpY][stairUpX] = '⇑';
    this.stairsUp[1] = { x: stairUpX, y: stairUpY };

    let downRoom, stairDownX, stairDownY;
    const downOptions = this.levels[1].rooms.map(room => {
        const centerX = room.left + Math.floor(room.w / 2);
        const centerY = room.top + Math.floor(room.h / 2);
        const dx = stairUpX - centerX;
        const dy = stairUpY - centerY;
        return { room, distance: Math.sqrt(dx * dx + dy * dy) };
    }).sort((a, b) => b.distance - a.distance);

    const farRooms = downOptions.filter(opt => opt.distance >= this.MIN_STAIR_DISTANCE);
    downRoom = farRooms.find(opt => opt.room.type === 'BossChamberSpecial')?.room ||
        farRooms.find(opt => opt.room.type === 'AlcoveSpecial')?.room ||
        farRooms[0]?.room || downOptions[0].room;
    stairDownX = downRoom.left + 1 + Math.floor(Math.random() * (downRoom.w - 2));
    stairDownY = downRoom.top + 1 + Math.floor(Math.random() * (downRoom.h - 2));
    this.levels[1].map[stairDownY][stairDownX] = '⇓';
    this.stairsDown[1] = { x: stairDownX, y: stairDownY };

    //console.log(`Tier 1 initialized: stairsUp[1] at (${stairUpX}, ${stairUpY}), stairsDown[1] at (${stairDownX}, ${stairDownY})`);
    //console.log("Initializing treasures for tier 1");
    levelService.generateTreasures(1);

    this.player.x = stairUpX + 1;
    this.player.y = stairUpY;
    const map = this.levels[1].map;
    if (map[this.player.y][this.player.x] !== ' ') {
        const directions = [
            { x: stairUpX - 1, y: stairUpY },
            { x: stairUpX, y: stairUpY + 1 },
            { x: stairUpX, y: stairUpY - 1 }
        ];
        for (let dir of directions) {
            if (map[dir.y][dir.x] === ' ') {
                this.player.x = dir.x;
                this.player.y = dir.y;
                break;
            }
        }
    }

    this.lastPlayerX = null;
    this.lastPlayerY = null;
    this.needsInitialRender = true;
    this.needsRender = true;
}
}