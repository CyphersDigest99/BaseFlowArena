/**
 * @fileoverview Filler Ticker
 *
 * Scrolling header ticker that cycles through user-defined filler words/phrases.
 * Owns: localStorage persistence, rAF animation loop, modal open/close/interactions.
 *
 * Exports: init(), show(), hide()
 */

import { elements } from './ui.js';

// --- Constants ---
const STORAGE_KEY = 'fillerTickerData';
const DEFAULT_DATA = { entries: [], speed: 2, gap: 2 };

// --- Module State ---
let data = { ...DEFAULT_DATA };
let rafId = null;
let xPos = 0;
let currentEntryIndex = 0;
let isPausing = false;
let pauseTimer = null;
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
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getEnabledEntries() {
    return data.entries.filter(e => e.enabled);
}

// --- Animation ---
function getTickerWidth() {
    return elements.fillerTickerEl?.offsetWidth || 300;
}

function getTextWidth() {
    return elements.fillerTickerText?.offsetWidth || 0;
}

function loadNextEntry() {
    const enabled = getEnabledEntries();
    if (enabled.length === 0) {
        stopAnimation();
        if (!isModalOpen && !isActiveMode) {
            elements.fillerTickerEl.style.display = 'none';
        }
        return;
    }
    currentEntryIndex = (currentEntryIndex + 1) % enabled.length;
    elements.fillerTickerText.textContent = enabled[currentEntryIndex].text;
    xPos = getTickerWidth();
    elements.fillerTickerText.style.transform = `translateX(${xPos}px)`;
}

function tick() {
    xPos -= data.speed;
    elements.fillerTickerText.style.transform = `translateX(${xPos}px)`;
    if (xPos < -getTextWidth()) {
        isPausing = true;
        rafId = null;
        pauseTimer = setTimeout(() => {
            isPausing = false;
            loadNextEntry();
            rafId = requestAnimationFrame(tick);
        }, data.gap * 1000);
        return;
    }
    rafId = requestAnimationFrame(tick);
}

function startAnimation() {
    if (rafId) return;
    const enabled = getEnabledEntries();
    if (enabled.length === 0) return;
    currentEntryIndex = 0;
    elements.fillerTickerText.textContent = enabled[0].text;
    xPos = getTickerWidth();
    elements.fillerTickerText.style.transform = `translateX(${xPos}px)`;
    elements.fillerTickerText.style.willChange = 'transform';
    rafId = requestAnimationFrame(tick);
}

function stopAnimation() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (pauseTimer) { clearTimeout(pauseTimer); pauseTimer = null; }
    isPausing = false;
    if (elements.fillerTickerText) elements.fillerTickerText.style.willChange = 'auto';
}

function restartAnimation() {
    stopAnimation();
    const enabled = getEnabledEntries();
    if (enabled.length === 0) return;
    currentEntryIndex = Math.min(currentEntryIndex, enabled.length - 1);
    elements.fillerTickerText.textContent = enabled[currentEntryIndex].text;
    xPos = getTickerWidth();
    elements.fillerTickerText.style.transform = `translateX(${xPos}px)`;
    elements.fillerTickerText.style.willChange = 'transform';
    rafId = requestAnimationFrame(tick);
}

// --- Public: Show / Hide ---
export function show() {
    isActiveMode = true;
    const enabled = getEnabledEntries();
    if (enabled.length === 0) return;
    elements.fillerTickerEl.style.display = 'flex';
    if (!rafId) startAnimation();
}

export function hide() {
    isActiveMode = false;
    if (isModalOpen) return;
    elements.fillerTickerEl.style.display = 'none';
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

        const trashBtn = document.createElement('button');
        trashBtn.innerHTML = '<i class="fas fa-trash"></i>';
        trashBtn.title = 'Delete';
        trashBtn.addEventListener('click', () => {
            data.entries.splice(i, 1);
            saveData();
            renderList();
            restartAnimation();
        });

        row.appendChild(label);
        row.appendChild(eyeBtn);
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
    data.entries.push({ text, enabled: true });
    saveData();
    input.value = '';
    renderList();
    restartAnimation();
}

// --- Modal: Open / Close ---
function openModal() {
    isModalOpen = true;
    elements.fillerTickerEl.style.display = 'flex';
    const enabled = getEnabledEntries();
    if (enabled.length > 0 && !rafId) startAnimation();
    if (elements.fillerTickerSpeed) {
        elements.fillerTickerSpeed.value = data.speed;
        if (elements.fillerTickerSpeedValue) elements.fillerTickerSpeedValue.textContent = data.speed;
    }
    if (elements.fillerTickerGap) {
        elements.fillerTickerGap.value = data.gap;
        if (elements.fillerTickerGapValue) elements.fillerTickerGapValue.textContent = `${data.gap}s`;
    }
    renderList();
    if (elements.fillerTickerModal) elements.fillerTickerModal.style.display = 'block';
}

function closeModal() {
    isModalOpen = false;
    if (elements.fillerTickerModal) elements.fillerTickerModal.style.display = 'none';
    if (!isActiveMode) {
        elements.fillerTickerEl.style.display = 'none';
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

    elements.fillerTickerGap?.addEventListener('input', () => {
        data.gap = parseFloat(elements.fillerTickerGap.value);
        if (elements.fillerTickerGapValue) elements.fillerTickerGapValue.textContent = `${data.gap}s`;
        saveData();
    });
}
