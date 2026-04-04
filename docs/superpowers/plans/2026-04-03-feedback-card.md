# Feedback Card System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a feedback card dialog that pops up when rejecting rhymes, collecting optional structured reason codes and remarks alongside the existing phonetic rejection data.

**Architecture:** The feedback card is a dynamically-created DOM overlay managed entirely in `rhyme.js`, with phoneme alignment logic in `phonetics.js` and styling in `styles.css`. No new files, no new state properties, no HTML changes.

**Tech Stack:** Vanilla JS (ES6 modules), CSS3 with existing CRT theme variables.

**Spec:** `docs/superpowers/specs/2026-04-03-feedback-card-design.md`

---

### Task 1: Add `getAlignedComparison()` to phonetics.js

**Files:**
- Modify: `public/js/phonetics.js` (append after `getVowelContext` at line ~521)

- [ ] **Step 1: Add the `getAlignedComparison` export function**

This function extracts rhyming segments for both words, scores forward and reverse alignments, then returns aligned phoneme arrays with per-position similarity data. Append after the `getVowelContext` function (end of file):

```js
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
```

- [ ] **Step 2: Verify it works via browser console**

Open the app, open browser console, and test:
```
// After rhyme data loads:
import('/public/js/phonetics.js').then(m => console.log(m.getAlignedComparison('criminal', 'jimena')))
```

Expected: An object with `pairs` array showing aligned phoneme slots, `alignment` string, `matchPercent` number.

- [ ] **Step 3: Commit**

```bash
git add public/js/phonetics.js
git commit -m "feat: add getAlignedComparison() for feedback card phoneme display"
```

---

### Task 2: Add feedback card CSS styles

**Files:**
- Modify: `public/styles.css` (append new section after the existing rhyme tier tooltip styles around line ~3400)

- [ ] **Step 1: Add all feedback card styles**

Append this block to the end of the rhyme-related styles section in `public/styles.css`:

```css
/* ===== Feedback Card ===== */
.feedback-card-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1100;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: feedback-fade-in 0.15s ease-out;
}

@keyframes feedback-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
}

.feedback-card {
    width: 320px;
    background: var(--panel-bg-opaque);
    border: 1px solid var(--primary-accent);
    border-radius: 8px;
    padding: 16px;
    position: relative;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.6), var(--phosphor-glow);
    color: var(--text-color);
    font-family: var(--font-main);
    animation: feedback-fade-in 0.15s ease-out;
}

.feedback-card-close {
    position: absolute;
    top: 8px;
    right: 10px;
    background: none;
    border: none;
    color: var(--text-color);
    font-size: 1.4em;
    cursor: pointer;
    opacity: 0.6;
    transition: opacity 0.2s;
    line-height: 1;
}

.feedback-card-close:hover {
    opacity: 1;
    color: var(--red-color);
}

.feedback-card-header {
    text-align: center;
    margin-bottom: 12px;
    padding-bottom: 10px;
    border-bottom: 1px dashed var(--border-color);
}

.feedback-card-words {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    font-size: 1.3em;
    font-weight: bold;
    color: var(--text-bright);
}

.feedback-card-words .feedback-vs {
    font-size: 0.7em;
    opacity: 0.5;
    font-weight: normal;
}

.feedback-card-match {
    font-size: 0.85em;
    opacity: 0.7;
    margin-top: 4px;
}

/* Phoneme comparison rows */
.feedback-phoneme-section {
    margin-bottom: 12px;
    overflow-x: auto;
}

.feedback-phoneme-row {
    display: flex;
    gap: 3px;
    justify-content: center;
    margin: 3px 0;
    flex-wrap: nowrap;
}

.feedback-phoneme-row .word-label {
    font-size: 0.7em;
    opacity: 0.5;
    min-width: 50px;
    text-align: right;
    padding-right: 4px;
    align-self: center;
    flex-shrink: 0;
}

.feedback-vowel-block {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.3);
    color: var(--secondary-accent);
    border: 1px solid var(--secondary-accent);
    padding: 2px 5px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.8em;
    font-weight: bold;
    min-width: 28px;
    text-align: center;
    flex-shrink: 0;
}

.feedback-consonant-block {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    color: var(--text-color);
    border: 1px solid rgba(var(--text-color), 0.4);
    border: 1px solid var(--border-color);
    padding: 2px 5px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.8em;
    min-width: 28px;
    text-align: center;
    opacity: 0.7;
    flex-shrink: 0;
}

.feedback-empty-block {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    padding: 2px 5px;
    flex-shrink: 0;
}

.feedback-mismatch {
    border-color: var(--red-color) !important;
    box-shadow: 0 0 4px rgba(255, 51, 51, 0.3);
}

.feedback-match-good {
    border-color: var(--green-color) !important;
    opacity: 1 !important;
}

/* Reason chips */
.feedback-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
}

.feedback-chip {
    padding: 4px 10px;
    border: 1px solid var(--primary-accent);
    border-radius: 16px;
    background: transparent;
    color: var(--text-color);
    font-family: var(--font-main);
    font-size: 0.85em;
    cursor: pointer;
    transition: all 0.15s ease;
    user-select: none;
}

.feedback-chip:hover {
    background: rgba(51, 255, 51, 0.1);
}

.feedback-chip.active {
    background: var(--primary-accent);
    color: var(--bg-color);
    font-weight: bold;
}

/* Remark input */
.feedback-remark {
    width: 100%;
    padding: 6px 10px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-color);
    font-family: var(--font-main);
    font-size: 0.9em;
    outline: none;
    transition: border-color 0.2s;
}

.feedback-remark:focus {
    border-color: var(--primary-accent);
}

.feedback-remark::placeholder {
    color: var(--text-color);
    opacity: 0.4;
}

/* Skip badge */
.feedback-skip-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    padding: 2px 8px;
    font-size: 0.75em;
    color: var(--text-color);
    opacity: 0.6;
    font-family: var(--font-main);
}
```

- [ ] **Step 2: Verify styles load without errors**

Refresh the app in the browser and confirm no CSS parse errors in the console. The styles won't be visible yet since no card DOM exists.

- [ ] **Step 3: Commit**

```bash
git add public/styles.css
git commit -m "feat: add feedback card CSS styles matching CRT theme"
```

---

### Task 3: Add feedback card local state and `pendingFeedback` map to rhyme.js

**Files:**
- Modify: `public/js/rhyme.js:248-251` (after `tempRejected` declaration)

- [ ] **Step 1: Add feedback card state variables**

After the existing `let tempRejected = new Set();` line (line 251), add:

```js
// --- Feedback Card State (session-local, not persisted) ---
let pendingFeedback = new Map();   // rejectedWord -> { reasons: [], remark: '' }
let lastCardDismissTime = 0;
let lastCardHadFeedback = false;
let skipCounter = 0;
const RAPID_FIRE_MS = 2000;
```

- [ ] **Step 2: Reset feedback state on modal open**

In `openRhymeFinderModalWithSort()` (line 254), add resets after `tempRejected = new Set();`:

```js
export function openRhymeFinderModalWithSort() {
    tempRejected = new Set();
    pendingFeedback = new Map();
    lastCardDismissTime = 0;
    lastCardHadFeedback = false;
    skipCounter = 0;
    rhymeSortMode = 'similarity';
    updateRhymeSortButtonState();
    attachRhymeSortListeners();
    showRhymeFinder();
}
```

- [ ] **Step 3: Update `persistTempRejections()` to merge pending feedback**

Replace the existing `persistTempRejections()` function (lines 261-282) with:

```js
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
            reasons: fb?.reasons || [],
            remark: fb?.remark || '',
            skipped: !fb,
            timestamp: new Date().toISOString().split('T')[0]
        });
    }
    storage.saveSettings();
    pendingFeedback.clear();
    tempRejected.clear();
}
```

- [ ] **Step 4: Commit**

```bash
git add public/js/rhyme.js
git commit -m "feat: add feedback card state vars and merge feedback into rejectionLog"
```

---

### Task 4: Build `showFeedbackCard()` and `closeFeedbackCard()` in rhyme.js

**Files:**
- Modify: `public/js/rhyme.js` (add new functions after the `persistTempRejections` function)

- [ ] **Step 1: Add the reason chip definitions**

Add after `persistTempRejections()`:

```js
// --- Feedback Card Reason Chips ---
const FEEDBACK_REASONS = [
    { code: 'stressed_vowel', label: 'Stressed sounds don\'t match' },
    { code: 'ending_different', label: 'Endings sound different' },
    { code: 'syllable_mismatch', label: 'Wrong syllable count' },
    { code: 'beginning_different', label: 'Beginning throws it off' },
    { code: 'not_a_word', label: 'Not a real word' },
    { code: 'sounds_wrong', label: 'Just sounds wrong' },
];
```

- [ ] **Step 2: Add the `showFeedbackCard` function**

```js
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
    closeBtn.onclick = () => closeFeedbackCard(true);
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
    if (comparison) {
        card.appendChild(renderPhonemeComparison(comparison, baseWord, rejectedWord));
    }

    // Reason chips
    const chipsContainer = document.createElement('div');
    chipsContainer.className = 'feedback-chips';
    const selectedReasons = new Set();

    for (const reason of FEEDBACK_REASONS) {
        const chip = document.createElement('button');
        chip.className = 'feedback-chip';
        chip.textContent = reason.label;
        chip.type = 'button';
        chip.addEventListener('click', () => {
            if (selectedReasons.has(reason.code)) {
                selectedReasons.delete(reason.code);
                chip.classList.remove('active');
            } else {
                selectedReasons.add(reason.code);
                chip.classList.add('active');
            }
        });
        chipsContainer.appendChild(chip);
    }
    card.appendChild(chipsContainer);

    // Remark input
    const remark = document.createElement('input');
    remark.type = 'text';
    remark.className = 'feedback-remark';
    remark.placeholder = 'Quick note (optional)...';
    card.appendChild(remark);

    // Escape key handler
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeFeedbackCard(true);
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);

    // Store references for closeFeedbackCard
    backdrop._feedbackState = {
        rejectedWordLower,
        selectedReasons,
        remarkInput: remark,
        escHandler,
    };

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);
}
```

- [ ] **Step 3: Add the `closeFeedbackCard` function**

```js
function closeFeedbackCard(saveFeedback) {
    const backdrop = document.querySelector('.feedback-card-backdrop');
    if (!backdrop) return;

    if (saveFeedback && backdrop._feedbackState) {
        const { rejectedWordLower, selectedReasons, remarkInput, escHandler } = backdrop._feedbackState;
        const reasons = Array.from(selectedReasons);
        const remarkText = remarkInput.value.trim();
        const hadFeedback = reasons.length > 0 || remarkText.length > 0;

        if (hadFeedback || pendingFeedback.has(rejectedWordLower)) {
            pendingFeedback.set(rejectedWordLower, {
                reasons,
                remark: remarkText,
            });
        }

        lastCardHadFeedback = hadFeedback;
        lastCardDismissTime = Date.now();

        if (!hadFeedback) {
            skipCounter++;
            updateSkipBadge();
        }

        document.removeEventListener('keydown', escHandler);
    }

    backdrop.remove();
}
```

- [ ] **Step 4: Commit**

```bash
git add public/js/rhyme.js
git commit -m "feat: add showFeedbackCard() and closeFeedbackCard() with chip/remark UI"
```

---

### Task 5: Build `renderPhonemeComparison()` in rhyme.js

**Files:**
- Modify: `public/js/rhyme.js` (add between `closeFeedbackCard` and the reason chip definitions, or right after `closeFeedbackCard`)

- [ ] **Step 1: Add the phoneme comparison renderer**

```js
function renderPhonemeComparison(comparison, baseWord, rejectedWord) {
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

    for (const pair of comparison.pairs) {
        // Word 1 block
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

        // Word 2 block
        if (pair.p2) {
            const block2 = document.createElement('span');
            block2.className = pair.p2.isVowel ? 'feedback-vowel-block' : 'feedback-consonant-block';
            block2.textContent = pair.p2.clean;
            if (pair.mismatch) block2.classList.add('feedback-mismatch');
            else if (pair.match) block2.classList.add('feedback-match-good');
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
```

- [ ] **Step 2: Commit**

```bash
git add public/js/rhyme.js
git commit -m "feat: add renderPhonemeComparison() with aligned vowel/consonant blocks"
```

---

### Task 6: Wire X click handler to feedback card with rapid-fire bypass

**Files:**
- Modify: `public/js/rhyme.js:376-389` (the X click handler in `createRhymeListItem`)

- [ ] **Step 1: Replace the X click handler**

In `createRhymeListItem()`, replace the existing `else` block (the X icon handler, lines 376-389) with:

```js
    } else {
        // Add the [X] icon
        const x = document.createElement('span');
        x.className = 'rhyme-x';
        x.textContent = '\u00d7';
        x.title = 'Reject this rhyme';
        x.onclick = (e) => {
            e.stopPropagation();
            tempRejected.add(wordLower);

            // Rapid-fire bypass: if last card was dismissed empty within 2s, skip card
            const now = Date.now();
            const rapidFire = !lastCardHadFeedback && (now - lastCardDismissTime) < RAPID_FIRE_MS && lastCardDismissTime > 0;

            if (rapidFire) {
                skipCounter++;
                updateSkipBadge();
            } else {
                showFeedbackCard(state.currentWord, rhymeWord);
            }

            // Re-render
            const baseWordLower = state.currentWord?.toLowerCase();
            displayRhymeList(baseWordLower);
        };
        li.appendChild(x);
    }
```

- [ ] **Step 2: Commit**

```bash
git add public/js/rhyme.js
git commit -m "feat: wire X click to feedback card with rapid-fire bypass"
```

---

### Task 7: Add skip badge rendering

**Files:**
- Modify: `public/js/rhyme.js` (add `updateSkipBadge` function near the other feedback card functions)

- [ ] **Step 1: Add the `updateSkipBadge` function**

Add near the other feedback card functions:

```js
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
```

- [ ] **Step 2: Commit**

```bash
git add public/js/rhyme.js
git commit -m "feat: add skip badge counter to rhyme modal"
```

---

### Task 8: Manual testing and verification

**Files:**
- No files modified — verification only

- [ ] **Step 1: Test basic feedback card flow**

1. Start dev server: `python3 server.py`
2. Open app in browser, navigate to a word
3. Open rhyme modal (click "Find Rhymes")
4. Click X on a rhyme word
5. Verify: feedback card dialog appears with the two words, phoneme comparison, reason chips, and remark field
6. Tap a reason chip — verify it toggles active styling
7. Type a remark
8. Click X on the card — verify it closes and the word is strikethrough in the list

- [ ] **Step 2: Test dismissal methods**

1. Click X on another word — card appears
2. Click outside the card (on backdrop) — verify card closes
3. Click X on another word — card appears
4. Press Escape — verify card closes

- [ ] **Step 3: Test rapid-fire bypass**

1. Click X on a word — card appears
2. Close it immediately without filling anything
3. Within 2 seconds, click X on another word
4. Verify: no card appears, word is silently rejected, skip badge shows "1 skipped"
5. Wait 3 seconds, click X on another word
6. Verify: card appears again (timer expired)

- [ ] **Step 4: Test feedback persistence**

1. Reject a word with reason chips selected and a remark typed
2. Close the rhyme modal
3. Open browser console: check `JSON.parse(localStorage.getItem('freestyleArenaSettings_v6')).rejectionLog`
4. Verify the latest entry has `reasons` array and `remark` string populated
5. Verify a skipped entry has `reasons: [], remark: "", skipped: true`

- [ ] **Step 5: Test export/import includes feedback data**

1. Go to Settings, click "Export All Settings"
2. Open the exported JSON file
3. Verify `rejectionLog` entries contain the `reasons`, `remark`, `skipped` fields
4. Import the file back — verify data survives the round-trip

- [ ] **Step 6: Commit any fixes from testing**

```bash
git add -A
git commit -m "fix: feedback card testing fixes"
```

(Only run this step if fixes were needed during testing.)
