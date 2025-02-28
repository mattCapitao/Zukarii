console.log("monsters.js loaded");

const monsterTemplates = [
    {
        x: 0,
        y: 0,
        name: "Skeleton",
        classes: "skeleton",
        avatar: "s",
        baseHp: 12,
        maxHp: 12,
        hp: 12,
        minBaseDamage: 1,
        maxBaseDamage: 3,
        isAgro: false,
        isElite: false,
        isBoss: false,
        affixes:[],

    },
    {
        x: 0,
        y: 0,
        name: "Goblin",
        classes: "goblin",
        avatar: "g",
        baseHp: 14,
        maxHp: 14,
        hp: 14,
        minBaseDamage: 2,
        maxBaseDamage: 3,
        isAgro: false,
        isElite: false,
        isBoss: false,
        affixes: [],
    },
    {
        x: 0,
        y: 0,
        name: "Orc",
        classes: "orc",
        avatar: "o",
        baseHp: 16,
        maxHp: 16,
        hp: 16,
        minBaseDamage: 2,
        maxBaseDamage: 4,
        isAgro: false,
        isElite: false,
        isBoss: false,
        affixes: [],
    }
];


const uniqueMonsters = [

    {
        x: 0,
        y: 0,
        name: "Pinklefart",
        classes: "demon",
        avatar: "P",
        baseHp: 12,
        maxHp: 12,
        hp: 12,
        minBaseDamage: 1,
        maxBaseDamage: 3,
        isAgro: false,
        isElite: true,
        isBoss: true,
        affixes: [],

        },
    ]

function calculateMonsterAttackDamage(enemy, tier) {
    const tierDamageMultiplier = 0.1;
    const baseDamage = Math.floor(Math.random() * (enemy.maxBaseDamage - enemy.minBaseDamage + 1)) + enemy.minBaseDamage;
    const damage = Math.round(baseDamage * (1 + tier * tierDamageMultiplier));
    console.log(`Monster attack damage: ${damage} (base: ${baseDamage}, min: ${enemy.minBaseDamage}, max: ${enemy.maxBaseDamage})`);
    return damage;
}

// Generates a single monster instance with tier-scaled stats
function generateMonster(tier, map, rooms, playerX, playerY) {

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



// Generates monsters for a level, with configurable density
function generateLevelMonsters(tier) {
    const map = state.levels[tier].map;
    const rooms = state.levels[tier].rooms;
    const baseMonsterCount = 9;
    const densityFactor = 1 + tier * 0.1;
    const monsterCount = Math.floor(baseMonsterCount * densityFactor);
    let levelMonsters = [];

    console.log(`Generating ${monsterCount} monsters for tier ${tier} (base: ${baseMonsterCount}, density factor: ${densityFactor.toFixed(2)})`);

    for (let i = 0; i < monsterCount; i++) {
        const monsterToPush = generateMonster(tier, map, rooms, state.player.x, state.player.y);
        console.log(`Monster to push:`, monsterToPush);
        levelMonsters.push(monsterToPush);
    }
    return levelMonsters;
}

function moveMonsters() {

    if (state.player.dead) return;

    const tier = state.tier;
    console.log(`Moving monsters on tier ${state.tier}, monsters:`, state.monsters[tier]);
    if (!state.monsters[tier] || !Array.isArray(state.monsters[tier])) {
        console.log(`No monsters defined for tier ${state.tier}`);
        return;
    }
    let map = state.levels[tier].map;
    const monsters = state.monsters[tier];

    const AGGRO_RANGE = 10;

    monsters.forEach(monster => {
        console.log(`Monster: `, monster);
        if (monster.hp <= 0) return;

        const dx = state.player.x - monster.x;
        const dy = state.player.y - monster.y;
        const distanceToPlayer = Math.sqrt(dx * dx + dy * dy);

        if (distanceToPlayer <= AGGRO_RANGE) {
            monster.isAgro = true;
            // Chase player
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
                    (newX === state.player.x && newY === state.player.y) ||
                    isOccupiedByMonster) {
                    continue;
                }

                monster.x = newX;
                monster.y = newY;
                break;
            }
        } else {
            monster.isAgro = false;
            // Random wandering when out of range
            let wanderDirections = [
                { x: 1, y: 0 }, { x: -1, y: 0 }, // Left, right
                { x: 0, y: 1 }, { x: 0, y: -1 }  // Up, down
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
                !(newX === state.player.x && newY === state.player.y) &&
                !isOccupiedByMonster) {
                monster.x = newX;
                monster.y = newY;
            }
        }
    });
}

function dropLoot(monster) {
    /* Placholder function for dropping loot from monsters
    const lootChance = 0.5;
    if (Math.random() < lootChance) {
        const loot = {
            x: monster.x,
            y: monster.y,
            type: 'gold',
            amount: Math.floor(Math.random() * 10) + 1
        };
        state.loot[state.tier - 1].push(loot);
        console.log(`Dropped loot:`, loot);
    }
*/
    return;
}

window.dropLoot = dropLoot;
window.calculateMonsterAttackDamage = calculateMonsterAttackDamage;
window.moveMonsters = moveMonsters;
window.generateLevelMonsters = generateLevelMonsters;