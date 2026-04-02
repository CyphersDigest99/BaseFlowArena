/**
 * @fileoverview Phonetic Data Resolution for BaseFlowArena
 *
 * Provides the lookup chain for phonetic patterns:
 *   1. state.rhymeData (full pre-baked data for word list words)
 *   2. state.cmuLookup (compact CMU dictionary, ~117k words)
 *   3. Rule-based approximation (spelling-to-sound for unknown words)
 *
 * Owns the inverted index (pattern -> word list) and consonant class logic.
 * Nothing else should touch cmuLookup or rule-based logic directly.
 */

import { state } from './state.js';

// --- Consonant classification (mirrors process_rhymes.py) ---
const NASAL = new Set(['N', 'M', 'NG']);
const LIQUID = new Set(['L', 'R']);
const STOP = new Set(['P', 'B', 'T', 'D', 'K', 'G']);
const FRICATIVE = new Set(['F', 'V', 'S', 'Z', 'SH', 'ZH', 'TH', 'DH', 'HH', 'CH', 'JH']);

function classifyConsonant(phoneme) {
    const clean = phoneme.replace(/[012]$/, '');
    if (NASAL.has(clean)) return 'nasal';
    if (LIQUID.has(clean)) return 'liquid';
    if (STOP.has(clean)) return 'stop';
    if (FRICATIVE.has(clean)) return 'fricative';
    return 'other';
}

// --- Rule-based spelling-to-sound fallback ---
// Maps common English spelling endings to ARPAbet vowel+consonant-class patterns.
// Ordered longest-first so greedy matching works.
const ENDING_RULES = [
    // 4+ char endings
    { ending: 'tion', pattern: ['AH+fricative'] },
    { ending: 'sion', pattern: ['AH+nasal'] },
    { ending: 'ight', pattern: ['AY+stop'] },
    { ending: 'ound', pattern: ['AW+nasal'] },
    { ending: 'ould', pattern: ['UH+liquid'] },
    { ending: 'ough', pattern: ['AO+null'] },
    { ending: 'ture', pattern: ['ER+null'] },
    { ending: 'ious', pattern: ['IY+fricative'] },
    { ending: 'eous', pattern: ['IY+fricative'] },
    { ending: 'ence', pattern: ['EH+nasal'] },
    { ending: 'ance', pattern: ['AE+nasal'] },
    { ending: 'ment', pattern: ['EH+nasal'] },
    { ending: 'ness', pattern: ['EH+fricative'] },
    { ending: 'able', pattern: ['AH+stop'] },
    { ending: 'ible', pattern: ['AH+stop'] },
    // 3 char endings
    { ending: 'ing', pattern: ['IH+nasal'] },
    { ending: 'ong', pattern: ['AO+nasal'] },
    { ending: 'ung', pattern: ['AH+nasal'] },
    { ending: 'ang', pattern: ['AE+nasal'] },
    { ending: 'ank', pattern: ['AE+nasal'] },
    { ending: 'ink', pattern: ['IH+nasal'] },
    { ending: 'unk', pattern: ['AH+nasal'] },
    { ending: 'and', pattern: ['AE+nasal'] },
    { ending: 'end', pattern: ['EH+nasal'] },
    { ending: 'ind', pattern: ['AY+nasal'] },
    { ending: 'ant', pattern: ['AE+nasal'] },
    { ending: 'ent', pattern: ['EH+nasal'] },
    { ending: 'int', pattern: ['IH+nasal'] },
    { ending: 'unt', pattern: ['AH+nasal'] },
    { ending: 'amp', pattern: ['AE+nasal'] },
    { ending: 'ump', pattern: ['AH+nasal'] },
    { ending: 'ack', pattern: ['AE+stop'] },
    { ending: 'eck', pattern: ['EH+stop'] },
    { ending: 'ick', pattern: ['IH+stop'] },
    { ending: 'ock', pattern: ['AA+stop'] },
    { ending: 'uck', pattern: ['AH+stop'] },
    { ending: 'ake', pattern: ['EY+stop'] },
    { ending: 'ike', pattern: ['AY+stop'] },
    { ending: 'oke', pattern: ['OW+stop'] },
    { ending: 'uke', pattern: ['UW+stop'] },
    { ending: 'ate', pattern: ['EY+stop'] },
    { ending: 'ite', pattern: ['AY+stop'] },
    { ending: 'ote', pattern: ['OW+stop'] },
    { ending: 'ute', pattern: ['UW+stop'] },
    { ending: 'ail', pattern: ['EY+liquid'] },
    { ending: 'eel', pattern: ['IY+liquid'] },
    { ending: 'ool', pattern: ['UW+liquid'] },
    { ending: 'oil', pattern: ['OY+liquid'] },
    { ending: 'ear', pattern: ['IH+liquid'] },
    { ending: 'air', pattern: ['EH+liquid'] },
    { ending: 'ore', pattern: ['AO+liquid'] },
    { ending: 'ire', pattern: ['AY+liquid'] },
    { ending: 'our', pattern: ['AW+liquid'] },
    { ending: 'ash', pattern: ['AE+fricative'] },
    { ending: 'ish', pattern: ['IH+fricative'] },
    { ending: 'ush', pattern: ['AH+fricative'] },
    { ending: 'oss', pattern: ['AO+fricative'] },
    { ending: 'ass', pattern: ['AE+fricative'] },
    { ending: 'ess', pattern: ['EH+fricative'] },
    { ending: 'iss', pattern: ['IH+fricative'] },
    { ending: 'ow', pattern: ['OW+null'] },
    { ending: 'ew', pattern: ['UW+null'] },
    { ending: 'ay', pattern: ['EY+null'] },
    { ending: 'oy', pattern: ['OY+null'] },
    { ending: 'ee', pattern: ['IY+null'] },
    { ending: 'oo', pattern: ['UW+null'] },
    // 2 char endings (short vowel + consonant)
    { ending: 'an', pattern: ['AE+nasal'] },
    { ending: 'en', pattern: ['EH+nasal'] },
    { ending: 'in', pattern: ['IH+nasal'] },
    { ending: 'on', pattern: ['AA+nasal'] },
    { ending: 'un', pattern: ['AH+nasal'] },
    { ending: 'am', pattern: ['AE+nasal'] },
    { ending: 'im', pattern: ['IH+nasal'] },
    { ending: 'um', pattern: ['AH+nasal'] },
    { ending: 'at', pattern: ['AE+stop'] },
    { ending: 'et', pattern: ['EH+stop'] },
    { ending: 'it', pattern: ['IH+stop'] },
    { ending: 'ot', pattern: ['AA+stop'] },
    { ending: 'ut', pattern: ['AH+stop'] },
    { ending: 'ap', pattern: ['AE+stop'] },
    { ending: 'ip', pattern: ['IH+stop'] },
    { ending: 'op', pattern: ['AA+stop'] },
    { ending: 'up', pattern: ['AH+stop'] },
    { ending: 'ab', pattern: ['AE+stop'] },
    { ending: 'ib', pattern: ['IH+stop'] },
    { ending: 'ob', pattern: ['AA+stop'] },
    { ending: 'ub', pattern: ['AH+stop'] },
    { ending: 'ad', pattern: ['AE+stop'] },
    { ending: 'ed', pattern: ['EH+stop'] },
    { ending: 'id', pattern: ['IH+stop'] },
    { ending: 'od', pattern: ['AA+stop'] },
    { ending: 'ag', pattern: ['AE+stop'] },
    { ending: 'ig', pattern: ['IH+stop'] },
    { ending: 'og', pattern: ['AO+stop'] },
    { ending: 'ug', pattern: ['AH+stop'] },
    { ending: 'al', pattern: ['AE+liquid'] },
    { ending: 'el', pattern: ['EH+liquid'] },
    { ending: 'il', pattern: ['IH+liquid'] },
    { ending: 'ol', pattern: ['AA+liquid'] },
    { ending: 'ul', pattern: ['UH+liquid'] },
    { ending: 'ar', pattern: ['AA+liquid'] },
    { ending: 'er', pattern: ['ER+null'] },
    { ending: 'ir', pattern: ['ER+null'] },
    { ending: 'or', pattern: ['AO+liquid'] },
    { ending: 'ur', pattern: ['ER+null'] },
];

function ruleBasedPattern(word) {
    const lower = word.toLowerCase();
    for (const rule of ENDING_RULES) {
        if (lower.endsWith(rule.ending)) {
            return rule.pattern;
        }
    }
    return null;
}

// --- Load CMU lookup data ---
export async function loadCmuLookup() {
    console.log("Loading CMU lookup data...");
    try {
        const response = await fetch('cmu_lookup.json');
        if (!response.ok) {
            throw new Error(`Failed to load cmu_lookup.json: ${response.status}`);
        }
        state.cmuLookup = await response.json();
        buildInvertedIndex();
        console.log(`CMU lookup loaded (${Object.keys(state.cmuLookup).length} entries, ${Object.keys(state.cmuInvertedIndex).length} unique patterns).`);
    } catch (error) {
        console.error("Could not load cmu_lookup.json:", error);
        state.cmuLookup = null;
        state.cmuInvertedIndex = null;
    }
}

// --- Build inverted index: patternString -> [word1, word2, ...] ---
function buildInvertedIndex() {
    const index = {};
    for (const [word, compactValue] of Object.entries(state.cmuLookup)) {
        const pipeIdx = compactValue.lastIndexOf('|');
        const patternStr = compactValue.substring(0, pipeIdx);
        if (!index[patternStr]) {
            index[patternStr] = [];
        }
        index[patternStr].push(word);
    }
    state.cmuInvertedIndex = index;
}

// --- Core lookup: get pattern for any word ---
export function getPattern(word) {
    if (!word) return null;
    const wordLower = word.toLowerCase();

    // Tier 1: full rhymeData
    if (state.rhymeData) {
        const data = state.rhymeData[wordLower];
        if (data) {
            if (data.rhyme_pattern) return data.rhyme_pattern;
            if (Array.isArray(data)) return data;
        }
    }

    // Tier 2: compact CMU lookup
    if (state.cmuLookup && state.cmuLookup[wordLower]) {
        const compact = state.cmuLookup[wordLower];
        const pipeIdx = compact.lastIndexOf('|');
        return compact.substring(0, pipeIdx).split('-');
    }

    // Tier 3: runtime cache (previously computed rule-based)
    if (state.runtimePatterns[wordLower]) {
        const cached = state.runtimePatterns[wordLower];
        const pipeIdx = cached.lastIndexOf('|');
        return cached.substring(0, pipeIdx).split('-');
    }

    // Tier 4: rule-based fallback
    const approx = ruleBasedPattern(wordLower);
    if (approx) {
        // Cache for future lookups
        const syllables = approx.length; // rough estimate: 1 vowel per syllable
        state.runtimePatterns[wordLower] = `${approx.join('-')}|${syllables}`;
        return approx;
    }

    return null;
}

// --- Get syllable count for any word ---
export function getSyllables(word) {
    if (!word) return null;
    const wordLower = word.toLowerCase();

    // Tier 1: full rhymeData
    if (state.rhymeData) {
        const data = state.rhymeData[wordLower];
        if (data && data.syllables) return data.syllables;
    }

    // Tier 2: compact CMU lookup
    if (state.cmuLookup && state.cmuLookup[wordLower]) {
        const compact = state.cmuLookup[wordLower];
        const pipeIdx = compact.lastIndexOf('|');
        return parseInt(compact.substring(pipeIdx + 1), 10);
    }

    // Tier 3: runtime cache
    if (state.runtimePatterns[wordLower]) {
        const cached = state.runtimePatterns[wordLower];
        const pipeIdx = cached.lastIndexOf('|');
        return parseInt(cached.substring(pipeIdx + 1), 10);
    }

    return null;
}

// --- Get all CMU words with a matching pattern (O(1) via inverted index) ---
export function getCandidatesForPattern(patternString) {
    if (!state.cmuInvertedIndex || !patternString) return [];
    return state.cmuInvertedIndex[patternString] || [];
}

// --- Get vowel+consonant context for a word (used by rejection reporting) ---
export function getVowelContext(word) {
    const pattern = getPattern(word);
    return pattern || [];
}
