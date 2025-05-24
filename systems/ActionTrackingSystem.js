import { System } from '../core/Systems.js';
import { PlayerActionQueueComponent, JourneyPathComponent, JourneyUpdateQueueComponent, PlayerAchievementsComponent } from '../core/Components.js';

export class ActionTrackingSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus);
        this.requiredComponents = [];
        this.utilities = utilities;
        this.echoCounter = 0; // Temporary counter for Echo quest completions
    }

    init() {
        // No event listeners; relies on PlayerActionQueue
    }

    update(deltaTime) {
        const player = this.entityManager.getEntity('player');
        const playerActionQueue = player.getComponent('PlayerActionQueue');
        const journeyPath = player.getComponent('JourneyPath');
        const gameState = this.entityManager.getEntity('gameState');
        const journeyUpdateQueue = gameState.getComponent('JourneyUpdateQueue');
        const achievements = player.getComponent('PlayerAchievements');

        if (!playerActionQueue) {
            console.error('ActionTrackingSystem: PlayerActionQueue component not found on player');
            return;
        }
        if (!journeyPath) {
            console.error('ActionTrackingSystem: JourneyPath component not found on player');
            return;
        }
        if (!journeyUpdateQueue) {
            console.error('ActionTrackingSystem: JourneyUpdateQueue component not found on gameState');
            return;
        }
        if (!achievements) {
            console.error('ActionTrackingSystem: PlayerAchievements component not found on player');
            return;
        }

        if (playerActionQueue.actions.length === 0) {
            return;
        }

        // Cache open tasks and types
        const openTypes = new Set();
        const taskMap = new Map();
        journeyPath.paths.forEach(path => {
            if (path.id === path.parentId || path.completed) return;
            path.tasks?.forEach(task => {
                if (task.completed) return;
                const type = task.completionCondition.type;
                if (!taskMap.has(type)) {
                    openTypes.add(type);
                    taskMap.set(type, []);
                }
                taskMap.get(type).push(task);
            });
        });

        // Process actions
        playerActionQueue.actions.forEach(action => {
            // Track Echo completions for completeEchoes tasks
            if (action.type === 'completeWhispers') {
                const path = journeyPath.paths.find(p => p.id === action.data.pathId);
                if (path && path.parentId === 'master_echoes') {
                    this.echoCounter += 1;
                    console.log(`ActionTrackingSystem: Incremented echoCounter to ${this.echoCounter}`);
                    if (this.echoCounter >= 5) {
                        this.utilities.pushPlayerActions('completeEchoes', { count: this.echoCounter });
                        console.log(`ActionTrackingSystem: Pushed completeEchoes with count ${this.echoCounter}`);
                        this.echoCounter = 0; // Reset for next set
                    }
                }
            }

            // Filter quest-relevant actions
            if (!openTypes.has(action.type)) {
                console.log(`ActionTrackingSystem: Skipped non-quest action ${action.type}`, action.data);
                return;
            }

            const tasks = taskMap.get(action.type) || [];
            for (const task of tasks) {
                if (this.matchesTask(action, task)) {
                    journeyUpdateQueue.queue.push({ ...action });
                    console.log(`ActionTrackingSystem: Forwarded ${action.type} to JourneyUpdateQueue`, action.data);
                }
            }
        });

        // Clear processed actions
        playerActionQueue.actions = [];
        console.log('ActionTrackingSystem: Cleared PlayerActionQueue actions');
    }

    matchesTask(action, task) {
        const condition = task.completionCondition;
        switch (action.type) {
            case 'collectResource':
                return condition.resourceType === action.data.resourceType &&
                    (condition.quantity <= action.data.quantity || !condition.quantity);
            case 'findItem':
            case 'collectItem':
                return condition.journeyItemId === action.data.journeyItemId ||
                    condition.itemId === action.data.itemId;
            case 'bossKill':
                return condition.tier === action.data.tier;
            case 'interactWithNPC':
                return condition.npc === action.data.npcId;
            case 'useItem':
                return condition.itemId === action.data.itemId;
            case 'reachTier':
                return condition.tier === action.data.tier;
            case 'completeEchoes':
                return condition.count <= action.data.count;
            case 'completeWhispers':
                return condition.pathId === action.data.pathId;
            case 'turnIn':
                return condition.taskId === action.data.taskId && condition.npc === action.data.npcId;
            default:
                console.warn(`ActionTrackingSystem: Unknown task type ${action.type}`);
                return false;
        }
    }
}