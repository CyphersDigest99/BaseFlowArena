# Recent Words Tray — Design Spec

**Date:** 2026-04-04
**Branch:** main
**Status:** Approved

## Problem

The Live Feed transcript scrolls too fast during active STT sessions. New words from speech recognition push existing words upward continuously, making it difficult to click a word to set it as the active word.

The click-to-set-active mechanic already works — the problem is purely stability.

## Solution

Add a pill tray to the bottom of the Live Feed panel. It collects recent unique content words in a stable row that never scrolls. The tray is the interaction target; the live feed keeps flowing uninterrupted above it.

## Layout

The tray attaches to the bottom of the existing `.transcript-area` panel — same border box, separated from the transcript by a faint horizontal divider line. No new panel header. One unified visual block.

```
┌─────────────────────────────────┐
│ ⚡ LIVE FEED                     │
│                                  │
│  back in the days when the sun  │
│  all i ever wanted was a sign   │
│  riding waves until the end...  │
│  chasing dreams...              │
├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤
│ [away] [dreams] [chasing] [time]│
│ [waves] [riding] [sign] [days]  │
└─────────────────────────────────┘
```

## Behavior

### Word collection
- Triggered on every final STT result (same `isFinal` path in `updateTranscript`)
- Words extracted from the final line text, split on whitespace
- Each word cleaned (lowercase, strip non-alpha)
- Filtered: skip words ≤2 characters; skip stopwords (see list below)
- For each passing word: if **not already in `state.recentWords`**, unshift to front of array
- If word already exists in array: **skip** — do not reposition (stability)
- Array capped at 20 entries; oldest entry trimmed when over

### Tray rendering
- `ui.updateRecentWordsTray()` rebuilds the pill DOM from `state.recentWords` after each final result
- Pills rendered newest-first (left to right)
- Tray hidden (`display:none`) until at least one word is present
- When a pill is clicked: visual selected state applied to that pill; `wordManager.setActiveWord(word)` called

### Reset
- `state.recentWords` cleared when STT stops
- Tray re-renders to empty/hidden state

## Stopword Filter

Filtered out in addition to words ≤2 chars:

```
a, an, the, i, me, my, you, your, we, our, it, its, is, are, was, were,
be, been, being, have, has, had, do, does, did, will, would, could,
should, may, might, can, to, of, in, on, at, by, for, up, out, so,
and, but, or, not, no, if, as, with, from, that, this, than, then,
when, who, what, how, all, just, like
```

## State Changes

`state.js` — one new field:
```js
recentWords: []   // string[], newest first, max 20, session-only, not persisted
```

## Files Changed

| File | Change |
|------|--------|
| `state.js` | Add `recentWords: []` |
| `index.html` | Add `<div id="recent-words-tray"></div>` inside `.transcript-area` after `#new-transcript` |
| `styles.css` | Pill styles, divider, selected state, empty/hidden state |
| `ui.js` | Add `updateRecentWordsTray()`, call at end of `updateTranscript()` on `isFinal` path; add word extraction + filtering logic |
| `main.js` | Add delegated click handler on `#recent-words-tray` → `wordManager.setActiveWord(word)` |

## Out of Scope

- Persisting recent words across sessions
- Sorting or reordering pills after initial placement
- Any changes to the live feed scroll behavior
