/**
 * @fileoverview Audio Visualizer Module
 * 
 * This module handles real-time microphone input visualization using the Web Audio API.
 * It creates a simple horizontal bar that grows and shrinks based on the current volume
 * of the microphone input.
 * 
 * Key responsibilities:
 * - Setting up Web Audio API components (AudioContext, MediaStreamSource, AnalyserNode)
 * - Processing audio data to calculate volume levels
 * - Drawing the visualizer on a canvas element
 * - Managing the animation loop with requestAnimationFrame
 * 
 * Dependencies: None (standalone module)
 */

// Audio context and nodes
let audioContext = null;
let analyser = null;
let source = null;
let canvas = null;
let ctx = null;
let canvasLeft = null;
let ctxLeft = null;
let animationId = null;
let isActive = false;
let volumeHistory = []; // Track recent volume levels for adaptive sensitivity
const HISTORY_SIZE = 30; // Number of frames to track

// Configuration object for easy sensitivity adjustment
const config = {
    baseSensitivity: 3.0,      // Base sensitivity multiplier
    powerCurve: 0.6,           // Power curve for volume response (0.5-1.0)
    adaptiveSensitivity: true, // Enable adaptive sensitivity
    smoothingTimeConstant: 0.6 // Analyser smoothing (0.0-1.0)
};

/**
 * Initialize the audio visualizer with a microphone stream
 * @param {MediaStream} stream - The microphone stream from getUserMedia
 */
export async function initAudioVisualizer(stream) {
    try {
        // Get canvas elements
        canvas = document.getElementById('mic-visualizer-canvas');
        if (!canvas) {
            console.error('Mic visualizer canvas not found');
            return false;
        }
        ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error('Could not get 2D context for mic visualizer canvas');
            return false;
        }
        canvasLeft = document.getElementById('mic-visualizer-canvas-left');
        ctxLeft = canvasLeft ? canvasLeft.getContext('2d') : null;

        // Create audio context
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Resume context if suspended (required by some browsers)
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
        
        // Create media stream source
        source = audioContext.createMediaStreamSource(stream);
        
        // Create analyser node
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = config.smoothingTimeConstant;
        
        // Connect the audio nodes
        source.connect(analyser);
        
        // Start the visualization
        isActive = true;
        draw();
        
        // Add visual indicator that visualizer is active
        for (const c of [canvas, canvasLeft]) {
            if (c) {
                c.style.borderColor = '#00ffff';
                c.style.boxShadow = '0 0 10px rgba(0, 255, 255, 0.5)';
            }
        }
        
        console.log('Audio visualizer initialized successfully');
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
    
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    
    if (source) {
        source.disconnect();
        source = null;
    }

    if (analyser) {
        analyser.disconnect();
        analyser = null;
    }

    if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
        audioContext = null;
    }

    // Clear canvases and remove visual indicators
    for (const [c, cx] of [[canvas, ctx], [canvasLeft, ctxLeft]]) {
        if (cx && c) cx.clearRect(0, 0, c.width, c.height);
        if (c) { c.style.borderColor = ''; c.style.boxShadow = ''; }
    }
    
    // Reset volume history
    volumeHistory = [];
    
    console.log('Audio visualizer stopped');
}

/**
 * Main drawing function that runs in a loop
 */
function draw() {
    if (!isActive || !analyser || !ctx || !canvas) {
        return;
    }
    
    try {
        // Get frequency data
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
        }
        const average = sum / bufferLength;
        
        // Track volume history for adaptive sensitivity
        volumeHistory.push(average);
        if (volumeHistory.length > HISTORY_SIZE) {
            volumeHistory.shift();
        }
        
        // Calculate adaptive sensitivity based on recent volume levels
        const maxRecentVolume = Math.max(...volumeHistory);
        const avgRecentVolume = volumeHistory.reduce((sum, vol) => sum + vol, 0) / volumeHistory.length;
        
        // Adaptive sensitivity: more sensitive when volumes are generally low
        let sensitivityBoost = config.baseSensitivity;
        if (config.adaptiveSensitivity) {
            if (maxRecentVolume < 50) {
                sensitivityBoost = config.baseSensitivity * 1.7; // Very sensitive for quiet microphones
            } else if (maxRecentVolume < 100) {
                sensitivityBoost = config.baseSensitivity * 1.3; // Moderately sensitive
            } else if (maxRecentVolume < 150) {
                sensitivityBoost = config.baseSensitivity; // Normal sensitivity
            } else {
                sensitivityBoost = config.baseSensitivity * 0.7; // Less sensitive for loud microphones
            }
        }
        
        // Apply sensitivity boost and normalization
        let normalizedVolume = (average / 255) * sensitivityBoost;
        normalizedVolume = Math.pow(normalizedVolume, config.powerCurve);
        
        // Clamp to 0-1 range
        normalizedVolume = Math.max(0, Math.min(1, normalizedVolume));
        
        // Clear and draw on both canvases
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawVolumeBar(ctx, canvas, normalizedVolume);
        if (ctxLeft && canvasLeft) {
            ctxLeft.clearRect(0, 0, canvasLeft.width, canvasLeft.height);
            drawVolumeBar(ctxLeft, canvasLeft, normalizedVolume);
        }
        
        // Continue the animation loop
        animationId = requestAnimationFrame(draw);
    } catch (error) {
        console.error('Error in audio visualizer draw loop:', error);
        // Stop the visualizer if there's an error
        isActive = false;
        for (const c of [canvas, canvasLeft]) {
            if (c) { c.style.borderColor = ''; c.style.boxShadow = ''; }
        }
    }
}

/**
 * Draw a vertical volume bar on a canvas (fills bottom-to-top)
 * @param {CanvasRenderingContext2D} cx - 2D context to draw on
 * @param {HTMLCanvasElement} cv - Canvas element
 * @param {number} volume - Normalized volume (0-1)
 */
function drawVolumeBar(cx, cv, volume) {
    if (!cx || !cv) return;
    const ctx = cx;
    const canvas = cv;

    const w = canvas.width;
    const h = canvas.height;
    const barHeight = h * volume;

    // Gradient: green at bottom, yellow in mid, red at top
    const gradient = ctx.createLinearGradient(0, h, 0, 0);
    gradient.addColorStop(0,    '#33ff33');
    gradient.addColorStop(0.75, '#33ff33');
    gradient.addColorStop(0.88, '#ffff00');
    gradient.addColorStop(1,    '#ff2222');

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, w, h);

    // Volume bar (fills from bottom)
    ctx.fillStyle = gradient;
    ctx.fillRect(0, h - barHeight, w, barHeight);

    // Glow — color matches bar level
    const glowColor = volume > 0.88 ? '#ff2222' : '#33ff33';
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 6;
    ctx.fillRect(0, h - barHeight, w, barHeight);
    ctx.shadowBlur = 0;
}

/**
 * Check if the visualizer is currently active
 * @returns {boolean} True if the visualizer is running
 */
export function isVisualizerActive() {
    return isActive;
}

/**
 * Get the current audio context (for debugging/testing)
 * @returns {AudioContext|null} The audio context or null if not initialized
 */
export function getAudioContext() {
    return audioContext;
}

/**
 * Update visualizer configuration
 * @param {Object} newConfig - Configuration object with any of: baseSensitivity, powerCurve, adaptiveSensitivity, smoothingTimeConstant
 */
export function updateConfig(newConfig) {
    Object.assign(config, newConfig);
    console.log('Audio visualizer config updated:', config);
}

/**
 * Get current configuration
 * @returns {Object} Current configuration object
 */
export function getConfig() {
    return { ...config };
}
