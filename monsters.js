//console.log("Monsters.js loaded");

import { State } from './State.js';

export class Monsters {
    constructor(state, game) {
        this.state = state;
        this.game = game;
        this.monsterAffixes = {
            goldTheft: {
                name: "Gold Theft",
                description: "Steals gold on hit",
                onHit: function (monster, player) {
                    const goldStolen = Math.floor(this.state.player.gold * 0.1) +1 ;
                    this.state.player.gold -= goldStolen;
                    this.game.getService('ui').updatePlayerInfo();
                    this.game.getService('ui').writeToLog(`${monster.name}'s Greedy Claw attack has stolen ${goldStolen} gold from you!`);
                    if (this.state.player.gold < 0) {
                        this.state.player.gold = 0;
                        this.game.getService('ui').writeToLog(`ALL YOUR GOLD ARE BELONG TO ${monster.name} `);
                    }
                }.bind(this)
            },
            poisonGas: {
                name: "Poison Gas",
                description: "Releases a cloud of poison gas.",
                onDeath: function (monster, tier) {
                    const gasCloud = {
                        x: monster.x,
                        y: monster.y,
                        tier: tier,
                        duration: 3,
                        damage: 2
                    };
                    this.state.gasClouds.push(gasCloud);
                    //console.log(`Poison gas cloud released at (${monster.x}, ${monster.y})`);
                }.bind(this)
            }
        };
    }



    generateMonster(tier, map, rooms, playerX, playerY, spawnPool) {
        const data = this.state.game.getService('data');
        let newMonster = {};

        //console.log(`Generating monster for tier ${tier}, spawn pool:`, spawnPool);
        if (spawnPool.boss) {
            newMonster = { ...spawnPool.boss }; // Spawn a boss!
        } else {
            let normalMonsters = [];
            let monsterTemplates = [];
            if (spawnPool.monsterTemplates) {
                normalMonsters = data.getMonsterTemplates();
                monsterTemplates = [...normalMonsters];
            }
            if (spawnPool.uniqueMonsters) {
                const uniqueMonsters = data.getUniqueMonsters();
                if (uniqueMonsters.length > 0) {
                    monsterTemplates.push(...uniqueMonsters);
                }
            }
         //   console.log(`Monster templates:`, monsterTemplates);
            newMonster = { ...monsterTemplates[Math.floor(Math.random() * monsterTemplates.length)] };
        }
        const room = rooms[Math.floor(Math.random() * rooms.length)];
        do {
            newMonster.x = room.left + 1 + Math.floor(Math.random() * (room.w - 2));
            newMonster.y = room.top + 1 + Math.floor(Math.random() * (room.h - 2));
        } while (map[newMonster.y][newMonster.x] !== ' ' || (newMonster.x === playerX && newMonster.y === playerY));

        
        const calculatedMaxMonsterHp = this.getCalculatedMonsterMaxHp(newMonster.baseHp, tier);
        newMonster.maxHp = Math.round(calculatedMaxMonsterHp);
        newMonster.hp = newMonster.maxHp;
        newMonster.minBaseDamage += Math.floor(tier / 3);
        newMonster.maxBaseDamage += Math.floor(tier / 2);

        return newMonster;
    }

    getCalculatedMonsterMaxHp(monsterBaseHp, tier = 1) {
    // Constants for HP calculation
    const BASE_GROWTH_RATE = 0.15;         // 15% growth per tier
    const INITIAL_VARIANCE_FACTOR = 0.1;   // 10% variance at Tier 1
    const VARIANCE_GROWTH_RATE = 0.005;     // .5% increase in variance per tier

    // Calculate HP
    const tierAdjustment = tier - 1;   // Adjust tier to start growth from Tier 2
    const varianceScaling = 1 + VARIANCE_GROWTH_RATE * tierAdjustment; // Variance grows slightly with tier
    const newMonsterTierHpSmoothing = Math.random() * INITIAL_VARIANCE_FACTOR * varianceScaling; // Random variance
    const calculatedMaxMonsterHp = monsterBaseHp * (1 + BASE_GROWTH_RATE * tierAdjustment + newMonsterTierHpSmoothing);

    return calculatedMaxMonsterHp;
    }

    calculateMonsterAttackDamage(enemy) {
        const tier = this.state.tier;
        const tierDamageMultiplier = 0.05;
        const baseDamage = Math.floor(Math.random() * (enemy.maxBaseDamage - enemy.minBaseDamage) + 1) + enemy.minBaseDamage;
        const damage = Math.round(baseDamage * (tier * (1 + tierDamageMultiplier)));
        //console.log(`Monster attack damage: ${damage} (base: ${baseDamage}, min: ${enemy.minBaseDamage}, max: ${enemy.maxBaseDamage})`);
        return damage;
    }

    generateLevelMonsters(tier, map, rooms, uniqueMonsters = false, bossRoom = null) {
        const baseMonsterCount = 12;
        const densityFactor = 1 + tier * 0.1;
        const monsterCount = Math.floor(baseMonsterCount * densityFactor);
        let levelMonsters = [];

        const spawnPool = {
            monsterTemplates: true,
            uniqueMonsters: uniqueMonsters,
        };

        //console.log(`Generating ${monsterCount} monsters for tier ${tier} (base: ${baseMonsterCount}, density factor: ${densityFactor.toFixed(2)})`);

        if (bossRoom) {
            const bossMonsters = this.state.game.getService('data').getBossMonsters();
            const boss = bossMonsters[Math.floor(Math.random() * bossMonsters.length)];
            const bossMonster = this.generateMonster(tier, map, [bossRoom], this.state.player.x, this.state.player.y, {
                monsterTemplates: false,
                uniqueMonsters: false,
                boss: boss
            });
            levelMonsters.push(bossMonster);
            console.log(`Boss ${bossMonster.name} spawned in BossChamberSpecial at (${bossMonster.x}, ${bossMonster.y})`);
        }

        const availableRooms = bossRoom ? rooms.filter(r => r !== bossRoom) : rooms;
        for (let i = 0; i < monsterCount; i++) {
            const monsterToPush = this.generateMonster(tier, map, availableRooms, this.state.player.x, this.state.player.y, spawnPool);
            console.log(`Monster to push:`, monsterToPush);
            levelMonsters.push(monsterToPush);
        }
        return levelMonsters;
    }

    moveMonsters() {
        if (this.state.player.dead) return;
        const tier = this.state.tier;
        if (!this.state.monsters[tier] || !Array.isArray(this.state.monsters[tier])) return;
        if (!this.state.levels[tier] || !this.state.levels[tier].map) {
        //    console.warn(`Level ${tier} not initialized—skipping monster movement`);
            return;
        }

       // console.log(`Moving monsters on tier ${this.state.tier}, monsters:`, this.state.monsters[tier]);
        if (!this.state.monsters[tier] || !Array.isArray(this.state.monsters[tier])) {
            console.log(`No monsters defined for tier ${this.state.tier}`);
            return;
        }
        let map = this.state.levels[tier].map;
        const monsters = this.state.monsters[tier];

        const AGGRO_RANGE = (this.state.discoveryRadius || 2) + 2;
        this.state.AGGRO_RANGE = AGGRO_RANGE;
        monsters.forEach(monster => {
           // console.log(`Monster: `, monster);
            if (monster.hp <= 0) return;

            const dx = this.state.player.x - monster.x;
            const dy = this.state.player.y - monster.y;
            const distanceToPlayer = Math.sqrt(dx * dx + dy * dy);

            if (distanceToPlayer <= AGGRO_RANGE + 2) {
                monster.isDetected = true;
            }

            if (distanceToPlayer <= AGGRO_RANGE || monster.isAggro) {
                monster.isAggro = true;
 // Diagonals are disabled for now - consider a check for a monster Affix that enables them when we add affixes
// { x: Math.sign(dx), y: Math.sign(dy) },

                let directions = [
                    { x: Math.sign(dx), y: 0, dist: Math.abs(dx) },
                    { x: 0, y: Math.sign(dy), dist: Math.abs(dy) }
                ];
                directions.sort((a, b) => b.dist - a.dist); // Sort by distance, descending


                for (let dir of directions) {
                    let newX = monster.x + dir.x;
                    let newY = monster.y + dir.y;

                    const isOccupiedByMonster = monsters.some(otherMonster =>
                        otherMonster !== monster &&
                        otherMonster.hp > 0 &&
                        otherMonster.x === newX &&
                        otherMonster.y === newY
                    );

                    if (map[newY][newX] === '#' ||
                        map[newY][newX] === '⇑' ||
                        map[newY][newX] === '⇓' ||
                        map[newY][newX] === '?' ||
                        (newX === this.state.player.x && newY === this.state.player.y) ||
                        isOccupiedByMonster) {
                        continue;
                    }
                     
                    monster.x = newX;
                    monster.y = newY;
                    break;
                }
            } else {
                //console.log(`Monster ${monster.name} is not aggroed`);
               /* 
                // Wandering disabled for now
                monster.isAggro = false;
                let wanderDirections = [
                    { x: 1, y: 0 }, { x: -1, y: 0 },
                    { x: 0, y: 1 }, { x: 0, y: -1 }
                ];
                const dir = wanderDirections[Math.floor(Math.random() * wanderDirections.length)];
                let newX = monster.x + dir.x;
                let newY = monster.y + dir.y;

                const isOccupiedByMonster = monsters.some(otherMonster =>
                    otherMonster !== monster &&
                    otherMonster.hp > 0 &&
                    otherMonster.x === newX &&
                    otherMonster.y === newY
                );

                if (map[newY][newX] !== '#' &&
                    map[newY][newX] !== '⇑' &&
                    map[newY][newX] !== '⇓' &&
                    !(newX === this.state.player.x && newY === this.state.player.y) &&
                    !isOccupiedByMonster) {
                    monster.x = newX;
                    monster.y = newY;
                }
                */
            }
        });
    }

    monsterBaseXpCalc(monster, tier) {
        let baseXp = (monster.maxHp / 3) + (monster.minBaseDamage + (monster.maxBaseDamage * 1.5));
        let tierXpMultiplier = 1 + (tier * 0.1);
        return Math.round(baseXp * tierXpMultiplier);
    }
   
    handleMonsterDeath(monster, player, tier, combatLogMsg) {
        monster.hp = 0;
        monster.isAggro = false;
        const uiService = this.state.game.getService('ui');
        const itemsService = this.state.game.getService('items');
        uiService.writeToLog(combatLogMsg + `(${monster.hp}/${monster.maxHp})`);
        uiService.writeToLog(`${monster.name} defeated!`);
        itemsService.dropTreasure(monster, tier, this.state.levels[tier].map, this.state.treasures[tier] );
        const baseXp = this.monsterBaseXpCalc(monster, tier);
        player.awardXp(baseXp);
    }

    

    handleMonsterAttack(monster, player) {
        const uiService = this.state.game.getService('ui');
        if (!monster.isAggro) {
            monster.isAggro = true;
            return false;
        }

        if (this.state.player.block > 0 || this.state.player.dodge > 0) {
            if (Math.random() * 100 < this.state.player.block) {
                uiService.writeToLog(`You blocked the ${monster.name}'s attack!`);
                return false;
            }
            if (Math.random() * 100 < this.state.player.dodge) {
                uiService.writeToLog(`You dodged the ${monster.name}'s attack!`);
                return false;
            }
        }

        let monsterDamage = this.calculateMonsterAttackDamage(monster);
        const armor = player.playerInventory.getEquipped("armor")?.armor || 0;
        let armorDmgReduction = 0;

        if (armor > 0) {
            armorDmgReduction = Math.max(1, Math.floor(monsterDamage * (0.15 * armor)));
        }
        let damageDealt = monsterDamage - armorDmgReduction;

        const defenseDmgReduction = Math.round(monsterDamage * (0.10 * this.state.player.defense));
        //console.log(`Monster attack (${monsterDamage}) : Defense (${this.state.player.defense})`, this.state.player);
        damageDealt -= defenseDmgReduction;

        this.state.player.hp -= damageDealt;
        uiService.writeToLog(`${monster.name} dealt ${damageDealt} damage to You. Attack(${monsterDamage}) - Armor(${armorDmgReduction}) - Defense(${defenseDmgReduction}) `);

        // Trigger goldTheft affix when monster hits player
        const monstersService = this.game.getService('monsters');
        if (monster.affixes.includes('goldTheft')) {
            monstersService.monsterAffixes.goldTheft.onHit(monster, player);
        }


        uiService.statRefreshUI();

        if (this.state.player.hp <= 0) {
            player.death(monster.name);
            return true;
        }
        return false;
    }
}