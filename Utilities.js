//console.log("Utilities.js loaded");

export class Utilities {
    constructor() {
        this.entityManager = null; 
        this.eventBus = null;
    } 

    pushPlayerActions(actionType, actionData) {
        if (!this.entityManager) {
            console.error('Utilities: entityManager not initialized');
            return;
        }
        const playerActionQueue = this.entityManager.getEntity('player').getComponent('PlayerActionQueue');
        if (!playerActionQueue) {
            console.error(`Utilities: PlayerActionQueue component not found on player`);
            return;
        }
        const action = { type: actionType, data: actionData, timestamp: Date.now() };
        playerActionQueue.actions.push(action);
        console.warn(`Utilities: Pushed ${actionType} to PlayerActionQueue`, action);
    }


    camelToTitleCase(str) {
        return str
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    }

    generateUniqueId() {
        const time = Date.now().toString(36);
        const rand1 = Math.random().toString(36).substring(2, 8);
        const rand2 = Math.random().toString(36).substring(2, 8);
        return `${time}-${rand1}-${rand2}`;
    }

    encodeHTMLEntities(text) {
        return text.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    getRandomName(names) {
        if (!Array.isArray(names) || names.length === 0) {
            return undefined;
        }
        const randomIndex = Math.floor(Math.random() * names.length);
        return names[randomIndex];
    }

    escapeJsonString(str) {
        return str.replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');
    }

    dRoll(dieSize, rollCount = 1, plus=0) {

        let total = plus; let roll = 0;
        let rollText = `Rolling ${rollCount} D${dieSize} + ${plus} : `;

        for (let i = 0; i < rollCount; i++) {
            roll= Math.floor(Math.random() * dieSize) + 1;
            total += roll;
            rollText += `R${i}:${roll} : `;
        }
        rollText += `Total: ${total}`;
        return total;
    }

    // Add a path to a JourneyPathComponent's paths array
    addPath(journeyPathComponent, path) {
        journeyPathComponent.paths.push({
            id: path.id || '',
            parentId: path.parentId || '',
            nextPathId: path.nextPathId || '',
            completed: path.completed || false,
            title: path.title || '',
            description: path.description || '',
            completionCondition: path.completionCondition || null,
            rewards: path.rewards || [],
            completionText: path.completionText || '',
            logCompletion: path.logCompletion !== undefined ? path.logCompletion : true
        });
    }

    // Remove a path from a JourneyPathComponent's paths array by ID
    removePath(journeyPathComponent, pathId) {
        journeyPathComponent.paths = journeyPathComponent.paths.filter(path => path.id !== pathId);
    }

    // Find a path in a JourneyPathComponent's paths array by ID
    findPath(journeyPathComponent, pathId) {
        return journeyPathComponent.paths.find(path => path.id === pathId) || null;
    }

    findPortalOnTier(tier) {
        // 1. Find the level entity for the given tier
        const levelEntity = this.entityManager.getEntitiesWith(['Tier'])
            .find(e => e.getComponent('Tier').value === tier);
        if (!levelEntity) {
            console.warn(`No level entity found for tier ${tier}`);
            return null;
        }

        // 2. Get the EntityListComponent and its portals array
        const entityList = levelEntity.getComponent('EntityList');
        if (!entityList || !Array.isArray(entityList.portals) || entityList.portals.length === 0) {
            console.warn(`No portals found in tier ${tier} EntityList`);
            return null;
        }

        // 3. Return the first portal entity (or all if you want to return an array)
        const portalId = entityList.portals[0];
        const portalEntity = this.entityManager.getEntity(portalId);
        if (!portalEntity) {
            console.warn(`Portal entity with ID ${portalId} not found`);
            return null;
        }
        return portalEntity;
    }

    logMessage(logData) {
        if (!logData || typeof logData !== 'object' || !logData.message) {
            console.error("Invalid log data provided. Expected an object.");
            return;
        }
        // Default entityId to "player" if not provided
        const entityId = logData.entityId || 'player';
        const channel = logData.channel || 'system';
        const message = logData.message;
        const timestamp = Date.now(); // Generate timestamp at write time

        // Get the entity’s log component (implementation depends on your ECS)
        const logEntity = this.entityManager.getEntity(entityId);
        const logComponent = logEntity.getComponent('Log');

        // Add the log entry
        logComponent.messages.unshift({channel, message, timestamp });

        // Optional: Limit log size to prevent memory issues
        if (logComponent.messages.length > 200) {
            logComponent.messages.pop(); // Remove oldest entry
        }
        this.eventBus.emit('LogUpdated');
    }

    getLogMessages(options = {}) {
        const entityId = options.entityId || "player";
        const channel = options.channel || "all";
        const limit = options.limit || null;

        const entity = this.entityManager.getEntity(entityId);
        if (!entity) {
            console.error(`Entity with ID ${entityId} not found.`);
            return [];
        }

        const logComponent = entity.getComponent("Log");
        if (!logComponent) {
            console.error(`Entity ${entityId} does not have a Log component.`);
            return [];
        }

        let messages = logComponent.messages;

        if (channel !== "all") {

            const channels = typeof channel === "string" ? [channel] : channel;
            if (!Array.isArray(channels)) {
                console.error("Invalid channel parameter. Must be a string or an array of strings.");
                return [];
            }
            if (!channels.every(ch => typeof ch === "string")) {
                console.error("Channel array must contain only strings.");
                return [];
            }
            messages = messages.filter(msg => channels.includes(msg.channel));
        }

        if (limit !== null) {
            messages = messages.slice(0, limit);
        }

        return messages;
    }


}