// systems/PlayerSystem.js
import { System } from '../core/Systems.js';

export class PlayerSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus, utilities);
        this.requiredComponents = ['PlayerState', 'Stats', 'Health', 'Mana', 'Inventory', 'Resource'];
    }

    init() {
        this.eventBus.on('InitializePlayer', () => this.initializePlayer());
        this.eventBus.on('GearChanged', (data) => this.updateGearStats(data.entityId));
        this.eventBus.on('AwardXp', (data) => this.awardXp(data));
        this.eventBus.on('PlayerDeath', (data) => this.death(data));
        this.eventBus.on('TorchExpired', () => this.torchExpired());
        this.eventBus.on('LightTorch', () => this.lightTorch());
        this.eventBus.on('PlayerExit', () => this.exit()); // New event handler for PlayerExit
        this.eventBus.on('TilesDiscovered', (data) => this.handleTilesDiscovered(data));
    }

    initializePlayer() {
        const player = this.entityManager.getEntity('player');
       // const utilities = this.entityManager.getEntity('state').getComponent('Utilities').utilities;

        const stats = player.getComponent('Stats');
        stats._internal.base.intellect = this.utilities.dRoll(4, 3, 3);
        stats._internal.base.prowess = this.utilities.dRoll(4, 3, 3);
        stats._internal.base.agility = this.utilities.dRoll(4, 3, 3);
        stats._internal.base.luck = 0;
        stats._internal.base.maxHp = Math.round(30 * stats._internal.base.prowess * 0.1);
        stats._internal.base.maxMana = Math.round(10 * stats._internal.base.intellect * 0.05);
        stats.intellect = stats._internal.base.intellect;
        stats.prowess = stats._internal.base.prowess;
        stats.agility = stats._internal.base.agility;
        stats.luck = stats._internal.base.luck;
        stats.maxHp = stats._internal.base.maxHp;
        stats.maxMana = stats._internal.base.maxMana;

        const health = player.getComponent('Health');
        health.hp = stats.maxHp;
        health.maxHp = stats.maxHp;

        const mana = player.getComponent('Mana');
        mana.mana = stats.maxMana;
        mana.maxMana = stats.maxMana;

        const playerState = player.getComponent('PlayerState');
        playerState.xp = 0;
        playerState.level = 1;
        playerState.nextLevelXp = 125;
        playerState.dead = false;
        playerState.torchLit = false;
        playerState.lampLit = false;
        playerState.name = "Mage"; // mageNames removed, placeholder name

        const resource = player.getComponent('Resource');
        resource.torches = 1;
        resource.healPotions = 1;
        resource.gold = 100;
        resource.torchExpires = 0;
        resource.potionDropFail = 0;
        resource.torchDropFail = 0;

        const inventory = player.getComponent('Inventory');

        // Use Promise.then to handle async item generation without await
        this.getRandomStartItems().then(startItems => {
            inventory.items = startItems.map(item => ({ ...item, uniqueId: this.utilities.generateUniqueId() }));
        });

        this.calculateStats(player);
    }

    getRandomStartItems() {

        const randomStartItemTierIndex = Math.random() < 0.5 ? 0: 1;
        const partialItems = [
            { tierIndex: randomStartItemTierIndex}, // Random Junk or common item
            { tierIndex: 0, type: 'armor'}, // Junk armor
            { tierIndex: 0, type: 'weapon', attackType: 'ranged' }, // Junk ranged weapon
            { tierIndex: 0, type: 'weapon', attackType: 'melee' }, // Junk melee weapon
        ];

        // Use Promise.all to handle async item generation via EventBus
        return Promise.all(partialItems.map(partialItem => {
            return new Promise((resolve) => {
                this.eventBus.emit('GenerateROGItem', {
                    partialItem,
                    dungeonTier: 0, // Starting at tier 0 (surface level)
                    callback: (item) => {
                        if (item) {
                            resolve(item);
                        } else {
                            console.warn('Failed to generate start item for partialItem:', partialItem);
                            resolve(null); // Fallback to avoid breaking
                        }
                    }
                });
            });
        })).then(items => items.filter(item => item !== null)); // Filter out any failed generations
    }

    updateGearStats(entityId) {
        const player = this.entityManager.getEntity(entityId);
        const stats = player.getComponent('Stats');
        const inventory = player.getComponent('Inventory');

        stats._internal.gear = {
            intellect: 0, prowess: 0, agility: 0, maxHp: 0, maxMana: 0,
            armor: 0, defense: 0, block: 0, dodge: 0, range: 0, baseRange: 0,
            damageBonus: 0, meleeDamageBonus: 0, rangedDamageBonus: 0, luck: 0, maxLuck: 0
        };

        Object.values(inventory.equipped).forEach(item => {
            if (!item) return;
            if (item.type === 'armor') stats._internal.gear.armor += item.armor || 0;
            if (item.type === 'weapon' && item.attackType === 'melee') stats._internal.gear.block += item.baseBlock || 0;
            if (item.type === 'weapon' && item.attackType === 'ranged') stats._internal.gear.range = Math.max(stats._internal.gear.range || 0, item.baseRange || 0);
            if (item.stats) {
                Object.entries(item.stats).forEach(([stat, value]) => {
                    stats._internal.gear[stat] = (stats._internal.gear[stat] || 0) + (value || 0);
                });
            }
        });

        this.calculateStats(player);
    }

    calculateStats(player) {
        const stats = player.getComponent('Stats');
        const health = player.getComponent('Health');
        const mana = player.getComponent('Mana');

        stats.intellect = stats._internal.base.intellect + (stats._internal.gear.intellect || 0) + (stats._internal.temp.intellect || 0);
        stats.prowess = stats._internal.base.prowess + (stats._internal.gear.prowess || 0) + (stats._internal.temp.prowess || 0);
        stats.agility = stats._internal.base.agility + (stats._internal.gear.agility || 0) + (stats._internal.temp.agility || 0);
        const oldMaxHp = health.maxHp || stats._internal.base.maxHp;
        stats.maxHp = stats._internal.base.maxHp + (stats._internal.gear.maxHp || 0) + (stats._internal.temp.maxHp || 0);
        health.maxHp = stats.maxHp;
        if (oldMaxHp !== 0 && health.maxHp !== oldMaxHp) {
            health.hp = Math.round(health.hp * (health.maxHp / oldMaxHp));
            health.hp = Math.max(1, Math.min(health.hp, health.maxHp));
        }
        const oldMaxMana = mana.maxMana || stats._internal.base.maxMana;
        stats.maxMana = stats._internal.base.maxMana + (stats._internal.gear.maxMana || 0) + (stats._internal.temp.maxMana || 0);
        mana.maxMana = stats.maxMana;
        if (oldMaxMana !== 0 && mana.maxMana !== oldMaxMana) {
            mana.mana = Math.round(mana.mana * (mana.maxMana / oldMaxMana));
            mana.mana = Math.max(1, Math.min(mana.mana, mana.maxMana));
        }
        stats.armor = (stats._internal.gear.armor || 0) + (stats._internal.temp.armor || 0);
        stats.defense = (stats._internal.gear.defense || 0) + (stats._internal.temp.defense || 0);
        stats.block = (stats._internal.gear.block || 0) + (stats._internal.temp.block || 0);
        stats.dodge = (stats._internal.gear.dodge || 0) + (stats._internal.temp.dodge || 0);
        stats.range = (stats._internal.gear.range || 0) + (stats._internal.temp.range || 0);
        stats.baseRange = (stats._internal.gear.baseRange || 0) + (stats._internal.temp.baseRange || 0);
        stats.damageBonus = (stats._internal.gear.damageBonus || 0) + (stats._internal.temp.damageBonus || 0);
        stats.meleeDamageBonus = (stats._internal.gear.meleeDamageBonus || 0) + (stats._internal.temp.meleeDamageBonus || 0);
        stats.rangedDamageBonus = (stats._internal.gear.rangedDamageBonus || 0) + (stats._internal.temp.rangedDamageBonus || 0);
        stats.luck = stats._internal.base.luck + (stats._internal.gear.luck || 0) + (stats._internal.temp.luck || 0);
        stats.maxLuck = (stats._internal.gear.maxLuck || 0) + (stats._internal.temp.maxLuck || 0);

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
                stats._internal.base[statToBoost]++;
                this.eventBus.emit('LogMessage', { message: `Your ${statToBoost} increased to ${stats._internal.base[statToBoost]}!` });
            }

            const hpIncrease = Math.round((6 + playerState.level) * stats._internal.base.prowess * 0.1);
            const mpIncrease = Math.round((2 + playerState.level) * stats._internal.base.intellect * 0.05);
            stats._internal.base.maxHp += hpIncrease;
            stats._internal.base.maxMana += mpIncrease;
            playerState.xp = newXp;
            playerState.nextLevelXp = Math.round(playerState.nextLevelXp * 1.55);

            this.eventBus.emit('LogMessage', { message: `Level up! Now level ${playerState.level}, Max HP increased by ${hpIncrease} to ${stats._internal.base.maxHp}` });
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

    exit() {
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        this.eventBus.emit('LogMessage', { message: 'You exited the dungeon! Game Over.' });
        document.removeEventListener('keydown', this.handleInput);
        document.removeEventListener('keyup', this.handleInput);
        gameState.gameOver = true;
        this.eventBus.emit('GameOver', { message: 'You exited the dungeon! Too much adventure to handle eh?' });
        this.eventBus.emit('StatsUpdated', { entityId: 'player' });
    }

    // Store the handleInput reference for removal
    handleInput = (event) => {
        const game = this.entityManager.getEntity('game');
        if (game) game.handleInput(event);
    };

    handleTilesDiscovered({ count, total }) {
        const player = this.entityManager.getEntity('player');
        const playerState = player.getComponent('PlayerState');

        //this.eventBus.emit('LogMessage', { message: `Discovered ${count} new tiles (${total} total)` });

        // Award XP every 1000 tiles
        const xpThreshold = 1000;
        const previousTotal = total - count;
        const previousMilestones = Math.floor(previousTotal / xpThreshold);
        const currentMilestones = Math.floor(total / xpThreshold);

        if (currentMilestones > previousMilestones) {
            const xpAward = (currentMilestones - previousMilestones) * 50; // 50 XP per 1000 tiles
            this.eventBus.emit('AwardXp', { amount: xpAward });
            this.eventBus.emit('LogMessage', { message: `Exploration milestone reached! Gained ${xpAward} XP for discovering ${currentMilestones * xpThreshold} tiles.` });
        }
    }
}