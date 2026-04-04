# Rhyme Alias System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Sounds like" checkbox to the rhyme modal's add input, allowing users to declare that the current word should inherit all rhyme matches from another word.

**Architecture:** A checkbox toggles the existing add input between two modes: single manual rhyme add (unchecked) and alias declaration (checked). Aliases are stored as `state.rhymeAliases` (object of Sets, same pattern as `rejectedRhymes`). `getValidRhymesForWord()` checks aliases and merges candidates from alias words' patterns, scoring against the alias word. Dedup keeps the higher score.

**Tech Stack:** Vanilla JS (ES6 modules), HTML5, CSS3 with existing CRT theme variables.

**Spec:** `docs/superpowers/specs/2026-04-03-rhyme-alias-design.md`

---

### Task 1: Add `rhymeAliases` to state and storage

**Files:**
- Modify: `public/js/state.js:40` (after `manualRhymes`)
- Modify: `public/js/storage.js:86,140,240,284,338` (save/load/reset/export/import)

- [ ] **Step 1: Add `rhymeAliases` to state.js**

After `manualRhymes: {},` on line 40, add:

```js
    rhymeAliases: {},   // { baseWord: Set('alias1', 'alias2'), ... } — "sounds like" pointers
```

- [ ] **Step 2: Add `rhymeAliases` to `saveSettings()` in storage.js**

After line 86 (`slantRhymes: serializeNestedSets(state.slantRhymes),`), add:

```js
            rhymeAliases: serializeNestedSets(state.rhymeAliases),
```

- [ ] **Step 3: Add `rhymeAliases` to `loadSettings()` in storage.js**

After line 140 (`state.slantRhymes = ...`), add:

```js
             state.rhymeAliases = parsedData.rhymeAliases ? deserializeNestedSets(parsedData.rhymeAliases) : {};
```

- [ ] **Step 4: Add `rhymeAliases` to `resetToDefaults()` in storage.js**

After line 240 (`state.slantRhymes = {};`), add:

```js
    state.rhymeAliases = {};
```

- [ ] **Step 5: Add `rhymeAliases` to `exportSettings()` in storage.js**

After line 284 (`slantRhymes: serializeNestedSets(state.slantRhymes),`), add:

```js
                rhymeAliases: serializeNestedSets(state.rhymeAliases),
```

- [ ] **Step 6: Add `rhymeAliases` to `importSettings()` in storage.js**

After line 338 (`state.slantRhymes = ...`), add:

```js
        state.rhymeAliases = settings.rhymeAliases ? deserializeNestedSets(settings.rhymeAliases) : {};
```

- [ ] **Step 7: Commit**

```bash
git add public/js/state.js public/js/storage.js
git commit -m "feat: add rhymeAliases to state and storage persistence"
```

---

### Task 2: Add checkbox to rhyme modal HTML and CSS

**Files:**
- Modify: `public/index.html:506-510` (add-rhyme-section)
- Modify: `public/styles.css:2789` (add-rhyme-section styles)

- [ ] **Step 1: Add the checkbox to the add-rhyme-section in index.html**

Replace lines 506-510:

```html
            <!-- Manual rhyme addition section -->
            <div class="add-rhyme-section">
                <input type="text" id="manual-rhyme-input" placeholder="Add your own rhyme...">
                <button id="add-manual-rhyme-button" class="icon-button tiny-button"><i class="fas fa-plus"></i> Add</button>
            </div>
```

With:

```html
            <!-- Manual rhyme addition / alias section -->
            <div class="add-rhyme-section">
                <div class="add-rhyme-row">
                    <input type="text" id="manual-rhyme-input" placeholder="Add your own rhyme...">
                    <button id="add-manual-rhyme-button" class="icon-button tiny-button"><i class="fas fa-plus"></i> Add</button>
                </div>
                <label class="sounds-like-toggle">
                    <input type="checkbox" id="sounds-like-checkbox">
                    <span>Sounds like</span>
                </label>
            </div>
```

- [ ] **Step 2: Update CSS for the new layout**

Find the `.add-rhyme-section` block at line 2789 and replace it:

```css
.add-rhyme-section {
    margin-top: 20px;
    padding-top: 15px;
    border-top: 1px dashed var(--border-color);
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.add-rhyme-row {
    display: flex;
    gap: 10px;
    align-items: center;
}

.sounds-like-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-main);
    font-size: 0.85em;
    color: var(--text-color);
    cursor: pointer;
    user-select: none;
    opacity: 0.7;
    transition: opacity 0.15s;
}

.sounds-like-toggle:hover {
    opacity: 1;
}

.sounds-like-toggle input[type="checkbox"] {
    accent-color: var(--primary-accent);
    cursor: pointer;
}
```

- [ ] **Step 3: Commit**

```bash
git add public/index.html public/styles.css
git commit -m "feat: add 'Sounds like' checkbox to rhyme modal add section"
```

---

### Task 3: Wire checkbox to toggle placeholder and modify addManualRhyme()

**Files:**
- Modify: `public/js/rhyme.js:1134,1142-1161` (showRhymeFinder input clear, addManualRhyme function)

- [ ] **Step 1: Add checkbox toggle listener and placeholder swap**

In `showRhymeFinder()`, after line 1134 (`if (ui.elements.manualRhymeInput) ui.elements.manualRhymeInput.value = '';`), add:

```js
    // Reset sounds-like checkbox and attach toggle
    const soundsLikeCheckbox = document.getElementById('sounds-like-checkbox');
    if (soundsLikeCheckbox) {
        soundsLikeCheckbox.checked = false;
        soundsLikeCheckbox.onchange = () => {
            if (ui.elements.manualRhymeInput) {
                ui.elements.manualRhymeInput.placeholder = soundsLikeCheckbox.checked
                    ? 'Type a word this sounds like...'
                    : 'Add your own rhyme...';
            }
        };
    }
```

- [ ] **Step 2: Modify addManualRhyme() to handle alias mode**

Replace the existing `addManualRhyme()` function (lines 1142-1161) with:

```js
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
        const suggestedLower = suggestedWord.toLowerCase();
        if (!state.rhymeAliases[baseWordLower]) state.rhymeAliases[baseWordLower] = new Set();
        if (state.rhymeAliases[baseWordLower].has(suggestedLower)) {
            ui.showFeedback(`"${baseWord}" already sounds like "${suggestedWord}".`);
            return;
        }
        state.rhymeAliases[baseWordLower].add(suggestedLower);
        console.log(`Added alias: "${baseWord}" sounds like "${suggestedWord}"`);
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
        storage.saveSettings();
        state.currentRhymeList = getValidRhymesForWord(baseWord);
        displayRhymeList(baseWordLower);
        ui.showFeedback(`"${suggestedWord}" added to manual rhymes for "${baseWord}".`);
    }
    ui.elements.manualRhymeInput.value = '';
}
```

- [ ] **Step 3: Commit**

```bash
git add public/js/rhyme.js
git commit -m "feat: wire Sounds like checkbox to addManualRhyme with alias mode"
```

---

### Task 4: Add alias candidate merging to getValidRhymesForWord()

**Files:**
- Modify: `public/js/rhyme.js:158-205` (getValidRhymesForWord function)

- [ ] **Step 1: Add alias lookup and candidate merging**

Replace the existing `getValidRhymesForWord()` function (lines 158-205) with:

```js
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

    // Score candidates from inverted index
    if (wordPattern) {
        const patternString = wordPattern.join('-');
        const candidates = phonetics.getCandidatesForPattern(patternString);

        for (const word of candidates) {
            const wordLower = word.toLowerCase();
            if (wordLower === baseWordLower) continue;
            if (rejectedSet.has(wordLower)) continue;

            const score = phonetics.rhymeScore(baseWordLower, wordLower);
            if (score >= SCORE_THRESHOLD) {
                seen.set(wordLower, { word, score });
                rhymeScoreCache.set(`${baseWordLower}|${wordLower}`, score);
            }
        }
    }

    // Alias candidates: for each alias, pull its candidates and score against the alias word
    const aliasSet = state.rhymeAliases[baseWordLower];
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

    return scoredMatches.map(m => m.word);
}
```

- [ ] **Step 2: Commit**

```bash
git add public/js/rhyme.js
git commit -m "feat: merge alias candidates into getValidRhymesForWord with dedup"
```

---

### Task 5: Manual testing and verification

**Files:**
- No files modified — verification only

- [ ] **Step 1: Test alias creation flow**

1. Start dev server: `python3 server.py`
2. Open app, navigate to word "litres"
3. Open rhyme modal — should show 0 or very few results
4. Check the "Sounds like" checkbox
5. Verify placeholder changes to "Type a word this sounds like..."
6. Type "leaders" and press Enter (or click Add)
7. Verify feedback message: `"litres" now inherits rhymes from "leaders".`
8. Verify rhyme list now shows all of leaders' rhymes (readers, feeders, breeders, etc.)

- [ ] **Step 2: Test multiple aliases**

1. With "litres" still active, check "Sounds like" again
2. Type "liters" and submit
3. Verify results merge — may show some new words, deduped

- [ ] **Step 3: Test unchecked mode still works**

1. Uncheck "Sounds like"
2. Verify placeholder reverts to "Add your own rhyme..."
3. Type a word and submit — verify it adds as a manual rhyme (not an alias)

- [ ] **Step 4: Test persistence**

1. Reload the page
2. Open rhyme modal for "litres" again
3. Verify the alias results still appear (persisted via localStorage)

- [ ] **Step 5: Test export/import**

1. Export settings
2. Open the JSON file, verify `rhymeAliases` section exists with the alias data
3. Import the file — verify aliases survive round-trip
