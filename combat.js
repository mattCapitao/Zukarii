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

    calculatePlayerDamage(baseStat, minBaseDamage, maxBaseDamage, damageBonus) {
        let baseDamage = Math.floor(Math.random() * (maxBaseDamage - minBaseDamage + 1)) + minBaseDamage + this.state.player.level;
        let playerDamage = Math.round(baseDamage * (baseStat * 0.20)) + damageBonus;
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
        this.ui.writeToLog(combatLogMsg + `(${monster.hp}/${monster.maxHp})`);
        this.ui.writeToLog(`${monster.name} defeated!`);
        this.items.dropTreasure(monster, tier);
        const monsterKillXP = (5 + Math.floor(Math.random() * 6)) * this.state.tier;
        this.player.awardXp(monsterKillXP);
    }

    handleMonsterRetaliation(monster, tier) {


        if (this.state.player.block > 0 || this.state.player.dodge > 0) {

            if (Math.random() * 100 < this.state.player.block) {
                this.ui.writeToLog(`You blocked the ${monster.name}'s attack!`);
                return false;
            }
            if (Math.random() * 100 < this.state.player.dodge) {
                this.ui.writeToLog(`You dodged the ${monster.name}'s attack!`);
                return false;
            }
        }

        let monsterDamage = this.monsters.calculateMonsterAttackDamage(monster, this.state.tier);

        const armor = this.player.playerInventory.getEquipped("armor")?.armor || 0;
        let armorDmgReduction = 0;

        if (armor > 0) {
            armorDmgReduction = Math.max(1,Math.floor(monsterDamage * (.01 * armor * 2)));
        } 
        let damageDealt = monsterDamage - armorDmgReduction;

        const defenseDmgReduction = Math.round(monsterDamage * (.01 * this.state.player.defense));
        console.log(`Monster attack (${monsterDamage}) : Defense (${this.state.player.defense})`, this.player);
        damageDealt -= defenseDmgReduction;

        this.state.player.hp -= damageDealt;
        this.ui.writeToLog(`${monster.name} dealt ${damageDealt} damage to You. Attack(${monsterDamage}) - Armor(${armorDmgReduction}) - Defense(${defenseDmgReduction}) `);
        this.ui.updateStats();

        if (this.state.player.hp <= 0) {
            this.player.death(monster.name);
            return true;
        }
        return false;
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
        const { damage, isCrit } = this.calculatePlayerDamage(this.state.player.prowess, minBaseDamage, maxBaseDamage, damageBonus);
        let combatLogMsg = isCrit ? `Critical hit! Dealt ${damage} damage to ${monster.name} ` : `You dealt ${damage} damage to ${monster.name} `;

        monster.hp -= damage;

        if (monster.hp <= 0) {
            this.handleMonsterDeath(monster, this.state.tier, combatLogMsg);
        } else {
            this.ui.writeToLog(combatLogMsg + `(${monster.hp}/${monster.maxHp})`);
            if (this.handleMonsterRetaliation(monster, this.state.tier)) {
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
        const defaultRange = 7;
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

        if (offWeapon?.attackType === "ranged") {
            minBaseDamage = offWeapon.baseDamageMin;
            maxBaseDamage = offWeapon.baseDamageMax;
        } else if (mainWeapon?.attackType === "ranged") {
            minBaseDamage = mainWeapon.baseDamageMin;
            maxBaseDamage = mainWeapon.baseDamageMax;
        } else {
            this.ui.writeToLog("No ranged weapon equipped!");
            return;
        }

        for (let i = 1; i <= defaultRange; i++) {
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
                const { damage, isCrit } = this.calculatePlayerDamage(this.state.player.intellect, minBaseDamage, maxBaseDamage, damageBonus);
                let combatLogMsg = isCrit ? `Critical hit! Dealt ${damage} damage to ${monster.name} ` : `You dealt ${damage} damage to ${monster.name} `;

                monster.hp -= damage;

                if (monster.hp <= 0) {
                    this.handleMonsterDeath(monster, this.state.tier, combatLogMsg);
                } else if (i === 1) {
                    this.ui.writeToLog(combatLogMsg + `(${monster.hp}/${monster.maxHp})`);
                    if (!this.handleMonsterRetaliation(monster, this.state.tier)) {
                        this.ui.updateStats();
                    }
                } else {
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