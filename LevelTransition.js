
export class LevelTransition {
    constructor(state) {
        this.state = state;
    }

    findAdjacentTile(map, stairX, stairY) {
        const directions = [
            { x: stairX - 1, y: stairY }, { x: stairX + 1, y: stairY },
            { x: stairX, y: stairY - 1 }, { x: stairX, y: stairY + 1 }
        ];
        for (let dir of directions) {
            if (dir.y >= 0 && dir.y < map.length && dir.x >= 0 && dir.x < map[dir.y].length && map[dir.y][dir.x] === ' ') {
                return { x: dir.x, y: dir.y };
            }
        }
        throw new Error(`No adjacent walkable tile found near (${stairX}, ${stairY})`);
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

        this.state.game.getService('level').addLevel(this.state.tier);
        const map = this.state.levels[this.state.tier].map;
        console.log(`State after addLevel: stairsUp[${this.state.tier}] =`, this.state.stairsUp[this.state.tier]);
        const upStair = this.state.stairsUp[this.state.tier];
        console.log(`Tier ${this.state.tier} stairsUp from state: (${upStair?.x}, ${upStair?.y})`);
        if (upStair) {
            const pos = this.findAdjacentTile(map, upStair.x, upStair.y);
            this.state.player.x = pos.x;
            this.state.player.y = pos.y;
            console.log(`Landed at (${pos.x}, ${pos.y}) next to stairsUp on tier ${this.state.tier}`);
        } else {
            console.error(`No stairsUp on tier ${this.state.tier}, defaulting to (1, 1)`);
            this.state.player.x = 1;
            this.state.player.y = 1;
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
            console.log(`Tier ${this.state.tier} stairsDown from state: (${downStair?.x}, ${downStair?.y})`);
            if (downStair) {
                const pos = this.findAdjacentTile(map, downStair.x, downStair.y);
                this.state.player.x = pos.x;
                this.state.player.y = pos.y;
                console.log(`Landed at (${pos.x}, ${pos.y}) next to stairsDown on tier ${this.state.tier}`);
            } else {
                console.error(`No stairsDown on tier ${this.state.tier}, defaulting to (1, 1)`);
                this.state.player.x = 1;
                this.state.player.y = 1;
            }
            this.state.needsInitialRender = true;
            this.state.needsRender = true;
        }
    }

    transitionViaPortal(newX, newY) {
        let map = this.state.levels[this.state.tier].map;
        const currentTier = this.state.tier;
        let minTier = currentTier - 3;
        let maxTier = currentTier + 3;

        // Standard random tier selection (±3 range, excluding current tier)
        let destinationTier;
        do {
            destinationTier = Math.floor(Math.random() * (maxTier - minTier + 1)) + minTier;
        } while (destinationTier === currentTier);
        if (destinationTier < 1) destinationTier = 1;

        // Calculate risk chance (1% per 10 tiers)
        const riskChance = Math.floor(currentTier / 10);
        if (Math.random() < riskChance / 100) {
            // On risk hit, expand range to ±8 and re-pick
            minTier = currentTier - 8;
            maxTier = currentTier + 8;
            do {
                destinationTier = Math.floor(Math.random() * (maxTier - minTier + 1)) + minTier;
            } while (destinationTier === currentTier);
            if (destinationTier < 1) destinationTier = 1;
        } 

        this.state.game.getService('ui').writeToLog(`You step through a mysterious portal surging with chaotic energy and are transported to Tier ${destinationTier}!`);
        

        console.log(`Portal transition from tier ${currentTier} to tier ${destinationTier} (standard range: ${currentTier - 3} to ${currentTier + 3}, risk range: ${currentTier - 8} to ${currentTier + 8})`);
        map[newY][newX] = ' ';
        this.state.tier = destinationTier;

        if (!this.state.levels[destinationTier]) {
            this.state.game.getService('level').addLevel(destinationTier);
        }
        map = this.state.levels[this.state.tier].map;
        const upStair = this.state.stairsUp[this.state.tier];
        console.log(`Tier ${destinationTier} stairsUp from state: (${upStair?.x}, ${upStair?.y})`);

        if (upStair) {
            const pos = this.findAdjacentTile(map, upStair.x, upStair.y);
            this.state.player.x = pos.x;
            this.state.player.y = pos.y;
            console.log(`Landed at (${pos.x}, ${pos.y}) next to stairsUp on tier ${destinationTier}`);
        } else {
            console.error(`No stairsUp on tier ${destinationTier}, defaulting to (1, 1)`);
            this.state.player.x = 1;
            this.state.player.y = 1;
        }
        this.state.needsInitialRender = true;
        this.state.needsRender = true;
    }


}


