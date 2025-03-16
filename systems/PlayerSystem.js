// systems/PlayerSystem.js
import { System } from '../core/Systems.js';

export class PlayerSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['PlayerState', 'Stats', 'Health', 'Mana', 'Inventory', 'Resource'];
    }

    init() {
        this.eventBus.on('InitializePlayer', () => this.initializePlayer());
        this.eventBus.on('GearChanged', (data) => this.updateGearStats(data.entityId));
        this.eventBus.on('AwardXp', (data) => this.awardXp(data));
        this.eventBus.on('PlayerDeath', (data) => this.death(data));
        this.eventBus.on('TorchExpired', () => this.torchExpired());
        this.eventBus.on('LightTorch', () => this.lightTorch());
    }

    initializePlayer() {
        const player = this.entityManager.getEntity('player');
        const utilities = this.entityManager.getEntity('state').getComponent('Utilities').utilities;

        const stats = player.getComponent('Stats');
        stats.base.intellect = utilities.dRoll(4, 3, 3);
        stats.base.prowess = utilities.dRoll(4, 3, 3);
        stats.base.agility = utilities.dRoll(4, 3, 3);
        stats.base.luck = 0;
        stats.base.maxHp = Math.round(30 * stats.base.prowess * 0.1);
        stats.base.maxMana = Math.round(10 * stats.base.intellect * 0.05);
        stats.temp = { intellect: 0, prowess: 0, agility: 0, maxHp: 0, maxMana: 0, armor: 0, block: 0, range: 0, luck: 0 };

        const health = player.getComponent('Health');
        health.hp = stats.base.maxHp;
        health.maxHp = stats.base.maxHp;

        const mana = player.getComponent('Mana');
        mana.mana = stats.base.maxMana;
        mana.maxMana = stats.base.maxMana;

        const playerState = player.getComponent('PlayerState');
        playerState.xp = 0;
        playerState.level = 1;
        playerState.nextLevelXp = 125;
        playerState.dead = false;
        playerState.torchLit = false;

        const resource = player.getComponent('Resource');
        resource.torches = 1;
        resource.healPotions = 1;
        resource.gold = 100;

        const inventory = player.getComponent('Inventory');
        const startItems = [
            { name: 'Rusty Dagger', type: 'weapon', attackType: 'melee', baseDamageMin: 1, baseDamageMax: 3, baseBlock: 1, icon: 'dagger.svg', itemTier: 'common' },
            { name: 'Ragged Robes', type: 'armor', armor: 1, icon: 'robe.svg', itemTier: 'common' },
            { name: 'Crooked Wand', type: 'weapon', attackType: 'ranged', baseDamageMin: 1, baseDamageMax: 2, baseRange: 2, icon: 'crooked-wand.svg', itemTier: 'common' }
        ];
        inventory.items = startItems.map(item => ({ ...item, uniqueId: utilities.generateUniqueId() }));

        this.calculateStats(player);
    }

    updateGearStats(entityId) {
        const player = this.entityManager.getEntity(entityId);
        const stats = player.getComponent('Stats');
        const inventory = player.getComponent('Inventory');

        // Clear gear stats
        stats.gear = { intellect: 0, prowess: 0, agility: 0, maxHp: 0, maxMana: 0, armor: 0, block: 0, range: 0, luck: 0 };

        // Update gear stats from equipped items
        Object.values(inventory.equipped).forEach(item => {
            if (!item) return;
            if (item.type === 'armor') stats.gear.armor += item.armor || 0;
            if (item.type === 'weapon' && item.attackType === 'melee') stats.gear.block += item.baseBlock || 0;
            if (item.type === 'weapon' && item.attackType === 'ranged') stats.gear.range = Math.max(stats.gear.range || 0, item.baseRange || 0);
            if (item.stats) {
                Object.entries(item.stats).forEach(([stat, value]) => {
                    stats.gear[stat] = (stats.gear[stat] || 0) + (value || 0);
                });
            }
        });

        this.calculateStats(player);
    }

    calculateStats(player) {
        const stats = player.getComponent('Stats');
        const health = player.getComponent('Health');
        const mana = player.getComponent('Mana');
        const playerState = player.getComponent('PlayerState');

        // Calculate effective stats
        stats.effective.intellect = stats.base.intellect + (stats.gear.intellect || 0) + (stats.temp.intellect || 0);
        stats.effective.prowess = stats.base.prowess + (stats.gear.prowess || 0) + (stats.temp.prowess || 0);
        stats.effective.agility = stats.base.agility + (stats.gear.agility || 0) + (stats.temp.agility || 0);
        stats.effective.luck = stats.base.luck + (stats.gear.luck || 0) + (stats.temp.luck || 0);

        const oldMaxHp = health.maxHp || stats.base.maxHp;
        stats.effective.maxHp = stats.base.maxHp + (stats.gear.maxHp || 0) + (stats.temp.maxHp || 0);
        health.maxHp = stats.effective.maxHp;
        if (oldMaxHp !== 0 && health.maxHp !== oldMaxHp) {
            health.hp = Math.round(health.hp * (health.maxHp / oldMaxHp));
            health.hp = Math.max(1, Math.min(health.hp, health.maxHp));
        }

        const oldMaxMana = mana.maxMana || stats.base.maxMana;
        stats.effective.maxMana = stats.base.maxMana + (stats.gear.maxMana || 0) + (stats.temp.maxMana || 0);
        mana.maxMana = stats.effective.maxMana;
        if (oldMaxMana !== 0 && mana.maxMana !== oldMaxMana) {
            mana.mana = Math.round(mana.mana * (mana.maxMana / oldMaxMana));
            mana.mana = Math.max(1, Math.min(mana.mana, mana.maxMana));
        }

        stats.effective.armor = (stats.gear.armor || 0) + (stats.temp.armor || 0);
        stats.effective.block = (stats.gear.block || 0) + (stats.temp.block || 0);
        stats.effective.range = (stats.gear.range || 0) + (stats.temp.range || 0);

        this.eventBus.emit('StatsUpdated', { entityId: player.id });
    }

    awardXp({ amount }) {
        const player = this.entityManager.getEntity('player');
        const playerState = player.getComponent('PlayerState');
        playerState.xp += amount;
        this.eventBus.emit('LogMessage', { message: `Gained ${amount} XP (${playerState.xp}/${playerState.nextLevelXp})` });
        this.checkLevelUp(player);
    }

    checkLevelUp(player) {
        const playerState = player.getComponent('PlayerState');
        const stats = player.getComponent('Stats');

        while (playerState.xp >= playerState.nextLevelXp) {
            const newXp = playerState.xp - playerState.nextLevelXp;
            playerState.level++;

            if (playerState.level % 3 === 0) {
                const statOptions = ['prowess', 'intellect', 'agility'];
                const statToBoost = statOptions[Math.floor(Math.random() * 3)];
                stats.base[statToBoost]++;
                this.eventBus.emit('LogMessage', { message: `Your ${statToBoost} increased to ${stats.base[statToBoost]}!` });
            }

            const hpIncrease = Math.round((6 + playerState.level) * stats.base.prowess * 0.1);
            const mpIncrease = Math.round((2 + playerState.level) * stats.base.intellect * 0.05);
            stats.base.maxHp += hpIncrease;
            stats.base.maxMana += mpIncrease;
            playerState.xp = newXp;
            playerState.nextLevelXp = Math.round(playerState.nextLevelXp * 1.55);

            this.eventBus.emit('LogMessage', { message: `Level up! Now level ${playerState.level}, Max HP increased by ${hpIncrease} to ${stats.base.maxHp}` });
        }
        this.calculateStats(player);
    }

    death({ source }) {
        const player = this.entityManager.getEntity('player');
        const health = player.getComponent('Health');
        const playerState = player.getComponent('PlayerState');
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');

        health.hp = 0;
        playerState.dead = true;
        gameState.gameOver = true;

        this.eventBus.emit('LogMessage', { message: 'You died! Game Over.' });
        this.eventBus.emit('GameOver', { message: `You have been killed by a ${source}!` });
        this.eventBus.emit('StatsUpdated', { entityId: 'player' });
    }

    torchExpired() {
        const player = this.entityManager.getEntity('player');
        const playerState = player.getComponent('PlayerState');
        const renderState = this.entityManager.getEntity('renderState').getComponent('RenderState');
        const state = this.entityManager.getEntity('state');

        playerState.torchLit = false;
        player.getComponent('Resource').torchExpires = 0;
        renderState.discoveryRadius = state.getComponent('DiscoveryRadius').discoveryRadiusDefault;

        this.eventBus.emit('LogMessage', { message: 'The torch has burned out!' });
        this.eventBus.emit('PlayAudio', { sound: 'torchBurning', play: false });
        this.eventBus.emit('RenderNeeded');
    }

    lightTorch() {
        const player = this.entityManager.getEntity('player');
        const resource = player.getComponent('Resource');
        const playerState = player.getComponent('PlayerState');
        const renderState = this.entityManager.getEntity('renderState')?.getComponent('RenderState');

        if (resource.torches > 0 && !playerState.torchLit) {
            resource.torches--;
            resource.torchExpires = 50;
            playerState.torchLit = true;
            if (renderState) renderState.discoveryRadius = 5;
            this.eventBus.emit('LogMessage', { message: `Lit a torch. ${resource.torches} torches remaining.` });
            this.eventBus.emit('PlayAudio', { sound: 'torchBurning', play: true });
            this.eventBus.emit('RenderNeeded');
        } else if (resource.torches <= 0) {
            this.eventBus.emit('LogMessage', { message: 'You have no torches left.' });
        }
    }
}