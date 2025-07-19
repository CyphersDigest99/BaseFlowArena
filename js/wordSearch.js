/**
 * @fileoverview Word Search Module for BaseFlowArena
 * 
 * This module handles the word search functionality, allowing users to manually
 * search through the word list and select specific words. It integrates with the
 * existing word management system and maintains all the relationships between
 * words, rhymes, and navigation.
 */

import { state } from './state.js';
import * as ui from './ui.js';
import * as wordManager from './wordManager.js';
import * as rhyme from './rhyme.js';

// Search state
let searchState = {
    isActive: false,
    currentQuery: '',
    suggestions: [],
    selectedIndex: -1,
    originalWord: ''
};

// DOM elements
let searchElements = {
    searchButton: null,
    searchInput: null,
    searchAutocomplete: null,
    searchContainer: null,
    wordCell: null
};

/**
 * Initialize the search functionality
 */
export function initSearch() {
    // Get DOM elements
    searchElements.searchButton = document.getElementById('search-word');
    searchElements.searchInput = document.getElementById('search-input');
    searchElements.searchAutocomplete = document.getElementById('search-autocomplete');
    searchElements.searchContainer = document.getElementById('search-input-container');
    searchElements.wordCell = document.getElementById('word-cell');

    if (!searchElements.searchButton || !searchElements.searchInput || 
        !searchElements.searchAutocomplete || !searchElements.searchContainer || 
        !searchElements.wordCell) {
        console.error('Search elements not found');
        return;
    }

    // Attach event listeners
    searchElements.searchButton.addEventListener('click', startSearch);
    searchElements.searchInput.addEventListener('input', handleSearchInput);
    searchElements.searchInput.addEventListener('keydown', handleSearchKeydown);
    searchElements.searchInput.addEventListener('blur', handleSearchBlur);

    console.log('Word search initialized');
}

/**
 * Start search mode
 */
function startSearch() {
    if (searchState.isActive) return;

    // Store current word
    searchState.originalWord = state.currentWord;
    searchState.isActive = true;
    searchState.currentQuery = '';
    searchState.suggestions = [];
    searchState.selectedIndex = -1;

    // Update UI
    searchElements.wordCell.classList.add('search-mode');
    searchElements.searchContainer.classList.add('active');
    searchElements.searchInput.value = '';
    searchElements.searchAutocomplete.textContent = '';
    
    // Show subtle instructions
    searchElements.searchInput.placeholder = 'Type to search...';
    
    // Set initial font size for search input
    adjustSearchFontSize();
    
    // Focus the input
    setTimeout(() => {
        searchElements.searchInput.focus();
    }, 100);

    console.log('Search mode activated');
}

/**
 * Handle search input changes
 */
function handleSearchInput(event) {
    const query = event.target.value.toLowerCase().trim();
    searchState.currentQuery = query;

    // Remove placeholder instructions as soon as user starts typing
    if (query.length > 0) {
        searchElements.searchInput.placeholder = '';
    }

    if (query.length === 0) {
        searchElements.searchAutocomplete.textContent = '';
        searchState.suggestions = [];
        searchState.selectedIndex = -1;
        return;
    }

    // Find matching words from the complete word list (ignores filters for search)
    const suggestions = state.wordList.filter(word => 
        word.toLowerCase().startsWith(query)
    ).slice(0, 10); // Limit to 10 suggestions for arrow navigation

    searchState.suggestions = suggestions;

    if (suggestions.length > 0) {
        // Show first suggestion as autocomplete
        const firstSuggestion = suggestions[0];
        const remainingPart = firstSuggestion.substring(query.length);
        searchElements.searchAutocomplete.textContent = remainingPart;
        searchState.selectedIndex = 0;
        
        // Position autocomplete at the cursor position
        positionAutocomplete();
    } else {
        searchElements.searchAutocomplete.textContent = '';
        searchState.selectedIndex = -1;
    }

    // Adjust font size for the input to match word display behavior
    adjustSearchFontSize();
}

/**
 * Position the autocomplete text at the cursor position
 */
function positionAutocomplete() {
    const input = searchElements.searchInput;
    const autocomplete = searchElements.searchAutocomplete;
    
    if (!input || !autocomplete) return;
    
    // Create a temporary span to measure the input text width
    const tempSpan = document.createElement('span');
    tempSpan.style.font = window.getComputedStyle(input).font;
    tempSpan.style.visibility = 'hidden';
    tempSpan.style.position = 'absolute';
    tempSpan.style.whiteSpace = 'nowrap';
    tempSpan.textContent = input.value;
    document.body.appendChild(tempSpan);
    
    // Calculate the width of the input text
    const inputTextWidth = tempSpan.offsetWidth;
    document.body.removeChild(tempSpan);
    
    // Position autocomplete to the right of the cursor (center of input)
    const containerWidth = searchElements.wordCell.offsetWidth;
    const centerPosition = containerWidth / 2;
    const leftPosition = centerPosition + (inputTextWidth / 2);
    
    autocomplete.style.left = leftPosition + 'px';
    autocomplete.style.transform = 'none';
    
    console.log('Positioning autocomplete:', {
        inputText: input.value,
        inputWidth: inputTextWidth,
        containerWidth: containerWidth,
        centerPosition: centerPosition,
        leftPosition: leftPosition
    });
}

/**
 * Handle keyboard navigation in search
 */
function handleSearchKeydown(event) {
    switch (event.key) {
        case 'Enter':
            event.preventDefault();
            confirmSearch();
            break;
        case 'Escape':
            event.preventDefault();
            cancelSearch();
            break;
        case 'ArrowDown':
            event.preventDefault();
            navigateSuggestions(1);
            break;
        case 'ArrowUp':
            event.preventDefault();
            navigateSuggestions(-1);
            break;
        case 'Tab':
            event.preventDefault();
            if (searchState.suggestions.length > 0) {
                // Complete with first suggestion
                searchElements.searchInput.value = searchState.suggestions[0];
                searchState.currentQuery = searchState.suggestions[0];
                searchElements.searchAutocomplete.textContent = '';
            }
            break;
    }
}

/**
 * Navigate through suggestions with arrow keys (alphabetically)
 */
function navigateSuggestions(direction) {
    if (searchState.suggestions.length === 0) return;

    const newIndex = searchState.selectedIndex + direction;
    if (newIndex >= 0 && newIndex < searchState.suggestions.length) {
        searchState.selectedIndex = newIndex;
        const selectedSuggestion = searchState.suggestions[newIndex];
        const remainingPart = selectedSuggestion.substring(searchState.currentQuery.length);
        searchElements.searchAutocomplete.textContent = remainingPart;
        
        // Reposition autocomplete
        positionAutocomplete();
    }
}

/**
 * Handle search input blur
 */
function handleSearchBlur() {
    // Small delay to allow for clicking on suggestions
    setTimeout(() => {
        if (!searchElements.searchInput.matches(':focus')) {
            cancelSearch();
        }
    }, 100);
}

/**
 * Confirm the search and set the selected word
 */
function confirmSearch() {
    let selectedWord = searchState.currentQuery;

    // If we have suggestions and one is selected, use that
    if (searchState.suggestions.length > 0 && searchState.selectedIndex >= 0) {
        selectedWord = searchState.suggestions[searchState.selectedIndex];
    }

    // Validate the word exists in our word list
    if (!state.wordList.includes(selectedWord)) {
        ui.showFeedback(`"${selectedWord}" not found in word list!`, true, 2000);
        return;
    }

    // Find the word in the word list and set it as current
    const wordIndex = state.wordList.indexOf(selectedWord);
    if (wordIndex !== -1) {
        // Update state
        state.currentWord = selectedWord;
        state.currentWordIndex = wordIndex;
        
        // Clear rhyme state since we're changing the base word
        state.currentRhymeList = [];
        state.currentRhymeIndex = -1;

        // Exit search mode first to restore normal display
        exitSearchMode();
        
        // Update display after search mode is exited
        ui.displayWord(selectedWord);
        
        // Load rhymes for the new word (this is what was missing!)
        state.currentRhymeList = rhyme.getValidRhymesForWord(selectedWord);
        state.currentRhymeIndex = -1;
        
        // Force refresh rhyme navigation buttons
        ui.updateRhymeNavButtons();
        
        // Update tooltips if they're active
        if (typeof updateTooltipForDisplayedWord === 'function') {
            updateTooltipForDisplayedWord();
        }

        ui.showFeedback(`Selected: "${selectedWord}"`, false, 1500);
    } else {
        exitSearchMode();
    }
}

/**
 * Cancel search and return to original state
 */
function cancelSearch() {
    if (searchState.originalWord && searchState.originalWord !== state.currentWord) {
        // Restore original word if it's different
        const originalIndex = state.filteredWordList.indexOf(searchState.originalWord);
        if (originalIndex !== -1) {
            state.currentWord = searchState.originalWord;
            state.currentWordIndex = originalIndex;
            
            // Exit search mode first
            exitSearchMode();
            
            // Update display after search mode is exited
            ui.displayWord(searchState.originalWord);
            
            // Force refresh rhyme navigation buttons
            setTimeout(() => {
                ui.updateRhymeNavButtons();
            }, 50);
        } else {
            exitSearchMode();
        }
    } else {
        exitSearchMode();
    }
}

/**
 * Exit search mode and clean up
 */
function exitSearchMode() {
    searchState.isActive = false;
    searchState.currentQuery = '';
    searchState.suggestions = [];
    searchState.selectedIndex = -1;
    searchState.originalWord = '';

    // Update UI
    searchElements.wordCell.classList.remove('search-mode');
    searchElements.searchContainer.classList.remove('active');
    searchElements.searchInput.value = '';
    searchElements.searchInput.placeholder = ''; // Clear placeholder
    searchElements.searchAutocomplete.textContent = '';
    searchElements.searchInput.blur();

    console.log('Search mode deactivated');
}

/**
 * Adjust font size for search input to match word display behavior
 */
function adjustSearchFontSize() {
    const input = searchElements.searchInput;
    const container = searchElements.wordCell;
    
    if (!input || !container) return;

    console.log('=== adjustSearchFontSize called ===');
    console.log('Setting font size to 3.2em');

    const maxWidth = container.offsetWidth - 80; // More padding for action buttons and autocomplete
    const maxHeight = container.offsetHeight - 20; // More generous vertical padding allowance
    
    // Start with base font size (halfway between large and small, favoring smaller)
    let fontSize = 3.2; // Halfway between large and small, favoring smaller
    input.style.fontSize = fontSize + 'em !important';
    searchElements.searchAutocomplete.style.fontSize = fontSize + 'em !important';
    
    console.log('Font size set to:', input.style.fontSize);
    console.log('Computed font size:', window.getComputedStyle(input).fontSize);
    
    // Reduce font size until it fits (same logic as word display)
    while ((input.scrollWidth > maxWidth || input.scrollHeight > maxHeight) && fontSize > 1) {
        fontSize -= 0.1;
        input.style.fontSize = fontSize + 'em !important';
        searchElements.searchAutocomplete.style.fontSize = fontSize + 'em !important';
    }
    
    // Ensure autocomplete is positioned correctly after font size change
    positionAutocomplete();
    
    console.log('Final font size:', input.style.fontSize);
    console.log('Final computed font size:', window.getComputedStyle(input).fontSize);
    console.log('=== adjustSearchFontSize complete ===');
}

/**
 * Check if search mode is currently active
 */
export function isSearchActive() {
    return searchState.isActive;
}

/**
 * Force exit search mode (for external use)
 */
export function forceExitSearch() {
    if (searchState.isActive) {
        exitSearchMode();
    }
} 