import { System } from '../core/Systems.js';

export class SplashSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.splash = document.getElementById('splash');
        this.canvas = document.getElementById('splash-canvas');
        this.ctx = this.canvas?.getContext('2d');
        this.width = 0;
        this.height = 0;
        this.portalParticles = [];
        this.tightPortalParticles = [];
        this.riftFlicker = 1;
        this.selectedIndex = 0;
        this.menuItems = [];
        this.isActive = true;
        this.animationFrameId = null;
        this.zuImg = new Image();
        this.karnImg = new Image();
        this.zukarathImg = new Image();
        this.caerVorythImg = new Image();
        this.vortexImg = new Image();
    }

    async init() {
        if (!this.splash || !this.canvas || !this.ctx) {
            throw new Error('SplashSystem: Splash or canvas elements not found');
        }

        console.log('SplashSystem: Initializing canvas - Width:', this.canvas.width, 'Height:', this.canvas.height);

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Initialize particles
        for (let i = 0; i < 50; i++) {
            this.portalParticles.push(this.createParticle());
        }
        for (let i = 0; i < 30; i++) {
            this.tightPortalParticles.push(this.createTightParticle());
        }

        // Load images with error handling
        this.zuImg.src = 'img/avatars/player.png';
        this.karnImg.src = 'img/avatars/player.png';
        this.zukarathImg.src = 'img/splash/zukarath.png';
        this.caerVorythImg.src = 'img/splash/caer-voryth.png';
        this.vortexImg.src = 'img/splash/vortex.png';

        // Debug image loading
        this.vortexImg.onload = () => {
            console.log('Vortex image loaded successfully:', this.vortexImg.src);
        };
        this.vortexImg.onerror = () => {
            console.error('Failed to load vortex image:', this.vortexImg.src);
        };

        // Setup menu interactions
        this.menuItems = document.querySelectorAll('.splash-menu li');
        if (this.menuItems.length === 0) {
            console.warn('SplashSystem: No menu items found');
        }
        this.updateSelection();
        this.setupEventListeners();

        // Wait for audio to load
        this.eventBus.on('AudioLoaded', () => {
            console.log('SplashSystem: Audio loaded, playing sounds');
            this.eventBus.emit('PlayTrackControl', { track: 'backgroundMusic', play: true, volume: 0.05 });
            setTimeout(() => this.eventBus.emit('PlaySfxImmediate', { sfx: 'portal0', volume: 0.05 }), 100);
            setTimeout(() => this.eventBus.emit('PlaySfxImmediate', { sfx: 'intro', volume: 0.25 }), 2500);
        });

        // Start animation loop
        this.animate();

        console.log('SplashSystem: Initialized');
    }

    createParticle() {
        return {
            x: this.width * 0.5 + (Math.random() * 150 - 75),
            y: this.height * 0.5 + (Math.random() * 150 - 75),
            radius: Math.random() * 5 + 2,
            angle: Math.random() * Math.PI * 2,
            speed: Math.random() * 4 + 2,
            opacity: Math.random() * 0.5 + 0.5
        };
    }

    createTightParticle() {
        return {
            x: this.width * 0.5 + (Math.random() * 50 - 25),
            y: this.height * 0.5 + (Math.random() * 50 - 25),
            radius: Math.random() * 4 + 1,
            angle: Math.random() * Math.PI * 2,
            speed: Math.random() * 2 + 1,
            opacity: Math.random() * 0.7 + 0.3
        };
    }

    resizeCanvas() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.portalParticles.forEach(p => {
            p.x = this.width * 0.5 + (Math.random() * 150 - 75);
            p.y = this.height * 0.5 + (Math.random() * 150 - 75);
        });
        this.tightPortalParticles.forEach(p => {
            p.x = this.width * 0.5 + (Math.random() * 50 - 25);
            p.y = this.height * 0.5 + (Math.random() * 50 - 25);
        });
        console.log('SplashSystem: Canvas resized - Width:', this.width, 'Height:', this.height);
    }

    animate() {
        if (!this.isActive) {
            console.log('SplashSystem: Animation loop stopped');
            return;
        }

        this.ctx.clearRect(0, 0, this.width, this.height);

        // Update animations
        this.riftFlicker = 0.6 + Math.sin(Date.now() * 0.005) * 0.4;

        // Draw centered vortex image with clockwise rotation (behind menu and particles)
        if (this.vortexImg.complete) {
            this.ctx.save();
            // Translate to the center of the image (pivot point for rotation)
            const vortexX = this.width * 0.5;
            const vortexY = this.height * 0.5;
            this.ctx.translate(vortexX, vortexY);
            // Apply clockwise rotation with normalized angle
            const angle = (Date.now() * 0.001) % (2 * Math.PI); // Slightly faster rotation
            this.ctx.rotate(angle);
            // Draw the image centered on the pivot point
            this.ctx.globalAlpha = 0.3;
            this.ctx.drawImage(this.vortexImg, -180, -180, 360, 360);
            this.ctx.restore();
            this.ctx.globalAlpha = 1;
            // Debug log to confirm animation loop

        } else {
            console.log('Vortex image not yet loaded');
        }

        // Draw Zukarath image in top-left corner
        if (this.zukarathImg.complete) {
            this.ctx.globalAlpha = 0.9;
            this.ctx.drawImage(this.zukarathImg, 0, 0, 1024, 680);
            this.ctx.globalAlpha = 1;
        }

        // Draw Caer-Voryth image in lower-right corner
        if (this.caerVorythImg.complete) {
            this.ctx.globalAlpha = 0.7;
            this.ctx.drawImage(this.caerVorythImg, this.width - 1024, this.height - 680, 1024, 680);
            this.ctx.globalAlpha = 1;
        }

        // Draw portal (spread-out vortex)
        this.portalParticles.forEach(p => {
            p.angle += 0.05;
            p.x += Math.cos(p.angle) * p.speed;
            p.y += Math.sin(p.angle) * p.speed;
            p.opacity -= 0.005;
            if (p.opacity <= 0) {
                Object.assign(p, this.createParticle());
            }
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(0, 102, 255, ${p.opacity})`;
            this.ctx.fill();
        });

        // Draw tight vortex
        this.tightPortalParticles.forEach(p => {
            p.angle += 0.07;
            p.x += Math.cos(p.angle) * p.speed;
            p.y += Math.sin(p.angle) * p.speed;
            p.opacity -= 0.004;
            if (p.opacity <= 0) {
                Object.assign(p, this.createTightParticle());
            }
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(0, 153, 255, ${p.opacity})`;
            this.ctx.fill();
        });

        // Draw Zu/Karn silhouettes with transparency
        if (this.zuImg.complete) {
            this.ctx.globalAlpha = 0.09;
            this.ctx.drawImage(this.zuImg, this.width * 0.5 - 272, this.height * 0.5, 144, 144);
            this.ctx.globalAlpha = 1;
        }
        if (this.karnImg.complete) {
            this.ctx.globalAlpha = 0.09;
            this.ctx.save();
            this.ctx.translate(this.width * 0.5 + 200, this.height * 0.5);
            this.ctx.scale(-1, 1);
            this.ctx.drawImage(this.karnImg, -72, 0, 144, 144);
            this.ctx.restore();
            this.ctx.globalAlpha = 1;
        }

        this.animationFrameId = requestAnimationFrame(() => this.animate());
    }

    setupEventListeners() {
        this.menuItems.forEach((item, index) => {
            item.addEventListener('click', () => {
                this.selectedIndex = index;
                this.eventBus.emit('PlaySfxImmediate', { sfx: 'ding', volume: 0.06 });
                this.updateSelection();
                this.handleSelection(index);
            });
        });

        this.handleKeydown = (e) => {
            if (!this.isActive) return;
            if (e.key === 'ArrowUp') {
                this.selectedIndex = (this.selectedIndex - 1 + this.menuItems.length) % this.menuItems.length;
                this.eventBus.emit('PlaySfxImmediate', { sfx: 'ding', volume: 0.06 });
                this.updateSelection();
            } else if (e.key === 'ArrowDown') {
                this.selectedIndex = (this.selectedIndex + 1) % this.menuItems.length;
                this.eventBus.emit('PlaySfxImmediate', { sfx: 'ding', volume: 0.06 });
                this.updateSelection();
            } else if (e.key === 'Enter') {
                this.handleSelection(this.selectedIndex);
            }
        };
        document.addEventListener('keydown', this.handleKeydown);
    }

    updateSelection() {
        this.menuItems.forEach((item, index) => {
            item.classList.toggle('selected', index === this.selectedIndex);
        });
    }

    handleSelection(index) {
        this.eventBus.emit('PlaySfxImmediate', { sfx: 'portal1', volume: 0.075 });
        if (index === 0) {
            this.isActive = false;
            this.splash.style.display = 'none';
            this.eventBus.emit('StartGame');
        } else if (index === 1) {
            this.eventBus.emit('ToggleOverlay', { tab: 'menu' });
            setTimeout(() => {
                const loadButton = document.getElementById('load-games-button');
                if (loadButton) {
                    loadButton.click();
                }
            }, 0);
        } else if (index === 2) {
            this.eventBus.emit('ToggleOverlay', { tab: 'menu' });
            setTimeout(() => {
                const optionsButton = document.getElementById('options-button');
                if (loadButton) {
                    optionsButton.click();
                }
            }, 0);
        } else if (index === 3) {
            this.splash.innerHTML = `
                <div class="splash-credits" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: #0f0; font-size: 1.5rem; background: rgba(20, 30, 20, 0.7); padding: 2rem; border: 0.125rem solid #0f0; border-radius: 0.625rem; animation: fadeIn 0.5s ease-in;">
                    <h2 style="font-size: 2rem; margin-bottom: 1rem;">Credits</h2>
                    <p>Creator / Game Director / Lead Engineer: Matt Capitao</p>
                    <p>Supporting AI - Architect / Engineer: Grok 3 (xAI)</p>
                    <p>Supporting AI - QA / Debug Engineer: GitHub Copilot</p>
                    <button id="back-to-menu" style="margin-top: 1rem; padding: 0.625rem; background: #2c672c; color: #0f0; border: 0.125rem solid #0f0; border-radius: 0.3125rem; cursor: pointer;">Back to Menu</button>
                </div>
            `;
            document.getElementById('back-to-menu').addEventListener('click', () => {
                this.splash.innerHTML = `
                    <canvas id="splash-canvas"></canvas>
                    <h1 class="splash-title">Zukarii: The Descent</h1>
                    <div class="splash-menu">
                        <ul>
                            <li class="selected">New Game</li>
                            <li>Load Game</li>
                            <li>Options</li>
                            <li>Credits</li>
                        </ul>
                    </div>
                    <div class="splash-lore">
                        Whispers yet echo
                    </div>
                `;
                this.canvas = document.getElementById('splash-canvas');
                this.ctx = this.canvas.getContext('2d');
                this.resizeCanvas();
                this.isActive = true;
                this.setupEventListeners();
                this.animate();
            });
        }
    }

    destroy() {
        window.removeEventListener('resize', this.resizeCanvas);
        document.removeEventListener('keydown', this.handleKeydown);
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        this.isActive = false;
        this.splash.style.display = 'none';
        console.log('SplashSystem: Destroyed');
    }
}