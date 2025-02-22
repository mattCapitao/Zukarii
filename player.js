function checkLevelUp() {
    while (state.player.xp >= state.player.nextLevelXp) {
        state.player.level++;
        const hpBaseIncrease = 3 + Math.floor(Math.random() * 3);
        const hpMultiplier = state.player.level * state.player.prowess * 0.5;
        state.player.maxHp += Math.round(hpBaseIncrease + hpMultiplier);
        state.player.hp = state.player.maxHp;
        state.player.xp = 0;
        state.player.nextLevelXp = Math.round(state.player.nextLevelXp * 1.5);
        state.combatLog.push(`Level up! Now level ${state.player.level}, Max HP increased to ${state.player.maxHp}`);
        if (state.player.level % 3 === 0) {
            const stats = ['prowess', 'intellect', 'agility'];
            const statToBoost = stats[Math.floor(Math.random() * 3)];
            state.player[statToBoost]++;
            state.combatLog.push(`Your ${statToBoost} increased to ${state.player[statToBoost]}!`);
        }
        if (state.combatLog.length > 5) state.combatLog.shift();
    }
}