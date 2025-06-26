// js/autoBpm.js
// Handles automatic BPM detection using Web Audio API AnalyserNode.

import * as ui from './ui.js'; // For feedback messages

// --- Configuration ---
const ANALYSIS_DURATION_S = 5;
const MIN_BPM = 60;
const MAX_BPM = 200;          // <<<=== PUT BACK TO 200 (or maybe 180)
const PEAK_THRESHOLD_RATIO = 0.85; // <<<=== INCREASED SENSITIVITY THRESHOLD
// Force more time between detected peaks - try a value targeting ~180 BPM max detection
const MIN_PEAK_INTERVAL_MS = 333; // ms for 180 BPM <<<=== SET A FIXED MIN INTERVAL
//const MIN_PEAK_INTERVAL_MS = (60 / MAX_BPM) * 1000 * 0.9; // Remove or comment out the old calculation
const MAX_PEAK_INTERVAL_MS = (60 / MIN_BPM) * 1000 * 1.2;
const ENERGY_BAND_HZ = { min: 60, max: 140 };
const HISTORY_SIZE = 128;
const MIN_ENERGY_THRESHOLD = 5; // Keep this to avoid silence triggers

// --- State Variables ---
let audioContext = null;
let analyser = null;
let mediaStreamSource = null;
let microphoneStream = null;
let animationFrameId = null;
let detectionTimeout = null;

let energyHistory = new Array(HISTORY_SIZE).fill(0);
let historyIndex = 0;
let detectedPeakTimes = [];
let lastPeakTime = 0;


// --- Main Detection Function ---
export function startDetection(durationSeconds = ANALYSIS_DURATION_S) {
    return new Promise(async (resolve, reject) => {
        if (audioContext && audioContext.state === 'running') {
            console.warn("Detection already in progress or context not closed properly.");
            await stopAudioProcessing(); // Attempt cleanup first
        }

        console.log(`Starting BPM detection for ${durationSeconds} seconds...`);
        ui.showFeedback(`Listening for rhythm (${durationSeconds}s)...`, false, durationSeconds * 1000 + 1000);
        resetDetectionState();

        try {
            // 1. Get Microphone Access & Setup Audio Context
            microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            mediaStreamSource = audioContext.createMediaStreamSource(microphoneStream);

            // 2. Setup AnalyserNode
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
            const bufferLength = analyser.frequencyBinCount;
            const frequencyData = new Uint8Array(bufferLength);

            // Connect source to analyser
            mediaStreamSource.connect(analyser);

            // 3. Start Analysis Loop
            lastPeakTime = performance.now();
            const analyse = (currentTime) => {
                animationFrameId = requestAnimationFrame(analyse);
                analyser.getByteFrequencyData(frequencyData);
                const bandEnergy = calculateBandEnergy(frequencyData, ENERGY_BAND_HZ, audioContext.sampleRate);

                if (isPeak(bandEnergy, currentTime)) {
                    detectedPeakTimes.push(currentTime);
                    // console.log(`Peak detected at ${currentTime.toFixed(0)}ms, Energy: ${bandEnergy.toFixed(2)}`); // Optional debug
                }

                energyHistory[historyIndex] = bandEnergy;
                historyIndex = (historyIndex + 1) % HISTORY_SIZE;
            };
            animationFrameId = requestAnimationFrame(analyse); // Start loop

            // 4. Set Timeout to Stop Detection
            clearTimeout(detectionTimeout);
            detectionTimeout = setTimeout(async () => {
                console.log("Detection duration reached. Analyzing results...");
                const bpmResult = analyseIntervalsAndGetBpm(); // This now uses the wider MAX_BPM for validation
                await stopAudioProcessing();
                if (bpmResult) {
                    // Confidence is hardcoded as 1.0 for this simple method
                    resolve({ bpm: Math.round(bpmResult), confidence: 1.0 });
                } else {
                    ui.showFeedback("Could not determine BPM.", true);
                    reject(new Error("Could not determine BPM."));
                }
            }, durationSeconds * 1000);

        } catch (err) {
            console.error("Error during BPM detection setup:", err);
            ui.showFeedback(`Error starting detection: ${err.message}`, true);
            await stopAudioProcessing();
            reject(err);
        }
    });
}

// --- Helper Functions ---

function resetDetectionState() {
    energyHistory.fill(0);
    historyIndex = 0;
    detectedPeakTimes = [];
    lastPeakTime = 0;
}

function calculateBandEnergy(frequencyData, bandHz, sampleRate) {
    const nyquist = sampleRate / 2;
    const bufferLength = frequencyData.length;
    let totalEnergy = 0;
    let count = 0;
    const freqResolution = nyquist / bufferLength; // Hz per bin

    for (let i = 0; i < bufferLength; i++) {
        const freq = i * freqResolution;
        if (freq >= bandHz.min && freq <= bandHz.max) {
            // frequencyData[i] is 0-255. Use it directly or scale? Direct is simpler.
            totalEnergy += frequencyData[i];
            count++;
        }
        // Optimization: break loop if we pass the max frequency band
        if (freq > bandHz.max) break;
    }
    return count > 0 ? totalEnergy / count : 0; // Average energy in the band
}

function isPeak(currentEnergy, currentTime) {
    const avgEnergy = energyHistory.reduce((sum, val) => sum + val, 0) / HISTORY_SIZE;
    const threshold = avgEnergy * PEAK_THRESHOLD_RATIO;
    const timeSinceLastPeak = currentTime - lastPeakTime;

    // Add a small base threshold to avoid triggers during silence
    const MIN_ENERGY_THRESHOLD = 5; // Adjust if needed

    if (currentEnergy > threshold && currentEnergy > (avgEnergy + 2) && currentEnergy > MIN_ENERGY_THRESHOLD && timeSinceLastPeak > MIN_PEAK_INTERVAL_MS) {
         lastPeakTime = currentTime;
         return true;
    }
    return false;
}

function analyseIntervalsAndGetBpm() {
    if (detectedPeakTimes.length < 4) {
        console.log("Not enough peaks detected to estimate BPM.");
        return null;
    }

    const intervals = [];
    for (let i = 1; i < detectedPeakTimes.length; i++) {
        const interval = detectedPeakTimes[i] - detectedPeakTimes[i - 1];
        // Filter based on MIN/MAX intervals (which depend on MIN/MAX_BPM)
        if (interval >= MIN_PEAK_INTERVAL_MS && interval <= MAX_PEAK_INTERVAL_MS) {
             intervals.push(interval);
        }
    }

    if (intervals.length < 3) {
         console.log("Not enough valid intervals detected.");
         return null;
    }

    console.log("Valid intervals (ms):", intervals.map(ms => ms.toFixed(1)));

    // --- Median Interval Calculation ---
    intervals.sort((a, b) => a - b);
    const medianInterval = intervals[Math.floor(intervals.length / 2)];

    if (!medianInterval || medianInterval <= 0) {
        console.log("Could not determine median interval.");
        return null;
    }

    const estimatedBpm = 60000 / medianInterval;
    console.log(`Median Interval: ${medianInterval.toFixed(1)}ms -> Estimated BPM: ${estimatedBpm.toFixed(1)}`);

    // Final check if BPM is within reasonable range (uses updated MAX_BPM)
    if (estimatedBpm >= MIN_BPM && estimatedBpm <= MAX_BPM) {
         return estimatedBpm;
    } else {
        console.log("Estimated BPM outside reasonable range.", { bpm: estimatedBpm, min: MIN_BPM, max: MAX_BPM });
        return null; // Return null if outside the NOW WIDER range
    }
}


async function stopAudioProcessing() {
    console.log("Stopping audio stream and analysis...");
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    clearTimeout(detectionTimeout);
    animationFrameId = null;
    detectionTimeout = null;

    if (analyser) analyser.disconnect();
    if (mediaStreamSource) mediaStreamSource.disconnect();
    microphoneStream?.getTracks().forEach(track => track.stop());

    analyser = null;
    mediaStreamSource = null;
    microphoneStream = null;

    if (audioContext && audioContext.state !== 'closed') {
        try { await audioContext.close(); console.log("AudioContext closed."); }
        catch (e) { console.error("Error closing AudioContext:", e); }
    }
    audioContext = null;
    resetDetectionState();
}