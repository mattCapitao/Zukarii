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
        const spritePaths = {
            floor: 'img/map/floor.png',
            wall: 'img/map/wall.png',
            player: 'img/avatars/player.png',
            stairsup: 'img/avatars/stairsup.png',
            stairsdown: 'img/avatars/stairsdown.png',
            portal: 'img/avatars/portal.png',
            chest: 'img/avatars/chest.png',
            fountain: 'img/avatars/fountain.png',
            player_idle: 'img/anim/Player/Idle.png',
            player_walk: 'img/anim/Player/Walk.png'
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

        let wallCount = 0;
        // First pass: Render all entity sprites
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

            const animation = entity.hasComponent('Animation') ? entity.getComponent('Animation') : null;
            const animState = entity.hasComponent('AnimationState') ? entity.getComponent('AnimationState') : null;

            let spritePath = visuals.avatar;
            let sprite = null;

            // Handle player with animations
            if (entity.id === 'player' && animation && animState) {
                const animData = animation.animations[animation.currentAnimation];
                if (!animData) {
                    console.warn(`MapRenderSystem: No animation data for ${animation.currentAnimation} in ${entity.id}`);
                    continue;
                }
                spritePath = animation.currentAnimation === 'idle' ? 'img/anim/Player/Idle.png' : 'img/anim/Player/Walk.png';
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
                            frame.x, frame.y, animData.frameWidth, animData.frameHeight,
                            -(renderX + visuals.w * this.SCALE_FACTOR), renderY,
                            visuals.w * this.SCALE_FACTOR, visuals.h * this.SCALE_FACTOR
                        );
                    } else {
                        this.ctx.drawImage(
                            sprite,
                            frame.x, frame.y, animData.frameWidth, animData.frameHeight,
                            renderX, renderY,
                            visuals.w * this.SCALE_FACTOR, visuals.h * this.SCALE_FACTOR
                        );
                    }
                    this.ctx.restore();
                    continue; // Skip default rendering for player
                }
            }

            // Default rendering for non-player entities or if animation fails
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
        }

        // Second pass: Render health bars
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
</DOCUMENT >

 <DOCUMENT filename="GameComponents.js">
// core/components/GameComponents.js
// Defines components related to overall game state and UI

export class UIComponent {
    constructor({
        activeOverlay = null
    } = {}) {
        this.type = 'UI';
        this.activeOverlay = activeOverlay; // e.g., 'character', 'inventory', etc.
    }
}

export class RenderStateComponent {
    constructor({
        renderRadius = 0
    } = {}) {
        this.type = 'RenderState';
        this.renderRadius = renderRadius; // Adjust dynamically if needed
    }
}

export class GameStateComponent {
    constructor({
        gameStarted = false,
        gameOver = false,
        tier = 1,
        highestTier = 1,
        needsInitialRender = true,
        needsRender = true,
        transitionLock = false,
        isRangedMode = false
    } = {}) {
        this.type = 'GameState';
        this.gameStarted = gameStarted;
        this.gameOver = gameOver;
        this.tier = tier;
        this.highestTier = highestTier;
        this.needsInitialRender = needsInitialRender;
        this.needsRender = needsRender;
        this.transitionLock = transitionLock;
        this.isRangedMode = isRangedMode;
    }
}
export class MouseTargetComponent {
    constructor(targetX = 0, targetY = 0) {
        this.type = 'MouseTarget';
        this.targetX = targetX;
        this.targetY = targetY;
    }
}
export class ProjectileComponent {
    constructor({
        damage = 0,
        range = 0,
        dx = 0,
        dy = 0,
        speed = 0,
        source = null
    } = {}) {
        this.type = 'Projectile';
        this.damage = damage;
        this.range = range;
        this.dx = dx;
        this.dy = dy;
        this.speed = speed;
        this.source = source;
    }
}

export class LootSourceData {
    constructor({
        tier = 1,
        sourceType = null,
        sourceId = null,
        quantity = 1
    } = {}) {
        this.type = 'LootSourceData';
        this.tier = tier;
        this.sourceType = sourceType;
        this.sourceId = sourceId;
        this.quantity = quantity;
    }
}

export class LootData {
    constructor({
        item = null,
        quantity = 1,
        tier = 1
    } = {}) {
        this.type = 'LootData';
        this.item = item;
        this.quantity = quantity;
        this.tier = tier;
    }
}

export class RenderControlComponent {
    constructor({
        locked = false
    } = {}) {
        this.type = 'RenderControl';
        this.locked = locked;
    }
}

export class LightingState {
    constructor({
        visibilityRadius = 5
    } = {}) {
        this.type = 'LightingState';
        this.visibilityRadius = visibilityRadius; // Tiles
        this.isLampLit = false;
        this.lampFuel = 0; // Fuel in seconds
        this.lampFuelMax = 0;
    }
}

export class LightSourceDefinitions {
    constructor({
        torch = { visibilityRadius: 2, fuelSeconds: 30 },
        lamp = { visibilityRadius: 4, fuelSeconds: 120 },
        fountain = { visibilityRadius: 5, fuelSeconds: 0 }
    } = {}) {
        this.type = 'LightSourceDefinitions';
        this.torch = torch;
        this.lamp = lamp;
        this.fountain = fountain;
    }
}

export class OverlayStateComponent {
    constructor({
        isOpen = false,
        activeTab = null,
        logMessages = [],
        activeMenuSection = 'controls-button'
    } = {}) {
        this.type = 'OverlayState';
        this.isOpen = isOpen;
        this.activeTab = activeTab;
        this.logMessages = logMessages;
        this.activeMenuSection = activeMenuSection;
    }
}

export class DataProcessQueues {
    constructor({
        healthUpdates = [],
        pathTransfers = []
    } = {}) {
        this.type = 'DataProcessQueues';
        this.healthUpdates = healthUpdates; // Array of health update objects
        this.pathTransfers = pathTransfers; // Array of path transfer objects
    }
}

export class AudioQueueComponent {
    constructor({
        TrackControl = [],
        SFX = []
    } = {}) {
        this.type = 'AudioQueue';
        this.TrackControl = TrackControl; // Array of track control objects { track: string, play: boolean, volume: number }
        this.SFX = SFX; // Array of sfx objects { sfx: string, volume: number }
    }
}

export class LevelTransitionComponent {
    constructor({
        pendingTransition = null,
        lastMovementDirection = { dx: 0, dy: 0 }
    } = {}) {
        this.type = 'LevelTransition';
        this.pendingTransition = pendingTransition; // e.g., 'down', 'up', 'portal', 'load'
        this.lastMovementDirection = lastMovementDirection; // { dx, dy }
    }
}
</DOCUMENT>

 <DOCUMENT filename="CommonComponents.js">
export class PositionComponent {
    constructor(x = 0, y = 0) {
        this.type = 'Position';
        this.x = x;
        this.y = y;
    }
}
export class LastPositionComponent {
    constructor(x = 0, y = 0) {
        this.type = 'LastPosition';
        this.x = x;
        this.y = y;
    }
}
export class VisualsComponent {
    constructor(w = 32, h = 32, avatar = null, faceLeft = false) {
        this.type = 'Visuals';
        this.w = w;
        this.h = h;
        this.avatar = avatar;
        this.faceLeft = faceLeft;
        this.sprite = new Image();
        if (avatar) {
            this.sprite.src = avatar;
        }
    }
}
export class HealthComponent {
    constructor(hp = 0, maxHp = 0) {
        this.type = 'Health';
        this.hp = hp;
        this.maxHp = maxHp;
    }
}
export class HpBarComponent {
    constructor({
        fillPercent = 1,
        fillColor = 'green',
        updated = false,
        animationStartTime = null,
        animationDuration = 500, // ms
        lastFillPercent = 1,
        lastFillColor = 'green'
    } = {}) {
        this.type = 'HpBar';
        this.fillPercent = fillPercent;
        this.fillColor = fillColor;
        this.updated = updated;
        this.animationStartTime = animationStartTime;
        this.animationDuration = animationDuration;
        this.lastFillPercent = lastFillPercent;
        this.lastFillColor = lastFillColor;
    }
}
export class ManaComponent {
    constructor(mana = 0, maxMana = 0) {
        this.type = 'Mana';
        this.mana = mana;
        this.maxMana = maxMana;
    }
}
export class AttackSpeedComponent {
    constructor(attackSpeed = 500) {
        this.type = 'AttackSpeed';
        this.attackSpeed = attackSpeed; // in milliseconds
        this.elapsedSinceLastAttack = 0; // in milliseconds
    }
}
export class MovementSpeedComponent {
    constructor(movementSpeed = 0) {
        this.type = 'MovementSpeed';
        this.movementSpeed = movementSpeed; // Pixels per second
    }
}
export class AffixComponent {
    constructor({
        affixes = []
    } = {}) {
        this.type = 'Affix';
        this.affixes = affixes; // Array of affix objects
    }
}
export class InCombatComponent {
    constructor({
        duration = 0
    } = {}) {
        this.type = 'InCombat';
        this.duration = duration; // in seconds
    }
}
export class DeadComponent {
    constructor({
        deathTime = null
    } = {}) {
        this.type = 'Dead';
        this.deathTime = deathTime; // Timestamp of death
    }
}
export class NeedsRenderComponent {
    constructor(x = 0, y = 0) {
        this.type = 'NeedsRender';
        this.x = x;
        this.y = y;
    }
}
export class HitboxComponent {
    constructor(width = 32, height = 32) {
        this.type = 'Hitbox';
        this.width = width;
        this.height = height;
    }
}
export class MovementIntentComponent {
    constructor(targetX = 0, targetY = 0) {
        this.type = 'MovementIntent';
        this.targetX = targetX;
        this.targetY = targetY;
    }
}
export class CollisionComponent {
    constructor({
        collisions = []
    } = {}) {
        this.type = 'Collision';
        this.collisions = collisions; // Array of collision objects { targetId, collisionType, normalX, normalY, distance }
    }
}
export class RemoveEntityComponent {
    constructor({
        markedForRemoval = false
    } = {}) {
        this.type = 'RemoveEntity';
        this.markedForRemoval = markedForRemoval;
    }
}
export class StairLockComponent {
    constructor({
        stairLock = false
    } = {}) {
        this.type = 'StairLock';
        this.stairLock = stairLock;
    }
}
export class JourneyPathComponent {
    constructor({
        paths = [] // Array of path objects
    } = {}) {
        this.type = 'JourneyPath';
        this.paths = paths; // e.g., [{ id: string, parentId: string, completed: boolean, ... }]
    }
}
</DOCUMENT>

Thanks for sharing the details and files for * Zukarii: The Descent * !Let’s implement the idle and walk animations for the player, focusing on a structured ECS approach as you requested.I’ve reviewed the provided files and have a clear understanding of your setup, but I still need a few details about the sprite sheets to proceed accurately.Below, I’ll outline the remaining questions, then implement the animation system based on the information provided, with placeholders for the sprite details you’ll fill in.

### Remaining Questions

1. ** Sprite Sheet Clarifications **:
   - ** Frame Positioning **: You mentioned the player occupies the "bottom half" of the strip(64 pixels from the bottom of a 128 - pixel tall strip).Does this mean the player sprite(32x32 pixels) is centered in the bottom 64 pixels of each 128x128 frame, with transparent padding above ? Or is the 32x32 sprite aligned differently(e.g., bottom - left corner of the frame) ? This affects the `drawImage` source coordinates(`sx`, `sy`).
   - ** Animation Speed **: You’re unsure about the speed.I’ll use 100ms per frame(10 FPS) as a placeholder for both idle(8 frames, 0.8s per loop) and walk(7 frames, 0.7s per loop), which you can adjust during testing.Does this sound reasonable, or do you have a preference(e.g., faster / slower) ?
   - ** Facing Direction **: The walk sprite has one direction(assumed right - facing).The `VisualsComponent.faceLeft` logic mirrors the sprite for left - facing movement.Is the walk sprite designed to face right by default, or should I adjust the mirroring logic ?

    2. ** Animation Triggers **:
- You suggested using booleans in a component with a setter method to manage animation states(`isIdle`, `isWalking`), which I’ll implement in a new `AnimationStateComponent`.The setter will ensure only one state is true at a time.I’ll trigger:
     - ** Idle **: When `MovementIntentComponent` is absent.
     - ** Walk **: When `MovementIntentComponent` is present.
   - Does this align with your vision ? Should the walk animation stop immediately when `MovementIntentComponent` is removed, or do you prefer a brief transition(e.g., finish the current walk cycle) ?

    With this information, I can finalize the implementation.For now, I’ll assume:
- The 32x32 player sprite is centered in the bottom 64 pixels of each 128x128 frame(transparent padding above and on sides).
- Animation speed: 100ms per frame(10 FPS).
- Walk sprite faces right by default, mirrored using`faceLeft`.
- Immediate state transitions(no cycle completion).

### Animation System Design

#### Goals
    - ** Player Animations **:
  - ** Idle **: Looping animation(8 frames) when not moving.
  - ** Walk **: Looping animation(7 frames, right - facing, mirrored for left) when moving.
- ** Integration **:
- Add`AnimationStateComponent` to player to track state(`isIdle`, `isWalking`).
  - Add`AnimationComponent` to player to manage frame data and timing.
  - Create`AnimationSystem.js` to update animation state and frames.
  - Update`MapRenderSystem.js` to render animated frames.
- ** Triggers **:
- Use`AnimationStateComponent` with booleans and a setter method.
  - `AnimationSystem.js` checks `MovementIntentComponent` to set`isWalking` / `isIdle`.
- ** Level Transitions **:
- Pause animations during`transitionLock`.
  - Reset to `isIdle` post - transition in `LevelTransitionSystem.js`.
- ** Rendering **:
- Scale 128x128 frames to 32x32(1 / 4 scaling) to match`VisualsComponent`(32x32).
  - Apply`SCALE_FACTOR = 2` during rendering(on - screen size: 64x64).
  - Use`VisualsComponent.faceLeft` to mirror walk animation.

#### ECS Components
Add to `CommonComponents.js`:
- ** AnimationStateComponent **:
```javascript
  export class AnimationStateComponent {
      constructor() {
          this.type = 'AnimationState';
          this.isIdle = true;
          this.isWalking = false;
      }

      setAnimation(state) {
          this.isIdle = state === 'idle';
          this.isWalking = state === 'walk';
      }
  }
  ```
    - ** AnimationComponent **:
```javascript
  export class AnimationComponent {
      constructor() {
          this.type = 'Animation';
          this.animations = {}; // Map of animation names to { frames, frameWidth, frameHeight, frameTime }
          this.currentAnimation = 'idle';
          this.currentFrame = 0;
          this.frameTimer = 0;
          this.spriteSheets = {}; // Map of animation names to Image objects
      }
  }
  ```

#### AnimationSystem.js
This system updates the player’s animation state and frame progression.

< xaiArtifact artifact_id = "b31315a9-a784-44e2-965a-c8647183b93d" artifact_version_id = "57761e64-5a16-4b78-aedb-147db906fb18" title = "AnimationSystem.js" contentType = "text/javascript" >
import { System } from '../core/Systems.js';

export class AnimationSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Animation', 'AnimationState', 'Position', 'Visuals'];
    }

    update(deltaTime) {
        const entities = this.entityManager.getEntitiesWith(this.requiredComponents);
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');

        if (gameState?.transitionLock) {
            return; // Pause animations during transitions
        }

        for (const entity of entities) {
            if (entity.id !== 'player') continue; // Only handle player for now

            const animation = entity.getComponent('Animation');
            const animState = entity.getComponent('AnimationState');
            const hasMovement = entity.hasComponent('MovementIntent');

            // Update animation state
            if (hasMovement && !animState.isWalking) {
                animState.setAnimation('walk');
                animation.currentAnimation = 'walk';
                animation.currentFrame = 0;
                animation.frameTimer = 0;
                console.log(`AnimationSystem: Switched ${entity.id} to walk`);
            } else if (!hasMovement && !animState.isIdle) {
                animState.setAnimation('idle');
                animation.currentAnimation = 'idle';
                animation.currentFrame = 0;
                animation.frameTimer = 0;
                console.log(`AnimationSystem: Switched ${entity.id} to idle`);
            }

            // Update frame timer
            const animData = animation.animations[animation.currentAnimation];
            if (!animData) {
                console.warn(`AnimationSystem: No data for ${animation.currentAnimation} in ${entity.id}`);
                continue;
            }

            animation.frameTimer += deltaTime * 1000; // Convert to ms
            if (animation.frameTimer >= animData.frameTime) {
                animation.currentFrame = (animation.currentFrame + 1) % animData.frames.length;
                animation.frameTimer = 0;
            }
        }
    }
}