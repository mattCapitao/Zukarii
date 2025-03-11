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
                baseHp: 20,
                maxHp: 20,
                hp: 20,
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
                baseHp: 24,
                maxHp: 24,
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
                baseHp: 26,
                maxHp: 26,
                hp: 26,
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
                name: "Plinklefart",
                classes: "Demon",
                avatar: "P",
                baseHp: 50,
                maxHp: 50,
                hp: 50,
                minBaseDamage: 4,
                maxBaseDamage: 6,
                isAggro: false,
                isElite: true,
                isBoss: true,
                affixes: ['poisonGas'],
                gold: 100,
                uniqueItemsDropped: ['Golden Khepresh'],
            },
            {
                x: 0,
                y: 0,
                name: "T`Kore-Tickrob",
                classes: "demon",
                avatar: "K",
                baseHp: 100,
                maxHp: 100,
                hp: 100,
                minBaseDamage: 0,
                maxBaseDamage: 2,
                isAggro: false,
                isElite: true,
                isBoss: true,
                affixes: ['goldTheft'],
                gold: 100,
                uniqueItemsDropped: ['Stolen Honor'],
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
            },
        ];

        this._uniqueItems = [
            {
                name: "Mbphu Staff ",
                type: "weapon",
                attackType: "ranged",
                baseRange: 7,
                slots: ["mainhand", "offhand"],
                baseDamageMin: 10,
                baseDamageMax: 15,
                itemTier: "relic",
                stats: {
                    intellect: 10,
                    maxMana: 10,
                    agility: 10,
                    maxLuck: 10,
                    maxHp: 15,
                    damageBonus: 5,
                },
                description: "The Golden Khepresh has got nothing on this babby! ",
                uniqueId: null,
                icon: "mbphu-staff.svg",
            },
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
                    maxLuck: 5,
                    maxHp: 5,
                },
                description: "A majestic helm worthy of a king.",
                uniqueId: null,
                icon: "golden-khepresh.svg",
                relicAffixes: [],
            },
            {
                name: "The Preciousss",
                type: "ring",
                slot: "ring",
                luck: 0,
                itemTier: "relic",
                stats: {
                    maxHp: 20,
                    damageBonus: 15,
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

    }

    getMonsterTemplates() {
        return JSON.parse(JSON.stringify(this._monsterTemplates));
    }

    getUniqueMonsters() {
        return JSON.parse(JSON.stringify(this._uniqueMonsters));
    }

    getStartItems() {
        return JSON.parse(JSON.stringify(this._startItems));
    }

    getUniqueItems() {
        return JSON.parse(JSON.stringify(this._uniqueItems));
    }

}


