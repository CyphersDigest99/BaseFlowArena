# Rhyme Alias System — Design Spec

## Purpose

Allow users to declare that two words sound the same, so that one word inherits all rhyme matches from the other. Solves the problem of words missing from the CMU dictionary (e.g., "litres" has no phonetic data, but "leaders" does and sounds identical). The alias is a living pointer — not a snapshot — so results update as the scorer improves.

## UI Change

A checkbox is added next to the existing "Add your own rhyme" input at the bottom of the rhyme modal.

- **Label:** "Sounds like"
- **Default state:** Unchecked
- **When unchecked:** Input works exactly as today — adds a single manual rhyme on submit
- **When checked:** Input becomes an alias declaration. Submitting adds the typed word as an alias for the current base word. Placeholder changes to "Type a word this sounds like..."

Submit triggers: pressing Enter in the input or clicking the Add button (same as today).

## Data Model

New state property:

```js
state.rhymeAliases = {}  // { baseWord: Set(["alias1", "alias2"]) }
```

Multiple aliases per word are allowed. Example: `{ "litres": Set(["leaders", "meters"]) }`.

## Scoring Integration

In `getValidRhymesForWord(baseWord)`:

1. Run existing logic — get pattern for baseWord, pull candidates from inverted index, score against baseWord, filter at threshold. This may return 0 results for words with no CMU data.
2. Check `state.rhymeAliases[baseWordLower]` for aliases.
3. For each alias word:
   a. Get the alias word's vowel pattern via `phonetics.getPattern(aliasWord)`
   b. Pull candidates from `phonetics.getCandidatesForPattern(patternString)` using the alias word's pattern
   c. Score each candidate against the **alias word** (not the base word) via `phonetics.rhymeScore(aliasWord, candidate)` — because the alias word has the phonetic data
   d. Filter at the same `SCORE_THRESHOLD` (0.45)
4. Merge alias results into the main results. Dedup by word — if a word appears from both the original and alias paths, keep the higher score.
5. Exclude the base word itself and any rejected words (existing logic already handles this, but alias candidates must also be checked against `rejectedSet`).

## Storage Integration

`rhymeAliases` is added to the persistence layer using the same serialization pattern as `rejectedRhymes` and `manualRhymes` (object of Sets ↔ object of arrays):

- `saveSettings()` — serialize `state.rhymeAliases` via `serializeNestedSets()`
- `loadSettings()` — deserialize via `deserializeNestedSets()`
- `exportSettings()` — include in export data
- `importSettings()` — include in import logic
- `resetToDefaults()` — reset to `{}`

## Files Modified

**`public/index.html`**
- Add a checkbox element with label next to the existing manual rhyme input inside `.add-rhyme-section`

**`public/js/state.js`**
- Add `rhymeAliases: {}` to the state object

**`public/js/storage.js`**
- Add `rhymeAliases` to `saveSettings()`, `loadSettings()`, `exportSettings()`, `importSettings()`, `resetToDefaults()`

**`public/js/rhyme.js`**
- `addManualRhyme()` — check checkbox state; if checked, add to `state.rhymeAliases` instead of `state.manualRhymes`
- `getValidRhymesForWord()` — after existing candidate scoring, check for aliases and merge their candidates with dedup
- Update placeholder text when checkbox toggles

**`public/styles.css`**
- Minimal styling for the checkbox inline with the input

## Out of Scope

- Alias removal UI (can be done via export/edit/import for now)
- Bidirectional aliases (litres→leaders does not imply leaders→litres)
- Alias chain resolution (if A→B and B→C, A does NOT get C's rhymes — only direct aliases)
