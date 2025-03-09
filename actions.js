console.log("actions.js loaded");

import { State } from './state.js';

export class Actions {
    constructor(state) {
        this.state = state;
    }

    useFountain(fountain, tier) {
        const uiService = this.state.game.getService('ui');
        if (!fountain.used) {
            let healAmount;

            const critChance = this.state.player.critChance || (this.state.player.agility * 0.02);

            if (Math.random() < critChance) {
                const maxHpBoost = Math.round(1 + (2 * (tier / 10)));
                this.state.player.stats.base.maxHp += maxHpBoost;
                this.state.player.maxHp = this.state.player.stats.base.maxHp;
                healAmount = this.state.player.maxHp - this.state.player.hp;
                this.state.player.hp = this.state.player.maxHp;
                uiService.writeToLog(`The fountain surges with power! Fully healed and Max HP increased by ${maxHpBoost} to ${this.state.player.maxHp}!`);
            } else {
                const missingHp = this.state.player.maxHp - this.state.player.hp;
                const healPercent = Math.random() * (0.5 - 0.3) + 0.3;
                healAmount = Math.round(missingHp * healPercent);
                this.state.player.hp = Math.min(this.state.player.hp + healAmount, this.state.player.maxHp);
                uiService.writeToLog(`The fountain restores ${healAmount} HP. Current HP: ${this.state.player.hp}/${this.state.player.maxHp}`);
            }

            fountain.used = true;
            this.state.levels[tier].map[fountain.y][fountain.x] = ' ';
            console.log(`Fountain at (${fountain.x}, ${fountain.y}) used and removed from tier ${tier}`);
        }
    }

    drinkHealPotion() {
        const uiService = this.state.game.getService('ui');
        if (this.state.player.healPotions) {
            const critChance = this.state.player.critChance || (this.state.player.agility * 0.02);
            let critHealText = '';

            let healAmount = Math.round(this.state.player.maxHp * .3);
           
            if (Math.random() < critChance) {  
                healAmount = this.state.player.maxHp - this.state.player.hp;
                critHealText = 'is of exceptional quality and '; 
            }

            let healMessage = `The Heal Potion restores ${healAmount} HP. Current HP: ${this.state.player.hp}/${this.state.player.maxHp}`;
            this.state.player.hp += healAmount;

            if (this.state.player.hp >= this.state.player.maxHp) {
                this.state.player.hp = this.state.player.maxHp;
                healMessage = `The Heal Potion ${critHealText} fully heals you!`;
            } 
            uiService.writeToLog(healMessage);
            this.state.player.healPotions--;
        }
    }

    lightTorch() {
        const uiService = this.state.game.getService('ui');
        const audioService = this.state.game.getService('audio');
        const renderService = this.state.game.getService('render');
        let message = '';

        if (this.state.player.torches > 0) {
            this.state.player.torches--;
            this.state.player.torchLit = true;
            this.state.torchExpires = 1000;
            this.state.discoveryRadius = this.state.discoveryRadiusDefault + 2;
            message = 'The darkness is at bay... for now!';

            if (this.state.player.torches < 1) {
                message = 'You light your last torch!';
                this.state.torchLitOnTurn = true;
                this.state.needsRender = true;
            }

            audioService.playTorch();
        } else {
            message = 'You have no torches left.';
        }
        uiService.writeToLog(message);
        if (this.state.needsRender) renderService.renderIfNeeded();
    }

    torchExpired() {
        const uiService = this.state.game.getService('ui');
        const audioService = this.state.game.getService('audio');
        const renderService = this.state.game.getService('render');
        audioService.playTorch(false);
        this.state.player.torchLit = false;
        this.state.torchExpires = 0;
        this.state.discoveryRadius = this.state.discoveryRadiusDefault;
        uiService.writeToLog('The torch has burned out!');
        renderService.renderIfNeeded();
    }

    placeTreasure(treasure) {
        const renderService = this.state.game.getService('render');
        const tier = this.state.tier;
        const map = this.state.levels[tier].map;
        const tierTreasures = this.state.treasures[tier];

        console.log(`Placing treasure at (${treasure.x}, ${treasure.y}):`, treasure);
        map[treasure.y][treasure.x] = '$';

        const existingTreasureIndex = tierTreasures.findIndex(t => t.x === treasure.x && t.y === treasure.y);
        if (existingTreasureIndex !== -1) {
            const existingTreasure = tierTreasures[existingTreasureIndex];
            existingTreasure.gold = (existingTreasure.gold || 0) + (treasure.gold || 0);
            existingTreasure.torches = (existingTreasure.torches || 0) + (treasure.torches || 0);
            existingTreasure.healPotions = (existingTreasure.healPotions || 0) + (treasure.healPotions || 0);
            if (treasure.items && treasure.items.length) {
                treasure.items.forEach(newItem => {
                    if (!existingTreasure.items.some(i => i.uniqueId === newItem.uniqueId)) {
                        existingTreasure.items = existingTreasure.items || [];
                        existingTreasure.items.push(newItem);
                    } else {
                        console.log(`Duplicate item ${newItem.name} (ID: ${newItem.uniqueId}) ignored at (${treasure.x}, ${treasure.y})`);
                    }
                });
            }
        } else {
            tierTreasures.push({
                x: treasure.x,
                y: treasure.y,
                name: treasure.name || "Unknown",
                gold: treasure.gold || 0,
                torches: treasure.torches || 0,
                healPotions: treasure.healPotions || 0,
                items: treasure.items || []
            });
        }

        this.state.needsRender = true;
        if (!treasure.suppressRender) {
            renderService.renderIfNeeded();
        }
    }

    pickupTreasure(x, y) {
        const uiService = this.state.game.getService('ui');
        const renderService = this.state.game.getService('render');
        const playerInventoryService = this.state.game.getService('player').playerInventory;
        const tier = this.state.tier;
        const tierTreasures = this.state.treasures[tier];
        const treasureIndex = tierTreasures.findIndex(t => t.x === x && t.y === y);

        if (treasureIndex !== -1) {
            const treasure = tierTreasures[treasureIndex];
            let pickupMessage = [];

            if (treasure.gold) {
                this.state.player.gold += treasure.gold;
                pickupMessage.push(`${treasure.gold} gold`);
            }
            if (treasure.torches) {
                this.state.player.torches += treasure.torches;
                pickupMessage.push(`${treasure.torches} torch${treasure.torches > 1 ? 'es' : ''}`);
            }
            if (treasure.healPotions) {
                this.state.player.healPotions += treasure.healPotions;
                pickupMessage.push(`${treasure.healPotions} heal potion${treasure.healPotions > 1 ? 's' : ''}`);
            }
            if (treasure.items && treasure.items.length) {
                treasure.items.forEach(item => {
                    playerInventoryService.addItem(item);
                    pickupMessage.push(item.name);
                });
            }

            if (pickupMessage.length) {
                const message = `Found ${pickupMessage.join(', ')} from ${treasure.name || 'a treasure'}!`;
                uiService.writeToLog(message);
            }

            tierTreasures.splice(treasureIndex, 1);

            const map = this.state.levels[tier].map;
            console.log(`Before clearing tile at (${x}, ${y}): '${map[y][x]}'`);
            map[y][x] = ' ';
            console.log(`After clearing tile at (${x}, ${y}): '${map[y][x]}'`);

            this.state.needsRender = true;
            renderService.renderIfNeeded();
        } else {
            console.log(`No treasure found at (${x}, ${y})`);
        }
    }
}