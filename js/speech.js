// js/speech.js
// Handles Speech Recognition API interaction.

import { state } from './state.js';
import * as ui from './ui.js';
import * as wordManager from './wordManager.js';
import * as utils from './utils.js';

export function setupSpeechRecognition() {
    window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!window.SpeechRecognition) {
        console.error("Speech Recognition API not supported.");
        if (ui.elements.voiceModeButton) {
            ui.elements.voiceModeButton.disabled = true;
            ui.elements.voiceModeButton.innerHTML = '<span class="light"></span><i class="fas fa-microphone-slash"></i> NOT SUPPORTED';
        }
        ui.showFeedback("Speech Recognition not available in this browser.", true, 5000);
        return false; // Indicate failure
    }

    state.recognition = new SpeechRecognition();
    state.recognition.continuous = true;
    state.recognition.interimResults = true;
    state.recognition.lang = 'en-US'; // Configurable?

    state.recognition.onstart = onRecognitionStart;
    state.recognition.onresult = onRecognitionResult;
    state.recognition.onerror = onRecognitionError;
    state.recognition.onend = onRecognitionEnd;

    console.log("Speech Recognition initialized.");
    return true; // Indicate success
}

function onRecognitionStart() {
    state.isMicActive = true;
    console.log('Mic hardware ON.');
    ui.updateActivationUI(); // Update button visual state
    if (state.activationMode === 'voice') {
        ui.showFeedback("Voice Mode Activated", false, 2000);
    }
}

function onRecognitionResult(event) {
    let currentInterim = '';
    let currentFinal = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcriptPart = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
            currentFinal += transcriptPart.trim() + ' ';
        } else {
            currentInterim += transcriptPart;
        }
    }
    currentFinal = currentFinal.trim();
    currentInterim = currentInterim.trim();

    // --- Update Transcript Display ---
    state.finalTranscript = currentFinal; // Store final part
    state.interimTranscript = currentInterim; // Store interim part
    ui.updateTranscript(currentFinal, true); // Display final
    ui.updateTranscript(currentInterim, false); // Display interim

    // --- Process Final Transcript for Frequencies ---
    if (currentFinal) {
        wordManager.updateFrequencies(currentFinal);
    }

    // --- Word Matching ---
    checkForWordMatch(currentFinal || currentInterim);
}

function onRecognitionError(event) {
    console.error('Speech recognition error:', event.error, event.message);
    let errorMsg = `Speech Error: ${event.error}`;
    if (event.error === 'no-speech') errorMsg = 'No speech detected.';
    else if (event.error === 'audio-capture') errorMsg = 'Mic Error. Check permissions/hardware.';
    else if (event.error === 'not-allowed') errorMsg = 'Mic access denied by user or browser setting.';
    ui.showFeedback(errorMsg, true, 4000);

    state.isMicActive = false; // Assume hardware stopped
    ui.updateActivationUI(); // Update button visual state

    // If critical error makes voice mode unusable, revert to manual
    if (event.error === 'not-allowed' || event.error === 'audio-capture') {
         if (state.activationMode === 'voice') {
             setActivationMode('manual'); // Defined in main.js, called via event handler
         }
    }
}

function onRecognitionEnd() {
    const wasMicActive = state.isMicActive; // Capture state before update
    state.isMicActive = false;
    console.log('Speech recognition hardware ended.');
    ui.updateActivationUI(); // Update button visual state immediately

    const micShouldBeActiveIntent = (state.activationMode === 'voice');

    // Only attempt restart if it was active and SHOULD be active (mode is still 'voice')
    if (wasMicActive && micShouldBeActiveIntent && state.recognition) {
        console.log('Recognition ended unexpectedly, attempting restart...');
        // Use a small delay to prevent rapid-fire restarts on some errors
        setTimeout(() => {
            if (state.activationMode === 'voice' && !state.isMicActive) { // Check state again before restarting
                try {
                    startRecognition(); // Attempt to restart
                } catch (err) {
                     console.error('Error restarting recognition hardware:', err);
                     // Potentially call setActivationMode('manual') here if restart fails critically
                     ui.showFeedback("Failed to restart mic.", true, 4000);
                }
            } else {
                console.log('Activation mode changed or mic restarted during timeout. Not restarting.');
            }
        }, 500); // Delay before restart attempt
    } else {
         console.log('Mic ended intentionally or mode changed.');
    }
}

// --- Control Functions ---
export function startRecognition() {
    if (!state.recognition) {
        console.warn("Speech recognition not setup. Cannot start.");
        ui.showFeedback("Speech recognition unavailable.", true);
        return;
    }
    if (state.isMicActive) {
        console.log("Mic already active.");
        return;
    }
    try {
        state.finalTranscript = '';
        state.interimTranscript = '';
        ui.clearTranscript(); // Clear display
        console.log("Requesting speech recognition hardware start...");
        state.recognition.start();
        // state.isMicActive = true; // Set by onstart event
    } catch (error) {
        console.error("Error starting speech recognition hardware:", error);
        state.isMicActive = false; // Ensure state is false
        ui.updateActivationUI();
        // Maybe call setActivationMode('manual') here
        ui.showFeedback("Could not start mic. Check permissions?", true, 4000);
    }
}

export function stopRecognition(isModeChange = false) { // `isModeChange` suppresses feedback msg
    if (!state.recognition || !state.isMicActive) {
        return; // Only stop if initialized and active
    }
    try {
        console.log('Requesting speech recognition hardware stop.');
        state.recognition.stop();
         // onend will set isMicActive = false and update UI
        if (!isModeChange) {
             ui.showFeedback("Voice Mode Deactivated", false, 1500);
        }
    } catch (e) {
        console.warn("Error during recognition.stop(): ", e);
        // If stop() errors, force state and UI update
        state.isMicActive = false;
        ui.updateActivationUI();
        // if (state.activationMode === 'voice' && !isModeChange) setActivationMode('manual'); // Handled in main now
    }
}


// --- Word Matching Logic ---
function checkForWordMatch(utterance) {
     if (!utterance || state.activationMode !== 'voice' || !state.isMicActive) {
         return; // Exit if no utterance or not in active voice mode
     }

     const targetWord = state.currentWord?.toLowerCase(); // Safely access currentWord
     if (!targetWord || targetWord === "no words!" || targetWord.length < 2) {
         return; // Exit if no valid target word
     }

     const wordsInUtterance = utterance.toLowerCase().match(/\b(\w+)\b/g) || [];

     for (const spokenWord of wordsInUtterance) {
         if (spokenWord.length < 2) continue;

         const similarity = utils.levenshteinDistance(spokenWord, targetWord);

         // Check similarity AND ensure it's not the same match we just processed
         if (similarity >= state.LEVENSHTEIN_THRESHOLD && targetWord !== state.lastMatchedWord) {
              console.log(`MATCH: "${spokenWord}" (${similarity.toFixed(2)}) vs "${targetWord}"`);
              state.lastMatchedWord = targetWord; // Debounce - set immediately

              // Calculate points BEFORE updating streak
              const pointsEarned = 10 + state.currentStreak * 2;
              wordManager.updateStreak(true); // Update streak
              wordManager.updateScore(pointsEarned); // Update score
              ui.showFeedback(`HIT! +${pointsEarned} pts`);
              utils.triggerConfetti();

              // Schedule the next word change with a short delay
              setTimeout(() => {
                  // Double-check the mode hasn't changed during the timeout
                  if (state.activationMode === 'voice' && targetWord === state.lastMatchedWord) {
                      wordManager.changeWord('next', false, true); // isVoiceMatch = true
                  } else {
                      console.warn("Mode changed or word advanced before match timeout completed.");
                  }
              }, 150); // Delay for feedback visibility

              break; // Match found for this utterance, stop checking words
         }
     }
}