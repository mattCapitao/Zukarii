console.log("player.js loaded");

class Player {
    constructor(state, ui, game, utilities) { // Added utilities parameter
        this.state = state;
        this.ui = ui;
        this.game = game;
        this.utilities = utilities; // Store utilities
        this.playerInventory = new PlayerInventory(state, ui, this, utilities); // Pass utilities to Inventory
        this.initializePlayer();
    }

    initializePlayer() {
        this.statInit();
        this.addStartingItems();
        this.calculateStats()
    }



    statInit() {
        this.state.player.stats.base.intellect = this.utilities.dRoll(6,2,3);
        this.state.player.stats.base.prowess = this.utilities.dRoll(6,2,3);
        this.state.player.stats.base.agility = this.utilities.dRoll(6,2,3);
        this.state.player.stats.base.maxHp = 30;
        this.state.player.stats.base.maxMana = 10;

        // Manually init current stat vaslues that are not updated by calculateStats()
        this.state.player.hp = this.state.player.stats.base.maxHp;
        this.state.player.mana = this.state.player.stats.base.maxMana;
        this.state.player.nextLevelXp = 75;
    }

    initializeEquippedSlots() {
        const emptyEquipSlots = this.state.data.getEmptyEquipSlots();
        const slotsWithIds = {};
        Object.entries(emptyEquipSlots).forEach(([slot, data]) => {
            slotsWithIds[slot] = {
                ...data,
                uniqueId: this.utilities.generateUniqueId(), // Use this.utilities
            };
        });
        return slotsWithIds;
    }

    addStartingItems() {
        this.state.player.inventory.equipped = this.initializeEquippedSlots();
        const startItems = this.state.data.getStartItems();
        const uniqueItems = this.state.data.getUniqueItems();

        const itemsToAdd = this.getInitialItems(startItems, uniqueItems);
        const randomStartItems = this.getRandomStartItems();

        randomStartItems.forEach(item => {
            const maxRogTierRoll = 25; // used in rogItem() 25 gives a 15:10 split for junk:common
            const rogTierRoll = (Math.floor(Math.random() * maxRogTierRoll) + 1) * .01; // 0.01 - 0.25
            const rogItem = this.game.items.rogItem(rogTierRoll, item);
            itemsToAdd.push(rogItem);
        });

        itemsToAdd.forEach(item => {
            this.playerInventory.addItem(item);
        });

        this.ui.updateStats();
    }

    getInitialItems(startItems, uniqueItems) {
        return [
            // Add specific start items and unique items if needed
            // startItems[0], startItems[1], startItems[2],
            // uniqueItems[0],
        ];
    }

    getRandomStartItems() {
        return [ 
            { type: 'weapon', attackType: 'ranged' },
            { type: 'weapon', attackType: 'melee' },
            { type: 'armor' },
        ];
    }

    calculatePlayerDamage(baseStat, minBaseDamage, maxBaseDamage, damageBonus) {
        let baseDamage = Math.floor(Math.random() * (maxBaseDamage - minBaseDamage + 1)) + minBaseDamage + this.state.player.level;
        let playerDamage = Math.round(baseDamage * (baseStat * 0.20)) + damageBonus;
        let isCrit = false;

        const critChance = this.state.player.agility / 2;
        if (Math.random() * 100 < critChance) {
            const critMultiplier = 1.5 + Math.random() * 1.5;
            playerDamage = Math.round(playerDamage * critMultiplier);
            isCrit = true;
        }

        return { damage: playerDamage, isCrit };
    }

    awardXp(amount) {
        this.state.player.xp += amount;
        this.ui.writeToLog(`Gained ${amount} XP (${this.state.player.xp}/${this.state.player.nextLevelXp})`);
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
                this.ui.writeToLog(`Your ${statToBoost} increased to ${this.state.player[statToBoost]}!`);
            }

            const hpIncrease = Math.round(3 + this.state.player.level * this.state.player.prowess * 0.5);
            this.state.player.stats.base.maxHp += hpIncrease;
            this.state.player.maxHp = this.state.player.stats.base.maxHp;
            this.state.player.hp = this.state.player.maxHp;
            this.state.player.xp = newXp;
            this.state.player.nextLevelXp = Math.round(this.state.player.nextLevelXp * 1.5);
            this.ui.writeToLog(`Level up! Now level ${this.state.player.level}, Max HP increased by ${hpIncrease} to ${this.state.player.maxHp}`);

            this.ui.updateStats();
        }
    }

    death(source) {
        this.state.player.hp = 0;
        this.state.player.dead = true;
        this.ui.writeToLog('You died! Game Over.');
        document.removeEventListener('keydown', this.game.handleInput);
        document.removeEventListener('keyup', this.game.combat.toggleRanged);
        console.log("Player has died - Game over!");
        this.state.gameOver = true;
        this.ui.updatePlayerInfo();
        this.ui.updatePlayerStatus();
        this.ui.gameOver('You have been killed by a ' + source + '!');
        this.ui.updateStats();
    }

    exit() {
        this.ui.writeToLog("You exited the dungeon! Game Over.");
        document.removeEventListener('keydown', this.game.handleInput);
        document.removeEventListener('keyup', this.game.combat.toggleRanged);
        console.log("Player has Left the building - Game over!");
        this.state.gameOver = true;
        this.ui.gameOver('You exited the dungeon! Too much adventure to handle eh?');
        this.ui.updatePlayerInfo();
        this.ui.updatePlayerStatus();
        this.ui.updateStats();
    }

    updateGearStats() {
        console.log("Before Updating gear stats", this.state.player);

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

            // We set the player Base gear stats for Armor, Block and Range directly, as they are not tracked in item.stats[]

            if (item.type === 'armor') {
                
                // we allow cumulative stacking of baseArmor bonuses for future support of multiple armor slots (helmet, chest, legs, etc))
                console.log("Armor change detected", item.armor);
                this.state.player.stats.gear.armor = (this.state.player.stats.gear.armor || 0) + (item.armor || 0);
            }

            if (item.type === 'weapon') {
                switch (item.attackType) {
                    case 'melee':
                        // we allow cumulative stacking of baseBlock with other weapon baseBlock and block bonuses for future support of dual wield melee weapons
                        this.state.player.stats.gear.block = (this.state.player.stats.gear.block || 0) + (item.baseBlock || 0);
                        break;
                    case 'ranged':
                        // Take only the highest baseRange value from all equipped ranged weapons
                        this.state.player.stats.gear.Baserange = Math.max(this.state.player.stats.gear.baseRange, item.baseRange, 0);
                        // allow cumulative stacking of baseRange and range bonuses 
                        this.state.player.stats.gear.range = (this.state.player.stats.gear.range || 0) + (this.state.player.stats.gear.Baserange || 0)
                        break;
                    default:
                        console.log("Unknown weapon type");
                        break;
                }
            }
        });

        console.log("After Updating gear stats", this.state.player);
        this.calculateStats();
    }

    calculateStats() {
        this.state.possibleItemStats.forEach(stat => {

            switch(stat){
                case 'maxLuck':
                    this.state.player[stat] = this.state.player.stats.base[stat] + this.state.player.stats.gear[stat];
                    this.state.player.luck = this.state.player[stat] + this.state.player.luckTempMod;
                    console.log(`Luck = base:${this.state.player.stats.base[stat]} + gear:${this.state.player.stats.gear[stat]} + temp:${this.state.player.luckTempMod}`);
                break;

                case 'maxHp':// placholder for potential temp stat modifiers
                case 'maxMana':// placholder for potential temp stat modifiers
                default:
                    this.state.player[stat] = (this.state.player.stats.base[stat] || 0) + (this.state.player.stats.gear[stat] || 0);
                    console.log(`${stat} = ${ (this.state.player.stats.base[stat] || 0) } + ${ (this.state.player.stats.gear[stat] || 0) }`);
                    console.log(this.state.player);
                break;
            }
        });


        this.ui.renderOverlay();
    }

    promptForName(delay) {
        setTimeout(() => {
            try {
                let userCharacterName = prompt("Please name your character to begin:");
                if (userCharacterName !== null) {
                    console.log("Hello, " + userCharacterName + "!");
                    const sanitizedInput = this.utilities.encodeHTMLEntities(userCharacterName);
                    this.state.player.name = sanitizedInput;
                    this.ui.updatePlayerInfo();
                } else {
                    console.log("User cancelled the prompt.");
                    this.state.player.name = this.utilities.getRandomName(this.game.render.mageNames);
                    this.ui.writeToLog(`You didnt enter a name, so a random one has been given to you, ${this.state.player.name} `);
                    this.ui.updatePlayerInfo();
                }
            } catch (error) {
                console.error("Error in promptForName:", error);
                this.state.player.name = this.utilities.getRandomName(this.game.render.mageNames);
                this.ui.writeToLog(`Failed to get name due to an error, assigned: ${this.state.player.name}`);
                this.ui.updatePlayerInfo();
            }
        }, delay);
    }
}