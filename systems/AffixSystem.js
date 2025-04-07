// systems/AffixSystem.js
import { System } from '../core/Systems.js';

export class AffixSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = [];
    }

    init() {
        this.eventBus.on('PlayerWasHit', ({ entityId, attackerId }) => {
            console.log(`AffixSystem: Received PlayerWasHit for ${entityId} from ${attackerId}`);
            this.handleAffixes(attackerId, 'attackHitTarget', { targetId: entityId });
            this.handleAffixes(entityId, 'hitByAttack', { attackerId });
        });
        this.eventBus.on('MonsterWasHit', ({ entityId, attackerId, damageDealt }) => {
            console.log(`AffixSystem: Received MonsterWasHit for ${entityId} from ${attackerId} with damageDealt: ${damageDealt}`);
            this.handleAffixes(attackerId, 'attackHitTarget', { targetId: entityId, damageDealt });
            this.handleAffixes(entityId, 'hitByAttack', { attackerId });
        });
        console.log('AffixSystem: Initialized and listening for events');
    }

    update() {
        // No per-frame logic needed—event-driven
    }

    // CHANGED: Updated to dispatch 'applyEffect' instead of running effects directly
    handleAffixes(entityId, trigger, context = {}) {
        const entity = this.entityManager.getEntity(entityId);
        console.log(`AffixSystem: handleAffixes called for entity ${entityId}, trigger: ${trigger}, context:`, context, entity);
        if (!entity) {
            console.warn(`AffixSystem: Entity ${entityId} not found`);
            return;
        }

        console.log(`AffixSystem: Processing affixes for entity ${entityId}, components:`, Array.from(entity.components.keys()));

        const affixComponent = entity.getComponent('Affix');
       

        if (!affixComponent || !affixComponent.affixes) {
            console.log(`AffixSystem: No Affix component found for ${entityId}`);
            return;
        }

        console.log(`AffixSystem: Affix component for ${entityId}:`, affixComponent);

        const matchingAffixes = affixComponent.affixes.filter(affix => affix.trigger === trigger);
        if (matchingAffixes.length === 0) {
            console.log(`AffixSystem: No matching affixes found for ${entityId} with trigger ${trigger}`);
            return;
        }

        console.log(`AffixSystem: Found affixes for ${entityId}:`, matchingAffixes);

        matchingAffixes.forEach(affix => {
            this.eventBus.emit('applyEffect', {
                entityId,
                effect: affix.effect,
                params: affix.params,
                context
            });
        });
    }
}