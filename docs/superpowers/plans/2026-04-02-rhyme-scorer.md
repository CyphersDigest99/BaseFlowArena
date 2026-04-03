# Weighted Phoneme Rhyme Scorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace binary pattern matching with a continuous 0.0-1.0 phoneme similarity scorer that uses articulatory distance matrices, stress-aware segment extraction, and threshold filtering to produce ranked rhyme results.

**Architecture:** Candidate words are retrieved via bare-vowel inverted index (O(1)), then scored pairwise using a weighted edit distance on phoneme segments extracted from each word's last stressed vowel onward. Vowel pairs use a 15x15 articulatory similarity matrix; consonant pairs use manner/place/voicing heuristics. Scored results are filtered by threshold (0.45) and sorted by score.

**Tech Stack:** Python (CMU dictionary processing), Vanilla JavaScript ES6 modules (browser runtime)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `process_rhymes.py` | Revert to bare vowel patterns, add `--cmu-phonemes` mode |
| Modify | `public/js/state.js` | Add `state.cmuPhonemes` |
| Modify | `public/js/phonetics.js` | Scoring engine: vowel matrix, consonant similarity, segment extraction, `rhymeScore()`, `loadCmuPhonemes()`, `getFullPhonemes()`, update `getPattern()` to strip context, update `getVowelContext()` to compute from phonemes |
| Modify | `public/js/rhyme.js` | Rewrite `getValidRhymesForWord()`, update tier mapping, update sorting, remove old `calculateRhymeScore()`/`getVowelSimilarity()` |
| Modify | `public/js/main.js` | Add `loadCmuPhonemes()` to parallel startup |
| Create | `public/cmu_phonemes.json` | Generated: full phoneme strings for ~117k CMU words |
| Regenerate | `public/cmu_lookup.json` | Bare vowel patterns (no consonant context) |
| Regenerate | `public/rhyme_data.json` | Bare vowel patterns in `rhyme_pattern` field |

---

### Task 1: Update Data Pipeline and Regenerate Files

**Files:**
- Modify: `process_rhymes.py:98-215` (pattern functions), `process_rhymes.py:279-327` (cmu_lookup gen), `process_rhymes.py:220-231` (CLI args), `process_rhymes.py:330-339` (main)
- Create: `public/cmu_phonemes.json`
- Regenerate: `public/cmu_lookup.json`, `public/rhyme_data.json`

- [ ] **Step 1: Revert `process_word_list()` to use bare vowel patterns**

In `process_rhymes.py`, change `process_word_list()` to call `get_all_vowel_pattern(word)` instead of `get_context_aware_pattern(word)`:

```python
# In process_word_list(), around line 255:
# BEFORE:
        pattern = get_context_aware_pattern(word)
# AFTER:
        pattern = get_all_vowel_pattern(word)
```

- [ ] **Step 2: Revert `generate_cmu_lookup()` to bare vowel patterns**

Replace the pattern extraction loop in `generate_cmu_lookup()` with bare vowel extraction:

```python
def generate_cmu_lookup(output_dir):
    """Generates cmu_lookup.json from the full CMU Pronouncing Dictionary."""
    output_path = os.path.join(SCRIPT_DIR, output_dir, 'cmu_lookup.json')

    print(f"Generating cmu_lookup.json from full CMU dictionary...")

    cmu_entries = pronouncing.cmudict.entries()
    lookup = {}
    count = 0

    for word, pronunciation in cmu_entries:
        if not word.isalpha():
            continue
        if word in lookup:
            continue

        phonemes = pronunciation

        # Extract bare vowels only (no consonant context)
        pattern_parts = []
        for phone in phonemes:
            if re.match(r'^[AEIOU]', phone):
                vowel = re.sub(r'[012]$', '', phone)
                pattern_parts.append(vowel)

        if not pattern_parts:
            continue

        syllable_count = max(1, len([p for p in phonemes if p[-1].isdigit()]))
        pattern_str = '-'.join(pattern_parts)
        lookup[word] = f"{pattern_str}|{syllable_count}"
        count += 1

    print(f"Processed {count} words from CMU dictionary.")
    print(f"Writing to: {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(lookup, f, separators=(',', ':'), ensure_ascii=False)
    print("Done.")
```

- [ ] **Step 3: Add `generate_cmu_phonemes()` function**

Add this new function after `generate_cmu_lookup()`:

```python
def generate_cmu_phonemes(output_dir):
    """Generates cmu_phonemes.json — full phoneme strings for all CMU words."""
    output_path = os.path.join(SCRIPT_DIR, output_dir, 'cmu_phonemes.json')

    print(f"Generating cmu_phonemes.json from full CMU dictionary...")

    cmu_entries = pronouncing.cmudict.entries()
    phonemes_map = {}
    count = 0

    for word, pronunciation in cmu_entries:
        if not word.isalpha():
            continue
        if word in phonemes_map:
            continue

        phonemes_map[word] = ' '.join(pronunciation)
        count += 1

    print(f"Processed {count} words from CMU dictionary.")
    print(f"Writing to: {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(phonemes_map, f, separators=(',', ':'), ensure_ascii=False)
    print("Done.")
```

- [ ] **Step 4: Update CLI args and main block**

Add the `--cmu-phonemes` flag and update `--all` to run all three generators:

```python
def parse_args():
    parser = argparse.ArgumentParser(description='Generate rhyme data for BaseFlowArena')
    parser.add_argument('--input', default='public/word-list.txt',
                        help='Input word list file (default: public/word-list.txt)')
    parser.add_argument('--output-dir', default='public',
                        help='Output directory (default: public)')
    parser.add_argument('--cmu-full', action='store_true',
                        help='Generate cmu_lookup.json from full CMU dictionary')
    parser.add_argument('--cmu-phonemes', action='store_true',
                        help='Generate cmu_phonemes.json from full CMU dictionary')
    parser.add_argument('--all', action='store_true',
                        help='Generate rhyme_data.json, cmu_lookup.json, and cmu_phonemes.json')
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()

    if args.all:
        process_word_list(args.input, args.output_dir)
        generate_cmu_lookup(args.output_dir)
        generate_cmu_phonemes(args.output_dir)
    elif args.cmu_phonemes:
        generate_cmu_phonemes(args.output_dir)
    elif args.cmu_full:
        generate_cmu_lookup(args.output_dir)
    else:
        process_word_list(args.input, args.output_dir)
```

- [ ] **Step 5: Run the data pipeline**

Run: `python process_rhymes.py --all`

Expected output:
```
Generating rhyme_data.json...
Reading words from: .../public/word-list.txt
Found XXXXX words. Processing...
Processed: ~18228 words
Writing ... patterns to: .../public/rhyme_data.json
Done.
Generating cmu_lookup.json from full CMU dictionary...
Processed ~117486 words from CMU dictionary.
Writing to: .../public/cmu_lookup.json
Done.
Generating cmu_phonemes.json from full CMU dictionary...
Processed ~117486 words from CMU dictionary.
Writing to: .../public/cmu_phonemes.json
Done.
```

- [ ] **Step 6: Verify generated files**

Spot-check `public/cmu_lookup.json`:
- "lantern" should be `"AE-ER|2"` (bare vowels, no `+nasal`)
- "tractor" should be `"AE-ER|2"` (same bare vowel pattern as lantern)

Spot-check `public/rhyme_data.json`:
- "lantern" should have `"rhyme_pattern": ["AE", "ER"]` (bare vowels)
- "lantern" should still have `"phonemes": ["L", "AE1", "N", "T", "ER0", "N"]` (full phonemes with stress)

Spot-check `public/cmu_phonemes.json`:
- "lantern" should be `"L AE1 N T ER0 N"` (space-separated, stress markers preserved)
- "phenotype" should be `"F IY1 N AH0 T AY2 P"` (secondary stress marker 2 present)

- [ ] **Step 7: Commit**

```bash
git add process_rhymes.py public/rhyme_data.json public/cmu_lookup.json public/cmu_phonemes.json
git commit -m "feat: revert to bare vowel patterns, generate cmu_phonemes.json for scorer"
```

---

### Task 2: State and Loading Plumbing

**Files:**
- Modify: `public/js/state.js:41` (add cmuPhonemes)
- Modify: `public/js/phonetics.js:155-170` (add loadCmuPhonemes), `public/js/phonetics.js:187-224` (update getPattern), `public/js/phonetics.js:260-264` (update getVowelContext)
- Modify: `public/js/main.js:100` (parallel load)

- [ ] **Step 1: Add `cmuPhonemes` to state.js**

In `public/js/state.js`, add after the `cmuInvertedIndex` line (around line 42):

```javascript
    cmuPhonemes: null,        // Full phoneme strings for all CMU words (loaded from cmu_phonemes.json)
```

- [ ] **Step 2: Add `loadCmuPhonemes()` to phonetics.js**

In `public/js/phonetics.js`, add after the `loadCmuLookup()` function (after line 170):

```javascript
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
```

- [ ] **Step 3: Add `getFullPhonemes()` to phonetics.js**

Add after `loadCmuPhonemes()`:

```javascript
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
```

- [ ] **Step 4: Update `getPattern()` to strip consonant context**

Replace the entire `getPattern()` function in `phonetics.js` (lines 187-224):

```javascript
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
```

- [ ] **Step 5: Update `getVowelContext()` to compute from phonemes**

Replace the `getVowelContext()` function in `phonetics.js` (lines 261-264):

```javascript
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
```

- [ ] **Step 6: Wire up loading in main.js**

In `public/js/main.js`, update the parallel load at line 100:

```javascript
    // 2. Load Settings, Rhyme Data, CMU Lookup, CMU Phonemes, Word List
    storage.loadSettings();
    await Promise.all([rhyme.loadRhymeData(), phonetics.loadCmuLookup(), phonetics.loadCmuPhonemes()]);
    await wordManager.loadWords();
```

- [ ] **Step 7: Verify loading in browser**

Run: `python server.py`

Open browser to `http://localhost:8000`. Open DevTools console. Expected log messages:
```
Loading CMU phoneme data...
CMU phonemes loaded (117486 entries).
```

No errors about failed fetches.

- [ ] **Step 8: Commit**

```bash
git add public/js/state.js public/js/phonetics.js public/js/main.js
git commit -m "feat: add cmuPhonemes loading, bare vowel getPattern, phoneme-based getVowelContext"
```

---

### Task 3: Scoring Engine

**Files:**
- Modify: `public/js/phonetics.js` (add after `getFullPhonemes()`, before `getPattern()`)

This task adds the core scoring logic: vowel similarity matrix, consonant similarity function, segment extraction, and the `rhymeScore()` function.

- [ ] **Step 1: Add the vowel similarity matrix**

Add after `getFullPhonemes()` in `phonetics.js`:

```javascript
// ============================================================
// RHYME SCORING ENGINE
// ============================================================

// --- 15x15 Vowel Similarity Matrix (articulatory distance) ---
// Values from IPA vowel chart: height (close/mid/open), frontness (front/central/back), rounding.
// Symmetric — stored as sorted key pairs.
const VOWEL_SIM = {};
(function buildVowelMatrix() {
    // Raw upper triangle from spec (row, col, value)
    const raw = [
        ['AA','AE',0.4],['AA','AH',0.7],['AA','AO',0.8],['AA','AW',0.5],['AA','AY',0.4],
        ['AA','EH',0.3],['AA','ER',0.3],['AA','EY',0.2],['AA','IH',0.2],['AA','IY',0.1],
        ['AA','OW',0.5],['AA','OY',0.4],['AA','UH',0.5],['AA','UW',0.3],
        ['AE','AH',0.6],['AE','AO',0.3],['AE','AW',0.4],['AE','AY',0.5],
        ['AE','EH',0.8],['AE','ER',0.3],['AE','EY',0.6],['AE','IH',0.5],['AE','IY',0.3],
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
        ['UH','UW',0.8],
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
```

- [ ] **Step 2: Add consonant similarity function**

Add after `vowelSimilarity()`:

```javascript
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
```

- [ ] **Step 3: Add segment extraction function**

Add after `consonantSimilarity()`:

```javascript
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
```

- [ ] **Step 4: Add `rhymeScore()` function**

Add after `extractSegment()`:

```javascript
// --- Main scoring function: returns 0.0 to 1.0 ---
export function rhymeScore(word1, word2) {
    const phonemes1 = getFullPhonemes(word1);
    const phonemes2 = getFullPhonemes(word2);
    if (!phonemes1 || !phonemes2) return 0;

    const seg1 = extractSegment(phonemes1);
    const seg2 = extractSegment(phonemes2);
    if (!seg1 || !seg2) return 0;

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
```

- [ ] **Step 5: Verify scoring in browser console**

Run: `python server.py`, open `http://localhost:8000`, open DevTools console.

Test known pairs:
```javascript
// After app loads:
import('./js/phonetics.js').then(p => {
    console.log('lantern/panther:', p.rhymeScore('lantern', 'panther'));  // expect 0.6-0.9
    console.log('lantern/tractor:', p.rhymeScore('lantern', 'tractor'));  // expect 0.3-0.5
    console.log('lantern/bicycle:', p.rhymeScore('lantern', 'bicycle'));  // expect <0.2
    console.log('otherwise/undermine:', p.rhymeScore('otherwise', 'undermine')); // expect 0.5+
    console.log('district/biscuit:', p.rhymeScore('district', 'biscuit'));  // expect 0.5+
    console.log('instrument/implement:', p.rhymeScore('instrument', 'implement')); // expect 0.5+
    console.log('guinea/kinky:', p.rhymeScore('guinea', 'kinky'));  // expect <0.45
});
```

If scores don't match expectations, note the actual values for threshold calibration in Task 5.

- [ ] **Step 6: Commit**

```bash
git add public/js/phonetics.js
git commit -m "feat: add rhymeScore() with vowel/consonant similarity matrices and stress-aware segments"
```

---

### Task 4: Integration — Rewrite rhyme.js

**Files:**
- Modify: `public/js/rhyme.js:54-110` (remove old extractRhymingPart, update getPhonemes), `public/js/rhyme.js:177-340` (remove old calculateRhymeScore/getVowelSimilarity), `public/js/rhyme.js:342-378` (rewrite getValidRhymesForWord), `public/js/rhyme.js:649-724` (update displayRhymeList/getTierInfo), `public/js/rhyme.js:839-890` (update sortByRhymeSimilarity)

- [ ] **Step 1: Add score cache and tier constants**

At the top of `rhyme.js`, after the imports (after line 27), add:

```javascript
// --- Score cache: avoids re-scoring in getTierInfo/sort after getValidRhymesForWord ---
let rhymeScoreCache = new Map();

// --- Tier thresholds (from spec) ---
const SCORE_THRESHOLD = 0.45;
const TIER_PERFECT = 0.85;
const TIER_STRONG = 0.65;
const TIER_STANDARD = 0.50;
```

- [ ] **Step 2: Update `getPhonemes()` to use phonetics module**

Replace the existing `getPhonemes()` function (lines 59-67):

```javascript
// --- Get Phonemes (Internal) ---
// Retrieves the complete phoneme array for a given word via phonetics module
function getPhonemes(word) {
    return phonetics.getFullPhonemes(word);
}
```

- [ ] **Step 3: Update `extractRhymingPart()` to use last stressed vowel**

Replace the existing `extractRhymingPart()` function (lines 70-110):

```javascript
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
```

- [ ] **Step 4: Remove old `calculateRhymeScore()` and `getVowelSimilarity()`**

Delete these two functions entirely (lines 177-340 — from `export function calculateRhymeScore` through the closing brace of `getVowelSimilarity`).

These are replaced by `phonetics.rhymeScore()`.

- [ ] **Step 5: Rewrite `getValidRhymesForWord()`**

Replace the existing function (lines 342-378):

```javascript
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
```

- [ ] **Step 6: Update `getTierInfo()` to use new thresholds and cache**

Replace the existing `getTierInfo()` function (lines 727-750):

```javascript
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
```

- [ ] **Step 7: Update `sortByRhymeSimilarity()` to use cache**

Replace the existing `sortByRhymeSimilarity()` function (lines 840-890):

```javascript
// --- Rhyme Similarity Sort ---
function sortByRhymeSimilarity(words, baseWord) {
    const baseWordLower = baseWord.toLowerCase();
    const slantSet = state.slantRhymes[baseWordLower] || new Set();
    const manualSet = state.manualRhymes[baseWordLower] || new Set();

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
```

- [ ] **Step 8: Update tooltip hover handler to use cached scores**

In the `setupRhymeTooltipDelegation()` function (around line 604-614), replace the score calculation:

```javascript
        _activeTooltipTimeout = setTimeout(() => {
            const tier = li.dataset.tier;
            const rhymeWord = li.dataset.rhymeWord;
            let matchValue = '';
            if (tier === 'perfect') {
                matchValue = '100%';
            } else if (tier === 'strong') {
                const baseWordLower = state.currentWord?.toLowerCase();
                const cacheKey = `${baseWordLower}|${rhymeWord.toLowerCase()}`;
                const cached = rhymeScoreCache.get(cacheKey);
                matchValue = cached !== undefined ? `${Math.round(cached * 100)}%` : '~70%';
            }
```

- [ ] **Step 9: Remove the old `isPerfectRhyme()` function**

Delete the `isPerfectRhyme()` function (lines 819-837). It's no longer used — tier determination now goes through `getTierInfo()` which uses score thresholds.

- [ ] **Step 10: Verify in browser**

Run: `python server.py`, open `http://localhost:8000`.

1. Click the rhyme finder button (magnifying glass icon) for a word
2. Verify rhyme modal opens with scored, tiered results
3. Check that "lantern" shows "panther", "banter", "cancer" in the top tiers
4. Check that "lantern" does NOT show "bicycle" or "cinema"
5. Sort buttons (alpha, phonetic, similarity) still work
6. Rejecting a word (X button) still works
7. Manual rhyme submission still works

- [ ] **Step 11: Commit**

```bash
git add public/js/rhyme.js
git commit -m "feat: integrate rhymeScore into getValidRhymesForWord, threshold filtering, new tier mapping"
```

---

### Task 5: Calibration and Edge Cases

**Files:**
- Possibly adjust: `public/js/phonetics.js` (threshold/matrix values), `public/js/rhyme.js` (tier constants)

- [ ] **Step 1: Test calibration word pairs in browser console**

Open DevTools console at `http://localhost:8000` and test these pairs. Import phonetics if needed via the module:

```javascript
// Access via the loaded module
const p = await import('./js/phonetics.js');

// Expected GOOD rhymes (should score >= 0.45):
console.log('lantern/panther:', p.rhymeScore('lantern', 'panther'));
console.log('lantern/banter:', p.rhymeScore('lantern', 'banter'));
console.log('lantern/cancer:', p.rhymeScore('lantern', 'cancer'));
console.log('district/biscuit:', p.rhymeScore('district', 'biscuit'));
console.log('instrument/implement:', p.rhymeScore('instrument', 'implement'));
console.log('otherwise/undermine:', p.rhymeScore('otherwise', 'undermine'));
console.log('phenotype/prototype:', p.rhymeScore('phenotype', 'prototype'));

// Expected BAD rhymes (should score < 0.45):
console.log('lantern/bicycle:', p.rhymeScore('lantern', 'bicycle'));
console.log('guinea/kinky:', p.rhymeScore('guinea', 'kinky'));
console.log('instrument/cinema:', p.rhymeScore('instrument', 'cinema'));
console.log('instrument/articulate:', p.rhymeScore('instrument', 'articulate'));
```

Record the actual scores. If a good pair scores below 0.45, or a bad pair scores above 0.45, note it for adjustment.

- [ ] **Step 2: Adjust threshold if needed**

If calibration reveals the threshold is too high (good rhymes excluded) or too low (bad rhymes included), update `SCORE_THRESHOLD` in `rhyme.js`:

```javascript
const SCORE_THRESHOLD = 0.45; // Adjust this value based on calibration
```

Also adjust tier boundaries if the distribution of scores doesn't cluster well around the current thresholds (0.85/0.65/0.50).

- [ ] **Step 3: Test the rhyme modal end-to-end**

In the browser:
1. Navigate to word "lantern" and open rhyme finder — verify panther, banter, cancer appear
2. Navigate to word "otherwise" — verify undermine appears
3. Navigate to a 1-syllable word (e.g., "beat") — verify it loads within ~500ms (1-syllable words have large candidate pools)
4. Navigate to a word NOT in CMU — verify rule-based fallback produces some candidates
5. Reject a rhyme, close modal, reopen — verify rejected word is gone
6. Add a manual rhyme — verify it appears in the list
7. Sort by similarity — verify tier separators appear correctly

- [ ] **Step 4: Commit final calibration**

```bash
git add public/js/phonetics.js public/js/rhyme.js
git commit -m "feat: calibrate rhyme scorer thresholds after testing"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] `rhymeScore(word1, word2)` in phonetics.js — Task 3
- [x] Vowel similarity matrix (15x15) — Task 3, Step 1
- [x] Consonant similarity (manner + place + voicing) — Task 3, Step 2
- [x] Segment extraction from last stressed vowel — Task 3, Step 3
- [x] Stress weighting (2x for stressed pairs) — Task 3, Step 4
- [x] `cmu_phonemes.json` generation — Task 1, Step 3
- [x] Bare vowel pattern reversion — Task 1, Steps 1-2
- [x] `state.cmuPhonemes` — Task 2, Step 1
- [x] `loadCmuPhonemes()` — Task 2, Step 2
- [x] `getFullPhonemes()` — Task 2, Step 3
- [x] `getPattern()` strips consonant context — Task 2, Step 4
- [x] `getVowelContext()` computes from phonemes — Task 2, Step 5
- [x] Load at startup in parallel — Task 2, Step 6
- [x] `getValidRhymesForWord()` rewrite with scoring — Task 4, Step 5
- [x] Tier mapping (0.85/0.65/0.50/0.45) — Task 4, Steps 1 and 6
- [x] Display threshold (0.45) — Task 4, Step 5
- [x] Modal UI unchanged (sort, reject, slant, manual) — verified in Task 4
- [x] Rejection logging still uses phonetic context — Task 2, Step 5
- [x] Calibration with known word pairs — Task 5

**Placeholder scan:** No TBD/TODO items found.

**Type consistency:** `rhymeScore()` exported from phonetics.js, used as `phonetics.rhymeScore()` in rhyme.js. `getFullPhonemes()` exported from phonetics.js, used as `phonetics.getFullPhonemes()` in rhyme.js. `SCORE_THRESHOLD`, `TIER_PERFECT`, `TIER_STRONG`, `TIER_STANDARD` used consistently across `getValidRhymesForWord()`, `getTierInfo()`, and `sortByRhymeSimilarity()`.
