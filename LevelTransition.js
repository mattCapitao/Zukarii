export class LevelTransition {
    constructor(state) {
        this.state = state;
    }

    transitionDown() {
        if (this.state.tier >= Number.MAX_SAFE_INTEGER) return;

        const newTier = this.state.tier + 1;
        console.log(`Transitioning down to tier ${newTier}`);
        this.state.tier = newTier;
        if (this.state.tier > this.state.highestTier) {
            this.state.highestTier = this.state.tier;
            const newTierXP = 5 * this.state.tier;
            this.state.game.getService('ui').writeToLog(`You Reached Tier ${this.state.tier}`);
            this.state.game.getService('player').awardXp(newTierXP);
        }

        // Initialize the new tier
        this.state.game.getService('level').addLevel(this.state.tier);

        // Access the new tier's map and stairsUp
        const map = this.state.levels[this.state.tier].map;
        const upStair = this.state.stairsUp[this.state.tier];
        console.log(`upStair for tier ${this.state.tier}:`, upStair);

        if (upStair) {
            let x = upStair.x + 1;
            let y = upStair.y;
            if (y >= 0 && y < map.length && x >= 0 && x < map[y].length && map[y][x] !== ' ') {
                // Check adjacent tiles if +1 is blocked
                const directions = [
                    { x: upStair.x - 1, y: upStair.y },
                    { x: upStair.x, y: upStair.y + 1 },
                    { x: upStair.x, y: upStair.y - 1 }
                ];
                for (let dir of directions) {
                    if (y >= 0 && y < map.length && x >= 0 && x < map[y].length && map[dir.y][dir.x] === ' ') {
                        x = dir.x;
                        y = dir.y;
                        break;
                    }
                }
                if (map[y][x] !== ' ') {
                    console.error(`No walkable tile near < at (${upStair.x}, ${upStair.y}) on tier ${this.state.tier}, defaulting to (1, 1)`);
                    x = 1;
                    y = 1;
                }
            }
            this.state.player.x = x;
            this.state.player.y = y;
            console.log(`Landed at (${x}, ${y}) near stairsUp on tier ${this.state.tier}`);
        } else {
            console.error(`No stairsUp defined for tier ${this.state.tier}`);
            this.state.player.x = 1;
            this.state.player.y = 1;
            console.log(`Fallback landed at (1, 1) on tier ${this.state.tier}`);
        }
        this.state.needsInitialRender = true;
        this.state.needsRender = true;
    }

    transitionUp() {
        console.log(`Transitioning up to tier ${this.state.tier - 1}`);
        if (this.state.tier === 0 || this.state.tier === 1) {
            this.state.game.getService('player').exit();
        } else {
            const newTier = this.state.tier - 1;
            this.state.tier = newTier;
            if (!this.state.levels[this.state.tier]?.map) {
                this.state.game.getService('level').addLevel(this.state.tier);
            }
            const map = this.state.levels[this.state.tier].map;
            const downStair = this.state.stairsDown[this.state.tier];
            console.log(`downStair for tier ${this.state.tier}:`, downStair);
            if (downStair) {
                let x = downStair.x + 1;
                let y = downStair.y;
                if (y >= 0 && y < map.length && x >= 0 && x < map[y].length && map[y][x] !== ' ') {
                    // Check adjacent tiles if +1 is blocked
                    const directions = [
                        { x: downStair.x - 1, y: downStair.y },
                        { x: downStair.x, y: downStair.y + 1 },
                        { x: downStair.x, y: downStair.y - 1 }
                    ];
                    for (let dir of directions) {
                        if (y >= 0 && y < map.length && x >= 0 && x < map[y].length && map[dir.y][dir.x] === ' ') {
                            x = dir.x;
                            y = dir.y;
                            break;
                        }
                    }
                    if (map[y][x] !== ' ') {
                        console.error(`No walkable tile near > at (${downStair.x}, ${downStair.y}) on tier ${this.state.tier}, defaulting to (1, 1)`);
                        x = 1;
                        y = 1;
                    }
                }
                this.state.player.x = x;
                this.state.player.y = y;
                console.log(`Landed at (${x}, ${y}) near stairsDown on tier ${this.state.tier}`);
            } else {
                console.error(`No stairsDown defined for tier ${this.state.tier}`);
                this.state.player.x = 1;
                this.state.player.y = 1;
                console.log(`Fallback landed at (1, 1) on tier ${this.state.tier}`);
            }
            this.state.needsInitialRender = true;
            this.state.needsRender = true;
        }
    }

    transitionViaPortal(newX, newY) {
        let map = this.state.levels[this.state.tier].map;
        const currentTier = this.state.tier;
        const minTier = Math.max(1, currentTier - 3);
        const maxTier = currentTier + 3;
        let destinationTier;
        do {
            destinationTier = Math.floor(Math.random() * (maxTier - minTier + 1)) + minTier;
        } while (destinationTier === currentTier);

        const riskChance = Math.floor(currentTier / 10) / 100; // 0% at 1-9, 1% at 10-19, etc.
        if (Math.random() < riskChance) {
            destinationTier += 5;
            this.state.game.getService('ui').writeToLog(`The portal surges with chaotic energy, flinging you far ahead to Tier ${destinationTier}!`);
        } else {
            this.state.game.getService('ui').writeToLog(`You step through a mysterious portal to Tier ${destinationTier}!`);
        }

        // Remove the portal
        map[newY][newX] = ' ';
        this.state.needsRender = true;

        // Transition to new tier
        this.state.tier = destinationTier;
        if (!this.state.levels[destinationTier]) {
            this.state.game.getService('level').addLevel(destinationTier);
        }
        map = this.state.levels[this.state.tier].map;
        const centerX = Math.floor(this.state.WIDTH / 2);
        const centerY = Math.floor(this.state.HEIGHT / 2);
        let x = centerX;
        let y = centerY;
        if (y >= 0 && y < map.length && x >= 0 && x < map[y].length && map[y][x] !== ' ') {
            const directions = [
                { x: centerX - 1, y: centerY }, { x: centerX + 1, y: centerY },
                { x: centerX, y: centerY - 1 }, { x: centerX, y: centerY + 1 }
            ];
            for (let dir of directions) {
                if (map[dir.y][dir.x] === ' ') {
                    x = dir.x;
                    y = dir.y;
                    break;
                }
            }
            if (map[y][x] !== ' ') {
                console.error(`No walkable tile near center (${centerX}, ${centerY}), defaulting to (1, 1)`);
                x = 1;
                y = 1;
            }
        }
        this.state.player.x = x;
        this.state.player.y = y;
        console.log(`Landed at (${x}, ${y}) on tier ${destinationTier}`);
        this.state.needsInitialRender = true;
        this.state.needsRender = true;
    }
}