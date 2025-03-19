// systems/DataSystem.js
// Manages static game data (monsters, items, levels)

import { System } from '../core/Systems.js';

export class DataSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = []; // No entity requirements, acts as a data provider

        // Monster templates
        this.monsterTemplates = [
            { x: 0, y: 0, name: "Skeleton", classes: "skeleton", avatar: "s", baseHp: 12, maxHp: 12, hp: 12, minBaseDamage: 1, maxBaseDamage: 3, isAggro: false, isElite: false, isBoss: false, affixes: [] },
            { x: 0, y: 0, name: "Goblin", classes: "goblin", avatar: "g", baseHp: 15, maxHp: 15, hp: 24, minBaseDamage: 2, maxBaseDamage: 3, isAggro: false, isElite: false, isBoss: false, affixes: [] },
            { x: 0, y: 0, name: "Orc", classes: "orc", avatar: "o", baseHp: 18, maxHp: 18, hp: 18, minBaseDamage: 3, maxBaseDamage: 4, isAggro: false, isElite: false, isBoss: false, affixes: [] }
        ];

        // Unique monsters
        this.uniqueMonsters = [
            { x: 0, y: 0, name: "Orc Chieftan", classes: "orc", avatar: "O", baseHp: 25, maxHp: 25, hp: 25, minBaseDamage: 3, maxBaseDamage: 5, isAggro: false, isElite: true, isBoss: false, affixes: [] }
        ];

        // Boss monsters
        this.bossMonsters = [
            {
                x: 0, y: 0, name: "Plinklefart", classes: "Demon", avatar: "P", baseHp: 50, maxHp: 50, hp: 50, minBaseDamage: 1, maxBaseDamage: 6, isAggro: false, isElite: true, isBoss: true, affixes: [], gold: 100, uniqueItemsDropped: [
                    { name: "Golden Khepresh", type: "armor", slot: "armor", armor: 5, itemTier: "relic", stats: { prowess: 5, maxHp: 30, agility: 5 }, description: "A majestic helm worthy of a king.", uniqueId: null, icon: "golden-khepresh.svg", relicAffixes: [] }
                ]
            }
        ];

        // Start items
        this.startItems = [
            { name: "Rusty Dagger", type: "weapon", attackType: "melee", slots: ["mainhand", "offhand"], baseBlock: 1, baseDamageMin: 1, baseDamageMax: 3, itemTier: "junk", description: "A rusty dagger, barely sharp.", uniqueId: null, icon: "dagger.svg" },
            { name: "Ragged Robes", type: "armor", attackType: null, slot: "armor", armor: 1, itemTier: "junk", description: "Musty old ragged robes. Will this actually protect you from anything?", uniqueId: null, icon: "robe.svg" },
            { name: "Crooked Wand", type: "weapon", attackType: "ranged", baseRange: 4, slots: ["mainhand", "offhand"], baseDamageMin: 2, baseDamageMax: 3, itemTier: "junk", description: "A crooked wand, hope it shoots straighter than it looks.", uniqueId: null, icon: "crooked-wand.svg", maxLuck: 15 }
        ];

        // Unique items (subset for now, will sync with ItemSystem later)
        this.uniqueItems = [
            { name: "Mbphu Greater iLvl Annihilation Staff", type: "weapon", attackType: "ranged", baseRange: 7, slots: ["mainhand", "offhand"], baseDamageMin: 10, baseDamageMax: 15, itemTier: "relic", stats: { intellect: 5, maxMana: 5, agility: 5, damageBonus: 5, rangedDamageBonus: 5 }, description: "The Golden Khepresh has got nothing on this babby!", uniqueId: null, icon: "mbphu-staff.svg" }
        ];

        // Custom surface level
        this.customSurfaceLevel = {
            map: this.generateSurfaceMap(),
            rooms: [{ left: 1, top: 1, w: 8, h: 8, x: 5, y: 5, type: 'SurfaceRoom', connections: [] }],
            stairsUp: { x: 2, y: 2 },
            stairsDown: { x: 5, y: 5 },
        playerSpawn: { x: 1, y: 1 },
        monsters: [],
            treasures: [],
                fountains: [],
                    spawn: []
        };
        // Stat opotions for ROG System items
        this.itemStatOptions = {
            weapon: {
                ranged: {
                    base: ['baseDamageMin', 'baseDamageMax', 'attackType', 'baseRange'],
                    bonus: ['intellect', 'agility', 'range', 'rangedDamageBonus', 'damageBonus'],
                },
                melee: {
                    base: ['baseDamageMin', 'baseDamageMax', 'attackType', 'baseBlock'],
                    bonus: ['prowess', 'agility', 'block', 'meleeDamageBonus', 'damageBonus'],
                },
            },
            armor: {
                base: ['armor'],
                bonus: ['maxHp', 'prowess', 'agility', 'block', 'defense'],
            },
            amulet: {
                base: ['maxLuck'],
                bonus: [
                    'maxHp', 'maxMana',
                    'intellect', 'prowess', 'agility',
                    'range', 'block', 'defense',
                    'meleeDamageBonus', 'rangedDamageBonus', 'damageBonus'
                ],
            },
            ring: {
                base: ['maxLuck'],
                bonus: [
                    'maxHp', 'maxMana',
                    'intellect', 'prowess', 'agility',
                    'range', 'block', 'defense',
                    'meleeDamageBonus', 'rangedDamageBonus', 'damageBonus'
                ],
            },
        };
}

init() {
    this.eventBus.on('GetCustomLevel', (data) => this.provideCustomLevel(data));
    this.eventBus.on('GetMonsterTemplates', (data) => this.provideMonsterTemplates(data));
    this.eventBus.on('GetUniqueMonsters', (data) => this.provideUniqueMonsters(data));
    this.eventBus.on('GetBossMonsters', (data) => this.provideBossMonsters(data));
    this.eventBus.on('GetStartItems', (data) => this.provideStartItems(data));
    this.eventBus.on('GetUniqueItems', (data) => this.provideUniqueItems(data));
    this.eventBus.on('GetItemStatOptions', (data) => {
        this.provideItemStatOptions(data);
        console.log('DataSystem: GetItemStatOptions event received');
    });
}

generateSurfaceMap() {
    const state = this.entityManager.getEntity('state');
    let map = [];
    for (let y = 0; y < 67; y++) {
        map[y] = [];
        for (let x = 0; x < 122; x++) {
            if (y < 10 && x < 10) {
                map[y][x] = (y === 0 || y === 9 || x === 0 || x === 9) ? '#' : ' ';
            } else {
                map[y][x] = '#';
            }
        }
    }
    map[2][2] = '⇑';
    map[5][5] = '⇓';
    return map;
}

provideCustomLevel({ tier, callback }) {
    if (tier === 0) {
        callback(JSON.parse(JSON.stringify(this.customSurfaceLevel)));
    } else {
        callback(null);
    }
    }

    provideItemStatOptions({ callback }) {
        callback(JSON.parse(JSON.stringify(this.itemStatOptions)));
    }

    provideMonsterTemplates({ callback }) {
        callback(JSON.parse(JSON.stringify(this.monsterTemplates)));
    }

    provideUniqueMonsters({ callback }) {
        callback(JSON.parse(JSON.stringify(this.uniqueMonsters)));
    }

    provideBossMonsters({ callback }) {
        callback(JSON.parse(JSON.stringify(this.bossMonsters)));
    }

    provideStartItems({ callback }) {
        callback(JSON.parse(JSON.stringify(this.startItems)));
    }

    provideUniqueItems({ callback }) {
        callback(JSON.parse(JSON.stringify(this.uniqueItems)));
    }
}




    /*
    //add later when player naming and saving is implemented
PlayerSystem.prototype.mageNames = [
    "Elarion", "Sylvara", "Tharion", "Lysandra", "Zephyrion", "Morwenna", "Aethric",
    "Vionelle", "Dravenor", "Celestine", "Kaelith", "Seraphine", "Tormund", "Elowen",
    "Zarathis", "Lunara", "Veyron", "Ashka", "Rivenna", "Solthar", "Ysmera", "Drenvar",
    "Thalindra", "Orythia", "Xandrel", "Miravelle", "Korathis", "Eryndor", "Valthira",
    "Nythera"
];
    */