console.log("render.js loaded");

class Render {
    constructor(state, ui, game) {
        this.state = state;
        this.ui = ui;
        this.game = game; // Added for renderIfNeeded dependencies
        this.animationFrame = null;
        this.mageNames = [
            "Elarion", "Sylvara", "Tharion", "Lysandra", "Zephyrion", "Morwenna", "Aethric",
            "Vionelle", "Dravenor", "Celestine", "Kaelith", "Seraphine", "Tormund", "Elowen",
            "Zarathis", "Lunara", "Veyron", "Ashka", "Rivenna", "Solthar", "Ysmera", "Drenvar",
            "Thalindra", "Orythia", "Xandrel", "Miravelle", "Korathis", "Eryndor", "Valthira",
            "Nythera"
        ];
    }

    render() {
        console.log("Rendering...", State.needsRender, "typeof:", typeof State.needsRender);
        if (!State.needsRender) return;

        const titleScreenContainer = document.getElementById('splash');

        if (!this.state.mapDiv) this.state.mapDiv = document.getElementById('map');
        if (!this.state.statsDiv) this.state.statsDiv = document.getElementById('stats');
        if (!this.state.logDiv) this.state.logDiv = document.getElementById('log');

        if (this.state.mapDiv.style.height || this.state.mapDiv.style.width || this.state.mapDiv.style.margin) {
            console.warn("Unexpected CSS properties on #map (height, width, or margin) may break scrolling. Ensure only overflow: auto is used.");
        }

        if (!this.state.gameStarted || !this.state.levels[this.state.tier]) {
            document.getElementById('splash').style.display = 'flex';
            titleScreenContainer.innerHTML = window.titleScreen || '<pre>DUNGEON CRAWL\n\nPress any key to start</pre>';
            return;
        }

        const tier = this.state.tier;
        let map = this.state.levels[tier].map;
        const height = map.length;
        const width = map[0].length;

        if (this.state.lastPlayerX !== this.state.player.x || this.state.lastPlayerY !== this.state.player.y || this.state.needsInitialRender || this.state.torchLitOnTurn) {
            if (this.state.torchLitOnTurn) { this.state.torchLitOnTurn = false; }
            const prevDiscoveredCount = this.state.discoveredWalls[tier].size;
            this.state.visibleTiles[tier].clear();

            const minX = Math.max(0, this.state.player.x - this.state.discoveryRadius);
            const maxX = Math.min(width - 1, this.state.player.x + this.state.discoveryRadius);
            const minY = Math.max(0, this.state.player.y - this.state.discoveryRadius);
            const maxY = Math.min(height - 1, this.state.player.y + this.state.discoveryRadius);

            for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
                    let distance = Math.sqrt(Math.pow(this.state.player.x - x, 2) + Math.pow(this.state.player.y - y, 2));
                    let isInRadius = distance <= this.state.discoveryRadius;
                    if (isInRadius && (map[y][x] === '#' || map[y][x] === '⇑' || map[y][x] === '⇓')) {
                        this.state.discoveredWalls[tier].add(`${x},${y}`);
                    }
                    if (isInRadius && (map[y][x] === ' ')) {
                        this.state.discoveredFloors[tier] = this.state.discoveredFloors[tier] || new Set();
                        this.state.discoveredFloors[tier].add(`${x},${y}`);
                    }
                    if (isInRadius) this.state.visibleTiles[tier].add(`${x},${y}`);
                }
            }

            const newDiscoveredCount = this.state.discoveredWalls[tier].size;
            this.state.discoveredTileCount[tier] += newDiscoveredCount - prevDiscoveredCount;
            if (this.state.discoveredTileCount[tier] >= 1000) {
                this.state.discoveredTileCount[tier] = 0;
                const exploreXP = 25;
                this.ui.writeToLog("Explored 1000 tiles!");
                this.game.player.awardXp(exploreXP);
            }
        }

        const tileMap = this.state.tileMap[tier];
        const updateRadius = Math.min(this.state.AGGRO_RANGE + 2, 15);
        const minUpdateX = this.state.needsInitialRender ? 0 : Math.max(0, this.state.player.x - updateRadius);
        const maxUpdateX = this.state.needsInitialRender ? width - 1 : Math.min(width - 1, this.state.player.x + updateRadius);
        const minUpdateY = this.state.needsInitialRender ? 0 : Math.max(0, this.state.player.y - updateRadius);
        const maxUpdateY = this.state.needsInitialRender ? height - 1 : Math.min(height - 1, this.state.player.y + updateRadius);

        if (this.state.needsInitialRender) {
            let mapDisplay = '';
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    let char = map[y][x];
                    let className = 'undiscovered';
                    let isDiscovered = this.state.discoveredWalls[tier].has(`${x},${y}`);
                    let isFloor = this.state.discoveredFloors[tier] && this.state.discoveredFloors[tier].has(`${x},${y}`);
                    let isInRadius = this.state.visibleTiles[tier].has(`${x},${y}`);
                    let monster = this.state.monsters[tier].find(m => m.x === x && m.y === y && m.hp > 0);
                    let treasure = this.state.treasures[tier].find(t => t.x === x && t.y === y);
                    let fountain = this.state.fountains[tier].find(f => f.x === x && f.y === y && !f.used);

                    if (x === this.state.player.x && y === this.state.player.y) {
                        char = '𓀠';
                        className = 'player';
                        if (this.state.player.torchLit) className += ' torch';
                        if (this.state.player.lampLit) {
                            className += ' lamp';
                            this.state.discoveryRadius = 6;
                        }
                    } else if (this.state.projectile && x === this.state.projectile.x && y === this.state.projectile.y) {
                        char = '*';
                        className = 'discovered';
                    } else if (monster && (isInRadius || monster.isAgro)) {
                        char = monster.avatar;
                        className = 'discovered monster ' + monster.classes;
                        if (monster.isElite) className += ' elite';
                        if (monster.isBoss) className += ' boss';
                        monster.affixes.forEach(affix => className += ` ${affix}`);
                    } else if (treasure && (isInRadius || treasure.discovered)) {
                        treasure.discovered = true;
                        char = '$';
                        className = 'discovered treasure';
                    } else if (fountain && (isInRadius || fountain.discovered)) {
                        fountain.discovered = true;
                        char = '≅';
                        className = 'discovered fountain';
                    } else if (isDiscovered || isInRadius) {
                        className = 'discovered';
                    } else if (map[y][x] === ' ' && isFloor) {
                        className = 'discovered floor';
                    }

                    mapDisplay += `<span class="${className}" data-x="${x}" data-y="${y}">${char}</span>`;
                    tileMap[y][x] = { char, class: className };
                }
                mapDisplay += '\n';
            }
            this.state.mapDiv.innerHTML = mapDisplay;
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    tileMap[y][x].element = this.state.mapDiv.querySelector(`span[data-x="${x}"][data-y="${y}"]`);
                }
            }
        } else {
            for (let y = minUpdateY; y <= maxUpdateY; y++) {
                for (let x = minUpdateX; x <= maxUpdateX; x++) {
                    let char = map[y][x];
                    let className = 'undiscovered';
                    let isDiscovered = this.state.discoveredWalls[tier].has(`${x},${y}`);
                    let isFloor = this.state.discoveredFloors[tier] && this.state.discoveredFloors[tier].has(`${x},${y}`);
                    let isInRadius = this.state.visibleTiles[tier].has(`${x},${y}`);
                    let monster = this.state.monsters[tier].find(m => m.x === x && m.y === y && m.hp > 0);
                    let treasure = this.state.treasures[tier].find(t => t.x === x && t.y === y);
                    let fountain = this.state.fountains[tier].find(f => f.x === x && f.y === y && !f.used);

                    if (x === this.state.player.x && y === this.state.player.y) {
                        char = '𓀠';
                        className = 'player';
                        if (this.state.player.torchLit) className += ' torch';
                        if (this.state.player.lampLit) {
                            className += ' lamp';
                            this.state.discoveryRadius = 6;
                        }
                    } else if (this.state.projectile && x === this.state.projectile.x && y === this.state.projectile.y) {
                        char = '*';
                        className = 'discovered';
                    } else if (monster && (isInRadius || monster.isAgro)) {
                        char = monster.avatar;
                        className = 'discovered monster ' + monster.classes;
                        if (monster.isElite) className += ' elite';
                        if (monster.isBoss) className += ' boss';
                        monster.affixes.forEach(affix => className += ` ${affix}`);
                    } else if (treasure && (isInRadius || treasure.discovered)) {
                        treasure.discovered = true;
                        char = '$';
                        className = 'discovered treasure';
                    } else if (fountain && (isInRadius || fountain.discovered)) {
                        fountain.discovered = true;
                        char = '≅';
                        className = 'discovered fountain';
                    } else if (isDiscovered || isInRadius) {
                        className = 'discovered';
                    } else if (map[y][x] === ' ' && isFloor) {
                        className = 'discovered floor';
                    }

                    const current = tileMap[y][x];
                    if (current.char !== char || current.class !== className) {
                        current.element.textContent = char;
                        current.element.className = className;
                        tileMap[y][x] = { char, class: className, element: current.element };
                    }
                }
            }
        }

        this.state.mapDiv.style.border = 'none';

        if (this.state.needsInitialRender) {
            this.setInitialScroll();
        }

        this.state.lastPlayerX = this.state.player.x;
        this.state.lastPlayerY = this.state.player.y;
        this.state.lastProjectileX = this.state.projectile ? this.state.projectile.x : null;
        this.state.lastProjectileY = this.state.projectile ? this.state.projectile.y : null;
        this.state.needsInitialRender = false;
        State.needsRender = false;
        console.log("needsRender after render:", State.needsRender, "typeof:", typeof State.needsRender);
    }

    updateMapScroll() {
        const map = document.getElementById('map');
        const player = document.querySelector('.player');
        if (!player || !map) {
            console.log("Scroll update failed: Player or map not found");
            return;
        }

        console.log(`Map dimensions: scrollWidth=${map.scrollWidth}, scrollHeight=${map.scrollHeight}, clientWidth=${map.clientWidth}, clientHeight=${map.clientHeight}`);
        console.log(`Player position: offsetLeft=${player.offsetLeft}, offsetTop=${player.offsetTop}`);

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }

        const spanWidth = 16;
        const spanHeight = 16;
        const playerX = player.offsetLeft;
        const playerY = player.offsetTop;
        const viewportWidth = map.clientWidth;
        const viewportHeight = map.clientHeight;
        const currentScrollX = map.scrollLeft;
        const currentScrollY = map.scrollTop;

        const paddingX = viewportWidth * 0.25;
        const paddingY = viewportHeight * 0.25;

        const playerViewportX = playerX - currentScrollX;
        const playerViewportY = playerY - currentScrollY;

        let targetScrollX = currentScrollX;
        let targetScrollY = currentScrollY;

        if (playerViewportX < paddingX) {
            targetScrollX = playerX - paddingX;
        } else if (playerViewportX + spanWidth > viewportWidth - paddingX) {
            targetScrollX = playerX + spanWidth - (viewportWidth - paddingX);
        }

        if (playerViewportY < paddingY) {
            targetScrollY = playerY - paddingY;
        } else if (playerViewportY + spanHeight > viewportHeight - paddingY) {
            targetScrollY = playerY + spanHeight - (viewportHeight - paddingY);
        }

        targetScrollX = Math.max(0, Math.min(targetScrollX, map.scrollWidth - viewportWidth));
        targetScrollY = Math.max(0, Math.min(targetScrollY, map.scrollHeight - viewportHeight));

        const scrollThreshold = 4;
        if (Math.abs(targetScrollX - currentScrollX) < scrollThreshold && Math.abs(targetScrollY - currentScrollY) < scrollThreshold) {
            return;
        }

        const duration = 300;
        let startTime = null;
        const easeInOutQuad = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

        const animateScroll = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = easeInOutQuad(progress);

            const currentX = currentScrollX + (targetScrollX - currentScrollX) * easedProgress;
            const currentY = currentScrollY + (targetScrollY - currentScrollY) * easedProgress;

            map.scrollLeft = Math.max(0, Math.min(currentX, map.scrollWidth - viewportWidth));
            map.scrollTop = Math.max(0, Math.min(currentY, map.scrollHeight - viewportHeight));

            if (progress < 1) {
                this.animationFrame = requestAnimationFrame(animateScroll);
            } else {
                this.animationFrame = null;
                console.log(`Scroll adjusted to (${map.scrollLeft}, ${map.scrollTop}) for player at (${playerX}, ${playerY})`);
            }
        };

        this.animationFrame = requestAnimationFrame(animateScroll);
    }

    setInitialScroll() {
        const map = document.getElementById('map');
        const player = document.querySelector('.player');
        if (!player || !map) {
            console.log("Initial scroll failed: Player or map not found");
            return;
        }

        console.log(`Map dimensions: scrollWidth=${map.scrollWidth}, scrollHeight=${map.scrollHeight}, clientWidth=${map.clientWidth}, clientHeight=${map.clientHeight}`);
        console.log(`Player position: offsetLeft=${player.offsetLeft}, offsetTop=${player.offsetTop}`);

        const spanWidth = 16;
        const spanHeight = 16;
        const playerX = player.offsetLeft;
        const playerY = player.offsetTop;
        const mapWidth = map.clientWidth;
        const mapHeight = map.clientHeight;

        const scrollX = playerX - (mapWidth / 2) + (spanWidth / 2);
        const scrollY = playerY - (mapHeight / 2) + (spanHeight / 2);

        map.scrollLeft = Math.max(0, Math.min(scrollX, map.scrollWidth - mapWidth));
        map.scrollTop = Math.max(0, Math.min(scrollY, map.scrollHeight - mapHeight));

        console.log(`Initial scroll set to (${map.scrollLeft}, ${map.scrollTop}) for player at (${playerX}, ${playerY})`);
    }

    renderIfNeeded() {
        if (this.state.gameOver) {
            console.log("renderIfNeeded skipped due to gameOver");
            return;
        }
        console.log("Checking renderIfNeeded, needsRender:", State.needsRender, "typeof:", typeof State.needsRender);
        if (State.needsRender === true) {
            console.log("Rendering at", Date.now(), "with needsRender:", State.needsRender, "typeof:", typeof State.needsRender);
            this.render();
            State.needsRender = false;
            console.log("needsRender set to false after render (State.needsRender:", State.needsRender, "typeof:", typeof State.needsRender, ")");
        } else {
            console.log("renderIfNeeded called but needsRender is", State.needsRender, "typeof:", typeof State.needsRender);
        }
    }
}