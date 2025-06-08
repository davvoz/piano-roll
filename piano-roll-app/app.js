import PianoRollCanvas from './src/piano-roll-canvas.js';
import AudioEngine from './src/audio-engine.js';
import AppTimer from './src/app-timer.js';

class App {
    constructor() {
        this.appTimer = null;
        this.pianoRoll = null;
        this.audioEngine = null;
        this.init();
    }

    async init() {
        // Initialize centralized timer first
        this.appTimer = new AppTimer({
            tempo: 120,
            timeSignature: { numerator: 4, denominator: 4 },
            subdivision: 16,
            totalBars: 8,
            isLooping: true
        });

        // Initialize simplified audio engine with timer's audio context
        this.audioEngine = new AudioEngine({
            masterVolume: 0.2,
            audioContext: this.appTimer.getAudioContext()
        });
        
        // Initialize piano roll canvas
        const container = document.getElementById('app');
        this.pianoRoll = new PianoRollCanvas(container, {
            gridRows: 49, // 4 octaves (C3-C7)
            gridCols: 32,
            tempo: 120,
            cellHeight: 24,
            labelWidth: 60
        });

        // Connect piano roll to timer
        if (this.pianoRoll.TimingProxy) {
            this.pianoRoll.TimingProxy.connectToTimer(this.appTimer);
        }

        // Setup timer event handlers
        this.setupTimerEvents();
        
        // Setup event listeners
        this.setupEventListeners();
        this.createAudioControls();
    }

    setupEventListeners() {
        // Eventi dal piano roll
        document.addEventListener('pianoroll:playNotes', (event) => {
            const { notes } = event.detail;
            notes.forEach(note => {
                // Calculate note duration based on timer's current tempo
                // Calculate step duration: 1 step = 1/16th note at subdivision 16
                const stepDuration = this.appTimer ? 
                    this.appTimer.barBeatTickToSeconds(1, 1, 24) - this.appTimer.barBeatTickToSeconds(1, 1, 0) : // 1/4 of a beat (24 ticks)
                    0.125; // fallback: 1/8 second for 16th note at 120 BPM
                const noteDuration = (note.duration || 1) * stepDuration;
                this.audioEngine.playNote(note.pitch, 0, note.velocity || 127, noteDuration);
            });
        });

        document.addEventListener('pianoroll:playNote', (event) => {
            const { pitch } = event.detail;
            this.audioEngine.playNote(pitch, 0, 100);
        });

        document.addEventListener('pianoroll:stopAllNotes', () => {
            this.audioEngine.stopAll();
        });

        // Gestione della tastiera per il pianoforte virtuale
        document.addEventListener('keydown', (event) => {
            this.handleKeyboardInput(event);
        });

        // Resume audio context on user interaction
        document.addEventListener('click', async () => {
            await this.audioEngine.resumeContext();
            // Also ensure timer's audio context is resumed
            if (this.appTimer.audioContext.state === 'suspended') {
                await this.appTimer.audioContext.resume();
            }
        }, { once: true });
    }

    createAudioControls() {
        const audioControls = document.createElement('div');
        audioControls.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 1001;
            background: rgba(0,0,0,0.8);
            padding: 15px;
            border-radius: 5px;
            color: white;
            font-family: Arial, sans-serif;
            font-size: 14px;
            min-width: 200px;
        `;
        
        audioControls.innerHTML = `
            <h3 style="margin: 0 0 10px 0;">Audio Settings</h3>
            <div style="margin-bottom: 10px;">
                <label>Master Volume: <span id="volume-value">20</span>%</label>
                <input type="range" id="volume-slider" min="0" max="100" value="20" style="width: 100%;">
            </div>
            <div style="margin-bottom: 10px;">
                <button id="stop-all" style="width: 100%; padding: 8px; background: #ff4444; color: white; border: none; border-radius: 3px; cursor: pointer;">
                    Stop All Notes
                </button>
            </div>
            <div style="font-size: 12px; color: #aaa; margin-top: 10px;">
                <p>Simplified Audio Engine</p>
                <p>Basic sine wave synthesis</p>
            </div>
        `;
        
        document.body.appendChild(audioControls);
        
        // Event listeners for audio controls
        document.getElementById('volume-slider').addEventListener('input', (e) => {
            const volume = parseInt(e.target.value) / 100;
            this.audioEngine.setMasterVolume(volume);
            document.getElementById('volume-value').textContent = e.target.value;
        });
        
        document.getElementById('stop-all').addEventListener('click', () => {
            this.audioEngine.stopAll();
        });
    }

    handleKeyboardInput(event) {
        // Mappa della tastiera per le note
        const keyMap = {
            'KeyA': 'C4',
            'KeyW': 'C#4',
            'KeyS': 'D4',
            'KeyE': 'D#4',
            'KeyD': 'E4',
            'KeyF': 'F4',
            'KeyT': 'F#4',
            'KeyG': 'G4',
            'KeyY': 'G#4',
            'KeyH': 'A4',
            'KeyU': 'A#4',
            'KeyJ': 'B4',
            'KeyK': 'C5',
            'KeyO': 'C#5',
            'KeyL': 'D5',
            'KeyP': 'D#5',
            'Semicolon': 'E5'
        };
        
        if (keyMap[event.code] && !event.repeat) {
            event.preventDefault();
            this.audioEngine.playNote(keyMap[event.code], 0, 100);
        }
    }

    setupTimerEvents() {
        // Subscribe to timer events for app-level coordination
        this.appTimer.subscribe('app-coordination', (event, data) => {
            switch(event) {
                case 'play':
                    console.log('Timer started playing');
                    break;
                case 'pause':
                    console.log('Timer paused');
                    break;
                case 'stop':
                    console.log('Timer stopped');
                    break;
                case 'tempoChange':
                    console.log('Tempo changed to:', data.tempo);
                    break;
            }
        });
    }

    handleStepPlayback(timerData) {
        // This will be called on each timer tick
        // The piano roll's timing proxy will handle the step conversion
        // and trigger note playback through its own events
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});

export default App;