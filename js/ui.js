// js/ui.js
// Handles DOM element selection and UI updates.

import { state } from './state.js';

// --- Get DOM Elements ---
export const elements = {
    // Header & Feedback
    scoreDisplay: document.getElementById('score'),
    streakDisplay: document.getElementById('streak-counter'),
    feedbackMessage: document.getElementById('feedback-message'),
    bgCanvas: document.getElementById('bg-canvas'),

    // Word Display Area
    wordDisplay: document.getElementById('word-display'),
    wordDisplayContainer: document.getElementById('word-display-container'),
    blacklistButton: document.getElementById('blacklist-word'),
    favoriteButton: document.getElementById('favorite-word'),
    findRhymesButton: document.getElementById('find-rhymes-button'), // Button below word box

    // Word Display Area Arrows
    upWordButton: document.getElementById('up-word'), // NEW
    downWordButton: document.getElementById('down-word'), // NEW
    prevWordButton: document.getElementById('prev-word'),
    nextWordButton: document.getElementById('next-word'),

    // Left Panel Controls (Word Settings)
    wordOrderSelect: document.getElementById('word-order'),
    favoritesButton: document.getElementById('favorites-button'),
    editWordListButton: document.getElementById('edit-word-list-button'),

    // Left Panel Controls (RNG)
    rngDigitsInput: document.getElementById('rng-digits'),
    rngSetsInput: document.getElementById('rng-sets'),
    rngSurpriseCheckbox: document.getElementById('rng-surprise-me'),
    generateNumbersButton: document.getElementById('generate-numbers-button'),
    rngDisplayArea: document.getElementById('rng-display-area'),

    // Center Stage Controls (Activation)
    voiceModeButton: document.getElementById('voice-mode-button'),
    timedModeButton: document.getElementById('timed-mode-button'),
    timedCycleOptionsDiv: document.getElementById('timed-cycle-options'),
    cycleSpeedInput: document.getElementById('cycle-speed'),
    cycleSpeedSlider: document.getElementById('cycle-speed-slider'),
    transcriptContainer: document.getElementById('new-transcript'),

    // Right Panel Controls (BPM)
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

    // Right Panel Controls (Frequencies)
    frequentWordsContainer: document.getElementById('frequent-words'),

    // Modals
    favoritesModal: document.getElementById('favorites-modal'),
    closeFavoritesModal: document.getElementById('close-favorites-modal'),
    favoritesListUl: document.getElementById('favorites-list'),
    clearFavoritesButton: document.getElementById('clear-favorites-button'),

    wordListEditorModal: document.getElementById('word-list-editor-modal'),
    closeWordListEditor: document.getElementById('close-word-list-editor'),
    wordListTextarea: document.getElementById('word-list-textarea'),
    saveWordListButton: document.getElementById('save-word-list-button'),

    rhymeFinderModal: document.getElementById('rhyme-finder-modal'),
    closeRhymeModalButton: document.getElementById('close-rhyme-modal'),
    rhymeModalBaseWord: document.getElementById('rhyme-modal-base-word'), // Updated ID
    rhymeModalPatternContainer: document.getElementById('rhyme-modal-pattern-container'), // Updated ID
    rhymeResultsList: document.getElementById('rhyme-results-list'),
    rhymeNoResults: document.getElementById('rhyme-no-results'),
    manualRhymeInput: document.getElementById('manual-rhyme-input'),
    addManualRhymeButton: document.getElementById('add-manual-rhyme-button'),
};

// --- UI Update Functions ---

// Add function to update detect button state
export function updateDetectBpmButtonState(isDetecting) {
    if (!elements.detectBpmButton) return;
    elements.detectBpmButton.disabled = isDetecting;
    elements.detectBpmButton.classList.toggle('detecting', isDetecting); // For spinner CSS
    if (isDetecting) {
        elements.detectBpmButton.innerHTML = '<i class="fas fa-robot"></i> DETECTING...';
    } else {
        elements.detectBpmButton.innerHTML = '<i class="fas fa-robot"></i> DETECT';
    }
}

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

export function updateScoreDisplay(newScore) {
    if (!elements.scoreDisplay) return;
    elements.scoreDisplay.textContent = newScore;
    elements.scoreDisplay.classList.remove('pulse');
    void elements.scoreDisplay.offsetWidth;
    elements.scoreDisplay.classList.add('pulse');
    setTimeout(() => elements.scoreDisplay?.classList.remove('pulse'), 300);
}

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

export function displayWord(word) { // word is the word to display (could be base or rhyme)
    if(!elements.wordDisplay) return;

    elements.wordDisplay.textContent = word;

    // --- REMOVED DYNAMIC FONT SIZE LOGIC ---
    // All words will now use the base font size from CSS (4em)
    // This eliminates the font-size transitions that cause jittering

    // Update action buttons based on the *displayed* word
    elements.blacklistButton?.classList.toggle('active', state.blacklist.has(word));
    elements.favoriteButton?.classList.toggle('active', state.favorites.has(word));

    updateWordDisplayAnimation();
    updateRhymeNavButtons(); // Update up/down button states
}

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

export function updateActivationUI() {
    if (!elements.voiceModeButton || !elements.timedModeButton || !elements.timedCycleOptionsDiv) return;
    elements.voiceModeButton.classList.toggle('active', state.activationMode === 'voice' && state.isMicActive);
    elements.timedModeButton.classList.toggle('active', state.activationMode === 'timed');
    elements.timedCycleOptionsDiv.style.display = (state.activationMode === 'timed') ? 'flex' : 'none';
    if (elements.cycleSpeedInput) elements.cycleSpeedInput.value = state.cycleSpeed;
    if (elements.cycleSpeedSlider) elements.cycleSpeedSlider.value = state.cycleSpeed;
    if (elements.wordOrderSelect) elements.wordOrderSelect.value = state.wordOrderMode;
}

export function updateBpmIndicator(bpmValue) {
    if(elements.bpmDisplay) elements.bpmDisplay.textContent = bpmValue;
    const beatIntervalSeconds = bpmValue > 0 ? 60 / bpmValue : 0.5;
    document.documentElement.style.setProperty('--beat-interval', `${beatIntervalSeconds}s`);
    if (elements.wordDisplayContainer?.classList.contains('buzz-with-bpm')) {
        elements.wordDisplayContainer.style.animationDuration = `${beatIntervalSeconds}s`;
    }
}

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

export function triggerScreenShake() {
    document.body.classList.remove('screen-shaking');
    void document.body.offsetWidth;
    document.body.classList.add('screen-shaking');
}

export function startWordBuzz() {
    if (elements.wordDisplayContainer && state.bpm > 0) {
        const beatIntervalSeconds = 60 / state.bpm;
        elements.wordDisplayContainer.style.animationDuration = `${beatIntervalSeconds}s`;
        elements.wordDisplayContainer.classList.add('buzz-with-bpm');
    }
}

export function stopWordBuzz() {
     if (elements.wordDisplayContainer) {
         elements.wordDisplayContainer.classList.remove('buzz-with-bpm');
         elements.wordDisplayContainer.style.animationDuration = '';
     }
}

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

export function clearTranscript() {
    if (elements.transcriptContainer) elements.transcriptContainer.innerHTML = '';
}

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

export function updateRngInputs(digits, sets) {
    if(elements.rngDigitsInput) elements.rngDigitsInput.value = digits;
    if(elements.rngSetsInput) elements.rngSetsInput.value = sets;
}

// --- NEW: Update Rhyme Navigation Button States ---
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