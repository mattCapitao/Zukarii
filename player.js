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
        state.player.maxHp += hpIncrease;
        state.player.hp = state.player.maxHp;
        state.player.xp = 0;
        state.player.nextLevelXp = Math.round(state.player.nextLevelXp * 1.5);
        writeToLog(`Level up! Now level ${state.player.level}, Max HP increased by ${hpIncrease} to ${state.player.maxHp}`);
    }
}