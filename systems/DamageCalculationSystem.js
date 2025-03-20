// systems/DamageCalculationSystem.js
import { System } from '../core/Systems.js';

export class DamageCalculationSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = [];
    }

    init() {
        this.eventBus.on('CalculatePlayerDamage', ({ attacker, target, weapon, callback }) => {
            const result = this.calculatePlayerToMonsterDamage({ attacker, target, weapon });
            callback(result);
        });

        this.eventBus.on('CalculateMonsterDamage', ({ attacker, target, callback }) => {
            const result = this.calculateMonsterToPlayerDamage({ attacker, target });
            callback(result);
        });
    }

    calculatePlayerToMonsterDamage({ attacker, target, weapon }) {
        const attackerStats = attacker.getComponent('Stats');
        const level = attacker.getComponent('PlayerState').level;

        const baseDamageMin = weapon?.baseDamageMin || 1;
        const baseDamageMax = weapon?.baseDamageMax || 2;
        const prowess = attackerStats.prowess || 0;
        const intellect = attackerStats.intellect || 0;
        const damageBonus = attackerStats.damageBonus || 0; // All attacks
        const meleeDamageBonus = attackerStats.meleeDamageBonus || 0;
        const rangedDamageBonus = attackerStats.rangedDamageBonus || 0;
        const agility = attackerStats.agility || 0;

        const isRanged = weapon?.attackType === 'ranged';
        const statBonus = isRanged ? intellect + rangedDamageBonus : prowess + meleeDamageBonus;
        const baseStat = isRanged ? intellect : prowess;

        // Base damage: roll + level
        const baseRoll = Math.floor(Math.random() * (baseDamageMax - baseDamageMin + 1)) + baseDamageMin;
        const baseDamage = baseRoll + level;

        // Apply bonuses and stat multiplier
        const preCritDamage = (baseDamage + damageBonus + statBonus) * (1 + baseStat * 0.02);

        // Crit check: agility * 0.01, 1.5x multiplier
        const critChance = agility * 0.01;
        const critRoll = Math.random();
        const isCritical = critRoll < critChance;
        const totalDamage = Math.round(isCritical ? preCritDamage * 1.5 : preCritDamage);

        return { damage: totalDamage, isCritical };
    }

    calculateMonsterToPlayerDamage({ attacker, target }) {
        const monsterData = attacker.getComponent('MonsterData');
        const targetStats = target.getComponent('Stats');
        const tier = this.entityManager.getEntity('gameState').getComponent('GameState').tier;
        const tierDamageMultiplier = 0.05;
        const armorReductionFactor = 0.15;
        const defenseReductionFactor = 0.10;

        const baseDamageMin = monsterData.minBaseDamage || 1;
        const baseDamageMax = monsterData.maxBaseDamage || 2;
        const baseDamage = Math.round(Math.random() * (baseDamageMax - baseDamageMin)) + baseDamageMin;
        const scaledDamage = Math.round(baseDamage * (1 + tier * tierDamageMultiplier));

        const critThreshold = 99;
        const critMultiplier = 1.1;
        const critRoll = Math.random() * 100;
        const isCritical = critRoll >= critThreshold;
        const preReductionDamage = isCritical ? Math.round(scaledDamage * critMultiplier) : scaledDamage;

        const armor = targetStats.armor || 0;
        const armorReduction = armor > 0 ? Math.max(1, Math.floor(preReductionDamage * (armorReductionFactor * armor))) : 0;
        const defenseReduction = Math.round(preReductionDamage * (defenseReductionFactor * (targetStats.defense || 0)));
        const totalDamage = Math.round(Math.max(0, preReductionDamage - armorReduction - defenseReduction));

        return {
            damage: totalDamage,
            isCritical,
            armorReduction,
            defenseReduction
        };
    }
}

