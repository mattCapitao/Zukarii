// core/components/CommonComponents.js
// Defines components shared across multiple entity types in the Component-Based Architecture

export class PositionComponent {
    constructor(x = 0, y = 0) {
        this.type = 'Position';
        this.x = x;
        this.y = y;
    }
}

export class HealthComponent {
    constructor(hp = 0, maxHp = 0) {
        this.type = 'Health';
        this.hp = hp;
        this.maxHp = maxHp;
    }
}