//console.log("Combat.js loaded");

import { State } from './State.js';

export class Combat {
    constructor(state, game) {
        this.state = state;
        this.game = game;
        this.playerInventory = this.game.getService('playerInventory');
        //console.log("Combat initialized with playerInventory:", this.playerInventory);
    }

    // Get damage range for a specific attack type, with fallback to fists for melee
    getWeaponDamageRange(attackType) {
        const mainWeapon = this.playerInventory.getEquipped("mainhand");
        const offWeapon = this.playerInventory.getEquipped("offhand");
        let returnData = null;

        if (mainWeapon?.attackType === attackType) {
            returnData = { minBaseDamage: mainWeapon.baseDamageMin, maxBaseDamage: mainWeapon.baseDamageMax };
        } else if (offWeapon?.attackType === attackType) {
            returnData = { minBaseDamage: offWeapon.baseDamageMin, maxBaseDamage: offWeapon.baseDamageMax };
        } else if (attackType === 'melee') {
            returnData = { minBaseDamage: 1, maxBaseDamage: 1 }; // Fists fallback
        }
        return returnData;
    }

    // Get all equipped melee weapons for dual wield
    getMeleeWeapons() {
        const mainWeapon = this.playerInventory.getEquipped("mainhand");
        const offWeapon = this.playerInventory.getEquipped("offhand");
        const meleeWeapons = [];
        if (mainWeapon?.attackType === 'melee') meleeWeapons.push({ slot: 'mainhand', weapon: mainWeapon });
        if (offWeapon?.attackType === 'melee') meleeWeapons.push({ slot: 'offhand', weapon: offWeapon });
        return meleeWeapons.length > 0 ? meleeWeapons : [{ slot: 'fists', weapon: { baseDamageMin: 1, baseDamageMax: 1, attackType: 'melee' , name: 'Fists'} }];
    }

    // Get the best ranged weapon based on mean base damage
    getBestRangedWeapon() {
        const mainWeapon = this.playerInventory.getEquipped("mainhand");
        const offWeapon = this.playerInventory.getEquipped("offhand");
        const rangedWeapons = [];
        if (mainWeapon?.attackType === 'ranged') rangedWeapons.push(mainWeapon);
        if (offWeapon?.attackType === 'ranged') rangedWeapons.push(offWeapon);

        if (rangedWeapons.length === 0) {
            return { baseDamageMin: 1, baseDamageMax: 1, attackType: 'melee' }; // Fists fallback
        }

        return rangedWeapons.reduce((best, current) => {
            const bestMean = (best.baseDamageMin + best.baseDamageMax) * 0.5;
            const currentMean = (current.baseDamageMin + current.baseDamageMax) * 0.5;
            return currentMean > bestMean ? current : best;
        }, rangedWeapons[0]);
    }
    
    // Calculate damage and prepare log message
    calculateAndLogDamage(baseStat, weapon, damageBonus, monster) {
        //console.log(`Calculating damage with baseStat: ${baseStat}, weapon: ${weapon.name}, basedmg: ${weapon.baseDm}-  damageBonus: ${damageBonus}`);
        const playerService = this.game.getService('player');
        const uiService = this.game.getService('ui');
        const { damage, isCrit } = playerService.calculatePlayerDamage(baseStat, weapon.baseDamageMin, weapon.baseDamageMax, damageBonus);
        const combatLogMsg = `${isCrit ? 'CRITICAL HIT! : ' : ''}You dealt ${damage} damage to ${monster.name} with your ${weapon.name}`;
        return { damage, combatLogMsg };
    }

    // Apply damage to monster and handle death
    applyDamageToMonster(monster, damage, combatLogMsg) {
        const monstersService = this.game.getService('monsters');
        const playerService = this.game.getService('player');
        monster.hp -= damage;
        if (monster.hp <= 0) {
            monstersService.handleMonsterDeath(monster, playerService, this.state.tier, combatLogMsg);
            return true;
        }
        return false;
    }

    // Handle monster response (retaliation or aggro)
    handleMonsterResponse(monster, combatLogMsg, canRetaliate) {
        const uiService = this.game.getService('ui');
        const monstersService = this.game.getService('monsters');
        uiService.writeToLog(combatLogMsg + ` (${monster.hp}/${monster.maxHp})`);
        if (canRetaliate) {
            const playerService = this.game.getService('player');
            const playerKilled = monstersService.handleMonsterAttack(monster, playerService);
            uiService.statRefreshUI();
            if (playerKilled) {
                // Death handled in Monsters.js
            }
        } else {
            monster.isAggro = true;
        }
    }

    // Check if monster is in melee range (adjacent tiles)
    isInMeleeRange(monster) {
        const dx = Math.abs(this.state.player.x - monster.x);
        const dy = Math.abs(this.state.player.y - monster.y);
        return dx <= 1 && dy <= 1 && (dx + dy) > 0; // Adjacent, not same tile
    }

    // Melee attack with dual wield support
    meleeAttack(monster) {
        /* // commented out for now since a melee attack against a monster is currently only triggered when the player attempts to move into the monster's tile.
        if (!this.isInMeleeRange(monster)) {
            this.game.getService('ui').writeToLog(`The ${monster.name} is too far for a melee attack!`);
            return false;
        }
        */

        const meleeWeapons = this.getMeleeWeapons();
        const isDualWield = meleeWeapons.length === 2;
        const baseStat = this.state.player.prowess;
        const damageBonus = this.state.player.damageBonus + this.state.player.meleeDamageBonus;

        let monsterAlive = monster.hp > 0;
        let combatLogMsg = '';

        for (const [index, { slot, weapon }] of meleeWeapons.entries()) {
            if (!monsterAlive) break; // Stop if monster dies

            // Miss chance: 20% for mainhand, 30% for offhand in dual wield
            const missChance = isDualWield ? (index === 0 ? 20 : 30) : 0;

            if (Math.random() * 100 < missChance) {
                this.game.getService('ui').writeToLog(`Your ${slot} attack missed the ${monster.name}!`);
                continue;
            }
            //console.log('ERROR: Weapon sent to dmg calc:', weapon);
            const { damage, combatLogMsg } = this.calculateAndLogDamage(
                baseStat,
                weapon,
                damageBonus,
                monster
            );
            //console.log(`Damage calculated: ${damage}, ${combatLogMsg}`, monster);
            const monsterDied = this.applyDamageToMonster(monster, damage, combatLogMsg);
            if (monsterDied) {
                monsterAlive = false;
            }
        }

        if (monsterAlive) {
            this.handleMonsterResponse(monster, combatLogMsg, true);
        }

        this.state.needsRender = true;

        return true;
    }

    toggleRanged(event) {
        const uiService = this.game.getService('ui');
        if (event.key === ' ') {
            event.preventDefault();

            if (event.type === 'keyup') {
                this.state.isRangedMode = false;
                //console.log("Ranged mode disabled on keyup");
                return;
            }

            if (event.type === 'keydown') {
                const offWeapon = this.playerInventory.getEquipped("offhand");
                const mainWeapon = this.playerInventory.getEquipped("mainhand");
                if ((offWeapon?.attackType === "ranged" && offWeapon?.baseRange > 0) ||
                    (mainWeapon?.attackType === "ranged" && mainWeapon?.baseRange > 0)) {
                    this.state.isRangedMode = true;
                    //console.log("Ranged mode enabled");
                    //console.log(`Spacebar pressed detected state.isRangedMode = ${this.state.isRangedMode} : after toggleRanged`);
                } else {
                    this.state.isRangedMode = false;
                    uiService.writeToLog("You need a valid ranged weapon equipped to use ranged mode!");
                }
            }
        }
        return false;
    }

    async rangedAttack(direction) {
        const uiService = this.game.getService('ui');
        const renderService = this.game.getService('render');
        let map = this.state.levels[this.state.tier].map;
        let dx = 0, dy = 0;
        switch (direction) {
            case 'ArrowUp': dy = -1; break;
            case 'ArrowDown': dy = 1; break;
            case 'ArrowLeft': dx = -1; break;
            case 'ArrowRight': dx = 1; break;
            default: return;
        }
        //console.log(`Ranged attack in direction ${direction}`);

        const weapon = this.getBestRangedWeapon();
        const isRanged = weapon.attackType === 'ranged';
        const range = isRanged ? (this.state.player.range || 3) : 1; // Fists limited to melee range
        const baseStat = isRanged ? this.state.player.intellect : this.state.player.prowess;
        const damageBonus = isRanged ?
            (this.state.player.damageBonus + this.state.player.rangedDamageBonus) :
            (this.state.player.damageBonus + this.state.player.meleeDamageBonus);

        const projectileDiscoveryRadius = 1;
        const maxDiscoveredTiles = Math.min(5, range);
        let discoveredTiles = new Set();
        let newlyDiscoveredCount = 0;

        for (let i = 1; i <= range; i++) {
            let tx = this.state.player.x + dx * i;
            let ty = this.state.player.y + dy * i;
            if (tx < 0 || tx >= this.state.WIDTH || ty < 0 || ty >= this.state.HEIGHT || map[ty][tx] === '#') {
                uiService.writeToLog(`Your ${isRanged ? 'shot' : 'fist'} hit a wall at (${tx}, ${ty})`);
                break;
            }

            this.state.projectile = { x: tx, y: ty };
            this.state.needsRender = true;
            renderService.renderIfNeeded();
            await new Promise(resolve => setTimeout(resolve, 50));

            if (i > this.state.discoveryRadius && isRanged) {
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
                                //console.log(`Discovered tile at (${discX}, ${discY})`);
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
                        //console.log(`Monster at (${monster.x}, ${monster.y}) aggroed and detected by projectile`);
                    }
                }
            });

            let monster = this.state.monsters[this.state.tier].find(m => m.x === tx && m.y === ty && m.hp > 0);
            if (monster) {
                const { damage, combatLogMsg } = this.calculateAndLogDamage(
                    baseStat,
                    weapon,
                    damageBonus,
                    monster
                );

                monster.isDetected = true;
                const monsterDied = this.applyDamageToMonster(monster, damage, combatLogMsg);
                if (!monsterDied) {
                    this.handleMonsterResponse(monster, combatLogMsg, i === 1); // Retaliate only if in melee range
                }

                this.state.projectile = null;
                this.state.needsRender = true;
                renderService.renderIfNeeded();
                uiService.statRefreshUI();
                break;
            }
        }

        if (newlyDiscoveredCount > 0 && isRanged) {
            this.state.discoveredTileCount[this.state.tier] += newlyDiscoveredCount;
            //console.log(`Ranged attack discovered ${newlyDiscoveredCount} new tiles, total for tier ${this.state.tier}: ${this.state.discoveredTileCount[this.state.tier]}`);
            if (this.state.discoveredTileCount[this.state.tier] >= 1000) {
                this.state.discoveredTileCount[this.state.tier] = 0;
                const exploreXP = 25;
                uiService.writeToLog("Explored 1000 tiles!");
                this.game.getService('player').awardXp(exploreXP);
            }
        }

        this.state.projectile = null;
        this.state.needsRender = true;
        renderService.renderIfNeeded();
    }
}