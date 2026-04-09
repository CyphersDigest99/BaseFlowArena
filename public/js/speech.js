/**
 * @fileoverview Speech Recognition and Voice Command Handler
 *
 * This module manages all speech recognition logic for the BaseFlowArena application.
 * It sets up and controls the Web Speech API, processes user utterances for word matches,
 * handles voice commands, and coordinates UI feedback and state updates.
 *
 * Key responsibilities:
 * - Initializing and configuring the Speech Recognition API
 * - Handling speech recognition events (start, result, error, end)
 * - Starting and stopping recognition based on app state
 * - Processing user utterances for word matches and gamification
 * - Handling voice commands (next word, show/hide rhymes, show definition)
 * - Updating UI and state in response to speech events
 *
 * Dependencies: state.js, ui.js, wordManager.js, utils.js, wordApi.js
 */

// js/speech.js
// Handles Speech Recognition API interaction.

import { state } from './state.js';
import * as ui from './ui.js';
import * as wordManager from './wordManager.js';
import * as utils from './utils.js';
import * as wordApi from './wordApi.js';
import { initAudioVisualizer, stopAudioVisualizer } from './audioVisualizer.js';

// --- Setup Speech Recognition ---
// Initializes the Speech Recognition API and configures event handlers
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

    // Recover STT when tab regains visibility (browser suspends recognition in background)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && state.activationMode === 'voice' && !state.isMicActive) {
            console.log('Tab visible again, restarting speech recognition...');
            scheduleRecognitionRestart(300);
        }
    });

    initSttSliders();
    console.log("Speech Recognition initialized.");
    return true; // Indicate success
}

// Wire up the Flush Interval and Min Chars sliders in the Live Feed gear modal,
// and restore saved values from localStorage.
const STT_SETTINGS_KEY = 'sttCycleSettings';

function initSttSliders() {
    // Load saved settings
    try {
        const saved = JSON.parse(localStorage.getItem(STT_SETTINGS_KEY) || '{}');
        if (saved.cycleMs)   CYCLE_RESTART_MS = saved.cycleMs;
        if (saved.minChars)  CYCLE_MIN_INTERIM_CHARS = saved.minChars;
    } catch (e) { /* ignore corrupt data */ }

    const msSlider  = document.getElementById('stt-cycle-ms');
    const msLabel   = document.getElementById('stt-cycle-ms-val');
    const chSlider  = document.getElementById('stt-min-chars');
    const chLabel   = document.getElementById('stt-min-chars-val');

    if (msSlider) {
        msSlider.value = CYCLE_RESTART_MS;
        if (msLabel) msLabel.textContent = CYCLE_RESTART_MS + 'ms';
        msSlider.addEventListener('input', () => {
            CYCLE_RESTART_MS = parseInt(msSlider.value, 10);
            if (msLabel) msLabel.textContent = CYCLE_RESTART_MS + 'ms';
            localStorage.setItem(STT_SETTINGS_KEY,
                JSON.stringify({ cycleMs: CYCLE_RESTART_MS, minChars: CYCLE_MIN_INTERIM_CHARS }));
        });
    }
    if (chSlider) {
        chSlider.value = CYCLE_MIN_INTERIM_CHARS;
        if (chLabel) chLabel.textContent = CYCLE_MIN_INTERIM_CHARS;
        chSlider.addEventListener('input', () => {
            CYCLE_MIN_INTERIM_CHARS = parseInt(chSlider.value, 10);
            if (chLabel) chLabel.textContent = CYCLE_MIN_INTERIM_CHARS;
            localStorage.setItem(STT_SETTINGS_KEY,
                JSON.stringify({ cycleMs: CYCLE_RESTART_MS, minChars: CYCLE_MIN_INTERIM_CHARS }));
        });
    }
}

// --- Speech Recognition Event Handlers ---
// Handles the start of speech recognition hardware
function onRecognitionStart() {
    const wasCycleRestart = state.intentionalCycleRestart;
    state.intentionalCycleRestart = false; // Reset flag now that we've read it
    state.isMicActive = true;
    console.log(wasCycleRestart ? 'Mic hardware ON (cycle restart).' : 'Mic hardware ON.');
    ui.updateActivationUI(); // Update button visual state
    if (state.activationMode === 'voice') {
        // Only show activation toast on a true user-initiated start, not on cycle restarts
        if (!wasCycleRestart) {
            ui.showFeedback("Voice Mode Activated", false, 2000);
        }
        scheduleCycleRestart();
    }
}

// Force-promote interim text to final on a recurring interval.
// The speech API accumulates text in a single growing result during continuous speech.
// We track how many characters we've already promoted and only push the new portion.
let _interimPromoteInterval = null;
let _promotedCharCount = 0; // How many chars of the current interim we already promoted
const INTERIM_PROMOTE_MS = 2000;

function startInterimPromotion() {
    if (_interimPromoteInterval) return;
    _interimPromoteInterval = setInterval(() => {
        const interimEl = document.getElementById('new-transcript')?.querySelector('.interim');
        if (!interimEl) return;
        const fullText = interimEl.textContent.trim();
        if (!fullText || fullText.length <= _promotedCharCount) return;

        // Extract only the new portion we haven't promoted yet
        const newText = fullText.substring(_promotedCharCount).trim();
        if (!newText) return;

        // Only promote up to the last complete word boundary (space).
        // This prevents splitting mid-word fragments like "eff" / "icacious"
        // when the API is still processing a longer word.
        const lastSpace = newText.lastIndexOf(' ');
        if (lastSpace <= 0) return; // single word fragment — let final result handle it

        const toPromote = newText.substring(0, lastSpace).trim();
        if (!toPromote) return;

        _promotedCharCount += lastSpace + 1;

        // Push the complete words as a final clickable line (don't remove interim —
        // the API will keep updating it with more text)
        ui.updateTranscript(toPromote, true);
        wordManager.updateFrequencies(toPromote);
    }, INTERIM_PROMOTE_MS);
}

function stopInterimPromotion() {
    if (_interimPromoteInterval) {
        clearInterval(_interimPromoteInterval);
        _interimPromoteInterval = null;
    }
    _promotedCharCount = 0;
}

// --- Forced STT Restart Cycle ---
// Chrome's webkitSpeechRecognition decides when to flip interim→final based on
// voice-activity detection. When rapping continuously with no pauses, it never
// trips the "end of phrase" detector and the grey interim block grows unbounded.
// Fix: periodically call recognition.stop(), which forces Chrome to flush its
// buffer as a final result. onend then immediately restarts recognition.
//
// Tunable via the gear icon sliders in the Live Feed panel.
// Lower CYCLE_RESTART_MS = smaller grey block, more mic gaps.
// Higher CYCLE_MIN_INTERIM_CHARS = only flush when there's a lot of grey text.
let CYCLE_RESTART_MS = 2500;
let CYCLE_MIN_INTERIM_CHARS = 30;
// Delay before start() after our intentional stop(). Chrome throws
// "recognition has already started" if called synchronously inside onend.
const CYCLE_RESTART_GAP_MS = 50;

function scheduleCycleRestart() {
    if (state.cycleRestartTimer) clearTimeout(state.cycleRestartTimer);
    state.cycleRestartTimer = setTimeout(() => {
        state.cycleRestartTimer = null;
        // Only cycle if still in voice mode and mic is active
        if (state.activationMode !== 'voice' || !state.isMicActive || !state.recognition) return;

        // Skip the cycle if there's not enough grey text to make it worthwhile.
        // The browser will keep accumulating naturally; we just check again on the next tick.
        const interimEl = document.getElementById('new-transcript')?.querySelector('.interim');
        const interimLen = interimEl?.textContent?.trim().length || 0;
        if (interimLen < CYCLE_MIN_INTERIM_CHARS) {
            scheduleCycleRestart(); // Defer — try again next cycle window
            return;
        }

        try {
            state.intentionalCycleRestart = true;
            state.recognition.stop(); // Flushes interim → final, triggers onend
        } catch (err) {
            console.warn('Cycle restart stop() error:', err);
            state.intentionalCycleRestart = false;
            scheduleCycleRestart(); // Try again next cycle
        }
    }, CYCLE_RESTART_MS);
}

function cancelCycleRestart() {
    if (state.cycleRestartTimer) {
        clearTimeout(state.cycleRestartTimer);
        state.cycleRestartTimer = null;
    }
    state.intentionalCycleRestart = false;
}

// Handles speech recognition results (final and interim)
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
    state.finalTranscript = currentFinal;
    state.interimTranscript = currentInterim;

    if (currentFinal) {
        // API finalized naturally. Only display the portion we haven't already promoted.
        if (_promotedCharCount > 0) {
            const newPortion = currentFinal.substring(_promotedCharCount).trim();
            if (newPortion) {
                ui.updateTranscript(newPortion, true);
                wordManager.updateFrequencies(newPortion);
            }
            // Remove the interim element since the API is done with this result
            const interimEl = document.getElementById('new-transcript')?.querySelector('.interim');
            if (interimEl) interimEl.remove();
        } else {
            ui.updateTranscript(currentFinal, true);
            wordManager.updateFrequencies(currentFinal);
        }
        // Reset for next result
        _promotedCharCount = 0;
    }
    if (currentInterim) {
        ui.updateTranscript(currentInterim, false);
        startInterimPromotion();
    }

    // --- Check for Voice Commands First ---
    if (currentFinal && state.activationMode === 'voice') {
        const commandProcessed = processVoiceCommands(currentFinal);
        if (commandProcessed) {
            return;
        }
    }

    // --- Word Matching ---
    checkForWordMatch(currentFinal || currentInterim);
}

// Handles errors from the speech recognition API
function onRecognitionError(event) {
    console.error('Speech recognition error:', event.error, event.message);
    if (event.error === 'aborted') return; // Chrome internal — transient, handled by onend restart
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

// Handles the end of speech recognition hardware (intentional or not)
function onRecognitionEnd() {
    state.isMicActive = false;
    ui.updateActivationUI();

    // If this onend was triggered by our cycle-restart timer, bounce back up fast.
    // Use a small gap (CYCLE_RESTART_GAP_MS) because Chrome throws if start() is
    // called synchronously inside onend.
    if (state.intentionalCycleRestart && state.activationMode === 'voice' && state.recognition) {
        setTimeout(() => {
            if (state.activationMode !== 'voice' || state.isMicActive) return;
            try {
                state.recognition.start();
            } catch (err) {
                console.warn('Cycle restart start() error, falling back to scheduled restart:', err);
                state.intentionalCycleRestart = false;
                scheduleRecognitionRestart(200);
            }
        }, CYCLE_RESTART_GAP_MS);
        return;
    }

    console.log('Speech recognition hardware ended.');
    // If voice mode is still active, always attempt restart
    if (state.activationMode === 'voice' && state.recognition) {
        console.log('Recognition ended while voice mode active, restarting...');
        scheduleRecognitionRestart();
    } else {
        console.log('Mic ended intentionally or mode changed.');
    }
}

// Robust restart with verification — retries if start() silently fails
let _restartTimer = null;
function scheduleRecognitionRestart(delay = 500) {
    if (_restartTimer) clearTimeout(_restartTimer);
    _restartTimer = setTimeout(() => {
        _restartTimer = null;
        if (state.activationMode !== 'voice' || state.isMicActive) return;
        try {
            startRecognition();
        } catch (err) {
            console.error('Error restarting recognition:', err);
        }
        // Verify it actually started — if onstart doesn't fire within 2s, retry
        setTimeout(() => {
            if (state.activationMode === 'voice' && !state.isMicActive) {
                console.warn('Recognition start() may have failed silently, retrying...');
                try { startRecognition(); } catch (e) { /* give up */ }
            }
        }, 2000);
    }, delay);
}

// --- Control Functions ---
// Starts speech recognition hardware and clears transcript
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
        if (state.activationMode !== 'voice') ui.clearTranscript(); // Don't wipe feed mid-session in voice mode
        console.log("Requesting speech recognition hardware start...");
        state.recognition.start();
        // Start mic visualizer
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => { state._micStream = stream; initAudioVisualizer(stream); })
            .catch(err => console.warn('Mic visualizer unavailable:', err));
    } catch (error) {
        console.error("Error starting speech recognition hardware:", error);
        state.isMicActive = false; // Ensure state is false
        ui.updateActivationUI();
        // Maybe call setActivationMode('manual') here
        ui.showFeedback("Could not start mic. Check permissions?", true, 4000);
    }
}

// Stops speech recognition hardware
export function stopRecognition(isModeChange = false) { // `isModeChange` suppresses feedback msg
    stopInterimPromotion(); // Clean up the promotion interval
    cancelCycleRestart(); // Kill any pending cycle restart (so it doesn't fire after user stops)
    stopAudioVisualizer();
    if (state._micStream) {
        state._micStream.getTracks().forEach(t => t.stop());
        state._micStream = null;
    }
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
// Checks if the user's utterance matches the displayed word and handles scoring
function checkForWordMatch(utterance) {
     if (!utterance || state.activationMode !== 'voice' || !state.isMicActive) {
         return; // Exit if no utterance or not in active voice mode
     }

     // Skip word matching if utterance contains command keywords
     if (containsCommandKeywords(utterance)) {
         console.log('Skipping word matching - utterance contains command keywords');
         return;
     }

     // Get the currently displayed word (could be base word or rhyme)
     const displayedWord = ui.elements.wordDisplay?.dataset.word || ui.elements.wordDisplay?.textContent;
     const targetWord = displayedWord?.toLowerCase(); // Safely access displayed word
     if (!targetWord || targetWord === "no words!" || targetWord === "loading..." || targetWord === "error" || targetWord.length < 2) {
         return; // Exit if no valid target word
     }

     const wordsInUtterance = utterance.toLowerCase().match(/\b(\w+)\b/g) || [];

     for (const spokenWord of wordsInUtterance) {
         if (spokenWord.length < 2) continue;

         const similarity = utils.levenshteinDistance(spokenWord, targetWord);

         // Check similarity AND ensure it's not the same match we just processed
         if (similarity >= state.LEVENSHTEIN_THRESHOLD && targetWord !== state.lastMatchedWord) {
              // When auto-cycle is paused, ignore the match entirely (no score, no effects)
              if (state.autoCyclePaused) {
                  break;
              }

              console.log(`MATCH: "${spokenWord}" (${similarity.toFixed(2)}) vs "${targetWord}"`);
              state.lastMatchedWord = targetWord; // Debounce - set immediately

              // Calculate points BEFORE updating streak
              const pointsEarned = 10 + state.currentStreak * 2;
              wordManager.updateStreak(true); // Update streak
              wordManager.updateScore(pointsEarned); // Update score
              ui.showFeedback(`HIT! +${pointsEarned} pts`);
              utils.triggerPixelBlockEffect(); // Use new pixel block effect

              // TIMING COORDINATION: Schedule the next word change with a longer delay
              setTimeout(() => {
                  if (state.activationMode === 'voice' && targetWord === state.lastMatchedWord) {
                      ui.clearTranscriptSelection();
                      if (state.voiceRhymeMode) {
                          const rhymeNavigated = wordManager.navigateNextRhymeForVoice();
                          if (!rhymeNavigated) {
                              wordManager.changeWord('next', false, true);
                          }
                      } else {
                          wordManager.changeWord('next', false, true);
                      }
                  }
              }, 800);

              break; // Match found for this utterance, stop checking words
         }
     }
}

// --- Voice Command Processing ---
// Processes voice commands and triggers corresponding actions
function processVoiceCommands(utterance) {
    if (!utterance || state.activationMode !== 'voice') {
        return false;
    }

    const lowerUtterance = utterance.toLowerCase().trim();
    
    // Command: "next word"
    if (lowerUtterance.includes('next word')) {
        console.log('Voice command detected: "next word"');
        wordManager.changeWord('next', false, false);
        ui.showFeedback("Next word!", false, 1500);
        return true;
    }

    // Command: "blacklist"
    if (lowerUtterance.includes('blacklist')) {
        console.log('Voice command detected: "blacklist"');
        wordManager.toggleBlacklist();
        return true;
    }

    // Command: "show rhymes"
    if (lowerUtterance.includes('show rhymes')) {
        console.log('Voice command detected: "show rhymes"');
        state.voiceRhymeMode = true;
        ui.showFeedback("Rhyme mode ON - voice matches will navigate rhymes", false, 3000);
        return true;
    }
    
    // Command: "hide rhymes"
    if (lowerUtterance.includes('hide rhymes')) {
        console.log('Voice command detected: "hide rhymes"');
        state.voiceRhymeMode = false;
        ui.showFeedback("Rhyme mode OFF - voice matches will get random words", false, 3000);
        return true;
    }
    
    // Command: "show definition"
    if (lowerUtterance.includes('show definition')) {
        console.log('Voice command detected: "show definition"');
        showDefinitionForCurrentWord();
        return true;
    }
    
    return false; // No command processed
}

// --- Helper function for showing definition ---
// Fetches and displays the definition for the currently displayed word
async function showDefinitionForCurrentWord() {
    const currentDisplayedWord = ui.elements.wordDisplay?.dataset.word || ui.elements.wordDisplay?.textContent;
    if (!currentDisplayedWord || currentDisplayedWord === "NO WORDS!" || currentDisplayedWord === "LOADING..." || currentDisplayedWord === "ERROR") {
        ui.showFeedback("No word available for definition", true, 2000);
        return;
    }
    
    ui.showFeedback("Fetching definition...", false, 2000);
    
    try {
        const wordData = await wordApi.fetchWordData(currentDisplayedWord);
        
        // Set tooltip state for pinned display
        state.tooltip.isPinned = true;
        state.tooltip.displayMode = 'both';
        
        // Update the pinned tooltip view with the fetched data
        ui.updateTooltipView(wordData.synonyms, wordData.definition);
        
        ui.showFeedback(`Definition pinned for "${currentDisplayedWord}"`, false, 2000);
    } catch (error) {
        console.error('Error fetching definition for voice command:', error);
        ui.showFeedback("Failed to fetch definition", true, 2000);
    }
}

// --- Check if utterance contains command keywords ---
// Returns true if the utterance contains any recognized command phrase
function containsCommandKeywords(utterance) {
    if (!utterance) return false;
    const lowerUtterance = utterance.toLowerCase();
    
    // Check for exact command phrases, not just individual words
    const commandPhrases = [
        'next word',
        'blacklist',
        'show rhymes',
        'hide rhymes',
        'show definition'
    ];
    
    return commandPhrases.some(phrase => lowerUtterance.includes(phrase));
}