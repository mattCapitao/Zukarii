//console.log("Data.js loaded");

export class Data {
    constructor() {
        // Static JSON objects defined her

        this._monsterTemplates = [
            {
                x: 0,
                y: 0,
                name: "Skeleton",
                classes: "skeleton",
                avatar: "s",
                baseHp: 12,
                maxHp: 12,
                hp: 12,
                minBaseDamage: 1,
                maxBaseDamage: 3,
                isAggro: false,
                isElite: false,
                isBoss: false,
                affixes: [],
            },
            {
                x: 0,
                y: 0,
                name: "Goblin",
                classes: "goblin",
                avatar: "g",
                baseHp: 15,
                maxHp: 15,
                hp: 24,
                minBaseDamage: 2,
                maxBaseDamage: 3,
                isAggro: false,
                isElite: false,
                isBoss: false,
                affixes: [],
            },
            {
                x: 0,
                y: 0,
                name: "Orc",
                classes: "orc",
                avatar: "o",
                baseHp: 18,
                maxHp: 18,
                hp: 18,
                minBaseDamage: 3,
                maxBaseDamage: 4,
                isAggro: false,
                isElite: false,
                isBoss: false,
                affixes: [],
            }
        ];

        this._uniqueMonsters = [
            {
                x: 0,
                y: 0,
                name: "Orc Chieftan",
                classes: "orc",
                avatar: "O",
                baseHp: 25,
                maxHp: 25,
                hp: 25,
                minBaseDamage: 3,
                maxBaseDamage: 5,
                isAggro: false,
                isElite: true,
                isBoss: false,
                affixes: [],
            },
        ];

        this._bossMonsters = [
             {
                x: 0,
                y: 0,
                name: "Plinklefart",
                classes: "Demon",
                avatar: "P",
                baseHp: 50,
                maxHp: 50,
                hp: 50,
                minBaseDamage: 1,
                maxBaseDamage: 6,
                isAggro: false,
                isElite: true,
                isBoss: true,
                affixes: [],//['poisonGas'],
                gold: 100,
                uniqueItemsDropped: [
                    {
                        name: "Golden Khepresh",
                        type: "armor",
                        slot: "armor",
                        armor: 5,
                        itemTier: "relic",
                        stats: {
                            prowess: 5,
                            maxHP: 30,
                            agility: 5,
                            maxHp: 5,
                        },
                        description: "A majestic helm worthy of a king.",
                        uniqueId: null,
                        icon: "golden-khepresh.svg",
                        relicAffixes: [],
                    },
                ],
             },
            {
                x: 0,
                y: 0,
                name: "T`Kore-Tickrob",
                classes: "demon",
                avatar: "K",
                baseHp: 50,
                maxHp: 50,
                hp: 50,
                minBaseDamage: 1,
                maxBaseDamage: 3,
                isAggro: false,
                isElite: true,
                isBoss: true,
                affixes: ['goldTheft'],
                gold: 0,
                uniqueItemsDropped: [{
                    name: "Golden Skin of T`Kore-Tickrob",
                    type: "armor",
                    slot: "armor",
                    armor: -6,
                    itemTier: "relic",
                    stats: {
                        prowess: 0,
                        agility: 0,
                        maxHP: 0,
                        defense: 0,
                        block: 0,
                        maxLuck: -66,
                    },
                    description: "Shiny but it doesnt seem to do anything!, Maybe if it was perfectly activated?",
                    uniqueId: null,
                    icon: "golden-skin.png",
                    relicAffixes: [],
                },],
            },
        ];

        this._startItems = [
            {
                name: "Rusty Dagger",
                type: "weapon",
                attackType: "melee",
                slots: ["mainhand", "offhand"],
                baseBlock: 1,
                baseDamageMin: 1,
                baseDamageMax: 3,
                itemTier: "junk",
                description: "A rusty dagger, barely sharp.",
                uniqueId: null,
                icon: "dagger.svg",
            },
            {
                name: "Ragged Robes",
                type: "armor",
                attackType: null,
                slot: "armor",
                armor: 1,
                itemTier: "junk",
                description: "Musty old ragged robes. Will this actually protect you from anything?",
                uniqueId: null,
                icon: "robe.svg",
            },
            {
                name: "Crooked Wand",
                type: "weapon",
                attackType: "ranged",
                baseRange: 4,
                slots: ["mainhand", "offhand"],
                baseDamageMin: 2,
                baseDamageMax: 3,
                itemTier: "junk",
                description: "A crooked wand, hope it shoots straighter than it looks.",
                uniqueId: null,
                icon: "crooked-wand.svg",
                maxLuck: 15,
            },
        ];

        this._uniqueItems = [
            {
                name: "Mbphu Greater iLvl Annihilation Staff",
                type: "weapon",
                attackType: "ranged",
                baseRange: 7,
                slots: ["mainhand", "offhand"],
                baseDamageMin: 10,
                baseDamageMax: 15,
                itemTier: "relic",
                stats: {
                    intellect: 5,
                    maxMana: 5,
                    agility: 5,
                    damageBonus: 5,
                    rangedBonus: 5,
                },
                description: "The Golden Khepresh has got nothing on this babby! ",
                uniqueId: null,
                icon: "mbphu-staff.svg",
            },
            {
                name: "The Preciousss",
                type: "ring",
                slot: "ring",
                luck: -15,
                itemTier: "relic",
                stats: {
                    maxHp: 20,
                    damageBonus: 10,
                },
                description: "A plain simple gold band, that you mussst possesss.",
                uniqueId: null,
                icon: "golden-khepresh.svg",
                relicAffixes: [],
            },
            {
                name: "Stolen Honor",
                type: "amulet",
                slot: "amulet",
                luck: 10,
                itemTier: "relic",
                stats: {
                    intellect: 5,
                    agility: 15,
                    damageBonus: 15,
                },
                description: "An amulet radiating malicious energy.",
                uniqueId: null,
                icon: "golden-khepresh.svg",
                relicAffixes: [],
            },
            
        ];

        this._customSurfaceLevel = {
            map: (() => {
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
                map[2][2] = '⇑'; // Stairs up
                map[5][5] = '⇓'; // Stairs down
                return map;
            })(),
            rooms: [{ left: 1, top: 1, w: 8, h: 8, x: 5, y: 5, type: 'SurfaceRoom', connections: [] }],
            stairsUp: { x: 2, y: 2 },
            stairsDown: { x: 5, y: 5 },
            playerSpawn: { x: 1, y: 1 },
            monsters: [],
            treasures: [],
            fountains: [],
            spawn: []
        };


    }

    getCustomLevel(tier) {
        return tier === 0 ? JSON.parse(JSON.stringify(this._customSurfaceLevel)) : null;
    }

    getMonsterTemplates() {
        return JSON.parse(JSON.stringify(this._monsterTemplates));
    }

    getUniqueMonsters() {
        return JSON.parse(JSON.stringify(this._uniqueMonsters));
    }

    getBossMonsters() {
        return JSON.parse(JSON.stringify(this._bossMonsters));
    }

    getStartItems() {
        return JSON.parse(JSON.stringify(this._startItems));
    }

    getUniqueItems() {
        return JSON.parse(JSON.stringify(this._uniqueItems));
    }

}


