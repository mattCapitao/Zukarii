console.log("combat.js loaded"); // Debug to confirm loading

window.meleeCombat = function (monster) {
    let baseDamage = 2 + Math.floor(Math.random() * 2);
    let playerDamage = Math.round(baseDamage * (state.player.prowess * 0.3));

    const critChance = state.player.agility / 2;
    if (Math.random() * 100 < critChance) {
        const critMultiplier = 1.5 + Math.random() * 1.5;
        playerDamage = Math.round(playerDamage * critMultiplier);
        state.combatLog.push(`Critical hit! Dealt ${playerDamage} damage to Monster (melee)`);
    } else {
        state.combatLog.push(`You dealt ${playerDamage} damage to Monster (melee)`);
    }

    monster.hp -= playerDamage;
    if (monster.hp <= 0) {
        state.combatLog.push('Monster defeated!');
        let map = state.levels[state.currentLevel - 1].map;
        state.treasures[state.currentLevel - 1].push({ x: monster.x, y: monster.y });
        map[monster.y][monster.x] = '$';
        state.player.xp += (5 + Math.floor(Math.random() * 6)) * state.currentLevel;
    } else {
        let monsterDamage = 1 + Math.floor(Math.random() * 3) + Math.floor(state.currentLevel / 2);
        state.player.hp -= monsterDamage;
        state.combatLog.push(`Monster dealt ${monsterDamage} damage to You`);
    }
    if (state.combatLog.length > 5) state.combatLog.shift();
};

window.rangedAttack = async function (direction) {
    let map = state.levels[state.currentLevel - 1].map;
    let dx = 0, dy = 0;
    switch (direction) {
        case 'ArrowUp': dy = -1; break;
        case 'ArrowDown': dy = 1; break;
        case 'ArrowLeft': dx = -1; break;
        case 'ArrowRight': dx = 1; break;
        default: return;
    }

    for (let i = 1; i <= 7; i++) {
        let tx = state.player.x + dx * i;
        let ty = state.player.y + dy * i;
        if (tx < 0 || tx >= state.WIDTH || ty < 0 || ty >= state.HEIGHT || map[ty][tx] === '#') {
            state.combatLog.push(`Ranged shot hit a wall at (${tx}, ${ty})`);
            break;
        }

        state.projectile = { x: tx, y: ty };
        needsRender = true;
        renderIfNeeded();
        await new Promise(resolve => setTimeout(resolve, 100));

        let monster = state.monsters[state.currentLevel - 1].find(m => m.x === tx && m.y === ty && m.hp > 0);
        if (monster) {
            let baseDamage = 2 + Math.floor(Math.random() * 2);
            let playerDamage = Math.round(baseDamage * (state.player.intellect * 0.3));

            const critChance = state.player.agility / 2;
            if (Math.random() * 100 < critChance) {
                const critMultiplier = 1.5 + Math.random() * 1.5;
                playerDamage = Math.round(playerDamage * critMultiplier);
                state.combatLog.push(`Critical hit! Dealt ${playerDamage} damage to Monster (ranged) at (${tx}, ${ty})`);
            } else {
                state.combatLog.push(`You dealt ${playerDamage} damage to Monster (ranged) at (${tx}, ${ty})`);
            }

            monster.hp -= playerDamage;
            if (monster.hp <= 0) {
                state.combatLog.push('Monster defeated!');
                state.treasures[state.currentLevel - 1].push({ x: monster.x, y: monster.y });
                map[monster.y][monster.x] = '$';
                state.player.xp += (5 + Math.floor(Math.random() * 6)) * state.currentLevel;
            } else if (i === 1) {
                let monsterDamage = 1 + Math.floor(Math.random() * 3) + Math.floor(state.currentLevel / 2);
                state.player.hp -= monsterDamage;
                state.combatLog.push(`Monster dealt ${monsterDamage} damage to You (melee counterattack)`);
            }
            state.projectile = null;
            needsRender = true;
            renderIfNeeded();
            break;
        }
    }
    state.projectile = null;
    if (state.combatLog.length > 5) state.combatLog.shift();
    moveMonsters();
    needsRender = true;
    renderIfNeeded();
};

window.useFountain = function (fountain, tier) {
    if (!fountain.used && state.player.hp < state.player.maxHp) {
        let missingHp = state.player.maxHp - state.player.hp;
        let healPercent = 0.2 + Math.random() * 0.8;
        let healAmount = Math.round(missingHp * healPercent);
        state.player.hp = Math.min(state.player.hp + healAmount, state.player.maxHp);
        fountain.used = true;
        state.combatLog.push(`Healed ${healAmount} HP at fountain`);
        if (state.combatLog.length > 5) state.combatLog.shift();
        let map = state.levels[tier].map;
        map[fountain.y][fountain.x] = ' ';
    }
};