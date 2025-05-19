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
        this.eventBus.on('InteractWithNPC', (data) => this.handleInteractWithNPC(data));
        this.simulateInteraction();
    }

    update(deltaTime) {
        // No per-frame updates needed for now; interactions are event-driven
    }

    handleInteractWithNPC({ npcId }) {
        const npc = this.entityManager.getEntity(npcId);
        if (!npc || !npc.hasComponent('NPCData')) {
            console.error(`InteractionSystem: NPC ${npcId} not found or missing NPCData`);
            return;
        }
        const npcData = npc.getComponent('NPCData');
        const shopComponent = npc.hasComponent('ShopComponent') ? npc.getComponent('ShopComponent') : null;
        const shopDialogueText = shopComponent ? shopComponent.dialogueText : null;

        this.eventBus.emit('OpenDialogue', {
            npcId: npcId,
            text: npcData.greeting,
            shopDialogueText: shopDialogueText
        });
        console.log(`InteractionSystem: Opened dialogue for NPC ${npcId} (${npcData.name})${shopDialogueText ? ` with shop dialogue "${shopDialogueText}"` : ''}`);
    }

    simulateInteraction() {
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

        setTimeout(() => {
            this.acceptPathFromNPC('npc_1', 'player', 'echo_parent_1');
            this.acceptPathFromNPC('npc_1', 'player', 'echo_child_1_1');
            this.eventBus.emit('LogMessage', { message: 'You accepted the Echo: Echoes of the Past from an NPC.' });
            console.log('InteractionSystem: Simulated accepting Echo from NPC');
        }, 5000);
    }

    acceptPathFromNPC(sourceEntityId, targetEntityId, journeyPathCompId) {
        this.pathTransfers.push({
            sourceEntityId,
            targetEntityId,
            journeyPathCompId
        });
        console.log(`InteractionSystem: Pushed path transfer request - ${journeyPathCompId} from ${sourceEntityId} to ${targetEntityId}`);
    }
}