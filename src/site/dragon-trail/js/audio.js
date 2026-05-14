// Dragon Trail Web - Audio System
// Web Audio API for synthesized SFX + HTML5 Audio for background music

const AudioSystem = {
    ctx: null,
    musicMuted: false,
    sfxMuted: false,
    currentMusicTrack: null,
    analyser: null,
    dataArray: null,
    visualizerBars: null,
    visualizerInterval: null,

    // Initialize Web Audio API
    init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.ctx.createAnalyser();
            this.analyser.fftSize = 64;
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            this.visualizerBars = document.querySelectorAll('.audio-visualizer .bar');
            return true;
        } catch (e) {
            console.warn('Web Audio API not available:', e);
            return false;
        }
    },

    // Synthesize a UI beep
    beep(freq = 440, duration = 50, type = 'sine', volume = 0.1) {
        if (!this.ctx || this.sfxMuted) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration / 1000);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration / 1000);
    },

    // Typing sound (randomized clicks)
    typeSound() {
        if (!this.ctx || this.sfxMuted) return;
        const freq = Utils.randInt(800, 1200);
        this.beep(freq, 15, 'square', 0.03);
    },

    // Combat hit sound (noise burst)
    hitSound() {
        if (!this.ctx || this.sfxMuted) return;
        const bufferSize = this.ctx.sampleRate * 0.1;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start();
    },

    // Miss sound (swish)
    missSound() {
        if (!this.ctx || this.sfxMuted) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
    },

    // Victory sound (ascending arpeggio)
    victorySound() {
        if (!this.ctx || this.sfxMuted) return;
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
            setTimeout(() => this.beep(freq, 120, 'sine', 0.12), i * 100);
        });
    },

    // Defeat sound (descending)
    defeatSound() {
        if (!this.ctx || this.sfxMuted) return;
        const notes = [400, 350, 300, 200];
        notes.forEach((freq, i) => {
            setTimeout(() => this.beep(freq, 200, 'sawtooth', 0.08), i * 150);
        });
    },

    // Level up / XP sound
    xpSound() {
        if (!this.ctx || this.sfxMuted) return;
        this.beep(880, 80, 'sine', 0.1);
        setTimeout(() => this.beep(1100, 120, 'sine', 0.12), 80);
    },

    // Potion drink sound
    potionSound() {
        if (!this.ctx || this.sfxMuted) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.4);
    },

    // Error / invalid input sound
    errorSound() {
        if (!this.ctx || this.sfxMuted) return;
        this.beep(150, 100, 'sawtooth', 0.08);
    },

    // Menu select sound
    menuSound() {
        if (!this.ctx || this.sfxMuted) return;
        this.beep(660, 40, 'sine', 0.06);
    },

    // Music playback via HTML5 Audio
    playMusic(trackName) {
        if (this.musicMuted) return;
        const audioEl = document.getElementById(`music-${trackName}`);
        if (!audioEl) return;
        if (this.currentMusicTrack && this.currentMusicTrack !== audioEl) {
            this.currentMusicTrack.pause();
            this.currentMusicTrack.currentTime = 0;
        }
        this.currentMusicTrack = audioEl;
        audioEl.play().catch(() => {
            // Audio play failed (browser policy)
        });
        this.startVisualizer();
    },

    stopMusic() {
        if (this.currentMusicTrack) {
            this.currentMusicTrack.pause();
            this.currentMusicTrack.currentTime = 0;
            this.currentMusicTrack = null;
        }
        this.stopVisualizer();
    },

    toggleMusic() {
        this.musicMuted = !this.musicMuted;
        if (this.musicMuted) {
            this.stopMusic();
            Terminal.println('Music muted.', 'yellow');
        } else {
            Terminal.println('Music unmuted.', 'green');
        }
    },

    toggleSfx() {
        this.sfxMuted = !this.sfxMuted;
        Terminal.println(this.sfxMuted ? 'SFX muted.' : 'SFX unmuted.', 'yellow');
    },

    // Visualizer animation
    startVisualizer() {
        if (!this.analyser || !this.visualizerBars.length) return;
        document.querySelector('.audio-visualizer').classList.add('active');
        this.visualizerInterval = setInterval(() => {
            if (!this.analyser) return;
            this.analyser.getByteFrequencyData(this.dataArray);
            const step = Math.floor(this.dataArray.length / this.visualizerBars.length);
            for (let i = 0; i < this.visualizerBars.length; i++) {
                const value = this.dataArray[i * step] || 0;
                const height = Math.max(2, (value / 255) * 20);
                this.visualizerBars[i].style.height = `${height}px`;
            }
        }, 50);
    },

    stopVisualizer() {
        if (this.visualizerInterval) {
            clearInterval(this.visualizerInterval);
            this.visualizerInterval = null;
        }
        document.querySelector('.audio-visualizer').classList.remove('active');
        for (const bar of this.visualizerBars || []) {
            bar.style.height = '2px';
        }
    },

    // Resume audio context (required after user interaction)
    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }
};

// Convenience global
const Audio = AudioSystem;
