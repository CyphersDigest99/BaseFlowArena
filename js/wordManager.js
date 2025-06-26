// js/wordManager.js
// Handles loading, filtering, sorting, and changing words.

import { state } from './state.js';
import * as ui from './ui.js';
import * as storage from './storage.js';
import * as rhyme from './rhyme.js'; // Import rhyme module for getting rhyme list

// --- Word Loading ---
export async function loadWords() {
    console.log('Loading words...');
    try {
        let text;
        try {
            const response = await fetch('random word list.txt'); // Assumes file in root
            if (!response.ok) {
                console.warn(`Could not fetch 'random word list.txt' (Status: ${response.status}). Falling back to defaults.`);
                text = state.DEFAULT_WORD_LIST.join('\n');
            } else {
                text = await response.text();
            }
        } catch (fetchError) {
            console.warn(`Network error fetching 'random word list.txt': ${fetchError}. Falling back to defaults.`);
            text = state.DEFAULT_WORD_LIST.join('\n');
        }

        // Process words, keeping original case, filtering blanks/short ones
        state.wordList = text.split('\n').map(word => word.trim()).filter(word => word && word.length > 1);

        if (state.wordList.length === 0) {
            console.warn('Word list empty after processing, using defaults.');
            state.wordList = [...state.DEFAULT_WORD_LIST];
        }

        console.log(`Loaded ${state.wordList.length} words initially.`);
        if(ui.elements.wordListTextarea) ui.elements.wordListTextarea.value = state.wordList.join('\n');

        applyFiltersAndSort(); // Apply initial blacklist/sort

    } catch (error) {
        console.error('Unexpected error during word loading:', error);
        state.wordList = [...state.DEFAULT_WORD_LIST];
        if(ui.elements.wordListTextarea) ui.elements.wordListTextarea.value = state.wordList.join('\n');
        applyFiltersAndSort();
        ui.showFeedback("Error loading word list, used defaults.", true);
    }
}

// --- Filtering and Sorting ---
export function applyFiltersAndSort() {
    // --- DEBUG LOGGING START ---
    console.log('[applyFiltersAndSort] Before Filter:', {
        wordListCount: state.wordList.length,
        blacklistCount: state.blacklist.size,
        currentWord: state.currentWord,
        currentIndex: state.currentWordIndex,
        // Uncomment to see blacklist content (might be large)
        // blacklistContent: Array.from(state.blacklist).slice(0, 50)
    }); // Log state BEFORE
    // --- DEBUG LOGGING END ---

    const oldFilteredListLength = state.filteredWordList.length;
    const oldCurrentWord = state.currentWord;

    // --- Actual filtering ---
    state.filteredWordList = state.wordList.filter(word => !state.blacklist.has(word));
    const currentWordStillValid = state.filteredWordList.includes(state.currentWord);

    // Apply sorting
    if (state.wordOrderMode === 'alphabetical') {
        state.filteredWordList.sort((a, b) => a.localeCompare(b));
    }
    // 'random' and 'sequential' don't need explicit sorting here


    // --- DEBUG LOGGING START ---
    console.log('[applyFiltersAndSort] After Filter:', {
        filteredCount: state.filteredWordList.length,
        currentWordStillValid: currentWordStillValid
    });
    // --- DEBUG LOGGING END ---


    // --- Update current index based on changes ---
    if (currentWordStillValid) {
        state.currentWordIndex = state.filteredWordList.indexOf(state.currentWord);
    } else if (state.filteredWordList.length > 0) {
        state.currentWordIndex = 0; // Reset to start
        state.currentWord = state.filteredWordList[0]; // SET the word here too
        // --- DEBUG LOGGING START ---
        console.log('[applyFiltersAndSort] Current word invalid/changed, Resetting word to:', state.currentWord); // Log reset
        // --- DEBUG LOGGING END ---
    } else {
        state.currentWordIndex = -1;
        state.currentWord = "NO WORDS!"; // Ensure state matches message
        // --- DEBUG LOGGING START ---
        console.log('[applyFiltersAndSort] Filtered list is now empty!');
         // --- DEBUG LOGGING END ---
    }

    // --- DEBUG LOGGING START ---
    // Only log if something significant changed overall
    if (oldFilteredListLength !== state.filteredWordList.length || oldCurrentWord !== state.currentWord) {
        console.log(`[applyFiltersAndSort] Complete. Mode: ${state.wordOrderMode}. Filtered count: ${state.filteredWordList.length}. Final State:`, { word: state.currentWord, index: state.currentWordIndex });
    }
     // --- DEBUG LOGGING END ---

    // The calling function should determine if ui.displayWord needs to be called based on context
}


// --- Word Navigation (Left/Right/Timed/Voice) ---
// This function sets the "base word"
export function changeWord(direction = 'next', isInitial = false, isVoiceMatch = false) {
    // --- DEBUG LOGGING START ---
    // console.log(`[changeWord] Called with direction: ${direction}, initial: ${isInitial}, voice: ${isVoiceMatch}`);
    // console.log(`[changeWord] State before change:`, { currentWord: state.currentWord, currentIndex: state.currentWordIndex, filteredCount: state.filteredWordList.length });
    // --- DEBUG LOGGING END ---

    // Check if list is empty AFTER potential filtering during init
    if (state.filteredWordList.length === 0) {
        if (state.currentWord !== "NO WORDS!") {
            state.currentWord = "NO WORDS!"; state.currentWordIndex = -1;
            state.currentRhymeList = []; state.currentRhymeIndex = -1;
            ui.displayWord("NO WORDS!");
            ui.showFeedback("Word list empty or fully blacklisted!", true, 3000);
        }
        return;
    }

    // --- Streak ---
    if (!isInitial && !isVoiceMatch && (direction !== 'stay')) updateStreak(false);

    // --- History ---
     if (!isInitial && direction !== 'previous' && state.currentWordIndex >= 0 && state.currentWord !== "NO WORDS!") {
         if (direction !== 'stay' || state.history.length === 0 || state.history[state.history.length - 1] !== state.currentWordIndex) {
            state.history.push(state.currentWordIndex);
            if (state.history.length > state.MAX_HISTORY) state.history.shift();
         }
     }

    // --- Determine Next Index (in filteredWordList) ---
    let nextIndex = state.currentWordIndex;
    if (direction === 'previous') {
        if (state.history.length > 0) { nextIndex = state.history.pop(); }
        else { ui.showFeedback("No more history", true, 1000); return; }
    } else if (direction === 'next') {
        switch (state.wordOrderMode) {
            case 'random':
                if (state.filteredWordList.length > 1) {
                    let tempIndex;
                    do { tempIndex = Math.floor(Math.random() * state.filteredWordList.length); }
                    while (tempIndex === state.currentWordIndex);
                    nextIndex = tempIndex;
                } else { nextIndex = 0; } break;
            case 'alphabetical': case 'sequential': default:
                nextIndex = (state.currentWordIndex === -1) ? 0 : (state.currentWordIndex + 1) % state.filteredWordList.length; break;
        }
    } else if (direction === 'stay') {
         nextIndex = (state.currentWordIndex === -1 && state.filteredWordList.length > 0) ? 0 : state.currentWordIndex;
         if (nextIndex < 0 || nextIndex >= state.filteredWordList.length) nextIndex = 0; // Clamp
    }

    // --- Validate and Update State ---
    if (nextIndex >= 0 && nextIndex < state.filteredWordList.length) {
        const newWord = state.filteredWordList[nextIndex];
        if (state.currentWord !== newWord || isInitial || state.currentWord === "NO WORDS!") {
            state.currentWordIndex = nextIndex;
            state.currentWord = newWord; // Set the new BASE word
            state.lastMatchedWord = null;
            console.log(`Word changed (L/R). New Index: ${state.currentWordIndex}, Word: "${state.currentWord}"`);

            state.currentRhymeList = rhyme.getValidRhymesForWord(state.currentWord); // Fetch rhymes
            state.currentRhymeIndex = -1;

            ui.displayWord(state.currentWord);

        } else if (direction === 'stay') {
            // Ensure rhymes are up-to-date even if base word is same
            state.currentRhymeList = rhyme.getValidRhymesForWord(state.currentWord);
            state.currentRhymeIndex = -1;
            ui.displayWord(state.currentWord); // Refresh UI
        }
    } else if (state.filteredWordList.length > 0 && state.currentWord !== "NO WORDS!") {
         // Fallback if index invalid
         console.warn(`Invalid next index ${nextIndex}. Resetting to 0.`);
         state.currentWordIndex = 0;
         state.currentWord = state.filteredWordList[0];
         state.lastMatchedWord = null;
         state.currentRhymeList = rhyme.getValidRhymesForWord(state.currentWord);
         state.currentRhymeIndex = -1;
         ui.displayWord(state.currentWord);
    }
     // No else needed - empty list handled at start
}

// --- Rhyme Navigation (Up/Down) ---
export function selectRhyme(direction) {
    if (!state.currentRhymeList || state.currentRhymeList.length === 0) {
        ui.showFeedback("No rhymes available for current word.", true, 1500); return;
    }

    const rhymeList = state.currentRhymeList;
    const count = rhymeList.length;
    let nextRhymeIndex = state.currentRhymeIndex;

    if (direction === 'down') { nextRhymeIndex = (nextRhymeIndex + 1) % count; }
    else if (direction === 'up') { nextRhymeIndex = (nextRhymeIndex - 1 + count) % count; }
    else return;

    state.currentRhymeIndex = nextRhymeIndex;
    const selectedRhymeWord = rhymeList[state.currentRhymeIndex];

    console.log(`Rhyme navigated (${direction}): "${selectedRhymeWord}" (Rhyme Index ${state.currentRhymeIndex})`);

    // --- Update UI ONLY ---
    ui.displayWord(selectedRhymeWord); // Show the selected rhyme temporarily
}


// Helper function export for listeners
export function nextWord() { changeWord('next', false, false); }
export function previousWord() { changeWord('previous', false, false); }
export function stayWord() { changeWord('stay', false, false); }


// --- Word Actions (Blacklist/Favorite) ---
export function toggleBlacklist() {
    const wordToToggle = ui.elements.wordDisplay?.textContent; // Act on DISPLAYED word
    if (!wordToToggle || wordToToggle === "NO WORDS!" || wordToToggle === "LOADING..." || wordToToggle === "ERROR") {
        console.warn("Cannot blacklist invalid displayed word."); return;
    }

    const wasBlacklisted = state.blacklist.has(wordToToggle);
    if (wasBlacklisted) {
        state.blacklist.delete(wordToToggle); ui.showFeedback(`"${wordToToggle}" un-blacklisted.`);
    } else {
        state.blacklist.add(wordToToggle); ui.showFeedback(`"${wordToToggle}" blacklisted!`, true);
        if (wordToToggle === state.currentWord && state.currentStreak > 0) updateStreak(false);
    }
    storage.saveSettings(); // Save changes
    applyFiltersAndSort(); // Recalculate filtered list

    // --- Decide what to display next ---
    if (wordToToggle === state.currentWord) {
        // If the BASE word was actioned
        if (!wasBlacklisted) changeWord('next', false, false); // Just blacklisted -> move
        else changeWord('stay', false, false); // Just unblacklisted -> refresh
    } else {
        // If a RHYME was actioned, revert display to BASE word & refresh its rhymes
        console.log(`Rhyme "${wordToToggle}" actioned. Reverting display to base word "${state.currentWord}" and refreshing rhymes.`);
        changeWord('stay', false, false); // 'stay' re-fetches rhymes for current base word
    }
}

export function toggleFavorite() {
    const wordToToggle = ui.elements.wordDisplay?.textContent; // Act on DISPLAYED word
    if (!wordToToggle || wordToToggle === "NO WORDS!" || wordToToggle === "LOADING..." || wordToToggle === "ERROR") {
        console.warn("Cannot favorite invalid displayed word."); return;
    }

    if (state.favorites.has(wordToToggle)) {
        state.favorites.delete(wordToToggle); ui.showFeedback(`"${wordToToggle}" un-favorited.`);
    } else {
        state.favorites.add(wordToToggle); ui.showFeedback(`"${wordToToggle}" favorited!`);
    }
    storage.saveSettings();
    ui.elements.favoriteButton?.classList.toggle('active', state.favorites.has(wordToToggle));
}

// --- Word Order ---
export function setWordOrder(newOrder) {
    if (newOrder && newOrder !== state.wordOrderMode) {
        state.wordOrderMode = newOrder;
        console.log(`Word order mode changed to: ${state.wordOrderMode}`);
        applyFiltersAndSort(); // Re-sort list
        changeWord('stay', false, false); // Refresh base word & its rhymes
        storage.saveSettings();
    }
}

// --- Gamification Update ---
export function updateScore(points) {
    const isAddingPoints = points > 0;
    state.score += points;
    if (state.score < 0) state.score = 0;
    if (points !== 0) console.log(`Score updated by ${points}. New score: ${state.score}`);
    if (isAddingPoints) ui.updateScoreDisplay(state.score);
    else if (ui.elements.scoreDisplay) ui.elements.scoreDisplay.textContent = state.score;
}

export function updateStreak(increment) {
    const oldStreak = state.currentStreak;
    let grew = false;
    if (increment) { state.currentStreak++; grew = true; }
    else { if (oldStreak > 0) console.log(`Streak reset from ${oldStreak}.`); state.currentStreak = 0; }
    if (grew) console.log(`Streak updated. Current streak: ${state.currentStreak}`);
    ui.updateStreakDisplay(state.currentStreak, grew);
}

export function resetGamification() {
    state.score = 0; state.currentStreak = 0;
    if (ui.elements.scoreDisplay) ui.elements.scoreDisplay.textContent = state.score;
    if (ui.elements.streakDisplay) ui.elements.streakDisplay.textContent = state.currentStreak;
    console.log("Score and Streak reset.");
}

// --- Frequency Update ---
export function updateFrequencies(text) {
    if (!text) return;
    const words = text.toLowerCase().match(/\b(\w{2,})\b/g);
    if (!words) return;
    let changed = false;
    words.forEach(word => {
        if (!state.blacklist.has(word)) {
            state.wordFrequencies[word] = (state.wordFrequencies[word] || 0) + 1;
            changed = true;
        }
    });
    if (changed) {
        ui.displayFrequencies(state.wordFrequencies);
        storage.saveSettings(); // Save updated frequencies
    }
}

// --- Word List Editor ---
export function applyWordListChanges(newText) {
     const newWords = newText.split('\n').map(w => w.trim()).filter(w => w && w.length > 1);
     if (newWords.length > 0) {
         state.wordList = newWords;
         applyFiltersAndSort(); // Recalculates filtered list & updates current index/word if needed

         // Decide which word to show: use state determined by applyFiltersAndSort
         if (state.currentWord === "NO WORDS!") {
             changeWord('next', true, false); // Will display "NO WORDS!" if list truly empty
         } else if (state.filteredWordList.includes(state.currentWord)) {
             changeWord('stay', false, false); // Refresh state for potentially resorted current word
         } else {
             // applyFiltersAndSort should have reset state.currentWord already
             changeWord('stay', false, false); // Show the new word at index 0
         }

         ui.showFeedback(`Word list updated for session (${state.filteredWordList.length} valid words).`, false, 3000);
         return true;
     } else {
         ui.showFeedback('Word list cannot be empty!', true, 3000);
         return false;
     }
}