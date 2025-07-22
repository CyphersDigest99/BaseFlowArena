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
import * as storage from './storage.js';
import * as modal from './modal.js';

// Search state
let searchState = {
    isActive: false,
    currentQuery: '',
    suggestions: [],
    selectedIndex: -1,
    originalWord: '',
    canAddWord: false,
    isReverseMode: false // Added reverse mode state
};

// DOM elements
let searchElements = {
    searchButton: null,
    searchInput: null,
    searchAutocomplete: null,
    searchContainer: null,
    wordCell: null,
    searchPrefixSpan: null // Add reference for prefix span
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
    // Add Alt+S keyup event for reverse mode toggle
    searchElements.searchInput.addEventListener('keyup', function(event) {
        if (event.altKey && (event.key === 's' || event.key === 'S')) {
            toggleReverseMode();
        }
    });

    console.log('Word search initialized');
}

/**
 * Start search mode
 */
export function startSearch() {
    if (searchState.isActive) return;

    // Store current word
    searchState.originalWord = state.currentWord;
    searchState.isActive = true;
    searchState.currentQuery = '';
    searchState.suggestions = [];
    searchState.selectedIndex = -1;
    searchState.canAddWord = false;

    // Update UI
    searchElements.wordCell.classList.add('search-mode');
    searchElements.searchContainer.classList.add('active');
    searchElements.searchInput.value = '';
    searchElements.searchAutocomplete.textContent = '';
    clearSearchBorder();
    
    // Insert prefix span if not present
    if (!searchElements.searchPrefixSpan) {
        const prefixSpan = document.createElement('span');
        prefixSpan.id = 'search-prefix-span';
        prefixSpan.style.opacity = '0';
        prefixSpan.style.transition = 'opacity 0.2s';
        prefixSpan.style.pointerEvents = 'none';
        prefixSpan.style.position = 'absolute';
        prefixSpan.style.left = '0';
        prefixSpan.style.top = '50%';
        prefixSpan.style.transform = 'translateY(-50%)';
        prefixSpan.style.fontFamily = 'var(--font-display)';
        prefixSpan.style.fontSize = '3.2em';
        prefixSpan.style.fontWeight = 'bold';
        prefixSpan.style.color = 'var(--highlight-color)';
        prefixSpan.style.textShadow = '0 0 10px #fff, 0 0 15px var(--highlight-color)';
        prefixSpan.style.zIndex = '7';
        prefixSpan.style.whiteSpace = 'nowrap';
        // Insert before searchInput in the container
        searchElements.searchContainer.insertBefore(prefixSpan, searchElements.searchInput);
        searchElements.searchPrefixSpan = prefixSpan;
    }
    // Always hide prefix span on start
    searchElements.searchPrefixSpan.style.opacity = '0';
    searchElements.searchPrefixSpan.textContent = '';
    
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

    if (searchState.isReverseMode) {
        // Reverse search: find words ending with the query
        if (query.length === 0) {
            searchState.suggestions = [];
            searchState.selectedIndex = -1;
            if (searchElements.searchPrefixSpan) {
                searchElements.searchPrefixSpan.style.opacity = '0';
                searchElements.searchPrefixSpan.textContent = '';
            }
            return;
        }
        const suggestions = state.wordList.filter(word => 
            word.toLowerCase().endsWith(query)
        );
        searchState.suggestions = suggestions;
        searchState.selectedIndex = suggestions.length > 0 ? 0 : -1;
        // Show prefix if suggestion exists
        if (searchElements.searchPrefixSpan) {
            if (suggestions.length > 0) {
                const firstSuggestion = suggestions[0];
                const prefix = firstSuggestion.substring(0, firstSuggestion.length - query.length);
                searchElements.searchPrefixSpan.textContent = prefix;
                searchElements.searchPrefixSpan.style.opacity = '1';
            } else {
                searchElements.searchPrefixSpan.style.opacity = '0';
                searchElements.searchPrefixSpan.textContent = '';
            }
        }
        // No UI update for rest of reverse mode yet
        return;
    } else {
        // Hide prefix span in forward mode
        if (searchElements.searchPrefixSpan) {
            searchElements.searchPrefixSpan.style.opacity = '0';
            searchElements.searchPrefixSpan.textContent = '';
        }
        // Remove placeholder instructions as soon as user starts typing
        if (query.length > 0) {
            searchElements.searchInput.placeholder = '';
        }

        if (query.length === 0) {
            searchElements.searchAutocomplete.textContent = '';
            searchElements.searchAutocomplete.classList.remove('add-word-prompt');
            searchState.suggestions = [];
            searchState.selectedIndex = -1;
            return;
        }

        // Find matching words from the complete word list (ignores filters for search)
        // Use the master wordList, not the filtered version, to get ALL possible words
        const suggestions = state.wordList.filter(word => 
            word.toLowerCase().startsWith(query)
        ); // No limit - show all matching words for complete exploration
        
        // Debug logging to see what words are found
        if (query === 'pi') {
            console.log('PI words found:', suggestions.slice(0, 20)); // Show first 20 for debugging
            console.log('Total PI words:', suggestions.length);
        }

        searchState.suggestions = suggestions;

        if (suggestions.length > 0) {
            // Show first suggestion as autocomplete
            const firstSuggestion = suggestions[0];
            const remainingPart = firstSuggestion.substring(query.length);
            searchElements.searchAutocomplete.textContent = remainingPart;
            searchElements.searchAutocomplete.classList.remove('add-word-prompt');
            searchState.selectedIndex = 0;
            
            // Check if the exact word exists in the list
            const exactMatch = state.wordList.includes(query);
            updateSearchBorder(exactMatch);
            
            // If the typed word doesn't exist, show both options
            if (!exactMatch) {
                showDualSuggestion(query, firstSuggestion);
            } else {
                // Word exists, no need for suggestions
                hideAllSuggestions();
            }
            
            // Position autocomplete at the cursor position
            positionAutocomplete();
        } else if (query.length > 0) {
            // No suggestions found - clear autocomplete
            searchElements.searchAutocomplete.textContent = '';
            searchElements.searchAutocomplete.classList.remove('add-word-prompt');
            searchState.selectedIndex = -1;
            searchState.canAddWord = true;
            
            // Word not found - show red border
            updateSearchBorder(false);
            
            // Hide any existing dual suggestions and show single "Press Enter" dialog
            hideAllSuggestions();
            showEnterSuggestion(query);
            
            // Position autocomplete at the cursor position
            positionAutocomplete();
        } else {
            searchElements.searchAutocomplete.textContent = '';
            searchElements.searchAutocomplete.classList.remove('add-word-prompt');
            searchState.selectedIndex = -1;
            searchState.canAddWord = false;
            
            // Clear border when no input
            clearSearchBorder();
            
            // Hide all suggestions
            hideAllSuggestions();
        }

        // Adjust font size for the input to match word display behavior
        adjustSearchFontSize();
    }
}

/**
 * Position the autocomplete text at the cursor position
 */
function positionAutocomplete() {
    const input = searchElements.searchInput;
    const autocomplete = searchElements.searchAutocomplete;
    
    if (!input || !autocomplete) return;
    
    // If this is the "Press Enter to add" message, don't position it (CSS handles it)
    if (autocomplete.classList.contains('add-word-prompt')) {
        return;
    }
    
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
}

/**
 * Update the search border based on word existence
 */
function updateSearchBorder(wordExists) {
    const container = searchElements.searchContainer;
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
 * Clear the search border
 */
function clearSearchBorder() {
    const container = searchElements.searchContainer;
    if (!container) return;
    
    container.classList.remove('word-found', 'word-not-found');
}

/**
 * Handle keyboard navigation in search
 */
function handleSearchKeydown(event) {
    switch (event.key) {
        case 'Enter':
            event.preventDefault();
            // If there's an autocomplete suggestion but user wants to submit what they typed
            if (searchState.suggestions.length > 0 && searchState.currentQuery !== searchState.suggestions[0]) {
                // Submit the typed word as a new word
                addNewWord(searchState.currentQuery);
            } else {
                confirmSearch();
            }
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
        case 'ArrowLeft':
            event.preventDefault();
            navigateLetterBackward();
            break;
        case 'ArrowRight':
            event.preventDefault();
            navigateLetterForward();
            break;
        case 'Tab':
            event.preventDefault();
            if (searchState.suggestions.length > 0) {
                // Select the suggested word as the current word
                const selectedSuggestion = searchState.suggestions[0];
                
                // Find the word in the word list and set it as current
                const wordIndex = state.wordList.indexOf(selectedSuggestion);
                if (wordIndex !== -1) {
                    // Update state
                    state.currentWord = selectedSuggestion;
                    state.currentWordIndex = wordIndex;
                    
                    // Clear rhyme state since we're changing the base word
                    state.currentRhymeList = [];
                    state.currentRhymeIndex = -1;

                    // Exit search mode first to restore normal display
                    exitSearchMode();
                    
                    // Update display after search mode is exited
                    ui.displayWord(selectedSuggestion);
                    
                    // Load rhymes for the new word
                    state.currentRhymeList = rhyme.getValidRhymesForWord(selectedSuggestion);
                    state.currentRhymeIndex = -1;
                    
                    // Force refresh rhyme navigation buttons
                    ui.updateRhymeNavButtons();
                    
                    // Update tooltips if they're active
                    if (typeof updateTooltipForDisplayedWord === 'function') {
                        updateTooltipForDisplayedWord();
                    }

                    ui.showFeedback(`Selected: "${selectedSuggestion}"`, false, 1500);
                } else {
                    exitSearchMode();
                }
            }
            break;
    }
}

/**
 * Navigate through suggestions with arrow keys (alphabetically)
 */
function navigateSuggestions(direction) {
    if (searchState.suggestions.length === 0) return;

    let newIndex = searchState.selectedIndex + direction;
    
    // Cycle continuously through the suggestions
    if (newIndex < 0) {
        // Wrap to the bottom when going up past the top
        newIndex = searchState.suggestions.length - 1;
    } else if (newIndex >= searchState.suggestions.length) {
        // Wrap to the top when going down past the bottom
        newIndex = 0;
    }
    
    searchState.selectedIndex = newIndex;
    const selectedSuggestion = searchState.suggestions[newIndex];
    const remainingPart = selectedSuggestion.substring(searchState.currentQuery.length);
    searchElements.searchAutocomplete.textContent = remainingPart;
    
    // Reposition autocomplete
    positionAutocomplete();
}

/**
 * Navigate forward by adding the next letter from the current suggestion
 */
function navigateLetterForward() {
    if (searchState.suggestions.length === 0) return;
    
    const currentSuggestion = searchState.suggestions[searchState.selectedIndex >= 0 ? searchState.selectedIndex : 0];
    const currentQuery = searchState.currentQuery;
    
    // Check if we can add another letter
    if (currentQuery.length < currentSuggestion.length) {
        const nextLetter = currentSuggestion[currentQuery.length];
        const newQuery = currentQuery + nextLetter;
        
        // Update the input value
        searchElements.searchInput.value = newQuery;
        searchState.currentQuery = newQuery;
        
        // Trigger input event to update suggestions
        const inputEvent = new Event('input', { bubbles: true });
        searchElements.searchInput.dispatchEvent(inputEvent);
    }
}

/**
 * Navigate backward by removing the last letter
 */
function navigateLetterBackward() {
    const currentQuery = searchState.currentQuery;
    
    // Only allow going back if we have at least one character
    if (currentQuery.length > 0) {
        const newQuery = currentQuery.slice(0, -1);
        
        // Update the input value
        searchElements.searchInput.value = newQuery;
        searchState.currentQuery = newQuery;
        
        // Trigger input event to update suggestions
        const inputEvent = new Event('input', { bubbles: true });
        searchElements.searchInput.dispatchEvent(inputEvent);
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

    // Check if we should add a new word
    if (searchState.canAddWord && !state.wordList.includes(selectedWord)) {
        addNewWord(selectedWord);
        return;
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

        ui.showFeedback(`