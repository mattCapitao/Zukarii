import { Game } from './Game.js';


let gameInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded fired from main.js');
    gameInstance = new Game();
    window.game = gameInstance; // Expose for testing
});

