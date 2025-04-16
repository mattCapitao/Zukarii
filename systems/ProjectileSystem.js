import { System } from '../core/Systems.js';
import { PositionComponent, ProjectileComponent, MovementSpeedComponent, NeedsRenderComponent } from '../core/Components.js';

export class ProjectileSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Projectile', 'Position', 'LastPosition', 'MovementSpeed'];
        this.sfxQueue = this.entityManager.getEntity('gameState').getComponent('SfxQueue').Sounds || []
    }

    update(deltaTime) {
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        if (gameState?.gameOver) return;

        const projectiles = this.entityManager.getEntitiesWith(this.requiredComponents);
        for (const proj of projectiles) {

            const projData = proj.getComponent('Projectile');
            if (projData.removeAfterRender && projData.finalRenderApplied) {
                this.entityManager.removeEntity(proj.id);
                continue;
            }
            
            const tier = gameState.tier;
            const levelEntity = this.entityManager.getEntitiesWith(['Map', 'Tier']).find(e => e.getComponent('Tier').value === tier);
            if (!levelEntity) {
                console.warn(`ProjectileSystem: No level entity found for tier ${tier}, skipping projectile ${proj.id}`);
                continue;
            }

            const moveSpeedComp = proj.getComponent('MovementSpeed');
            moveSpeedComp.elapsedSinceLastMove += deltaTime * 1000;
            if (moveSpeedComp.elapsedSinceLastMove < moveSpeedComp.movementSpeed) {
                continue;
            }

            const pos = proj.getComponent('Position');
            const map = levelEntity.getComponent('Map').map;
            const source = this.entityManager.getEntity(projData.sourceEntityId);
            const targetFilter = source?.hasComponent('PlayerState')
                ? ['Position', 'Health', 'MonsterData']
                : ['Position', 'Health', 'PlayerState'];
            const targets = this.entityManager.getEntitiesWith(targetFilter);

            

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

                const isOutOfBounds = newX < 0 || newX >= map[0].length || newY < 0 || newY >= map.length;
                const entitiesAtTarget = this.entityManager.getEntitiesWith(['Position']).filter(e => {
                    const ePos = e.getComponent('Position');
                    return ePos.x === newX && ePos.y === newY;
                });

                const hitsWall = entitiesAtTarget.some(e => e.hasComponent('Wall'));
                if (isOutOfBounds || hitsWall) {
                    projData.removeAfterRender = true;
                    this.sfxQueue.push({ sfx: 'firehit0', volume: .1 });
                    this.eventBus.emit('LogMessage', { message: 'Your shot hit a wall.' });
                    continue;
                }

                const target = targets.find(m => {
                    const mPos = m.getComponent('Position');
                    return mPos.x === newX && mPos.y === newY && !m.hasComponent('Dead');
                });

                if (target) {
                    console.log(`ProjectileSystem: ${proj.id} hit target ${target.id} at (${newX}, ${newY})`);
                    const weapon = projData.weapon;
                    if (!weapon && source?.hasComponent('PlayerState')) {
                        throw new Error(`Projectile ${proj.id} from player has no weapon assigned!`);
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

                    if (!projData.isPiercing) {
                        projData.removeAfterRender = true;
                        continue;
                    }
                }

                const lastPos = proj.getComponent('LastPosition');
                lastPos.x = pos.x;
                lastPos.y = pos.y;

                pos.x = newX;
                pos.y = newY;
                projData.rangeLeft--;
                moveSpeedComp.elapsedSinceLastMove -= moveSpeedComp.movementSpeed;

            } else {
                projData.removeAfterRender = true;
            }
        }
    }
}