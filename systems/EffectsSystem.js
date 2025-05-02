// systems/EffectsSystem.js
import { System } from '../core/Systems.js';
import { ResourceComponent } from '../core/Components.js';

export class EffectsSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = [];
        this.healthUpdates = this.entityManager.getEntity('gameState').getComponent('DataProcessQueues').HealthUpdates;
    }

    init() {

        console.log('EffectsSystem.init: this.entityManager:', this.entityManager);

        this.eventBus.on('applyEffect', ({ entityId, effect, params, context }) => {

            console.log('EffectsSystem.applyEffect: this:', this, 'entityManager:', this.entityManager);
            console.log(`EffectsSystem: Received applyEffect for ${entityId} with effect: ${effect}`);


            const handlers = {
                stealGold: this.stealGold.bind(this),
                instantHeal: this.instantHeal.bind(this),
                lifeSteal: this.lifeSteal.bind(this)
            };
            const handler = handlers[effect];
            if (handler) {
                handler(entityId, params, context);
            } else {
                console.warn(`EffectsSystem: No handler for effect ${effect} on ${entityId}`);
            }
        });
        console.log('EffectsSystem: Initialized and listening for applyEffect events');
    }

    update() {
        // No per-frame logic needed yet—event-driven for now
    }

    // NEW: Moved from AffixSystem - stealGold effect
    stealGold(entityId, params, context) {
        console.log('EffectsSystem.stealGold: this.entityManager:', this.entityManager);
        const attacker = this.entityManager.getEntity(entityId);
        const targetId = context.targetId;
        const target = this.entityManager.getEntity(targetId);
        if (!attacker || !target) {
            console.warn(`EffectsSystem: Attacker ${entityId} or target ${targetId} not found for stealGold`);
            return;
        }

        console.log(`EffectsSystem: Attempting stealGold on ${target.id} by ${attacker.id}`);
        const STEAL_PERCENTAGE = params?.stealPercentage || 0.1;
        const MIN_STEAL = params?.minSteal || 1;

        const resource = target.getComponent('Resource');
        if (!resource) {
            console.warn(`EffectsSystem: Target ${target.id} has no Resource component for stealGold`);
            return;
        }

        const monsterData = attacker.getComponent('MonsterData');
        const attackerName = monsterData ? monsterData.name : 'Unknown';

        const goldBefore = resource.gold;
        const stolenGold = Math.floor(goldBefore * STEAL_PERCENTAGE) + MIN_STEAL;
        resource.gold = Math.max(0, goldBefore - stolenGold);

        if (goldBefore > 0) {
            this.eventBus.emit('LogMessage', {
                message: `${attackerName}'s Greedy Claw attack has stolen ${stolenGold} gold from you!`
            });
            if (resource.gold === 0) {
                this.eventBus.emit('LogMessage', {
                    message: `ALL YOUR GOLD ARE BELONG TO ${attackerName}`
                });
            }
        } else {
            this.eventBus.emit('LogMessage', {
                message: `${attackerName} tried to steal gold, but you have none left!`
            });
        }

        console.log(`EffectsSystem: ${attackerName} stole ${stolenGold} gold from ${target.id}. Gold now: ${resource.gold}`);
    }

    // NEW: Moved from AffixSystem - instantHeal effect
    instantHeal(entityId, params, context) {
        console.log('EffectsSystem.instantHeal: this.entityManager:', this.entityManager);
        const entity = this.entityManager.getEntity(entityId);
        if (!entity) {
            console.warn(`EffectsSystem: Entity ${entityId} not found for instantHeal`);
            return;
        }

        console.log(`EffectsSystem: Attempting instantHeal on ${entity.id}`);
        const CHANCE_TO_HEAL = params?.chanceToHeal || 0.05;
        const MIN_HEAL_PERCENTAGE = params?.minHealPercentage || 0.05;
        const MAX_HEAL_PERCENTAGE = params?.maxHealPercentage || 0.10;

        if (Math.random() >= CHANCE_TO_HEAL) {
            console.log(`EffectsSystem: Heal chance failed for ${entity.id}`);
            return;
        }

        const health = entity.getComponent('Health');
        if (!health) {
            console.warn(`EffectsSystem: Entity ${entity.id} has no Health component for instantHeal`);
            return;
        }

        const missingHp = health.maxHp - health.hp;
        const healPercentage = Math.random() * (MAX_HEAL_PERCENTAGE - MIN_HEAL_PERCENTAGE) + MIN_HEAL_PERCENTAGE;
        const healAmount = Math.round(missingHp * healPercentage);

        //health.hp = Math.min(health.hp + healAmount, health.maxHp);
        this.healthUpdates.push({ entityId, amount: healAmount });
    
        this.eventBus.emit('LogMessage', {
            message: `Resilience heals you for ${healAmount} HP! (${health.hp}/${health.maxHp})`
        });
        console.log(`EffectsSystem: Healed ${entity.id} for ${healAmount} HP. Now: ${health.hp}/${health.maxHp}`);
    }

    // NEW: Moved from AffixSystem - lifeSteal effect
    lifeSteal(entityId, params, context) {
        console.log('EffectsSystem.lifeSteal: this.entityManager:', this.entityManager);
        const entity = this.entityManager.getEntity(entityId);
        if (!entity) {
            console.warn(`EffectsSystem: Entity ${entityId} not found for lifeSteal`);
            return;
        }

        console.log(`EffectsSystem: Attempting lifeSteal on ${entity.id}`);
        const CHANCE_TO_STEAL_LIFE = params?.chanceToStealLife || 0.05;
        const MIN_DAMAGE_HEALED_PERCENTAGE = params?.minDamageHealedPercentage || 0.10;
        const MAX_DAMAGE_HEALED_PERCENTAGE = params?.maxDamageHealedPercentage || 0.25;

        if (Math.random() >= CHANCE_TO_STEAL_LIFE) {
            console.log(`EffectsSystem: Life steal chance failed for ${entity.id}`);
            return;
        }

        const targetId = context.targetId;
        const target = this.entityManager.getEntity(targetId);
        if (!target) {
            console.warn(`EffectsSystem: Target ${targetId} not found for lifeSteal`);
            return;
        }

        const health = entity.getComponent('Health');
        if (!health) {
            console.warn(`EffectsSystem: Entity ${entity.id} has no Health component for lifeSteal`);
            return;
        }

        const damageDealt = context.damageDealt || 0;
        if (damageDealt <= 0) {
            console.warn(`EffectsSystem: No damage dealt provided for lifeSteal on ${entity.id}`);
            return;
        }

        const healPercentage = Math.random() * (MAX_DAMAGE_HEALED_PERCENTAGE - MIN_DAMAGE_HEALED_PERCENTAGE) + MIN_DAMAGE_HEALED_PERCENTAGE;
        const healAmount = Math.round(damageDealt * healPercentage);



        this.eventBus.emit('LogMessage', {
            message: `Life Steal heals you for ${healAmount} HP from damage dealt! (${health.hp}/${health.maxHp})`
        });
        console.log(`EffectsSystem: ${entity.id} stole ${healAmount} HP from ${targetId}. Now: ${health.hp}/${health.maxHp}`);
    }


    reflectDamage(entityId, params, context) {
        console.log('EffectsSystem.reflectDamage: this.entityManager:', this.entityManager);
        const entity = this.entityManager.getEntity(entityId);
        if (!entity) {
            console.warn(`EffectsSystem: Entity ${entityId} not found for reflectDamage`);
            return;
        }

        console.log(`EffectsSystem: Attempting reflectDamage on ${entity.id}`);
        const CHANCE_TO_REFLECT = params?.chanceToReflect || 0.10;
        const MIN_REFLECT_PERCENTAGE = params?.minReflectPercentage || 0.50;
        const MAX_REFLECT_PERCENTAGE = params?.maxReflectPercentage || 1;
        const DAMAGE = context.damageDealt || 0;
        const TARGET_ID = context.attackerId || null;

        if (Math.random() >= CHANCE_TO_REFLECT) {
            console.log(`EffectsSystem: Reflect chance failed for ${entity.id}`);
            return;
        }
        const reflectAmount = Math.round(DAMAGE * (Math.random() * (MAX_REFLECT_PERCENTAGE - MIN_REFLECT_PERCENTAGE) + MIN_REFLECT_PERCENTAGE));

        //health.hp = Math.min(health.hp + healAmount, health.maxHp);
        this.healthUpdates.push({ entityId, amount: DAMAGE });
        this.healthUpdates.push({ TARGET_ID, amount: -reflectAmount });

        this.eventBus.emit('LogMessage', {
            message: `Reflect Damage hits your attacker for ${reflectAmount} HP! `
        });
        console.log(`EffectsSystem: Reflect Damage hits your attacker for ${entity.id} for ${reflectAmount} HP. `);
    }
}