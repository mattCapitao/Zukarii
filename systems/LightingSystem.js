// systems/LightingSystem.js - Updated
import { System } from '../core/Systems.js';

export class LightingSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['LightingState', 'LightSourceDefinitions'];
    }

    init() {
        this.eventBus.on('LightSourceActivated', (data) => this.activateLightSource(data));
        this.eventBus.on('TurnEnded', () => this.checkExpiration());
        console.log('LightingSystem: Initialized with EventBus:', this.eventBus);
        console.log('LightingSystem: Required components:', this.requiredComponents);
        console.log('LightingSystem: Event listeners initialized');
    }

    checkExpiration() {
        const lightingStateEntity = this.entityManager.getEntity('lightingState');
        const lightingState = lightingStateEntity.getComponent('LightingState');

        if (lightingState.isLit && lightingState.remainingDuration > 0) {
            lightingState.remainingDuration--;
            if (lightingState.remainingDuration <= 0) {
                lightingState.isLit = false;
                lightingState.expiresOnTurn = 0;
                lightingState.visibleRadius = 2; // Default radius
                console.log(`LightingSystem: Torch expired, visibleRadius reset to ${lightingState.visibleRadius}`);
                this.eventBus.emit('LightingStateChanged', { visibleRadius: lightingState.visibleRadius });
                this.eventBus.emit('LogMessage', { message: 'The torch has burned out!' });
                this.eventBus.emit('PlayAudio', { sound: 'torchBurning', play: false });
                this.eventBus.emit('RenderNeeded');
            }
        }
    }

    activateLightSource({ type }) {
        console.log('LightingSystem: Activating light source:', type);
        const lightingStateEntity = this.entityManager.getEntity('lightingState');
        const lightingState = lightingStateEntity.getComponent('LightingState');
        const definitions = lightingStateEntity.getComponent('LightSourceDefinitions').definitions;

        if (!definitions[type]) {
            console.warn(`LightingSystem: Unknown light source type: ${type}`);
            return;
        }

        const { duration, visibleRadius } = definitions[type];
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const currentTurn = gameState.turn || 0;

        lightingState.isLit = true;
        lightingState.expiresOnTurn = currentTurn + duration;
        lightingState.visibleRadius = visibleRadius; // Use fixed value from definitions (e.g., 4)
        lightingState.remainingDuration = duration;

        console.log(`LightingSystem: Activated ${type} - visibleRadius: ${lightingState.visibleRadius}, expires on turn: ${lightingState.expiresOnTurn}`);
        this.eventBus.emit('LightingStateChanged', { visibleRadius: lightingState.visibleRadius });
        this.eventBus.emit('PlayAudio', { sound: 'torchBurning', play: true });
        this.eventBus.emit('RenderNeeded');
    }
}