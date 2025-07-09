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

// --- Get Phonemes (Internal) ---
// Retrieves the complete phoneme array for a given word from rhyme data
function getPhonemes(word) {
    if (!state.rhymeData || !word) return null;
    const wordLower = word.toLowerCase();
    const data = state.rhymeData[wordLower];
    
    if (!data || !data.phonemes) return null;
    return data.phonemes;
}

// --- Extract Rhyming Part ---
// Extracts the phonetic segment from the stressed vowel to the end of the word
function extractRhymingPart(phonemes) {
    if (!Array.isArray(phonemes) || phonemes.length === 0) return null;
    
    // Find the primary stressed vowel (stress marker 1)
    let stressIndex = -1;
    for (let i = 0; i < phonemes.length; i++) {
        if (phonemes[i].endsWith('1')) {
            stressIndex = i;
            break;
        }
    }
    
    // If no primary stress found, look for secondary stress (2) or unstressed (0)
    if (stressIndex === -1) {
        for (let i = 0; i < phonemes.length; i++) {
            if (phonemes[i].endsWith('2') || phonemes[i].endsWith('0')) {
                stressIndex = i;
                break;
            }
        }
    }
    
    // If still no stress found, use the last vowel
    if (stressIndex === -1) {
        for (let i = phonemes.length - 1; i >= 0; i--) {
            if (/[AEIOU]/.test(phonemes[i][0])) {
                stressIndex = i;
                break;
            }
        }
    }
    
    // If no stress point found, return the last few phonemes
    if (stressIndex === -1) {
        return phonemes.slice(-3); // Return last 3 phonemes as fallback
    }
    
    // Return the segment from stress point to end
    return phonemes.slice(stressIndex);
}

// --- Create Modal Header HTML ---
// Creates the appropriate header HTML based on sort mode
function createModalHeaderHTML(baseWord, rhymeSortMode) {
    const baseWordLower = baseWord.toLowerCase();
    const rhymeMatches = getValidRhymesForWord(baseWord);
    const matchCount = rhymeMatches.length;
    const wordText = matchCount === 1 ? 'word' : 'words';
    
    let patternDisplay = '';
    let patternType = '';
    
    if (rhymeSortMode === 'similarity') {
        // For similarity mode, show the full phonetic ending
        const phonemes = getPhonemes(baseWord);
        if (phonemes) {
            const rhymingPart = extractRhymingPart(phonemes);
            if (rhymingPart && rhymingPart.length > 0) {
                // Create phoneme blocks with different styling for vowels vs consonants
                const phonemeBlocks = rhymingPart.map(phoneme => {
                    const isVowel = /[AEIOU]/.test(phoneme[0]);
                    const cleanPhoneme = phoneme.replace(/[012]$/, ''); // Remove stress markers
                    const className = isVowel ? 'vowel-pattern-block' : 'consonant-pattern-block';
                    return `<span class="${className}">${cleanPhoneme}</span>`;
                }).join(' ');
                
                patternDisplay = phonemeBlocks;
                patternType = 'phonetic ending';
            } else {
                patternDisplay = 'unknown pattern';
                patternType = 'phonetic ending';
            }
        } else {
            patternDisplay = 'no phonetic data';
            patternType = 'phonetic ending';
        }
    } else {
        // For other modes, show the simple vowel pattern
        const wordPattern = getRhymePattern(baseWord);
        if (wordPattern && wordPattern.length > 0) {
            const vowelBlocks = wordPattern.map(vowel => `<span class="vowel-pattern-block">${vowel}</span>`).join(' ');
            patternDisplay = vowelBlocks;
            patternType = 'vowel sounds';
        } else {
            patternDisplay = 'no vowel data';
            patternType = 'vowel sounds';
        }
    }
    
    // Add focusable header with prev/next buttons
    return `
        <div>${matchCount} ${wordText}</div>
        <div>sound like the</div>
        <div style="margin: 8px 0;">${patternDisplay}</div>
        <div>in</div>
        <div class="rhyme-header-focus-row">
            <button id="rhyme-header-prev" class="rhyme-header-nav" tabindex="-1" aria-label="Previous word"><i class='fas fa-chevron-left'></i></button>
            <span id="rhyme-header-word" class="rhyme-header-word" tabindex="0">${baseWord}</span>
            <button id="rhyme-header-next" class="rhyme-header-nav" tabindex="-1" aria-label="Next word"><i class='fas fa-chevron-right'></i></button>
        </div>
    `;
}

// --- Calculate Rhyme Score ---
// Calculates a similarity score between two words based on their phonetic endings
// Returns a score from 0.0 to 1.0, where 1.0 indicates a perfect rhyme
export function calculateRhymeScore(word1_phonemes, word2_phonemes) {
    if (!Array.isArray(word1_phonemes) || !Array.isArray(word2_phonemes)) {
        return 0.0;
    }
    
    // Find the primary stressed vowel in word1 (the one with stress marker 1)
    let stressIndex1 = -1;
    for (let i = 0; i < word1_phonemes.length; i++) {
        if (word1_phonemes[i].endsWith('1')) {
            stressIndex1 = i;
            break;
        }
    }
    
    // If no primary stress found, look for secondary stress (2) or unstressed (0)
    if (stressIndex1 === -1) {
        for (let i = 0; i < word1_phonemes.length; i++) {
            if (word1_phonemes[i].endsWith('2') || word1_phonemes[i].endsWith('0')) {
                stressIndex1 = i;
                break;
            }
        }
    }
    
    // If still no stress found, use the last vowel
    if (stressIndex1 === -1) {
        for (let i = word1_phonemes.length - 1; i >= 0; i--) {
            if (/[AEIOU]/.test(word1_phonemes[i][0])) {
                stressIndex1 = i;
                break;
            }
        }
    }
    
    // If no stress point found in word1, return 0
    if (stressIndex1 === -1) {
        return 0.0;
    }
    
    // Find the corresponding stress point in word2
    let stressIndex2 = -1;
    for (let i = 0; i < word2_phonemes.length; i++) {
        if (word2_phonemes[i].endsWith('1')) {
            stressIndex2 = i;
            break;
        }
    }
    
    // If no primary stress found, look for secondary stress (2) or unstressed (0)
    if (stressIndex2 === -1) {
        for (let i = 0; i < word2_phonemes.length; i++) {
            if (word2_phonemes[i].endsWith('2') || word2_phonemes[i].endsWith('0')) {
                stressIndex2 = i;
                break;
            }
        }
    }
    
    // If still no stress found, use the last vowel
    if (stressIndex2 === -1) {
        for (let i = word2_phonemes.length - 1; i >= 0; i--) {
            if (/[AEIOU]/.test(word2_phonemes[i][0])) {
                stressIndex2 = i;
                break;
            }
        }
    }
    
    // If no stress point found in word2, return 0
    if (stressIndex2 === -1) {
        return 0.0;
    }
    
    // Get the segments from stress point to end for both words
    const segment1 = word1_phonemes.slice(stressIndex1);
    const segment2 = word2_phonemes.slice(stressIndex2);
    
    // Calculate similarity based on matching phonemes from stress point to end
    let matches = 0;
    const minLength = Math.min(segment1.length, segment2.length);
    
    for (let i = 0; i < minLength; i++) {
        // Remove stress markers for comparison
        const phoneme1 = segment1[i].replace(/[012]$/, '');
        const phoneme2 = segment2[i].replace(/[012]$/, '');
        
        if (phoneme1 === phoneme2) {
            matches++;
        } else {
            // Check for similar vowel sounds (near rhymes)
            if (/[AEIOU]/.test(phoneme1[0]) && /[AEIOU]/.test(phoneme2[0])) {
                // Vowel similarity scoring
                const vowelSimilarity = getVowelSimilarity(phoneme1, phoneme2);
                if (vowelSimilarity > 0.7) {
                    matches += vowelSimilarity;
                }
            }
        }
    }
    
    // Calculate base score
    let score = matches / Math.max(segment1.length, segment2.length);
    
    // Bonus for perfect ending match
    if (segment1.length === segment2.length && matches === segment1.length) {
        score = 1.0; // Perfect rhyme
    }
    
    // Penalty for length mismatch
    const lengthDiff = Math.abs(segment1.length - segment2.length);
    if (lengthDiff > 0) {
        score *= Math.max(0.5, 1 - (lengthDiff * 0.1));
    }
    
    return Math.min(1.0, Math.max(0.0, score));
}

// --- Vowel Similarity Helper ---
// Returns a similarity score between two vowel phonemes
function getVowelSimilarity(vowel1, vowel2) {
    if (vowel1 === vowel2) return 1.0;
    
    // Define vowel similarity groups
    const vowelGroups = {
        'AA': ['AA', 'AO'], // father, caught
        'AE': ['AE', 'AH'], // cat, cut
        'AH': ['AH', 'AE', 'AX'], // cut, cat, about
        'AO': ['AO', 'AA'], // caught, father
        'AW': ['AW', 'OW'], // cow, go
        'AY': ['AY', 'EY'], // price, face
        'EH': ['EH', 'IH'], // bed, bit
        'EY': ['EY', 'AY'], // face, price
        'IH': ['IH', 'EH', 'IY'], // bit, bed, fleece
        'IY': ['IY', 'IH'], // fleece, bit
        'OW': ['OW', 'AW'], // go, cow
        'OY': ['OY'], // boy
        'UH': ['UH', 'UW'], // foot, goose
        'UW': ['UW', 'UH'] // goose, foot
    };
    
    // Check if vowels are in the same similarity group
    for (const [key, group] of Object.entries(vowelGroups)) {
        if (group.includes(vowel1) && group.includes(vowel2)) {
            return 0.8; // High similarity
        }
    }
    
    // Check for partial matches
    for (const [key, group] of Object.entries(vowelGroups)) {
        if (group.includes(vowel1) || group.includes(vowel2)) {
            // Check if the other vowel is in any adjacent group
            for (const [otherKey, otherGroup] of Object.entries(vowelGroups)) {
                if (key !== otherKey && (group.includes(vowel1) || group.includes(vowel2))) {
                    return 0.6; // Medium similarity
                }
            }
        }
    }
    
    return 0.3; // Low similarity
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
let rhymeSortMode = 'similarity'; // 'default', 'alpha', 'phonetic', 'similarity'

function setRhymeSortMode(mode) {
    // If clicking the already active sort, revert to default
    if (rhymeSortMode === mode) {
        rhymeSortMode = 'default';
    } else {
        rhymeSortMode = mode;
    }
    updateRhymeSortButtonState();
    
    // Update modal header based on new sort mode
    updateModalHeader();
    
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
    rhymeSortMode = 'similarity';
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
function createRhymeListItem(rhymeWord, baseWordLower, tierInfo = null) {
    if (!ui.elements.rhymeResultsList) return;
    const wordLower = rhymeWord.toLowerCase();
    const li = document.createElement('li');
    li.textContent = rhymeWord;
    li.dataset.rhymeWord = rhymeWord;
    
    // Add click handler to select this rhyme word
    li.addEventListener('click', (e) => {
        // Don't trigger if clicking on icons
        if (e.target.classList.contains('rhyme-x') || e.target.classList.contains('rhyme-tag')) {
            return;
        }
        
        // Select the rhyme word
        selectRhymeWordFromModal(rhymeWord);
    });
    const freq = state.wordFrequencies[wordLower] || 0;
    if (freq >= 5) li.classList.add('rhyme-freq-high');
    else if (freq >= 2) li.classList.add('rhyme-freq-med');
    else if (freq === 1) li.classList.add('rhyme-freq-low');
    else li.classList.add('rhyme-freq-none');
    
    // Add tier class for similarity sort mode
    if (tierInfo && rhymeSortMode === 'similarity') {
        li.classList.add(`rhyme-tier-${tierInfo.tier}`);
        if (tierInfo.tier === 'perfect') {
            li.title = 'Perfect rhyme';
        } else if (tierInfo.tier === 'strong') {
            li.title = 'Strong near rhyme';
        } else if (tierInfo.tier === 'standard') {
            li.title = 'Standard near rhyme';
        } else if (tierInfo.tier === 'slant') {
            li.title = 'User-tagged slant rhyme';
        }
    }
    
    // Add tooltip functionality for tier info
    if (tierInfo && (tierInfo.tier === 'perfect' || tierInfo.tier === 'strong')) {
        let tooltipTimeout;
        let tooltip = null;
        
        li.addEventListener('mouseenter', () => {
            tooltipTimeout = setTimeout(() => {
                tooltip = document.createElement('div');
                tooltip.className = 'rhyme-tier-tooltip';
                
                // Calculate match value based on tier
                let matchValue = '';
                if (tierInfo.tier === 'perfect') {
                    matchValue = '100%';
                } else if (tierInfo.tier === 'strong') {
                    const basePhonemes = getPhonemes(state.currentWord);
                    const candidatePhonemes = getPhonemes(rhymeWord);
                    if (basePhonemes && candidatePhonemes) {
                        const score = calculateRhymeScore(basePhonemes, candidatePhonemes);
                        matchValue = `${Math.round(score * 100)}%`;
                    } else {
                        matchValue = '~70%';
                    }
                }
                
                tooltip.textContent = `Match: ${matchValue}`;
                document.body.appendChild(tooltip);
                
                // Position tooltip
                const rect = li.getBoundingClientRect();
                tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
                tooltip.style.top = `${rect.top - tooltip.offsetHeight - 8}px`;
                tooltip.style.opacity = '1';
            }, 1000); // 1 second delay
        });
        
        li.addEventListener('mouseleave', () => {
            if (tooltipTimeout) {
                clearTimeout(tooltipTimeout);
                tooltipTimeout = null;
            }
            if (tooltip) {
                tooltip.style.opacity = '0';
                setTimeout(() => {
                    if (tooltip && tooltip.parentNode) {
                        tooltip.parentNode.removeChild(tooltip);
                    }
                }, 200);
                tooltip = null;
            }
        });
    }
    
    // Add tier class for similarity sort mode
    if (tierInfo && rhymeSortMode === 'similarity') {
        li.classList.add(`rhyme-tier-${tierInfo.tier}`);
        if (tierInfo.tier === 'perfect') {
            li.title = 'Perfect rhyme';
        } else if (tierInfo.tier === 'strong') {
            li.title = 'Strong near rhyme';
        } else if (tierInfo.tier === 'standard') {
            li.title = 'Standard near rhyme';
        } else if (tierInfo.tier === 'slant') {
            li.title = 'User-tagged slant rhyme';
        }
    }
    
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
            displayRhymeList(baseWordLower);
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
            displayRhymeList(baseWordLower);
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
        displayRhymeList(currentBaseWordLower);
    };
    li.appendChild(tag);
    
    ui.elements.rhymeResultsList.appendChild(li);
}

// Update displayRhymeList to move tempRejected words to end and add tier separators
function displayRhymeList(baseWordLower) {
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
        if (rhymeSortMode === 'similarity') {
            // For similarity mode, add tier separators and tier info
            let currentTier = null;
            let lastTier = null;
            
            for (const word of finalList) {
                const wordLower = word.toLowerCase();
                const tierInfo = getTierInfo(word, baseWordLower);
                
                // Add separator if tier changes
                if (currentTier && currentTier !== tierInfo.tier && lastTier !== tierInfo.tier) {
                    addTierSeparator(tierInfo.tier);
                    lastTier = currentTier;
                }
                
                createRhymeListItem(word, baseWordLower, tierInfo);
                currentTier = tierInfo.tier;
            }
            
            // Trigger initial shimmer for gold and silver tiers
            setTimeout(() => {
                const perfectItems = ui.elements.rhymeResultsList.querySelectorAll('.rhyme-tier-perfect');
                const strongItems = ui.elements.rhymeResultsList.querySelectorAll('.rhyme-tier-strong');
                
                perfectItems.forEach(item => {
                    item.classList.add('shimmer-active');
                    setTimeout(() => item.classList.remove('shimmer-active'), 1500);
                });
                
                strongItems.forEach(item => {
                    item.classList.add('shimmer-active');
                    setTimeout(() => item.classList.remove('shimmer-active'), 1500);
                });
            }, 300); // Small delay to ensure elements are rendered
        } else {
            // For other modes, just create items normally
            finalList.forEach(match => createRhymeListItem(match, baseWordLower));
        }
        
        if (ui.elements.rhymeNoResults) ui.elements.rhymeNoResults.style.display = 'none';
    } else {
        if (ui.elements.rhymeNoResults) ui.elements.rhymeNoResults.style.display = 'block';
    }
    // Ensure keyboard focus is restored after rendering
    if (typeof window.updateRhymeModalFocus === 'function') {
        window.updateRhymeModalFocus();
    } else if (typeof updateRhymeModalFocus === 'function') {
        updateRhymeModalFocus();
    }
}

// Helper function to get tier information for a word
function getTierInfo(word, baseWordLower) {
    const wordLower = word.toLowerCase();
    const slantSet = state.slantRhymes[baseWordLower] || new Set();
    const manualSet = state.manualRhymes[baseWordLower] || new Set();
    
    if (slantSet.has(wordLower)) {
        return { tier: 'slant' };
    } else if (manualSet.has(wordLower)) {
        return { tier: 'standard' };
    } else {
        const basePhonemes = getPhonemes(state.currentWord);
        const candidatePhonemes = getPhonemes(word);
        
        if (basePhonemes && candidatePhonemes) {
            const score = calculateRhymeScore(basePhonemes, candidatePhonemes);
            if (score === 1.0) return { tier: 'perfect' };
            else if (score >= 0.5) return { tier: 'strong' };
            else if (score >= 0.2) return { tier: 'standard' };
            else return { tier: 'weak' };
        } else {
            return { tier: 'unknown' };
        }
    }
}

// Helper function to add tier separators
function addTierSeparator(tier) {
    if (!ui.elements.rhymeResultsList) return;
    
    const separator = document.createElement('div');
    separator.className = 'rhyme-tier-separator';
    separator.style.cssText = `
        width: 100%;
        height: 1px;
        background: linear-gradient(90deg, transparent, var(--border-color), transparent);
        margin: 8px 0;
        flex-basis: 100%;
    `;
    
    // Add tier label
    const label = document.createElement('span');
    label.className = 'rhyme-tier-label';
    label.textContent = getTierLabel(tier);
    label.style.cssText = `
        display: block;
        text-align: center;
        font-size: 0.8em;
        color: var(--text-color);
        opacity: 0.7;
        margin: 4px 0;
        font-style: italic;
    `;
    
    ui.elements.rhymeResultsList.appendChild(separator);
    ui.elements.rhymeResultsList.appendChild(label);
}

// Helper function to get tier labels
function getTierLabel(tier) {
    switch (tier) {
        case 'perfect': return 'Perfect Rhymes';
        case 'strong': return 'Strong Near Rhymes';
        case 'standard': return 'Standard Near Rhymes';
        case 'slant': return 'User-Tagged Slant Rhymes';
        default: return 'Other Rhymes';
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
    const basePhonemes = getPhonemes(baseWord);
    const baseWordLower = baseWord.toLowerCase();
    const slantSet = state.slantRhymes[baseWordLower] || new Set();
    const manualSet = state.manualRhymes[baseWordLower] || new Set();
    
    // Calculate rhyme scores for all words
    const wordScores = [];
    for (const word of words) {
        const wordLower = word.toLowerCase();
        const candidatePhonemes = getPhonemes(word);
        
        if (slantSet.has(wordLower)) {
            // User-tagged slant rhymes get a special score
            wordScores.push({ word, score: 0.5, category: 'slant' });
        } else if (manualSet.has(wordLower)) {
            // Manual rhymes get a medium score
            wordScores.push({ word, score: 0.7, category: 'manual' });
        } else if (basePhonemes && candidatePhonemes) {
            // Calculate actual rhyme score
            const score = calculateRhymeScore(basePhonemes, candidatePhonemes);
            let category = 'near';
            if (score === 1.0) category = 'perfect';
            else if (score >= 0.5) category = 'strong';
            else if (score >= 0.2) category = 'medium';
            else category = 'weak';
            wordScores.push({ word, score, category });
        } else {
            // No phonetic data available
            wordScores.push({ word, score: 0.0, category: 'unknown' });
        }
    }
    
    // Sort by score (descending), then by category priority, then alphabetically
    wordScores.sort((a, b) => {
        // First by score
        if (Math.abs(a.score - b.score) > 0.01) {
            return b.score - a.score;
        }
        
        // Then by category priority
        const categoryOrder = { 'perfect': 0, 'strong': 1, 'medium': 2, 'manual': 3, 'slant': 4, 'weak': 5, 'unknown': 6 };
        const catDiff = categoryOrder[a.category] - categoryOrder[b.category];
        if (catDiff !== 0) return catDiff;
        
        // Finally alphabetically
        return a.word.localeCompare(b.word);
    });
    
    return wordScores.map(ws => ws.word);
}

// --- Update Modal Header ---
// Updates the modal header based on current sort mode
function updateModalHeader() {
    if (!ui.elements.rhymeModalDynamicHeading) return;
    
    const baseWord = state.currentWord;
    if (!baseWord || baseWord === "NO WORDS!") return;
    
    const headingHTML = createModalHeaderHTML(baseWord, rhymeSortMode);
    ui.elements.rhymeModalDynamicHeading.innerHTML = headingHTML;
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

    // Update modal header with initial sort mode
    updateModalHeader();

    // Clear previous results and input
    if (ui.elements.rhymeResultsList) ui.elements.rhymeResultsList.innerHTML = '';
    if (ui.elements.rhymeNoResults) ui.elements.rhymeNoResults.style.display = 'none';
    if (ui.elements.manualRhymeInput) ui.elements.manualRhymeInput.value = '';

    // Populate List
    displayRhymeList(baseWordLower); // Calls internal helper which calls getValidRhymesForWord

    modal.openModal(ui.elements.rhymeFinderModal);
}

// --- addManualRhyme (EXPORTED) ---
// Allows user to manually add a rhyme for the current base word
export function addManualRhyme() {
    if (!ui.elements.manualRhymeInput) return;
    const suggestedWord = ui.elements.manualRhymeInput.value.trim();
    const baseWord = state.currentWord;
    const baseWordLower = baseWord?.toLowerCase();
    if (!suggestedWord || !baseWordLower || baseWord === "NO WORDS!") { return; }
    if (suggestedWord.toLowerCase() === baseWordLower) { return; }
    console.log(`Manually adding rhyme: "${suggestedWord}" for base word "${baseWord}"`);
    if (!state.manualRhymes[baseWordLower]) state.manualRhymes[baseWordLower] = new Set();
    if (state.manualRhymes[baseWordLower].has(suggestedWord)) { return; }
    state.manualRhymes[baseWordLower].add(suggestedWord);
    storage.saveSettings();
    // Refresh the displayed list
    displayRhymeList(baseWordLower); // Re-render list
    ui.showFeedback(`"${suggestedWord}" added to manual rhymes for "${baseWord}".`);
    ui.elements.manualRhymeInput.value = '';
}

// --- selectRhymeWordFromModal (INTERNAL) ---
// Handles selecting a rhyme word from the modal
function selectRhymeWordFromModal(rhymeWord) {
    // Find the word in the current rhyme list and select it
    const rhymeList = state.currentRhymeList;
    const index = rhymeList.indexOf(rhymeWord);
    
    if (index !== -1) {
        // Update the rhyme index
        state.currentRhymeIndex = index;
        
        // Display the selected rhyme word
        ui.displayWord(rhymeWord);
        
        // Close the modal
        modal.closeModal(ui.elements.rhymeFinderModal);
        
        // Show feedback
        ui.showFeedback(`Selected: ${rhymeWord}`, false, 1500);
    }
}