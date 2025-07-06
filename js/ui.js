/**
 * @fileoverview User Interface Management and DOM Element Controller
 * 
 * This module handles all user interface interactions and DOM element management
 * for the BaseFlowArena application. It provides a centralized interface for
 * updating UI elements, managing visual feedback, handling animations, and
 * coordinating between the application state and the user interface.
 * 
 * Key responsibilities:
 * - DOM element selection and caching
 * - Word display management with dynamic font sizing
 * - Visual feedback and notification system
 * - BPM and beat grid visualization
 * - Tooltip and definition display management
 * - Transcript and voice recognition UI
 * - Animation and visual effects coordination
 * - Modal and settings interface management
 * - Gamification display updates (score, streaks)
 * - RNG results visualization
 * 
 * Dependencies: state.js
 */

// js/ui.js
// Handles DOM element selection and UI updates.

import { state } from './state.js';

// Callback for when displayed word changes (for tooltip updates)
let onDisplayedWordChangeCallback = null;

export function setDisplayedWordChangeCallback(callback) {
    onDisplayedWordChangeCallback = callback;
}

// --- Get DOM Elements ---
// Centralized DOM element references for easy access and maintenance
export const elements = {
    // Header & Feedback - Score, streak, and user feedback elements
    scoreDisplay: document.getElementById('score'),
    streakDisplay: document.getElementById('streak-counter'),
    feedbackMessage: document.getElementById('feedback-message'),
    bgCanvas: document.getElementById('bg-canvas'),

    // Word Display Area - Main word display and associated controls
    wordDisplay: document.getElementById('word-display'),
    wordDisplayUnit: document.getElementById('word-display-unit'),
    wordCell: document.getElementById('word-cell'),
    blacklistButton: document.getElementById('blacklist-word'),
    favoriteButton: document.getElementById('favorite-word'),
    meansLikeButton: document.getElementById('means-like-button'),
    wordSubtext: document.getElementById('word-subtext'),
    wordDefinitionTooltip: document.getElementById('word-definition-tooltip'),
    tooltipSynonyms: document.getElementById('tooltip-synonyms'),
    tooltipDefinition: document.getElementById('tooltip-definition'),
    findRhymesButton: document.getElementById('find-rhymes-button'), // Button below word box

    // Word Display Area Arrows - Navigation controls for words and rhymes
    upWordButton: document.getElementById('up-word'), // NEW
    downWordButton: document.getElementById('down-word'), // NEW
    prevWordButton: document.getElementById('prev-word'),
    nextWordButton: document.getElementById('next-word'),

    // Left Panel Controls (Word Settings) - Word filtering and management
    wordOrderSelect: document.getElementById('word-order'),
    minSyllablesInput: document.getElementById('min-syllables'),
    maxSyllablesInput: document.getElementById('max-syllables'),
    resetSyllablesButton: document.getElementById('reset-syllables-button'),
    favoritesButton: document.getElementById('favorites-button'),
    editWordListButton: document.getElementById('edit-word-list-button'),

    // Left Panel Controls (RNG) - Random number generation interface
    rngDigitsInput: document.getElementById('rng-digits'),
    rngSetsInput: document.getElementById('rng-sets'),
    rngSurpriseCheckbox: document.getElementById('rng-surprise-me'),
    generateNumbersButton: document.getElementById('generate-numbers-button'),
    rngDisplayArea: document.getElementById('rng-display-area'),

    // Center Stage Controls (Activation) - Voice and timed mode controls
    voiceModeButton: document.getElementById('voice-mode-button'),
    timedModeButton: document.getElementById('timed-mode-button'),
    timedCycleOptionsDiv: document.getElementById('timed-cycle-options'),
    cycleSpeedInput: document.getElementById('cycle-speed'),
    cycleSpeedSlider: document.getElementById('cycle-speed-slider'),
    transcriptContainer: document.getElementById('new-transcript'),

    // Right Panel Controls (BPM) - Beat per minute detection and management
    bpmButton: document.getElementById('bpm-button'),
	detectBpmButton: document.getElementById('detect-bpm-button'), // NEW
    bpmDisplay: document.getElementById('bpm-display'),
    bpmAdjustPlus: document.getElementById('bpm-adjust-plus'),
    bpmAdjustMinus: document.getElementById('bpm-adjust-minus'),
    stopBpmButton: document.getElementById('stop-bpm-button'),
    fourCountContainer: document.getElementById('four-count-container'),
    addRowButton: document.getElementById('add-row-button'),
    removeRowButton: document.getElementById('remove-row-button'),
    addColButton: document.getElementById('add-col-button'),
    removeColButton: document.getElementById('remove-col-button'),
    rowCountDisplay: document.getElementById('row-count-display'),
    colCountDisplay: document.getElementById('col-count-display'),
    // BPM Multiplier Buttons (Need selector)
    multiplierButtons: document.querySelectorAll('.multiplier-btn'), // Use querySelectorAll

    // Beat Player Controls - Audio beat playback interface
    beatPlayPauseButton: document.getElementById('beat-play-pause'),
    beatStopButton: document.getElementById('beat-stop'),
    beatNextButton: document.getElementById('beat-next'),
    beatPreviousButton: document.getElementById('beat-previous'),
    beatVolumeSlider: document.getElementById('beat-volume'),

    // Right Panel Controls (Frequencies) - Word frequency display
    frequentWordsContainer: document.getElementById('frequent-words'),

    // Modals - Popup dialogs for various features
    favoritesModal: document.getElementById('favorites-modal'),
    closeFavoritesModal: document.getElementById('close-favorites-modal'),
    favoritesListUl: document.getElementById('favorites-list'),
    clearFavoritesButton: document.getElementById('clear-favorites-button'),

    wordListEditorModal: document.getElementById('word-list-editor-modal'),
    closeWordListEditor: document.getElementById('close-word-list-editor'),
    wordListTextarea: document.getElementById('word-list-textarea'),
    saveWordListButton: document.getElementById('save-word-list-button'),
    addWordButton: document.getElementById('add-word-button'),
    resetWordListButton: document.getElementById('reset-word-list-button'),
    exportWordListButton: document.getElementById('export-word-list-button'),
    importWordListButton: document.getElementById('import-word-list-button'),

    rhymeFinderModal: document.getElementById('rhyme-finder-modal'),
    closeRhymeModalButton: document.getElementById('close-rhyme-modal'),
    rhymeModalBaseWord: document.getElementById('rhyme-modal-base-word'), // Updated ID
    rhymeModalPatternContainer: document.getElementById('rhyme-modal-pattern-container'), // Updated ID
    rhymeResultsList: document.getElementById('rhyme-results-list'),
    rhymeNoResults: document.getElementById('rhyme-no-results'),
    manualRhymeInput: document.getElementById('manual-rhyme-input'),
    addManualRhymeButton: document.getElementById('add-manual-rhyme-button'),
    synonymsCell: document.getElementById('synonyms-cell'),
    synonymsContent: document.getElementById('synonyms-content'),
    definitionCell: document.getElementById('definition-cell'),
    definitionContent: document.getElementById('definition-content'),

    settingsModal: document.getElementById('settings-modal'),
    closeSettingsModal: document.getElementById('close-settings-modal'),
    settingsButton: document.getElementById('settings-button'),
    exportAllSettingsButton: document.getElementById('export-all-settings-button'),
    importAllSettingsButton: document.getElementById('import-all-settings-button'),
    clearBlacklistButton: document.getElementById('clear-blacklist-button'),
    clearWordFrequenciesButton: document.getElementById('clear-word-frequencies-button'),
    resetAllSettingsButton: document.getElementById('reset-all-settings-button'),
};

// --- UI Update Functions ---

// Add function to update detect button state
// Manages BPM detection button appearance and functionality
export function updateDetectBpmButtonState(isDetecting) {
    if (!elements.detectBpmButton) return;
    
    elements.detectBpmButton.disabled = false; // Never disable, allow stopping
    elements.detectBpmButton.classList.toggle('detecting', isDetecting);
    
    if (isDetecting) {
        elements.detectBpmButton.innerHTML = '<i class="fas fa-stop"></i> STOP DETECTING';
        elements.detectBpmButton.title = 'Click to stop BPM detection';
    } else {
        elements.detectBpmButton.innerHTML = '<i class="fas fa-robot"></i> DETECT';
        elements.detectBpmButton.title = 'Detect BPM from microphone input (12 seconds)';
    }
}

// Shows user feedback messages with automatic timeout
export function showFeedback(message, isError = false, duration = 2500) {
    if (!elements.feedbackMessage) return;
    elements.feedbackMessage.textContent = message;
    elements.feedbackMessage.className = isError ? 'error' : 'success';
    console.log(`Feedback: [${isError ? 'Error' : 'Success'}] ${message}`);
    if (elements.feedbackMessage.timeoutId) clearTimeout(elements.feedbackMessage.timeoutId);
    elements.feedbackMessage.timeoutId = setTimeout(() => {
        if (elements.feedbackMessage.textContent === message) {
            elements.feedbackMessage.textContent = '';
            elements.feedbackMessage.className = '';
        }
    }, duration);
}

// Updates score display with pulse animation
export function updateScoreDisplay(newScore) {
    if (!elements.scoreDisplay) return;
    elements.scoreDisplay.textContent = newScore;
    elements.scoreDisplay.classList.remove('pulse');
    void elements.scoreDisplay.offsetWidth;
    elements.scoreDisplay.classList.add('pulse');
    setTimeout(() => elements.scoreDisplay?.classList.remove('pulse'), 300);
}

// Updates streak display with growth animation
export function updateStreakDisplay(newStreak, grew) {
    if (!elements.streakDisplay) return;
    elements.streakDisplay.textContent = newStreak;
    if (grew) {
        elements.streakDisplay.classList.remove('pulse', 'pulse-grow');
        void elements.streakDisplay.offsetWidth;
        if (newStreak > 1) {
            elements.streakDisplay.classList.add('pulse-grow');
            setTimeout(() => elements.streakDisplay?.classList.remove('pulse-grow'), 400);
        } else {
            elements.streakDisplay.classList.add('pulse');
            setTimeout(() => elements.streakDisplay?.classList.remove('pulse'), 300);
        }
    }
}

// Main word display function with dynamic font sizing and state management
export function displayWord(word) { // word is the word to display (could be base or rhyme)
    console.log(`displayWord called with word: "${word}"`);
    console.log(`elements.wordDisplay exists:`, !!elements.wordDisplay);
    
    if(!elements.wordDisplay) {
        console.error('wordDisplay element not found!');
        return;
    }

    const previousWord = elements.wordDisplay.textContent;
    console.log(`displayWord called: "${previousWord}" -> "${word}"`);
    console.log(`wordDisplay element:`, elements.wordDisplay);
    console.log(`wordDisplay visibility:`, window.getComputedStyle(elements.wordDisplay).visibility);
    console.log(`wordDisplay display:`, window.getComputedStyle(elements.wordDisplay).display);
    console.log(`wordDisplay opacity:`, window.getComputedStyle(elements.wordDisplay).opacity);
    
    elements.wordDisplay.textContent = word;
    
    // Verify the text was actually set
    console.log(`After setting textContent, wordDisplay.textContent: "${elements.wordDisplay.textContent}"`);

    // --- DYNAMIC FONT SIZE LOGIC RESTORED ---
    // Calculate appropriate font size to fit word within the middle cell
    const container = elements.wordCell;
    const maxWidth = container ? container.offsetWidth - 40 : 400; // Account for padding and action buttons
    const currentFontSize = parseFloat(window.getComputedStyle(elements.wordDisplay).fontSize);
    
    console.log(`Container width: ${container?.offsetWidth}, maxWidth: ${maxWidth}`);
    console.log(`Current font size: ${currentFontSize}`);
    
    // Reset to base size first
    elements.wordDisplay.style.fontSize = '4em';
    console.log(`Reset font size to 4em`);
    
    // Check if word overflows and reduce font size if needed
    if (elements.wordDisplay.scrollWidth > maxWidth) {
        console.log(`Word overflows, reducing font size. scrollWidth: ${elements.wordDisplay.scrollWidth}, maxWidth: ${maxWidth}`);
        let fontSize = 4;
        while (elements.wordDisplay.scrollWidth > maxWidth && fontSize > 1) {
            fontSize -= 0.1;
            elements.wordDisplay.style.fontSize = `${fontSize}em`;
            console.log(`Reduced font size to ${fontSize}em, scrollWidth: ${elements.wordDisplay.scrollWidth}`);
        }
    } else {
        console.log(`Word fits within maxWidth, keeping 4em font size`);
    }
    
    console.log(`Final font size: ${window.getComputedStyle(elements.wordDisplay).fontSize}`);
    console.log(`Final scrollWidth: ${elements.wordDisplay.scrollWidth}`);
    console.log(`Final container width: ${container?.offsetWidth}`);
    
    // Final visibility check
    const finalStyle = window.getComputedStyle(elements.wordDisplay);
    console.log(`Final visibility check:`);
    console.log(`- visibility: ${finalStyle.visibility}`);
    console.log(`- display: ${finalStyle.display}`);
    console.log(`- opacity: ${finalStyle.opacity}`);
    console.log(`- height: ${finalStyle.height}`);
    console.log(`- width: ${finalStyle.width}`);
    console.log(`- position: ${finalStyle.position}`);
    console.log(`- top: ${finalStyle.top}`);
    console.log(`- left: ${finalStyle.left}`);
    console.log(`- transform: ${finalStyle.transform}`);
    
    // Check if the element is actually visible in the viewport
    const rect = elements.wordDisplay.getBoundingClientRect();
    console.log(`Bounding rect:`, rect);
    console.log(`Element is in viewport: ${rect.width > 0 && rect.height > 0}`);

    // Update action buttons based on the *displayed* word
    elements.blacklistButton?.classList.toggle('active', state.blacklist.has(word));
    elements.favoriteButton?.classList.toggle('active', state.favorites.has(word));

    updateWordDisplayAnimation();
    updateRhymeNavButtons(); // Update up/down button states
    
    // Update tooltip view if pinned
    if (state.tooltip.isPinned) {
        // Note: updateTooltipView will be called from main.js with the correct data
        // when the word changes and tooltip data is fetched
    }
    
    // Notify callback if word actually changed and callback exists
    if (previousWord !== word && onDisplayedWordChangeCallback) {
        console.log(`Calling onDisplayedWordChangeCallback: "${previousWord}" -> "${word}"`);
        onDisplayedWordChangeCallback(word, previousWord);
    } else if (previousWord !== word) {
        console.log(`Word changed but no callback set: "${previousWord}" -> "${word}"`);
    }
}

// Manages word display animation for timed mode cycling
export function updateWordDisplayAnimation() {
    if (!elements.wordDisplay || !elements.cycleSpeedInput) return;
    elements.wordDisplay.classList.remove('shrink-word');
    void elements.wordDisplay.offsetWidth;
    if (state.activationMode === 'timed') {
        const cycleDuration = state.cycleSpeed;
        elements.wordDisplay.style.setProperty('--cycle-duration', `${cycleDuration}s`);
        elements.wordDisplay.classList.add('shrink-word');
    } else {
        elements.wordDisplay.style.removeProperty('--cycle-duration');
    }
}

// Updates activation mode UI elements and controls visibility
export function updateActivationUI() {
    if (!elements.voiceModeButton || !elements.timedModeButton || !elements.timedCycleOptionsDiv) return;
    elements.voiceModeButton.classList.toggle('active', state.activationMode === 'voice' && state.isMicActive);
    elements.timedModeButton.classList.toggle('active', state.activationMode === 'timed');
    elements.timedCycleOptionsDiv.style.display = (state.activationMode === 'timed') ? 'flex' : 'none';
    if (elements.cycleSpeedInput) elements.cycleSpeedInput.value = state.cycleSpeed;
    if (elements.cycleSpeedSlider) elements.cycleSpeedSlider.value = state.cycleSpeed;
    if (elements.wordOrderSelect) elements.wordOrderSelect.value = state.wordOrderMode;
    
    // Update syllable filter inputs and dropdowns
    updateSyllableFilterUI();
}

// Updates syllable filter input values to match current state
export function updateSyllableFilterUI() {
    if (elements.minSyllablesInput) {
        const minValue = state.minSyllables;
        const selectValue = minValue >= 6 ? '6' : minValue.toString();
        elements.minSyllablesInput.value = selectValue;
    }
    
    if (elements.maxSyllablesInput) {
        const maxValue = state.maxSyllables;
        const selectValue = maxValue >= 6 ? '6' : maxValue.toString();
        elements.maxSyllablesInput.value = selectValue;
    }
}

// Shows tooltip with synonyms and definition data
export function showTooltip(data) {
    if (elements.wordDefinitionTooltip && elements.tooltipSynonyms && elements.tooltipDefinition) {
        elements.tooltipSynonyms.textContent = data.synonyms || 'No synonyms found.';
        elements.tooltipDefinition.textContent = data.definition || 'No definition found.';
        elements.wordDefinitionTooltip.style.display = 'block';
    }
}

// Hides the tooltip display
export function hideTooltip() {
    if (elements.wordDefinitionTooltip) {
        elements.wordDefinitionTooltip.style.display = 'none';
    }
}

// Updates BPM display and sets CSS variables for beat timing
export function updateBpmIndicator(bpmValue) {
    if(elements.bpmDisplay) elements.bpmDisplay.textContent = bpmValue;
    const beatIntervalSeconds = bpmValue > 0 ? 60 / bpmValue : 0.5;
    document.documentElement.style.setProperty('--beat-interval', `${beatIntervalSeconds}s`);
    if (elements.wordDisplayUnit?.classList.contains('buzz-with-bpm')) {
        elements.wordDisplayUnit.style.animationDuration = `${beatIntervalSeconds}s`;
    }
}

// Updates beat grid visual indicators for current beat position
export function updateBeatGridVisuals(currentBeatIndex, totalBoxes) {
    if(!elements.fourCountContainer) return;
    const boxes = elements.fourCountContainer.querySelectorAll('.beat-box');
    if (boxes.length !== totalBoxes) {
        // console.warn("Beatbox visual update skipped: count mismatch.");
        return;
    }
    boxes.forEach((box, index) => {
        box.classList.toggle('active', index === currentBeatIndex);
    });
}

// Rebuilds the beat grid with specified rows and columns
export function rebuildBeatGrid(rows, cols) {
    if(!elements.fourCountContainer) return;
    elements.fourCountContainer.innerHTML = '';
    elements.fourCountContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    const totalBoxes = rows * cols;
    if (totalBoxes <= 0 || totalBoxes > 64) return;
    for (let i = 0; i < totalBoxes; i++) {
        const box = document.createElement('div');
        box.classList.add('beat-box');
        elements.fourCountContainer.appendChild(box);
    }
    if(elements.rowCountDisplay) elements.rowCountDisplay.textContent = rows;
    if(elements.colCountDisplay) elements.colCountDisplay.textContent = cols;
}

// Triggers screen shake animation effect
export function triggerScreenShake() {
    document.body.classList.remove('screen-shaking');
    void document.body.offsetWidth;
    document.body.classList.add('screen-shaking');
}

// Starts word display buzz animation synchronized with BPM
export function startWordBuzz() {
    if (elements.wordDisplayUnit && state.bpm > 0) {
        const beatIntervalSeconds = 60 / state.bpm;
        elements.wordDisplayUnit.style.animationDuration = `${beatIntervalSeconds}s`;
        elements.wordDisplayUnit.classList.add('buzz-with-bpm');
    }
}

// Stops word display buzz animation
export function stopWordBuzz() {
     if (elements.wordDisplayUnit) {
         elements.wordDisplayUnit.classList.remove('buzz-with-bpm');
         elements.wordDisplayUnit.style.animationDuration = '';
     }
}

// Updates transcript display with interim or final speech recognition results
export function updateTranscript(lineText, isFinal) {
     if (!lineText || !elements.transcriptContainer) return;
     lineText = lineText.trim();
     if (!lineText) return;
     const displayLine = lineText;
     let interimElement = elements.transcriptContainer.querySelector('.interim');
     if (!isFinal) {
         if (interimElement) {
             if (interimElement.textContent !== displayLine) interimElement.textContent = displayLine;
         } else {
             interimElement = document.createElement('div');
             interimElement.classList.add('interim');
             interimElement.textContent = displayLine;
             elements.transcriptContainer.insertBefore(interimElement, elements.transcriptContainer.firstChild);
         }
     } else {
         if (interimElement) interimElement.remove();
         const finalElement = document.createElement('div');
         finalElement.classList.add('final');
         finalElement.textContent = displayLine;
         elements.transcriptContainer.insertBefore(finalElement, elements.transcriptContainer.firstChild);
         while (elements.transcriptContainer.children.length > state.MAX_TRANSCRIPT_LINES) {
             elements.transcriptContainer.removeChild(elements.transcriptContainer.lastChild);
         }
     }
     elements.transcriptContainer.scrollTop = 0;
}

// Clears all transcript content
export function clearTranscript() {
    if (elements.transcriptContainer) elements.transcriptContainer.innerHTML = '';
}

// Displays word frequency statistics with color-coded frequency levels
export function displayFrequencies(wordFreqMap) {
    if(!elements.frequentWordsContainer) return;
    const sortedFrequencies = Object.entries(wordFreqMap)
        .filter(([word, count]) => count >= 2 && !state.blacklist.has(word))
        .sort(([, countA], [, countB]) => countB - countA);
    elements.frequentWordsContainer.innerHTML = sortedFrequencies.length === 0
        ? '<p style="opacity: 0.5;">Speak more to track common words...</p>' : '';
    sortedFrequencies.slice(0, 20).forEach(([word, count]) => {
        const span = document.createElement('span');
        span.textContent = `${word} (${count})`;
        span.classList.add('freq-word');
        if (count >= 5) span.classList.add('freq-5');
        else if (count >= 4) span.classList.add('freq-4');
        else if (count >= 3) span.classList.add('freq-3');
        else span.classList.add('freq-2');
        elements.frequentWordsContainer.appendChild(span);
    });
}

// Displays RNG results with animated spinning slot machine effect
export function displayRngResults(sets) {
    if (!elements.rngDisplayArea) return;
    elements.rngDisplayArea.innerHTML = '';
    sets.forEach((setDigits, s_index) => {
        const setDiv = document.createElement('div');
        setDiv.classList.add('rng-set');
        const numDigits = setDigits.length;
        for (let i = 0; i < numDigits; i++) {
            const slotDiv = document.createElement('div');
            slotDiv.classList.add('rng-slot');
            const numberSpan = document.createElement('span');
            numberSpan.textContent = '?';
            slotDiv.appendChild(numberSpan);
            setDiv.appendChild(slotDiv);
            const currentDigit = setDigits[i];
            setTimeout(() => {
                slotDiv.classList.add('spinning');
                setTimeout(() => {
                    numberSpan.textContent = currentDigit;
                    slotDiv.classList.remove('spinning');
                }, 150);
            }, 200 + i * 70 + s_index * 120);
        }
        elements.rngDisplayArea.appendChild(setDiv);
    });
}

// Updates RNG input field values
export function updateRngInputs(digits, sets) {
    if(elements.rngDigitsInput) elements.rngDigitsInput.value = digits;
    if(elements.rngSetsInput) elements.rngSetsInput.value = sets;
}

// --- NEW: Update Rhyme Navigation Button States ---
// Updates rhyme navigation button states based on available rhymes
export function updateRhymeNavButtons() {
    // Check if there are *any* rhymes, ignoring the currentRhymeIndex
    const hasRhymes = state.currentRhymeList && state.currentRhymeList.length > 0;
    const upButton = elements.upWordButton;
    const downButton = elements.downWordButton;

    if (upButton) {
        upButton.disabled = !hasRhymes;
        upButton.style.opacity = hasRhymes ? '1' : '0.3'; // Visually dim if disabled
        upButton.style.cursor = hasRhymes ? 'pointer' : 'not-allowed';
    }
    if (downButton) {
        downButton.disabled = !hasRhymes;
        downButton.style.opacity = hasRhymes ? '1' : '0.3';
        downButton.style.cursor = hasRhymes ? 'pointer' : 'not-allowed';
    }
}

// Shows subtext below the main word display
export function showSubtext(text) {
    if (elements.wordSubtext) {
        elements.wordSubtext.textContent = text;
        elements.wordSubtext.classList.add('visible');
    }
}

// Hides the subtext display
export function hideSubtext() {
    if (elements.wordSubtext) {
        elements.wordSubtext.textContent = '';
        elements.wordSubtext.classList.remove('visible');
    }
}

// Shows synonyms in the tooltip area
export function showSynonyms(synonyms) {
    const el = elements.synonymsContent;
    if (!el) return;
    
    // Handle "no results" messages gracefully
    const trimmedSynonyms = synonyms ? synonyms.trim() : '';
    const isEmptyOrNoResults = !trimmedSynonyms || 
                               trimmedSynonyms.toLowerCase().includes('no synonyms found') ||
                               trimmedSynonyms.toLowerCase().includes('no results') ||
                               trimmedSynonyms.toLowerCase().includes('not found');
    
    if (!isEmptyOrNoResults) {
        el.textContent = trimmedSynonyms;
        el.classList.add('visible');
    } else {
        el.textContent = '';
        el.classList.remove('visible');
    }
}

// Hides the synonyms display
export function hideSynonyms() {
    const el = elements.synonymsContent;
    if (el) {
        el.textContent = '';
        el.classList.remove('visible');
    }
}

// Shows definition in the tooltip area with dynamic font sizing
export function showDefinition(definition) {
    const el = elements.definitionContent;
    if (!el) return;
    
    // Handle "no results" messages gracefully
    const trimmedDefinition = definition ? definition.trim() : '';
    const isEmptyOrNoResults = !trimmedDefinition || 
                               trimmedDefinition.toLowerCase().includes('no definition found') ||
                               trimmedDefinition.toLowerCase().includes('no results') ||
                               trimmedDefinition.toLowerCase().includes('not found');
    
    if (!isEmptyOrNoResults) {
        el.textContent = trimmedDefinition;
        el.classList.add('visible');
        // Dynamic font size: shrink if doesn't fit
        el.classList.remove('shrink');
        setTimeout(() => {
            if (el.scrollWidth > el.clientWidth) {
                el.classList.add('shrink');
            }
        }, 10);
    } else {
        el.textContent = '';
        el.classList.remove('visible');
        el.classList.remove('shrink');
    }
}

// Hides the definition display
export function hideDefinition() {
    const el = elements.definitionContent;
    if (el) {
        el.textContent = '';
        el.classList.remove('visible');
        el.classList.remove('shrink');
    }
}

// Update tooltip view based on state - Manages tooltip display modes and icons
export function updateTooltipView(synonyms = null, definition = null) {
    if (!elements.meansLikeButton || !elements.synonymsCell || !elements.definitionCell) return;
    
    if (!state.tooltip.isPinned) {
        // Not pinned - hide tooltip and show default closed book icon
        hideSynonyms();
        hideDefinition();
        elements.meansLikeButton.innerHTML = '<i class="fas fa-book"></i>';
        elements.meansLikeButton.classList.remove('pinned');
        elements.meansLikeButton.title = 'Show definition and synonyms';
        return;
    }
    
    // Pinned - show tooltip and update icon based on display mode
    elements.meansLikeButton.classList.add('pinned');
    
    // Update icon and title based on display mode - always show next action
    switch (state.tooltip.displayMode) {
        case 'both':
            elements.meansLikeButton.innerHTML = '<i class="fas fa-book-open"></i>';
            elements.meansLikeButton.title = 'Show synonyms only';
            if (synonyms !== null) showSynonyms(synonyms);
            if (definition !== null) showDefinition(definition);
            break;
        case 'synonyms':
            elements.meansLikeButton.innerHTML = '<i class="fas fa-random"></i>';
            elements.meansLikeButton.title = 'Show definition only';
            if (synonyms !== null) showSynonyms(synonyms);
            hideDefinition();
            break;
        case 'definition':
            elements.meansLikeButton.innerHTML = '<i class="fas fa-paragraph"></i>';
            elements.meansLikeButton.title = 'Show both definition and synonyms';
            hideSynonyms();
            if (definition !== null) showDefinition(definition);
            break;
        default:
            elements.meansLikeButton.innerHTML = '<i class="fas fa-book-open"></i>';
            elements.meansLikeButton.title = 'Show synonyms only';
            if (synonyms !== null) showSynonyms(synonyms);
            if (definition !== null) showDefinition(definition);
    }
}