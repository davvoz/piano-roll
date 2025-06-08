/**
 * Piano Roll Configuration System
 * Gestisce tutte le impostazioni configurabili del piano roll
 */
class PianoRollConfig {
    constructor(options = {}) {
        // Grid configuration
        this.gridRows = options.gridRows || 97; // C0 to C8
        this.gridCols = options.gridCols || 32; // Default 2 bars
        this.noteRange = options.noteRange || { start: 'C0', end: 'C8' };
        
        // Visual configuration
        this.cellHeight = options.cellHeight || 20;
        this.cellWidth = options.cellWidth || 'auto'; // 'auto' or number
        this.labelWidth = options.labelWidth || 80;
        this.showBeatNumbers = options.showBeatNumbers !== false;
        this.showPianoKeys = options.showPianoKeys !== false;
        
        // Note names and octaves
        this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        this.minOctave = 0;
        this.maxOctave = 8;
        
        // Timing configuration (will be synced with TimingProxy)
        this.tempo = options.tempo || 120;
        this.timeSignature = options.timeSignature || { numerator: 4, denominator: 4 };
        this.subdivision = options.subdivision || 16; // 16th notes
        this.swing = options.swing || 0;
        
        // Loop configuration
        this.loopStart = options.loopStart || 0;
        this.loopEnd = options.loopEnd || this.gridCols - 1;
        this.isLooping = options.isLooping !== false;
        
        // Performance options
        this.enableVirtualScrolling = options.enableVirtualScrolling || false;
        this.virtualRowBuffer = options.virtualRowBuffer || 10;
        this.enableBatchUpdates = options.enableBatchUpdates !== false;
        
        // Theme and styling
        this.theme = options.theme || 'default';
        this.colors = this.getThemeColors(this.theme);
        
        // Callbacks
        this.onChange = options.onChange || null;
        
        this.init();
    }

    init() {
        this.calculateDerivedValues();
    }

    calculateDerivedValues() {
        // Calculate total rows based on note range
        if (this.noteRange.start && this.noteRange.end) {
            const startNote = this.parseNote(this.noteRange.start);
            const endNote = this.parseNote(this.noteRange.end);
            this.gridRows = this.calculateNoteDistance(startNote, endNote) + 1;
        }

        // Calculate steps per bar
        this.stepsPerBeat = this.subdivision / 4;
        this.stepsPerBar = this.stepsPerBeat * this.timeSignature.numerator;
        this.totalBars = Math.ceil(this.gridCols / this.stepsPerBar);
    }

    // Note parsing utilities
    parseNote(noteString) {
        const match = noteString.match(/^([A-G]#?)(\d+)$/);
        if (!match) throw new Error(`Invalid note format: ${noteString}`);
        
        const noteName = match[1];
        const octave = parseInt(match[2]);
        const noteIndex = this.noteNames.indexOf(noteName);
        
        return { noteName, octave, noteIndex, midiNumber: (octave + 1) * 12 + noteIndex };
    }

    calculateNoteDistance(startNote, endNote) {
        return endNote.midiNumber - startNote.midiNumber;
    }

    // Configuration setters
    setGridSize(rows, cols) {
        this.gridRows = Math.max(1, rows);
        this.gridCols = Math.max(1, cols);
        this.calculateDerivedValues();
        this.notifyChange('gridSize', { rows, cols });
    }

    setNoteRange(start, end) {
        try {
            this.noteRange = { start, end };
            this.calculateDerivedValues();
            this.notifyChange('noteRange', { start, end });
        } catch (error) {
            console.error('Invalid note range:', error.message);
        }
    }

    setTempo(bpm) {
        this.tempo = Math.max(30, Math.min(300, bpm));
        this.notifyChange('tempo', this.tempo);
    }

    setTimeSignature(numerator, denominator) {
        this.timeSignature = { numerator, denominator };
        this.calculateDerivedValues();
        this.notifyChange('timeSignature', this.timeSignature);
    }

    setSubdivision(subdivision) {
        this.subdivision = subdivision;
        this.calculateDerivedValues();
        this.notifyChange('subdivision', subdivision);
    }

    setLoopRegion(start, end) {
        this.loopStart = Math.max(0, Math.min(start, this.gridCols - 1));
        this.loopEnd = Math.max(this.loopStart, Math.min(end, this.gridCols - 1));
        this.notifyChange('loopRegion', { start: this.loopStart, end: this.loopEnd });
    }

    setSwing(amount) {
        this.swing = Math.max(0, Math.min(100, amount));
        this.notifyChange('swing', this.swing);
    }

    // Visual configuration
    setCellHeight(height) {
        this.cellHeight = Math.max(10, height);
        this.notifyChange('cellHeight', height);
    }

    setLabelWidth(width) {
        this.labelWidth = Math.max(50, width);
        this.notifyChange('labelWidth', width);
    }

    enableFeature(feature, enabled) {
        switch (feature) {
            case 'beatNumbers':
                this.showBeatNumbers = enabled;
                break;
            case 'pianoKeys':
                this.showPianoKeys = enabled;
                break;
            case 'virtualScrolling':
                this.enableVirtualScrolling = enabled;
                break;
            case 'batchUpdates':
                this.enableBatchUpdates = enabled;
                break;
        }
        this.notifyChange(feature, enabled);
    }

    // Theme management
    setTheme(theme) {
        this.theme = theme;
        this.colors = this.getThemeColors(theme);
        this.notifyChange('theme', theme);
    }

    getThemeColors(theme) {
        const themes = {
            default: {
                background: '#f0f0f0',
                gridBackground: '#ffffff',
                gridLine: '#e0e0e0',
                cellBorder: '#ddd',
                activeNote: '#4caf50',
                currentStep: '#ff4444',
                beatStart: '#bbb',
                barStart: '#666',
                loopStart: '#4caf50',
                loopEnd: '#f44336',
                whiteKey: '#ffffff',
                blackKey: '#333333'
            },
            dark: {
                background: '#1e1e1e',
                gridBackground: '#2d2d2d',
                gridLine: '#404040',
                cellBorder: '#555',
                activeNote: '#66bb6a',
                currentStep: '#ff6b6b',
                beatStart: '#777',
                barStart: '#999',
                loopStart: '#66bb6a',
                loopEnd: '#ef5350',
                whiteKey: '#f5f5f5',
                blackKey: '#1a1a1a'
            },
            neon: {
                background: '#0a0a0a',
                gridBackground: '#111111',
                gridLine: '#222222',
                cellBorder: '#333',
                activeNote: '#00ff88',
                currentStep: '#ff0088',
                beatStart: '#0088ff',
                barStart: '#ff8800',
                loopStart: '#00ff88',
                loopEnd: '#ff0088',
                whiteKey: '#f0f0f0',
                blackKey: '#101010'
            }
        };

        return themes[theme] || themes.default;
    }

    // Preset configurations
    static getPresets() {
        return {
            '2-bars-16th': {
                gridCols: 32,
                subdivision: 16,
                timeSignature: { numerator: 4, denominator: 4 }
            },
            '4-bars-16th': {
                gridCols: 64,
                subdivision: 16,
                timeSignature: { numerator: 4, denominator: 4 }
            },
            '8-bars-16th': {
                gridCols: 128,
                subdivision: 16,
                timeSignature: { numerator: 4, denominator: 4 }
            },
            '2-bars-8th': {
                gridCols: 16,
                subdivision: 8,
                timeSignature: { numerator: 4, denominator: 4 }
            },
            '4-bars-32nd': {
                gridCols: 128,
                subdivision: 32,
                timeSignature: { numerator: 4, denominator: 4 }
            },
            'custom-long': {
                gridCols: 256, // 16 bars
                subdivision: 16,
                timeSignature: { numerator: 4, denominator: 4 }
            }
        };
    }

    loadPreset(presetName) {
        const presets = PianoRollConfig.getPresets();
        const preset = presets[presetName];
        
        if (preset) {
            Object.assign(this, preset);
            this.calculateDerivedValues();
            this.notifyChange('preset', presetName);
        }
    }

    // Note utilities
    getNoteInfo(row) {
        // Convert row to note (top to bottom = high to low)
        const totalNotes = this.gridRows;
        const notePosition = totalNotes - 1 - row;
        const octave = Math.floor(notePosition / 12) + this.minOctave;
        const noteIndex = notePosition % 12;
        const noteName = this.noteNames[noteIndex];
        const fullNoteName = `${noteName}${octave}`;
        const midiNumber = (octave + 1) * 12 + noteIndex;
        
        return {
            row,
            notePosition,
            noteName,
            octave,
            fullNoteName,
            midiNumber,
            isBlackKey: noteName.includes('#')
        };
    }

    getStepInfo(col) {
        const bar = Math.floor(col / this.stepsPerBar);
        const beatInBar = Math.floor((col % this.stepsPerBar) / this.stepsPerBeat);
        const subdivisionInBeat = col % this.stepsPerBeat;
        
        return {
            col,
            bar: bar + 1,
            beat: beatInBar + 1,
            subdivision: subdivisionInBeat + 1,
            isBarStart: col % this.stepsPerBar === 0,
            isBeatStart: col % this.stepsPerBeat === 0,
            isLoopStart: col === this.loopStart,
            isLoopEnd: col === this.loopEnd
        };    }

    // Configuration methods
    setTempo(bpm) {
        this.tempo = Math.max(30, Math.min(300, bpm));
        this.notifyChange('tempo', this.tempo);
    }    setGridLength(cols) {
        const newCols = Math.max(8, Math.min(512, cols)); // Min 8 steps, max 512 steps
        this.gridCols = newCols;
        
        // Aggiorna la regione di loop per rispecchiare la nuova lunghezza
        // Se la nuova lunghezza è maggiore, estendi il loop end
        // Se la nuova lunghezza è minore, riduci il loop end
        this.loopEnd = this.gridCols - 1;
        
        // Assicurati che il loop start sia valido
        if (this.loopStart >= this.gridCols) {
            this.loopStart = Math.max(0, this.gridCols - 1);
        }
        
        this.calculateDerivedValues();
        this.notifyChange('gridLength', this.gridCols);
        return this.gridCols;
    }

    // Export/Import
    export() {
        return {
            gridRows: this.gridRows,
            gridCols: this.gridCols,
            noteRange: this.noteRange,
            cellHeight: this.cellHeight,
            cellWidth: this.cellWidth,
            labelWidth: this.labelWidth,
            showBeatNumbers: this.showBeatNumbers,
            showPianoKeys: this.showPianoKeys,
            tempo: this.tempo,
            timeSignature: this.timeSignature,
            subdivision: this.subdivision,
            swing: this.swing,
            loopStart: this.loopStart,
            loopEnd: this.loopEnd,
            isLooping: this.isLooping,
            enableVirtualScrolling: this.enableVirtualScrolling,
            enableBatchUpdates: this.enableBatchUpdates,
            theme: this.theme
        };
    }

    import(config) {
        Object.assign(this, config);
        this.colors = this.getThemeColors(this.theme);
        this.calculateDerivedValues();
        this.notifyChange('import', config);
    }

    // Change notification
    notifyChange(property, value) {
        if (this.onChange) {
            this.onChange(property, value, this);
        }
    }

    // Validation
    validate() {
        const errors = [];
        
        if (this.gridRows < 1) errors.push('Grid rows must be at least 1');
        if (this.gridCols < 1) errors.push('Grid columns must be at least 1');
        if (this.tempo < 30 || this.tempo > 300) errors.push('Tempo must be between 30 and 300 BPM');
        if (this.loopStart >= this.gridCols) errors.push('Loop start must be less than grid columns');
        if (this.loopEnd >= this.gridCols) errors.push('Loop end must be less than grid columns');
        if (this.loopStart > this.loopEnd) errors.push('Loop start must be less than or equal to loop end');
        
        return errors;
    }
}

export default PianoRollConfig;
