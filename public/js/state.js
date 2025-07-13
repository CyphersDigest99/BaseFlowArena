/**
 * @fileoverview Central State Manager for BaseFlowArena Application
 * 
 * This module serves as the single source of truth for all application state.
 * It manages word lists, user interactions, BPM/rhythm tracking, voice recognition,
 * rhyme navigation, and various UI settings. The state object is exported and
 * shared across all modules to maintain consistency and enable real-time updates
 * throughout the application.
 * 
 * Key responsibilities:
 * - Word management and filtering
 * - Voice recognition state
 * - BPM detection and beat tracking
 * - Rhyme navigation and data
 * - User preferences and settings
 * - Gamification elements (score, streaks)
 * - UI state management
 */

// js/state.js
// Holds the shared application state.

export const state = {
    // Word State - Core word management and navigation
    wordList: [], // Master list of all available words for freestyling
    filteredWordList: [], // Current subset of words based on active filters
    currentWord: '', // Currently displayed/active word
    currentWordIndex: -1, // Position of current word in filtered list
    wordOrderMode: 'random', // 'random', 'alphabetical', 'sequential'
    history: [], // Recent words that have been displayed
    MAX_HISTORY: 20, // Maximum number of words to keep in history

    // Lists & Data - User preferences and word relationships
    blacklist: new Set(), // Words user has chosen to exclude
    favorites: new Set(), // Words user has marked as favorites
    wordFrequencies: {}, // Tracks how often each word has been used
    rhymeData: null, // Loaded rhyme dictionary data
    rejectedRhymes: {}, // { baseWord: Set('rejected1', 'rejected2'), ... }
    manualRhymes: {},   // { baseWord: Set('manual1', 'manual2'), ... }

    // Activation & Modes - Voice recognition and interaction modes
    activationMode: 'manual', // 'manual', 'voice', 'timed'
    isMicActive: false, // Tracks actual hardware state
    recognition: null, // SpeechRecognition instance
    lastMatchedWord: null, // Debounce for voice match
    finalTranscript: '', // Completed speech recognition text
    interimTranscript: '', // Ongoing speech recognition text
    transcriptTimeout: null, // Timer for clearing transcript
    timedInterval: null, // Interval for timed word cycling
    voiceRhymeMode: false, // Controls whether voice matches should navigate rhymes

    // BPM / Rhythm - Beat detection and timing
    bpm: 0, // Current detected beats per minute
	bpmMultiplier: 1, // Default multiplier is 1x (no button selected)
	isDetectingBpm: false, // Flag for UI feedback during BPM detection
    bpmClickTimestamps: [], // Array of click times for BPM calculation
    BPM_AVERAGE_COUNT: 10, // Number of clicks to average for BPM
    beatIntervalId: null, // Timer ID for beat synchronization
    currentBeat: 0, // Current beat position in the grid
    beatGridRows: 1, // Number of rows in the beat grid
    beatGridCols: 4, // Number of columns in the beat grid
    isBpmLockedShaking: false, // For word display buzz effect

    // Gamification - User engagement metrics
    score: 0, // User's current score
    currentStreak: 0, // Current consecutive successful interactions

    // Settings - User preferences (Reflected in UI, saved/loaded)
    rngDigits: 3, // Number of digits for random number generation
    rngSets: 1, // Number of random number sets to generate
    rngSurprise: false, // Whether to use surprise mode for RNG
    cycleSpeed: 10, // Speed of automatic word cycling
    minSyllables: 0, // Syllable filter minimum (0 = no limit)
    maxSyllables: 0, // Syllable filter maximum (0 = no limit)

    // Constants - Application configuration values
    LEVENSHTEIN_THRESHOLD: 0.7, // Threshold for fuzzy word matching
    DEFAULT_WORD_LIST: ["practice", "flow", "freestyle", "rhyme", "beat", "mic", "word", "speak", "rap", "skill", "game", "streak", "score", "arena", "threejs", "road", "effect", "background", "visual", "dynamic"], // Fallback word list
    TRANSCRIPT_SILENCE_MS: 500, // Milliseconds of silence before finalizing transcript
    TRANSCRIPT_MAX_CHARS: 80, // Maximum characters to display in transcript
    MAX_TRANSCRIPT_LINES: 20, // Maximum number of transcript lines to show

    // Rhyme Navigation State - Rhyme browsing functionality
    currentRhymeList: [], // Holds the valid rhymes for the currentWord
    currentRhymeIndex: -1, // Index within currentRhymeList (-1 means none selected, displaying base word)
    rhymeSortMode: 'default', // 'default', 'alphabetical', 'high-similarity' - Controls rhyme navigation sorting

    // --- Tooltip State Management ---
    tooltip: {
        isPinned: false, // Whether tooltip is pinned open
        displayMode: 'both', // 'both', 'synonyms', or 'definition'
        lastClickTimestamp: 0 // Timestamp of last tooltip interaction
    },
};