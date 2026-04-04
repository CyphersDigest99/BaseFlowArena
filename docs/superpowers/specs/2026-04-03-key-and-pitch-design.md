---
title: Key Finder — Design Spec
date: 2026-04-03
branch: key-and-pitch
status: approved
---

# Key Finder

## Problem

When rapping over an instrumental, the beat has a tonal center (a key). Singing or rapping notes outside that key sounds bad. The user wants a quick way to hum into the mic before rapping, identify what key they're in, and see which notes are safe to hit — all without any music theory knowledge required.

## Use Case

1. New beat comes on.
2. User opens the Key Finder and hums or sings along to the root tone they hear in the beat.
3. The mic detects their pitch in real time and identifies the note.
4. A piano keyboard lights up: the detected root note highlighted in bright green, the rest of the natural minor scale in a dimmer green.
5. User reads the keyboard, internalizes the safe notes, closes the tool, and starts rapping.

This is a **pre-rap ritual tool**, not something used while rapping. It does not need to run concurrently with voice match mode.

## Where It Lives

Right panel (Rhythm Engine), between the BPM panel and the BPM Multiplier panel. A single `♪ FIND KEY` button opens the modal. The button follows the same `icon-button` styling as existing BPM controls.

## Architecture

### New file: `public/js/keyFinder.js`

Self-contained module. No dependencies on other app modules except wiring through `main.js`. Exports:
- `init()` — called once from `main.js` to wire the button and modal close handler
- `open()` — starts mic, begins pitch detection loop, shows modal
- `close()` — stops mic, cancels animation frame, hides modal

### Pitch Detection

Web Audio API, no external libraries:

```
getUserMedia({ audio: true })
  → AudioContext
  → AnalyserNode (fftSize: 2048)
  → getFloatTimeDomainData()
  → autocorrelation → fundamental frequency (Hz)
  → frequency-to-MIDI → note name (C, C#, D, … B)
```

Runs on `requestAnimationFrame` at ~15fps. Computation per frame is trivial (~0.1ms). Mic is acquired when the modal opens and released (`stream.getTracks().forEach(t => t.stop())`) when it closes.

Minimum confidence threshold: if the signal is too quiet or ambiguous, display `—` rather than a junk note.

### Harmonic Map

Static JS object in `keyFinder.js`. For each of the 12 chromatic roots, stores the 7 notes of the natural minor scale. No network requests, no external data.

```js
const MINOR_SCALES = {
  'C':  ['C','D','Eb','F','G','Ab','Bb'],
  'C#': ['C#','D#','E','F#','G#','A','B'],
  // ... all 12
};
```

The displayed "safe notes" on the keyboard are simply all 7 notes of the detected root's natural minor scale. The root note gets the bright highlight; the other 6 get the dim highlight.

### Display

Modal (pattern matching existing modals in `index.html`):

- **Header**: pulsing mic dot + "KEY FINDER — LISTENING"
- **Detected note**: large text showing current note name (updates live)
- **Scale label**: e.g. "A Natural Minor"
- **Piano**: 2 octaves of white keys only. White keys cover all natural minor scale notes for most roots. Keys highlighted in two shades of green (root vs. scale). Non-scale keys remain unlit (dark).
- **Hint line**: "Hum into your mic · keyboard updates in real time"

Styling in `styles.css` following the existing CRT phosphor theme (green on black, monospace font).

### State

Stateless. Nothing is persisted to localStorage. The modal is ephemeral.

### Mic Conflict

Key Finder and voice match mode are never active simultaneously (this is a pre-rap tool). No coordination needed. Both use `getUserMedia` independently and release the stream when done.

## What Is Explicitly Out of Scope

- Beat key detection (analyzing audio files)
- Major scale mode
- Pentatonic sub-layer distinction (may add later if two shades feel insufficient)
- Persistence of last-detected key
- Mobile layout optimization
- Black keys on the piano

## Files Changed

| File | Change |
|------|--------|
| `public/js/keyFinder.js` | New module |
| `public/js/main.js` | Import and call `keyFinder.init()` |
| `index.html` | Add FIND KEY button in right panel; add Key Finder modal markup |
| `styles.css` | Key Finder modal and piano keyboard styles |
