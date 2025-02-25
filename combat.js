console.log("combat.js loaded");

window.meleeCombat = function (monster) {
    let baseDamage = 2 + Math.floor(Math.random() * 2);
    let playerDamage = Math.round(baseDamage * (state.player.prowess * 0.3));

    let combatLogMsg = `You dealt ${playerDamage} damage to ${monster.name} `;

    const critChance = state.player.agility / 2;
    if (Math.random() * 100 < critChance) {
        const critMultiplier = 1.5 + Math.random() * 1.5;
        playerDamage = Math.round(playerDamage * critMultiplier);
        //writeToLog(`Critical hit! Dealt ${playerDamage} damage to Monster (${monster.hp - playerDamage}/${monster.maxHp})`);
        combatLogMsg = `Critical hit! Dealt ${playerDamage} damage to ${monster.name} `;
    }

    monster.hp -= playerDamage;

    if (monster.hp <= 0) {
        monster.hp = 0;
        monster.isAgro = false;
        writeToLog(combatLogMsg + `(${monster.hp}/${monster.maxHp})`);
        writeToLog(`${monster.name} defeated!`);
        let map = state.levels[state.currentLevel - 1].map;
        let tierTreasures = state.treasures[state.currentLevel - 1];
        console.log(`Melee: Checking treasure at (${monster.x}, ${monster.y}), tier ${state.currentLevel - 1}, map tile before: ${map[monster.y][monster.x]}`);

        const existingTreasure = tierTreasures.find(t => t.x === monster.x && t.y === monster.y);
        const goldGain = 10 + Math.floor(Math.random() * 41) + state.currentLevel * 10;

        if (existingTreasure) {
            existingTreasure.gold = (existingTreasure.gold || 10) + goldGain;
            console.log(`Melee: Updated treasure at (${monster.x}, ${monster.y}) to ${existingTreasure.gold} gold`);
        } else {
            console.log(`Melee: Dropping new treasure at (${monster.x}, ${monster.y}) with ${goldGain} gold`);
            tierTreasures.push({ x: monster.x, y: monster.y, gold: goldGain, discovered: false });
            map[monster.y][monster.x] = '$';
        }

        console.log(`Melee: Map tile after: ${map[monster.y][monster.x]}, treasures:`, tierTreasures);
        state.player.xp += (5 + Math.floor(Math.random() * 6)) * state.currentLevel;
    } else {
        writeToLog(combatLogMsg + `(${monster.hp}/${monster.maxHp})`);

        //let monsterDamage = 1 + Math.floor(Math.random() * 3) + Math.floor(state.currentLevel / 2);

        let monsterDamage = window.calculateMonsterAttackDamage(monster, state.currentLevel);
        state.player.hp -= monsterDamage;
        writeToLog(`${monster.name} dealt ${monsterDamage} damage to You`);
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
            state.isRangedMode = true;
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
            let baseDamage = 2 + Math.floor(Math.random() * 2);
            let playerDamage = Math.round(baseDamage * (state.player.intellect * 0.3));

            let combatLogMsg = `You dealt ${playerDamage} damage to ${monster.name} `;

            const critChance = state.player.agility / 2;
            if (Math.random() * 100 < critChance) {
                const critMultiplier = 1.5 + Math.random() * 1.5;
                playerDamage = Math.round(playerDamage * critMultiplier);
                combatLogMsg = `Critical hit! Dealt ${playerDamage} damage to ${monster.name} `;
            }

            monster.hp -= playerDamage;

            if (monster.hp <= 0) {
                monster.hp = 0;
                monster.isAgro = false;
                writeToLog(combatLogMsg + `(${monster.hp}/${monster.maxHp})`);
                writeToLog(`${monster.name} defeated!`);
                let tierTreasures = state.treasures[state.currentLevel - 1];
                console.log(`Ranged: Checking treasure at (${monster.x}, ${monster.y}), tier ${state.currentLevel - 1}, map tile before: ${map[monster.y][monster.x]}`);

                const existingTreasure = tierTreasures.find(t => t.x === monster.x && t.y === monster.y);
                const goldGain = 10 + Math.floor(Math.random() * 41) + state.currentLevel * 10;

                if (existingTreasure) {
                    existingTreasure.gold = (existingTreasure.gold || 10) + goldGain;
                    console.log(`Ranged: Updated treasure at (${monster.x}, ${monster.y}) to ${existingTreasure.gold} gold`);
                } else {
                    console.log(`Ranged: Dropping new treasure at (${monster.x}, ${monster.y}) with ${goldGain} gold`);
                    tierTreasures.push({ x: monster.x, y: monster.y, gold: goldGain, discovered: false });
                    map[monster.y][monster.x] = '$';
                }

                console.log(`Ranged: Map tile after: ${map[monster.y][monster.x]}, treasures:`, tierTreasures);
                state.player.xp += (5 + Math.floor(Math.random() * 6)) * state.currentLevel;
            } else if (i === 1) {
                writeToLog(combatLogMsg + `(${monster.hp}/${monster.maxHp})`);
                //let monsterDamage = 1 + Math.floor(Math.random() * 3) + Math.floor(state.currentLevel / 2);
                let monsterDamage = calculateMonsterAttackDamage(monster, state.currentLevel)
                state.player.hp -= monsterDamage;
                writeToLog(`${monster.name} dealt ${monsterDamage} damage to You`);
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
    moveMonsters();
    needsRender = true;
    renderIfNeeded();
};