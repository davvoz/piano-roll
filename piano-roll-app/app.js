import PianoRollWrapper from './piano-roll-wrapper.js';
import AudioEngine from './audio-engine.js';
import AppTimer from './app-timer.js';

class App {
    constructor() {
        this.appTimer = null;
        this.pianoRollWrapper = null;
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
        
        // Initialize piano roll wrapper
        const container = document.getElementById('app');
        this.pianoRollWrapper = new PianoRollWrapper(container, {
            gridRows: 49, // 4 octaves (C3-C7)
            gridCols: 32,
            tempo: 120,
            cellHeight: 24,
            cellWidth: 40,
            labelWidth: 60,
            totalBars: 8,
            subdivision: 16,
            showControls: true, // Mostra la testata con i controlli
            showDimensionControls: true, // Mostra controlli dimensioni
            showLengthControls: true,
            showAudioControls: true, // Mostra controlli audio nella testata
            autoResize: true,
            masterVolume: 20
        });

        // Get piano roll instance from wrapper
        this.pianoRoll = this.pianoRollWrapper.getPianoRoll();

        // Connect piano roll to timer
        if (this.pianoRoll.TimingProxy) {
            this.pianoRoll.TimingProxy.connectToTimer(this.appTimer);
        }

        // Setup timer event handlers
        this.setupTimerEvents();
        
        // Setup event listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Eventi dal piano roll wrapper
        document.addEventListener('pianorollwrapper:dimensionsChanged', (event) => {
            console.log('Piano roll dimensions changed:', event.detail);
            
            // Reconnect to new piano roll instance if provided
            if (event.detail.pianoRoll) {
                this.pianoRoll = event.detail.pianoRoll;
                
                // Reconnect piano roll to timer
                if (this.pianoRoll.TimingProxy && this.appTimer) {
                    this.pianoRoll.TimingProxy.connectToTimer(this.appTimer);
                }
                
                // Re-setup timer event handlers for the new instance
                this.setupTimerEvents();
            }
        });

        document.addEventListener('pianorollwrapper:tempoChanged', (event) => {
            const { tempo } = event.detail;
            // Sincronizza il tempo con l'app timer
            if (this.appTimer) {
                this.appTimer.setTempo(tempo);
            }
        });

        document.addEventListener('pianorollwrapper:audioVolumeChanged', (event) => {
            const { volume } = event.detail;
            // Aggiorna il volume dell'audio engine
            this.audioEngine.setMasterVolume(volume / 100);
        });

        document.addEventListener('pianorollwrapper:stopAllNotes', (event) => {
            // Stop all audio
            this.audioEngine.stopAll();
        });

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