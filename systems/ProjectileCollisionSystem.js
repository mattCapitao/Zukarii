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

                console.log(`ProjectileCollisionSystem: ${projectile.id} collided with ${target.id}`);

                if (target.hasComponent('Wall')) {
                    if (!projectile.hasComponent('RemoveEntity')) {
                        projectile.addComponent(new RemoveEntityComponent());
                    }
                    this.sfxQueue.push({ sfx: 'firehit0', volume: .1 });
                    this.eventBus.emit('LogMessage', { message: 'Your shot hit a wall.' });
                    console.log(`ProjectileCollisionSystem: ${projectile.id} hit wall ${target.id}`);
                    continue;
                }

                if ((target.hasComponent('MonsterData') && !target.hasComponent('Dead'))) {

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
                    // NEW: SFX on hit—no callback needed
                    if (source?.hasComponent('PlayerState')) {
                       
                        this.sfxQueue.push({ sfx: 'firehit0', volume: .1 });
                    }

                    if (!projData.isPiercing && !projectile.hasComponent('RemoveEntity')) {
                        projectile.rangeLeft = 0;
                        projectile.addComponent(new RemoveEntityComponent());

                    } else {
                        projectile.rangeLeft -=1
                    }
                }
                
            }

            projectile.removeComponent('Collision');
        }
    }
}

