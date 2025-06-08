/**
 * Timing Proxy
 * Un proxy semplificato che riceve informazioni di timing da un timer esterno.
 * Non gestisce più il tempo internamente, ma fornisce utilità per calcoli temporali.
 * @class TimingProxy
 * @param {Object} [options] - Configuration options
 * @param {number} [options.subdivision=16] - Subdivision (e.g., 16 for 16th notes)
 * @param {number} [options.totalSteps=32] - Total steps in the sequence    
 * @param {number} [options.swing=0] - Swing percentage (0-100)
 * @param {boolean} [options.isLooping=true] - Whether to loop the sequence
 * @param {number} [options.loopStart=0] - Start step of the loop
 * @param {number} [options.loopEnd=31] - End step of the loop  
 * @param {Function} [options.onStep] - Callback for each step
 * @param {Function} [options.onVisualUpdate] - Callback for visual updates
 */

class TimingProxy {
    constructor(options = {}) {
        // Configuration
        this.subdivision = options.subdivision || 16; // 16th notes per beat
        this.swing = options.swing || 0; // 0-100% swing
        this.totalSteps = options.totalSteps || 32; // Default 2 bars in 4/4        // Current timing state (updated externally)
        this.currentStep = 0;
        this.lastStep = -1;
        this.tempo = 120; // BPM (will be updated by external timer)
        this.timeSignature = { numerator: 4, denominator: 4 };
        this.isPlaying = false;

        // Loop settings
        this.loopStart = options.loopStart || 0;
        this.loopEnd = options.loopEnd || (this.totalSteps - 1);
        this.isLooping = options.isLooping !== false;        // Callbacks
        this.onStep = options.onStep || null;
        this.onVisualUpdate = options.onVisualUpdate || null;
        this.onPlay = options.onPlay || null;
        this.onPause = options.onPause || null;
        this.onStop = options.onStop || null;

        // External timer reference
        this.externalTimer = null;    }

    // ============ EXTERNAL TIMER INTEGRATION ============

    /**
     * Connect to an external timer (AppTimer)
     */
    connectToTimer(timer) {
        this.externalTimer = timer;
          // Subscribe to timer events
        timer.subscribe('timing-proxy', (event, data) => {
            switch(event) {
                case 'tick':
                    this.handleTimerTick(data);
                    break;
                case 'play':
                    this.isPlaying = true;
                    if (this.onPlay) this.onPlay();
                    break;
                case 'pause':
                    this.isPlaying = false;
                    if (this.onPause) this.onPause();
                    break;
                case 'stop':
                    this.isPlaying = false;
                    this.currentStep = 0;
                    this.lastStep = -1;
                    if (this.onStop) this.onStop();
                    break;
                case 'tempoChange':
                    this.tempo = data.tempo;
                    break;
                case 'timeSignatureChange':
                    this.timeSignature = data;
                    break;
            }
        });
    }

    /**
     * Handle timer tick events and convert to steps
     */
    handleTimerTick(timerData) {
        // Convert timer position to steps
        const step = this.barBeatTickToStep(timerData.bar, timerData.beat, timerData.tick);
        
        // Update current step with looping logic
        this.updateCurrentStep(step);
        
        // Call step callback if step changed
        if (this.onStep && step !== this.lastStep) {
            this.onStep(this.currentStep, timerData.time);
        }
        
        // Call visual update callback
        if (this.onVisualUpdate) {
            this.onVisualUpdate(timerData.time, this.currentStep);
        }
        
        this.lastStep = step;
    }

    /**
     * Update current step with looping logic
     */
    updateCurrentStep(step) {
        if (this.isLooping) {
            const loopLength = this.loopEnd - this.loopStart + 1;
            if (step >= this.loopStart && step <= this.loopEnd) {
                this.currentStep = step;
            } else if (step > this.loopEnd) {
                // Wrap to loop start
                this.currentStep = this.loopStart + ((step - this.loopStart) % loopLength);
            } else {
                // Before loop start, use step as is
                this.currentStep = step % this.totalSteps;
            }
        } else {
            this.currentStep = step % this.totalSteps;
        }
    }

    /**
     * Convert bar/beat/tick to step number
     */
    barBeatTickToStep(bar, beat, tick) {
        const stepsPerBeat = this.subdivision / 4; // 16th notes = 4 steps per beat
        const stepsPerBar = stepsPerBeat * this.timeSignature.numerator;
        const ticksPerBeat = 96; // Standard MIDI resolution
        const ticksPerStep = ticksPerBeat / stepsPerBeat;
        
        const totalSteps = (bar - 1) * stepsPerBar + (beat - 1) * stepsPerBeat + Math.floor(tick / ticksPerStep);
        return Math.floor(totalSteps);
    }



    setTimeSignature(numerator, denominator) {
        this.timeSignature = { numerator, denominator };
        // Notify external timer if connected
        if (this.externalTimer) {
            this.externalTimer.setTimeSignature(numerator, denominator);
        }
    }

    setSubdivision(subdivision) {
        this.subdivision = subdivision; // 4, 8, 16, 32
    }

    setTotalSteps(steps) {
        this.totalSteps = Math.max(1, steps);
        if (this.loopEnd >= this.totalSteps) {
            this.loopEnd = this.totalSteps - 1;
        }
        if (this.currentStep >= this.totalSteps) {
            this.currentStep = 0;
        }
    }

    setLoopRegion(start, end) {
        this.loopStart = Math.max(0, Math.min(start, this.totalSteps - 1));
        this.loopEnd = Math.max(this.loopStart, Math.min(end, this.totalSteps - 1));
    } 
    
    setSwing(amount) {
        this.swing = Math.max(0, Math.min(100, amount));
    }

    setLooping(enabled) {
        this.isLooping = enabled;
        // Notify external timer if connected
        if (this.externalTimer) {
            this.externalTimer.setLooping(enabled);
        }
    }

    // Step information
    getStepInfo(step) {
        const stepsPerBeat = this.subdivision / 4;
        const stepsPerBar = stepsPerBeat * this.timeSignature.numerator;

        const bar = Math.floor(step / stepsPerBar);
        const beat = Math.floor((step % stepsPerBar) / stepsPerBeat);
        const subdivision = step % stepsPerBeat;

        return {
            step,
            bar: bar + 1, // 1-based
            beat: beat + 1, // 1-based
            subdivision: subdivision + 1, // 1-based
            isBarStart: step % stepsPerBar === 0,
            isBeatStart: step % stepsPerBeat === 0,
            isLoopStart: step === this.loopStart,
            isLoopEnd: step === this.loopEnd
        };
    }

    // Getters
    getCurrentStep() {
        return this.currentStep;
    }

    getTempo() {
        return this.tempo;
    }

    getTimeSignature() {
        return { ...this.timeSignature };
    }

    getLoopRegion() {
        return { start: this.loopStart, end: this.loopEnd };
    }

    isCurrentlyPlaying() {
        return this.isPlaying;
    }    // Time utilities
    stepToTime(step) {
        if (!this.externalTimer) return 0;
        
        const stepsPerBeat = this.subdivision / 4;
        const beatsPerSecond = this.tempo / 60;
        const stepsPerSecond = beatsPerSecond * stepsPerBeat;
        
        return step / stepsPerSecond;
    }

    timeToStep(time) {
        if (!this.externalTimer) return 0;
        
        const stepsPerBeat = this.subdivision / 4;
        const beatsPerSecond = this.tempo / 60;
        const stepsPerSecond = beatsPerSecond * stepsPerBeat;
        
        return Math.floor(time * stepsPerSecond);
    }

    // ============ CONFIGURATION METHODS ============

    setTempo(bpm) {
        this.tempo = Math.max(30, Math.min(300, bpm));
        // Notify external timer if connected
        if (this.externalTimer) {
            this.externalTimer.setTempo(bpm);
        }
        return this.tempo;
    }

    // Export/Import settings
    exportSettings() {
        return {
            tempo: this.tempo,
            timeSignature: this.timeSignature,
            subdivision: this.subdivision,
            totalSteps: this.totalSteps,
            loopStart: this.loopStart,
            loopEnd: this.loopEnd,
            isLooping: this.isLooping,
            swing: this.swing
        };
    }

    importSettings(settings) {
        this.setTempo(settings.tempo || 120);
        this.setTimeSignature(
            settings.timeSignature?.numerator || 4,
            settings.timeSignature?.denominator || 4
        );
        this.setSubdivision(settings.subdivision || 16);
        this.setTotalSteps(settings.totalSteps || 32);
        this.setLoopRegion(
            settings.loopStart || 0,
            settings.loopEnd || this.totalSteps - 1
        );
        this.isLooping = settings.isLooping !== false;
        this.setSwing(settings.swing || 0);
    }

    // ============ CLEANUP ============

    disconnect() {
        if (this.externalTimer) {
            this.externalTimer.unsubscribe('timing-proxy');
            this.externalTimer = null;
        }
    }

    // ============ TRANSPORT METHODS (delegate to external timer) ============

    async start() {
        if (this.externalTimer) {
            await this.externalTimer.play();
        }
    }

    pause() {
        if (this.externalTimer) {
            this.externalTimer.pause();
        }
    }

    stop() {
        if (this.externalTimer) {
            this.externalTimer.stop();
        }
    }
}

export default TimingProxy;
