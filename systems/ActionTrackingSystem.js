import { System } from '../core/Systems.js';
import { PlayerActionQueueComponent, JourneyPathComponent, JourneyUpdateQueueComponent, PlayerAchievementsComponent } from '../core/Components.js';

export class ActionTrackingSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus);
        this.requiredComponents = [];
        this.utilities = utilities;
        this.echoCounter = 0;
    }

    init() {
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
                // Allow interactWithNPC actions for interactWithNPCFinal tasks
                if (type === 'interactWithNPCFinal') {
                    openTypes.add('interactWithNPC');
                    if (!taskMap.has('interactWithNPC')) {
                        taskMap.set('interactWithNPC', []);
                    }
                    taskMap.get('interactWithNPC').push(task);
                }
            });
        });

  
        playerActionQueue.actions.forEach(action => {
            if (action.type === 'completeWhispers') {
                const path = journeyPath.paths.find(p => p.id === action.data.pathId);
                if (path && path.parentId === 'master_echoes') {
                    this.echoCounter += 1;
                    console.log(`ActionTrackingSystem: Incremented echoCounter to ${this.echoCounter}`);
                    if (this.echoCounter >= 5) {
                        this.utilities.pushPlayerActions('completeEchoes', { count: this.echoCounter });
                        console.log(`ActionTrackingSystem: Pushed completeEchoes with count ${this.echoCounter}`);
                        this.echoCounter = 0;
                    }
                }
            }
            if (action.type === 'attemptStairs') {
                
                console.log(`ActionTrackingSystem: AttemptStairs action detected, fromTier: ${action.data.fromTier}, toTier: ${action.data.toTier}, success: ${action.data.success}`);
                console.log(`ActionTrackingSystem: JourneyPath`, journeyPath);
                console.log('ActionTrackingSystem: Processing actions', playerActionQueue.actions.length, 'openTypes:', Array.from(openTypes), 'taskMap size:', taskMap.size);

            }
            if (!openTypes.has(action.type)) {
                console.log(`ActionTrackingSystem: Skipped non-quest action ${action.type}`, action.data);
                return;
            }

            const tasks = taskMap.get(action.type) || [];
            for (const task of tasks) {
                if (this.matchesTask(action, task)) {
                    console.log(`ActionTrackingSystem: Task ${task.id} matches action ${action.type}`, { actionData: action.data, taskCondition: task.completionCondition });
                    if (task.id === 'whisper_child_2_4' || task.id === 'whisper_child_3_4') {
                        const path = journeyPath.paths.find(p => p.id === task.parentId);
                        console.log(`ActionTrackingSystem: Forwarding ${task.id}`, {
                            totalTaskCount: path.totalTaskCount,
                            completedTaskCount: path.completedTaskCount
                        });
                    }
                    journeyUpdateQueue.queue.push({ ...action });
                    console.log(`ActionTrackingSystem: Forwarded ${action.type} to JourneyUpdateQueue`, action.data);
                } else if (task.id === 'whisper_child_2_4' || task.id === 'whisper_child_3_4') {
                    console.log(`ActionTrackingSystem: Task ${task.id} did not match action ${action.type}`, {
                        actionData: action.data,
                        taskCondition: task.completionCondition
                    });
                }
            }
        });

        playerActionQueue.actions = [];
        console.log('ActionTrackingSystem: Cleared PlayerActionQueue actions');
    }

    matchesTask(action, task) {
        const condition = task.completionCondition;
        console.log(`ActionTrackingSystem: Matching task ${task.id} with action ${action.type}`, { condition, actionData: action.data });
        switch (action.type) {
            case 'collectResource':
                return condition.type === 'collectResource' &&
                    condition.resourceType === action.data.resourceType &&
                    (condition.quantity <= action.data.quantity || !condition.quantity);
            case 'findItem':
            case 'collectItem':
                return condition.journeyItemId === action.data.journeyItemId ||
                    condition.itemId === action.data.itemId;
            case 'brickKill':
                return condition.tier === action.data.tier;
            case 'interactWithNPC':
                if (condition.type === 'interactWithNPC') {
                    return condition.npc === action.data.npcId &&
                        action.data.taskId === task.id;
                } else if (condition.type === 'interactWithNPCFinal') {
                    const path = this.entityManager.getEntity('player').getComponent('JourneyPath').paths.find(p => p.id === task.parentId);
                    const isMatch = condition.npc === action.data.npcId &&
                        action.data.taskId === task.id &&
                        (path.completedTaskCount || 0) === (path.totalTaskCount || 0) - 1;
                    if (task.id === 'whisper_child_2_4') {
                        console.log(`ActionTrackingSystem: Evaluated whisper_child_2_4 for interactWithNPC`, {
                            matches: isMatch,
                            npcId: action.data.npcId,
                            taskId: action.data.taskId,
                            totalTaskCount: path.totalTaskCount,
                            completedTaskCount: path.completedTaskCount
                        });
                    }
                    return isMatch;
                }
                return false;
            case 'interactWithNPCFinal':
                const path = this.entityManager.getEntity('player').getComponent('JourneyPath').paths.find(p => p.id === task.parentId);
                const isMatch = condition.type === 'interactWithNPCFinal' &&
                    condition.npc === action.data.npcId &&
                    action.data.taskId === task.id &&
                    (path.completedTaskCount || 0) === (path.totalTaskCount || 0) - 1;
                if (task.id === 'whisper_child_2_4') {
                    console.log(`ActionTrackingSystem: Evaluated whisper_child_2_4`, {
                        matches: isMatch,
                        npcId: action.data.npcId,
                        taskId: action.data.taskId,
                        totalTaskCount: path.totalTaskCount,
                        completedTaskCount: path.completedTaskCount
                    });
                }
                return isMatch;
            case 'attemptStairs':
                const isAttemptMatch = condition.type === 'attemptStairs' &&
                    condition.fromTier === action.data.fromTier &&
                    condition.toTier === action.data.toTier &&
                    action.data.success === false;
                if (task.id === 'whisper_child_3_4') {
                    console.log(`ActionTrackingSystem: Evaluated whisper_child_3_4 for attemptStairs`, {
                        matches: isAttemptMatch,
                        fromTier: action.data.fromTier,
                        toTier: action.data.toTier,
                        success: action.data.success
                    });
                }
                return isAttemptMatch;
            case 'useItem':
                return condition.type === 'useItem' && condition.itemId === action.data.itemId;
            case 'reachTier':
                return condition.type === 'reachTier' && condition.tier === action.data.tier;
            case 'completeEchoes':
                return condition.type === 'completeEchoes' && condition.count <= action.data.count;
            case 'completeWhispers':
                return condition.type === 'completeWhispers' && condition.pathId === action.data.pathId;
            case 'turnIn':
                return condition.type === 'turnIn' && condition.taskId === action.data.taskId && condition.npc === action.data.npcId;
            default:
                console.warn(`ActionTrackingSystem: Unknown task type ${action.type}`);
                return false;
        }
    }
}