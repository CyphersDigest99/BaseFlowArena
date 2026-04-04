# Feedback Card System — Design Spec

## Purpose

Replace the silent X-to-reject flow in the rhyme modal with a feedback card dialog that encourages (but never requires) the user to explain why a rhyme match is bad. Collects structured reason codes and free-text remarks alongside the phonetic context already captured, enabling future batch analysis to tune the scorer.

## Trigger & Lifecycle

### Opening the card

1. User clicks the X icon on a rhyme list item in the rhyme modal.
2. The word is immediately added to `tempRejected` (strikethrough applied as today).
3. A feedback card dialog opens as an overlay on top of the rhyme modal.

### Rapid-fire bypass

- Track `lastCardDismissTime` and `lastCardHadFeedback` (local to rhyme.js, not persisted).
- If the previous card was dismissed **without any input** (no chips, no remark) AND the current X click is within **2 seconds** of that dismissal, skip the card entirely — silent rejection only.
- If the user provides any feedback (even one chip tap), reset the bypass window — next rejection always shows the card.
- A **skip counter** (session-local, resets on modal close) tracks how many rejections happened without feedback.

### Dismissal

All three methods are equivalent — the rejection stands, whatever feedback exists is saved:

- Click the X button on the card
- Click outside the card (on the semi-transparent backdrop)
- Press Escape

### Badge

When skip counter > 0, a small non-intrusive badge appears in the rhyme modal corner: e.g., "3 skipped". Informational only — no action wired to it in this build (batch review is future scope).

### Data flow

1. X click on rhyme item → word added to `tempRejected` → feedback card opens (or bypassed)
2. User optionally taps chips / types remark → state held locally in card
3. Card closes → feedback written to a pending map keyed by rejected word
4. Modal close → `persistTempRejections()` runs as today, but merges pending feedback into each `rejectionLog` entry

## Card Layout

320px wide, dynamic height. Centered over the rhyme modal with a semi-transparent backdrop.

### Structure (top to bottom)

**1. Header row**

Two words displayed prominently — base word (left) and rejected word (right), separated by "vs". Match percentage shown small beneath (e.g., "52% match"). Dismiss X in the top-right corner of the card.

**2. Phoneme comparison**

Both words' rhyming segments (from last stressed vowel onward) displayed as colored blocks, stacked vertically (base word on top, rejected word below):

- **Vowels:** Styled like the existing `vowel-pattern-block` badges (amber/gold filled blocks in CRT theme)
- **Consonants:** Same block shape but visually distinct — border-only / muted variant (dimmer, not filled)
- **Mismatches:** Where phonemes at the same position diverge, blocks get a red/warning tint or border highlight
- **Pre-segment context:** Phonemes before the rhyming segment shown smaller/faded — visible but not the focus

The alignment reflects whichever direction the scorer used (forward from stressed vowel, or reverse from word end). `getAlignedComparison()` returns the winning alignment so the display anchors correctly:

- **If reverse alignment won** (endings matched better): right-align the two rows so endings line up. Extra phonemes on the longer segment hang off the left with empty partner slots.
- **If forward alignment won** (stressed vowels matched better): left-align from the stressed vowel. Extra phonemes hang off the right.

This means even a 10-syllable word vs a 3-syllable word will show exactly which sounds corresponded — the matched pairs are visually adjacent, and unmatched phonemes are clearly orphaned.

**3. Reason chips**

Six tappable pill buttons in a flex-wrap layout. Multi-select (toggle on/off). Zero or more can be active.

| Display text | Internal code |
|---|---|
| "Stressed sounds don't match" | `stressed_vowel` |
| "Endings sound different" | `ending_different` |
| "Wrong syllable count" | `syllable_mismatch` |
| "Beginning throws it off" | `beginning_different` |
| "Not a real word" | `not_a_word` |
| "Just sounds wrong" | `sounds_wrong` |

**4. Remark field**

Single-line text input. Placeholder: "Quick note (optional)...". No label, no submit button. Contents saved on card close.

## Data Model

Extends existing `state.rejectionLog` entries. No schema migration needed — new fields are simply present on new entries and absent on old ones.

```js
{
  base: "optic",
  rejected: "jimena",
  base_context: ["AA+stop", "IH+stop"],
  rejected_context: ["IH+nasal", "EY+nasal", "AH+null"],
  reasons: ["not_a_word"],          // array of chip codes, can be []
  remark: "this is a name",         // string, can be ""
  skipped: false,                   // true if rapid-fire bypassed
  timestamp: "2026-04-03"
}
```

Entries created via rapid-fire bypass get `reasons: [], remark: "", skipped: true`.

Skip counter is session-local (not persisted). Resets when modal closes.

## Integration Points

### Modified files

**`public/js/rhyme.js`**
- `createRhymeListItem()` — X click handler opens feedback card (or bypasses per rapid-fire logic) instead of only toggling `tempRejected`
- New functions:
  - `showFeedbackCard(baseWord, rejectedWord)` — creates and displays the card dialog
  - `closeFeedbackCard()` — saves feedback, removes card, updates bypass timestamp
  - `renderPhonemeComparison(baseWord, rejectedWord)` — builds the phoneme block HTML using data from phonetics.js
- New local state: `lastCardDismissTime`, `lastCardHadFeedback`, `skipCounter`, `pendingFeedback` (Map of rejectedWord -> {reasons, remark})
- `persistTempRejections()` — merge `pendingFeedback` into each `rejectionLog` entry before saving
- Badge rendering: small counter element updated after each skip

**`public/styles.css`**
- `.feedback-card-backdrop` — fixed overlay, semi-transparent black, click-to-dismiss
- `.feedback-card` — 320px dialog, CRT-themed (panel-bg, border-color, phosphor glow)
- `.feedback-card-header` — word pair display and match percentage
- `.feedback-phoneme-row` — horizontal block layout for phoneme comparison
- `.feedback-vowel-block` — reuses vowel-pattern-block styling
- `.feedback-consonant-block` — border-only / muted variant of vowel block
- `.feedback-mismatch` — red/warning border highlight for divergent positions
- `.feedback-chip` — pill button with toggle active state
- `.feedback-remark` — single-line input styled to match CRT theme
- `.feedback-skip-badge` — small counter badge

**`public/js/phonetics.js`**
- New export: `getAlignedComparison(word1, word2)` — extracts both rhyming segments, scores forward and reverse alignments, then returns: the two phoneme arrays padded/aligned according to the winning direction, per-position match/mismatch flags with similarity scores, the alignment direction used (`"forward"` or `"reverse"`), and the overall match percentage. This keeps all phonetic logic in phonetics.js so rhyme.js only renders the result.

### Files NOT modified

- `state.js` — no new state properties (skip counter and pending feedback are local to rhyme.js; rejectionLog schema is unchanged)
- `storage.js` — no changes needed. `rejectionLog` is already included in `saveSettings()`, `exportSettings()`, and `importSettings()`. The new fields (`reasons`, `remark`, `skipped`) serialize automatically as plain object properties. Imported settings from before this feature will just have entries without those keys, which is handled gracefully (missing keys = no feedback data for that entry).
- `index.html` — card is created dynamically in JS, no static markup needed

### No new files

Everything fits into existing modules.

## Visual Design Notes

- Card inherits CRT theme variables (`--panel-bg`, `--border-color`, `--primary-accent`, `--text-color`, `--phosphor-glow`)
- Vowel blocks match the existing `vowel-pattern-block` style exactly
- Consonant blocks use the same dimensions but `background: transparent` with a `border: 1px solid` in a muted version of the accent color
- Reason chips use `--primary-accent` border when inactive, filled `--primary-accent` background when active (toggled)
- The backdrop is `rgba(0, 0, 0, 0.5)` — enough to dim the modal behind without being heavy
- Card entrance: simple fade-in (opacity 0→1, ~150ms). No slide or bounce.

## Out of Scope

- Batch review UI for skipped rejections (badge is informational only)
- Auto-tuning the scorer based on rejection patterns (data collection only)
- Partial vowel pattern matching for rare patterns
- Result count capping
- CMU name filtering
