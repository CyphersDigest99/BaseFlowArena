// js/main.js
// Main application entry point, initialization, and event listeners.

// Import modules
import { state } from './state.js';
import * as ui from './ui.js';
import * as storage from './storage.js';
import * as threeBackground from './threeBackground.js';
import * as wordManager from './wordManager.js';
import * as rhyme from './rhyme.js';
import * as speech from './speech.js';
import * as bpm from './bpm.js';
import * as rng from './rng.js';
import * as modal from './modal.js';
import * as autoBpm from './autoBpm.js'; // Import the Web Audio API version
import * as datamuse from './datamuse.js'; // Import the Datamuse API module

// --- Initialization ---
async function initializeApp() {
    console.log("--- Freestyle Flow Arena Initializing ---");

    // 1. Init UI Background
    threeBackground.initBackground(ui.elements.bgCanvas);

    // --- REMOVED AUBIO INIT ---
    // No explicit init needed for the Web Audio API approach here,
    // it's handled when startDetection is called.

    // 2. Load Settings, Rhyme Data, Word List
    storage.loadSettings(); // Loads ALL settings, applies defaults, updates relevant UI
    await rhyme.loadRhymeData();
    await wordManager.loadWords(); // Applies filters based on loaded blacklist

    // 3. Setup Features
    speech.setupSpeechRecognition();

    // 4. Display Initial Word & Sync Final UI
    ui.updateActivationUI(); // Sync activation/mode controls
    wordManager.changeWord('next', true, false); // Display first word & update rhymes

    // 5. Attach Event Listeners
    attachEventListeners();

    console.log("--- Initialization Complete ---");
}

// --- Activation Mode Control ---
function setActivationMode(newMode) {
    if (!ui.elements.voiceModeButton || !ui.elements.timedModeButton) return;
    if (state.activationMode === newMode) newMode = 'manual';
    const previousMode = state.activationMode;
    if (previousMode === newMode) return;
    state.activationMode = newMode;
    console.log(`Activation mode changed from ${previousMode} to ${state.activationMode}`);
    if (previousMode === 'timed' && state.timedInterval) { clearInterval(state.timedInterval); state.timedInterval = null; ui.updateWordDisplayAnimation(); }
    if (previousMode === 'voice') speech.stopRecognition(true);
    if (state.activationMode === 'timed') startTimedCycleInternal();
    else if (state.activationMode === 'voice') speech.startRecognition();
    ui.updateActivationUI();
}

// --- Timed Cycle ---
function startTimedCycleInternal() {
    if (state.timedInterval) clearInterval(state.timedInterval);
    if (!ui.elements.cycleSpeedInput) return;
    state.cycleSpeed = Math.max(3, Math.min(parseInt(ui.elements.cycleSpeedInput.value, 10) || state.cycleSpeed, 30));
    ui.elements.cycleSpeedInput.value = state.cycleSpeed;
    if (ui.elements.cycleSpeedSlider) ui.elements.cycleSpeedSlider.value = state.cycleSpeed;
    console.log(`Starting timed cycle. Interval: ${state.cycleSpeed}s.`);
    wordManager.changeWord('next', false, false);
    state.timedInterval = setInterval(() => {
        if (state.activationMode === 'timed') wordManager.changeWord('next', false, false);
        else { clearInterval(state.timedInterval); state.timedInterval = null; ui.updateWordDisplayAnimation(); }
    }, state.cycleSpeed * 1000);
    ui.showFeedback("Timed Cycle Activated", false, 1500);
}

// --- Handle Detect BPM Click ---
async function handleDetectBpmClick() {
    if (state.isDetectingBpm) return; // Prevent multiple simultaneous detections

    // --- REMOVED AUBIO CHECKS ---
    // No need to check for 'aubio' global or call initAubio here.
    // The autoBpm module now handles errors within startDetection if Web Audio API fails.

    state.isDetectingBpm = true;
    ui.updateDetectBpmButtonState(true); // Update button UI to 'detecting'

    try {
        // Start detection process using the Web Audio API version
        const result = await autoBpm.startDetection(8); // Specify duration
        console.log("Detection Promise Resolved:", result);

        if (result && result.bpm > 0) {
            // Use confidence value from the result if available/meaningful
            const confidenceText = result.confidence ? ` (Confidence: ${result.confidence.toFixed(2)})` : '';
            ui.showFeedback(`Detected BPM: ${result.bpm}${confidenceText}`, false, 4000);
            bpm.setBpm(result.bpm); // Update the main BPM system in bpm.js
        } else {
            // Feedback for failure usually shown inside autoBpm module now
            console.log("No reliable BPM detected or detection failed.");
        }
    } catch (error) {
        console.error("BPM Detection failed:", error);
        // Display a user-friendly error message
        ui.showFeedback(`BPM Detection Error: ${error.message || 'Mic/Audio Error'}`, true);
    } finally {
        // ALWAYS ensure the detecting state and button UI are reset
        state.isDetectingBpm = false;
        ui.updateDetectBpmButtonState(false);
    }
}


// --- Attach Event Listeners ---
function attachEventListeners() {
    // Word Navigation & Actions
    ui.elements.prevWordButton?.addEventListener('click', wordManager.previousWord);
    ui.elements.nextWordButton?.addEventListener('click', wordManager.nextWord);
    ui.elements.blacklistButton?.addEventListener('click', wordManager.toggleBlacklist);
    ui.elements.favoriteButton?.addEventListener('click', wordManager.toggleFavorite);
    ui.elements.findRhymesButton?.addEventListener('click', rhyme.showRhymeFinder);

    // Means Like Button Hover Events
    let subtextTimeout;
    ui.elements.meansLikeButton?.addEventListener('mouseenter', async () => {
        if (subtextTimeout) {
            clearTimeout(subtextTimeout);
        }
        ui.showSubtext('Loading related words...');
        try {
            const relatedWords = await datamuse.fetchMeansLike(state.currentWord);
            ui.showSubtext(relatedWords);
        } catch (error) {
            console.error('Error fetching related words:', error);
            ui.showSubtext('Unable to fetch related words.');
        }
    });

    ui.elements.meansLikeButton?.addEventListener('mouseleave', () => {
        subtextTimeout = setTimeout(() => {
            ui.hideSubtext();
        }, 100);
    });

    // Keep subtext visible if mouse is over it
    ui.elements.wordSubtext?.addEventListener('mouseenter', () => {
        if (subtextTimeout) {
            clearTimeout(subtextTimeout);
        }
    });
    ui.elements.wordSubtext?.addEventListener('mouseleave', () => {
        ui.hideSubtext();
    });

    // Rhyme Navigation Listeners
    ui.elements.upWordButton?.addEventListener('click', () => wordManager.selectRhyme('up'));
    ui.elements.downWordButton?.addEventListener('click', () => wordManager.selectRhyme('down'));

    // Word Order Setting
    ui.elements.wordOrderSelect?.addEventListener('change', (e) => wordManager.setWordOrder(e.target.value));

    // Syllable Filter Settings
    const handleSyllableFilterChange = () => {
        const minSyllables = parseInt(ui.elements.minSyllablesInput.value, 10) || 0;
        const maxSyllables = parseInt(ui.elements.maxSyllablesInput.value, 10) || 0;
        
        // Validate that min doesn't exceed max
        if (minSyllables > 0 && maxSyllables > 0 && minSyllables > maxSyllables) {
            ui.showFeedback("Min syllables cannot exceed max syllables!", true, 2000);
            return;
        }
        
        if (state.minSyllables !== minSyllables || state.maxSyllables !== maxSyllables) {
            state.minSyllables = minSyllables;
            state.maxSyllables = maxSyllables;
            console.log(`Syllable filter updated: min=${minSyllables}, max=${maxSyllables}`);
            
            // Reapply filters and get new word if current word doesn't match
            wordManager.applyFiltersAndSort();
            
            // If current word is no longer valid, get a new one
            if (state.currentWord === "NO WORDS!" || !state.filteredWordList.includes(state.currentWord)) {
                if (state.filteredWordList.length > 0) {
                    wordManager.changeWord('next', false, false);
                } else {
                    ui.showFeedback("No words match the current syllable filter!", true, 3000);
                }
            }
            
            storage.saveSettings();
        }
    };
    
    ui.elements.minSyllablesInput?.addEventListener('change', handleSyllableFilterChange);
    ui.elements.maxSyllablesInput?.addEventListener('change', handleSyllableFilterChange);
    
    // Reset Syllables Button
    ui.elements.resetSyllablesButton?.addEventListener('click', () => {
        if (ui.elements.minSyllablesInput && ui.elements.maxSyllablesInput) {
            ui.elements.minSyllablesInput.value = '0';
            ui.elements.maxSyllablesInput.value = '0';
            handleSyllableFilterChange();
            ui.showFeedback("Syllable filters reset to no limits", false, 1500);
        }
    });

    // Activation Mode Buttons
    ui.elements.voiceModeButton?.addEventListener('click', () => setActivationMode('voice'));
    ui.elements.timedModeButton?.addEventListener('click', () => setActivationMode('timed'));

    // Timed Mode Speed Controls
    const handleCycleSpeedChange = () => {
        const speed = Math.max(3, Math.min(parseInt(ui.elements.cycleSpeedInput.value, 10) || 10, 30));
        if (state.cycleSpeed !== speed) {
            state.cycleSpeed = speed;
            if (document.activeElement !== ui.elements.cycleSpeedInput && ui.elements.cycleSpeedInput) ui.elements.cycleSpeedInput.value = speed;
            if (document.activeElement !== ui.elements.cycleSpeedSlider && ui.elements.cycleSpeedSlider) ui.elements.cycleSpeedSlider.value = speed;
            if (state.activationMode === 'timed') startTimedCycleInternal();
            storage.saveSettings();
        }
    };
    ui.elements.cycleSpeedSlider?.addEventListener('input', () => { if (ui.elements.cycleSpeedInput) ui.elements.cycleSpeedInput.value = ui.elements.cycleSpeedSlider.value; });
    ui.elements.cycleSpeedSlider?.addEventListener('change', handleCycleSpeedChange);
    ui.elements.cycleSpeedInput?.addEventListener('change', handleCycleSpeedChange);

    // --- BPM CONTROLS ---
    ui.elements.bpmButton?.addEventListener('click', bpm.handleTap);
    ui.elements.bpmAdjustPlus?.addEventListener('click', () => bpm.adjustBpm(1));
    ui.elements.bpmAdjustMinus?.addEventListener('click', () => bpm.adjustBpm(-1));
    ui.elements.stopBpmButton?.addEventListener('click', bpm.stopBpm);
    // Detect BPM Button - Listener points to the corrected handleDetectBpmClick
    ui.elements.detectBpmButton?.addEventListener('click', handleDetectBpmClick);
    // Grid Controls
    ui.elements.addRowButton?.addEventListener('click', () => bpm.updateRowCount(1));
    ui.elements.removeRowButton?.addEventListener('click', () => bpm.updateRowCount(-1));
    ui.elements.addColButton?.addEventListener('click', () => bpm.updateColumnCount(1));
    ui.elements.removeColButton?.addEventListener('click', () => bpm.updateColumnCount(-1));
    // Multiplier Buttons
    ui.elements.multiplierButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const multiplier = event.target.dataset.multiplier;
            if (multiplier) bpm.setMultiplier(multiplier);
        });
    });
    // --- END BPM CONTROLS ---

    // RNG Controls
    ui.elements.generateNumbersButton?.addEventListener('click', rng.generate);

    // Modal Triggers & Actions
    ui.elements.favoritesButton?.addEventListener('click', modal.showFavoritesModal);
    ui.elements.closeFavoritesModal?.addEventListener('click', () => modal.closeModal(ui.elements.favoritesModal));
    ui.elements.clearFavoritesButton?.addEventListener('click', modal.clearAllFavorites);
    ui.elements.editWordListButton?.addEventListener('click', modal.showWordListEditor);
    ui.elements.closeWordListEditor?.addEventListener('click', () => modal.closeModal(ui.elements.wordListEditorModal));
    ui.elements.saveWordListButton?.addEventListener('click', modal.saveWordListChanges);
    ui.elements.closeRhymeModalButton?.addEventListener('click', () => modal.closeModal(ui.elements.rhymeFinderModal));

    // Manual Rhyme Add Listeners
    ui.elements.addManualRhymeButton?.addEventListener('click', rhyme.addManualRhyme);
    ui.elements.manualRhymeInput?.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') { event.preventDefault(); rhyme.addManualRhyme(); }
    });

    // Global Listeners
    window.addEventListener('click', (event) => {
       if (event.target === ui.elements.favoritesModal) modal.closeModal(ui.elements.favoritesModal);
       if (event.target === ui.elements.wordListEditorModal) modal.closeModal(ui.elements.wordListEditorModal);
       if (event.target === ui.elements.rhymeFinderModal) modal.closeModal(ui.elements.rhymeFinderModal);
    });
    window.addEventListener('beforeunload', storage.saveSettings);

    console.log('Event listeners attached.');
}

// --- Start Application ---
document.addEventListener('DOMContentLoaded', initializeApp);