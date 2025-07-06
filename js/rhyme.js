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

// --- Rhyme Finder Sorting State ---
let rhymeSortMode = 'default'; // 'default', 'alpha', 'phonetic', 'similarity'

function setRhymeSortMode(mode) {
    // If clicking the already active sort, revert to default
    if (rhymeSortMode === mode) {
        rhymeSortMode = 'default';
    } else {
        rhymeSortMode = mode;
    }
    updateRhymeSortButtonState();
    // Re-render rhyme list
    const baseWordLower = state.currentWord?.toLowerCase();
    const wordPattern = getRhymePattern(state.currentWord);
    displayRhymeList(baseWordLower, wordPattern);
}

function updateRhymeSortButtonState() {
    const btns = [
        { id: 'sort-alpha', mode: 'alpha' },
        { id: 'sort-phonetic', mode: 'phonetic' },
        { id: 'sort-similarity', mode: 'similarity' }
    ];
    btns.forEach(({ id, mode }) => {
        const btn = document.getElementById(id);
        if (btn) btn.classList.toggle('active', rhymeSortMode === mode);
    });
}

function attachRhymeSortListeners() {
    const btnAlpha = document.getElementById('sort-alpha');
    const btnPhonetic = document.getElementById('sort-phonetic');
    const btnSimilarity = document.getElementById('sort-similarity');
    if (btnAlpha) btnAlpha.onclick = () => setRhymeSortMode('alpha');
    if (btnPhonetic) btnPhonetic.onclick = () => setRhymeSortMode('phonetic');
    if (btnSimilarity) btnSimilarity.onclick = () => setRhymeSortMode('similarity');
}

// --- Temporary Rejection State (modal-local) ---
let tempRejected = new Set();

// --- Enhanced Modal Open with Sorting ---
export function openRhymeFinderModalWithSort() {
    tempRejected = new Set();
    rhymeSortMode = 'default';
    updateRhymeSortButtonState();
    attachRhymeSortListeners();
    showRhymeFinder();
}
export function persistTempRejections() {
    const baseWord = state.currentWord;
    const baseWordLower = baseWord?.toLowerCase();
    if (!baseWordLower) return;
    if (!state.rejectedRhymes[baseWordLower]) state.rejectedRhymes[baseWordLower] = new Set();
    for (const word of tempRejected) {
        state.rejectedRhymes[baseWordLower].add(word.toLowerCase());
    }
    storage.saveSettings();
    tempRejected.clear();
}

// Update createRhymeListItem for temp rejection/undo and slant tagging
function createRhymeListItem(rhymeWord, baseWordLower) {
    if (!ui.elements.rhymeResultsList) return;
    const wordLower = rhymeWord.toLowerCase();
    const li = document.createElement('li');
    li.textContent = rhymeWord;
    li.dataset.rhymeWord = rhymeWord;
    const freq = state.wordFrequencies[wordLower] || 0;
    if (freq >= 5) li.classList.add('rhyme-freq-high');
    else if (freq >= 2) li.classList.add('rhyme-freq-med');
    else if (freq === 1) li.classList.add('rhyme-freq-low');
    else li.classList.add('rhyme-freq-none');
    
    // Check if word is slant tagged
    const slantSet = state.slantRhymes[baseWordLower] || new Set();
    const isSlantTagged = slantSet.has(wordLower);
    if (isSlantTagged) {
        li.classList.add('slant-tagged');
        li.style.fontStyle = 'italic';
    }
    
    // Check if word was manually added
    const manualSet = state.manualRhymes[baseWordLower] || new Set();
    const isManuallyAdded = manualSet.has(wordLower);
    if (isManuallyAdded) {
        li.classList.add('manually-added');
        li.style.textDecoration = 'underline';
        li.title = 'Manually added rhyme';
    }
    
    // If temp rejected, add .rejected and show [undo] icon
    if (tempRejected.has(wordLower)) {
        li.classList.add('rejected');
        const undo = document.createElement('span');
        undo.className = 'rhyme-x';
        undo.textContent = '↩';
        undo.title = 'Undo rejection';
        undo.onclick = (e) => {
            e.stopPropagation();
            tempRejected.delete(wordLower);
            // Re-render
            const baseWordLower = state.currentWord?.toLowerCase();
            const wordPattern = getRhymePattern(state.currentWord);
            displayRhymeList(baseWordLower, wordPattern);
        };
        li.appendChild(undo);
    } else {
        // Add the [X] icon
        const x = document.createElement('span');
        x.className = 'rhyme-x';
        x.textContent = '×';
        x.title = 'Reject this rhyme';
        x.onclick = (e) => {
            e.stopPropagation();
            tempRejected.add(wordLower);
            // Re-render
            const baseWordLower = state.currentWord?.toLowerCase();
            const wordPattern = getRhymePattern(state.currentWord);
            displayRhymeList(baseWordLower, wordPattern);
        };
        li.appendChild(x);
    }
    
    // Add the [Tag] icon for slant rhyming
    const tag = document.createElement('span');
    tag.className = 'rhyme-tag';
    tag.textContent = isSlantTagged ? '📌' : '🏷️';
    tag.title = isSlantTagged ? 'Remove slant rhyme tag' : 'Tag as slant rhyme';
    tag.onclick = (e) => {
        e.stopPropagation();
        if (!state.slantRhymes[baseWordLower]) state.slantRhymes[baseWordLower] = new Set();
        if (isSlantTagged) {
            state.slantRhymes[baseWordLower].delete(wordLower);
            if (state.slantRhymes[baseWordLower].size === 0) {
                delete state.slantRhymes[baseWordLower];
            }
        } else {
            state.slantRhymes[baseWordLower].add(wordLower);
        }
        storage.saveSettings();
        // Re-render
        const currentBaseWordLower = state.currentWord?.toLowerCase();
        const wordPattern = getRhymePattern(state.currentWord);
        displayRhymeList(currentBaseWordLower, wordPattern);
    };
    li.appendChild(tag);
    
    ui.elements.rhymeResultsList.appendChild(li);
}

// Update displayRhymeList to move tempRejected words to end
function displayRhymeList(baseWordLower, wordPattern) {
    if (!ui.elements.rhymeResultsList || !baseWordLower) return;
    let rhymesToDisplay = getValidRhymesForWord(state.currentWord);
    // Apply sorting
    if (rhymeSortMode === 'alpha') {
        rhymesToDisplay = [...rhymesToDisplay].sort((a, b) => a.localeCompare(b));
    } else if (rhymeSortMode === 'phonetic') {
        rhymesToDisplay = sortByPhoneticEnding(rhymesToDisplay);
    } else if (rhymeSortMode === 'similarity') {
        rhymesToDisplay = sortByRhymeSimilarity(rhymesToDisplay, state.currentWord);
    }
    // Move tempRejected words to end
    const normal = [], rejected = [];
    for (const word of rhymesToDisplay) {
        if (tempRejected.has(word.toLowerCase())) rejected.push(word);
        else normal.push(word);
    }
    const finalList = [...normal, ...rejected];
    ui.elements.rhymeResultsList.innerHTML = '';
    if (finalList.length > 0) {
        finalList.forEach(match => createRhymeListItem(match, baseWordLower));
        if (ui.elements.rhymeNoResults) ui.elements.rhymeNoResults.style.display = 'none';
    } else {
        if (ui.elements.rhymeNoResults) ui.elements.rhymeNoResults.style.display = 'block';
    }
}

// --- Phonetic Ending Sort ---
function sortByPhoneticEnding(words) {
    // Group by last 1-2 phonemes
    const groups = {};
    for (const word of words) {
        const pattern = getRhymePattern(word);
        let ending = pattern ? pattern.slice(-2).join('-') : 'unknown';
        if (!groups[ending]) groups[ending] = [];
        groups[ending].push(word);
    }
    // Sort groups by size descending, then alphabetize within
    const sortedGroups = Object.entries(groups)
        .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
    let result = [];
    for (const [, group] of sortedGroups) {
        result = result.concat(group.sort((a, b) => a.localeCompare(b)));
    }
    return result;
}

// --- Slant Rhymes State ---
if (!state.slantRhymes) state.slantRhymes = {};

// --- Helper: Is Perfect Rhyme ---
function isPerfectRhyme(basePhonetic, candidatePhonetic) {
    // Both are arrays of phonemes (e.g., ['AH0', 'N', 'D'])
    if (!Array.isArray(basePhonetic) || !Array.isArray(candidatePhonetic)) return false;
    // Find the last stressed vowel in basePhonetic
    let baseIdx = -1;
    for (let i = basePhonetic.length - 1; i >= 0; i--) {
        if (/\d/.test(basePhonetic[i])) { baseIdx = i; break; }
    }
    if (baseIdx === -1) return false;
    const baseEnding = basePhonetic.slice(baseIdx).join('-');
    // Do the same for candidate
    let candIdx = -1;
    for (let i = candidatePhonetic.length - 1; i >= 0; i--) {
        if (/\d/.test(candidatePhonetic[i])) { candIdx = i; break; }
    }
    if (candIdx === -1) return false;
    const candEnding = candidatePhonetic.slice(candIdx).join('-');
    return baseEnding === candEnding;
}

// --- Rhyme Similarity Sort ---
function sortByRhymeSimilarity(words, baseWord) {
    const basePhonetic = getRhymePattern(baseWord);
    const baseWordLower = baseWord.toLowerCase();
    const slantSet = state.slantRhymes[baseWordLower] || new Set();
    const manualSet = state.manualRhymes[baseWordLower] || new Set();
    let perfect = [], near = [], slant = [];
    for (const word of words) {
        const wordLower = word.toLowerCase();
        if (slantSet.has(wordLower)) {
            slant.push(word);
        } else {
            const candidatePhonetic = getRhymePattern(word);
            if (isPerfectRhyme(basePhonetic, candidatePhonetic)) {
                perfect.push(word);
            } else {
                near.push(word);
            }
        }
    }
    // Manual rhymes are always 'near' unless also tagged as slant
    for (const word of manualSet) {
        const wordLower = word.toLowerCase();
        if (!slantSet.has(wordLower) && !near.includes(word)) {
            near.push(word);
        }
    }
    perfect.sort((a, b) => a.localeCompare(b));
    near.sort((a, b) => a.localeCompare(b));
    slant.sort((a, b) => a.localeCompare(b));
    return [...perfect, ...near, ...slant];
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