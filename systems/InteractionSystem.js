import { System } from '../core/Systems.js';
import { JourneyPathComponent } from '../core/Components.js';

export class InteractionSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus);
        this.requiredComponents = [];
        this.utilities = utilities;
        this.queues = this.entityManager.getEntity('gameState').getComponent('DataProcessQueues') || {};
        this.pathTransfers = this.queues.pathTransfers || [];
    }

    init() {
        // For testing, simulate an interaction that triggers a path transfer
        // In a real scenario, this would be triggered by player interaction with an NPC or object
        this.simulateInteraction();
    }

    update(deltaTime) {
        // No per-frame updates needed for now; interactions are event-driven
        // Future implementations can add logic to detect interactions (e.g., player-NPC proximity)
    }

    simulateInteraction() {
        // Simulate an NPC with a JourneyPathComponent containing Echo paths
        const npcEntity = this.entityManager.createEntity('npc_1');
        const npcJourneyPath = new JourneyPathComponent();
        this.utilities.addPath(npcJourneyPath, {
            id: 'echo_parent_1',
            parentId: 'master_echoes',
            nextPathId: '',
            completed: false,
            title: 'Echoes of the Past',
            description: 'A whisper in the fortress walls speaks of a lost artifact. Find the Shard of Zukarath on Tier 3.',
            completionCondition: null,
            rewards: [
                { type: 'item', itemId: 'shardOfZukarath', quantity: 1, rewarded: false },
                { type: 'logMessage', message: 'The shard pulses with ancient energy, whispering forgotten secrets.' }
            ],
            completionText: 'You have found the Shard of Zukarath.',
            logCompletion: true
        });
        this.utilities.addPath(npcJourneyPath, {
            id: 'echo_child_1_1',
            parentId: 'echo_parent_1',
            nextPathId: '',
            completed: false,
            title: 'Find the Shard',
            description: 'Locate the Shard of Zukarath on Tier 3.',
            completionCondition: { type: 'findArtifact', artifactId: 'shardOfZukarath', tier: 3 },
            rewards: [],
            completionText: 'You have located the Shard of Zukarath.',
            logCompletion: true
        });
        this.entityManager.addComponentToEntity('npc_1', npcJourneyPath);

        // Simulate the player accepting the Echo from the NPC
        // In a real scenario, this would be triggered by a player action (e.g., key press near NPC)
        setTimeout(() => {
            this.acceptPathFromNPC('npc_1', 'player', 'echo_parent_1');
            this.acceptPathFromNPC('npc_1', 'player', 'echo_child_1_1');
            this.eventBus.emit('LogMessage', { message: 'You accepted the Echo: Echoes of the Past from an NPC.' });
            console.log('InteractionSystem: Simulated accepting Echo from NPC');
        }, 5000); // Delay for testing purposes
    }

    acceptPathFromNPC(sourceEntityId, targetEntityId, journeyPathCompId) {
        // Push the transfer request to the pathTransfers queue
        this.pathTransfers.push({
            sourceEntityId,
            targetEntityId,
            journeyPathCompId
        });
        console.log(`InteractionSystem: Pushed path transfer request - ${journeyPathCompId} from ${sourceEntityId} to ${targetEntityId}`);
    }
}