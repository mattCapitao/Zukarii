// JourneyProgressSystem.js
import { System } from '../core/Systems.js';
import { JourneyUpdateQueueComponent, JourneyPathComponent, JourneyStateComponent, OfferedQuestsComponent, PlayerActionQueueComponent, JourneyRewardComponent } from '../core/Components.js';

export class JourneyProgressSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus);
        this.requiredComponents = [];
        this.utilities = utilities;
    }

    async init() {
        this.eventBus.on('FinalizeQuestCompletion', ({ questId }) => {
            this.finalizeQuestCompletion(questId);
        });
    }

    update(deltaTime) {
        const gameState = this.entityManager.getEntity('gameState');
        const player = this.entityManager.getEntity('player');
        const journeyUpdateQueue = gameState.getComponent('JourneyUpdateQueue');
        const journeyPath = player.getComponent('JourneyPath');
        const journeyState = player.getComponent('JourneyState');
        const offeredQuests = gameState.getComponent('OfferedQuests');
        const inventory = player.getComponent('Inventory');
        const resource = player.getComponent('Resource');
        const journeyPathsComp = gameState.getComponent('JourneyPaths');

        if (!journeyUpdateQueue || !journeyPath || !journeyState || !offeredQuests || !inventory || !resource || !journeyPathsComp) {
            console.error('JourneyProgressSystem: Missing required components');
            return;
        }

        // Process equipGear tasks
        const hasEquipGearTask = journeyPath.paths.some(path =>
            path.tasks?.some(task => !task.completed && task.completionCondition.type === 'equipGear')
        );
        if (hasEquipGearTask) {
            journeyPath.paths.forEach(path => {
                if (path.completed || path.id === path.parentId) return;
                path.tasks?.forEach(task => {
                    if (!task.completed && task.completionCondition.type === 'equipGear') {
                        if (this.checkEquipGear(task, inventory)) {
                            task.completed = true;
                            task.completedAt = Date.now();
                            this.eventBus.emit('LogMessage', { message: task.completionText });
                            this.eventBus.emit('JourneyStateUpdated');
                            console.log(`JourneyProgressSystem: Completed equipGear task ${task.id}`);
                        }
                    }
                });
            });
        }

        // Process actions with task-specific validation
        journeyUpdateQueue.queue.forEach(action => {
            journeyPath.paths.forEach(path => {
                if (path.completed || path.id === path.parentId) return;
                path.tasks?.forEach(task => {
                    if (!task.completed && this.matchesTask(action, task)) {
                        if (task.completionCondition.type === 'interactWithNPC') {
                            console.log(`JourneyProgressSystem: Processing interactWithNPC for task ${task.id}`);
                        }
                        console.log(`JourneyProgressSystem: Completing task ${task.id}`);
                        task.completed = true;
                        task.completedAt = Date.now();
                        this.eventBus.emit('LogMessage', { message: task.completionText });
                        this.eventBus.emit('JourneyStateUpdated');
                        console.log(`JourneyProgressSystem: Completed task ${task.id} for action ${action.type}`);
                    }
                });
            });
        });

        // Update JourneyDialogueComponent
        const syliri = this.entityManager.getEntitiesWith(['NPCData']).find(e => e.getComponent('NPCData').id === 'sehnrhyx_syliri');
        if (syliri && syliri.hasComponent('JourneyDialogue')) {
            const dialogueComp = syliri.getComponent('JourneyDialogue');
            dialogueComp.dialogues = {};

            // Pending rewards (quests in pendingCompletion state)
            journeyPath.paths.forEach(path => {
                if (path.pendingCompletion && !path.completed) {
                    const questData = journeyPathsComp.paths.find(p => p.id === path.id);
                    if (questData) {
                        // Format rewards and append to completionText
                        const rewardStrings = questData.rewards?.map(reward => {
                            if (reward.xp) return `${reward.xp} XP`;
                            if (reward.gold) return `${reward.gold} gold`;
                            if (reward.type === 'item') {
                                const itemName = reward.journeyItemId === 'stoneOfReturn' ? 'Stone of Return' : reward.journeyItemId;
                                return itemName;
                            }
                            if (reward.type === 'unlock') return `${reward.mechanic}`;
                            return '';
                        }).filter(str => str) || [];
                        const rewardMessage = rewardStrings.length > 0 ? rewardStrings.join(', ') : 'None';
                        const dialogueText = `${questData.completionText} Rewards: ${rewardMessage}`;
                        dialogueComp.dialogues[path.id] = {
                            text: dialogueText,
                            action: 'acknowledgeCompletion',
                            params: { questId: path.id, npcId: syliri.id }
                        };
                        // Add to completedPaths for InteractionSystem to handle
                        if (!journeyState.completedPaths.some(p => p.id === path.id)) {
                            journeyState.completedPaths.push({
                                id: path.id,
                                parentId: path.parentId,
                                title: path.title,
                                completedAt: new Date().toISOString(),
                                completionText: path.completionText,
                                rewards: path.rewards
                            });
                        }
                    }
                }
            });

            // Offered quests
            offeredQuests.quests.forEach(quest => {
                if (quest.offeredBy === 'sehnrhyx_syliri') {
                    const questData = journeyPathsComp.paths.find(p => p.id === quest.questId);
                    if (questData && !journeyPath.paths.some(p => p.id === quest.questId)) {
                        dialogueComp.dialogues[quest.questId] = {
                            text: questData.offerText || questData.description,
                            action: 'acceptQuest',
                            params: { questId: quest.questId, npcId: syliri.id }
                        };
                    }
                }
            });

            // Active tasks
            journeyPath.paths.forEach(path => {
                if (path.id === path.parentId || path.completed) return;
                path.tasks?.forEach(task => {
                    if (!task.completed && (task.completionCondition.npc === 'sehnrhyx_syliri' || path.offeredBy === 'sehnrhyx_syliri')) {
                        dialogueComp.dialogues[task.id] = {
                            text: task.activeText || task.description,
                            action: task.completionCondition.type === 'turnIn' ? 'turnIn' : task.completionCondition.type === 'interactWithNPC' ? 'completeTask' : null,
                            params: task.completionCondition.type === 'turnIn' ? {
                                taskId: task.id,
                                resourceType: task.completionCondition.resourceType,
                                itemId: task.completionCondition.itemId,
                                quantity: task.completionCondition.quantity,
                                npcId: syliri.id
                            } : task.completionCondition.type === 'interactWithNPC' ? {
                                taskId: task.id,
                                npcId: syliri.id
                            } : null
                        };
                    }
                });
            });

            console.log(`JourneyProgressSystem: Updated JourneyDialogueComponent for Syliri`, dialogueComp.dialogues);
        }

        // Check for completed quests
        journeyPath.paths.forEach(quest => {
            if (quest.completed || quest.pendingCompletion || quest.id === journeyPath.parentId) return;
            const allTasksCompleted = quest.tasks?.length > 0 && quest.tasks.every(task => task.completed);
            if (allTasksCompleted) {
                quest.pendingCompletion = true;
                this.eventBus.emit('JourneyStateUpdated');
                console.log(`JourneyProgressSystem: Quest ${quest.id} set to pendingCompletion`);
            }
        });

        // Clear processed actions
        journeyUpdateQueue.queue = journeyUpdateQueue.queue.filter(action => !journeyPath.paths.some(path =>
            path.tasks?.some(task => this.matchesTask(action, task))
        ));
        console.log('JourneyProgressSystem: Cleared processed actions from JourneyUpdateQueue');
    }

    matchesTask(action, task) {
        const condition = task.completionCondition;
        console.log(`JourneyProgressSystem: Matching task ${task.id} with action ${action.type}, condition:`, condition);
        if (!condition.type) {
            console.error(`JourneyProgressSystem: Task ${task.id} has invalid completion condition:`, condition);
            return false;
        }

        switch (action.type) {
            case 'collectResource':
                return condition.type === 'collectResource' &&
                    condition.resourceType === action.data.resourceType &&
                    (condition.quantity <= action.data.quantity || !condition.quantity);
            case 'findItem':
            case 'collectItem':
                return (condition.type === 'findItem' || condition.type === 'collectItem') &&
                    (condition.journeyItemId === action.data.journeyItemId || condition.itemId === action.data.itemId);
            case 'bossKill':
                return condition.type === 'bossKill' && condition.tier === action.data.tier;
            case 'interactWithNPC':
                return condition.type === 'interactWithNPC' &&
                    condition.npc === action.data.npcId;
            case 'useItem':
                return condition.type === 'useItem' && condition.itemId === action.data.itemId;
            case 'reachTier':
                return condition.type === 'reachTier' && condition.tier === action.data.tier;
            case 'completeEchoes':
                return condition.type === 'completeEchoes' && condition.count <= action.data.count;
            case 'completeWhispers':
                return condition.type === 'completeWhispers' && condition.pathId === action.data.pathId;
            case 'turnIn':
                return condition.type === 'turnIn' &&
                    condition.npc === action.data.npcId &&
                    this.handleTurnInCondition(condition, action.data);
            default:
                console.warn(`JourneyProgressSystem: Unknown task type ${action.type}`);
                return false;
        }
    }

    handleTurnInCondition(condition) {
        if (condition.resourceType) {
            const resources = this.entityManager.getEntity('player').getComponent('Resource');
            if (resources.craftResources[condition.resourceType] >= condition.quantity) {
                resources.craftResources[condition.resourceType] -= condition.quantity;
                return true;
            }
        } else if (condition.itemId) {
            const inventory = this.entityManager.getEntity('player').getComponent('Inventory');
            const itemIndex = inventory.items.findIndex(item => item.id === condition.itemId);
            if (itemIndex !== -1) {
                inventory.items.splice(itemIndex, 1);
                return true;
            }
        }
        return false;
    }

    checkEquipGear(task, inventory) {
        const requiredTypes = new Set(['amulet', 'armor', 'ring', 'ring', 'weapon', 'weapon']);
        const requiredWeapons = new Set(['melee', 'ranged']);
        const equippedTypes = new Set();
        const equippedWeapons = new Set();

        for (const item of Object.values(inventory.equipped)) {
            if (!item || item.itemTier !== 'magic') continue;
            if (item.type === 'amulet' || item.type === 'armor') {
                equippedTypes.add(item.type);
            } else if (item.type === 'ring') {
                if (!equippedTypes.has('ring')) {
                    equippedTypes.add('ring');
                } else if (equippedTypes.has('ring') && !equippedTypes.has('ring2')) {
                    equippedTypes.add('ring2');
                }
            } else if (item.type === 'weapon') {
                if (item.attackType === 'melee' || item.attackType === 'ranged') {
                    equippedWeapons.add(item.attackType);
                    equippedTypes.add('weapon');
                }
            }
        }

        return requiredTypes.size === equippedTypes.size &&
            requiredTypes.every(type => type === 'weapon' || equippedTypes.has(type)) &&
            requiredWeapons.size === equippedWeapons.size &&
            requiredWeapons.every(attackType => equippedWeapons.has(attackType));
    }

    applyRewards(quest) {
        const player = this.entityManager.getEntity('player');
        const journeyReward = player.getComponent('JourneyReward');

        if (!journeyReward) {
            console.warn('JourneyProgressSystem: JourneyReward component not found on player');
            return;
        }
        if (!quest.rewards) {
            console.warn('JourneyProgressSystem: No rewards found for quest', quest.id);
            return;
        }
        if (!quest.rewards.length) {
            console.warn('JourneyProgressSystem: No rewards found for quest', quest.id);
            return;
        }
        console.log('JourneyProgressSystem: Adding rewards to JourneyRewardComponent:', quest.rewards);
        journeyReward.rewards = quest.rewards;
    }

    offerNextQuest(quest) {
        if (quest.nextPathId) {
            const gameState = this.entityManager.getEntity('gameState');
            const journeyPathsComp = gameState.getComponent('JourneyPaths');
            const offeredQuestsComp = gameState.getComponent('OfferedQuests');
            const nextQuest = journeyPathsComp.paths.find(path => path.id === quest.nextPathId);
            if (nextQuest && !offeredQuestsComp.quests.some(q => q.questId === nextQuest.id)) {
                const offeredBy = nextQuest.offeredBy || quest.offeredBy || 'default_npc';
                offeredQuestsComp.quests.push({ questId: nextQuest.id, offeredBy });
                this.eventBus.emit('LogMessage', { message: `New quest available: ${nextQuest.title}` });
                console.log(`JourneyProgressSystem: Offered next quest ${nextQuest.id} by ${offeredBy}`);
            }
        }
    }

    triggerMasterPath(quest) {
        if (quest.triggersMasterPath) {
            const journeyPath = this.entityManager.getEntity('player').getComponent('JourneyPath');
            const gameState = this.entityManager.getEntity('gameState');
            const journeyPathsComp = gameState.getComponent('JourneyPaths');
            const masterPath = journeyPathsComp.paths.find(path => path.id === quest.triggersMasterPath);
            if (masterPath && !journeyPath.paths.some(p => p.id === masterPath.id)) {
                this.utilities.addPath(journeyPath, masterPath);
                this.eventBus.emit('LogMessage', { message: `New path unlocked: ${masterPath.title}` });
                console.log(`JourneyProgressSystem: Triggered master path ${masterPath.id}`);
            }
        }
    }

    finalizeQuestCompletion(questId) {
        const player = this.entityManager.getEntity('player');
        const journeyPath = player.getComponent('JourneyPath');
        const quest = journeyPath.paths.find(q => q.id === questId && q.pendingCompletion);
        if (!quest) {
            console.warn(`JourneyProgressSystem: Quest ${questId} not found or not in pendingCompletion state`);
            return;
        }

        quest.pendingCompletion = false;
        quest.completed = true;
        this.applyRewards(quest);
        this.offerNextQuest(quest);
        this.triggerMasterPath(quest);
        this.utilities.pushPlayerActions('completeWhispers', { pathId: quest.id, title: quest.title });
        this.eventBus.emit('JourneyStateUpdated');
        console.log(`JourneyProgressSystem: Finalized completion of quest ${questId}`);

        this.utilities.removePath(journeyPath, questId);
        console.log(`JourneyProgressSystem: Removed completed quest ${questId} from JourneyPath.paths`);
    }
}