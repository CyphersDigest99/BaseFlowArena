/**
 * @fileoverview Audio Visualizer Module
 *
 * Segmented VU-style mic level meters using div elements.
 * Two meters (left + right) flank the live feed transcript.
 * Each meter has discrete segments that light up bottom-to-top:
 *   green (bottom) → yellow → red (top)
 *
 * Dependencies: None (standalone module)
 */

const SEGMENT_COUNT = 12;
// Segment zones (index 0 = top, 11 = bottom)
// Top 2 = red, next 2 = yellow, bottom 8 = green
const RED_BELOW   = 2;  // indices 0-1
const YELLOW_BELOW = 4; // indices 2-3

let audioContext = null;
let analyser = null;
let source = null;
let animationId = null;
let isActive = false;
let volumeHistory = [];
const HISTORY_SIZE = 30;

// Segment DOM references (arrays of divs, index 0 = top segment)
let segsLeft = [];
let segsRight = [];

const config = {
    baseSensitivity: 3.0,
    powerCurve: 0.6,
    adaptiveSensitivity: true,
    smoothingTimeConstant: 0.6
};

/** Build segment divs inside a meter container */
function buildSegments(container) {
    if (!container) return [];
    container.innerHTML = '';
    const segs = [];
    for (let i = 0; i < SEGMENT_COUNT; i++) {
        const seg = document.createElement('div');
        seg.className = 'mic-meter-seg';
        container.appendChild(seg);
        segs.push(seg);
    }
    return segs;
}

/** Assign lit/unlit classes to segments for a given volume (0-1) */
function updateSegments(segs, volume) {
    const litCount = Math.round(volume * SEGMENT_COUNT);
    // Segments are top-to-bottom in DOM. Light from bottom up.
    for (let i = 0; i < SEGMENT_COUNT; i++) {
        const seg = segs[i];
        const fromBottom = SEGMENT_COUNT - 1 - i;
        const isLit = fromBottom < litCount;

        // Remove old classes
        seg.classList.remove('lit-green', 'lit-yellow', 'lit-red');

        if (isLit) {
            if (i < RED_BELOW)        seg.classList.add('lit-red');
            else if (i < YELLOW_BELOW) seg.classList.add('lit-yellow');
            else                       seg.classList.add('lit-green');
        }
    }
}

/**
 * Initialize the audio visualizer with a microphone stream
 * @param {MediaStream} stream - The microphone stream from getUserMedia
 */
export async function initAudioVisualizer(stream) {
    try {
        const meterLeft  = document.getElementById('mic-meter-left');
        const meterRight = document.getElementById('mic-meter-right');
        if (!meterLeft && !meterRight) {
            console.error('No mic meter elements found');
            return false;
        }

        segsLeft  = buildSegments(meterLeft);
        segsRight = buildSegments(meterRight);

        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === 'suspended') await audioContext.resume();

        source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = config.smoothingTimeConstant;
        source.connect(analyser);

        isActive = true;
        draw();

        console.log('Audio visualizer initialized (segmented meters)');
        return true;
    } catch (error) {
        console.error('Error initializing audio visualizer:', error);
        return false;
    }
}

/**
 * Stop the audio visualizer and clean up resources
 */
export function stopAudioVisualizer() {
    isActive = false;

    if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
    if (source)  { source.disconnect(); source = null; }
    if (analyser) { analyser.disconnect(); analyser = null; }
    if (audioContext && audioContext.state !== 'closed') { audioContext.close(); audioContext = null; }

    // Clear all segments
    for (const seg of [...segsLeft, ...segsRight]) {
        seg.classList.remove('lit-green', 'lit-yellow', 'lit-red');
    }

    volumeHistory = [];
    console.log('Audio visualizer stopped');
}

/**
 * Main drawing function that runs in a loop
 */
function draw() {
    if (!isActive || !analyser) return;

    try {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
        const average = sum / bufferLength;

        volumeHistory.push(average);
        if (volumeHistory.length > HISTORY_SIZE) volumeHistory.shift();

        const maxRecentVolume = Math.max(...volumeHistory);

        let sensitivityBoost = config.baseSensitivity;
        if (config.adaptiveSensitivity) {
            if (maxRecentVolume < 50)       sensitivityBoost = config.baseSensitivity * 1.7;
            else if (maxRecentVolume < 100)  sensitivityBoost = config.baseSensitivity * 1.3;
            else if (maxRecentVolume < 150)  sensitivityBoost = config.baseSensitivity;
            else                             sensitivityBoost = config.baseSensitivity * 0.7;
        }

        let normalizedVolume = (average / 255) * sensitivityBoost;
        normalizedVolume = Math.pow(normalizedVolume, config.powerCurve);
        normalizedVolume = Math.max(0, Math.min(1, normalizedVolume));

        updateSegments(segsLeft, normalizedVolume);
        updateSegments(segsRight, normalizedVolume);

        animationId = requestAnimationFrame(draw);
    } catch (error) {
        console.error('Error in audio visualizer draw loop:', error);
        isActive = false;
    }
}

export function isVisualizerActive() { return isActive; }
export function getAudioContext() { return audioContext; }
export function updateConfig(newConfig) { Object.assign(config, newConfig); }
export function getConfig() { return { ...config }; }
