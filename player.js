//console.log("Player.js loaded");

import { State } from './State.js';

export class Player {
    constructor(state) {
        this.state = state;
        this.statInit();
        this.addStartingItems();
    }

    statInit() {
        this.state.player.stats.base.intellect = this.state.utilities.dRoll(4, 3, 3);
        this.state.player.stats.base.prowess = this.state.utilities.dRoll(4, 3, 3);
        this.state.player.stats.base.agility = this.state.utilities.dRoll(4, 3, 3);
        this.state.player.stats.base.maxHp = Math.round(30 * this.state.player.stats.base.prowess * 0.1);
        this.state.player.stats.base.maxMana = Math.round(10 * this.state.player.stats.base.intellect * 0.05);
        //console.log("Player base stats initialized", this.state.player.stats.base);

        // Manually init current stat values that are not updated by calculateStats()
        this.state.player.hp = this.state.player.stats.base.maxHp;
        this.state.player.mana = this.state.player.stats.base.maxMana;
        //console.log("Player stats initialized", this.state.player);
        this.state.player.nextLevelXp = 125;
        this.updateGearStats()
    }

    addStartingItems() {
        const itemsService = this.state.game.getService('items');
        const playerInventory = this.state.game.getService('playerInventory');

        const startItems = this.state.game.getService('data').getStartItems();
        const uniqueItems = this.state.game.getService('data').getUniqueItems();

        const itemsToAdd = this.getInitialItems(startItems, uniqueItems); //create array of specific start/unique items
        const randomStartItems = this.getRandomStartItems(); //create array of start items with some params to send to ROG

        randomStartItems.forEach(item => {
            const tierIndex = Math.round(Math.random() - .2) || 0; 
            const rogItem = itemsService.getItem(tierIndex, item);
            itemsToAdd.push(rogItem);
        });

        itemsToAdd.forEach(item => {
            playerInventory.addItem(item);
        });

        //console.log("Starting rog items added:", this.state.player.inventory.items);
        this.state.player.torches = 1;
        this.state.player.healPotions = 1;
        this.state.player.gold = 100;
    }

    getInitialItems(startItems, uniqueItems) {
        return [ // Add specific start items and unique items if needed
            startItems[0], startItems[1], startItems[2],//uniqueItems[0], 
        ];
    }

    getRandomStartItems() {
        return [
            {},
            //{ type: 'weapon', attackType: 'ranged' }, { type: 'weapon', attackType: 'melee' }, 
            //{ type: 'ring', }, { type: 'ring', }, {type: 'amulet'},
        ];
    }

    //change to receive weapon and monster
    calculatePlayerDamage(baseStat, minBaseDamage, maxBaseDamage, damageBonus) {
        
        console.log("Calculating player damage", { baseStat, minBaseDamage, maxBaseDamage, damageBonus });

        let damageRoll = Math.floor(Math.random() * (maxBaseDamage - minBaseDamage + 1)) + minBaseDamage;
        console.log("Damage roll: ", damageRoll);

        let baseDamage = damageRoll + this.state.player.level;
        console.log("Base damage with player level modifier: ", baseDamage);

        let playerDamage = Math.round((baseDamage + damageBonus ) * (1 + (baseStat * 0.02 ) ) ) ;
        console.log("Player damage after primary stat bonus", playerDamage);

        let isCrit = false;

        const critChance = (this.state.player.agility * .01) ;
        console.log("Player crit chance with Agilty: ", this.state.player.agility, " = ", critChance);

        let critRoll = Math.random();
        console.log("Crit roll: ", critRoll);
        if (critRoll < critChance) {
            let critMultiplier = 1.5;
            playerDamage = Math.round(playerDamage * critMultiplier);
            isCrit = true;
        }
        if(isCrit) console.log("Player damage after crit", playerDamage);

        return { damage: playerDamage, isCrit };
    }

    awardXp(baseXp) {
        const LEVEL_SCALING_FACTOR = .5;
        const xpReductionFloor = 0.5;
        const multiplierBaseline = 1;
        const levelscalingMultiplier = Math.max(xpReductionFloor, multiplierBaseline + (this.state.tier - this.state.player.level) * LEVEL_SCALING_FACTOR);
        const amount = Math.round(baseXp * levelscalingMultiplier);

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
            this.state.player.nextLevelXp = Math.round(this.state.player.nextLevelXp * 1.55);
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
        //console.log("Player has died - Game over!");
        this.state.gameOver = true;
        this.state.game.getService('ui').gameOver('You have been killed by a ' + source + '!');
        this.state.game.getService('ui').statRefreshUI();
    }

    exit() {
        this.state.game.getService('ui').writeToLog("You exited the dungeon! Game Over.");
        document.removeEventListener('keydown', this.state.game.handleInput);
        document.removeEventListener('keyup', this.state.game.handleInput);
        //console.log("Player has Left the building - Game over!");
        this.state.gameOver = true;
        this.state.game.getService('ui').gameOver('You exited the dungeon! Too much adventure to handle eh?');
        this.state.game.getService('ui').statRefreshUI();
    }

    updateGearStats() {
        //console.log("Before Updating gear stats", this.state.player);

        const startGearProwess = this.state.player.stats.gear.prowess || 0;

        this.state.possibleItemStats.forEach(stat => {
            this.state.player.stats.gear[stat] = 0;
        });

        Object.values(this.state.player.inventory.equipped).forEach(item => {
            if (!item) return; // Skip empty slots
            if ('stats' in item && item.stats) {
                const propCount = Object.keys(item.stats).length;
                if (propCount > 0) {
                    Object.entries(item.stats).forEach(([stat, value]) => {
                        this.state.player.stats.gear[stat] = (this.state.player.stats.gear[stat] || 0) + (value || 0);
                    });
                }
            }

            if (item.type === 'armor') {
                //console.log("Armor change detected", item.armor);
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
                        //console.log("Unknown weapon type");
                        break;
                }
            }
        });
        const endGearProwess = this.state.player.stats.gear.prowess;

        const increasedProwess = endGearProwess - startGearProwess;
        const newHp = Math.round((this.state.player.stats.base.maxHp + this.state.player.stats.gear.maxHp) * (increasedProwess * .05));

        this.state.player.stats.gear.maxHp += newHp;

        //console.log("After Updating gear stats", this.state.player);
        this.calculateStats();
    }

    adjustCurrentStatByMaxChangeRatio(stat, oldMax, newMax) {
        const ratio = newMax / oldMax;
        const current = this.state.player[stat];
        const newStat = Math.round(current * ratio);
        this.state.player[stat] = Math.max(1, Math.min(newStat, newMax));
    }

    calculateStats() {
        const oldMaxHp = this.state.player.maxHp || this.state.player.stats.base.maxHp;
        const oldMaxMana = this.state.player.maxMana || this.state.player.stats.base.maxMana;

        this.state.possibleItemStats.forEach(stat => {
            switch (stat) {
                case 'maxLuck':
                    this.state.player[stat] = this.state.player.stats.base[stat] + this.state.player.stats.gear[stat];
                    this.state.player.luck = this.state.player[stat] + this.state.player.luckTempMod;
                    //console.log(`Luck = base:${this.state.player.stats.base[stat]} + gear:${this.state.player.stats.gear[stat]} + temp:${this.state.player.luckTempMod}`);
                    break;
                default:
                    this.state.player[stat] = (this.state.player.stats.base[stat] || 0) + (this.state.player.stats.gear[stat] || 0);
                    //console.log(`${stat} = base:${this.state.player.stats.base[stat] || 0} + gear:${this.state.player.stats.gear[stat] || 0}`);
                    break;
            }
        });

        // Ensure HP and mana are set
        const newMaxHp = this.state.player.stats.base.maxHp + (this.state.player.stats.gear.maxHp || 0);
        this.state.player.maxHp = newMaxHp;
        //adjust current by same ratio as max
        this.adjustCurrentStatByMaxChangeRatio('hp', oldMaxHp, newMaxHp);

        const newMaxMana = this.state.player.stats.base.maxMana + (this.state.player.stats.gear.maxMana || 0);
        this.state.player.maxMana = newMaxMana;
        this.adjustCurrentStatByMaxChangeRatio('mana', oldMaxMana, newMaxMana);
       


        /*
        if (oldMaxHp !== 0 && this.state.player.maxHp !== oldMaxHp) {
            const hpRatio = this.state.player.maxHp / oldMaxHp; // Percentage change
            const newHp = Math.round(this.state.player.hp * hpRatio); // Scale current HP
            this.state.player.hp = Math.max(1, Math.min(newHp, this.state.player.maxHp)); // Clamp HP: 1 to Max HP
        }
        if (oldMaxMana !== 0 && this.state.player.maxMana !== oldMaxMana) {
            const manaRatio = this.state.player.maxMana / oldMaxMana; // Percentage change
            const newMana = Math.round(this.state.player.hp * manaRatio); // Scale current Mana
            this.state.player.mana = Math.max(1, Math.min(newMana, this.state.player.maxMana)); // Clamp Mana: 1 to Max Mana
        }
        */


        //this.state.player.hp = Math.min(this.state.player.hp, this.state.player.maxHp);
        //this.state.player.mana = Math.min(this.state.player.mana, this.state.player.maxMana);
        /*console.log("After calculateStats:", {
            maxHp: this.state.player.maxHp,
            hp: this.state.player.hp,
            maxMana: this.state.player.maxMana,
            mana: this.state.player.mana
        });*/
        this.state.game.getService('ui').statRefreshUI();
    }

    promptForName(delay) {
        setTimeout(() => {
            try {
                let userCharacterName = prompt("Please name your character to begin:");
                if (userCharacterName !== null) {
                    //console.log("Hello, " + userCharacterName + "!");
                    const sanitizedInput = this.state.utilities.encodeHTMLEntities(userCharacterName);
                    this.state.player.name = sanitizedInput;
                    this.state.game.getService('ui').updatePlayerInfo();
                } else {
                    //console.log("User cancelled the prompt.");
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