/**
 * @fileoverview Beat Playback and Playlist Manager (Howler.js)
 *
 * This module manages beat playback for the BaseFlowArena application using Howler.js.
 * It handles playlist management, audio playback controls, volume, BPM per track,
 * and UI synchronization for the beat player.
 *
 * Key responsibilities:
 * - Managing the beat playlist and adding new beats
 * - Initializing and controlling audio playback (play, pause, stop, next, previous)
 * - Handling volume and playback state
 * - Storing and retrieving BPM per track
 * - Synchronizing UI elements with playback state
 * - Loading album art and BPM metadata (if available)
 *
 * Dependencies: ui.js, storage.js, bpm.js, Howler.js (global)
 */

// js/beatManager.js
// Handles beat playback using Howler.js library

import * as ui from './ui.js';
import * as storage from './storage.js';
import * as bpm from './bpm.js'; // For setBpm

// --- Beat Playlist Configuration ---
// List of available beats for playback
let BEAT_PLAYLIST = [
    {
        name: "Symphony (Storytelling Hip-Hop)",
        file: "beats/20170904_A Storytelling Hip-Hop Beat ｜｜ ＂Symphony＂ (Prod. Flakron).mp3"
    },
    {
        name: "If I Lose You (XXXTENTACION Type Beat)",
        file: "beats/20180701_XXXTENTACION - If I Lose You (feat. Shiloh Dynasty) ｜ TYPE BEAT.mp3"
    },
    {
        name: "Morning Sun (J. Cole Type Beat)",
        file: "beats/20180720_Free J Cole Type Beat - ＂Morning Sun＂.mp3"
    },
    {
        name: "On The Edge (Chill Type Beat)",
        file: "beats/20190911_FREE ＂On The Edge＂ J. Cole Type Beat ｜ Chill Type Beat.mp3"
    },
    {
        name: "Hope (Sad Guitar Hip Hop)",
        file: "beats/20191109_｜ FREE ｜ Sad Guitar Hip Hop Beat ⧹⧹ ＂Hope＂ (Prod. Aksil).mp3"
    },
    {
        name: "Triton (J. Cole x Isaiah Rashad x Kendrick Type Beat)",
        file: "beats/20191124_[FREE] J. Cole x Isaiah Rashad x Kendrick Lamar Type Beat ｜ ＂Triton＂.mp3"
    },
    {
        name: "Hold Me Down (Roddy Ricch x Polo G Type Beat)",
        file: "beats/20200301_(FREE) Roddy Ricch x Polo G Type Beat ＂Hold Me Down＂ ｜ Lil Durk Type Beat.mp3"
    },
    {
        name: "Your Beat 1",
        file: "beats/yourbeat1.mp3"
    },
    {
        name: "Wet Dreamz (J. Cole Instrumental)",
        file: "beats/20141208_J. Cole - Wet Dreamz (INSTRUMENTAL).mp3"
    }
];

// --- Auto-Discover MP3s Function ---
// (Currently a stub; returns manual playlist)
async function discoverMP3Files() {
    try {
        // This would work if you had a server endpoint to list files
        // For now, we'll keep the manual playlist but add a helper function
        console.log('MP3 discovery: Currently using manual playlist. Add files to BEAT_PLAYLIST array.');
        return BEAT_PLAYLIST;
    } catch (error) {
        console.warn('Could not auto-discover MP3s:', error);
        return BEAT_PLAYLIST;
    }
}

// --- Helper Function to Add New MP3s ---
// Adds a new MP3 file to the playlist and updates the UI
export function addMP3ToPlaylist(filePath, displayName = null) {
    const fileName = filePath.split('/').pop().replace('.mp3', '');
    const name = displayName || fileName.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
    
    const newBeat = {
        name: name,
        file: filePath
    };
    
    BEAT_PLAYLIST.push(newBeat);
    console.log(`Added new beat: ${name} (${filePath})`);
    
    // Update UI if player is already initialized
    updateBeatDisplay();
    
    return newBeat;
}

// --- State Management ---
let currentBeatIndex = 0; // Index of the currently selected beat
let currentHowl = null;   // Howler.js instance for current beat
let isPlaying = false;    // Playback state
let volume = 0.7;         // Default volume (0.0 to 1.0)

// --- Simple Howler-only State ---
let suppressSeekEvent = false;

// --- BPM per Track Storage ---
// Returns a unique storage key for a beat's BPM
function getBpmStorageKey(beatFile) {
    return 'bpm_for_' + encodeURIComponent(beatFile);
}
// Saves the BPM value for the current track to localStorage
export function saveBpmForCurrentTrack(bpmValue) {
    const beatInfo = BEAT_PLAYLIST[currentBeatIndex];
    if (beatInfo && bpmValue) {
        localStorage.setItem(getBpmStorageKey(beatInfo.file), bpmValue);
    }
}
// Retrieves the saved BPM value for the current track
function getSavedBpmForCurrentTrack() {
    const beatInfo = BEAT_PLAYLIST[currentBeatIndex];
    if (beatInfo) {
        const val = localStorage.getItem(getBpmStorageKey(beatInfo.file));
        return val ? parseInt(val) : null;
    }
    return null;
}

// --- Play/Pause Sync Flag ---
let suppressPlayPause = false;

// --- Core Audio Functions ---

// Initializes the beat player, loads settings, and sets up UI
export function initializeBeatPlayer() {
    // Load saved settings
    const savedSettings = storage.loadBeatPlayerSettings();
    if (savedSettings) {
        currentBeatIndex = savedSettings.currentBeatIndex || 0;
        volume = savedSettings.volume || 0.7;
    }
    
    // Ensure currentBeatIndex is valid
    if (currentBeatIndex >= BEAT_PLAYLIST.length) {
        currentBeatIndex = 0;
    }
    
    // Simple Howler-only setup - no WaveSurfer
    
    // Update UI with current beat info
    updateBeatDisplay();
    updateVolumeDisplay();
    loadCurrentBeat(); // Load album art, bpm, and audio
    console.log('Beat Player initialized');

    // Note: Event listeners are attached in main.js to avoid duplicates
    // Only attach volume slider here since it's not handled in main.js
    const volSlider = document.getElementById('beat-volume');
    if (volSlider) volSlider.oninput = (e) => setVolume(e.target.value / 100);
}

// Toggles play/pause for the current beat
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

// Starts playback of the current beat
export function play() {
    if (!currentHowl) {
        loadCurrentBeat();
    }
    if (currentHowl && !isPlaying) {
        currentHowl.play();
    }
}

// Pauses playback of the current beat
export function pause() {
    if (currentHowl && isPlaying) {
        currentHowl.pause();
    }
}

// Stops playback and resets state/UI
export function stop() {
    if (currentHowl) {
        currentHowl.stop();
        isPlaying = false;
        updatePlayPauseButton();
        ui.showFeedback('Beat stopped', false, 1000);
    }
}

// Advances to the next beat in the playlist
export function nextBeat() {
    if (currentBeatIndex < BEAT_PLAYLIST.length - 1) {
        currentBeatIndex++;
    } else {
        currentBeatIndex = 0; // Loop to first beat
    }
    switchToBeat(currentBeatIndex);
}

// Goes to the previous beat in the playlist
export function previousBeat() {
    if (currentBeatIndex > 0) {
        currentBeatIndex--;
    } else {
        currentBeatIndex = BEAT_PLAYLIST.length - 1; // Loop to last beat
    }
    switchToBeat(currentBeatIndex);
}

// Sets the playback volume (0.0 to 1.0)
export function setVolume(newVolume) {
    volume = Math.max(0, Math.min(1, newVolume));
    // Only set volume, never create or reload Howl
    if (currentHowl) {
        currentHowl.volume(volume);
    }
    updateVolumeDisplay();
    storage.saveBeatPlayerSettings(currentBeatIndex, volume);
}

// Returns info about the current beat
export function getCurrentBeatInfo() {
    return {
        name: BEAT_PLAYLIST[currentBeatIndex].name,
        index: currentBeatIndex,
        total: BEAT_PLAYLIST.length,
        isPlaying: isPlaying
    };
}

// --- Helper Functions ---

// --- Robust Cleanup Function ---
// Stops and unloads the current Howler instance
function cleanupAudio() {
    if (currentHowl) {
        try { currentHowl.stop(); } catch (e) {}
        try { currentHowl.unload(); } catch (e) {}
        currentHowl = null;
    }
    // Don't reset isPlaying here - let the caller handle that
}

// Switches to a new beat by index, loads audio, and updates UI
function switchToBeat(index) {
    const wasPlaying = isPlaying; // Remember if we were playing
    
    cleanupAudio();
    currentBeatIndex = index;
    updateBeatDisplay();
    loadCurrentBeat();
    
    // Always try to play if we were playing before
    if (wasPlaying) {
        // Small delay to ensure Howler is ready
        setTimeout(() => {
            play();
        }, 100);
    }
    
    storage.saveBeatPlayerSettings(currentBeatIndex, volume);
    ui.showFeedback(`Switched to: ${BEAT_PLAYLIST[currentBeatIndex].name}`, false, 2000);
}

// Loads the current beat's audio, album art, and BPM metadata
function loadCurrentBeat() {
    cleanupAudio();
    // Reset album art and BPM
    const albumArt = document.getElementById('album-art');
    const defaultArt = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nNTAnIGhlaWdodD0nNTAnIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc+PHJlY3Qgd2lkdGg9JzUwJyBoZWlnaHQ9JzUwJyBmaWxsPSIjMzM0Ii8+PHRleHQgeD0nMjUnIHk9JzI3JyBmb250LXNpemU9JzEwJyB0ZXh0LWFuY2hvcj0nbWlkZGxlJyBmaWxsPSIjN2ZmIj5BPC90ZXh0Pjwvc3ZnPg==';
    if (albumArt) albumArt.src = defaultArt;
    const bpmDiv = document.getElementById('beat-bpm');
    if (bpmDiv) bpmDiv.textContent = '';

    const beatInfo = BEAT_PLAYLIST[currentBeatIndex];

    // --- BPM Priority: Saved > Metadata ---
    let bpmValue = getSavedBpmForCurrentTrack();
    if (bpmValue) {
        if (bpmDiv) bpmDiv.textContent = `BPM: ${bpmValue}`;
        if (bpm && typeof bpm.setBpm === 'function') {
            bpm.setBpm(bpmValue);
        }
    } else if (window.jsmediatags) {
        try {
            window.jsmediatags.read(beatInfo.file, {
                onSuccess: function(tag) {
                    // Album art
                    if (tag.tags.picture) {
                        const { data, format } = tag.tags.picture;
                        let base64String = '';
                        if (Array.isArray(data)) {
                            base64String = btoa(String.fromCharCode.apply(null, data));
                        } else {
                            base64String = btoa(String.fromCharCode(...new Uint8Array(data)));
                        }
                        if (albumArt) albumArt.src = `data:${format};base64,${base64String}`;
                    } else {
                        if (albumArt) albumArt.src = defaultArt;
                    }
                    // BPM from metadata
                    if (tag.tags.TBPM || tag.tags.bpm) {
                        const metaBpm = parseInt(tag.tags.TBPM || tag.tags.bpm);
                        if (metaBpm && bpmDiv) {
                            bpmDiv.textContent = `BPM: ${metaBpm}`;
                            if (bpm && typeof bpm.setBpm === 'function') {
                                bpm.setBpm(metaBpm);
                            }
                        }
                    }
                },
                onError: function(error) {
                    console.warn('jsmediatags error:', error);
                    if (albumArt) albumArt.src = defaultArt;
                }
            });
        } catch (err) {
            console.warn('jsmediatags exception:', err);
            if (albumArt) albumArt.src = defaultArt;
        }
    } else {
        if (albumArt) albumArt.src = defaultArt;
    }

    // Load Howler for audio playback
    currentHowl = new Howl({
        src: [encodeURI(beatInfo.file)],
        volume: volume,
        html5: true, // Use HTML5 Audio for better compatibility
        preload: true,
        onload: () => {
            console.log(`Loaded beat: ${beatInfo.name}`);
        },
        onloaderror: (id, error) => {
            console.error(`Error loading beat: ${beatInfo.name}`, error);
            ui.showFeedback(`Error loading beat: ${beatInfo.name}`, true, 3000);
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
            // Auto-play next beat (optional - uncomment if you want auto-advance)
            // nextBeat();
        }
    });
}

// Updates the beat display UI with current beat info
function updateBeatDisplay() {
    const beatDisplay = document.getElementById('current-beat-display');
    if (beatDisplay) {
        const beatInfo = BEAT_PLAYLIST[currentBeatIndex];
        beatDisplay.textContent = `${currentBeatIndex + 1}/${BEAT_PLAYLIST.length}: ${beatInfo.name}`;
    }
}

// Updates the play/pause button icon based on playback state
function updatePlayPauseButton() {
    const playPauseBtn = document.getElementById('beat-play-pause');
    if (playPauseBtn) {
        const icon = playPauseBtn.querySelector('i');
        if (icon) {
            icon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
        }
    }
}

// Updates the volume slider UI to match current volume
function updateVolumeDisplay() {
    const volumeSlider = document.getElementById('beat-volume');
    if (volumeSlider) {
        volumeSlider.value = volume * 100; // Convert to percentage
    }
}

// --- Public API for external access ---
// Returns the current playlist array
export function getPlaylist() {
    return BEAT_PLAYLIST;
}

// Returns the current playback volume
export function getCurrentVolume() {
    return volume;
}

// Returns whether a beat is currently playing
export function isCurrentlyPlaying() {
    return isPlaying;
} 