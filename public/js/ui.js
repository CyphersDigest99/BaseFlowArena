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

const TRAY_STOPWORDS = new Set([
    'a','an','the','i','me','my','you','your','we','our','it','its',
    'is','are','was','were','be','been','being','have','has','had',
    'do','does','did','will','would','could','should','may','might',
    'can','to','of','in','on','at','by','for','up','out','so',
    'and','but','or','not','no','if','as','with','from','that',
    'this','than','then','when','who','what','how','all','just','like'
]);

// Fuzzy per-word match for filler phrase detection.
// Short words (max length < 5) require exact match to avoid false positives on
// common filler like "um", "uh", "like". Longer words allow 1 edit so STT
// mishearings like "basicaly" still flag "basically".
function fuzzyFillerWord(spoken, filler) {
    if (spoken === filler) return true;
    const ls = spoken.length, lf = filler.length;
    if (Math.max(ls, lf) < 5) return false;         // short words: exact only
    if (Math.abs(ls - lf) > 1) return false;         // length diff > 1 → LD > 1
    const row = Array.from({ length: lf + 1 }, (_, j) => j);
    for (let i = 1; i <= ls; i++) {
        let prev = i;
        for (let j = 1; j <= lf; j++) {
            const val = spoken[i - 1] === filler[j - 1]
                ? row[j - 1]
                : 1 + Math.min(row[j - 1], row[j], prev);
            row[j - 1] = prev;
            prev = val;
        }
        row[lf] = prev;
    }
    return row[lf] <= 1;
}

// Retroactively marks spans that form a multi-word filler phrase straddling the
// boundary between the previous transcript line and the freshly-built new line.
// Called before the new element is inserted into the DOM.
function checkCrossBoundaryFillers(prevLineEl, newLineEl, sortedPhrases) {
    if (!prevLineEl || !sortedPhrases.length) return;
    const prevSpans = Array.from(prevLineEl.querySelectorAll('.transcript-word'));
    const newSpans  = Array.from(newLineEl.querySelectorAll('.transcript-word'));
    if (!prevSpans.length || !newSpans.length) return;

    const maxPhraseLen = Math.max(...sortedPhrases.map(p => p.length));
    const tailCount = Math.min(maxPhraseLen - 1, prevSpans.length);
    const headCount = Math.min(maxPhraseLen - 1, newSpans.length);
    const combined  = [
        ...prevSpans.slice(prevSpans.length - tailCount),
        ...newSpans.slice(0, headCount),
    ];
    const words = combined.map(s => s.textContent.replace(/[^a-zA-Z'-]/g, '').toLowerCase());

    for (const phraseWords of sortedPhrases) {
        const plen = phraseWords.length;
        if (plen < 2) continue; // single-word fillers are already caught per-line
        for (let i = 0; i <= words.length - plen; i++) {
            // Only positions that genuinely straddle the boundary
            if (i >= tailCount || i + plen <= tailCount) continue;
            let match = true;
            for (let k = 0; k < plen; k++) {
                if (!fuzzyFillerWord(words[i + k], phraseWords[k])) { match = false; break; }
            }
            if (match) {
                for (let k = 0; k < plen; k++) {
                    combined[i + k].className = 'transcript-word transcript-word-filler';
                }
            }
        }
    }
}

// POS suffix heuristic — purely visual coloring for pill tray
function classifyPOS(word) {
    const w = word.toLowerCase();
    if (w.endsWith('ly')) return 'adverb';
    if (w.endsWith('ing') || w.endsWith('ed') || w.endsWith('ize') || w.endsWith('ise') || w.endsWith('ify') || w.endsWith('ate')) return 'verb';
    if (w.endsWith('ful') || w.endsWith('less') || w.endsWith('ous') || w.endsWith('ive') || w.endsWith('able') || w.endsWith('ible') || w.endsWith('al') || w.endsWith('ish') || w.endsWith('ic')) return 'adjective';
    if (w.endsWith('tion') || w.endsWith('sion') || w.endsWith('ment') || w.endsWith('ness') || w.endsWith('ity') || w.endsWith('er') || w.endsWith('or') || w.endsWith('ist') || w.endsWith('ism')) return 'noun';
    return 'other';
}

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
    
    // Theme Controls
    themeDarkButton: document.getElementById('theme-dark'),
    themeClassicButton: document.getElementById('theme-classic'),
    themeLightButton: document.getElementById('theme-light'),
    randomizePaletteButton: document.getElementById('randomize-palette'),
    randomizeDropdown: document.getElementById('randomize-dropdown'),
    generatePaletteButton: document.getElementById('generate-palette'),
    copyCssButton: document.getElementById('copy-css'),

    // Word Display Area - Main word display and associated controls
    wordDisplay: document.getElementById('word-display'), // Updated to use correct ID
    wordDisplayUnit: document.getElementById('word-display-unit'),
    wordCell: document.getElementById('word-cell'),
    blacklistButton: document.getElementById('blacklist-word'),
    favoriteButton: document.getElementById('favorite-word'),
    searchButton: document.getElementById('search-word'),
    reverseSearchButton: document.getElementById('reverse-search-word'),
    meansLikeButton: document.getElementById('means-like-button'),
    wordSubtext: document.getElementById('word-subtext'),
    wordDefinitionTooltip: document.getElementById('word-definition-tooltip'),
    tooltipSynonyms: document.getElementById('tooltip-synonyms'),
    tooltipDefinition: document.getElementById('tooltip-definition'),
    findRhymesButton: document.getElementById('find-rhymes-button'), // Button inside middle cell at bottom

    // Word Display Area Arrows - Navigation controls for words and rhymes
    upWordButton: document.getElementById('up-word'), // NEW
    downWordButton: document.getElementById('down-word'), // NEW
    rhymeSortToggleButton: document.getElementById('rhyme-sort-toggle'), // NEW
    prevWordButton: document.getElementById('prev-word'),
    nextWordButton: document.getElementById('next-word'),

    // Left Panel Controls (Word Settings) - Word filtering and management
    wordListSelect: document.getElementById('word-list-select'),
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
    rhymeModalDynamicHeading: document.getElementById('rhyme-modal-dynamic-heading'), // New dynamic heading element
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

    // Filler Ticker
    fillerTickerEl: document.getElementById('filler-ticker'),
    fillerTickerPreview: document.getElementById('filler-ticker-preview'),
    fillerTickerButton: document.getElementById('filler-ticker-button'),
    fillerTickerModal: document.getElementById('filler-ticker-modal'),
    closeFillerTickerModal: document.getElementById('close-filler-ticker-modal'),
    fillerTickerInput: document.getElementById('filler-ticker-input'),
    fillerTickerAddButton: document.getElementById('filler-ticker-add-btn'),
    fillerTickerList: document.getElementById('filler-ticker-list'),
    fillerTickerSpeed: document.getElementById('filler-ticker-speed'),
    fillerTickerSpeedValue: document.getElementById('filler-ticker-speed-val'),
    fillerTickerSpacing: document.getElementById('filler-ticker-spacing'),
    fillerTickerSpacingValue: document.getElementById('filler-ticker-spacing-val'),
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

// --- WINDOW RESIZE HANDLER FOR DYNAMIC FONT SCALING ---
// Recalculates font size when window is resized to maintain proper scaling
let resizeTimeout;
window.addEventListener('resize', () => {
    // Debounce resize events to avoid excessive recalculations
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        // Only recalculate if there's a current word displayed
        const resizeWord = elements.wordDisplay?.dataset.word || elements.wordDisplay?.textContent;
        if (resizeWord && resizeWord !== 'LOADING...' && resizeWord !== 'NO WORDS!') {

            console.log('Window resized, recalculating font size for current word');
            const currentWord = resizeWord;
            displayWord(currentWord);
        }
    }, 250); // Wait 250ms after resize stops before recalculating
});

// Track last navigation direction for flip animation
let lastFlipDirection = 'top';

// Set flip direction from external callers (keyboard handlers)
export function setFlipDirection(direction) {
    lastFlipDirection = direction; // 'top' or 'bottom'
}

// Main word display function with dynamic font sizing and state management
export function displayWord(word, direction = null) { // word is the word to display (could be base or rhyme)
    console.log(`displayWord called with word: "${word}"`);
    console.log(`elements.wordDisplay exists:`, !!elements.wordDisplay);

    if(!elements.wordDisplay) {
        console.error('wordDisplay element not found!');
        return;
    }

    const previousWord = elements.wordDisplay.dataset.word || '';
    console.log(`displayWord called: "${previousWord}" -> "${word}"`);

    // Use provided direction, or fall back to last set direction
    const flipDir = direction || lastFlipDirection;

    // Store canonical word in data attribute (textContent is unreliable with overlay)
    elements.wordDisplay.dataset.word = word;

    // Split-flap display animation - all letters flip from same direction
    if (previousWord && previousWord !== word) {
        // Remove old animation classes (including voice-match dissolve exit)
        elements.wordDisplay.classList.remove('flip-from-top', 'flip-from-bottom', 'dissolve-exit');

        // Create letter spans
        elements.wordDisplay.innerHTML = word.split('').map((letter) => {
            const displayChar = letter === ' ' ? '&nbsp;' : letter;
            return `<span class="flip-letter">${displayChar}</span>`;
        }).join('');

        // Force reflow then add direction class
        void elements.wordDisplay.offsetWidth;
        elements.wordDisplay.classList.add(flipDir === 'top' ? 'flip-from-top' : 'flip-from-bottom');
    } else {
        // No animation for initial load or same word — still use flip-letter spans
        elements.wordDisplay.innerHTML = word.split('').map((letter) => {
            const displayChar = letter === ' ' ? '&nbsp;' : letter;
            return `<span class="flip-letter" style="opacity:1">${displayChar}</span>`;
        }).join('');
    }

    // Add invisible selectable overlay so the full word can be highlighted/right-clicked
    let overlay = elements.wordDisplay.querySelector('.word-select-overlay');
    if (!overlay) {
        overlay = document.createElement('span');
        overlay.className = 'word-select-overlay';
        elements.wordDisplay.appendChild(overlay);
    }
    overlay.textContent = word;

    // Verify the text was actually set
    console.log(`After setting textContent, wordDisplay.textContent: "${elements.wordDisplay.textContent}"`);

    // --- ENHANCED DYNAMIC FONT SIZE LOGIC ---
    // Calculate appropriate font size to fit word within the middle cell
    const container = elements.wordCell;
    const maxWidth = container ? container.offsetWidth - 40 : 400; // Account for padding and action buttons
    const maxHeight = container ? container.offsetHeight - 10 : 200; // More generous vertical padding allowance
    
    console.log(`Container dimensions: ${container?.offsetWidth}x${container?.offsetHeight}, maxWidth: ${maxWidth}, maxHeight: ${maxHeight}`);
    console.log(`Word length: ${word.length} characters`);
    
    // Determine base font size based on word length and screen size
    let baseFontSize = 4; // Default for short words
    
    // Adjust base font size based on word length
    if (word.length <= 3) {
        baseFontSize = 3.5; // Large but not overwhelming for short words like "run"
    } else if (word.length <= 5) {
        baseFontSize = 3.8; // Large for medium-short words
    } else if (word.length <= 8) {
        baseFontSize = 3.5; // Medium for medium words
    } else if (word.length <= 12) {
        baseFontSize = 3.0; // Smaller for longer words
    } else {
        baseFontSize = 2.5; // Smallest for very long words
    }
    
    // Adjust for screen size
    const screenWidth = window.innerWidth;
    if (screenWidth <= 480) {
        baseFontSize *= 0.8; // Smaller on mobile
    } else if (screenWidth <= 768) {
        baseFontSize *= 0.9; // Slightly smaller on tablets
    }
    
    console.log(`Calculated base font size: ${baseFontSize}em`);
    
    // Reset to calculated base size first
    elements.wordDisplay.style.fontSize = `${baseFontSize}em`;
    
    // Check if word overflows and reduce font size if needed
    let fontSize = baseFontSize;
    let iterations = 0;
    const maxIterations = 50; // Prevent infinite loops
    const minFontSize = 1.5; // Minimum font size to ensure readability
    
    while ((elements.wordDisplay.scrollWidth > maxWidth || elements.wordDisplay.scrollHeight > maxHeight) && 
           fontSize > minFontSize && iterations < maxIterations) {
        fontSize -= 0.1;
        elements.wordDisplay.style.fontSize = `${fontSize}em`;
        iterations++;
    }
    
    // Ensure we don't go below minimum font size
    if (fontSize < minFontSize) {
        fontSize = minFontSize;
        elements.wordDisplay.style.fontSize = `${fontSize}em`;
    }
    
    console.log(`Final font size: ${fontSize}em (${iterations} iterations)`);
    console.log(`Final dimensions: ${elements.wordDisplay.scrollWidth}x${elements.wordDisplay.scrollHeight}`);
    console.log(`Container dimensions: ${maxWidth}x${maxHeight}`);
    
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
    elements.voiceModeButton.classList.toggle('active', state.activationMode === 'voice');
    elements.timedModeButton.classList.toggle('active', state.activationMode === 'timed');
    elements.timedCycleOptionsDiv.style.display = (state.activationMode === 'timed') ? 'flex' : 'none';
    if (elements.cycleSpeedInput) elements.cycleSpeedInput.value = state.cycleSpeed;
    if (elements.cycleSpeedSlider) elements.cycleSpeedSlider.value = state.cycleSpeed;
    if (elements.wordOrderSelect) elements.wordOrderSelect.value = state.wordOrderMode;
    if (elements.wordListSelect) elements.wordListSelect.value = state.wordListFile;

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
    
    // Reattach click listener to the first beat box for resync
    const firstBeatBox = elements.fourCountContainer.querySelector('.beat-box:first-child');
    if (firstBeatBox) {
        firstBeatBox.addEventListener('click', () => {
            // Import bpm module dynamically to avoid circular dependency
            import('./bpm.js').then(bpmModule => {
                bpmModule.resyncAnimation();
                showFeedback('Beat grid resynced!', false, 1000);
            });
        });
    }
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

/** Removes .selected class from any transcript word and clears state */
export function clearTranscriptSelection() {
    const selected = elements.transcriptContainer?.querySelector('.transcript-word.selected');
    if (selected) selected.classList.remove('selected');
    state.transcriptSelectedWord = null;
    updateRecentWordsTray();
}

// Updates transcript display with interim or final speech recognition results
export function updateTranscript(lineText, isFinal) {
     if (!lineText || !elements.transcriptContainer) return;
     lineText = lineText.trim();
     if (!lineText) return;
     let interimElement = elements.transcriptContainer.querySelector('.interim');
     if (!isFinal) {
         if (interimElement) {
             if (interimElement.textContent !== lineText) interimElement.textContent = lineText;
         } else {
             interimElement = document.createElement('div');
             interimElement.classList.add('interim');
             interimElement.textContent = lineText;
             elements.transcriptContainer.insertBefore(interimElement, elements.transcriptContainer.firstChild);
         }
     } else {
         if (interimElement) interimElement.remove();
         const prevLineEl = elements.transcriptContainer.firstElementChild;
         const finalElement = document.createElement('div');
         finalElement.classList.add('final');

         // Split into clickable word spans, with filler-phrase detection.
         // fillerRanges marks [start, end) word-index ranges of filler phrases
         // so we can apply the penalty class — supports multi-word phrases like
         // "you know" in addition to single words like "um", "uh", "like".
         const rawWords = lineText.split(/\s+/);
         const cleanedWords = rawWords.map(r => r.replace(/[^a-zA-Z'-]/g, '').toLowerCase());
         const fillerMask = new Array(rawWords.length).fill(false);
         const phrases = Array.isArray(state.fillerPhrases) ? state.fillerPhrases : [];

         // Sort phrases by word-count descending so longer phrases claim first
         const sortedPhrases = phrases
             .map(p => p.split(/\s+/).filter(Boolean))
             .filter(parts => parts.length > 0)
             .sort((a, b) => b.length - a.length);

         for (const phraseWords of sortedPhrases) {
             const plen = phraseWords.length;
             for (let i = 0; i <= cleanedWords.length - plen; i++) {
                 // Skip if any of this range is already marked (longer phrase wins)
                 let alreadyMarked = false;
                 for (let k = 0; k < plen; k++) {
                     if (fillerMask[i + k]) { alreadyMarked = true; break; }
                 }
                 if (alreadyMarked) continue;
                 // Check if cleanedWords[i..i+plen] matches phraseWords (fuzzy)
                 let match = true;
                 for (let k = 0; k < plen; k++) {
                     if (!fuzzyFillerWord(cleanedWords[i + k], phraseWords[k])) { match = false; break; }
                 }
                 if (match) {
                     for (let k = 0; k < plen; k++) fillerMask[i + k] = true;
                 }
             }
         }

         rawWords.forEach((rawWord, i) => {
             const cleaned = rawWord.replace(/[^a-zA-Z'-]/g, '');
             if (cleaned.length < 2) return;
             if (i > 0) finalElement.appendChild(document.createTextNode(' '));
             const span = document.createElement('span');
             span.className = fillerMask[i] ? 'transcript-word transcript-word-filler' : 'transcript-word';
             span.textContent = cleaned;
             finalElement.appendChild(span);
         });

         checkCrossBoundaryFillers(prevLineEl, finalElement, sortedPhrases);
         elements.transcriptContainer.insertBefore(finalElement, elements.transcriptContainer.firstChild);
         while (elements.transcriptContainer.children.length > state.MAX_TRANSCRIPT_LINES) {
             elements.transcriptContainer.removeChild(elements.transcriptContainer.lastChild);
         }

         // Update pill tray (dynamic capacity)
         lineText.split(/\s+/).forEach(rawWord => {
             const w = rawWord.replace(/[^a-zA-Z'-]/g, '').toLowerCase();
             if (w.length <= 2 || TRAY_STOPWORDS.has(w) || state.ignoredFeedWords.has(w)) return;
             if (state.traySlots.some(s => s && s.word === w)) return;

             const entry = { word: w, age: ++state.trayAgeCounter };

             if (state.traySlots.length < state.trayCapacity) {
                 // Still growing — append and check overflow
                 state.traySlots.push(entry);
                 updateRecentWordsTray();
                 const tray = document.getElementById('recent-words-tray');
                 if (tray && tray.scrollHeight > tray.clientHeight) {
                     // Overflowed — this is one too many, lock capacity and replace instead
                     state.traySlots.pop();
                     state.trayCapacity = state.traySlots.length;
                     // Fall through to replacement below
                 } else {
                     return; // Fits, done
                 }
             }

             // At capacity — fill empty (banned) slot first, else replace oldest
             let target = state.traySlots.indexOf(null);
             if (target === -1) {
                 let minAge = Infinity;
                 state.traySlots.forEach((s, i) => {
                     if (s && s.age < minAge) { minAge = s.age; target = i; }
                 });
             }
             state.traySlots[target] = entry;
         });
         updateRecentWordsTray();

     }
     elements.transcriptContainer.scrollTop = 0;
}

// Clears all transcript content
export function clearTranscript() {
    if (elements.transcriptContainer) elements.transcriptContainer.innerHTML = '';
}

// Clear the tray DOM (slots created dynamically as words arrive)
export function initTraySlots() {
    const tray = document.getElementById('recent-words-tray');
    if (tray) tray.innerHTML = '';
    state.traySlots = [];
    state.trayAgeCounter = 0;
    state.trayCapacity = Infinity;
}

// Sync tray DOM to state.traySlots — dynamic slot count, in-place updates
export function updateRecentWordsTray() {
    const tray = document.getElementById('recent-words-tray');
    if (!tray) return;

    // Ensure DOM element count matches state length
    while (tray.children.length > state.traySlots.length) {
        tray.removeChild(tray.lastChild);
    }
    while (tray.children.length < state.traySlots.length) {
        const slot = document.createElement('div');
        slot.className = 'tray-slot tray-slot--empty';
        slot.dataset.slotIndex = tray.children.length;
        slot.dataset.word = '';
        tray.appendChild(slot);
    }

    const slots = tray.children;

    // Find newest age for heat indicator
    let maxAge = 0;
    state.traySlots.forEach(s => { if (s && s.age > maxAge) maxAge = s.age; });

    for (let i = 0; i < slots.length; i++) {
        const el = slots[i];
        const data = state.traySlots[i];
        const currentWord = el.dataset.word || '';

        if (!data) {
            if (currentWord) {
                el.innerHTML = '';
                el.className = 'tray-slot tray-slot--empty';
                el.dataset.word = '';
            }
            continue;
        }

        const isNewest = data.age === maxAge;

        if (data.word === currentWord) {
            el.classList.toggle('selected', data.word === state.transcriptSelectedWord);
            el.classList.toggle('tray-slot--newest', isNewest);
            if (!isNewest) el.classList.remove('tray-slot--hot');
            continue;
        }

        // New or replaced word — rebuild pill content
        const pos = classifyPOS(data.word);
        el.innerHTML = '';
        el.className = `tray-slot tray-slot--occupied pos-${pos}`;
        el.dataset.word = data.word;
        el.dataset.slotIndex = i;

        const label = document.createElement('span');
        label.className = 'pill-label';
        label.textContent = data.word;
        const ban = document.createElement('span');
        ban.className = 'pill-ban';
        ban.title = 'Ignore in feed';
        ban.textContent = '\u00d7';
        el.appendChild(label);
        el.appendChild(ban);

        el.classList.toggle('selected', data.word === state.transcriptSelectedWord);
        if (isNewest) el.classList.add('tray-slot--newest', 'tray-slot--hot');
    }
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

// --- NEW: Update Rhyme Sort Toggle Button ---
// Updates the rhyme sort toggle button state and appearance
export function updateRhymeSortToggleButton() {
    if (!elements.rhymeSortToggleButton) return;
    
    const icon = elements.rhymeSortToggleButton.querySelector('i');
    
    if (icon) {
        switch (state.rhymeSortMode) {
            case 'alphabetical':
                icon.className = 'fas fa-sort-alpha-down';
                break;
            case 'high-similarity':
                icon.className = 'fas fa-bullseye';
                break;
            default: // 'default'
                icon.className = 'fas fa-random';
                break;
        }
    }
    
    const modeNames = {
        'default': 'Default',
        'alphabetical': 'Alphabetical', 
        'high-similarity': 'High-Similarity'
    };
    
    elements.rhymeSortToggleButton.title = `Sort Order: ${modeNames[state.rhymeSortMode] || 'Default'}`;
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

// --- Theme Management Functions ---

// Initialize theme system
export function initializeThemeSystem() {
    // Load saved theme preference or set default
    const savedTheme = localStorage.getItem('preferred-theme');
    const defaultTheme = savedTheme || 'dark';
    document.documentElement.setAttribute('data-theme', defaultTheme);
    
    // Add event listeners for theme buttons
    if (elements.themeDarkButton) {
        elements.themeDarkButton.addEventListener('click', () => switchTheme('dark'));
    }
    if (elements.themeClassicButton) {
        elements.themeClassicButton.addEventListener('click', () => switchTheme('classic'));
    }
    if (elements.themeLightButton) {
        elements.themeLightButton.addEventListener('click', () => switchTheme('light'));
    }
    
    // Add event listeners for randomize functionality
    if (elements.randomizePaletteButton) {
        elements.randomizePaletteButton.addEventListener('click', toggleRandomizeDropdown);
    }
    if (elements.generatePaletteButton) {
        elements.generatePaletteButton.addEventListener('click', generateRandomPalette);
    }
    if (elements.copyCssButton) {
        elements.copyCssButton.addEventListener('click', copyCssToConsole);
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (event) => {
        if (!event.target.closest('.randomize-container')) {
            hideRandomizeDropdown();
        }
    });
    
    // Update theme button states
    updateThemeButtonStates();
    
    // Initialize color previews
    updateColorPreviews();
}

// Switch between themes
export function switchTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeButtonStates();
    
    // Update color previews in randomize dropdown
    updateColorPreviews();
    
    // Store theme preference
    localStorage.setItem('preferred-theme', theme);
    
    console.log(`Theme switched to: ${theme}`);
}

// Update theme button active states
function updateThemeButtonStates() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    
    if (elements.themeDarkButton) {
        elements.themeDarkButton.classList.toggle('active', currentTheme === 'dark');
    }
    if (elements.themeClassicButton) {
        elements.themeClassicButton.classList.toggle('active', currentTheme === 'classic');
    }
    if (elements.themeLightButton) {
        elements.themeLightButton.classList.toggle('active', currentTheme === 'light');
    }
}

// Toggle randomize dropdown visibility
function toggleRandomizeDropdown() {
    if (elements.randomizeDropdown) {
        elements.randomizeDropdown.classList.toggle('show');
    }
}

// Hide randomize dropdown
function hideRandomizeDropdown() {
    if (elements.randomizeDropdown) {
        elements.randomizeDropdown.classList.remove('show');
    }
}

// Generate random palette based on selected colors
function generateRandomPalette() {
    const colorOptions = document.querySelectorAll('.color-option input[type="checkbox"]:checked');
    const root = document.documentElement;
    
    colorOptions.forEach(checkbox => {
        const colorVar = checkbox.getAttribute('data-color');
        const newColor = generateAestheticColor(colorVar);
        root.style.setProperty(colorVar, newColor);
    });
    
    // Update color previews
    updateColorPreviews();
    
    // Show copy CSS button
    if (elements.copyCssButton) {
        elements.copyCssButton.style.display = 'block';
    }
    
    // Hide dropdown
    hideRandomizeDropdown();
    
    console.log('Random palette generated!');
}

// Generate aesthetically pleasing colors using HSL
function generateAestheticColor(colorVar) {
    // Define color ranges for different variables
    const colorRanges = {
        '--primary-accent': { h: [180, 240], s: [60, 100], l: [40, 70] }, // Blues/Cyans
        '--secondary-accent': { h: [280, 320], s: [60, 100], l: [40, 70] }, // Magentas/Purples
        '--panel-bg': { h: [200, 280], s: [10, 30], l: [15, 35] }, // Dark backgrounds
        '--text-color': { h: [0, 360], s: [0, 20], l: [70, 95] }, // Light text
        '--highlight-color': { h: [30, 60], s: [70, 100], l: [50, 80] }, // Oranges/Yellows
        '--border-color': { h: [200, 280], s: [20, 50], l: [30, 60] }, // Medium borders
        '--text-bright': { h: [0, 360], s: [0, 20], l: [85, 100] }, // Bright text
        '--red-color': { h: [0, 15], s: [70, 100], l: [40, 70] }, // Reds
        '--green-color': { h: [120, 150], s: [60, 100], l: [40, 70] }, // Greens
        '--disabled-color': { h: [200, 220], s: [10, 30], l: [40, 60] } // Disabled colors
    };
    
    const range = colorRanges[colorVar] || { h: [0, 360], s: [50, 100], l: [40, 70] };
    
    const h = Math.floor(Math.random() * (range.h[1] - range.h[0]) + range.h[0]);
    const s = Math.floor(Math.random() * (range.s[1] - range.s[0]) + range.s[0]);
    const l = Math.floor(Math.random() * (range.l[1] - range.l[0]) + range.l[0]);
    
    return `hsl(${h}, ${s}%, ${l}%)`;
}

// Update color previews in the randomize dropdown
function updateColorPreviews() {
    const colorPreviews = document.querySelectorAll('.color-preview');
    colorPreviews.forEach(preview => {
        const checkbox = preview.parentElement.querySelector('input[type="checkbox"]');
        if (checkbox) {
            const colorVar = checkbox.getAttribute('data-color');
            const currentColor = getComputedStyle(document.documentElement).getPropertyValue(colorVar);
            preview.style.background = currentColor;
        }
    });
}

// Copy current CSS variables to console
function copyCssToConsole() {
    const colorVars = [
        '--primary-accent',
        '--secondary-accent', 
        '--panel-bg',
        '--panel-bg-opaque',
        '--border-color',
        '--text-color',
        '--text-bright',
        '--highlight-color',
        '--red-color',
        '--green-color',
        '--disabled-color'
    ];
    
    let cssBlock = '/* Generated Theme CSS */\n';
    cssBlock += '[data-theme="custom"] {\n';
    
    colorVars.forEach(varName => {
        const value = getComputedStyle(document.documentElement).getPropertyValue(varName);
        cssBlock += `    ${varName}: ${value};\n`;
    });
    
    cssBlock += '}';
    
    console.log('%cGenerated CSS Theme:', 'color: #00ffff; font-weight: bold; font-size: 14px;');
    console.log(cssBlock);
    
    // Also copy to clipboard if possible
    if (navigator.clipboard) {
        navigator.clipboard.writeText(cssBlock).then(() => {
            showFeedback('CSS copied to clipboard and console!', false, 2000);
        }).catch(() => {
            showFeedback('CSS copied to console!', false, 2000);
        });
    } else {
        showFeedback('CSS copied to console!', false, 2000);
    }
}