/**
 * @fileoverview Random Number Generator Logic for UI
 *
 * This module provides logic for generating random numbers for the BaseFlowArena UI.
 * It supports user-configurable digit and set counts, a "surprise" mode for randomizing
 * those parameters, and updates the UI with animated results.
 *
 * Key responsibilities:
 * - Generate random numbers with a specified number of digits and sets
 * - Support a "surprise" mode for randomizing parameters
 * - Validate and synchronize state and UI for RNG controls
 * - Display results in the UI with animation
 *
 * Dependencies: state.js, ui.js
 */

// js/rng.js
// Handles the Random Number Generator logic.

import { state } from './state.js';
import * as ui from './ui.js';

/**
 * Generates random numbers based on user input or surprise mode, and updates the UI.
 */
export function generate() {
    if (!ui.elements.rngDigitsInput || !ui.elements.rngSetsInput) return;

    // Read current values or use state defaults
    state.rngDigits = parseInt(ui.elements.rngDigitsInput.value, 10) || state.rngDigits;
    state.rngSets = parseInt(ui.elements.rngSetsInput.value, 10) || state.rngSets;
    state.rngSurprise = ui.elements.rngSurpriseCheckbox?.checked || false;

    let targetDigits = state.rngDigits;
    let targetSets = state.rngSets;

    if (state.rngSurprise) {
        // Surprise mode: randomize digits (1-7) and sets (1-5)
        targetDigits = Math.floor(Math.random() * 7) + 1; // 1 to 7 digits
        targetSets = Math.floor(Math.random() * 5) + 1;   // 1 to 5 sets
        console.log(`Surprise! Generating ${targetSets} set(s) of ${targetDigits}-digit numbers.`);
        // Update state and UI to reflect surprise values
        state.rngDigits = targetDigits;
        state.rngSets = targetSets;
        ui.updateRngInputs(targetDigits, targetSets);
    }

    // Validate final values (even after surprise)
    targetDigits = Math.max(1, Math.min(targetDigits, 7));
    targetSets = Math.max(1, Math.min(targetSets, 5));
     // Ensure state and UI match final validated values
    if(state.rngDigits !== targetDigits || state.rngSets !== targetSets) {
        state.rngDigits = targetDigits;
        state.rngSets = targetSets;
        ui.updateRngInputs(targetDigits, targetSets);
    }

    // Generate numbers for each set
    const setsResults = [];
    for (let s = 0; s < targetSets; s++) {
        const min = (targetDigits === 1) ? 0 : Math.pow(10, targetDigits - 1);
        const max = Math.pow(10, targetDigits) - 1;
        const randomNum = Math.floor(Math.random() * (max - min + 1)) + min;
        const numString = randomNum.toString().padStart(targetDigits, '0');
        setsResults.push(numString);
    }

    // Update the UI with animation
    ui.displayRngResults(setsResults);
}