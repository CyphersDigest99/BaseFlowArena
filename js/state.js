// js/state.js
// Holds the shared application state.

export const state = {
    // Word State
    wordList: [],
    filteredWordList: [],
    currentWord: '',
    currentWordIndex: -1,
    wordOrderMode: 'random', // 'random', 'alphabetical', 'sequential'
    history: [],
    MAX_HISTORY: 20,

    // Lists & Data
    blacklist: new Set(),
    favorites: new Set(),
    wordFrequencies: {},
    rhymeData: null,
    rejectedRhymes: {}, // { baseWord: Set('rejected1', 'rejected2'), ... }
    manualRhymes: {},   // { baseWord: Set('manual1', 'manual2'), ... }

    // Activation & Modes
    activationMode: 'manual', // 'manual', 'voice', 'timed'
    isMicActive: false, // Tracks actual hardware state
    recognition: null, // SpeechRecognition instance
    lastMatchedWord: null, // Debounce for voice match
    finalTranscript: '',
    interimTranscript: '',
    transcriptTimeout: null,
    timedInterval: null,
    voiceRhymeMode: false, // NEW: Controls whether voice matches should navigate rhymes

    // BPM / Rhythm
    bpm: 0,
	bpmMultiplier: 1, // Default multiplier is 1x (no button selected)
	isDetectingBpm: false, // Flag for UI feedback during BPM detection
    bpmClickTimestamps: [],
    BPM_AVERAGE_COUNT: 10,
    beatIntervalId: null,
    currentBeat: 0,
    beatGridRows: 1,
    beatGridCols: 4,
    isBpmLockedShaking: false, // For word display buzz effect

    // Gamification
    score: 0,
    currentStreak: 0,

    // Settings (Reflected in UI, saved/loaded)
    rngDigits: 3,
    rngSets: 1,
    rngSurprise: false,
    cycleSpeed: 10,
    minSyllables: 0, // Syllable filter minimum
    maxSyllables: 0, // Syllable filter maximum (0 = no limit)

    // Constants
    LEVENSHTEIN_THRESHOLD: 0.7,
    DEFAULT_WORD_LIST: ["practice", "flow", "freestyle", "rhyme", "beat", "mic", "word", "speak", "rap", "skill", "game", "streak", "score", "arena", "threejs", "road", "effect", "background", "visual", "dynamic"],
    TRANSCRIPT_SILENCE_MS: 500,
    TRANSCRIPT_MAX_CHARS: 80,
    MAX_TRANSCRIPT_LINES: 20,

    // Rhyme Navigation State
    currentRhymeList: [], // Holds the valid rhymes for the currentWord
    currentRhymeIndex: -1, // Index within currentRhymeList (-1 means none selected, displaying base word)

    // --- Tooltip State Management ---
    tooltip: {
        isPinned: false,
        displayMode: 'both', // 'both', 'synonyms', or 'definition'
        lastClickTimestamp: 0
    },
};