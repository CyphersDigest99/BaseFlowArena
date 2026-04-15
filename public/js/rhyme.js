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
import * as wordManager from './wordManager.js'; // For delegating blacklist-from-modal flow (cycle is safe: only accessed at click time)
import { animate } from './anime.esm.min.js';

// --- Score cache: avoids re-scoring in getTierInfo/sort after getValidRhymesForWord ---
let rhymeScoreCache = new Map();

// --- Tier thresholds (from spec) ---
const SCORE_THRESHOLD = 0.45;
const MAX_RHYME_RESULTS = 200;
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
function createModalHeaderHTML(baseWord, rhymeSortMode, rhymeList) {
    const baseWordLower = baseWord.toLowerCase();
    const rhymeMatches = rhymeList || getValidRhymesForWord(baseWord);
    const matchCount = rhymeMatches.length;
    const totalBeforeCap = rhymeMatches._totalBeforeCap || matchCount;
    const wasCapped = totalBeforeCap > matchCount;
    const countLabel = wasCapped ? `${matchCount} of ${totalBeforeCap}` : `${matchCount}`;
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
    
    // Add focusable header with prev/next buttons and blacklist
    const isBlacklisted = state.blacklist.has(baseWord.toUpperCase());
    return `
        <button id="rhyme-header-blacklist" class="word-action-icon blacklist-icon${isBlacklisted ? ' active' : ''}" title="Blacklist Word"><i class="fas fa-ban"></i></button>
        <button id="rhyme-header-pin" class="word-action-icon pin-mode-btn${state.favorites.has(baseWordLower) ? ' active' : ''}" title="${state.favorites.has(baseWordLower) ? 'Remove from favorites' : 'Add to favorites'}"><i class="fas fa-star"></i></button>
        <div>${countLabel} ${wordText}</div>
        <div>sound like the</div>
        <div style="margin: 8px 0;">${patternDisplay}</div>
        <div>in</div>
        <div class="rhyme-header-focus-row">
            <button id="rhyme-header-prev" class="rhyme-header-nav" tabindex="-1" aria-label="Previous word"><i class='fas fa-angle-left'></i></button>
            <span id="rhyme-header-word" class="rhyme-header-word" tabindex="0">${baseWord.toUpperCase()}</span>
            <button id="rhyme-header-next" class="rhyme-header-nav" tabindex="-1" aria-label="Next word"><i class='fas fa-angle-right'></i></button>
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

    // Track seen words for dedup (lowercase -> { word, score })
    const seen = new Map();

    // Score candidates from inverted index.
    // Skipped when a "sounds like" alias is set — the alias fully replaces the
    // base word's native phoneme pool. Manual rhymes (manualSet) are still kept.
    const aliasSet = state.rhymeAliases[baseWordLower];
    if (wordPattern && !aliasSet) {
        const patternString = wordPattern.join('-');
        const candidates = phonetics.getCandidatesForPattern(patternString);

        for (const word of candidates) {
            const wordLower = word.toLowerCase();
            if (wordLower === baseWordLower) continue;
            if (rejectedSet.has(wordLower)) continue;
            if (state.rhymeVocabulary && !state.rhymeVocabulary.has(wordLower)) continue;

            const score = phonetics.rhymeScore(baseWordLower, wordLower);
            if (score >= SCORE_THRESHOLD) {
                seen.set(wordLower, { word, score });
                rhymeScoreCache.set(`${baseWordLower}|${wordLower}`, score);
            }
        }
    }

    // Alias candidates: for each alias, pull its candidates and score against the alias word
    if (aliasSet) {
        for (const aliasWord of aliasSet) {
            const aliasPattern = getRhymePattern(aliasWord);
            if (!aliasPattern) continue;

            const aliasPatternString = aliasPattern.join('-');
            const aliasCandidates = phonetics.getCandidatesForPattern(aliasPatternString);

            for (const word of aliasCandidates) {
                const wordLower = word.toLowerCase();
                if (wordLower === baseWordLower) continue;
                if (rejectedSet.has(wordLower)) continue;
                if (state.rhymeVocabulary && !state.rhymeVocabulary.has(wordLower)) continue;

                const score = phonetics.rhymeScore(aliasWord, wordLower);
                if (score >= SCORE_THRESHOLD) {
                    const existing = seen.get(wordLower);
                    if (!existing || score > existing.score) {
                        seen.set(wordLower, { word, score });
                        rhymeScoreCache.set(`${baseWordLower}|${wordLower}`, score);
                    }
                }
            }
        }
    }

    // Add manual rhymes (bypass threshold)
    for (const manualWord of manualSet) {
        const manualLower = manualWord.toLowerCase();
        if (manualLower === baseWordLower) continue;
        if (!seen.has(manualLower)) {
            const score = phonetics.rhymeScore(baseWordLower, manualLower) || 0.7;
            seen.set(manualLower, { word: manualWord, score });
            rhymeScoreCache.set(`${baseWordLower}|${manualLower}`, score);
        }
    }

    // Sort by score descending
    const scoredMatches = Array.from(seen.values());
    scoredMatches.sort((a, b) => b.score - a.score);

    const totalCount = scoredMatches.length;
    const capped = scoredMatches.slice(0, MAX_RHYME_RESULTS);
    const result = capped.map(m => m.word);
    result._totalBeforeCap = totalCount;
    return result;
}

// --- Rhyme Finder Sorting State ---
// Persist sort preference across sessions
const RHYME_SORT_KEY = 'rhymenexus-rhyme-sort-mode';
const _savedSort = (() => { try { return localStorage.getItem(RHYME_SORT_KEY); } catch { return null; } })();
let rhymeSortMode = _savedSort || 'similarity'; // 'default', 'alpha', 'phonetic', 'similarity', 'random'

function setRhymeSortMode(mode) {
    // If clicking the already active sort, revert to default
    if (rhymeSortMode === mode) {
        rhymeSortMode = 'default';
    } else {
        rhymeSortMode = mode;
    }
    try { localStorage.setItem(RHYME_SORT_KEY, rhymeSortMode); } catch {}
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
        { id: 'sort-similarity', mode: 'similarity' },
        { id: 'sort-random', mode: 'random' },
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
    const btnRandom = document.getElementById('sort-random');
    if (btnAlpha) btnAlpha.onclick = () => setRhymeSortMode('alpha');
    if (btnPhonetic) btnPhonetic.onclick = () => setRhymeSortMode('phonetic');
    if (btnSimilarity) btnSimilarity.onclick = () => setRhymeSortMode('similarity');
    if (btnRandom) btnRandom.onclick = () => setRhymeSortMode('random');
}

// --- Temporary Rejection State (modal-local) ---
let tempRejected = new Set();

// --- Pin Selection State (modal-local) ---
let isSelectionMode = false;
let pendingPins = new Set();

// --- Rhyme Modal Toast ---
// Shows a brief notification inside the rhyme modal (above the modal overlay)
function showRhymeToast(message, isError = false) {
    const toast = document.getElementById('rhyme-modal-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `rhyme-modal-toast ${isError ? 'error' : 'success'}`;
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.textContent = '';
        toast.className = 'rhyme-modal-toast';
    }, 2500);
}

// --- Plural Collapse Map (rebuilt each displayRhymeList call) ---
// Maps wordLower → display string (e.g. "critic" → "critic/s")
let currentPluralMap = new Map();

// Scans a word list for singular/plural pairs and returns:
//   skipSet   — plural forms to hide (their base handles display)
//   displayMap — base word → display string with /s or /es suffix
function buildPluralMap(words) {
    const wordSet = new Set(words.map(w => w.toLowerCase()));
    const skipSet = new Set();
    const displayMap = new Map();
    for (const word of words) {
        const wl = word.toLowerCase();
        if (skipSet.has(wl)) continue;
        if (wordSet.has(wl + 's')) {
            skipSet.add(wl + 's');
            displayMap.set(wl, word + '/s');
        } else if (/(?:s|sh|ch|x|z|o)$/.test(wl) && wordSet.has(wl + 'es')) {
            skipSet.add(wl + 'es');
            displayMap.set(wl, word + '/es');
        }
    }
    return { skipSet, displayMap };
}

// --- Feedback Card State (session-local, not persisted) ---
let pendingFeedback = new Map();   // rejectedWord -> { reasons: [], remark: '' }
let lastCardDismissTime = 0;
let lastCardHadFeedback = false;
let skipCounter = 0;
let consecutiveEmptyDismissals = 0;
let feedbackHidden = false;
const RAPID_FIRE_MS = 5000;

// --- Enhanced Modal Open with Sorting ---
export function openRhymeFinderModalWithSort() {
    tempRejected = new Set();
    isSelectionMode = false;
    pendingPins = new Set();
    pendingFeedback = new Map();
    lastCardDismissTime = 0;
    lastCardHadFeedback = false;
    skipCounter = 0;
    consecutiveEmptyDismissals = 0;
    feedbackHidden = false;
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

        // Merge pending feedback if available
        const fb = pendingFeedback.get(wordLower);
        state.rejectionLog.push({
            base: baseWordLower,
            rejected: wordLower,
            base_context: baseContext,
            rejected_context: phonetics.getVowelContext(wordLower),
            flaggedPhonemes: fb?.flaggedPhonemes || [],
            notAWord: fb?.notAWord || false,
            remark: fb?.remark || '',
            skipped: !fb,
            timestamp: new Date().toISOString().split('T')[0]
        });
    }
    storage.saveSettings();
    pendingFeedback.clear();
    tempRejected.clear();
}

function renderPhonemeComparison(comparison, baseWord, rejectedWord, flagState) {
    const section = document.createElement('div');
    section.className = 'feedback-phoneme-section';

    // Row for word 1
    const row1 = document.createElement('div');
    row1.className = 'feedback-phoneme-row';
    const label1 = document.createElement('span');
    label1.className = 'word-label';
    label1.textContent = baseWord;
    row1.appendChild(label1);

    // Row for word 2
    const row2 = document.createElement('div');
    row2.className = 'feedback-phoneme-row';
    const label2 = document.createElement('span');
    label2.className = 'word-label';
    label2.textContent = rejectedWord;
    row2.appendChild(label2);

    // Pre-segment context (phonemes before the rhyming segment, shown smaller/faded)
    const preSeg1 = comparison.fullPhonemes1.slice(0, comparison.fullPhonemes1.length - comparison.segment1.length);
    const preSeg2 = comparison.fullPhonemes2.slice(0, comparison.fullPhonemes2.length - comparison.segment2.length);
    const maxPre = Math.max(preSeg1.length, preSeg2.length);

    for (let i = 0; i < maxPre; i++) {
        const ph1 = i < preSeg1.length ? preSeg1[i] : null;
        const ph2 = i < preSeg2.length ? preSeg2[i] : null;

        if (ph1) {
            const block = document.createElement('span');
            const isVowel = /[AEIOU]/.test(ph1[0]);
            block.className = isVowel ? 'feedback-vowel-block' : 'feedback-consonant-block';
            block.textContent = ph1.replace(/[012]$/, '');
            block.style.opacity = '0.6';
            block.style.fontSize = '0.65em';
            row1.appendChild(block);
        } else {
            row1.appendChild(Object.assign(document.createElement('span'), { className: 'feedback-empty-block' }));
        }

        if (ph2) {
            const block = document.createElement('span');
            const isVowel = /[AEIOU]/.test(ph2[0]);
            block.className = isVowel ? 'feedback-vowel-block' : 'feedback-consonant-block';
            block.textContent = ph2.replace(/[012]$/, '');
            block.style.opacity = '0.6';
            block.style.fontSize = '0.65em';
            row2.appendChild(block);
        } else {
            row2.appendChild(Object.assign(document.createElement('span'), { className: 'feedback-empty-block' }));
        }
    }

    for (let i = 0; i < comparison.pairs.length; i++) {
        const pair = comparison.pairs[i];

        // Word 1 block (static — reference only)
        if (pair.p1) {
            const block1 = document.createElement('span');
            block1.className = pair.p1.isVowel ? 'feedback-vowel-block' : 'feedback-consonant-block';
            block1.textContent = pair.p1.clean;
            if (pair.mismatch) block1.classList.add('feedback-mismatch');
            else if (pair.match) block1.classList.add('feedback-match-good');
            row1.appendChild(block1);
        } else {
            const empty = document.createElement('span');
            empty.className = 'feedback-empty-block';
            row1.appendChild(empty);
        }

        // Word 2 block (clickable — user flags problem phonemes)
        if (pair.p2) {
            const block2 = document.createElement('span');
            block2.className = pair.p2.isVowel ? 'feedback-vowel-block' : 'feedback-consonant-block';
            block2.textContent = pair.p2.clean;
            if (pair.mismatch) block2.classList.add('feedback-mismatch');
            else if (pair.match) block2.classList.add('feedback-match-good');
            block2.style.cursor = 'pointer';
            block2.addEventListener('click', () => {
                const existing = flagState.flaggedPhonemes.findIndex(fp => fp.index === i);
                if (existing >= 0) {
                    flagState.flaggedPhonemes.splice(existing, 1);
                    block2.classList.remove('feedback-flagged');
                } else {
                    flagState.flaggedPhonemes.push({
                        b: pair.p2.clean,
                        a: pair.p1 ? pair.p1.clean : null,
                        index: i,
                    });
                    block2.classList.add('feedback-flagged');
                }
            });
            row2.appendChild(block2);
        } else {
            const empty = document.createElement('span');
            empty.className = 'feedback-empty-block';
            row2.appendChild(empty);
        }
    }

    section.appendChild(row1);
    section.appendChild(row2);
    return section;
}

function showFeedbackCard(baseWord, rejectedWord) {
    // Remove any existing card first
    closeFeedbackCard(false);

    const baseWordLower = baseWord.toLowerCase();
    const rejectedWordLower = rejectedWord.toLowerCase();
    const comparison = phonetics.getAlignedComparison(baseWordLower, rejectedWordLower);

    // Build backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'feedback-card-backdrop';
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) closeFeedbackCard(true);
    });

    // Build card
    const card = document.createElement('div');
    card.className = 'feedback-card';

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'feedback-card-close';
    closeBtn.textContent = '\u00d7';
    closeBtn.onclick = () => {
        tempRejected.delete(rejectedWordLower);
        displayRhymeList(baseWordLower);
        closeFeedbackCard(false);
    };
    card.appendChild(closeBtn);

    // Header: word pair + match %
    const header = document.createElement('div');
    header.className = 'feedback-card-header';
    const wordsDiv = document.createElement('div');
    wordsDiv.className = 'feedback-card-words';
    wordsDiv.innerHTML = `<span>${baseWord}</span><span class="feedback-vs">vs</span><span>${rejectedWord}</span>`;
    header.appendChild(wordsDiv);

    if (comparison) {
        const matchDiv = document.createElement('div');
        matchDiv.className = 'feedback-card-match';
        matchDiv.textContent = `${comparison.matchPercent}% match`;
        header.appendChild(matchDiv);
    }
    card.appendChild(header);

    // Phoneme comparison
    const flagState = { flaggedPhonemes: [] };
    if (comparison) {
        card.appendChild(renderPhonemeComparison(comparison, baseWord, rejectedWord, flagState));
    }

    // "Not a word" escape hatch
    const notAWordRef = { active: false };
    const notAWordBtn = document.createElement('button');
    notAWordBtn.className = 'feedback-not-a-word';
    notAWordBtn.textContent = 'not a word';
    notAWordBtn.type = 'button';
    notAWordBtn.addEventListener('click', () => {
        notAWordRef.active = true;
        closeFeedbackCard(true);
    });
    card.appendChild(notAWordBtn);

    // Remark input
    const remark = document.createElement('input');
    remark.type = 'text';
    remark.className = 'feedback-remark';
    remark.placeholder = 'Quick note (optional)...';
    card.appendChild(remark);

    // Keyboard handler: Escape to dismiss, Enter to submit
    const keyHandler = (e) => {
        if (e.key === 'Escape') {
            closeFeedbackCard(true);
        } else if (e.key === 'Enter') {
            closeFeedbackCard(true);
        }
    };
    document.addEventListener('keydown', keyHandler);

    // Store references for closeFeedbackCard
    backdrop._feedbackState = {
        rejectedWordLower,
        flagState,
        notAWordRef,
        remarkInput: remark,
        keyHandler,
    };

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);
}

function closeFeedbackCard(saveFeedback) {
    const backdrop = document.querySelector('.feedback-card-backdrop');
    if (!backdrop) return;

    // Always clean up escape handler
    if (backdrop._feedbackState?.keyHandler) {
        document.removeEventListener('keydown', backdrop._feedbackState.keyHandler);
    }

    if (saveFeedback && backdrop._feedbackState) {
        const { rejectedWordLower, flagState, notAWordRef, remarkInput } = backdrop._feedbackState;
        const flaggedPhonemes = flagState.flaggedPhonemes;
        const notAWord = notAWordRef.active;
        const remarkText = remarkInput.value.trim();
        const hadFeedback = flaggedPhonemes.length > 0 || notAWord || remarkText.length > 0;

        // Always write to pendingFeedback so persistTempRejections knows card was shown
        pendingFeedback.set(rejectedWordLower, {
            flaggedPhonemes,
            notAWord,
            remark: remarkText,
        });

        lastCardHadFeedback = hadFeedback;
        lastCardDismissTime = Date.now();

        if (!hadFeedback) {
            skipCounter++;
            consecutiveEmptyDismissals++;
            updateSkipBadge();
            if (consecutiveEmptyDismissals >= 2) {
                showHideFeedbackButton();
            }
        } else {
            consecutiveEmptyDismissals = 0;
        }

        showRejectionToast();
    }

    backdrop.remove();
}

function showRejectionToast() {
    // Remove any existing toast
    const old = document.querySelector('.rejection-toast');
    if (old) old.remove();

    const totalRejections = state.rejectionLog.length + tempRejected.size;

    const toast = document.createElement('div');
    toast.className = 'rejection-toast';
    toast.innerHTML = `Rejection feedback received <span class="rejection-toast-count">#${totalRejections}</span>`;
    document.body.appendChild(toast);

    // Auto-remove after 3s — slide up and out
    setTimeout(() => {
        toast.classList.add('rejection-toast-exit');
        setTimeout(() => toast.remove(), 400);
    }, 1500);
}

function updateSkipBadge() {
    const modalContent = ui.elements.rhymeFinderModal?.querySelector('.modal-content');
    if (!modalContent) return;

    let badge = modalContent.querySelector('.feedback-skip-badge');
    if (skipCounter > 0) {
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'feedback-skip-badge';
            modalContent.style.position = 'relative';
            modalContent.appendChild(badge);
        }
        badge.textContent = `${skipCounter} skipped`;
    } else if (badge) {
        badge.remove();
    }
}

function showHideFeedbackButton() {
    const modalContent = ui.elements.rhymeFinderModal?.querySelector('.modal-content');
    if (!modalContent || modalContent.querySelector('.feedback-hide-btn')) return;

    const btn = document.createElement('button');
    btn.className = 'feedback-hide-btn';
    btn.textContent = 'Hide feedback';
    btn.onclick = () => {
        feedbackHidden = true;
        btn.remove();
    };
    modalContent.appendChild(btn);
}

// Update createRhymeListItem for temp rejection/undo and slant tagging
function createRhymeListItem(rhymeWord, baseWordLower, tierInfo = null) {
    if (!ui.elements.rhymeResultsList) return;
    const wordLower = rhymeWord.toLowerCase();
    const li = document.createElement('li');
    const displayText = currentPluralMap.get(wordLower) || rhymeWord;
    const slashIdx = displayText.indexOf('/');
    if (slashIdx !== -1) {
        li.innerHTML = displayText.slice(0, slashIdx) +
            '<span class="rhyme-plural-suffix">' + displayText.slice(slashIdx + 1) + '</span>';
    } else {
        li.textContent = displayText;
    }
    li.dataset.rhymeWord = rhymeWord;
    
    // Add click handler — toggles pin in selection mode, selects word otherwise
    li.addEventListener('click', (e) => {
        if (e.target.classList.contains('rhyme-x') || e.target.classList.contains('rhyme-rating-btn')) return;

        if (isSelectionMode) {
            if (pendingPins.has(wordLower)) {
                pendingPins.delete(wordLower);
                li.classList.remove('rhyme-pending-pin');
            } else {
                pendingPins.add(wordLower);
                li.classList.add('rhyme-pending-pin');
            }
            return;
        }

        selectRhymeWordFromModal(rhymeWord);
    });

    if (isSelectionMode && pendingPins.has(wordLower)) {
        li.classList.add('rhyme-pending-pin');
    }
    li.classList.add('rhyme-freq-none');
    
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
    
    // Check user rating (new system) + legacy slant backward compat
    const currentRating = (state.rhymeRatings[baseWordLower] || {})[wordLower] || null;
    const slantSet = state.slantRhymes[baseWordLower] || new Set();
    const isLegacySlant = !currentRating && slantSet.has(wordLower);
    if (currentRating) {
        li.classList.add(`user-rating-${currentRating}`);
        if (currentRating === 'slant') { li.classList.add('slant-tagged'); li.style.fontStyle = 'italic'; }
    } else if (isLegacySlant) {
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
        x.textContent = '\u00d7';
        x.title = 'Reject this rhyme';
        x.onclick = (e) => {
            e.stopPropagation();
            tempRejected.add(wordLower);

            // Skip card if hidden, rapid-fire, or within cooldown
            const now = Date.now();
            const rapidFire = !lastCardHadFeedback && (now - lastCardDismissTime) < RAPID_FIRE_MS && lastCardDismissTime > 0;

            if (feedbackHidden || rapidFire) {
                skipCounter++;
                updateSkipBadge();
            } else {
                showFeedbackCard(state.currentWord, rhymeWord);
            }

            // Animate the item out, then re-render once it's gone
            const baseWordLower = state.currentWord?.toLowerCase();
            const startHeight = li.offsetHeight;
            li.style.overflow = 'hidden';
            animate(li, {
                opacity: [1, 0],
                translateX: [0, 40],
                height: [startHeight, 0],
                paddingTop: 0,
                paddingBottom: 0,
                marginTop: 0,
                marginBottom: 0,
                duration: 220,
                easing: 'easeInQuad',
                onComplete: () => displayRhymeList(baseWordLower),
            });
        };
        li.appendChild(x);
    }
    
    // Reclassify star icon (tag button)
    const RATING_COLORS = { stretch: '#888', slant: 'var(--secondary-accent)', rhyme: 'var(--primary-accent)', dope: '#ffb000', perfect: '#FFD700' };
    const RATING_ICONS  = { stretch: 'fa-grip-lines', slant: 'fa-slash', rhyme: 'fa-music', dope: 'fa-fire', perfect: 'fa-star' };
    const tag = document.createElement('span');
    tag.className = 'rhyme-tag';
    const starIcon = document.createElement('i');
    starIcon.className = currentRating ? `fas ${RATING_ICONS[currentRating]}` : 'far fa-star';
    if (currentRating) tag.style.color = RATING_COLORS[currentRating];
    tag.appendChild(starIcon);
    tag.title = currentRating ? `${currentRating} rhyme — click to reclassify` : 'Rate this rhyme';
    tag.onclick = (e) => {
        e.stopPropagation();
        const isOpen = li.classList.contains('rating-open');
        document.querySelectorAll('#rhyme-results-list li.rating-open').forEach(el => el.classList.remove('rating-open'));
        if (!isOpen) {
            li.classList.add('rating-open');
            const closeOnOutside = (evt) => {
                if (!li.contains(evt.target)) {
                    li.classList.remove('rating-open');
                    document.removeEventListener('click', closeOnOutside, { capture: true });
                }
            };
            setTimeout(() => document.addEventListener('click', closeOnOutside, { capture: true }), 0);
        }
    };
    li.appendChild(tag);

    // 5-option rating selector (overlay, shown when .rating-open)
    const RATINGS = ['stretch', 'slant', 'rhyme', 'dope', 'perfect'];
    const ICONS   = { stretch: 'fa-grip-lines', slant: 'fa-slash', rhyme: 'fa-music', dope: 'fa-fire', perfect: 'fa-star' };
    const selector = document.createElement('div');
    selector.className = 'rhyme-rating-selector';
    RATINGS.forEach(rating => {
        const btn = document.createElement('span');
        btn.className = 'rhyme-rating-btn' + (currentRating === rating ? ' active' : '');
        btn.dataset.rating = rating;
        const btnIcon = document.createElement('i');
        btnIcon.className = `fas ${ICONS[rating]}`;
        btn.appendChild(btnIcon);
        btn.title = rating.charAt(0).toUpperCase() + rating.slice(1) + ' rhyme';
        btn.onclick = (e) => {
            e.stopPropagation();
            if (!state.rhymeRatings[baseWordLower]) state.rhymeRatings[baseWordLower] = {};
            if (currentRating === rating) {
                delete state.rhymeRatings[baseWordLower][wordLower];
                if (!Object.keys(state.rhymeRatings[baseWordLower]).length) delete state.rhymeRatings[baseWordLower];
            } else {
                state.rhymeRatings[baseWordLower][wordLower] = rating;
            }
            li.classList.remove('rating-open');
            storage.saveSettings();
            displayRhymeList(state.currentWord?.toLowerCase());
        };
        selector.appendChild(btn);
    });
    li.appendChild(selector);
    
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

    function clearTooltip() {
        if (_activeTooltipTimeout) {
            clearTimeout(_activeTooltipTimeout);
            _activeTooltipTimeout = null;
        }
        if (_activeTooltip) {
            _activeTooltip.remove();
            _activeTooltip = null;
        }
    }

    listEl.addEventListener('mouseover', (e) => {
        const li = e.target.closest('li[data-tier]');
        if (!li) { clearTooltip(); return; }

        clearTooltip();
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
    });

    listEl.addEventListener('mouseout', (e) => {
        const li = e.target.closest('li[data-tier]');
        if (!li) return;
        const related = e.relatedTarget;
        if (related && li.contains(related)) return;
        clearTooltip();
    });
}

// Update displayRhymeList to move tempRejected words to end and add tier separators
function displayRhymeList(baseWordLower) {
    if (!ui.elements.rhymeResultsList || !baseWordLower) return;
    let rhymesToDisplay = getValidRhymesForWord(state.currentWord);
    const totalBeforeCap = rhymesToDisplay._totalBeforeCap || rhymesToDisplay.length;

    // Apply sorting
    if (rhymeSortMode === 'alpha') {
        rhymesToDisplay = [...rhymesToDisplay].sort((a, b) => a.localeCompare(b));
    } else if (rhymeSortMode === 'phonetic') {
        rhymesToDisplay = sortByPhoneticEnding(rhymesToDisplay, baseWordLower);
    } else if (rhymeSortMode === 'similarity') {
        rhymesToDisplay = sortByRhymeSimilarity(rhymesToDisplay, state.currentWord);
    } else if (rhymeSortMode === 'random') {
        const arr = [...rhymesToDisplay];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        rhymesToDisplay = arr;
    }
    rhymesToDisplay._totalBeforeCap = totalBeforeCap;

    // Collapse singular/plural pairs — "critic" + "critics" → display "critic/s", hide "critics"
    const { skipSet: pluralSkipSet, displayMap: pluralDisplayMap } = buildPluralMap(rhymesToDisplay);
    currentPluralMap = pluralDisplayMap;
    rhymesToDisplay = rhymesToDisplay.filter(w => !pluralSkipSet.has(w.toLowerCase()));
    rhymesToDisplay._totalBeforeCap = totalBeforeCap;

    // Update header with accurate count
    if (ui.elements.rhymeModalDynamicHeading) {
        ui.elements.rhymeModalDynamicHeading.innerHTML = createModalHeaderHTML(state.currentWord, rhymeSortMode, rhymesToDisplay);
        attachHeaderNavHandlers();
    }
    
    // Split out temp-rejected
    const normal = [], rejected = [];
    for (const word of rhymesToDisplay) {
        if (tempRejected.has(word.toLowerCase())) rejected.push(word);
        else normal.push(word);
    }

    // Separate user-rated words from unrated
    const RATING_ORDER = ['perfect', 'dope', 'rhyme', 'slant', 'stretch'];
    const RATING_LABELS = { perfect: 'Perfect Rhyme', dope: 'Dope Rhyme', rhyme: 'Rhyme', slant: 'Slant Rhyme', stretch: 'Stretch Rhyme' };
    const RATING_COLORS = { perfect: '#FFD700', dope: '#ffb000', rhyme: 'var(--primary-accent)', slant: 'var(--secondary-accent)', stretch: '#888' };
    const userRatings = state.rhymeRatings[baseWordLower] || {};
    const ratedByTier = {};
    RATING_ORDER.forEach(r => { ratedByTier[r] = []; });
    const unratedNormal = [];
    for (const word of normal) {
        const rating = userRatings[word.toLowerCase()];
        if (rating && ratedByTier[rating]) ratedByTier[rating].push(word);
        else unratedNormal.push(word);
    }
    const hasRated = RATING_ORDER.some(r => ratedByTier[r].length > 0);

    ui.elements.rhymeResultsList.innerHTML = '';
    setupRhymeTooltipDelegation(ui.elements.rhymeResultsList);

    // Selection mode styling
    ui.elements.rhymeResultsList.classList.toggle('rhyme-list-selection-mode', isSelectionMode);

    const pinnedSet = state.pinnedRhymes[baseWordLower] || new Set();
    const filterPinned = (arr) => isSelectionMode ? arr : arr.filter(w => !pinnedSet.has(w.toLowerCase()));

    if (rhymesToDisplay.length > 0) {
        // Pinned section — shown above everything else when not in selection mode
        if (!isSelectionMode && pinnedSet.size > 0) {
            const pinnedInList = rhymesToDisplay.filter(w => pinnedSet.has(w.toLowerCase()));
            if (pinnedInList.length > 0) {
                const pinHeader = document.createElement('div');
                pinHeader.className = 'rhyme-pin-section-header';
                pinHeader.innerHTML = '<i class="fas fa-star"></i> Pinned';
                ui.elements.rhymeResultsList.appendChild(pinHeader);
                pinnedInList.forEach(word => createRhymeListItem(word, baseWordLower, rhymeSortMode === 'similarity' ? getTierInfo(word, baseWordLower) : null));
                const pinDivider = document.createElement('div');
                pinDivider.className = 'rhyme-pin-divider';
                ui.elements.rhymeResultsList.appendChild(pinDivider);
            }
        }

        // Render user-rated groups at top
        if (hasRated) {
            RATING_ORDER.forEach(rating => {
                const words = filterPinned(ratedByTier[rating]);
                if (!words.length) return;
                addRatingGroupHeader(rating, RATING_LABELS[rating], RATING_COLORS[rating]);
                words.forEach(word => createRhymeListItem(word, baseWordLower, rhymeSortMode === 'similarity' ? getTierInfo(word, baseWordLower) : null));
            });
            // Divider before unrated section
            if (filterPinned(unratedNormal).length) {
                const divider = document.createElement('div');
                divider.className = 'rhyme-rating-unrated-divider';
                ui.elements.rhymeResultsList.appendChild(divider);
            }
        }

        // Render unrated words with existing sort logic
        const unratedToRender = filterPinned(unratedNormal);
        if (rhymeSortMode === 'similarity') {
            let currentTier = null;
            let lastTier = null;
            for (const word of unratedToRender) {
                const tierInfo = getTierInfo(word, baseWordLower);
                if (currentTier && currentTier !== tierInfo.tier && lastTier !== tierInfo.tier) {
                    addTierSeparator(tierInfo.tier);
                    lastTier = currentTier;
                }
                createRhymeListItem(word, baseWordLower, tierInfo);
                currentTier = tierInfo.tier;
            }
            // Shimmer for gold/silver tiers
            setTimeout(() => {
                ui.elements.rhymeResultsList.querySelectorAll('.rhyme-tier-perfect').forEach(item => {
                    item.classList.add('shimmer-active');
                    setTimeout(() => item.classList.remove('shimmer-active'), 1500);
                });
                ui.elements.rhymeResultsList.querySelectorAll('.rhyme-tier-strong').forEach(item => {
                    item.classList.add('shimmer-active');
                    setTimeout(() => item.classList.remove('shimmer-active'), 1500);
                });
            }, 300);
        } else {
            unratedToRender.forEach(match => createRhymeListItem(match, baseWordLower));
        }

        // Render rejected at end
        rejected.forEach(word => createRhymeListItem(word, baseWordLower, rhymeSortMode === 'similarity' ? getTierInfo(word, baseWordLower) : null));

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

// Add a user-rating group header to the rhyme list
function addRatingGroupHeader(rating, label, color) {
    if (!ui.elements.rhymeResultsList) return;
    const header = document.createElement('div');
    header.className = 'rhyme-rating-group-header';
    header.textContent = label;
    header.style.color = color;
    ui.elements.rhymeResultsList.appendChild(header);
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
function sortByPhoneticEnding(words, baseWord) {
    // Extract orthographic rhyming suffix (from last non-silent vowel onwards)
    function getSpelledEnding(word) {
        const w = word.toLowerCase();
        const vowels = 'aeiouy';
        // Trailing silent 'e': if word ends in consonant + 'e', exclude it when searching
        let searchEnd = w.length;
        if (w.length > 2 && w[w.length - 1] === 'e' && !vowels.includes(w[w.length - 2])) {
            searchEnd = w.length - 1;
        }
        for (let i = searchEnd - 1; i >= 0; i--) {
            if (vowels.includes(w[i])) return w.slice(i);
        }
        return w;
    }

    // Get the base word's rhyming phoneme key and spelled ending
    const basePhonemes = getPhonemes(baseWord);
    const baseEnding = basePhonemes ? extractRhymingPart(basePhonemes) : null;
    const baseEndingKey = baseEnding ? baseEnding.map(p => p.replace(/[012]$/, '')).join('-') : null;
    const baseSpelledEnding = getSpelledEnding(baseWord);

    function getEndingKey(word) {
        const phonemes = getPhonemes(word.toLowerCase());
        if (!phonemes) return null;
        const ending = extractRhymingPart(phonemes);
        return ending ? ending.map(p => p.replace(/[012]$/, '')).join('-') : null;
    }

    // Partition: exact phonetic ending match vs others
    const exact = [];
    const others = [];
    for (const word of words) {
        if (baseEndingKey && getEndingKey(word) === baseEndingKey) {
            exact.push(word);
        } else {
            others.push(word);
        }
    }

    // Within exact group: base word's spelling first, then alphabetically by spelled ending, then by full word
    exact.sort((a, b) => {
        const aEnd = getSpelledEnding(a);
        const bEnd = getSpelledEnding(b);
        const aIsBase = aEnd === baseSpelledEnding ? 0 : 1;
        const bIsBase = bEnd === baseSpelledEnding ? 0 : 1;
        if (aIsBase !== bIsBase) return aIsBase - bIsBase;
        if (aEnd !== bEnd) return aEnd.localeCompare(bEnd);
        return a.localeCompare(b);
    });

    others.sort((a, b) => a.localeCompare(b));

    return [...exact, ...others];
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

// --- Etymology / Word Family ---
let etymologyCache = new Map();

// Morphological suffixes that are valid word endings.
// Used to verify that a shorter prefix is a genuine stem of the base word,
// not just a coincidentally real word that happens to be a prefix.
// E.g. "plumb" → "plumber" (suffix "er" ✓), but "plum" → "plump" (suffix "p" ✗).
const MORPH_SUFFIXES = new Set([
    's', 'es', 'd', 'ed', 'r', 'er', 'ers', 'est',
    'ing', 'ings', 'y', 'ey', 'ly', 'ier', 'iest',
    'ness', 'ment', 'ments', 'tion', 'tions', 'ation', 'ations',
    'ful', 'less', 'ish', 'able', 'ible', 'ity', 'ities',
    'al', 'ive', 'ous', 'ary', 'ory', 'age', 'ance', 'ence',
    'ant', 'ent', 'ship', 'dom', 'hood', 'ward', 'wards',
]);

function findWordFamily(baseWord) {
    const word = baseWord.toLowerCase();

    // Build a set of prefixes to match against — starting with the full baseWord.
    // We also look for a shorter real-word stem, but ONLY if the characters we
    // stripped form a recognised morphological suffix. This prevents false positives
    // like "plum" showing up in "plump"'s family (suffix "p" is not a real suffix).
    const prefixes = new Set([word]);

    // Build a quick lookup for wordList membership
    const wordSet = new Set(state.wordList.map(w => w.toLowerCase()));

    // Find the longest proper prefix (>= 4 chars) that is itself a word AND whose
    // relationship to baseWord is a real derivational suffix.
    // Also handle silent-e drop: "educating" → stem "educat" + "e" = "educate".
    for (let len = word.length - 1; len >= 4; len--) {
        const candidate = word.slice(0, len);
        const tail = word.slice(len);
        if (!MORPH_SUFFIXES.has(tail)) continue; // Not a morphological suffix — skip
        if (wordSet.has(candidate)) {
            prefixes.add(candidate);
            break;
        }
        if (wordSet.has(candidate + 'e')) {
            // Silent-e stem: "educating" → "educat" + "e" = "educate"
            prefixes.add(candidate);
            prefixes.add(candidate + 'e');
            break;
        }
    }

    const family = [];
    const seen = new Set([word]);
    for (const w of state.wordList) {
        const lower = w.toLowerCase();
        if (seen.has(lower)) continue;
        for (const p of prefixes) {
            // Full prefix match, with reasonable suffix length (max 6 chars appended)
            if (lower.startsWith(p) && lower.length <= p.length + 6) {
                family.push(w);
                seen.add(lower);
                break;
            }
        }
        if (family.length >= 15) break;
    }
    return family;
}

async function fetchEtymology(word) {
    const lower = word.toLowerCase();
    if (etymologyCache.has(lower)) return etymologyCache.get(lower);
    try {
        const resp = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(lower)}`);
        if (!resp.ok) { etymologyCache.set(lower, null); return null; }
        const data = await resp.json();
        const entry = data?.[0];
        const result = {
            origin: entry?.origin || null,
            meanings: (entry?.meanings || []).slice(0, 3).map(m => ({
                partOfSpeech: m.partOfSpeech,
                definition: m.definitions?.[0]?.definition || ''
            }))
        };
        etymologyCache.set(lower, result);
        return result;
    } catch {
        etymologyCache.set(lower, null);
        return null;
    }
}

function setupEtymologySection(baseWord) {
    const section = document.getElementById('etymology-section');
    const toggleBtn = document.getElementById('etymology-toggle');
    const content = document.getElementById('etymology-content');
    const familyEl = document.getElementById('etymology-family');
    const originEl = document.getElementById('etymology-origin');
    if (!section || !toggleBtn || !content) return;

    // Show the section, reset state
    section.style.display = '';
    content.style.display = 'none';
    toggleBtn.classList.remove('active');
    familyEl.innerHTML = '';
    originEl.innerHTML = '';

    // One-time delegation for word family clicks (bound once per element lifetime)
    if (!familyEl.dataset.clickBound) {
        familyEl.dataset.clickBound = 'true';
        familyEl.addEventListener('click', (e) => {
            const wordSpan = e.target.closest('.etymology-family-word');
            if (!wordSpan) return;
            const clickedWord = wordSpan.dataset.word || wordSpan.textContent.trim();
            const idx = state.currentRhymeList.indexOf(clickedWord);
            if (idx !== -1) state.currentRhymeIndex = idx;
            ui.displayWord(clickedWord);
            modal.closeModal(ui.elements.rhymeFinderModal);
            ui.showFeedback(`Selected: ${clickedWord}`, false, 1500);
        });
    }

    // Remove old listener by cloning
    const newBtn = toggleBtn.cloneNode(true);
    toggleBtn.parentNode.replaceChild(newBtn, toggleBtn);

    newBtn.addEventListener('click', async () => {
        const isOpen = content.style.display !== 'none';
        if (isOpen) {
            content.style.display = 'none';
            newBtn.classList.remove('active');
            return;
        }
        content.style.display = '';
        newBtn.classList.add('active');

        // Word family (synchronous)
        const family = findWordFamily(baseWord);
        if (family.length > 0) {
            // Merge plural duplicates: if "word" and "words" both appear, show "word/s" as one chip
            const familyLowerSet = new Set(family.map(w => w.toLowerCase()));
            const skipSet = new Set();
            const chips = family.reduce((acc, w) => {
                const lower = w.toLowerCase();
                if (skipSet.has(lower)) return acc;
                if (familyLowerSet.has(lower + 's')) {
                    acc.push({ display: w + '/s', word: w });
                    skipSet.add(lower + 's');
                } else {
                    acc.push({ display: w, word: w });
                }
                return acc;
            }, []);
            familyEl.innerHTML = `
                <div class="etymology-family-label">Word Family</div>
                <div class="etymology-family-words">
                    ${chips.map(c => `<span class="etymology-family-word" data-word="${c.word}">${c.display}</span>`).join('')}
                </div>`;
        } else {
            familyEl.innerHTML = '<div class="etymology-family-label">Word Family</div><div style="opacity:0.5">No related forms found in word list</div>';
        }

        // Etymology (async fetch)
        originEl.innerHTML = '<div class="etymology-origin-label">Etymology</div><div style="opacity:0.5">Loading...</div>';
        const etym = await fetchEtymology(baseWord);
        if (etym && (etym.origin || etym.meanings.length > 0)) {
            let html = '<div class="etymology-origin-label">Etymology</div>';
            if (etym.origin) {
                html += `<div class="etymology-origin-text">${etym.origin}</div>`;
            }
            if (etym.meanings.length > 0) {
                html += '<div style="margin-top:6px">';
                for (const m of etym.meanings) {
                    html += `<div><strong style="color:var(--secondary-accent)">${m.partOfSpeech}</strong>: ${m.definition}</div>`;
                }
                html += '</div>';
            }
            originEl.innerHTML = html;
        } else {
            originEl.innerHTML = '<div class="etymology-origin-label">Etymology</div><div style="opacity:0.5">No etymology data available</div>';
        }
    });
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
// Wires up the prev/next/blacklist buttons in the modal header
function attachHeaderNavHandlers() {
    const prevBtn = document.getElementById('rhyme-header-prev');
    const nextBtn = document.getElementById('rhyme-header-next');
    const blacklistBtn = document.getElementById('rhyme-header-blacklist');

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

    if (blacklistBtn) {
        blacklistBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const word = state.currentWord;
            if (!word) return;

            const wasBlacklisted = state.blacklist.has(word);

            if (wasBlacklisted) {
                // Un-blacklisting — keep modal open, just toggle state
                state.blacklist.delete(word);
                blacklistBtn.classList.remove('active');
                ui.showFeedback(`"${word}" un-blacklisted.`);
                storage.saveSettings();
                const mainBtn = document.getElementById('blacklist-word');
                if (mainBtn) mainBtn.classList.toggle('active', false);
                return;
            }

            // Blacklisting: delegate to wordManager.toggleBlacklist which handles
            // removing the word, advancing to the next (respecting forward history),
            // and updating the display. Then close the modal.
            //
            // toggleBlacklist reads from ui.elements.wordDisplay.dataset.word, so we
            // ensure the main display shows the word we're blacklisting first.
            if (ui.elements.wordDisplay) {
                ui.elements.wordDisplay.dataset.word = word;
            }
            wordManager.toggleBlacklist();
            ui.showFeedback(`"${word}" blacklisted!`, true);
            modal.closeModal(ui.elements.rhymeFinderModal);
        });
    }

    const pinBtn = document.getElementById('rhyme-header-pin');
    if (pinBtn) {
        pinBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const word = state.currentWord;
            if (!word) return;

            const isFav = state.favorites.has(word);
            if (isFav) {
                state.favorites.delete(word);
                showRhymeToast(`"${word.toUpperCase()}" un-favorited.`);
            } else {
                state.favorites.add(word);
                showRhymeToast(`"${word.toUpperCase()}" favorited!`);
            }
            storage.saveSettings();
            pinBtn.classList.toggle('active', state.favorites.has(word));
            // Sync main page favorite button
            ui.elements.favoriteButton?.classList.toggle('active', state.favorites.has(word));
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

    // Reset selection mode when navigating to a new word
    isSelectionMode = false;
    pendingPins = new Set();

    // Refresh modal content
    updateModalHeader();
    displayRhymeList(newWord.toLowerCase());
    setupEtymologySection(newWord);

    // Always scroll back to top when navigating to a new word
    if (ui.elements.rhymeFinderModal) ui.elements.rhymeFinderModal.scrollTop = 0;

    // Update the manual-rhyme placeholder to reflect the new word
    if (ui.elements.manualRhymeInput) {
        const soundsLikeCheckbox = document.getElementById('sounds-like-checkbox');
        const isAlias = soundsLikeCheckbox?.checked;
        ui.elements.manualRhymeInput.placeholder = isAlias
            ? `${newWord} sounds like...`
            : `${newWord} rhymes with...`;
    }
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

// Track the last word the modal was opened for, to preserve scroll on reopen
let _lastModalWord = null;

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
    if (ui.elements.manualRhymeInput) {
        ui.elements.manualRhymeInput.value = '';
        ui.elements.manualRhymeInput.placeholder = `${baseWord} rhymes with...`;
    }

    // Reset sounds-like checkbox and attach toggle
    const soundsLikeCheckbox = document.getElementById('sounds-like-checkbox');
    if (soundsLikeCheckbox) {
        soundsLikeCheckbox.checked = false;
        soundsLikeCheckbox.onchange = () => {
            if (ui.elements.manualRhymeInput) {
                ui.elements.manualRhymeInput.placeholder = soundsLikeCheckbox.checked
                    ? `${baseWord} sounds like...`
                    : `${baseWord} rhymes with...`;
            }
        };
    }

    // Populate List
    displayRhymeList(baseWordLower); // Calls internal helper which calls getValidRhymesForWord

    // Set up etymology section for current word
    setupEtymologySection(baseWord);

    modal.openModal(ui.elements.rhymeFinderModal);

    // Reset scroll after modal is visible (scrollTop is ignored on display:none elements)
    if (baseWordLower !== _lastModalWord) {
        if (ui.elements.rhymeFinderModal) ui.elements.rhymeFinderModal.scrollTop = 0;
        if (ui.elements.rhymeResultsList) ui.elements.rhymeResultsList.scrollTop = 0;
    }
    _lastModalWord = baseWordLower;
}

// --- addManualRhyme (EXPORTED) ---
// Adds a manual rhyme or a "sounds like" alias depending on checkbox state
export function addManualRhyme() {
    if (!ui.elements.manualRhymeInput) return;
    const suggestedWord = ui.elements.manualRhymeInput.value.trim();
    const baseWord = state.currentWord;
    const baseWordLower = baseWord?.toLowerCase();
    if (!suggestedWord || !baseWordLower || baseWord === "NO WORDS!") { return; }
    if (suggestedWord.toLowerCase() === baseWordLower) { return; }

    const soundsLikeCheckbox = document.getElementById('sounds-like-checkbox');
    const isAlias = soundsLikeCheckbox?.checked;

    if (isAlias) {
        // Alias mode: "this word sounds like suggestedWord"
        // Also add suggestedWord itself as a manual rhyme so it appears in the list.
        const suggestedLower = suggestedWord.toLowerCase();
        if (!state.rhymeAliases[baseWordLower]) state.rhymeAliases[baseWordLower] = new Set();
        if (state.rhymeAliases[baseWordLower].has(suggestedLower)) {
            ui.showFeedback(`"${baseWord}" already sounds like "${suggestedWord}".`);
            return;
        }
        state.rhymeAliases[baseWordLower].add(suggestedLower);

        // Also register as a manual rhyme so the word itself shows up
        if (!state.manualRhymes[baseWordLower]) state.manualRhymes[baseWordLower] = new Set();
        state.manualRhymes[baseWordLower].add(suggestedWord);

        // If word isn't on the main word list, add it as a new entry
        const suggestedUpper = suggestedWord.toUpperCase();
        const onList = state.wordList.some(w => w.toUpperCase() === suggestedUpper);
        if (!onList) {
            state.wordList.push(suggestedWord);
        }

        console.log(`Added alias + manual rhyme: "${baseWord}" sounds like "${suggestedWord}"`);
        storage.saveSettings();
        // Refresh rhyme list to show imported matches
        state.currentRhymeList = getValidRhymesForWord(baseWord);
        displayRhymeList(baseWordLower);
        updateModalHeader();
        ui.showFeedback(`"${baseWord}" now inherits rhymes from "${suggestedWord}".`);
    } else {
        // Manual mode: add a single rhyme (existing behavior)
        console.log(`Manually adding rhyme: "${suggestedWord}" for base word "${baseWord}"`);
        if (!state.manualRhymes[baseWordLower]) state.manualRhymes[baseWordLower] = new Set();
        if (state.manualRhymes[baseWordLower].has(suggestedWord)) { return; }
        state.manualRhymes[baseWordLower].add(suggestedWord);

        // If word isn't on the main word list, add it as a new entry
        const suggestedUpper = suggestedWord.toUpperCase();
        const onList = state.wordList.some(w => w.toUpperCase() === suggestedUpper);
        if (!onList) {
            state.wordList.push(suggestedWord);
            console.log(`"${suggestedWord}" added to word list (${state.wordList.length} words)`);
        }

        storage.saveSettings();
        state.currentRhymeList = getValidRhymesForWord(baseWord);
        displayRhymeList(baseWordLower);
        const extra = onList ? '' : ' (also added to word list)';
        ui.showFeedback(`"${suggestedWord}" added to manual rhymes for "${baseWord}"${extra}.`);
    }
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