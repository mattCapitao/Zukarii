console.log("combat.js loaded");

import { State } from './state.js';
import { Game } from './game.js';
import { UI } from './ui.js';
import { Player } from './player.js';
import { Monsters } from './monsters.js';
import { Items } from './items.js';

export class Combat {
    constructor(state, game, ui, player, monsters, items) {
        this.state = state;
        this.game = game;
        this.ui = ui;
        this.player = player;
        this.monsters = monsters;
        this.items = items;

        this.isRangedModeEnabled = false;
    }ww
    
    getWeaponDamageRange(attackType) {// Extracted method: Get damage range for a given attack type
        const mainWeapon = this.player.playerInventory.getEquipped("mainhand");
        const offWeapon = this.player.playerInventory.getEquipped("offhand");
        let returnData = null;

        if (mainWeapon?.attackType === attackType) {
            returnData = { minBaseDamage: mainWeapon.baseDamageMin, maxBaseDamage: mainWeapon.baseDamageMax };
        } else if (offWeapon?.attackType === attackType) {
            returnData = { minBaseDamage: offWeapon.baseDamageMin, maxBaseDamage: offWeapon.baseDamageMax };
        } else if (attackType === 'melee') {
            returnData = { minBaseDamage: 1, maxBaseDamage: 1 }; // Fists
        } return returnData;
    }

    calculateAndLogDamage(baseStat, minBaseDamage, maxBaseDamage, damageBonus, monster) {// Extracted method: Calculate damage and generate log message
        const { damage, isCrit } = this.player.calculatePlayerDamage(baseStat, minBaseDamage, maxBaseDamage, damageBonus);
        const combatLogMsg = `${isCrit ? 'CRITICAL HIT! : ' : ''}You dealt ${damage} damage to ${monster.name} `;
        return { damage, combatLogMsg };
    }

    applyDamageToMonster(monster, damage, combatLogMsg) { // Extracted method: Apply damage to monster and handle death
        monster.hp -= damage;
        if (monster.hp <= 0) {
            this.monsters.handleMonsterDeath(monster, this.player, this.state.tier, combatLogMsg);
            return true; // Monster died
        }
        return false; // Monster survived
    }

    handleMonsterResponse(monster, combatLogMsg, canRetaliate) {// Extracted method: Handle monster response after being attacked
        this.ui.writeToLog(combatLogMsg + `(${monster.hp}/${monster.maxHp})`);
        if (canRetaliate) {
            if (!this.monsters.handleMonsterAttack(monster, this.player)) {
                this.ui.updateStats();
            }
        } else {monster.isAggro = true;}
    }

    meleeAttack(monster) {
        const { minBaseDamage, maxBaseDamage } = this.getWeaponDamageRange("melee");

        const damageBonus = this.state.player.damageBonus + this.state.player.meleeDamageBonus;
        const { damage, combatLogMsg } = this.calculateAndLogDamage(this.state.player.prowess, minBaseDamage, maxBaseDamage, damageBonus, monster);

        const monsterDied = this.applyDamageToMonster(monster, damage, combatLogMsg);
        if (!monsterDied) {
            this.handleMonsterResponse(monster, combatLogMsg, true); // Melee always allows retaliation
        }
    }

    toggleRanged(event) {
        if (event.key === ' ') {
            event.preventDefault();
            if (event.type === 'keydown') {
                const offWeapon = this.player.playerInventory.getEquipped("offhand");
                const mainWeapon = this.player.playerInventory.getEquipped("mainhand");
                if ((offWeapon?.attackType === "ranged" && offWeapon?.baseRange > 0 ||
                    mainWeapon?.attackType === "ranged" && mainWeapon?.baseRange > 0) 
                    && this.state.player.range > 0)
                {
                    this.state.isRangedMode = true;
                } else {
                    this.state.isRangedMode = false;
                    this.ui.writeToLog("You need a valid ranged weapon equipped to use ranged mode!");
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

        const damageRange = this.getWeaponDamageRange("ranged");
        if (!damageRange) {
            this.ui.writeToLog("No ranged weapon equipped!");
            return;
        }
        const { minBaseDamage, maxBaseDamage } = damageRange;

        const projectileDiscoveryRadius = 1;
        const maxDiscoveredTiles = Math.min(5, this.state.player.range);
        let discoveredTiles = new Set();
        let newlyDiscoveredCount = 0;

        for (let i = 1; i <= (this.state.player.range); i++) {
            let tx = this.state.player.x + dx * i;
            let ty = this.state.player.y + dy * i;
            if (tx < 0 || tx >= this.state.WIDTH || ty < 0 || ty >= this.state.HEIGHT || map[ty][tx] === '#') {
                this.ui.writeToLog(`Ranged shot hit a wall at (${tx}, ${ty})`);
                break;
            }

            this.state.projectile = { x: tx, y: ty };
            this.state.needsRender = true;
            this.game.render.renderIfNeeded();
            await new Promise(resolve => setTimeout(resolve, 50));

            if (i > this.state.discoveryRadius) {
                for (let dyOffset = -projectileDiscoveryRadius; dyOffset <= projectileDiscoveryRadius; dyOffset++) {
                    for (let dxOffset = -projectileDiscoveryRadius; dxOffset <= projectileDiscoveryRadius; dxOffset++) {
                        let discX = tx + dxOffset;
                        let discY = ty + dyOffset;
                        if (discX >= 0 && discX < this.state.WIDTH && discY >= 0 && discY < this.state.HEIGHT) {
                            const tileKey = `${discX},${discY}`;
                            const alreadyDiscoveredWall = this.state.discoveredWalls[this.state.tier].has(tileKey);
                            const alreadyDiscoveredFloor = this.state.discoveredFloors[this.state.tier] && this.state.discoveredFloors[this.state.tier].has(tileKey);
                            if (!discoveredTiles.has(tileKey) && !alreadyDiscoveredWall && !alreadyDiscoveredFloor && discoveredTiles.size < maxDiscoveredTiles) {
                                if (map[discY][discX] === '#') {
                                    this.state.discoveredWalls[this.state.tier].add(tileKey);
                                    newlyDiscoveredCount++;
                                } else if (map[discY][discX] === ' ') {
                                    this.state.discoveredFloors[this.state.tier] = this.state.discoveredFloors[this.state.tier] || new Set();
                                    this.state.discoveredFloors[this.state.tier].add(tileKey);
                                    newlyDiscoveredCount++;
                                }
                                discoveredTiles.add(tileKey);
                                this.state.needsRender = true;
                                console.log(`Discovered tile at (${discX}, ${discY})`);
                            }
                        }
                    }
                }
            }

            this.state.monsters[this.state.tier].forEach(monster => {
                if (monster.hp > 0) {
                    const distX = monster.x - tx;
                    const distY = monster.y - ty;
                    const distance = Math.sqrt(distX * distX + distY * distY);
                    if (distance <= this.state.AGGRO_RANGE) {
                        monster.isAggro = true;
                        monster.isDetected = true;
                        console.log(`Monster at (${monster.x}, ${monster.y}) aggroed and detected by projectile`);
                    }
                }
            });

            let monster = this.state.monsters[this.state.tier].find(m => m.x === tx && m.y === ty && m.hp > 0);
            if (monster) {
                const damageBonus = this.state.player.damageBonus + this.state.player.rangedDamageBonus;
                const { damage, combatLogMsg } = this.calculateAndLogDamage(this.state.player.intellect, minBaseDamage, maxBaseDamage, damageBonus, monster);

                monster.isDetected = true;
                const monsterDied = this.applyDamageToMonster(monster, damage, combatLogMsg);
                if (!monsterDied) {
                    this.handleMonsterResponse(monster, combatLogMsg, i === 1); // Retaliate only if at range 1
                }

                this.state.projectile = null;
                this.state.needsRender = true;
                this.game.render.renderIfNeeded();
                this.ui.updateStats();
                break;
            }
        }

        if (newlyDiscoveredCount > 0) {
            this.state.discoveredTileCount[this.state.tier] += newlyDiscoveredCount;
            console.log(`Ranged attack discovered ${newlyDiscoveredCount} new tiles, total for tier ${this.state.tier}: ${this.state.discoveredTileCount[this.state.tier]}`);
            if (this.state.discoveredTileCount[this.state.tier] >= 1000) {
                this.state.discoveredTileCount[this.state.tier] = 0;
                const exploreXP = 25;
                this.ui.writeToLog("Explored 1000 tiles!");
                this.game.player.awardXp(exploreXP);
            }
        }

        this.state.projectile = null;
        this.state.needsRender = true;
        this.game.endTurn();
    }
}