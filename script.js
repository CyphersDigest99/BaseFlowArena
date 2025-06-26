// Import Three.js (Ensure type="module" in HTML script tag)
import * as THREE from 'three';

// --- Three.js Background Variables ---
let scene, camera, renderer, roadLines = [], roadPlane;
const lineCount = 50; // Number of line segments moving
const lineLength = 5;
const lineSpacing = 10; // Spacing between start points of consecutive lines
const roadSpeed = 0.25; // How fast lines move towards camera per frame
let isThreeJsInitialized = false; // Flag to prevent multiple inits

// --- Main Application Logic ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed - Freestyle Flow Arena');

    // --- Get DOM Elements ---
    // Header & Feedback
    const scoreDisplay = document.getElementById('score');
    const streakDisplay = document.getElementById('streak-counter');
    const feedbackMessage = document.getElementById('feedback-message');
    const bgCanvas = document.getElementById('bg-canvas'); // Three.js Canvas

    // Word Display Area
    const wordDisplay = document.getElementById('word-display');
    const wordDisplayContainer = document.getElementById('word-display-container');
    const prevWordButton = document.getElementById('prev-word'); // Arrow Button
    const nextWordButton = document.getElementById('next-word'); // Arrow Button
    const blacklistButton = document.getElementById('blacklist-word'); // Icon Button
    const favoriteButton = document.getElementById('favorite-word'); // Icon Button
    const findRhymesButton = document.getElementById('find-rhymes-button'); // Rhyme Button << NEW

    // Left Panel Controls (Word Settings)
    const wordOrderSelect = document.getElementById('word-order');
    const favoritesButton = document.getElementById('favorites-button');
    const editWordListButton = document.getElementById('edit-word-list-button');

    // Left Panel Controls (RNG)
    const rngDigitsInput = document.getElementById('rng-digits');
    const rngSetsInput = document.getElementById('rng-sets');
    const rngSurpriseCheckbox = document.getElementById('rng-surprise-me');
    const generateNumbersButton = document.getElementById('generate-numbers-button');
    const rngDisplayArea = document.getElementById('rng-display-area');

    // Center Stage Controls (Activation)
    const voiceModeButton = document.getElementById('voice-mode-button');
    const timedModeButton = document.getElementById('timed-mode-button');
    const timedCycleOptionsDiv = document.getElementById('timed-cycle-options');
    const cycleSpeedInput = document.getElementById('cycle-speed');
    const cycleSpeedSlider = document.getElementById('cycle-speed-slider');
    const transcriptContainer = document.getElementById('new-transcript');

    // Right Panel Controls (BPM)
    const bpmButton = document.getElementById('bpm-button');
    const bpmDisplay = document.getElementById('bpm-display');
    const bpmAdjustPlus = document.getElementById('bpm-adjust-plus');
    const bpmAdjustMinus = document.getElementById('bpm-adjust-minus');
    const stopBpmButton = document.getElementById('stop-bpm-button');
    const fourCountContainer = document.getElementById('four-count-container');
    const addRowButton = document.getElementById('add-row-button');
    const removeRowButton = document.getElementById('remove-row-button');
    const addColButton = document.getElementById('add-col-button');
    const removeColButton = document.getElementById('remove-col-button');
    const rowCountDisplay = document.getElementById('row-count-display');
    const colCountDisplay = document.getElementById('col-count-display');

    // Right Panel Controls (Frequencies)
    const frequentWordsContainer = document.getElementById('frequent-words');

    // Modals
    const favoritesModal = document.getElementById('favorites-modal');
    const closeFavoritesModal = document.getElementById('close-favorites-modal');
    const favoritesListUl = document.getElementById('favorites-list');
    const clearFavoritesButton = document.getElementById('clear-favorites-button');

    const wordListEditorModal = document.getElementById('word-list-editor-modal');
    const closeWordListEditor = document.getElementById('close-word-list-editor');
    const wordListTextarea = document.getElementById('word-list-textarea');
    const saveWordListButton = document.getElementById('save-word-list-button');

    // Rhyme Finder Modal Elements << NEW
    const rhymeFinderModal = document.getElementById('rhyme-finder-modal');
    const closeRhymeModalButton = document.getElementById('close-rhyme-modal');
    const rhymeSourceWordDisplay = document.getElementById('rhyme-source-word');
    const rhymePatternDisplay = document.getElementById('rhyme-pattern-display');
    const rhymeResultsList = document.getElementById('rhyme-results-list');
    const rhymeNoResults = document.getElementById('rhyme-no-results');


    // --- State Variables ---
    let wordList = [];
    let filteredWordList = [];
    let currentWord = '';
    let currentWordIndex = -1;
    let wordOrderMode = 'random'; // 'random', 'alphabetical', 'sequential'
    let activationMode = 'manual'; // 'manual', 'voice', 'timed'
    let history = [];
    const MAX_HISTORY = 20;

    let isMicActive = false; // Tracks hardware state
    let recognition = null;
    let lastMatchedWord = null;
    let finalTranscript = '';
    let interimTranscript = '';
    let transcriptTimeout = null;
    const TRANSCRIPT_SILENCE_MS = 500;
    const TRANSCRIPT_MAX_CHARS = 80;
    const MAX_TRANSCRIPT_LINES = 20;

    let timedInterval = null;

    let bpm = 0;
    let bpmClickTimestamps = [];
    const BPM_AVERAGE_COUNT = 10;
    let beatIntervalId = null;
    let currentBeat = 0;
    let beatGridRows = 1;
    let beatGridCols = 4;
    let isBpmLockedShaking = false;

    let blacklist = new Set();
    let favorites = new Set();
    let wordFrequencies = {};
    let rhymeData = null; // To store pre-processed rhyme patterns << NEW

    // Gamification State
    let score = 0;
    let currentStreak = 0;


    // --- Constants ---
    const LEVENSHTEIN_THRESHOLD = 0.7; // 70% similarity
    const DEFAULT_WORD_LIST = ["practice", "flow", "freestyle", "rhyme", "beat", "mic", "word", "speak", "rap", "skill", "game", "streak", "score", "arena", "threejs", "road", "effect", "background", "visual", "dynamic"];


    // --- Initialization ---
    async function initializeApp() { // << Made async
        console.log("Initializing application...");
        initThreeJsBackground(bgCanvas);
        loadSettings(); // Load general settings
        await loadRhymeData(); // << Load rhyme data BEFORE words that use it
        wordOrderMode = wordOrderSelect?.value || 'random'; // Read initial word order mode safely
        resetGamification();
        await loadWords(); // << Make loadWords async if needed (it is now due to fetch)
        setupSpeechRecognition();
        updateGrid();
        displayFrequencies();
        attachEventListeners(); // Attach AFTER elements exist
        updateActivationUI(); // Ensure initial UI state matches activationMode
        // Link slider and number input for Timed mode speed
        cycleSpeedSlider?.addEventListener('input', () => cycleSpeedInput.value = cycleSpeedSlider.value);
        cycleSpeedInput?.addEventListener('input', () => cycleSpeedSlider.value = cycleSpeedInput.value);
        console.log('Application initialization complete.');
    }

    // --- Three.js Background Functions ---
    function initThreeJsBackground(canvas) {
        if (!canvas || isThreeJsInitialized) return; // Prevent re-initialization
        console.log('Initializing Three.js background...');
        try {
            scene = new THREE.Scene();

            // Camera
            camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            camera.position.set(0, 4, 10); // Adjusted height for better road view
            camera.lookAt(0, 0, 0);

            // Renderer
            renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(window.devicePixelRatio);

            // Lighting
            scene.add(new THREE.AmbientLight(0x404060, 1));
            const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
            dirLight.position.set(5, 10, 7);
            scene.add(dirLight);

            // Road Plane (Visual only)
            const roadGeometry = new THREE.PlaneGeometry(50, lineCount * lineSpacing * 1.5); // Wider & Longer
            const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.9, metalness: 0.1 });
            roadPlane = new THREE.Mesh(roadGeometry, roadMaterial);
            roadPlane.rotation.x = -Math.PI / 2;
            roadPlane.position.y = -0.1;
            scene.add(roadPlane);

            // Road Lines (White dashes)
            const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const lineGeometry = new THREE.PlaneGeometry(0.2, lineLength); // Dashes

            for (let i = 0; i < lineCount; i++) {
                const line = new THREE.Mesh(lineGeometry, lineMaterial);
                line.rotation.x = -Math.PI / 2; // Align with road plane rotation
                line.position.z = (i * -lineSpacing);
                line.position.y = 0; // Exactly on the 'ground'
                roadLines.push(line);
                scene.add(line);
            }

            window.addEventListener('resize', onWindowResize, false);
            animateThreeJs(); // Start the animation loop
            isThreeJsInitialized = true;
            console.log('Three.js background initialized.');

        } catch (error) {
            console.error("Error initializing Three.js:", error);
            if(canvas) canvas.style.display = 'none'; // Hide canvas on error
        }
    }

    function animateThreeJs() {
        if (!isThreeJsInitialized) return; // Stop if not initialized
        requestAnimationFrame(animateThreeJs);

        roadLines.forEach(line => {
            line.position.z += roadSpeed;
            // Wrap around: If line's starting edge goes past camera, move it to the back
            if (line.position.z - (lineLength / 2) > camera.position.z) {
                line.position.z -= lineCount * lineSpacing;
            }
        });

        // Optional: Move the road plane texture for parallax
        // if (roadPlane.material.map) roadPlane.material.map.offset.y += roadSpeed * 0.005;

        if (renderer && scene && camera) {
            renderer.render(scene, camera);
        }
    }

    function onWindowResize() {
        if (!isThreeJsInitialized || !camera || !renderer) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        console.log('Three.js background resized.');
    }

    // --- Gamification Functions ---
     function resetGamification() {
         score = 0;
         currentStreak = 0;
         updateScore(0);
         updateStreak(false);
     }

    function updateScore(points) {
        const isAddingPoints = points > 0;
        score += points;
        if (score < 0) score = 0; // Prevent negative score
        scoreDisplay.textContent = score;

        if (isAddingPoints) {
             console.log(`Score updated by ${points}. New score: ${score}`);
            scoreDisplay.classList.remove('pulse'); // Remove first for re-trigger
            void scoreDisplay.offsetWidth; // Trigger reflow
            scoreDisplay.classList.add('pulse');
            setTimeout(() => scoreDisplay.classList.remove('pulse'), 300);
        } else if (points === 0) { // Only update display, no animation for reset
            scoreDisplay.textContent = score;
        }
    }

    function updateStreak(increment) {
        const oldStreak = currentStreak;
        if (increment) {
            currentStreak++;
        } else {
            currentStreak = 0;
            if (oldStreak > 0) console.log(`Streak reset from ${oldStreak}.`);
        }
        streakDisplay.textContent = currentStreak;

        if (increment) {
            console.log(`Streak updated. Current streak: ${currentStreak}`);
            streakDisplay.classList.remove('pulse', 'pulse-grow');
            void streakDisplay.offsetWidth;
            if (currentStreak > 1) {
                streakDisplay.classList.add('pulse-grow');
                setTimeout(() => streakDisplay.classList.remove('pulse-grow'), 400);
            } else {
                streakDisplay.classList.add('pulse');
                setTimeout(() => streakDisplay.classList.remove('pulse'), 300);
            }
        }
    }

    function showFeedback(message, isError = false, duration = 2500) {
        if (!feedbackMessage) return; // Safety check
        feedbackMessage.textContent = message;
        feedbackMessage.className = isError ? 'error' : 'success';
        console.log(`Feedback: [${isError ? 'Error' : 'Success'}] ${message}`);
        // Clear previous timeout if exists
        if (feedbackMessage.timeoutId) clearTimeout(feedbackMessage.timeoutId);
        // Set new timeout
        feedbackMessage.timeoutId = setTimeout(() => {
            if (feedbackMessage.textContent === message) { // Avoid clearing newer messages
                feedbackMessage.textContent = '';
                feedbackMessage.className = '';
            }
        }, duration);
    }

    // --- NEW: Load Rhyme Data Function ---
    async function loadRhymeData() {
        console.log("Loading rhyme data...");
        try {
            const response = await fetch('rhyme_data.json'); // Assumes file is in the same directory
            if (!response.ok) {
                // Handle file not found or other HTTP errors
                if (response.status === 404) {
                    throw new Error(`Rhyme data file ('rhyme_data.json') not found. Please run 'python process_rhymes.py'.`);
                } else {
                    throw new Error(`HTTP error loading rhyme data! status: ${response.status}`);
                }
            }
            rhymeData = await response.json();
            console.log(`Rhyme data loaded successfully (${Object.keys(rhymeData).length} entries).`);
            if(findRhymesButton) findRhymesButton.disabled = false; // Enable button if load succeeds
        } catch (error) {
            console.error("Could not load or parse rhyme_data.json:", error);
            rhymeData = {}; // Set to empty object to prevent errors later
            showFeedback(error.message || "Error: Could not load rhyme data. Rhyme finder disabled.", true, 7000);
            // Disable the rhyme button if data fails to load
            if(findRhymesButton) findRhymesButton.disabled = true;
        }
    }


    // --- Word Handling ---
    async function loadWords() { // << Make async because fetch is async
        console.log('Loading words...');
        try {
            let text;
            try {
                const response = await fetch('random word list.txt');
                 if (!response.ok) {
                    console.warn(`Could not fetch 'random word list.txt' (Status: ${response.status}). Falling back to defaults.`);
                    text = DEFAULT_WORD_LIST.join('\n');
                 } else {
                    text = await response.text();
                 }
            } catch (fetchError) {
                 console.warn(`Network error fetching 'random word list.txt': ${fetchError}. Falling back to defaults.`);
                 text = DEFAULT_WORD_LIST.join('\n');
            }

            // Use the case as read from the file (don't force lowercase here)
            // Filter empty lines and words <= 1 char
            wordList = text.split('\n').map(word => word.trim()).filter(word => word && word.length > 1);

            if (wordList.length === 0) {
                console.warn('Loaded word list is empty after processing, using defaults.');
                wordList = [...DEFAULT_WORD_LIST];
            } else if (wordList.length < 5 && text !== DEFAULT_WORD_LIST.join('\n')) {
                console.warn(`Word list has only ${wordList.length} words. Consider adding more to 'random word list.txt'.`);
            }

            console.log(`Using ${wordList.length} valid words.`);
            if(wordListTextarea) wordListTextarea.value = wordList.join('\n'); // Populate editor safely

            applyFiltersAndSort(); // Apply blacklist/sort based on initial mode
            changeWord('next', true, false); // Display the first word (isInitial = true)

        } catch (error) { // Catch unexpected errors during processing
            console.error('Unexpected error during word loading:', error);
            wordList = [...DEFAULT_WORD_LIST]; // Ensure defaults on any error
            if(wordListTextarea) wordListTextarea.value = wordList.join('\n');
            applyFiltersAndSort();
            changeWord('next', true, false);
        }
    }


    function applyFiltersAndSort() {
        filteredWordList = wordList.filter(word => !blacklist.has(word));
        const currentWordExists = filteredWordList.includes(currentWord);

        if (wordOrderMode === 'alphabetical') {
            filteredWordList.sort((a, b) => a.localeCompare(b));
        }
        // No sort needed for 'random' or 'sequential' (maintains load/filter order)

        // Find index after filtering/sorting
        if (currentWordExists) {
            currentWordIndex = filteredWordList.indexOf(currentWord);
        } else {
            // Current word removed (e.g., blacklisted) or list changed/was empty
            // Try to maintain position relative to history if possible, otherwise reset
             if (filteredWordList.length > 0) {
                  // Simplest reset: go to the start
                  currentWordIndex = 0;
                  currentWord = filteredWordList[currentWordIndex];
             } else {
                 currentWordIndex = -1; // List is empty
                 currentWord = "NO WORDS!";
             }
        }

        console.log(`Filters applied. Order: ${wordOrderMode}. Filtered count: ${filteredWordList.length}. Current Index: ${currentWordIndex}`);
    }


    // Core word changing function
     function changeWord(direction = 'next', isInitial = false, isVoiceMatch = false) {
         if (filteredWordList.length === 0) {
             displayWord("NO WORDS!");
             showFeedback("Word list empty or fully blacklisted!", true, 3000);
             return;
         }

         // --- Streak Handling ---
         if (!isInitial && !isVoiceMatch && (direction !== 'stay')) {
             updateStreak(false);
         }

         // Save history before changing index
         if (!isInitial && direction !== 'previous' && currentWordIndex >= 0 && currentWordIndex < filteredWordList.length) {
             if (direction !== 'stay' || history.length === 0 || history[history.length - 1] !== currentWordIndex) {
                history.push(currentWordIndex);
                if (history.length > MAX_HISTORY) history.shift();
             }
         }

         // Determine next index
         let nextIndex = currentWordIndex;
         if (direction === 'previous') {
             if (history.length > 0) {
                 nextIndex = history.pop();
                 console.log(`History pop: Retrieving index ${nextIndex}`);
             } else {
                 showFeedback("No more history", true, 1000);
                 console.log("History empty, cannot go previous.");
                 return;
             }
         } else if (direction === 'next') {
              switch (wordOrderMode) {
                 case 'random':
                     if (filteredWordList.length > 1) {
                         let tempIndex;
                         do { tempIndex = Math.floor(Math.random() * filteredWordList.length); }
                         while (tempIndex === currentWordIndex);
                         nextIndex = tempIndex;
                     } else { nextIndex = 0; }
                     break;
                 case 'alphabetical':
                 case 'sequential':
                 default:
                     nextIndex = (currentWordIndex === -1) ? 0 : (currentWordIndex + 1) % filteredWordList.length;
                     break;
              }
         } else if (direction === 'stay') {
              nextIndex = (currentWordIndex === -1 && filteredWordList.length > 0) ? 0 : currentWordIndex;
         }

         // Validate and set the new word
         if (nextIndex >= 0 && nextIndex < filteredWordList.length) {
             currentWordIndex = nextIndex;
             currentWord = filteredWordList[currentWordIndex];
             console.log(`Changing word. Direction: ${direction}, New Index: ${currentWordIndex}, Word: "${currentWord}"`);
             displayWord(currentWord);
         } else if (filteredWordList.length > 0 && direction !== 'previous' && !isInitial){
             console.warn(`Invalid index calculated (${nextIndex}) for direction ${direction}. Resetting to 0.`);
             currentWordIndex = 0;
             currentWord = filteredWordList[0];
             displayWord(currentWord);
         } else {
             console.log("Could not determine next word (list possibly empty or error).");
             if(filteredWordList.length === 0) displayWord("NO WORDS!");
             // Avoid displaying "ERROR" unless absolutely necessary
         }
         updateWordDisplayAnimation();
         lastMatchedWord = null;
     }


    // Updates the UI element
    function displayWord(word) {
        currentWord = word; // Update state
        if(wordDisplay) wordDisplay.textContent = word;

        // Update action icon states
        blacklistButton?.classList.toggle('active', blacklist.has(word));
        favoriteButton?.classList.toggle('active', favorites.has(word));
        // Rhyme button doesn't have an active state based on the word itself

        updateWordDisplayAnimation();
    }

     // Update word display animation based on mode
     function updateWordDisplayAnimation() {
         if (!wordDisplay || !cycleSpeedInput) return;
         wordDisplay.classList.remove('shrink-word');
         void wordDisplay.offsetWidth; // Reflow

         if (activationMode === 'timed') {
              const cycleDuration = parseInt(cycleSpeedInput.value, 10) || 10;
              wordDisplay.style.setProperty('--cycle-duration', `${cycleDuration}s`);
              wordDisplay.classList.add('shrink-word');
         } else {
             wordDisplay.style.removeProperty('--cycle-duration'); // Clean up style
         }
     }

    function toggleBlacklist() {
        if (!currentWord || currentWord === "NO WORDS!") return;
        const wordToToggle = currentWord;

        if (blacklist.has(wordToToggle)) {
            blacklist.delete(wordToToggle);
            showFeedback(`"${wordToToggle}" un-blacklisted.`);
        } else {
            blacklist.add(wordToToggle);
            showFeedback(`"${wordToToggle}" blacklisted!`, true);
            if (currentStreak > 0) updateStreak(false);
        }
        updateWordListsStorage(); // Save blacklist change
        const wasCurrentWordBlacklisted = blacklist.has(wordToToggle);
        applyFiltersAndSort(); // Re-filter and sort

        // Decide what to display next
        if (wasCurrentWordBlacklisted) {
            // The word just displayed was blacklisted, move to the next one
            console.log('Current word was blacklisted, changing word.');
            changeWord('next', false, false);
        } else {
            // Word was un-blacklisted OR a different word was blacklisted.
            // Check if the word *currently meant* to be displayed still exists
            if (filteredWordList.includes(currentWord)) {
                 // If it still exists (and wasn't the one blacklisted), refresh its display/state
                 currentWordIndex = filteredWordList.indexOf(currentWord);
                 displayWord(currentWord);
            } else if (filteredWordList.length > 0) {
                 // If the current word disappeared (e.g., was blacklisted indirectly?), change word
                 changeWord('next', false, false);
            } else {
                 // List became empty
                 displayWord("NO WORDS!");
            }
        }
    }


    function toggleFavorite() {
        if (!currentWord || currentWord === "NO WORDS!") return;
        const wordToToggle = currentWord;

        if (favorites.has(wordToToggle)) {
            favorites.delete(wordToToggle);
            showFeedback(`"${wordToToggle}" un-favorited.`);
        } else {
            favorites.add(wordToToggle);
            showFeedback(`"${wordToToggle}" favorited!`);
        }
        favoriteButton?.classList.toggle('active', favorites.has(wordToToggle)); // Update button immediately
        updateWordListsStorage(); // Save favorite change
    }


     // --- Activation Mode Management ---
    function setActivationMode(newMode) {
        if (!voiceModeButton || !timedModeButton) return;

        if (activationMode === newMode) {
            newMode = 'manual'; // Deactivate if clicking active mode again
        }

        const previousMode = activationMode;
        activationMode = newMode;
        console.log(`Activation mode changed from ${previousMode} to ${activationMode}`);

        // Stop previous mode's activity
        if (previousMode === 'timed' && timedInterval) {
            clearInterval(timedInterval);
            timedInterval = null;
            console.log('Timed interval cleared.');
            wordDisplay?.classList.remove('shrink-word'); // Remove animation if stopping timed mode
        }
        if (previousMode === 'voice' && isMicActive) {
            stopSpeechRecognition(true); // Pass flag to suppress "deactivated" message
            console.log('Requesting mic stop due to mode change.');
        }

        // Start new mode's activity
        if (activationMode === 'timed') {
            startTimedCycleInternal();
        } else if (activationMode === 'voice') {
            startSpeechRecognition();
        }

        updateActivationUI();
        updateWordDisplayAnimation(); // Ensure animation matches new mode
    }

    function updateActivationUI() {
        if (!voiceModeButton || !timedModeButton || !timedCycleOptionsDiv) return;

        voiceModeButton.classList.toggle('active', activationMode === 'voice' && isMicActive); // Reflect actual mic state too
        timedModeButton.classList.toggle('active', activationMode === 'timed');

        timedCycleOptionsDiv.style.display = (activationMode === 'timed') ? 'flex' : 'none';
    }

    // --- Speech Recognition Integration ---
    function setupSpeechRecognition() {
        window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!window.SpeechRecognition) {
            console.error("Speech Recognition API not supported.");
            if (voiceModeButton) {
                voiceModeButton.disabled = true;
                voiceModeButton.innerHTML = '<span class="light"></span><i class="fas fa-microphone-slash"></i> NOT SUPPORTED';
            }
            showFeedback("Speech Recognition not available in this browser.", true, 5000);
            return;
        }

        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            isMicActive = true; // Hardware state is ON
            console.log('Mic hardware ON.');
            updateActivationUI(); // Update UI to show active state
             if (activationMode === 'voice') {
                showFeedback("Voice Mode Activated", false, 2000);
             }
        };

        recognition.onresult = handleSpeechResult;

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error, event.message);
            let errorMsg = `Speech Error: ${event.error}`;
            if (event.error === 'no-speech') errorMsg = 'No speech detected.';
            else if (event.error === 'audio-capture') errorMsg = 'Mic Error. Check permissions/hardware.';
            else if (event.error === 'not-allowed') errorMsg = 'Mic access denied by user or browser.';
            showFeedback(errorMsg, true, 4000);

            isMicActive = false; // Assume hardware stopped on error
            updateActivationUI(); // Reflect inactive state
            if (event.error === 'not-allowed' || event.error === 'audio-capture') {
                 if (activationMode === 'voice') {
                     setActivationMode('manual'); // Force back to manual if critical error
                 }
            }
        };

        recognition.onend = () => {
            const wasMicActive = isMicActive; // Store previous hardware state
            isMicActive = false; // Hardware is now OFF
            console.log('Speech recognition hardware ended.');
            updateActivationUI(); // Reflect inactive state

            const micShouldBeActiveIntent = (activationMode === 'voice');

            // Only attempt restart if the INTENT was to be active and it stopped unexpectedly
            // (i.e., it was active, and the mode is still 'voice')
            if (wasMicActive && micShouldBeActiveIntent && recognition) {
                console.log('Recognition ended unexpectedly while in voice mode, attempting restart...');
                setTimeout(() => {
                    if (activationMode === 'voice' && !isMicActive) { // Double check state
                        try {
                            recognition.start(); // onstart will set isMicActive = true
                            console.log('Speech recognition hardware restarted.');
                        } catch (err) {
                             console.error('Error restarting recognition hardware:', err);
                             setActivationMode('manual'); // Give up if restart fails
                             showFeedback("Failed to restart mic.", true, 4000);
                        }
                    } else {
                        console.log('Activation mode changed or mic already restarted during timeout. Not restarting mic.');
                    }
                }, 500);
            } else {
                 console.log('Mic ended intentionally or mode changed.');
            }
        };
    }


    function startSpeechRecognition() {
        if (!recognition) {
             console.warn("Speech recognition not initialized."); return;
        }
        if (isMicActive) {
            console.log("StartSpeechRecognition called but mic already active."); return;
        }
        try {
            finalTranscript = '';
            interimTranscript = '';
            if(transcriptContainer) transcriptContainer.innerHTML = '';
            console.log("Requesting speech recognition hardware start...");
            recognition.start();
             // UI update and feedback handled by onstart
        } catch (error) {
            console.error("Error starting speech recognition hardware:", error);
            isMicActive = false; // Ensure flag is false on error
            updateActivationUI(); // Reflect failed state
            setActivationMode('manual'); // Revert mode on failure
            showFeedback("Could not start mic. Check permissions?", true, 4000);
        }
    }

    function stopSpeechRecognition(isModeChange = false) {
        if (!recognition) return;
        if (!isMicActive) {
            // console.log("StopSpeechRecognition called but mic already inactive.");
            return;
        }
        try {
            console.log('Requesting speech recognition hardware stop.');
            recognition.stop(); // onend will set isMicActive = false and update UI
             // Provide feedback immediately only if manually stopped (not part of mode change)
            if (!isModeChange) {
                showFeedback("Voice Mode Deactivated", false, 1500);
            }
        } catch (e) {
            console.warn("Error during recognition.stop(): ", e);
            // If stop() errors, force state and UI update
            isMicActive = false;
            updateActivationUI();
            if (activationMode === 'voice' && !isModeChange) setActivationMode('manual');
        }
    }


    // Handle incoming speech results
     function handleSpeechResult(event) {
         let currentInterimTranscript = '';
         let currentFinalTranscript = '';

         for (let i = event.resultIndex; i < event.results.length; ++i) {
             const transcriptPart = event.results[i][0].transcript;
             if (event.results[i].isFinal) {
                 currentFinalTranscript += transcriptPart.trim() + ' ';
             } else {
                 currentInterimTranscript += transcriptPart;
             }
         }
         currentFinalTranscript = currentFinalTranscript.trim();
         currentInterimTranscript = currentInterimTranscript.trim();

         // --- Transcript Display Logic ---
         processTranscriptLine(currentFinalTranscript, true); // Process final part
         processTranscriptLine(currentInterimTranscript, false); // Process interim part

         // --- Word Matching ---
         const utteranceToCheck = (currentFinalTranscript || currentInterimTranscript).toLowerCase();
         const targetWord = currentWord.toLowerCase();

         if (!targetWord || targetWord === "no words!" || targetWord.length < 2 || !utteranceToCheck || activationMode !== 'voice' || !isMicActive) {
            return; // Exit if invalid state
         }

         const wordsInUtterance = utteranceToCheck.match(/\b(\w+)\b/g) || [];

         for (const spokenWord of wordsInUtterance) {
             if (spokenWord.length < 2) continue;

             const similarity = levenshteinDistance(spokenWord, targetWord);

             if (similarity >= LEVENSHTEIN_THRESHOLD && targetWord !== lastMatchedWord) {
                  console.log(`MATCH: "${spokenWord}" (${similarity.toFixed(2)}) vs "${targetWord}"`);
                  lastMatchedWord = targetWord; // Debounce

                  const pointsEarned = 10 + currentStreak * 2;
                  updateStreak(true);
                  updateScore(pointsEarned);
                  showFeedback(`HIT! +${pointsEarned} pts`);
                  triggerConfetti();

                  if (activationMode === 'voice') {
                      setTimeout(() => {
                          if (activationMode === 'voice') { // Double check mode
                             changeWord('next', false, true); // isVoiceMatch = true
                          }
                     }, 150);
                  }
                  break; // Match found
             }
         }
     }

     // Display transcript line (Simplified: Update/add interim, add final)
     function processTranscriptLine(text, isFinal) {
         if (!text || !transcriptContainer) return;
         text = text.trim();
         if (!text) return;

         const displayLine = text; // Simple text display

         // Manage interim line
         let interimElement = transcriptContainer.querySelector('.interim');
         if (!isFinal) {
             if (interimElement) {
                 if (interimElement.textContent !== displayLine) {
                      interimElement.textContent = displayLine; // Update existing
                 }
             } else {
                 // Create new interim line if none exists
                 interimElement = document.createElement('div');
                 interimElement.classList.add('interim');
                 interimElement.textContent = displayLine;
                 transcriptContainer.insertBefore(interimElement, transcriptContainer.firstChild);
             }
         } else {
             // If final text arrived, remove old interim and add new final
             if (interimElement) {
                 interimElement.remove();
             }
             // Add the final line
             const finalElement = document.createElement('div');
             finalElement.classList.add('final'); // Add 'final' class if needed for styling
             finalElement.textContent = displayLine;
             transcriptContainer.insertBefore(finalElement, transcriptContainer.firstChild);

             // Limit total lines
             while (transcriptContainer.children.length > MAX_TRANSCRIPT_LINES) {
                 transcriptContainer.removeChild(transcriptContainer.lastChild);
             }
             updateFrequencies(text); // Update frequencies only on final transcripts
         }

         transcriptContainer.scrollTop = 0; // Scroll to newest
     }


    // --- Timed Cycle Integration ---
    function startTimedCycleInternal() {
        if (timedInterval) clearInterval(timedInterval);
        if (!cycleSpeedInput) return; // Safety check

        let cycleDuration = parseInt(cycleSpeedInput.value, 10) || 10;
        if (cycleDuration < 3) cycleDuration = 3; // Enforce minimum
        cycleSpeedInput.value = cycleDuration; // Update input if clamped

        console.log(`Starting timed cycle. Interval: ${cycleDuration}s.`);

        changeWord('next', false, false); // Start cycle immediately
        updateWordDisplayAnimation(); // Apply animation

        timedInterval = setInterval(() => {
            if (activationMode === 'timed') {
                 changeWord('next', false, false);
                 // updateWordDisplayAnimation(); // changeWord calls this now
            } else {
                 if (timedInterval) clearInterval(timedInterval);
                 timedInterval = null;
                 console.warn("Timed interval running detected outside of timed mode. Stopping.");
                 wordDisplay?.classList.remove('shrink-word'); // Ensure animation stops
            }
        }, cycleDuration * 1000);
        showFeedback("Timed Cycle Activated", false, 1500);
    }


    // --- Word Order Handling ---
    function handleWordOrderChange() {
        const newOrder = wordOrderSelect?.value;
        if (newOrder && newOrder !== wordOrderMode) {
            wordOrderMode = newOrder;
            console.log(`Word order mode changed to: ${wordOrderMode}`);
            applyFiltersAndSort();
            changeWord('stay', false, false); // Re-display word at potentially new index
            saveSettings(); // Persist word order preference
        }
    }


    // --- BPM ---
    function handleBpmClick() {
        const now = Date.now();
        bpmClickTimestamps.push(now);
        if (bpmClickTimestamps.length > BPM_AVERAGE_COUNT + 1) bpmClickTimestamps.shift();

        // Brief shake effect
        document.body.classList.remove('screen-shaking');
        void document.body.offsetWidth;
        document.body.classList.add('screen-shaking');

        if (bpmClickTimestamps.length > 1) calculateBpm();

        if (bpmClickTimestamps.length >= BPM_AVERAGE_COUNT && bpm > 0) {
            if (!isBpmLockedShaking) startWordDisplayShake();
        } else {
            if (isBpmLockedShaking) stopWordDisplayShake();
        }
    }

    function calculateBpm() {
        if (bpmClickTimestamps.length < 2) return;
        const relevantTimestamps = bpmClickTimestamps.slice(-(BPM_AVERAGE_COUNT + 1));
        const intervals = relevantTimestamps.slice(1).map((ts, i) => ts - relevantTimestamps[i]);
        if (intervals.length === 0) return;

        const reasonableIntervals = intervals.filter(interval => interval < 2000);
        if (reasonableIntervals.length < Math.min(2, intervals.length) ) return;

        const averageInterval = reasonableIntervals.reduce((sum, interval) => sum + interval, 0) / reasonableIntervals.length;
        if (averageInterval > 0) {
            const newBpm = Math.round(60000 / averageInterval);
             if (newBpm !== bpm) { // Only update if BPM actually changes
                bpm = newBpm;
                console.log(`Calculated BPM: ${bpm}`);
                updateBpmDisplay();
                startBeatAnimation();
             }
        }
    }

    function updateBpmDisplay() {
        if(bpmDisplay) bpmDisplay.textContent = bpm;
        const beatIntervalSeconds = bpm > 0 ? 60 / bpm : 0.5;
        document.documentElement.style.setProperty('--beat-interval', `${beatIntervalSeconds}s`);
        if (wordDisplayContainer?.classList.contains('buzz-with-bpm')) {
            wordDisplayContainer.style.animationDuration = `${beatIntervalSeconds}s`;
        }
        saveSettings();
    }

    function adjustBpm(amount) {
        const newBpm = Math.max(0, bpm + amount);
        if (newBpm !== bpm) {
            bpm = newBpm;
            bpmClickTimestamps = []; // Clear tap history
            updateBpmDisplay();
            if (bpm > 0) {
                 startBeatAnimation();
                 if (!isBpmLockedShaking) startWordDisplayShake();
                 document.body.classList.remove('screen-shaking');
            } else {
                 stopBpm(); // Use stopBpm for consistency
            }
            console.log(`BPM adjusted to ${bpm}.`);
        }
    }

    function stopBpm() {
        if (bpm === 0 && !beatIntervalId && !isBpmLockedShaking) return; // No need to stop if already stopped

        bpm = 0;
        bpmClickTimestamps = [];
        updateBpmDisplay();
        stopBeatAnimation();
        stopWordDisplayShake();
        document.body.classList.remove('screen-shaking');
        console.log('BPM stopped and reset.');
        showFeedback("BPM Stopped", false, 1000);
        saveSettings(); // Save the stopped state
    }

    function startBeatAnimation() {
        stopBeatAnimation();
        if (bpm <= 0) return;
        const beatIntervalMs = (60 / bpm) * 1000;
        const totalBoxes = beatGridRows * beatGridCols;
        if (totalBoxes <= 0 || !isFinite(beatIntervalMs) || beatIntervalMs <= 0) return;

        currentBeat = 0;
        updateBeatGridVisuals(totalBoxes); // Activate first beat

        try {
             beatIntervalId = setInterval(() => {
                 currentBeat = (currentBeat + 1) % totalBoxes;
                 updateBeatGridVisuals(totalBoxes);
             }, beatIntervalMs);
             // console.log(`Beat animation started with interval ${beatIntervalMs}ms`);
        } catch (e) { console.error("Error starting beat interval: ", e)}
    }

    function stopBeatAnimation() {
        if (beatIntervalId) clearInterval(beatIntervalId);
        beatIntervalId = null;
        if(fourCountContainer) {
            fourCountContainer.querySelectorAll('.beat-box').forEach(box => box.classList.remove('active'));
        }
    }

     function updateBeatGridVisuals(totalBoxes) {
         if(!fourCountContainer) return;
         const boxes = fourCountContainer.querySelectorAll('.beat-box');
         if (boxes.length !== totalBoxes) {
             console.warn(`Beatbox count mismatch (${boxes.length} vs ${totalBoxes}), regenerating grid`);
             updateGrid(); // Regenerate grid if structure changed
             return; // updateGrid will restart animation if needed
         }
         boxes.forEach((box, index) => {
             box.classList.toggle('active', index === currentBeat);
         });
     }

    function updateGrid() {
        if(!fourCountContainer) return;
        console.log(`Updating beat grid: ${beatGridRows}r x ${beatGridCols}c`);
        fourCountContainer.innerHTML = '';
        fourCountContainer.style.gridTemplateColumns = `repeat(${beatGridCols}, 1fr)`;
        const totalBoxes = beatGridRows * beatGridCols;
        if (totalBoxes > 64 || totalBoxes <= 0) return; // Prevent invalid grid

        for (let i = 0; i < totalBoxes; i++) {
            const box = document.createElement('div'); box.classList.add('beat-box');
            fourCountContainer.appendChild(box);
        }
        if(rowCountDisplay) rowCountDisplay.textContent = beatGridRows;
        if(colCountDisplay) colCountDisplay.textContent = beatGridCols;
        saveSettings();
        // Restart animation if BPM is active, stop otherwise
        if (bpm > 0) startBeatAnimation(); else stopBeatAnimation();
    }

    function updateRowCount(delta) {
        const newRows = beatGridRows + delta;
        if (newRows >= 1 && newRows <= 8) { beatGridRows = newRows; updateGrid(); }
    }
    function updateColumnCount(delta) {
        const newCols = beatGridCols + delta;
        if (newCols >= 1 && newCols <= 8) { beatGridCols = newCols; updateGrid(); }
    }


    // --- Shaking Effects ---
     function startWordDisplayShake() { // Starts the buzz
         if (bpm > 0 && wordDisplayContainer && !isBpmLockedShaking) {
             wordDisplayContainer.classList.add('buzz-with-bpm');
             const beatIntervalSeconds = 60 / bpm;
             wordDisplayContainer.style.animationDuration = `${beatIntervalSeconds}s`;
             isBpmLockedShaking = true; // Update state flag
             // console.log("Starting word buzz effect");
         }
     }

     function stopWordDisplayShake() { // Stops the buzz
         if (wordDisplayContainer && isBpmLockedShaking) {
             wordDisplayContainer.classList.remove('buzz-with-bpm');
             wordDisplayContainer.style.animationDuration = '';
             isBpmLockedShaking = false; // Update state flag
             // console.log("Stopping word buzz effect");
         }
     }


    // --- Word Frequencies ---
    function updateFrequencies(text) {
        if (!text || !frequentWordsContainer) return;
        const words = text.toLowerCase().match(/\b(\w{2,})\b/g);
        if (!words) return;
        let changed = false;
        words.forEach(word => {
            if (!blacklist.has(word)) { // Don't count blacklisted words
                wordFrequencies[word] = (wordFrequencies[word] || 0) + 1;
                changed = true;
            }
        });
        if(changed) {
            displayFrequencies();
            // Debounce saving frequencies
            clearTimeout(window.freqSaveTimeout);
            window.freqSaveTimeout = setTimeout(saveSettings, 2000);
        }
    }

    function displayFrequencies() {
        if(!frequentWordsContainer) return;
        const sortedFrequencies = Object.entries(wordFrequencies)
            .filter(([word, count]) => count >= 2) // Only show words spoken 2+ times
            .sort(([, countA], [, countB]) => countB - countA);

        frequentWordsContainer.innerHTML = sortedFrequencies.length === 0 ? '<p style="opacity: 0.5;">Speak more to track common words...</p>' : ''; // Clear or add placeholder

        sortedFrequencies.slice(0, 20).forEach(([word, count]) => { // Limit displayed words
            const span = document.createElement('span'); span.textContent = `${word} (${count})`; span.classList.add('freq-word');
            if (count >= 5) span.classList.add('freq-5'); else if (count >= 4) span.classList.add('freq-4');
            else if (count >= 3) span.classList.add('freq-3'); else span.classList.add('freq-2');
            frequentWordsContainer.appendChild(span);
        });
    }


    // --- Persistence (LocalStorage) ---
    function saveSettings() {
        try {
            const settings = {
                blacklist: Array.from(blacklist),
                favorites: Array.from(favorites),
                wordFrequencies: wordFrequencies,
                beatGridRows: beatGridRows,
                beatGridCols: beatGridCols,
                cycleSpeed: cycleSpeedInput?.value || 10,
                bpm: bpm,
                wordOrderMode: wordOrderMode,
            };
            localStorage.setItem('freestyleArenaSettings_v3', JSON.stringify(settings));
        } catch (e) { console.error("Error saving settings:", e); }
    }

    function loadSettings() {
        try { // Add try-catch around the whole load process
            const savedSettings = localStorage.getItem('freestyleArenaSettings_v3');
            if (savedSettings) {
                 const settings = JSON.parse(savedSettings); // Parse inside try
                 blacklist = new Set(settings.blacklist || []);
                 favorites = new Set(settings.favorites || []);
                 wordFrequencies = settings.wordFrequencies || {};
                 beatGridRows = settings.beatGridRows || 1;
                 beatGridCols = settings.beatGridCols || 4;
                 if(cycleSpeedInput) cycleSpeedInput.value = settings.cycleSpeed || 10;
                 if(cycleSpeedSlider) cycleSpeedSlider.value = settings.cycleSpeed || 10;
                 bpm = settings.bpm || 0;
                 wordOrderMode = settings.wordOrderMode || 'random';
                 if(wordOrderSelect) wordOrderSelect.value = wordOrderMode;

                 if(bpm > 0) {
                      updateBpmDisplay(); // Update display and CSS var
                      // Don't automatically start animations/buzz on load, let user interaction trigger
                 }
                 console.log('Settings loaded.');
             } else {
                 console.log('No saved settings found, using defaults.');
                 resetToDefaults(); // Apply defaults if no settings found
             }
        } catch (error) {
             console.error('Failed to load or parse settings:', error);
             localStorage.removeItem('freestyleArenaSettings_v3'); // Clear potentially corrupted data
             resetToDefaults(); // Apply defaults on error
        }
    }


    function resetToDefaults() { // Resets non-gamification settings
        console.log("Resetting settings to defaults.");
        blacklist = new Set(); favorites = new Set(); wordFrequencies = {};
        beatGridRows = 1; beatGridCols = 4; bpm = 0;
        if(cycleSpeedInput) cycleSpeedInput.value = 10;
        if(cycleSpeedSlider) cycleSpeedSlider.value = 10;
        wordOrderMode = 'random';
        if(wordOrderSelect) wordOrderSelect.value = wordOrderMode;
        updateBpmDisplay();
        updateGrid();
        displayFrequencies();
        if(activationMode !== 'manual') setActivationMode('manual'); // Go to manual
        else updateActivationUI(); // Just update UI if already manual
        stopWordDisplayShake();
        // Reset score/streak? Usually done separately via resetGamification()
    }

    function updateWordListsStorage() { // Saves only blacklist/favorites
        try {
            let currentSettings = {};
            try { // Inner try for reading existing settings
                currentSettings = JSON.parse(localStorage.getItem('freestyleArenaSettings_v3') || '{}');
            } catch (e) { console.warn("Could not parse existing settings before list save:", e); }

            const newSettings = {
                 ...currentSettings, // Preserve other settings
                 blacklist: Array.from(blacklist),
                 favorites: Array.from(favorites)
            };
            localStorage.setItem('freestyleArenaSettings_v3', JSON.stringify(newSettings));
        } catch (e) { console.error("Error saving blacklist/favorites:", e); }
    }


    // --- Modals ---
    function showFavoritesModal() {
        if(!favoritesModal || !favoritesListUl) return;
        favoritesListUl.innerHTML = '';
        const sortedFavorites = Array.from(favorites).sort();

        if (sortedFavorites.length === 0) {
             favoritesListUl.innerHTML = '<li>No favorited words yet.</li>';
        } else {
            sortedFavorites.forEach(word => {
                const li = document.createElement('li'); li.textContent = word;
                const removeBtn = document.createElement('button'); removeBtn.innerHTML = '<i class="fas fa-times"></i>'; removeBtn.title="Remove Favorite"; removeBtn.classList.add("icon-button", "tiny-button", "red-button");
                removeBtn.onclick = () => {
                    const removingCurrent = (word === currentWord);
                    favorites.delete(word);
                    updateWordListsStorage();
                    showFavoritesModal(); // Refresh list
                    if(removingCurrent && favoriteButton) favoriteButton.classList.remove('active');
                    showFeedback(`"${word}" un-favorited.`);
                };
                li.appendChild(removeBtn); favoritesListUl.appendChild(li);
            });
        }
        favoritesModal.style.display = 'block';
    }

    function clearAllFavorites() {
        if (favorites.size === 0) {
            showFeedback("No favorites to clear.", true, 1500);
            return;
        }
        if (confirm('Are you sure you want to remove ALL favorited words?')) {
            const currentWordWasFav = favorites.has(currentWord);
            favorites.clear();
            updateWordListsStorage();
            showFavoritesModal(); // Refresh list
            if(currentWordWasFav && favoriteButton) favoriteButton.classList.remove('active');
            showFeedback("All favorites cleared!", false, 1500);
        }
    }

    function showWordListEditor() {
        if (!wordListEditorModal || !wordListTextarea) return;
        wordListTextarea.value = wordList.join('\n'); // Ensure current list

        // Try scrolling to current word
        if (currentWord && currentWord !== "NO WORDS!") {
            const lines = wordListTextarea.value.split('\n');
            let lineIndex = -1;
            // Find the first exact match (case-sensitive, as displayed)
            lineIndex = lines.findIndex(line => line === currentWord);

            if (lineIndex !== -1) {
                 setTimeout(() => { // Allow modal to render
                      try {
                          const avgLineHeight = wordListTextarea.scrollHeight / Math.max(1, lines.length);
                          const targetScrollTop = Math.max(0, lineIndex * avgLineHeight - (wordListTextarea.clientHeight / 3));
                          wordListTextarea.scrollTop = targetScrollTop;
                          // Optional: Select the text
                          // const startPos = wordListTextarea.value.indexOf(currentWord);
                          // if (startPos >= 0) {
                          //     wordListTextarea.focus();
                          //     wordListTextarea.setSelectionRange(startPos, startPos + currentWord.length);
                          // }
                      } catch (e) { console.warn("Error calculating scroll for editor:", e); }
                 }, 100);
             } else {
                  wordListTextarea.scrollTop = 0; // Scroll to top if not found
             }
        } else {
             wordListTextarea.scrollTop = 0;
        }

        wordListEditorModal.style.display = 'block';
    }

    function saveWordListChanges() {
        if(!wordListTextarea) return;
        const newWords = wordListTextarea.value.split('\n').map(w => w.trim()).filter(w => w && w.length > 1);
        if (newWords.length > 0) {
            wordList = newWords; // Update the main list
            applyFiltersAndSort(); // Re-filter (applies blacklist) and sort

            // Check if the *currently displayed* word still exists in the *filtered* list
            const currentWordStillExists = filteredWordList.includes(currentWord);
            if (currentWordStillExists) {
                 currentWordIndex = filteredWordList.indexOf(currentWord); // Update index if needed
                 changeWord('stay', false, false); // Refresh display at current index
            } else {
                 // If current word removed or no longer valid, go to start of new list
                 changeWord('next', true, false); // isInitial=true effectively resets index
            }
            closeModal(wordListEditorModal);
            showFeedback(`Word list updated for session (${filteredWordList.length} valid words).`, false, 3000);
             // Note: This doesn't save the list permanently, only applies for the session.
             // It also doesn't automatically re-run the rhyme processing.
        } else {
            showFeedback('Word list cannot be empty! Please add valid words.', true, 3000);
        }
    }

    function closeModal(modal) {
         if(modal) {
             modal.style.display = 'none';
             // Clear rhyme results when closing that specific modal
             if (modal.id === 'rhyme-finder-modal') {
                 if(rhymeResultsList) rhymeResultsList.innerHTML = '';
                 if(rhymePatternDisplay) rhymePatternDisplay.textContent = '-';
                 if(rhymeSourceWordDisplay) rhymeSourceWordDisplay.textContent = '';
                 if(rhymeNoResults) rhymeNoResults.style.display = 'none';
             }
         }
     }

    // --- NEW: Rhyme Finder Functions ---
    function getRhymePattern(word) {
        if (!rhymeData || !word) return null;
        // Lookup uses the exact case from wordList, matching keys in rhyme_data.json
        // (assuming process_rhymes.py stored keys matching wordList case)
        // If process_rhymes.py stored lowercase keys, use word.toLowerCase() here.
        return rhymeData[word] || null;
    }

    function showRhymeFinder() {
        if (!rhymeFinderModal || !rhymeData || !currentWord || currentWord === "NO WORDS!") {
            if (!rhymeData) {
                showFeedback("Rhyme data not loaded. Cannot find rhymes.", true);
            } else {
                showFeedback("Cannot find rhymes for the current word.", true);
            }
            return;
        }

        const wordPattern = getRhymePattern(currentWord);

        if (rhymeSourceWordDisplay) rhymeSourceWordDisplay.textContent = currentWord;
        if (rhymeResultsList) rhymeResultsList.innerHTML = ''; // Clear previous
        if (rhymeNoResults) rhymeNoResults.style.display = 'none'; // Hide no results msg

        if (!wordPattern) {
            if(rhymePatternDisplay) rhymePatternDisplay.textContent = "N/A";
            if(rhymeResultsList) rhymeResultsList.innerHTML = '<li>Phonetic data not available for this word.</li>';
            console.warn(`Rhyme pattern not found for current word: ${currentWord}`);
        } else {
            const patternString = wordPattern.join('-'); // e.g., "UW-IY"
            if(rhymePatternDisplay) rhymePatternDisplay.textContent = patternString;

            console.log(`Finding rhymes for "${currentWord}" with pattern: ${patternString}`);

            // Search through the *currently filtered* list
            const matchingWords = filteredWordList.filter(word => {
                if (word === currentWord) return false; // Don't list the word itself
                const otherPattern = getRhymePattern(word);
                // Compare patterns (simple string comparison of joined arrays works)
                return otherPattern && otherPattern.join('-') === patternString;
            });

            if (matchingWords.length > 0) {
                matchingWords.sort(); // Sort alphabetically
                matchingWords.forEach(match => {
                    const li = document.createElement('li');
                    li.textContent = match;
                    rhymeResultsList?.appendChild(li);
                });
                console.log(`Found ${matchingWords.length} matching words.`);
            } else {
                if (rhymeNoResults) rhymeNoResults.style.display = 'block';
                console.log(`No other matching words found for pattern ${patternString}.`);
            }
        }

        rhymeFinderModal.style.display = 'block';
    }


    // --- Random Number Generator ---
    function generateRandomNumbers() {
        if (!rngDigitsInput || !rngSetsInput || !rngDisplayArea) return;

        let numDigits = parseInt(rngDigitsInput.value, 10);
        let numSets = parseInt(rngSetsInput.value, 10);
        const isSurprise = rngSurpriseCheckbox?.checked;

        if (isSurprise) {
            numDigits = Math.floor(Math.random() * 7) + 1; // 1 to 7 digits
            numSets = Math.floor(Math.random() * 5) + 1;   // 1 to 5 sets
            rngDigitsInput.value = numDigits; // Update inputs
            rngSetsInput.value = numSets;
            console.log(`Surprise! Generating ${numSets} set(s) of ${numDigits}-digit numbers.`);
        }

        // Validate inputs
        numDigits = Math.max(1, Math.min(numDigits || 3, 7));
        numSets = Math.max(1, Math.min(numSets || 1, 5));
        rngDigitsInput.value = numDigits; // Ensure input reflects clamped value
        rngSetsInput.value = numSets;


        rngDisplayArea.innerHTML = ''; // Clear previous

        for (let s = 0; s < numSets; s++) {
            const setDiv = document.createElement('div');
            setDiv.classList.add('rng-set');

            // Calculate min/max correctly
            const min = (numDigits === 1) ? 0 : Math.pow(10, numDigits - 1);
            const max = Math.pow(10, numDigits) - 1;
            const randomNum = Math.floor(Math.random() * (max - min + 1)) + min;
            const randomNumberString = randomNum.toString().padStart(numDigits, '0');

            // Create slots and animate
            for (let i = 0; i < numDigits; i++) {
                const slotDiv = document.createElement('div');
                slotDiv.classList.add('rng-slot');
                const numberSpan = document.createElement('span');
                numberSpan.textContent = '?'; // Placeholder
                slotDiv.appendChild(numberSpan);
                setDiv.appendChild(slotDiv);

                // Staggered reveal animation
                const currentDigit = randomNumberString[i]; // Capture digit for closure
                setTimeout(() => {
                    slotDiv.classList.add('spinning');
                    setTimeout(() => {
                        numberSpan.textContent = currentDigit;
                        slotDiv.classList.remove('spinning');
                    }, 150);
                }, 200 + i * 70 + s * 120);
            }
            rngDisplayArea.appendChild(setDiv);
        }
    }


    // --- Utility Functions ---
    function levenshteinDistance(a, b) {
        if (!a || !b) return 0.0;
        a = a.toLowerCase(); b = b.toLowerCase();
        if (a.length === 0) return b.length === 0 ? 1.0 : 0.0;
        if (b.length === 0) return 0.0;

        const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
        for (let i = 0; i <= a.length; i += 1) matrix[0][i] = i;
        for (let j = 0; j <= b.length; j += 1) matrix[j][0] = j;
        for (let j = 1; j <= b.length; j += 1) {
            for (let i = 1; i <= a.length; i += 1) {
                const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min( matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + indicator );
            }
        }
        const distance = matrix[b.length][a.length];
        const maxLength = Math.max(a.length, b.length);
        if (maxLength === 0) return 1.0;
        return 1.0 - (distance / maxLength);
    }

    // Syllable counting is removed as it's not used directly anymore


    function triggerConfetti() {
        if (typeof confetti === 'function') {
            confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ['#00ffff', '#ff00ff', '#ffffff', '#f9a826'] });
        } else {
            console.warn("Confetti function not found.");
        }
    }


    // --- Attach Event Listeners ---
     function attachEventListeners() {
         // Word Navigation & Actions
         prevWordButton?.addEventListener('click', () => changeWord('previous', false, false));
         nextWordButton?.addEventListener('click', () => changeWord('next', false, false));
         blacklistButton?.addEventListener('click', toggleBlacklist);
         favoriteButton?.addEventListener('click', toggleFavorite);
         findRhymesButton?.addEventListener('click', showRhymeFinder); // << NEW Listener

         // Word Order Setting
         wordOrderSelect?.addEventListener('change', handleWordOrderChange);

         // Activation Mode Buttons
         voiceModeButton?.addEventListener('click', () => setActivationMode('voice'));
         timedModeButton?.addEventListener('click', () => setActivationMode('timed'));

         // BPM Controls
         bpmButton?.addEventListener('click', handleBpmClick);
         bpmAdjustPlus?.addEventListener('click', () => adjustBpm(1));
         bpmAdjustMinus?.addEventListener('click', () => adjustBpm(-1));
         stopBpmButton?.addEventListener('click', stopBpm);
         addRowButton?.addEventListener('click', () => updateRowCount(1));
         removeRowButton?.addEventListener('click', () => updateRowCount(-1));
         addColButton?.addEventListener('click', () => updateColumnCount(1));
         removeColButton?.addEventListener('click', () => updateColumnCount(-1));

         // RNG Controls
         generateNumbersButton?.addEventListener('click', generateRandomNumbers);

         // Modal Triggers & Actions
         favoritesButton?.addEventListener('click', showFavoritesModal);
         closeFavoritesModal?.addEventListener('click', () => closeModal(favoritesModal));
         clearFavoritesButton?.addEventListener('click', clearAllFavorites);
         editWordListButton?.addEventListener('click', showWordListEditor);
         closeWordListEditor?.addEventListener('click', () => closeModal(wordListEditorModal));
         saveWordListButton?.addEventListener('click', saveWordListChanges);
         closeRhymeModalButton?.addEventListener('click', () => closeModal(rhymeFinderModal)); // << NEW Listener

         // Global Listeners
         window.addEventListener('click', (event) => { // Close modals on outside click
            if (event.target == favoritesModal) closeModal(favoritesModal);
            if (event.target == wordListEditorModal) closeModal(wordListEditorModal);
            if (event.target == rhymeFinderModal) closeModal(rhymeFinderModal); // << Close Rhyme Modal
         });
         window.addEventListener('beforeunload', saveSettings); // Save persistent settings on exit
         console.log('Event listeners attached.');
     }

    // Start the application initialization process
    initializeApp();

}); // End of DOMContentLoaded listener

console.log('Game script loaded (module).')
