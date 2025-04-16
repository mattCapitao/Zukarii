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
    constructor(hp = 0, maxHp = 0, updated=false) {
        this.type = 'Health';
        this.hp = hp;
        this.maxHp = maxHp;
        this.updated = updated; // Indicates if the health has been updated
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

export class MovementSpeedComponent {
    constructor(movementSpeed = 0) {
        this.type = 'MovementSpeed';
        this.movementSpeed = movementSpeed; // Cooldown in milliseconds
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