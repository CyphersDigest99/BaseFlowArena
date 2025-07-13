/**
 * @fileoverview BPM (Beats Per Minute) Detection, Control, and Beat Grid Animation
 *
 * This module manages all BPM-related logic for the BaseFlowArena application.
 * It handles tap-based BPM detection, manual BPM adjustment, beat grid animation,
 * BPM multipliers, and visual feedback for rhythm and timing.
 *
 * Key responsibilities:
 * - BPM tap detection and calculation
 * - Manual BPM adjustment and direct setting
 * - Beat grid animation and visual feedback
 * - BPM multiplier controls
 * - Word display buzz/shake effects
 * - Persistence of BPM and grid settings
 *
 * Dependencies: state.js, ui.js, storage.js
 */

// js/bpm.js
// Handles BPM tapping, calculation, grid display, and related effects.

import { state } from './state.js';
import * as ui from './ui.js';
import { updateBpmIndicator } from './ui-helpers.js';
import * as storage from './storage.js'; // To save BPM settings

// --- BPM Tapping and Calculation ---
// Handles user tap input for BPM detection and triggers calculation
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

// Calculates BPM from tap intervals and updates state/UI
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
            updateBpmIndicator(state.bpm);
            startBeatAnimation();
            storage.saveSettings();
        }
    }
}

// --- BPM Adjustment and Stop ---
// Adjusts BPM by a given amount (manual increment/decrement)
export function adjustBpm(amount) {
    const newBpm = Math.max(0, state.bpm + amount);
    if (newBpm !== state.bpm) {
        state.bpm = newBpm;
        state.bpmClickTimestamps = [];
        updateBpmIndicator(state.bpm);
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

// Stops BPM and all related animations/effects
export function stopBpm() {
    if (state.bpm === 0 && !state.beatIntervalId && !state.isBpmLockedShaking) return;
    console.log('Stopping BPM...');
    state.bpm = 0;
    state.bpmClickTimestamps = [];
    updateBpmIndicator(state.bpm);
    stopBeatAnimation();
    stopWordDisplayShake();
    storage.saveSettings();
    ui.showFeedback("BPM Stopped", false, 1000);
}

// --- Set BPM Directly (Used by auto-detection result) ---
// Sets BPM directly (e.g., from auto-detection) and updates state/UI
export function setBpm(newBpmValue) {
    newBpmValue = Math.round(newBpmValue);
    if (isNaN(newBpmValue) || newBpmValue < 0) {
        console.error(`Invalid BPM value passed to setBpm: ${newBpmValue}`); return;
    }
    if (newBpmValue !== state.bpm) {
        console.log(`Setting BPM directly to: ${newBpmValue}`);
        state.bpm = newBpmValue;
        state.bpmClickTimestamps = [];
        updateBpmIndicator(state.bpm);
        storage.saveSettings();
        if (state.bpm > 0) {
            startBeatAnimation();
            if (!state.isBpmLockedShaking) startWordDisplayShake();
        } else {
            stopBpm();
        }
    } else {
         // console.log(`BPM already set to ${newBpmValue}, no change.`);
         // Always restart animation to resync, even if BPM value hasn't changed
         if (state.bpm > 0) {
             startBeatAnimation();
             if (!state.isBpmLockedShaking) startWordDisplayShake();
         }
    }
    
    // Update triplet animation duration if triplet mode is active
    if (state.bpmMultiplier === 'triplet' && ui.elements.fourCountContainer) {
        const baseIntervalMs = (60 / state.bpm) * 1000;
        const tripletDuration = (baseIntervalMs / 3) / 1000; // Convert to seconds
        ui.elements.fourCountContainer.style.setProperty('--triplet-duration', `${tripletDuration}s`);
    }
}

// --- Beat Grid Animation ---
// Starts the beat grid animation based on current BPM and grid size
function startBeatAnimation() {
    stopBeatAnimation();
    if (state.bpm <= 0) return;
    const totalBoxes = state.beatGridRows * state.beatGridCols;
    const baseIntervalMs = (60 / state.bpm) * 1000;
    if (totalBoxes <= 0 || !isFinite(baseIntervalMs) || baseIntervalMs <= 0) return;
    state.currentBeat = -1; // Start before the first beat to make the first one hit 0 index

    // Calculate interval based on multiplier
    let intervalMs = baseIntervalMs;
    if (state.bpmMultiplier === 0.5) {
        intervalMs = baseIntervalMs * 2; // Slower animation
    } else if (state.bpmMultiplier === 2) {
        intervalMs = baseIntervalMs / 2; // Faster animation
    }
    // For triplet mode, we keep the same interval but add subdivision logic

    const updateVisualsForBeat = (beatIndex) => {
        if (!ui.elements.fourCountContainer) return;
        const boxes = ui.elements.fourCountContainer.querySelectorAll('.beat-box');
        if (boxes.length !== totalBoxes) {
            return; // Skip this frame if grid is not ready
        }

        // Update light position based on active beat
        if (beatIndex >= 0 && beatIndex < boxes.length) {
            const activeBox = boxes[beatIndex];
            const rect = activeBox.getBoundingClientRect();
            const containerRect = ui.elements.fourCountContainer.getBoundingClientRect();
            
            // Calculate relative position within the container
            let relativeX = ((rect.left + rect.width / 2) - containerRect.left) / containerRect.width * 100;
            let relativeY = ((rect.top + rect.height / 2) - containerRect.top) / containerRect.height * 100;
            
            // For triplet mode, adjust light position within the box
            if (state.bpmMultiplier === 'triplet') {
                const tripletPhase = (Date.now() % baseIntervalMs) / baseIntervalMs; // 0 to 1
                const boxWidth = rect.width;
                const boxLeft = rect.left;
                
                if (tripletPhase < 0.33) {
                    // First third
                    relativeX = ((boxLeft + boxWidth * 0.167) - containerRect.left) / containerRect.width * 100;
                } else if (tripletPhase < 0.67) {
                    // Middle third
                    relativeX = ((boxLeft + boxWidth * 0.5) - containerRect.left) / containerRect.width * 100;
                } else {
                    // Last third
                    relativeX = ((boxLeft + boxWidth * 0.833) - containerRect.left) / containerRect.width * 100;
                }
            }
            
            // Update CSS custom properties for light position
            ui.elements.fourCountContainer.style.setProperty('--light-x', `${relativeX}%`);
            ui.elements.fourCountContainer.style.setProperty('--light-y', `${relativeY}%`);
            ui.elements.fourCountContainer.classList.add('has-light');
        } else {
            ui.elements.fourCountContainer.classList.remove('has-light');
        }

        // Update box states
        boxes.forEach((box, index) => {
            const shouldBeActive = (index === beatIndex);
            if (shouldBeActive) {
                if (!box.classList.contains('active')) {
                    box.classList.add('active');
                }
            } else {
                if (box.classList.contains('active')) {
                    box.classList.remove('active');
                }
            }
        });
    };

    // Function to update triplet pulse position to follow active beat box
    function updateTripletPosition(beatIndex) {
        if (state.bpmMultiplier !== 'triplet' || !ui.elements.fourCountContainer) return;
        
        const boxes = ui.elements.fourCountContainer.querySelectorAll('.beat-box');
        if (beatIndex >= 0 && beatIndex < boxes.length) {
            const activeBox = boxes[beatIndex];
            const rect = activeBox.getBoundingClientRect();
            const containerRect = ui.elements.fourCountContainer.getBoundingClientRect();
            
            const relativeX = ((rect.left + rect.width / 2) - containerRect.left) / containerRect.width * 100;
            const relativeY = ((rect.top + rect.height / 2) - containerRect.top) / containerRect.height * 100;
            
            ui.elements.fourCountContainer.style.setProperty('--triplet-x', `${relativeX}%`);
            ui.elements.fourCountContainer.style.setProperty('--triplet-y', `${relativeY}%`);
        }
    }

    updateVisualsForBeat(-1); // Ensure all off initially
    
    // For triplet mode, we need a faster update rate for smooth subdivision
    const updateInterval = (state.bpmMultiplier === 'triplet') ? 16 : intervalMs; // 60fps for triplets
    
    state.beatIntervalId = setInterval(() => {
        if (state.bpm <= 0) { stopBeatAnimation(); return; }
        
        // For triplet mode, we need to track both beat and subdivision
        if (state.bpmMultiplier === 'triplet') {
            // Update visuals every frame for smooth triplet animation
            if (state.currentBeat >= 0) {
                updateVisualsForBeat(state.currentBeat);
                // Update triplet position to follow active beat box
                updateTripletPosition(state.currentBeat);
            }
            
            // Advance to next beat at the regular interval
            if (Date.now() % baseIntervalMs < updateInterval) {
                state.currentBeat = (state.currentBeat + 1) % totalBoxes;
            }
        } else {
            // Regular multiplier logic
            state.currentBeat = (state.currentBeat + 1) % totalBoxes;
            updateVisualsForBeat(state.currentBeat);
        }
    }, updateInterval);
    
    // console.log(`Beat animation started. Base Interval: ${baseIntervalMs}ms, Actual Interval: ${intervalMs}ms`);
}

// Stops the beat grid animation and resets visuals
function stopBeatAnimation() {
    if (state.beatIntervalId) {
        clearInterval(state.beatIntervalId);
        state.beatIntervalId = null;
        if (ui.elements.fourCountContainer) {
            ui.elements.fourCountContainer.querySelectorAll('.beat-box').forEach(box => {
                box.classList.remove('active');
            });
            // Remove light effect
            ui.elements.fourCountContainer.classList.remove('has-light');
        }
        // console.log("Beat animation stopped.");
    }
    state.currentBeat = -1; // Reset beat counter
}

// --- Beat Grid Structure ---
// Updates the beat grid structure and restarts animation if needed
export function updateGrid() {
    ui.rebuildBeatGrid(state.beatGridRows, state.beatGridCols);
    storage.saveSettings();
    if (state.bpm > 0) {
        startBeatAnimation();
    } else {
        stopBeatAnimation();
    }
}

// Updates the number of rows in the beat grid
export function updateRowCount(delta) {
    const newRows = state.beatGridRows + delta;
    if (newRows >= 1 && newRows <= 8) {
        state.beatGridRows = newRows;
        updateGrid();
    }
}
// Updates the number of columns in the beat grid
export function updateColumnCount(delta) {
    const newCols = state.beatGridCols + delta;
    if (newCols >= 1 && newCols <= 16) { // Max 16 cols
        state.beatGridCols = newCols;
        updateGrid();
    }
}

// --- Multiplier ---
// Sets the BPM multiplier for beat grid animation (0.5x, 2x, triplet, or 1x)
export function setMultiplier(newMultiplierValue) {
    let clickedMultiplier = newMultiplierValue;
    
    // Handle numeric values
    if (newMultiplierValue !== 'triplet') {
        clickedMultiplier = parseFloat(newMultiplierValue);
        if (isNaN(clickedMultiplier) || (clickedMultiplier !== 0.5 && clickedMultiplier !== 2)) {
            console.warn("Invalid multiplier value passed from button:", newMultiplierValue);
            return;
        }
    }

    let finalMultiplierToSet;

    if (state.bpmMultiplier === clickedMultiplier) {
        finalMultiplierToSet = 1; // Toggle OFF, revert to 1x
        console.log(`BPM Multiplier toggled OFF (reverted to 1x).`);
    } else {
        finalMultiplierToSet = clickedMultiplier; // Set to 0.5x, 2x, or triplet
        console.log(`BPM Multiplier set to: ${finalMultiplierToSet}`);
    }

    if (state.bpmMultiplier !== finalMultiplierToSet) {
        state.bpmMultiplier = finalMultiplierToSet;

        document.querySelectorAll('.multiplier-btn').forEach(btn => {
            const btnMultiplierValue = btn.dataset.multiplier;
            btn.classList.toggle('selected', btnMultiplierValue === state.bpmMultiplier.toString() && state.bpmMultiplier !== 1);
        });

        // Update triplet mode class and animation duration
        if (ui.elements.fourCountContainer) {
            if (state.bpmMultiplier === 'triplet') {
                ui.elements.fourCountContainer.classList.add('triplet-mode');
                // Set animation duration to 1/3 of the beat interval
                const baseIntervalMs = (60 / state.bpm) * 1000;
                const tripletDuration = (baseIntervalMs / 3) / 1000; // Convert to seconds
                ui.elements.fourCountContainer.style.setProperty('--triplet-duration', `${tripletDuration}s`);
                // Set initial triplet position to center
                ui.elements.fourCountContainer.style.setProperty('--triplet-x', '50%');
                ui.elements.fourCountContainer.style.setProperty('--triplet-y', '50%');
            } else {
                ui.elements.fourCountContainer.classList.remove('triplet-mode');
            }
        }

        storage.saveSettings();

        // Restart animation to apply new multiplier
        if (state.bpm > 0) {
            startBeatAnimation();
        }
    }
}

// --- Beat Grid Resync ---
// Resyncs the beat grid animation to start from the current moment
export function resyncAnimation() {
    if (state.bpm <= 0) return;
    
    // Stop the current animation immediately
    stopBeatAnimation();
    
    // Clear all boxes first
    if (ui.elements.fourCountContainer) {
        const boxes = ui.elements.fourCountContainer.querySelectorAll('.beat-box');
        boxes.forEach(box => {
            box.classList.remove('active', 'flashing-border');
            box.style.animationDuration = '';
        });
    }
    
    // Calculate timing based on current BPM
    const totalBoxes = state.beatGridRows * state.beatGridCols;
    const baseIntervalMs = (60 / state.bpm) * 1000;
    
    if (totalBoxes <= 0 || !isFinite(baseIntervalMs) || baseIntervalMs <= 0) return;
    
    // Immediately light up the first box for instant feedback
    if (ui.elements.fourCountContainer) {
        const boxes = ui.elements.fourCountContainer.querySelectorAll('.beat-box');
        if (boxes.length > 0) {
            // Immediately activate the first box
            boxes[0].classList.add('active');
            
            // Position light at first box
            const rect = boxes[0].getBoundingClientRect();
            const containerRect = ui.elements.fourCountContainer.getBoundingClientRect();
            const relativeX = ((rect.left + rect.width / 2) - containerRect.left) / containerRect.width * 100;
            const relativeY = ((rect.top + rect.height / 2) - containerRect.top) / containerRect.height * 100;
            
            ui.elements.fourCountContainer.style.setProperty('--light-x', `${relativeX}%`);
            ui.elements.fourCountContainer.style.setProperty('--light-y', `${relativeY}%`);
            ui.elements.fourCountContainer.classList.add('has-light');
        }
    }
    
    // Set current beat to 0 (first box) since we just activated it
    state.currentBeat = 0;
    
    // Start the interval immediately, but schedule the next beat based on the BPM interval
    // This ensures the rhythm starts from the click moment
    state.beatIntervalId = setInterval(() => {
        if (state.bpm <= 0) { stopBeatAnimation(); return; }
        state.currentBeat = (state.currentBeat + 1) % totalBoxes;
        
        // Update visuals for the new beat
        if (ui.elements.fourCountContainer) {
            const boxes = ui.elements.fourCountContainer.querySelectorAll('.beat-box');
            if (boxes.length === totalBoxes) {
                // Update light position
                if (state.currentBeat >= 0 && state.currentBeat < boxes.length) {
                    const activeBox = boxes[state.currentBeat];
                    const rect = activeBox.getBoundingClientRect();
                    const containerRect = ui.elements.fourCountContainer.getBoundingClientRect();
                    
                    const relativeX = ((rect.left + rect.width / 2) - containerRect.left) / containerRect.width * 100;
                    const relativeY = ((rect.top + rect.height / 2) - containerRect.top) / containerRect.height * 100;
                    
                    ui.elements.fourCountContainer.style.setProperty('--light-x', `${relativeX}%`);
                    ui.elements.fourCountContainer.style.setProperty('--light-y', `${relativeY}%`);
                    ui.elements.fourCountContainer.classList.add('has-light');
                }
                
                // Update box states
                boxes.forEach((box, index) => {
                    const shouldBeActive = (index === state.currentBeat);
                    if (shouldBeActive) {
                        if (!box.classList.contains('active')) {
                            box.classList.add('active');
                        }
                    } else {
                        if (box.classList.contains('active')) {
                            box.classList.remove('active');
                        }
                    }
                });
            }
        }
    }, baseIntervalMs);
    
    console.log('Beat grid resynced to current moment - rhythm starts now');
}

// --- Word Display Buzz Effect ---
// Starts the word display buzz effect when BPM is locked
function startWordDisplayShake() {
    if (!state.isBpmLockedShaking && state.bpm > 0) {
        ui.startWordBuzz();
        state.isBpmLockedShaking = true;
    }
}

// Stops the word display buzz effect
function stopWordDisplayShake() {
    if (state.isBpmLockedShaking) {
        ui.stopWordBuzz();
        state.isBpmLockedShaking = false;
    }
}