/**
 * App Timer - Sistema di timing centralizzato per l'applicazione
 * Gestisce il tempo globale, trasporto e sincronizzazione di tutti i moduli
 * Fornisce interfaccia grafica per controllo tempo e visualizzazione BPM
 */

class AppTimer {
    constructor(options = {}) {
        // Audio Context
        this.audioContext = options.audioContext || new (window.AudioContext || window.webkitAudioContext)();
        
        // Timing Properties
        this.isPlaying = false;
        this.isPaused = false;
        this.tempo = options.tempo || 120; // BPM
        this.timeSignature = options.timeSignature || { numerator: 4, denominator: 4 };
        this.subdivision = options.subdivision || 16; // 16th notes
        
        // Transport
        this.currentBar = 1;
        this.currentBeat = 1;
        this.currentTick = 0;
        this.totalBars = options.totalBars || 8;
        
        // Timing calculation
        this.ticksPerBeat = 96; // Standard MIDI resolution
        this.startTime = 0;
        this.pauseTime = 0;
        this.elapsedTime = 0;
        
        // Callbacks and subscribers
        this.subscribers = new Map();
        this.onTick = null;
        this.onBeat = null;
        this.onBar = null;
        
        // Visual UI
        this.ui = null;
        this.updateInterval = null;
        
        // Loop settings
        this.isLooping = options.isLooping !== false;
        this.loopStart = { bar: 1, beat: 1, tick: 0 };
        this.loopEnd = { bar: this.totalBars, beat: this.timeSignature.numerator, tick: 0 };
        
        this.init();
    }

    async init() {
        // Resume audio context if needed
        if (this.audioContext.state === 'suspended') {
            // Will be resumed on first user interaction
        }
        
        this.createUI();
        this.setupEventListeners();
    }

    // ============ TRANSPORT CONTROLS ============

    async play() {
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        if (!this.isPlaying) {
            this.isPlaying = true;
            this.isPaused = false;
            this.startTime = this.audioContext.currentTime - this.elapsedTime;
            
            this.notifySubscribers('play', { time: this.audioContext.currentTime });
            this.startTimingLoop();
            this.updateUI();
        }
    }

    pause() {
        if (this.isPlaying) {
            this.isPlaying = false;
            this.isPaused = true;
            this.elapsedTime = this.audioContext.currentTime - this.startTime;
            
            this.notifySubscribers('pause', { time: this.audioContext.currentTime });
            this.stopTimingLoop();
            this.updateUI();
        }
    }

    stop() {
        this.isPlaying = false;
        this.isPaused = false;
        this.elapsedTime = 0;
        this.currentBar = 1;
        this.currentBeat = 1;
        this.currentTick = 0;
        
        this.notifySubscribers('stop', { time: this.audioContext.currentTime });
        this.stopTimingLoop();
        this.updateUI();
    }

    // ============ TIMING CALCULATIONS ============

    calculatePosition() {
        if (!this.isPlaying) return;

        const currentTime = this.audioContext.currentTime;
        const totalElapsed = currentTime - this.startTime;
        
        // Calculate total ticks elapsed
        const beatsPerSecond = this.tempo / 60;
        const ticksPerSecond = beatsPerSecond * this.ticksPerBeat;
        const totalTicks = Math.floor(totalElapsed * ticksPerSecond);
        
        // Convert to bars, beats, ticks
        const ticksPerBar = this.ticksPerBeat * this.timeSignature.numerator;
        
        let bars = Math.floor(totalTicks / ticksPerBar);
        let remainingTicks = totalTicks % ticksPerBar;
        let beats = Math.floor(remainingTicks / this.ticksPerBeat);
        let ticks = remainingTicks % this.ticksPerBeat;

        // Handle looping
        if (this.isLooping) {
            const loopLengthBars = this.loopEnd.bar - this.loopStart.bar + 1;
            if (bars >= this.loopStart.bar - 1) {
                const relativeBars = (bars - (this.loopStart.bar - 1)) % loopLengthBars;
                bars = this.loopStart.bar - 1 + relativeBars;
            }
        }

        this.currentBar = bars + 1;
        this.currentBeat = beats + 1;
        this.currentTick = ticks;

        return {
            bar: this.currentBar,
            beat: this.currentBeat,
            tick: this.currentTick,
            totalTicks,
            time: currentTime
        };
    }

    startTimingLoop() {
        if (this.updateInterval) return;
        
        const update = () => {
            if (!this.isPlaying) return;
            
            const position = this.calculatePosition();
            this.notifySubscribers('tick', position);
            this.updateUI();
            
            this.updateInterval = requestAnimationFrame(update);
        };
        
        this.updateInterval = requestAnimationFrame(update);
    }

    stopTimingLoop() {
        if (this.updateInterval) {
            cancelAnimationFrame(this.updateInterval);
            this.updateInterval = null;
        }
    }

    // ============ CONFIGURATION ============

    setTempo(bpm) {
        const oldTempo = this.tempo;
        this.tempo = Math.max(30, Math.min(300, bpm));
        
        // Adjust elapsed time to maintain position
        if (this.isPlaying) {
            const ratio = oldTempo / this.tempo;
            this.startTime = this.audioContext.currentTime - (this.elapsedTime * ratio);
        }
        
        this.notifySubscribers('tempoChange', { tempo: this.tempo, oldTempo });
        this.updateUI();
        return this.tempo;
    }

    setTimeSignature(numerator, denominator) {
        this.timeSignature = { numerator, denominator };
        this.notifySubscribers('timeSignatureChange', this.timeSignature);
        this.updateUI();
    }

    setLooping(enabled) {
        this.isLooping = enabled;
        this.notifySubscribers('loopChange', { enabled: this.isLooping });
        this.updateUI();
    }

    setLoopRegion(startBar, endBar) {
        this.loopStart.bar = Math.max(1, startBar);
        this.loopEnd.bar = Math.min(this.totalBars, endBar);
        this.notifySubscribers('loopRegionChange', { 
            start: this.loopStart, 
            end: this.loopEnd 
        });
        this.updateUI();
    }

    // ============ SUBSCRIBER SYSTEM ============

    subscribe(id, callback) {
        this.subscribers.set(id, callback);
    }

    unsubscribe(id) {
        this.subscribers.delete(id);
    }

    notifySubscribers(event, data) {
        this.subscribers.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                console.error('Error in timer subscriber:', error);
            }
        });
    }

    // ============ UI CREATION ============

    createUI() {
        // Create timer UI container
        const timerContainer = document.createElement('div');
        timerContainer.className = 'app-timer-container';
        timerContainer.innerHTML = `
            <div class="timer-transport">
                <button class="timer-btn timer-stop" data-action="stop">⏹</button>
                <button class="timer-btn timer-play" data-action="play">▶</button>
                <button class="timer-btn timer-pause" data-action="pause">⏸</button>
            </div>
            
            <div class="timer-display">
                <div class="timer-position">
                    <span class="position-bars">001</span>:
                    <span class="position-beats">1</span>:
                    <span class="position-ticks">000</span>
                </div>
                <div class="timer-tempo">
                    <input type="number" class="tempo-input" min="30" max="300" value="${this.tempo}">
                    <span class="tempo-label">BPM</span>
                </div>
            </div>
            
            <div class="timer-controls">
                <label class="timer-control">
                    <input type="checkbox" class="loop-toggle" ${this.isLooping ? 'checked' : ''}>
                    <span>Loop</span>
                </label>
                <div class="time-signature">
                    <input type="number" class="sig-numerator" min="1" max="16" value="${this.timeSignature.numerator}">
                    <span>/</span>
                    <input type="number" class="sig-denominator" min="1" max="16" value="${this.timeSignature.denominator}">
                </div>
            </div>
        `;

        // Add to page
        document.body.insertBefore(timerContainer, document.body.firstChild);
        this.ui = timerContainer;
    }

    setupEventListeners() {
        if (!this.ui) return;

        // Transport controls
        this.ui.querySelector('.timer-play').addEventListener('click', () => this.play());
        this.ui.querySelector('.timer-pause').addEventListener('click', () => this.pause());
        this.ui.querySelector('.timer-stop').addEventListener('click', () => this.stop());

        // Tempo control
        const tempoInput = this.ui.querySelector('.tempo-input');
        tempoInput.addEventListener('change', (e) => {
            this.setTempo(parseInt(e.target.value));
        });

        // Loop toggle
        const loopToggle = this.ui.querySelector('.loop-toggle');
        loopToggle.addEventListener('change', (e) => {
            this.setLooping(e.target.checked);
        });

        // Time signature
        const sigNum = this.ui.querySelector('.sig-numerator');
        const sigDen = this.ui.querySelector('.sig-denominator');
        
        sigNum.addEventListener('change', (e) => {
            this.setTimeSignature(parseInt(e.target.value), this.timeSignature.denominator);
        });
        
        sigDen.addEventListener('change', (e) => {
            this.setTimeSignature(this.timeSignature.numerator, parseInt(e.target.value));
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;
            
            switch(e.code) {
                case 'Space':
                    e.preventDefault();
                    this.isPlaying ? this.pause() : this.play();
                    break;
                case 'Enter':
                    e.preventDefault();
                    this.stop();
                    break;
            }
        });
    }

    updateUI() {
        if (!this.ui) return;

        // Update position display
        const bars = String(this.currentBar).padStart(3, '0');
        const beats = String(this.currentBeat);
        const ticks = String(this.currentTick).padStart(3, '0');

        this.ui.querySelector('.position-bars').textContent = bars;
        this.ui.querySelector('.position-beats').textContent = beats;
        this.ui.querySelector('.position-ticks').textContent = ticks;

        // Update transport button states
        const playBtn = this.ui.querySelector('.timer-play');
        const pauseBtn = this.ui.querySelector('.timer-pause');
        const stopBtn = this.ui.querySelector('.timer-stop');

        playBtn.classList.toggle('active', this.isPlaying);
        pauseBtn.classList.toggle('active', this.isPaused);
        stopBtn.classList.toggle('active', !this.isPlaying && !this.isPaused);

        // Update tempo display
        this.ui.querySelector('.tempo-input').value = this.tempo;
    }

    // ============ PUBLIC API ============

    getCurrentPosition() {
        return {
            bar: this.currentBar,
            beat: this.currentBeat,
            tick: this.currentTick,
            tempo: this.tempo,
            isPlaying: this.isPlaying,
            isPaused: this.isPaused,
            timeSignature: { ...this.timeSignature }
        };
    }

    getAudioContext() {
        return this.audioContext;
    }

    // Utility methods
    barBeatTickToSeconds(bar, beat, tick) {
        const totalTicks = ((bar - 1) * this.timeSignature.numerator + (beat - 1)) * this.ticksPerBeat + tick;
        const beatsPerSecond = this.tempo / 60;
        const ticksPerSecond = beatsPerSecond * this.ticksPerBeat;
        return totalTicks / ticksPerSecond;
    }

    secondsToBarBeatTick(seconds) {
        const beatsPerSecond = this.tempo / 60;
        const ticksPerSecond = beatsPerSecond * this.ticksPerBeat;
        const totalTicks = Math.floor(seconds * ticksPerSecond);
        
        const ticksPerBar = this.ticksPerBeat * this.timeSignature.numerator;
        const bars = Math.floor(totalTicks / ticksPerBar) + 1;
        const remainingTicks = totalTicks % ticksPerBar;
        const beats = Math.floor(remainingTicks / this.ticksPerBeat) + 1;
        const ticks = remainingTicks % this.ticksPerBeat;
        
        return { bar: bars, beat: beats, tick: ticks };
    }

    // Cleanup
    destroy() {
        this.stop();
        this.subscribers.clear();
        if (this.ui) {
            this.ui.remove();
        }
    }
}

export default AppTimer;
