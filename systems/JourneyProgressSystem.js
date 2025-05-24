import { System } from '../core/Systems.js';
import { JourneyUpdateQueueComponent, JourneyPathComponent, JourneyStateComponent, OfferedQuestsComponent, PlayerActionQueueComponent, ResourceComponent, InventoryComponent } from '../core/Components.js';

export class JourneyProgressSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus);
        this.requiredComponents = [];
        this.utilities = utilities;
    }

    init() {
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

        if (!journeyUpdateQueue) {
            console.error('JourneyProgressSystem: JourneyUpdateQueue component not found on gameState');
            return;
        }
        if (!journeyPath) {
            console.error('JourneyProgressSystem: JourneyPath component not found on player');
            return;
        }
        if (!journeyState) {
            console.error('JourneyProgressSystem: JourneyState component not found on player');
            return;
        }
        if (!offeredQuests) {
            console.error('JourneyProgressSystem: OfferedQuests component not found on gameState');
            return;
        }
        if (!inventory) {
            console.error('JourneyProgressSystem: Inventory component not found on player');
            return;
        }
        if (!resource) {
            console.error('JourneyProgressSystem: Resource component not found on player');
            return;
        }

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

        journeyUpdateQueue.queue.forEach(action => {
            journeyPath.paths.forEach(path => {
                if (path.completed || path.id === path.parentId) return;
                path.tasks?.forEach(task => {
                    if (!task.completed && this.matchesTask(action, task)) {
                        task.completed = true;
                        task.completedAt = Date.now();
                        this.eventBus.emit('LogMessage', { message: task.completionText });
                        this.eventBus.emit('JourneyStateUpdated');
                        console.log(`JourneyProgressSystem: Completed task ${task.id} for action ${action.type}, condition:`, task.completionCondition);
                    }
                });
            });
        });

        const completedQuests = [];
        journeyPath.paths.forEach(quest => {
            if (quest.completed || quest.pendingCompletion || quest.id === quest.parentId) return;
            const allTasksCompleted = quest.tasks?.length > 0 && quest.tasks.every(task => task.completed);
            if (allTasksCompleted) {
                // Instead of marking as completed, set to pendingCompletion and add to completedPaths
                quest.pendingCompletion = true;
                journeyState.completedPaths.push({
                    id: quest.id,
                    parentId: quest.parentId,
                    title: quest.title,
                    completedAt: new Date().toISOString(),
                    completionText: quest.completionText
                });
                this.eventBus.emit('JourneyStateUpdated');
                console.log(`JourneyProgressSystem: Quest ${quest.id} has all tasks completed, set to pendingCompletion`);
            }
        });

        completedQuests.forEach(questId => {
            this.utilities.removePath(journeyPath, questId);
            console.log(`JourneyProgressSystem: Removed completed quest ${questId} from JourneyPath.paths`);
        });
        if (completedQuests.length > 0) {
            journeyUpdateQueue.queue = [];
            console.log('JourneyProgressSystem: Processed completed quests:', completedQuests);
            console.log('JourneyProgressSystem: JourneyUpdateQueue', journeyUpdateQueue.queue);
            console.log('JourneyProgressSystem: Cleared JourneyUpdateQueue');
        }
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
                return condition.type === 'interactWithNPC' && condition.npc === action.data.npcId;
            case 'useItem':
                return condition.type === 'useItem' && condition.itemId === action.data.itemId;
            case 'reachTier':
                return condition.type === 'reachTier' && condition.tier === action.data.tier;
            case 'completeEchoes':
                return condition.type === 'completeEchoes' && condition.count <= action.data.count;
            case 'completeWhispers':
                return condition.type === 'completeWhispers' && condition.pathId === action.data.pathId;
            case 'turnIn':
                return condition.type === 'turnIn' && condition.npc === action.data.npcId && this.handleTurnInCondition(condition);
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
        quest.rewards?.forEach(reward => {
            if (!reward) {
                console.warn(`JourneyProgressSystem: Skipping null reward in quest ${quest.id}`);
                return;
            }
            if (reward.xp) {
                this.eventBus.emit('AwardXp', { amount: reward.xp });
                console.log(`JourneyProgressSystem: Emitted AwardXp for ${reward.xp}`);
            }
            if (reward.gold) {
                const resource = this.entityManager.getEntity('player').getComponent('Resource');
                resource.gold += reward.gold;
                this.eventBus.emit('LogMessage', { message: `Gained ${reward.gold} gold` });
                console.log(`JourneyProgressSystem: Added ${reward.gold} gold`);
            }
            if (reward.type === 'item' && !reward.rewarded) {
                this.eventBus.emit('AddItem', {
                    entityId: 'player',
                    item: {
                        itemId: reward.itemId,
                        quantity: reward.quantity || 1,
                        useItem: reward.useItem,
                        useEffect: reward.useEffect,
                        params: reward.params,
                        isQuestItem: reward.isQuestItem
                    }
                });
                reward.rewarded = true;
                console.log(`JourneyProgressSystem: Emitted AddItem for ${reward.itemId}`);
            } else if (reward.type === 'unlock' && reward.mechanic === 'portalBinding') {
                this.eventBus.emit('AddComponent', { entityId: 'player', component: new PortalBindingsComponent([0]) });
                this.eventBus.emit('LogMessage', { message: `Unlocked Portal Binding` });
                console.log(`JourneyProgressSystem: Added PortalBindingsComponent`);
            } else if (reward.type) {
                console.warn(`JourneyProgressSystem: Unknown reward type ${reward.type} in quest ${quest.id}`);
            }
        });
    }

    offerNextQuest(quest) {
        if (quest.nextPathId) {
            const gameState = this.entityManager.getEntity('gameState');
            const journeyPathsComp = gameState.getComponent('JourneyPaths');
            const offeredQuestsComp = gameState.getComponent('OfferedQuests');
            const nextQuest = journeyPathsComp.paths.find(path => path.id === quest.nextPathId);
            if (nextQuest && !offeredQuestsComp.quests.some(q => q.questId === nextQuest.id)) {
                // Use the offeredBy from the current quest if nextQuest doesn't specify one
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
        this.eventBus.emit('LogMessage', { message: quest.completionText });
        this.eventBus.emit('JourneyStateUpdated');
        console.log(`JourneyProgressSystem: Finalized completion of quest ${questId}`);

        this.utilities.removePath(journeyPath, questId);
        console.log(`JourneyProgressSystem: Removed completed quest ${questId} from JourneyPath.paths`);
    }
}