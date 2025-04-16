// systems/AudioSystem.js
import { System } from '../core/Systems.js';

export class AudioSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.soundBuffers = {};
        this.musicVolume = 0.05;
        this.torchVolume = 0.04;
        this.dingVolume = 0.1;
        this.sfxQueue = this.entityManager.getEntity('gameState').getComponent('SfxQueue').Sounds || [];
        this.backgroundMusicSource = null;
        this.torchBurningSource = null;
        this.preloadSounds();
    }

    init() {
        this.eventBus.on('PlayAudio', (data) => this.playAudio(data));
        this.eventBus.on('PlaySfx', (data) => {
            console.log('PlaySfx event received', data);
            this.playSfx(data);
        });
        this.eventBus.on('ToggleBackgroundMusic', (data) => this.playBackgroundMusic(data));
    }

    update(deltaTime) {
        if (this.sfxQueue.length > 0) {
            this.sfxQueue.forEach(({ sfx, volume }) => {
                console.log(`AudioSystem: Processing SfxQueue - Playing sfx: ${sfx} at Volume: ${volume}`);
                this.playSfx({ sfx, volume });
            });
            this.sfxQueue.length = 0;
            console.log('AudioSystem: Processed and cleared SfxQueue');
        }
    }

    async preloadSounds() {
        const soundFiles = {
            torchBurning: 'audio/torch-burning.mp3',
            backgroundMusic: 'audio/haunted.wav',
            ding: 'audio/ding.mp3',
            loot0: 'audio/loot/loot_0.wav',
            portal0: 'audio/portal/portal_0.wav',
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
                console.log(`AudioSystem: Preloaded ${key}`);
            } catch (error) {
                console.error(`AudioSystem: Failed to preload ${key} from ${path}:`, error);
            }
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

    playAudio({ sound, play = true }) {
        if (sound === 'torchBurning') {
            if (play) {
                if (this.torchBurningSource) {
                    this.torchBurningSource.stop();
                }
                if (this.soundBuffers.torchBurning) {
                    this.torchBurningSource = this.audioContext.createBufferSource();
                    this.torchBurningSource.buffer = this.soundBuffers.torchBurning;
                    this.torchBurningSource.loop = true;
                    const gainNode = this.audioContext.createGain();
                    gainNode.gain.value = this.torchVolume;
                    this.torchBurningSource.connect(gainNode);
                    gainNode.connect(this.audioContext.destination);
                    if (this.audioContext.state === 'suspended') {
                        this.audioContext.resume().then(() => {
                            this.torchBurningSource.start(0);
                            console.log('AudioSystem: Playing torchBurning');
                        }).catch(error => {
                            console.error('AudioSystem: Failed to resume AudioContext for torchBurning:', error);
                        });
                    } else {
                        this.torchBurningSource.start(0);
                        console.log('AudioSystem: Playing torchBurning');
                    }
                } else {
                    console.warn('AudioSystem: Sound buffer torchBurning not found');
                }
            } else if (this.torchBurningSource) {
                this.torchBurningSource.stop();
                this.torchBurningSource = null;
                console.log('AudioSystem: Stopped torchBurning');
            }
        } else if (sound === 'ding') {
            this.playSfx({ sfx: 'ding', volume: this.dingVolume });
        }
    }

    playBackgroundMusic({ play = true } = {}) {
        if (play) {
            if (this.backgroundMusicSource) {
                this.backgroundMusicSource.stop();
            }
            if (this.soundBuffers.backgroundMusic) {
                this.backgroundMusicSource = this.audioContext.createBufferSource();
                this.backgroundMusicSource.buffer = this.soundBuffers.backgroundMusic;
                this.backgroundMusicSource.loop = true;
                const gainNode = this.audioContext.createGain();
                gainNode.gain.value = this.musicVolume;
                this.backgroundMusicSource.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                if (this.audioContext.state === 'suspended') {
                    this.audioContext.resume().then(() => {
                        this.backgroundMusicSource.start(0);
                        console.log('AudioSystem: Playing backgroundMusic');
                    }).catch(error => {
                        console.error('AudioSystem: Failed to resume AudioContext for backgroundMusic:', error);
                    });
                } else {
                    this.backgroundMusicSource.start(0);
                    console.log('AudioSystem: Playing backgroundMusic');
                }
            } else {
                console.warn('AudioSystem: Sound buffer backgroundMusic not found');
            }
        } else if (this.backgroundMusicSource) {
            this.backgroundMusicSource.stop();
            this.backgroundMusicSource = null;
            console.log('AudioSystem: Stopped backgroundMusic');
        }
    }
}