/**
 * @fileoverview Main Application Entry Point and Event Coordinator
 * 
 * This module serves as the central orchestrator for the BaseFlowArena application.
 * It handles application initialization, coordinates between all modules, manages
 * event listeners, and controls the overall application flow. The module imports
 * and coordinates all other modules to create a cohesive freestyle rap experience.
 * 
 * Key responsibilities:
 * - Application initialization and startup sequence
 * - Event listener management for all UI interactions
 * - Coordination between word management, BPM detection, and voice recognition
 * - Tooltip and word data prefetching system
 * - Activation mode switching (manual, voice, timed)
 * - Beat player and BPM system integration
 * - Modal and settings management
 * 
 * Dependencies: All other modules in the js/ directory
 */

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
import * as beatManager from './beatManager.js'; // Import the beat player module

// Cached word data for tooltip display and performance optimization
let lastWordData = { synonyms: '', definition: '', word: '' };
let tooltipCurrentWord = ''; // Tracks which word the tooltip is currently showing

// Helper function to get the currently displayed word (moved to module scope)
function getCurrentlyDisplayedWord() {
    return ui.elements.wordDisplay?.textContent || state.currentWord;
}

// Prefetch synonyms/definition for the current word to improve tooltip responsiveness
async function prefetchWordData(word) {
    if (!word || word === 'NO WORDS!') {
        lastWordData = { synonyms: '', definition: '', word: word };
        return;
    }
    try {
        const data = await wordApi.fetchWordData(word);
        lastWordData = { ...data, word };
    } catch (e) {
        console.error(`Error fetching word data for "${word}":`, e);
        lastWordData = { synonyms: '', definition: '', word };
    }
}

// Helper function to check if any tooltip is being hovered (moved to higher scope)
function isAnyTooltipHovered() {
    // Only check if the button itself is being hovered
    // Don't check the tooltip boxes since they can be visible when pinned even when not hovered
    return ui.elements.meansLikeButton?.matches(':hover') || false;
}

// --- Initialization ---
async function initializeApp() {
    console.log("--- Freestyle Flow Arena Initializing ---");
    
    // Ensure tooltip starts in unpinned state
    state.tooltip.isPinned = false;
    state.tooltip.displayMode = 'both';
    state.tooltip.lastClickTimestamp = 0;

    // Set up the callback for displayed word changes EARLY
    ui.setDisplayedWordChangeCallback(onDisplayedWordChange);
    
    // Set up the callback for word changes (for tooltip data prefetching)
    wordManager.setWordChangeCallback(onWordChange);

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
    beatManager.initializeBeatPlayer(); // Initialize beat player

    // 4. Display Initial Word & Sync Final UI
    ui.updateActivationUI(); // Sync activation/mode controls
    wordManager.changeWord('next', true, false); // Display first word & update rhymes
    window.requestAnimationFrame(() => ui.displayWord(state.currentWord));

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
    if (state.isDetectingBpm) {
        // If already detecting, stop the detection
        console.log("Stopping BPM detection...");
        state.isDetectingBpm = false;
        ui.updateDetectBpmButtonState(false);
        await autoBpm.stopDetection();
        ui.showFeedback("BPM detection stopped", false, 2000);
        return;
    }

    state.isDetectingBpm = true;
    ui.updateDetectBpmButtonState(true);

    try {
        const result = await autoBpm.startDetection(8);
        console.log("BPM Detection completed:", result);

        if (result && result.bpm > 0) {
            const confidenceText = result.confidence ? ` (${(result.confidence * 100).toFixed(0)}% confidence)` : '';
            const peaksText = result.peaksDetected ? ` - ${result.peaksDetected} beats detected` : '';
            
            // Show correction info if the tempo was adjusted
            let correctionText = '';
            if (result.originalBpm && result.originalBpm !== result.bpm) {
                correctionText = ` (corrected from ${result.originalBpm})`;
            }
            
            ui.showFeedback(`🎵 BPM: ${result.bpm}${correctionText}${confidenceText}${peaksText}`, false, 5000);
            bpm.setBpm(result.bpm);
        }
    } catch (error) {
        console.error("BPM Detection failed:", error);
        // Error messages are already shown by autoBpm module
    } finally {
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
    let infoTimeout; // Timer for hiding tooltips when not hovered
    function hideAllIfNotHovered() {
        // Don't hide tooltip if it's pinned
        if (state.tooltip.isPinned) return;
        
        if (!isAnyTooltipHovered()) {
            ui.hideSynonyms();
            ui.hideDefinition();
            tooltipCurrentWord = '';
        }
    }
    
    ui.elements.meansLikeButton?.addEventListener('mouseenter', async () => {
        // Only show tooltip on hover if not pinned
        if (state.tooltip.isPinned) return;
        
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
        // Only hide tooltip on mouseleave if not pinned
        if (!state.tooltip.isPinned) {
            infoTimeout = setTimeout(hideAllIfNotHovered, 100);
        }
    });
    
    // Add mousedown event listener for tooltip button (to capture both left and right clicks)
    ui.elements.meansLikeButton?.addEventListener('mousedown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        // Right-click always unpins the tooltip
        if (event.button === 2) {
            if (state.tooltip.isPinned) {
                state.tooltip.isPinned = false;
                console.log('Right-click: unpinning tooltip');
                ui.updateTooltipView();
            }
            return;
        }
        
        // Left-click behavior (existing logic)
        const now = Date.now();
        const timeSinceLastClick = now - state.tooltip.lastClickTimestamp;
        
        // Use CSS :hover selector directly for reliable hover detection
        const isCurrentlyHovered = ui.elements.meansLikeButton?.matches(':hover');
        
        console.log(`Click detected - hover state: ${isCurrentlyHovered}, pinned: ${state.tooltip.isPinned}, mode: ${state.tooltip.displayMode}`);
        
        if (state.tooltip.isPinned) {
            // Tooltip is pinned - behavior depends on hover state
            if (isCurrentlyHovered) {
                // Mouse is hovering - cycle through modes regardless of time
                const modes = ['both', 'synonyms', 'definition'];
                const currentIndex = modes.indexOf(state.tooltip.displayMode);
                const nextIndex = (currentIndex + 1) % modes.length;
                state.tooltip.displayMode = modes[nextIndex];
                console.log(`Hovering click: cycling to ${state.tooltip.displayMode} mode`);
            } else {
                // Mouse not hovering - unpin if enough time has passed
                if (timeSinceLastClick >= 2000) {
                    state.tooltip.isPinned = false;
                    console.log('Non-hovering click: unpinning tooltip');
                } else {
                    // Still in rapid click window - cycle through modes
                    const modes = ['both', 'synonyms', 'definition'];
                    const currentIndex = modes.indexOf(state.tooltip.displayMode);
                    const nextIndex = (currentIndex + 1) % modes.length;
                    state.tooltip.displayMode = modes[nextIndex];
                    console.log(`Rapid click: cycling to ${state.tooltip.displayMode} mode`);
                }
            }
        } else {
            // Tooltip is unpinned - always pin it
            state.tooltip.isPinned = true;
            state.tooltip.displayMode = 'both';
            console.log('Fresh click: pinning tooltip in both mode');
        }
        
        state.tooltip.lastClickTimestamp = now;
        
        // Always ensure we have current data when pinning
        if (state.tooltip.isPinned) {
            const displayedWord = getCurrentlyDisplayedWord();
            
            if (displayedWord && displayedWord !== lastWordData.word) {
                // If we don't have data for the current word, fetch it first
                prefetchWordData(displayedWord).then(() => {
                    ui.updateTooltipView(lastWordData.synonyms, lastWordData.definition);
                });
            } else {
                ui.updateTooltipView(lastWordData.synonyms, lastWordData.definition);
            }
        } else {
            ui.updateTooltipView();
        }
        
        // Force update tooltip text immediately after click
        setTimeout(() => {
            if (state.tooltip.isPinned) {
                ui.updateTooltipView(lastWordData.synonyms, lastWordData.definition);
            }
        }, 10);
    });
    
    // Prevent context menu on tooltip button
    ui.elements.meansLikeButton?.addEventListener('contextmenu', (event) => {
        event.preventDefault();
    });
    
    ui.elements.synonymsCell?.addEventListener('mouseenter', () => {
        // Don't interfere with timeout if tooltip is pinned
        if (state.tooltip.isPinned) return;
        if (infoTimeout) clearTimeout(infoTimeout);
    });
    ui.elements.synonymsCell?.addEventListener('mouseleave', () => {
        // Don't set timeout if tooltip is pinned
        if (state.tooltip.isPinned) return;
        infoTimeout = setTimeout(hideAllIfNotHovered, 100);
    });
    ui.elements.definitionCell?.addEventListener('mouseenter', () => {
        // Don't interfere with timeout if tooltip is pinned
        if (state.tooltip.isPinned) return;
        if (infoTimeout) clearTimeout(infoTimeout);
    });
    ui.elements.definitionCell?.addEventListener('mouseleave', () => {
        // Don't set timeout if tooltip is pinned
        if (state.tooltip.isPinned) return;
        infoTimeout = setTimeout(hideAllIfNotHovered, 100);
    });

    // Rhyme Navigation Listeners
    ui.elements.upWordButton?.addEventListener('click', () => wordManager.selectRhyme('up'));
    ui.elements.downWordButton?.addEventListener('click', () => wordManager.selectRhyme('down'));

    // Word Order Setting
    ui.elements.wordOrderSelect?.addEventListener('change', (e) => wordManager.setWordOrder(e.target.value));

    // Syllable Filter Settings - Controls word filtering by syllable count
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

    // Timed Mode Speed Controls - Manages automatic word cycling speed
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

    // --- BEAT PLAYER CONTROLS ---
    ui.elements.beatPlayPauseButton?.addEventListener('click', beatManager.playPause);
    ui.elements.beatStopButton?.addEventListener('click', beatManager.stop);
    ui.elements.beatNextButton?.addEventListener('click', beatManager.nextBeat);
    ui.elements.beatPreviousButton?.addEventListener('click', beatManager.previousBeat);
    ui.elements.beatVolumeSlider?.addEventListener('input', (e) => {
        const volume = parseInt(e.target.value, 10) / 100; // Convert percentage to 0-1
        beatManager.setVolume(volume);
    });
    // --- END BEAT PLAYER CONTROLS ---

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

    // Save BPM button - Allows saving detected BPM to current beat track
    const saveBpmBtn = document.getElementById('save-bpm-button');
    const bpmDisplay = document.getElementById('bpm-display');
    function updateSaveBpmButtonState() {
        const bpmValue = bpmDisplay ? parseInt(bpmDisplay.textContent) : null;
        if (saveBpmBtn) {
            saveBpmBtn.disabled = !bpmValue || isNaN(bpmValue);
        }
    }
    if (saveBpmBtn) {
        saveBpmBtn.onclick = () => {
            const bpmValue = bpmDisplay ? parseInt(bpmDisplay.textContent) : null;
            if (bpmValue && !isNaN(bpmValue)) {
                beatManager.saveBpmForCurrentTrack(bpmValue);
                ui.showFeedback('BPM saved for this track!', false, 1500);
            } else {
                ui.showFeedback('No BPM to save!', true, 1500);
            }
            updateSaveBpmButtonState();
        };
    }
    // Update save button state whenever BPM changes
    if (bpmDisplay) {
        const observer = new MutationObserver(updateSaveBpmButtonState);
        observer.observe(bpmDisplay, { childList: true, characterData: true, subtree: true });
    }
    updateSaveBpmButtonState();

    console.log('Event listeners attached.');
}

// Prefetch word data on page load for immediate tooltip display
window.addEventListener('DOMContentLoaded', () => {
    prefetchWordData(state.currentWord);
});

// Prefetch on word change - Updates tooltip data when word changes
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

// Handle displayed word changes (for tooltip updates) - Manages tooltip state during word navigation
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
    } else if (state.tooltip.isPinned && newWord !== previousWord) {
        // Tooltip is pinned - update it with new data
        console.log(`Tooltip is pinned, updating for word change: "${previousWord}" -> "${newWord}"`);
        
        // Fetch new data for the displayed word
        await prefetchWordData(newWord);
        tooltipCurrentWord = newWord;
        
        // Update the pinned tooltip view
        ui.updateTooltipView(lastWordData.synonyms, lastWordData.definition);
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
// Initialize the application when DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeApp);