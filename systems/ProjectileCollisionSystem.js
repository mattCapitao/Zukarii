import { System } from '../core/Systems.js';
import { RemoveEntityComponent } from '../core/Components.js';
export class ProjectileCollisionSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Projectile', 'Collision'];
        this.sfxQueue = this.entityManager.getEntity('gameState').getComponent('AudioQueue').SFX || []
    }

    update(deltaTime) {
        const projectiles = this.entityManager.getEntitiesWith(this.requiredComponents);

        for (const projectile of projectiles) {
            if (!projectile.hasComponent('Collision') || projectile.hasComponent('RemoveEntity')) continue;
            const collision = projectile.getComponent('Collision');
            const projData = projectile.getComponent('Projectile');
            if (projData.rangeLeft <= 0) continue;
            const source = this.entityManager.getEntity(projData.sourceEntityId);

            for (const collisionData of collision.collisions) {

               const targetId = projectile.id === collisionData.moverId ? collisionData.targetId : collisionData.moverId;
               const target = this.entityManager.getEntity(targetId)

                if (target.hasComponent('Projectile')) {
                    target.sourceEntityId = target.getComponent('Projectile').sourceEntityId; 
                    if (projData.sourceEntityId === target.sourceEntityId) break;
                }

               const isOverlapping = this.isOverlapping(projectile, target);

                console.log(`ProjectileCollisionSystem: ${projectile.id} collided with ${target.id}`);

                if (target.hasComponent('Wall') && isOverlapping) {
                    if (!projectile.hasComponent('RemoveEntity')) {
                        projectile.addComponent(new RemoveEntityComponent());
                    }
                    this.sfxQueue.push({ sfx: 'firehit0', volume: .1 });
                    this.eventBus.emit('LogMessage', { message: 'Your shot hit a wall.' });
                    console.log(`ProjectileCollisionSystem: ${projectile.id} hit wall ${target.id}`);
                    break;
                }

                if ((target.hasComponent('MonsterData') && !target.hasComponent('Dead')) && isOverlapping) {

                    console.log(`ProjectileCollisionSystem: ${projectile.id} hit target ${target.id}`);
                    const weapon = projData.weapon;
                    if (!weapon && source?.hasComponent('PlayerState')) {
                        throw new Error(`Projectile ${projectile.id} from player has no weapon assigned!`);
                    }
                    this.eventBus.emit('CalculateDamage', {
                        attacker: source,
                        target: target,
                        weapon: weapon
                    });

                    this.eventBus.emit('RangedAttackHit', {
                        attacker: source,
                        target: target,
                    }); 

                    // NEW: SFX on hit—no callback needed
                    if (source?.hasComponent('PlayerState')) {
                       
                        this.sfxQueue.push({ sfx: 'firehit0', volume: .1 });
                    }

                    if (!projData.isPiercing && !projectile.hasComponent('RemoveEntity')) {
                        projectile.rangeLeft = 0;
                        projectile.addComponent(new RemoveEntityComponent());
                        break;
                    } else {
                        projectile.rangeLeft -=1
                    }
                }
                
            }

            projectile.removeComponent('Collision');
        }
    }


    isOverlapping(projectile, target) {
        const projectilePos = projectile.getComponent('Position');
        const projectileHitbox = projectile.getComponent('Hitbox');
        if (!projectilePos || !projectileHitbox) return false;

        if (!target) {
            console.warn(`ProjectileCollisionSystem: Target not found in isOverlapping for projectile ${projectile.id}`);
        }

        // Always use Hitbox and Position for area checks
        if (target.hasComponent('Hitbox') && target.hasComponent('Position')) {
            const targetPos = target.getComponent('Position');
            const targetHitbox = target.getComponent('Hitbox');
            const areaLeft = targetPos.x + (targetHitbox.offsetX || 0);
            const areaTop = targetPos.y + (targetHitbox.offsetY || 0);
            const areaRight = areaLeft + targetHitbox.width;
            const areaBottom = areaTop + targetHitbox.height;

            // projectile hitbox bounds
            const projectileLeft = projectilePos.x + (projectileHitbox.offsetX || 0);
            const projectileTop = projectilePos.y + (projectileHitbox.offsetY || 0);
            const projectileRight = projectileLeft + projectileHitbox.width;
            const projectileBottom = projectileTop + projectileHitbox.height;

            // Rectangle overlap check
            return (
                projectileLeft < areaRight &&
                projectileRight > areaLeft &&
                projectileTop < areaBottom &&
                projectileBottom > areaTop
            );
        }
        return false;
    }


}

