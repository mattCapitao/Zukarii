

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
            writeToLog(`The fountain surges with power! Fully healed and Max HP increased by ${maxHpBoost} to ${state.player.maxHp}!`);
        } else {
            const healPercent = Math.random() * (0.5 - 0.3) + 0.3;
            healAmount = Math.round(missingHp * healPercent);
            state.player.hp = Math.min(state.player.hp + healAmount, state.player.maxHp);
            writeToLog(`The fountain restores ${healAmount} HP. Current HP: ${state.player.hp}/${state.player.maxHp}`);
        }

        fountain.used = true;
        state.levels[tier].map[fountain.y][fountain.x] = ' ';
        console.log(`Fountain at (${fountain.x}, ${fountain.y}) used and removed from tier ${tier}`);
    }
}


window.useFountain = useFountain;