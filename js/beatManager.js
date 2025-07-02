// js/beatManager.js
// Handles beat playback using Howler.js library

import * as ui from './ui.js';
import * as storage from './storage.js';

// --- Beat Playlist Configuration ---
const BEAT_PLAYLIST = [
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
    }
];

// --- State Management ---
let currentBeatIndex = 0;
let currentHowl = null;
let isPlaying = false;
let volume = 0.7; // Default volume (0.0 to 1.0)

// --- Core Audio Functions ---

export function initializeBeatPlayer() {
    // Load saved settings
    const savedSettings = storage.loadBeatPlayerSettings();
    if (savedSettings) {
        currentBeatIndex = savedSettings.currentBeatIndex || 0;
        volume = savedSettings.volume || 0.7;
    }
    
    // Update UI with current beat info
    updateBeatDisplay();
    updateVolumeDisplay();
    
    console.log('Beat Player initialized');
}

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
    
    if (currentHowl) {
        currentHowl.play();
        isPlaying = true;
        updatePlayPauseButton();
        ui.showFeedback('Beat started', false, 1000);
    }
}

export function pause() {
    if (currentHowl && isPlaying) {
        currentHowl.pause();
        isPlaying = false;
        updatePlayPauseButton();
        ui.showFeedback('Beat paused', false, 1000);
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
        currentBeatIndex = 0; // Loop to first beat
    }
    switchToBeat(currentBeatIndex);
}

export function previousBeat() {
    if (currentBeatIndex > 0) {
        currentBeatIndex--;
    } else {
        currentBeatIndex = BEAT_PLAYLIST.length - 1; // Loop to last beat
    }
    switchToBeat(currentBeatIndex);
}

export function setVolume(newVolume) {
    volume = Math.max(0, Math.min(1, newVolume));
    
    if (currentHowl) {
        currentHowl.volume(volume);
    }
    
    updateVolumeDisplay();
    storage.saveBeatPlayerSettings(currentBeatIndex, volume);
}

export function getCurrentBeatInfo() {
    return {
        name: BEAT_PLAYLIST[currentBeatIndex].name,
        index: currentBeatIndex,
        total: BEAT_PLAYLIST.length,
        isPlaying: isPlaying
    };
}

// --- Helper Functions ---

function loadCurrentBeat() {
    // Stop current beat if playing
    if (currentHowl) {
        currentHowl.stop();
        currentHowl.unload();
    }
    
    const beatInfo = BEAT_PLAYLIST[currentBeatIndex];
    
    currentHowl = new Howl({
        src: [beatInfo.file],
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
            // Auto-play next beat if it was playing
            if (isPlaying) {
                nextBeat();
            }
        }
    });
}

function switchToBeat(index) {
    const wasPlaying = isPlaying;
    
    // Stop current beat
    if (currentHowl) {
        currentHowl.stop();
        currentHowl.unload();
        currentHowl = null;
    }
    
    currentBeatIndex = index;
    updateBeatDisplay();
    
    // Load and play new beat if it was playing before
    if (wasPlaying) {
        loadCurrentBeat();
        play();
    }
    
    storage.saveBeatPlayerSettings(currentBeatIndex, volume);
    ui.showFeedback(`Switched to: ${BEAT_PLAYLIST[currentBeatIndex].name}`, false, 2000);
}

function updateBeatDisplay() {
    const beatDisplay = document.getElementById('current-beat-display');
    if (beatDisplay) {
        const beatInfo = BEAT_PLAYLIST[currentBeatIndex];
        beatDisplay.textContent = `${currentBeatIndex + 1}/${BEAT_PLAYLIST.length}: ${beatInfo.name}`;
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
        volumeSlider.value = volume * 100; // Convert to percentage
    }
}

// --- Public API for external access ---
export function getPlaylist() {
    return BEAT_PLAYLIST;
}

export function getCurrentVolume() {
    return volume;
}

export function isCurrentlyPlaying() {
    return isPlaying;
} 