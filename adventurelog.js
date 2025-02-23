console.log("adventurelog.js loaded");

const adventureLog = {
    entries: [],
    maxEntries: 20
};

function writeToLog(message) {
    adventureLog.entries.unshift(message); // Add to the top
    if (adventureLog.entries.length > adventureLog.maxEntries) {
        adventureLog.entries.pop(); // Remove from the bottom
    }
}

function clearLog() {
    adventureLog.entries = [];
}

window.writeToLog = writeToLog;
window.clearLog = clearLog;