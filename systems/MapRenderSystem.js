import { System } from '../core/Systems.js';

export class MapRenderSystem extends System {
    constructor(entityManager, eventBus, state) {
        super(entityManager, eventBus);
        this.state = state;
        this.requiredComponents = ['Position', 'Visuals'];
        this.canvas = null;
        this.ctx = null;
        this.TILE_SIZE = 32;
        this.SCALE_FACTOR = 2;
        this.sprites = new Map();
        this.initializeCanvas();
        this.loadSprites();
        window.addEventListener('resize', () => this.resizeCanvas());
    }


    init() {
        console.log('MapRenderSystem: Loaded sprites:', Array.from(this.sprites.entries()));
    }
    initializeCanvas() {
        this.canvas = document.getElementById('viewport-canvas');
        if (!this.canvas) {
            console.error('MapRenderSystem: Canvas element with id="viewport-canvas" not found');
            return;
        }
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
    }

    resizeCanvas() {
        if (!this.canvas) return;
        this.canvas.width = Math.min(window.innerWidth, 1920);
        this.canvas.height = Math.min(window.innerHeight, 1080);
    }

    loadSprites() {
        // Preload only floor and wall sprites as fallback
        const spritePaths = {
            floor: 'img/map/floor.png',
            wall: 'img/map/wall.png',
            player: 'img/avatars/player.png',
            stairsup: 'img/avatars/stairsup.png',
            stairsdown: 'img/avatars/stairsdown.png',
            portal: 'img/avatars/portal.png',
            chest: 'img/avatars/chest.png',
            fountain: 'img/avatars/fountain.png'
        };
        for (const [key, path] of Object.entries(spritePaths)) {
            const img = new Image();
            img.src = path;
            img.onload = () => console.log(`${key} sprite preloaded at ${path}`);
            img.onerror = () => console.error(`Failed to preload sprite: ${path}`);
            this.sprites.set(path, img); // Use path as key for preloaded sprites
        }
    }

    getEntitiesInViewport(startX, startY, endX, endY, bucketsComp) {
        const entities = [];
        const bucketSize = 16;
        const startBucketX = Math.floor(startX / this.TILE_SIZE / bucketSize);
        const startBucketY = Math.floor(startY / this.TILE_SIZE / bucketSize);
        const endBucketX = Math.floor(endX / this.TILE_SIZE / bucketSize);
        const endBucketY = Math.floor(endY / this.TILE_SIZE / bucketSize);

        for (let by = startBucketY; by <= endBucketY; by++) {
            for (let bx = startBucketX; bx <= endBucketX; bx++) {
                const bucketKey = `${bx},${by}`;
                const bucket = bucketsComp.buckets.get(bucketKey) || [];
               // console.log(`MapRenderSystem: Bucket (${bx},${by}) contains ${bucket.length} entities: ${bucket.join(', ')}`);
                for (const entityId of bucket) {
                    const entity = this.entityManager.getEntity(entityId);
                    if (!entity || !entity.hasComponent('Position') || !entity.hasComponent('Visuals')) continue;
                    const pos = entity.getComponent('Position');
                    if (pos.x >= startX && pos.x < endX && pos.y >= startY && pos.y < endY) {
                        entities.push(entity);
                    }
                }
            }
        }
        /*
        console.log(`MapRenderSystem: Entities in viewport:`, entities.map(e => ({
            id: e.id,
            pos: e.getComponent('Position'),
            components: Array.from(e.components.keys())
        })));
        */
        return entities;

    }

    update() {
        if (!this.canvas || !this.ctx) {
            console.warn('MapRenderSystem: Canvas or context not initialized');
            return;
        }

        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        if (!gameState?.gameStarted || !gameState.needsRender) return;

        const playerEntity = this.entityManager.getEntity('player');
        if (!playerEntity) return;

        const playerPos = playerEntity.getComponent('Position');
        if (!playerPos) return;

        const viewportWidth = this.canvas.width / this.SCALE_FACTOR;
        const viewportHeight = this.canvas.height / this.SCALE_FACTOR;

        const mapWidth = this.state.WIDTH * this.TILE_SIZE;
        const mapHeight = this.state.HEIGHT * this.TILE_SIZE;

        let startX = playerPos.x - viewportWidth / 2;
        let startY = playerPos.y - viewportHeight / 2;

        startX = Math.max(0, Math.min(startX, mapWidth - viewportWidth));
        startY = Math.max(0, Math.min(startY, mapHeight - viewportHeight));

        const endX = startX + viewportWidth;
        const endY = startY + viewportHeight;

        //console.log(`MapRenderSystem: Canvas dimensions: ${this.canvas.width}x${this.canvas.height}`);
        //console.log(`MapRenderSystem: Player position: (${playerPos.x}, ${playerPos.y})`);
       // console.log(`MapRenderSystem: Viewport bounds: startX=${startX}, startY=${startY}, endX=${endX}, endY=${endY}`);

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Render floor
        const floorSprite = this.sprites.get('img/map/floor.png');
        if (floorSprite && floorSprite.complete) {
            this.ctx.save();
            this.ctx.scale(this.SCALE_FACTOR, this.SCALE_FACTOR);
            this.ctx.translate(-(startX % this.TILE_SIZE), -(startY % this.TILE_SIZE));
            const pattern = this.ctx.createPattern(floorSprite, 'repeat');
            this.ctx.fillStyle = pattern || 'black';
            // Add a buffer of 1 tile (TILE_SIZE) to ensure coverage during movement
            const buffer = this.TILE_SIZE;
            this.ctx.fillRect(0, 0, viewportWidth + buffer, viewportHeight + buffer);
            this.ctx.restore();
        } else {
           // console.warn('MapRenderSystem: Floor sprite not loaded, using fallback');
            this.ctx.fillStyle = 'black';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // Get level entity for active tier
        const levelEntity = this.entityManager.getEntity(`level_${this.entityManager.getActiveTier()}`);
        if (!levelEntity) return;

        const bucketsComp = levelEntity.getComponent('SpatialBuckets');
        if (!bucketsComp) return;

        // Add a buffer of 1 tile to the viewport bounds to fetch entities just outside the visible area
        const buffer = this.TILE_SIZE; // 32 pixels
        const bufferedStartX = startX - buffer;
        const bufferedStartY = startY - buffer;
        const bufferedEndX = endX + buffer;
        const bufferedEndY = endY + buffer;

        const entities = this.getEntitiesInViewport(bufferedStartX, bufferedStartY, bufferedEndX, bufferedEndY, bucketsComp);
       // console.log(`MapRenderSystem: Rendering ${entities.length} entities in viewport`);

        const mapComp = levelEntity.getComponent('Map');
        if (mapComp) {
            const tileX = Math.floor(playerPos.x / this.TILE_SIZE);
            const tileY = Math.floor(playerPos.y / this.TILE_SIZE);
            //console.log(`MapRenderSystem: Player at tile (${tileX}, ${tileY}), pixel (${playerPos.x}, ${playerPos.y})`);
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    const checkX = tileX + dx;
                    const checkY = tileY + dy;
                    if (checkX >= 0 && checkX < mapComp.map[0].length && checkY >= 0 && checkY < mapComp.map.length) {
                       // console.log(`MapRenderSystem: Tile (${checkX}, ${checkY}) is ${mapComp.map[checkY][checkX] === ' ' ? 'walkable' : 'not walkable'}`);
                    }
                }
            }
        }

        let wallCount = 0;
        for (const entity of entities) {
            const pos = entity.getComponent('Position');
            const tileX = Math.floor(pos.x / this.TILE_SIZE);
            const tileY = Math.floor(pos.y / this.TILE_SIZE);
            const isDiscovered = true; // Temporarily disabled
            if (!isDiscovered) {
                console.log(`MapRenderSystem: Tile (${tileX},${tileY}) not discovered for entity ${entity.id}`);
                continue;
            }
            const visuals = entity.getComponent('Visuals');
            if (!visuals) {
                console.warn(`MapRenderSystem: Entity ${entity.id} missing Visuals component`);
                continue;
            }
            let spritePath = visuals.avatar;
            if (!spritePath) {
                console.log(`MapRenderSystem: No spritePath in Visuals.avatar for entity ${entity.id}, components: ${Array.from(entity.components.keys())}`);
                if (entity.hasComponent('Wall')) {
                    spritePath = 'img/map/wall.png';
                } else if (entity.id === 'player') {
                    spritePath = 'img/avatars/player.png';
                } else if (entity.hasComponent('Stair')) {
                    const stairComp = entity.getComponent('Stair');
                    spritePath = stairComp.direction === 'up' ? 'img/avatars/stairsup.png' : 'img/avatars/stairsdown.png';
                } else if (entity.hasComponent('Fountain')) {
                    spritePath = 'img/avatars/fountain.png';
                } else if (entity.hasComponent('Portal')) {
                    spritePath = 'img/avatars/portal.png';
                } else if (entity.hasComponent('LootData')) {
                    spritePath = 'img/avatars/chest.png';
                }
            }
            if (!spritePath) {
                console.log(`MapRenderSystem: No spritePath determined for entity ${entity.id}, components: ${Array.from(entity.components.keys())}`);
                continue;
            }
            if (!this.sprites.has(spritePath)) {
                const img = new Image();
                img.src = spritePath;
                img.onload = () => console.log(`Dynamically loaded sprite: ${spritePath}`);
                img.onerror = () => console.error(`Failed to load sprite dynamically: ${spritePath}`);
                this.sprites.set(spritePath, img);
            }
            const sprite = this.sprites.get(spritePath);
            if (!sprite) {
                console.warn(`MapRenderSystem: Sprite ${spritePath} not found for entity ${entity.id}`);
                continue;
            }
            if (!sprite.complete) {
                console.warn(`MapRenderSystem: Sprite ${spritePath} not loaded for entity ${entity.id}`);
                continue;
            }
            const renderX = (pos.x - startX) * this.SCALE_FACTOR;
            const renderY = (pos.y - startY) * this.SCALE_FACTOR;
            if (spritePath === 'img/map/wall.png') {
                wallCount++;
            } else {
                //console.log(`MapRenderSystem: Rendering ${entity.id} at (${renderX}, ${renderY}) with sprite ${spritePath}`);
            }
            // Handle facing direction for the player
            this.ctx.save();
            if (visuals.faceLeft === true) {
                // Flip horizontally by scaling x-axis by -1
                this.ctx.scale(-1, 1);
                // Adjust renderX to account for the flip (move the origin to the right edge of the sprite)
                this.ctx.drawImage(
                    sprite,
                    -(renderX + visuals.w * this.SCALE_FACTOR), // Shift left by the scaled width
                    renderY,
                    visuals.w * this.SCALE_FACTOR,
                    visuals.h * this.SCALE_FACTOR
                );
            } else {
                this.ctx.drawImage(
                    sprite,
                    renderX,
                    renderY,
                    visuals.w * this.SCALE_FACTOR,
                    visuals.h * this.SCALE_FACTOR
                );
            }
            this.ctx.restore();
        }
        //console.log(`MapRenderSystem: Rendered ${wallCount} wall entities in viewport`);
    }

}