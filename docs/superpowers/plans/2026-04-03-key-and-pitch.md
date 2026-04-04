# Key Finder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mic-based pitch detector to the Rhythm Engine panel that identifies the note being hummed and lights up a piano keyboard showing which notes are safe to sing in that key.

**Architecture:** A single new module `public/js/keyFinder.js` handles all pitch detection, harmonic lookup, and DOM updates. It is wired into the app via one `init()` call in `main.js`. The modal reuses the existing `.modal` / `.modal-content` CSS pattern. No libraries, no state persistence.

**Tech Stack:** Vanilla JS ES6 modules, Web Audio API (`getUserMedia`, `AudioContext`, `AnalyserNode`), HTML/CSS (CRT phosphor theme, CSS variables)

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `public/js/keyFinder.js` | Create | All pitch detection, harmonic map, DOM wiring |
| `index.html` | Modify | FIND KEY button in right panel; Key Finder modal |
| `styles.css` | Modify | Modal + piano keyboard styles |
| `public/js/main.js` | Modify | Import keyFinder; call `keyFinder.init()` |

---

## Task 1: Core utility functions in `keyFinder.js`

**Files:**
- Create: `public/js/keyFinder.js`

- [ ] **Step 1: Create the file with chromatic definitions and scale lookup**

```js
// public/js/keyFinder.js

const CHROMATIC = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
// Natural minor scale: semitone intervals from root
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10];

/**
 * Returns the 7 notes of the natural minor scale for a given root note name.
 * e.g. getMinorScale('A') → ['A','B','C','D','E','F','G']
 */
export function getMinorScale(rootName) {
  const rootIdx = CHROMATIC.indexOf(rootName);
  if (rootIdx === -1) return [];
  return MINOR_INTERVALS.map(i => CHROMATIC[(rootIdx + i) % 12]);
}

/**
 * Converts a frequency in Hz to a MIDI note number.
 * Returns null if outside vocal range (80–1100 Hz).
 */
export function freqToMidi(freq) {
  if (freq < 80 || freq > 1100) return null;
  return Math.round(12 * Math.log2(freq / 440) + 69);
}

/**
 * Returns the note name (e.g. 'A', 'C#') for a MIDI note number.
 */
export function midiToName(midi) {
  return CHROMATIC[midi % 12];
}

/**
 * Autocorrelation-based fundamental frequency detector.
 * buf: Float32Array from AnalyserNode.getFloatTimeDomainData()
 * sampleRate: AudioContext.sampleRate
 * Returns Hz, or -1 if signal is too quiet / no clear pitch found.
 */
export function autoCorrelate(buf, sampleRate) {
  const SIZE = buf.length;

  // RMS check — return -1 if too quiet
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.015) return -1;

  // Trim leading/trailing silence
  let r1 = 0, r2 = SIZE - 1;
  const thresh = 0.2;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buf[i]) >= thresh) { r1 = i; break; }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buf[SIZE - i]) >= thresh) { r2 = SIZE - i; break; }
  }
  const trimmed = buf.slice(r1, r2);
  const N = trimmed.length;

  // Compute autocorrelation
  const c = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N - i; j++) {
      c[i] += trimmed[j] * trimmed[j + i];
    }
  }

  // Find first dip, then first peak after the dip
  let d = 0;
  while (d < N - 1 && c[d] > c[d + 1]) d++;
  let maxval = -1, maxpos = -1;
  for (let i = d; i < N; i++) {
    if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
  }
  if (maxpos < 1 || maxpos >= N - 1) return -1;

  // Parabolic interpolation for sub-sample accuracy
  const x1 = c[maxpos - 1], x2 = c[maxpos], x3 = c[maxpos + 1];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  const T0 = a ? maxpos - b / (2 * a) : maxpos;

  return sampleRate / T0;
}
```

- [ ] **Step 2: Verify pure functions in browser console**

Start the dev server (`python3 server.py` in Git Bash from project root), open `http://localhost:8000` in Chrome, open DevTools Console, and paste:

```js
import('/public/js/keyFinder.js').then(m => {
  console.assert(JSON.stringify(m.getMinorScale('A')) === JSON.stringify(['A','B','C','D','E','F','G']), 'A minor failed');
  console.assert(JSON.stringify(m.getMinorScale('C')) === JSON.stringify(['C','D','D#','F','G','G#','A#']), 'C minor failed');
  console.assert(m.freqToMidi(440) === 69, 'A4 midi failed');
  console.assert(m.freqToMidi(50) === null, 'out-of-range failed');
  console.assert(m.midiToName(69) === 'A', 'midiToName failed');
  console.assert(m.midiToName(60) === 'C', 'midiToName C failed');
  console.log('All pure function checks passed');
});
```

Expected: `All pure function checks passed` with no assertion errors.

- [ ] **Step 3: Commit**

```bash
git add public/js/keyFinder.js
git commit -m "feat: keyFinder pure functions — harmonic map, pitch detection, note naming"
```

---

## Task 2: HTML — FIND KEY button and modal

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add the FIND KEY button between `#bpm-panel` and `.bpm-multiplier-controls`**

Find the comment `<!-- End of #bpm-panel -->` (around line 418) and insert after it:

```html
            </div> <!-- End of #bpm-panel -->

            <!-- --- KEY FINDER --- -->
            <div id="key-finder-panel" class="panel">
                <h3><i class="fas fa-music"></i> Key Finder</h3>
                <div class="bpm-main-controls">
                    <button id="open-key-finder-button" class="icon-button large-button" title="Find the key you're humming">
                        <i class="fas fa-microphone"></i> FIND KEY
                    </button>
                </div>
            </div>
            <!-- END: Key Finder -->

            <!-- --- BPM MULTIPLIER CONTROLS --- -->
```

- [ ] **Step 2: Add the Key Finder modal**

Find the line `<!-- Word List Editor Modal -->` (near the other modals) and insert before it:

```html
    <!-- Key Finder Modal -->
    <div id="key-finder-modal" class="modal">
        <div class="modal-content">
            <span class="close-button" id="close-key-finder-modal">×</span>
            <h2><i class="fas fa-music"></i> Key Finder</h2>

            <div class="kf-header">
                <div class="kf-mic-dot" id="kf-mic-dot"></div>
                <span class="kf-listening-label">LISTENING</span>
            </div>

            <div class="kf-detected-row">
                <div class="kf-big-note" id="kf-detected-note">—</div>
                <div class="kf-note-meta">
                    <div class="kf-scale-label">DETECTED KEY</div>
                    <div class="kf-scale-name" id="kf-scale-name">—</div>
                </div>
            </div>

            <div class="kf-piano" id="kf-piano">
                <!-- Octave 3 -->
                <div class="kf-key" data-note="C"><span>C</span></div>
                <div class="kf-key" data-note="D"><span>D</span></div>
                <div class="kf-key" data-note="E"><span>E</span></div>
                <div class="kf-key" data-note="F"><span>F</span></div>
                <div class="kf-key" data-note="G"><span>G</span></div>
                <div class="kf-key" data-note="A"><span>A</span></div>
                <div class="kf-key" data-note="B"><span>B</span></div>
                <div class="kf-octave-gap"></div>
                <!-- Octave 4 -->
                <div class="kf-key" data-note="C"><span>C</span></div>
                <div class="kf-key" data-note="D"><span>D</span></div>
                <div class="kf-key" data-note="E"><span>E</span></div>
                <div class="kf-key" data-note="F"><span>F</span></div>
                <div class="kf-key" data-note="G"><span>G</span></div>
                <div class="kf-key" data-note="A"><span>A</span></div>
                <div class="kf-key" data-note="B"><span>B</span></div>
            </div>

            <p class="kf-hint">Hum into your mic · keyboard updates in real time</p>
        </div>
    </div>

```

- [ ] **Step 3: Verify markup renders**

Open `http://localhost:8000`. The right panel should show a "Key Finder" section with a FIND KEY button between BPM and Multiplier. Clicking it should show an unstyled modal shell (ugly but present — styling comes in Task 3).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: key finder button and modal markup"
```

---

## Task 3: CSS — modal and piano keyboard styles

**Files:**
- Modify: `styles.css`

- [ ] **Step 1: Append Key Finder styles at the end of `styles.css`**

```css
/* ============================================================
   KEY FINDER
   ============================================================ */

/* Panel button inherits .large-button — no extra styles needed */

/* Modal header */
.kf-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 18px;
}

.kf-mic-dot {
    width: 10px;
    height: 10px;
    background: var(--primary-accent);
    border-radius: 50%;
    box-shadow: 0 0 6px var(--primary-accent);
    animation: kf-pulse 1.1s ease-in-out infinite;
}

@keyframes kf-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.2; }
}

.kf-listening-label {
    font-size: 11px;
    letter-spacing: 3px;
    color: var(--secondary-text, #6b9e6b);
    font-family: 'Courier New', monospace;
}

/* Detected note display */
.kf-detected-row {
    display: flex;
    align-items: center;
    gap: 24px;
    margin-bottom: 20px;
}

.kf-big-note {
    font-size: 72px;
    font-weight: bold;
    color: var(--primary-accent);
    text-shadow: 0 0 20px var(--primary-accent);
    line-height: 1;
    min-width: 80px;
    text-align: center;
    font-family: 'Orbitron', monospace;
}

.kf-note-meta {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.kf-scale-label {
    font-size: 10px;
    letter-spacing: 2px;
    color: var(--secondary-text, #5a8a5a);
    font-family: 'Courier New', monospace;
}

.kf-scale-name {
    font-size: 16px;
    color: var(--primary-accent);
    font-family: 'Courier New', monospace;
}

/* Piano keyboard */
.kf-piano {
    display: flex;
    gap: 3px;
    overflow-x: auto;
    padding: 4px 0 8px;
    margin-bottom: 12px;
}

.kf-key {
    width: 36px;
    height: 100px;
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 0 0 4px 4px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 6px;
    font-size: 10px;
    font-family: 'Courier New', monospace;
    color: #444;
    flex-shrink: 0;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

/* Root note — bright accent */
.kf-key--root {
    background: var(--primary-accent);
    border-color: var(--primary-accent);
    color: #000;
    box-shadow: 0 0 12px var(--primary-accent);
}

/* Scale notes — dim accent */
.kf-key--scale {
    background: color-mix(in srgb, var(--primary-accent) 25%, #111);
    border-color: color-mix(in srgb, var(--primary-accent) 40%, #333);
    color: var(--primary-accent);
}

.kf-octave-gap {
    width: 10px;
    flex-shrink: 0;
}

/* Hint */
.kf-hint {
    font-size: 11px;
    color: var(--secondary-text, #3a6a3a);
    text-align: center;
    letter-spacing: 1px;
    font-family: 'Courier New', monospace;
}
```

- [ ] **Step 2: Verify styles in browser**

Open `http://localhost:8000`, click FIND KEY. The modal should show:
- Pulsing mic dot
- Large `—` note display
- Dark piano keys (no highlights yet — that comes in Task 4)
- Correct CRT color theme

- [ ] **Step 3: Commit**

```bash
git add styles.css
git commit -m "feat: key finder modal and piano keyboard CSS"
```

---

## Task 4: `keyFinder.js` — DOM wiring, mic, pitch loop, and piano update

**Files:**
- Modify: `public/js/keyFinder.js`

- [ ] **Step 1: Add `updatePiano()` function**

Append to `keyFinder.js`:

```js
/**
 * Updates the piano keyboard highlights.
 * rootName: note name string e.g. 'A', or null to clear all highlights.
 */
function updatePiano(rootName) {
  const keys = document.querySelectorAll('.kf-key');
  const scaleNotes = rootName ? getMinorScale(rootName) : [];

  keys.forEach(key => {
    const note = key.dataset.note;
    key.classList.remove('kf-key--root', 'kf-key--scale');
    if (!rootName) return;
    if (note === rootName) {
      key.classList.add('kf-key--root');
    } else if (scaleNotes.includes(note)) {
      key.classList.add('kf-key--scale');
    }
  });
}
```

- [ ] **Step 2: Add `updateDisplay()` function**

```js
/**
 * Updates the note label, scale name, and piano highlights.
 * noteName: e.g. 'A', or null to show idle state.
 */
function updateDisplay(noteName) {
  const noteEl = document.getElementById('kf-detected-note');
  const scaleEl = document.getElementById('kf-scale-name');

  if (!noteName) {
    noteEl.textContent = '—';
    scaleEl.textContent = '—';
    updatePiano(null);
    return;
  }

  noteEl.textContent = noteName;
  scaleEl.textContent = `${noteName} Natural Minor`;
  updatePiano(noteName);
}
```

- [ ] **Step 3: Add mic + pitch detection loop**

```js
// Module-level references so open/close can share them
let _audioCtx = null;
let _analyser = null;
let _stream = null;
let _rafId = null;
let _buf = null;
// Debounce: only switch displayed note when same note held for N frames
let _lastNote = null;
let _noteCount = 0;
const NOTE_HOLD_FRAMES = 4;

function startPitchLoop() {
  if (!_analyser || !_audioCtx) return;

  function tick() {
    _analyser.getFloatTimeDomainData(_buf);
    const freq = autoCorrelate(_buf, _audioCtx.sampleRate);

    if (freq > 0) {
      const midi = freqToMidi(freq);
      if (midi !== null) {
        const name = midiToName(midi);
        if (name === _lastNote) {
          _noteCount++;
          if (_noteCount >= NOTE_HOLD_FRAMES) updateDisplay(name);
        } else {
          _lastNote = name;
          _noteCount = 1;
        }
      }
    }
    // No else — keep last display until new confident reading

    _rafId = requestAnimationFrame(tick);
  }

  _rafId = requestAnimationFrame(tick);
}
```

- [ ] **Step 4: Add `open()`, `close()`, and `init()` exports**

```js
export async function open() {
  const modal = document.getElementById('key-finder-modal');
  if (!modal) return;

  try {
    _stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    _audioCtx = new AudioContext();
    _analyser = _audioCtx.createAnalyser();
    _analyser.fftSize = 2048;
    _buf = new Float32Array(_analyser.fftSize);

    const source = _audioCtx.createMediaStreamSource(_stream);
    source.connect(_analyser);

    modal.style.display = 'block';
    updateDisplay(null);
    startPitchLoop();
  } catch (err) {
    console.warn('Key Finder: mic access denied or unavailable', err);
    modal.style.display = 'block'; // show modal anyway, just won't detect
  }
}

export function close() {
  const modal = document.getElementById('key-finder-modal');
  if (modal) modal.style.display = 'none';

  if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
  if (_stream) { _stream.getTracks().forEach(t => t.stop()); _stream = null; }
  if (_audioCtx) { _audioCtx.close(); _audioCtx = null; }
  _analyser = null;
  _buf = null;
  _lastNote = null;
  _noteCount = 0;

  updateDisplay(null);
}

export function init() {
  const openBtn = document.getElementById('open-key-finder-button');
  const closeBtn = document.getElementById('close-key-finder-modal');
  const modal = document.getElementById('key-finder-modal');

  if (!openBtn || !closeBtn || !modal) {
    console.warn('Key Finder: DOM elements not found');
    return;
  }

  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);

  // Close on backdrop click
  modal.addEventListener('click', e => {
    if (e.target === modal) close();
  });
}
```

- [ ] **Step 5: Verify in browser**

Open `http://localhost:8000`, open DevTools, click FIND KEY. Allow mic.
- Hum a steady note — the big letter should update after ~4 consistent frames
- Piano keys should light up: root in bright green, scale notes in dim green
- Closing the modal (× or backdrop) should stop the mic (verify in DevTools → Application → Permissions or check the mic icon in the browser tab disappears)

- [ ] **Step 6: Commit**

```bash
git add public/js/keyFinder.js
git commit -m "feat: key finder DOM wiring, mic capture, and live pitch detection loop"
```

---

## Task 5: Wire into `main.js`

**Files:**
- Modify: `public/js/main.js`

- [ ] **Step 1: Add import at the top of the imports block**

After the last existing import line (around line 43), add:

```js
import * as keyFinder from './keyFinder.js';
```

- [ ] **Step 2: Call `init()` inside `initializeApp()`**

Find the `// 3. Setup Features` comment block (around line ~105) and add:

```js
    // Key Finder
    keyFinder.init();
```

- [ ] **Step 3: Verify full integration**

Reload `http://localhost:8000`. No console errors. FIND KEY button works. Mic activates on open, releases on close.

- [ ] **Step 4: Commit**

```bash
git add public/js/main.js
git commit -m "feat: wire key finder into app init"
```

---

## Task 6: Smoke test checklist

No automated test runner — verify each manually in Chrome.

- [ ] FIND KEY button is visible in the right panel, between BPM controls and Multiplier
- [ ] Clicking FIND KEY opens the modal; mic permission prompt appears (first time)
- [ ] Humming a low steady note (e.g. matching the beat's bassline) causes a note letter to appear within ~0.5 seconds
- [ ] The correct piano keys light up (root = bright, scale notes = dim, others = dark)
- [ ] Humming a different note changes the display
- [ ] Closing via × stops the mic (browser tab's mic indicator disappears)
- [ ] Closing via backdrop click also stops the mic
- [ ] Opening and closing multiple times works without errors in DevTools console
- [ ] Theme switch (dark/classic/light) doesn't break the piano colors (they use CSS vars)

- [ ] **Commit changelog entry**

Add to `CHANGELOG.md` under today's date:

```markdown
## 2026-04-03
- feat: Key Finder — real-time mic pitch detection with piano keyboard scale display
```

```bash
git add CHANGELOG.md
git commit -m "docs: changelog entry for key finder feature"
```
