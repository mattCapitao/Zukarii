import { Game } from './game.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded fired from main.js');
    const gameInstance = new Game();
    gameInstance.init();
});
