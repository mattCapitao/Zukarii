//console.log("Utilities.js loaded");

export class Utilities {
    constructor() {
        this.entityManager = null; 
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
}