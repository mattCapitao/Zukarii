console.log("combat.js loaded");

class Combat {
    constructor(state, game) {
        this.state = state;
        this.game = game;
    }

    calculatePlayerDamage(baseStat, minBaseDamage, maxBaseDamage, damageBonus) {
        let baseDamage = Math.floor(Math.random() * (maxBaseDamage - minBaseDamage + 1)) + minBaseDamage;
        let playerDamage = Math.round(baseDamage * (baseStat * 0.3)) + damageBonus;
        let isCrit = false;

        const critChance = this.state.player.agility / 2;
        if (Math.random() * 100 < critChance) {
            const critMultiplier = 1.5 + Math.random() * 1.5;
            playerDamage = Math.round(playerDamage * critMultiplier);
            isCrit = true;
        }

        return { damage: playerDamage, isCrit };
    }

    handleMonsterDeath(monster, tier, combatLogMsg) {
        monster.hp = 0;
        monster.isAgro = false;
        window.ui.writeToLog(combatLogMsg + `(${monster.hp}/${monster.maxHp})`);
        window.ui.writeToLog(`${monster.name} defeated!`);
        window.dropTreasure(monster, tier);
        const monsterKillXP = (5 + Math.floor(Math.random() * 6)) * this.state.tier;
        window.awardXp(monsterKillXP);
    }

    handleMonsterRetaliation(monster, tier) {
        let monsterDamage = window.calculateMonsterAttackDamage(monster, this.state.tier);
        const defense = this.state.player.inventory.equipped.armor?.defense || 0;
        monsterDamage = Math.max(1, monsterDamage - defense);
        this.state.player.hp -= monsterDamage;
        window.ui.writeToLog(`${monster.name} dealt ${monsterDamage} damage to You`);
        window.ui.updateStats();

        if (this.state.player.hp <= 0) {
            window.playerDied(monster.name);
            return true;
        }
        return false;
    }

    meleeCombat(monster) {
        let minBaseDamage, maxBaseDamage;
        const mainWeapon = this.state.player.inventory.equipped.mainhand;
        const offWeapon = this.state.player.inventory.equipped.offhand;

        if (mainWeapon?.attackType === "melee") {
            minBaseDamage = mainWeapon.baseDamageMin;
            maxBaseDamage = mainWeapon.baseDamageMax;
        } else if (offWeapon?.attackType === "melee") {
            minBaseDamage = offWeapon.baseDamageMin;
            maxBaseDamage = offWeapon.baseDamageMax;
        } else {
            minBaseDamage = 1; // Fists
            maxBaseDamage = 1;
        }
        const damageBonus = this.state.player.damageBonus + this.state.player.meleeDamageBonus;
        const { damage, isCrit } = this.calculatePlayerDamage(this.state.player.prowess, minBaseDamage, maxBaseDamage, damageBonus);
        let combatLogMsg = isCrit ? `Critical hit! Dealt ${damage} damage to ${monster.name} ` : `You dealt ${damage} damage to ${monster.name} `;

        monster.hp -= damage;

        if (monster.hp <= 0) {
            this.handleMonsterDeath(monster, this.state.tier, combatLogMsg);
        } else {
            window.ui.writeToLog(combatLogMsg + `(${monster.hp}/${monster.maxHp})`);
            if (this.handleMonsterRetaliation(monster, this.state.tier)) {
                if (this.state.ui.overlayOpen) {
                    window.ui.updateStats();
                }
            } else {
                if (this.state.ui.overlayOpen) {
                    window.ui.updateStats();
                }
            }
        }
    }

    toggleRanged(event) {
        if (event.key === ' ') {
            if (event.type === 'keydown') {
                const offWeapon = this.state.player.inventory.equipped.offhand;
                const mainWeapon = this.state.player.inventory.equipped.mainhand;
                if (offWeapon?.attackType === "ranged" || mainWeapon?.attackType === "ranged") {
                    this.state.isRangedMode = true;
                } else {
                    window.ui.writeToLog("You need a ranged weapon equipped to use ranged mode!");
                }
            } else if (event.type === 'keyup') {
                this.state.isRangedMode = false;
            }
            
            if (!this.state.projectile) {
                window.needsRender = true;
                this.game.renderIfNeeded();
            }
            
        }
    }

    async rangedAttack(direction) {
        let map = this.state.levels[this.state.tier].map;
        let dx = 0, dy = 0;
        switch (direction) {
            case 'ArrowUp': dy = -1; break;
            case 'ArrowDown': dy = 1; break;
            case 'ArrowLeft': dx = -1; break;
            case 'ArrowRight': dx = 1; break;
            default: return;
        }

        let minBaseDamage, maxBaseDamage;
        const offWeapon = this.state.player.inventory.equipped.offhand;
        const mainWeapon = this.state.player.inventory.equipped.mainhand;

        if (offWeapon?.attackType === "ranged") {
            minBaseDamage = offWeapon.baseDamageMin;
            maxBaseDamage = offWeapon.baseDamageMax;
        } else if (mainWeapon?.attackType === "ranged") {
            minBaseDamage = mainWeapon.baseDamageMin;
            maxBaseDamage = mainWeapon.baseDamageMax;
        } else {
            window.ui.writeToLog("No ranged weapon equipped!");
            return;
        }

        for (let i = 1; i <= 7; i++) {
            let tx = this.state.player.x + dx * i;
            let ty = this.state.player.y + dy * i;
            if (tx < 0 || tx >= this.state.WIDTH || ty < 0 || ty >= this.state.HEIGHT || map[ty][tx] === '#') {
                window.ui.writeToLog(`Ranged shot hit a wall at (${tx}, ${ty})`);
                break;
            }

            this.state.projectile = { x: tx, y: ty };
            window.needsRender = true;
            this.game.renderIfNeeded();
            await new Promise(resolve => setTimeout(resolve, 50));

            let monster = this.state.monsters[this.state.tier].find(m => m.x === tx && m.y === ty && m.hp > 0);
            if (monster) {
                const damageBonus = this.state.player.damageBonus + this.state.player.rangedDamageBonus;
                const { damage, isCrit } = this.calculatePlayerDamage(this.state.player.intellect, minBaseDamage, maxBaseDamage, damageBonus);
                let combatLogMsg = isCrit ? `Critical hit! Dealt ${damage} damage to ${monster.name} ` : `You dealt ${damage} damage to ${monster.name} `;

                monster.hp -= damage;

                if (monster.hp <= 0) {
                    this.handleMonsterDeath(monster, this.state.tier, combatLogMsg);
                } else if (i === 1) {
                    window.ui.writeToLog(combatLogMsg + `(${monster.hp}/${monster.maxHp})`);
                    if (!this.handleMonsterRetaliation(monster, this.state.tier)) {
                        window.ui.updateStats();
                    }
                } else {
                    window.ui.writeToLog(combatLogMsg + `(${monster.hp}/${monster.maxHp})`);
                }
                this.state.projectile = null;
                window.needsRender = true;
                this.game.renderIfNeeded();
                window.ui.updateStats();
                break;
            }
        }
        this.state.projectile = null;
        window.needsRender = true;
       this.game.endTurn();
    }
}

// Expose methods on window as per original
window.meleeCombat = function (monster) {
    window.combat.meleeCombat(monster);
};
window.toggleRanged = function (event) {
    window.combat.toggleRanged(event);
};
window.rangedAttack = async function (direction) {
    await window.combat.rangedAttack(direction);
};

// Note: Combat instance will be created in game.js