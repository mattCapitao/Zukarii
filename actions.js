function moveMonsters() {
    const tier = state.currentLevel - 1;
    console.log(`Moving monsters on tier ${state.currentLevel}, monsters:`, state.monsters[tier]);
    if (!state.monsters[tier] || !Array.isArray(state.monsters[tier])) {
        console.log(`No monsters defined for tier ${state.currentLevel}`);
        return;
    }
    let map = state.levels[tier].map;
    state.monsters[tier].forEach(monster => {
        if (monster.hp <= 0) return;

        let dx = state.player.x - monster.x;
        let dy = state.player.y - monster.y;
        let newX = monster.x + (dx !== 0 ? Math.sign(dx) : 0);
        let newY = monster.y + (dy !== 0 ? Math.sign(dy) : 0);

        if (map[newY][newX] !== '#' && !(newX === state.player.x && newY === state.player.y)) {
            monster.x = newX;
            monster.y = newY;
        }
    });
}

function useFountain(fountain, tier) {
    if (!fountain.used) {
        const missingHp = state.player.maxHp - state.player.hp;
        let healAmount;

        const critChance = state.player.critChance || (state.player.agility * 0.02);
        if (Math.random() < critChance) {
            healAmount = missingHp;
            const maxHpBoost = Math.round(1 + (2 * (tier / 10)));
            state.player.maxHp += maxHpBoost;
            state.player.hp = state.player.maxHp;
            state.combatLog.push(`The fountain surges with power! Fully healed and Max HP increased by ${maxHpBoost} to ${state.player.maxHp}!`);
        } else {
            const healPercent = Math.random() * (0.5 - 0.3) + 0.3;
            healAmount = Math.round(missingHp * healPercent);
            state.player.hp = Math.min(state.player.hp + healAmount, state.player.maxHp);
            state.combatLog.push(`The fountain restores ${healAmount} HP. Current HP: ${state.player.hp}/${state.player.maxHp}`);
        }

        fountain.used = true; // Still mark as used for safety
        state.levels[tier].map[fountain.y][fountain.x] = ' '; // Remove from map
        console.log(`Fountain at (${fountain.x}, ${fountain.y}) used and removed from tier ${tier}`);
        if (state.combatLog.length > 5) state.combatLog.shift();
    }
}

window.moveMonsters = moveMonsters;
window.useFountain = useFountain;