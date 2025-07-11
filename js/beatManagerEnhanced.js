/**
 * @fileoverview Enhanced Beat Playback and Playlist Manager
 *
 * This enhanced module manages beat playback for the BaseFlowArena application using Howler.js.
 * It loads beat metadata from JSON files and provides rich information including:
 * - BPM detection and storage
 * - Sentiment analysis (mood classification)
 * - Album art display
 * - Waveform visualization data
 * - Artist and genre information
 * - Enhanced UI with metadata display
 *
 * Key features:
 * - Dynamic loading from beats.json or beats_lightweight.json
 * - Rich metadata display (BPM, sentiment, artist info)
 * - Album art support with fallback
 * - Waveform data for visualization
 * - Sentiment-based mood classification
 * - Performance optimization with lightweight mode
 *
 * Dependencies: ui.js, storage.js, bpm.js, Howler.js (global)
 */

import * as ui from './ui.js';
import * as storage from './storage.js';
import * as bpm from './bpm.js';

// --- Configuration ---
const METADATA_CONFIG = {
    full: 'beats.json',           // Full metadata with album art (~64MB)
    lightweight: 'beats_lightweight.json'  // Lightweight without album art (~2MB)
};

// --- State Management ---
let BEAT_PLAYLIST = [];           // Dynamic playlist loaded from metadata
let currentBeatIndex = 0;         // Index of the currently selected beat
let currentHowl = null;           // Howler.js instance for current beat
let isPlaying = false;            // Playback state
let volume = 0.7;                 // Default volume (0.0 to 1.0)
let metadataMode = 'lightweight'; // Current metadata mode
let beatMetadata = null;          // Loaded metadata object

// --- Metadata Loading Functions ---

// Loads beat metadata from JSON file
async function loadBeatMetadata(mode = 'lightweight') {
    try {
        const response = await fetch(METADATA_CONFIG[mode]);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        beatMetadata = await response.json();
        metadataMode = mode;
        
        // Convert metadata to playlist format
        BEAT_PLAYLIST = beatMetadata.beats.map(beat => ({
            name: extractCleanTitle(beat),
            file: beat.filePath || beat.file_path,
            bpm: beat.bpm,
            sentiment: beat.sentimentDisplay || beat.sentiment,
            sentiment_score: beat.sentimentScore || beat.sentiment_score,
            album_art: beat.albumArt || beat.album_art,
            waveform: beat.waveform,
            artist: beat.producer || beat.artist,
            genre: beat.genre,
            duration: beat.duration,
            mood: beat.mood || getMoodFromSentiment(beat.sentimentScore || beat.sentiment_score)
        }));
        
        console.log(`Loaded ${BEAT_PLAYLIST.length} beats from ${mode} metadata`);
        return true;
    } catch (error) {
        console.error(`Failed to load ${mode} metadata:`, error);
        return false;
    }
}

// Converts sentiment score to mood classification
function getMoodFromSentiment(score) {
    if (score >= 7) return 'Energetic';
    if (score >= 5) return 'Neutral';
    if (score >= 3) return 'Melancholic';
    return 'Dark';
}

// Helper to extract a clean title from filename
function extractCleanTitle(beat) {
    if (beat.trackTitle && typeof beat.trackTitle === 'string' && beat.trackTitle.trim().length > 0) {
        return beat.trackTitle.trim();
    }
    // Fallback: use filename
    let file = beat.filePath || beat.file_path || '';
    file = file.split('/').pop().replace(/\.mp3$/i, '');
    // Remove common patterns (type beat, prod, instrumental, etc.)
    file = file.replace(/\b(prod\.?|type beat|instrumental|beat|free|with hook|x|feat\.?|ft\.?|\d{8,})\b/gi, '');
    // Remove extra dashes, underscores, and whitespace
    file = file.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
    // If still too long, take last 3 words
    const words = file.split(' ');
    if (words.length > 4) file = words.slice(-3).join(' ');
    return file || 'Untitled';
}

// Switches between full and lightweight metadata modes
export async function switchMetadataMode(mode) {
    if (mode !== 'full' && mode !== 'lightweight') {
        console.error('Invalid metadata mode:', mode);
        return false;
    }
    
    const wasPlaying = isPlaying;
    const currentFile = BEAT_PLAYLIST[currentBeatIndex]?.file;
    
    // Load new metadata
    const success = await loadBeatMetadata(mode);
    if (!success) return false;
    
    // Find the same beat in new playlist
    if (currentFile) {
        const newIndex = BEAT_PLAYLIST.findIndex(beat => beat.file === currentFile);
        if (newIndex !== -1) {
            currentBeatIndex = newIndex;
        }
    }
    
    // Update UI
    updateBeatDisplay();
    updateMetadataDisplay();
    
    // Restart playback if it was playing
    if (wasPlaying) {
        setTimeout(() => play(), 100);
    }
    
    ui.showFeedback(`Switched to ${mode} mode`, false, 2000);
    return true;
}

// --- Enhanced UI Functions ---

// Updates the metadata display with rich information
function updateMetadataDisplay() {
    const beat = BEAT_PLAYLIST[currentBeatIndex];
    if (!beat) return;
    
    // Update album art
    const albumArt = document.getElementById('album-art');
    if (albumArt) {
        if (beat.album_art && metadataMode === 'full') {
            albumArt.src = beat.album_art;
        } else {
            // Default album art
            albumArt.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nNTAnIGhlaWdodD0nNTAnIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc+PHJlY3Qgd2lkdGg9JzUwJyBoZWlnaHQ9JzUwJyBmaWxsPSIjMzM0Ii8+PHRleHQgeD0nMjUnIHk9JzI3JyBmb250LXNpemU9JzEwJyB0ZXh0LWFuY2hvcj0nbWlkZGxlJyBmaWxsPSIjN2ZmIj5BPC90ZXh0Pjwvc3ZnPg==';
        }
    }
    
    // Update BPM display
    const bpmDiv = document.getElementById('beat-bpm');
    if (bpmDiv && beat.bpm) {
        bpmDiv.textContent = `BPM: ${beat.bpm}`;
        if (bpm && typeof bpm.setBpm === 'function') {
            bpm.setBpm(beat.bpm);
        }
    }
    
    // Update sentiment/mood display
    const moodDiv = document.getElementById('beat-mood');
    if (moodDiv && beat.mood) {
        moodDiv.textContent = `Mood: ${beat.mood}`;
        moodDiv.className = `beat-mood ${beat.mood.toLowerCase()}`;
    }
    
    // Update artist info
    const artistDiv = document.getElementById('beat-artist');
    if (artistDiv && beat.artist) {
        artistDiv.textContent = `Artist: ${beat.artist}`;
    }
    
    // Update duration
    const durationDiv = document.getElementById('beat-duration');
    if (durationDiv && beat.duration) {
        const minutes = Math.floor(beat.duration / 60);
        const seconds = Math.floor(beat.duration % 60);
        durationDiv.textContent = `Duration: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

// --- Core Audio Functions (Enhanced) ---

// Initializes the enhanced beat player
export async function initializeBeatPlayer() {
    // Load saved settings
    const savedSettings = storage.loadBeatPlayerSettings();
    if (savedSettings) {
        currentBeatIndex = savedSettings.currentBeatIndex || 0;
        volume = savedSettings.volume || 0.7;
        metadataMode = savedSettings.metadataMode || 'lightweight';
    }
    
    // Load beat metadata
    const success = await loadBeatMetadata(metadataMode);
    if (!success) {
        console.warn('Failed to load metadata, falling back to lightweight mode');
        await loadBeatMetadata('lightweight');
    }
    
    // Ensure currentBeatIndex is valid
    if (currentBeatIndex >= BEAT_PLAYLIST.length) {
        currentBeatIndex = 0;
    }
    
    // Update UI
    updateBeatDisplay();
    updateMetadataDisplay();
    updateVolumeDisplay();
    loadCurrentBeat();
    
    console.log('Enhanced Beat Player initialized');
    
    // Attach volume slider
    const volSlider = document.getElementById('beat-volume');
    if (volSlider) volSlider.oninput = (e) => setVolume(e.target.value / 100);
}

// Enhanced loadCurrentBeat with metadata
function loadCurrentBeat() {
    cleanupAudio();
    
    const beat = BEAT_PLAYLIST[currentBeatIndex];
    if (!beat) return;
    
    // Update metadata display
    updateMetadataDisplay();
    
    // Load Howler for audio playback
    currentHowl = new Howl({
        src: [encodeURI(beat.file)],
        volume: volume,
        html5: true,
        preload: true,
        onload: () => {
            console.log(`Loaded beat: ${beat.name}`);
        },
        onloaderror: (id, error) => {
            console.error(`Error loading beat: ${beat.name}`, error);
            ui.showFeedback(`Error loading beat: ${beat.name}`, true, 3000);
        },
        onplay: () => {
            isPlaying = true;
            updatePlayPauseButton();
        },
        onpause: () => {
            isPlaying = false;
            updatePlayPauseButton();
        },
        onstop: () => {
            isPlaying = false;
            updatePlayPauseButton();
        },
        onend: () => {
            isPlaying = false;
            updatePlayPauseButton();
        }
    });
}

// --- Standard Audio Control Functions ---

export function playPause() {
    if (!currentHowl) {
        loadCurrentBeat();
    }
    if (isPlaying) {
        pause();
    } else {
        play();
    }
}

export function play() {
    if (!currentHowl) {
        loadCurrentBeat();
    }
    if (currentHowl && !isPlaying) {
        currentHowl.play();
    }
}

export function pause() {
    if (currentHowl && isPlaying) {
        currentHowl.pause();
    }
}

export function stop() {
    if (currentHowl) {
        currentHowl.stop();
        isPlaying = false;
        updatePlayPauseButton();
        ui.showFeedback('Beat stopped', false, 1000);
    }
}

export function nextBeat() {
    if (currentBeatIndex < BEAT_PLAYLIST.length - 1) {
        currentBeatIndex++;
    } else {
        currentBeatIndex = 0;
    }
    switchToBeat(currentBeatIndex);
}

export function previousBeat() {
    if (currentBeatIndex > 0) {
        currentBeatIndex--;
    } else {
        currentBeatIndex = BEAT_PLAYLIST.length - 1;
    }
    console.log('Previous beat pressed, switching to index:', currentBeatIndex);
    switchToBeat(currentBeatIndex);
}

export function setVolume(newVolume) {
    volume = Math.max(0, Math.min(1, newVolume));
    if (currentHowl) {
        currentHowl.volume(volume);
    }
    updateVolumeDisplay();
    storage.saveBeatPlayerSettings(currentBeatIndex, volume, metadataMode);
}

// --- Helper Functions ---

function cleanupAudio() {
    if (currentHowl) {
        try { currentHowl.stop(); } catch (e) {}
        try { currentHowl.unload(); } catch (e) {}
        currentHowl = null;
    }
}

function switchToBeat(index) {
    const wasPlaying = isPlaying;
    
    cleanupAudio();
    currentBeatIndex = index;
    updateBeatDisplay();
    updateMetadataDisplay();
    loadCurrentBeat();
    
    if (wasPlaying) {
        setTimeout(() => play(), 100);
    }
    
    storage.saveBeatPlayerSettings(currentBeatIndex, volume, metadataMode);
    ui.showFeedback(`Switched to: ${BEAT_PLAYLIST[currentBeatIndex].name}`, false, 2000);
}

function updateBeatDisplay() {
    const beatDisplay = document.getElementById('current-beat-display');
    if (beatDisplay) {
        const beat = BEAT_PLAYLIST[currentBeatIndex];
        if (beat) {
            beatDisplay.textContent = `${currentBeatIndex + 1}/${BEAT_PLAYLIST.length}: ${beat.name}`;
        }
    }
}

function updatePlayPauseButton() {
    const playPauseBtn = document.getElementById('beat-play-pause');
    if (playPauseBtn) {
        const icon = playPauseBtn.querySelector('i');
        if (icon) {
            icon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
        }
    }
}

function updateVolumeDisplay() {
    const volumeSlider = document.getElementById('beat-volume');
    if (volumeSlider) {
        volumeSlider.value = volume * 100;
    }
}

// --- Public API ---

export function getCurrentBeatInfo() {
    const beat = BEAT_PLAYLIST[currentBeatIndex];
    return {
        name: beat?.name || 'Unknown',
        index: currentBeatIndex,
        total: BEAT_PLAYLIST.length,
        isPlaying: isPlaying,
        bpm: beat?.bpm,
        mood: beat?.mood,
        artist: beat?.artist,
        duration: beat?.duration
    };
}

export function getPlaylist() {
    return BEAT_PLAYLIST;
}

export function getCurrentVolume() {
    return volume;
}

export function isCurrentlyPlaying() {
    return isPlaying;
}

export function getCurrentMetadataMode() {
    return metadataMode;
}

// Get waveform data for current beat (if available)
export function getCurrentWaveform() {
    const beat = BEAT_PLAYLIST[currentBeatIndex];
    return beat?.waveform || null;
}

// Get sentiment data for current beat
export function getCurrentSentiment() {
    const beat = BEAT_PLAYLIST[currentBeatIndex];
    return {
        score: beat?.sentiment_score,
        classification: beat?.sentiment,
        mood: beat?.mood
    };
} 