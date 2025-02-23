console.log("monsters.js loaded");

// Generates a single monster instance with tier-scaled stats
function generateMonster(tier, map, rooms, playerX, playerY) {
    const room = rooms[Math.floor(Math.random() * rooms.length)];
    let x, y;
    do {
        x = room.left + 1 + Math.floor(Math.random() * (room.w - 2));
        y = room.top + 1 + Math.floor(Math.random() * (room.h - 2));
    } while (map[y][x] !== ' ' || (x === playerX && y === playerY));
    const minDamage = 1 + Math.floor(tier / 3);
    const maxDamage = 3 + Math.floor(tier / 2);
    const damage = Math.floor(Math.random() * (maxDamage - minDamage + 1)) + minDamage;
    const totalHp = 15 + tier * 3;
    return { x, y, hp: totalHp, maxHp: totalHp, attack: damage };
}

// Generates monsters for a level, with configurable density
function generateLevelMonsters(tier) {
    const map = state.levels[tier].map;
    const rooms = state.levels[tier].rooms;
    const baseMonsterCount = 7; // Increased from 5 to 7 for higher density
    const densityFactor = 1 + tier * 0.1; // 10% more monsters per tier
    const monsterCount = Math.floor(baseMonsterCount * densityFactor); // Scales with tier
    let levelMonsters = [];

    // Clearer density implementation: base count + tier-scaled increase
    console.log(`Generating ${monsterCount} monsters for tier ${tier} (base: ${baseMonsterCount}, density factor: ${densityFactor.toFixed(2)})`);

    for (let i = 0; i < monsterCount; i++) {
        levelMonsters.push(generateMonster(tier, map, rooms, state.player.x, state.player.y));
    }
    return levelMonsters;
}

window.generateLevelMonsters = generateLevelMonsters;