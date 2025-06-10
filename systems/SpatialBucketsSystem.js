import { System } from '../core/Systems.js';
import { SpatialBucketsComponent } from '../core/Components.js';

export class SpatialBucketsSystem extends System {
    constructor(entityManager, eventBus, state) {
        super(entityManager, eventBus);
        this.state = state;
        this.requiredComponents = ['Position', 'Visuals'];
        this.TILE_SIZE = this.state.TILE_SIZE || 32;
        this.BUCKET_SIZE = 16; // Matches existing bucket size (16 tiles)
        this.invTileBucket = 1 / (this.TILE_SIZE * this.BUCKET_SIZE);
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

        // Black box optimization: clear arrays in place instead of clearing the map
        for (const arr of bucketsComp.buckets.values()) arr.length = 0;

        // Find all entities with Position and Visuals components
        const entities = this.entityManager.getEntitiesWith(['Position', 'Visuals']);
        const invTileBucket = this.invTileBucket;

        for (let i = 0; i < entities.length; i++) {
            const entity = entities[i];
            const pos = entity.getComponent('Position');
            const bucketX = Math.floor(pos.x * invTileBucket);
            const bucketY = Math.floor(pos.y * invTileBucket);
            const bucketKey = `${bucketX},${bucketY}`;
            let arr = bucketsComp.buckets.get(bucketKey);
            if (!arr) {
                arr = [];
                bucketsComp.buckets.set(bucketKey, arr);
            }
            arr.push(entity.id);
        }
    }
}

