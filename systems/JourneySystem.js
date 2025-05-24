// systems/JourneySystem.js
import { System } from '../core/Systems.js';
import { JourneyStateComponent, JourneyPathComponent } from '../core/Components.js';

export class JourneySystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus);
        this.requiredComponents = ['JourneyState'];
        this.utilities = utilities;
    }

    init() {
        this.eventBus.on('BossKilled', ({ tier }) => {
            const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
            if (!gameState.bossKills) gameState.bossKills = [];
            gameState.bossKills.push({ tier, killed: true });
        });
        this.eventBus.on('ItemUsed', ({ entityId, itemId }) => {
            if (entityId === 'player') {
                const journeyPath = this.entityManager.getEntity('player').getComponent('JourneyPath');
                journeyPath.paths.forEach(path => {
                    path.tasks?.forEach(task => {
                        if (task.completionCondition?.type === 'useItem' && task.completionCondition.itemId === itemId && !task.completed) {
                            task.completed = true;
                            this.eventBus.emit('LogMessage', { message: task.completionText });
                            this.checkParentCompletion(path);
                        }
                    });
                });
            }
        });
        this.eventBus.on('AcceptQuest', ({ questId }) => {
            const player = this.entityManager.getEntity('player');
            const journeyPath = player.getComponent('JourneyPath');
            const gameState = this.entityManager.getEntity('gameState');
            const journeyPathsComp = gameState.getComponent('JourneyPaths');
            const offeredQuestsComp = gameState.getComponent('OfferedQuests');

            const quest = journeyPathsComp.paths.find(path => path.id === questId);
            if (!quest || journeyPath.paths.some(p => p.id === questId)) return;

            journeyPath.paths.push({ ...quest });
            offeredQuestsComp.quests = offeredQuestsComp.quests.filter(q => q.questId !== questId);
            this.eventBus.emit('LogMessage', { message: `Quest accepted: ${quest.title}` });
            this.eventBus.emit('QuestAccepted', { questId });
        });
        this.eventBus.on('InteractWithNPC', ({ npcId }) => {
            const player = this.entityManager.getEntity('player');
            const journeyPath = player.getComponent('JourneyPath');
            journeyPath.paths.forEach(path => {
                path.tasks?.forEach(task => {
                    if (task.completionCondition?.type === 'interactWithNPC' && task.completionCondition.npc === npcId && !task.completed) {
                        let canComplete = true;
                        if (task.completionCondition.requiresResource) {
                            const resources = player.getComponent('Resource');
                            const resourceCount = resources.craftResources[task.completionCondition.requiresResource.resourceType] || 0;
                            if (resourceCount >= task.completionCondition.requiresResource.quantity) {
                                resources.craftResources[task.completionCondition.requiresResource.resourceType] -= task.completionCondition.requiresResource.quantity;
                            } else {
                                canComplete = false;
                            }
                        } else if (task.completionCondition.requiresItem) {
                            const inventory = player.getComponent('Inventory');
                            const itemIndex = inventory.items.findIndex(item => item.itemId === task.completionCondition.requiresItem.itemId);
                            if (itemIndex !== -1) {
                                inventory.items.splice(itemIndex, 1);
                            } else {
                                canComplete = false;
                            }
                        }
                        if (canComplete) {
                            task.completed = true;
                            this.eventBus.emit('LogMessage', { message: task.completionText });
                            this.checkParentCompletion(path);
                        }
                    }
                });
            });
        });
    }

    update(deltaTime) {
        const player = this.entityManager.getEntity('player');
        if (!player) {
            console.error('JourneySystem: Player entity not found');
            return;
        }

        const journeyState = player.getComponent('JourneyState');
        const journeyPath = player.getComponent('JourneyPath');
        if (!journeyState || !journeyPath) {
            console.error('JourneySystem: JourneyState or JourneyPath component not found on player');
            return;
        }

        // Process active quests
        const activeQuests = journeyPath.paths.filter(path => path.id !== path.parentId);
        activeQuests.forEach(quest => {
            if (quest.completed) return;
            quest.tasks?.forEach(task => {
                if (!task.completed) {
                    this.evaluateCompletionCondition(task, journeyState);
                }
            });
            this.checkParentCompletion(quest, journeyState);
        });
    }

    evaluateCompletionCondition(task, journeyState) {
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const playerResources = this.entityManager.getEntity('player').getComponent('Resource');
        const inventory = this.entityManager.getEntity('player').getComponent('Inventory');

        let isCompleted = false;
        const condition = task.completionCondition;
        if (!condition) return;

        switch (condition.type) {
            case 'reachTier':
                if (gameState.tier >= condition.tier) {
                    isCompleted = true;
                }
                break;
            case 'findItem':
                const hasArtifactInInventory = inventory.items.some(item => item.journeyItemId===condition.journeyItemId);
                const hasArtifactEquipped = Object.values(inventory.equipped).some(item => item && item.journeyItemId===condition.journeyItemId);
                if (gameState.tier >= condition.tier && (hasArtifactInInventory || hasArtifactEquipped)) {
                    isCompleted = true;
                }
                break;
            case 'interactWithNPC':
                // Handled via event listener
                break;
            case 'bossKill':
                if (gameState.bossKills?.some(b => b.tier === condition.tier && b.killed)) {
                    isCompleted = true;
                }
                break;
            case 'collectItem':
                const hasItem = inventory.items.some(item => item.itemId === condition.itemId) ||
                    Object.values(inventory.equipped).some(item => item && item.itemId === condition.itemId);
                if (hasItem) {
                    isCompleted = true;
                }
                break;
            case 'collectResource':
                const resourceCount = playerResources.craftResources[condition.resourceType] || 0;
                if (resourceCount >= condition.quantity) {
                    isCompleted = true;
                }
                break;
            case 'useItem':
                // Handled via ItemUsed event
                break;
            case 'completeEchoes':
                isCompleted = true; // Auto-completed for testing
                break;
            default:
                console.warn(`JourneySystem: Unknown completion condition type ${condition.type}`);
        }

        if (isCompleted) {
            task.completed = true;
            this.eventBus.emit('LogMessage', { message: task.completionText });
        }
    }

    checkParentCompletion(quest, journeyState) {
        if (!quest || quest.completed) return;

        const allTasksCompleted = quest.tasks?.length > 0 && quest.tasks.every(task => task.completed);
        if (!allTasksCompleted) return;

        quest.completed = true;
        this.eventBus.emit('LogMessage', { message: quest.completionText });

        // Record completion in JourneyState
        const journeyStateComp = this.entityManager.getEntity('player').getComponent('JourneyState');
        journeyStateComp.completedPaths.push({
            id: quest.id,
            parentId: quest.parentId,
            title: quest.title,
            completedAt: new Date().toISOString(),
            completionText: quest.completionText
        });

        // Handle rewards
        quest.rewards?.forEach(reward => {
            if (reward.type === 'item' && !reward.rewarded) {
                this.eventBus.emit('AddItem', {
                    entityId: 'player',
                    item: {
                        itemId: reward.itemId,
                        quantity: reward.quantity || 1,
                        useItem: reward.useItem,
                        useEffect: reward.useEffect,
                        params: reward.params
                    }
                });
                reward.rewarded = true;
            } else if (reward.type === 'xp') {
                const playerState = this.entityManager.getEntity('player').getComponent('PlayerState');
                playerState.xp += reward.xp;
                this.eventBus.emit('LogMessage', { message: `Gained ${reward.xp} XP` });
            } else if (reward.type === 'gold') {
                const resources = this.entityManager.getEntity('player').getComponent('Resource');
                resources.gold += reward.gold;
                this.eventBus.emit('LogMessage', { message: `Gained ${reward.gold} gold` });
            } else if (reward.type === 'unlock' && reward.mechanic === 'portalBinding') {
                this.entityManager.addComponentToEntity('player', new PortalBindingsComponent([0]));
                this.eventBus.emit('LogMessage', { message: `Unlocked Portal Binding` });
            }
        });

        // Offer the next quest
        if (quest.nextPathId) {
            const gameState = this.entityManager.getEntity('gameState');
            const journeyPathsComp = gameState.getComponent('JourneyPaths');
            const offeredQuestsComp = gameState.getComponent('OfferedQuests');
            const nextQuest = journeyPathsComp.paths.find(path => path.id === quest.nextPathId);
            if (nextQuest && !offeredQuestsComp.quests.some(q => q.questId === nextQuest.id)) {
                offeredQuestsComp.quests.push({ questId: nextQuest.id, offeredBy: nextQuest.offeredBy });
                this.eventBus.emit('LogMessage', { message: `New quest available: ${nextQuest.title}` });
            }
        }

        // Trigger additional master paths (e.g., Echoes)
        if (quest.triggersMasterPath) {
            const journeyPath = this.entityManager.getEntity('player').getComponent('JourneyPath');
            const gameState = this.entityManager.getEntity('gameState');
            const journeyPathsComp = gameState.getComponent('JourneyPaths');
            const masterPath = journeyPathsComp.paths.find(path => path.id === quest.triggersMasterPath);
            if (masterPath && !journeyPath.paths.some(p => p.id === masterPath.id)) {
                journeyPath.paths.push({ ...masterPath });
                this.eventBus.emit('LogMessage', { message: `New path unlocked: ${masterPath.title}` });
            }
        }

        this.eventBus.emit('JourneyStateUpdated');
    }
}