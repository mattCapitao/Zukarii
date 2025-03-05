console.log("actions.js loaded");

class Actions {
    constructor(state) {
        this.state = state;
    }

    useFountain(fountain, tier) {
        if (!fountain.used) {
            let healAmount;

            const critChance = this.state.player.critChance || (this.state.player.agility * 0.02);

            if (Math.random() < critChance) {
                const maxHpBoost = Math.round(1 + (2 * (tier / 10)));
                this.state.player.stats.base.maxHp += maxHpBoost;
                this.state.player.maxHp = this.state.player.stats.base.maxHp;
                healAmount = this.state.player.maxHp - this.state.player.hp;
                this.state.player.hp = this.state.player.maxHp;
                window.ui.writeToLog(`The fountain surges with power! Fully healed and Max HP increased by ${maxHpBoost} to ${this.state.player.maxHp}!`);
            } else {
                const missingHp = this.state.player.maxHp - this.state.player.hp;
                const healPercent = Math.random() * (0.5 - 0.3) + 0.3;
                healAmount = Math.round(missingHp * healPercent);
                this.state.player.hp = Math.min(this.state.player.hp + healAmount, this.state.player.maxHp);
                window.ui.writeToLog(`The fountain restores ${healAmount} HP. Current HP: ${this.state.player.hp}/${this.state.player.maxHp}`);
            }

            fountain.used = true;
            this.state.levels[tier].map[fountain.y][fountain.x] = ' ';
            console.log(`Fountain at (${fountain.x}, ${fountain.y}) used and removed from tier ${tier}`);
        }
    }

    lightTorch() {
        let message = '';

        if (this.state.player.torches > 0) {
            this.state.player.torches--;
            this.state.player.torchLit = true;
            this.state.torchExpires = 1000;
            this.state.discoveryRadius = 4;
            message = 'The darkness is at bay... for now!';

            if (this.state.player.torches < 1) {
                message = 'You light your last torch!';
                this.state.torchLitOnTurn = true;
                window.needsRender = true;
            }
        } else {
            message = 'You have no torches left.';
        }
        window.ui.writeToLog(message);
    }

    torchExpired() {
        this.state.player.torchLit = false;
        this.state.torchExpires = 0;
        this.state.discoveryRadius = this.state.discoveryRadiusDefault;
        window.ui.writeToLog('The torch has burned out!');
        window.render();
    }
}

// Expose methods on window as per original
window.lightTorch = function () {
    window.actions.lightTorch();
};
window.torchExpired = function () {
    window.actions.torchExpired();
};
window.useFountain = function (fountain, tier) {
    window.actions.useFountain(fountain, tier);
};

// Note: Actions instance will be created in game.js