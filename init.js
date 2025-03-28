import { Game } from './Game.js';
import { EventBus } from './core/EventBus.js';

let gameInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded fired from main.js');
    gameInstance = new Game();
    window.game = gameInstance; // Expose for testing
});
/*
// New: Function to restart the game with an optional saveId
window.restartGame = (saveId = null) => {
    console.log('init.js: Restarting game with saveId:', saveId);
    if (gameInstance) {
        gameInstance.destroy(); // Clean up the old instance
        gameInstance = null;
        window.game = null;
    }
    //EventBus.clear(); // Clear all event listeners
    gameInstance = new Game(saveId);
    window.game = gameInstance;
};
*/
