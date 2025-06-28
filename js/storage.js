// js/storage.js
// Handles saving and loading settings to/from LocalStorage.

import { state } from './state.js';
import * as ui from './ui.js';
import { updateGrid } from './bpm.js'; // For updating grid visuals after load/reset

const STORAGE_KEY = 'freestyleArenaSettings_v5';

// --- Serialization Helpers for Sets within Objects ---
function serializeNestedSets(objWithSets) {
    const serialized = {};
    for (const key in objWithSets) {
        if (objWithSets[key] instanceof Set) {
            serialized[key] = Array.from(objWithSets[key]);
        } else {
            serialized[key] = objWithSets[key];
            // console.warn(`Serializing non-Set value within nested object: ${key}`);
        }
    }
    return serialized;
}

function deserializeNestedSets(serializedObj) {
    const deserialized = {};
    for (const key in serializedObj) {
        if (Array.isArray(serializedObj[key])) {
             deserialized[key] = new Set(serializedObj[key]);
        } else {
             console.warn(`Expected array for nested set ${key}, got:`, serializedObj[key]);
             deserialized[key] = new Set(); // Default to empty Set on error
        }
    }
    return deserialized;
}

// --- Main Save Function ---
export function saveSettings() {
    try {
        const settingsToSave = {
            beatGridRows: state.beatGridRows,
            beatGridCols: state.beatGridCols,
            bpm: state.bpm,
            bpmMultiplier: state.bpmMultiplier,
            wordOrderMode: state.wordOrderMode,
            cycleSpeed: state.cycleSpeed,
            minSyllables: state.minSyllables,
            maxSyllables: state.maxSyllables,
            wordFrequencies: state.wordFrequencies,
            blacklist: Array.from(state.blacklist),
            favorites: Array.from(state.favorites),
            rejectedRhymes: serializeNestedSets(state.rejectedRhymes),
            manualRhymes: serializeNestedSets(state.manualRhymes),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsToSave));
        // console.log('Settings saved.');
    } catch (e) {
        console.error("Error saving settings:", e);
        ui.showFeedback("Error saving settings!", true);
    }
}

// --- Main Load Function ---
export function loadSettings() {
    console.log(`Attempting to load settings from key: ${STORAGE_KEY}`);
    try {
        const savedSettings = localStorage.getItem(STORAGE_KEY);
        if (savedSettings) {
             const parsedData = JSON.parse(savedSettings);

             state.beatGridRows = parsedData.beatGridRows ?? 1;
             state.beatGridCols = parsedData.beatGridCols ?? 4;
             state.bpm = parsedData.bpm ?? 0;
             state.bpmMultiplier = parsedData.bpmMultiplier ?? 1; // Default multiplier is 1x
             state.wordOrderMode = parsedData.wordOrderMode || 'random';
             state.cycleSpeed = parsedData.cycleSpeed ?? 10;
             state.minSyllables = parsedData.minSyllables ?? 0;
             state.maxSyllables = parsedData.maxSyllables ?? 0;
             state.wordFrequencies = parsedData.wordFrequencies || {};
             state.blacklist = Array.isArray(parsedData.blacklist) ? new Set(parsedData.blacklist) : new Set();
             state.favorites = Array.isArray(parsedData.favorites) ? new Set(parsedData.favorites) : new Set();
             state.rejectedRhymes = parsedData.rejectedRhymes ? deserializeNestedSets(parsedData.rejectedRhymes) : {};
             state.manualRhymes = parsedData.manualRhymes ? deserializeNestedSets(parsedData.manualRhymes) : {};

             console.log('Settings loaded successfully.');
             applyLoadedSettingsToUI();

         } else {
             console.log('No saved settings found, using defaults.');
             resetToDefaults(false); // Apply defaults but don't re-save immediately
         }
    } catch (error) {
         console.error('Failed to load or parse settings:', error);
         localStorage.removeItem(STORAGE_KEY);
         resetToDefaults(false);
         ui.showFeedback("Failed to load settings, reset to defaults.", true, 4000);
    }
}

// --- Helper to Update UI based on Loaded/Reset State ---
function applyLoadedSettingsToUI() {
    ui.updateActivationUI();
    ui.updateBpmIndicator(state.bpm);
    updateGrid(); // Rebuild beat grid (this is imported from bpm.js)
    ui.displayFrequencies(state.wordFrequencies);

    // Update multiplier button visuals
    document.querySelectorAll('.multiplier-btn').forEach(btn => {
        const btnMultiplierValue = parseInt(btn.dataset.multiplier);
        // A button is selected if its value matches state.bpmMultiplier, AND state.bpmMultiplier is NOT 1.
        btn.classList.toggle('selected', btnMultiplierValue === state.bpmMultiplier && state.bpmMultiplier !== 1);
    });
}

// --- Reset Function ---
export function resetToDefaults(saveAfterReset = true) {
    console.log("Resetting settings to defaults.");
    state.blacklist = new Set();
    state.favorites = new Set();
    state.wordFrequencies = {};
    state.beatGridRows = 1;
    state.beatGridCols = 4;
    state.bpm = 0;
    state.bpmMultiplier = 1; // Default multiplier is 1x (no button selected)
    state.wordOrderMode = 'random';
    state.cycleSpeed = 10;
    state.minSyllables = 0;
    state.maxSyllables = 0;
    state.activationMode = 'manual';
    state.rejectedRhymes = {};
    state.manualRhymes = {};

    applyLoadedSettingsToUI();

    if (state.beatIntervalId) { clearInterval(state.beatIntervalId); state.beatIntervalId = null; }
    if (state.isBpmLockedShaking) { ui.stopWordBuzz(); state.isBpmLockedShaking = false; }
    if (state.timedInterval) { clearInterval(state.timedInterval); state.timedInterval = null; }
    ui.updateWordDisplayAnimation();

    if (saveAfterReset) {
        saveSettings();
        console.log("Defaults applied and saved.");
    } else {
        console.log("Defaults applied.");
    }
}