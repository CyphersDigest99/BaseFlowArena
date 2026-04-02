/**
 * @fileoverview Reverse Search Module for BaseFlowArena
 *
 * This module handles reverse search functionality, allowing users to find words
 * that end with a specific suffix. Works like the normal search but in reverse -
 * user types a suffix and sees autocomplete for the prefix.
 *
 * Example: User types "ice" → autocomplete shows "pr" → full word is "price"
 */

import { state } from './state.js';
import * as ui from './ui.js';
import * as wordManager from './wordManager.js';
import * as rhyme from './rhyme.js';
import * as storage from './storage.js';

// Reverse search state
let reverseSearchState = {
    isActive: false,
    currentSuffix: '',
    suggestions: [],
    selectedIndex: -1,
    originalWord: '',
    lastDirection: 'top' // Track navigation direction for flip animation
};

// DOM elements
let reverseSearchElements = {
    reverseSearchButton: null,
    reverseSearchInput: null,
    reverseSearchAutocomplete: null,
    reverseSearchContainer: null,
    wordCell: null,
    suggestionList: null
};

/**
 * Initialize the reverse search functionality
 */
export function initReverseSearch() {
    // Get DOM elements
    reverseSearchElements.reverseSearchButton = document.getElementById('reverse-search-word');
    reverseSearchElements.reverseSearchInput = document.getElementById('reverse-search-input');
    reverseSearchElements.reverseSearchAutocomplete = document.getElementById('reverse-search-autocomplete');
    reverseSearchElements.reverseSearchContainer = document.getElementById('reverse-search-container');
    reverseSearchElements.wordCell = document.getElementById('word-cell');

    if (!reverseSearchElements.reverseSearchButton || !reverseSearchElements.reverseSearchInput ||
        !reverseSearchElements.reverseSearchAutocomplete || !reverseSearchElements.reverseSearchContainer ||
        !reverseSearchElements.wordCell) {
        console.error('Reverse search elements not found');
        return;
    }

    // Create suggestion list container
    reverseSearchElements.suggestionList = document.createElement('div');
    reverseSearchElements.suggestionList.className = 'suggestion-list reverse';
    reverseSearchElements.suggestionList.id = 'reverse-search-suggestion-list';
    reverseSearchElements.reverseSearchContainer.appendChild(reverseSearchElements.suggestionList);

    // Attach event listeners
    reverseSearchElements.reverseSearchButton.addEventListener('click', startReverseSearch);
    reverseSearchElements.reverseSearchInput.addEventListener('input', handleReverseSearchInput);
    reverseSearchElements.reverseSearchInput.addEventListener('keydown', handleReverseSearchKeydown);
    reverseSearchElements.reverseSearchInput.addEventListener('blur', handleReverseSearchBlur);

    console.log('Reverse search initialized');
}

/**
 * Start reverse search mode
 */
export function startReverseSearch() {
    if (reverseSearchState.isActive) return;

    // Store current word
    reverseSearchState.originalWord = state.currentWord;
    reverseSearchState.isActive = true;
    reverseSearchState.currentSuffix = '';
    reverseSearchState.suggestions = [];
    reverseSearchState.selectedIndex = -1;

    // Update UI
    reverseSearchElements.wordCell.classList.add('reverse-search-mode');
    reverseSearchElements.reverseSearchContainer.classList.add('active');
    reverseSearchElements.reverseSearchInput.value = '';
    reverseSearchElements.reverseSearchInput.classList.remove('has-content');
    reverseSearchElements.reverseSearchAutocomplete.textContent = '';
    clearReverseSearchBorder();

    // Show subtle instructions
    reverseSearchElements.reverseSearchInput.placeholder = 'Type suffix...';

    // Hide any existing suggestions
    hideAllReverseSuggestions();

    // Set initial input width
    positionReverseAutocomplete();

    // Focus the input
    setTimeout(() => {
        reverseSearchElements.reverseSearchInput.focus();
    }, 100);

    console.log('Reverse search mode activated');
}

/**
 * Handle reverse search input changes
 */
function handleReverseSearchInput(event) {
    const suffix = event.target.value.toLowerCase().trim();
    reverseSearchState.currentSuffix = suffix;

    // Toggle has-content class for styling
    if (suffix.length > 0) {
        reverseSearchElements.reverseSearchInput.classList.add('has-content');
        reverseSearchElements.reverseSearchInput.placeholder = '';
    } else {
        reverseSearchElements.reverseSearchInput.classList.remove('has-content');
    }

    if (suffix.length === 0) {
        reverseSearchElements.reverseSearchAutocomplete.textContent = '';
        reverseSearchState.suggestions = [];
        reverseSearchState.selectedIndex = -1;
        clearReverseSearchBorder();
        hideAllReverseSuggestions();
        hideReverseSuggestionList();
        positionReverseAutocomplete();
        return;
    }

    // Find words that end with the suffix
    const suggestions = state.wordList.filter(word =>
        word.toLowerCase().endsWith(suffix) && word.toLowerCase() !== suffix
    );

    reverseSearchState.suggestions = suggestions;

    if (suggestions.length > 0) {
        // Show first suggestion's prefix as autocomplete
        const firstSuggestion = suggestions[0];
        const prefix = firstSuggestion.substring(0, firstSuggestion.length - suffix.length);
        reverseSearchElements.reverseSearchAutocomplete.textContent = prefix;
        reverseSearchState.selectedIndex = 0;

        // Render the visible suggestion list
        renderReverseSuggestionList();

        // Check if the exact suffix exists as a word in the list
        const exactMatch = state.wordList.some(w => w.toLowerCase() === suffix);
        updateReverseSearchBorder(exactMatch);

        // If the typed suffix doesn't exist as a word, show dual suggestions
        if (!exactMatch) {
            showDualReverseSuggestion(suffix, firstSuggestion);
        } else {
            // Suffix exists as a word, show that it can be selected
            hideAllReverseSuggestions();
        }

        // Position autocomplete
        positionReverseAutocomplete();
    } else if (suffix.length > 0) {
        // No suggestions found - clear autocomplete
        reverseSearchElements.reverseSearchAutocomplete.textContent = '';
        reverseSearchState.selectedIndex = -1;

        // Hide suggestion list
        hideReverseSuggestionList();

        // Check if the suffix itself exists as a word
        const exactMatch = state.wordList.some(w => w.toLowerCase() === suffix);
        updateReverseSearchBorder(exactMatch);

        if (exactMatch) {
            hideAllReverseSuggestions();
        } else {
            // Show option to add as new word
            hideAllReverseSuggestions();
            showReverseEnterSuggestion(suffix);
        }

        positionReverseAutocomplete();
    }
}

/**
 * Position the autocomplete text before the input
 * Now handled by CSS flexbox - this function just adjusts input width
 */
function positionReverseAutocomplete() {
    const input = reverseSearchElements.reverseSearchInput;
    if (!input) return;

    // Auto-size the input based on content
    // Create a temporary span to measure text width
    const tempSpan = document.createElement('span');
    tempSpan.style.fontSize = window.getComputedStyle(input).fontSize;
    tempSpan.style.fontFamily = window.getComputedStyle(input).fontFamily;
    tempSpan.style.fontWeight = window.getComputedStyle(input).fontWeight;
    tempSpan.style.visibility = 'hidden';
    tempSpan.style.position = 'absolute';
    tempSpan.style.whiteSpace = 'pre';
    tempSpan.textContent = input.value || input.placeholder || 'W';
    document.body.appendChild(tempSpan);

    const textWidth = tempSpan.offsetWidth;
    document.body.removeChild(tempSpan);

    // Set input width to match content (with small padding)
    input.style.width = Math.max(textWidth + 5, 20) + 'px';
}

/**
 * Update the reverse search border based on word existence
 */
function updateReverseSearchBorder(wordExists) {
    const container = reverseSearchElements.reverseSearchContainer;
    if (!container) return;

    // Remove existing border classes
    container.classList.remove('word-found', 'word-not-found');

    // Add appropriate border class
    if (wordExists) {
        container.classList.add('word-found');
    } else {
        container.classList.add('word-not-found');
    }
}

/**
 * Clear the reverse search border
 */
function clearReverseSearchBorder() {
    const container = reverseSearchElements.reverseSearchContainer;
    if (!container) return;

    container.classList.remove('word-found', 'word-not-found');
}

/**
 * Handle keyboard navigation in reverse search
 */
function handleReverseSearchKeydown(event) {
    switch (event.key) {
        case 'Tab':
            event.preventDefault();
            // Tab accepts the autocomplete suggestion (full word with prefix)
            if (reverseSearchState.suggestions.length > 0) {
                const selectedSuggestion = reverseSearchState.suggestions[reverseSearchState.selectedIndex >= 0 ? reverseSearchState.selectedIndex : 0];
                selectReverseWord(selectedSuggestion);
            }
            break;
        case 'Enter':
            event.preventDefault();
            // Enter submits what you typed (the suffix, or adds as new word)
            const typedSuffix = reverseSearchState.currentSuffix.trim();
            if (typedSuffix.length >= 2) {
                // Check if typed suffix exists as a word
                const existingWord = state.wordList.find(w => w.toLowerCase() === typedSuffix);
                if (existingWord) {
                    selectReverseWord(existingWord);
                } else if (reverseSearchState.suggestions.length > 0) {
                    // Select first suggestion if suffix doesn't exist as word
                    const selectedSuggestion = reverseSearchState.suggestions[reverseSearchState.selectedIndex >= 0 ? reverseSearchState.selectedIndex : 0];
                    selectReverseWord(selectedSuggestion);
                } else {
                    // No matches - could add as new word
                    addNewWordFromReverse(typedSuffix);
                }
            } else if (reverseSearchState.suggestions.length > 0) {
                // Fallback: if typed suffix too short but suggestions exist
                const selectedSuggestion = reverseSearchState.suggestions[reverseSearchState.selectedIndex >= 0 ? reverseSearchState.selectedIndex : 0];
                selectReverseWord(selectedSuggestion);
            }
            break;
        case 'Escape':
            event.preventDefault();
            cancelReverseSearch();
            break;
        case 'Backspace':
            // Close search if no letters typed
            if (reverseSearchState.currentSuffix.length === 0) {
                event.preventDefault();
                cancelReverseSearch();
            }
            break;
        case 'ArrowDown':
            event.preventDefault();
            navigateReverseSuggestions(1);
            break;
        case 'ArrowUp':
            event.preventDefault();
            navigateReverseSuggestions(-1);
            break;
        case 'ArrowLeft':
            event.preventDefault();
            navigateSuffixExpand();
            break;
        case 'ArrowRight':
            event.preventDefault();
            navigateSuffixShrink();
            break;
    }
}

/**
 * Navigate through suggestions with arrow keys
 */
function navigateReverseSuggestions(direction) {
    if (reverseSearchState.suggestions.length === 0) return;

    // Track direction for flip animation (direction: 1 = down, -1 = up)
    reverseSearchState.lastDirection = direction > 0 ? 'top' : 'bottom';

    let newIndex = reverseSearchState.selectedIndex + direction;

    // Cycle continuously through the suggestions
    if (newIndex < 0) {
        newIndex = reverseSearchState.suggestions.length - 1;
    } else if (newIndex >= reverseSearchState.suggestions.length) {
        newIndex = 0;
    }

    reverseSearchState.selectedIndex = newIndex;
    const selectedSuggestion = reverseSearchState.suggestions[newIndex];
    const suffix = reverseSearchState.currentSuffix;
    const prefix = selectedSuggestion.substring(0, selectedSuggestion.length - suffix.length);
    reverseSearchElements.reverseSearchAutocomplete.textContent = prefix;

    // Render the visible suggestion list
    renderReverseSuggestionList();

    // Update the dual suggestion to show new word
    const exactMatch = state.wordList.some(w => w.toLowerCase() === suffix);
    if (!exactMatch) {
        showDualReverseSuggestion(suffix, selectedSuggestion);
    }

    // Reposition autocomplete
    positionReverseAutocomplete();
}

/**
 * Render the visible suggestion list with fade effect for reverse search
 * Shows 2 items above, selected item, and 2 items below
 */
function renderReverseSuggestionList() {
    const list = reverseSearchElements.suggestionList;
    if (!list) return;

    const suggestions = reverseSearchState.suggestions;
    const selectedIndex = reverseSearchState.selectedIndex;
    const suffix = reverseSearchState.currentSuffix;

    // Clear existing items
    list.innerHTML = '';

    if (suggestions.length === 0 || selectedIndex < 0) {
        list.style.display = 'none';
        return;
    }

    list.style.display = 'flex';

    // Hide the single-word autocomplete and input text since the list shows full words
    reverseSearchElements.reverseSearchAutocomplete.style.visibility = 'hidden';
    reverseSearchElements.reverseSearchInput.style.color = 'transparent';
    reverseSearchElements.reverseSearchInput.style.caretColor = 'transparent';
    reverseSearchElements.reverseSearchInput.style.textShadow = 'none';

    // Build visible items: 2 above, selected, 2 below (5 total)
    const visibleCount = 5;
    const halfVisible = Math.floor(visibleCount / 2);

    let prevIdx = null;
    for (let offset = -halfVisible; offset <= halfVisible; offset++) {
        // Calculate wrapped index
        let idx = selectedIndex + offset;
        const len = suggestions.length;
        idx = ((idx % len) + len) % len; // proper modulo for negative numbers

        const word = suggestions[idx];
        const item = document.createElement('div');
        item.className = 'suggestion-item';

        // Detect wrap-around: if index jumps backward, we've wrapped from end to start
        if (prevIdx !== null && idx < prevIdx) {
            item.classList.add('list-seam');
        }
        prevIdx = idx;

        // Apply fade based on distance from center
        const distance = Math.abs(offset);
        const isSelected = distance === 0;

        // For reverse search: prefix is autocomplete, suffix is typed
        const suffixLength = suffix.length;

        if (isSelected) {
            item.classList.add('selected');
            item.classList.add(reverseSearchState.lastDirection === 'top' ? 'flip-from-top' : 'flip-from-bottom');
            word.split('').forEach((letter, i) => {
                const span = document.createElement('span');
                span.textContent = letter;
                span.className = `flip-letter ${i >= (word.length - suffixLength) ? 'typed-part' : 'autocomplete-part'}`;
                item.appendChild(span);
            });
        } else {
            const pre = document.createElement('span');
            pre.className = 'autocomplete-part';
            pre.textContent = word.substring(0, word.length - suffixLength);
            const suf = document.createElement('span');
            suf.className = 'typed-part';
            suf.textContent = word.substring(word.length - suffixLength);
            item.appendChild(pre);
            item.appendChild(suf);

            if (distance === 1) {
                item.classList.add('fade-1');
            } else {
                item.classList.add('fade-2');
            }
        }

        list.appendChild(item);
    }
}

/**
 * Hide the reverse suggestion list
 */
function hideReverseSuggestionList() {
    if (reverseSearchElements.suggestionList) {
        reverseSearchElements.suggestionList.style.display = 'none';
        reverseSearchElements.suggestionList.innerHTML = '';
    }
    // Restore autocomplete and input visibility
    if (reverseSearchElements.reverseSearchAutocomplete) {
        reverseSearchElements.reverseSearchAutocomplete.style.visibility = 'visible';
    }
    if (reverseSearchElements.reverseSearchInput) {
        reverseSearchElements.reverseSearchInput.style.color = '';
        reverseSearchElements.reverseSearchInput.style.caretColor = '';
        reverseSearchElements.reverseSearchInput.style.textShadow = '';
    }
}

/**
 * Expand suffix by taking the last letter from the prefix (Arrow Left)
 * Example: suffix "ice", prefix "adv" (advice) → suffix "vice", prefix "ad"
 */
function navigateSuffixExpand() {
    if (reverseSearchState.suggestions.length === 0) return;

    const currentSuggestion = reverseSearchState.suggestions[reverseSearchState.selectedIndex >= 0 ? reverseSearchState.selectedIndex : 0];
    const currentSuffix = reverseSearchState.currentSuffix;

    // Get the prefix for the current suggestion
    const prefix = currentSuggestion.substring(0, currentSuggestion.length - currentSuffix.length);

    // Check if we can expand (prefix has at least one letter)
    if (prefix.length > 0) {
        // Take the last letter of the prefix and prepend it to the suffix
        const lastPrefixLetter = prefix[prefix.length - 1];
        const newSuffix = lastPrefixLetter + currentSuffix;

        // Update the input value
        reverseSearchElements.reverseSearchInput.value = newSuffix;
        reverseSearchState.currentSuffix = newSuffix;

        // Trigger input event to update suggestions
        const inputEvent = new Event('input', { bubbles: true });
        reverseSearchElements.reverseSearchInput.dispatchEvent(inputEvent);
    }
}

/**
 * Shrink suffix by removing the first letter (Arrow Right)
 * Example: suffix "ice" → suffix "ce"
 */
function navigateSuffixShrink() {
    const currentSuffix = reverseSearchState.currentSuffix;

    // Only allow shrinking if we have more than one character
    if (currentSuffix.length > 1) {
        // Remove the first letter
        const newSuffix = currentSuffix.slice(1);

        // Update the input value
        reverseSearchElements.reverseSearchInput.value = newSuffix;
        reverseSearchState.currentSuffix = newSuffix;

        // Trigger input event to update suggestions
        const inputEvent = new Event('input', { bubbles: true });
        reverseSearchElements.reverseSearchInput.dispatchEvent(inputEvent);
    }
}

/**
 * Select a word from reverse search
 */
function selectReverseWord(word) {
    const wordIndex = state.wordList.indexOf(word);
    if (wordIndex !== -1) {
        // Update state
        state.currentWord = word;
        state.currentWordIndex = wordIndex;

        // Clear rhyme state since we're changing the base word
        state.currentRhymeList = [];
        state.currentRhymeIndex = -1;

        // Exit reverse search mode first
        exitReverseSearchMode();

        // Update display
        ui.displayWord(word);

        // Load rhymes for the new word
        state.currentRhymeList = rhyme.getValidRhymesForWord(word);
        state.currentRhymeIndex = -1;

        // Force refresh rhyme navigation buttons
        ui.updateRhymeNavButtons();

        // Update tooltips if they're active
        if (typeof updateTooltipForDisplayedWord === 'function') {
            updateTooltipForDisplayedWord();
        }

        ui.showFeedback(`Selected: "${word}"`, false, 1500);
    } else {
        exitReverseSearchMode();
    }
}

/**
 * Add a new word from reverse search
 */
function addNewWordFromReverse(word) {
    const trimmedWord = word.trim().toLowerCase();
    if (!trimmedWord || trimmedWord.length < 2) {
        ui.showFeedback('Word must be at least 2 characters long', true, 2000);
        return;
    }

    // Check if word already exists
    if (state.wordList.some(existingWord => existingWord.toLowerCase() === trimmedWord)) {
        ui.showFeedback(`"${word}" already exists in the word list`, true, 2000);
        return;
    }

    // Add word to the word list
    state.wordList.push(word);
    state.wordList.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    wordManager.applyFiltersAndSort();
    storage.saveSettings();

    // Find and select the newly added word
    const wordIndex = state.wordList.indexOf(word);
    if (wordIndex !== -1) {
        state.currentWord = word;
        state.currentWordIndex = wordIndex;
        state.currentRhymeList = [];
        state.currentRhymeIndex = -1;

        exitReverseSearchMode();
        ui.displayWord(word);
        state.currentRhymeList = rhyme.getValidRhymesForWord(word);
        state.currentRhymeIndex = -1;
        ui.updateRhymeNavButtons();

        ui.showFeedback(`Added and selected: "${word}"`, false, 2000);
        state.manualWordsAdded++;

        console.log(`New word added: "${word}". Total words: ${state.wordList.length}`);
    } else {
        exitReverseSearchMode();
        ui.showFeedback(`Error adding word: "${word}"`, true, 2000);
    }
}

/**
 * Show the "Press Enter for [word]" message for reverse search
 */
function showReverseEnterSuggestion(word) {
    let enterSuggestion = document.getElementById('reverse-enter-suggestion');
    if (!enterSuggestion) {
        enterSuggestion = document.createElement('div');
        enterSuggestion.id = 'reverse-enter-suggestion';
        enterSuggestion.className = 'enter-suggestion';
        reverseSearchElements.reverseSearchContainer.appendChild(enterSuggestion);
    } else {
        enterSuggestion.className = 'enter-suggestion';
    }

    enterSuggestion.textContent = `Press Enter to add "${word}"`;
    enterSuggestion.style.display = 'block';
}

/**
 * Show dual suggestions for reverse search
 */
function showDualReverseSuggestion(suffix, suggestion) {
    // Create or update the tab suggestion element (left) - GREEN BOX
    let tabSuggestion = document.getElementById('reverse-tab-suggestion');
    if (!tabSuggestion) {
        tabSuggestion = document.createElement('div');
        tabSuggestion.id = 'reverse-tab-suggestion';
        tabSuggestion.className = 'tab-suggestion dual-left';
        reverseSearchElements.reverseSearchContainer.appendChild(tabSuggestion);
    } else {
        tabSuggestion.className = 'tab-suggestion dual-left';
    }

    // Create or update the enter suggestion element (right) - ORANGE BOX
    let enterSuggestion = document.getElementById('reverse-enter-suggestion');
    if (!enterSuggestion) {
        enterSuggestion = document.createElement('div');
        enterSuggestion.id = 'reverse-enter-suggestion';
        enterSuggestion.className = 'enter-suggestion dual-right';
        reverseSearchElements.reverseSearchContainer.appendChild(enterSuggestion);
    } else {
        enterSuggestion.className = 'enter-suggestion dual-right';
    }

    // Tab accepts the full word (suggestion), Enter would add suffix as new word
    tabSuggestion.textContent = `Tab for "${suggestion}"`;
    enterSuggestion.textContent = `Enter to add "${suffix}"`;
    tabSuggestion.style.display = 'block';
    enterSuggestion.style.display = 'block';
}

/**
 * Hide all reverse suggestion messages
 */
function hideAllReverseSuggestions() {
    const enterSuggestion = document.getElementById('reverse-enter-suggestion');
    const tabSuggestion = document.getElementById('reverse-tab-suggestion');

    if (enterSuggestion) {
        enterSuggestion.style.display = 'none';
    }
    if (tabSuggestion) {
        tabSuggestion.style.display = 'none';
    }
}

/**
 * Handle reverse search input blur
 */
function handleReverseSearchBlur() {
    setTimeout(() => {
        if (!reverseSearchElements.reverseSearchInput.matches(':focus')) {
            cancelReverseSearch();
        }
    }, 150);
}

/**
 * Cancel reverse search and return to original state
 */
function cancelReverseSearch() {
    if (reverseSearchState.originalWord && reverseSearchState.originalWord !== state.currentWord) {
        const originalIndex = state.filteredWordList.indexOf(reverseSearchState.originalWord);
        if (originalIndex !== -1) {
            state.currentWord = reverseSearchState.originalWord;
            state.currentWordIndex = originalIndex;

            exitReverseSearchMode();
            ui.displayWord(reverseSearchState.originalWord);

            setTimeout(() => {
                ui.updateRhymeNavButtons();
            }, 50);
        } else {
            exitReverseSearchMode();
        }
    } else {
        exitReverseSearchMode();
    }
}

/**
 * Exit reverse search mode and clean up
 */
function exitReverseSearchMode() {
    reverseSearchState.isActive = false;
    reverseSearchState.currentSuffix = '';
    reverseSearchState.suggestions = [];
    reverseSearchState.selectedIndex = -1;
    reverseSearchState.originalWord = '';

    // Update UI
    reverseSearchElements.wordCell.classList.remove('reverse-search-mode');
    reverseSearchElements.reverseSearchContainer.classList.remove('active');
    reverseSearchElements.reverseSearchInput.value = '';
    reverseSearchElements.reverseSearchInput.placeholder = '';
    reverseSearchElements.reverseSearchAutocomplete.textContent = '';
    clearReverseSearchBorder();
    hideAllReverseSuggestions();
    hideReverseSuggestionList(); // Hide the suggestion list
    reverseSearchElements.reverseSearchInput.blur();

    console.log('Reverse search mode deactivated');
}

/**
 * Check if reverse search mode is currently active
 */
export function isReverseSearchActive() {
    return reverseSearchState.isActive;
}

/**
 * Force exit reverse search mode (for external use)
 */
export function forceExitReverseSearch() {
    if (reverseSearchState.isActive) {
        exitReverseSearchMode();
    }
}

/**
 * Alias for startReverseSearch (for backwards compatibility with main.js)
 */
export const startSearch = startReverseSearch;
