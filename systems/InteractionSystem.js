import { System } from '../core/Systems.js';
import { JourneyPathComponent, DialogueComponent, InteractionIntentComponent, ShopInteractionComponent, JourneyPathsComponent, OfferedQuestsComponent, JourneyStateComponent } from '../core/Components.js';

export class InteractionSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus);
        this.requiredComponents = [];
        this.utilities = utilities;
        this.queues = this.entityManager.getEntity('gameState').getComponent('DataProcessQueues') || {};
        this.pathTransfers = this.queues.pathTransfers || [];
        this.shownCompletions = new Set();
    }

    init() {
        // Clear shownCompletions on init to handle stale completions from previous sessions
        this.shownCompletions.clear();
        console.log('InteractionSystem: Cleared shownCompletions on init');
    }

    update(deltaTime) {
        while (this.pathTransfers.length > 0) {
            const transfer = this.pathTransfers.shift();
            this.processPathTransfer(transfer);
        }

        const player = this.entityManager.getEntity('player');
        const intent = player.getComponent('InteractionIntent');
        if (intent && intent.intents.length > 0) {
            intent.intents.forEach(({ action, params }) => {
                if (action === 'interactWithNPC') {
                    this.handleInteractWithNPC(params);
                } else if (action === 'acceptQuest') {
                    this.handleAcceptQuest(params);
                } else if (action === 'openShop') {
                    this.handleOpenShop(params);
                } else if (action === 'turnIn') {
                    this.handleTurnIn(params);
                } else if (action === 'acknowledgeCompletion') {
                    this.handleAcknowledgeCompletion(params);
                }
                console.log(`InteractionSystem: Processed intent: ${action}`, params);
            });
            intent.intents = [];
            console.log('InteractionSystem: Cleared InteractionIntent intents');
        }
    }

    handleInteractWithNPC({ npcId }) {
        const npc = this.entityManager.getEntity(npcId);
        if (!npc || !npc.hasComponent('NPCData')) {
            console.error(`InteractionSystem: NPC ${npcId} not found or missing NPCData`);
            return;
        }
        const npcData = npc.getComponent('NPCData');
        console.log(`InteractionSystem: Interacting with NPC ${npcId}, NPCData ID: ${npcData.id}, Name: ${npcData.name}`);

        const dialogue = this.entityManager.getEntity('dialogueState').getComponent('Dialogue');
        if (!dialogue) {
            console.error('InteractionSystem: Dialogue component not found on dialogueState');
            return;
        }

        this.utilities.pushPlayerActions('interactWithNPC', { npcId: npcData.id });
        console.log(`InteractionSystem: Pushed interactWithNPC to PlayerActionQueue`, { npcId: npcData.id });

        this.refreshDialogue(npcId);
    }

    handleAcceptQuest({ questId, npcId }) {
        const gameState = this.entityManager.getEntity('gameState');
        const offeredQuestsComp = gameState.getComponent('OfferedQuests');
        const journeyPathsComp = gameState.getComponent('JourneyPaths');
        const player = this.entityManager.getEntity('player');
        const journeyPath = player.getComponent('JourneyPath');

        if (!offeredQuestsComp) {
            console.error('InteractionSystem: OfferedQuests component not found on gameState');
            return;
        }
        if (!journeyPathsComp) {
            console.error('InteractionSystem: JourneyPaths component not found on gameState');
            return;
        }
        if (!journeyPath) {
            console.error('InteractionSystem: JourneyPath component not found on player');
            return;
        }

        const offeredQuest = offeredQuestsComp.quests.find(q => q.questId === questId);
        if (!offeredQuest) {
            console.error(`InteractionSystem: Offered quest ${questId} not found`);
            return;
        }

        const questData = journeyPathsComp.paths.find(path => path.id === questId);
        if (!questData) {
            console.error(`InteractionSystem: Quest data for ${questId} not found`);
            return;
        }

        journeyPath.paths.push({ ...questData, accepted: true });
        offeredQuestsComp.quests = offeredQuestsComp.quests.filter(q => q.questId !== questId);
        this.eventBus.emit('LogMessage', { message: `Quest accepted: ${questData.title}` });
        this.eventBus.emit('JourneyStateUpdated');
        console.log(`InteractionSystem: Quest ${questId} accepted by player`);

        const dialogue = this.entityManager.getEntity('dialogueState').getComponent('Dialogue');
        if (dialogue) {
            dialogue.text = '';
            dialogue.options = [];
            dialogue.isOpen = false;
        }

        this.refreshDialogue(npcId);
    }

    handleOpenShop({ npcId }) {
        const npc = this.entityManager.getEntity(npcId);
        if (!npc || !npc.hasComponent('ShopComponent')) {
            console.error(`InteractionSystem: NPC ${npcId} not found or missing ShopComponent`);
            return;
        }
        const player = this.entityManager.getEntity('player');
        if (!player.hasComponent('ShopInteraction')) {
            player.addComponent(new ShopInteractionComponent());
            console.log(`InteractionSystem: Added ShopInteractionComponent to player for NPC ${npcId}`);
        }
        this.eventBus.emit('ToggleOverlay', { tab: 'shop', fromShop: true, npcId });
        this.eventBus.emit('LogMessage', { message: `Opened shop for ${npc.getComponent('NPCData').name}` });
        console.log(`InteractionSystem: Emitted ToggleOverlay for shop with NPC ${npcId}`);
    }

    handleTurnIn({ taskId, resourceType, itemId, quantity, npcId }) {
        this.utilities.pushPlayerActions('turnIn', { taskId, resourceType, itemId, quantity, npcId });
        console.log(`InteractionSystem: Pushed turnIn to PlayerActionQueue`, { taskId, resourceType, itemId, quantity, npcId });
        this.refreshDialogue(npcId);
    }

    handleAcknowledgeCompletion({ questId, npcId }) {
        const dialogue = this.entityManager.getEntity('dialogueState').getComponent('Dialogue');
        const player = this.entityManager.getEntity('player');
        const journeyState = player.getComponent('JourneyState');
        if (!dialogue) {
            console.error('InteractionSystem: Dialogue component not found on dialogueState');
            return;
        }
        if (!journeyState) {
            console.error('InteractionSystem: JourneyState component not found on player');
            return;
        }

        // Emit an event to finalize the quest completion
        this.eventBus.emit('FinalizeQuestCompletion', { questId });

        // Remove from completedPaths after acknowledging
        journeyState.completedPaths = journeyState.completedPaths.filter(path => path.id !== questId);
        this.eventBus.emit('JourneyStateUpdated');

        dialogue.text = '';
        dialogue.options = [];
        dialogue.isOpen = true;

        this.refreshDialogue(npcId);
        console.log(`InteractionSystem: Acknowledged completion of quest ${questId}`);
    }

    refreshDialogue(npcId) {
        const npc = this.entityManager.getEntity(npcId);
        if (!npc || !npc.hasComponent('NPCData')) {
            console.error(`InteractionSystem: NPC ${npcId} not found or missing NPCData`);
            return false;
        }
        const npcData = npc.getComponent('NPCData');
        const dialogue = this.entityManager.getEntity('dialogueState').getComponent('Dialogue');
        const player = this.entityManager.getEntity('player');
        const journeyPath = player.getComponent('JourneyPath');
        const journeyState = player.getComponent('JourneyState');
        const gameState = this.entityManager.getEntity('gameState');
        const journeyPathsComp = gameState.getComponent('JourneyPaths');
        const offeredQuestsComp = gameState.getComponent('OfferedQuests');

        if (!dialogue || !journeyPath || !journeyState || !journeyPathsComp || !offeredQuestsComp) {
            console.error('InteractionSystem: Missing required components for refreshDialogue');
            return false;
        }

        dialogue.options = [];

        // Check for recently completed quests in journeyState.completedPaths, sorted by completedAt (newest first)
        const completedPaths = [...journeyState.completedPaths].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
        const completedQuest = completedPaths.find(path =>
            path.completionText && !this.shownCompletions.has(path.id)
        );
        if (completedQuest) {
            dialogue.text = `Quest completed: ${completedQuest.title}. Rewards: ${this.formatRewards(journeyPathsComp.paths.find(p => p.id === completedQuest.id)?.rewards || [])}`;
            dialogue.options = [
                { label: 'OK', action: 'acknowledgeCompletion', params: { questId: completedQuest.id, npcId } },
                { label: 'Close', action: 'closeDialogue', params: {} }
            ];
            dialogue.isOpen = true;
            dialogue.npcId = npcId;
            dialogue.dialogueStage = 'completion';
            this.shownCompletions.add(completedQuest.id);
            console.log(`InteractionSystem: Showing completion message for quest ${completedQuest.id}`);
            return true;
        }

        const offeredQuests = offeredQuestsComp.quests.filter(
            quest => quest.offeredBy === npcData.id && !journeyPath.paths.some(p => p.id === quest.questId)
        );
        if (offeredQuests.length > 0) {
            const quest = offeredQuests[0];
            const questData = journeyPathsComp.paths.find(path => path.id === quest.questId);
            if (!questData) {
                console.error(`InteractionSystem: Quest data for ${quest.questId} not found`);
                return false;
            }
            dialogue.text = `I have a task for you: ${questData.title}. ${questData.description} Will you accept?`;
            dialogue.options = [
                { label: 'Accept', action: 'acceptQuest', params: { questId: quest.questId, npcId } },
                { label: 'Close', action: 'closeDialogue', params: {} }
            ];
            dialogue.isOpen = true;
            dialogue.npcId = npcId;
            dialogue.dialogueStage = 'questOffer';
            console.log(`InteractionSystem: Offering quest ${quest.questId}`);
            return true;
        }

        let hasTurnInOptions = false;
        journeyPath.paths.forEach(path => {
            if (path.id === path.parentId || path.completed) return;
            path.tasks?.forEach(task => {
                if (!task.completed && task.completionCondition.type === 'turnIn' && task.completionCondition.npc === npcData.id) {
                    const condition = task.completionCondition;
                    dialogue.options.push({
                        label: `Deliver ${condition.quantity} ${condition.resourceType || condition.itemId}`,
                        action: 'turnIn',
                        params: { taskId: task.id, resourceType: condition.resourceType, itemId: condition.itemId, quantity: condition.quantity, npcId }
                    });
                    hasTurnInOptions = true;
                }
            });
        });

        const shopComponent = npc.hasComponent('ShopComponent') ? npc.getComponent('ShopComponent') : null;
        const shopDialogueText = shopComponent ? shopComponent.dialogueText : null;
        if (hasTurnInOptions || shopDialogueText) {
            dialogue.text = hasTurnInOptions ? 'What do you have for me?' : npcData.greeting;
            if (shopDialogueText && !hasTurnInOptions) {
                dialogue.options.push({ label: 'Shop', action: 'openShop', params: { npcId } });
            }
            dialogue.options.push({ label: 'Close', action: 'closeDialogue', params: {} });
            dialogue.isOpen = true;
            dialogue.npcId = npcId;
            dialogue.dialogueStage = 'greeting';
            console.log(`InteractionSystem: Set default dialogue for NPC ${npcId}`);
            return true;
        }

        dialogue.text = npcData.greeting || 'Greetings, adventurer.';
        dialogue.options = [{ label: 'Close', action: 'closeDialogue', params: {} }];
        dialogue.isOpen = true;
        dialogue.npcId = npcId;
        dialogue.dialogueStage = 'greeting';
        console.log(`InteractionSystem: Set fallback greeting for NPC ${npcId}`);
        return true;
    }

    formatRewards(rewards) {
        const rewardStrings = rewards.map(reward => {
            if (reward.xp) return `${reward.xp} XP`;
            if (reward.gold) return `${reward.gold} gold`;
            if (reward.type === 'item') return `${reward.quantity || 1} ${reward.itemId}`;
            if (reward.type === 'unlock') return `${reward.mechanic}`;
            return '';
        }).filter(str => str);
        return rewardStrings.join(', ');
    }

    processPathTransfer({ sourceEntityId, targetEntityId, journeyPathCompId }) {
        const sourceEntity = this.entityManager.getEntity(sourceEntityId);
        const targetEntity = this.entityManager.getEntity(targetEntityId);
        if (!sourceEntity || !targetEntity) {
            console.error(`InteractionSystem: Source (${sourceEntityId}) or target (${targetEntityId}) entity not found`);
            return;
        }

        const sourceJourneyPath = sourceEntity.getComponent('JourneyPath');
        const targetJourneyPath = targetEntity.getComponent('JourneyPath');
        if (!sourceJourneyPath || !targetJourneyPath) {
            console.error('InteractionSystem: JourneyPath component missing on source or target');
            return;
        }

        const pathToTransfer = sourceJourneyPath.paths.find(path => path.id === journeyPathCompId);
        if (!pathToTransfer) {
            console.error(`InteractionSystem: Path ${journeyPathCompId} not found on source entity ${sourceEntityId}`);
            return;
        }

        targetJourneyPath.paths.push({ ...pathToTransfer });
        this.utilities.removePath(sourceJourneyPath, journeyPathCompId);
        console.log(`InteractionSystem: Transferred path ${journeyPathCompId} from ${sourceEntityId} to ${targetEntityId}`);
        this.eventBus.emit('JourneyStateUpdated');
    }
}