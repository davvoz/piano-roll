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
        this.needsRedraw = true;
        // Note resize properties
        this.isResizingNote = false;
        this.resizingNoteKey = null;
        this.resizingNoteStartX = null;
        this.resizingNoteInitialDuration = null;
        this.justFinishedResizing = false; // Flag per prevenire click dopo resize// Flag per ottimizzare il rendering

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
    }

    createControls() {
        const controls = document.createElement('div');
        controls.className = 'canvas-controls'; controls.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            z-index: 1000;
            background: rgba(0,0,0,0.9);
            padding: 10px;
            border-radius: 8px;
            color: white;
            font-family: Arial, sans-serif;
            font-size: 14px;
            cursor: move;
            user-select: none;
            border: 1px solid rgba(255,255,255,0.2);
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            backdrop-filter: blur(10px);
            transition: box-shadow 0.2s ease;
        `;

        // Add hover effect
        controls.addEventListener('mouseenter', () => {
            controls.style.boxShadow = '0 6px 16px rgba(0,0,0,0.4)';
            controls.style.border = '1px solid rgba(255,255,255,0.3)';
        });

        controls.addEventListener('mouseleave', () => {
            controls.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
            controls.style.border = '1px solid rgba(255,255,255,0.2)';
        });
        controls.innerHTML = `
            <div class="controls-header" style="
                margin-bottom: 10px; 
                padding-bottom: 8px; 
                border-bottom: 1px solid rgba(255,255,255,0.2); 
                cursor: move;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <span style="font-weight: bold; color: #4a9eff;">♪ Piano Roll</span>
                <span style="font-size: 11px; opacity: 0.6; font-style: italic;">drag me</span>
            </div>            <div style="margin-bottom: 10px;">
                <label style="display: block; margin-bottom: 5px;">Tempo: <span id="tempo-value">${this.config.tempo}</span> BPM</label>
                <input type="range" id="tempo-slider" min="60" max="200" value="${this.config.tempo}" style="width: 100%; accent-color: #4a9eff;">
            </div>
            <div style="margin-bottom: 10px;">
                <label style="display: block; margin-bottom: 5px;">Lunghezza: <span id="length-value">${this.config.gridCols}</span> steps</label>
                <input type="range" id="length-slider" min="8" max="128" value="${this.config.gridCols}" style="width: 100%; accent-color: #4a9eff;">
            </div>            <div style="margin-bottom: 10px;">
                <label style="cursor: pointer;">
                    <input type="checkbox" id="loop-checkbox" ${this.config.isLooping ? 'checked' : ''} style="margin-right: 5px; accent-color: #4a9eff;"> Loop
                </label>
            </div>
            <div style="margin-bottom: 10px;">
                <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #cccccc;">Navigazione:</label>
                <div style="display: flex; gap: 5px;">
                    <button id="scroll-start" style="padding: 3px 8px; border: none; border-radius: 3px; background: #555; color: white; cursor: pointer; font-size: 12px;">⏮ Inizio</button>
                    <button id="scroll-left" style="padding: 3px 8px; border: none; border-radius: 3px; background: #555; color: white; cursor: pointer; font-size: 12px;">◀</button>
                    <button id="scroll-right" style="padding: 3px 8px; border: none; border-radius: 3px; background: #555; color: white; cursor: pointer; font-size: 12px;">▶</button>
                    <button id="scroll-end" style="padding: 3px 8px; border: none; border-radius: 3px; background: #555; color: white; cursor: pointer; font-size: 12px;">⏭ Fine</button>
                </div>
            </div>
            <div>
                <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #cccccc;">Scroll: Shift+Ruota (Orizz.) | Ruota (Vert.)</label>
            </div>
        `; document.body.appendChild(controls);

        // Add button hover effects
        const buttons = controls.querySelectorAll('button');
        buttons.forEach(button => {
            button.addEventListener('mouseenter', () => {
                button.style.transform = 'scale(1.05)';
                button.style.transition = 'transform 0.1s ease';
            });
            button.addEventListener('mouseleave', () => {
                button.style.transform = 'scale(1)';
            });
        });
        const tempoSlider = document.getElementById('tempo-slider');
        tempoSlider.addEventListener('input', (e) => {
            const tempo = parseInt(e.target.value);
            this.setTempo(tempo);
            document.getElementById('tempo-value').textContent = tempo;
        }); const lengthSlider = document.getElementById('length-slider');
        lengthSlider.addEventListener('input', (e) => {
            const length = parseInt(e.target.value);
            this.setGridLength(length);
            document.getElementById('length-value').textContent = length;

            // Aggiorna il timing engine con la nuova regione di loop
            this.TimingProxy.setLoopRegion(this.config.loopStart, this.config.loopEnd);
        });
        document.getElementById('loop-checkbox').addEventListener('change', (e) => {
            this.TimingProxy.setLooping(e.target.checked);
        });

        // Navigation controls
        document.getElementById('scroll-start').addEventListener('click', () => {
            this.scrollX = 0;
            this.needsRedraw = true;
        });

        document.getElementById('scroll-left').addEventListener('click', () => {
            this.scrollX = Math.max(0, this.scrollX - this.cellWidth * 4);
            this.needsRedraw = true;
        });

        document.getElementById('scroll-right').addEventListener('click', () => {
            this.scrollX = Math.min(this.maxScrollX, this.scrollX + this.cellWidth * 4);
            this.needsRedraw = true;
        });

        document.getElementById('scroll-end').addEventListener('click', () => {
            this.scrollX = this.maxScrollX;
            this.needsRedraw = true;
        });

        // Make controls draggable
        this.makeDraggable(controls);
    }

    makeDraggable(element) {
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;

        // Get initial position from CSS
        const rect = element.getBoundingClientRect();
        xOffset = rect.left;
        yOffset = rect.top;

        const dragStart = (e) => {
            // Only drag from header or main area, not from controls
            const target = e.target;
            if (target.tagName === 'INPUT' || target.tagName === 'BUTTON') {
                return;
            }

            if (e.type === "touchstart") {
                initialX = e.touches[0].clientX - xOffset;
                initialY = e.touches[0].clientY - yOffset;
            } else {
                initialX = e.clientX - xOffset;
                initialY = e.clientY - yOffset;
            }

            if (e.target === element || e.target.closest('.controls-header')) {
                isDragging = true;
                element.style.cursor = 'grabbing';
            }
        };

        const dragEnd = (e) => {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
            element.style.cursor = 'move';
        };

        const drag = (e) => {
            if (isDragging) {
                e.preventDefault();

                if (e.type === "touchmove") {
                    currentX = e.touches[0].clientX - initialX;
                    currentY = e.touches[0].clientY - initialY;
                } else {
                    currentX = e.clientX - initialX;
                    currentY = e.clientY - initialY;
                }

                xOffset = currentX;
                yOffset = currentY;

                // Keep within viewport bounds
                const maxX = window.innerWidth - element.offsetWidth;
                const maxY = window.innerHeight - element.offsetHeight;

                currentX = Math.max(0, Math.min(currentX, maxX));
                currentY = Math.max(0, Math.min(currentY, maxY));

                element.style.left = currentX + "px";
                element.style.top = currentY + "px";
            }
        };

        // Mouse events
        element.addEventListener("mousedown", dragStart);
        document.addEventListener("mousemove", drag);
        document.addEventListener("mouseup", dragEnd);

        // Touch events for mobile
        element.addEventListener("touchstart", dragStart);
        document.addEventListener("touchmove", drag);
        document.addEventListener("touchend", dragEnd);
    }

    resizeCanvas() {
        const rect = this.container.getBoundingClientRect();
        this.canvasWidth = rect.width;
        this.canvasHeight = rect.height;

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
    }

    handleMouseDown(event) {
        const pos = this.getMousePosition(event);
        this.lastMouseX = pos.x;
        this.lastMouseY = pos.y;
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
    }

    handleMouseMove(event) {
        const pos = this.getMousePosition(event);

        // --- AGGIUNTA: cambia il cursore se sopra handle ---
        const hit = this.getNoteResizeHandleAtPosition(pos.x, pos.y);
        if (hit) {
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
    } getNoteResizeHandleAtPosition(x, y) {
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
    } handleClick(event) {
        // Se sto ridimensionando o ho appena finito di ridimensionare, ignora il click
        if (this.isResizingNote || this.justFinishedResizing) {
            event.preventDefault();
            return;
        }

        const pos = this.getMousePosition(event);

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
        }

        // Scroll
        if (event.shiftKey) {
            this.scrollX = Math.max(0, Math.min(this.maxScrollX, this.scrollX + event.deltaY));
        } else {
            this.scrollY = Math.max(0, Math.min(this.maxScrollY, this.scrollY + event.deltaY));
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
    }    onTimingPlay() {
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
    }

    drawScrollbars() {
        const scrollbarSize = 12;
        const scrollbarColor = 'rgba(255, 255, 255, 0.3)';
        const thumbColor = 'rgba(255, 255, 255, 0.6)';

        // Horizontal scrollbar
        if (this.maxScrollX > 0) {
            const scrollbarY = this.canvasHeight - scrollbarSize;
            const scrollbarWidth = this.canvasWidth - this.labelWidth;
            const scrollbarX = this.labelWidth;

            // Track
            this.ctx.fillStyle = scrollbarColor;
            this.ctx.fillRect(scrollbarX, scrollbarY, scrollbarWidth, scrollbarSize);

            // Thumb
            const thumbWidth = Math.max(20, (scrollbarWidth * this.canvasWidth) / this.totalWidth);
            const thumbX = scrollbarX + (this.scrollX / this.maxScrollX) * (scrollbarWidth - thumbWidth);

            this.ctx.fillStyle = thumbColor;
            this.ctx.fillRect(thumbX, scrollbarY, thumbWidth, scrollbarSize);
        }

        // Vertical scrollbar
        if (this.maxScrollY > 0) {
            const scrollbarX = this.canvasWidth - scrollbarSize;
            const scrollbarHeight = this.canvasHeight - this.headerHeight;
            const scrollbarY = this.headerHeight;

            // Track
            this.ctx.fillStyle = scrollbarColor;
            this.ctx.fillRect(scrollbarX, scrollbarY, scrollbarSize, scrollbarHeight);

            // Thumb
            const thumbHeight = Math.max(20, (scrollbarHeight * this.canvasHeight) / this.totalHeight);
            const thumbY = scrollbarY + (this.scrollY / this.maxScrollY) * (scrollbarHeight - thumbHeight);

            this.ctx.fillStyle = thumbColor;
            this.ctx.fillRect(scrollbarX, thumbY, scrollbarSize, thumbHeight);
        }
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
