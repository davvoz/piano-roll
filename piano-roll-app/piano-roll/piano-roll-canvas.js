import PianoRollConfig from './piano-roll-config.js';
import TimingProxy from './timing-proxy.js';

/**
 * Piano Roll Canvas Renderer
 * Sistema di rendering ad alte prestazioni usando Canvas 2D
 */
class PianoRollCanvas {
    constructor(container, options = {}) {
        this.container = container;
        this.notes = new Map();

        // Configurazione
        this.config = new PianoRollConfig(options);

        // Canvas setup
        this.canvas = null;
        this.ctx = null;
        this.canvasWidth = 0;
        this.canvasHeight = 0;
        this.devicePixelRatio = window.devicePixelRatio || 1;

        // Layout calculations
        this.labelWidth = this.config.labelWidth;
        this.cellWidth = 40;
        this.cellHeight = this.config.cellHeight;
        this.headerHeight = 40;

        // Grid dimensions
        this.gridRows = this.config.gridRows;
        this.gridCols = this.config.gridCols;
        this.totalWidth = this.labelWidth + (this.gridCols * this.cellWidth);
        this.totalHeight = this.headerHeight + (this.gridRows * this.cellHeight);

        // Scroll state
        this.scrollX = 0;
        this.scrollY = 0;
        this.maxScrollX = Math.max(0, this.totalWidth - window.innerWidth);
        this.maxScrollY = Math.max(0, this.totalHeight - window.innerHeight);

        // Piano keys and notes
        this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        this.notesByRow = this.generateNotesByRow();

        // Timing Engine
        this.TimingProxy = new TimingProxy({
            tempo: this.config.tempo,
            timeSignature: this.config.timeSignature,
            subdivision: this.config.subdivision,
            swing: this.config.swing,
            totalSteps: this.config.gridCols,
            loopStart: this.config.loopStart,
            loopEnd: this.config.loopEnd,
            isLooping: this.config.isLooping
        });        // State

        this.isPlaying = false;
        this.currentStep = 0;
        this.visualStep = 0; // Separato per visual updates        this.hoveredCell = null;
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.needsRedraw = true;        // Note resize properties
        this.isResizingNote = false;
        this.resizingNoteKey = null;
        this.resizingNoteStartX = null;
        this.resizingNoteInitialDuration = null;
        this.justFinishedResizing = false; // Flag per prevenire click dopo resize

        // Scrollbar drag properties
        this.isDraggingScrollbar = false;
        this.draggingHorizontalScrollbar = false;
        this.draggingVerticalScrollbar = false;
        this.scrollbarDragOffset = { x: 0, y: 0 };

        // Flag per ottimizzare il rendering

        // Colors and theme
        this.colors = {
            background: '#1a1a1a',
            gridLine: '#333333',
            whiteKey: '#f0f0f0',
            blackKey: '#2a2a2a',
            whiteKeyHover: '#ffffff',
            blackKeyHover: '#404040',
            activeNote: '#4a9eff',
            currentStep: '#ff6b4a',
            beatMarker: '#666666',
            barMarker: '#888888',
            loopMarker: '#ffaa00',
            text: '#ffffff',
            textSecondary: '#cccccc'
        };        // Setup timing callbacks
        this.TimingProxy.onStep = (step) => this.onTimingStep(step);
        this.TimingProxy.onVisualUpdate = (currentTime, step) => this.onVisualUpdate(currentTime, step);
        this.TimingProxy.onPlay = () => this.onTimingPlay();
        this.TimingProxy.onPause = () => this.onTimingPause();
        this.TimingProxy.onStop = () => this.onTimingStop();

        // Setup configuration change callbacks
        this.config.onChange = (property, value) => this.onConfigChange(property, value);

        // Bind event handlers to preserve 'this'
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleClick = this.handleClick.bind(this);
        this.handleGlobalMouseMove = this.handleGlobalMouseMove.bind(this);
        this.handleGlobalMouseUp = this.handleGlobalMouseUp.bind(this);

        this.init();
    }

    init() {
        this.createCanvas();
        //this.createControls();
        this.setupEventListeners();
        this.render();

        // Start animation loop
        this.animationId = requestAnimationFrame(() => this.animationLoop());
    }

    createCanvas() {
        // Remove existing content
        this.container.innerHTML = '';

        // Create canvas
        this.canvas = document.createElement('canvas');
        this.canvas.style.display = 'block';
        this.canvas.style.background = this.colors.background;
        this.canvas.style.cursor = 'crosshair';

        this.ctx = this.canvas.getContext('2d');

        this.container.appendChild(this.canvas);
        this.resizeCanvas();
    }    resizeCanvas() {
        const rect = this.container.getBoundingClientRect();
        
        // Determine canvas dimensions based on configuration
        if (this.config.canvasWidth === 'auto') {
            this.canvasWidth = rect.width;
        } else {
            this.canvasWidth = this.config.canvasWidth;
        }
        
        if (this.config.canvasHeight === 'auto') {
            this.canvasHeight = rect.height;
        } else {
            this.canvasHeight = this.config.canvasHeight;
        }

        // Apply limits if configured
        if (this.config.minCanvasWidth) {
            this.canvasWidth = Math.max(this.canvasWidth, this.config.minCanvasWidth);
        }
        if (this.config.minCanvasHeight) {
            this.canvasHeight = Math.max(this.canvasHeight, this.config.minCanvasHeight);
        }
        if (this.config.maxCanvasWidth !== null) {
            this.canvasWidth = Math.min(this.canvasWidth, this.config.maxCanvasWidth);
        }
        if (this.config.maxCanvasHeight !== null) {
            this.canvasHeight = Math.min(this.canvasHeight, this.config.maxCanvasHeight);
        }

        // Set canvas size with device pixel ratio for crisp rendering
        this.canvas.width = this.canvasWidth * this.devicePixelRatio;
        this.canvas.height = this.canvasHeight * this.devicePixelRatio;
        this.canvas.style.width = this.canvasWidth + 'px';
        this.canvas.style.height = this.canvasHeight + 'px';

        // Scale context to match device pixel ratio
        this.ctx.scale(this.devicePixelRatio, this.devicePixelRatio);

        // Update scroll limits
        this.maxScrollX = Math.max(0, this.totalWidth - this.canvasWidth);
        this.maxScrollY = Math.max(0, this.totalHeight - this.canvasHeight);

        // Aggiusta lo scroll corrente se necessario
        this.scrollX = Math.min(this.scrollX, this.maxScrollX);
        this.scrollY = Math.min(this.scrollY, this.maxScrollY);

        this.needsRedraw = true;
    }

    generateNotesByRow() {
        const notes = [];
        for (let octave = 8; octave >= 0; octave--) {
            for (let i = this.noteNames.length - 1; i >= 0; i--) {
                const noteName = this.noteNames[i];
                notes.push({
                    name: noteName,
                    octave: octave,
                    fullName: `${noteName}${octave}`,
                    isBlack: noteName.includes('#')
                });
            }
        }
        return notes.slice(0, this.gridRows);
    }

    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('click', (e) => this.handleClick(e));

        // Wheel events for scrolling
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));

        // Keyboard events
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));

        // Window resize
        window.addEventListener('resize', () => this.resizeCanvas());

        // --- AGGIUNTA: eventi globali per resize note ---
        document.addEventListener('mousemove', (e) => this.handleGlobalMouseMove(e));
        document.addEventListener('mouseup', (e) => this.handleGlobalMouseUp(e));
    } handleMouseDown(event) {
        const pos = this.getMousePosition(event);
        const canvasPos = {
            x: event.clientX - this.canvas.getBoundingClientRect().left,
            y: event.clientY - this.canvas.getBoundingClientRect().top
        };

        this.lastMouseX = pos.x;
        this.lastMouseY = pos.y;

        // Check if click is on scrollbar
        const scrollbarType = this.getScrollbarAtPosition(canvasPos.x, canvasPos.y);
        if (scrollbarType) {
            this.isDraggingScrollbar = true;
            this.draggingHorizontalScrollbar = scrollbarType === 'horizontal';
            this.draggingVerticalScrollbar = scrollbarType === 'vertical';
            // Calculate offset for smooth dragging
            if (scrollbarType === 'horizontal') {
                const scrollbarSize = 14;
                const margin = 4;
                const scrollbarX = this.labelWidth;
                const scrollbarWidth = this.canvasWidth - this.labelWidth - scrollbarSize - margin;
                const thumbWidth = Math.max(20, (scrollbarWidth * this.canvasWidth) / this.totalWidth);
                const thumbX = scrollbarX + (this.scrollX / this.maxScrollX) * (scrollbarWidth - thumbWidth);
                this.scrollbarDragOffset.x = canvasPos.x - thumbX;
            } else {
                const scrollbarSize = 14;
                const margin = 4;
                const scrollbarY = this.headerHeight;
                const scrollbarHeight = this.canvasHeight - this.headerHeight - scrollbarSize - margin;
                const thumbHeight = Math.max(20, (scrollbarHeight * this.canvasHeight) / this.totalHeight);
                const thumbY = scrollbarY + (this.scrollY / this.maxScrollY) * (scrollbarHeight - thumbHeight);
                this.scrollbarDragOffset.y = canvasPos.y - thumbY;
            }

            this.handleScrollbarClick(scrollbarType, canvasPos.x, canvasPos.y);
            event.preventDefault();
            return;
        }

        // Check if mouse is on a note resize handle
        const hit = this.getNoteResizeHandleAtPosition(pos.x, pos.y);
        if (hit) {
            this.isResizingNote = true;
            this.resizingNoteKey = hit.noteKey;
            this.resizingNoteStartX = pos.x;
            this.resizingNoteInitialDuration = hit.note.duration;
            // Previeni selezione/click
            event.preventDefault();
            return;
        }
        this.isDragging = true;
    } handleMouseMove(event) {
        const pos = this.getMousePosition(event);
        const canvasPos = {
            x: event.clientX - this.canvas.getBoundingClientRect().left,
            y: event.clientY - this.canvas.getBoundingClientRect().top
        };        // Handle scrollbar dragging
        if (this.isDraggingScrollbar) {
            if (this.draggingHorizontalScrollbar) {
                const scrollbarSize = 14;
                const margin = 4;
                const scrollbarX = this.labelWidth;
                const scrollbarWidth = this.canvasWidth - this.labelWidth - scrollbarSize - margin;
                const thumbWidth = Math.max(20, (scrollbarWidth * this.canvasWidth) / this.totalWidth);

                const thumbX = canvasPos.x - this.scrollbarDragOffset.x;
                const thumbRatio = (thumbX - scrollbarX) / (scrollbarWidth - thumbWidth);
                this.scrollX = Math.max(0, Math.min(this.maxScrollX, thumbRatio * this.maxScrollX));
                this.needsRedraw = true;
            } else if (this.draggingVerticalScrollbar) {
                const scrollbarSize = 14;
                const margin = 4;
                const scrollbarY = this.headerHeight;
                const scrollbarHeight = this.canvasHeight - this.headerHeight - scrollbarSize - margin;
                const thumbHeight = Math.max(20, (scrollbarHeight * this.canvasHeight) / this.totalHeight);

                const thumbY = canvasPos.y - this.scrollbarDragOffset.y;
                const thumbRatio = (thumbY - scrollbarY) / (scrollbarHeight - thumbHeight);
                this.scrollY = Math.max(0, Math.min(this.maxScrollY, thumbRatio * this.maxScrollY));
                this.needsRedraw = true;
            }
            return;
        }

        // Check cursor for scrollbars and resize handles
        const scrollbarType = this.getScrollbarAtPosition(canvasPos.x, canvasPos.y);
        const hit = this.getNoteResizeHandleAtPosition(pos.x, pos.y);

        if (scrollbarType) {
            this.canvas.style.cursor = 'pointer';
        } else if (hit) {
            this.canvas.style.cursor = 'ew-resize';
        } else {
            this.canvas.style.cursor = 'crosshair';
        }

        if (this.isDragging) {
            // Handle panning
            if (event.ctrlKey || event.metaKey) {
                const deltaX = pos.x - this.lastMouseX;
                const deltaY = pos.y - this.lastMouseY;

                this.scrollX = Math.max(0, Math.min(this.maxScrollX, this.scrollX - deltaX));
                this.scrollY = Math.max(0, Math.min(this.maxScrollY, this.scrollY - deltaY));
                this.needsRedraw = true;
            }
        }

        // Update hover state
        const cell = this.getCellFromPosition(pos.x, pos.y);
        if (cell && (!this.hoveredCell || cell.row !== this.hoveredCell.row || cell.col !== this.hoveredCell.col)) {
            this.hoveredCell = cell;
            this.needsRedraw = true;
        } else if (!cell && this.hoveredCell) {
            this.hoveredCell = null;
            this.needsRedraw = true;
        }

        this.lastMouseX = pos.x;
        this.lastMouseY = pos.y;
    }

    // --- NUOVI METODI GLOBALI ---
    handleGlobalMouseMove(event) {
        if (!this.isResizingNote) return;
        // Usa coordinate globali
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left + this.scrollX;
        // Calcola nuova durata
        const note = this.notes.get(this.resizingNoteKey);
        if (note) {
            const deltaX = x - this.resizingNoteStartX;
            let newDuration = Math.round(this.resizingNoteInitialDuration + deltaX / this.cellWidth);
            newDuration = Math.max(1, newDuration);
            note.duration = newDuration;
            this.needsRedraw = true;
            this.dispatchEvent('pianoroll:noteChange', { notes: Array.from(this.notes.values()) });
        }
    } handleGlobalMouseUp(event) {
        if (this.isResizingNote) {
            this.isResizingNote = false;
            this.resizingNoteKey = null;
            this.resizingNoteStartX = null;
            this.resizingNoteInitialDuration = null;
            this.justFinishedResizing = true; // Imposta flag per prevenire click

            // Reset flag dopo un breve delay
            setTimeout(() => {
                this.justFinishedResizing = false;
            }, 100);
        }
    } handleMouseUp(event) {
        if (this.isResizingNote) {
            this.isResizingNote = false;
            this.resizingNoteKey = null;
            this.resizingNoteStartX = null;
            this.resizingNoteInitialDuration = null;
            this.justFinishedResizing = true; // Imposta flag per prevenire click

            // Reset flag dopo un breve delay
            setTimeout(() => {
                this.justFinishedResizing = false;
            }, 100);
            return;
        }

        // Reset scrollbar dragging
        if (this.isDraggingScrollbar) {
            this.isDraggingScrollbar = false;
            this.draggingHorizontalScrollbar = false;
            this.draggingVerticalScrollbar = false;
            this.scrollbarDragOffset = { x: 0, y: 0 };
            return;
        }

        this.isDragging = false;
    }

    getMousePosition(event) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left + this.scrollX,
            y: event.clientY - rect.top + this.scrollY
        };
    }

    getCellFromPosition(x, y) {
        if (x < this.labelWidth || y < this.headerHeight) return null;

        const col = Math.floor((x - this.labelWidth) / this.cellWidth);
        const row = Math.floor((y - this.headerHeight) / this.cellHeight);

        if (col >= 0 && col < this.gridCols && row >= 0 && row < this.gridRows) {
            return { row, col };
        }
        return null;
    }
    getNoteResizeHandleAtPosition(x, y) {
        // Returns {noteKey, note} if mouse is on a handle, else null
        // Note: x, y are in world coordinates (with scroll added by getMousePosition)
        for (const [noteKey, note] of this.notes.entries()) {
            // Calculate note position in world coordinates (no scroll subtraction)
            const noteX = this.labelWidth + (note.col * this.cellWidth);
            const noteY = this.headerHeight + (note.row * this.cellHeight);
            const noteW = this.cellWidth * note.duration;
            const handleWidth = 8;
            const handleX = noteX + noteW - handleWidth - 2;
            const handleY = noteY + 4;
            const handleHeight = this.cellHeight - 8;
            if (
                x >= handleX && x <= handleX + handleWidth &&
                y >= handleY && y <= handleY + handleHeight
            ) {
                return { noteKey, note };
            }
        }
        return null;
    }
    handleClick(event) {
        // Se sto ridimensionando o ho appena finito di ridimensionare, ignora il click
        if (this.isResizingNote || this.justFinishedResizing) {
            event.preventDefault();
            return;
        }

        const pos = this.getMousePosition(event);
        const canvasPos = {
            x: event.clientX - this.canvas.getBoundingClientRect().left,
            y: event.clientY - this.canvas.getBoundingClientRect().top
        };

        // IMPORTANTE: Verifica se il click è su una scrollbar - se sì, ignora
        const scrollbarType = this.getScrollbarAtPosition(canvasPos.x, canvasPos.y);
        if (scrollbarType) {
            event.preventDefault();
            return;
        }

        // Controlla anche se il click è su un resize handle
        const handleHit = this.getNoteResizeHandleAtPosition(pos.x, pos.y);
        if (handleHit) {
            event.preventDefault();
            return;
        }

        const cell = this.getCellFromPosition(pos.x, pos.y);

        if (cell) {
            this.toggleNote(cell.row, cell.col);
        } else if (pos.x < this.labelWidth && pos.y >= this.headerHeight) {
            // Clicked on piano key label
            const row = Math.floor((pos.y - this.headerHeight) / this.cellHeight);
            if (row >= 0 && row < this.gridRows) {
                this.playNote(this.notesByRow[row].fullName);
            }
        }
    }
    handleWheel(event) {
        event.preventDefault();

        if (event.ctrlKey || event.metaKey) {
            // Zoom (future feature)
            return;
        }        // Scroll standard: normale per verticale, Shift per orizzontale
        const scrollAmount = event.deltaY;

        if (event.shiftKey) {
            // Shift + rotella = scroll orizzontale
            this.scrollX = Math.max(0, Math.min(this.maxScrollX, this.scrollX + scrollAmount));
        } else {
            // Rotella normale = scroll verticale
            this.scrollY = Math.max(0, Math.min(this.maxScrollY, this.scrollY + scrollAmount));
        }

        this.needsRedraw = true;
    }
    handleKeyDown(event) {
        if (event.code === 'Space') {
            event.preventDefault();
            this.togglePlayback();
        }

        // Navigation with arrow keys
        const scrollStep = this.cellWidth * 2;

        switch (event.code) {
            case 'ArrowLeft':
                event.preventDefault();
                this.scrollX = Math.max(0, this.scrollX - scrollStep);
                this.needsRedraw = true;
                break;

            case 'ArrowRight':
                event.preventDefault();
                this.scrollX = Math.min(this.maxScrollX, this.scrollX + scrollStep);
                this.needsRedraw = true;
                break;

            case 'ArrowUp':
                event.preventDefault();
                this.scrollY = Math.max(0, this.scrollY - this.cellHeight * 2);
                this.needsRedraw = true;
                break;

            case 'ArrowDown':
                event.preventDefault();
                this.scrollY = Math.min(this.maxScrollY, this.scrollY + this.cellHeight * 2);
                this.needsRedraw = true;
                break;

            case 'Home':
                event.preventDefault();
                this.scrollX = 0;
                this.scrollY = 0;
                this.needsRedraw = true;
                break;

            case 'End':
                event.preventDefault();
                this.scrollX = this.maxScrollX;
                this.needsRedraw = true;
                break;
        }
    }
    toggleNote(row, col) {
        const noteKey = `${row}-${col}`;

        if (this.notes.has(noteKey)) {
            this.notes.delete(noteKey);
        } else {
            const note = {
                row,
                col,
                pitch: this.notesByRow[row].fullName,
                velocity: 127,
                duration: 1
            };
            this.notes.set(noteKey, note);
        }

        this.needsRedraw = true;
        this.dispatchEvent('pianoroll:noteChange', { notes: Array.from(this.notes.values()) });
    }

    playNote(pitch) {
        this.dispatchEvent('pianoroll:playNote', { pitch });
    }
    // Timing Engine callbacks
    onTimingStep(step) {
        this.currentStep = step;
        const notesAtStep = this.getNotesAtStep(step);
        if (notesAtStep.length > 0) {
            this.dispatchEvent('pianoroll:playNotes', { notes: notesAtStep });
        }
    }
    onVisualUpdate(currentTime, step) {
        // Aggiorna solo il visual step per evitare conflitti
        if (this.visualStep !== step) {
            this.visualStep = step;

            // Auto-scroll durante la riproduzione per seguire il playhead
            if (this.isPlaying) {
                this.autoScrollToStep(step);
            }

            this.needsRedraw = true;
        }
    }

    autoScrollToStep(step) {
        const stepX = step * this.cellWidth;
        const stepScreenX = this.labelWidth + stepX - this.scrollX;

        // Auto-scroll se il playhead esce dalla vista
        const margin = this.cellWidth * 4; // Margine di 4 celle

        if (stepScreenX < margin) {
            // Scroll a sinistra
            this.scrollX = Math.max(0, stepX - margin);
        } else if (stepScreenX > this.canvasWidth - margin) {
            // Scroll a destra
            this.scrollX = Math.min(this.maxScrollX, stepX - this.canvasWidth + margin);
        }
    } onTimingPlay() {
        this.isPlaying = true;
        this.needsRedraw = true;
        // Aggiorna i controlli se esistono
        const playBtn = document.getElementById('play-btn');
        if (playBtn) playBtn.textContent = 'Pause';
    }

    onTimingPause() {
        this.isPlaying = false;
        this.needsRedraw = true;
        // Aggiorna i controlli se esistono
        const playBtn = document.getElementById('play-btn');
        if (playBtn) playBtn.textContent = 'Play';
    }

    onTimingStop() {
        this.isPlaying = false;
        this.currentStep = 0;
        this.visualStep = 0;
        this.needsRedraw = true;
        // Aggiorna i controlli se esistono
        const playBtn = document.getElementById('play-btn');
        if (playBtn) playBtn.textContent = 'Play';
        this.dispatchEvent('pianoroll:stopAllNotes');
    }

    // Configurazione cambiamenti
    onConfigChange(property, value) {
        switch (property) {
            case 'canvasWidth':
            case 'canvasHeight':
            case 'canvasLimits':
                // Force canvas resize when dimensions change
                this.resizeCanvas();
                break;
            case 'cellHeight':
                this.cellHeight = this.config.cellHeight;
                this.totalHeight = this.headerHeight + (this.gridRows * this.cellHeight);
                this.maxScrollY = Math.max(0, this.totalHeight - this.canvasHeight);
                this.scrollY = Math.min(this.scrollY, this.maxScrollY);
                this.needsRedraw = true;
                break;
            case 'labelWidth':
                this.labelWidth = this.config.labelWidth;
                this.totalWidth = this.labelWidth + (this.gridCols * this.cellWidth);
                this.maxScrollX = Math.max(0, this.totalWidth - this.canvasWidth);
                this.scrollX = Math.min(this.scrollX, this.maxScrollX);
                this.needsRedraw = true;
                break;
        }
    }

    // Transport controls
    togglePlayback() {
        if (this.isPlaying) {
            this.pausePlayback();
        } else {
            this.startPlayback();
        }
    } async startPlayback() {
        if (!this.isPlaying) {
            this.isPlaying = true;
            // Delegate to external timer if connected
            if (this.TimingProxy.externalTimer) {
                await this.TimingProxy.externalTimer.play();
            }
            const playBtn = document.getElementById('play-btn');
            if (playBtn) playBtn.textContent = 'Pause';
        }
    }

    pausePlayback() {
        if (this.isPlaying) {
            this.isPlaying = false;
            // Delegate to external timer if connected
            if (this.TimingProxy.externalTimer) {
                this.TimingProxy.externalTimer.pause();
            }
            const playBtn = document.getElementById('play-btn');
            if (playBtn) playBtn.textContent = 'Play';
        }
    }

    stopPlayback() {
        this.isPlaying = false;
        this.currentStep = 0;
        this.visualStep = 0;
        // Delegate to external timer if connected
        if (this.TimingProxy.externalTimer) {
            this.TimingProxy.externalTimer.stop();
        }
        const playBtn = document.getElementById('play-btn');
        if (playBtn) playBtn.textContent = 'Play';
        this.dispatchEvent('pianoroll:stopAllNotes');
    } setTempo(bpm) {
        this.config.setTempo(bpm);
        // Delegate to external timer if connected, otherwise update TimingProxy directly
        if (this.TimingProxy.externalTimer) {
            this.TimingProxy.externalTimer.setTempo(bpm);
        } else {
            this.TimingProxy.setTempo(bpm);
        }
    } setGridLength(cols) {
        const newCols = this.config.setGridLength(cols);

        // Update grid dimensions
        this.gridCols = newCols;
        this.totalWidth = this.labelWidth + (this.gridCols * this.cellWidth);
        this.maxScrollX = Math.max(0, this.totalWidth - this.canvasWidth);

        // Aggiusta lo scroll se necessario
        this.scrollX = Math.min(this.scrollX, this.maxScrollX);

        // Update timing engine with new total steps and loop region
        this.TimingProxy.setTotalSteps(newCols);
        this.TimingProxy.setLoopRegion(this.config.loopStart, this.config.loopEnd);

        // Force redraw
        this.needsRedraw = true;

        return newCols;
    }

    // Canvas dimension control methods
    setCanvasSize(width, height) {
        this.config.setCanvasSize(width, height);
        this.resizeCanvas();
    }

    setCanvasWidth(width) {
        this.config.setCanvasWidth(width);
        this.resizeCanvas();
    }

    setCanvasHeight(height) {
        this.config.setCanvasHeight(height);
        this.resizeCanvas();
    }

    getCanvasSize() {
        return {
            width: this.canvasWidth,
            height: this.canvasHeight,
            configuredWidth: this.config.canvasWidth,
            configuredHeight: this.config.canvasHeight
        };
    }

    // Configuration change handler
    onConfigChange(property, value) {
        switch (property) {
            case 'canvasWidth':
            case 'canvasHeight':
            case 'canvasLimits':
                // Force canvas resize when dimensions change
                this.resizeCanvas();
                break;
            case 'cellHeight':
                this.cellHeight = this.config.cellHeight;
                this.totalHeight = this.headerHeight + (this.gridRows * this.cellHeight);
                this.maxScrollY = Math.max(0, this.totalHeight - this.canvasHeight);
                this.scrollY = Math.min(this.scrollY, this.maxScrollY);
                this.needsRedraw = true;
                break;
            case 'labelWidth':
                this.labelWidth = this.config.labelWidth;
                this.totalWidth = this.labelWidth + (this.gridCols * this.cellWidth);
                this.maxScrollX = Math.max(0, this.totalWidth - this.canvasWidth);
                this.scrollX = Math.min(this.scrollX, this.maxScrollX);
                this.needsRedraw = true;
                break;
        }
    }

    clearAll() {
        this.notes.clear();
        this.needsRedraw = true;
        this.dispatchEvent('pianoroll:noteChange', { notes: [] });
    }

    getNotesAtStep(step) {
        const notes = [];
        for (const note of this.notes.values()) {
            if (note.col === step) {
                notes.push(note);
            }
        }
        return notes;
    }    // Rendering methods
    animationLoop() {
        // Rendering ottimizzato: riduci il carico quando non necessario
        if (this.isPlaying || this.needsRedraw || this.isDragging || this.hoveredCell) {
            this.render();
            this.needsRedraw = false;
        }
        this.animationId = requestAnimationFrame(() => this.animationLoop());
    }
    render() {
        this.clearCanvas();
        this.drawBackground();
        this.drawPianoKeys();
        this.drawHeader();
        this.drawGrid();
        this.drawNotes();
        this.drawCurrentStep();
        this.drawHover();
        this.drawScrollbars();
    }

    clearCanvas() {
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    }

    drawBackground() {
        // Draw main grid background
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(
            this.labelWidth - this.scrollX,
            this.headerHeight - this.scrollY,
            this.gridCols * this.cellWidth,
            this.gridRows * this.cellHeight
        );
    }

    drawPianoKeys() {
        const startRow = Math.max(0, Math.floor(this.scrollY / this.cellHeight));
        const endRow = Math.min(this.gridRows, Math.floor((this.scrollY + this.canvasHeight) / this.cellHeight) + 1);

        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        for (let row = startRow; row < endRow; row++) {
            const y = this.headerHeight + (row * this.cellHeight) - this.scrollY;
            const note = this.notesByRow[row];

            // Key background
            this.ctx.fillStyle = note.isBlack ? this.colors.blackKey : this.colors.whiteKey;
            this.ctx.fillRect(0, y, this.labelWidth, this.cellHeight);

            // Key border
            this.ctx.strokeStyle = this.colors.gridLine;
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(0, y, this.labelWidth, this.cellHeight);

            // Note label
            this.ctx.fillStyle = note.isBlack ? this.colors.whiteKey : this.colors.background;
            this.ctx.fillText(note.fullName, this.labelWidth / 2, y + this.cellHeight / 2);
        }
    }

    drawHeader() {
        // Header background
        this.ctx.fillStyle = this.colors.blackKey;
        this.ctx.fillRect(this.labelWidth - this.scrollX, 0, this.gridCols * this.cellWidth, this.headerHeight);

        // Beat numbers
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = this.colors.text;

        const startCol = Math.max(0, Math.floor(this.scrollX / this.cellWidth));
        const endCol = Math.min(this.gridCols, Math.floor((this.scrollX + this.canvasWidth) / this.cellWidth) + 1);

        for (let col = startCol; col < endCol; col++) {
            const x = this.labelWidth + (col * this.cellWidth) - this.scrollX;

            // Beat marker
            if (col % 4 === 0) {
                this.ctx.fillStyle = this.colors.barMarker;
                this.ctx.fillRect(x, this.headerHeight, 2, this.gridRows * this.cellHeight);
            } else {
                this.ctx.fillStyle = this.colors.beatMarker;
                this.ctx.fillRect(x, this.headerHeight, 1, this.gridRows * this.cellHeight);
            }

            // Beat number
            this.ctx.fillStyle = this.colors.text;
            this.ctx.fillText((col + 1).toString(), x + this.cellWidth / 2, this.headerHeight / 2);
        }
    }

    drawGrid() {
        this.ctx.strokeStyle = this.colors.gridLine;
        this.ctx.lineWidth = 0.5;

        const startCol = Math.max(0, Math.floor(this.scrollX / this.cellWidth));
        const endCol = Math.min(this.gridCols, Math.floor((this.scrollX + this.canvasWidth) / this.cellWidth) + 1);
        const startRow = Math.max(0, Math.floor(this.scrollY / this.cellHeight));
        const endRow = Math.min(this.gridRows, Math.floor((this.scrollY + this.canvasHeight) / this.cellHeight) + 1);

        // Vertical grid lines
        for (let col = startCol; col <= endCol; col++) {
            const x = this.labelWidth + (col * this.cellWidth) - this.scrollX;
            this.ctx.beginPath();
            this.ctx.moveTo(x, this.headerHeight);
            this.ctx.lineTo(x, this.headerHeight + this.gridRows * this.cellHeight);
            this.ctx.stroke();
        }

        // Horizontal grid lines
        for (let row = startRow; row <= endRow; row++) {
            const y = this.headerHeight + (row * this.cellHeight) - this.scrollY;
            this.ctx.beginPath();
            this.ctx.moveTo(this.labelWidth, y);
            this.ctx.lineTo(this.labelWidth + this.gridCols * this.cellWidth, y);
            this.ctx.stroke();
        }
    }

    drawNotes() {
        for (const note of this.notes.values()) {
            const x = this.labelWidth + (note.col * this.cellWidth) - this.scrollX;
            const y = this.headerHeight + (note.row * this.cellHeight) - this.scrollY;

            // Skip if outside viewport
            if (x + this.cellWidth < 0 || x > this.canvasWidth ||
                y + this.cellHeight < 0 || y > this.canvasHeight) {
                continue;
            }

            // Note background
            this.ctx.fillStyle = this.colors.activeNote;
            this.ctx.fillRect(x + 2, y + 2, (this.cellWidth * note.duration) - 4, this.cellHeight - 4);

            // Note border
            this.ctx.strokeStyle = this.colors.text;
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(x + 2, y + 2, (this.cellWidth * note.duration) - 4, this.cellHeight - 4);

            // Draw resize handle (right edge)
            const handleWidth = 8;
            const handleX = x + (this.cellWidth * note.duration) - handleWidth - 2;
            const handleY = y + 4;
            const handleHeight = this.cellHeight - 8;
            this.ctx.fillStyle = '#ffaa00';
            this.ctx.fillRect(handleX, handleY, handleWidth, handleHeight);
        }
    }
    drawCurrentStep() {
        if (this.isPlaying) {
            // Usa visualStep per il rendering fluido
            const stepToRender = this.visualStep;

            if (stepToRender >= 0 && stepToRender < this.gridCols) {
                const x = this.labelWidth + (stepToRender * this.cellWidth) - this.scrollX;

                // Current step highlight
                this.ctx.fillStyle = this.colors.currentStep + '40'; // Semi-transparent
                this.ctx.fillRect(x, this.headerHeight, this.cellWidth, this.gridRows * this.cellHeight);

                // Playhead line
                this.ctx.strokeStyle = this.colors.currentStep;
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.moveTo(x + this.cellWidth / 2, this.headerHeight);
                this.ctx.lineTo(x + this.cellWidth / 2, this.headerHeight + this.gridRows * this.cellHeight);
                this.ctx.stroke();
            }
        }
    }

    drawHover() {
        if (this.hoveredCell) {
            const x = this.labelWidth + (this.hoveredCell.col * this.cellWidth) - this.scrollX;
            const y = this.headerHeight + (this.hoveredCell.row * this.cellHeight) - this.scrollY;

            this.ctx.strokeStyle = this.colors.text;
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(x + 1, y + 1, this.cellWidth - 2, this.cellHeight - 2);
        }
    } drawScrollbars() {
        const scrollbarSize = 14;  // Aumentato per renderle più facili da usare
        const margin = 4;  // Margine dal bordo
        const trackColor = 'rgba(40, 40, 40, 0.9)';  // Più scuro per contrasto
        const thumbColor = this.isDraggingScrollbar ? 'rgba(74, 158, 255, 0.9)' : 'rgba(180, 180, 180, 0.8)';
        const thumbHoverColor = 'rgba(200, 200, 200, 0.9)';

        // Horizontal scrollbar (spostata più in alto)
        if (this.maxScrollX > 0) {
            const scrollbarY = this.canvasHeight - scrollbarSize - margin;
            const scrollbarWidth = this.canvasWidth - this.labelWidth - scrollbarSize - margin;
            const scrollbarX = this.labelWidth;

            // Track with better contrast and rounded corners
            this.ctx.fillStyle = trackColor;
            this.ctx.fillRect(scrollbarX, scrollbarY, scrollbarWidth, scrollbarSize);

            // Add subtle border
            this.ctx.strokeStyle = 'rgba(60, 60, 60, 0.8)';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(scrollbarX, scrollbarY, scrollbarWidth, scrollbarSize);

            // Thumb with better visibility
            const thumbWidth = Math.max(20, (scrollbarWidth * this.canvasWidth) / this.totalWidth);
            const thumbX = scrollbarX + (this.scrollX / this.maxScrollX) * (scrollbarWidth - thumbWidth);

            this.ctx.fillStyle = this.draggingHorizontalScrollbar ? thumbColor : thumbHoverColor;
            this.ctx.fillRect(thumbX + 2, scrollbarY + 2, thumbWidth - 4, scrollbarSize - 4);

            // Add highlight to thumb
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(thumbX + 2, scrollbarY + 2, thumbWidth - 4, scrollbarSize - 4);
        }

        // Vertical scrollbar (spostata più a sinistra)
        if (this.maxScrollY > 0) {
            const scrollbarX = this.canvasWidth - scrollbarSize - margin;
            const scrollbarHeight = this.canvasHeight - this.headerHeight - scrollbarSize - margin;
            const scrollbarY = this.headerHeight;

            // Track with better contrast and rounded corners
            this.ctx.fillStyle = trackColor;
            this.ctx.fillRect(scrollbarX, scrollbarY, scrollbarSize, scrollbarHeight);

            // Add subtle border
            this.ctx.strokeStyle = 'rgba(60, 60, 60, 0.8)';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(scrollbarX, scrollbarY, scrollbarSize, scrollbarHeight);

            // Thumb with better visibility
            const thumbHeight = Math.max(20, (scrollbarHeight * this.canvasHeight) / this.totalHeight);
            const thumbY = scrollbarY + (this.scrollY / this.maxScrollY) * (scrollbarHeight - thumbHeight);

            this.ctx.fillStyle = this.draggingVerticalScrollbar ? thumbColor : thumbHoverColor;
            this.ctx.fillRect(scrollbarX + 2, thumbY + 2, scrollbarSize - 4, thumbHeight - 4);
            // Add highlight to thumb
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(scrollbarX + 2, thumbY + 2, scrollbarSize - 4, thumbHeight - 4);
        }
    }

    // Helper methods for scrollbar interaction
    getScrollbarAtPosition(x, y) {
        const scrollbarSize = 14;  // Aumentato per renderle più facili da usare
        const margin = 4;  // Margine dal bordo

        // Check horizontal scrollbar (spostata più in alto)
        if (this.maxScrollX > 0) {
            const scrollbarY = this.canvasHeight - scrollbarSize - margin;
            const scrollbarWidth = this.canvasWidth - this.labelWidth - scrollbarSize - margin;
            const scrollbarX = this.labelWidth;

            if (x >= scrollbarX && x <= scrollbarX + scrollbarWidth &&
                y >= scrollbarY && y <= scrollbarY + scrollbarSize) {
                return 'horizontal';
            }
        }

        // Check vertical scrollbar (spostata più a sinistra)
        if (this.maxScrollY > 0) {
            const scrollbarX = this.canvasWidth - scrollbarSize - margin;
            const scrollbarHeight = this.canvasHeight - this.headerHeight - scrollbarSize - margin;
            const scrollbarY = this.headerHeight;

            if (x >= scrollbarX && x <= scrollbarX + scrollbarSize &&
                y >= scrollbarY && y <= scrollbarY + scrollbarHeight) {
                return 'vertical';
            }
        }

        return null;
    }

    handleScrollbarClick(scrollbarType, x, y) {
        const scrollbarSize = 14;
        const margin = 4;

        if (scrollbarType === 'horizontal') {
            const scrollbarWidth = this.canvasWidth - this.labelWidth - scrollbarSize - margin;
            const scrollbarX = this.labelWidth;
            const clickRatio = (x - scrollbarX) / scrollbarWidth;
            this.scrollX = Math.max(0, Math.min(this.maxScrollX, clickRatio * this.maxScrollX));
        } else if (scrollbarType === 'vertical') {
            const scrollbarHeight = this.canvasHeight - this.headerHeight - scrollbarSize - margin;
            const scrollbarY = this.headerHeight;
            const clickRatio = (y - scrollbarY) / scrollbarHeight;
            this.scrollY = Math.max(0, Math.min(this.maxScrollY, clickRatio * this.maxScrollY));
        }

        this.needsRedraw = true;
    }

    // Event system
    dispatchEvent(eventType, data = {}) {
        const event = new CustomEvent(eventType, { detail: data });
        document.dispatchEvent(event);
    }    // Cleanup
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        // Disconnect from external timer
        if (this.TimingProxy) {
            this.TimingProxy.disconnect();
        }

        // Remove controls
        const controls = document.querySelector('.canvas-controls');
        if (controls) {
            controls.remove();
        }
    }
    if(controls) {
        controls.remove();
    }
}


export default PianoRollCanvas;
