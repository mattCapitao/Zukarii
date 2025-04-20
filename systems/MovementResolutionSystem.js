import { System } from '../core/Systems.js';
import {NeedsRenderComponent, } from '../core/Components.js';

export class MovementResolutionSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Position', 'MovementIntent'];
    }

    update(deltaTime) {

        const entities = this.entityManager.getEntitiesWith(this.requiredComponents);

        for (const entity of entities) {

            let entityCanMove = entity.hasComponent('MovementIntent') && entity.hasComponent('Position');
            let blockedBy = '';

            const intent = entity.getComponent('MovementIntent');
            console.log(`MovementResolutionSystem: Processing entity ${entity.id} with intent:`, intent);   

            if (entity.hasComponent('Collision')) {
                console.log(`MovementResolutionSystem: Entity ${entity.id} has Collision component` , entity.getComponent('Collision'));
                const collisionComponent = entity?.getComponent('Collision');
                const collisions = collisionComponent?.collisions;
                console.log(`MovementResolutionSystem: Entity ${entity.id} has collisions:`, collisions);

                if (collisions?.length > 0) {

                    for (const collision of collisions) {
                        const targetEntity = this.entityManager.getEntity(collision.targetId);
                        console.log(`MovementResolutionSystem: Checking collision with target entity ${collision.targetId}`, targetEntity);
                        if (!targetEntity) {
                            console.warn(`MovementResolutionSystem: Target entity ${collision.targetId} not found for ${entity.id}`);
                            continue;
                        }
                        if (!entity.hasComponent('Projectile') && targetEntity.hasComponent('Projectile')) {
                            //Movement is not inhibited by colliding with projectiles 
                            continue;
                        }
                        entityCanMove = false; // Entity is blocked by a collision
                        blockedBy = collision.targetId;
                        break;
                    }
                } else {
                    console.log(`MovementResolutionSystem: No collisionss found for  Entity ${entity.id} having collision component`, collisionComponent);
                    entity.removeComponent('Collision'); // Clear collision component if no collisions
                }
            } 

            if (entityCanMove) {
                // No collisions, move to intended position
                console.log(`MovementResolutionSystem: Moving ${entity.id} to (${intent.targetX}, ${intent.targetY})`);

                const pos = entity.getComponent('Position');
                const lastPos = entity.getComponent('LastPosition');

                lastPos.x = pos.x;
                lastPos.y = pos.y;

                pos.x = intent.targetX;
                pos.y = intent.targetY;

                if (!entity.hasComponent('NeedsRender')) {
                    this.entityManager.addComponentToEntity(entity.id, new NeedsRenderComponent(pos.x, pos.y));
                }


                if (entity.id === 'player') {
                    this.eventBus.emit('PositionChanged', { entityId: 'player', x: pos.x, y: pos.y});
                    console.log(`MovementResolutionSystem: Player moved to (${pos.x}, ${pos.y})`);
                }

            } else {
                console.log(`MovementRsolutionSystem: Entity ${entity.id} blocked by ${blockedBy}`);
            }

            // Remove MovementIntent after processing 
            entity.removeComponent('MovementIntent');
        }
        
    }
}

