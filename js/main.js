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
import * as wordApi from './wordApi.js'; // Import the new word API module

let lastWordData = { synonyms: '', definition: '', word: '' };
let tooltipCurrentWord = '';

// Prefetch synonyms/definition for the current word
async function prefetchWordData(word) {
    if (!word || word === 'NO WORDS!') {
        lastWordData = { synonyms: '', definition: '', word: word };
        return;
    }
    try {
        const data = await wordApi.fetchWordData(word);
        lastWordData = { ...data, word };
    } catch (e) {
        lastWordData = { synonyms: '', definition: '', word };
    }
}

// Helper function to check if any tooltip is being hovered (moved to higher scope)
function isAnyTooltipHovered() {
    return (
        ui.elements.meansLikeButton?.matches(':hover') ||
        ui.elements.synonymsBox?.matches(':hover') ||
        ui.elements.definitionBox?.matches(':hover')
    );
}

// --- Initialization ---
async function initializeApp() {
    console.log("--- Freestyle Flow Arena Initializing ---");

    // Set up the callback for displayed word changes EARLY
    ui.setDisplayedWordChangeCallback(onDisplayedWordChange);

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

    // Synonyms/Definition Hover Events
    let infoTimeout;
    function hideAllIfNotHovered() {
        if (!isAnyTooltipHovered()) {
            ui.hideSynonyms();
            ui.hideDefinition();
            tooltipCurrentWord = '';
        }
    }
    
    // Helper function to get the currently displayed word
    function getCurrentlyDisplayedWord() {
        return ui.elements.wordDisplay?.textContent || state.currentWord;
    }
    
    ui.elements.meansLikeButton?.addEventListener('mouseenter', async () => {
        if (infoTimeout) clearTimeout(infoTimeout);
        const displayedWord = getCurrentlyDisplayedWord();
        tooltipCurrentWord = displayedWord;
        // Show cached data immediately
        ui.showSynonyms(lastWordData.synonyms);
        ui.showDefinition(lastWordData.definition);
        // Fetch fresh data in background
        if (displayedWord && displayedWord !== lastWordData.word) {
            const word = displayedWord;
            await prefetchWordData(word);
            // Only update if still hovered and word matches
            if (isAnyTooltipHovered() && tooltipCurrentWord === word) {
                ui.showSynonyms(lastWordData.synonyms);
                ui.showDefinition(lastWordData.definition);
            }
        }
    });
    ui.elements.meansLikeButton?.addEventListener('mouseleave', () => {
        infoTimeout = setTimeout(hideAllIfNotHovered, 100);
    });
    ui.elements.synonymsBox?.addEventListener('mouseenter', () => {
        if (infoTimeout) clearTimeout(infoTimeout);
    });
    ui.elements.synonymsBox?.addEventListener('mouseleave', () => {
        infoTimeout = setTimeout(hideAllIfNotHovered, 100);
    });
    ui.elements.definitionBox?.addEventListener('mouseenter', () => {
        if (infoTimeout) clearTimeout(infoTimeout);
    });
    ui.elements.definitionBox?.addEventListener('mouseleave', () => {
        infoTimeout = setTimeout(hideAllIfNotHovered, 100);
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
    ui.elements.addWordButton?.addEventListener('click', modal.addNewWord);
    ui.elements.resetWordListButton?.addEventListener('click', modal.resetWordList);
    ui.elements.exportWordListButton?.addEventListener('click', modal.exportWordList);
    ui.elements.importWordListButton?.addEventListener('click', modal.importWordList);

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
       if (event.target === ui.elements.settingsModal) modal.closeModal(ui.elements.settingsModal);
    });
    window.addEventListener('beforeunload', storage.saveSettings);

    // Settings Modal
    ui.elements.settingsButton?.addEventListener('click', modal.showSettingsModal);
    ui.elements.closeSettingsModal?.addEventListener('click', () => modal.closeModal(ui.elements.settingsModal));
    ui.elements.exportAllSettingsButton?.addEventListener('click', modal.exportAllSettings);
    ui.elements.importAllSettingsButton?.addEventListener('click', modal.importAllSettings);
    ui.elements.clearBlacklistButton?.addEventListener('click', modal.clearBlacklist);
    ui.elements.clearFavoritesButton?.addEventListener('click', modal.clearAllFavorites);
    ui.elements.clearWordFrequenciesButton?.addEventListener('click', modal.clearWordFrequencies);
    ui.elements.resetAllSettingsButton?.addEventListener('click', modal.resetAllSettings);

    console.log('Event listeners attached.');
}

// Prefetch on page load
window.addEventListener('DOMContentLoaded', () => {
    prefetchWordData(state.currentWord);
});

// Prefetch on word change
async function onWordChange(newWord) {
    await prefetchWordData(newWord);
    if (isAnyTooltipHovered()) {
        // Clear boxes first to force fade-out
        ui.hideSynonyms();
        ui.hideDefinition();
        const displayedWord = getCurrentlyDisplayedWord();
        tooltipCurrentWord = displayedWord;
        // Wait a frame for fade-out, then show new data
        setTimeout(() => {
            // Only show if still hovered and word matches
            if (isAnyTooltipHovered() && tooltipCurrentWord === displayedWord) {
                ui.showSynonyms(lastWordData.synonyms);
                ui.showDefinition(lastWordData.definition);
            }
        }, 50);
    }
}

// Handle displayed word changes (for tooltip updates)
async function onDisplayedWordChange(newWord, previousWord) {
    console.log(`onDisplayedWordChange called: "${previousWord}" -> "${newWord}"`);
    
    // Only update tooltip if it's currently being shown and the word actually changed
    if (isAnyTooltipHovered() && newWord !== previousWord) {
        console.log(`Tooltip is hovered, updating for word change: "${previousWord}" -> "${newWord}"`);
        
        // Clear current tooltip data
        ui.hideSynonyms();
        ui.hideDefinition();
        
        // Fetch new data for the displayed word
        await prefetchWordData(newWord);
        tooltipCurrentWord = newWord;
        
        // Show new data after a brief delay to allow fade-out
        setTimeout(() => {
            // Only show if still hovered and word matches
            if (isAnyTooltipHovered() && tooltipCurrentWord === newWord) {
                console.log(`Showing updated tooltip for: "${newWord}"`);
                ui.showSynonyms(lastWordData.synonyms);
                ui.showDefinition(lastWordData.definition);
            }
        }, 50);
    } else {
        console.log(`Tooltip not hovered or word didn't change, skipping update`);
    }
}

// Export function to update tooltips when displayed word changes (for rhyme navigation)
export async function updateTooltipForDisplayedWord() {
    if (isAnyTooltipHovered()) {
        const displayedWord = getCurrentlyDisplayedWord();
        if (displayedWord && displayedWord !== lastWordData.word) {
            await prefetchWordData(displayedWord);
            tooltipCurrentWord = displayedWord;
            // Only update if still hovered and word matches
            if (isAnyTooltipHovered() && tooltipCurrentWord === displayedWord) {
                ui.showSynonyms(lastWordData.synonyms);
                ui.showDefinition(lastWordData.definition);
            }
        }
    }
}

// --- Start Application ---
document.addEventListener('DOMContentLoaded', initializeApp);