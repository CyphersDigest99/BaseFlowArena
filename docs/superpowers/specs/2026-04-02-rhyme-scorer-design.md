# Weighted Phoneme Rhyme Scorer Design

## Problem

The binary pattern-matching approach (exact vowel pattern match = rhyme, no match = not a rhyme) has two failure modes:

1. **Too strict for long words** — "otherwise" (`AH-ER-AY`) only matches "hoverflies" because 3-vowel exact matches are rare. Misses obvious rhymes like "undermine", "paradise".
2. **Too noisy for short words** — "instrument" (`IH-AH-AH`) matches "cinema", "criminal" — words that share vowels but don't rhyme.

The root cause: rhyming is a gradient, not a binary. "Lantern" and "panther" rhyme strongly (0.85), "lantern" and "tractor" rhyme weakly (0.5), "lantern" and "bicycle" don't rhyme at all (0.05). A continuous score captures this; a binary match cannot.

## Prior Art

Research into existing solutions (Hirjee-Brown BLOSUM-inspired phoneme substitution matrices, DopeLearning vowel-only matching, PanPhon articulatory feature vectors, Phyme categorical rhyme types, Datamuse/RhymeBrain APIs) found that nobody has shipped a production-ready browser-compatible multi-syllabic rhyme scorer for the freestyle rap use case. The pieces exist but nobody has assembled them. This design combines established phonetic distance principles into a custom scorer.

## Design

### Scoring Function: `rhymeScore(word1, word2)`

Lives in `phonetics.js`. Takes two words (strings), looks up their phonemes internally, returns 0.0-1.0.

**Step 1: Get phonemes for both words**
Lookup chain: `state.rhymeData[word].phonemes` (full CMU data for word-list words) -> `state.cmuPhonemes[word]` (full CMU data for all other CMU words, from `cmu_phonemes.json`).

**Step 2: Extract rhyming segments**
From the **last** stressed vowel (stress marker 1 or 2) to the end of the word. This is critical for multi-syllable words: extracting from the primary (first) stressed vowel causes long words to score poorly because too much of the word is included. The rhyming part of a word is its tail, not its head.

Scan phonemes right-to-left, find the last vowel with stress marker 1 or 2, extract from there to end. Fallback: last vowel (stress 0) if no stressed vowel found.

- "lantern" (L AE1 N T ER0 N) -> last stressed: AE1 -> segment: `AE1 N T ER0 N`
- "panther" (P AE1 N TH ER0) -> last stressed: AE1 -> segment: `AE1 N TH ER0`
- "tractor" (T R AE1 K T ER0) -> last stressed: AE1 -> segment: `AE1 K T ER0`
- "phenotype" (F IY1 N AH0 T AY2 P) -> last stressed: AY2 -> segment: `AY2 P` (matches "-type" words)
- "otherwise" (AH1 DH ER0 W AY2 Z) -> last stressed: AY2 -> segment: `AY2 Z` (matches "-ize" words)
- "undermine" (AH1 N D ER0 M AY2 N) -> last stressed: AY2 -> segment: `AY2 N` (matches "otherwise" via vowel similarity)

**Step 3: Align and score**
Position-by-position comparison of the two segments. Each aligned pair gets a similarity score:

*Vowel-vowel pairs* — lookup in a 15x15 similarity matrix based on articulatory distance (IPA vowel chart positions):
- Identical: 1.0 (AE vs AE)
- Same height or same frontness: 0.7-0.8 (AE vs EH — both front, differ in height)
- Adjacent in vowel space: 0.4-0.6 (AE vs AH)
- Distant: 0.1-0.3 (AE vs UW — front-low vs back-high)

*Consonant-consonant pairs* — based on manner + place similarity:
- Identical: 1.0 (N vs N)
- Same manner class: 0.7 (N vs M — both nasal)
- Same place of articulation: 0.5 (T vs D — both alveolar, differ in voicing)
- Different manner and place: 0.1-0.3 (N vs K — nasal vs velar stop)

*Vowel-consonant or consonant-vowel:* 0.0 (treated as insertion/deletion)

*Unmatched trailing phonemes* (when segments differ in length): penalty of 0.1 per unmatched phoneme, subtracted from the total.

**Step 4: Weight by stress**
Phoneme pairs involving a stressed vowel (marker 1 or 2) count 2x in the final average. This makes the stressed syllable the dominant factor — matching stressed vowels + their consonant neighbors matters more than matching unstressed endings.

**Step 5: Normalize**
Weighted sum of pair scores / weighted count of pairs. Result: 0.0 to 1.0.

### Vowel Similarity Matrix

15 ARPAbet vowels. Values derived from IPA vowel chart positions (height: close/mid/open, frontness: front/central/back, rounding). Approximate values:

```
       AA   AE   AH   AO   AW   AY   EH   ER   EY   IH   IY   OW   OY   UH   UW
AA    1.0  0.4  0.7  0.8  0.5  0.4  0.3  0.3  0.2  0.2  0.1  0.5  0.4  0.5  0.3
AE         1.0  0.6  0.3  0.4  0.5  0.8  0.3  0.6  0.5  0.3  0.2  0.3  0.2  0.1
AH              1.0  0.5  0.5  0.4  0.6  0.5  0.4  0.5  0.3  0.4  0.3  0.5  0.4
AO                   1.0  0.5  0.3  0.3  0.3  0.2  0.2  0.1  0.7  0.6  0.6  0.5
AW                        1.0  0.5  0.3  0.3  0.3  0.2  0.1  0.6  0.5  0.4  0.4
AY                             1.0  0.4  0.3  0.6  0.5  0.5  0.3  0.4  0.2  0.2
EH                                  1.0  0.4  0.7  0.7  0.5  0.2  0.3  0.2  0.1
ER                                       1.0  0.3  0.4  0.3  0.3  0.3  0.4  0.3
EY                                            1.0  0.5  0.6  0.3  0.3  0.2  0.1
IH                                                 1.0  0.8  0.2  0.2  0.3  0.2
IY                                                      1.0  0.1  0.2  0.2  0.2
OW                                                           1.0  0.6  0.6  0.7
OY                                                                1.0  0.4  0.4
UH                                                                     1.0  0.8
UW                                                                          1.0
```

These values will need tuning based on real-world testing. The matrix is symmetric.

### Consonant Similarity

Rather than a full matrix (25+ consonants), use manner-of-articulation classes with place-of-articulation bonus:

**Manner classes:** nasal (N, M, NG), stop (P, B, T, D, K, G), fricative (F, V, S, Z, SH, ZH, TH, DH, HH), affricate (CH, JH), liquid (L, R), glide (W, Y)

**Base scores:**
- Same manner: 0.6
- Nasal vs liquid: 0.3 (sonority neighbors)
- Stop vs affricate: 0.4 (both have burst)
- Stop vs fricative: 0.2
- All other cross-manner: 0.1

**Place bonus (+0.2):** Same place of articulation (both alveolar, both velar, etc.)

**Voicing bonus (+0.1):** Same voicing (both voiced or both voiceless)

Scores capped at 1.0. Identical consonants = 1.0.

### Candidate Retrieval (Inverted Index)

The inverted index changes from consonant-context patterns to **bare vowel patterns**. This produces broader candidate pools that the scorer then ranks and filters.

Index key for "lantern": `AE-ER` (just the vowels, no consonant class)
Candidate pool: all ~117k CMU words with the vowel pattern `AE-ER`

For words with no full phoneme data (CMU-lookup-only), scoring falls back to a simplified version that compares vowel patterns with the vowel similarity matrix (no consonant scoring). This is less accurate but ensures every word gets some kind of score.

### Threshold and Tier Mapping

**Display threshold:** 0.45 — words scoring below this are not shown in the rhyme modal.

**Tier mapping** (replaces the current `calculateRhymeScore` tier system):
- **Perfect** (0.85-1.0): Near-identical phoneme sequences from stressed vowel onward
- **Strong** (0.65-0.84): Clear rhyme, consonant texture may differ
- **Standard** (0.50-0.64): Recognizable rhyme, vowels match but consonant context diverges
- **Slant** (0.45-0.49): Borderline — shown but marked as slant

These thresholds are tunable. The rejection log data can inform future adjustments.

### Data Layer Changes

**`cmu_lookup.json`** — reverts to bare vowel patterns (no consonant context):
```json
{
  "lantern": "AE-ER|2",
  "tractor": "AE-ER|2",
  "panther": "AE-ER|2"
}
```

**`rhyme_data.json`** — `rhyme_pattern` field also reverts to bare vowels. The `phonemes` field (full ARPAbet arrays) is what the scorer actually uses. The pattern is only for candidate retrieval.

**New: `cmu_phonemes.json`** — full phoneme arrays for all ~117k CMU words. Needed because `cmu_lookup.json` only has vowel patterns, but the scorer needs full phoneme sequences including stress markers (0, 1, 2) for segment extraction. Format:
```json
{
  "lantern": "L AE1 N T ER0 N",
  "tractor": "T R AE1 K T ER0"
}
```
Space-separated phoneme strings with stress markers preserved (compact, ~3-4MB). Parsed into arrays at scoring time. Stress markers are essential for the "last stressed vowel" segment extraction in Step 2. Loaded at startup alongside the other data files.

### File Changes

| Action | File | Change |
|--------|------|--------|
| Modify | `process_rhymes.py` | Revert to bare vowel patterns, add `--cmu-phonemes` mode to generate `cmu_phonemes.json` |
| Modify | `public/js/phonetics.js` | Add `rhymeScore()`, vowel similarity matrix, consonant similarity, load `cmu_phonemes.json`, revert inverted index to bare vowels, revert `getPattern()` to bare vowels |
| Modify | `public/js/rhyme.js` | `getValidRhymesForWord()` uses score threshold instead of exact match, tier mapping uses score ranges |
| Modify | `public/js/main.js` | Load `cmu_phonemes.json` at startup |
| Modify | `public/js/state.js` | Add `state.cmuPhonemes` |
| Create | `public/cmu_phonemes.json` | Full phoneme strings for all CMU words |
| Regenerate | `public/cmu_lookup.json` | Bare vowel patterns (simpler, smaller) |
| Regenerate | `public/rhyme_data.json` | Bare vowel patterns in `rhyme_pattern` field |

### What Doesn't Change

- Rhyme modal UI, sort buttons, reject/undo, slant tagging, manual rhyme submission
- The lookup chain (rhymeData -> cmuLookup -> rule-based fallback) for pattern retrieval
- Rejection logging with phonetic context
- Retroactive enrichment of existing rejections
- Storage persistence of runtimePatterns and rejectionLog
- The rule-based fallback for non-CMU words

### Out of Scope

- Automatic compound decomposition (multi-word rhyme suggestions)
- External API integration (Datamuse, RhymeBrain) — keeping everything local/offline
- Auto-filtering based on rejection patterns
- Phonetic word embeddings or ML-based approaches — the weighted edit distance is simpler and more interpretable

### Performance

- Inverted index on bare vowels produces larger candidate pools (~2,000-5,000 for 2-syllable words)
- Scoring each candidate: ~50 microseconds (array comparison + matrix lookups)
- Total per modal open: ~100-250ms for 2-syllable words, potentially more for 1-syllable words with very large pools
- If performance is an issue, can add syllable count as a secondary filter (only score words within +/- 1 syllable)
- `cmu_phonemes.json` adds ~3-4MB to startup load, but loads in parallel with other data
