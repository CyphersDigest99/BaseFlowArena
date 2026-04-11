# Carousel Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-viewport rotating 3D card carousel mode where each card displays a word and updates silently as it passes through the back of the ring.

**Architecture:** A new `carouselMode.js` module owns all carousel logic — DOM creation, the rAF animation loop, config panel, and word management. It reads from the existing `state` and `wordManager` modules and never modifies `state.currentWord`. Entry is a button added to the Activation Mode panel header; the overlay sits at `z-index: 1000` and covers the full viewport.

**Tech Stack:** Vanilla JS ES6 modules, CSS3 3D transforms, `requestAnimationFrame`. No build step. Dev server: `python3 server.py` → `http://localhost:8000`.

---

## File Map

| File | Change | Responsibility |
|---|---|---|
| `public/js/carouselMode.js` | **Create** | All carousel logic: DOM, rAF loop, config, word pool |
| `index.html` | **Modify** | Entry button in Activation Mode panel header |
| `styles.css` | **Modify** | Carousel overlay, card, panel CSS (append to end) |
| `public/js/main.js` | **Modify** | Import carouselMode, wire entry button click |

---

### Task 1: Carousel CSS

**Files:**
- Modify: `styles.css` (append block to end of file)

- [ ] **Step 1: Append carousel styles to `styles.css`**

Add this entire block to the very end of `styles.css`:

```css
/* ============================================================
   CAROUSEL MODE
   ============================================================ */

.carousel-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: #050505;
}

.carousel-overlay.active {
  display: block;
}

/* Top bar: Config (left) and Exit (right) */
.carousel-top-controls {
  position: absolute;
  top: 12px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  padding: 0 14px;
  z-index: 2;
}

.carousel-btn {
  background: #111;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  color: #666;
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  padding: 6px 12px;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;
}

.carousel-btn:hover { color: #ccc; border-color: #555; }
.carousel-btn.config { color: #4aaa64; border-color: #2a4a3a; }
.carousel-btn.config:hover { background: #0d2a1a; }

/* 3D scene */
.carousel-scene {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  perspective: 1000px !important;
}

.carousel-inner {
  position: relative;
  width: 0;
  height: 0;
  transform-style: preserve-3d !important;
}

/* Individual word cards */
.carousel-card {
  position: absolute;
  width: 100px;
  height: 150px;
  margin-left: -50px;
  margin-top: -75px;
  border: 2px solid rgba(74, 170, 100, 0.7);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Courier New', monospace;
  font-size: 1rem;
  font-weight: bold;
  letter-spacing: 2px;
  color: #4aaa64;
  background: radial-gradient(
    circle,
    rgba(74, 170, 100, 0.06) 0%,
    rgba(74, 170, 100, 0.16) 100%
  );
  backface-visibility: hidden;
  pointer-events: none;
  text-transform: uppercase;
  text-align: center;
  padding: 8px;
  word-break: break-word;
}

/* Corner action buttons */
.carousel-corner-btn {
  position: absolute;
  bottom: 18px;
  background: #111;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  padding: 10px 16px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-family: 'Courier New', monospace;
  font-size: 0.65rem;
  color: #555;
  letter-spacing: 1px;
  text-transform: uppercase;
  transition: color 0.2s, border-color 0.2s;
  z-index: 2;
}

.carousel-corner-btn .corner-icon { font-size: 1.1rem; }
.carousel-corner-btn.blacklist { left: 18px; border-color: #4a2a2a; }
.carousel-corner-btn.blacklist:hover { color: #cc6666; border-color: #aa4444; }
.carousel-corner-btn.favorite { right: 18px; border-color: #2a3a4a; }
.carousel-corner-btn.favorite:hover { color: #6699cc; border-color: #4477aa; }

/* Config panel */
.carousel-config-panel {
  display: none;
  position: absolute;
  top: 44px;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(8, 8, 8, 0.96);
  z-index: 3;
  overflow-y: auto;
  padding: 20px;
  flex-direction: column;
  gap: 18px;
  font-family: 'Courier New', monospace;
}

.carousel-config-panel.active { display: flex; }

.carousel-config-title {
  color: #e8b84b;
  font-size: 0.85rem;
  letter-spacing: 2px;
  text-transform: uppercase;
  border-bottom: 1px solid #1a1a1a;
  padding-bottom: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.carousel-config-esc {
  font-size: 0.62rem;
  color: #444;
  border: 1px solid #222;
  border-radius: 3px;
  padding: 2px 6px;
}

.carousel-config-section {
  font-size: 0.6rem;
  color: #3a6a4a;
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-bottom: -8px;
}

.carousel-config-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.carousel-config-label {
  font-size: 0.68rem;
  color: #666;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.carousel-config-control {
  display: flex;
  align-items: center;
  gap: 10px;
}

.carousel-config-control input[type="range"] { flex: 1; }

.carousel-config-val {
  color: #4aaa64;
  font-size: 0.8rem;
  min-width: 40px;
  text-align: right;
}

.carousel-seg-group { display: flex; gap: 6px; flex-wrap: wrap; }

.carousel-seg-btn {
  background: #111;
  border: 1px solid #333;
  border-radius: 4px;
  padding: 4px 10px;
  font-family: 'Courier New', monospace;
  font-size: 0.72rem;
  color: #666;
  cursor: pointer;
  transition: all 0.15s;
}

.carousel-seg-btn.active {
  background: #0d2a1a;
  border-color: #4aaa64;
  color: #4aaa64;
}

.carousel-syl-row { display: flex; gap: 16px; }

.carousel-syl-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.carousel-syl-mini-label {
  font-size: 0.6rem;
  color: #555;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.carousel-divider { border: none; border-top: 1px solid #141414; }

/* Entry button in Activation Mode panel */
.activation-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0;
}

.activation-panel-header h2 { margin: 0; }

.carousel-entry-btn {
  background: #111;
  border: 1px solid #2a4a3a;
  border-radius: 6px;
  color: #4aaa64;
  font-family: 'Courier New', monospace;
  font-size: 0.72rem;
  padding: 5px 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  transition: background 0.2s;
  white-space: nowrap;
}

.carousel-entry-btn:hover { background: #0d2a1a; }
```

- [ ] **Step 2: Verify page still loads**

Open `http://localhost:8000`. Page should look and behave identically to before — no visual changes yet.

- [ ] **Step 3: Commit**

```bash
git add styles.css
git commit -m "feat: carousel mode CSS"
```

---

### Task 2: Entry Button in HTML

**Files:**
- Modify: `index.html` (~line 354)

- [ ] **Step 1: Wrap the Activation Mode `<h2>` in a header row**

Find this in `index.html`:

```html
            <div class="activation-controls panel">
                <h2><i class="fas fa-power-off"></i> Activation Mode</h2>
```

Replace with:

```html
            <div class="activation-controls panel">
                <div class="activation-panel-header">
                    <h2><i class="fas fa-power-off"></i> Activation Mode</h2>
                    <button id="carousel-entry-btn" class="carousel-entry-btn" title="Carousel Mode">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/></svg>
                        Carousel
                    </button>
                </div>
```

- [ ] **Step 2: Verify in browser**

Reload `http://localhost:8000`. The Activation Mode panel should show a green "Carousel" button in the upper-right of its header row, alongside the "Activation Mode" title. Button is not yet wired up.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: carousel entry button in Activation Mode header"
```

---

### Task 3: Create `carouselMode.js` — Core Module

**Files:**
- Create: `public/js/carouselMode.js`

This task builds the complete module: DOM construction, rAF loop, word pool, config panel UI, and all button handlers. Everything in one file.

- [ ] **Step 1: Create `public/js/carouselMode.js`**

```javascript
// public/js/carouselMode.js
import { state } from './state.js';
import * as wordManager from './wordManager.js';
import * as storage from './storage.js';

// ── Config (live-edited by config panel) ──────────────────
const config = {
  speed: 20,          // seconds per full revolution
  direction: 1,       // 1 = CW, -1 = CCW
  tilt: -15,          // X-axis tilt in degrees
  cardCount: 8,
  minSyllables: 0,    // 0 = no limit
  maxSyllables: 0,
  isConfigOpen: false,
};

// ── Animation state ───────────────────────────────────────
let rafId = null;
let lastTimestamp = null;
let carouselAngle = 0;

// ── Word pool ─────────────────────────────────────────────
let wordPool = [];
let wordPoolIndex = 0;

// ── DOM references ────────────────────────────────────────
let overlay, inner, configPanel;
let configBtn;

// ═══════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════

export function init() {
  overlay = document.createElement('div');
  overlay.className = 'carousel-overlay';

  // Top controls
  const topControls = document.createElement('div');
  topControls.className = 'carousel-top-controls';

  configBtn = document.createElement('button');
  configBtn.className = 'carousel-btn config';
  configBtn.textContent = '⚙ Config';
  configBtn.addEventListener('click', toggleConfig);

  const exitBtn = document.createElement('button');
  exitBtn.className = 'carousel-btn';
  exitBtn.textContent = '✕ Exit';
  exitBtn.addEventListener('click', exit);

  topControls.appendChild(configBtn);
  topControls.appendChild(exitBtn);

  // 3D scene
  const scene = document.createElement('div');
  scene.className = 'carousel-scene';

  inner = document.createElement('div');
  inner.className = 'carousel-inner';
  scene.appendChild(inner);

  // Corner buttons
  const blacklistBtn = document.createElement('button');
  blacklistBtn.className = 'carousel-corner-btn blacklist';
  blacklistBtn.innerHTML = '<span class="corner-icon">🚫</span><span>Blacklist</span>';
  blacklistBtn.addEventListener('click', blacklistFrontWord);

  const favoriteBtn = document.createElement('button');
  favoriteBtn.className = 'carousel-corner-btn favorite';
  favoriteBtn.innerHTML = '<span class="corner-icon">★</span><span>Favorite</span>';
  favoriteBtn.addEventListener('click', favoriteFrontWord);

  // Config panel
  configPanel = buildConfigPanel();

  overlay.appendChild(topControls);
  overlay.appendChild(scene);
  overlay.appendChild(blacklistBtn);
  overlay.appendChild(favoriteBtn);
  overlay.appendChild(configPanel);
  document.body.appendChild(overlay);

  wireConfigPanel();

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && config.isConfigOpen) closeConfig();
  });
}

export function enter() {
  buildCards(config.cardCount);
  buildWordPool();
  seedCards();
  carouselAngle = 0;
  lastTimestamp = null;
  overlay.classList.add('active');
  rafId = requestAnimationFrame(rafLoop);
}

export function exit() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  overlay.classList.remove('active');
  if (config.isConfigOpen) closeConfig();
}

// ═══════════════════════════════════════════════════════════
// DOM CONSTRUCTION
// ═══════════════════════════════════════════════════════════

function buildCards(count) {
  inner.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const card = document.createElement('div');
    card.className = 'carousel-card';
    card.dataset.prevAngle = String((360 / count) * i);
    inner.appendChild(card);
  }
}

function buildConfigPanel() {
  const panel = document.createElement('div');
  panel.className = 'carousel-config-panel';

  panel.innerHTML = `
    <div class="carousel-config-title">
      ⚙ Carousel Settings
      <span class="carousel-config-esc">ESC to close</span>
    </div>

    <div class="carousel-config-section">Rotation</div>

    <div class="carousel-config-row">
      <div class="carousel-config-label">Speed</div>
      <div class="carousel-config-control">
        <input type="range" id="cs-speed" min="5" max="60" step="1" value="${config.speed}">
        <span class="carousel-config-val" id="cs-speed-val">${config.speed}s</span>
      </div>
    </div>

    <div class="carousel-config-row">
      <div class="carousel-config-label">Direction</div>
      <div class="carousel-seg-group" id="cs-dir">
        <button class="carousel-seg-btn active" data-val="1">↺ CW</button>
        <button class="carousel-seg-btn" data-val="-1">↻ CCW</button>
      </div>
    </div>

    <div class="carousel-config-row">
      <div class="carousel-config-label">Tilt</div>
      <div class="carousel-config-control">
        <input type="range" id="cs-tilt" min="-45" max="0" step="1" value="${config.tilt}">
        <span class="carousel-config-val" id="cs-tilt-val">${config.tilt}°</span>
      </div>
    </div>

    <hr class="carousel-divider">
    <div class="carousel-config-section">Cards</div>

    <div class="carousel-config-row">
      <div class="carousel-config-label">Number of Cards</div>
      <div class="carousel-seg-group" id="cs-count">
        ${[4, 6, 8, 10, 12].map(n =>
          `<button class="carousel-seg-btn${n === config.cardCount ? ' active' : ''}" data-val="${n}">${n}</button>`
        ).join('')}
      </div>
    </div>

    <hr class="carousel-divider">
    <div class="carousel-config-section">Words</div>

    <div class="carousel-config-row">
      <div class="carousel-config-label">Syllable Range</div>
      <div class="carousel-syl-row">
        <div class="carousel-syl-col">
          <div class="carousel-syl-mini-label">Min</div>
          <div class="carousel-config-control">
            <input type="range" id="cs-syl-min" min="0" max="8" step="1" value="${config.minSyllables}">
            <span class="carousel-config-val" id="cs-syl-min-val">${config.minSyllables || 'any'}</span>
          </div>
        </div>
        <div class="carousel-syl-col">
          <div class="carousel-syl-mini-label">Max</div>
          <div class="carousel-config-control">
            <input type="range" id="cs-syl-max" min="0" max="8" step="1" value="${config.maxSyllables}">
            <span class="carousel-config-val" id="cs-syl-max-val">${config.maxSyllables || 'any'}</span>
          </div>
        </div>
      </div>
    </div>
  `;

  return panel;
}

function wireConfigPanel() {
  const speedSlider = document.getElementById('cs-speed');
  const speedVal = document.getElementById('cs-speed-val');
  speedSlider.addEventListener('input', () => {
    config.speed = Number(speedSlider.value);
    speedVal.textContent = `${config.speed}s`;
  });

  document.getElementById('cs-dir').addEventListener('click', e => {
    const btn = e.target.closest('.carousel-seg-btn');
    if (!btn) return;
    config.direction = Number(btn.dataset.val);
    document.querySelectorAll('#cs-dir .carousel-seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });

  const tiltSlider = document.getElementById('cs-tilt');
  const tiltVal = document.getElementById('cs-tilt-val');
  tiltSlider.addEventListener('input', () => {
    config.tilt = Number(tiltSlider.value);
    tiltVal.textContent = `${config.tilt}°`;
  });

  document.getElementById('cs-count').addEventListener('click', e => {
    const btn = e.target.closest('.carousel-seg-btn');
    if (!btn) return;
    const newCount = Number(btn.dataset.val);
    if (newCount === config.cardCount) return;
    config.cardCount = newCount;
    document.querySelectorAll('#cs-count .carousel-seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    // Rebuild ring with new card count (only when carousel is active)
    if (overlay.classList.contains('active')) {
      buildCards(newCount);
      buildWordPool();
      seedCards();
    }
  });

  const sylMinSlider = document.getElementById('cs-syl-min');
  const sylMinVal = document.getElementById('cs-syl-min-val');
  sylMinSlider.addEventListener('input', () => {
    config.minSyllables = Number(sylMinSlider.value);
    sylMinVal.textContent = config.minSyllables || 'any';
    if (overlay.classList.contains('active')) buildWordPool();
  });

  const sylMaxSlider = document.getElementById('cs-syl-max');
  const sylMaxVal = document.getElementById('cs-syl-max-val');
  sylMaxSlider.addEventListener('input', () => {
    config.maxSyllables = Number(sylMaxSlider.value);
    sylMaxVal.textContent = config.maxSyllables || 'any';
    if (overlay.classList.contains('active')) buildWordPool();
  });
}

// ═══════════════════════════════════════════════════════════
// WORD POOL
// ═══════════════════════════════════════════════════════════

function buildWordPool() {
  wordPool = state.filteredWordList.filter(word => {
    if (config.minSyllables === 0 && config.maxSyllables === 0) return true;
    const count = countSyllables(word);
    if (config.minSyllables > 0 && count < config.minSyllables) return false;
    if (config.maxSyllables > 0 && count > config.maxSyllables) return false;
    return true;
  });
  // Fall back to full list if syllable filter is too restrictive
  if (wordPool.length === 0) wordPool = [...state.filteredWordList];
  wordPoolIndex = 0;
}

function countSyllables(word) {
  const w = word.toLowerCase();
  const rd = state.rhymeData && state.rhymeData[w];
  if (rd && typeof rd.syllables === 'number') return rd.syllables;
  // Fallback: count vowel groups
  const matches = w.match(/[aeiouy]+/g);
  return matches ? matches.length : 1;
}

function getNextPoolWord() {
  if (wordPool.length === 0) return '';
  const word = wordPool[wordPoolIndex % wordPool.length];
  wordPoolIndex++;
  return word;
}

function seedCards() {
  const cards = inner.querySelectorAll('.carousel-card');
  cards.forEach(card => { card.textContent = getNextPoolWord(); });
}

function swapCardWord(card) {
  card.textContent = getNextPoolWord();
}

// ═══════════════════════════════════════════════════════════
// RAF LOOP
// ═══════════════════════════════════════════════════════════

function rafLoop(timestamp) {
  if (!lastTimestamp) lastTimestamp = timestamp;
  const delta = Math.min((timestamp - lastTimestamp) / 1000, 0.1); // cap at 100ms
  lastTimestamp = timestamp;

  const speedMult = config.isConfigOpen ? 0.2 : 1;
  const degreesPerSec = (360 / config.speed) * speedMult * config.direction;
  carouselAngle += degreesPerSec * delta;

  const cards = inner.querySelectorAll('.carousel-card');
  const n = cards.length;
  if (n === 0) { rafId = requestAnimationFrame(rafLoop); return; }

  // translateZ so cards form a ring with ~20px gaps between them
  const translateZ = Math.round((n * 120) / (2 * Math.PI));

  cards.forEach((card, i) => {
    const prevAngle = parseFloat(card.dataset.prevAngle);
    const cardAngle = carouselAngle + (360 / n) * i;
    const norm = ((cardAngle % 360) + 360) % 360;
    const prevNorm = ((prevAngle % 360) + 360) % 360;

    // Detect 180° crossing → swap word silently
    if (config.direction > 0 && prevNorm < 180 && norm >= 180) swapCardWord(card);
    else if (config.direction < 0 && prevNorm > 180 && norm <= 180) swapCardWord(card);

    card.dataset.prevAngle = String(cardAngle);
    card.style.transform = `rotateX(${config.tilt}deg) rotateY(${cardAngle}deg) translateZ(${translateZ}px)`;

    // Depth-based opacity: front = 1.0, back = 0.08
    const depth = (Math.cos((norm * Math.PI) / 180) + 1) / 2;
    card.style.opacity = String(0.08 + depth * 0.92);
  });

  rafId = requestAnimationFrame(rafLoop);
}

// ═══════════════════════════════════════════════════════════
// CONFIG PANEL OPEN / CLOSE
// ═══════════════════════════════════════════════════════════

function toggleConfig() {
  config.isConfigOpen ? closeConfig() : openConfig();
}

function openConfig() {
  config.isConfigOpen = true;
  configPanel.classList.add('active');
}

function closeConfig() {
  config.isConfigOpen = false;
  configPanel.classList.remove('active');
}

// ═══════════════════════════════════════════════════════════
// BLACKLIST / FAVORITE
// ═══════════════════════════════════════════════════════════

function getFrontCard() {
  const cards = Array.from(inner.querySelectorAll('.carousel-card'));
  const n = cards.length;
  let front = cards[0];
  let minDist = Infinity;
  cards.forEach((card, i) => {
    const norm = ((carouselAngle + (360 / n) * i) % 360 + 360) % 360;
    const dist = Math.min(norm, 360 - norm);
    if (dist < minDist) { minDist = dist; front = card; }
  });
  return front;
}

function blacklistFrontWord() {
  const word = getFrontCard().textContent.trim();
  if (!word) return;
  state.blacklist.add(word);
  storage.saveSettings();
  wordManager.applyFiltersAndSort();
  buildWordPool();
  // Immediately replace the front card's word
  getFrontCard().textContent = getNextPoolWord();
}

function favoriteFrontWord() {
  const word = getFrontCard().textContent.trim();
  if (!word) return;
  if (state.favorites.has(word)) {
    state.favorites.delete(word);
  } else {
    state.favorites.add(word);
  }
  storage.saveSettings();
}
```

- [ ] **Step 2: Wire into `main.js`**

Add to the imports block at the top of `main.js`:

```javascript
import * as carouselMode from './carouselMode.js';
```

Find where other `init()` calls happen on startup (look for `wordManager.init()` or the first lines inside `DOMContentLoaded`) and add:

```javascript
carouselMode.init();
```

Find where other button click handlers are wired (look for `addEventListener('click', ...)` calls near the other activation buttons) and add:

```javascript
document.getElementById('carousel-entry-btn').addEventListener('click', () => carouselMode.enter());
```

- [ ] **Step 3: Verify in browser — rotation**

Open `http://localhost:8000`. Click "Carousel" in the Activation Mode panel.

Expected:
- Page goes dark, 8 cards appear in a tilted 3D ring with words on them
- Ring rotates continuously
- Cards at the back are faded, front card is brightest
- Exit button (top-right) returns to the normal view

If cards appear flat (not 3D), open DevTools → Elements, inspect `.carousel-scene`. Confirm it has `perspective: 1000px`. If the browser stylesheet shows `perspective: none` winning, increase specificity or add `!important` to the `.carousel-scene` rule in `styles.css`.

- [ ] **Step 4: Verify — word swapping**

Let the carousel run for one full revolution (~20 seconds at default speed). Each card should silently receive a new word as it passes through the back of the ring. Words should be distinct and come from the active word list.

- [ ] **Step 5: Verify — config panel**

Click "⚙ Config". Panel slides up, carousel visibly slows. Test each setting:
- Speed slider → rotation speed changes live
- CCW button → direction reverses immediately
- Tilt slider → ring angle changes live
- Card count (e.g. 4) → ring rebuilds with that many cards
- Syllable sliders → pool rebuilds (visible on subsequent word swaps)

Press ESC → panel closes, full speed resumes.

- [ ] **Step 6: Verify — blacklist and favorite**

With the carousel running, click "🚫 Blacklist". The front card should immediately get a new word, and that word should no longer appear. Click "★ Favorite" on any word — no visible change (favorites aren't displayed in carousel), but the word should appear in favorites when you exit to the main app.

- [ ] **Step 7: Commit**

```bash
git add public/js/carouselMode.js public/js/main.js
git commit -m "feat: carousel mode — rAF loop, word pool, config panel, blacklist/favorite"
```
