import { System } from '../core/Systems.js';
import { MovementIntentComponent,RemoveEntityComponent} from '../core/Components.js';

export class ProjectileSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Projectile', 'Position', 'LastPosition', 'MovementSpeed'];
    }

    update(deltaTime) {
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        if (gameState?.gameOver) return;

        const projectiles = this.entityManager.getEntitiesWith(this.requiredComponents);
        for (const projectile of projectiles) {

            const projData = projectile.getComponent('Projectile')

            const tier = gameState.tier;
            const levelEntity = this.entityManager.getEntitiesWith(['Map', 'Tier']).find(e => e.getComponent('Tier').value === tier);
            if (!levelEntity) {
                console.warn(`ProjectileSystem: No level entity found for tier ${tier}, skipping projectile ${projectile.id}`);
                continue;
            }

            const moveSpeedComp = projectile.getComponent('MovementSpeed');
            moveSpeedComp.elapsedSinceLastMove += deltaTime * 1000;
            if (moveSpeedComp.elapsedSinceLastMove < moveSpeedComp.movementSpeed) {
                continue;
            }

            const pos = projectile.getComponent('Position');
            const map = levelEntity.getComponent('Map').map;

            if (projData.rangeLeft >= 0) {
                let dx = 0, dy = 0;
                switch (projData.direction) {
                    case 'ArrowUp': dy = -1; break;
                    case 'ArrowDown': dy = 1; break;
                    case 'ArrowLeft': dx = -1; break;
                    case 'ArrowRight': dx = 1; break;
                }

                const newX = pos.x + dx;
                const newY = pos.y + dy;

                const isOutOfBounds = newX < 0 || newX >= map[0].length || newY < 0 || newY >= map.length;

                
                /* moved to MovementResolutionSystem to prevent lastpos update when movement is blocked
                const lastPos = projectile.getComponent('LastPosition');
                lastPos.x = pos.x;
                lastPos.y = pos.y;
                */
                projData.rangeLeft--;

                if (isOutOfBounds || projData.rangeLeft <= 0) {
                    if (!projectile.hasComponent('RemoveEntity')) {
                        projectile.addComponent(new RemoveEntityComponent());
                    }
                    console.log(`ProjectileSystem: ${projectile.id} is out of bounds (${newX}, ${newY})`);
                    continue;
                }

                this.entityManager.addComponentToEntity(projectile.id, new MovementIntentComponent(newX, newY));

                //pos.x = newX;
                //pos.y = newY;
                
                moveSpeedComp.elapsedSinceLastMove -= moveSpeedComp.movementSpeed;

            } else {
                console.log(`ProjectileSystem: ${projectile.id} has reached its range limit`);
                if (!projectile.hasComponent('RemoveEntity')) {
                    projectile.addComponent(new RemoveEntityComponent());
                }
            }
        }
    }
}