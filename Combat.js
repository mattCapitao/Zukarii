console.log("Combat.js loaded");

import { State } from './State.js';

export class Combat {
    constructor(state, game) {
        this.state = state;
        this.game = game; // Inject game to access services
        this.playerInventory = this.game.getService('playerInventory'); // Get playerInventory service
        console.log("Combat initialized with playerInventory:", this.playerInventory);
    }
    
    getWeaponDamageRange(attackType) {
        const mainWeapon = this.playerInventory.getEquipped("mainhand");
        const offWeapon = this.playerInventory.getEquipped("offhand");
        let returnData = null;

        if (mainWeapon?.attackType === attackType) {
            returnData = { minBaseDamage: mainWeapon.baseDamageMin, maxBaseDamage: mainWeapon.baseDamageMax };
        } else if (offWeapon?.attackType === attackType) {
            returnData = { minBaseDamage: offWeapon.baseDamageMin, maxBaseDamage: offWeapon.baseDamageMax };
        } else if (attackType === 'melee') {
            returnData = { minBaseDamage: 1, maxBaseDamage: 1 }; // Fists
        }
        return returnData;
    }

    calculateAndLogDamage(baseStat, minBaseDamage, maxBaseDamage, damageBonus, monster) {
        const playerService = this.state.game.getService('player');
        const uiService = this.state.game.getService('ui');
        const { damage, isCrit } = playerService.calculatePlayerDamage(baseStat, minBaseDamage, maxBaseDamage, damageBonus);
        const combatLogMsg = `${isCrit ? 'CRITICAL HIT! : ' : ''}You dealt ${damage} damage to ${monster.name} `;
        return { damage, combatLogMsg };
    }

    applyDamageToMonster(monster, damage, combatLogMsg) {
        const monstersService = this.state.game.getService('monsters');
        const playerService = this.state.game.getService('player');
        monster.hp -= damage;
        if (monster.hp <= 0) {
            monstersService.handleMonsterDeath(monster, playerService, this.state.tier, combatLogMsg);
            return true;
        }
        return false;
    }

    handleMonsterResponse(monster, combatLogMsg, canRetaliate) {
        const uiService = this.state.game.getService('ui');
        const monstersService = this.state.game.getService('monsters');
        uiService.writeToLog(combatLogMsg + `(${monster.hp}/${monster.maxHp})`);
        if (canRetaliate) {
            const playerService = this.state.game.getService('player');
            const playerKilled = monstersService.handleMonsterAttack(monster, playerService);
            uiService.updateStats();
            if (playerKilled) {
                // No additional action needed here; death is handled in Monsters
            }
        } else {
            monster.isAggro = true;
        }
    }

    meleeAttack(monster) {
        const { minBaseDamage, maxBaseDamage } = this.getWeaponDamageRange("melee");
        const damageBonus = this.state.player.damageBonus + this.state.player.meleeDamageBonus;
        const { damage, combatLogMsg } = this.calculateAndLogDamage(this.state.player.prowess, minBaseDamage, maxBaseDamage, damageBonus, monster);

        const monsterDied = this.applyDamageToMonster(monster, damage, combatLogMsg);
        if (!monsterDied) {
            this.handleMonsterResponse(monster, combatLogMsg, true);
        }
    }


toggleRanged(event) {
    const uiService = this.state.game.getService('ui');
    if (event.key === ' ') {
        event.preventDefault();

        if (event.type === 'keyup') {
            this.state.isRangedMode = false;
            console.log("Ranged mode disabled on keyup");
            return;
        }

        if (event.type === 'keydown') {
            const offWeapon = this.playerInventory.getEquipped("offhand");
            const mainWeapon = this.playerInventory.getEquipped("mainhand");
            if ((offWeapon?.attackType === "ranged" && offWeapon?.baseRange > 0 ||
                mainWeapon?.attackType === "ranged" && mainWeapon?.baseRange > 0) 
                && this.state.player.range > 0) {
                this.state.isRangedMode = true;
                console.log("Ranged mode enabled");
                 console.log(`Spacebar pressed detected state.isRangedMode = ${this.state.isRangedMode} : after toggleRanged`);
            } else {
                this.state.isRangedMode = false;
                uiService.writeToLog("You need a valid ranged weapon equipped to use ranged mode!");
            }
        } 
    }
    return false;
}

    async rangedAttack(direction) {
        const uiService = this.state.game.getService('ui');
        const renderService = this.state.game.getService('render');
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
            uiService.writeToLog("No ranged weapon equipped!");
            return;
        }
        const { minBaseDamage, maxBaseDamage } = damageRange;

        const projectileDiscoveryRadius = 1;
        const maxDiscoveredTiles = Math.min(5, this.state.player.range);
        let discoveredTiles = new Set();
        let newlyDiscoveredCount = 0;

        for (let i = 1; i <= this.state.player.range; i++) {
            let tx = this.state.player.x + dx * i;
            let ty = this.state.player.y + dy * i;
            if (tx < 0 || tx >= this.state.WIDTH || ty < 0 || ty >= this.state.HEIGHT || map[ty][tx] === '#') {
                uiService.writeToLog(`Ranged shot hit a wall at (${tx}, ${ty})`);
                break;
            }

            this.state.projectile = { x: tx, y: ty };
            this.state.needsRender = true;
            renderService.renderIfNeeded();
            await new Promise(resolve => setTimeout(resolve, 50));

            if (i > this.state.discoveryRadius) {
                for (let dyOffset = -projectileDiscoveryRadius; dyOffset <= projectileDiscoveryRadius; dyOffset++) {
                    for (let dxOffset = -projectileDiscoveryRadius; dxOffset <= projectileDiscoveryRadius; dxOffset++) {
                        let discX = tx + dxOffset;
                        let discY = ty + dyOffset;
                        if (discX >= 0 && discX < this.state.WIDTH && discY >= 0 && discY < this.state.HEIGHT) {
                            const tileKey = `${discX},${discY}`;
                            const alreadyDiscoveredWall = this.state.discoveredWalls[this.state.tier].has(tileKey);
                            const alreadyDiscoveredFloor = this.state.discoveredFloors[this.state.tier]?.has(tileKey);
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
                    this.handleMonsterResponse(monster, combatLogMsg, i === 1);
                }

                this.state.projectile = null;
                this.state.needsRender = true;
                renderService.renderIfNeeded();
                uiService.updateStats();
                break;
            }
        }

        if (newlyDiscoveredCount > 0) {
            this.state.discoveredTileCount[this.state.tier] += newlyDiscoveredCount;
            console.log(`Ranged attack discovered ${newlyDiscoveredCount} new tiles, total for tier ${this.state.tier}: ${this.state.discoveredTileCount[this.state.tier]}`);
            if (this.state.discoveredTileCount[this.state.tier] >= 1000) {
                this.state.discoveredTileCount[this.state.tier] = 0;
                const exploreXP = 25;
                uiService.writeToLog("Explored 1000 tiles!");
                this.state.game.getService('player').awardXp(exploreXP);
            }
        }

        this.state.projectile = null;
        this.state.needsRender = true;
        this.state.game.endTurn();
    }
}