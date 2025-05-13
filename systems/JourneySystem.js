import { System } from '../core/Systems.js';
import { JourneyStateComponent, JourneyPathComponent } from '../core/Components.js';

export class JourneySystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus);
        this.requiredComponents = ['JourneyState'];
        this.utilities = utilities;
    }

    init() {
        // Initialize the pathTree cache based on existing paths in the player's JourneyPathComponent
        this.updatePathTree();
    }

    update(deltaTime) {
        const player = this.entityManager.getEntity('player');
        if (!player) {
            console.error('JourneySystem: Player entity not found');
            return; 
        }

        const journeyState = player.getComponent('JourneyState');
        if (!journeyState) {
            console.error('JourneySystem: JourneyState component not found on player');
            return;
        }

        const journeyPath = player.getComponent('JourneyPath');
        if (!journeyPath) {
            console.error('JourneySystem: JourneyPath component not found on player');
            return;
        }

        // Get all active paths from the JourneyPathComponent
        const activePaths = journeyPath.paths;

        // Update pathTree if the paths have changed
        this.updatePathTree();

        // Process each active path
        activePaths.forEach(path => {
            // Skip Master Paths (they are never completed)
            if (path.id === path.parentId) {
                return;
            }

            // Skip already completed paths (though they should have been removed)
            if (path.completed) {
                return;
            }

            // Evaluate completion conditions for leaf paths
            if (path.completionCondition) {
                this.evaluateCompletionCondition(path, journeyState);
            }

            // Check completion for parent paths (all children must be completed)
            if (!path.completionCondition) {
                this.checkParentCompletion(path, journeyState);
            }
        });
    }

    updatePathTree() {
        const player = this.entityManager.getEntity('player');
        const journeyState = player.getComponent('JourneyState');
        const journeyPath = player.getComponent('JourneyPath');
        if (!player || !journeyState || !journeyPath) {
            console.error('JourneySystem: Player, JourneyState, or JourneyPath not found');
            return;
        }

        // Get all paths from the JourneyPathComponent
        const activePaths = journeyPath.paths;

        // *** CHANGE START: Add detailed logging ***
        /*console.log('JourneySystem: Active Paths before building pathTree:', activePaths.map(p => ({
            id: p.id,
            parentId: p.parentId,
            completionCondition: p.completionCondition,
            completed: p.completed
        })));
        */
        // *** CHANGE END ***

        // Rebuild the pathTree
        journeyState.pathTree.clear();
        activePaths.forEach(path => {
            const parentId = path.parentId;
            if (!journeyState.pathTree.has(parentId)) {
                journeyState.pathTree.set(parentId, []);
            }
            journeyState.pathTree.get(parentId).push(path);
        });

      //  console.log('JourneySystem: Updated pathTree with', activePaths.length, 'paths');
    }

    evaluateCompletionCondition(path, journeyState) {
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const playerResources = this.entityManager.getEntity('player').getComponent('Resource');

        let isCompleted = false;
        const condition = path.completionCondition;

        switch (condition.type) {
            case 'reachTier':
                if (gameState.tier >= condition.tier) {
                    isCompleted = true;
                }
                break;
            case 'findArtifact':
                // Check if the player has the artifact in their inventory or resources
                const inventory = this.entityManager.getEntity('player').getComponent('Inventory');
                const hasArtifactInInventory = inventory.items.some(item => item.itemId === condition.artifactId);
                const hasArtifactEquipped = Object.values(inventory.equipped).some(item => item && item.itemId === condition.artifactId);
                if (gameState.tier >= condition.tier && (hasArtifactInInventory || hasArtifactEquipped)) {
                    isCompleted = true;
                }
                break;
            case 'discoverLore':
                // For now, assume discoverLore is completed when triggered (e.g., by InteractionSystem)
                isCompleted = condition.target === true;
                break;
            case 'interactWithNPC':
                // This would typically be set by InteractionSystem; for now, assume false
                isCompleted = false;
                break;
            default:
                console.warn(`JourneySystem: Unknown completion condition type ${condition.type} for path ${path.id}`);
                return;
        }

        if (isCompleted) {
            path.completed = true;
            this.eventBus.emit('LogMessage', { message: path.completionText });
            console.log(`JourneySystem: Completed leaf path ${path.id}`);
            const parentPath = this.findParentPath(path.parentId);
            this.checkParentCompletion(parentPath, journeyState);
        }
    }

    findParentPath(parentId) {
        const player = this.entityManager.getEntity('player');
        const journeyPath = player.getComponent('JourneyPath');
        if (!player || !journeyPath) {
            console.error('JourneySystem: Player or JourneyPath not found');
            return null;
        }
        return this.utilities.findPath(journeyPath, parentId);
    }

    checkParentCompletion(parentPath, journeyState) {
        if (!parentPath || parentPath.completed) {
            return;
        }

        // Find all child paths using pathTree
        const childPaths = journeyState.pathTree.get(parentPath.id) || [];

        // Check if all children are completed
        const allChildrenCompleted = childPaths.length > 0 && childPaths.every(child => child.completed);

        if (allChildrenCompleted) {
            parentPath.completed = true;
            this.eventBus.emit('LogMessage', { message: parentPath.completionText });

            // Grant rewards
            parentPath.rewards.forEach(reward => {
                if (reward.type === 'item' && !reward.rewarded) {
                    const inventory = this.entityManager.getEntity('player').getComponent('Inventory');
                    inventory.items.push({ itemId: reward.itemId, quantity: reward.quantity });
                    this.eventBus.emit('LogMessage', { message: `Received ${reward.quantity} ${reward.itemId} for completing ${parentPath.title}` });
                    reward.rewarded = true;
                }
            });

            // Move parent and children to completedPaths
            const completedEntry = {
                id: parentPath.id,
                parentId: parentPath.parentId,
                title: parentPath.title,
                completedAt: new Date().toISOString(),
                completionText: parentPath.completionText
            };
            journeyState.completedPaths.push(completedEntry);

            childPaths.forEach(child => {
                journeyState.completedPaths.push({
                    id: child.id,
                    parentId: child.parentId,
                    title: child.title,
                    completedAt: new Date().toISOString(),
                    completionText: child.completionText
                });
            });

            // Remove parent and children from the player's JourneyPathComponent
            const journeyPath = this.entityManager.getEntity('player').getComponent('JourneyPath');
            this.utilities.removePath(journeyPath, parentPath.id);
            childPaths.forEach(child => {
                this.utilities.removePath(journeyPath, child.id);
            });

            // Update pathTree after removal
            this.updatePathTree();

            // Start the next path if specified
            if (parentPath.nextPathId) {
                this.startNextPath(parentPath.nextPathId, parentPath.parentId);
            }

            console.log(`JourneySystem: Completed parent path ${parentPath.id}`);
            this.eventBus.emit('JourneyStateUpdated');
        }
    }

    startNextPath(nextPathId, parentId) {
        const journeyPath = this.entityManager.getEntity('player').getComponent('JourneyPath');
        if (!journeyPath) {
            console.error('JourneySystem: JourneyPath component not found on player');
            return;
        }

        // For now, hardcode the next Whisper; this can be replaced with data-driven logic later
        if (nextPathId === 'whisper_parent_2') {
            this.utilities.addPath(journeyPath, {
                id: 'whisper_parent_2',
                parentId: 'master_whispers',
                nextPathId: 'whisper_parent_3',
                completed: false,
                title: 'Echoes of the Past',
                description: 'The Zukran Masters sense a disturbance. Find the Shard of Zukarath on Tier 3 to uncover its secrets.',
                completionCondition: null,
                rewards: [
                    { type: 'item', itemId: 'shardOfZukarath', quantity: 1, rewarded: false },
                    { type: 'logMessage', message: 'The shard pulses with ancient energy, whispering forgotten secrets.' }
                ],
                completionText: 'You have uncovered the secrets of the Shard of Zukarath.',
                logCompletion: true
            });
            this.utilities.addPath(journeyPath, {
                id: 'whisper_child_2_1',
                parentId: 'whisper_parent_2',
                nextPathId: '',
                completed: false,
                title: 'Find the Shard of Zukarath',
                description: 'Locate the Shard of Zukarath on Tier 3.',
                completionCondition: { type: 'findArtifact', artifactId: 'shardOfZukarath', tier: 3 },
                rewards: [],
                completionText: 'You have found the Shard of Zukarath.',
                logCompletion: true
            });
            console.log(`JourneySystem: Started next path ${nextPathId}`);
            this.updatePathTree();
            this.eventBus.emit('JourneyStateUpdated');
        }
    }
}