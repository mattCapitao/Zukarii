console.log("actions.js loaded");

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

function lightTorch() {
    let message = '';

    if (state.player.torches > 0) {
        state.player.torches--;
        state.player.torchLit = true;
        state.torchExpires = 1000;
        state.discoveryRadius = 4;
        message = 'The darkness is at bay... for now!';

        if (state.player.torches < 1) {
            message = 'You light your last torch!';
        }   
    } else {
        message = 'You have no torches left.';
    }
    writeToLog(message);

    render();

}

function torchExpired(){
    state.player.torchLit = false;
    state.torchExpires = 0;
    state.discoveryRadius = state.discoveryRadiusDefault;
    writeToLog('The torch has burned out!');
    render();
}

window.lightTorch = lightTorch;
window.torchExpired = torchExpired;
window.useFountain = useFountain;