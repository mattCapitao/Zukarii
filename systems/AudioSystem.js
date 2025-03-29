// systems/AudioSystem.js
import { System } from '../core/Systems.js';

export class AudioSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.sounds = {};
        this.musicVolume = 0.05;
        this.torchVolume = 0.04;
        this.dingVolume = 0.1;
        this.preloadSounds();
    }

    init() {
        this.eventBus.on('PlayAudio', (data) => this.playAudio(data));
        this.eventBus.on('ToggleBackgroundMusic', (data) => this.playBackgroundMusic(data));
    }

    preloadSounds() {
        const soundFiles = {
            torchBurning: 'audio/torch-burning.mp3',
            backgroundMusic: 'audio/haunted.wav',
            ding: 'audio/ding.mp3'
        };

        for (const [key, path] of Object.entries(soundFiles)) {
            this.sounds[key] = new Audio(path);
            this.sounds[key].preload = 'auto';
            this.sounds[key].addEventListener('canplaythrough', () => { });
        }
    }

    playAudio({ sound, play = true }) {
        if (!this.sounds[sound]) return;

        if (sound === 'torchBurning') {
            this.sounds.torchBurning.loop = true;
            this.sounds.torchBurning.volume = this.torchVolume;
            play ? this.sounds.torchBurning.play() : this.sounds.torchBurning.pause();
            console.log('AudioSystem: Playing torchBurning');
        }
        if (sound === 'ding') {
            this.sounds.ding.volume = this.dingVolume;
            this.sounds.ding.play();
        }
    }

    playBackgroundMusic({ play = true } = {}) {
        this.sounds.backgroundMusic.loop = true;
        this.sounds.backgroundMusic.volume = this.musicVolume;
        play ? this.sounds.backgroundMusic.play() : this.sounds.backgroundMusic.pause();
    }
}