/**
 * @fileoverview Filler Ticker — CSS animation scroller
 *
 * Renders a continuously scrolling text ticker in the Live Feed panel.
 * Uses CSS transform animation on the compositor thread for stutter-free
 * scrolling even during heavy Web Speech API activity on the main thread.
 *
 * Exports: init(), show(), hide()
 */

import { elements } from './ui.js';
import { state } from './state.js';

// --- Constants ---
const STORAGE_KEY = 'fillerTickerData';
const DEFAULT_DATA = { entries: [], speed: 2, spacing: 3 };

// --- Module State ---
let data = { ...DEFAULT_DATA };
let beltText = '';
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
    if (!enabled.length) { beltText = ''; return; }

    const spacing = Math.max(0, Math.round(data.spacing || 0));
    const sp = ' '.repeat(spacing);
    const texts = enabled.map(e => e.text.toUpperCase());
    beltText = texts.join(sp) + sp;
}

// --- CSS Animation Control ---
function updateTicker(containerEl) {
    if (!containerEl) return;
    const inner = containerEl.querySelector('.ticker-inner');
    const belts = containerEl.querySelectorAll('.ticker-belt');
    if (!inner || !belts.length) return;

    belts.forEach(b => { b.textContent = beltText; });

    if (!beltText) {
        inner.style.animationDuration = '0s';
        return;
    }

    // data.speed is px/frame at 60fps → px/s = speed × 60
    const beltWidth = belts[0].offsetWidth || beltText.length * 9;
    inner.style.animationDuration = Math.max(0.5, beltWidth / (data.speed * 60)) + 's';
}

function refreshAll() {
    rebuildBelt();
    if (isActiveMode) updateTicker(elements.fillerTickerEl);
    if (isModalOpen)  updateTicker(elements.fillerTickerPreview);
}

// --- Public: Show / Hide ---
export function show() {
    isActiveMode = true;
    if (!getEnabledEntries().length) return;
    elements.fillerTickerEl.style.display = 'block';
    rebuildBelt();
    updateTicker(elements.fillerTickerEl);
}

export function hide() {
    isActiveMode = false;
    if (isModalOpen) return;
    if (elements.fillerTickerEl) elements.fillerTickerEl.style.display = 'none';
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
        label.title = 'Double-click to edit';
        label.addEventListener('dblclick', () => {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = entry.text;
            input.className = 'filler-ticker-edit-input';
            label.replaceWith(input);
            input.focus();
            input.select();
            const commit = () => {
                const newText = input.value.trim();
                if (newText && newText !== entry.text) {
                    data.entries[i].text = newText;
                    saveData();
                    refreshAll();
                }
                renderList();
            };
            input.addEventListener('blur', commit);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); commit(); }
                if (e.key === 'Escape') { renderList(); }
            });
        });

        const eyeBtn = document.createElement('button');
        eyeBtn.innerHTML = `<i class="fas fa-eye${entry.enabled ? '' : '-slash'}"></i>`;
        eyeBtn.title = entry.enabled ? 'Hide from ticker' : 'Show in ticker';
        if (!entry.enabled) eyeBtn.classList.add('eye-off');
        eyeBtn.addEventListener('click', () => {
            data.entries[i].enabled = !data.entries[i].enabled;
            saveData();
            renderList();
            refreshAll();
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
            refreshAll();
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
    refreshAll();
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
    rebuildBelt();
    updateTicker(elements.fillerTickerPreview);
}

function closeModal() {
    isModalOpen = false;
    if (elements.fillerTickerModal) elements.fillerTickerModal.style.display = 'none';
    if (!isActiveMode) {
        if (elements.fillerTickerEl) elements.fillerTickerEl.style.display = 'none';
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
        refreshAll();
    });

    elements.fillerTickerSpacing?.addEventListener('input', () => {
        data.spacing = parseInt(elements.fillerTickerSpacing.value, 10);
        if (elements.fillerTickerSpacingValue) elements.fillerTickerSpacingValue.textContent = data.spacing;
        saveData();
        refreshAll();
    });
}
