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
        const response = await fetch('public/cmu_lookup.json');
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

// --- Load full CMU phoneme data for scoring ---
export async function loadCmuPhonemes() {
    console.log("Loading CMU phoneme data...");
    try {
        const response = await fetch('public/cmu_phonemes.json');
        if (!response.ok) {
            throw new Error(`Failed to load cmu_phonemes.json: ${response.status}`);
        }
        state.cmuPhonemes = await response.json();
        console.log(`CMU phonemes loaded (${Object.keys(state.cmuPhonemes).length} entries).`);
    } catch (error) {
        console.error("Could not load cmu_phonemes.json:", error);
        state.cmuPhonemes = null;
    }
}

// --- Get full phoneme array for any word (for scoring) ---
export function getFullPhonemes(word) {
    if (!word) return null;
    const w = word.toLowerCase();
    // Tier 1: rhymeData (curated word list, already parsed arrays)
    if (state.rhymeData?.[w]?.phonemes) return state.rhymeData[w].phonemes;
    // Tier 2: cmuPhonemes (full CMU dict, space-separated strings)
    if (state.cmuPhonemes?.[w]) return state.cmuPhonemes[w].split(' ');
    return null;
}

// ============================================================
// RHYME SCORING ENGINE
// ============================================================

// --- 15x15 Vowel Similarity Matrix (articulatory distance) ---
// Values from IPA vowel chart: height (close/mid/open), frontness (front/central/back), rounding.
// Symmetric — stored as sorted key pairs.
const VOWEL_SIM = {};
(function buildVowelMatrix() {
    const raw = [
        ['AA','AE',0.4],['AA','AH',0.7],['AA','AO',0.8],['AA','AW',0.5],['AA','AY',0.4],
        ['AA','EH',0.3],['AA','ER',0.3],['AA','EY',0.2],['AA','IH',0.2],['AA','IY',0.1],
        ['AA','OW',0.5],['AA','OY',0.4],['AA','UH',0.5],['AA','UW',0.3],
        ['AE','AH',0.6],['AE','AO',0.3],['AE','AW',0.4],['AE','AY',0.5],
        ['AE','EH',0.6],['AE','ER',0.3],['AE','EY',0.6],['AE','IH',0.5],['AE','IY',0.3],
        ['AE','OW',0.2],['AE','OY',0.3],['AE','UH',0.2],['AE','UW',0.1],
        ['AH','AO',0.5],['AH','AW',0.5],['AH','AY',0.4],
        ['AH','EH',0.6],['AH','ER',0.5],['AH','EY',0.4],['AH','IH',0.5],['AH','IY',0.3],
        ['AH','OW',0.4],['AH','OY',0.3],['AH','UH',0.5],['AH','UW',0.4],
        ['AO','AW',0.5],['AO','AY',0.3],
        ['AO','EH',0.3],['AO','ER',0.3],['AO','EY',0.2],['AO','IH',0.2],['AO','IY',0.1],
        ['AO','OW',0.7],['AO','OY',0.6],['AO','UH',0.6],['AO','UW',0.5],
        ['AW','AY',0.5],
        ['AW','EH',0.3],['AW','ER',0.3],['AW','EY',0.3],['AW','IH',0.2],['AW','IY',0.1],
        ['AW','OW',0.6],['AW','OY',0.5],['AW','UH',0.4],['AW','UW',0.4],
        ['AY','EH',0.4],['AY','ER',0.3],['AY','EY',0.6],['AY','IH',0.5],['AY','IY',0.5],
        ['AY','OW',0.3],['AY','OY',0.4],['AY','UH',0.2],['AY','UW',0.2],
        ['EH','ER',0.4],['EH','EY',0.7],['EH','IH',0.7],['EH','IY',0.5],
        ['EH','OW',0.2],['EH','OY',0.3],['EH','UH',0.2],['EH','UW',0.1],
        ['ER','EY',0.3],['ER','IH',0.4],['ER','IY',0.3],
        ['ER','OW',0.3],['ER','OY',0.3],['ER','UH',0.4],['ER','UW',0.3],
        ['EY','IH',0.5],['EY','IY',0.6],
        ['EY','OW',0.3],['EY','OY',0.3],['EY','UH',0.2],['EY','UW',0.1],
        ['IH','IY',0.8],
        ['IH','OW',0.2],['IH','OY',0.2],['IH','UH',0.3],['IH','UW',0.2],
        ['IY','OW',0.1],['IY','OY',0.2],['IY','UH',0.2],['IY','UW',0.2],
        ['OW','OY',0.6],['OW','UH',0.6],['OW','UW',0.7],
        ['OY','UH',0.4],['OY','UW',0.4],
        ['UH','UW',0.6],
    ];
    for (const [v1, v2, score] of raw) {
        VOWEL_SIM[`${v1}-${v2}`] = score;
    }
})();

function vowelSimilarity(p1, p2) {
    const v1 = p1.replace(/[012]$/, '');
    const v2 = p2.replace(/[012]$/, '');
    if (v1 === v2) return 1.0;
    const key = v1 < v2 ? `${v1}-${v2}` : `${v2}-${v1}`;
    return VOWEL_SIM[key] ?? 0.1;
}

// --- Consonant Similarity (manner + place + voicing) ---
const MANNER = {
    N:'nasal',M:'nasal',NG:'nasal',
    P:'stop',B:'stop',T:'stop',D:'stop',K:'stop',G:'stop',
    F:'fricative',V:'fricative',S:'fricative',Z:'fricative',
    SH:'fricative',ZH:'fricative',TH:'fricative',DH:'fricative',HH:'fricative',
    CH:'affricate',JH:'affricate',
    L:'liquid',R:'liquid',
    W:'glide',Y:'glide'
};

const PLACE = {
    P:'bilabial',B:'bilabial',M:'bilabial',
    F:'labiodental',V:'labiodental',
    TH:'dental',DH:'dental',
    T:'alveolar',D:'alveolar',N:'alveolar',S:'alveolar',Z:'alveolar',L:'alveolar',R:'alveolar',
    SH:'postalveolar',ZH:'postalveolar',CH:'postalveolar',JH:'postalveolar',
    K:'velar',G:'velar',NG:'velar',
    HH:'glottal',
    W:'labiovelar',Y:'palatal'
};

const VOICED = new Set(['B','D','G','V','DH','Z','ZH','JH','M','N','NG','L','R','W','Y']);

const MANNER_CROSS = {
    'nasal-liquid': 0.3,
    'liquid-nasal': 0.3,
    'affricate-stop': 0.4,
    'stop-affricate': 0.4,
    'fricative-stop': 0.2,
    'stop-fricative': 0.2,
};

function consonantSimilarity(p1, p2) {
    const c1 = p1.replace(/[012]$/, '');
    const c2 = p2.replace(/[012]$/, '');
    if (c1 === c2) return 1.0;

    const m1 = MANNER[c1], m2 = MANNER[c2];
    if (!m1 || !m2) return 0.1;

    let score;
    if (m1 === m2) {
        score = 0.6;
    } else {
        score = MANNER_CROSS[`${m1}-${m2}`] ?? 0.1;
    }

    // Place bonus
    const pl1 = PLACE[c1], pl2 = PLACE[c2];
    if (pl1 && pl2 && pl1 === pl2) score += 0.2;

    // Voicing bonus
    if (VOICED.has(c1) === VOICED.has(c2)) score += 0.1;

    return Math.min(1.0, score);
}

// --- Extract rhyming segment from last stressed vowel onward ---
function extractSegment(phonemes) {
    // Scan right-to-left for last stressed vowel (marker 1 or 2)
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
    // Ultimate fallback: last 3 phonemes
    return phonemes.slice(-3);
}

// --- Score two aligned phoneme sequences position-by-position ---
function scoreAligned(seg1, seg2) {
    const minLen = Math.min(seg1.length, seg2.length);
    const maxLen = Math.max(seg1.length, seg2.length);

    let weightedSum = 0;
    let weightedCount = 0;

    for (let i = 0; i < minLen; i++) {
        const p1 = seg1[i];
        const p2 = seg2[i];
        const isVowel1 = /[AEIOU]/.test(p1[0]);
        const isVowel2 = /[AEIOU]/.test(p2[0]);

        let pairScore;
        if (isVowel1 && isVowel2) {
            pairScore = vowelSimilarity(p1, p2);
        } else if (!isVowel1 && !isVowel2) {
            pairScore = consonantSimilarity(p1, p2);
        } else {
            pairScore = 0.0; // vowel-consonant mismatch
        }

        // Stressed vowel pairs count 2x
        const isStressed = (isVowel1 && /[12]$/.test(p1)) || (isVowel2 && /[12]$/.test(p2));
        const weight = isStressed ? 2.0 : 1.0;

        weightedSum += pairScore * weight;
        weightedCount += weight;
    }

    // Penalty for unmatched trailing phonemes
    const unmatched = maxLen - minLen;
    weightedSum -= unmatched * 0.1;

    if (weightedCount === 0) return 0;
    return Math.max(0, Math.min(1, weightedSum / weightedCount));
}

// --- Main scoring function: returns 0.0 to 1.0 ---
export function rhymeScore(word1, word2) {
    const phonemes1 = getFullPhonemes(word1);
    const phonemes2 = getFullPhonemes(word2);
    if (!phonemes1 || !phonemes2) return 0;

    const seg1 = extractSegment(phonemes1);
    const seg2 = extractSegment(phonemes2);
    if (!seg1 || !seg2) return 0;

    // Bidirectional: score L→R (stress-aligned) and R→L (ending-aligned)
    // Only use reverse when forward shows some match — prevents coincidental
    // ending overlaps (e.g., shared "-unz" suffix) from inflating unrelated words
    const fwdScore = scoreAligned(seg1, seg2);
    const revScore = scoreAligned([...seg1].reverse(), [...seg2].reverse());
    let score = fwdScore >= 0.25 ? Math.max(fwdScore, revScore) : fwdScore;

    // Tail coverage dampening: when the rhyming segment is a small fraction
    // of the word, the tail match alone isn't enough for a high score
    const avgSegLen = (seg1.length + seg2.length) / 2;
    const avgWordLen = (phonemes1.length + phonemes2.length) / 2;
    const tailRatio = avgSegLen / avgWordLen;
    if (tailRatio < 0.5) {
        score *= tailRatio / 0.5;
    }

    // Syllable count penalty: different syllable counts reduce structural fit
    const syl1 = phonemes1.filter(p => /[AEIOU]/.test(p[0])).length;
    const syl2 = phonemes2.filter(p => /[AEIOU]/.test(p[0])).length;
    const sylDiff = Math.abs(syl1 - syl2);
    if (sylDiff > 0) {
        score *= Math.max(0.6, 1.0 - sylDiff * 0.15);
    }

    return Math.max(0, Math.min(1, score));
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

// --- Core lookup: get bare vowel pattern for any word ---
export function getPattern(word) {
    if (!word) return null;
    const wordLower = word.toLowerCase();
    let pattern = null;

    // Tier 1: full rhymeData
    if (!pattern && state.rhymeData) {
        const data = state.rhymeData[wordLower];
        if (data) {
            if (data.rhyme_pattern) pattern = data.rhyme_pattern;
            else if (Array.isArray(data)) pattern = data;
        }
    }

    // Tier 2: compact CMU lookup
    if (!pattern && state.cmuLookup && state.cmuLookup[wordLower]) {
        const compact = state.cmuLookup[wordLower];
        const pipeIdx = compact.lastIndexOf('|');
        pattern = compact.substring(0, pipeIdx).split('-');
    }

    // Tier 3: runtime cache (previously computed rule-based)
    if (!pattern && state.runtimePatterns[wordLower]) {
        const cached = state.runtimePatterns[wordLower];
        const pipeIdx = cached.lastIndexOf('|');
        pattern = cached.substring(0, pipeIdx).split('-');
    }

    // Tier 4: rule-based fallback
    if (!pattern) {
        const approx = ruleBasedPattern(wordLower);
        if (approx) {
            const syllables = approx.length;
            state.runtimePatterns[wordLower] = `${approx.join('-')}|${syllables}`;
            pattern = approx;
        }
    }

    // Strip consonant context (e.g. "AE+nasal" -> "AE") for bare vowel index lookup
    if (pattern) {
        return pattern.map(p => p.includes('+') ? p.split('+')[0] : p);
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
    if (!word) return [];
    const phonemes = getFullPhonemes(word);
    if (phonemes) {
        // Compute context-aware pattern from full phonemes
        const pattern = [];
        for (let i = 0; i < phonemes.length; i++) {
            if (/[AEIOU]/.test(phonemes[i][0])) {
                const vowel = phonemes[i].replace(/[012]$/, '');
                let nextClass = 'null';
                for (let j = i + 1; j < phonemes.length; j++) {
                    if (/[AEIOU]/.test(phonemes[j][0])) break;
                    nextClass = classifyConsonant(phonemes[j]);
                    break;
                }
                pattern.push(`${vowel}+${nextClass}`);
            }
        }
        return pattern;
    }
    // Fall back to rule-based (which already has context)
    return ruleBasedPattern(word.toLowerCase()) || [];
}

// --- Aligned phoneme comparison for feedback card display ---
export function getAlignedComparison(word1, word2) {
    const phonemes1 = getFullPhonemes(word1);
    const phonemes2 = getFullPhonemes(word2);
    if (!phonemes1 || !phonemes2) return null;

    const seg1 = extractSegment(phonemes1);
    const seg2 = extractSegment(phonemes2);
    if (!seg1 || !seg2) return null;

    // Score both directions to determine alignment
    const fwdScore = scoreAligned(seg1, seg2);
    const revScore = scoreAligned([...seg1].reverse(), [...seg2].reverse());
    const useReverse = fwdScore >= 0.25 && revScore > fwdScore;

    // Build aligned pair arrays
    const maxLen = Math.max(seg1.length, seg2.length);
    const pairs = [];

    if (useReverse) {
        // Right-align: pad shorter segment on the left
        const pad1 = maxLen - seg1.length;
        const pad2 = maxLen - seg2.length;
        for (let i = 0; i < maxLen; i++) {
            const p1 = i >= pad1 ? seg1[i - pad1] : null;
            const p2 = i >= pad2 ? seg2[i - pad2] : null;
            pairs.push(buildPair(p1, p2));
        }
    } else {
        // Left-align: pad shorter segment on the right
        for (let i = 0; i < maxLen; i++) {
            const p1 = i < seg1.length ? seg1[i] : null;
            const p2 = i < seg2.length ? seg2[i] : null;
            pairs.push(buildPair(p1, p2));
        }
    }

    // Overall match percentage (same logic as rhymeScore)
    const overall = rhymeScore(word1, word2);

    return {
        word1, word2,
        alignment: useReverse ? 'reverse' : 'forward',
        pairs,
        matchPercent: Math.round(overall * 100),
        fullPhonemes1: phonemes1,
        fullPhonemes2: phonemes2,
        segment1: seg1,
        segment2: seg2,
    };
}

function buildPair(p1, p2) {
    const isVowel1 = p1 ? /[AEIOU]/.test(p1[0]) : false;
    const isVowel2 = p2 ? /[AEIOU]/.test(p2[0]) : false;

    let similarity = 0;
    if (p1 && p2) {
        if (isVowel1 && isVowel2) {
            similarity = vowelSimilarity(p1, p2);
        } else if (!isVowel1 && !isVowel2) {
            similarity = consonantSimilarity(p1, p2);
        }
    }

    return {
        p1: p1 ? { phoneme: p1, isVowel: isVowel1, clean: p1.replace(/[012]$/, '') } : null,
        p2: p2 ? { phoneme: p2, isVowel: isVowel2, clean: p2.replace(/[012]$/, '') } : null,
        similarity,
        match: similarity >= 0.8,
        mismatch: p1 && p2 && similarity < 0.4,
    };
}
