/**
 * @fileoverview Word Management and Navigation System
 * 
 * This module handles all aspects of word management in the BaseFlowArena application.
 * It provides functionality for loading word lists, filtering words by various criteria,
 * navigating between words, managing rhymes, and handling user interactions with words.
 * The module serves as the core word processing engine that coordinates with other
 * modules to provide a seamless freestyle experience.
 * 
 * Key responsibilities:
 * - Word list loading and management from files or defaults
 * - Syllable counting and filtering
 * - Word navigation (next, previous, random, alphabetical, sequential)
 * - Rhyme navigation and management
 * - Blacklist and favorites management
 * - Word frequency tracking
 * - Gamification elements (score, streaks)
 * - Word list editing and persistence
 * 
 * Dependencies: state.js, ui.js, storage.js, rhyme.js, utils.js
 */

// js/wordManager.js
// Handles loading, filtering, sorting, and changing words.

import { state } from './state.js';
import * as ui from './ui.js';
import * as storage from './storage.js';
import * as rhyme from './rhyme.js'; // Import rhyme module for getting rhyme list
import * as utils from './utils.js'; // Import utils module for swipe animations

// Callback for when words change (for tooltip updates)
let onWordChangeCallback = null;

export function setWordChangeCallback(callback) {
    onWordChangeCallback = callback;
}

// --- Syllable Counting Function ---
// Calculates syllable count using JavaScript regex patterns
function countSyllables(word) {
    if (!word) return 0;
    
    // Convert to lowercase for consistent processing
    word = word.toLowerCase();
    
    // Remove common suffixes that don't add syllables
    word = word.replace(/(?:ed|ing|er|est|ly|ful|less|ness|ment|tion|sion|able|ible|ous|ious|eous|al|ial|ic|ical|ive|ative|itive|ize|ise|ify|fy|dom|hood|ship|th|ty|cy|ry|my|ny|sy|zy|by|dy|fy|gy|hy|jy|ky|ly|my|ny|py|qy|ry|sy|ty|vy|wy|zy)$/g, '');
    
    // Count vowel groups (consonant-vowel-consonant pattern)
    const vowelGroups = word.match(/[aeiouy]+/g);
    if (!vowelGroups) return 1; // At least one syllable
    
    let syllableCount = vowelGroups.length;
    
    // Handle special cases
    if (word.endsWith('e') && syllableCount > 1) {
        syllableCount--; // Silent 'e' at end doesn't count
    }
    
    // Ensure minimum of 1 syllable
    return Math.max(1, syllableCount);
}

// --- Get Syllable Count from JSON Data (Preferred) ---
// Attempts to get accurate syllable count from rhyme data, falls back to calculation
function getSyllableCount(word) {
    if (!word) return 1;
    
    // Try to get syllable count from rhyme data first (most accurate)
    if (state.rhymeData) {
        const wordLower = word.toLowerCase();
        const data = state.rhymeData[wordLower];
        
        if (data && data.syllables) {
            return data.syllables; // Use accurate count from JSON
        }
    }
    
    // Fallback to JavaScript calculation if not found in JSON
    return countSyllables(word);
}

// --- Word Loading ---
// Loads word list from file or uses defaults, applies initial filters
export async function loadWords() {
    console.log('Loading words...');
    
    // Check if we have a saved word list in state (from localStorage)
    if (state.wordList && state.wordList.length > 0) {
        console.log(`Using ${state.wordList.length} words from saved state.`);
        if(ui.elements.wordListTextarea) ui.elements.wordListTextarea.value = state.wordList.join('\n');
        applyFiltersAndSort(); // Apply initial blacklist/sort
        return;
    }
    
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
// Applies blacklist and syllable filters, sorts words, and updates current word state
export function applyFiltersAndSort() {
    // --- DEBUG LOGGING START ---
    console.log('[applyFiltersAndSort] Before Filter:', {
        wordListCount: state.wordList.length,
        blacklistCount: state.blacklist.size,
        currentWord: state.currentWord,
        currentIndex: state.currentWordIndex,
        minSyllables: state.minSyllables,
        maxSyllables: state.maxSyllables,
        // Uncomment to see blacklist content (might be large)
        // blacklistContent: Array.from(state.blacklist).slice(0, 50)
    }); // Log state BEFORE
    // --- DEBUG LOGGING END ---

    const oldFilteredListLength = state.filteredWordList.length;
    const oldCurrentWord = state.currentWord;

    // --- Actual filtering ---
    state.filteredWordList = state.wordList.filter(word => {
        // Blacklist filter
        if (state.blacklist.has(word)) return false;
        
        // Syllable filter
        const syllableCount = getSyllableCount(word);
        if (state.minSyllables > 0 && syllableCount < state.minSyllables) return false;
        if (state.maxSyllables > 0) {
            // Handle 6+ logic: if max is 6, accept 6 or more syllables
            if (state.maxSyllables === 6) {
                if (syllableCount < 6) return false;
            } else {
                if (syllableCount > state.maxSyllables) return false;
            }
        }
        
        return true;
    });
    
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
// This function sets the "base word" and manages word transitions
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
            const previousWord = state.currentWord;
            state.currentWordIndex = nextIndex;
            state.currentWord = newWord; // Set the new BASE word
            state.lastMatchedWord = null;
            console.log(`Word changed (L/R). New Index: ${state.currentWordIndex}, Word: "${state.currentWord}"`);

            state.currentRhymeList = rhyme.getValidRhymesForWord(state.currentWord); // Fetch rhymes
            state.currentRhymeIndex = -1;

            ui.displayWord(state.currentWord);
            
            // Call the word change callback if set
            if (onWordChangeCallback) {
                onWordChangeCallback(state.currentWord, previousWord);
            }

        } else if (direction === 'stay') {
            // Ensure rhymes are up-to-date even if base word is same
            state.currentRhymeList = rhyme.getValidRhymesForWord(state.currentWord);
            state.currentRhymeIndex = -1;
            ui.displayWord(state.currentWord); // Refresh UI
        }
    } else if (state.filteredWordList.length > 0 && state.currentWord !== "NO WORDS!") {
         // Fallback if index invalid
         console.warn(`Invalid next index ${nextIndex}. Resetting to 0.`);
         const previousWord = state.currentWord;
         state.currentWordIndex = 0;
         state.currentWord = state.filteredWordList[0];
         state.lastMatchedWord = null;
         state.currentRhymeList = rhyme.getValidRhymesForWord(state.currentWord);
         state.currentRhymeIndex = -1;
         ui.displayWord(state.currentWord);
         
         // Call the word change callback if set
         if (onWordChangeCallback) {
             onWordChangeCallback(state.currentWord, previousWord);
         }
    }
     // No else needed - empty list handled at start
}

// --- Rhyme Navigation (Up/Down) ---
// Navigates through available rhymes for the current base word with animations
export function selectRhyme(direction) {
    if (!state.currentRhymeList || state.currentRhymeList.length === 0) {
        ui.showFeedback("No rhymes available for current word.", true, 1500); return;
    }

    // Get the rhyme list to use for navigation
    let rhymeList = state.currentRhymeList;
    let currentRhymeIndex = state.currentRhymeIndex;
    
    // If alphabetical mode is enabled, create a sorted copy and find the current word's position
    if (state.isRhymeSortAlphabetical) {
        const sortedRhymeList = [...state.currentRhymeList].sort((a, b) => a.localeCompare(b));
        
        // Find the current rhyme word in the sorted list
        let currentRhymeWord = null;
        if (currentRhymeIndex >= 0 && currentRhymeIndex < state.currentRhymeList.length) {
            currentRhymeWord = state.currentRhymeList[currentRhymeIndex];
        }
        
        // Use the sorted list for navigation
        rhymeList = sortedRhymeList;
        
        // Find the current word's position in the sorted list
        if (currentRhymeWord) {
            currentRhymeIndex = sortedRhymeList.indexOf(currentRhymeWord);
            if (currentRhymeIndex === -1) currentRhymeIndex = 0; // Fallback to first if not found
        } else {
            currentRhymeIndex = -1; // Start from base word
        }
    }

    const count = rhymeList.length;
    let nextRhymeIndex = currentRhymeIndex;

    if (direction === 'down') { nextRhymeIndex = (nextRhymeIndex + 1) % count; }
    else if (direction === 'up') { nextRhymeIndex = (nextRhymeIndex - 1 + count) % count; }
    else return;

    // Find the selected word in the original list to maintain the correct index
    const selectedRhymeWord = rhymeList[nextRhymeIndex];
    const originalIndex = state.currentRhymeList.indexOf(selectedRhymeWord);
    
    // Update the state with the original index
    state.currentRhymeIndex = originalIndex >= 0 ? originalIndex : 0;

    console.log(`Rhyme navigated (${direction}): "${selectedRhymeWord}" (Rhyme Index ${state.currentRhymeIndex})`);

    // Trigger vertical swipe animation for rhyme navigation
    utils.triggerVerticalSwipe(direction);
    
    // Delay the UI update to allow animation to complete
    setTimeout(() => {
        // --- Update UI ONLY ---
        ui.displayWord(selectedRhymeWord); // Show the selected rhyme temporarily
        // Tooltip will be updated automatically via callback
    }, 200);
}

// --- Voice Rhyme Navigation ---
// Handles automatic rhyme navigation for voice recognition mode
export function navigateNextRhymeForVoice() {
    // If no rhymes available, return false to indicate we should get a random word
    if (!state.currentRhymeList || state.currentRhymeList.length === 0) {
        console.log('No rhymes available for voice navigation, will get random word');
        return false;
    }

    const rhymeList = state.currentRhymeList;
    const count = rhymeList.length;
    
    // Move to next rhyme (or first rhyme if we're at base word)
    let nextRhymeIndex = state.currentRhymeIndex + 1;
    
    // If we've gone through all rhymes, return false to get a new random word
    if (nextRhymeIndex >= count) {
        console.log('All rhymes navigated, will get new random word');
        return false;
    }
    
    // Navigate to the next rhyme
    state.currentRhymeIndex = nextRhymeIndex;
    const selectedRhymeWord = rhymeList[state.currentRhymeIndex];
    
    console.log(`Voice rhyme navigation: "${selectedRhymeWord}" (Rhyme Index ${state.currentRhymeIndex})`);
    
    // Update UI to show the rhyme
    ui.displayWord(selectedRhymeWord);
    ui.showFeedback(`Rhyme: ${selectedRhymeWord}`, false, 1500);
    
    // Tooltip will be updated automatically via callback
    
    return true; // Successfully navigated to a rhyme
}

// Helper function export for listeners - Navigation with animations
export function nextWord() { 
    // Trigger horizontal swipe animation for right navigation
    utils.triggerHorizontalSwipe('right');
    // Delay the actual word change to allow animation to complete
    setTimeout(() => changeWord('next', false, false), 200);
}
export function previousWord() { 
    // Trigger horizontal swipe animation for left navigation
    utils.triggerHorizontalSwipe('left');
    // Delay the actual word change to allow animation to complete
    setTimeout(() => changeWord('previous', false, false), 200);
}
export function stayWord() { changeWord('stay', false, false); }


// --- Word Actions (Blacklist/Favorite) ---
// Toggles blacklist status of displayed word (base word or rhyme)
export function toggleBlacklist() {
    const wordToToggle = ui.elements.wordDisplay?.textContent; // Act on DISPLAYED word
    if (!wordToToggle || wordToToggle === "NO WORDS!" || wordToToggle === "LOADING..." || wordToToggle === "ERROR") {
        console.warn("Cannot blacklist invalid displayed word."); return;
    }

    const wasBlacklisted = state.blacklist.has(wordToToggle);
    const wasBaseWord = wordToToggle === state.currentWord;
    
    if (wasBlacklisted) {
        state.blacklist.delete(wordToToggle); 
        ui.showFeedback(`"${wordToToggle}" un-blacklisted.`);
    } else {
        state.blacklist.add(wordToToggle); 
        ui.showFeedback(`"${wordToToggle}" blacklisted!`, true);
        if (wasBaseWord && state.currentStreak > 0) updateStreak(false);
    }
    storage.saveSettings(); // Save changes
    
    // --- Handle word advancement for blacklisting ---
    if (!wasBlacklisted && wasBaseWord) {
        // Word was just blacklisted - advance to next word immediately
        // Store current state before filtering
        const currentIndex = state.currentWordIndex;
        
        // Apply filters (this will remove the blacklisted word)
        applyFiltersAndSort();
        
        // If the filtered list is empty, show "NO WORDS!"
        if (state.filteredWordList.length === 0) {
            state.currentWord = "NO WORDS!";
            state.currentWordIndex = -1;
            state.currentRhymeList = [];
            state.currentRhymeIndex = -1;
            ui.displayWord("NO WORDS!");
            ui.showFeedback("Word list empty or fully blacklisted!", true, 3000);
            return;
        }
        
        // Advance to next word based on current word order mode
        let nextIndex;
        switch (state.wordOrderMode) {
            case 'random':
                if (state.filteredWordList.length > 1) {
                    let tempIndex;
                    do { tempIndex = Math.floor(Math.random() * state.filteredWordList.length); }
                    while (tempIndex === currentIndex && state.filteredWordList.length > 1);
                    nextIndex = tempIndex;
                } else { 
                    nextIndex = 0; 
                } 
                break;
            case 'alphabetical': 
            case 'sequential': 
            default:
                // For sequential modes, try to maintain position or move to next
                if (currentIndex >= 0 && currentIndex < state.filteredWordList.length) {
                    nextIndex = currentIndex % state.filteredWordList.length;
                } else {
                    nextIndex = 0;
                }
                break;
        }
        
        // Update state with new word
        const newWord = state.filteredWordList[nextIndex];
        const previousWord = state.currentWord;
        state.currentWordIndex = nextIndex;
        state.currentWord = newWord;
        state.lastMatchedWord = null;
        
        console.log(`Word blacklisted. Advanced to: "${state.currentWord}" (Index: ${state.currentWordIndex})`);
        
        // Fetch rhymes for new word
        state.currentRhymeList = rhyme.getValidRhymesForWord(state.currentWord);
        state.currentRhymeIndex = -1;
        
        // Update UI
        ui.displayWord(state.currentWord);
        
        // Call the word change callback if set
        if (onWordChangeCallback) {
            onWordChangeCallback(state.currentWord, previousWord);
        }
        
    } else if (wasBlacklisted && wasBaseWord) {
        // Word was just un-blacklisted - refresh current word
        applyFiltersAndSort();
        changeWord('stay', false, false);
        
    } else {
        // A rhyme was actioned - revert to base word and refresh rhymes
        console.log(`Rhyme "${wordToToggle}" actioned. Reverting display to base word "${state.currentWord}" and refreshing rhymes.`);
        applyFiltersAndSort();
        changeWord('stay', false, false);
    }
}

// Toggles favorite status of displayed word (base word or rhyme)
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
// Changes the word ordering mode (random, alphabetical, sequential)
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
// Updates user score with visual feedback
export function updateScore(points) {
    const isAddingPoints = points > 0;
    state.score += points;
    if (state.score < 0) state.score = 0;
    if (points !== 0) console.log(`Score updated by ${points}. New score: ${state.score}`);
    if (isAddingPoints) ui.updateScoreDisplay(state.score);
    else if (ui.elements.scoreDisplay) ui.elements.scoreDisplay.textContent = state.score;
}

// Updates user streak with visual feedback
export function updateStreak(increment) {
    const oldStreak = state.currentStreak;
    let grew = false;
    if (increment) { state.currentStreak++; grew = true; }
    else { if (oldStreak > 0) console.log(`Streak reset from ${oldStreak}.`); state.currentStreak = 0; }
    if (grew) console.log(`Streak updated. Current streak: ${state.currentStreak}`);
    ui.updateStreakDisplay(state.currentStreak, grew);
}

// Resets all gamification elements to zero
export function resetGamification() {
    state.score = 0; state.currentStreak = 0;
    if (ui.elements.scoreDisplay) ui.elements.scoreDisplay.textContent = state.score;
    if (ui.elements.streakDisplay) ui.elements.streakDisplay.textContent = state.currentStreak;
    console.log("Score and Streak reset.");
}

// --- Frequency Update ---
// Tracks word usage frequency from user input text
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
// Applies changes from the word list editor and updates the application state
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