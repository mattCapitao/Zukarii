console.log("monsters.js loaded");

class Monsters {
    constructor(state, data) {
        this.state = state;
        this.data = data;
        this.monsterAffixes = {
            goldTheft: {
                name: "Gold Theft",
                description: "Steals gold on hit",
                onHit: function (monster, player) {
                    const goldStolen = Math.floor(player.gold * 0.1);
                    player.gold -= goldStolen;
                    window.ui.writeToLog(`${monster.name} has stolen ${goldStolen} gold from you!`);
                    if (player.gold < 0) {
                        player.gold = 0;
                        window.ui.writeToLog(`ALL YOUR GOLD ARE BELONG TO ${monster.name} `);
                    }
                }
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
                }.bind(this) // Bind to keep `this.state` context
            }
        };
    }

    calculateMonsterAttackDamage(enemy, tier) {
        const tierDamageMultiplier = 0.1;
        const baseDamage = Math.floor(Math.random() * (enemy.maxBaseDamage - enemy.minBaseDamage + 1)) + enemy.minBaseDamage;
        const damage = Math.round(baseDamage * (1 + tier * tierDamageMultiplier));
        console.log(`Monster attack damage: ${damage} (base: ${baseDamage}, min: ${enemy.minBaseDamage}, max: ${enemy.maxBaseDamage})`);
        return damage;
    }

    generateMonster(tier, map, rooms, playerX, playerY, unique = false) {

        const monsterTemplates = unique ? this.data.getUniqueMonsters() : this.data.getMonsterTemplates();
        
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
        const baseMonsterCount = 9;
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

            if (distanceToPlayer <= AGGRO_RANGE) {
                monster.isAgro = true;
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
                monster.isAgro = false;
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
}


window.calculateMonsterAttackDamage = function (enemy, tier) {
    return window.monstersInstance.calculateMonsterAttackDamage(enemy, tier);
};
window.moveMonsters = function () {
    window.monstersInstance.moveMonsters();
};
window.generateLevelMonsters = function (tier) {
    return window.monstersInstance.generateLevelMonsters(tier);
};

// Note: Monsters instance will be created in game.js as window.monstersInstance