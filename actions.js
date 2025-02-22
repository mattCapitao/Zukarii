function moveMonsters() {
    const tier = state.currentLevel - 1;
    console.log(`Moving monsters on tier ${state.currentLevel}, monsters:`, state.monsters[tier]);
    if (!state.monsters[tier] || !Array.isArray(state.monsters[tier])) {
        console.log(`No monsters defined for tier ${state.currentLevel}`);
        return;
    }
    let map = state.levels[tier].map;
    state.monsters[tier].forEach(monster => {
        if (monster.hp <= 0) return;

        let dx = state.player.x - monster.x;
        let dy = state.player.y - monster.y;
        let newX = monster.x + (dx !== 0 ? Math.sign(dx) : 0);
        let newY = monster.y + (dy !== 0 ? Math.sign(dy) : 0);

        if (map[newY][newX] !== '#' && !(newX === state.player.x && newY === state.player.y)) {
            monster.x = newX;
            monster.y = newY;
        }
    });
}

function toggleRanged(event) {
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
}