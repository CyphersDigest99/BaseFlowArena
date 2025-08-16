/**
 * @fileoverview Reverse Search Module for BaseFlowArena
 * 
 * This module handles reverse search functionality, allowing users to find words
 * that end with a specific suffix. It's particularly useful for freestyle rap
 * when you want to explore different words that rhyme or end with the same pattern.
 * 
 * Example: If you're typing "BARK" and cursor is at "B", it finds words ending in "ARK"
 * like "SPARK" (shows "SP"), "DARK" (shows "D"), "SHARK" (shows "SH")
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
    cursorPosition: 0,
    inputElement: null
};

// DOM elements
let reverseSearchElements = {
    reverseSearchButton: null,
    wordCell: null,
    suggestionContainer: null
};

/**
 * Initialize the reverse search functionality
 */
export function initReverseSearch() {
    // Get DOM elements
    reverseSearchElements.reverseSearchButton = document.getElementById('reverse-search-word');
    reverseSearchElements.wordCell = document.getElementById('word-cell');
    
    console.log('Reverse search elements found:', {
        reverseSearchButton: !!reverseSearchElements.reverseSearchButton,
        wordCell: !!reverseSearchElements.wordCell
    });
    
    // Create suggestion container if it doesn't exist
    if (!document.getElementById('reverse-suggestion-container')) {
        reverseSearchElements.suggestionContainer = document.createElement('div');
        reverseSearchElements.suggestionContainer.id = 'reverse-suggestion-container';
        reverseSearchElements.suggestionContainer.className = 'reverse-suggestion-container';
        reverseSearchElements.wordCell.appendChild(reverseSearchElements.suggestionContainer);
    } else {
        reverseSearchElements.suggestionContainer = document.getElementById('reverse-suggestion-container');
    }

    if (!reverseSearchElements.reverseSearchButton || !reverseSearchElements.wordCell || 
        !reverseSearchElements.suggestionContainer) {
        console.error('Reverse search elements not found');
        return;
    }

    // Attach event listeners
    reverseSearchElements.reverseSearchButton.addEventListener('click', startReverseSearch);

    console.log('Reverse search initialized');
}

/**
 * Start reverse search mode
 */
export function startReverseSearch() {
    console.log('startReverseSearch called!');
    if (reverseSearchState.isActive) return;

    // Store current word and state
    reverseSearchState.originalWord = state.currentWord;
    reverseSearchState.isActive = true;
    reverseSearchState.currentSuffix = '';
    reverseSearchState.suggestions = [];
    reverseSearchState.selectedIndex = -1;
    reverseSearchState.cursorPosition = 0;

    // Create or get input element
    let inputElement = document.getElementById('reverse-search-input');
    if (!inputElement) {
        inputElement = document.createElement('input');
        inputElement.id = 'reverse-search-input';
        inputElement.className = 'reverse-search-input';
        inputElement.type = 'text';
        inputElement.autocomplete = 'off';
        inputElement.spellcheck = 'false';
        inputElement.placeholder = 'Type to search suffixes...';
        reverseSearchElements.wordCell.appendChild(inputElement);
    }
    
    reverseSearchState.inputElement = inputElement;

    // Set up input event listeners
    inputElement.addEventListener('input', handleReverseSearchInput);
    inputElement.addEventListener('keydown', handleReverseSearchKeydown);
    inputElement.addEventListener('blur', handleReverseSearchBlur);

    // Update UI
    reverseSearchElements.wordCell.classList.add('reverse-search-mode');
    reverseSearchElements.suggestionContainer.classList.add('active');
    
    // Clear any existing content
    inputElement.value = '';
    clearReverseSuggestions();
    
    // Focus the input
    setTimeout(() => {
        inputElement.focus();
    }, 100);

    console.log('Reverse search mode activated');
}

/**
 * Handle reverse search input changes
 */
function handleReverseSearchInput(event) {
    const suffix = event.target.value.toLowerCase().trim();
    reverseSearchState.currentSuffix = suffix;

    if (suffix.length === 0) {
        clearReverseSuggestions();
        return;
    }

    // Find words that end with the suffix
    const suggestions = state.wordList.filter(word => 
        word.toLowerCase().endsWith(suffix) && word.toLowerCase() !== suffix
    );

    reverseSearchState.suggestions = suggestions;

    if (suggestions.length > 0) {
        displayReverseSuggestions(suffix, suggestions);
        reverseSearchState.selectedIndex = 0;
    } else {
        clearReverseSuggestions();
        reverseSearchState.selectedIndex = -1;
    }
}

/**
 * Display reverse search suggestions
 */
function displayReverseSuggestions(suffix, suggestions) {
    const container = reverseSearchElements.suggestionContainer;
    container.innerHTML = '';

    suggestions.forEach((word, index) => {
        const prefix = word.substring(0, word.length - suffix.length);
        const suffixPart = word.substring(word.length - suffix.length);
        
        const suggestionElement = document.createElement('div');
        suggestionElement.className = 'reverse-suggestion';
        suggestionElement.dataset.index = index;
        suggestionElement.dataset.word = word;
        
        // Create prefix span (what would be inserted)
        const prefixSpan = document.createElement('span');
        prefixSpan.className = 'reverse-prefix';
        prefixSpan.textContent = prefix;
        
        // Create suffix span (what you're searching for)
        const suffixSpan = document.createElement('span');
        suffixSpan.className = 'reverse-suffix';
        suffixSpan.textContent = suffixPart;
        
        suggestionElement.appendChild(prefixSpan);
        suggestionElement.appendChild(suffixSpan);
        
        // Add click handler
        suggestionElement.addEventListener('click', () => {
            selectReverseSuggestion(word);
        });
        
        container.appendChild(suggestionElement);
    });

    // Highlight first suggestion
    if (suggestions.length > 0) {
        highlightReverseSuggestion(0);
    }
}

/**
 * Clear reverse search suggestions
 */
function clearReverseSuggestions() {
    const container = reverseSearchElements.suggestionContainer;
    container.innerHTML = '';
}

/**
 * Highlight a specific suggestion
 */
function highlightReverseSuggestion(index) {
    const suggestions = reverseSearchElements.suggestionContainer.querySelectorAll('.reverse-suggestion');
    
    suggestions.forEach((suggestion, i) => {
        if (i === index) {
            suggestion.classList.add('selected');
        } else {
            suggestion.classList.remove('selected');
        }
    });
}

/**
 * Handle reverse search keyboard navigation
 */
function handleReverseSearchKeydown(event) {
    switch (event.key) {
        case 'Enter':
            event.preventDefault();
            if (reverseSearchState.suggestions.length > 0 && reverseSearchState.selectedIndex >= 0) {
                const selectedWord = reverseSearchState.suggestions[reverseSearchState.selectedIndex];
                selectReverseSuggestion(selectedWord);
            }
            break;
        case 'Escape':
            event.preventDefault();
            cancelReverseSearch();
            break;
        case 'ArrowDown':
            event.preventDefault();
            navigateReverseSuggestions(1);
            break;
        case 'ArrowUp':
            event.preventDefault();
            navigateReverseSuggestions(-1);
            break;
        case 'Tab':
            event.preventDefault();
            if (reverseSearchState.suggestions.length > 0) {
                const selectedWord = reverseSearchState.suggestions[0];
                selectReverseSuggestion(selectedWord);
            }
            break;
    }
}

/**
 * Navigate through reverse suggestions
 */
function navigateReverseSuggestions(direction) {
    if (reverseSearchState.suggestions.length === 0) return;

    let newIndex = reverseSearchState.selectedIndex + direction;
    
    // Cycle through suggestions
    if (newIndex < 0) {
        newIndex = reverseSearchState.suggestions.length - 1;
    } else if (newIndex >= reverseSearchState.suggestions.length) {
        newIndex = 0;
    }
    
    reverseSearchState.selectedIndex = newIndex;
    highlightReverseSuggestion(newIndex);
}

/**
 * Select a reverse search suggestion
 */
function selectReverseSuggestion(word) {
    // Find the word in the word list and set it as current
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
 * Handle reverse search input blur
 */
function handleReverseSearchBlur() {
    setTimeout(() => {
        if (!reverseSearchState.inputElement.matches(':focus')) {
            cancelReverseSearch();
        }
    }, 100);
}

/**
 * Cancel reverse search and return to original state
 */
function cancelReverseSearch() {
    if (reverseSearchState.originalWord && reverseSearchState.originalWord !== state.currentWord) {
        // Restore original word if it's different
        const originalIndex = state.filteredWordList.indexOf(reverseSearchState.originalWord);
        if (originalIndex !== -1) {
            state.currentWord = reverseSearchState.originalWord;
            state.currentWordIndex = originalIndex;
            
            // Exit reverse search mode first
            exitReverseSearchMode();
            
            // Update display
            ui.displayWord(reverseSearchState.originalWord);
            
            // Force refresh rhyme navigation buttons
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
    reverseSearchState.cursorPosition = 0;

    // Update UI
    reverseSearchElements.wordCell.classList.remove('reverse-search-mode');
    reverseSearchElements.suggestionContainer.classList.remove('active');
    
    // Remove input element
    if (reverseSearchState.inputElement) {
        reverseSearchState.inputElement.remove();
        reverseSearchState.inputElement = null;
    }
    
    clearReverseSuggestions();

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