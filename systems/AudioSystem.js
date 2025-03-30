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
        this.eventBus.on('PlaySfx', (data) => {
            console.log('PlaySfx event received', data);
            this.playSfx(data);

        });
        this.eventBus.on('ToggleBackgroundMusic', (data) => this.playBackgroundMusic(data));
    }

    preloadSounds() {
        const soundFiles = {
            torchBurning: 'audio/torch-burning.mp3',
            backgroundMusic: 'audio/haunted.wav',
            ding: 'audio/ding.mp3',
            loot0: 'audio/loot/loot_0.wav',
            portal0: 'audio/portal/portal_0.wav',
            //spellcasting sfx
            firecast0: 'audio/spell/cast/firecast_0.wav',
            firehit0: 'audio/spell/hit/firehit_0.wav',
            //Miss Sfx
            miss0: 'audio/miss/miss_0.wav',
            miss1: 'audio/miss/miss_1.wav',
            miss2: 'audio/miss/miss_2.wav',
            miss3: 'audio/miss/miss_3.wav',
            miss4: 'audio/miss/miss_4.wav',
            miss5: 'audio/miss/miss_5.wav',
            miss6: 'audio/miss/miss_6.wav',
            miss7: 'audio/miss/miss_7.wav',
            miss8: 'audio/miss/miss_8.wav',
            //Block Sfx
            block0: 'audio/block/block_0.wav',
            block1: 'audio/block/block_1.wav',
            block2: 'audio/block/block_2.wav',
            block3: 'audio/block/block_3.wav',
            block4: 'audio/block/block_4.wav',
            block5: 'audio/block/block_5.wav',
            block6: 'audio/block/block_6.wav',
            block7: 'audio/block/block_7.wav',
            block8: 'audio/block/block_8.wav',
            //Hit Sfx
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
            hit26: 'audio/hit/hit_26.wav',


        };

        for (const [key, path] of Object.entries(soundFiles)) {
            this.sounds[key] = new Audio(path);
            this.sounds[key].preload = 'auto';
            this.sounds[key].addEventListener('canplaythrough', () => { });
        }
        console.log('AudioSystem: Preloaded sounds', soundFiles);
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

    playSfx({sfx, volume}) {
        console.log(`AudioSystem: Playing sfx: ${sfx} at Volume: ${volume}`, );

        if (!this.sounds[sfx]) {
            console.warn(`AudioSystem: Sound effect ${sfx} not found`);
            return;
        }
        this.sounds[sfx].volume = volume;
        this.sounds[sfx].play();
    }

    playBackgroundMusic({ play = true } = {}) {
        this.sounds.backgroundMusic.loop = true;
        this.sounds.backgroundMusic.volume = this.musicVolume;
        play ? this.sounds.backgroundMusic.play() : this.sounds.backgroundMusic.pause();
    }
}