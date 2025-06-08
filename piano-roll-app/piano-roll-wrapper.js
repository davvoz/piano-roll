import PianoRollCanvas from './piano-roll/piano-roll-canvas.js';

class PianoRollWrapper {
    constructor(container, options = {}) {
        this.container = container;
        this.pianoRoll = null;
        this.audioEngine = options.audioEngine || null;

        // Default configuration
        this.config = {
            // Dimensioni grafiche
            gridRows: options.gridRows || 20,
            gridCols: options.gridCols || 20,
            cellHeight: options.cellHeight || 20,
            cellWidth: options.cellWidth || 20,
            labelWidth: options.labelWidth || 20,
            headerHeight: options.headerHeight || 20,

            // Canvas dimensions
            canvasWidth: options.canvasWidth || 'auto',
            canvasHeight: options.canvasHeight || 'auto',
            minCanvasWidth: options.minCanvasWidth || 400,
            minCanvasHeight: options.minCanvasHeight || 300,
            maxCanvasWidth: options.maxCanvasWidth || null,
            maxCanvasHeight: options.maxCanvasHeight || null,

            // Configurazione musicale
            tempo: options.tempo || 120,
            timeSignature: options.timeSignature || { numerator: 4, denominator: 4 },
            subdivision: options.subdivision || 16,
            totalBars: options.totalBars || 8,

            // Controlli UI
            showControls: options.showControls !== false,
            showDimensionControls: options.showDimensionControls !== false,
            showLengthControls: options.showLengthControls !== false,
            showAudioControls: options.showAudioControls !== false,

            // Collasso controlli
            startCollapsed: options.startCollapsed || false,
            startFullyCollapsed: options.startFullyCollapsed || false,

            // Auto-resize
            autoResize: options.autoResize !== false,
            minCellHeight: options.minCellHeight || 16,
            maxCellHeight: options.maxCellHeight || 40,
            minCellWidth: options.minCellWidth || 24,
            maxCellWidth: options.maxCellWidth || 80,

            // Audio
            masterVolume: options.masterVolume || 20
        };

        this.controls = null;
        this.isControlsCollapsed = this.config.startCollapsed;
        this.isFullyCollapsed = this.config.startFullyCollapsed;
        this.init();
    } init() {
        this.createWrapper();
        this.createControls();
        this.createPianoRoll();
        this.setupEventListeners();
    }

    createWrapper() {
        // Wrapper container
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'piano-roll-wrapper';
        this.wrapper.style.cssText = `
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            position: relative;
        `;

        this.container.appendChild(this.wrapper);
    }

    createControls() {
        if (!this.config.showControls) return;

        this.controls = document.createElement('div');
        this.controls.className = 'piano-roll-controls';
        this.controls.style.cssText = `
            background: rgba(30, 30, 30, 0.95);
            color: white;
            border-bottom: 1px solid #444;
            display: flex;
            flex-direction: column;
            font-family: Arial, sans-serif;
            font-size: 13px;
            z-index: 1000;
            transition: max-height 0.3s ease-in-out;
            overflow: hidden;
        `;

        // Header con pulsante collapse
        const controlsHeader = document.createElement('div');
        controlsHeader.className = 'controls-header';
        controlsHeader.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            background: rgba(20, 20, 20, 0.8);
            border-bottom: 1px solid #555;
            cursor: pointer;
            user-select: none;
        `;

        controlsHeader.innerHTML = `
            <span style="font-weight: bold; font-size: 14px;">Piano Roll Controls</span>
            <div style="display: flex; gap: 4px;">
               
                <button id="collapse-controls" style="
                    background: none;
                    border: none;
                    color: white;
                    font-size: 16px;
                    cursor: pointer;
                    padding: 4px 8px;
                    border-radius: 3px;
                    transition: background-color 0.2s;
                ">▼</button>
            </div>
        `;

        // Contenuto dei controlli
        const controlsContent = document.createElement('div');
        controlsContent.className = 'controls-content';
        controlsContent.style.cssText = `
            padding: 12px;
            display: flex;
            gap: 20px;
            align-items: center;
            flex-wrap: wrap;
            transition: all 0.3s ease-in-out;
            max-height: 200px;
            opacity: 1;
        `;

        let controlsHTML = '';

        // Controlli dimensioni celle
        if (this.config.showDimensionControls) {
            controlsHTML += `
                <div class="control-group">
                    <label>Dimensioni:</label>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <div>
                            <label>Alt. Cella: <span id="cell-height-value">${this.config.cellHeight}</span>px</label>
                            <input type="range" id="cell-height" min="${this.config.minCellHeight}" max="${this.config.maxCellHeight}" value="${this.config.cellHeight}" style="width: 100px;">
                        </div>
                    </div>
                </div>
            `;
        }

        // Controlli lunghezza partitura
        if (this.config.showLengthControls) {
            controlsHTML += `
                <div class="control-group">
                    <label>Partitura:</label>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <div>
                            <label>Battute: <span id="total-bars-value">${this.config.totalBars}</span></label>
                            <input type="range" id="total-bars" min="1" max="32" value="${this.config.totalBars}" style="width: 100px;">
                        </div>
                        <div>
                            <label>Suddivisione: <span id="subdivision-value">${this.config.subdivision}</span></label>
                            <select id="subdivision" style="background: #333; color: white; border: 1px solid #555; padding: 4px;">
                                <option value="4" ${this.config.subdivision === 4 ? 'selected' : ''}>1/4</option>
                                <option value="8" ${this.config.subdivision === 8 ? 'selected' : ''}>1/8</option>
                                <option value="16" ${this.config.subdivision === 16 ? 'selected' : ''}>1/16</option>
                                <option value="32" ${this.config.subdivision === 32 ? 'selected' : ''}>1/32</option>
                            </select>
                        </div>
                    </div>
                </div>
            `;
        }


        controlsContent.innerHTML = controlsHTML;

        this.controls.appendChild(controlsHeader);
        this.controls.appendChild(controlsContent);
        this.wrapper.appendChild(this.controls);

        // Setup collapse functionality
        this.setupCollapseControls();
    }

    createPianoRoll() {
        // Piano roll container
        this.pianoRollContainer = document.createElement('div');
        this.pianoRollContainer.className = 'piano-roll-container';
        this.pianoRollContainer.style.cssText = `
            flex: 1;
            overflow: auto;
            position: relative;
            transition: max-height 0.3s ease-in-out, opacity 0.3s ease-in-out;
            max-height: 100vh;
            opacity: 1;
        `;

        this.wrapper.appendChild(this.pianoRollContainer);

        // Calculate grid columns based on bars and subdivision
        this.updateGridColumns();

        // Create piano roll instance
        this.pianoRoll = new PianoRollCanvas(this.pianoRollContainer, {
            gridRows: this.config.gridRows,
            gridCols: this.config.gridCols,
            tempo: this.config.tempo,
            cellHeight: this.config.cellHeight,
            labelWidth: this.config.labelWidth,
            canvasWidth: this.config.canvasWidth,
            canvasHeight: this.config.canvasHeight,
            minCanvasWidth: this.config.minCanvasWidth,
            minCanvasHeight: this.config.minCanvasHeight,
            maxCanvasWidth: this.config.maxCanvasWidth,
            maxCanvasHeight: this.config.maxCanvasHeight
        });

        // Apply initial collapse state if needed
        if (this.isFullyCollapsed) {
            this.applyFullCollapse();
        }



        this.container.appendChild(this.wrapper);
    }

    createPianoRoll() {
        // Piano roll container
        this.pianoRollContainer = document.createElement('div');
        this.pianoRollContainer.className = 'piano-roll-container';
        this.pianoRollContainer.style.cssText = `
            flex: 1;
            overflow: auto;
            position: relative;
            transition: max-height 0.3s ease-in-out, opacity 0.3s ease-in-out;
            max-height: 100vh;
            opacity: 1;
        `;

        this.wrapper.appendChild(this.pianoRollContainer);

        // Calculate grid columns based on bars and subdivision
        this.updateGridColumns();

        // Create piano roll instance
        this.pianoRoll = new PianoRollCanvas(this.pianoRollContainer, {
            gridRows: this.config.gridRows,
            gridCols: this.config.gridCols,
            tempo: this.config.tempo,
            cellHeight: this.config.cellHeight,
            labelWidth: this.config.labelWidth,
            canvasWidth: this.config.canvasWidth,
            canvasHeight: this.config.canvasHeight,
            minCanvasWidth: this.config.minCanvasWidth,
            minCanvasHeight: this.config.minCanvasHeight,
            maxCanvasWidth: this.config.maxCanvasWidth,
            maxCanvasHeight: this.config.maxCanvasHeight
        });

        // Apply initial collapse state if needed
        if (this.isFullyCollapsed) {
            this.applyFullCollapse();
        }
    }

    setupEventListeners() {
        if (!this.controls) return;

        // Dimensioni celle
        const cellHeightSlider = this.controls.querySelector('#cell-height');
        const cellWidthSlider = this.controls.querySelector('#cell-width');
        const gridRowsSlider = this.controls.querySelector('#grid-rows');

        if (cellHeightSlider) {
            cellHeightSlider.addEventListener('input', (e) => {
                this.config.cellHeight = parseInt(e.target.value);
                this.controls.querySelector('#cell-height-value').textContent = this.config.cellHeight;
                this.updatePianoRollDimensions();
            });
        }

        if (cellWidthSlider) {
            cellWidthSlider.addEventListener('input', (e) => {
                this.config.cellWidth = parseInt(e.target.value);
                this.controls.querySelector('#cell-width-value').textContent = this.config.cellWidth;
                this.updatePianoRollDimensions();
            });
        }

        if (gridRowsSlider) {
            gridRowsSlider.addEventListener('input', (e) => {
                this.config.gridRows = parseInt(e.target.value);
                this.controls.querySelector('#grid-rows-value').textContent = this.config.gridRows;
                this.updatePianoRollDimensions();
            });
        }

        // Controlli partitura
        const totalBarsSlider = this.controls.querySelector('#total-bars');
        const subdivisionSelect = this.controls.querySelector('#subdivision');
        const tempoSlider = this.controls.querySelector('#tempo');

        if (totalBarsSlider) {
            totalBarsSlider.addEventListener('input', (e) => {
                this.config.totalBars = parseInt(e.target.value);
                this.controls.querySelector('#total-bars-value').textContent = this.config.totalBars;
                this.updateGridColumns();
                this.updatePianoRollDimensions();
            });
        }

        if (subdivisionSelect) {
            subdivisionSelect.addEventListener('change', (e) => {
                this.config.subdivision = parseInt(e.target.value);
                this.controls.querySelector('#subdivision-value').textContent = this.config.subdivision;
                this.updateGridColumns();
                this.updatePianoRollDimensions();
            });
        }

        if (tempoSlider) {
            tempoSlider.addEventListener('input', (e) => {
                this.config.tempo = parseInt(e.target.value);
                this.controls.querySelector('#tempo-value').textContent = this.config.tempo;
                this.updateTempo();
            });
        }
        // Pulsanti azione
        const fitToScreenBtn = this.controls.querySelector('#fit-to-screen');
        const resetBtn = this.controls.querySelector('#reset-dimensions');

        if (fitToScreenBtn) {
            fitToScreenBtn.addEventListener('click', () => this.fitToScreen());
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetDimensions());
        }

        // Controlli audio
        const masterVolumeSlider = this.controls.querySelector('#master-volume');
        const stopAllBtn = this.controls.querySelector('#stop-all-notes');
        const exportConfigBtn = this.controls.querySelector('#export-config');

        if (masterVolumeSlider) {
            masterVolumeSlider.addEventListener('input', (e) => {
                this.config.masterVolume = parseInt(e.target.value);
                this.controls.querySelector('#master-volume-value').textContent = this.config.masterVolume;
                this.dispatchEvent('audioVolumeChanged', { volume: this.config.masterVolume });
            });
        }

        if (stopAllBtn) {
            stopAllBtn.addEventListener('click', () => {
                this.dispatchEvent('stopAllNotes', {});
            });
        } if (exportConfigBtn) {
            exportConfigBtn.addEventListener('click', () => {
                const config = this.exportConfig();
                console.log('Piano Roll Configuration:', config);
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(config);
                    alert('Configuration copied to clipboard!');
                }
            });
        }

        // Controlli scroll orizzontale
        const scrollStartBtn = this.controls.querySelector('#scroll-start');
        const scrollLeftBtn = this.controls.querySelector('#scroll-left');
        const scrollRightBtn = this.controls.querySelector('#scroll-right');
        const scrollEndBtn = this.controls.querySelector('#scroll-end');

        if (scrollStartBtn) {
            scrollStartBtn.addEventListener('click', () => {
                if (this.pianoRoll) {
                    this.pianoRoll.scrollX = 0;
                    this.pianoRoll.needsRedraw = true;
                }
            });
        }

        if (scrollLeftBtn) {
            scrollLeftBtn.addEventListener('click', () => {
                if (this.pianoRoll) {
                    this.pianoRoll.scrollX = Math.max(0, this.pianoRoll.scrollX - this.pianoRoll.cellWidth * 4);
                    this.pianoRoll.needsRedraw = true;
                }
            });
        }

        if (scrollRightBtn) {
            scrollRightBtn.addEventListener('click', () => {
                if (this.pianoRoll) {
                    this.pianoRoll.scrollX = Math.min(this.pianoRoll.maxScrollX, this.pianoRoll.scrollX + this.pianoRoll.cellWidth * 4);
                    this.pianoRoll.needsRedraw = true;
                }
            });
        }

        if (scrollEndBtn) {
            scrollEndBtn.addEventListener('click', () => {
                if (this.pianoRoll) {
                    this.pianoRoll.scrollX = this.pianoRoll.maxScrollX;
                    this.pianoRoll.needsRedraw = true;
                }
            });
        }

        // Auto-resize su ridimensionamento finestra
        if (this.config.autoResize) {
            window.addEventListener('resize', () => {
                setTimeout(() => this.handleWindowResize(), 200);
            });
        }
    }

    updateGridColumns() {
        // Calcola il numero di colonne basato su battute e suddivisione
        this.config.gridCols = this.config.totalBars * this.config.subdivision;
    } updatePianoRollDimensions() {
        if (!this.pianoRoll) return;

        // Store current state before recreating
        const currentState = {
            isPlaying: this.pianoRoll.isPlaying,
            currentStep: this.pianoRoll.currentStep,
            visualStep: this.pianoRoll.visualStep,
            notes: new Map(this.pianoRoll.notes),
            scrollX: this.pianoRoll.scrollX,
            scrollY: this.pianoRoll.scrollY,
            externalTimer: this.pianoRoll.TimingProxy.externalTimer
        };

        // Ricrea il piano roll con le nuove dimensioni
        this.pianoRollContainer.innerHTML = '';
        this.pianoRoll = new PianoRollCanvas(this.pianoRollContainer, {
            gridRows: this.config.gridRows,
            gridCols: this.config.gridCols,
            tempo: this.config.tempo,
            cellHeight: this.config.cellHeight,
            labelWidth: this.config.labelWidth,
            canvasWidth: this.config.canvasWidth,
            canvasHeight: this.config.canvasHeight,
            minCanvasWidth: this.config.minCanvasWidth,
            minCanvasHeight: this.config.minCanvasHeight,
            maxCanvasWidth: this.config.maxCanvasWidth,
            maxCanvasHeight: this.config.maxCanvasHeight
        });

        // Restore state after recreation
        this.pianoRoll.isPlaying = currentState.isPlaying;
        this.pianoRoll.currentStep = currentState.currentStep;
        this.pianoRoll.visualStep = currentState.visualStep;
        this.pianoRoll.notes = currentState.notes;

        // Restore scroll position (adjust for new dimensions)
        this.pianoRoll.scrollX = Math.min(currentState.scrollX, this.pianoRoll.maxScrollX);
        this.pianoRoll.scrollY = Math.min(currentState.scrollY, this.pianoRoll.maxScrollY);

        // Reconnect to external timer if it was connected
        if (currentState.externalTimer) {
            this.pianoRoll.TimingProxy.connectToTimer(currentState.externalTimer);

            // If the timer was playing, make sure the visual state is properly synced
            if (currentState.isPlaying) {
                // Update timing proxy state to reflect playing status
                this.pianoRoll.TimingProxy.isPlaying = true;

                // Force a timing update to get the current position from the external timer
                if (currentState.externalTimer.getCurrentStep) {
                    const currentTimerStep = currentState.externalTimer.getCurrentStep();
                    this.pianoRoll.currentStep = currentTimerStep;
                    this.pianoRoll.visualStep = currentTimerStep;
                }
            }
        }

        // Force redraw to show restored state
        this.pianoRoll.needsRedraw = true;

        // Riconnetti agli eventi se necessario
        this.dispatchEvent('dimensionsChanged', {
            gridRows: this.config.gridRows,
            gridCols: this.config.gridCols,
            cellHeight: this.config.cellHeight,
            cellWidth: this.config.cellWidth,
            pianoRoll: this.pianoRoll // Include the new instance for re-connection
        });
    }

    updateTempo() {
        if (this.pianoRoll && this.pianoRoll.setTempo) {
            this.pianoRoll.setTempo(this.config.tempo);
        }

        this.dispatchEvent('tempoChanged', { tempo: this.config.tempo });
    }

    fitToScreen() {
        const containerRect = this.pianoRollContainer.getBoundingClientRect();
        const availableWidth = containerRect.width - this.config.labelWidth - 20; // margini
        const availableHeight = containerRect.height - this.config.headerHeight - 20;

        // Calcola dimensioni ottimali
        const optimalCellWidth = Math.max(
            this.config.minCellWidth,
            Math.min(this.config.maxCellWidth, Math.floor(availableWidth / this.config.gridCols))
        );

        const optimalCellHeight = Math.max(
            this.config.minCellHeight,
            Math.min(this.config.maxCellHeight, Math.floor(availableHeight / this.config.gridRows))
        );

        // Aggiorna configurazione
        this.config.cellWidth = optimalCellWidth;
        this.config.cellHeight = optimalCellHeight;

        // Aggiorna controlli UI
        if (this.controls) {
            const cellHeightSlider = this.controls.querySelector('#cell-height');
            const cellWidthSlider = this.controls.querySelector('#cell-width');

            if (cellHeightSlider) {
                cellHeightSlider.value = this.config.cellHeight;
                this.controls.querySelector('#cell-height-value').textContent = this.config.cellHeight;
            }

            if (cellWidthSlider) {
                cellWidthSlider.value = this.config.cellWidth;
                this.controls.querySelector('#cell-width-value').textContent = this.config.cellWidth;
            }
        }

        this.updatePianoRollDimensions();
    }

    resetDimensions() {
        // Reset alle dimensioni di default
        this.config.cellHeight = 24;
        this.config.cellWidth = 40;
        this.config.gridRows = 49;
        this.config.totalBars = 8;
        this.config.subdivision = 16;
        this.config.tempo = 120;

        // Aggiorna controlli UI
        if (this.controls) {
            this.controls.querySelector('#cell-height').value = this.config.cellHeight;
            this.controls.querySelector('#cell-height-value').textContent = this.config.cellHeight;
            this.controls.querySelector('#cell-width').value = this.config.cellWidth;
            this.controls.querySelector('#cell-width-value').textContent = this.config.cellWidth;
            this.controls.querySelector('#grid-rows').value = this.config.gridRows;
            this.controls.querySelector('#grid-rows-value').textContent = this.config.gridRows;
            this.controls.querySelector('#total-bars').value = this.config.totalBars;
            this.controls.querySelector('#total-bars-value').textContent = this.config.totalBars;
            this.controls.querySelector('#subdivision').value = this.config.subdivision;
            this.controls.querySelector('#subdivision-value').textContent = this.config.subdivision;
            this.controls.querySelector('#tempo').value = this.config.tempo;
            this.controls.querySelector('#tempo-value').textContent = this.config.tempo;
        }

        this.updateGridColumns();
        this.updatePianoRollDimensions();
    }

    handleWindowResize() {
        // Auto-fit quando la finestra viene ridimensionata
        this.fitToScreen();
    }    // Metodi pubblici per accesso alle funzionalità del piano roll
    getPianoRoll() {
        return this.pianoRoll;
    }

    getConfig() {
        return { ...this.config };
    }

    setConfig(newConfig) {
        Object.assign(this.config, newConfig);
        this.updateGridColumns();
        this.updatePianoRollDimensions();
    }

    // Metodi per controllo dimensioni programmatico
    setCellHeight(height) {
        this.config.cellHeight = Math.max(this.config.minCellHeight, Math.min(this.config.maxCellHeight, height));
        this.updateControlsUI();
        this.updatePianoRollDimensions();
    }

    setCellWidth(width) {
        this.config.cellWidth = Math.max(this.config.minCellWidth, Math.min(this.config.maxCellWidth, width));
        this.updateControlsUI();
        this.updatePianoRollDimensions();
    }

    setGridRows(rows) {
        this.config.gridRows = Math.max(25, Math.min(88, rows));
        this.updateControlsUI();
        this.updatePianoRollDimensions();
    }

    setTotalBars(bars) {
        this.config.totalBars = Math.max(1, Math.min(32, bars));
        this.updateControlsUI();
        this.updateGridColumns();
        this.updatePianoRollDimensions();
    }

    setSubdivision(subdivision) {
        const validSubdivisions = [4, 8, 16, 32];
        if (validSubdivisions.includes(subdivision)) {
            this.config.subdivision = subdivision;
            this.updateControlsUI();
            this.updateGridColumns();
            this.updatePianoRollDimensions();
        }
    }

    setTempo(tempo) {
        this.config.tempo = Math.max(60, Math.min(200, tempo));
        this.updateControlsUI();
        this.updateTempo();
    }

    // Canvas dimension control methods
    setCanvasSize(width, height) {
        this.config.canvasWidth = width;
        this.config.canvasHeight = height;
        if (this.pianoRoll) {
            this.pianoRoll.setCanvasSize(width, height);
        }
    }

    setCanvasWidth(width) {
        this.config.canvasWidth = width;
        if (this.pianoRoll) {
            this.pianoRoll.setCanvasWidth(width);
        }
    }

    setCanvasHeight(height) {
        this.config.canvasHeight = height;
        if (this.pianoRoll) {
            this.pianoRoll.setCanvasHeight(height);
        }
    }

    setCanvasLimits(minWidth, minHeight, maxWidth = null, maxHeight = null) {
        this.config.minCanvasWidth = minWidth;
        this.config.minCanvasHeight = minHeight;
        this.config.maxCanvasWidth = maxWidth;
        this.config.maxCanvasHeight = maxHeight;

        if (this.pianoRoll && this.pianoRoll.config) {
            this.pianoRoll.config.setCanvasLimits(minWidth, minHeight, maxWidth, maxHeight);
        }
    }

    getCanvasSize() {
        if (this.pianoRoll) {
            return this.pianoRoll.getCanvasSize();
        }
        return {
            width: 'auto',
            height: 'auto',
            configuredWidth: this.config.canvasWidth,
            configuredHeight: this.config.canvasHeight
        };
    }

    // Metodo per aggiornare i controlli UI nascosti
    updateControlsUI() {
        if (!this.controls) return;

        const cellHeightSlider = this.controls.querySelector('#cell-height');
        const cellWidthSlider = this.controls.querySelector('#cell-width');
        const gridRowsSlider = this.controls.querySelector('#grid-rows');
        const totalBarsSlider = this.controls.querySelector('#total-bars');
        const subdivisionSelect = this.controls.querySelector('#subdivision');
        const tempoSlider = this.controls.querySelector('#tempo');

        if (cellHeightSlider && this.controls.querySelector('#cell-height-value')) {
            cellHeightSlider.value = this.config.cellHeight;
            this.controls.querySelector('#cell-height-value').textContent = this.config.cellHeight;
        }

        if (cellWidthSlider && this.controls.querySelector('#cell-width-value')) {
            cellWidthSlider.value = this.config.cellWidth;
            this.controls.querySelector('#cell-width-value').textContent = this.config.cellWidth;
        }

        if (gridRowsSlider && this.controls.querySelector('#grid-rows-value')) {
            gridRowsSlider.value = this.config.gridRows;
            this.controls.querySelector('#grid-rows-value').textContent = this.config.gridRows;
        }

        if (totalBarsSlider && this.controls.querySelector('#total-bars-value')) {
            totalBarsSlider.value = this.config.totalBars;
            this.controls.querySelector('#total-bars-value').textContent = this.config.totalBars;
        }

        if (subdivisionSelect && this.controls.querySelector('#subdivision-value')) {
            subdivisionSelect.value = this.config.subdivision;
            this.controls.querySelector('#subdivision-value').textContent = this.config.subdivision;
        }

        if (tempoSlider && this.controls.querySelector('#tempo-value')) {
            tempoSlider.value = this.config.tempo;
            this.controls.querySelector('#tempo-value').textContent = this.config.tempo;
        }
    }

    // Sistema di eventi
    dispatchEvent(eventName, data) {
        const event = new CustomEvent(`pianorollwrapper:${eventName}`, {
            detail: data,
            bubbles: true
        });
        this.wrapper.dispatchEvent(event);
    }

    // Metodi di utility
    exportConfig() {
        return JSON.stringify(this.config, null, 2);
    }

    importConfig(configJson) {
        try {
            const config = JSON.parse(configJson);
            this.setConfig(config);
            return true;
        } catch (error) {
            console.error('Error importing config:', error);
            return false;
        }
    }
    setupCollapseControls() {
        if (!this.controls) return;

        const collapseBtn = this.controls.querySelector('#collapse-controls');
        const fullyCollapseBtn = this.controls.querySelector('#fully-collapse-controls');
        const controlsContent = this.controls.querySelector('.controls-content');

        if (collapseBtn) {
            collapseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleFullCollapse(); // Cambiato da toggleControls() a toggleFullCollapse()
            });

            // Update button text based on current state (aggiornato per riflettere il full collapse)
            collapseBtn.textContent = this.isFullyCollapsed ? '▲' : '▼';
        }

        if (fullyCollapseBtn) {
            fullyCollapseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleFullCollapse();
            });

            // Update button text based on current state
            fullyCollapseBtn.textContent = this.isFullyCollapsed ? '□' : '■';
        }

        // Apply initial collapse state
        if (this.isFullyCollapsed) {
            this.applyFullCollapse();
        } else if (this.isControlsCollapsed) {
            this.applyControlsCollapse();
        }
    }

    toggleControls() {
        this.isControlsCollapsed = !this.isControlsCollapsed;

        if (this.isControlsCollapsed) {
            this.applyControlsCollapse();
        } else {
            this.applyControlsExpand();
        }

        // Update button text
        const collapseBtn = this.controls.querySelector('#collapse-controls');
        if (collapseBtn) {
            collapseBtn.textContent = this.isControlsCollapsed ? '▲' : '▼';
        }

        this.dispatchEvent('controlsToggled', {
            isCollapsed: this.isControlsCollapsed,
            isFullyCollapsed: this.isFullyCollapsed
        });
    } 
    
    toggleFullCollapse() {
        this.isFullyCollapsed = !this.isFullyCollapsed;

        if (this.isFullyCollapsed) {
            this.applyFullCollapse();
        } else {
            this.applyFullExpand();
        }

        // Update button text per entrambi i pulsanti di collapse
        const collapseBtn = this.controls.querySelector('#collapse-controls');
        const fullyCollapseBtn = this.controls.querySelector('#fully-collapse-controls');

        if (collapseBtn) {
            collapseBtn.textContent = this.isFullyCollapsed ? '▲' : '▼';
        }

        if (fullyCollapseBtn) {
            fullyCollapseBtn.textContent = this.isFullyCollapsed ? '□' : '■';
        }

        this.dispatchEvent('fullyToggled', {
            isCollapsed: this.isControlsCollapsed,
            isFullyCollapsed: this.isFullyCollapsed
        });
    }

    applyControlsCollapse() {
        const controlsContent = this.controls.querySelector('.controls-content');
        if (controlsContent) {
            controlsContent.style.maxHeight = '0px';
            controlsContent.style.opacity = '0';
            controlsContent.style.padding = '0 12px';
        }
    }

    applyControlsExpand() {
        const controlsContent = this.controls.querySelector('.controls-content');
        if (controlsContent) {
            controlsContent.style.maxHeight = '200px';
            controlsContent.style.opacity = '1';
            controlsContent.style.padding = '12px';
        }
    } 
    
    applyFullCollapse() {
        // Hide only the controls content but keep the header visible
        const controlsContent = this.controls.querySelector('.controls-content');
        if (controlsContent) {
            controlsContent.style.maxHeight = '0px';
            controlsContent.style.opacity = '0';
            controlsContent.style.padding = '0 12px';
            controlsContent.style.overflow = 'hidden';
        }

        // Hide piano roll container
        if (this.pianoRollContainer) {
            this.pianoRollContainer.style.maxHeight = '0px';
            this.pianoRollContainer.style.opacity = '0';
            this.pianoRollContainer.style.overflow = 'hidden';
        }
    } 
    
    applyFullExpand() {
        // Show piano roll container
        if (this.pianoRollContainer) {
            this.pianoRollContainer.style.maxHeight = '100vh';
            this.pianoRollContainer.style.opacity = '1';
            this.pianoRollContainer.style.overflow = 'auto';
        }

        // Always show controls content when fully expanding
        const controlsContent = this.controls.querySelector('.controls-content');
        if (controlsContent) {
            controlsContent.style.maxHeight = '200px';
            controlsContent.style.opacity = '1';
            controlsContent.style.padding = '12px';
            controlsContent.style.overflow = 'visible';
        }        // Reset controls collapsed state to false when fully expanding
        this.isControlsCollapsed = false;
    }

    // Public methods for programmatic control
    collapseControls() {
        if (!this.isControlsCollapsed) {
            this.toggleControls();
        }
    }

    expandControls() {
        if (this.isControlsCollapsed) {
            this.toggleControls();
        }
    }

    fullyCollapse() {
        if (!this.isFullyCollapsed) {
            this.toggleFullCollapse();
        }
    }

    fullyExpand() {
        if (this.isFullyCollapsed) {
            this.toggleFullCollapse();
        }
    }

    getCollapseState() {
        return {
            isControlsCollapsed: this.isControlsCollapsed,
            isFullyCollapsed: this.isFullyCollapsed
        };
    }


}

export default PianoRollWrapper;
