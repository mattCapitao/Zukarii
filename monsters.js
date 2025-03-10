console.log("Monsters.js loaded");

import { State } from './State.js';

export class Monsters {
    constructor(state) {
        this.state = state;
        this.monsterAffixes = {
            goldTheft: {
                name: "Gold Theft",
                description: "Steals gold on hit",
                onHit: function (monster, player) {
                    const goldStolen = Math.floor(player.gold * 0.1);
                    player.gold -= goldStolen;
                    this.state.game.getService('ui').writeToLog(`${monster.name} has stolen ${goldStolen} gold from you!`);
                    if (player.gold < 0) {
                        player.gold = 0;
                        this.state.game.getService('ui').writeToLog(`ALL YOUR GOLD ARE BELONG TO ${monster.name} `);
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
                    console.log(`Poison gas cloud released at (${monster.x}, ${monster.y})`);
                }.bind(this)
            }
        };
    }

    generateMonster(tier, map, rooms, playerX, playerY, unique = false) {
        const data = this.state.data;
        const monsterTemplates = unique ? data.getUniqueMonsters() : data.getMonsterTemplates();

        let newMonster = { ...monsterTemplates[Math.floor(Math.random() * monsterTemplates.length)] };
        const room = rooms[Math.floor(Math.random() * rooms.length)];

        do {
            newMonster.x = room.left + 1 + Math.floor(Math.random() * (room.w - 2));
            newMonster.y = room.top + 1 + Math.floor(Math.random() * (room.h - 2));
        } while (map[newMonster.y][newMonster.x] !== ' ' || (newMonster.x === playerX && newMonster.y === playerY));

        const newMonsterTierHpSmoothing = 1 + Math.floor(Math.random() * 5);
        const calculatedMaxMonsterHp = newMonster.baseHp + newMonsterTierHpSmoothing * Math.sqrt(tier + 1);
        newMonster.maxHp = Math.round(calculatedMaxMonsterHp);
        newMonster.hp = newMonster.maxHp;
        newMonster.minBaseDamage += Math.floor(tier / 3);
        newMonster.maxBaseDamage += Math.floor(tier / 2);

        return newMonster;
    }

    generateLevelMonsters(tier) {
        const map = this.state.levels[tier].map;
        const rooms = this.state.levels[tier].rooms;
        const baseMonsterCount = 12;
        const densityFactor = 1 + tier * 0.1;
        const monsterCount = Math.floor(baseMonsterCount * densityFactor);
        let levelMonsters = [];

        console.log(`Generating ${monsterCount} monsters for tier ${tier} (base: ${baseMonsterCount}, density factor: ${densityFactor.toFixed(2)})`);

        for (let i = 0; i < monsterCount; i++) {
            const monsterToPush = this.generateMonster(tier, map, rooms, this.state.player.x, this.state.player.y);
            console.log(`Monster to push:`, monsterToPush);
            levelMonsters.push(monsterToPush);
        }
        return levelMonsters;
    }

    moveMonsters() {
        if (this.state.player.dead) return;

        const tier = this.state.tier;
        console.log(`Moving monsters on tier ${this.state.tier}, monsters:`, this.state.monsters[tier]);
        if (!this.state.monsters[tier] || !Array.isArray(this.state.monsters[tier])) {
            console.log(`No monsters defined for tier ${this.state.tier}`);
            return;
        }
        let map = this.state.levels[tier].map;
        const monsters = this.state.monsters[tier];

        const AGGRO_RANGE = (this.state.discoveryRadius || 2) + 2;
        this.state.AGGRO_RANGE = AGGRO_RANGE;
        monsters.forEach(monster => {
            console.log(`Monster: `, monster);
            if (monster.hp <= 0) return;

            const dx = this.state.player.x - monster.x;
            const dy = this.state.player.y - monster.y;
            const distanceToPlayer = Math.sqrt(dx * dx + dy * dy);

            if (distanceToPlayer <= AGGRO_RANGE + 2) {
                monster.isDetected = true;
            }

            if (distanceToPlayer <= AGGRO_RANGE || monster.isAggro) {
                monster.isAggro = true;
                let directions = [
                    { x: Math.sign(dx), y: Math.sign(dy) },
                    { x: Math.sign(dx), y: 0 },
                    { x: 0, y: Math.sign(dy) }
                ];

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
                        (newX === this.state.player.x && newY === this.state.player.y) ||
                        isOccupiedByMonster) {
                        continue;
                    }

                    monster.x = newX;
                    monster.y = newY;
                    break;
                }
            } else {
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
            }
        });
    }

    monsterXpCalc(monster, tier) {
        let baseXp = (monster.maxHp / 3) + (monster.minBaseDamage + (monster.maxBaseDamage * 1.5));
        let xpMultiplier = 1 + (tier * 0.05);
        return Math.round(baseXp * xpMultiplier);
    }

    handleMonsterDeath(monster, player, tier, combatLogMsg) {
        monster.hp = 0;
        monster.isAggro = false;
        const uiService = this.state.game.getService('ui');
        const itemsService = this.state.game.getService('items');
        uiService.writeToLog(combatLogMsg + `(${monster.hp}/${monster.maxHp})`);
        uiService.writeToLog(`${monster.name} defeated!`);
        itemsService.dropTreasure(monster, tier);
        const monsterKillXP = this.monsterXpCalc(monster, this.state.tier);
        player.awardXp(monsterKillXP);
    }

    calculateMonsterAttackDamage(enemy) {
        const tier = this.state.tier;
        const tierDamageMultiplier = 0.05;
        const baseDamage = Math.floor(Math.random() * (enemy.maxBaseDamage - enemy.minBaseDamage) + 1) + enemy.minBaseDamage;
        const damage = Math.round(baseDamage * (tier * (1 + tierDamageMultiplier)));
        console.log(`Monster attack damage: ${damage} (base: ${baseDamage}, min: ${enemy.minBaseDamage}, max: ${enemy.maxBaseDamage})`);
        return damage;
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
            armorDmgReduction = Math.max(1, Math.floor(monsterDamage * (0.01 * armor * 2)));
        }
        let damageDealt = monsterDamage - armorDmgReduction;

        const defenseDmgReduction = Math.round(monsterDamage * (0.01 * this.state.player.defense));
        console.log(`Monster attack (${monsterDamage}) : Defense (${this.state.player.defense})`, this.state.player);
        damageDealt -= defenseDmgReduction;

        this.state.player.hp -= damageDealt;
        uiService.writeToLog(`${monster.name} dealt ${damageDealt} damage to You. Attack(${monsterDamage}) - Armor(${armorDmgReduction}) - Defense(${defenseDmgReduction}) `);
        uiService.statRefreshUI();

        if (this.state.player.hp <= 0) {
            player.death(monster.name);
            return true;
        }
        return false;
    }
}