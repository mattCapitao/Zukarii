console.log("combat.js loaded");

class Combat {
    constructor(state, game, ui, player, monsters, items) {
        this.state = state;
        this.game = game;
        this.ui = ui;
        this.player = player;
        this.monsters = monsters;
        this.items = items;
    }

    meleeCombat(monster) {
        let minBaseDamage, maxBaseDamage;
        const mainWeapon = this.player.playerInventory.getEquipped("mainhand");
        const offWeapon = this.player.playerInventory.getEquipped("offhand");

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
        const { damage, isCrit } = this.player.calculatePlayerDamage(this.state.player.prowess, minBaseDamage, maxBaseDamage, damageBonus);
        let combatLogMsg = isCrit ? `Critical hit! Dealt ${damage} damage to ${monster.name} ` : `You dealt ${damage} damage to ${monster.name} `;

        monster.hp -= damage;

        if (monster.hp <= 0) {
            this.monsters.handleMonsterDeath(monster, this.player, this.state.tier, combatLogMsg);
        } else {
            this.ui.writeToLog(combatLogMsg + `(${monster.hp}/${monster.maxHp})`);
            if (this.monsters.handleMonsterAttack(monster, this.player)) {
                if (this.state.ui.overlayOpen) {
                    this.ui.updateStats();
                }
            } else {
                if (this.state.ui.overlayOpen) {
                    this.ui.updateStats();
                }
            }
        }
    }

    toggleRanged(event) {
        if (event.key === ' ') {
            event.preventDefault();
            if (event.type === 'keydown') {
                const offWeapon = this.player.playerInventory.getEquipped("offhand");
                const mainWeapon = this.player.playerInventory.getEquipped("mainhand");
                if (offWeapon?.attackType === "ranged" || mainWeapon?.attackType === "ranged") {
                    this.state.isRangedMode = true;
                } else {
                    this.ui.writeToLog("You need a ranged weapon equipped to use ranged mode!");
                }
            } else if (event.type === 'keyup') {
                this.state.isRangedMode = false;
            }
        }
        return false;
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
        console.log(`Ranged attack in direction ${direction}`);
        let minBaseDamage, maxBaseDamage;
        const offWeapon = this.player.playerInventory.getEquipped("offhand");
        const mainWeapon = this.player.playerInventory.getEquipped("mainhand");

        if (offWeapon?.attackType === "ranged" && offWeapon?.baseRange > 0) {
            minBaseDamage = offWeapon.baseDamageMin;
            maxBaseDamage = offWeapon.baseDamageMax;
        } else if (mainWeapon?.attackType === "ranged" && mainWeapon?.baseRange > 0) {
            minBaseDamage = mainWeapon.baseDamageMin;
            maxBaseDamage = mainWeapon.baseDamageMax;
        } else {
            this.ui.writeToLog("No ranged weapon equipped!");
            return;
        }

        for (let i = 1; i <= (this.state.player.range); i++) {
            let tx = this.state.player.x + dx * i;
            let ty = this.state.player.y + dy * i;
            if (tx < 0 || tx >= this.state.WIDTH || ty < 0 || ty >= this.state.HEIGHT || map[ty][tx] === '#') {
                this.ui.writeToLog(`Ranged shot hit a wall at (${tx}, ${ty})`);
                break;
            }

            this.state.projectile = { x: tx, y: ty };
            console.log(`Projectile tick ${i} at (${tx}, ${ty})`);
            this.state.needsRender = true;
            this.game.render.renderIfNeeded();
            await new Promise(resolve => setTimeout(resolve, 50));

            let monster = this.state.monsters[this.state.tier].find(m => m.x === tx && m.y === ty && m.hp > 0);
            if (monster) {
                const damageBonus = this.state.player.damageBonus + this.state.player.rangedDamageBonus;
                const { damage, isCrit } = this.player.calculatePlayerDamage(this.state.player.intellect, minBaseDamage, maxBaseDamage, damageBonus);
                let combatLogMsg = isCrit ? `Critical hit! Dealt ${damage} damage to ${monster.name} ` : `You dealt ${damage} damage to ${monster.name} `;

                monster.hp -= damage;
               

                if (monster.hp <= 0) {
                    this.monsters.handleMonsterDeath(monster, this.player, this.state.tier, combatLogMsg);
                } else if (i === 1) {
                    this.ui.writeToLog(combatLogMsg + `(${monster.hp}/${monster.maxHp})`);
                    if (!this.monsters.handleMonsterAttack(monster, this.player)) {
                        this.ui.updateStats();
                    }
                } else {
                    monster.isAggro = true;
                    this.ui.writeToLog(combatLogMsg + `(${monster.hp}/${monster.maxHp})`);
                }
                this.state.projectile = null;
                this.state.needsRender = true;
                this.game.render.renderIfNeeded();
                this.ui.updateStats();
                break;
            }
        }
        this.state.projectile = null;
        this.state.needsRender = true;
        this.game.endTurn();
    }
}