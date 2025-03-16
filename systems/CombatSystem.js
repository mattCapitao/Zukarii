// systems/CombatSystem.js
import { System } from '../core/Systems.js';
import { PositionComponent } from '../core/Components.js';

export class CombatSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Position', 'Health'];
        this.isRangedMode = false;
    }

    init() {
        this.eventBus.on('MeleeAttack', (data) => this.handleMeleeAttack(data));
        this.eventBus.on('RangedAttack', (data) => this.handleRangedAttack(data));
        this.eventBus.on('ToggleRangedMode', (data) => this.toggleRangedMode(data));
    }

    handleMeleeAttack({ targetEntityId }) {
        const player = this.entityManager.getEntity('player');
        const target = this.entityManager.getEntity(targetEntityId);
        if (!player || !target) return;

        const playerStats = player.getComponent('Stats');
        const playerInventory = player.getComponent('Inventory');
        const targetHealth = target.getComponent('Health');
        const targetMonsterData = target.getComponent('MonsterData');

        const weapon = playerInventory.equipped.mainhand || { baseDamageMin: 1, baseDamageMax: 2, name: 'Fists' };
        const damage = Math.floor(Math.random() * (weapon.baseDamageMax - weapon.baseDamageMin + 1)) + weapon.baseDamageMin + (playerStats.prowess || 0);
        targetHealth.hp -= damage;

        this.eventBus.emit('LogMessage', {
            message: `You dealt ${damage} damage to ${targetMonsterData.name} with your ${weapon.name} (${targetHealth.hp}/${targetHealth.maxHp})`
        });

        if (targetHealth.hp <= 0) {
            this.eventBus.emit('MonsterDied', { entityId: targetEntityId });
        }
    }

    handleRangedAttack({ direction }) {
        const player = this.entityManager.getEntity('player');
        if (!player) return;
        console.log('Ranged Attack Player check succeded', player);

        const playerPos = player.getComponent('Position');
        const playerInventory = player.getComponent('Inventory');
        const playerStats = player.getComponent('Stats');
        const weapon = playerInventory.equipped.offhand || playerInventory.equipped.mainhand || { baseDamageMin: 1, baseDamageMax: 2, baseRange: 1, name: 'Fists' };
        const range = weapon.baseRange || 1;
        const damage = Math.floor(Math.random() * (weapon.baseDamageMax - weapon.baseDamageMin + 1)) + weapon.baseDamageMin + (playerStats.intellect || 0);

        const tier = this.entityManager.getEntity('gameState').getComponent('GameState').tier;
        const levelEntity = this.entityManager.getEntitiesWith(['Map', 'Tier']).find(e => e.getComponent('Tier').value === tier);
        if (!levelEntity) return;

        const map = levelEntity.getComponent('Map').map;
        let targetX = playerPos.x;
        let targetY = playerPos.y;

        switch (direction) {
            case 'ArrowUp': targetY -= range; break;
            case 'ArrowDown': targetY += range; break;
            case 'ArrowLeft': targetX -= range; break;
            case 'ArrowRight': targetX += range; break;
        }

        const monsters = this.entityManager.getEntitiesWith(['Position', 'Health', 'MonsterData']);
        const target = monsters.find(m => {
            const pos = m.getComponent('Position');
            return pos.x === targetX && pos.y === targetY && m.getComponent('Health').hp > 0;
        });

        if (target) {
            const targetHealth = target.getComponent('Health');
            const targetMonsterData = target.getComponent('MonsterData');
            targetHealth.hp -= damage;
            this.eventBus.emit('LogMessage', {
                message: `You dealt ${damage} damage to ${targetMonsterData.name} with your ${weapon.name} (${targetHealth.hp}/${targetHealth.maxHp})`
            });

            if (targetHealth.hp <= 0) {
                this.eventBus.emit('MonsterDied', { entityId: target.id });
            }
        } else {
            const projectile = this.entityManager.createEntity(`projectile_${Date.now()}`);
            this.entityManager.addComponentToEntity(projectile.id, new PositionComponent(playerPos.x, playerPos.y));
            this.eventBus.emit('RenderNeeded');
            console.log('Ranged Attack Process - Render Needed Step 1');

            setTimeout(() => {
                const projPos = projectile.getComponent('Position');
                projPos.x = targetX;
                projPos.y = targetY;
                this.eventBus.emit('PositionChanged', { entityId: projectile.id, x: targetX, y: targetY });
                this.eventBus.emit('RenderNeeded');
                console.log('Ranged Attack Process - Render Needed Step 2');

                setTimeout(() => {
                    this.entityManager.removeEntity(projectile.id);
                    this.eventBus.emit('RenderNeeded');
                }, 300);
            }, 300);
        }
    }

    toggleRangedMode({ event }) {
        console.log('Ranged mode event', event);
        this.isRangedMode = !this.isRangedMode;
        console.log('Ranged mode', this.isRangedMode ? 'on' : 'off');
    }
}