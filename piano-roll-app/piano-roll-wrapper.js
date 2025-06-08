import PianoRollCanvas from './piano-roll/piano-roll-canvas.js';

class PianoRollWrapper {    constructor(container, options = {}) {
        this.container = container;
        this.pianoRoll = null;
        this.audioEngine = options.audioEngine || null;
        
        // Default configuration
        this.config = {
            // Dimensioni grafiche
            gridRows: options.gridRows || 49,
            gridCols: options.gridCols || 32,
            cellHeight: options.cellHeight || 24,
            cellWidth: options.cellWidth || 40,
            labelWidth: options.labelWidth || 60,
            headerHeight: options.headerHeight || 40,
            
            // Configurazione musicale
            tempo: options.tempo || 120,
            timeSignature: options.timeSignature || { numerator: 4, denominator: 4 },
            subdivision: options.subdivision || 16,
            totalBars: options.totalBars || 8,
            
            // Controlli UI
            showControls: options.showControls !== true,
            showDimensionControls: options.showDimensionControls !== false,
            showLengthControls: options.showLengthControls !== false,
            showAudioControls: options.showAudioControls !== false,
            
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
        this.init();
    }

    init() {
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
            padding: 12px;
            border-bottom: 1px solid #444;
            display: flex;
            gap: 20px;
            align-items: center;
            flex-wrap: wrap;
            font-family: Arial, sans-serif;
            font-size: 13px;
            z-index: 1000;
        `;
        
        let controlsHTML = '';
          // Controlli dimensioni (nascosti ma funzionali)
        // if (this.config.showDimensionControls) {
        //     controlsHTML += `
        //         <div class="control-group" style="display: none;">
        //             <label>Dimensioni:</label>
        //             <div style="display: flex; gap: 10px; align-items: center;">
        //                 <div>
        //                     <label>H: <span id="cell-height-value">${this.config.cellHeight}</span>px</label>
        //                     <input type="range" id="cell-height" min="${this.config.minCellHeight}" max="${this.config.maxCellHeight}" value="${this.config.cellHeight}" style="width: 80px;">
        //                 </div>
        //                 <div>
        //                     <label>W: <span id="cell-width-value">${this.config.cellWidth}</span>px</label>
        //                     <input type="range" id="cell-width" min="${this.config.minCellWidth}" max="${this.config.maxCellWidth}" value="${this.config.cellWidth}" style="width: 80px;">
        //                 </div>
        //                 <div>
        //                     <label>Note: <span id="grid-rows-value">${this.config.gridRows}</span></label>
        //                     <input type="range" id="grid-rows" min="25" max="88" value="${this.config.gridRows}" style="width: 80px;">
        //                 </div>
        //             </div>
        //         </div>
        //     `;
        // }
        
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
                        <div>
                            <label>Tempo: <span id="tempo-value">${this.config.tempo}</span> BPM</label>
                            <input type="range" id="tempo" min="60" max="200" value="${this.config.tempo}" style="width: 100px;">
                        </div>
                    </div>
                </div>
            `;
        }        // Controlli scroll orizzontale
        controlsHTML += `
            <div class="control-group">
                <label>Navigazione:</label>
                <div style="display: flex; gap: 5px; align-items: center;">
                    <button id="scroll-start" style="background: #555; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 12px;">⏮</button>
                    <button id="scroll-left" style="background: #555; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 12px;">◀</button>
                    <button id="scroll-right" style="background: #555; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 12px;">▶</button>
                    <button id="scroll-end" style="background: #555; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 12px;">⏭</button>
                </div>
            </div>
        `;

        // Controlli azioni
        // controlsHTML += `
        //     <div class="control-group">
        //         <button id="fit-to-screen" style="background: #007acc; color: white; border: none; padding: 6px 12px; border-radius: 3px; cursor: pointer;">
        //             Adatta a schermo
        //         </button>
        //         <button id="reset-dimensions" style="background: #666; color: white; border: none; padding: 6px 12px; border-radius: 3px; cursor: pointer;">
        //             Reset
        //         </button>
        //     </div>
        // `;

        // Controlli audio
        // if (this.config.showAudioControls) {
        //     controlsHTML += `
        //         <div class="control-group">
        //             <label>Audio:</label>
        //             <div style="display: flex; gap: 10px; align-items: center;">
        //                 <div>
        //                     <label>Volume: <span id="master-volume-value">${this.config.masterVolume}</span>%</label>
        //                     <input type="range" id="master-volume" min="0" max="100" value="${this.config.masterVolume}" style="width: 80px;">
        //                 </div>
        //                 <button id="stop-all-notes" style="background: #ff4444; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 12px;">
        //                     Stop All
        //                 </button>
        //                 <button id="export-config" style="background: #28a745; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 12px;">
        //                     Export
        //                 </button>
        //             </div>
        //         </div>
        //     `;
        // }
        
        this.controls.innerHTML = controlsHTML;
        this.wrapper.appendChild(this.controls);
    }

    createPianoRoll() {
        // Piano roll container
        this.pianoRollContainer = document.createElement('div');
        this.pianoRollContainer.className = 'piano-roll-container';
        this.pianoRollContainer.style.cssText = `
            flex: 1;
            overflow: auto;
            position: relative;
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
            labelWidth: this.config.labelWidth
        });
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
        }        if (exportConfigBtn) {
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
    }

    updatePianoRollDimensions() {
        if (!this.pianoRoll) return;
        
        // Ricrea il piano roll con le nuove dimensioni
        this.pianoRollContainer.innerHTML = '';
        this.pianoRoll = new PianoRollCanvas(this.pianoRollContainer, {
            gridRows: this.config.gridRows,
            gridCols: this.config.gridCols,
            tempo: this.config.tempo,
            cellHeight: this.config.cellHeight,
            labelWidth: this.config.labelWidth
        });
        
        // Riconnetti agli eventi se necessario
        this.dispatchEvent('dimensionsChanged', {
            gridRows: this.config.gridRows,
            gridCols: this.config.gridCols,
            cellHeight: this.config.cellHeight,
            cellWidth: this.config.cellWidth
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
}

export default PianoRollWrapper;
