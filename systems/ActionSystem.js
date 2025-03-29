// ActionSystem.js
import { System } from '../core/Systems.js';

export class ActionSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Position', 'Resource', 'PlayerState'];
    }

    init() {
        this.eventBus.on('UseFountain', (data) => this.useFountain(data));
        this.eventBus.on('LightTorch', () => this.lightTorch());
        this.eventBus.on('DrinkHealPotion', () => this.drinkHealPotion());
    }

    // ActionSystem.js - Updated useFountain method
    useFountain({ fountainEntityId, tierEntityId }) {
        const player = this.entityManager.getEntity('player');
        const fountainEntity = this.entityManager.getEntity(fountainEntityId);
        const tierEntity = this.entityManager.getEntity(tierEntityId); 
    

        if (!player || !fountainEntity || !tierEntity) return;

        const fountainData = fountainEntity.getComponent('Fountain') || { used: false };
        if (fountainData.used) return;

        const playerStats = player.getComponent('Stats');
        const playerHealth = player.getComponent('Health');
        const critChance = playerStats.critChance || (playerStats.agility * 0.02);

        
        if (Math.random() < critChance) {
            const maxHpBoost = Math.round(1 + (2 * (tierEntity.getComponent('Tier').value / 10)));

            this.eventBus.emit('LogMessage', { message: `The fountain surges with power! Fully healed and Max HP increased!` });

            this.eventBus.emit('ModifyBaseStat', { stat: 'maxHp', value: maxHpBoost });
            // Keep direct write to playerHealth for now (consistent with drinkHealPotion)
            playerHealth.hp = playerHealth.maxHp;

        } else {
            const missingHp = playerHealth.maxHp - playerHealth.hp;
            const healPercent = Math.random() * (0.5 - 0.3) + 0.3;
            const healAmount = Math.round(missingHp * healPercent);
            playerHealth.hp = Math.min(playerHealth.hp + healAmount, playerHealth.maxHp);
            this.eventBus.emit('LogMessage', { message: `The fountain restores ${healAmount} HP. Current HP: ${playerHealth.hp}/${playerHealth.maxHp}` });
        }

        fountainData.used = true;
        this.eventBus.emit('StatsUpdated', { entityId: 'player' });
        this.eventBus.emit('RenderNeeded');
    }

    drinkHealPotion() {
        const player = this.entityManager.getEntity('player');
        if (!player) return;

        const resource = player.getComponent('Resource');
        const health = player.getComponent('Health');
        const stats = player.getComponent('Stats');

        if (resource.healPotions <= 0) return;

        const critChance = stats.critChance || (stats.agility * 0.02);
        let critHealText = '';
        let healAmount = Math.round(health.maxHp * 0.3);

        if (Math.random() < critChance) {
            healAmount = health.maxHp - health.hp;
            critHealText = 'is of exceptional quality and ';
        }

        health.hp = Math.min(health.hp + healAmount, health.maxHp);
        resource.healPotions--;

        const message = health.hp >= health.maxHp
            ? `The Heal Potion ${critHealText}fully heals you!`
            : `The Heal Potion restores ${healAmount} HP. Current HP: ${health.hp}/${health.maxHp}`;
        this.eventBus.emit('LogMessage', { message });
        this.eventBus.emit('StatsUpdated', { entityId: 'player' });
    }

    lightTorch() {
        const player = this.entityManager.getEntity('player');
        if (!player) return;

        const resource = player.getComponent('Resource');
        console.log('ActionSystem: - LightTorch: resource:', resource);
        if (resource.torches <= 0) {
            this.eventBus.emit('LogMessage', { message: 'You have no torches left.' });
            return;
        }
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        if (gameState) gameState.needsRender = true;

        resource.torches--;
        this.eventBus.emit('LightSourceActivated', { type: 'torch' });
        this.eventBus.emit('StatsUpdated', { entityId: 'player' });

        let message = 'The darkness is at bay... for now!';
        if (resource.torches < 1) {
            message = 'You light your last torch!';
        }
        this.eventBus.emit('LogMessage', { message });
        console.log('ActionSystem: - LightTorch: resource:', resource);
    }
}