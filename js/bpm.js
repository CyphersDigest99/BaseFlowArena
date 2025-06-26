// js/bpm.js
// Handles BPM tapping, calculation, grid display, and related effects.

import { state } from './state.js';
import * as ui from './ui.js';
import * as storage from './storage.js'; // To save BPM settings

// --- BPM Tapping and Calculation ---
export function handleTap() {
    const now = Date.now();
    state.bpmClickTimestamps.push(now);
    if (state.bpmClickTimestamps.length > state.BPM_AVERAGE_COUNT + 1) {
        state.bpmClickTimestamps.shift();
    }
    ui.triggerScreenShake();
    if (state.bpmClickTimestamps.length > 1) {
        calculateAndUpdateBpm();
    }
    if (state.bpmClickTimestamps.length >= state.BPM_AVERAGE_COUNT && state.bpm > 0) {
        if (!state.isBpmLockedShaking) startWordDisplayShake();
    } else {
        if (state.isBpmLockedShaking) stopWordDisplayShake();
    }
}

function calculateAndUpdateBpm() {
    if (state.bpmClickTimestamps.length < 2) return;
    const relevantTimestamps = state.bpmClickTimestamps.slice(-(state.BPM_AVERAGE_COUNT + 1));
    const intervals = relevantTimestamps.slice(1).map((ts, i) => ts - relevantTimestamps[i]);
    if (intervals.length === 0) return;
    const reasonableIntervals = intervals.filter(interval => interval > 100 && interval < 3000);
    if (reasonableIntervals.length < Math.min(2, intervals.length)) {
        // console.log("Not enough reasonable intervals to calculate BPM reliably.");
        return;
    }
    const averageInterval = reasonableIntervals.reduce((sum, interval) => sum + interval, 0) / reasonableIntervals.length;
    if (averageInterval > 0) {
        const newBpm = Math.round(60000 / averageInterval);
        if (newBpm !== state.bpm) {
            state.bpm = newBpm;
            console.log(`BPM Calculated: ${state.bpm}`);
            ui.updateBpmIndicator(state.bpm);
            startBeatAnimation();
            storage.saveSettings();
        }
    }
}

// --- BPM Adjustment and Stop ---
export function adjustBpm(amount) {
    const newBpm = Math.max(0, state.bpm + amount);
    if (newBpm !== state.bpm) {
        state.bpm = newBpm;
        state.bpmClickTimestamps = [];
        ui.updateBpmIndicator(state.bpm);
        storage.saveSettings();
        if (state.bpm > 0) {
            startBeatAnimation();
            if (!state.isBpmLockedShaking) startWordDisplayShake();
        } else {
            stopBpm();
        }
        console.log(`BPM manually adjusted to ${state.bpm}.`);
    }
}

export function stopBpm() {
    if (state.bpm === 0 && !state.beatIntervalId && !state.isBpmLockedShaking) return;
    console.log('Stopping BPM...');
    state.bpm = 0;
    state.bpmClickTimestamps = [];
    ui.updateBpmIndicator(state.bpm);
    stopBeatAnimation();
    stopWordDisplayShake();
    storage.saveSettings();
    ui.showFeedback("BPM Stopped", false, 1000);
}

// --- Set BPM Directly (Used by auto-detection result) ---
export function setBpm(newBpmValue) {
    newBpmValue = Math.round(newBpmValue);
    if (isNaN(newBpmValue) || newBpmValue < 0) {
        console.error(`Invalid BPM value passed to setBpm: ${newBpmValue}`); return;
    }
    if (newBpmValue !== state.bpm) {
        console.log(`Setting BPM directly to: ${newBpmValue}`);
        state.bpm = newBpmValue;
        state.bpmClickTimestamps = [];
        ui.updateBpmIndicator(state.bpm);
        storage.saveSettings();
        if (state.bpm > 0) {
            startBeatAnimation();
            if (!state.isBpmLockedShaking) startWordDisplayShake();
        } else {
            stopBpm();
        }
    } else {
         // console.log(`BPM already set to ${newBpmValue}, no change.`);
         if (state.bpm > 0 && !state.beatIntervalId) startBeatAnimation();
    }
}

// --- Beat Grid Animation ---
function startBeatAnimation() {
    stopBeatAnimation();
    if (state.bpm <= 0) return;
    const totalBoxes = state.beatGridRows * state.beatGridCols;
    const baseIntervalMs = (60 / state.bpm) * 1000;
    if (totalBoxes <= 0 || !isFinite(baseIntervalMs) || baseIntervalMs <= 0) return;
    state.currentBeat = -1; // Start before the first beat to make the first one hit 0 index

    const updateVisualsForBeat = (beatIndex) => {
        if (!ui.elements.fourCountContainer) return;
        const boxes = ui.elements.fourCountContainer.querySelectorAll('.beat-box');
        if (boxes.length !== totalBoxes) {
            // console.warn("Beatbox count mismatch during updateVisuals. Grid may be rebuilding.");
            // updateGrid(); // Avoid recursive call if updateGrid also calls startBeatAnimation
            return; // Skip this frame if grid is not ready
        }
        const baseIntervalSeconds = baseIntervalMs / 1000;
        const flashDurationSeconds = baseIntervalSeconds / state.bpmMultiplier;

        boxes.forEach((box, index) => {
            const shouldBeActive = (index === beatIndex);
            if (shouldBeActive) { // If this specific box should be active
                if (!box.classList.contains('active')) { // Add classes only if not already present
                    box.classList.add('active');
                    box.classList.add('flashing-border');
                    box.style.animationDuration = `${flashDurationSeconds}s`;
                } else if (box.classList.contains('flashing-border') && box.style.animationDuration !== `${flashDurationSeconds}s`) {
                    // If already active but multiplier changed, just update duration
                    box.style.animationDuration = `${flashDurationSeconds}s`;
                }
            } else { // If this box should NOT be active
                if (box.classList.contains('active')) { // Remove classes if present
                    box.classList.remove('active');
                    box.classList.remove('flashing-border');
                    box.style.animationDuration = '';
                }
            }
        });
    };

    updateVisualsForBeat(-1); // Ensure all off initially
    state.beatIntervalId = setInterval(() => {
        if (state.bpm <= 0) { stopBeatAnimation(); return; }
        state.currentBeat = (state.currentBeat + 1) % totalBoxes;
        updateVisualsForBeat(state.currentBeat);
    }, baseIntervalMs);
    // console.log(`Beat animation started. Base Interval: ${baseIntervalMs}ms`);
}

function stopBeatAnimation() {
    if (state.beatIntervalId) {
        clearInterval(state.beatIntervalId);
        state.beatIntervalId = null;
        if (ui.elements.fourCountContainer) {
            ui.elements.fourCountContainer.querySelectorAll('.beat-box').forEach(box => {
                box.classList.remove('active', 'flashing-border');
                box.style.animationDuration = '';
            });
        }
        // console.log("Beat animation stopped.");
    }
    state.currentBeat = -1; // Reset beat counter
}

// --- Beat Grid Structure ---
export function updateGrid() {
    ui.rebuildBeatGrid(state.beatGridRows, state.beatGridCols);
    storage.saveSettings();
    if (state.bpm > 0) {
        startBeatAnimation();
    } else {
        stopBeatAnimation();
    }
}

export function updateRowCount(delta) {
    const newRows = state.beatGridRows + delta;
    if (newRows >= 1 && newRows <= 8) {
        state.beatGridRows = newRows;
        updateGrid();
    }
}
export function updateColumnCount(delta) {
    const newCols = state.beatGridCols + delta;
    if (newCols >= 1 && newCols <= 16) { // Max 16 cols
        state.beatGridCols = newCols;
        updateGrid();
    }
}

// --- Multiplier ---
export function setMultiplier(newMultiplierValue) {
    const clickedMultiplier = parseInt(newMultiplierValue, 10);

    if (isNaN(clickedMultiplier) || clickedMultiplier < 2 || clickedMultiplier > 4) {
        console.warn("Invalid multiplier value passed from button:", newMultiplierValue);
        return;
    }

    let finalMultiplierToSet;

    if (state.bpmMultiplier === clickedMultiplier) {
        finalMultiplierToSet = 1; // Toggle OFF, revert to 1x
        console.log(`BPM Multiplier toggled OFF (reverted to 1x).`);
    } else {
        finalMultiplierToSet = clickedMultiplier; // Set to 2x, 3x, or 4x
        console.log(`BPM Multiplier set to: ${finalMultiplierToSet}x`);
    }

    if (state.bpmMultiplier !== finalMultiplierToSet) {
        state.bpmMultiplier = finalMultiplierToSet;

        document.querySelectorAll('.multiplier-btn').forEach(btn => {
            const btnMultiplierValue = parseInt(btn.dataset.multiplier);
            btn.classList.toggle('selected', btnMultiplierValue === state.bpmMultiplier && state.bpmMultiplier !== 1);
        });

        storage.saveSettings();

        // If animation is running and BPM active, update flash duration for the currently active box
        if (state.beatIntervalId && state.currentBeat >= 0 && ui.elements.fourCountContainer && state.bpm > 0) {
             const currentActiveBox = ui.elements.fourCountContainer.querySelector(`.beat-box:nth-child(${state.currentBeat + 1})`);
             if (currentActiveBox && currentActiveBox.classList.contains('flashing-border')){
                 const baseIntervalMs = (60 / state.bpm) * 1000;
                 const baseIntervalSeconds = baseIntervalMs / 1000;
                 const flashDurationSeconds = baseIntervalSeconds / state.bpmMultiplier;
                 currentActiveBox.style.animationDuration = `${flashDurationSeconds}s`;
                 // console.log(`Updated flash duration for active box to ${flashDurationSeconds}s`);
              }
        }
    }
}

// --- Word Display Buzz Effect ---
function startWordDisplayShake() {
    if (!state.isBpmLockedShaking && state.bpm > 0) {
        ui.startWordBuzz();
        state.isBpmLockedShaking = true;
    }
}

function stopWordDisplayShake() {
    if (state.isBpmLockedShaking) {
        ui.stopWordBuzz();
        state.isBpmLockedShaking = false;
    }
}