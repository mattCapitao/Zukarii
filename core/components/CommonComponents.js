// core/components/CommonComponents.js
// Defines components shared across multiple entity types in the Component-Based Architecture

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
/////////////////////////////////////////////////////////////////////////
export class HitboxComponent {
    constructor(width = 1, height = 1, offsetX = 0, offsetY = 0) {
        this.type = 'Hitbox';
        this.width = width;
        this.height = height;
        this.offsetX = offsetX;
        this.offsetY = offsetY;
    }
}

export class MovementIntentComponent {
    constructor(targetX, targetY) {
        this.type = 'MovementIntent';
        this.targetX = targetX;
        this.targetY = targetY;
    }
}

export class CollisionComponent {
    constructor() {
        this.type = 'Collision';
        this.collisions = []; // Array to store collision details
    }
}



////////////////////////////////////////////////////////////////////////////////////

export class VisualsComponent {
    constructor(h = 32, w = 32) {
        this.type = 'Visuals';
        this.avatar = null; // Placeholder for avatar image
        this.h = h;
        this.w = w;
        this.faceLeft = false; // Indicates if the entity is facing left
        this.animations = []
    }
}

export class HealthComponent {
    constructor(hp = 0, maxHp = 0 ) {
        this.type = 'Health';
        this.hp = hp;
        this.maxHp = maxHp;
        this.healthRegen = 0;
        this.updated = false; // Indicates if the health has been updated
    }
} 

export class HpBarComponent {
    constructor(fillPercent = 1, fillColor = 'green', lastFillPercent = 1, lastFillColor = 'green') {
        this.type = 'HpBar';
        this.fillColor = fillColor; // Color of the health bar
        this.fillPercent = fillPercent; // Percentage of health remaining (0 to 1)
        this.lastFillColor = lastFillColor; // Last color of the health bar
        this.lastFillPercent = lastFillPercent; // Last percentage of health remaining
        this.animationStartTime = null; // Timestamp when animation starts (ms)
        this.animationDuration = 500; // Duration of animation (ms)
        this.updated = false; // Indicates if the health bar has been updated
    }
}

export class ManaComponent {
    constructor(mana = 0, maxMana = 0, manaRegen = 0.25) {
        this.type = 'Mana';
        this.mana = mana;
        this.maxMana = maxMana;
        this.manaRegen = manaRegen;
        this.updated = false;
    }
}

export class AttackSpeedComponent {
    constructor(attackSpeed = 0) {
        this.type = 'AttackSpeed';
        this.attackSpeed = attackSpeed;
        this.elapsedSinceLastAttack = 0;
    }
}

export class InCombatComponent {
    constructor(duration = 3000) { // ms
        this.type = 'InCombat';
        this.duration = duration;
        this.elapsed = 0;
    }
}

export class StairLockComponent { 
    constructor(duration = 1500) { // ms
        this.type = 'StairLock';
        this.duration = duration;
        this.elapsed = 0;
    }
}


export class MovementSpeedComponent {
    constructor(movementSpeed = 0) {
        this.type = 'MovementSpeed';
        this.movementSpeed = movementSpeed; // px per second
        this.elapsedSinceLastMove = 0; // Time since last move in ms
    }
}

export class AffixComponent {
    constructor(affixes = []) {
        this.type = 'Affix';
        this.affixes = affixes; // Array of { type, trigger, effect, params }
    }
}

export class DeadComponent {
    constructor(expiresAt) { // Absolute expiry time in ms
        this.type = 'Dead';
        this.expiresAt = expiresAt; // Set by system
        this.state = 'new'; 
    }
}


export class NeedsRenderComponent {
    constructor(x = 0, y = 0) {
        this.type = 'NeedsRender';
        this.x = x;
        this.y = y;
    }
}

export class RemoveEntityComponent {
    constructor() {
        this.type = 'RemoveEntity';
        this.remove = true;
    }
}

export class JourneyPathComponent {
    constructor() {
        this.type = 'JourneyPath';
        this.paths = []; // Array of path objects, each mirroring the previous JourneyPathComponent structure
    }
} 


export class AnimationStateComponent {
    constructor() {
        this.type = 'AnimationState';
        this.isIdle = true;
        this.isWalking = false;
        this.isAttacking = false;
    }
}

export class AnimationComponent {
    constructor() {
        this.type = 'Animation';
        this.animations = {};
        this.currentAnimation = 'idle';
        this.currentFrame = 0;
        this.frameTimer = 0;
        this.spriteSheets = {};
    }
}