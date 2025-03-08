class AudioManager {
    constructor() {
        this.sounds = {};
        this.preloadSounds();
        this.musicVolume = 0.05;
        this.torchVolume = 0.04;
    }

    preloadSounds() {
        const soundFiles = {
           torchBurning: 'audio/torch-burning.mp3',
            backgroundMusic: 'audio/haunted.wav',
 
        };

        for (const [key, path] of Object.entries(soundFiles)) {
            this.sounds[key] = new Audio(path);
            this.sounds[key].preload = 'auto';

            const preloadHandler = () => {
                console.log(`${key} preloaded!`);
                this.sounds[key].removeEventListener('canplaythrough', preloadHandler);
            };
            this.sounds[key].addEventListener('canplaythrough', preloadHandler);
        }
    }

    playBackgroundMusic(play = true) {
        this.sounds.backgroundMusic.loop = true;
        this.sounds.backgroundMusic.volume = this.musicVolume;

        if (play) {
            this.sounds.backgroundMusic.play();
        } else {
            this.sounds.backgroundMusic.pause();
        }
    }

    playTorch(play = true) {
        if (play) {
            this.sounds.torchBurning.loop = true;
            this.sounds.torchBurning.volume = this.torchVolume;
            this.sounds.torchBurning.play();
        } else {
            this.sounds.torchBurning.pause();
        }
    }
}
