// js/rhyme.js
// Handles loading rhyme data and the rhyme finder modal logic.

import { state } from './state.js';
import * as ui from './ui.js';
import * as modal from './modal.js';
import * as storage from './storage.js'; // Need saveSettings

// --- Load Rhyme Data ---
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
function getRhymePattern(word) {
    if (!state.rhymeData || !word) return null;
    // Use toLowerCase() for lookup, assumes keys in rhyme_data.json are lowercase
    const wordLower = word.toLowerCase();
    return state.rhymeData[wordLower] || null;
}


// --- NEW: Get Valid Rhymes for a Word (Needs Export) ---
// <<<--- ADD 'export' HERE ---<<<
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
export function showRhymeFinder() {
    if (!state.rhymeData) { /* ... */ return; }
    const baseWord = state.currentWord;
    if (!baseWord || baseWord === "NO WORDS!") { /* ... */ return; }
    const baseWordLower = baseWord.toLowerCase();
    const wordPattern = getRhymePattern(baseWord);

    // Update Modal Header
    if (ui.elements.rhymeModalBaseWord) ui.elements.rhymeModalBaseWord.textContent = baseWord;
    if (ui.elements.rhymeModalPatternContainer) {
        ui.elements.rhymeModalPatternContainer.innerHTML = ''; // Clear previous
        if (wordPattern) {
            wordPattern.forEach(vowel => {
                const block = document.createElement('span');
                block.classList.add('vowel-pattern-block');
                block.textContent = vowel;
                ui.elements.rhymeModalPatternContainer.appendChild(block);
            });
        } else { /* ... show N/A block ... */ }
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