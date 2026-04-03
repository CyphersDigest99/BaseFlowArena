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
import * as phonetics from './phonetics.js';

// --- Score cache: avoids re-scoring in getTierInfo/sort after getValidRhymesForWord ---
let rhymeScoreCache = new Map();

// --- Tier thresholds (from spec) ---
const SCORE_THRESHOLD = 0.45;
const TIER_PERFECT = 0.85;
const TIER_STRONG = 0.65;
const TIER_STANDARD = 0.50;

// --- Load Rhyme Data ---
// Loads rhyme data from JSON file and updates state
export async function loadRhymeData() {
    console.log("Loading rhyme data...");
    try {
        const response = await fetch('public/rhyme_data.json');
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
// Retrieves the rhyme pattern array for a given word, delegating to phonetics module
function getRhymePattern(word) {
    return phonetics.getPattern(word);
}

// --- Get Phonemes (Internal) ---
// Retrieves the complete phoneme array for a given word via phonetics module
function getPhonemes(word) {
    return phonetics.getFullPhonemes(word);
}

// --- Extract Rhyming Part (for modal header display) ---
// Extracts from the last stressed vowel to end of word
function extractRhymingPart(phonemes) {
    if (!Array.isArray(phonemes) || phonemes.length === 0) return null;

    // Last stressed vowel (marker 1 or 2)
    for (let i = phonemes.length - 1; i >= 0; i--) {
        if (/[AEIOU]/.test(phonemes[i][0]) && /[12]$/.test(phonemes[i])) {
            return phonemes.slice(i);
        }
    }
    // Fallback: last vowel of any stress
    for (let i = phonemes.length - 1; i >= 0; i--) {
        if (/[AEIOU]/.test(phonemes[i][0])) {
            return phonemes.slice(i);
        }
    }
    return phonemes.slice(-3);
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
        // For similarity mode, show only the vowel sounds from the phonetic ending
        const phonemes = getPhonemes(baseWord);
        if (phonemes) {
            const rhymingPart = extractRhymingPart(phonemes);
            if (rhymingPart && rhymingPart.length > 0) {
                const vowelBlocks = rhymingPart
                    .filter(phoneme => /[AEIOU]/.test(phoneme[0]))
                    .map(phoneme => {
                        const cleanPhoneme = phoneme.replace(/[012]$/, '');
                        return `<span class="vowel-pattern-block">${cleanPhoneme}</span>`;
                    }).join(' ');

                patternDisplay = vowelBlocks || 'no vowel data';
                patternType = 'vowel sounds';
            } else {
                patternDisplay = 'unknown pattern';
                patternType = 'phonetic ending';
            }
        } else {
            patternDisplay = 'no phonetic data';
            patternType = 'phonetic ending';
        }
    } else {
        // For other modes, show the bare vowel pattern
        const wordPattern = getRhymePattern(baseWord);
        if (wordPattern && wordPattern.length > 0) {
            const vowelBlocks = wordPattern.map(entry => {
                return `<span class="vowel-pattern-block">${entry}</span>`;
            }).join(' ');
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

// --- Get Valid Rhymes for a Word ---
// Returns a sorted list of valid rhymes using scored candidates from the full CMU vocabulary
export function getValidRhymesForWord(baseWord) {
    if (!baseWord) return [];

    const baseWordLower = baseWord.toLowerCase();
    const wordPattern = getRhymePattern(baseWord);

    const rejectedSet = state.rejectedRhymes[baseWordLower] || new Set();
    const manualSet = state.manualRhymes[baseWordLower] || new Set();

    // Clear score cache for this base word
    rhymeScoreCache = new Map();

    // Score candidates from inverted index
    let scoredMatches = [];
    if (wordPattern) {
        const patternString = wordPattern.join('-');
        const candidates = phonetics.getCandidatesForPattern(patternString);

        for (const word of candidates) {
            const wordLower = word.toLowerCase();
            if (wordLower === baseWordLower) continue;
            if (rejectedSet.has(wordLower)) continue;

            const score = phonetics.rhymeScore(baseWordLower, wordLower);
            if (score >= SCORE_THRESHOLD) {
                scoredMatches.push({ word, score });
                rhymeScoreCache.set(`${baseWordLower}|${wordLower}`, score);
            }
        }
    }

    // Add manual rhymes (bypass threshold)
    for (const manualWord of manualSet) {
        const manualLower = manualWord.toLowerCase();
        if (manualLower === baseWordLower) continue;
        if (!scoredMatches.find(m => m.word.toLowerCase() === manualLower)) {
            const score = phonetics.rhymeScore(baseWordLower, manualLower) || 0.7;
            scoredMatches.push({ word: manualWord, score });
            rhymeScoreCache.set(`${baseWordLower}|${manualLower}`, score);
        }
    }

    // Sort by score descending
    scoredMatches.sort((a, b) => b.score - a.score);

    return scoredMatches.map(m => m.word);
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

    const baseContext = phonetics.getVowelContext(baseWordLower);

    for (const word of tempRejected) {
        const wordLower = word.toLowerCase();
        state.rejectedRhymes[baseWordLower].add(wordLower);

        // Log rejection with phonetic context
        state.rejectionLog.push({
            base: baseWordLower,
            rejected: wordLower,
            base_context: baseContext,
            rejected_context: phonetics.getVowelContext(wordLower),
            timestamp: new Date().toISOString().split('T')[0]
        });
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
    
    // Store tier data on the element for delegated tooltip handling
    if (tierInfo && (tierInfo.tier === 'perfect' || tierInfo.tier === 'strong')) {
        li.dataset.tier = tierInfo.tier;
        li.dataset.rhymeWord = rhymeWord;
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

// Delegated tooltip handler — one listener pair on the list container instead of per-item.
// Avoids memory leaks when the list is cleared and rebuilt.
let _tooltipDelegationBound = false;
let _activeTooltip = null;
let _activeTooltipTimeout = null;

function setupRhymeTooltipDelegation(listEl) {
    if (_tooltipDelegationBound) return;
    _tooltipDelegationBound = true;

    listEl.addEventListener('mouseenter', (e) => {
        const li = e.target.closest('li[data-tier]');
        if (!li) return;

        _activeTooltipTimeout = setTimeout(() => {
            const rhymeWord = li.dataset.rhymeWord;
            const baseWordLower = state.currentWord?.toLowerCase();
            const wordLower = rhymeWord?.toLowerCase();
            const cacheKey = `${baseWordLower}|${wordLower}`;
            let score = rhymeScoreCache.get(cacheKey);
            if (score === undefined) {
                score = phonetics.rhymeScore(baseWordLower, wordLower);
            }
            const matchValue = `${Math.round(score * 100)}%`;

            _activeTooltip = document.createElement('div');
            _activeTooltip.className = 'rhyme-tier-tooltip';
            _activeTooltip.textContent = `Match: ${matchValue}`;
            document.body.appendChild(_activeTooltip);

            const rect = li.getBoundingClientRect();
            _activeTooltip.style.left = `${rect.left + rect.width / 2 - _activeTooltip.offsetWidth / 2}px`;
            _activeTooltip.style.top = `${rect.top - _activeTooltip.offsetHeight - 8}px`;
            _activeTooltip.style.opacity = '1';
        }, 1000);
    }, true); // useCapture for mouseenter delegation

    listEl.addEventListener('mouseleave', (e) => {
        const li = e.target.closest('li[data-tier]');
        if (!li) return;

        if (_activeTooltipTimeout) {
            clearTimeout(_activeTooltipTimeout);
            _activeTooltipTimeout = null;
        }
        if (_activeTooltip) {
            const tip = _activeTooltip;
            tip.style.opacity = '0';
            setTimeout(() => { if (tip.parentNode) tip.remove(); }, 200);
            _activeTooltip = null;
        }
    }, true);
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
    setupRhymeTooltipDelegation(ui.elements.rhymeResultsList);

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

    if (slantSet.has(wordLower)) {
        return { tier: 'slant' };
    }

    // Use cached score from getValidRhymesForWord, or compute fresh
    const cacheKey = `${baseWordLower}|${wordLower}`;
    let score = rhymeScoreCache.get(cacheKey);
    if (score === undefined) {
        score = phonetics.rhymeScore(baseWordLower, wordLower);
        rhymeScoreCache.set(cacheKey, score);
    }

    if (score >= TIER_PERFECT) return { tier: 'perfect', score };
    if (score >= TIER_STRONG) return { tier: 'strong', score };
    if (score >= TIER_STANDARD) return { tier: 'standard', score };
    return { tier: 'slant', score };
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

// --- Rhyme Similarity Sort ---
function sortByRhymeSimilarity(words, baseWord) {
    const baseWordLower = baseWord.toLowerCase();
    const slantSet = state.slantRhymes[baseWordLower] || new Set();

    const wordScores = [];
    for (const word of words) {
        const wordLower = word.toLowerCase();

        // Use cached score
        const cacheKey = `${baseWordLower}|${wordLower}`;
        let score = rhymeScoreCache.get(cacheKey);
        if (score === undefined) {
            score = phonetics.rhymeScore(baseWordLower, wordLower);
            rhymeScoreCache.set(cacheKey, score);
        }

        let category;
        if (slantSet.has(wordLower)) {
            category = 'slant';
        } else if (score >= TIER_PERFECT) {
            category = 'perfect';
        } else if (score >= TIER_STRONG) {
            category = 'strong';
        } else if (score >= TIER_STANDARD) {
            category = 'standard';
        } else {
            category = 'weak';
        }

        wordScores.push({ word, score, category });
    }

    wordScores.sort((a, b) => {
        if (Math.abs(a.score - b.score) > 0.01) return b.score - a.score;
        const categoryOrder = { perfect: 0, strong: 1, standard: 2, manual: 3, slant: 4, weak: 5, unknown: 6 };
        const catDiff = (categoryOrder[a.category] ?? 6) - (categoryOrder[b.category] ?? 6);
        if (catDiff !== 0) return catDiff;
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

    // Attach click handlers to nav buttons
    attachHeaderNavHandlers();
}

// --- Attach Header Nav Button Handlers ---
// Wires up the prev/next buttons in the modal header
function attachHeaderNavHandlers() {
    const prevBtn = document.getElementById('rhyme-header-prev');
    const nextBtn = document.getElementById('rhyme-header-next');

    if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            navigateWordInModal('previous');
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            navigateWordInModal('next');
        });
    }
}

// --- Navigate Word In Modal ---
// Changes to prev/next word and refreshes the modal
function navigateWordInModal(direction) {
    // Get current word index in filtered list
    const currentIndex = state.filteredWordList.indexOf(state.currentWord);
    if (currentIndex === -1) return;

    // Calculate new index
    let newIndex;
    if (direction === 'previous') {
        newIndex = (currentIndex - 1 + state.filteredWordList.length) % state.filteredWordList.length;
    } else {
        newIndex = (currentIndex + 1) % state.filteredWordList.length;
    }

    // Update state
    const newWord = state.filteredWordList[newIndex];
    state.currentWord = newWord;
    state.currentWordIndex = newIndex;
    state.currentRhymeIndex = -1;
    state.currentRhymeList = getValidRhymesForWord(newWord);

    // Update the main display behind the modal
    ui.displayWord(newWord);

    // Refresh modal content
    updateModalHeader();
    displayRhymeList(newWord.toLowerCase());
}

// --- Get Currently Displayed Word ---
// Returns the word currently being displayed (could be base word or a rhyme)
function getDisplayedWord() {
    // If we're viewing a rhyme (navigated up/down), use that rhyme word
    if (state.currentRhymeIndex >= 0 &&
        state.currentRhymeList &&
        state.currentRhymeList.length > 0 &&
        state.currentRhymeList[state.currentRhymeIndex]) {
        return state.currentRhymeList[state.currentRhymeIndex];
    }
    // Otherwise use the base word
    return state.currentWord;
}

// --- Show Rhyme Finder Modal ---
// Opens the rhyme finder modal and populates it with rhymes for the current word
export function showRhymeFinder() {
    if (!state.rhymeData) {
        ui.showFeedback("Rhyme data not loaded. Please wait or refresh the page.", true);
        return;
    }

    // Get the currently displayed word (could be a rhyme if navigating up/down)
    const displayedWord = getDisplayedWord();

    // Update state.currentWord to the displayed word so modal shows correct rhymes
    // Also reset rhyme navigation since we're now treating this as the new base word
    if (displayedWord !== state.currentWord) {
        state.currentWord = displayedWord;
        state.currentRhymeIndex = -1;
        // Populate rhyme list for the new base word
        state.currentRhymeList = getValidRhymesForWord(displayedWord);
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