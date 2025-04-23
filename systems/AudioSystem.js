// systems/AudioSystem.js
import { System } from '../core/Systems.js';

export class AudioSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.soundBuffers = {};
        this.trackSources = new Map(); // Track sources for play/stop (e.g., torchBurning, backgroundMusic)
        this.preloadSounds();
    }

    init() {
        this.sfxQueue = this.entityManager.getEntity('gameState')?.getComponent('AudioQueue')?.SFX || [];
        this.trackControlQueue = this.entityManager.getEntity('gameState')?.getComponent('AudioQueue')?.TrackControl || [];
        this.eventBus.on('PlaySfxImmediate', ({ sfx, volume }) => {
            console.log(`AudioSystem: Immediate playback requested for sfx: ${sfx} at volume: ${volume}`);
            this.playSfx({ sfx, volume });
        });
        this.eventBus.on('PlayTrackControl', ({ track, play, volume }) => {
            this.playTrackControl({ track, play, volume });
        });
    }

    update(deltaTime) {
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        if (!gameState?.transitionLock && this.sfxQueue.length > 0) {
            this.sfxQueue.forEach(({ sfx, volume }) => {
                console.log(`AudioSystem: Processing AudioQueue - Playing sfx: ${sfx} at Volume: ${volume}`);
                this.playSfx({ sfx, volume });
            });
            this.sfxQueue.length = 0;
            console.log('AudioSystem: Processed and cleared AudioQueue SFX');
        }
        if (this.trackControlQueue.length > 0) {
            this.trackControlQueue.forEach(({ track, play, volume }) => {
                const playCommand = play ? 'play' : 'stop';
                console.log(`AudioSystem: Processing AudioQueue - Track Control ${playCommand} track: ${track} at Volume: ${volume}`);
                this.playTrackControl({ track, play, volume });
            });
            this.trackControlQueue.length = 0;
            console.log('AudioSystem: Processed and cleared AudioQueue TrackControl');
        }
    }

    playSfx({ sfx, volume }) {
        console.log(`AudioSystem: Playing sfx: ${sfx} at Volume: ${volume}`);
        if (!this.soundBuffers[sfx]) {
            console.warn(`AudioSystem: Sound buffer ${sfx} not found`);
            return;
        }
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume().then(() => {
                console.log(`AudioSystem: AudioContext resumed for ${sfx}`);
                this.scheduleSfx(sfx, volume);
            }).catch(error => {
                console.error(`AudioSystem: Failed to resume AudioContext for ${sfx}:`, error);
            });
        } else {
            this.scheduleSfx(sfx, volume);
        }
    }

    scheduleSfx(sfx, volume) {
        const source = this.audioContext.createBufferSource();
        source.buffer = this.soundBuffers[sfx];
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = volume;
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        source.start(0);
        console.log(`AudioSystem: Playback scheduled for ${sfx}`);
    }

    playTrackControl({ track, play = true, volume = 0.05 }) {
        if (play) {
            // Stop existing source if any
            if (this.trackSources.has(track)) {
                const existingSource = this.trackSources.get(track);
                existingSource.stop();
                this.trackSources.delete(track);
                console.log(`AudioSystem: Stopped existing ${track}`);
            }
            // Play new track if buffer exists
            if (this.soundBuffers[track]) {
                const source = this.audioContext.createBufferSource();
                source.buffer = this.soundBuffers[track];
                source.loop = true; // All tracks (torchBurning, backgroundMusic) loop
                const gainNode = this.audioContext.createGain();
                gainNode.gain.value = volume;
                source.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                if (this.audioContext.state === 'suspended') {
                    this.audioContext.resume().then(() => {
                        source.start(0);
                        this.trackSources.set(track, source);
                        console.log(`AudioSystem: Playing ${track} at Volume: ${volume}`);
                    }).catch(error => {
                        console.error(`AudioSystem: Failed to resume AudioContext for ${track}:`, error);
                    });
                } else {
                    source.start(0);
                    this.trackSources.set(track, source);
                    console.log(`AudioSystem: Playing ${track} at Volume: ${volume}`);
                }
            } else {
                console.warn(`AudioSystem: Sound buffer ${track} not found`);
            }
        } else {
            // Stop track if source exists
            if (this.trackSources.has(track)) {
                const source = this.trackSources.get(track);
                source.stop();
                this.trackSources.delete(track);
                console.log(`AudioSystem: Stopped ${track}`);
            }
        }
    }

    async preloadSounds() {
        const soundFiles = {
            torchBurning: 'audio/torch-burning.mp3',
            backgroundMusic: 'audio/haunted.wav',
            intro: 'audio/narration/intro.mp3',
            ding: 'audio/ding.mp3',
            loot0: 'audio/loot/loot_0.wav',
            portal0: 'audio/portal/portal_0.wav',
            portal1: 'audio/portal/portal_1.wav',
            bossLevel0: 'audio/boss/level/boss-level_0.wav',
            fountain0: 'audio/fountain/fountain_0.wav',
            firecast0: 'audio/spell/cast/firecast_0.wav',
            firehit0: 'audio/spell/hit/firehit_0.wav',
            miss0: 'audio/miss/miss_0.wav',
            miss1: 'audio/miss/miss_1.wav',
            miss2: 'audio/miss/miss_2.wav',
            miss3: 'audio/miss/miss_3.wav',
            miss4: 'audio/miss/miss_4.wav',
            miss5: 'audio/miss/miss_5.wav',
            miss6: 'audio/miss/miss_6.wav',
            miss7: 'audio/miss/miss_7.wav',
            miss8: 'audio/miss/miss_8.wav',
            block0: 'audio/block/block_0.wav',
            block1: 'audio/block/block_1.wav',
            block2: 'audio/block/block_2.wav',
            block3: 'audio/block/block_3.wav',
            block4: 'audio/block/block_4.wav',
            block5: 'audio/block/block_5.wav',
            block6: 'audio/block/block_6.wav',
            block7: 'audio/block/block_7.wav',
            block8: 'audio/block/block_8.wav',
            hit0: 'audio/hit/hit_0.wav',
            hit1: 'audio/hit/hit_1.wav',
            hit2: 'audio/hit/hit_2.wav',
            hit3: 'audio/hit/hit_3.wav',
            hit4: 'audio/hit/hit_4.wav',
            hit5: 'audio/hit/hit_5.wav',
            hit6: 'audio/hit/hit_6.wav',
            hit7: 'audio/hit/hit_7.wav',
            hit8: 'audio/hit/hit_8.wav',
            hit9: 'audio/hit/hit_9.wav',
            hit10: 'audio/hit/hit_10.wav',
            hit11: 'audio/hit/hit_11.wav',
            hit12: 'audio/hit/hit_12.wav',
            hit13: 'audio/hit/hit_13.wav',
            hit14: 'audio/hit/hit_14.wav',
            hit15: 'audio/hit/hit_15.wav',
            hit16: 'audio/hit/hit_16.wav',
            hit17: 'audio/hit/hit_17.wav',
            hit18: 'audio/hit/hit_18.wav',
            hit19: 'audio/hit/hit_19.wav',
            hit20: 'audio/hit/hit_20.wav',
            hit21: 'audio/hit/hit_21.wav',
            hit22: 'audio/hit/hit_22.wav',
            hit23: 'audio/hit/hit_23.wav',
            hit24: 'audio/hit/hit_24.wav',
            hit25: 'audio/hit/hit_25.wav',
            hit26: 'audio/hit/hit_26.wav'
        };

        for (const [key, path] of Object.entries(soundFiles)) {
            try {
                const response = await fetch(path);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const arrayBuffer = await response.arrayBuffer();
                this.soundBuffers[key] = await this.audioContext.decodeAudioData(arrayBuffer);
                //console.log(`AudioSystem: Preloaded ${key}`);
            } catch (error) {
                console.error(`AudioSystem: Failed to preload ${key} from ${path}:`, error);
            }
        }
        console.log('AudioSystem: sounds preloaded');
        this.eventBus.emit('AudioLoaded');
    }
}