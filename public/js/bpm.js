/**
 * @fileoverview BPM (Beats Per Minute) Detection, Control, and Ball Animation
 *
 * Two opposing horizontal balls: ball-x from the left, ball-r from the right,
 * each on its own lane (vertical stagger). Axis multiplier inputs control each
 * ball's speed independently. Dev toolbar sliders control visual parameters.
 *
 * Dependencies: state.js, ui.js, storage.js, anime.esm.min.js
 */

import { state } from './state.js';
import * as ui from './ui.js';
import { updateBpmIndicator } from './ui-helpers.js';
import * as storage from './storage.js';
import { animate, utils } from './anime.esm.min.js';

// --- Ball animation state ---
const BASE_BPM = 120;
const BASE_DURATION = 60000 / BASE_BPM; // 500ms per half-cycle at base BPM
let ballAnimX = null;
let ballAnimR = null;

// --- Dev visual settings (not persisted) ---
let devWallGap = 4;    // px from each wall at the bounce point
let devStagger = 20;   // vertical distance (px) between the two ball centers
let devSwing = 0;      // 0 = linear … 10 = heavy easeInOutBack
let devGlow = 10;      // box-shadow blur radius in px

function getEasing() {
    if (devSwing < 2)  return 'linear';
    if (devSwing < 5)  return 'easeInOutSine';
    if (devSwing < 8)  return 'easeInOutCubic';
    return 'easeInOutBack';
}

function applyLanePositions() {
    const xEl = document.getElementById('bpm-ball-x');
    const rEl = document.getElementById('bpm-ball-r');
    const container = document.getElementById('bpm-cross-container');
    if (!xEl || !rEl || !container) return;
    const cy = container.clientHeight / 2;
    const half = devStagger / 2;
    xEl.style.top = `${cy - half - 14}px`;
    rEl.style.top = `${cy + half - 14}px`;
}

function applyGlow() {
    const r = devGlow;
    const shadow = r > 0
        ? `0 0 ${r}px var(--primary-accent), 0 0 ${r * 2}px var(--primary-accent)`
        : 'none';
    ['bpm-ball-x', 'bpm-ball-r'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.boxShadow = shadow;
    });
}

// Returns the playback speed for a given axis multiplier
function getAxisSpeed(multiplier) {
    if (state.bpm <= 0) return 0;
    return (state.bpm / BASE_BPM) * multiplier;
}

// Starts both ball animations or updates their speeds if already running
function startBeatAnimation() {
    if (state.bpm <= 0) return;

    const xEl = document.getElementById('bpm-ball-x');
    const rEl = document.getElementById('bpm-ball-r');
    const container = document.getElementById('bpm-cross-container');
    if (!xEl || !rEl || !container) return;

    const w = container.clientWidth;
    const ballSize = 28;
    const startX = devWallGap;
    const endX = w - ballSize - devWallGap;
    const easing = getEasing();

    applyLanePositions();
    applyGlow();

    if (ballAnimX) {
        utils.sync(() => { ballAnimX.speed = getAxisSpeed(state.xMultiplier); });
    } else {
        ballAnimX = animate(xEl, {
            x: [startX, endX],
            loop: true,
            alternate: true,
            duration: BASE_DURATION,
            playbackRate: getAxisSpeed(state.xMultiplier),
            easing,
        });
        xEl.classList.add('active');
    }

    if (ballAnimR) {
        utils.sync(() => { ballAnimR.speed = getAxisSpeed(state.yMultiplier); });
    } else {
        // Starts at right wall, bounces toward left — opposing ball-x
        ballAnimR = animate(rEl, {
            x: [endX, startX],
            loop: true,
            alternate: true,
            duration: BASE_DURATION,
            playbackRate: getAxisSpeed(state.yMultiplier),
            easing,
        });
        rEl.classList.add('active');
    }

    state.beatIntervalId = true;
}

// Pauses and destroys both ball animations
function stopBeatAnimation() {
    [ballAnimX, ballAnimR].forEach(anim => { if (anim) anim.pause(); });
    ballAnimX = null;
    ballAnimR = null;

    ['bpm-ball-x', 'bpm-ball-r'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('active');
            animate(el, { x: 0, duration: 200, easing: 'easeOutSine' });
        }
    });

    state.beatIntervalId = null;
    state.currentBeat = -1;
}

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
    if (reasonableIntervals.length < Math.min(2, intervals.length)) return;
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

// --- Set BPM Directly (used by auto-detection) ---
export function setBpm(newBpmValue) {
    newBpmValue = Math.round(newBpmValue);
    if (isNaN(newBpmValue) || newBpmValue < 0) {
        console.error(`Invalid BPM value passed to setBpm: ${newBpmValue}`); return;
    }
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
}

// --- Per-axis Multipliers ---
export function setXMultiplier(value) {
    state.xMultiplier = Math.max(0.25, parseFloat(value) || 1);
    storage.saveSettings();
    if (ballAnimX) {
        utils.sync(() => { ballAnimX.speed = getAxisSpeed(state.xMultiplier); });
    } else if (state.bpm > 0) {
        startBeatAnimation();
    }
}

export function setYMultiplier(value) {
    state.yMultiplier = Math.max(0.25, parseFloat(value) || 1);
    storage.saveSettings();
    if (ballAnimR) {
        utils.sync(() => { ballAnimR.speed = getAxisSpeed(state.yMultiplier); });
    } else if (state.bpm > 0) {
        startBeatAnimation();
    }
}

// --- Resync ---
// Kills both animations, snaps balls to start positions, restarts fresh
export function resyncAnimation() {
    if (state.bpm <= 0) return;
    [ballAnimX, ballAnimR].forEach(anim => { if (anim) anim.pause(); });
    ballAnimX = null;
    ballAnimR = null;
    // Clear inline transforms immediately — no RAF delay
    ['bpm-ball-x', 'bpm-ball-r'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.transform = '';
    });
    startBeatAnimation();
}

// --- Dev Settings ---
// Called from main.js dev slider listeners; restarts animation when needed
export function setDevSetting(key, value) {
    if (key === 'wallGap') {
        devWallGap = Math.max(0, parseInt(value, 10));
        resyncAnimation();
    } else if (key === 'stagger') {
        devStagger = Math.max(0, parseInt(value, 10));
        applyLanePositions();
    } else if (key === 'swing') {
        devSwing = parseFloat(value);
        resyncAnimation();
    } else if (key === 'glow') {
        devGlow = parseInt(value, 10);
        applyGlow();
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
