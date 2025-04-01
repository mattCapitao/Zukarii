// systems/CombatSystem.js
import { System } from '../core/Systems.js';
import { PositionComponent, HealthComponent } from '../core/Components.js';
import { ProjectileComponent } from '../core/Components.js';

export class CombatSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Position', 'Health'];
        this.frameDelay = 3; // Number of frames to wait before moving projectile (e.g., 3 frames ~50ms at 60 FPS)
        this.currentFrame = 0; // Counter for frame delay
    }

    init() {
        this.eventBus.on('MeleeAttack', (data) => this.handleMeleeAttack(data));
        this.eventBus.on('RangedAttack', (data) => this.handleRangedAttack(data));
        this.eventBus.on('MonsterAttack', (data) => this.handleMonsterMeleeAttack(data)); // New listener
    }

    // systems/CombatSystem.js - Updated update method
    update() {
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        if (gameState.gameOver) return; // Stop updating if game is over

        this.currentFrame = (this.currentFrame + 1) % this.frameDelay; // Increment and wrap around
        if (this.currentFrame !== 0) return; // Skip update if not at delay threshold

        const projectiles = this.entityManager.getEntitiesWith(['Position', 'Projectile']);
        projectiles.forEach(proj => {
            //console.log('CombatSystem: Updating projectile', proj.id, 'position:', proj.getComponent('Position'), 'timestamp:', Date.now());
            const pos = proj.getComponent('Position');
            const projData = proj.getComponent('Projectile');
            const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
            const tier = gameState.tier;
            const levelEntity = this.entityManager.getEntitiesWith(['Map', 'Tier']).find(e => e.getComponent('Tier').value === tier);
            if (!levelEntity) return;

            const map = levelEntity.getComponent('Map').map;
            const monsters = this.entityManager.getEntitiesWith(['Position', 'Health', 'MonsterData']);

            if (projData.rangeLeft > 0) {
                let dx = 0, dy = 0;
                switch (projData.direction) {
                    case 'ArrowUp': dy = -1; break;
                    case 'ArrowDown': dy = 1; break;
                    case 'ArrowLeft': dx = -1; break;
                    case 'ArrowRight': dx = 1; break;
                }

                const newX = pos.x + dx;
                const newY = pos.y + dy;

                // Check for boundary and wall collision
                const isOutOfBounds = newX < 0 || newX >= map[0].length || newY < 0 || newY >= map.length;
                const entitiesAtTarget = this.entityManager.getEntitiesWith(['Position']).filter(e => {
                    const ePos = e.getComponent('Position');
                    return ePos.x === newX && ePos.y === newY;
                });
                const hitsWall = entitiesAtTarget.some(e => e.hasComponent('Wall'));
                if (isOutOfBounds || hitsWall) {
                    this.entityManager.removeEntity(proj.id);
                    const sfx = 'firehit0';
                    this.eventBus.emit('PlaySfx', { sfx, volume: .1 }); 
                    this.eventBus.emit('LogMessage', { message: 'Your shot hit a wall.' });
                    this.eventBus.emit('RenderNeeded');
                    return;
                }

                // Check for monster collision
                const target = monsters.find(m => {
                    const mPos = m.getComponent('Position');
                    const mHealth = m.getComponent('Health');
                    return mPos.x === newX && mPos.y === newY && mHealth.hp > 0;
                });

                if (target) {
                    const player = this.entityManager.getEntity('player');
                    const bestRangedWeapon = this.getBestRangedWeapon();
                    const weapon = bestRangedWeapon ? bestRangedWeapon : { baseDamageMin: 1, baseDamageMax: 2, name: 'Fists' };
                    this.eventBus.emit('CalculatePlayerDamage', {
                        attacker: player,
                        target: target,
                        weapon: weapon,
                        callback: ({ damage, isCritical }) => {
                            const targetHealth = target.getComponent('Health');
                            const targetMonsterData = target.getComponent('MonsterData');
                            targetMonsterData.isAggro = true; // Aggro on player
                            targetHealth.hp = Math.max(0, targetHealth.hp - damage);

                            const health = target.getComponent('Health');
                            const hpBarWidth = Math.floor((health.hp / health.maxHp) * 16);
                            const monsterData = target.getComponent('MonsterData');
                            monsterData.hpBarWidth = hpBarWidth;
                            ////console.log(`Monster HP Bar Width: ${monsterData.hpBarWidth}`, target);
                            const sfx = 'firehit0';
                            this.eventBus.emit('PlaySfx', { sfx, volume: .1 }); 
                            this.eventBus.emit('LogMessage', {
                                message: `${isCritical ? ' (Critical Hit!) - ' : ''}You dealt ${damage} damage to ${targetMonsterData.name} with your ${weapon.name} (${targetHealth.hp}/${targetHealth.maxHp})`
                            });

                            if (targetHealth.hp <= 0) {
                                this.eventBus.emit('MonsterDied', { entityId: target.id });
                            }
                        }
                    });
                    const isPiercingProjectile = false;

                    if (!isPiercingProjectile) {
                        projData.rangeLeft = 0; // Stop projectile
                        this.entityManager.removeEntity(proj.id);
                        this.eventBus.emit('RenderNeeded');
                    }
                    // continue moving projectile if piercing
                }

                // Move projectile
                pos.x = newX;
                pos.y = newY;
                projData.rangeLeft--;
                //console.log('CombatSystem: Projectile moved', proj.id, 'new position:', { x: newX, y: newY }, 'rangeLeft:', projData.rangeLeft, 'timestamp:', Date.now());

                this.eventBus.emit('PositionChanged', { entityId: proj.id, x: newX, y: newY });
                this.eventBus.emit('RenderNeeded');
            } else {
                this.entityManager.removeEntity(proj.id);
                this.eventBus.emit('RenderNeeded');
            }
        });
    }

    combatSfx(type) {

        //console.log('CombatSystem: combatSfx called with :', type);
        const hitFileCount = 27;
        const missFileCount = 9;
        const blockFileCount = 9;

        let sfx = '';

        switch (type) {
            case 'hit':
                sfx = `${type}${Math.floor(Math.random() * hitFileCount)}`;
                break;
            case 'miss':
                sfx = `${type}${Math.floor(Math.random() * missFileCount)}`;
                break;
            case 'block':
                sfx = `${type}${Math.floor(Math.random() * blockFileCount)}`;
                break;
            default:
                //console.log('CombatSystem: Invalid combat sfx type:', type);
                return
        }
        //console.log('CombatSystem: Playing combat sfx:', sfx);
        this.eventBus.emit('PlaySfx', {sfx, volume: .1});
    }

    getBestRangedWeapon() {
        const player = this.entityManager.getEntity('player');
        const playerInventory = player.getComponent('Inventory');
        const mainWeapon = playerInventory.equipped.mainhand;
        const offWeapon = playerInventory.equipped.offhand
        const rangedWeapons = [];

        if (mainWeapon?.attackType === 'ranged') rangedWeapons.push(mainWeapon);
        if (offWeapon?.attackType === 'ranged') rangedWeapons.push(offWeapon);
        if (rangedWeapons.length === 0) {
            return null;
        }
            return rangedWeapons.reduce((best, current) => {
                const bestMean = (best.baseDamageMin + best.baseDamageMax) * 0.5;
                const currentMean = (current.baseDamageMin + current.baseDamageMax) * 0.5;
                const selectedWeapon = currentMean > bestMean ? current : best;
                return selectedWeapon;
            }, rangedWeapons[0]);
    }

    handleMonsterMeleeAttack({ entityId }) {
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        if (gameState.gameOver) return; // Stop if game is over

        const monster = this.entityManager.getEntity(entityId);
        const player = this.entityManager.getEntity('player');
        if (!monster || !player) return;

        const monsterData = monster.getComponent('MonsterData');
        if (!monsterData.isAggro) return;

        this.eventBus.emit('PlayerWasHit', { entityId: 'player' });

        const playerStats = player.getComponent('Stats');
        const playerHealth = player.getComponent('Health');

        const dodgeRoll = Math.round(Math.random() * 100 + playerStats.agility / 2 - (monsterData.luck || 0) / 2);
        if (dodgeRoll >= 85) {
            this.eventBus.emit('LogMessage', { message: `You dodged the ${monsterData.name}'s attack!` });
            //console.log("player dodged the attack"); 
            this.combatSfx('miss');
            return;
        }

        const blockRoll = Math.round(Math.random() * 100 + playerStats.block / 2 - (monsterData.luck || 0) / 2);
        if (blockRoll >= 85) {
            this.eventBus.emit('LogMessage', { message: `You blocked the ${monsterData.name}'s attack!` });
            //console.log("player blocked the attack");
            this.combatSfx('block');
            return;
        }
        //console.log("player was hit by the attack");
        this.combatSfx('hit');

        this.eventBus.emit('CalculateMonsterDamage', {
            attacker: monster,
            target: player,
            callback: ({ attackDmg, damage, isCritical, armorReduction, defenseReduction }) => {
                playerHealth.hp = Math.max(0, playerHealth.hp - damage); // Clamp to 0
                this.eventBus.emit('LogMessage', {
                    message: `${isCritical ? ' (Critical Hit!) - ' : ''}${monsterData.name} hits for ${attackDmg}, armor protects you from: ${armorReduction}, defense skill mitigates: ${defenseReduction} resulting in ${damage} damage dealt to you (${playerHealth.hp}/${playerHealth.maxHp})`
                });
                this.eventBus.emit('StatsUpdated', { entityId: 'player' });

                if (playerHealth.hp <= 0) {
                    this.eventBus.emit('PlayerDeath', { source: monsterData.name });
                }
            }
        });
    }

    handleMeleeAttack({ targetEntityId }) {
        const player = this.entityManager.getEntity('player');
        const target = this.entityManager.getEntity(targetEntityId);
        if (!player || !target) return;
        this.eventBus.emit('PlayerInitiatedAttack', { entityId: 'player' });

        const playerStats = player.getComponent('Stats');
        const playerInventory = player.getComponent('Inventory');
        const targetHealth = target.getComponent('Health');
        const targetMonsterData = target.getComponent('MonsterData');

        // Get all melee weapons from equipped slots
        const meleeWeapons = [];
        const mainhand = playerInventory.equipped.mainhand;
        const offhand = playerInventory.equipped.offhand;
        if (mainhand?.attackType === 'melee') meleeWeapons.push(mainhand);
        if (offhand?.attackType === 'melee') meleeWeapons.push(offhand);
        if (meleeWeapons.length === 0) meleeWeapons.push({ baseDamageMin: 0.5, baseDamageMax: 1, name: 'Fists', attackType: 'melee' });

        const isDualWield = meleeWeapons.length === 2;

        // Process each weapon swing
        meleeWeapons.forEach((weapon, index) => {
            if (targetHealth.hp <= 0) return; // Stop if monster dies

            // Miss chance: 15% mainhand, 25% offhand when dual-wielding
            const missChance = isDualWield ? (index === 0 ? 15 : 25) : 0;
            if (Math.random() * 100 < missChance) {
                this.eventBus.emit('LogMessage', { message: `Your ${weapon.name} missed the ${targetMonsterData.name}!` });
                this.combatSfx('miss');
                //console.log("player missed the attack");
                return;
            }

            // Dodge/block: 1% flat chance each
            const dodgeRoll = Math.random() * 100;
            if (dodgeRoll >= 99) {
                this.eventBus.emit('LogMessage', { message: `${targetMonsterData.name} dodged your ${weapon.name} attack!` });
                //console.log("monster dodged the attack");
                this.combatSfx('miss');
                return;
            }

            const blockRoll = Math.random() * 100;
            if (blockRoll >= 99) {
                this.eventBus.emit('LogMessage', { message: `${targetMonsterData.name} blocked your ${weapon.name} attack!` });
                //console.log("monster blocked the attack");
                this.combatSfx('block');
                return;
            }
            //console.log("monster was hit by the attack");
            this.combatSfx('hit');
            this.eventBus.emit('CalculatePlayerDamage', {
                attacker: player,
                target: target,
                weapon: weapon,
                callback: ({ damage, isCritical }) => {
                    targetHealth.hp = Math.max(0, targetHealth.hp - damage); // Clamp to 0

                    // set the wdith of the hp bar to a % of health left
                    const health = target.getComponent('Health');
                    const hpBarWidth = Math.floor((health.hp / health.maxHp) * 16);
                    const monsterData = target.getComponent('MonsterData');
                    monsterData.hpBarWidth = hpBarWidth;
                    //console.log(`Monster HP Bar Width: ${monsterData.hpBarWidth}`, target );

                    this.eventBus.emit('LogMessage', {
                        message: `${isCritical ? ' (Critical Hit!) - ' : ''}You dealt ${damage} damage to ${targetMonsterData.name} with your ${weapon.name} (${targetHealth.hp}/${targetHealth.maxHp})`
                    });

                    if (targetHealth.hp <= 0) {
                        this.eventBus.emit('MonsterDied', { entityId: targetEntityId });
                    }
                    this.eventBus.emit('RenderNeeded');
                }
            });
        });
    }

    handleRangedAttack({ direction }) {
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        //console.log('CombatSystem.handleRangedAttack(): Ranged attack:', direction, "Game State: ", gameState);
        const player = this.entityManager.getEntity('player');
        if (!player) return;
       
        this.eventBus.emit('PlayerInitiatedAttack', { entityId: 'player' });
        //this.eventBus.emit('LogMessage', { message: `Initiated Ranged attack!` });

        const playerPos = player.getComponent('Position');
        const stats = player.getComponent('Stats');
        const weapon = this.getBestRangedWeapon();
        const range = stats.range || weapon.baseRange || 3;
        ////console.log('CombatSystem.handleRangedAttack(): Ranged attack - player range stat:', stats.range, ' weapon baseRange:', weapon.baseRange, 'calculated range:', range);

        // Start at player's position, no offset
        let startX = playerPos.x;
        let startY = playerPos.y;

        const projectile = this.entityManager.createEntity(`projectile_${Date.now()}`);
        this.entityManager.addComponentToEntity(projectile.id, new PositionComponent(startX, startY));
        this.entityManager.addComponentToEntity(projectile.id, new ProjectileComponent(direction, range));
        this.eventBus.emit('RenderNeeded');
    }

    
}