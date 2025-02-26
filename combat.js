console.log("combat.js loaded");

function calculatePlayerDamage(baseStat, minBaseDamage, maxBaseDamage) {
    let baseDamage = Math.floor(Math.random() * (maxBaseDamage - minBaseDamage + 1)) + minBaseDamage;
    let playerDamage = Math.round(baseDamage * (baseStat * 0.3));
    let isCrit = false;

    const critChance = state.player.agility / 2;
    if (Math.random() * 100 < critChance) {
        const critMultiplier = 1.5 + Math.random() * 1.5;
        playerDamage = Math.round(playerDamage * critMultiplier);
        isCrit = true;
    }

    return { damage: playerDamage, isCrit };
}

function handleMonsterDeath(monster, tier, combatLogMsg) {
    monster.hp = 0;
    monster.isAgro = false;
    writeToLog(combatLogMsg + `(${monster.hp}/${monster.maxHp})`);
    writeToLog(`${monster.name} defeated!`);
    dropTreasure(monster, tier);
    monsterKillXP = (5 + Math.floor(Math.random() * 6)) * state.currentLevel;
    awardXp(monsterKillXP);
}

function handleMonsterRetaliation(monster, tier) {
    let monsterDamage = calculateMonsterAttackDamage(monster, state.currentLevel);
    const defense = state.player.inventory.equipped.armor?.defense || 0;
    monsterDamage = Math.max(1, monsterDamage - defense);
    state.player.hp -= monsterDamage;
    writeToLog(`${monster.name} dealt ${monsterDamage} damage to You`);
    if (state.player.hp <= 0) {
        playerDied(monster.name);
        return true; 
    }
    return false; 
}

window.meleeCombat = function (monster) {
    let minBaseDamage, maxBaseDamage;
    const mainWeapon = state.player.inventory.equipped.mainhand;
    const offWeapon = state.player.inventory.equipped.offhand;

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

    const { damage, isCrit } = calculatePlayerDamage(state.player.prowess, minBaseDamage, maxBaseDamage);
    let combatLogMsg = isCrit ? `Critical hit! Dealt ${damage} damage to ${monster.name} ` : `You dealt ${damage} damage to ${monster.name} `;

    monster.hp -= damage;

    if (monster.hp <= 0) {
        handleMonsterDeath(monster, state.currentLevel - 1, combatLogMsg);
    } else {
        writeToLog(combatLogMsg + `(${monster.hp}/${monster.maxHp})`);
        handleMonsterRetaliation(monster, state.currentLevel);
    }
};

window.toggleRanged = function (event) {
    if (!state.gameStarted) {
        state.gameStarted = true;
        initGame();
        document.getElementById('info').classList.remove('hidden');
        render();
        return;
    }
    if (event.key === ' ') {
        if (event.type === 'keydown') {
            const offWeapon = state.player.inventory.equipped.offhand;
            const mainWeapon = state.player.inventory.equipped.mainhand;
            if (offWeapon?.attackType === "ranged" || mainWeapon?.attackType === "ranged") {
                state.isRangedMode = true;
            } else {
                writeToLog("You need a ranged weapon equipped to use ranged mode!");
            }
        } else if (event.type === 'keyup') {
            state.isRangedMode = false;
        }
        render();
    }
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

    let minBaseDamage, maxBaseDamage;
    const offWeapon = state.player.inventory.equipped.offhand;
    const mainWeapon = state.player.inventory.equipped.mainhand;

    if (offWeapon?.attackType === "ranged") {
        minBaseDamage = offWeapon.baseDamageMin;
        maxBaseDamage = offWeapon.baseDamageMax;
    } else if (mainWeapon?.attackType === "ranged") {
        minBaseDamage = mainWeapon.baseDamageMin;
        maxBaseDamage = mainWeapon.baseDamageMax;
    } else {
        writeToLog("No ranged weapon equipped!");
        return; // Shouldn’t hit this due to toggleRanged check, but safety net
    }

    for (let i = 1; i <= 7; i++) {
        let tx = state.player.x + dx * i;
        let ty = state.player.y + dy * i;
        if (tx < 0 || tx >= state.WIDTH || ty < 0 || ty >= state.HEIGHT || map[ty][tx] === '#') {
            writeToLog(`Ranged shot hit a wall at (${tx}, ${ty})`);
            break;
        }

        state.projectile = { x: tx, y: ty };
        needsRender = true;
        renderIfNeeded();
        await new Promise(resolve => setTimeout(resolve, 100));

        let monster = state.monsters[state.currentLevel - 1].find(m => m.x === tx && m.y === ty && m.hp > 0);
        if (monster) {
            const { damage, isCrit } = calculatePlayerDamage(state.player.intellect, minBaseDamage, maxBaseDamage);
            let combatLogMsg = isCrit ? `Critical hit! Dealt ${damage} damage to ${monster.name} ` : `You dealt ${damage} damage to ${monster.name} `;

            monster.hp -= damage;

            if (monster.hp <= 0) {
                handleMonsterDeath(monster, state.currentLevel - 1, combatLogMsg);
            } else if (i === 1) {
                writeToLog(combatLogMsg + `(${monster.hp}/${monster.maxHp})`);
                if (!handleMonsterRetaliation(monster, state.currentLevel)) {
                    // Continue if player still alive
                }
            } else {
                writeToLog(combatLogMsg + `(${monster.hp}/${monster.maxHp})`);
            }
            state.projectile = null;
            needsRender = true;
            renderIfNeeded();
            break;
        }
    }
    state.projectile = null;
    needsRender = true;
    endTurn();
}; 