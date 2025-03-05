console.log("player.js loaded");

class Player {
    constructor(state) {
        this.state = state;
    }

    addStartingItems() {
        this.state.player.inventory.equipped = this.state.initializeEquippedSlots();
        const startItems = this.state.data.getStartItems();
        const uniqueItems = this.state.data.getUniqueItems();
        const itemsToAdd = [
            uniqueItems[0],
            startItems[0], startItems[1], startItems[2],
        ];

        for (let item of itemsToAdd) {
            item.uniqueId = window.generateUniqueId();
            this.state.player.inventory.items.push({ ...item });
        }
        window.ui.updateStats();
    }

    awardXp(amount) {
        this.state.player.xp += amount;
        window.ui.writeToLog(`Gained ${amount} XP (${this.state.player.xp}/${this.state.player.nextLevelXp})`);
        this.checkLevelUp();
    }

    checkLevelUp() {
        while (this.state.player.xp >= this.state.player.nextLevelXp) {
            this.state.player.level++;

            if (this.state.player.level % 3 === 0) {
                const stats = ['prowess', 'intellect', 'agility'];
                const statToBoost = stats[Math.floor(Math.random() * 3)];
                this.state.player[statToBoost]++;
                window.ui.writeToLog(`Your ${statToBoost} increased to ${this.state.player[statToBoost]}!`);
            }

            const hpIncrease = Math.round(3 + this.state.player.level * this.state.player.prowess * 0.5);
            this.state.player.stats.base.maxHp += hpIncrease;
            this.state.player.maxHp = this.state.player.stats.base.maxHp;
            this.state.player.hp = this.state.player.maxHp;
            this.state.player.xp = 0;
            this.state.player.nextLevelXp = Math.round(this.state.player.nextLevelXp * 1.5);
            window.ui.writeToLog(`Level up! Now level ${this.state.player.level}, Max HP increased by ${hpIncrease} to ${this.state.player.maxHp}`);

            window.ui.updateStats();
        }
    }

    death(source) {
        this.state.player.hp = 0;
        this.state.player.dead = true;
        window.ui.writeToLog('You died! Game Over.');
        document.removeEventListener('keydown', window.handleInput);
        document.removeEventListener('keydown', window.toggleRanged);
        document.removeEventListener('keyup', window.toggleRanged);
        console.log("Player has died - Game over!");
        this.state.gameOver = true;
        window.ui.updatePlayerInfo();
        window.ui.updatePlayerStatus();
        window.ui.gameOver('You have been killed by a ' + source + '!');
        window.ui.updateStats();
    }

    exit() {
        window.ui.writeToLog("You exited the dungeon! Game Over.");
        document.removeEventListener('keydown', window.handleInput);
        document.removeEventListener('keydown', window.toggleRanged);
        document.removeEventListener('keyup', window.toggleRanged);
        console.log("Player has Left the building - Game over!");
        this.state.gameOver = true;
        window.ui.gameOver('You exited the dungeon! Too much adventure to handle eh?');
        window.ui.updatePlayerInfo();
        window.ui.updatePlayerStatus();
        window.ui.updateStats();
    }

    updateGearStats() {
        console.log("Before Updating gear stats", this.state.player.stats.gear);

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
        });

        console.log("After Updating gear stats", this.state.player.stats.gear);
        this.calculateStats();
    }

    calculateStats() {
        this.state.possibleItemStats.forEach(stat => {
            this.state.player[stat] = (this.state.player.stats.base[stat] || 0) + (this.state.player.stats.gear[stat] || 0);
            console.log(`${stat} = ${(this.state.player.stats.base[stat] || 0)} + ${(this.state.player.stats.gear[stat] || 0)}`);
            console.log(this.state.player);
        });
        window.ui.renderOverlay();
    }
}

// Expose methods on window as per original
window.updateGearStats = function () {
    window.playerInstance.updateGearStats();
};
window.calculateStats = function () {
    window.playerInstance.calculateStats();
};
window.addStartingItems = function () {
    window.playerInstance.addStartingItems();
};
window.playerExit = function () {
    window.playerInstance.exit();
};
window.playerDied = function (source) {
    window.playerInstance.death(source);
};
window.awardXp = function (amount) {
    window.playerInstance.awardXp(amount);
};

// Note: Player instance will be created in game.js as window.playerInstance