/**
 * @fileoverview Rhyme Data Management and Rhyme Finder Modal
 *
 * This module handles all rhyme-related logic for the BaseFlowArena application.
 * It loads and manages the rhyme data, provides rhyme pattern matching,
 * manages the rhyme finder modal, and allows users to reject or manually add rhymes.
 *
 * Key responsibilities:
 * - Loading and parsing rhyme data from JSON
 * - Determining rhyme patterns for words
 * - Finding valid rhymes for a given word
 * - Managing the rhyme finder modal UI
 * - Allowing users to reject or manually add rhymes
 * - Persisting rhyme preferences and updates
 *
 * Dependencies: state.js, ui.js, modal.js, storage.js
 */

// js/rhyme.js
// Handles loading rhyme data and the rhyme finder modal logic.

import { state } from './state.js';
import * as ui from './ui.js';
import * as modal from './modal.js';
import * as storage from './storage.js'; // Need saveSettings

// --- Load Rhyme Data ---
// Loads rhyme data from JSON file and updates state
export async function loadRhymeData() {
    console.log("Loading rhyme data...");
    try {
        const response = await fetch('rhyme_data.json');
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error(`Rhyme data file ('rhyme_data.json') not found. Please run 'python process_rhymes.py'.`);
            } else {
                throw new Error(`HTTP error loading rhyme data! status: ${response.status}`);
            }
        }
        state.rhymeData = await response.json();
        console.log(`Rhyme data loaded successfully (${Object.keys(state.rhymeData).length} entries).`);
        if(ui.elements.findRhymesButton) ui.elements.findRhymesButton.disabled = false;
    } catch (error) {
        console.error("Could not load or parse rhyme_data.json:", error);
        state.rhymeData = null;
        ui.showFeedback(error.message || "Error: Could not load rhyme data. Rhyme finder disabled.", true, 7000);
        if(ui.elements.findRhymesButton) ui.elements.findRhymesButton.disabled = true;
    }
}

// --- Get Rhyme Pattern (Internal) ---
// Retrieves the rhyme pattern array for a given word from rhyme data
function getRhymePattern(word) {
    if (!state.rhymeData || !word) return null;
    // Use toLowerCase() for lookup, assumes keys in rhyme_data.json are lowercase
    const wordLower = word.toLowerCase();
    const data = state.rhymeData[wordLower];
    
    if (!data) return null;
    
    // Handle new format (object with rhyme_pattern and syllables)
    if (data.rhyme_pattern) {
        return data.rhyme_pattern;
    }
    
    // Handle old format (direct array) - backward compatibility
    if (Array.isArray(data)) {
        return data;
    }
    
    return null;
}

// --- Get Valid Rhymes for a Word ---
// Returns a sorted list of valid rhymes for the given base word
export function getValidRhymesForWord(baseWord) {
    if (!baseWord || !state.rhymeData) return [];

    const baseWordLower = baseWord.toLowerCase();
    const wordPattern = getRhymePattern(baseWord); // Use internal helper

    const rejectedSet = state.rejectedRhymes[baseWordLower] || new Set();
    const manualSet = state.manualRhymes[baseWordLower] || new Set();

    // Find Phonetic Matches from the currently filtered list
    let phoneticMatches = [];
    if (wordPattern) {
        const patternString = wordPattern.join('-');
        phoneticMatches = state.filteredWordList.filter(word => {
            const wordLower = word.toLowerCase();
            if (wordLower === baseWordLower) return false; // Exclude self
            if (rejectedSet.has(wordLower)) return false; // Exclude rejected
            const otherPattern = getRhymePattern(word);
            return otherPattern && otherPattern.join('-') === patternString;
        });
    }

    // Combine, remove duplicates, sort
    const combinedMatches = new Set([...phoneticMatches, ...manualSet]);
    const sortedMatches = Array.from(combinedMatches);

    // Sort by frequency
    sortedMatches.sort((a, b) => {
        const freqA = state.wordFrequencies[a.toLowerCase()] || 0;
        const freqB = state.wordFrequencies[b.toLowerCase()] || 0;
        return freqB - freqA; // Descending frequency
    });

    // console.log(`Found ${sortedMatches.length} valid rhymes for "${baseWord}"`); // Optional Debug
    return sortedMatches;
}

// --- Show Rhyme Finder Modal ---
// Opens the rhyme finder modal and populates it with rhymes for the current word
export function showRhymeFinder() {
    if (!state.rhymeData) { 
        ui.showFeedback("Rhyme data not loaded. Please wait or refresh the page.", true);
        return; 
    }
    const baseWord = state.currentWord;
    if (!baseWord || baseWord === "NO WORDS!") { 
        ui.showFeedback("No word selected for rhyme finding.", true);
        return; 
    }
    const baseWordLower = baseWord.toLowerCase();
    const wordPattern = getRhymePattern(baseWord);

    // Get rhyme matches to calculate count
    const rhymeMatches = getValidRhymesForWord(baseWord);
    const matchCount = rhymeMatches.length;

    // Create dynamic heading (multi-line, with vowel blocks)
    let headingHTML = '';
    if (wordPattern && wordPattern.length > 0) {
        const wordText = matchCount === 1 ? 'word' : 'words';
        // Build vowel blocks HTML
        const vowelBlocks = wordPattern.map(vowel => `<span class="vowel-pattern-block">${vowel}</span>`).join(' ');
        headingHTML = `
            <div>${matchCount} ${wordText}</div>
            <div>sound like the</div>
            <div style="margin: 8px 0;">${vowelBlocks}</div>
            <div>in</div>
            <div style="font-size:1.2em;font-weight:bold;margin-top:2px;">${baseWord}</div>
        `;
    } else {
        headingHTML = `<div>No phonetic data available for "${baseWord}"</div>`;
    }

    // Update Modal Header with dynamic heading (as HTML)
    if (ui.elements.rhymeModalDynamicHeading) {
        ui.elements.rhymeModalDynamicHeading.innerHTML = headingHTML;
    }

    // Clear previous results and input
    if (ui.elements.rhymeResultsList) ui.elements.rhymeResultsList.innerHTML = '';
    if (ui.elements.rhymeNoResults) ui.elements.rhymeNoResults.style.display = 'none';
    if (ui.elements.manualRhymeInput) ui.elements.manualRhymeInput.value = '';

    // Populate List
    displayRhymeList(baseWordLower, wordPattern); // Calls internal helper which calls getValidRhymesForWord

    modal.openModal(ui.elements.rhymeFinderModal);
}

// --- Display Rhyme List (Internal Helper) ---
// Populates the rhyme list in the modal for the given base word
function displayRhymeList(baseWordLower, wordPattern) {
    if (!ui.elements.rhymeResultsList || !baseWordLower) return;
    // Calls the EXPORTED function (which is fine)
    const rhymesToDisplay = getValidRhymesForWord(state.currentWord);
    ui.elements.rhymeResultsList.innerHTML = '';

    if (rhymesToDisplay.length > 0) {
        rhymesToDisplay.forEach(match => createRhymeListItem(match, baseWordLower));
        if (ui.elements.rhymeNoResults) ui.elements.rhymeNoResults.style.display = 'none';
    } else {
        if (ui.elements.rhymeNoResults) ui.elements.rhymeNoResults.style.display = 'block';
    }
}

// --- createRhymeListItem (Internal Helper) ---
// Creates a list item for a rhyme word and attaches rejection handler
function createRhymeListItem(rhymeWord, baseWordLower) {
    // ... (same as before) ...
    if (!ui.elements.rhymeResultsList) return;
    const li = document.createElement('li');
    li.textContent = rhymeWord;
    li.dataset.rhymeWord = rhymeWord;
    const freq = state.wordFrequencies[rhymeWord.toLowerCase()] || 0;
    if (freq >= 5) li.classList.add('rhyme-freq-high');
    else if (freq >= 2) li.classList.add('rhyme-freq-med');
    else if (freq === 1) li.classList.add('rhyme-freq-low');
    else li.classList.add('rhyme-freq-none');
    li.addEventListener('click', handleRhymeRejection);
    ui.elements.rhymeResultsList.appendChild(li);
}

// --- handleRhymeRejection (Internal Handler) ---
// Handles user rejection of a rhyme in the modal and updates state
function handleRhymeRejection(event) {
     // ... (same as before) ...
    const liElement = event.currentTarget;
    const rejectedWord = liElement.dataset.rhymeWord;
    const baseWord = state.currentWord;
    const baseWordLower = baseWord?.toLowerCase();
    if (!rejectedWord || !baseWordLower || liElement.classList.contains('rejected')) return;
    console.log(`Rejecting rhyme: "${rejectedWord}" for base word "${baseWord}"`);
    if (!state.rejectedRhymes[baseWordLower]) state.rejectedRhymes[baseWordLower] = new Set();
    state.rejectedRhymes[baseWordLower].add(rejectedWord.toLowerCase());
    storage.saveSettings();
    liElement.classList.add('rejected');
    liElement.style.pointerEvents = 'none';
    liElement.removeEventListener('click', handleRhymeRejection);
    ui.showFeedback(`"${rejectedWord}" marked as poor rhyme for "${baseWord}".`);
}

// --- addManualRhyme (EXPORTED) ---
// Allows user to manually add a rhyme for the current base word
export function addManualRhyme() {
     // ... (same as before) ...
    if (!ui.elements.manualRhymeInput) return;
    const suggestedWord = ui.elements.manualRhymeInput.value.trim();
    const baseWord = state.currentWord;
    const baseWordLower = baseWord?.toLowerCase();
    if (!suggestedWord || !baseWordLower || baseWord === "NO WORDS!") { /* ... */ return; }
    if (suggestedWord.toLowerCase() === baseWordLower) { /* ... */ return; }
    console.log(`Manually adding rhyme: "${suggestedWord}" for base word "${baseWord}"`);
    if (!state.manualRhymes[baseWordLower]) state.manualRhymes[baseWordLower] = new Set();
    if (state.manualRhymes[baseWordLower].has(suggestedWord)) { /* ... */ return; }
    state.manualRhymes[baseWordLower].add(suggestedWord);
    storage.saveSettings();
    // Refresh the displayed list
    const currentPattern = getRhymePattern(baseWord);
    displayRhymeList(baseWordLower, currentPattern); // Re-render list
    ui.showFeedback(`"${suggestedWord}" added to manual rhymes for "${baseWord}".`);
    ui.elements.manualRhymeInput.value = '';
}