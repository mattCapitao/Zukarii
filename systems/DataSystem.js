// systems/DataSystem.js
// Manages static game data (monsters, items, levels)

import { System } from '../core/Systems.js';

export class DataSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = [];

        // Load random monsters from JSON file asynchronously
        console.log('DataSystem: Starting fetch for randomMonsters.json');
        this.randomMonstersPromise = fetch('data/json/randomMonsters.json')
            .then(response => {
                console.log('DataSystem: Fetch response received (randomMonsters):', response);
                if (!response.ok) {
                    throw new Error(`Failed to load randomMonsters.json: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('DataSystem: Successfully loaded randomMonsters.json:', data);
                return data;
            })
            .catch(error => {
                console.error('DataSystem: Failed to load randomMonsters.json:', error);
                console.log('DataSystem: Returning empty array as fallback for randomMonsters');
                return [];
            });

        // Load unique monsters from JSON file asynchronously
        console.log('DataSystem: Starting fetch for uniqueMonsters.json');
        this.uniqueMonstersPromise = fetch('data/json/uniqueMonsters.json')
            .then(response => {
                console.log('DataSystem: Fetch response received (uniqueMonsters):', response);
                if (!response.ok) {
                    throw new Error(`Failed to load uniqueMonsters.json: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('DataSystem: Successfully loaded uniqueMonsters.json:', data);
                return data;
            })
            .catch(error => {
                console.error('DataSystem: Failed to load uniqueMonsters.json:', error);
                console.log('DataSystem: Returning empty array as fallback for uniqueMonsters');
                return [];
            });

        // Load boss monsters from JSON file asynchronously
        console.log('DataSystem: Starting fetch for bossMonsters.json');
        this.bossMonstersPromise = fetch('data/json/bossMonsters.json')
            .then(response => {
                console.log('DataSystem: Fetch response received (bossMonsters):', response);
                if (!response.ok) {
                    throw new Error(`Failed to load bossMonsters.json: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('DataSystem: Successfully loaded bossMonsters.json:', data);
                return data;
            })
            .catch(error => {
                console.error('DataSystem: Failed to load bossMonsters.json:', error);
                console.log('DataSystem: Returning empty array as fallback for bossMonsters');
                return [];
            });

        // Load unique items from JSON file asynchronously
        console.log('DataSystem: Starting fetch for uniqueItems.json');
        this.uniqueItemsPromise = fetch('data/json/uniqueItems.json')
            .then(response => {
                console.log('DataSystem: Fetch response received:', response);
                if (!response.ok) {
                    throw new Error(`Failed to load uniqueItems.json: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('DataSystem: Successfully loaded uniqueItems.json:', data);
                return data;
            })
            .catch(error => {
                console.error('DataSystem: Failed to load uniqueItems.json:', error);
                console.log('DataSystem: Returning empty array as fallback for uniqueItems');
                return [];
            });

        // Custom surface level
        this.customSurfaceLevel = {
            map: this.generateSurfaceMap(),
            rooms: [{ left: 1, top: 1, w: 8, h: 8, x: 5, y: 5, type: 'SurfaceRoom', connections: [] }],
            stairsUp: { x: 2, y: 2 },
            stairsDown: { x: 5, y: 5 },
            playerSpawn: { x: 1, y: 1 },
            monsters: [],
            treasures: [],
            fountains: [],
            spawn: []
        };

        // Load item stat options from JSON file asynchronously
        console.log('DataSystem: Starting fetch for itemStatOptions.json');
        this.itemStatOptionsPromise = fetch('data/json/itemStatOptions.json')
            .then(response => {
                console.log('DataSystem: Fetch response received (itemStatOptions):', response);
                if (!response.ok) {
                    throw new Error(`Failed to load itemStatOptions.json: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('DataSystem: Successfully loaded itemStatOptions.json:', data);
                return data;
            })
            .catch(error => {
                console.error('DataSystem: Failed to load itemStatOptions.json:', error);
                console.log('DataSystem: Returning empty object as fallback for itemStatOptions');
                return {};
            });
    }

    init() {
        this.eventBus.on('GetCustomLevel', (data) => this.provideCustomLevel(data));
        this.eventBus.on('GetRandomMonsters', (data) => this.provideRandomMonsters(data));
        this.eventBus.on('GetUniqueMonsters', (data) => this.provideUniqueMonsters(data));
        this.eventBus.on('GetBossMonsters', (data) => this.provideBossMonsters(data));
        this.eventBus.on('GetUniqueItems', (data) => this.provideUniqueItems(data));
        this.eventBus.on('GetItemStatOptions', (data) => {
            this.provideItemStatOptions(data);
            console.log('DataSystem: GetItemStatOptions event received');
        });
        this.eventBus.on('RequestSaveGameToStorage', (data) => this.saveGame(data));
        this.eventBus.on('RequestLoadGameFromStorage', (data, callback) => this.loadGame(data, callback));
        this.eventBus.on('RequestSavedGamesList', (callback) => this.getSavedGamesList(callback));
    }

    // Updated: Make saveGame async
    async saveGame({ key, data }) {
        console.log('DataSystem: Attempting to save game with key:', key, 'data:', data);
        try {
            localStorage.setItem(key, JSON.stringify(data));
            console.log('DataSystem: Successfully saved game with key:', key);
            this.eventBus.emit('GameSaved', { key, success: true, message: `Game saved to ${key}` });
        } catch (error) {
            console.error('DataSystem: Failed to save game:', error);
            this.eventBus.emit('GameSaved', { key, success: false, message: 'Failed to save game' });
        }
        return Promise.resolve();
    }

    // Updated: Make loadGame async
    async loadGame({ key }, callback) {
        try {
            const savedData = localStorage.getItem(key);
            if (savedData) {
                const data = JSON.parse(savedData);
                callback(data);
            } else {
                callback(null);
            }
        } catch (error) {
            console.error('DataSystem: Failed to load game:', error);
            callback(null);
        }
        return Promise.resolve();
    }

    // Updated: Make getSavedGamesList async
    async getSavedGamesList(callback) {
        const savedGames = [];
        console.log('DataSystem: Fetching saved games from localStorage, total keys:', localStorage.length);
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            console.log('DataSystem: Processing key:', key);
            try {
                const data = JSON.parse(localStorage.getItem(key));
                savedGames.push({ key, data });
            } catch (error) {
                console.error(`DataSystem: Failed to parse saved game for key ${key}:`, error);
            }
        }
        console.log('DataSystem: Saved games fetched:', savedGames);
        callback(savedGames);
        return Promise.resolve();
    }

    generateSurfaceMap() {
        const state = this.entityManager.getEntity('state');
        let map = [];
        for (let y = 0; y < 67; y++) {
            map[y] = [];
            for (let x = 0; x < 122; x++) {
                if (y < 10 && x < 10) {
                    map[y][x] = (y === 0 || y === 9 || x === 0 || x === 9) ? '#' : ' ';
                } else {
                    map[y][x] = '#';
                }
            }
        }
        map[2][2] = '⇑';
        map[5][5] = '⇓';
        return map;
    }

    provideCustomLevel({ tier, callback }) {
        if (tier === 0) {
            callback(JSON.parse(JSON.stringify(this.customSurfaceLevel)));
        } else {
            callback(null);
        }
    }

    provideItemStatOptions({ callback }) {
        this.itemStatOptionsPromise
            .then(itemStatOptions => {
                console.log('DataSystem: Providing item stat options:', itemStatOptions);
                callback(JSON.parse(JSON.stringify(itemStatOptions)));
            })
            .catch(error => {
                console.error('DataSystem: Error providing item stat options:', error);
                callback({});
            });
    }

    async provideRandomMonsters({ callback }) {
        try {
            const randomMonsters = await this.randomMonstersPromise;
            console.log('DataSystem: Providing random monsters:', randomMonsters);
            callback(JSON.parse(JSON.stringify(randomMonsters)));
        } catch (error) {
            console.error('DataSystem: Error providing random monsters:', error);
            callback([]);
        }
    }

    async provideUniqueMonsters({ callback }) {
        try {
            const uniqueMonsters = await this.uniqueMonstersPromise;
            console.log('DataSystem: Providing unique monsters:', uniqueMonsters);
            callback(JSON.parse(JSON.stringify(uniqueMonsters)));
        } catch (error) {
            console.error('DataSystem: Error providing unique monsters:', error);
            callback([]);
        }
    }

    async provideBossMonsters({ callback }) {
        try {
            const bossMonsters = await this.bossMonstersPromise;
            console.log('DataSystem: Providing boss monsters:', bossMonsters);
            callback(JSON.parse(JSON.stringify(bossMonsters)));
        } catch (error) {
            console.error('DataSystem: Error providing boss monsters:', error);
            callback([]);
        }
    }

    async provideUniqueItems({ callback }) {
        try {
            const uniqueItems = await this.uniqueItemsPromise;
            console.log('DataSystem: Providing unique items:', uniqueItems);
            callback(JSON.parse(JSON.stringify(uniqueItems)));
        } catch (error) {
            console.error('DataSystem: Error providing unique items:', error);
            callback([]);
        }
    }
}