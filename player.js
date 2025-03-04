console.log("player.js loaded");

function addStartingItems() {
    state.player.inventory.equipped = emptyEquipSlots;
    const startItems = [
        window.uniqueItems[0],
        window.startItems[0], window.startItems[1], window.startItems[2], 
    
    ];
    for (let item of startItems) {
        item.uniqueId = window.generateUniqueId(),
        state.player.inventory.items.push({ ...item });
    }
    window.ui.updateStats();
}

function awardXp(amount) {
    state.player.xp += amount;
    writeToLog(`Gained ${amount} XP (${state.player.xp}/${state.player.nextLevelXp})`);
        
    checkLevelUp();
}

function checkLevelUp() {
    while (state.player.xp >= state.player.nextLevelXp) {
        state.player.level++;

        if (state.player.level % 3 === 0) {
            const stats = ['prowess', 'intellect', 'agility'];
            const statToBoost = stats[Math.floor(Math.random() * 3)];
            state.player[statToBoost]++;
            writeToLog(`Your ${statToBoost} increased to ${state.player[statToBoost]}!`);
        }

        const hpIncrease = Math.round(3 + state.player.level * state.player.prowess * 0.5);
        state.player.stats.base.maxHp += hpIncrease;
        state.player.maxHp = state.player.stats.base.maxHp;
        state.player.hp = state.player.maxHp;
        state.player.xp = 0;
        state.player.nextLevelXp = Math.round(state.player.nextLevelXp * 1.5);
        writeToLog(`Level up! Now level ${state.player.level}, Max HP increased by ${hpIncrease} to ${state.player.maxHp}`);

        window.ui.updateStats();
    }
}

function death(source) {
    state.player.hp = 0;
    state.player.dead = true;
    writeToLog('You died! Game Over.');
    document.removeEventListener('keydown', handleInput);
    document.removeEventListener('keydown', toggleRanged);
    document.removeEventListener('keyup', toggleRanged);
    console.log("Player has died - Game over!");
    state.gameOver = true; // Set flag
    window.ui.updatePlayerInfo();
    window.ui.updatePlayerStatus();
    window.ui.gameOver('You have been killed by a ' + source + '!');
    window.ui.updateStats();

}

function exit() {
    writeToLog("You exited the dungeon! Game Over.");
    document.removeEventListener('keydown', handleInput);
    document.removeEventListener('keydown', toggleRanged);
    document.removeEventListener('keyup', toggleRanged);
    console.log("Player has Left the building - Game over!");
    state.gameOver = true; // Set flag
    window.ui.gameOver('You exited the dungeon! Too much adventure to handle eh?');
    window.ui.updatePlayerInfo();
    window.ui.updatePlayerStatus();
    window.ui.updateStats();
        

}

function calculateStats() {
        state.possibleItemStats.forEach(stat => {
        state.player[stat] = (state.player.stats.base[stat] || 0) + (state.player.stats.gear[stat] || 0);
    });
}

window.calculateStats = calculateStats;
window.addStartingItems = addStartingItems;
window.playerExit = exit;
window.playerDied = death;
window.awardXp = awardXp;