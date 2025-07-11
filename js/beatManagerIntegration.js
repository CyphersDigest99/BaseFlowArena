/**
 * @fileoverview Beat Manager Integration and Migration Helper
 *
 * This module provides utilities for migrating from the old beat manager to the enhanced one
 * and includes helper functions for testing and switching between metadata modes.
 *
 * Usage:
 * 1. Replace import in main.js: import * as beatManager from './beatManagerEnhanced.js';
 * 2. Use the utility functions to test different modes
 * 3. Add UI controls for switching between full/lightweight modes
 */

import * as beatManager from './beatManagerEnhanced.js';
import * as ui from './ui.js';

// --- Migration Helper Functions ---

/**
 * Migrates from old beat manager to enhanced beat manager
 * Call this after replacing the import in main.js
 */
export async function migrateToEnhancedBeatManager() {
    try {
        await beatManager.initializeBeatPlayer();
        console.log('Successfully migrated to enhanced beat manager');
        
        // Add metadata mode controls to UI
        addMetadataModeControls();
        
        return true;
    } catch (error) {
        console.error('Failed to migrate to enhanced beat manager:', error);
        return false;
    }
}

/**
 * Adds UI controls for switching between metadata modes
 */
function addMetadataModeControls() {
    // Look for existing beat player controls
    const beatPlayerContainer = document.querySelector('.beat-player') || 
                               document.getElementById('beat-player') ||
                               document.querySelector('[data-beat-player]');
    
    if (!beatPlayerContainer) {
        console.warn('Beat player container not found, cannot add metadata controls');
        return;
    }
    
    // Create metadata mode selector
    const modeSelector = document.createElement('div');
    modeSelector.className = 'metadata-mode-selector';
    modeSelector.innerHTML = `
        <label for="metadata-mode">Metadata Mode:</label>
        <select id="metadata-mode" title="Switch between full and lightweight metadata">
            <option value="lightweight">Lightweight (Fast)</option>
            <option value="full">Full (Album Art)</option>
        </select>
    `;
    
    // Insert before the first control
    const firstControl = beatPlayerContainer.querySelector('.beat-controls') || 
                        beatPlayerContainer.querySelector('button') ||
                        beatPlayerContainer.firstElementChild;
    
    if (firstControl) {
        beatPlayerContainer.insertBefore(modeSelector, firstControl);
    } else {
        beatPlayerContainer.appendChild(modeSelector);
    }
    
    // Set initial value
    const select = modeSelector.querySelector('#metadata-mode');
    select.value = beatManager.getCurrentMetadataMode();
    
    // Add event listener
    select.addEventListener('change', async (e) => {
        const newMode = e.target.value;
        const success = await beatManager.switchMetadataMode(newMode);
        if (success) {
            ui.showFeedback(`Switched to ${newMode} mode`, false, 2000);
        } else {
            ui.showFeedback(`Failed to switch to ${newMode} mode`, true, 2000);
            // Revert selection
            select.value = beatManager.getCurrentMetadataMode();
        }
    });
}

// --- Testing and Utility Functions ---

/**
 * Tests the enhanced beat manager with different metadata modes
 */
export async function testEnhancedBeatManager() {
    console.log('Testing enhanced beat manager...');
    
    // Test lightweight mode
    console.log('Testing lightweight mode...');
    await beatManager.switchMetadataMode('lightweight');
    const lightweightInfo = beatManager.getCurrentBeatInfo();
    console.log('Lightweight mode beat info:', lightweightInfo);
    
    // Test full mode
    console.log('Testing full mode...');
    await beatManager.switchMetadataMode('full');
    const fullInfo = beatManager.getCurrentBeatInfo();
    console.log('Full mode beat info:', fullInfo);
    
    // Test sentiment data
    const sentiment = beatManager.getCurrentSentiment();
    console.log('Current beat sentiment:', sentiment);
    
    // Test waveform data
    const waveform = beatManager.getCurrentWaveform();
    console.log('Current beat waveform available:', !!waveform);
    
    console.log('Enhanced beat manager test completed');
}

/**
 * Displays information about all available beats
 */
export function displayAllBeatsInfo() {
    const playlist = beatManager.getPlaylist();
    console.log(`Total beats available: ${playlist.length}`);
    
    playlist.forEach((beat, index) => {
        console.log(`${index + 1}. ${beat.name}`);
        console.log(`   File: ${beat.file}`);
        console.log(`   BPM: ${beat.bpm || 'Unknown'}`);
        console.log(`   Mood: ${beat.mood || 'Unknown'}`);
        console.log(`   Artist: ${beat.artist || 'Unknown'}`);
        console.log(`   Duration: ${beat.duration ? `${Math.floor(beat.duration / 60)}:${Math.floor(beat.duration % 60).toString().padStart(2, '0')}` : 'Unknown'}`);
        console.log('---');
    });
}

/**
 * Finds beats by mood
 */
export function findBeatsByMood(mood) {
    const playlist = beatManager.getPlaylist();
    return playlist.filter(beat => beat.mood && beat.mood.toLowerCase() === mood.toLowerCase());
}

/**
 * Finds beats by BPM range
 */
export function findBeatsByBPM(minBPM, maxBPM) {
    const playlist = beatManager.getPlaylist();
    return playlist.filter(beat => beat.bpm && beat.bpm >= minBPM && beat.bpm <= maxBPM);
}

/**
 * Gets statistics about the beat collection
 */
export function getBeatCollectionStats() {
    const playlist = beatManager.getPlaylist();
    const stats = {
        total: playlist.length,
        moods: {},
        bpmRanges: {
            slow: 0,    // 60-90 BPM
            medium: 0,  // 90-120 BPM
            fast: 0     // 120+ BPM
        },
        artists: {},
        averageBPM: 0
    };
    
    let totalBPM = 0;
    let bpmCount = 0;
    
    playlist.forEach(beat => {
        // Count moods
        if (beat.mood) {
            stats.moods[beat.mood] = (stats.moods[beat.mood] || 0) + 1;
        }
        
        // Count BPM ranges
        if (beat.bpm) {
            totalBPM += beat.bpm;
            bpmCount++;
            
            if (beat.bpm < 90) stats.bpmRanges.slow++;
            else if (beat.bpm < 120) stats.bpmRanges.medium++;
            else stats.bpmRanges.fast++;
        }
        
        // Count artists
        if (beat.artist) {
            stats.artists[beat.artist] = (stats.artists[beat.artist] || 0) + 1;
        }
    });
    
    if (bpmCount > 0) {
        stats.averageBPM = Math.round(totalBPM / bpmCount);
    }
    
    return stats;
}

// --- Quick Access Functions ---

/**
 * Quick function to switch to a specific beat by name
 */
export function switchToBeatByName(beatName) {
    const playlist = beatManager.getPlaylist();
    const index = playlist.findIndex(beat => 
        beat.name.toLowerCase().includes(beatName.toLowerCase())
    );
    
    if (index !== -1) {
        // This would need to be implemented in the beat manager
        console.log(`Found beat "${beatName}" at index ${index}`);
        return index;
    } else {
        console.log(`Beat "${beatName}" not found`);
        return -1;
    }
}

/**
 * Quick function to get a random beat
 */
export function getRandomBeat() {
    const playlist = beatManager.getPlaylist();
    const randomIndex = Math.floor(Math.random() * playlist.length);
    return playlist[randomIndex];
}

// --- Export all beat manager functions for convenience ---
export const {
    initializeBeatPlayer,
    playPause,
    play,
    pause,
    stop,
    nextBeat,
    previousBeat,
    setVolume,
    getCurrentBeatInfo,
    getPlaylist,
    getCurrentVolume,
    isCurrentlyPlaying,
    getCurrentMetadataMode,
    getCurrentWaveform,
    getCurrentSentiment,
    switchMetadataMode
} = beatManager; 