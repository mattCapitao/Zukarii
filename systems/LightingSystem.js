// systems/LightingSystem.js - Updated
import { System } from '../core/Systems.js';
import { LightSourceComponent } from '../core/Components.js'; 

export class LightingSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus, utilities);
        this.requiredComponents = ['LightingState', 'LightSourceDefinitions'];
       
    }

    init() {
        this.RENDER_RADIUS_MODIFIER = 3;
        this.DEFAULT_VISIBLE_RADIUS = 3;
        this.trackControlQueue = this.entityManager.getEntity('gameState')?.getComponent('AudioQueue')?.TrackControl || [];
        this.eventBus.on('LightSourceActivated', (data) => this.activateLightSource(data));
        this.eventBus.on('LightExpired', () => this.checkExpiration());
        this.renderState = this.entityManager.getEntity('renderState')?.getComponent('RenderState');
    }

    update(deltaTime) {
       this.checkExpiration(deltaTime);
    }

    checkExpiration(deltaTime) {
        const lightingStateEntity = this.entityManager.getEntity('lightingState');
        const lightingState = lightingStateEntity.getComponent('LightingState');

        if (lightingState.isLit && lightingState.remainingDuration > 0) {

            const deltaMs = deltaTime * 1000;

            lightingState.remainingDuration -= (deltaMs / 1000);

            if (lightingState.remainingDuration <= 0) {
                lightingState.isLit = false;
                lightingState.expiresOnTurn = 0;
                lightingState.visibleRadius = this.DEFAULT_VISIBLE_RADIUS; // Default radius
                this.renderState.renderRadius = this.DEFAULT_VISIBLE_RADIUS + this.RENDER_RADIUS_MODIFIER;
                console.log(`LightingSystem: Torch expired, visibleRadius reset to ${lightingState.visibleRadius}`);
                this.utilities.logMessage({ channel: 'system',  message: 'The torch has burned out!' });
                this.trackControlQueue.push({ track: 'torchBurning', play: false, volume: 0 });
            }
        }
    }

    activateLightSource({ type , entityId = 'player' }) {
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
        lightingState.visibleRadius = visibleRadius; 
        this.renderState.renderRadius = visibleRadius + this.RENDER_RADIUS_MODIFIER;
        lightingState.remainingDuration = duration;

        console.log(`LightingSystem: Activated ${type} - visibleRadius: ${lightingState.visibleRadius}, expires on turn: ${lightingState.expiresOnTurn}`);
        this.trackControlQueue.push({ track: 'torchBurning', play: true, volume: .05 });
    }
}