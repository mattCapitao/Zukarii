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
        // Portal animation properties
        this.portalFrameCount = 9;
        this.portalFrameWidth = 128;
        this.portalFrameHeight = 128;
        this.portalRenderWidth = 128;
        this.portalRenderHeight = 128;
        this.portalFrameDuration = 200; // 200ms per frame
        this.portalCurrentFrame = 0;
        this.lastPortalFrameTime = Date.now();
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
        const spritePaths = {
            floor: 'img/map/floor.png',
            wall: 'img/map/wall.png',
            player: 'img/avatars/player.png',
            stairsup: 'img/avatars/stairsup.png',
            stairsdown: 'img/avatars/stairsdown.png',
            portal: 'img/anim/Portal-Animation.png',  // This will be the sprite strip (replacing static portal.png)
            inactivePortal: 'img/avatars/inactive-portal.png',
            chest: 'img/avatars/chest.png',
            fountain: 'img/avatars/fountain.png',
            player_idle: 'img/anim/Player/Idle.png',
            player_walk: 'img/anim/Player/Walk.png',
            player_attack: 'img/anim/Player/Attack_Fire_3.png',
            npc_zu_master: 'img/avatars/npcs/zu-master.png', // Add NPC sprite
            npc_merchant: 'img/avatars/npcs/merchant.png'
        };
        for (const [key, path] of Object.entries(spritePaths)) {
            const img = new Image();
            img.src = path;
            img.onload = () => console.log(`${key} sprite preloaded at ${path}`);
            img.onerror = () => console.error(`Failed to preload sprite: ${path}`);
            this.sprites.set(path, img);
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
        return entities;
    }

    interpolateColor(startColor, endColor, t) {
        const colors = {
            green: [0, 128, 0],
            yellow: [255, 255, 0],
            orange: [255, 165, 0],
            red: [255, 0, 0]
        };
        const startRGB = colors[startColor] || [0, 128, 0];
        const endRGB = colors[endColor] || [0, 128, 0];
        const r = Math.round(startRGB[0] + (endRGB[0] - startRGB[0]) * t);
        const g = Math.round(startRGB[1] + (endRGB[1] - startRGB[1]) * t);
        const b = Math.round(startRGB[2] + (endRGB[2] - startRGB[2]) * t);
        return `rgb(${r}, ${g}, ${b})`;
    }

    update(deltaTime) {
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

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Render floor
        const floorSprite = this.sprites.get('img/map/floor.png');
        if (floorSprite && floorSprite.complete) {
            this.ctx.save();
            this.ctx.scale(this.SCALE_FACTOR, this.SCALE_FACTOR);
            this.ctx.translate(-(startX % this.TILE_SIZE), -(startY % this.TILE_SIZE));
            const pattern = this.ctx.createPattern(floorSprite, 'repeat');
            this.ctx.fillStyle = pattern || 'black';
            const buffer = this.TILE_SIZE;
            this.ctx.fillRect(0, 0, viewportWidth + buffer, viewportHeight + buffer);
            this.ctx.restore();
        } else {
            this.ctx.fillStyle = 'black';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // Get level entity for active tier
        const levelEntity = this.entityManager.getEntity(`level_${this.entityManager.getActiveTier()}`);
        if (!levelEntity) return;

        const bucketsComp = levelEntity.getComponent('SpatialBuckets');
        if (!bucketsComp) return;

        const buffer = this.TILE_SIZE;
        const bufferedStartX = startX - buffer;
        const bufferedStartY = startY - buffer;
        const bufferedEndX = endX + buffer;
        const bufferedEndY = endY + buffer;

        const entities = this.getEntitiesInViewport(bufferedStartX, bufferedStartY, bufferedEndX, bufferedEndY, bucketsComp);

        // Update portal animation frame
        const currentTime = Date.now();
        if (currentTime - this.lastPortalFrameTime >= this.portalFrameDuration) {
            this.portalCurrentFrame = (this.portalCurrentFrame + 1) % this.portalFrameCount;
            this.lastPortalFrameTime = currentTime;
        }

        let wallCount = 0;
        // First pass: Render all entity sprites except the player
        for (const entity of entities) {
            if (entity.id === 'player') continue; // Skip player for this pass

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

            const animation = entity.hasComponent('Animation') ? entity.getComponent('Animation') : null;
            const animState = entity.hasComponent('AnimationState') ? entity.getComponent('AnimationState') : null;

            let spritePath = visuals.avatar;
            let sprite = null;

            if (!spritePath) {
                console.log(`MapRenderSystem: No spritePath in Visuals.avatar for entity ${entity.id}, components: ${Array.from(entity.components.keys())}`);
                if (entity.hasComponent('Wall')) {
                    spritePath = 'img/map/wall.png';
                } else if (entity.hasComponent('Stair')) {
                    const stairComp = entity.getComponent('Stair');
                    spritePath = stairComp.direction === 'up' ? 'img/avatars/stairsup.png' : 'img/avatars/stairsdown.png';
                } else if (entity.hasComponent('Fountain')) {
                    spritePath = 'img/avatars/fountain.png';
                } else if (entity.hasComponent('Portal')) {
                    const portalComp = entity.getComponent('Portal');
                    spritePath = portalComp.active ? 'img/anim/Portal-Animation.png' : 'img/avatars/inactive-portal.png'; // Use the sprite strip for portals
                } else if (entity.hasComponent('LootData')) {
                    spritePath = 'img/avatars/chest.png';
                } else if (entity.hasComponent('NPCData')) {
                    spritePath = visuals.avatar || 'img/avatars/npcs/zu-master.png'; // Fallback
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
            sprite = this.sprites.get(spritePath);
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
            }

            // Render the entity sprite
            this.ctx.save();
            if (entity.hasComponent('Portal')) {
                const portalComp = entity.getComponent('Portal');
                if (portalComp.active) { 
                    // Render animated portal using the sprite strip
                    const frameX = this.portalCurrentFrame * this.portalFrameWidth;
                    this.ctx.drawImage(
                        sprite,
                        frameX, 0, // Source x, y
                        this.portalFrameWidth, this.portalFrameHeight, // Source width, height
                        renderX, renderY, // Destination x, y
                        this.portalRenderWidth, this.portalRenderHeight // Destination width, height
                    );
                } else {
                    // Render static inactive portal
                    this.ctx.drawImage(
                        sprite,
                        renderX,
                        renderY,
                        visuals.w * this.SCALE_FACTOR,
                        visuals.h * this.SCALE_FACTOR
                    );
                }
            } else if (entity.hasComponent('LootData')) {
                // Add faint golden glow for treasure chests
                this.ctx.shadowColor = 'rgba(255, 215, 0, 0.5)'; // Golden glow
                this.ctx.shadowBlur = 10;
                this.ctx.drawImage(
                    sprite,
                    renderX,
                    renderY,
                    visuals.w * this.SCALE_FACTOR,
                    visuals.h * this.SCALE_FACTOR
                );
                this.ctx.shadowBlur = 0; // Reset shadow
            } else if (entity.hasComponent('MonsterData')) {
                const monsterData = entity.getComponent('MonsterData');
                if (monsterData.isBoss || monsterData.isElite) {
                    // Add faint red glow for bosses and elites
                    this.ctx.shadowColor = 'rgba(255, 0, 0, 0.5)'; // Red glow
                    this.ctx.shadowBlur = 10;
                }
                if (visuals.faceLeft === true) {
                    this.ctx.scale(-1, 1);
                    this.ctx.drawImage(
                        sprite,
                        -(renderX + visuals.w * this.SCALE_FACTOR),
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
                this.ctx.shadowBlur = 0; // Reset shadow
            } else if (visuals.faceLeft === true) {
                this.ctx.scale(-1, 1);
                this.ctx.drawImage(
                    sprite,
                    -(renderX + visuals.w * this.SCALE_FACTOR),
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

        // Second pass: Render the player sprite (to ensure it appears on top)
        for (const entity of entities) {
            if (entity.id !== 'player') continue; // Only render the player

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

            const animation = entity.hasComponent('Animation') ? entity.getComponent('Animation') : null;
            const animState = entity.hasComponent('AnimationState') ? entity.getComponent('AnimationState') : null;

            let spritePath = visuals.avatar;
            let sprite = null;

            if (animation && animState) {
                const animData = animation.animations[animation.currentAnimation];
                if (!animData) {
                    console.warn(`MapRenderSystem: No animation data for ${animation.currentAnimation} in ${entity.id}`);
                    continue;
                }
                // Use attack animation if isAttacking
                spritePath = animState.isAttacking ? 'img/anim/Player/Attack_Fire_3.png' :
                    animation.currentAnimation === 'idle' ? 'img/anim/Player/Idle.png' :
                        'img/anim/Player/Walk.png';
                sprite = this.sprites.get(spritePath);
                if (!sprite || !sprite.complete) {
                    console.warn(`MapRenderSystem: Sprite ${spritePath} not loaded for ${entity.id}`);
                    sprite = this.sprites.get('img/avatars/player.png'); // Fallback
                } else {
                    const frame = animData.frames[animation.currentFrame];
                    const renderX = (pos.x - startX) * this.SCALE_FACTOR;
                    const renderY = (pos.y - startY) * this.SCALE_FACTOR;
                    this.ctx.save();
                    if (visuals.faceLeft) {
                        this.ctx.scale(-1, 1);
                        this.ctx.drawImage(
                            sprite,
                            frame.x + 32, // Center horizontally: (128 - 64) / 2
                            64, // Bottom half: 128 - 64
                            64, 64, // Source 64x64 area
                            -(renderX + visuals.w * this.SCALE_FACTOR), renderY,
                            visuals.w * this.SCALE_FACTOR, visuals.h * this.SCALE_FACTOR
                        );
                    } else {
                        this.ctx.drawImage(
                            sprite,
                            frame.x + 32,
                            64,
                            64, 64,
                            renderX, renderY,
                            visuals.w * this.SCALE_FACTOR, visuals.h * this.SCALE_FACTOR
                        );
                    }
                    this.ctx.restore();
                    continue;
                }
            } else {
                sprite = this.sprites.get(visuals.avatar);
                if (!sprite) {
                    console.warn(`MapRenderSystem: Sprite ${visuals.avatar} not found for entity ${entity.id}`);
                    continue;
                }
                if (!sprite.complete) {
                    console.warn(`MapRenderSystem: Sprite ${visuals.avatar} not loaded for entity ${entity.id}`);
                    continue;
                }
                const renderX = (pos.x - startX) * this.SCALE_FACTOR;
                const renderY = (pos.y - startY) * this.SCALE_FACTOR;
                this.ctx.save();
                if (visuals.faceLeft === true) {
                    this.ctx.scale(-1, 1);
                    this.ctx.drawImage(
                        sprite,
                        -(renderX + visuals.w * this.SCALE_FACTOR),
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
                continue;
            }
        }

        // Third pass: Render health bars
        for (const entity of entities) {
            if (!entity.hasComponent('HpBar')) continue;

            const pos = entity.getComponent('Position');
            const visuals = entity.getComponent('Visuals');
            if (!pos || !visuals) continue;

            const renderX = (pos.x - startX) * this.SCALE_FACTOR;
            const renderY = (pos.y - startY) * this.SCALE_FACTOR;

            const hpBar = entity.getComponent('HpBar');
            let currentFillPercent = hpBar.fillPercent;
            let currentFillColor = hpBar.fillColor;

            // Calculate animation progress
            if (hpBar.animationStartTime !== null) {
                const elapsed = Date.now() - hpBar.animationStartTime;
                const t = Math.min(elapsed / hpBar.animationDuration, 1);

                currentFillPercent = hpBar.lastFillPercent + (hpBar.fillPercent - hpBar.lastFillPercent) * t;
                currentFillColor = this.interpolateColor(hpBar.lastFillColor, hpBar.fillColor, t);

                if (t >= 1) {
                    hpBar.animationStartTime = null;
                }
            }

            // Health bar dimensions
            const barWidth = visuals.w * this.SCALE_FACTOR * 0.8;
            const barHeight = 3 * this.SCALE_FACTOR;
            const barX = renderX + (visuals.w * this.SCALE_FACTOR - barWidth) / 2;
            const barY = renderY - barHeight - 4 * this.SCALE_FACTOR;

            this.ctx.save();
            this.ctx.fillStyle = 'rgba(128, 128, 128, .7)';
            this.ctx.fillRect(barX, barY, barWidth, barHeight);

            this.ctx.fillStyle = currentFillColor;
            const fillWidth = barWidth * Math.max(0, Math.min(1, currentFillPercent));
            this.ctx.fillRect(barX, barY, fillWidth, barHeight);

            this.ctx.strokeStyle = 'rgba(226,226,226,.8)';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(barX, barY, barWidth, barHeight);

            this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            this.ctx.shadowBlur = 4;

            this.ctx.restore();

            hpBar.updated = false;
        }
        gameState.needsInitialRender = false;
    }
}