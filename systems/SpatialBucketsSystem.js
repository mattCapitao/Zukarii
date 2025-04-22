import { System } from '../core/Systems.js';
import { SpatialBucketsComponent } from '../core/Components.js';

export class SpatialBucketsSystem extends System {
    constructor(entityManager, eventBus, state) {
        super(entityManager, eventBus);
        this.state = state;
        this.requiredComponents = ['Position', 'Visuals'];
        this.TILE_SIZE = this.state.TILE_SIZE || 32;
        this.BUCKET_SIZE = 16; // Matches existing bucket size (16 tiles)
    }

    init() {
        // Listen for tier changes to ensure we manage the correct level's buckets
        this.eventBus.on('LevelAdded', ({ tier }) => {
            this.entityManager.setActiveTier(tier);
            console.log(`SpatialBucketSystem: Active tier set to ${tier}`);
        });
    }

    update() {
        const activeTier = this.entityManager.getActiveTier();
        const levelEntity = this.entityManager.getEntitiesWith(['Tier']).find(e => e.getComponent('Tier').value === activeTier);
        if (!levelEntity) {
            console.warn(`SpatialBucketSystem: No level entity found for active tier ${activeTier}`);
            return;
        }

        const bucketsComp = levelEntity.getComponent('SpatialBuckets');
        if (!bucketsComp) {
            console.warn(`SpatialBucketSystem: SpatialBucketsComponent missing for level ${levelEntity.id}`);
            return;
        }

        // Clear existing buckets to avoid duplicates
        bucketsComp.buckets.clear();

        // Find all entities with Position and Visuals components
        const entities = this.entityManager.getEntitiesWith(['Position', 'Visuals']);
        for (const entity of entities) {
            const pos = entity.getComponent('Position');
            const bucketX = Math.floor(pos.x / this.TILE_SIZE / this.BUCKET_SIZE);
            const bucketY = Math.floor(pos.y / this.TILE_SIZE / this.BUCKET_SIZE);
            const bucketKey = `${bucketX},${bucketY}`;
            if (!bucketsComp.buckets.has(bucketKey)) {
                bucketsComp.buckets.set(bucketKey, []);
            }
            bucketsComp.buckets.get(bucketKey).push(entity.id);
            //console.log(`SpatialBucketSystem: Added ${entity.id} to bucket (${bucketX},${bucketY}) on tier ${activeTier}`);
        }
    }
}