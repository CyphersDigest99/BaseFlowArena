// js/autoBpm.js
// Handles automatic BPM detection using Web Audio API AnalyserNode.

import * as ui from './ui.js'; // For feedback messages

// --- Configuration ---
const MIN_DETECTION_TIME_S = 10; // Minimum time to listen
const MAX_DETECTION_TIME_S = 30; // Maximum time to listen
const TARGET_CONFIDENCE = 0.90; // Target confidence level (90%)
const MIN_BPM = 60;
const MAX_BPM = 200;
const PEAK_THRESHOLD_RATIO = 0.85; // More sensitive for better detection
const MIN_PEAK_INTERVAL_MS = 250; // ms for 240 BPM max
const MAX_PEAK_INTERVAL_MS = (60 / MIN_BPM) * 1000 * 1.5;
const ENERGY_BAND_HZ = { min: 50, max: 150 }; // Wider band for better detection
const HISTORY_SIZE = 1024; // Much larger history for better averaging
const MIN_ENERGY_THRESHOLD = 6; // Lower threshold to catch more peaks
const MIN_PEAKS_REQUIRED = 15; // Increased for better accuracy
const MIN_VALID_INTERVALS = 10; // Increased for better accuracy
const CONFIDENCE_THRESHOLD = 0.75; // Minimum confidence to accept result

// --- State Variables ---
let audioContext = null;
let analyser = null;
let mediaStreamSource = null;
let microphoneStream = null;
let animationFrameId = null;
let detectionTimeout = null;
let isDetecting = false;

let energyHistory = new Array(HISTORY_SIZE).fill(0);
let historyIndex = 0;
let detectedPeakTimes = [];
let lastPeakTime = 0;
let detectionStartTime = 0;
let peakStrengths = []; // Track peak strength for confidence calculation
let currentConfidence = 0;
let lastAnalysisTime = 0;

// --- Main Detection Function ---
export function startDetection() {
    return new Promise(async (resolve, reject) => {
        // Prevent multiple simultaneous detections
        if (isDetecting) {
            reject(new Error("Detection already in progress"));
            return;
        }

        isDetecting = true;
        detectionStartTime = performance.now();
        lastAnalysisTime = detectionStartTime;

        console.log(`Starting adaptive BPM detection (target: ${(TARGET_CONFIDENCE * 100).toFixed(0)}% confidence)...`);
        ui.showFeedback(`🎤 Listening for rhythm... (minimum ${MIN_DETECTION_TIME_S}s)`, false, 2000);
        resetDetectionState();

        try {
            // 1. Get Microphone Access
            console.log("Requesting microphone access...");
            microphoneStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: 44100
                } 
            });
            
            // 2. Setup Audio Context
            console.log("Creating AudioContext...");
            audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 44100
            });
            
            // Resume context if suspended (required by some browsers)
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }
            
            mediaStreamSource = audioContext.createMediaStreamSource(microphoneStream);

            // 3. Setup AnalyserNode with better settings
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 4096; // Higher resolution
            analyser.smoothingTimeConstant = 0.7; // Better smoothing
            const bufferLength = analyser.frequencyBinCount;
            const frequencyData = new Uint8Array(bufferLength);

            // Connect source to analyser
            mediaStreamSource.connect(analyser);

            // 4. Start Analysis Loop
            lastPeakTime = performance.now();
            let frameCount = 0;
            let consecutiveLowEnergy = 0;
            
            const analyse = (currentTime) => {
                if (!isDetecting) return; // Stop if detection was cancelled
                
                animationFrameId = requestAnimationFrame(analyse);
                analyser.getByteFrequencyData(frequencyData);
                const bandEnergy = calculateBandEnergy(frequencyData, ENERGY_BAND_HZ, audioContext.sampleRate);

                // Track energy history for better peak detection
                energyHistory[historyIndex] = bandEnergy;
                historyIndex = (historyIndex + 1) % HISTORY_SIZE;

                // Enhanced peak detection with strength tracking
                const peakResult = isEnhancedPeak(bandEnergy, currentTime);
                if (peakResult.isPeak) {
                    detectedPeakTimes.push(currentTime);
                    peakStrengths.push(peakResult.strength);
                    frameCount++;
                    consecutiveLowEnergy = 0;
                    
                    // Show progress feedback
                    if (frameCount % 2 === 0) { // Update every 2nd peak
                        const elapsed = (currentTime - detectionStartTime) / 1000;
                        ui.showFeedback(`🎵 Detected ${detectedPeakTimes.length} beats... (${elapsed.toFixed(1)}s, ${(currentConfidence * 100).toFixed(0)}% confidence)`, false, 1000);
                    }
                } else {
                    consecutiveLowEnergy++;
                }

                // Check for early termination if no energy for too long
                if (consecutiveLowEnergy > 1000) { // ~16 seconds at 60fps
                    console.log("No energy detected for too long, stopping early");
                    isDetecting = false;
                }

                // Periodic confidence check and adaptive stopping
                const elapsed = (currentTime - detectionStartTime) / 1000;
                if (elapsed >= MIN_DETECTION_TIME_S && (currentTime - lastAnalysisTime) > 2000) { // Check every 2 seconds
                    lastAnalysisTime = currentTime;
                    
                    if (detectedPeakTimes.length >= MIN_PEAKS_REQUIRED) {
                        const intervals = calculateValidIntervals();
                        if (intervals.length >= MIN_VALID_INTERVALS) {
                            const bpmResult = calculateBPMFromIntervals(intervals);
                            if (bpmResult && bpmResult.bpm >= MIN_BPM && bpmResult.bpm <= MAX_BPM) {
                                const correctedBpm = correctTempoEnhanced(bpmResult.bpm, intervals);
                                const confidence = calculateAdvancedConfidence(intervals, correctedBpm, peakStrengths);
                                currentConfidence = confidence;
                                
                                console.log(`Progress check: ${correctedBpm.toFixed(1)} BPM, ${(confidence * 100).toFixed(1)}% confidence`);
                                
                                // Stop if we've reached target confidence or max time
                                if (confidence >= TARGET_CONFIDENCE || elapsed >= MAX_DETECTION_TIME_S) {
                                    console.log(`Target reached: ${(confidence * 100).toFixed(1)}% confidence after ${elapsed.toFixed(1)}s`);
                                    isDetecting = false;
                                }
                            }
                        }
                    }
                }
            };
            
            animationFrameId = requestAnimationFrame(analyse);

            // 5. Set Maximum Timeout
            clearTimeout(detectionTimeout);
            detectionTimeout = setTimeout(async () => {
                console.log("Maximum detection time reached. Analyzing final results...");
                const result = await analyzeResults();
                await stopAudioProcessing();
                
                if (result && result.bpm > 0 && result.confidence >= CONFIDENCE_THRESHOLD) {
                    resolve(result);
                } else if (result && result.bpm > 0) {
                    reject(new Error(`Low confidence (${(result.confidence * 100).toFixed(1)}%). Try a more consistent rhythm.`));
                } else {
                    reject(new Error("Could not determine BPM from audio input"));
                }
            }, MAX_DETECTION_TIME_S * 1000);

        } catch (err) {
            console.error("Error during BPM detection setup:", err);
            await stopAudioProcessing();
            
            let errorMessage = "Failed to start BPM detection";
            if (err.name === 'NotAllowedError') {
                errorMessage = "Microphone access denied. Please allow microphone access and try again.";
            } else if (err.name === 'NotFoundError') {
                errorMessage = "No microphone found. Please connect a microphone and try again.";
            } else if (err.name === 'NotSupportedError') {
                errorMessage = "Audio detection not supported in this browser.";
            } else {
                errorMessage = `Detection error: ${err.message}`;
            }
            
            ui.showFeedback(errorMessage, true, 5000);
            reject(err);
        }
    });
}

// --- Stop Detection Function ---
export function stopDetection() {
    if (isDetecting) {
        console.log("Stopping BPM detection...");
        isDetecting = false;
        return stopAudioProcessing();
    }
}

// --- Analyze Results Function ---
async function analyzeResults() {
    console.log(`Analyzing ${detectedPeakTimes.length} detected peaks...`);
    
    if (detectedPeakTimes.length < MIN_PEAKS_REQUIRED) {
        console.log(`Not enough peaks detected (${detectedPeakTimes.length}/${MIN_PEAKS_REQUIRED} required)`);
        ui.showFeedback(`Not enough rhythm detected. Try tapping along to music or speaking rhythmically.`, true, 4000);
        return null;
    }

    const intervals = calculateValidIntervals();
    
    if (intervals.length < MIN_VALID_INTERVALS) {
        console.log(`Not enough valid intervals (${intervals.length}/${MIN_VALID_INTERVALS} required)`);
        ui.showFeedback(`Rhythm too irregular. Try a more consistent beat.`, true, 4000);
        return null;
    }

    const bpmResult = calculateBPMFromIntervals(intervals);
    
    if (bpmResult && bpmResult.bpm >= MIN_BPM && bpmResult.bpm <= MAX_BPM) {
        // Apply enhanced tempo correction to avoid double/half tempo detection
        const correctedBpm = correctTempoEnhanced(bpmResult.bpm, intervals);
        const confidence = calculateAdvancedConfidence(intervals, correctedBpm, peakStrengths);
        
        console.log(`BPM Detection successful: ${correctedBpm} BPM (original: ${bpmResult.bpm}, confidence: ${(confidence * 100).toFixed(1)}%)`);
        
        return {
            bpm: Math.round(correctedBpm),
            confidence: confidence,
            peaksDetected: detectedPeakTimes.length,
            intervalsUsed: intervals.length,
            originalBpm: Math.round(bpmResult.bpm)
        };
    } else {
        console.log("BPM outside reasonable range:", bpmResult);
        ui.showFeedback(`Detected BPM (${bpmResult?.bpm?.toFixed(1) || 'unknown'}) is outside the valid range (${MIN_BPM}-${MAX_BPM} BPM).`, true, 4000);
        return null;
    }
}

// --- Helper Functions ---

function resetDetectionState() {
    energyHistory.fill(0);
    historyIndex = 0;
    detectedPeakTimes = [];
    peakStrengths = [];
    lastPeakTime = 0;
    currentConfidence = 0;
}

function calculateBandEnergy(frequencyData, bandHz, sampleRate) {
    const binSize = sampleRate / (frequencyData.length * 2);
    const startBin = Math.floor(bandHz.min / binSize);
    const endBin = Math.min(Math.floor(bandHz.max / binSize), frequencyData.length - 1);
    
    let totalEnergy = 0;
    let count = 0;
    
    for (let i = startBin; i <= endBin; i++) {
        totalEnergy += frequencyData[i];
        count++;
    }
    
    return count > 0 ? totalEnergy / count : 0;
}

function isEnhancedPeak(currentEnergy, currentTime) {
    // Calculate local average energy for better threshold
    const recentEnergy = energyHistory.slice(historyIndex - 50, historyIndex).filter(e => e > 0);
    const localAverage = recentEnergy.length > 0 ? recentEnergy.reduce((sum, e) => sum + e, 0) / recentEnergy.length : 0;
    
    // Dynamic threshold based on local average
    const dynamicThreshold = Math.max(MIN_ENERGY_THRESHOLD, localAverage * PEAK_THRESHOLD_RATIO);
    
    // Check if current energy is a peak
    const isPeak = currentEnergy > dynamicThreshold && 
                   currentEnergy > MIN_ENERGY_THRESHOLD &&
                   (currentTime - lastPeakTime) >= MIN_PEAK_INTERVAL_MS;
    
    if (isPeak) {
        lastPeakTime = currentTime;
        
        // Calculate peak strength (0-1 scale)
        const strength = Math.min(1.0, currentEnergy / (dynamicThreshold * 2));
        
        return { isPeak: true, strength: strength };
    }
    
    return { isPeak: false, strength: 0 };
}

function calculateValidIntervals() {
    const intervals = [];
    
    for (let i = 1; i < detectedPeakTimes.length; i++) {
        const interval = detectedPeakTimes[i] - detectedPeakTimes[i - 1];
        
        if (interval >= MIN_PEAK_INTERVAL_MS && interval <= MAX_PEAK_INTERVAL_MS) {
            intervals.push(interval);
        }
    }
    
    return intervals;
}

function calculateBPMFromIntervals(intervals) {
    // Advanced BPM calculation using multiple statistical methods
    
    // Method 1: Histogram-based analysis
    const histogram = createIntervalHistogram(intervals);
    const dominantInterval = findDominantInterval(histogram);
    
    // Method 2: Clustering analysis
    const clusters = clusterIntervals(intervals);
    const clusterBpm = calculateClusterBPM(clusters);
    
    // Method 3: Autocorrelation analysis
    const autocorrBpm = calculateAutocorrelationBPM(intervals);
    
    console.log(`Advanced BPM analysis:`);
    console.log(`  - Histogram dominant: ${(60000 / dominantInterval).toFixed(1)} BPM`);
    console.log(`  - Cluster analysis: ${clusterBpm.toFixed(1)} BPM`);
    console.log(`  - Autocorrelation: ${autocorrBpm.toFixed(1)} BPM`);
    
    // Weighted combination of methods
    const weights = [0.4, 0.4, 0.2]; // Histogram and clustering are most reliable
    const weightedBpm = (dominantInterval * weights[0] + clusterBpm * weights[1] + autocorrBpm * weights[2]) / weights.reduce((a, b) => a + b, 0);
    
    console.log(`  - Weighted result: ${weightedBpm.toFixed(1)} BPM`);
    
    return { bpm: weightedBpm, medianInterval: dominantInterval };
}

function createIntervalHistogram(intervals) {
    const histogram = {};
    const binSize = 10; // 10ms bins
    
    intervals.forEach(interval => {
        const bin = Math.round(interval / binSize) * binSize;
        histogram[bin] = (histogram[bin] || 0) + 1;
    });
    
    return histogram;
}

function findDominantInterval(histogram) {
    let maxCount = 0;
    let dominantBin = 0;
    
    for (const [bin, count] of Object.entries(histogram)) {
        if (count > maxCount) {
            maxCount = count;
            dominantBin = parseInt(bin);
        }
    }
    
    return dominantBin;
}

function clusterIntervals(intervals) {
    // Simple clustering: group intervals within 20% of each other
    const clusters = [];
    const tolerance = 0.2;
    
    intervals.forEach(interval => {
        let addedToCluster = false;
        
        for (const cluster of clusters) {
            const clusterAvg = cluster.reduce((sum, i) => sum + i, 0) / cluster.length;
            if (Math.abs(interval - clusterAvg) / clusterAvg < tolerance) {
                cluster.push(interval);
                addedToCluster = true;
                break;
            }
        }
        
        if (!addedToCluster) {
            clusters.push([interval]);
        }
    });
    
    return clusters.filter(cluster => cluster.length >= 2); // Only keep clusters with multiple intervals
}

function calculateClusterBPM(clusters) {
    if (clusters.length === 0) return 120; // Default
    
    // Find the largest cluster
    const largestCluster = clusters.reduce((largest, cluster) => 
        cluster.length > largest.length ? cluster : largest, clusters[0]);
    
    const avgInterval = largestCluster.reduce((sum, interval) => sum + interval, 0) / largestCluster.length;
    return 60000 / avgInterval;
}

function calculateAutocorrelationBPM(intervals) {
    // Simple autocorrelation to find repeating patterns
    const maxLag = Math.min(intervals.length, 20);
    let bestCorrelation = 0;
    let bestLag = 1;
    
    for (let lag = 1; lag <= maxLag; lag++) {
        let correlation = 0;
        let count = 0;
        
        for (let i = 0; i < intervals.length - lag; i++) {
            const diff = Math.abs(intervals[i] - intervals[i + lag]);
            const similarity = Math.max(0, 1 - diff / intervals[i]);
            correlation += similarity;
            count++;
        }
        
        if (count > 0) {
            correlation /= count;
            if (correlation > bestCorrelation) {
                bestCorrelation = correlation;
                bestLag = lag;
            }
        }
    }
    
    // Calculate BPM from the best lag
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    return 60000 / (avgInterval * bestLag);
}

function correctTempoEnhanced(originalBpm, intervals) {
    // Enhanced tempo correction with better analysis for double-tempo issues
    
    const possibleTempos = [
        originalBpm / 4,  // Quarter tempo
        originalBpm / 3,  // Third tempo
        originalBpm / 2,  // Half tempo (most likely for double-tempo issues)
        originalBpm,      // Original tempo
        originalBpm * 2,  // Double tempo
        originalBpm * 3,  // Triple tempo
    ];
    
    console.log(`Original detected BPM: ${originalBpm.toFixed(1)}`);
    console.log(`Testing possible tempos: ${possibleTempos.map(t => t.toFixed(1)).join(', ')}`);
    
    // Find the tempo that's most likely to be the fundamental beat
    let bestTempo = originalBpm;
    let bestScore = 0;
    
    for (const tempo of possibleTempos) {
        if (tempo < MIN_BPM || tempo > MAX_BPM) {
            console.log(`Skipping ${tempo.toFixed(1)} BPM (outside range ${MIN_BPM}-${MAX_BPM})`);
            continue;
        }
        
        const score = calculateAdvancedTempoScore(tempo, intervals);
        console.log(`Tempo ${tempo.toFixed(1)} BPM: score ${score.toFixed(3)}`);
        
        if (score > bestScore) {
            bestScore = score;
            bestTempo = tempo;
        }
    }
    
    console.log(`Selected tempo: ${bestTempo.toFixed(1)} BPM (score: ${bestScore.toFixed(3)})`);
    
    // Special handling for double-tempo detection
    if (originalBpm > 150) {
        const halfTempo = originalBpm / 2;
        if (halfTempo >= 60 && halfTempo <= 140) {
            // Check if half tempo has a significantly better score
            const halfScore = calculateAdvancedTempoScore(halfTempo, intervals);
            if (halfScore > bestScore * 0.8) { // If half tempo is at least 80% as good
                console.log(`High BPM detected (${originalBpm.toFixed(1)}), strongly preferring half tempo: ${halfTempo.toFixed(1)}`);
                return halfTempo;
            }
        }
    }
    
    // Pattern analysis for double-tempo detection
    const patternAnalysis = analyzeRhythmPatternEnhanced(intervals, originalBpm);
    if (patternAnalysis.suggestion === 'double' && originalBpm > 120) {
        const correctedTempo = originalBpm / 2;
        if (correctedTempo >= MIN_BPM && correctedTempo <= MAX_BPM) {
            console.log(`Pattern analysis suggests double-tempo, correcting ${originalBpm.toFixed(1)} → ${correctedTempo.toFixed(1)}`);
            return correctedTempo;
        }
    }
    
    // Fine-tuning to common tempos
    const commonTempos = [60, 65, 70, 75, 80, 85, 88, 90, 92, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140];
    for (const commonTempo of commonTempos) {
        if (Math.abs(bestTempo - commonTempo) < 2) {
            console.log(`Fine-tuning ${bestTempo.toFixed(1)} → ${commonTempo} (common tempo)`);
            return commonTempo;
        }
    }
    
    return bestTempo;
}

function analyzeRhythmPatternEnhanced(intervals, detectedBpm) {
    const expectedInterval = 60000 / detectedBpm;
    
    // Count intervals that are close to common subdivisions
    let quarterNoteCount = 0;  // 1x the expected interval
    let eighthNoteCount = 0;   // 0.5x the expected interval
    let sixteenthNoteCount = 0; // 0.25x the expected interval
    let otherCount = 0;
    
    for (const interval of intervals) {
        const ratio = interval / expectedInterval;
        
        if (Math.abs(ratio - 1) < 0.15) { // Tighter tolerance
            quarterNoteCount++;
        } else if (Math.abs(ratio - 0.5) < 0.15) {
            eighthNoteCount++;
        } else if (Math.abs(ratio - 0.25) < 0.15) {
            sixteenthNoteCount++;
        } else {
            otherCount++;
        }
    }
    
    console.log(`Enhanced interval analysis: ${quarterNoteCount} quarter notes, ${eighthNoteCount} eighth notes, ${sixteenthNoteCount} sixteenth notes, ${otherCount} other`);
    
    // If we have mostly eighth notes, we're probably detecting subdivisions
    if (eighthNoteCount > quarterNoteCount && eighthNoteCount > intervals.length * 0.3) {
        return { suggestion: 'double', confidence: 'high' };
    }
    
    // If we have mostly sixteenth notes, we're probably detecting subdivisions
    if (sixteenthNoteCount > quarterNoteCount && sixteenthNoteCount > intervals.length * 0.25) {
        return { suggestion: 'quadruple', confidence: 'high' };
    }
    
    // If we have a mix but eighth notes are prominent, still suggest double
    if (eighthNoteCount > intervals.length * 0.25) {
        return { suggestion: 'double', confidence: 'medium' };
    }
    
    return { suggestion: 'correct', confidence: 'high' };
}

function calculateAdvancedTempoScore(tempo, intervals) {
    const expectedInterval = 60000 / tempo;
    let score = 0;
    let count = 0;
    
    // Check how well intervals align with this tempo and its common subdivisions
    for (const interval of intervals) {
        // Check if interval matches the tempo or its common subdivisions
        const ratios = [0.25, 0.5, 1, 2, 3, 4]; // Common rhythmic ratios
        
        for (const ratio of ratios) {
            const expected = expectedInterval * ratio;
            const deviation = Math.abs(interval - expected) / expected;
            
            if (deviation < 0.15) { // Tighter tolerance for better accuracy
                score += (1 - deviation) * (1 - deviation); // Square for better weighting
                count++;
                break; // Only count the best match for each interval
            }
        }
    }
    
    if (count === 0) return 0;
    
    // Distribution analysis
    const closeIntervals = intervals.filter(interval => {
        const deviation = Math.abs(interval - expectedInterval) / expectedInterval;
        return deviation < 0.25; // Within 25% of expected
    }).length;
    
    const distributionScore = closeIntervals / intervals.length;
    
    // Sweet spot bonus for reasonable tempos
    let sweetSpotBonus = 1.0;
    if (tempo >= 60 && tempo <= 140) {
        sweetSpotBonus = 1.3; // 30% bonus for reasonable tempos
    }
    
    // Penalty for very high tempos
    if (tempo > 150) {
        sweetSpotBonus = 0.7; // 30% penalty for very high tempos
    }
    
    const finalScore = (score / count) * distributionScore * sweetSpotBonus;
    
    console.log(`  - Score: ${(score / count).toFixed(3)}, Distribution: ${distributionScore.toFixed(3)}, Bonus: ${sweetSpotBonus.toFixed(2)}, Final: ${finalScore.toFixed(3)}`);
    
    return finalScore;
}

function calculateAdvancedConfidence(intervals, bpm, peakStrengths) {
    // Multi-factor confidence calculation for much higher accuracy
    
    const expectedInterval = 60000 / bpm;
    
    // Factor 1: Interval consistency (40% weight)
    const deviations = intervals.map(interval => Math.abs(interval - expectedInterval) / expectedInterval);
    const avgDeviation = deviations.reduce((sum, dev) => sum + dev, 0) / deviations.length;
    const consistencyScore = Math.max(0, 1 - avgDeviation);
    
    // Factor 2: Peak strength consistency (25% weight)
    const avgPeakStrength = peakStrengths.reduce((sum, strength) => sum + strength, 0) / peakStrengths.length;
    const strengthVariance = peakStrengths.reduce((sum, strength) => sum + Math.pow(strength - avgPeakStrength, 2), 0) / peakStrengths.length;
    const strengthScore = Math.max(0, 1 - Math.sqrt(strengthVariance));
    
    // Factor 3: Data quantity (20% weight)
    const quantityScore = Math.min(1, intervals.length / 20); // Max score at 20+ intervals
    
    // Factor 4: Tempo reasonableness (15% weight)
    let reasonablenessScore = 1.0;
    if (bpm < 60 || bpm > 160) {
        reasonablenessScore = 0.7; // Penalty for extreme tempos
    } else if (bpm >= 80 && bpm <= 120) {
        reasonablenessScore = 1.2; // Bonus for common tempos
    }
    
    // Calculate weighted confidence
    const confidence = (consistencyScore * 0.4) + 
                      (strengthScore * 0.25) + 
                      (quantityScore * 0.2) + 
                      (reasonablenessScore * 0.15);
    
    console.log(`Confidence factors:`);
    console.log(`  - Consistency: ${(consistencyScore * 100).toFixed(1)}%`);
    console.log(`  - Peak strength: ${(strengthScore * 100).toFixed(1)}%`);
    console.log(`  - Data quantity: ${(quantityScore * 100).toFixed(1)}%`);
    console.log(`  - Tempo reasonableness: ${(reasonablenessScore * 100).toFixed(1)}%`);
    console.log(`  - Final confidence: ${(confidence * 100).toFixed(1)}%`);
    
    return Math.min(1, confidence); // Cap at 100%
}

async function stopAudioProcessing() {
    console.log("Stopping audio stream and analysis...");
    isDetecting = false;
    
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    
    if (detectionTimeout) {
        clearTimeout(detectionTimeout);
        detectionTimeout = null;
    }

    if (analyser) {
        analyser.disconnect();
        analyser = null;
    }
    
    if (mediaStreamSource) {
        mediaStreamSource.disconnect();
        mediaStreamSource = null;
    }

    if (microphoneStream) {
        microphoneStream.getTracks().forEach(track => {
            track.stop();
            console.log("Microphone track stopped");
        });
        microphoneStream = null;
    }

    if (audioContext && audioContext.state !== 'closed') {
        try {
            await audioContext.close();
            console.log("AudioContext closed successfully");
        } catch (e) {
            console.error("Error closing AudioContext:", e);
        }
    }
    audioContext = null;
    
    resetDetectionState();
}