/**
 * @fileoverview Filler Ticker — LED matrix canvas scroller
 *
 * Renders a continuously scrolling LED dot-matrix display in the Live Feed panel.
 * All enabled entries are concatenated into a belt that loops seamlessly.
 * Distance slider controls blank LED columns between entries (visible on screen).
 * Pause slider pauses the belt after each entry's last character exits left.
 *
 * Exports: init(), show(), hide()
 */

import { elements } from './ui.js';
import { state } from './state.js';

// --- Constants ---
const STORAGE_KEY = 'fillerTickerData';
const DEFAULT_DATA = { entries: [], speed: 2, spacing: 3 };

// LED geometry
const DOT = 3;        // LED dot diameter (px)
const STEP = 4;       // DOT + 1px gap between dots
const CHAR_W = 5;     // columns per character bitmap
const CHAR_SP = 1;    // blank columns between characters
const CHAR_COLS = CHAR_W + CHAR_SP; // 6 LED columns per character slot
const CHAR_H = 7;     // rows per character bitmap
const CANVAS_H = CHAR_H * STEP + 12; // 40px total canvas height

// 5×7 LED bitmaps. Bit 4 = leftmost column, bit 0 = rightmost.
const LED_FONT = {
    ' ': [0b00000,0b00000,0b00000,0b00000,0b00000,0b00000,0b00000],
    'A': [0b01110,0b10001,0b10001,0b11111,0b10001,0b10001,0b10001],
    'B': [0b11110,0b10001,0b10001,0b11110,0b10001,0b10001,0b11110],
    'C': [0b01110,0b10001,0b10000,0b10000,0b10000,0b10001,0b01110],
    'D': [0b11110,0b10001,0b10001,0b10001,0b10001,0b10001,0b11110],
    'E': [0b11111,0b10000,0b10000,0b11110,0b10000,0b10000,0b11111],
    'F': [0b11111,0b10000,0b10000,0b11110,0b10000,0b10000,0b10000],
    'G': [0b01110,0b10001,0b10000,0b10111,0b10001,0b10001,0b01111],
    'H': [0b10001,0b10001,0b10001,0b11111,0b10001,0b10001,0b10001],
    'I': [0b01110,0b00100,0b00100,0b00100,0b00100,0b00100,0b01110],
    'J': [0b00111,0b00010,0b00010,0b00010,0b00010,0b10010,0b01100],
    'K': [0b10001,0b10010,0b10100,0b11000,0b10100,0b10010,0b10001],
    'L': [0b10000,0b10000,0b10000,0b10000,0b10000,0b10000,0b11111],
    'M': [0b10001,0b11011,0b10101,0b10001,0b10001,0b10001,0b10001],
    'N': [0b10001,0b11001,0b10101,0b10011,0b10001,0b10001,0b10001],
    'O': [0b01110,0b10001,0b10001,0b10001,0b10001,0b10001,0b01110],
    'P': [0b11110,0b10001,0b10001,0b11110,0b10000,0b10000,0b10000],
    'Q': [0b01110,0b10001,0b10001,0b10001,0b10101,0b10010,0b01101],
    'R': [0b11110,0b10001,0b10001,0b11110,0b10100,0b10010,0b10001],
    'S': [0b01111,0b10000,0b10000,0b01110,0b00001,0b00001,0b11110],
    'T': [0b11111,0b00100,0b00100,0b00100,0b00100,0b00100,0b00100],
    'U': [0b10001,0b10001,0b10001,0b10001,0b10001,0b10001,0b01110],
    'V': [0b10001,0b10001,0b10001,0b10001,0b10001,0b01010,0b00100],
    'W': [0b10001,0b10001,0b10001,0b10101,0b10101,0b11011,0b10001],
    'X': [0b10001,0b10001,0b01010,0b00100,0b01010,0b10001,0b10001],
    'Y': [0b10001,0b10001,0b01010,0b00100,0b00100,0b00100,0b00100],
    'Z': [0b11111,0b00001,0b00010,0b00100,0b01000,0b10000,0b11111],
    '0': [0b01110,0b10001,0b10011,0b10101,0b11001,0b10001,0b01110],
    '1': [0b00100,0b01100,0b00100,0b00100,0b00100,0b00100,0b01110],
    '2': [0b01110,0b10001,0b00001,0b00110,0b01000,0b10000,0b11111],
    '3': [0b01110,0b10001,0b00001,0b00110,0b00001,0b10001,0b01110],
    '4': [0b00010,0b00110,0b01010,0b10010,0b11111,0b00010,0b00010],
    '5': [0b11111,0b10000,0b10000,0b11110,0b00001,0b00001,0b11110],
    '6': [0b01110,0b10000,0b10000,0b11110,0b10001,0b10001,0b01110],
    '7': [0b11111,0b00001,0b00010,0b00100,0b01000,0b01000,0b01000],
    '8': [0b01110,0b10001,0b10001,0b01110,0b10001,0b10001,0b01110],
    '9': [0b01110,0b10001,0b10001,0b01111,0b00001,0b00001,0b01110],
    '\'': [0b00100,0b00100,0b01000,0b00000,0b00000,0b00000,0b00000],
    '-': [0b00000,0b00000,0b00000,0b11111,0b00000,0b00000,0b00000],
    '.': [0b00000,0b00000,0b00000,0b00000,0b00000,0b00110,0b00110],
    '!': [0b00100,0b00100,0b00100,0b00100,0b00100,0b00000,0b00100],
    '?': [0b01110,0b10001,0b00001,0b00110,0b00100,0b00000,0b00100],
    ',': [0b00000,0b00000,0b00000,0b00000,0b00110,0b00100,0b01000],
    '/': [0b00001,0b00010,0b00100,0b01000,0b10000,0b00000,0b00000],
};

// --- Module State ---
let data = { ...DEFAULT_DATA };

// Belt — the full looping string rendered on the canvas
let beltText = '';
let loopWidth = 0;   // pixel width of one full belt loop
let xOffset = 0;     // pixels scrolled; increases each frame; wraps at loopWidth
let rafId = null;
let isModalOpen = false;
let isActiveMode = false;

// --- Data Management ---
function loadData() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) data = { ...DEFAULT_DATA, ...JSON.parse(saved) };
    } catch (e) {
        data = { ...DEFAULT_DATA };
    }
    updateIgnoredFeedWords();
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getEnabledEntries() {
    return data.entries.filter(e => e.enabled);
}

function updateIgnoredFeedWords() {
    state.ignoredFeedWords = new Set(
        data.entries.filter(e => e.filterFeed).map(e => e.text.toLowerCase())
    );
}

// --- Belt Construction ---
function rebuildBelt() {
    const enabled = getEnabledEntries();
    if (!enabled.length) { beltText = ''; loopWidth = 0; beltPausePts = []; return; }

    const spacing = Math.max(0, Math.round(data.spacing || 0));
    const sp = ' '.repeat(spacing);
    const texts = enabled.map(e => e.text.toUpperCase());

    // Entries joined by spacing, plus trailing spacing so loop restarts cleanly
    beltText = texts.join(sp) + sp;
    loopWidth = textWidthPx(beltText);
}

// --- LED Helpers ---
function textWidthPx(text) {
    return text.length * CHAR_COLS * STEP;
}

function getLitColor() {
    return getComputedStyle(document.documentElement)
        .getPropertyValue('--primary-accent').trim() || '#00ffff';
}

// --- Canvas Rendering ---
function renderToCanvas(canvas) {
    if (!canvas) return;
    const w = canvas.offsetWidth;
    if (!w) return;

    if (canvas.width !== w || canvas.height !== CANVAS_H) {
        canvas.width = w;
        canvas.height = CANVAS_H;
    }

    const W = canvas.width;
    const H = canvas.height;
    const ctx = canvas.getContext('2d');
    const padY = Math.floor((H - CHAR_H * STEP) / 2);
    const litColor = getLitColor();

    // Background
    ctx.fillStyle = '#050506';
    ctx.fillRect(0, 0, W, H);

    // Unlit LED grid
    ctx.fillStyle = '#141416';
    ctx.shadowBlur = 0;
    for (let row = 0; row < CHAR_H; row++) {
        const cy = padY + row * STEP + DOT / 2;
        for (let x = DOT / 2; x < W; x += STEP) {
            ctx.beginPath();
            ctx.arc(x, cy, DOT / 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    if (!beltText || !loopWidth) return;

    // Lit LEDs — render belt twice for seamless wrap
    ctx.fillStyle = litColor;
    ctx.shadowColor = litColor;
    ctx.shadowBlur = 6;

    for (let copy = 0; copy < 2; copy++) {
        const baseX = copy * loopWidth - xOffset;
        for (let ci = 0; ci < beltText.length; ci++) {
            const ch = beltText[ci];
            const bitmap = LED_FONT[ch] ?? LED_FONT[' '];
            for (let col = 0; col < CHAR_W; col++) {
                const cx = baseX + ci * CHAR_COLS * STEP + col * STEP + DOT / 2;
                if (cx < -STEP || cx > W + STEP) continue;
                for (let row = 0; row < CHAR_H; row++) {
                    if (!(bitmap[row] & (1 << (CHAR_W - 1 - col)))) continue;
                    ctx.beginPath();
                    ctx.arc(cx, padY + row * STEP + DOT / 2, DOT / 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }
    ctx.shadowBlur = 0;
}

function renderFrame() {
    renderToCanvas(elements.fillerTickerEl);
    if (isModalOpen) renderToCanvas(elements.fillerTickerPreview);
}

// --- Animation ---
function tick() {
    xOffset += data.speed;

    // Loop wrap
    if (xOffset >= loopWidth) {
        xOffset -= loopWidth;
    }

    renderFrame();
    rafId = requestAnimationFrame(tick);
}

function startAnimation() {
    if (rafId) return;
    rebuildBelt();
    if (!beltText) return;
    xOffset = 0;
    renderFrame();
    rafId = requestAnimationFrame(tick);
}

function stopAnimation() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
}

function restartAnimation() {
    stopAnimation();
    if (!getEnabledEntries().length) return;
    rebuildBelt();
    xOffset = 0;
    renderFrame();
    rafId = requestAnimationFrame(tick);
}

// --- Public: Show / Hide ---
export function show() {
    isActiveMode = true;
    if (!getEnabledEntries().length) return;
    elements.fillerTickerEl.style.display = 'block';
    if (!rafId) requestAnimationFrame(startAnimation);
}

export function hide() {
    isActiveMode = false;
    if (isModalOpen) return;
    if (elements.fillerTickerEl) elements.fillerTickerEl.style.display = 'none';
    stopAnimation();
}

// --- Modal: Entry List Rendering ---
function renderList() {
    const list = elements.fillerTickerList;
    if (!list) return;
    list.innerHTML = '';
    data.entries.forEach((entry, i) => {
        const row = document.createElement('div');
        row.className = 'filler-ticker-entry';

        const label = document.createElement('span');
        label.textContent = entry.text;

        const eyeBtn = document.createElement('button');
        eyeBtn.innerHTML = `<i class="fas fa-eye${entry.enabled ? '' : '-slash'}"></i>`;
        eyeBtn.title = entry.enabled ? 'Hide from ticker' : 'Show in ticker';
        if (!entry.enabled) eyeBtn.classList.add('eye-off');
        eyeBtn.addEventListener('click', () => {
            data.entries[i].enabled = !data.entries[i].enabled;
            saveData();
            renderList();
            restartAnimation();
        });

        const banBtn = document.createElement('button');
        banBtn.innerHTML = '<i class="fas fa-ban"></i>';
        banBtn.title = entry.filterFeed ? 'Allow in live feed' : 'Ignore in live feed';
        if (entry.filterFeed) banBtn.classList.add('feed-filtered');
        banBtn.addEventListener('click', () => {
            data.entries[i].filterFeed = !data.entries[i].filterFeed;
            saveData();
            updateIgnoredFeedWords();
            renderList();
        });

        const trashBtn = document.createElement('button');
        trashBtn.innerHTML = '<i class="fas fa-trash"></i>';
        trashBtn.title = 'Delete';
        trashBtn.addEventListener('click', () => {
            data.entries.splice(i, 1);
            saveData();
            updateIgnoredFeedWords();
            renderList();
            restartAnimation();
        });

        row.appendChild(label);
        row.appendChild(eyeBtn);
        row.appendChild(banBtn);
        row.appendChild(trashBtn);
        list.appendChild(row);
    });
}

// --- Modal: Add Entry ---
function addEntry() {
    const input = elements.fillerTickerInput;
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    data.entries.push({ text, enabled: true, filterFeed: false });
    saveData();
    input.value = '';
    renderList();
    restartAnimation();
}

// --- Modal: Open / Close ---
function openModal() {
    isModalOpen = true;
    if (elements.fillerTickerModal) elements.fillerTickerModal.style.display = 'block';
    if (elements.fillerTickerSpeed) {
        elements.fillerTickerSpeed.value = data.speed;
        if (elements.fillerTickerSpeedValue) elements.fillerTickerSpeedValue.textContent = data.speed;
    }
    if (elements.fillerTickerSpacing) {
        elements.fillerTickerSpacing.value = data.spacing ?? 3;
        if (elements.fillerTickerSpacingValue) elements.fillerTickerSpacingValue.textContent = data.spacing ?? 3;
    }
    renderList();
    if (!rafId && getEnabledEntries().length > 0) {
        requestAnimationFrame(startAnimation);
    }
}

function closeModal() {
    isModalOpen = false;
    if (elements.fillerTickerModal) elements.fillerTickerModal.style.display = 'none';
    if (!isActiveMode) {
        if (elements.fillerTickerEl) elements.fillerTickerEl.style.display = 'none';
        stopAnimation();
    }
}

// --- Public: Init ---
export function init() {
    loadData();

    elements.fillerTickerButton?.addEventListener('click', openModal);
    elements.closeFillerTickerModal?.addEventListener('click', closeModal);

    window.addEventListener('click', (e) => {
        if (e.target === elements.fillerTickerModal) closeModal();
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.fillerTickerModal?.style.display === 'block') {
            closeModal();
        }
    });

    elements.fillerTickerAddButton?.addEventListener('click', addEntry);

    elements.fillerTickerInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addEntry(); }
    });

    elements.fillerTickerSpeed?.addEventListener('input', () => {
        data.speed = parseFloat(elements.fillerTickerSpeed.value);
        if (elements.fillerTickerSpeedValue) elements.fillerTickerSpeedValue.textContent = data.speed;
        saveData();
    });

    elements.fillerTickerSpacing?.addEventListener('input', () => {
        data.spacing = parseInt(elements.fillerTickerSpacing.value, 10);
        if (elements.fillerTickerSpacingValue) elements.fillerTickerSpacingValue.textContent = data.spacing;
        saveData();
        if (rafId) restartAnimation();
    });
}
