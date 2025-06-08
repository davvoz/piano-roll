/**
 * Simplified Audio Engine
 * Basic oscillators with precise timing - no ADSR envelope
 */
class AudioEngine {
    constructor(options = {}) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.activeNotes = new Map();
        this.masterGain = this.audioContext.createGain();
        
        // Simple audio chain: masterGain -> destination
        this.masterGain.connect(this.audioContext.destination);
        
        // Settings
        this.masterVolume = options.masterVolume || 0.2;
        
        // Initialize master gain
        this.masterGain.gain.value = this.masterVolume;
    }

    playNote(pitch, time = 0, velocity = 127, duration = 0.5) {
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        const frequency = this.noteToFrequency(pitch);
        const normalizedVelocity = velocity / 127;
        const noteId = `${pitch}-${Date.now()}-${Math.random()}`;
        
        // Create simple oscillator
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        // Audio chain
        oscillator.connect(gainNode);
        gainNode.connect(this.masterGain);
        
        // Oscillator setup
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        // Simple gain control - no envelope
        const noteVolume = normalizedVelocity * 0.3;
        gainNode.gain.value = noteVolume;
        
        // Precise timing
        const startTime = this.audioContext.currentTime + time;
        const endTime = startTime + duration;
        
        oscillator.start(startTime);
        oscillator.stop(endTime);
        
        // Store note data
        this.activeNotes.set(noteId, { oscillator, gainNode, endTime });
        
        // Auto-cleanup after note ends
        setTimeout(() => {
            this.activeNotes.delete(noteId);
        }, (duration + time + 0.1) * 1000);
        
        return noteId;
    }

    noteToFrequency(pitch) {
        const noteRegex = /^([A-G]#?)(\d)$/;
        const match = pitch.match(noteRegex);
        
        if (!match) return 440;
        
        const noteName = match[1];
        const octave = parseInt(match[2]);
        
        const noteMap = {
            'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
            'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
        };
        
        const noteNumber = noteMap[noteName];
        if (noteNumber === undefined) return 440;
        
        const midiNote = (octave + 1) * 12 + noteNumber;
        return 440 * Math.pow(2, (midiNote - 69) / 12);
    }

    stopNote(noteId) {
        const noteData = this.activeNotes.get(noteId);
        if (noteData) {
            try {
                noteData.oscillator.stop();
            } catch (e) {
                // Note already stopped
            }
            this.activeNotes.delete(noteId);
        }
    }

    stopAll() {
        for (const [noteId, noteData] of this.activeNotes.entries()) {
            try {
                noteData.oscillator.stop();
            } catch (e) {
                // Ignore errors for already stopped oscillators
            }
        }
        this.activeNotes.clear();
    }

    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        this.masterGain.gain.setValueAtTime(this.masterVolume, this.audioContext.currentTime);
    }

    getCurrentTime() {
        return this.audioContext.currentTime;
    }

    async resumeContext() {
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }
}

export default AudioEngine;