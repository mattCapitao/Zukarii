console.log("Player.js loaded");

import { State } from './State.js';

export class Player {
    constructor(state) {
        this.state = state;
        this.initializePlayer();
    }

    initializePlayer() {
        this.statInit();
        this.addStartingItems();
    }

    statInit() {
        this.state.player.stats.base.intellect = this.state.utilities.dRoll(4, 3, 3);
        this.state.player.stats.base.prowess = this.state.utilities.dRoll(4, 3, 3);
        this.state.player.stats.base.agility = this.state.utilities.dRoll(4, 3, 3);
        this.state.player.stats.base.maxHp = Math.round(30 * this.state.player.stats.base.prowess * 0.1);
        this.state.player.stats.base.maxMana = Math.round(10 * this.state.player.stats.base.intellect * 0.05);
        console.log("Player base stats initialized", this.state.player.stats.base);

        // Manually init current stat values that are not updated by calculateStats()
        this.state.player.hp = this.state.player.stats.base.maxHp;
        this.state.player.mana = this.state.player.stats.base.maxMana;
        console.log("Player stats initialized", this.state.player);
        this.state.player.nextLevelXp = 100;
        this.updateGearStats()
    }

    initializeEquippedSlots() {
        const emptyEquipSlots = this.state.data.getEmptyEquipSlots();
        const slotsWithIds = {};
        Object.entries(emptyEquipSlots).forEach(([slot, data]) => {
            slotsWithIds[slot] = {
                ...data,
                uniqueId: this.state.utilities.generateUniqueId(),

            };
        });
        return slotsWithIds;
    }

    addStartingItems() {
        const itemsService = this.state.game.getService('items');
        const playerInventory = this.state.game.getService('playerInventory');

        this.state.player.inventory.equipped = this.initializeEquippedSlots();
        console.log("Equipped slots initialized", this.state.player.inventory.equipped);
        const startItems = this.state.data.getStartItems();
        const uniqueItems = this.state.data.getUniqueItems();

        const itemsToAdd = this.getInitialItems(startItems, uniqueItems);
        const randomStartItems = this.getRandomStartItems();

        randomStartItems.forEach(item => {
            const maxRogTierRoll = 20; //  15:5 junk:common split
            const rogTierRoll = (Math.floor(Math.random() * maxRogTierRoll) + 1) * 0.01; // 0.01 - 0.25
            const rogItem = itemsService.rogItem(rogTierRoll, item);
            itemsToAdd.push(rogItem);
        });

        itemsToAdd.forEach(item => {
            playerInventory.addItem(item);
        });

        console.log("Starting rog items added:", this.state.player.inventory.items);
    }

    getInitialItems(startItems, uniqueItems) {
        return [
            // Add specific start items and unique items if needed
            // startItems[0], startItems[1], startItems[2],
           //uniqueItems[0],
        ];
    }

    getRandomStartItems() {
        return [
            { type: 'weapon', attackType: 'ranged' },{ type: 'weapon', attackType: 'melee' },{ type: 'armor' },

            { type: 'ring', }, { type: 'ring', }, { type: 'ring', }, { type: 'ring', }, { type: 'ring', }, { type: 'ring', }, { type: 'ring', }, { type: 'ring', }, 

            

        ];
    }

    calculatePlayerDamage(baseStat, minBaseDamage, maxBaseDamage, damageBonus) {
        let baseDamage = Math.floor(Math.random() * (maxBaseDamage - minBaseDamage + 1)) + minBaseDamage + this.state.player.level;
        let playerDamage = Math.round(baseDamage * (baseStat * 0.20)) + damageBonus;
        let isCrit = false;

        const critChance = (this.state.player.agility / 10) + 1;
        if (Math.random() * 100 < critChance) {
            const critMultiplier = 1.5;
            playerDamage = Math.round(playerDamage * critMultiplier);
            isCrit = true;
        }

        return { damage: playerDamage, isCrit };
    }

    awardXp(amount) {
        this.state.player.xp += amount;
        this.state.game.getService('ui').writeToLog(`Gained ${amount} XP (${this.state.player.xp}/${this.state.player.nextLevelXp})`);
        this.checkLevelUp();
    }

    checkLevelUp() {
        while (this.state.player.xp >= this.state.player.nextLevelXp) {
            const newXp = this.state.player.xp - this.state.player.nextLevelXp;
            this.state.player.level++;

            if (this.state.player.level % 3 === 0) {
                const stats = ['prowess', 'intellect', 'agility'];
                const statToBoost = stats[Math.floor(Math.random() * 3)];
                this.state.player[statToBoost]++;
                this.state.game.getService('ui').writeToLog(`Your ${statToBoost} increased to ${this.state.player[statToBoost]}!`);
            }

            const hpIncrease = Math.round((6 + this.state.player.level) * this.state.player.prowess * 0.1);
            const mpIncrease = Math.round((2 + this.state.player.level) * this.state.player.intellect * 0.05);
            this.state.player.stats.base.maxHp += hpIncrease;
            this.state.player.stats.base.maxMana += mpIncrease;
            this.state.player.maxHp = this.state.player.stats.base.maxHp;
            this.state.player.maxMana = this.state.player.stats.base.maxMana;
            this.state.player.hp = this.state.player.maxHp;
            this.state.player.mana = this.state.player.maxMana;
            this.state.player.xp = newXp;
            this.state.player.nextLevelXp = Math.round(this.state.player.nextLevelXp * 1.5);
            this.state.game.getService('ui').writeToLog(`Level up! Now level ${this.state.player.level}, Max HP increased by ${hpIncrease} to ${this.state.player.maxHp}`);

            this.state.game.getService('ui').statRefreshUI();
        }
    }

    death(source) {
        this.state.player.hp = 0;
        this.state.player.dead = true;
        this.state.game.getService('ui').writeToLog('You died! Game Over.');
        document.removeEventListener('keydown', this.state.game.handleInput);
        document.removeEventListener('keyup', this.state.game.handleInput);
        console.log("Player has died - Game over!");
        this.state.gameOver = true;
        this.state.game.getService('ui').gameOver('You have been killed by a ' + source + '!');
        this.state.game.getService('ui').statRefreshUI();
    }

    exit() {
        this.state.game.getService('ui').writeToLog("You exited the dungeon! Game Over.");
        document.removeEventListener('keydown', this.state.game.handleInput);
        document.removeEventListener('keyup', this.state.game.handleInput);
        console.log("Player has Left the building - Game over!");
        this.state.gameOver = true;
        this.state.game.getService('ui').gameOver('You exited the dungeon! Too much adventure to handle eh?');
        this.state.game.getService('ui').statRefreshUI();
    }

    updateGearStats() {
        console.log("Before Updating gear stats", this.state.player);

        const startGearProwess = this.state.player.stats.gear.prowess;

        this.state.possibleItemStats.forEach(stat => {
            this.state.player.stats.gear[stat] = 0;
        });

        Object.values(this.state.player.inventory.equipped).forEach(item => {
            if ('stats' in item && item.stats) {
                const propCount = Object.keys(item.stats).length;
                if (propCount > 0) {
                    Object.entries(item.stats).forEach(([stat, value]) => {
                        this.state.player.stats.gear[stat] = (this.state.player.stats.gear[stat] || 0) + (value || 0);
                    });
                }
            }

            if (item.type === 'armor') {
                console.log("Armor change detected", item.armor);
                this.state.player.stats.gear.armor = (this.state.player.stats.gear.armor || 0) + (item.armor || 0);
            }

            if (item.type === 'weapon') {
                switch (item.attackType) {
                    case 'melee':
                        this.state.player.stats.gear.block = (this.state.player.stats.gear.block || 0) + (item.baseBlock || 0);
                        break;
                    case 'ranged':
                        this.state.player.stats.gear.Baserange = Math.max(this.state.player.stats.gear.baseRange, item.baseRange, 0);
                        this.state.player.stats.gear.range = (this.state.player.stats.gear.range || 0) + (this.state.player.stats.gear.Baserange || 0);
                        break;
                    default:
                        console.log("Unknown weapon type");
                        break;
                }
            }
        });
        const endGearProwess = this.state.player.stats.gear.prowess;

        const increasedProwess = endGearProwess - startGearProwess;
        const newHp = Math.round((this.state.player.stats.base.maxHp + this.state.player.stats.gear.maxHp) * (increasedProwess * .05));

        this.state.player.stats.gear.maxHp += newHp;

        console.log("After Updating gear stats", this.state.player);
        this.calculateStats();
    }

    calculateStats() {
        this.state.possibleItemStats.forEach(stat => {
            switch (stat) {
                case 'maxLuck':
                    this.state.player[stat] = this.state.player.stats.base[stat] + this.state.player.stats.gear[stat];
                    this.state.player.luck = this.state.player[stat] + this.state.player.luckTempMod;
                    console.log(`Luck = base:${this.state.player.stats.base[stat]} + gear:${this.state.player.stats.gear[stat]} + temp:${this.state.player.luckTempMod}`);
                    break;
                default:
                    this.state.player[stat] = (this.state.player.stats.base[stat] || 0) + (this.state.player.stats.gear[stat] || 0);
                    console.log(`${stat} = base:${this.state.player.stats.base[stat] || 0} + gear:${this.state.player.stats.gear[stat] || 0}`);
                    break;
            }
        });

        // Ensure HP and mana are set
        this.state.player.maxHp = this.state.player.stats.base.maxHp + (this.state.player.stats.gear.maxHp || 0);
        this.state.player.maxMana = this.state.player.stats.base.maxMana + (this.state.player.stats.gear.maxMana || 0);
        this.state.player.hp = Math.min(this.state.player.hp, this.state.player.maxHp);
        this.state.player.mana = Math.min(this.state.player.mana, this.state.player.maxMana);
        console.log("After calculateStats:", {
            maxHp: this.state.player.maxHp,
            hp: this.state.player.hp,
            maxMana: this.state.player.maxMana,
            mana: this.state.player.mana
        });
        this.state.game.getService('ui').statRefreshUI();
    }

    promptForName(delay) {
        setTimeout(() => {
            try {
                let userCharacterName = prompt("Please name your character to begin:");
                if (userCharacterName !== null) {
                    console.log("Hello, " + userCharacterName + "!");
                    const sanitizedInput = this.state.utilities.encodeHTMLEntities(userCharacterName);
                    this.state.player.name = sanitizedInput;
                    this.state.game.getService('ui').updatePlayerInfo();
                } else {
                    console.log("User cancelled the prompt.");
                    this.state.player.name = this.state.utilities.getRandomName(this.state.game.getService('render').mageNames);
                    this.state.game.getService('ui').writeToLog(`You didnt enter a name, so a random one has been given to you, ${this.state.player.name} `);
                    this.state.game.getService('ui').updatePlayerInfo();
                }
            } catch (error) {
                console.error("Error in promptForName:", error);
                this.state.player.name = this.state.utilities.getRandomName(this.state.game.getService('render').mageNames);
                this.state.game.getService('ui').writeToLog(`Failed to get name due to an error, assigned: ${this.state.player.name}`);
                this.state.game.getService('ui').updatePlayerInfo();
            }
        }, delay);
    }
}