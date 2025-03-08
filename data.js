console.log("data.js loaded");

class Data {
    constructor() {
        // Static JSON objects defined here
        this._emptyEquipSlots = {
            mainhand: {
                name: "Mainhand",
                type: "weapon",
                attackType: "melee",
                slots: ["mainhand"],
                baseBlock: 0,
                baseDamageMin: 1,
                baseDamageMax: 1,
                uniqueId: null, // Will be set by generateUniqueId in constructor
                itemTier: "Empty",
                description: "Not equipped.",
                icon: "no-mainhand.svg",
            },
            offhand: {
                name: "Offhand",
                type: "weapon",
                slots: ["offhand"],
                baseRange: 0,
                baseDamageMin: 0,
                baseDamageMax: 0,
                uniqueId: null,
                itemTier: "Empty",
                description: "Not equipped.",
                icon: "no-offhand.svg",
            },
            armor: {
                name: "Armor",
                type: "armor",
                slot: "armor",
                uniqueId: null,
                itemTier: "Empty",
                armor: 0,
                description: "Not equipped.",
                icon: "no-armor.svg",
            },
            amulet: {
                name: "Amulet",
                type: "amulet",
                slot: "amulet",
                uniqueId: null,
                itemTier: "Empty",
                description: "Not equipped.",
                icon: "no-amulet.svg",
            },
            rightring: {
                name: "Right Ring",
                type: "ring",
                slot: "rightring",
                uniqueId: null,
                itemTier: "Empty",
                description: "Not equipped.",
                icon: "no-rightring.svg",
            },
            leftring: {
                name: "Left Ring",
                type: "ring",
                slot: "leftring",
                uniqueId: null,
                itemTier: "Empty",
                description: "Not equipped.",
                icon: "no-leftring.svg",
            },
        };

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
                slots: ["mainhand", "offhand"],
                baseDamageMin: 2,
                baseDamageMax: 3,
                itemTier: "junk",
                description: "A crooked wand, hope it shoots straighter than it looks.",
                uniqueId: null,
                icon: "crooked-wand.svg",
            },
            {
                name: "Bronze Dagger",
                type: "weapon",
                attackType: "melee",
                slots: ["mainhand", "offhand"],
                baseDamageMin: 2,
                baseDamageMax: 3,
                itemTier: "common",
                description: "The blade is sharp but the metal is soft.",
                uniqueId: null,
                icon: "dagger.svg",
            },
            {
                name: "Willow Wand",
                type: "weapon",
                attackType: "ranged",
                slots: ["mainhand", "offhand"],
                baseDamageMin: 2,
                baseDamageMax: 4,
                itemTier: "common",
                description: `No sense any innate power here, but it should do the trick.`,
                uniqueId: null,
                icon: "willow-wand.svg",
            },
            {
                name: "Apprentice Robes",
                type: "armor",
                attackType: null,
                slot: "armor",
                armor: 2,
                itemTier: "common",
                description: "Plain and ordinary, but there are no holes and the fabric is heavy",
                uniqueId: null,
                icon: "robe.svg",
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

    // Getter for emptyEquipSlots
    getEmptyEquipSlots() {
        // Return a deep copy to prevent external modification
        return JSON.parse(JSON.stringify(this._emptyEquipSlots));
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


    // Placeholder for future fetch implementation
    // async getEmptyEquipSlots() {
    //     const response = await fetch('data/emptyEquipSlots.json');
    //     const data = await response.json();
    //     return data;
    // }
}

window.Data = Data; // Expose globally for now, to match current structure
