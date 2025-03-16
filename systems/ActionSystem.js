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

    useFountain({ fountainEntityId, tierEntityId }) {
        const player = this.entityManager.getEntity('player');
        const fountainEntity = this.entityManager.getEntity(fountainEntityId);
        const tierEntity = this.entityManager.getEntity(tierEntityId);

        if (!player || !fountainEntity || !tierEntity) return;

        const fountainData = fountainEntity.getComponent('FountainData') || { used: false };
        if (fountainData.used) return;

        const playerStats = player.getComponent('Stats');
        const playerHealth = player.getComponent('Health');
        const critChance = playerStats.critChance || (playerStats.agility * 0.02);

        let healAmount;
        if (Math.random() < critChance) {
            const maxHpBoost = Math.round(1 + (2 * (tierEntity.getComponent('Tier').value / 10)));
            playerHealth.maxHp += maxHpBoost;
            healAmount = playerHealth.maxHp - playerHealth.hp;
            playerHealth.hp = playerHealth.maxHp;
            this.eventBus.emit('LogMessage', { message: `The fountain surges with power! Fully healed and Max HP increased by ${maxHpBoost} to ${playerHealth.maxHp}!` });
        } else {
            const missingHp = playerHealth.maxHp - playerHealth.hp;
            const healPercent = Math.random() * (0.5 - 0.3) + 0.3;
            healAmount = Math.round(missingHp * healPercent);
            playerHealth.hp = Math.min(playerHealth.hp + healAmount, playerHealth.maxHp);
            this.eventBus.emit('LogMessage', { message: `The fountain restores ${healAmount} HP. Current HP: ${playerHealth.hp}/${playerHealth.maxHp}` });
        }

        fountainData.used = true;
        const mapComp = tierEntity.getComponent('Map');
        mapComp.map[fountainEntity.getComponent('Position').y][fountainEntity.getComponent('Position').x] = ' ';
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
        const playerState = player.getComponent('PlayerState');
        const renderState = this.entityManager.getEntity('renderState').getComponent('RenderState');

        if (resource.torches <= 0) {
            this.eventBus.emit('LogMessage', { message: 'You have no torches left.' });
            return;
        }

        resource.torches--;
        playerState.torchLit = true;
        resource.torchExpires = 1000;
        renderState.discoveryRadius = this.entityManager.getEntity('state').discoveryRadiusDefault + 2;

        let message = 'The darkness is at bay... for now!';
        if (resource.torches < 1) {
            message = 'You light your last torch!';
            renderState.torchLitOnTurn = true;
            this.eventBus.emit('RenderNeeded');
        }

        this.eventBus.emit('LogMessage', { message });
        this.eventBus.emit('PlayAudio', { sound: 'torch', play: true });
        if (renderState.torchLitOnTurn) this.eventBus.emit('RenderNeeded');
    }

    torchExpired() {
        const player = this.entityManager.getEntity('player');
        const renderState = this.entityManager.getEntity('renderState').getComponent('RenderState');
        const mapDiv = document.getElementById('map');

        player.getComponent('PlayerState').torchLit = false;
        player.getComponent('Resource').torchExpires = 0;
        renderState.discoveryRadius = this.entityManager.getEntity('state').discoveryRadiusDefault;

        const playerSpan = mapDiv.querySelector('.player');
        if (playerSpan) {
            playerSpan.classList.remove('torch', 'flicker');
        }

        this.eventBus.emit('LogMessage', { message: 'The torch has burned out!' });
        this.eventBus.emit('PlayAudio', { sound: 'torch', play: false });
        this.eventBus.emit('RenderNeeded');
    }
}