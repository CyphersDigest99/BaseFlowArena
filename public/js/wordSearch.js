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
    canAddWord: false
};

// DOM elements
let searchElements = {
    searchButton: null,
    searchInput: null,
    searchAutocomplete: null,
    searchContainer: null,
    wordCell: null,
    suggestionList: null
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

    // Create suggestion list container
    searchElements.suggestionList = document.createElement('div');
    searchElements.suggestionList.className = 'suggestion-list';
    searchElements.suggestionList.id = 'search-suggestion-list';
    searchElements.searchContainer.appendChild(searchElements.suggestionList);

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
        searchElements.searchAutocomplete.classList.remove('add-word-prompt');
        searchState.suggestions = [];
        searchState.selectedIndex = -1;
        hideSuggestionList();
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

        // Render the visible suggestion list
        renderSuggestionList();

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

        // Hide suggestion list
        hideSuggestionList();

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

        // Hide suggestion list
        hideSuggestionList();

        // Clear border when no input
        clearSearchBorder();

        // Hide all suggestions
        hideAllSuggestions();
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

    // If this is the "Press Enter to add" message, don't position it (CSS handles it)
    if (autocomplete.classList.contains('add-word-prompt')) {
        return;
    }

    // Create a temporary span to measure the input text width
    const tempSpan = document.createElement('span');
    tempSpan.style.fontSize = window.getComputedStyle(input).fontSize;
    tempSpan.style.fontFamily = window.getComputedStyle(input).fontFamily;
    tempSpan.style.fontWeight = window.getComputedStyle(input).fontWeight;
    tempSpan.style.letterSpacing = window.getComputedStyle(input).letterSpacing;
    tempSpan.style.visibility = 'hidden';
    tempSpan.style.position = 'absolute';
    tempSpan.style.whiteSpace = 'pre';
    tempSpan.textContent = input.value;
    document.body.appendChild(tempSpan);

    // Calculate the width of the input text
    const inputTextWidth = tempSpan.offsetWidth;
    document.body.removeChild(tempSpan);

    // Get the input's position within the container
    const inputRect = input.getBoundingClientRect();
    const containerRect = searchElements.searchContainer.getBoundingClientRect();

    // Calculate where the input text starts (accounting for text-align center)
    const inputCenterX = inputRect.left + (inputRect.width / 2);
    const textStartX = inputCenterX - (inputTextWidth / 2);
    const textEndX = textStartX + inputTextWidth;

    // Position autocomplete right after the typed text (relative to container)
    const leftPosition = textEndX - containerRect.left;

    autocomplete.style.left = leftPosition + 'px';
    autocomplete.style.transform = 'translateY(-50%)';
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
        case 'Tab':
            event.preventDefault();
            // Tab accepts the autocomplete suggestion (full word)
            if (searchState.suggestions.length > 0) {
                const selectedSuggestion = searchState.suggestions[searchState.selectedIndex >= 0 ? searchState.selectedIndex : 0];
                const wordIndex = state.wordList.indexOf(selectedSuggestion);
                if (wordIndex !== -1) {
                    state.currentWord = selectedSuggestion;
                    state.currentWordIndex = wordIndex;
                    state.currentRhymeList = [];
                    state.currentRhymeIndex = -1;
                    exitSearchMode();
                    ui.displayWord(selectedSuggestion);
                    state.currentRhymeList = rhyme.getValidRhymesForWord(selectedSuggestion);
                    state.currentRhymeIndex = -1;
                    ui.updateRhymeNavButtons();
                    if (typeof updateTooltipForDisplayedWord === 'function') {
                        updateTooltipForDisplayedWord();
                    }
                    ui.showFeedback(`Selected: "${selectedSuggestion}"`, false, 1500);
                } else {
                    exitSearchMode();
                }
            }
            break;
        case 'Enter':
            event.preventDefault();
            // Enter submits what you typed (partial word, adds if new)
            const typedWord = searchState.currentQuery.trim();
            if (typedWord.length >= 2) {
                if (state.wordList.includes(typedWord)) {
                    // Word exists, select it
                    const wordIndex = state.wordList.indexOf(typedWord);
                    state.currentWord = typedWord;
                    state.currentWordIndex = wordIndex;
                    state.currentRhymeList = [];
                    state.currentRhymeIndex = -1;
                    exitSearchMode();
                    ui.displayWord(typedWord);
                    state.currentRhymeList = rhyme.getValidRhymesForWord(typedWord);
                    state.currentRhymeIndex = -1;
                    ui.updateRhymeNavButtons();
                    ui.showFeedback(`Selected: "${typedWord}"`, false, 1500);
                } else {
                    // Word doesn't exist, add it
                    addNewWord(typedWord);
                }
            } else if (searchState.suggestions.length > 0) {
                // Fallback: if typed word too short but suggestions exist, treat as confirm
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

    // Render the visible suggestion list
    renderSuggestionList();

    // Reposition autocomplete
    positionAutocomplete();
}

/**
 * Render the visible suggestion list with fade effect
 * Shows 2 items above, selected item, and 2 items below
 */
function renderSuggestionList() {
    const list = searchElements.suggestionList;
    if (!list) return;

    const suggestions = searchState.suggestions;
    const selectedIndex = searchState.selectedIndex;
    const query = searchState.currentQuery;

    // Clear existing items
    list.innerHTML = '';

    if (suggestions.length === 0 || selectedIndex < 0) {
        list.style.display = 'none';
        return;
    }

    list.style.display = 'flex';

    // Hide the single-word autocomplete and input text since the list shows full words
    searchElements.searchAutocomplete.style.visibility = 'hidden';
    searchElements.searchInput.style.color = 'transparent';
    searchElements.searchInput.style.caretColor = 'transparent';
    searchElements.searchInput.style.textShadow = 'none';

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

        // Highlight the typed portion vs autocomplete portion
        const typedPart = word.substring(0, query.length);
        const autocompletePart = word.substring(query.length);

        item.innerHTML = `<span class="typed-part">${typedPart}</span><span class="autocomplete-part">${autocompletePart}</span>`;

        // Apply fade based on distance from center
        const distance = Math.abs(offset);
        if (distance === 0) {
            item.classList.add('selected');
        } else if (distance === 1) {
            item.classList.add('fade-1');
        } else {
            item.classList.add('fade-2');
        }

        list.appendChild(item);
    }
}

/**
 * Hide the suggestion list
 */
function hideSuggestionList() {
    if (searchElements.suggestionList) {
        searchElements.suggestionList.style.display = 'none';
        searchElements.suggestionList.innerHTML = '';
    }
    // Restore autocomplete and input visibility
    if (searchElements.searchAutocomplete) {
        searchElements.searchAutocomplete.style.visibility = 'visible';
    }
    if (searchElements.searchInput) {
        searchElements.searchInput.style.color = '';
        searchElements.searchInput.style.caretColor = '';
        searchElements.searchInput.style.textShadow = '';
    }
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

        ui.showFeedback(`Selected: "${selectedWord}"`, false, 1500);
    } else {
        exitSearchMode();
    }
}

/**
 * Add a new word to the word list
 */
function addNewWord(word) {
    // Validate word format
    const trimmedWord = word.trim().toLowerCase();
    if (!trimmedWord || trimmedWord.length < 2) {
        ui.showFeedback('Word must be at least 2 characters long', true, 2000);
        return;
    }

    // Check if word already exists (case insensitive)
    if (state.wordList.some(existingWord => existingWord.toLowerCase() === trimmedWord)) {
        ui.showFeedback(`"${word}" already exists in the word list`, true, 2000);
        return;
    }

    // Add word to the word list
    state.wordList.push(word);
    
    // Sort the word list alphabetically to maintain order
    state.wordList.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    
    // Update the filtered word list
    wordManager.applyFiltersAndSort();
    
    // Save the updated word list to storage
    storage.saveSettings();
    
    // Find the newly added word and set it as current
    const wordIndex = state.wordList.indexOf(word);
    if (wordIndex !== -1) {
        // Update state
        state.currentWord = word;
        state.currentWordIndex = wordIndex;
        
        // Clear rhyme state since we're changing the base word
        state.currentRhymeList = [];
        state.currentRhymeIndex = -1;

        // Exit search mode first to restore normal display
        exitSearchMode();
        
        // Update display after search mode is exited
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

        ui.showFeedback(`Added and selected: "${word}"`, false, 2000);
        
        // Increment manual words counter
        state.manualWordsAdded++;
        
        // Update data summary if settings modal is open
        modal.updateDataSummary();
        
        console.log(`New word added: "${word}". Total words: ${state.wordList.length}, Manual words: ${state.manualWordsAdded}`);
    } else {
        exitSearchMode();
        ui.showFeedback(`Error adding word: "${word}"`, true, 2000);
    }
}

/**
 * Show the "Press Enter for [word]" message
 */
function showEnterSuggestion(word) {
    // Create or update the enter suggestion element
    let enterSuggestion = document.getElementById('enter-suggestion');
    if (!enterSuggestion) {
        enterSuggestion = document.createElement('div');
        enterSuggestion.id = 'enter-suggestion';
        enterSuggestion.className = 'enter-suggestion';
        searchElements.searchContainer.appendChild(enterSuggestion);
    } else {
        // Ensure it's not using dual positioning when shown alone
        enterSuggestion.className = 'enter-suggestion';
    }
    
    enterSuggestion.textContent = `Press Enter for "${word}"`;
    enterSuggestion.style.display = 'block';
}

/**
 * Show dual suggestions - "Press Tab for [suggestion]" and "Press Enter for [word]"
 */
function showDualSuggestion(word, suggestion) {
    // Create or update the tab suggestion element (left) - GREEN BOX
    let tabSuggestion = document.getElementById('tab-suggestion');
    if (!tabSuggestion) {
        tabSuggestion = document.createElement('div');
        tabSuggestion.id = 'tab-suggestion';
        tabSuggestion.className = 'tab-suggestion dual-left';
        searchElements.searchContainer.appendChild(tabSuggestion);
    } else {
        tabSuggestion.className = 'tab-suggestion dual-left';
    }

    // Create or update the enter suggestion element (right) - ORANGE BOX
    let enterSuggestion = document.getElementById('enter-suggestion');
    if (!enterSuggestion) {
        enterSuggestion = document.createElement('div');
        enterSuggestion.id = 'enter-suggestion';
        enterSuggestion.className = 'enter-suggestion dual-right';
        searchElements.searchContainer.appendChild(enterSuggestion);
    } else {
        enterSuggestion.className = 'enter-suggestion dual-right';
    }

    // CORRECTED: Tab accepts autocomplete (suggestion), Enter accepts typed word
    tabSuggestion.textContent = `Press Tab for "${suggestion}"`;
    enterSuggestion.textContent = `Press Enter for "${word}"`;
    tabSuggestion.style.display = 'block';
    enterSuggestion.style.display = 'block';
}

/**
 * Hide all suggestion messages
 */
function hideAllSuggestions() {
    const enterSuggestion = document.getElementById('enter-suggestion');
    const tabSuggestion = document.getElementById('tab-suggestion');
    
    if (enterSuggestion) {
        enterSuggestion.style.display = 'none';
    }
    if (tabSuggestion) {
        tabSuggestion.style.display = 'none';
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
    searchState.canAddWord = false;

    // Update UI
    searchElements.wordCell.classList.remove('search-mode');
    searchElements.searchContainer.classList.remove('active');
    searchElements.searchInput.value = '';
    searchElements.searchInput.placeholder = ''; // Clear placeholder
    searchElements.searchAutocomplete.textContent = '';
    searchElements.searchAutocomplete.classList.remove('add-word-prompt');
    clearSearchBorder();
    hideAllSuggestions(); // Hide all suggestions when exiting
    hideSuggestionList(); // Hide the suggestion list
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
